/**
 * Run an ad-hoc prompt on a restaurant's agent and record it as a `manual` run.
 *   npx tsx scripts/run-prompt.ts <restaurantId-or-prefix> path/to/prompt.md
 * (Same code path as the admin page's "Run now".)
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { toolCall } from '@zoowork-ai/sdk'
import { db, schema } from '../src/lib/db/client'
import { runManualPrompt } from '../src/lib/zoowork/manual'
import { prepareZoowork } from '../src/lib/zoowork/client'
await prepareZoowork()

const [idArg, file] = process.argv.slice(2)
if (!idArg || !file) { console.error('usage: run-prompt.ts <restaurantId|prefix> <prompt.md>'); process.exit(1) }
const [r] = await db.select().from(schema.restaurants).where(sql`${schema.restaurants.id}::text like ${idArg + '%'}`).limit(1)
if (!r) throw new Error(`no restaurant matches ${idArg}`)
const prompt = readFileSync(file, 'utf8')
console.log(`restaurant: ${r.name} (${r.id}) · prompt ${prompt.length} chars`)
const t0 = Date.now()
const res = await runManualPrompt(r.id, prompt, { onEvent: (ev) => { const t = toolCall(ev); if (t?.phase === 'start') console.log(`  +${((Date.now() - t0) / 1000).toFixed(0)}s ${t.toolName} ${JSON.stringify(t.args ?? {}).slice(0, 140)}`) } })
console.log(`\n--- outcome: ${res.outcome ?? 'timeout'} in ${((Date.now() - t0) / 1000).toFixed(0)}s · run ${res.runId} ---\n${res.text}`)
process.exit(0)
