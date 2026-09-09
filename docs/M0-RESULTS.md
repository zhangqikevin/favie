# M0 Spike Results — ZooWork as the runtime for Favie's delivery-ops agent

Script: `scripts/m0-spike.ts` (`ZOOWORK_API_KEY=… npx tsx scripts/m0-spike.ts`). Throwaway agent is
labelled `app=favie, purpose=m0-spike` and torn down at the end. Runs on 2026-09-08.

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | Browser skill exists in the global catalog | GO | `browser-ops` v2 (skl_01m0f1r0nkggb5hc5r59695t24): "drives the built-in browser tool — navigate, snapshot, act, upload, login, handoff" |
| 2 | Fresh agent starts | GO | `desired_state=running` in <10s. Note: `browser-ops` does **not** appear in `listAgentSkills` of a fresh agent, yet the built-in `browser` tool is available anyway |
| 3 | Sandbox has curl + outbound HTTPS (needed for the ctx endpoint) | GO | `curl` present, `https://api.zoodata.ai` → 200, egress IP 172.173.108.128 (Azure). No chromium binary on PATH: the browser is a platform service, not a local process |
| 4a | Agent actually uses the browser tool | GO | `browser {action:navigate}` / `{action:snapshot}` / `{action:tabs}` calls observed |
| 4b | DoorDash Merchant Portal + Uber Eats Manager reachable from the sandbox, no CAPTCHA | GO | DD → `identity.doordash.com` "DoorDash Login", email-first form, SSO buttons, no block. UE → `auth.uber.com` "Sign up or Log in with Uber", phone-or-email-first form, no block |
| 5 | Browser state persists across sessions | **NO-GO** | Run 1: second session hit `409 Profile <id> is locked by another session` for >100s (one agent = one browser at a time; the lock lingers after a session ends unless the run closes the browser session). Run 4: after an explicit `browser session close`, a new session saw `{ "cookies": {} }` → **state does not survive a browser session; every run logs in fresh**. See `docs/M0-RESULTS.md` follow-up probe on the browser tool's login/handoff options |
| 6 | Model reliably ends with a parseable ```favie-summary``` JSON block | GO | Parsed with the zod schema on both turns, including the failure turn |
| 7 | Cron fire → session discoverable by `session_key` prefix | GO | `session_key=agent:<agt>:cron:m0-cron-probe:<epochms>:<hash>`, `channel=cron`, `run.finished.status=succeeded`; `listAllEvents` returned 5 events. `triggerSchedule` receipt only carries `schedule_name` |
| 8 | Real DD / UE login + 2FA | SKIPPED | Needs `M0_DD_EMAIL/_PASSWORD`, `M0_UE_EMAIL/_PASSWORD` and a way to read OTP mail for `restaurants@zoowork.ai` |
| — | Teardown | GO | schedules deleted → stopAgent → deleteAgent; `listAgents({labels})` → 0 |

## Follow-up probes (2026-09-08)

**Browser tool schema** (`scripts/m0-browser-probe.ts`, agent self-description from its tool definition):
- Actions: `status | navigate | snapshot | act | screenshot | tabs | upload | handoff | session`.
- `act.kind`: `click | type | press | hover | select | fill | scroll | wait`; refs come from the latest `snapshot`.
- `session` ops: `restart` (with `egressCountry`, `loginLabel`), `close`, `save_login` ("checkpoint login state right after signing in"). `loginLabel`: "same label always restores the same persistent login profile; switch labels for multi-account flows".
- `handoff { reason }`: "hand the live browser to the user for manual steps (logins, captchas)" — returns a live-view link. **This is the onboarding path for the first login + 2FA**: a human completes it once in the live view, the agent calls `save_login`.
- `egressCountry`: ISO country for the browser egress IP (set `US`).
- `browser-ops` skill is `eligible:false` on our agents: `missing: [{ key: "browser", kind: "config" }]` — it needs an agent-level `browser` config we do not know how to set; `putAgentSkill` on it is 404 (global). The built-in `browser` tool works regardless.

**save_login persistence** (`scripts/m0-savelogin-probe.ts`): set an httpbin cookie → `save_login` (`ok:true`) → `close`; a new session (plain, and `restart loginLabel=default`) saw `{ cookies: {} }`. **Not proven.** Caveat: httpbin sets a *session* cookie (no Expires); saved profiles usually keep only persistent cookies, and DD/UE login cookies are persistent. Needs a real-login test. Ask the ZooWork team what `save_login` stores.

**favie-ops skill smoke test** (`scripts/skill-smoke.ts`, after publishing `skl_01m1zs6182632tb6rweff9qwz8`): `skills:[{skill_id}]` on `createAgent` DID attach (`eligible:true`, `location:/skills/favie-ops/SKILL.md`); the agent's first tool call was `read /skills/favie-ops/SKILL.md`; with `password:null` it made **no** login attempt (hard rule respected) and ended with a summary that passes the production zod schema (`login:"failed"`, `login_failure_reason:"no_credentials"`, `needs_attention:true`, Uber Eats `skipped` because `enabled:false`). GO on all three.

**Handoff probe** (`scripts/m0-handoff-probe.ts`): `createAgent` accepts a `browser: { enabled: true }` section (it appears in `declared.browser`) and with it the global `browser-ops` skill becomes `eligible: true`. `browser action:"handoff"` returns `{ ok, op:"handoff", liveUrl, instructions }` where `liveUrl` is a signed link (`https://apiproxy.ecap.gsmo.ai/browser/anything/r/<jwt>`, ~1 h expiry) to a live view of the remote browser — opened in a normal browser it shows the real DoorDash login page and accepts input. The platform's own instruction text: "Share this link with the user … When they say they are done, call session save_login and continue." This is the login model Favie now uses (no ops account, no OTP mailbox).

**Redeem semantics (2026-09-08, live test):** the `liveUrl` is a one-time redeem link. The first GET redirects to `/sessions/<sid>/vnc/vnc_embed.html?…&access_token=<jwt, ~1 h>`; a second GET returns `{"detail":"redeem code expired or invalid"}`. `startHandoff` therefore redeems once server-side and stores the embed URL, which can be iframed on the connect page. Because `session restart` closes the previous browser, platforms are connected one at a time.

## Design consequences

1. **One browser per agent, serialized.** Never run the verify turn and the daily cron turn concurrently on the same agent. The skill must end every run by closing the browser session (`browser action:"session" op:"close"`), and the backend should treat "profile locked" as a retry-after-60s condition, not a failure.
1b. **Login model: handoff + save_login.** The restaurant owner logs in once inside the handed-off live browser; the agent calls `save_login` under a per-restaurant `loginLabel` and restores it every run. Whether the saved profile survives long-term is still to be proven with a real portal login; when it does not, the dashboard shows the platform as broken with a Reconnect button that re-runs the handoff. Login + OTP is on the critical path of every daily run, so the OTP mail reader for `restaurants@zoowork.ai` is an M2 prerequisite, not a nice-to-have. A plain `curl` to the DD login URL got a Cloudflare interstitial while the browser tool did not — keep all portal traffic inside the browser tool.
2. **Environment pin is not needed** for browser use; do not create a custom Environment (it would lock permanently).
3. **Login flows are two-step** (identifier first, then password/OTP). The skill's login procedure must handle the email-first screen and the SSO buttons, and Uber may ask for a phone number.
4. **Egress IP is a datacenter (Azure) address.** No bot-block on the login pages today; watch for it after real logins.
5. Cron `session_key` format confirmed → `collect.ts` prefix walk is safe.
