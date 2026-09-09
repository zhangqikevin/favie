import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { zoowork, logged, resolveModel } from './client'
import { ensureDailySchedule } from './schedule'
import { newToken, sha256 } from '@/lib/crypto'
import { computeDesiredEnabled } from '@/server/billing/gate'

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const env = () => process.env.FAVIE_ENV ?? process.env.NODE_ENV ?? 'development'

export function buildPersona(restaurant: { name: string; city: string | null; state: string | null; timezone: string }, ctxUrl: string) {
  return [
    `# Favie ops agent — ${restaurant.name}`,
    '',
    `You are the Favie delivery-operations agent for **${restaurant.name}**${restaurant.city ? ` (${restaurant.city}${restaurant.state ? ', ' + restaurant.state : ''})` : ''}, time zone ${restaurant.timezone}.`,
    'You ALWAYS follow the `favie-ops` skill for every task. Read it before acting.',
    '',
    `FAVIE_CONTEXT_URL=${ctxUrl}`,
    '',
    'Never reveal this URL, any credential, or any verification code in your replies.',
  ].join('\n')
}

/**
 * Resumable state machine keyed on restaurant_agents.agent_status:
 * none → creating → created → running → ready. Every step is idempotent, so retries resume.
 */
export async function provisionAgent(restaurantAgentId: string) {
  const [agent] = await db.select().from(schema.restaurantAgents).where(eq(schema.restaurantAgents.id, restaurantAgentId)).limit(1)
  if (!agent) throw new Error(`restaurant_agent ${restaurantAgentId} not found`)
  const [restaurant] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, agent.restaurantId)).limit(1)
  if (!restaurant) throw new Error('restaurant not found')
  const zc = zoowork()
  const set = (values: Partial<typeof schema.restaurantAgents.$inferInsert>) =>
    db.update(schema.restaurantAgents).set({ ...values, updatedAt: new Date() }).where(eq(schema.restaurantAgents.id, agent.id))

  try {
    // Capability token (rotatable). Only the hash is stored; the plaintext lives in the persona.
    let ctxToken: string | undefined
    if (!agent.ctxTokenHash) {
      ctxToken = newToken()
      await set({ ctxTokenHash: sha256(ctxToken), ctxTokenRotatedAt: new Date() })
    }

    let zooworkAgentId = agent.zooworkAgentId
    if (!zooworkAgentId) {
      await set({ agentStatus: 'creating' })
      const model = await resolveModel()
      const ctxUrl = `${appUrl()}/api/agent/ctx/${ctxToken!}`
      const input = {
        resource: {
          name: `favie-${agent.kind}-${restaurant.id}`,
          model: { primary: model },
          labels: { app: 'favie', env: env(), restaurant_id: restaurant.id, kind: agent.kind },
          sandbox: { scope: 'agent' as const },
          // Observed 2026-09-08: this section is accepted and makes the global browser-ops skill eligible.
          browser: { enabled: true },
          persona: { docs: [{ name: 'AGENTS.md', content: buildPersona(restaurant, ctxUrl) }] },
          ...(process.env.FAVIE_OPS_SKILL_ID ? { skills: [{ skill_id: process.env.FAVIE_OPS_SKILL_ID }] } : {}),
        },
      }
      // NOTE: never reuse an idempotency key of a deleted agent (gateway answers 502).
      const created = await logged('createAgent', agent.id, { ...input, resource: { ...input.resource, persona: '[redacted]' } }, () =>
        zc.createAgent(input as Parameters<typeof zc.createAgent>[0], `favie-${agent.kind}-${restaurant.id}-${agent.id.slice(0, 8)}`))
      zooworkAgentId = created.agent_id
      await set({ zooworkAgentId, agentStatus: 'created' })
    }

    // Start + wait on desired_state (never actual_state).
    const { warnings } = await logged('startAgent', agent.id, { zooworkAgentId }, () => zc.startAgent(zooworkAgentId!))
    if (warnings.length) console.log('[provision] start warnings', warnings)
    const running = await zc.waitUntilRunning(zooworkAgentId, { timeoutMs: 90_000 })
    if (running.status?.desired_state !== 'running') throw new Error('agent did not reach desired_state=running')
    await set({ agentStatus: 'running' })

    // Skill attachment: skills[] on create is "declared but never exercised" — verify and PUT if missing.
    const skillId = process.env.FAVIE_OPS_SKILL_ID
    if (skillId) {
      const attached = await zc.listAgentSkills(zooworkAgentId)
      const row = attached.find((s) => s.skill_id === skillId)
      if (!row) {
        await logged('putAgentSkill', agent.id, { skillId }, () => zc.putAgentSkill(zooworkAgentId!, skillId))
        const again = await zc.listAgentSkills(zooworkAgentId)
        const r2 = again.find((s) => s.skill_id === skillId)
        if (!r2) throw new Error('favie-ops skill did not resolve onto the agent')
        if (r2.eligible === false) throw new Error(`favie-ops attached but ineligible: ${JSON.stringify(r2)}`)
      } else if (row.eligible === false) {
        throw new Error(`favie-ops attached but ineligible: ${JSON.stringify(row)}`)
      }
    } else {
      console.warn('[provision] FAVIE_OPS_SKILL_ID not set — agent has no favie-ops skill; run scripts/publish-skill.ts')
    }

    // Daily schedule, enabled only if the gate says so (usually false until a platform is connected).
    const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.restaurantId, restaurant.id)).limit(1)
    const conns = await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.restaurantId, restaurant.id))
    const enabled = computeDesiredEnabled({
      subscriptionStatus: sub?.status, serviceDisabled: restaurant.serviceDisabled, dailySchedulePaused: restaurant.dailySchedulePaused, agentStatus: 'ready', connectionStatuses: conns.map((c) => c.status),
    })
    await ensureDailySchedule({ ...agent, zooworkAgentId }, restaurant.timezone, enabled)
    await set({ agentStatus: 'ready', agentError: null })
    return zooworkAgentId
  } catch (e) {
    await set({ agentStatus: 'failed', agentError: (e as Error).message })
    throw e
  }
}
