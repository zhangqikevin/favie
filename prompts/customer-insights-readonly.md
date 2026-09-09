Read-only task (mode "verify"-style, change nothing). Follow the favie-ops skill for login handling.

1. Fetch the context from FAVIE_CONTEXT_URL. Restore the browser profile once with `session restart` (loginLabel from the context, egressCountry US).
2. DoorDash: navigate to the DoorDash Merchant Portal. If you are logged in, select the store from the context, then open the Customers section and its analytics / insights page (labelled e.g. "Customers" → "Customer insights" / "顾客" → "顾客分析"). Read everything visible on that page: the date range shown, every metric with its value (new vs returning customers, total customers, frequency, retention, top items, ratings, anything else), and any charts' headline numbers. Scroll once if the page continues. Do not click anything that changes settings, budgets or campaigns.
3. Uber Eats: navigate to Uber Eats Manager for the store from the context. If logged in, open the Customers section and its analytics page, and read it the same way.
4. If either portal shows a login form, do NOT log in: record `login: "failed"` with reason `not_logged_in` for that platform.
5. Close the browser session.

Then reply in Simplified Chinese with a clear summary per platform: whether the saved login was still valid, and the customer-analytics figures you saw (metric → value, with the date range). Be factual; say "未显示" for anything not shown.

End with the favie-summary block (mode "verify"), one `store_status_checked` action per platform whose reason (in Chinese) contains the customer-analytics summary for that platform.
