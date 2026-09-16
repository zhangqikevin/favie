import { getSetting, SETTING_KEYS } from '@/server/settings'
import { firecrawlKey } from './firecrawl'

export type MenuReadProvider = 'firecrawl' | 'zoodata'
export const ZOODATA_MENU_MCP_DEFAULT = 'https://api.zoodata.ai/mcp-menu'
export const ZOODATA_MENU_TOOL_DEFAULT = 'menu_scrape'

/**
 * Which service reads a public store page for Menu Clinic. Firecrawl (default) or Zoodata's menu tool, chosen
 * in /admin/settings. Zoodata here uses Favie's PLATFORM key — unrelated to the per-restaurant data keys.
 */
export async function menuReadConfig() {
  const [provider, zKey, zUrl, zTool] = await Promise.all([
    getSetting(SETTING_KEYS.menuReadProvider), getSetting(SETTING_KEYS.zoodataPlatformKey), getSetting(SETTING_KEYS.zoodataMenuMcpUrl), getSetting(SETTING_KEYS.zoodataMenuTool),
  ])
  const zoodata = { key: zKey?.value || process.env.ZOODATA_PLATFORM_KEY || null, url: zUrl?.value || process.env.ZOODATA_MENU_MCP_URL || ZOODATA_MENU_MCP_DEFAULT, tool: zTool?.value || ZOODATA_MENU_TOOL_DEFAULT }
  const chosen: MenuReadProvider = provider?.value === 'zoodata' ? 'zoodata' : 'firecrawl'
  return { provider: chosen, firecrawlKey: await firecrawlKey(), zoodata }
}
