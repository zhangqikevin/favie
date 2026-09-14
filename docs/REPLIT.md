# Running Favie on Replit (or any single-container host)

Everything the app needs is in this repo plus a set of secrets. Favie has **two processes**: the Next.js
web app and a pg-boss **worker** (agent runs, menu jobs, handoffs, disputes). Both must run, against the
same Postgres.

## 1. Runtime

- Node **22** (see `.nvmrc`/`package.json`); `npm ci`.
- Start both processes with one command: `npm run start:all` (production build if `.next` exists, else
  `next dev`; the worker runs under a restart loop). For a dev-style run set `FAVIE_DEV=1`.
- Build: `npm run build`. The build does not need the database.

## 2. Secrets (Replit → Secrets)

Copy the names from `.env.example`. The ones that matter, in order of "nothing works without it":

| Secret | Why |
|---|---|
| `DATABASE_URL` | Supabase **session** pooler, port 5432 (worker, migrations, scripts) |
| `DATABASE_URL_WEB` | Supabase **transaction** pooler, port 6543 (web) |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth |
| `NEXT_PUBLIC_APP_URL` | The public URL of this deployment (`https://<repl>.replit.app`). Agents curl `<APP_URL>/api/agent/ctx/<token>` at the start of every run, Stripe and auth emails redirect to it |
| `FAVIE_ENCRYPTION_KEY` | Must be the **same** value as the environment whose database you point at, or saved per-restaurant keys cannot be decrypted |
| `ZOOWORK_API_KEY`, `FAVIE_OPS_SKILL_ID` | Agents. The skill id must be the one already published for this org |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_PORTAL_CONFIG_ID`, `STRIPE_WEBHOOK_SECRET` | Billing (test key unless this is production). `FAVIE_SKIP_BILLING=1` skips the payment step in dev |
| `FIRECRAWL_API_KEY` | Menu Clinic storefront reads (seconds instead of minutes) |
| `RESEND_API_KEY`, `SUPABASE_SEND_EMAIL_HOOK_SECRET`, `AUTH_EMAIL_FROM` | Auth emails through our hook |
| `ADMIN_EMAILS` | Who can open `/admin` |
| `ZOODATA_MCP_URL`, `ZOODATA_MCP_TOKEN` | Order/sales data; optional (sample data without a key) |

Secrets never go into git. `.env*` is ignored except `.env.example`.

## 3. Database

Migrations are SQL files under `drizzle/`, applied by `npm run db:migrate` (statement by statement,
idempotent by content hash). Against the existing Supabase project this is a no-op; against a fresh
Postgres it creates everything, including the `pgboss` schema the worker needs.

Never point two live deployments at the same database with different `FAVIE_ENCRYPTION_KEY`s.

## 4. Things that are tied to the public URL

When the deployment URL is new (not `dev.favie.us`), three external systems need to learn it:

1. **Supabase Auth** — `site_url`, the redirect allow-list (`<APP_URL>/**`) and the Send Email hook URL
   (`<APP_URL>/api/auth/send-email`). One command, needs the Supabase personal access token:
   ```bash
   env SUPABASE_ACCESS_TOKEN=sbp_… NEXT_PUBLIC_APP_URL=https://<repl>.replit.app \
       SEND_EMAIL_HOOK_URL=https://<repl>.replit.app/api/auth/send-email SEND_EMAIL_HOOK_SECRET='v1,whsec_…' \
       npx tsx scripts/supabase-auth-config.ts
   ```
2. **Stripe webhook** — create an endpoint for `<APP_URL>/api/stripe/webhook` (events listed in the
   README) and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. **Existing agents** — each ZooWork agent's persona carries the context URL of the environment that
   created it. After changing `NEXT_PUBLIC_APP_URL`, rewrite them once:
   ```bash
   npx tsx scripts/rotate-ctx.ts
   ```
   New restaurants provisioned from the new URL are fine without this.

The live-browser handoff (owner logs in to Uber Eats / DoorDash) works from any origin — the noVNC page
is proxied through our own routes, nothing to configure.

## 5. What the worker does, so you know it is alive

Log line `[worker] up; queues: …` on start. It polls Postgres (pg-boss); no inbound ports. If the
database drops every connection it exits with code 75 and the loop restarts it. Health check: the
`/admin` customers table's "Last run" column moves, and `pgboss.job` rows leave `created`.

## 6. Do not

- Do not run Menu Clinic **Sync** or the daily routine with `Agent changes` switched on against real
  restaurants while testing — those write to live Uber Eats / DoorDash menus and campaigns. New
  restaurants start observe-only; keep it that way on a test deployment.
- Do not commit `.env`, `supabase/email-templates/*.html` previews are fine.
- Do not change `FAVIE_ENCRYPTION_KEY` on an existing database.
