# Favie 部署与运维手册（公司云环境）

面向：负责把 Favie 部署到公司云（与 Zoodata 同一云环境）并长期维护的同事。
现状：生产环境 favie.us 目前跑在 Replit（GCP us-east1）+ Supabase（AWS us-east-1）上，处于内测状态，计费被旁路。本次迁移要同时完成两件事：**搬到公司云**、**把 Stripe 换成公司账号的 key**。

文档里不含任何密钥。现有密钥在 Kevin 本机的 `.env.replit` 里，请通过公司的密钥管理渠道交接，不要走聊天或邮件。

---

## 1. Favie 由什么组成

```
浏览器 ──> Web（Next.js 16，`next start`，端口 3000）──┐
                                                       ├──> Postgres（业务表 + pg-boss 任务队列）
Worker（`tsx src/worker/index.ts`，常驻进程）──────────┘
   │
   ├─ ZooWork Managed Agents（每家餐厅一个 agent，云端浏览器操作 Uber Eats / DoorDash 后台）
   ├─ Zoodata MCP（每日订单数据，按餐厅的 key）
   └─ Firecrawl（读公开店铺页的菜单，可选）

外部回调到 Web：
   ZooWork 沙箱  ──> GET  /api/agent/ctx/<token>      （agent 每次运行先拉上下文）
   Supabase Auth ──> POST /api/auth/send-email         （发信钩子 → Resend 发注册/重置邮件）
   Stripe        ──> POST /api/stripe/webhook
```

要点：

- **两个进程缺一不可。** Web 只处理短请求；所有要轮询 ZooWork、持有事件流、跑定时任务的逻辑都在 Worker。Worker 挂了的表现是：点"连接平台""读取菜单""现在检查"后一直转圈。
- **应用必须有公网 HTTPS 地址**，并且 ZooWork、Supabase、Stripe 都能从公网访问到它。纯内网部署不可用。
- 同一份代码、同一个镜像，Web 和 Worker 只是启动命令不同。`scripts/start-all.sh` 可以在一个容器里同时拉起两者（Worker 带自动重启循环），也可以拆成两个服务分别跑。

## 2. 资源与网络要求

| 项 | 要求 |
|---|---|
| 运行时 | Node.js 22（见 `.nvmrc`） |
| 规格 | 1 vCPU / 2 GiB 足够，机器配置从来不是瓶颈 |
| 数据库延迟 | **应用到 Postgres 的单次往返必须 < 10 ms**（同区域）。一个页面约十次查询；我们踩过的坑：跨美国东西岸 75–100 ms 时每个页面 1.5–3 秒 |
| 出站 | 需要访问 ZooWork API、`api.zoodata.ai`、Supabase、Stripe、Resend、Firecrawl |
| 入站 | 443，路径见上图；`/api/stripe/webhook`、`/api/agent/*`、`/auth/confirm` 不能被网关的登录拦截或 WAF 规则挡掉 |
| 长连接 | 登录握手页面通过 `/api/**/vnc/*` 反代远程浏览器画面，网关的请求超时请放到 ≥ 10 分钟，不要对响应做缓冲 |

## 3. 数据库与登录（Supabase）

Favie 用 Supabase 的两样东西：**Auth**（邮箱密码登录、邮件确认）和 **Postgres**。代码对 Postgres 没有 Supabase 专属依赖，但 Auth 依赖 Supabase（GoTrue）。两种做法：

- **推荐：继续用 Supabase 托管项目**，区域选离公司云最近的。现在的生产项目是 `Favie Replit East`（us-east-1）。如果公司云不在美东，建一个同区域的新项目并按第 6 节迁数据。
- 备选：在公司云自建 Supabase（至少 GoTrue + Postgres）。工作量明显更大，除非有合规要求否则不建议。

连接串有两条，别配反：

| 变量 | 用途 | 指向 |
|---|---|---|
| `DATABASE_URL` | Worker、迁移和脚本 | **会话模式**：Supabase session pooler（端口 5432）或直连 |
| `DATABASE_URL_WEB` | Web 进程 | **事务模式**：transaction pooler（端口 6543）。Web 连接池 8 个常驻连接 + 保温 |

注意：Supabase 免费档的 session pooler 最多 15 个客户端。Worker 占 4 个，pg-boss 占 4 个；不要让工作区/本地再起多余的 Worker 连同一个库，曾因此把池子占满导致全站卡死。

新建的 Supabase 项目默认用 ES256 非对称密钥签发 JWT，Favie 会在本地验签（每个请求省约 150 ms）。如果项目是旧式共享密钥（HS256），功能正常但每个请求会多一次到 Auth 服务器的往返。

## 4. 环境变量

完整清单见仓库根目录 `.env.example`（带注释）。按用途分组：

**构建期（会被编译进前端，改了必须重新构建）**

| 变量 | 说明 |
|---|---|
| `NEXT_PUBLIC_APP_URL` | 对外地址，如 `https://favie.us`。Stripe 回跳、agent 上下文 URL、邮件里的链接都由它生成 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 与 publishable key 同值 |

**运行期**

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` / `DATABASE_URL_WEB` | 见第 3 节 |
| `SUPABASE_SECRET_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Supabase API key |
| `FAVIE_ENCRYPTION_KEY` | 加密库里保存的各餐厅数据 key 和 ZooWork key。**迁移时必须沿用原值**，换了就解不开已存的密文 |
| `ZOOWORK_API_KEY` | ZooWork 组织级 token，仅服务端。管理后台 `/admin` 里保存的 key 优先于它 |
| `FAVIE_OPS_SKILL_ID` | 组织级 skill `favie-ops` 的 id，所有环境共用同一个 |
| `ZOODATA_MCP_URL` | 默认 `https://api.zoodata.ai/mcp-restaurant`。和 Zoodata 同云后可以换成内网地址，先确认内网入口支持同样的 Bearer 鉴权 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID` / `STRIPE_PRICE_ID_YEARLY` / `STRIPE_PORTAL_CONFIG_ID` | 见第 7 节，**本次要换成公司账号的** |
| `RESEND_API_KEY` / `SUPABASE_SEND_EMAIL_HOOK_SECRET` / `AUTH_EMAIL_FROM` | 注册、重置密码邮件（见 `docs/EMAIL.md`） |
| `FIRECRAWL_API_KEY` | 可选。没有它菜单读取会退回用 agent 浏览器，慢很多 |
| `ADMIN_EMAILS` | 逗号分隔的管理员邮箱，可进 `/admin` |
| `FAVIE_SKIP_BILLING` | **生产环境不要设**。设为 1 会跳过付款步骤（现在的 Replit 环境设了，迁移后要去掉，见第 7 节） |
| `PORT` | 默认 3000 |

**不要设置**：`FAVIE_DEV`。它会让启动脚本跑 `next dev`。Replit 上因为这个变量，生产环境跑了好几天开发模式，每个页面首次访问要编译 4–8 秒。

## 5. 部署步骤

### 5.1 构建

仓库：`https://github.com/zhangqikevin/favie`，分支 `main`。

**容器方式**（仓库根目录有 `Dockerfile`）：

```bash
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=https://favie.us \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx \
  -t favie:<git-sha> .
```

说明：镜像与环境绑定（三个 `NEXT_PUBLIC_*` 在构建期写死）。构建过程不连数据库，Dockerfile 里给了一个占位的 `DATABASE_URL`，这一点已用等价的 `next build` 验证过；Dockerfile 本身写好后还没有在真实 Docker 环境里完整构建过，第一次用时如果有问题请直接改。

**裸机/VM 方式**：

```bash
npm ci
npm run build          # 需要上面三个 NEXT_PUBLIC_* 和任意一个 DATABASE_URL 在环境里
```

### 5.2 数据库迁移

每次部署新版本前执行，幂等，可重复跑：

```bash
npm run db:migrate
```

它读取 `DATABASE_URL`，逐条语句应用 `drizzle/` 下未执行过的迁移，记录在 `drizzle.__drizzle_migrations`。不要用 `drizzle-kit migrate`，它会静默跳过枚举变更。

### 5.3 Supabase Auth 配置（新项目或换域名时执行一次）

把站点 URL、回调白名单、邮件模板、发信钩子、SMTP 一次性推到 Supabase：

```bash
env SUPABASE_ACCESS_TOKEN=sbp_xxx \
    NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co \
    NEXT_PUBLIC_APP_URL=https://favie.us \
    SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_USER=resend SMTP_PASS=<resend key> SMTP_SENDER=hello@favie.us \
    SEND_EMAIL_HOOK_URL=https://favie.us/api/auth/send-email \
    SEND_EMAIL_HOOK_SECRET='<与 SUPABASE_SEND_EMAIL_HOOK_SECRET 相同>' \
    EMAIL_RATE_LIMIT_PER_HOUR=100 \
    npx tsx scripts/supabase-auth-config.ts
```

`SUPABASE_ACCESS_TOKEN` 是 Supabase 个人访问令牌（Account → Access Tokens），只有这个脚本用，不需要放进运行环境。

### 5.4 启动

单容器（Web + Worker）：

```bash
sh scripts/start-all.sh
```

拆成两个服务（推荐，便于分别重启和看日志）：

```bash
# web
npx next start -p 3000
# worker（带崩溃自动重启；也可以交给编排系统的重启策略，直接跑 npx tsx src/worker/index.ts）
sh scripts/worker-forever.sh
```

Worker 只能跑**一个副本**（定时任务和浏览器任务按餐厅串行，多副本会抢同一个浏览器档案）。Web 可以多副本。

### 5.5 启动后检查

```bash
curl -s https://<域名>/api/health
# {"ok":true,"db_roundtrip_ms":[8,3,3]}   ← 后两个数应 < 10
curl -s https://<域名>/login | grep -c hmr-client
# 0   ← 不是 0 说明跑成了开发模式
```

Worker 日志里应出现一行 `[worker] up; queues: ...`，其中包含 `disputes-tick`、`zoodata-sync`、`collect-runs` 等 20 个队列。

## 6. 从现有生产环境迁移

数据量很小（几百 KB），整库搬迁十分钟内完成。流程我们刚做过一次（us-west-2 → us-east-1），照做即可：

1. **备份旧库**（业务表 + 登录账号）：
   ```bash
   pg_dump "$OLD_DATABASE_URL" --format=custom --no-owner --no-privileges \
     --schema=public --schema=auth -f favie.dump
   ```
2. 新库先跑 `npm run db:migrate` 建表。
3. **只导数据**，登录只搬 `auth.users` 和 `auth.identities`（会话表不要搬，用户重新登录一次即可，密码保留）：
   ```bash
   { echo "SET session_replication_role = replica;";
     pg_restore --data-only --no-owner --schema=auth -t users -t identities -f - favie.dump;
     pg_restore --data-only --no-owner --schema=public -f - favie.dump; } > restore.sql
   psql "$NEW_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f restore.sql
   ```
   `pgboss` 和 `drizzle` 两个 schema 不要搬，Worker 和迁移脚本会自己建。
4. 核对行数：`auth.users`、`public.users`、`restaurants`、`restaurant_agents`、`platform_connections`。
5. 对新 Supabase 项目执行 5.3。
6. **`FAVIE_ENCRYPTION_KEY` 沿用旧值。**
7. 域名：
   - 如果继续用 `favie.us`（只是把 DNS 从 Replit 切到公司云）：agent 的上下文 URL 不变，不需要额外操作。切 DNS 前把 TTL 调低。
   - 如果换域名：部署完成后执行一次 `NEXT_PUBLIC_APP_URL=https://新域名 npx tsx scripts/rotate-ctx.ts`，它会给每个 agent 换新的上下文 URL 并重写 persona；同时用新域名重跑 5.3，并更新 Stripe webhook 地址。
8. 切换期间旧环境必须停掉 Worker（或整个下线）。两个 Worker 同时指挥同一批 agent 会互相抢浏览器。

已保存的平台登录（商家在 Uber Eats / DoorDash 的登录态）存在 ZooWork 侧，按 `favie-<餐厅id前缀>` 的标签保存，不随数据库迁移丢失，商家无需重新登录。

## 7. 把 Stripe 换成公司账号（本次必须做）

现状：代码里的 Stripe 对接是完整的，但生产环境设了 `FAVIE_SKIP_BILLING=1`，付款步骤被跳过；生产库 `subscriptions` 表是空的，没有任何历史订阅需要迁移。此前开发用的是 Kevin 个人 Stripe 账号下的 key、价格和 portal 配置，**这些一律不要带到公司环境**。

在**公司 Stripe 账号**里操作（先 test mode 走通，再换 live）：

1. **产品与价格**：新建产品 "Favie"，在同一个产品下建两个价格：
   - 月付 **$299.00 USD / 月，recurring** → `STRIPE_PRICE_ID`
   - 年付 **$3,289.00 USD / 年，recurring**（11 个月的价格，送 1 个月）→ `STRIPE_PRICE_ID_YEARLY`。这个变量可选：不配的话付款页只显示月付，不会报错。
   - 在 Customer Portal 配置里把这两个价格都加进"可切换的方案"，用户才能自己在月付和年付之间切换。
2. **Customer Portal**：Settings → Billing → Customer portal，开启"更新付款方式""取消订阅"，保存后用 API 或 Dashboard 拿到配置 id `bpc_...` → `STRIPE_PORTAL_CONFIG_ID`（不设也能用，走账号默认配置）。
3. **API key**：建议建一个 Restricted key，权限：Customers、Checkout Sessions、Subscriptions、Invoices、Billing Portal 写权限，Charges / Events 读权限 → `STRIPE_SECRET_KEY`。
4. **Webhook**：Developers → Webhooks → Add endpoint
   - URL：`https://<域名>/api/stripe/webhook`
   - 事件：`checkout.session.completed`、`customer.subscription.created`、`customer.subscription.updated`、`customer.subscription.deleted`、`invoice.paid`、`invoice.payment_failed`、`charge.refunded`
   - 签名密钥 `whsec_...` → `STRIPE_WEBHOOK_SECRET`
5. 把四个变量配进运行环境，**删除 `FAVIE_SKIP_BILLING`**，重启 Web 和 Worker。
6. 验证（test mode）：新注册一个账号 → 付款页用测试卡 `4242 4242 4242 4242` → 回到连接平台页；库里 `subscriptions.status = 'active'` 且 `first_paid_at` 有值；`stripe_events` 表有对应事件；设置页的"管理账单"能打开 portal。
7. 换成 live key、live 价格和 live webhook 后再验证一次真实小额流程，或由财务同事确认。

**现有内测餐厅不受影响。** 计费闸门是"订阅 active 或餐厅被标记为免计费（`restaurants.billing_exempt`）才运营"。迁移 0022 会把执行时库里已存在的所有餐厅自动标记为免计费，所以去掉 `FAVIE_SKIP_BILLING` 后，现有 4 家内测餐厅的每日运营、争议检查照常，设置页的账单状态显示"内测期免费"。之后新注册的餐厅默认需要付款。要单独豁免或取消豁免某家餐厅，在 `/admin/<餐厅id>` 的 Settings 区块里拨"Billing"开关。

顺序要求：**先跑 `npm run db:migrate`（含 0022），再去掉 `FAVIE_SKIP_BILLING`。** 反过来的话，在迁移执行前的那段时间里内测餐厅会被判为未付款，每日定时任务会被关掉（迁移后下一次对账会自动恢复）。

退款政策是"首次付款 30 天内全额退款"，在 Stripe Dashboard 手动操作，webhook 会把 `refunded_at` 写回并取消订阅。

收尾：通知 Kevin 在他个人 Stripe 账号里**作废旧的 live restricted key**，它还留在他本机的开发 `.env` 里。

## 8. 上线验收清单

- [ ] `/api/health` 返回 `ok:true`，往返 < 10 ms
- [ ] 登录页源码不含 `hmr-client`
- [ ] Worker 日志有 `[worker] up; queues:`，且只有一个 Worker 实例
- [ ] 用已有账号能登录，后台各页面跳转 < 0.5 秒
- [ ] 新注册收到确认邮件，链接指向正式域名（不是 localhost）
- [ ] Stripe 测试付款走通，`subscriptions` 有 active 行
- [ ] 现有内测餐厅 `billing_exempt = true`，设置页账单状态显示"内测期免费"，每日任务仍为开启
- [ ] `/admin`（管理员邮箱）能打开，Platform settings 里 ZooWork key 显示已配置
- [ ] 在一家测试餐厅的"争议订单"页点"现在检查"，几秒内出现"运行中"，几分钟后有结果
- [ ] 从外网 `curl https://<域名>/api/agent/ctx/x` 返回 404/401 而不是被网关拦截成登录页

## 9. 日常运维

**发版流程**

```bash
git pull
npm ci
npm run db:migrate      # 有新迁移才会执行，没有也无害
npm run build           # 或重新构建镜像
# 重启 web 和 worker（两个都要）
```

**定时任务**（都在 Worker 里，UTC）

| 任务 | 时间 | 作用 |
|---|---|---|
| `collect-runs` | 每 5 分钟 | 收集 agent 运行结果，写入日历 |
| `disputes-tick` | 每小时 :05 | 各餐厅当地 08:00 触发 Uber Eats 争议订单检查，失败每小时重试到 20:00 |
| `zoodata-sync` | 10:30 和 17:30 | 拉昨天的订单数据（回看 3 天） |
| `ops-handoff-sweep` | 每 5 分钟 | 回收运营同事超时未关的远程浏览器 |
| `stale-runs` | 每小时 :17 | 中断卡住 3 小时以上的 agent 运行 |

每家餐厅的"每日运营"本身由 ZooWork 侧的 cron 触发（餐厅当地早上 6 点多），不依赖 Worker 在线；但结果要靠 `collect-runs` 收回来。

**Agent 的操作规程（prompt / skill）**

- 规程文本在 `skills/favie-ops/`，通过 `/admin/prompt` 页面或脚本发布为 ZooWork 组织级 skill 的新版本。**发布会影响组织下所有环境的所有 agent**（包括开发环境），发布前请和 Kevin 对齐。
- 发布后代码会自动把 skill 重新挂到每个 agent 并回读版本。如果怀疑某个 agent 没跟上，执行 `syncSkillToAgents()`（`src/lib/zoowork/skill-publish.ts`）。
- 管理后台有一个"Agent changes"开关：关闭时 agent 只观察和建议，不改广告和促销。对真实商家账户默认保持关闭，由 Kevin 决定何时打开。

**常见故障**

| 现象 | 多半是 |
|---|---|
| 所有需要 agent 的按钮一直转圈 | Worker 没在跑，或连不上库 |
| Worker 日志反复 `timeout exceeded when trying to connect` 后退出码 75 | 数据库连接池不可用，Worker 会自杀等重启；查 pooler 客户端数是否打满（上限 15） |
| 页面普遍 1 秒以上 | 先看 `/api/health` 的往返时间，再看是否跑成了开发模式 |
| agent 运行立即失败，错误含 `402 insufficient_credits` | ZooWork 组织余额不足，需要充值；余额偏低时 ZooWork 还会静默降级到小模型，表现为报告格式乱 |
| 连接平台时报 `browser_locked` | 同一餐厅有另一个浏览器会话没关（握手未完成、运营浏览器未释放）。等 5 分钟自动回收，或在 `/admin` 里释放 |
| 日历出现"无法读取报告" | agent 没按格式输出；每日运行会自动追问一次，仍失败才会显示。偶发可忽略，连续出现看是不是余额/模型问题 |
| 注册邮件链接指向错误域名 | `NEXT_PUBLIC_APP_URL` 配错或没重新构建；Supabase 的 site_url 没更新（重跑 5.3） |
| 订单分析缺最近一天 | `zoodata-sync` 没跑或 Zoodata 当天数据未出；可等下一次同步 |

**备份**：数据库每日备份用云厂商或 Supabase 自带的即可；手动备份命令见第 6 节第 1 步。

**密钥轮换**：Supabase secret key、数据库密码、Stripe key、`ZOOWORK_API_KEY` 都可以随时轮换，改环境变量后重启即可。**`FAVIE_ENCRYPTION_KEY` 不能轮换**（除非先写脚本把库里的密文重新加密）。当前 Supabase 项目的 secret key 和数据库密码在交接过程中出现过在聊天记录里，接手后请先轮换一次。

## 10. 接手需要的账号与权限

| 系统 | 需要什么 | 找谁 |
|---|---|---|
| GitHub `zhangqikevin/favie` | 读权限（维护需要写权限） | Kevin |
| Supabase 项目 | 成员权限 + 个人访问令牌 | Kevin |
| ZooWork 组织 | 组织 token；控制台查看 agent 会话和余额 | Kevin |
| Stripe（公司账号） | 开发者权限：建产品、key、webhook | 财务 / 公司 Stripe 管理员 |
| Resend | `favie.us` 域名的发信 key | Kevin |
| Firecrawl | API key | Kevin |
| DNS（favie.us） | 切换解析 | Kevin |
| 公司云 | 部署权限、密钥管理、日志 | 你自己 |

相关文档：`README.md`（本地开发）、`docs/DECISIONS.md`（设计决策和踩过的坑）、`docs/EMAIL.md`（邮件）、`docs/REPLIT.md`（现有 Replit 部署）、`docs/MARKETING-PLAYBOOK.md`（agent 的运营规则依据）。
