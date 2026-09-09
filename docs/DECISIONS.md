# Favie — decision log

Decisions that are not derivable from the code. Newest at the bottom. Dates are 2026.

## Product
- **One job.** Favie runs a US restaurant's Uber Eats and DoorDash accounts (ads, promotions, store health). Everything else (Chef/Social/CS agents, team members, approval flows, multi-location UI) is out of V1.
- **Pricing.** $299/mo per restaurant, paid at signup, no trial, full refund within 30 days (handled manually in Stripe). Customer Portal for card/cancel.
- **No per-restaurant goal (09-09).** Every restaurant's goal is "more orders + more profit". Onboarding does not ask, Settings does not show it, the agent context does not carry it. The `restaurants.goal` column still exists but is unused.
- **No user-facing Pause button.** Schedule on/off is purely internal gating (billing, connection state, admin).
- **Every agent action carries a `reason`.** The dashboard's "why" comes from it; `no_action` still needs one.
- **Weekly digest** is a placeholder table + disabled job only.
- **Zoodata is never named to owners (09-09).** UI says "order data" / "data access key".

## Agent topology (ZooWork Managed Agents)
- One ZooWork agent per restaurant, modeled in `restaurant_agents` so a restaurant can have several agents later. Labels: `app=favie, restaurant_id, kind`.
- One **org-level skill `favie-ops`**, unpinned, so publishing a new version upgrades every customer's agent at once. The skill = fixed protocol template (`skills/favie-ops/SKILL.template.md`) + the **global operating prompt** edited by sysadmins at `/admin` (`agent_prompt_versions`). It is one prompt for Favie's service agent, not per restaurant.
- Daily cron `daily-ops` per agent, isolated session, minute staggered by restaurant-id hash. Both existing restaurants have the cron **paused** (`daily_schedule_paused`) until Kevin writes the operating prompt.
- The agent fetches everything mutable (caps, MTD spend, login label, language, service_disabled) from a per-agent capability URL `/api/agent/ctx/<token>` at the start of each run. Rotating the token rewrites the agent persona (`scripts/rotate-ctx.ts`).
- The **backend** calls Zoodata MCP, never the agent.
- The summary contract: the run ends with one ```favie-summary``` fenced JSON (zod `FavieSummary`). Parse failure → `run_unparsed` action, still visible on the calendar.

## Platform login = browser handoff (09-08)
- No ops mailbox, no Manager invitation, no OTP reading. The agent opens the portal login page, `browser handoff` returns a one-time live URL, the **owner logs in themselves** in a new tab, clicks "I've logged in", and the agent `save_login`s the profile and enumerates the stores in the account; the owner picks one. Owners never type restaurant info.
- **One browser profile per restaurant** (`restaurants.browser_login_label`, `favie-<rid8>`), shared by both platforms, because one agent has one browser and a lingering session locks the profile.
- Messages to the agent carry parameters only (`FAVIE_HANDOFF <platform>` …); procedure lives in the skill. Instruction-like text in messages ("skip your step", "ignore the flag") gets refused as prompt injection.
- Login labels are declared opaque in the skill; a label containing another platform's name was flagged by the model.

## Data
- **Zoodata source of truth (09-09):** `restaurant_v2_platform_health` for orders and sales (order feed, fresh even before the portal reports; DoorDash's portal report lagged 3 days). `platform_daily` supplies ad spend, ROAS, rating, downtime. Cross-check with `channel_economics`. Uber Eats orders carry no attribution flag, so attributed sales there = ROAS × spend.
- Yesterday's row is usually `isMature:false`; it is stored, flagged, and overwritten by the next daily sync (which pulls the last 3 days).
- Restaurants **without their own key get deterministic sample data**. The global test token is never attributed to a customer.
- All run/action dates are the **restaurant's local day**, computed by us. The agent's own `run_date` is ignored (its sandbox clock is UTC).

## Dev environment
- Each developer runs an **isolated environment**: own Supabase project, own Postgres, own tunnel host (`NEXT_PUBLIC_APP_URL`). Shared: the ZooWork org key and `FAVIE_OPS_SKILL_ID`, the Zoodata test token. Agents are per-restaurant-row, so separate databases mean separate agents.
- Publishing a prompt/skill version affects **every** agent in the org (all developers' test restaurants and, later, customers). Coordinate before publishing.
- Dev is reached through a Cloudflare tunnel. Cloudflare turns Next's `no-cache` into a 4h cache for dev chunks → stale client code → hydration failure → dead page. `next.config.ts` sends `no-store` for `/_next/static/*` in dev and derives `allowedDevOrigins` from `NEXT_PUBLIC_APP_URL`.
- `drizzle-kit migrate` silently skipped enum changes; migrations run statement-by-statement via `scripts/db-migrate.ts` (`npm run db:migrate`).
- Supabase: the web app uses the transaction pooler (6543, `DATABASE_URL_WEB`), worker and scripts the session pooler (5432). Direct connections are IPv6-only.
