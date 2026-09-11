import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { getAuthUser } from '@/server/auth'
import { getRestaurantForUser } from '@/server/restaurants'
import type { Platform } from '@/lib/db/schema'

/**
 * The live-browser (VNC) page lives on ZooWork's proxy and authenticates its scripts, its resize
 * endpoint and its websocket with a SameSite=Lax cookie that the first page load sets. Inside a
 * cross-site <iframe> on favie.us that cookie never travels, so every sub-request answers 401 and the
 * embedded view is blank. Fix: serve our own copy of the page from OUR origin and proxy the /vnc/*
 * assets with the cookie attached; the websocket goes straight to the proxy with `access_token` in
 * its query, which the server accepts.
 */
export type HandoffTarget = {
  origin: string       // https://apiproxy.ecap.gsmo.ai
  vncBase: string      // /browser/anything/sessions/<sid>/vnc
  wsPath: string       // browser/anything/sessions/<sid>/vnc/websockify
  token: string        // websockify token
  password: string     // VNC password
  accessToken: string  // ba_live_access_token
}

export function parseHandoffUrl(handoffUrl: string): HandoffTarget | null {
  try {
    const u = new URL(handoffUrl)
    const accessToken = u.searchParams.get('access_token') ?? ''
    const token = u.searchParams.get('token') ?? ''
    if (!accessToken || !token) return null
    const vncBase = u.pathname.replace(/\/vnc_embed\.html$/, '')
    if (!/\/vnc$/.test(vncBase)) return null
    return {
      origin: u.origin, vncBase, token, accessToken,
      password: u.searchParams.get('password') ?? '',
      wsPath: u.searchParams.get('path') ?? `${vncBase.replace(/^\//, '')}/websockify`,
    }
  } catch { return null }
}

/** The signed-in owner's live handoff for one platform, or null (unauthenticated, not theirs, or no live browser). */
export async function ownerHandoffTarget(restaurantId: string, platform: string) {
  if (platform !== 'uber_eats' && platform !== 'doordash') return null
  const user = await getAuthUser()
  if (!user) return null
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) return null
  const [conn] = await db.select().from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, restaurantId), eq(schema.platformConnections.platform, platform as Platform))).limit(1)
  if (!conn?.handoffUrl || conn.status !== 'awaiting_login') return null
  if (conn.handoffStartedAt && Date.now() - conn.handoffStartedAt.getTime() > 60 * 60_000) return null // token lifetime
  return parseHandoffUrl(conn.handoffUrl)
}

/** Our stand-in for ZooWork's vnc_embed.html: same noVNC wiring, assets through our proxy, websocket direct. */
export function embedHtml(t: HandoffTarget, title: string) {
  const wsUrl = `${t.origin.replace(/^http/, 'ws')}/${t.wsPath}?token=${encodeURIComponent(t.token)}&access_token=${encodeURIComponent(t.accessToken)}`
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#1a1a1a}#screen{width:100%;height:100%}.msg{color:#888;text-align:center;margin-top:40vh;font-family:sans-serif}</style>
<script type="module">
import RFB from './vnc/core/rfb.js';
const screen = document.getElementById('screen');
const token = ${JSON.stringify(t.token)};
const rfb = new RFB(screen, ${JSON.stringify(wsUrl)}, { credentials: { password: ${JSON.stringify(t.password)} } });
rfb.scaleViewport = true; rfb.resizeSession = false; rfb.clipViewport = false;
let timer = null, lastW = 0, lastH = 0;
async function pushViewportSize() {
  const w = Math.max(320, Math.round(window.innerWidth / 2) * 2), h = Math.max(240, Math.round(window.innerHeight / 2) * 2);
  if (w === lastW && h === lastH) return; lastW = w; lastH = h;
  try { await fetch('./vnc/resize?token=' + encodeURIComponent(token) + '&w=' + w + '&h=' + h, { method: 'POST' }); } catch {}
}
window.addEventListener('resize', () => { if (timer) clearTimeout(timer); timer = setTimeout(pushViewportSize, 400); });
rfb.addEventListener('connect', () => { pushViewportSize(); });
rfb.addEventListener('disconnect', (e) => { screen.innerHTML = '<div class="msg">' + (e.detail.clean ? 'Session ended' : 'Connection lost') + '</div>'; });
</script>
</head>
<body><div id="screen"></div></body>
</html>`
}
