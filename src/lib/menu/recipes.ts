/**
 * Menu Clinic write side: deterministic "recipes" the agent executes step by step.
 *
 * The merchant portals are fixed pages, so the backend precomputes every URL, selector and value and
 * hands the agent an ordered list of browser tool calls (FAVIE_MENU_APPLY). The agent's job is to run
 * them in order without exploring: no snapshots except at the checkpoints listed here, CSS selectors
 * instead of snapshot refs (the DoorDash editor re-renders constantly and refs go stale), one login and
 * one editor load for the whole batch. Selectors were read from the live DOM on 2026-09-11; the ones
 * marked CALIBRATE were not exercised yet — the first real run is a supervised single-item run.
 *
 * NOTHING here performs a write by itself; it only renders the instructions. Kevin runs the first
 * real save manually.
 */
import { ueShortIdToUuid } from './firecrawl'

export type ApplyItem = { id: string; name: string; category: string | null; externalId: string | null; description: string | null; imageUrl: string | null }
export type ApplyContext = {
  platform: 'doordash' | 'uber_eats'
  loginLabel: string
  storefrontUrl: string | null
  storeExternalId: string | null
  menuEditorUrl: string | null // DoorDash: https://www.doordash.com/merchant/menu-editor/<menu_id>?store_id=<store_id>
}

const SEL = {
  dd: {
    search: '[data-testid="comboboxTextField"]',
    firstRowEdit: '[data-testid="EntityListItem"] [data-testid="编辑"], [data-testid="EntityListItem"] [data-testid="Edit"]',
    sheet: '[data-testid="LAYER-MANAGER-SHEET"]',
    description: '[data-testid="LAYER-MANAGER-SHEET"] textarea',
    photoInput: '[data-testid="LAYER-MANAGER-SHEET"] input[type="file"]',
    save: '[data-testid="LAYER-MANAGER-SHEET"] button[type="submit"]', // CALIBRATE: the save control appears only after an edit
    close: '[data-testid="LAYER-MANAGER-SHEET"] button[aria-label="Close"], [data-testid="LAYER-MANAGER-SHEET"] button:first-of-type',
  },
} as const

export function ueStoreUuid(ctx: ApplyContext): string | null {
  if (ctx.storeExternalId && /^[0-9a-f-]{36}$/i.test(ctx.storeExternalId)) return ctx.storeExternalId
  const m = ctx.storefrontUrl ? /ubereats\.com\/store\/[^/]+\/([A-Za-z0-9_-]{22})/.exec(ctx.storefrontUrl) : null
  return m ? ueShortIdToUuid(m[1]!) : null
}

export function ddStoreId(ctx: ApplyContext): string | null {
  const m = ctx.storefrontUrl ? /doordash\.com\/store\/(?:[^/?#]*?-)?(\d{6,})/.exec(ctx.storefrontUrl) : null
  return m?.[1] ?? null
}

/** The message body for one FAVIE_MENU_APPLY turn: header, then numbered steps, then the reply contract. */
export function buildApplyScript(ctx: ApplyContext, items: ApplyItem[]): { text: string; calibrate: boolean; unsupported: string[] } {
  const lines: string[] = []
  const unsupported: string[] = []
  let n = 0
  const step = (s: string) => { n++; lines.push(`${n}. ${s}`) }
  const q = (v: string) => JSON.stringify(v)
  let calibrate = false

  lines.push(`FAVIE_MENU_APPLY ${ctx.platform}`)
  lines.push(`Executor mode: run the numbered steps IN ORDER, one browser call each, exactly as written. No exploring, no extra snapshots except where a step says "snapshot". Use the CSS selector given (act with "selector"), never a ref from an old snapshot. Type only the values given. If a selector is not found or an unexpected dialog appears: take ONE snapshot, record the item as "failed" with what you saw, dismiss the dialog with Escape, and continue with the next item. Never touch price, availability, modifiers, hours or other items.`)
  lines.push('')
  step(`browser action "session" op "restart" loginLabel ${q(ctx.loginLabel)} egressCountry "US"`)

  if (ctx.platform === 'doordash') {
    const storeId = ddStoreId(ctx)
    const editor = ctx.menuEditorUrl ?? (storeId ? `https://www.doordash.com/merchant/menu-editor?store_id=${storeId}` : null)
    if (!editor) return { text: '', calibrate: false, unsupported: ['no DoorDash menu editor URL or store id on file'] }
    step(`browser action "navigate" url ${q(editor)}`)
    step('act kind "wait" timeoutMs 15000 (the Menu Manager list loads slowly), then act kind "wait" 5000 more if no rows are visible')
    step(`snapshot mode "efficient" — checkpoint: confirm the item search box (${SEL.dd.search}) and item rows exist. If a store/business chooser shows instead, pick ${q(storeId ?? '')} / the store named in the storefront title, then repeat this checkpoint.`)
    items.forEach((it, i) => {
      lines.push(`--- item ${i + 1}/${items.length}: ${it.name}`)
      step(`act kind "fill" selector ${q(SEL.dd.search)} text ${q(it.name)}; then act kind "wait" 1500`)
      step(`act kind "click" selector ${q(SEL.dd.firstRowEdit)} (the first row is the search hit); act kind "wait" 1500 (a right-side sheet opens)`)
      if (it.description) step(`act kind "fill" selector ${q(SEL.dd.description)} text ${q(it.description)}`)
      if (it.imageUrl) {
        step(`exec: curl -fsSL -o /workspace/photo-${i + 1}.jpg ${q(it.imageUrl)}; then browser action "upload" on selector ${q(SEL.dd.photoInput)} with that file (if upload needs an r2Key you cannot obtain, record the item as "photo_skipped" and continue with the description)`)
      }
      step(`act kind "click" on the sheet's Save button: selector ${q(SEL.dd.save)}; if not found, click the button whose text is "保存" or "Save" inside ${SEL.dd.sheet}. act kind "wait" 2000. CALIBRATE`)
      step(`snapshot mode "efficient" — checkpoint: the sheet shows no error banner${it.description ? ' and the description field contains the new text' : ''}. Then act kind "click" selector ${q(SEL.dd.close)} (or press Escape).`)
      calibrate = true
    })
  } else {
    const storeUuid = ueStoreUuid(ctx)
    if (!storeUuid) return { text: '', calibrate: false, unsupported: ['no Uber Eats store uuid on file'] }
    items.forEach((it, i) => {
      lines.push(`--- item ${i + 1}/${items.length}: ${it.name}`)
      if (!it.externalId) { unsupported.push(it.name); lines.push(`(skip: no item id on file — record as "failed", reason "no item id")`); return }
      step(`browser action "navigate" url ${q(`https://merchants.ubereats.com/manager/menumaker/${storeUuid}/items/${it.externalId}`)}; act kind "wait" 4000`)
      step(`snapshot mode "efficient" — checkpoint: the item edit page for ${q(it.name)} is open (name matches). If a tour/overlay blocks the page, press Escape once. CALIBRATE`)
      if (it.description) step(`act kind "fill" on the item DESCRIPTION field (the multi-line field labelled "Description" / "描述"; use its selector from the checkpoint snapshot) text ${q(it.description)}`)
      if (it.imageUrl) step(`exec: curl -fsSL -o /workspace/photo-${i + 1}.jpg ${q(it.imageUrl)}; then browser action "upload" on the item's photo input with that file; accept the default crop (if upload needs an r2Key you cannot obtain, record "photo_skipped" and continue)`)
      step(`act kind "click" on the "Save" / "保存" button of the item page; act kind "wait" 2000; snapshot mode "efficient" — checkpoint: no error, saved state. CALIBRATE`)
      calibrate = true
    })
  }
  step('browser action "session" op "close"')
  lines.push('')
  lines.push('Reply with one line — `applied N of M` — then exactly one block:')
  lines.push('```favie-menu-apply')
  lines.push('{ "items": [ { "name": "<item name as given>", "status": "saved" | "failed" | "photo_skipped", "reason": "<only when not saved>" } ] }')
  lines.push('```')
  return { text: lines.join('\n'), calibrate, unsupported }
}
