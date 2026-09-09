/**
 * Rotate a restaurant agent's capability token and rewrite its persona with the current
 * NEXT_PUBLIC_APP_URL. Needed whenever the app's public URL changes (e.g. a new dev tunnel).
 *
 *   NEXT_PUBLIC_APP_URL=https://xxx.trycloudflare.com npx tsx scripts/rotate-ctx.ts [restaurantId]
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db, schema } from '../src/lib/db/client'
import { zoowork, prepareZoowork } from '../src/lib/zoowork/client'
import { buildPersona } from '../src/lib/zoowork/provisioning'
import { newToken, sha256 } from '../src/lib/crypto'
await prepareZoowork()

const appUrl = process.env.NEXT_PUBLIC_APP_URL
if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL required')
const only = process.argv[2]
const agents = await db.select().from(schema.restaurantAgents)
for (const a of agents) {
  if (only && a.restaurantId !== only) continue
  if (!a.zooworkAgentId) continue
  const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, a.restaurantId)).limit(1)
  if (!r) continue
  const token = newToken()
  const ctxUrl = `${appUrl}/api/agent/ctx/${token}`
  await zoowork().updateAgent(a.zooworkAgentId, { persona: { docs: [{ name: 'AGENTS.md', content: buildPersona(r, ctxUrl) }] } })
  await db.update(schema.restaurantAgents).set({ ctxTokenHash: sha256(token), ctxTokenRotatedAt: new Date(), updatedAt: new Date() }).where(eq(schema.restaurantAgents.id, a.id))
  console.log('rotated', a.zooworkAgentId, '→', `${appUrl}/api/agent/ctx/<token>`)
}
process.exit(0)
