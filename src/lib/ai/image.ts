/**
 * Dish photo generation. Provider-agnostic; today one provider is wired (OpenAI Images, `gpt-image-1`)
 * and it is only active when OPENAI_API_KEY is set. Without a key, `imageGenerationAvailable()` is
 * false and the UI offers upload only.
 */
export function imageGenerationAvailable() {
  return !!process.env.OPENAI_API_KEY
}

export function dishPrompt(name: string, opts: { category?: string | null; cuisine?: string | null; descriptionEn?: string | null }) {
  const hints = [opts.category, opts.cuisine].filter(Boolean).join(', ')
  return [
    `Professional food photograph of "${name}"${hints ? ` (${hints})` : ''} for a restaurant delivery app listing.`,
    opts.descriptionEn ? `The dish: ${opts.descriptionEn}` : '',
    'Single plated dish, centered, filling most of the frame, on a clean neutral table with soft natural daylight from the side,',
    'shallow depth of field, appetizing steam or glossy sauce where natural, realistic colors, no people, no hands, no text, no logos, no extra props.',
    'Square 1:1 composition, sharp focus on the food.',
  ].filter(Boolean).join(' ')
}

/** Returns JPEG/PNG bytes. Throws when no provider is configured or the provider fails. */
export async function generateDishImage(prompt: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('image generation is not configured (OPENAI_API_KEY)')
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1', prompt, size: '1024x1024', quality: process.env.OPENAI_IMAGE_QUALITY ?? 'medium', n: 1, output_format: 'jpeg' }),
  })
  if (!res.ok) throw new Error(`image provider ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = await res.json() as { data: { b64_json?: string; url?: string }[] }
  const first = j.data?.[0]
  if (first?.b64_json) return { bytes: Uint8Array.from(Buffer.from(first.b64_json, 'base64')), contentType: 'image/jpeg' }
  if (first?.url) { const r = await fetch(first.url); return { bytes: new Uint8Array(await r.arrayBuffer()), contentType: r.headers.get('content-type') ?? 'image/png' } }
  throw new Error('image provider returned no image')
}
