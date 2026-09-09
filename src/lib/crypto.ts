import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

export function newToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url')
}

export function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}

function key() {
  const raw = process.env.FAVIE_ENCRYPTION_KEY
  if (!raw) throw new Error('FAVIE_ENCRYPTION_KEY is not set (32 bytes, base64)')
  const k = Buffer.from(raw, 'base64')
  if (k.length !== 32) throw new Error('FAVIE_ENCRYPTION_KEY must decode to 32 bytes')
  return k
}

/** AES-256-GCM. Output: base64(iv | tag | ciphertext). */
export function encrypt(plain: string) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64')
}

export function decrypt(b64: string) {
  const buf = Buffer.from(b64, 'base64')
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), enc = buf.subarray(28)
  const d = createDecipheriv('aes-256-gcm', key(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}
