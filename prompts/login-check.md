Read-only login check (mode "verify"-style, change nothing). Follow the favie-ops skill for login handling.

1. Fetch the context from FAVIE_CONTEXT_URL. Restore the browser profile once with `session restart` (loginLabel from the context, egressCountry US).
2. For DoorDash and then Uber Eats: navigate to the platform's portal_url, take one snapshot, and decide: logged in (merchant dashboard or store list visible) or not (login / verification form visible). Do not type anything. If logged in, confirm the store from the context is visible (name or id) with at most 3 more tool calls. Do not open marketing, menus or settings.
3. Close the browser session.
4. Reply with two lines, one per platform: "<platform>: logged in — store <name> visible" or "<platform>: NOT logged in (<what you saw>)", then the favie-summary block (mode "verify", one platform entry each with login, store_visible, store_name; no actions).
