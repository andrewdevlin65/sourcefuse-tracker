import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import CLIENT from '../../../config/client';

export async function POST(request) {
  try {
    const body = await request.json();
    const { clientId, filename, fileData, secret, receivedAt } = body;

    if (secret !== process.env.INGEST_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!fileData || !filename) {
      return Response.json({ error: 'Missing file data' }, { status: 400 });
    }

    const buffer = Buffer.from(fileData, 'base64');
    const filenameLower = filename.toLowerCase();
    let result;

    if (filenameLower.includes('invoiced_supplied_unsupplied') ||
        filenameLower.includes('supplied') ||
        filenameLower.includes('unsupplied')) {
      result = await processBowWave(buffer, clientId, receivedAt, filename);
    } else {
      return Response.json({ error: 'Unknown file type', filename }, { status: 400 });
    }

    console.log(`[ingest-email] ${clientId} | ${filename} | ${result.rowsUpserted} rows`);
    return Response.json({ success: true, filename, clientId, ...result });

  } catch (err) {
    console.error('[ingest-email] Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function parseParametersSheet(zip) {
  // Find the sheet index for "Parameters" tab
  const workbookFile = zip.file('xl/workbook.xml');
  if (!workbookFile) return null;
  const workbookXml = await workbookFile.async('string');

  // Find sheet named Parameters
  const sheetMatch = workbookXml.match(/<sheet[^>]+name="Parameters"[^>]+r:id="([^"]+)"/);
  if (!sheetMatch) return null;
  const rId = sheetMatch[1];

  // Get the sheet file path from relationships
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (!relsFile) return null;
  const relsXml = await relsFile.async('string');
  const relMatch = relsXml.match(new RegExp(`Id="${rId}"[^>]+Target="([^"]+)"`));
  if (!relMatch) return null;

  const sheetPath = `xl/${relMatch[1]}`;
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) return null;

  const sheetXml = await sheetFile.async('string');

  // Extract all inline string values
  const values = [];
  const cellMatches = sheetXml.matchAll(/<is><t[^>]*>(.*?)<\/t><\/is>/gs);
  for (const m of cellMatches) values.push(m[1].trim());

  // Find Date value — it follows the "Date:" label
  const dateIdx = values.findIndex(v => v.toLowerCase() === 'date:');
  if (dateIdx !== -1 && values[dateIdx + 1]) {
    return values[dateIdx + 1]; // e.g. "22 Mar 2026 06:31 AM GMT+10:00"
  }
  return null;
}

// Convert Excel serial date to YYYY-MM-DD string
function xlDate(v) {
  if (!v) return null;
  if (typeof v === 'string' && v.includes('-')) return v;
  const n = parseFloat(v);
  if (isNaN(n) || n < 1000) return null;
  return new Date(Math.round((n - 25569) * 86400000)).toISOString().split('T')[0];
}

// Month label from date string e.g. "Mar 2026"
function mLabel(d) {
  if (!d) return null;
  try { return new Date(d + 'T12:00:00').toLocaleString('default', { month: 'short', year: 'numeric' }); } catch { return null; }
}

async function processBowWave(buffer, clientId, receivedAt, filename) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const zip = await JSZip.loadAsync(buffer);

  // Extract report generated time from Parameters tab
  const reportDateStr = await parseParametersSheet(zip);
  const reportGeneratedAt = reportDateStr
    ? new Date(reportDateStr).toISOString()
    : receivedAt;

  console.log(`[ingest-email] Report generated at: ${reportDateStr} → ${reportGeneratedAt}`);

  // Determine import_date from filename (e.g. Invoiced_Supplied_Unsupplied_20260321.xlsx)
  const dateMatch = filename.match(/(\d{8})/);
  let importDate;
  if (dateMatch) {
    const d = dateMatch[1];
    importDate = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  } else {
    const now = new Date();
    importDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // Parse shared strings
  const ssXml = await zip.file('xl/sharedStrings.xml')?.async('string') || '';
  const strings = [];
  const siMatches = ssXml.match(/<si>[\s\S]*?<\/si>/g) || [];
  siMatches.forEach(si => {
    const texts = si.match(/<t[^>]*>([^<]*)<\/t>/g) || [];
    strings.push(texts.map(t => t.replace(/<[^>]+>/g, '')).join(''));
  });

  // Parse data sheet
  const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
  if (!sheetXml) throw new Error('sheet1.xml not found');
  const rowMatches = sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];

  const getCell = (cellXml) => {
    if (cellXml.includes('inlineStr')) {
      const m = cellXml.match(/<t[^>]*>([^<]*)<\/t>/);
      return m ? m[1] : null;
    }
    const v = cellXml.match(/<v>([^<]*)<\/v>/);
    if (!v) return null;
    if (cellXml.includes('t="s"')) return strings[parseInt(v[1])] ?? null;
    return v[1];
  };

  const rows = [];
  let lastA = '', lastB = '', lastE = '';

  rowMatches.forEach((rowXml, rowIdx) => {
    if (rowIdx === 0) return;
    const cells = {};
    const matches = [...rowXml.matchAll(/<c{1,2} r="([^"]+)"([^>]*)>([\s\S]*?)<\/c{1,2}>/g)];
    for (const m of matches) {
      const col = m[1].replace(/[0-9]/g, '').toUpperCase();
      cells[col] = getCell(m[0]);
    }
    if (cells['A']) lastA = cells['A'];
    if (cells['B']) lastB = cells['B'];
    if (cells['E']) lastE = cells['E'];
    if (!cells['N'] && !cells['O']) return;
    const amt = parseFloat(cells['N']) || 0;
    const invAmt = parseFloat(cells['O']) || 0;
    const qtyOnShip = parseFloat(cells['Y']) || 0;
    const unshippedQty = parseFloat(cells['Z']) || 0;
    const orderDate = xlDate(cells['C']);
    const requestedOn = xlDate(cells['T']);
    const shipDate = xlDate(cells['S']);
    let category = 'invoiced';
    if (invAmt === 0 && qtyOnShip === 0 && unshippedQty > 0) category = 'unsupplied';
    else if (qtyOnShip > 0 && invAmt === 0) category = 'sni';
    rows.push({
      client_id: CLIENT.id,
      order_nbr: lastE || ('ROW-' + rowIdx),
      order_date: orderDate,
      requested_on: requestedOn,
      customer_name: lastB || '',
      order_total_aud: amt,
      shipment_nbr: qtyOnShip > 0 ? 'shipped' : null,
      shipment_date: shipDate,
      status: category,
      invoice_nbr: invAmt > 0 ? 'invoiced' : null,
      invoice_date: invAmt > 0 ? requestedOn : null,
      invoice_total_aud: invAmt,
      unbilled_qty: 0,
      unshipped_qty: unshippedQty,
      import_date: importDate,
      month_label: mLabel(requestedOn || orderDate),
    });
  });

  if (rows.length === 0) throw new Error('No data rows parsed from file');

  // Clear existing rows for this import date and insert
  await supabase.from('bow_orders').delete().eq('client_id', CLIENT.id).eq('import_date', importDate);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('bow_orders').insert(rows.slice(i, i + 500));
    if (error) throw error;
  }

  // Upsert bow_snapshots summary
  const unsup = rows.filter(r => r.status === 'unsupplied');
  const sni = rows.filter(r => r.status === 'sni');
  const inv = rows.filter(r => r.status === 'invoiced');
  await supabase.from('bow_snapshots').upsert({
    client_id: CLIENT.id,
    import_date: importDate,
    total_orders: rows.length,
    total_unsupplied: unsup.reduce((s, r) => s + r.order_total_aud, 0),
    total_supplied_not_invoiced: sni.reduce((s, r) => s + r.order_total_aud, 0),
    total_invoiced: inv.reduce((s, r) => s + r.invoice_total_aud, 0),
  }, { onConflict: 'client_id,import_date' });

  // Log ingest with report timestamp
  await supabase.from('ingest_log').insert({
    client_id: clientId,
    filename,
    rows_upserted: rows.length,
    report_generated_at: reportGeneratedAt,
    received_at: receivedAt,
  }).then(({ error }) => { if (error) console.warn('ingest_log write failed:', error.message); });

  return { rowsUpserted: rows.length, type: 'bow_wave', reportGeneratedAt, importDate };
}
