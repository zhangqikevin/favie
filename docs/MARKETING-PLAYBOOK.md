# Delivery marketing playbook (Uber Eats + DoorDash)

Research notes behind the Favie agent's operating prompt v3 (2026-09-10). Aimed at small independent
Asian restaurants and small Asian chains in the US. Numbers are the platforms' own published figures
unless marked otherwise; treat them as upper bounds, not promises.

## How the two platforms actually charge

| | Uber Eats | DoorDash |
|---|---|---|
| Ads product | Sponsored Listings in Uber Eats Manager | Sponsored Listings in the Merchant Portal |
| Ads pricing | **Pay per click** (CPC); automatic bidding by default, manual under "Advanced" | **Pay per order** (CPA); second-price auction; automatic or custom max bid |
| Ads budget | Daily/weekly budget, pauses when hit, restarts next period | "Average weekly budget" |
| Ads audiences | All customers / New customers | Smart targeting / All / New / Existing (6 mo) / Lapsed (6+ mo) |
| Ads reporting | ROAS, attributed sales (order within 7 days of click), new customers; **~48 h data lag** | ROAS, orders, new customers; 7-day attribution |
| Ads benchmarks (platform-stated) | median 5–11× ROAS; top-2 carousel slots = 50%+ of orders | $6 sales per $1; 45%+ of ad orders are new customers |
| Promotions | BOGO, Spend X save Y, free item with minimum, $0 delivery fee, item discount; up to 5 live; audience All / New only; schedulable | New-customer discount, lapsed-customer discount, all-customer % or $ off (min subtotal + max discount), $0 delivery fee, free/discounted item, BOGO, Happy Hour, Lunch Special (time-boxed, top-10 items preselected) |
| Promotion cost | Merchant funds the discount | Discount **+ $0.99 marketing fee per order**; commission on the discounted subtotal |
| Promotion benchmarks | orders +23%, sales +15%; BOGO orders +39%, AOV +25% | sales +20%; ads + promo together = 1.7–2.2× the lift of either alone |
| Free credits | — | often $100 ads + $100 promotions for a first campaign |

## What practitioners agree on

1. **Fix conversion before buying traffic.** Photos on the top 15 items, English names + searchable
   keywords, accurate prep times, staying online. Poor conversion makes CPC ads (Uber Eats) expensive
   fast; DoorDash's pay-per-order model is more forgiving.
2. **Ads: always-on, automatic bidding, stable budget, judge on 7-day windows.** Changing budgets daily
   makes the auction unlearn; the platforms recommend 30 days before conclusions.
3. **Promotions buy a specific behavior; whole-menu discounts buy nothing.**
   - New-customer discount = acquisition (both platforms).
   - Spend-threshold discount with the threshold 20–30% above AOV = bigger baskets.
   - Happy Hour / scheduled offer 2–5 pm = fills the weekday lull without touching dinner margin.
   - BOGO on a high-margin, low-food-cost item (dumplings, buns, apps, drinks) = trial + basket.
   - Lapsed-customer discount (DoorDash only) = win-back once the store has 6+ months of history.
4. **Ads and promotions stack; two whole-menu promotions do not.** Never run two blanket discounts at once.
5. **Guardrails that protect margin:** discount ≤ 20% of the minimum subtotal and ≤ $8; minimum subtotal ≥
   AOV; no merchant-funded free delivery under $30; never opt in/out of DashPass, Uber One, or pricing plans.
6. **One change at a time; 7 days for ads, 14 for promotions.** Daily numbers are noise.

## Asian-restaurant specifics

- AOV typically $25–40 with shareable dishes → spend-threshold offers and family bundles outperform % off.
- Dumplings, buns, appetizers and drinks are the natural BOGO candidates; entrées and combos are not.
- Chinese-only item names hurt search; add English names and keywords (dumplings, noodles, hot pot, spicy).
- Weekday lunch and 2–5 pm are the lulls; Friday–Sunday dinner is the peak — do not discount the peak.
- Many owners also run HungryPanda / Fantuan for the Chinese-speaking audience; Uber Eats and DoorDash are
  mainly new, non-Chinese-speaking customers → new-customer offers first.

## Sources

- Uber Eats Sponsored Listings FAQ — https://help.uber.com/merchants-and-restaurants/article/sponsored-listings-faq?nodeId=b76c227a-9850-42cd-a419-163adae83fed
- Uber Eats Manager ads creation (Dec 2025) — https://merchants.ubereats.com/us/en/resources/articles/product-highlights/uber-eats-manager-ads-creation-dec-2025/
- Uber Eats: Is marketing actually affordable? — https://www.uber.com/au/en/blog/uber-eats-affordable-marketing/
- Uber Eats Merchant Academy: Promotions — https://merchants.ubereats.com/us/en/academy/promotions/
- Uber Eats: 10 types of sales promotions — https://merchants.ubereats.com/us/en/resources/articles/10-types-of-sales-promotions/
- DoorDash: Getting started with Sponsored Listings — https://help.doordash.com/en-us/merchants/article/getting-started-with-self-serve-sponsored-listing
- DoorDash: How to use Promotions — https://help.doordash.com/en-us/merchants/article/getting-started-with-doordash-promotions
- DoorDash: Happy Hour promotion — https://help.doordash.com/en-us/merchants/article/happy-hour-discount-on-doordash
- DoorDash: How ads and promotions work — https://merchants.doordash.com/en-us/learning-center/marketing-to-new-customers
- DoorDash: Use marketing to attract new customers — https://merchants.doordash.com/en-us/learning-center/how-to-get-new-customers
- DoorDash Promotions product page — https://merchants.doordash.com/en-us/products/promotions
- FoodShot: How to get more orders on Uber Eats (12 tactics) — https://foodshot.ai/blog/how-to-get-more-orders-on-uber-eats
- Deliverect: Advertising with Uber Eats Ads — https://www.deliverect.com/en-us/blog/online-food-delivery/how-to-advertise-your-restaurant-cstore-with-uber-eats-ads
- Stackmatix: DoorDash Ads practical guide — https://www.stackmatix.com/blog/doordash-ads
