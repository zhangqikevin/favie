import { createClient } from '@supabase/supabase-js'

const BUCKET = 'menu-images'
let ready: Promise<void> | null = null

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Supabase storage needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Public bucket for dish photos (AI-generated or owner uploads). Created on first use. */
async function ensureBucket() {
  ready ??= (async () => {
    const sb = client()
    const { data } = await sb.storage.getBucket(BUCKET)
    if (!data) await sb.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] })
  })()
  await ready
}

/** Store bytes under menu-images/<restaurant>/<file> and return the public URL. */
export async function putImage(restaurantId: string, fileName: string, bytes: Uint8Array | ArrayBuffer, contentType: string) {
  await ensureBucket()
  const sb = client()
  const path = `${restaurantId}/${fileName}`
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true, cacheControl: '31536000' })
  if (error) throw new Error(`storage upload failed: ${error.message}`)
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
