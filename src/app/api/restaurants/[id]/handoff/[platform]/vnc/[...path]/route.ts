import { ownerHandoffTarget } from '@/server/handoff-embed'

/**
 * Proxy for the noVNC assets and the resize endpoint of the live browser. Adds the access cookie the
 * ZooWork proxy wants, which a cross-site iframe cannot send itself. Only the owner of the restaurant
 * with a live handoff can reach it; the path is confined to that session's /vnc/ subtree.
 */
async function proxy(req: Request, ctx: { params: Promise<{ id: string; platform: string; path: string[] }> }) {
  const { id, platform, path } = await ctx.params
  const target = await ownerHandoffTarget(id, platform)
  if (!target) return new Response('not found', { status: 404 })
  const rel = path.map((p) => encodeURIComponent(decodeURIComponent(p))).join('/')
  if (!rel || rel.includes('..')) return new Response('bad path', { status: 400 })
  const search = new URL(req.url).search
  const upstream = `${target.origin}${target.vncBase}/${rel}${search}`
  const res = await fetch(upstream, {
    method: req.method,
    headers: { cookie: `ba_live_access_token=${target.accessToken}`, accept: req.headers.get('accept') ?? '*/*' },
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
    redirect: 'manual',
  })
  const headers = new Headers()
  for (const h of ['content-type', 'content-length', 'etag', 'last-modified']) { const v = res.headers.get(h); if (v) headers.set(h, v) }
  headers.set('cache-control', res.ok && req.method === 'GET' ? 'private, max-age=600' : 'no-store')
  return new Response(res.body, { status: res.status, headers })
}

export { proxy as GET, proxy as POST }
