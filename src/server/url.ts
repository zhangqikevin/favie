/**
 * The origin users see. Behind Replit's / a load balancer's proxy `req.url` carries the internal host
 * (localhost:3000), so redirects built from it point nowhere. Prefer the configured public URL, then
 * the proxy's forwarded headers, then the request itself.
 */
export function publicOrigin(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (configured && /^https?:\/\//.test(configured)) return configured
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '')
  if (host) return `${proto}://${host.split(',')[0]!.trim()}`
  return new URL(req.url).origin
}
