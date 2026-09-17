import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { zoowork, logged } from './client'

const SKILL_NAME = 'favie-ops'
const SKILL_DIR = join(process.cwd(), 'skills', SKILL_NAME)

export function skillTemplate() {
  return readFileSync(join(SKILL_DIR, 'SKILL.template.md'), 'utf8')
}
export function defaultOperatingPrompt() {
  return readFileSync(join(SKILL_DIR, 'default-operating-prompt.md'), 'utf8')
}

/** Full SKILL.md = fixed protocol (handoff, confirm-login, summary contract) + the admin's operating prompt. */
export function renderSkill(operatingPrompt: string) {
  const body = operatingPrompt.trim()
  if (!body.startsWith('## ')) throw new Error('The operating prompt must start with a markdown section heading (e.g. "## Mode `daily` — the routine").')
  return skillTemplate().replace('{{OPERATING_PROMPT}}', body + '\n')
}

export async function activePrompt() {
  const [row] = await db.select().from(schema.agentPromptVersions).where(eq(schema.agentPromptVersions.isActive, true)).limit(1)
  return row ?? null
}

export async function promptHistory(limit = 20) {
  return db.select().from(schema.agentPromptVersions).orderBy(desc(schema.agentPromptVersions.version)).limit(limit)
}

/**
 * Save a new operating-prompt version and publish it as a new favie-ops skill version. Every agent
 * installed without a version pin picks it up on its next turn — that is the fleet-wide upgrade.
 */
export async function publishOperatingPrompt(body: string, userId: string | null, note?: string) {
  const skillId = process.env.FAVIE_OPS_SKILL_ID
  if (!skillId) throw new Error('FAVIE_OPS_SKILL_ID is not set')
  const skillMd = renderSkill(body) // throws on a malformed prompt before anything is written
  const [latest] = await db.select().from(schema.agentPromptVersions).orderBy(desc(schema.agentPromptVersions.version)).limit(1)
  const version = (latest?.version ?? 0) + 1

  const zip = new JSZip()
  zip.folder(SKILL_NAME)!.file('SKILL.md', skillMd)
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const zc = zoowork()
  const published = await logged('uploadSkillVersion', null, { version, chars: body.length }, () =>
    zc.uploadSkillVersion(skillId, new Uint8Array(buf), { fileName: `${SKILL_NAME}.zip`, idempotencyKey: `${SKILL_NAME}-prompt-v${version}-${Date.now()}` }))

  await db.transaction(async (tx) => {
    await tx.update(schema.agentPromptVersions).set({ isActive: false }).where(eq(schema.agentPromptVersions.isActive, true))
    await tx.insert(schema.agentPromptVersions).values({
      version, body: body.trim(), note: note ?? null, skillVersion: String((published as { version?: string | number }).version ?? ''), isActive: true, createdByUserId: userId,
    })
  })
  const synced = await syncSkillToAgents(skillId).catch((e) => { console.warn('[skill] sync failed', (e as Error).message); return { updated: 0, total: 0 } })
  return { version, skillVersion: (published as { version?: string | number }).version, ...synced }
}

/**
 * Make every provisioned agent serve the latest favie-ops version. The SDK says unpinned agents follow
 * new versions on their own, but on 2026-09-16 three of four agents were still on v9 / v25 / v31 after
 * v35 was published (they were created with `skills[]` on createAgent). Re-attaching without a pin
 * re-resolves the version; verified by reading the version back.
 */
export async function syncSkillToAgents(skillId = process.env.FAVIE_OPS_SKILL_ID) {
  if (!skillId) return { updated: 0, total: 0 }
  const zc = zoowork()
  const agents = await db.select().from(schema.restaurantAgents).where(and(isNotNull(schema.restaurantAgents.zooworkAgentId), inArray(schema.restaurantAgents.agentStatus, ['ready', 'running', 'created'])))
  let updated = 0
  const versions: Record<string, string> = {}
  for (const a of agents) {
    try {
      await logged('putAgentSkill.sync', a.id, { skillId }, () => zc.putAgentSkill(a.zooworkAgentId!, skillId, { enabled: true, versionPin: null }))
      const skills = await zc.listAgentSkills(a.zooworkAgentId!) as { name: string; version?: string }[]
      const v = skills.find((s) => s.name === SKILL_NAME)?.version ?? '?'
      versions[a.zooworkAgentId!] = String(v)
      updated++
    } catch (e) {
      console.warn('[skill] sync', a.zooworkAgentId, (e as Error).message)
    }
  }
  console.log('[skill] agents now on favie-ops versions:', JSON.stringify(versions))
  return { updated, total: agents.length, versions }
}

/** Re-publish an older version's body as a new version (rollback = forward publish of old text). */
export async function rollbackTo(version: number, userId: string | null) {
  const [row] = await db.select().from(schema.agentPromptVersions).where(eq(schema.agentPromptVersions.version, version)).limit(1)
  if (!row) throw new Error(`version ${version} not found`)
  return publishOperatingPrompt(row.body, userId, `rollback to v${version}`)
}
