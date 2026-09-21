import { getSetting, SETTING_KEYS } from '@/server/settings'
import type { Platform } from '@/lib/db/schema'

/**
 * The portal procedures for the FAVIE_DISPUTES task, and the rules for the dispute text. They travel inside the
 * task message (not the skill), so a sysadmin can edit them in /admin/dispute-prompts and the next run uses them —
 * no skill publish. Built-in defaults below; a saved setting overrides each one.
 *
 * Placeholders the backend fills in: {store_name} {store_id} {list_url} {writing_rules}
 */

/** How to write the dispute text — shared by every platform. */
export const DEFAULT_DISPUTE_WRITING_RULES = `Write the dispute text in ENGLISH, at most 400 characters (count before you type; the fields truncate or reject longer text). Assertive, no apologies, no hedging, never mention Favie or an AI. You write the store's packing standards yourself — the owner supplies nothing. Use this frame and replace the bracketed part:

"This deduction is invalid. Every order at our store passes two checks: before packing, each item and customization is verified against the ticket; before courier handoff, the item count is rechecked and the bag is sealed. This order passed both checks. [hard fact] Please reverse this charge in full."

The [hard fact] is ONE concrete contradiction taken from the order itself, for example:
- "The ticket lists 1× Beef Chow Fun; the customer reports a missing Chicken Chow Fun that was never ordered."
- "The order held 3 items in one sealed bag; a missing item would have left the seal broken."
- "The charge ($18.40) exceeds the item price ($12.95)."
- "The customer's own photo shows the item they claim is missing." (ONLY when you have actually seen the photo's content in a screenshot you already took — never open, enlarge or analyse a photo to get this, and never describe a photo you have not seen.)
- "The courier picked up at 1:07 pm, 10 minutes after the order was ready; the delay is the courier's."
- "This customer has placed 2 orders at our store and reported an issue on both."
Never invent a fact. If the order shows nothing usable, state the two checks and the exact items and quantities on the ticket.`

export const DEFAULT_DISPUTE_PROMPT_UBER_EATS = `UBER EATS MANAGER — charged order issues. Portal labels are given as Chinese / English; the account may show either.

1. Restore the login and open Uber Eats Manager. If the account has several stores, switch to "{store_name}" in the store switcher BEFORE opening any list, and work on that store only.
2. Open the filtered list directly — do not build the filters by clicking. Navigate to
   {list_url}
   (if the current URL carries a restaurantUUID= parameter, keep it). Wait 4 seconds, then ONE snapshot (mode "efficient"; never "full" over 15000 chars). Check the sidebar still shows this store and the chips read 最近 30 天 / Last 30 days and 订单问题 / Order issue (9). If the filters did not apply, open the 订单问题 chip once, tick every box, Apply.
3. The 问题 / Issue column gives each row's state:
   - 已收费问题 / Charged issue (a red -US$x.xx under the subtotal is the charge) → to dispute.
   - 优步已退款 / Refunded by Uber → the store was not charged: skip, do not open it.
   - 异议已通过审核 / Dispute accepted, 异议被拒绝 / Dispute rejected → results of earlier appeals: record them, never dispute again.
   Count the charged rows → disputes_found.
4. For every order in the "awaiting a decision" list of this message: find it (search by order id) and record the outcome — accepted → "won" with recovered_cents and decision_text; rejected → "lost"; still under review → "filed".
5. For every other charged order not in the "already settled" list: open the order detail by SEARCHING its order id (never by editing the URL or guessing a /dispute link). Read: items and customizations ordered (items_total), what the customer reported (items_disputed), the customer's note (customer_note), whether a photo is attached (customer_photo), new or returning customer (customer_type), the charged amount (amount_cents), the order date. If it already shows as disputed / under review → report "filed" with filed_by "owner" and move on.
6. Click 争议 / Dispute. A panel slides out from the side — wait until it has finished rendering and snapshot again before touching it. Choose the reason that fits:
   - 顾客出错了 / Customer made a mistake — the item was in the bag / on the receipt.
   - 顾客提供的证据有误 / Customer's evidence is wrong — photo or claim contradicts the order.
   - 退款金额不正确 / Refund amount is incorrect — charged more than the item's price.
   - 其他 / Other.
   Put the option's English name in reason_category.
7. {writing_rules}
8. Type the text, snapshot, and re-read the panel before pressing 提交 / Submit: right reason, text complete and under 400 characters, right order id in the header. Press Submit ONCE.
9. Success = the confirmation 您的异议已提交 / Your dispute has been submitted. If a rating / feedback prompt follows, dismiss it — do not rate. If no confirmation appears, snapshot and check whether the order now shows as disputed; if not, report it as "open" with the error in reason — never submit a second time.
10. Report the order as status "filed", filed_by "favie", submitted_text = exactly what you sent, reason = one sentence for the owner (their language).

Speed: element refs go stale when a panel opens or the list re-renders — snapshot again after any click that changes the page, and prefer text selectors over old refs. Pass timeoutMs 8000 on every click. Use snapshots, not screenshots (one screenshot right before Submit). About 12 tool calls per order; if the list is long, newest first and report the rest as "open".`

export const DEFAULT_DISPUTE_PROMPT_DOORDASH = `DOORDASH MERCHANT PORTAL — error charges (错误费用 / Error charge). Portal labels are given as Chinese / English; the account may show either.

1. Restore the login and navigate to
   {list_url}
   The store_id in that URL selects the store. If the header does not show "{store_name}", pick it in the store selector at the top (the second selector, the one with the street address) and check the URL now carries store_id={store_id}.
2. Date range (first button, 过去 7 天 / Last 7 days by default) → choose 过去 30 天 / Last 30 days. Then open the transaction-type filter above the table (所有交易类型 / All transaction types), tick ONLY 错误费用 / Error charge, press 应用 / Apply. The heading reads "N 笔交易 / N transactions"; every row has 交易类型 = 错误费用. The 描述 / Description column says what the customer reported, the 错误费用 column is the amount. One order can have several rows — treat them as ONE dispute per order id, amount = the total the order panel shows. Count distinct orders → disputes_found. The filter is not part of the URL: after any reload, apply it again.
3. Click the order id (订单 ID column). A panel slides in from the right; its URL is /merchant/financials/transactions/<uuid>?store_id=… — wait until it has rendered, then snapshot. Read from the panel:
   - the status box at the top: "在 <date> 之前采取行动 / Take action by <date>" = still open, that date is the deadline; it names what was reported ("报告了缺少 1 个单品 / 1 item reported missing") and the amount ("US$9.46 的错误费用 …").
   - 顾客 / Customer: whether it says 重要顾客 / valued customer, how long on DoorDash, and "在您的店铺下过 N 个订单 / N orders at your store" → customer_type ("new" when N ≤ 1, else "returning").
   - 派送员 / Dasher: Picked up and Dropped off times next to the assigned times — a late pickup or a long delivery is the courier's, not the kitchen's.
   - 订单详情 / Order details: every item with quantity and price (items_total), discounts, subtotal.
   - 错误费用 / Error charge section: the item(s) charged, the type (缺少整个单品 / Missing item, 单品不正确 / Wrong item, 制作不当 / Poorly made …), the customer's comment in quotes (customer_note), whether a photo is attached (customer_photo), and 错误费用总计 / Error charge total (amount_cents, a positive number of cents).
4. State of the charge:
   - A button 争议收费 / Dispute charge is there → not disputed yet: dispute it (steps 5–8).
   - No button, and the status reads 争议待处理 / Dispute pending with 争议在审查中 / Dispute under review ("您可以在几个小时后回来查看决定 / check back in a few hours") → "filed" (filed_by "owner" unless it is in this message's "awaiting a decision" list).
   - It says approved / credited / refunded (已批准, 已退还, Approved, Credited) → "won", recovered_cents = the amount returned, decision_text = the wording shown.
   - It says denied / rejected (已拒绝, Denied) → "lost" with decision_text.
   - The deadline has passed and there is no button → "expired".
   For every order in the "awaiting a decision" list, open its panel and record the state the same way.
   Once you know an order's panel URL (/merchant/financials/transactions/<uuid>?store_id=…; the uuid ends with the order id in lower case) you may navigate to it directly instead of clicking through the list.
5. Click 争议收费 / Dispute charge — selector button:has-text("Dispute charge") or button:has-text("争议收费"). A form opens in the middle of the screen: "对订单 <id> 的错误费用提出异议 / Dispute error charge for order <id>". Wait for it, snapshot (mode "full", interactive true — mode "efficient" hides this form; a fullPage screenshot shows the items, what the customer reported and their comment). When several items were charged, each has a checkbox: tick every one first — the reason selectors only appear after that. For EACH charged item the form has a required selector 选择原因（必填）/ Select a reason (required), shown as 选择选项 / Choose an option — click that text, then click the option's text. Choose the option that matches what actually happened:
   - 按要求准备的单品 / Item was prepared as requested — the customer says an item was wrong or badly made, but the ticket shows it was made as ordered.
   - 单品未自取 / Item was not picked up — the item was packed and ready; the courier left without it.
   - 订单自取迟到 / Order was picked up late — quality or temperature complaint and the courier picked up well after the assigned time.
   - 订单处理不当 / Order was mishandled — the order left the store complete and sealed; the damage or loss happened in the courier's hands.
   - 其他原因 / Other reason — none of the above fits (for example a "missing item" claim on a sealed bag that was checked twice).
   Put the option's English name in reason_category.
6. {writing_rules}
7. Where the text goes — address the boxes by selector, never by scrolling (a click or type on a selector scrolls it into view by itself; scrolling inside this form fails and wastes minutes):
   - ALWAYS: 添加其他备注 / Add additional notes = textarea[name="additional-notes"] (limit 500 characters). Click it, type the text.
   - ONLY when you chose 其他原因 / Other reason: a second box 争议原因 / Dispute reason (placeholder "请描述您为何对此费用提出争议 / Describe why you're disputing this charge") appears right under the selector = the textarea that is NOT [name="additional-notes"] (textarea:not([name="additional-notes"])). Type the SAME text into it as well — both boxes must carry the text.
   After typing, snapshot once and check BOTH boxes show the text. Never press Escape while the form is open (it discards everything you typed). Never click 选择文件 / Choose file and do not upload anything.
8. Snapshot and re-read the form: right order id in the title, a reason selected for every item, the text complete in the box(es), 总退款金额 / Total refund amount equal to the charge. Press 提交以供审查 / Submit for review ONCE — selector button:has-text("Submit for review") or button:has-text("提交以供审查"). Success = a confirmation ("Dispute submitted"; do not click its 关闭 / Close button — a feedback overlay blocks it and the click only times out), and the panel then reads 争议待处理 / Dispute pending · 争议在审查中 / Dispute under review with no 争议收费 button. If that does not happen, snapshot; if the 争议收费 button is still there with no error shown, report the order as "open" with what you saw in reason — never submit a second time.
9. Report the order as status "filed", filed_by "favie", submitted_text = exactly what you typed, reason = one sentence for the owner (their language), deadline = the "take action by" date, kind = "missing_item" / "wrong_item" / "error_charge", detail_url = the panel URL of the order (report detail_url for every order you open, whatever its state). Close the panel (✕ or Escape) before opening the next order.

Speed: element refs go stale when the panel or the form opens — snapshot again after any click that changes the page, and prefer text selectors (button:has-text("争议收费"), button:has-text("提交以供审查")). Pass timeoutMs 8000 on every click. Use snapshots, not screenshots (one screenshot right before submitting). About 14 tool calls per order; if there are many, the ones with the nearest deadline first, and report the rest as "open".`

/**
 * FAST (scripted) single-order runs (FAVIE_DISPUTES_FAST — the skill's task table sanctions skipping Step 0; an
 * unsanctioned "do not read the skill" message was treated as an injection): no context fetch, no exploring — the message carries the
 * login label and a fixed sequence of calls with exact selectors. Placeholders: {order_id} {order_id_lower}
 * {detail_url} (empty when unknown) {list_url} {store_name} {store_id} {writing_rules}
 */
export const DEFAULT_DISPUTE_FAST_DOORDASH = `DOORDASH — scripted dispute of ONE order: {order_id}. Do exactly these calls, in this order — about 20 tool calls, under two minutes. Nothing else: no extra snapshots or screenshots, no scrolling (scrolling inside this panel and form always fails), no hovering, never press Escape, never click 选择文件 / Choose file, no other skills, no image tool, no exec / write. Every click passes timeoutMs 8000. Labels are English / Chinese — use whichever the page shows. Snapshot mode "efficient" hides this page's content — use the modes written here.

OPEN THE ORDER PANEL
A. If this line shows a URL, navigate to it and go to step C:  {detail_url}
B. Otherwise: navigate to {list_url} ; act wait 3000 ; click selector  button:has-text("All transaction types")  (or 所有交易类型) ; click text "Error charge" / "错误费用" ; click selector  button:has-text("Apply")  (or 应用) ; act wait 3000 ; click selector  td a[href*="{order_id_lower}"] . Only if that last click times out: click the date-range button ("Last 7 days" / "过去 7 天"), click "Last 30 days" / "过去 30 天", act wait 3000, and click the order link again.

LOOK — two looks, no more
C. act wait 3000 ; ONE snapshot (mode "full", maxChars 40000). The order panel is at the END of the tree, after the transactions table. Read from it: the deadline ("Take action by …"), what was reported, the error-charge total, the customer block (how many orders at this store), Picked up / Dropped off against the quoted times. The item list and the customer's comment are usually NOT in this snapshot — they come in step D; do not go looking for them here.
   - No button "Dispute charge" / "争议收费" → do NOT continue: report the state you see ("filed" when it says Dispute pending / under review, "won" when approved, "lost" when denied, "expired" when the window ended) and go to step J.
D. click selector  button:has-text("Dispute charge")   (or button:has-text("争议收费")) ; act wait 2000 ; ONE screenshot (fullPage true). The form "Dispute error charge for order {order_id}" lists every charged item with what the customer reported, their comment, and whether a photo is attached. A photo: record only that one is attached (customer_photo true) — never open, enlarge or analyse it and never say what it shows. Whatever these two looks did not show stays null in the report.

WRITE (no tool call)
E. Choose ONE reason for the charged items: "Item was prepared as requested" / 按要求准备的单品 · "Item was not picked up" / 单品未自取 · "Order was picked up late" / 订单自取迟到 · "Order was mishandled" / 订单处理不当 · "Other reason" / 其他原因. Then write the text — 45 to 60 words, which keeps it under the limit: do NOT measure it with exec / wc / files, and do not write drafts:
   {writing_rules}

FILL THE FORM (refs go stale after every click here — take each ref from the snapshot just before the click)
F. ONE snapshot (mode "full", interactive true). If the charged items have checkboxes that are not checked (orders with several charged items), click each one, then take ONE more snapshot (full, interactive true). With a single item there is usually no checkbox.
G. For each item's reason selector — it reads "Choose an option" / "选择选项": click its ref ; ONE snapshot (full, interactive true) ; click the option of your reason. Repeat until no selector reads "Choose an option".
H. click selector  textarea[name="additional-notes"]  ; type the text into the same selector. ONLY when the reason is "Other reason": also click selector  textarea:not([name="additional-notes"])  and type the SAME text there.
I. ONE screenshot (fullPage true): the order id in the form title is {order_id}, a reason shows for every charged item, the text is in the box(es), the total refund equals the charge. Then click selector  button:has-text("Submit for review")   (or button:has-text("提交以供审查")) — ONCE. act wait 3000 ; ONE screenshot: success = "Dispute submitted" / a confirmation, or the panel reading "Dispute pending" / "争议待处理". Do NOT click "Close" (a feedback overlay blocks it and the click only times out). If neither shows, report status "open" with what you saw — never submit again.
J. browser session close. Reply at once with the summary block (mode "disputes", this one order, submitted_text = exactly what you typed, detail_url = the panel URL) — no preamble, no exec.`

export const DEFAULT_DISPUTE_FAST_UBER_EATS = `UBER EATS — scripted dispute of ONE order: {order_id}. Do exactly these calls, in this order. No extra snapshots, no screenshots except where stated, never press Escape. Every click passes timeoutMs 8000. Labels are English / Chinese — use whichever the page shows.

OPEN THE ORDER
A. navigate to {list_url} ; act wait 4000. If the sidebar does not show "{store_name}", switch to it in the store switcher first, then navigate to the same URL again.
B. click the search box ("Search by customer name or order ID" / "搜索顾客姓名或订单编号") ; type {order_id} ; press Enter ; act wait 3000 ; click the row whose order id is {order_id}.
C. act wait 3000 ; ONE snapshot (mode "efficient"). Read: items and customizations ordered, what the customer reported, the customer's note, whether a photo is attached, new or returning customer, the charged amount.
   - The issue reads "Refunded by Uber" / 优步已退款 → not charged: report "skipped" and go to step I. It reads "Dispute accepted" / 异议已通过审核 → "won"; "Dispute rejected" / 异议被拒绝 → "lost"; already under review → "filed". In all these cases go to step I without touching anything.

WRITE (no tool call)
D. Choose the reason: "Customer made a mistake" / 顾客出错了 · "Customer's evidence is wrong" / 顾客提供的证据有误 · "Refund amount is incorrect" / 退款金额不正确 · "Other" / 其他. Then write the text:
   {writing_rules}

FILL THE FORM
E. click button "Dispute" / "争议" ; act wait 2500 (a panel slides in — it must finish rendering).
F. click the text of the reason you chose.
G. click selector  textarea  ; type the text.
H. ONE snapshot (mode "efficient"): right order id, reason selected, text complete. Then click button "Submit" / "提交" — ONCE. act wait 3000 ; ONE snapshot: success = "Your dispute has been submitted" / 您的异议已提交. Dismiss a rating prompt without rating. If there is no confirmation, report status "open" with what you saw — never submit again.
I. browser session close. Reply with the summary block (mode "disputes", this one order, submitted_text = exactly what you typed).`

export const DEFAULT_DISPUTE_FAST: Record<Platform, string> = { uber_eats: DEFAULT_DISPUTE_FAST_UBER_EATS, doordash: DEFAULT_DISPUTE_FAST_DOORDASH }
const FAST_KEY: Record<Platform, keyof typeof SETTING_KEYS> = { uber_eats: 'disputesFastUberEats', doordash: 'disputesFastDoordash' }

export async function renderDisputesFastPrompt(platform: Platform, store: { name: string; id: string | null }, order: { id: string; detailUrl: string | null }) {
  const [procedure, rules] = await Promise.all([getSetting(SETTING_KEYS[FAST_KEY[platform]]), getSetting(SETTING_KEYS.disputesWritingRules)])
  return fillDisputesPrompt(procedure?.value ?? DEFAULT_DISPUTE_FAST[platform], rules?.value ?? DEFAULT_DISPUTE_WRITING_RULES, platform, store)
    .replaceAll('{order_id_lower}', order.id.toLowerCase()).replaceAll('{order_id}', order.id).replaceAll('{detail_url}', order.detailUrl ?? '(none — use step B)')
}

const KEY: Record<Platform, keyof typeof SETTING_KEYS> = { uber_eats: 'disputesPromptUberEats', doordash: 'disputesPromptDoordash' }
export const DEFAULT_DISPUTE_PROMPT: Record<Platform, string> = { uber_eats: DEFAULT_DISPUTE_PROMPT_UBER_EATS, doordash: DEFAULT_DISPUTE_PROMPT_DOORDASH }

export const UBER_EATS_ISSUES_URL = 'https://merchants.ubereats.com/manager/orders?dateRange=last_30_days&orderIssuesV2=ORDER_ACCURACY_ISSUE%2CMISSING_CUSTOMIZATIONS%2CWRONG_CUSTOMIZATIONS%2CMISSING_ITEMS%2CWRONG_ORDER%2CWRONG_ITEMS%2CORDER_WITH_FTQ%2CTASTE_QUALITY_ISSUES%2CINADEQUATE_QUANTITY'

export function disputesListUrl(platform: Platform, storeId: string | null) {
  if (platform === 'uber_eats') return UBER_EATS_ISSUES_URL
  return `https://www.doordash.com/merchant/financials/transactions${storeId && /^\d{6,10}$/.test(storeId) ? `?store_id=${storeId}` : ''}`
}

/** The procedure for one platform with the writing rules and the store's values filled in. */
export async function renderDisputesPrompt(platform: Platform, store: { name: string; id: string | null }) {
  const [procedure, rules] = await Promise.all([getSetting(SETTING_KEYS[KEY[platform]]), getSetting(SETTING_KEYS.disputesWritingRules)])
  return fillDisputesPrompt(procedure?.value ?? DEFAULT_DISPUTE_PROMPT[platform], rules?.value ?? DEFAULT_DISPUTE_WRITING_RULES, platform, store)
}

export function fillDisputesPrompt(procedure: string, rules: string, platform: Platform, store: { name: string; id: string | null }) {
  return procedure
    .replaceAll('{writing_rules}', rules.trim())
    .replaceAll('{store_name}', store.name)
    .replaceAll('{store_id}', store.id ?? '(unknown — read it from the URL after selecting the store)')
    .replaceAll('{list_url}', disputesListUrl(platform, store.id))
}
