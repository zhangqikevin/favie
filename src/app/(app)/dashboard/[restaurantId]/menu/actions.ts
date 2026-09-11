'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser } from '@/server/restaurants'
import { enqueueMenuGenerate, enqueueMenuPull, enqueueMenuSave } from '@/server/jobs/enqueue'
import { putImage } from '@/lib/storage'
import type { Platform } from '@/lib/db/schema'

async function own(restaurantId: string) {
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) throw new Error('not found')
  return { user, r }
}
async function ownItem(menuItemId: string) {
  const user = await requireUser()
  const [item] = await db.select().from(schema.menuItems).where(eq(schema.menuItems.id, menuItemId)).limit(1)
  if (!item) throw new Error('not found')
  const r = await getRestaurantForUser(item.restaurantId, user.id)
  if (!r) throw new Error('not found')
  return { user, r, item }
}
const isPlatform = (p: unknown): p is Platform => p === 'uber_eats' || p === 'doordash'

/** Read (or re-read) the platform menu with the agent's browser. */
export async function pullMenu(restaurantId: string, platform: Platform) {
  const { r } = await own(restaurantId)
  if (!isPlatform(platform)) throw new Error('platform')
  const [conn] = await db.select().from(schema.platformConnections).where(and(eq(schema.platformConnections.restaurantId, r.id), eq(schema.platformConnections.platform, platform))).limit(1)
  if (conn?.status !== 'connected') return { error: 'not_connected' as const }
  const [job] = await db.insert(schema.menuJobs).values({ restaurantId: r.id, platform, kind: 'pull', note: 'Queued…' }).returning()
  await enqueueMenuPull(job!.id, r.id, platform)
  return { ok: true as const, jobId: job!.id }
}

/** "Favie AI 优化": bilingual description + (when configured) a generated photo. */
export async function aiOptimize(menuItemId: string) {
  const { r, item } = await ownItem(menuItemId)
  const [job] = await db.insert(schema.menuJobs).values({ restaurantId: r.id, platform: item.platform, kind: 'generate', menuItemId: item.id, note: 'Queued…' }).returning()
  await enqueueMenuGenerate(job!.id, item.id)
  return { ok: true as const, jobId: job!.id }
}

/** Owner edits the draft text (bilingual, English first) or picks which photo to send. */
export async function updateDraft(menuItemId: string, patch: { description?: string | null; imageUrl?: string | null }) {
  const { item } = await ownItem(menuItemId)
  const set: Partial<typeof schema.menuItems.$inferInsert> = { updatedAt: new Date() }
  if (patch.description !== undefined) set.draftDescription = patch.description?.trim() || null
  if (patch.imageUrl !== undefined) set.draftImageUrl = patch.imageUrl || null
  const hasDraft = (set.draftDescription ?? (patch.description === undefined ? item.draftDescription : null)) || (set.draftImageUrl ?? (patch.imageUrl === undefined ? item.draftImageUrl : null))
  set.status = hasDraft ? 'draft' : (item.status === 'saved' ? 'saved' : 'synced')
  await db.update(schema.menuItems).set(set).where(eq(schema.menuItems.id, item.id))
  return { ok: true as const }
}

/** Owner uploads their own photo (JPEG/PNG/WebP ≤ 8 MB); it becomes the draft photo. */
export async function uploadPhoto(fd: FormData) {
  const menuItemId = String(fd.get('menuItemId') ?? '')
  const file = fd.get('file')
  if (!(file instanceof File)) return { error: 'no_file' as const }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return { error: 'type' as const }
  if (file.size > 8 * 1024 * 1024) return { error: 'size' as const }
  const { r, item } = await ownItem(menuItemId)
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const url = await putImage(r.id, `${item.id}-owner-${Date.now()}.${ext}`, await file.arrayBuffer(), file.type)
  await db.update(schema.menuItems).set({ customImageUrl: url, draftImageUrl: url, status: 'draft', updatedAt: new Date() }).where(eq(schema.menuItems.id, item.id))
  return { ok: true as const, url }
}

/** Write the approved draft to the platform via the agent's saved browser login. */
export async function saveToPlatform(menuItemId: string) {
  const { r, item } = await ownItem(menuItemId)
  if (!item.draftDescription && !item.draftImageUrl) return { error: 'nothing' as const }
  const [job] = await db.insert(schema.menuJobs).values({ restaurantId: r.id, platform: item.platform, kind: 'save', menuItemId: item.id, note: 'Queued…' }).returning()
  await db.update(schema.menuItems).set({ status: 'saving', lastError: null, updatedAt: new Date() }).where(eq(schema.menuItems.id, item.id))
  await enqueueMenuSave(job!.id, item.id)
  return { ok: true as const, jobId: job!.id }
}

/** Drop Favie's draft and keep what the platform has. */
export async function discardDraft(menuItemId: string) {
  const { item } = await ownItem(menuItemId)
  await db.update(schema.menuItems).set({ draftDescription: null, draftImageUrl: null, status: item.lastSavedAt ? 'saved' : 'synced', lastError: null, updatedAt: new Date() }).where(eq(schema.menuItems.id, item.id))
  return { ok: true as const }
}

export async function revalidateMenu(restaurantId: string) { revalidatePath(`/dashboard/${restaurantId}/menu`) }
