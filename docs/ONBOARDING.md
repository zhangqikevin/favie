# Developer onboarding (isolated environment)

Every developer runs their own database, auth project and tunnel. What is shared is the ZooWork organization (one key, one `favie-ops` skill) and the Zoodata test token. Read `docs/DECISIONS.md` first, then `docs/PLAN.md` for the full architecture.

## 1. Accounts you need from Kevin
| Item | Why | Shared or yours |
|---|---|---|
| `ZOOWORK_API_KEY` | creates/starts agents, publishes the skill | shared (org key, server-side only) |
| `FAVIE_OPS_SKILL_ID` | the org skill every agent installs. **Never run the first-time upload again** — use this id | shared |
| `ZOODATA_MCP_TOKEN` (optional) | test restaurant data | shared |
| Supabase project | Postgres + Auth | **yours** (free tier is fine) |
| Cloudflare tunnel hostname | the ZooWork sandbox must reach your `/api/agent/ctx/<token>` | **yours** |
| Stripe | not needed in dev — set `FAVIE_SKIP_BILLING=1` | skip |

## 2. Supabase project
1. Create a project. Copy the URL, the **secret** key and the **publishable** key.
2. Auth → Providers → Email: keep **email confirmation ON** (signup flow depends on it).
3. Auth → URL Configuration → Redirect URLs: add `https://<your-tunnel-host>/auth/confirm` and `http://localhost:3100/auth/confirm`.
4. Connection strings: use the **session pooler (5432)** for `DATABASE_URL` and the **transaction pooler (6543)** for `DATABASE_URL_WEB`. Direct connections are IPv6-only and will not work from most laptops.

## 3. Tunnel
```bash
brew install cloudflared
cloudflared tunnel login                       # once
cloudflared tunnel create favie-<you>
# ~/.cloudflared/favie-<you>.yml: hostname dev-<you>.favie.us -> http://127.0.0.1:3100 (ask Kevin to add the DNS route)
cloudflared tunnel run favie-<you>
```
A quick tunnel (`cloudflared tunnel --url http://localhost:3100`) also works but its hostname is recycled after a while; every change of hostname requires `npx tsx scripts/rotate-ctx.ts` so your agents learn the new context URL.

## 4. Local setup
```bash
cp .env.example .env            # fill in everything above; openssl rand -base64 32 for FAVIE_ENCRYPTION_KEY
npm install
npm run db:migrate              # statement-by-statement migrator; do not use drizzle-kit migrate
npm run dev -- -p 3100          # web
npm run worker                  # background jobs, in a second terminal
```
Add your login email to `ADMIN_EMAILS` to reach `/admin`.

## 5. Register a test restaurant
Sign up → confirm email → (dev skips billing) → authorize → connect Uber Eats / DoorDash by logging in yourself in the secure browser tab → pick the store → set caps. This provisions **your own** ZooWork agent (labeled with your restaurant id). Daily crons are enabled by `reconcileSchedule`; set `restaurants.daily_schedule_paused = true` if you do not want it to run against a real account every morning.

## 6. Rules of the shared ZooWork org
- Publishing from `/admin` or `scripts/publish-skill.ts` upgrades **every** agent in the org, including Kevin's. Say so in the team channel before you do.
- Do not delete or stop agents you did not create (`listAgents({ labels: { app: 'favie' } })` shows all of them).
- Never paste the org key, database passwords or Zoodata tokens into chat or commits. `.env` is git-ignored; keep it that way.

## 7. Useful scripts
| Script | Purpose |
|---|---|
| `scripts/run-prompt.ts <rid8> <file.md>` | run an ad-hoc prompt on a restaurant's agent and stream it |
| `scripts/rotate-ctx.ts [restaurantId]` | new capability token + persona rewrite after the app URL changed |
| `scripts/publish-skill.ts` | re-render and publish `favie-ops` after editing the template |
| `scripts/db-migrate.ts` | apply pending Drizzle migrations |
