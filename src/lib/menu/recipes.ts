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
    // Typing into the search box opens a suggestion list; the first option (#combobox-item-0) is the matching
    // item and clicking it opens that item's sheet directly. The list under the box is NOT filtered, so never
    // click "the first row" — that is just the first item of the first category.
    suggestion: '[data-testid="comboboxItems"] #combobox-item-0',
    searchHint: '[data-testid="searchHintListCell"]',
    sheet: '[data-testid="LAYER-MANAGER-SHEET"]',
    description: '[data-testid="LAYER-MANAGER-SHEET"] textarea',
    photoInput: '[data-testid="LAYER-MANAGER-SHEET"] input[type="file"]',
    // NOTE: never target button[type="submit"] inside the sheet — those are the food-tag "删除" (delete) buttons.
    // The save control ("Save changes" / "保存更改") appears in the sheet footer only after an edit; it is clicked by ref.
    saveText: ['Save changes', '保存更改', '保存', 'Save'],
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
  lines.push(`Executor mode: run the numbered steps IN ORDER, one browser call each, exactly as written. No exploring, no extra snapshots except where a step says "snapshot". Use the CSS selector given (act with "selector", or "fill" with "fields": [{selector|ref, value}]), never a ref from an old snapshot. Type only the values given. If a selector is not found or an unexpected dialog appears: take ONE snapshot, record the item as "failed" with what you saw, dismiss the dialog with Escape, and continue with the next item. Never touch price, availability, modifiers, hours or other items.`)
  lines.push('')
  step(`browser action "session" op "restart" loginLabel ${q(ctx.loginLabel)} egressCountry "US"`)

  if (ctx.platform === 'doordash') {
    const storeId = ddStoreId(ctx)
    if (!ctx.menuEditorUrl && !storeId) return { text: '', calibrate: false, unsupported: ['no DoorDash menu editor URL or store id on file'] }
    if (ctx.menuEditorUrl) {
      step(`browser action "navigate" url ${q(ctx.menuEditorUrl)}`)
    } else {
      // The editor only renders its item list when the menu id is in the URL; the sidebar entry resolves it.
      step(`browser action "navigate" url ${q(`https://www.doordash.com/merchant/menu-editor?store_id=${storeId}`)}; act kind "wait" 8000`)
      step(`snapshot mode "efficient"; then act kind "click" on the sidebar button whose text is "菜单管理器" or "Menu Manager" (expand the "菜单" / "Menu" group first if it is collapsed); act kind "wait" 10000. Record the resulting page URL (it should look like /merchant/menu-editor/<menu_id>?store_id=…) — it goes into "menu_editor_url" in your reply. If no such sidebar entry exists, this account cannot edit this store's menu: record every item as "failed" with reason "no Menu Manager for this store" and skip to the last step.`)
    }
    step('act kind "wait" timeoutMs 15000 (the Menu Manager list loads slowly), then act kind "wait" 5000 more if no rows are visible')
    step(`snapshot mode "efficient" — checkpoint: confirm the item search box (${SEL.dd.search}) and item rows exist. If a store/business chooser shows instead, pick ${q(storeId ?? '')} / the store named in the storefront title, then repeat this checkpoint.`)
    items.forEach((it, i) => {
      lines.push(`--- item ${i + 1}/${items.length}: ${it.name}`)
      step(`act kind "click" selector ${q(SEL.dd.search)}; act kind "press" key "Control+a"; act kind "type" selector ${q(SEL.dd.search)} text ${q(it.name)} (typing — not fill — so the suggestion list opens); act kind "wait" 1500`)
      step(`snapshot mode "efficient" — the suggestion list (${SEL.dd.suggestion.split(' ')[0]}) must show an option named exactly ${q(it.name)}. If the only option is the "搜索…按 Enter" hint, the item does not exist under this name: record "failed" (reason "item not found in Menu Manager"), press Escape, and continue with the next item.`)
      step(`act kind "click" selector ${q(SEL.dd.suggestion)} (the matching option; it opens the item's sheet directly); act kind "wait" 2000`)
      step(`snapshot mode "efficient" — checkpoint: the right-side sheet heading is ${q(it.name)}. If it is a different item, click the sheet's Close, record "failed" (reason "wrong item opened"), and continue.`)
      if (it.description) step(`act kind "fill" fields [{ "selector": ${q(SEL.dd.description)}, "value": ${q(it.description)} }]`)
      if (it.imageUrl) {
        step(`exec: curl -fsSL -o /workspace/photo-${i + 1}.jpg ${q(it.imageUrl)}; then browser action "upload" on selector ${q(SEL.dd.photoInput)} with that file (if upload needs an r2Key you cannot obtain, record the item as "photo_skipped" and continue with the description)`)
      }
      step(`snapshot mode "efficient" — find the sheet footer button named ${SEL.dd.saveText.map(q).join(' / ')} and act kind "click" it by ref. NEVER click any "删除" / "Delete" / "Remove" button and never use button[type="submit"].`)
      step(`act kind "wait" 3000; snapshot mode "efficient". If a dialog "Are you sure?" / "确定吗？" offers "Keep changes" / "保留更改" (the POS-integration warning), click "Keep changes" by ref and wait 3000. If the save button still shows "Loading", wait 3000 more and snapshot again (up to 3 times). Saving is complete only when the Loading state is gone and no error banner is shown.`)
      step(`Verify: act kind "click" selector ${q(SEL.dd.close)}; act kind "wait" 1500; if an "Are you sure?" dialog appears now, the change was NOT saved — click "Keep changes", repeat the save step once, then close again. Then re-open the item the same way: click the search box, Control+a, type ${q(it.name)}, wait 1500, click ${q(SEL.dd.suggestion)}, wait 2000; snapshot mode "efficient" — the sheet heading is ${q(it.name)} and its description textbox contains the new text; report "saved" only if both hold, else "failed" with reason "description did not persist". Then act kind "click" selector ${q(SEL.dd.close)}.`)
      calibrate = true
    })
  } else {
    const storeUuid = ueStoreUuid(ctx)
    if (!storeUuid) return { text: '', calibrate: false, unsupported: ['no Uber Eats store uuid on file'] }
    items.forEach((it, i) => {
      lines.push(`--- item ${i + 1}/${items.length}: ${it.name}`)
      if (!it.externalId) { unsupported.push(it.name); lines.push(`(skip: no item id on file — record as "failed", reason "no item id")`); return }
      step(`browser action "navigate" url ${q(`https://merchants.ubereats.com/manager/menumaker/${storeUuid}/items/${it.externalId}`)}; act kind "wait" 10000 (the Menu Maker item form takes ~10 s to render; a 4 s wait shows only the navigation)`)
      step(`snapshot mode "full" maxChars 30000 — checkpoint: the item form for ${q(it.name)} is open: a Name field with that name, a Description textbox (label "Description(optional)", placeholder "Enter description"), a "Save" button. If only navigation is visible, act kind "wait" 8000 and snapshot again once. If a tour/overlay blocks the page, press Escape once.`)
      if (it.description) step(`act kind "fill" fields [{ "ref": "<the Description textbox ref from that snapshot>", "value": ${q(it.description)} }] (fill replaces the current text)`)
      if (it.imageUrl) step(`exec: curl -fsSL -o /workspace/photo-${i + 1}.jpg ${q(it.imageUrl)}; then browser action "upload" on the item's photo input with that file; accept the default crop (if upload needs an r2Key you cannot obtain, record "photo_skipped" and continue)`)
      step(`act kind "click" on the "Save" button (ref from the checkpoint snapshot); act kind "wait" 3000; snapshot mode "efficient" — checkpoint: no error toast, Save no longer pending. CALIBRATE`)
      calibrate = true
    })
  }
  step('browser action "session" op "close"')
  lines.push('')
  lines.push('Reply with one line — `applied N of M` — then exactly one block:')
  lines.push('```favie-menu-apply')
  lines.push('{ "menu_editor_url": "<DoorDash only: the /merchant/menu-editor/<menu_id>?store_id=… URL you ended up on, else null>", "items": [ { "name": "<item name as given>", "status": "saved" | "failed" | "photo_skipped", "reason": "<only when not saved>" } ] }')
  lines.push('```')
  return { text: lines.join('\n'), calibrate, unsupported }
}
