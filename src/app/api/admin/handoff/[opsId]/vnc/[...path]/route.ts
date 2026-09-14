import { adminOpsTarget } from '@/server/handoff-embed'

/** noVNC asset / resize proxy for the ops browser (admin only; see the owner variant under /api/restaurants). */
async function proxy(req: Request, ctx: { params: Promise<{ opsId: string; path: string[] }> }) {
  const { opsId, path } = await ctx.params
  const target = await adminOpsTarget(opsId)
  if (!target) return new Response('not found', { status: 404 })
  const rel = path.map((p) => encodeURIComponent(decodeURIComponent(p))).join('/')
  if (!rel || rel.includes('..')) return new Response('bad path', { status: 400 })
  const search = new URL(req.url).search
  const res = await fetch(`${target.origin}${target.vncBase}/${rel}${search}`, {
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
