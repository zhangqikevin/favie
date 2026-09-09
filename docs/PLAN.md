# Favie V1 — AI 外卖代运营 SaaS 实施计划

## Context

Kevin 要做一个新的 SaaS「Favie」:用 AI agent 代运营美国餐厅的 Uber Eats / DoorDash 账户,提升外卖单量与利润。
$299/月/餐厅,**注册时绑卡即付费,30 天内可全额退款**(无免费试用期)。现有 favie.us **仅作视觉参考**,
不作能力参考;新版本收窄到外卖代运营一件事。

Agent 跑在 ZooWork Managed Agents 上(`@zoowork-ai/sdk`,skill 文档在 `.agents/skills/zoowork-managed-agents/`,
key 已验证可调通)。餐厅数据来自 Zoodata MCP(`https://api.zoodata.ai/mcp-restaurant`,Bearer key,**按餐厅授权**)。
工作目录 `/Users/kevin/newfavie` 为空,非 git 仓库,全部 greenfield。

### 已确认的决策
| 项 | 决定 |
|---|---|
| 技术栈 | Next.js 15 App Router + Tailwind + Supabase(Postgres + Auth)+ Drizzle;后台任务用 pg-boss 独立 worker |
| 付费 | Stripe Checkout 订阅,**无 trial,注册即扣首月 $299**,30 天内退款(Stripe Dashboard 手动),Customer Portal 管理卡/取消。已在 live 账户创建 `price_1UDIyw04rFfqxdEqKPqjEAf6` 与 portal 配置 `bpc_1UDIyw04rFfqxdEqojaquc3K` |
| 注册 | Supabase Auth 邮箱+密码,**邮件确认开启**(`/auth/confirm` 回调 + check-email 页);项目 `ojsidsvzfgnyyfqysjje` |
| Agent 拓扑 | V1 一家餐厅一个 ZooWork agent(`kind='delivery-ops'`),但用 `restaurant_agents` 表建模,**将来一店多 agent**(更多服务)不改 schema;一个 org 级 skill `favie-ops`(不 pin,发新版即全量) |
| 调度 | 每 agent 一条每日 cron `daily-ops`,`sessionTarget: 'isolated'`,分钟数按餐厅 hash 错开 |
| Browser use | ZooWork 有内置 browser skill,**未验证**能登录 UE/DD → M0 spike 先跑 |
| 平台登录 | **改为 handoff 模型(2026-09-08 Kevin 决定)**:agent 打开门户登录页 → `browser handoff` 返回 liveUrl → 用户自己在实时浏览器里登录 → 点"我已登录" → agent `save_login`(按餐厅+平台的 `loginLabel`)并验证店铺。不再需要运营邮箱、Manager 邀请、OTP 读取 |
| Zoodata | 后端直连 MCP(agent 侧只能接无鉴权 MCP),先用测试 key;金额单位美分 |

### Scope 调整(Kevin 已确认)
- **补**:平台连接状态机 + 自动验证 + 服务授权条款勾选(Onboarding);每条 agent 操作带"为什么"(Dashboard)
- **不做**:用户可见的 Pause 按钮(schedule 开关只作内部 billing/连接门控);每周周报只留 job 占位和 `digest_sends` 表,不发信
- **砍/推迟**:Chef/Social/CS agent、WhatsApp/Slack 入口、团队成员、审批流(ZooWork approval 闭环未验证)、多门店 UI(数据模型留 user→restaurants 一对多)
- **定价文案**:$299/月/餐厅,注册即开通,30 天内不满意全额退款
- **顺序**:M0 技术验证先行,且只是**一个脚本**

### 未决的外部依赖(不阻塞开发,按假设推进)
1. **Zoodata key 按餐厅授权**:测试 key 只看到一家 POS 餐厅(chowbus/yelp/google,无 DD/UE 数据)。新客户如何进入 Zoodata、由谁发 key,需 Kevin 和 Zoodata 侧确认。V1 假设:每家餐厅一个 Zoodata key,存在 `restaurants.zoodata_key_ciphertext`,没有 key 时 Dashboard 走 mock。
2. ~~运营邮箱程序化读取~~ 已不需要(handoff 模型)。
3. **UE/DD 对第三方自动化的 ToS**:非技术风险,M0 期间做一次法务判断。

---

## 架构总览

```
浏览器 ──> Next.js (Vercel) ──> Supabase Postgres <── pg-boss worker (Railway/Fly)
                 │                                          │
                 │  Stripe webhook                          ├─ ZooWork SDK: provision / verify / collect / pause
                 │                                          ├─ Zoodata MCP: daily sync -> daily_metrics
                 │                                          ├─ Ops mailbox: OTP / invite links
                 └─ /api/agent/ctx/<token>  <───── ZooWork sandbox 内的 agent 每次运行开头 curl 一次
                                                     (拿 ad cap / MTD 花费 / service_disabled / 登录凭据 / otp_url)
```

**为什么要独立 worker**:ZooWork 没有 webhook,结果靠轮询;verify 轮次要持有 SSE 流最长 10 分钟并持久化 cursor。Vercel 函数超时不够。Web 端只做短 REST。

**为什么用 capability URL 给 agent 传状态**:文档明确没有 credential API、Environment 不能放 secret、cron 创建的 isolated session 无法在首轮之前注入 `system.message`。一个每 agent 独立、可轮换的 256-bit token URL 一次性解决 ad cap、内部停用标志、凭据、OTP 四个注入问题,且不触发 `updateAgent` 的 `config_version` 抖动。

---

## 数据模型(Drizzle,`src/lib/db/schema.ts`)

所有表 `id uuid`、`created_at/updated_at`;金额 `integer` 美分;餐厅当地日 `date`,瞬时 `timestamptz`。

| 表 | 关键列 |
|---|---|
| `users` | `id`(= Supabase auth uid)、`email`、`name` |
| `restaurants` | `owner_user_id`、`name`、`address*`、`timezone`、`cuisine`、`goal` enum `orders\|profit`、`onboarding_step` enum `billing\|profile\|connect\|verifying\|done`、`terms_accepted_at`、`terms_version`、`zoodata_key_ciphertext`、`service_disabled`(内部门控,无 UI) |
| `restaurant_agents` | `restaurant_id`、`kind` enum `delivery-ops`(将来加更多)、唯一 `(restaurant_id, kind)`;`zoowork_agent_id`、`agent_status` enum `none\|creating\|created\|running\|ready\|failed`、`agent_error`、`schedule_id` text(短 id,`daily-ops`)、`ctx_token_hash`、`cron_minute`、`skill_version_pinned` |
| `platform_connections` | `restaurant_id`+`platform` enum `uber_eats\|doordash` 唯一;`status` enum `not_started\|invite_pending\|connected\|broken`;`store_external_id`、`store_name`、`role_seen`、`invite_marked_at`、`invite_accepted_at`、`verified_at`、`last_verified_at`、`verify_attempts`、`last_error` |
| `agent_runs` | `restaurant_agent_id`、`zoowork_session_id` 唯一、`session_key`、`kind` enum `daily\|verify\|manual`、`status` enum `discovered\|running\|finished\|collected\|parse_failed\|timed_out\|interrupted`、`outcome`、`run_date`、`final_text`、`summary_json`、`tool_error_count`、`last_cursor`、`token_usage` |
| `agent_actions` | `run_id`、`restaurant_id`、`restaurant_agent_id`、`platform` enum `uber_eats\|doordash\|none`、`action_date`、`category` enum(见下)、`title`、**`reason`**(必填,Dashboard 的"为什么")、`before/after jsonb`、`amount_cents`、`needs_attention`;索引 `(restaurant_id, action_date)` |
| `ad_caps` / `ad_cap_history` | `restaurant_id`+`platform` 唯一;`monthly_cap_cents`(null = 未设,agent 只观察不动广告);history 追加 old/new/who/when |
| `daily_metrics` | `restaurant_id`+`platform`+`date` 唯一;`orders`、`gmv_cents`、`net_revenue_cents`、`commission_cents`、`refunds_cents`、`refund_cnt`、`aov_cents`、`ad_spend_cents`、`ad_attributed_orders`、`avg_rating`、`downtime_minutes`、`is_mature`、`source` enum `zoodata\|mock\|platform_ui`、`raw jsonb` |
| `subscriptions` | `restaurant_id` 唯一、`stripe_customer_id`、`stripe_subscription_id`、`status`(镜像 Stripe)、`current_period_end`、`cancel_at_period_end`、`first_paid_at`(退款窗口 = 此后 30 天)、`refunded_at` |
| `stripe_events` | `id` = `evt_…` PK,幂等 |
| `schedule_events` | 内部 schedule 开关审计:`restaurant_agent_id`、`action` enum `auto_disable_billing\|auto_enable_billing\|auto_disable_connection\|auto_enable_connection\|admin_disable\|admin_enable`、`schedule_update_ok`、`error` |
| `otp_fetches` | 2FA 验证码被 agent 取走的审计 |
| `digest_sends` | `restaurant_id`+`week_start` 唯一(**V1 只建表,不发信**) |
| `zoowork_ops_log` | 每次 mutating SDK 调用的 request/response/error,超时后靠它对账 |

`agent_actions.category`:`ad_budget_changed | ad_campaign_paused | ad_campaign_resumed | promo_changed | item_availability_flagged | store_status_checked | store_offline_flagged | review_flagged | issue_flagged | no_action | login_failed | store_not_visible | run_unparsed | interrupted`

---

## ZooWork 集成(`src/lib/zoowork/`)

### `client.ts`
`createZooworkClient()` 让 SDK 自己读 `ZOOWORK_API_KEY`(不要 `?? ''`,会绕过空值保护然后 401)。启动时 `listModels()` 选 `litellm/claude-sonnet-5` 并缓存,兼做健康检查。所有 mutating 调用包 `logged(op, fn)` 写 `zoowork_ops_log`。

### org skill `skills/favie-ops/SKILL.md`(`scripts/publish-skill.ts` 发布)
- zip 顶层目录名必须 = frontmatter `name: favie-ops`;首次 `uploadSkill(zip, { scope:'org', idempotencyKey:'favie-ops-v1' })`,存 `FAVIE_OPS_SKILL_ID`;之后每次改动 `uploadSkillVersion(...)`,**不要**再 loop `putAgentSkill`;超时后先 `listSkills({ q:'favie-ops' })` 对账再重传。
- **description 是触发器**,必须包含 cron message 里的词:"Use whenever asked to run the daily Favie ops routine, verify a Favie restaurant connection, log into Uber Eats Manager or DoorDash Merchant Portal, check or change an ad budget or monthly ad cap, or produce a favie-summary block."
- Body 结构:
  1. **硬规则**:不超月度上限;不碰 payout/银行/税务/账户安全设置;不接受新条款、不授权;每平台每次运行登录最多尝试 2 次;遇 CAPTCHA 停止并上报;不把凭据/OTP 写进回复。
  2. **Step 0 拉上下文**:`curl -fsS "$FAVIE_CONTEXT_URL"` → `{ restaurant, service_disabled, run_date, platforms:[{ platform, enabled, store_external_id, store_name, monthly_cap_cents, mtd_spend_cents, days_remaining, credentials, otp_url }] }`。`service_disabled=true`(内部门控:欠费/管理员停用)立即结束并输出 `aborted_early:true`。
  3. **登录流程**:浏览器 profile 放 `/workspace/browser-profile/<platform>`(agent-scope 沙箱跨 session 保留);识别 2FA 页后轮询 `otp_url` 最多 6 次。
  4. **每日例程(V1 刻意收窄)**:(a) 店铺在线状态;(b) 被标 unavailable 的菜品 → 只上报;(c) 广告:读 campaign 列表 + MTD 花费,`daily_budget = max(0, cap - mtd) / days_remaining`,`mtd >= cap` 则暂停 campaign,未设 cap 只观察;(d) 新差评/纠纷 → 只标记。
  5. **Verify 模式**(message 含 `FAVIE_VERIFY <platform>`):只登录、定位店铺、上报 `store_visible / store_name / role_seen`,不做任何修改。
  6. **强制输出契约**:最后一条消息以且仅以一个 ```` ```favie-summary ```` fenced JSON 结尾(schema 见 `summary-schema.ts`,zod 校验:`favie_summary_version, mode, run_date, aborted_early, platforms[{ platform, login, store_visible, store_name, ad_spend_mtd_cents, actions[{ category, title, reason, before, after, amount_cents, needs_attention }], observations, errors }]`)。**每条 action 的 `reason` 必填**:写"看到了什么数据 → 为什么这么做 → 预期效果",这是 Dashboard 上"为什么"的来源。无操作也要给一条 `no_action` 带原因。

### `provisioning.ts: provisionAgent(restaurantAgentId)`(pg-boss job,按 `agent_status` 可恢复)
1. 先查自己 DB 的 `restaurant_agents.zoowork_agent_id`;`listAgents({ labels })` 只作辅助(它只列本 key 绑定用户的 agent,空列表不是不存在的证据)。
2. `createAgent({ resource:{ name:`favie-${kind}-${restaurantId}`, model, labels:{ app:'favie', env, restaurant_id, kind }, sandbox:{ scope:'agent' }, persona:{ docs:[{ name:'AGENTS.md', content }] }, skills:[{ skill_id }] } }, `favie-${kind}-${restaurantId}-v1`)`,**立刻**持久化 `agent_id`(receipt 是扁平的,`config_version` 在顶层)。若 M0 证明需要自建 Environment(chromium + playwright),在这里 pin,**首个沙箱创建后永久锁定**。
3. `startAgent` → `waitUntilRunning(id, { timeoutMs: 60_000 })`;只认 `status.desired_state === 'running'`,不看 `actual_state`。
4. `listAgentSkills(id)` 确认 `favie-ops` 在且 `eligible !== false`;缺则 `putAgentSkill` 再读。
5. `ensureDailySchedule`;`agent_status = ready`。

Persona 极薄(只有餐厅名、时区、`FAVIE_CONTEXT_URL`、店铺 id),所有会迭代的逻辑在 skill 里;ad cap 不进 persona,改 cap 不调 `updateAgent`。

### `schedule.ts: ensureDailySchedule / reconcileSchedule / computeDesiredEnabled`
```ts
createSchedule(agentId, {
  schedule_id: 'daily-ops',
  schedule: { kind:'cron', expr:`${cron_minute} 6 * * *`, tz: restaurant.timezone },
  payload: { kind:'agentTurn', message: 'Run the daily Favie ops routine using the favie-ops skill ... end with the favie-summary block.' },
  sessionTarget: 'isolated', delivery: { mode:'none' }, enabled: computeDesiredEnabled(r),
}, `daily-ops-${restaurantId}-v1`)
```
- `computeDesiredEnabled(r) = billingOk && !service_disabled && agent_status==='ready' && anyConnectionConnected`,`billingOk = status === 'active'`(无 trial 状态)。纯函数,单测。
- `reconcileSchedule` = `getSchedule(agentId,'daily-ops')` 读 `enabled` → 不一致则 `updateSchedule({ enabled })` → 写 `schedule_events auto_*`。Stripe webhook、连接状态变化、每夜 sweep 都调它。**用户没有手动开关**。
- 坑:read 用 `scheduleSpec` 拼,write 必须发 `schedule:{kind,expr,tz}`;`getSchedule` 结果不能直接当 PUT body;overlap 策略是 skip;`deleteAgent` 不删 schedule。

### `collect.ts: collectRuns`(pg-boss 每 5 分钟)
1. `listSessions(agentId, { page:1 })` 过滤 `channel==='cron' && session_key.startsWith('agent:'+agentId+':cron:daily-ops:')`(`listScheduleRuns` 没有 `session_id`,这是唯一路径)。upsert `agent_runs`。
2. 对 `run_status` 已终止且未 collected 的:`listAllEvents(...)`(**不用** `listEvents`,它单页且 500 截断无提示)。取最后 `run.finished` 的 `runOutcome`;拼 `assistantText`;数 `toolCall(ev).isError`;读 `payload.message.usage`。
3. 解析 favie-summary → 写 `agent_actions`;按 `login/store_visible` 更新 `platform_connections`(失败→`broken`);`ad_spend_mtd_cents` 在 Zoodata 无行时以 `source=platform_ui` 写入 `daily_metrics`。解析失败 → `parse_failed` + 一条 `run_unparsed` action(日历上仍显示,可看 transcript)。
4. `outcome==='aborted'` → `interrupted` action:"中断前的操作可能已在平台生效"。
5. `staleRuns`(每小时):`running` 超过 3h → `postEvents(..., [{ type:'user.interrupt' }])`,标 `timed_out`。

### `verify.ts: verifyConnection(restaurantId, platform)`(pg-boss job)
`createSession(agentId, { initial_events:[{ type:'user.message', content:'FAVIE_VERIFY doordash ...' }], metadata:{ kind:'verify', platform } }, idemKey)` → `streamTurn`(按 events-and-streaming.md 的重连包装:`isRunFinished` 即 break,`{ cursor }` 续流,每个事件把 cursor 持久化到 `agent_runs.last_cursor`,总预算 10 分钟)→ 同一套 summary 解析 → 状态机 `invite_pending → connected` 或 attempts+1。UI 轮询 `/api/restaurants/[id]/connections`。

### 内部停用(无用户 UI)
欠费(`subscriptions.status ∉ {active}`)或管理员置 `restaurants.service_disabled=true` 时:`reconcileSchedule` 关 schedule;ctx 端点返回 `service_disabled:true` 让已起跑的 run 自我终止;`staleRuns` 顺带对仍在跑的 session 发 `user.interrupt`。恢复付费后 `reconcileSchedule` 自动再开。

### `teardown.ts: decommissionAgent`(取消 90 天后)
顺序:`listSchedules` → 每条 `deleteSchedule(agentId, s.memo.schedule_id)` → `stopAgent` → `deleteAgent`。

### 给 agent 的端点(`src/app/api/agent/ctx/[token]/`)
- `route.ts`:sha256(token) 查餐厅;返回 ctx JSON;限流;每次访问记 `zoowork_ops_log op=ctx_fetch`。
- `otp/route.ts`:`?platform=&after=<ISO>`,读运营邮箱里最新的该平台验证码,单次使用,写 `otp_fetches`。
- 凭据:V1 单一运营账号,UE/DD 密码 AES-GCM 加密存 env/DB(`FAVIE_OPS_UE_PASSWORD_CIPHERTEXT` 等),ctx 端点解密后下发。**风险**:N 个 agent 共用一个 UE/DD 登录可能触发平台安全策略,这是未来"每用户一个邮箱"的动因,M0 观察。

### 邀请接受 `src/lib/ops-mail/invites.ts`(`acceptInvites` 每 10 分钟)
扫描邮箱里 UE/DD 的 Manager 邀请邮件,按店铺名匹配 `platform_connections`(单邮箱下多店同时邀请时靠店名区分,匹配不到则进人工队列),发一个 verify 轮次:"FAVIE_VERIFY doordash. First open this invite link: <url>"。这是 `invite_pending → connected` 的隐藏前置,M0 必测。

---

## Zoodata 适配层(`src/lib/zoodata/`)

已探测:MCP streamable-http,`initialize → tools/list → tools/call`,600 req/min,19 个 tool,响应统一 `{ success, data:{ asOf, isFresh, dqcValid, count, cursor, … }, error, meta }`。

```ts
interface ZoodataClient {
  listRestaurants(): Promise<ZoodataRestaurant[]>            // restaurant_v2_list_restaurants
  getChannelEconomics(range): Promise<ChannelRow[]>          // restaurant_v2_channel_economics → orderCnt/gmvAmount/aovAmount/commissionAmount/refundCnt/discountAmount per platform
  getPlatformDaily(range, platform?): Promise<PlatformDailyRow[]>  // restaurant_v2_platform_daily → 评分/下线/广告/平台上报销售;isMature=false 不缓存
  getAdEffect(range): Promise<AdEffectRow[]>                 // restaurant_v2_ad_effect(DD 归因)
  getPromoEffect(range): Promise<PromoRow[]>                 // restaurant_v2_promo_effect
  getStoreStatus(platform?): Promise<StoreStatusRow[]>       // restaurant_v2_store_status
  getPlatformHealth(range): Promise<HealthRow[]>             // restaurant_v2_platform_health
}
```
- `mcp.ts`:`@modelcontextprotocol/sdk` StreamableHTTP client,每餐厅一个 key;`mapRow()` 集中字段映射。
- `mock.ts`:按 `(restaurantId, date)` seeded 的确定性假数据,周末抬高,偶尔零日;`ZOODATA_MODE=mock` 或餐厅无 key 时使用。
- `zoodataSync` job(每日 05:30 UTC + 连接刚 connected 时):拉 `[today-3, yesterday]` 覆盖迟到修正,upsert `daily_metrics`。Dashboard 和 ctx 端点**只读 `daily_metrics`**,不实时打 Zoodata。

---

## Stripe(`src/server/billing/`)
- 注册 → 建 restaurant → `stripe.customers.create`(metadata `restaurant_id`)→ Checkout `mode:'subscription'`,**无 trial,立即扣首月 $299**,`success_url:/onboarding/profile`。
- Webhook `src/app/api/stripe/webhook/route.ts`:先插 `stripe_events`(重复 id 直接 200);处理 `checkout.session.completed`(记 `first_paid_at`,`onboarding_step=profile`)、`customer.subscription.created|updated|deleted`(镜像状态 → `reconcileSchedule`)、`invoice.payment_failed`、`invoice.paid`、`charge.refunded`(记 `refunded_at`,取消订阅)。
- **30 天退款**:Dashboard 账单页显示"首次付款 {日期},{N} 天内可全额退款";退款本身在 Stripe Dashboard 手动操作,webhook 回写状态。

## 每周周报(V1 占位)
只建 `digest_sends` 表和 `src/worker/jobs/weeklyDigest.ts` 空壳(注册但 `enabled:false`)。实现推到 V1.1。

---

## 前端

### Landing(`src/app/(marketing)/page.tsx`)
**仅视觉参考** favie.us:深色餐厅实景 hero 大图 + 半透明遮罩、白色超大标题含一个蓝色高亮词、四个数据卡片、蓝色圆角主 CTA、白底卡片区块。内容全新,只讲一件事:
1. Hero:标题类似 "Your AI runs your **delivery**." / 副标 "Favie manages your Uber Eats and DoorDash every day — ads, promos, store health — so you get more orders and keep more margin." CTA "Get started — $299/mo" + 次按钮 "See how it works"。
2. 三个利益点:更多订单(广告与促销每日优化)、更高利润(按你的月度上限控花费,不烧钱)、零操心(每日自动运行,日历上看到每一步和原因)。
3. How it works 三步:注册 → 把 Favie 加为 Manager → 每天查看 agent 做了什么和为什么。
4. Dashboard 模型图(日历 + 广告上限 + 订单曲线)。
5. Pricing 单卡:$299/mo per restaurant,"Cancel anytime. Full refund within 30 days, no questions asked."
6. FAQ(安全性:Favie 只以 Manager 身份操作,不碰 payout/银行;如何取消与退款;需要我做什么)。
7. Footer + Terms/Privacy 链接。

### Auth(`(auth)/signup`, `/login`)
Supabase Auth 邮箱密码,关闭邮件确认;signup 后创建 `users` 行 → 跳 Checkout。

### Onboarding(`(app)/onboarding/*`,同一视觉语言,进度条 4 步)
1. `billing`:Stripe Checkout 付首月(回跳后自动到下一步)。
2. `profile`:餐厅名、地址、时区(按地址自动)、菜系、目标(单量优先 / 利润优先)、每平台月度广告上限(可跳过 = agent 不动广告)、**勾选服务授权条款**(授权 Favie 以 Manager 身份代为操作 UE/DD 账户,记 `terms_accepted_at/terms_version`)。
3. `connect`:两张平台卡。每张:平台后台路径截图式分步说明(DD:Merchant Portal → Settings → Manage Users → Add User → 角色 **Store Manager**;UE:Uber Eats Manager → Users → Add → 角色 **Manager**;角色名以 M0 实测为准)、一键复制 `restaurants@zoowork.ai`、"I've added Favie" 按钮 → `invite_pending`。
4. `verifying`:显示两平台状态(等待邀请 / 验证中 / 已连接 / 失败原因 + 重试),后台 `acceptInvites → verifyConnection` 推进;任一平台 connected 即可进入 Dashboard,另一平台可稍后补。

### Dashboard(`(app)/dashboard/[restaurantId]/*`)
- 顶部:连接状态芯片 ×2、订阅状态(含退款窗口剩余天数)。**无 Pause 按钮**。
- **Calendar**(月视图):每天按平台显示 action 徽标;点日 → 侧栏列出 `agent_actions`,每条展开为 **做了什么(title)/ 为什么(reason)/ 改动(before→after)**,`needs_attention` 标红;`run_unparsed` 显示"查看记录"打开 transcript(`listAllEvents` 只显示 `user.message`/`agent.assistant`)。
- **Ad caps**:两平台各一输入 + MTD 进度条 + 修改历史。
- **Orders**:近 30 天每日订单/GMV/AOV 折线(`daily_metrics`),按平台切换;数据来源标签(Zoodata / mock)。
- Settings:餐厅资料、账单(Customer Portal 链接)、取消。

---

## 目录结构

```
favie/
  package.json  drizzle.config.ts  drizzle/
  skills/favie-ops/SKILL.md
  scripts/{m0-spike,publish-skill,provision-check}.ts
  src/
    app/ (marketing)/  (auth)/  (app)/onboarding/*  (app)/dashboard/[restaurantId]/*
         api/stripe/webhook/  api/agent/ctx/[token]/{route,otp/route}.ts  api/restaurants/[id]/connections/
    server/ auth.ts restaurants.ts connections/transitions.ts metrics.ts billing/{checkout,webhooks,gate}.ts
    lib/ db/{schema,client,enums}.ts
         zoowork/{client,provisioning,schedule,collect,summary-schema,verify,streamTurn,teardown}.ts
         zoodata/{types,mock,mcp,index}.ts
         ops-mail/{gmail,otp,invites}.ts
         email/{resend.ts,templates/*.tsx}
         crypto.ts
    worker/ index.ts  jobs/{provisionAgent,verifyConnection,collectRuns,staleRuns,reconcileSchedules,zoodataSync,acceptInvites,weeklyDigest,decommissionAgent}.ts
  Dockerfile.worker
```
部署:web → Vercel;worker → Railway/Fly;同一 `DATABASE_URL`。`ZOOWORK_API_KEY`、Zoodata key、运营账号密码只在服务端。

---

## Milestones

**M0 — Spike(`scripts/m0-spike.ts`,**一个脚本**,一次性 agent,用完按 teardown 顺序删)。先于一切页面开发。按顺序回答:**
1. `listSkills({ scope:'global' })` 里是否真有 browser skill;没有则建 Environment(apt chromium + npm playwright),`createAgent` 时 pin(首次沙箱后永久锁定)。
2. 沙箱数据中心 IP 打开 UE Manager / DD Merchant Portal 是否遇 CAPTCHA/风控(遇到即硬停,不绕过)。
3. 邮箱密码登录 + 通过 `otp` 端点过 2FA(先做 `ops-mail/otp.ts`)。
4. 浏览器 profile 是否跨两个 isolated session 在 `/workspace` 保留;不保留则每次都要 OTP。
5. 读 campaign 列表、改一次日预算再改回,计时。
6. 模型是否稳定输出 favie-summary block,用真 zod schema 解析。
7. `createSchedule → triggerSchedule → listSessions` 确认 `channel:'cron'` 和 `session_key` 前缀格式(collect.ts 依赖它)。
8. 用邀请链接接受 Manager 邀请是否可由 agent 完成。
9. ToS 判断。

**阻塞规则**:1–3 失败 → M2 全阻塞,需换思路(自建 Playwright worker);4 失败不阻塞但 OTP 成关键路径;6 失败先迭代 skill;7 失败 → 改为 Favie worker 自己 `createSession` 驱动每日运行(真实分叉,在此决定)。

**M1 — Landing + Auth + Stripe**(M0 之后开始,零 ZooWork 依赖):schema(users/restaurants/restaurant_agents/subscriptions/stripe_events)、Supabase Auth、Checkout 即付、webhook 幂等、Customer Portal、`computeDesiredEnabled` 纯函数 + 单测、Landing 页。

**M2 — Onboarding + Provisioning**(M0 通过后):发布 `favie-ops` skill、`provisionAgent`、`ensureDailySchedule`、ctx/otp 端点、`acceptInvites`、`verifyConnection`、连接状态机、授权条款、`reconcileSchedule`、`collectRuns` + `staleRuns`、Onboarding 四步 UI。退出标准:一家真实餐厅两平台都 `connected` 且产出一条解析成功、带 reason 的每日 run。

**M3 — Dashboard**:日历 + 操作详情(做了什么 / 为什么 / 改动)、ad caps + 历史、`zoodataSync` + mock、订单图表、连接健康、账单与退款窗口、transcript 查看。

**M4 — 收尾**:事务邮件(连接断开、扣款失败)、`decommissionAgent`、`weeklyDigest` 空壳占位。

**长期风险看板**:`zct_` key 组织级全权限(仅服务端,支持免部署轮换);API 是 Developer Preview(锁 SDK 版本,所有调用进 `zoowork_ops_log`);run 成功但 tool 失败(outcome 旁永远显示 `tool_error_count`);overlap=skip(某天中午前无 run 即告警);单运营账号被多 agent 共用的风控风险。

---

## 验证方式

- **M0**:spike 脚本每步打印 go/no-go;最终 `listAgents({ labels })` 为空、`listSchedules` 为空。
- **M1**:Stripe test mode 走通 signup → Checkout(测试卡)→ webhook 落 `subscriptions.status='active'` 且 `first_paid_at` 有值;`stripe trigger charge.refunded` 回写 `refunded_at`;`computeDesiredEnabled` 单测覆盖 billing×service_disabled×connection 组合;Landing 在 mobile/desktop 截图检查。
- **M2**:用一家测试餐厅完整走 onboarding;`scripts/provision-check.ts` 打印 `listAgentSkills` 含 favie-ops 且 eligible、`getSchedule('daily-ops').enabled` 与 `computeDesiredEnabled` 一致;`triggerSchedule` 后 5 分钟内 `agent_runs` 出现 `collected` 行且每条 `agent_actions.reason` 非空;把订阅切到 `past_due` 后 `getSchedule.enabled===false` 且 `schedule_events` 有记录。
- **M3**:mock 模式下日历/图表渲染;切换真实 Zoodata key 后 `daily_metrics.source='zoodata'`;改 ad cap 后 `curl /api/agent/ctx/<token>` 立即返回新值。
- **M4**:`weeklyDigest` job 注册但禁用,不产生邮件。
