import type { NextConfig } from 'next'

function devHost() {
  try { return new URL(process.env.NEXT_PUBLIC_APP_URL ?? '').hostname || null } catch { return null }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Each developer reaches their dev server through their own tunnel (NEXT_PUBLIC_APP_URL);
  // without this Next 16 blocks /_next/* requests coming from that host.
  allowedDevOrigins: [devHost()].filter((h): h is string => !!h),
  serverExternalPackages: ['@zoowork-ai/sdk', 'pg', 'pg-boss'],
  // Dev chunks are not content-hashed. Through the Cloudflare tunnel they were being cached for hours,
  // so a browser could hydrate stale client code against fresh server HTML and the page went dead.
  async headers() {
    if (process.env.NODE_ENV === 'production') return []
    return [{ source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }] }]
  },
}

export default nextConfig
