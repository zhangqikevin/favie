import { isNotNull } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { getSetting, SETTING_KEYS } from '@/server/settings'
import { zoowork, currentZooworkKey } from '@/lib/zoowork/client'
import { PlatformSettings } from '../PlatformSettings'

export default async function AdminSettings() {
  const [savedKey, defaultModel, models, agentCount, savedFc] = await Promise.all([
    getSetting(SETTING_KEYS.zooworkApiKey),
    getSetting(SETTING_KEYS.zooworkDefaultModel),
    zoowork().listModels().catch(() => [] as { model: string; label?: string }[]),
    db.$count(schema.restaurantAgents, isNotNull(schema.restaurantAgents.zooworkAgentId)),
    getSetting(SETTING_KEYS.firecrawlApiKey),
  ])
  const fcEnv = process.env.FIRECRAWL_API_KEY ?? null
  const fcInUse = savedFc?.value ?? fcEnv
  const firecrawl = { source: savedFc ? ('database' as const) : fcEnv ? ('environment' as const) : ('none' as const), last4: fcInUse ? fcInUse.slice(-4) : null, updatedAt: savedFc?.updatedAt.toISOString() ?? null }
  const keyInUse = currentZooworkKey()
  const keyInfo = {
    source: savedKey ? ('database' as const) : keyInUse ? ('environment' as const) : ('none' as const),
    last4: keyInUse ? keyInUse.slice(-4) : null,
    updatedAt: savedKey?.updatedAt.toISOString() ?? null,
  }
  return (
    <section>
      <h1 className="font-display text-2xl font-bold tracking-tight">Platform settings</h1>
      <p className="mt-1 text-sm text-ink-500">Credentials and defaults for the ZooWork organization that hosts every customer agent.</p>
      <div className="mt-5">
        <PlatformSettings keyInfo={keyInfo} models={models.map((m) => ({ model: m.model, label: (m as { label?: string }).label }))} defaultModel={defaultModel?.value ?? null} agentCount={agentCount} firecrawl={firecrawl} />
      </div>
    </section>
  )
}
