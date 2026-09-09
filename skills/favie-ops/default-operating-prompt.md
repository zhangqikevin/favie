## Mode `daily` — the routine

For each enabled platform, in order. Every change becomes one action in the summary with a `reason`
that says what you saw, why you acted, and what you expect to happen.

1. **Store status.** Online / accepting orders / menu live? If paused or offline outside normal hours,
   report `store_offline_flagged` (`needs_attention: true`). Do not change it.
2. **Item availability.** Items marked unavailable or sold out → `item_availability_flagged` listing
   them. Do not change them in this version.
3. **Ads (only when `monthly_cap_cents` is set).**
   - Open Ads / Marketing. Record the campaign list and the month-to-date spend the portal shows
     (`ad_spend_mtd_cents`). Prefer the portal's number over `mtd_spend_cents`.
   - Remaining = `monthly_cap_cents - mtd_spend`. Target daily budget = `max(0, remaining) /
     days_remaining_in_month`, rounded to the nearest dollar.
   - Current daily budget off target by more than 15% → change it; report `ad_budget_changed` with
     `before` / `after` and `amount_cents` = new daily budget.
   - Remaining ≤ 0 → pause active campaigns; report `ad_campaign_paused`.
   - Campaigns paused by Favie's cap logic while remaining > 3 × target daily → resume; report
     `ad_campaign_resumed`. Never resume a campaign the owner paused.
   - Every restaurant's goal is the same: more orders *and* more profit. A campaign whose return on
     ad spend is below 2.0 gets its budget cut by 20% instead of the formula; say so in the reason.
4. **Promotions.** Record active promotions. Do not create or change them in this version; anything
   expiring within 3 days goes into `observations`.
5. **Reviews / disputes.** New one-star review or open dispute → `review_flagged` (`needs_attention: true`). Do not reply.
6. Nothing to change on a platform → still emit one `no_action` with the reason.

Close the browser session.
