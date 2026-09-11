import { embedHtml, ownerHandoffTarget } from '@/server/handoff-embed'

/** Same-origin live-browser page for the connect step's embedded view (see server/handoff-embed.ts). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; platform: string }> }) {
  const { id, platform } = await ctx.params
  const target = await ownerHandoffTarget(id, platform)
  if (!target) return new Response('No live browser for this platform.', { status: 404, headers: { 'content-type': 'text/plain' } })
  return new Response(embedHtml(target, platform === 'doordash' ? 'DoorDash login' : 'Uber Eats login'), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
