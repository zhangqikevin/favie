import { embedHtml, adminOpsTarget } from '@/server/handoff-embed'

/** Same-origin live-browser page for Favie's ops team (see server/handoff-embed.ts). Admin only. */
export async function GET(_req: Request, ctx: { params: Promise<{ opsId: string }> }) {
  const { opsId } = await ctx.params
  const target = await adminOpsTarget(opsId)
  if (!target) return new Response('No live browser.', { status: 404, headers: { 'content-type': 'text/plain' } })
  return new Response(embedHtml(target, 'Favie ops browser'), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
}
