/**
 * Bootstrap/CLI publish of the favie-ops skill: renders SKILL.md from SKILL.template.md + the ACTIVE
 * operating prompt in the database (or default-operating-prompt.md when none) and uploads it.
 * The admin page (/admin) does the same thing for prompt changes; use this after editing the template.
 *
 *   npx tsx scripts/publish-skill.ts
 */
import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createZooworkClient } from '@zoowork-ai/sdk'
import JSZip from 'jszip'
import { renderSkill, activePrompt, defaultOperatingPrompt } from '../src/lib/zoowork/skill-publish'

const NAME = 'favie-ops'
const zc = createZooworkClient()
const active = await activePrompt().catch(() => null)
const skillMd = renderSkill(active?.body ?? defaultOperatingPrompt())
writeFileSync(join('skills', NAME, 'SKILL.md'), skillMd) // keep the rendered file in the repo for reading
const zip = new JSZip(); zip.folder(NAME)!.file('SKILL.md', skillMd)
const buf = new Uint8Array(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
const stamp = Date.now().toString(36)
let skillId = process.env.FAVIE_OPS_SKILL_ID
if (!skillId) {
  const existing = (await zc.listSkills({ q: NAME })).filter((s) => s.name === NAME && (s.scope === 'org' || s.scope === 'personal'))
  skillId = existing[0]?.skill_id
}
if (!skillId) {
  const created = await zc.uploadSkill(buf, { scope: 'org', fileName: `${NAME}.zip`, idempotencyKey: `${NAME}-v1-${stamp}` })
  console.log(`created ${created.name} ${created.skill_id} version ${created.latest_version}\nAdd to .env: FAVIE_OPS_SKILL_ID=${created.skill_id}`)
} else {
  const v = await zc.uploadSkillVersion(skillId, buf, { fileName: `${NAME}.zip`, idempotencyKey: `${NAME}-${stamp}` })
  console.log(`published ${skillId} version ${(v as { version?: string }).version} (prompt ${active ? 'v' + active.version : 'default'})`)
}
process.exit(0)
