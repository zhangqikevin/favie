/** Menu Clinic heuristics. Cheap, explainable, and the owner can override every one by editing. */

export const DESC_MIN_CHARS = 40
export const DESC_MIN_WORDS = 8
export const PHOTO_MIN_WIDTH = 600

export function descriptionFlags(desc: string | null | undefined) {
  const text = (desc ?? '').trim()
  if (!text) return { descMissing: true, descThin: false }
  const words = text.split(/\s+/).length
  const cjk = (text.match(/[㐀-鿿]/g) ?? []).length
  // Chinese text has no spaces: count characters instead of words.
  const thin = cjk > text.length / 2 ? text.length < 20 : text.length < DESC_MIN_CHARS || words < DESC_MIN_WORDS
  return { descMissing: false, descThin: thin }
}

/** Read image dimensions from the first bytes (PNG IHDR, JPEG SOF, WebP VP8/VP8L/VP8X). */
export function imageSize(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) return { width: readU32(buf, 16), height: readU32(buf, 20) }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: (buf[i + 5] << 8) | buf[i + 6], width: (buf[i + 7] << 8) | buf[i + 8] }
      i += 2 + ((buf[i + 2] << 8) | buf[i + 3])
    }
  }
  if (buf.length > 30 && buf[0] === 0x52 && buf[1] === 0x49 && buf[8] === 0x57) {
    const tag = String.fromCharCode(buf[12], buf[13], buf[14], buf[15])
    if (tag === 'VP8 ') return { width: (buf[26] | (buf[27] << 8)) & 0x3fff, height: (buf[28] | (buf[29] << 8)) & 0x3fff }
    if (tag === 'VP8L') { const b = buf.subarray(21, 25); return { width: 1 + (((b[1] & 0x3f) << 8) | b[0]), height: 1 + (((b[3] & 0xf) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6)) } }
    if (tag === 'VP8X') return { width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)) }
  }
  return null
}
const readU32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0

/** Fetch only the head of the image and judge it: missing, too small, or a known placeholder. */
export async function photoFlags(url: string | null | undefined): Promise<{ photoMissing: boolean; photoPoor: boolean; width?: number; height?: number }> {
  if (!url) return { photoMissing: true, photoPoor: false }
  if (/placeholder|default|no[-_]?image|missing/i.test(url)) return { photoMissing: true, photoPoor: false }
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000)
    const res = await fetch(url, { headers: { range: 'bytes=0-65535' }, signal: ctl.signal })
    clearTimeout(t)
    if (!res.ok && res.status !== 206) return { photoMissing: false, photoPoor: false }
    const buf = new Uint8Array(await res.arrayBuffer())
    const dim = imageSize(buf)
    if (!dim) return { photoMissing: false, photoPoor: false }
    const ratio = dim.width / dim.height
    const poor = dim.width < PHOTO_MIN_WIDTH || ratio < 0.7 || ratio > 2.2
    return { photoMissing: false, photoPoor: poor, ...dim }
  } catch {
    return { photoMissing: false, photoPoor: false }
  }
}
