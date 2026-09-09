# Favie

AI delivery operations for US restaurants: a hosted agent (ZooWork Managed Agents) runs the
restaurant's Uber Eats and DoorDash accounts every day; the restaurant sees what it did and why.

- Plan: `~/.claude/plans/saas-favie-ai-ubereats-doordash-1-landi-wondrous-axolotl.md`
- M0 spike results: `docs/M0-RESULTS.md`

## Docs
- `docs/ONBOARDING.md` — set up your own isolated dev environment (start here)
- `docs/DECISIONS.md` — decision log: why things are the way they are
- `docs/PLAN.md` — full V1 architecture and milestone plan
- `docs/M0-RESULTS.md` — ZooWork browser-capability spike results

## Stack

Next.js 16 (App Router) · Tailwind v4 · Supabase (Postgres + Auth) · Drizzle · Stripe · pg-boss worker · `@zoowork-ai/sdk`

## Local setup

```bash
cp .env.example .env            # fill in the values below
npm install
npm run db:generate && npm run db:migrate   # db:migrate applies statement-by-statement (enum changes need it)
npm run dev                     # web on http://localhost:3000
npm run worker                  # background jobs (ZooWork collect/verify, Zoodata sync)
```

Required env:

| Var | Where from |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database (use the pooled connection for web, direct for migrations) |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Supabase → API keys. Email confirmation stays ON; add `<APP_URL>/auth/confirm` under Auth → URL Configuration → Redirect URLs |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `STRIPE_PORTAL_CONFIG_ID` | Stripe. Product/price/portal already exist (see `.env`). Create the webhook once the app has a public URL: `/api/stripe/webhook` with `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`. **Use a test-mode key locally** — the live key charges real cards |
| `ZOOWORK_API_KEY`, `FAVIE_OPS_SKILL_ID` | ZooWork org token + the published `favie-ops` skill id |
| `ZOODATA_MCP_URL`, `ZOODATA_MCP_TOKEN` | Zoodata (per-restaurant key; dev falls back to mock when unset) |
| `FAVIE_ENCRYPTION_KEY` | `openssl rand -base64 32` — encrypts per-restaurant Zoodata keys |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; the agent's capability URL and Stripe redirects derive from it |

Dev shortcut: `FAVIE_SKIP_BILLING=1` lets you pass the payment step without Stripe.

**The agent must be able to reach your app.** Every run starts with `curl $FAVIE_CONTEXT_URL`, which is built from `NEXT_PUBLIC_APP_URL`. On a laptop that means a tunnel. Use the **named** Cloudflare tunnel (stable hostname); quick tunnels get their hostname recycled after a while and every agent's context URL breaks:

```bash
cloudflared tunnel --origincert ~/.cloudflared/cert.favie.pem --config ~/.cloudflared/favie-local.yml run favie-local
# serves https://dev.favie.us -> http://127.0.0.1:3100
```

`NEXT_PUBLIC_APP_URL=https://dev.favie.us`. If the URL ever changes, rewrite the persona of every existing agent:

```bash
npx tsx scripts/rotate-ctx.ts            # all agents, or pass a restaurant id
```

## How a restaurant gets connected

1. Owner pays ($299, no trial) and accepts the service authorization. The worker provisions a ZooWork agent (`browser: { enabled: true }`, `favie-ops` skill, daily cron, disabled).
2. Owner clicks **Connect DoorDash / Uber Eats** (one platform at a time) → agent opens the portal login page and calls `browser handoff` → the one-time `liveUrl` is redeemed server-side into an embed URL → owner opens it in a new tab and logs in → clicks **I've logged in**.
3. In the same session the agent runs `session save_login` (profile `favie-<restaurant>-<platform>-<stamp>`), enumerates every store the account can see and reports them in the summary's `stores[]`. One store → connected automatically; several → the owner picks (`select_store`). The restaurant takes its name/address/time zone from the chosen store — the owner never types it.
4. Owner sets monthly ad caps (Preferences) → dashboard. Every restaurant shares one goal (more orders + more profit); there is no per-restaurant goal setting. Every morning the cron run restores the saved profile, applies the ad-cap policy, and ends with a `favie-summary` block that the worker turns into calendar entries (each with a reason).

## Languages

English, 简体中文, 繁體中文, Español, 日本語. The first visit picks the browser's `Accept-Language`
(proxy.ts writes the `favie_locale` cookie); the header switcher changes it and, when signed in, stores
it on `users.locale`. The agent receives that language in its context and writes titles/reasons in it.
Strings live in `src/i18n/dictionaries/*.ts` (typed against `en.ts`, so a missing key is a type
error). Admin and legal pages stay English.

## Sysadmin (`/admin`)

Only logins listed in `ADMIN_EMAILS` (plus `kevin_z@srp.one`) can open it; everyone else gets a 404.
- **Agent operating prompt**: the single daily-routine prompt for every customer's agent. It is the
  `{{OPERATING_PROMPT}}` section of `skills/favie-ops/SKILL.template.md`; publishing renders SKILL.md and
  uploads a new `favie-ops` skill version, which all (unpinned) agents pick up on their next run.
  Versions are kept in `agent_prompt_versions`; roll back = republish an older body.
- Per customer: pause/resume the daily cron, run the routine now (manual run), read recent runs.
- The connection protocol (handoff, login confirmation, store listing, favie-summary contract) lives in
  the template and is not editable from the UI on purpose — the backend parses it.

## Scripts

- `npm run m0` — ZooWork go/no-go spike (creates and tears down a throwaway agent)
- `npx tsx scripts/publish-skill.ts` — publish a new version of `skills/favie-ops`
- `npx tsx scripts/skill-smoke.ts` — end-to-end check that a fresh agent reads the skill and emits a valid summary
- `npx tsx scripts/m0-handoff-probe.ts` — shows the `browser handoff` live-view link flow
- `npx tsx scripts/m0-browser-probe.ts` / `m0-savelogin-probe.ts` — browser tool schema and login-state persistence probes
