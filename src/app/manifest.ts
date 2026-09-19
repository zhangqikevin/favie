import type { MetadataRoute } from 'next'

/**
 * Makes "Add to Home Screen" a real web app: opens full screen, always starts at /onboarding (which sends a
 * signed-in owner to their dashboard and everyone else to the login), and stays inside favie.us.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Favie',
    short_name: 'Favie',
    description: 'AI that runs your Uber Eats and DoorDash.',
    id: '/',
    start_url: '/onboarding',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f3f4f6',
    theme_color: '#f3f4f6',
    icons: [
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
