import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import CLIENT from '../../../config/client'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(req) {
  const { question } = await req.json()

  const currentFY = CLIENT.getCurrentFY()
  const { data: forecasts } = await supabase.from('forecasts').select('*').order('period_start', { ascending: false }).limit(50)
  const { data: actuals } = await supabase.from('actuals').select('*').order('period_start', { ascending: false }).limit(20)
  const { data: overlays } = await supabase.from('overlays').select('*').order('created_at', { ascending: false }).limit(20)
  const { data: snapshots } = await supabase.from('weekly_snapshots').select('*').order('week_ending', { ascending: false }).limit(50)
  const { data: largeDeals } = await supabase.from('large_deals').select('*').order('value', { ascending: false })
  const { data: quotas } = await supabase.from('quotas').select('*').eq('fiscal_year', currentFY)
  const { data: monthEndSnapshots } = await supabase.from('weekly_snapshots').select('*').eq('is_month_end', true).order('week_ending', { ascending: false }).limit(12)

  const chartInstructions = `IMPORTANT — CHART RENDERING:
This app automatically renders charts from markdown tables. When the user asks for graphs, trends or comparisons:
- Always include a properly formatted markdown table with the data
- Use clear column headers (e.g. "Month", "Avg Deal Size", "Revenue MTD")
- Do NOT say you cannot render graphs — you provide the data in a table and the app renders the chart automatically
- The first column should be the label (e.g. Month, Week, Rep Name)
- Subsequent columns should be numeric values
- For time-based data, put the time period in the first column so a line chart renders correctly`

  const dataBlock = `
ALL WEEKLY SNAPSHOTS (most recent first — ${snapshots?.length || 0} weeks of data):
${JSON.stringify(snapshots, null, 2)}

MONTH END SNAPSHOTS (final figures per month):
${JSON.stringify(monthEndSnapshots, null, 2)}

OPEN LARGE DEALS (>$100K):
${JSON.stringify(largeDeals, null, 2)}

QUOTAS:
${JSON.stringify(quotas, null, 2)}

FORECASTS:
${JSON.stringify(forecasts, null, 2)}

ACTUALS:
${JSON.stringify(actuals, null, 2)}
`

  const dataContext = CLIENT.buildAISystemPrompt(chartInstructions + '\n' + dataBlock)

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: dataContext,
      messages: [{ role: 'user', content: question }]
    })

    return Response.json({ answer: response.content[0].text })
  } catch (err) {
    console.error('Anthropic API error:', err.message || err)
    return Response.json({ error: err.message || 'AI generation failed' }, { status: 500 })
  }
}
