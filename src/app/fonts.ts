import localFont from 'next/font/local'

/**
 * Self-hosted fonts (latin subsets of the variable fonts, SIL OFL). Nothing is fetched from Google at build
 * time or in the browser, so the site renders identically on networks where fonts.googleapis.com is slow
 * or blocked. Chinese and Japanese text uses the system fonts from the fallback stacks in globals.css.
 *   marketing: Hanken Grotesk (text) + Bricolage Grotesque (display) · app: Inter (text) + Manrope (display)
 */
export const hanken = localFont({ src: '../fonts/hanken-grotesk-latin.woff2', weight: '400 700', display: 'swap', variable: '--font-hanken' })
export const bricolage = localFont({ src: '../fonts/bricolage-grotesque-latin.woff2', weight: '600 800', display: 'swap', variable: '--font-bricolage' })
export const inter = localFont({ src: '../fonts/inter-latin.woff2', weight: '300 700', display: 'swap', variable: '--font-inter', preload: false })
export const manrope = localFont({ src: '../fonts/manrope-latin.woff2', weight: '300 800', display: 'swap', variable: '--font-manrope', preload: false })

export const fontVariables = [hanken, bricolage, inter, manrope].map((f) => f.variable).join(' ')
