import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, date, jsonb, smallint, numeric,
  uniqueIndex, index,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------------------------
// Enums
export const platformEnum = pgEnum('platform', ['uber_eats', 'doordash'])
export const actionPlatformEnum = pgEnum('action_platform', ['uber_eats', 'doordash', 'none'])
export const goalEnum = pgEnum('restaurant_goal', ['orders', 'profit'])
export const onboardingStepEnum = pgEnum('onboarding_step', ['billing', 'connect', 'preferences', 'done'])
export const agentKindEnum = pgEnum('agent_kind', ['delivery-ops'])
export const agentStatusEnum = pgEnum('agent_status', ['none', 'creating', 'created', 'running', 'ready', 'failed'])
export const connectionStatusEnum = pgEnum('connection_status', ['not_started', 'awaiting_login', 'verifying', 'select_store', 'connected', 'broken'])
export const runKindEnum = pgEnum('run_kind', ['daily', 'verify', 'manual'])
export const runStatusEnum = pgEnum('run_status', ['discovered', 'running', 'finished', 'collected', 'parse_failed', 'timed_out', 'interrupted'])
export const runOutcomeEnum = pgEnum('run_outcome', ['succeeded', 'failed', 'aborted'])
export const actionCategoryEnum = pgEnum('action_category', [
  'ad_budget_changed', 'ad_campaign_paused', 'ad_campaign_resumed', 'promo_changed',
  'item_availability_flagged', 'store_status_checked', 'store_offline_flagged', 'review_flagged',
  'issue_flagged', 'no_action', 'login_failed', 'store_not_visible', 'run_unparsed', 'interrupted',
])
export const metricSourceEnum = pgEnum('metric_source', ['zoodata', 'mock', 'platform_ui'])
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused',
])
export const scheduleEventActionEnum = pgEnum('schedule_event_action', [
  'auto_disable_billing', 'auto_enable_billing', 'auto_disable_connection', 'auto_enable_connection',
  'admin_disable', 'admin_enable',
])

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

// ---------------------------------------------------------------------------------------------
// users — id mirrors the Supabase auth.users uid
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  // UI language the user last chose; the agent writes its reports in this language.
  locale: text('locale'),
  ...timestamps,
})

export const restaurants = pgTable('restaurants', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  addressLine: text('address_line'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  timezone: text('timezone').notNull().default('America/Los_Angeles'),
  cuisine: text('cuisine'),
  goal: goalEnum('goal').notNull().default('orders'),
  onboardingStep: onboardingStepEnum('onboarding_step').notNull().default('billing'),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  termsVersion: text('terms_version'),
  zoodataKeyCiphertext: text('zoodata_key_ciphertext'),
  // ONE browser login profile per restaurant: both platforms' logins live in it (browser session restart loginLabel).
  browserLoginLabel: text('browser_login_label'),
  // Admin switch: keep the daily cron off (for manual / custom-prompt operation) without disabling the service.
  dailySchedulePaused: boolean('daily_schedule_paused').notNull().default(false),
  serviceDisabled: boolean('service_disabled').notNull().default(false),
  ...timestamps,
}, (t) => [index('restaurants_owner_idx').on(t.ownerUserId)])

// One row per (restaurant, agent kind). V1 has one kind; more services later add kinds.
export const restaurantAgents = pgTable('restaurant_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  kind: agentKindEnum('kind').notNull().default('delivery-ops'),
  zooworkAgentId: text('zoowork_agent_id'),
  agentStatus: agentStatusEnum('agent_status').notNull().default('none'),
  agentError: text('agent_error'),
  scheduleId: text('schedule_id').notNull().default('daily-ops'),
  ctxTokenHash: text('ctx_token_hash'),
  ctxTokenRotatedAt: timestamp('ctx_token_rotated_at', { withTimezone: true }),
  cronMinute: smallint('cron_minute').notNull().default(0),
  skillVersionPinned: integer('skill_version_pinned'),
  ...timestamps,
}, (t) => [uniqueIndex('restaurant_agents_restaurant_kind_uq').on(t.restaurantId, t.kind)])

export const platformConnections = pgTable('platform_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  platform: platformEnum('platform').notNull(),
  status: connectionStatusEnum('status').notNull().default('not_started'),
  storeExternalId: text('store_external_id'),
  storeName: text('store_name'),
  storeAddress: text('store_address'),
  roleSeen: text('role_seen'),
  // Stores the agent saw in the account after login; the owner picks one when there are several.
  storeCandidates: jsonb('store_candidates').$type<{ name: string; external_id: string | null; address: string | null }[]>(),
  // Browser login profile the agent restores each run (`browser session restart loginLabel`).
  loginLabel: text('login_label'),
  // Handoff: the ZooWork session in which the live browser was handed to the user, and its live-view URL.
  handoffSessionId: text('handoff_session_id'),
  handoffUrl: text('handoff_url'),
  handoffStartedAt: timestamp('handoff_started_at', { withTimezone: true }),
  loginConfirmedAt: timestamp('login_confirmed_at', { withTimezone: true }),
  // Live, human-readable note of what the agent is doing right now (handoff / confirm turns).
  progressNote: text('progress_note'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  lastVerifyRunId: uuid('last_verify_run_id'),
  verifyAttempts: integer('verify_attempts').notNull().default(0),
  lastError: text('last_error'),
  brokenSince: timestamp('broken_since', { withTimezone: true }),
  ...timestamps,
}, (t) => [uniqueIndex('platform_connections_restaurant_platform_uq').on(t.restaurantId, t.platform)])

export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  restaurantAgentId: uuid('restaurant_agent_id').notNull().references(() => restaurantAgents.id),
  zooworkAgentId: text('zoowork_agent_id').notNull(),
  zooworkSessionId: text('zoowork_session_id').notNull().unique(),
  sessionKey: text('session_key'),
  channel: text('channel'),
  kind: runKindEnum('kind').notNull(),
  status: runStatusEnum('status').notNull().default('discovered'),
  runStatusRaw: text('run_status_raw'),
  outcome: runOutcomeEnum('outcome'),
  runDate: date('run_date'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  collectedAt: timestamp('collected_at', { withTimezone: true }),
  finalText: text('final_text'),
  summaryJson: jsonb('summary_json'),
  summaryParseError: text('summary_parse_error'),
  toolErrorCount: integer('tool_error_count').notNull().default(0),
  eventCount: integer('event_count').notNull().default(0),
  lastCursor: text('last_cursor'),
  tokenUsage: jsonb('token_usage'),
  ...timestamps,
}, (t) => [index('agent_runs_restaurant_date_idx').on(t.restaurantId, t.runDate)])

export const agentActions = pgTable('agent_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => agentRuns.id),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  restaurantAgentId: uuid('restaurant_agent_id').notNull().references(() => restaurantAgents.id),
  platform: actionPlatformEnum('platform').notNull().default('none'),
  actionDate: date('action_date').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  category: actionCategoryEnum('category').notNull(),
  title: text('title').notNull(),
  reason: text('reason').notNull(), // the dashboard's "why" — required
  before: jsonb('before'),
  after: jsonb('after'),
  amountCents: integer('amount_cents'),
  needsAttention: boolean('needs_attention').notNull().default(false),
  ...timestamps,
}, (t) => [index('agent_actions_restaurant_date_idx').on(t.restaurantId, t.actionDate)])

export const adCaps = pgTable('ad_caps', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  platform: platformEnum('platform').notNull(),
  monthlyCapCents: integer('monthly_cap_cents'), // null = not set → agent observes only
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
  ...timestamps,
}, (t) => [uniqueIndex('ad_caps_restaurant_platform_uq').on(t.restaurantId, t.platform)])

export const adCapHistory = pgTable('ad_cap_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  platform: platformEnum('platform').notNull(),
  oldCapCents: integer('old_cap_cents'),
  newCapCents: integer('new_cap_cents'),
  changedByUserId: uuid('changed_by_user_id').references(() => users.id),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
})

export const dailyMetrics = pgTable('daily_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  platform: platformEnum('platform').notNull(),
  date: date('date').notNull(),
  orders: integer('orders'),
  gmvCents: integer('gmv_cents'),
  netRevenueCents: integer('net_revenue_cents'),
  commissionCents: integer('commission_cents'),
  refundsCents: integer('refunds_cents'),
  refundCnt: integer('refund_cnt'),
  aovCents: integer('aov_cents'),
  adSpendCents: integer('ad_spend_cents'),
  adAttributedOrders: integer('ad_attributed_orders'),
  adAttributedSalesCents: integer('ad_attributed_sales_cents'), // platform-reported ROAS × spend
  avgRating: numeric('avg_rating', { precision: 3, scale: 2 }),
  downtimeMinutes: integer('downtime_minutes'),
  isMature: boolean('is_mature').notNull().default(true),
  source: metricSourceEnum('source').notNull(),
  raw: jsonb('raw'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (t) => [uniqueIndex('daily_metrics_restaurant_platform_date_uq').on(t.restaurantId, t.platform, t.date)])

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id).unique(),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripePriceId: text('stripe_price_id'),
  status: subscriptionStatusEnum('status').notNull().default('incomplete'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  firstPaidAt: timestamp('first_paid_at', { withTimezone: true }), // refund window = +30 days
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
  lastStripeEventCreated: timestamp('last_stripe_event_created', { withTimezone: true }),
  ...timestamps,
})

export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(), // evt_…
  type: text('type').notNull(),
  created: timestamp('created', { withTimezone: true }).notNull(),
  payload: jsonb('payload').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  error: text('error'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
})

export const scheduleEvents = pgTable('schedule_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantAgentId: uuid('restaurant_agent_id').notNull().references(() => restaurantAgents.id),
  action: scheduleEventActionEnum('action').notNull(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  reason: text('reason'),
  scheduleUpdateOk: boolean('schedule_update_ok'),
  scheduleEnabledAfter: boolean('schedule_enabled_after'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// V1: table only; the weekly digest job is a placeholder.
export const digestSends = pgTable('digest_sends', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  weekStart: date('week_start').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  providerMessageId: text('provider_message_id'),
  stats: jsonb('stats'),
}, (t) => [uniqueIndex('digest_sends_restaurant_week_uq').on(t.restaurantId, t.weekStart)])

export const zooworkOpsLog = pgTable('zoowork_ops_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantAgentId: uuid('restaurant_agent_id').references(() => restaurantAgents.id),
  op: text('op').notNull(),
  request: jsonb('request'),
  response: jsonb('response'),
  error: jsonb('error'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('zoowork_ops_log_agent_idx').on(t.restaurantAgentId, t.createdAt)])

export type Platform = (typeof platformEnum.enumValues)[number]
export type ActionCategory = (typeof actionCategoryEnum.enumValues)[number]
export type ConnectionStatus = (typeof connectionStatusEnum.enumValues)[number]
export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number]

// The ONE operating prompt for every customer agent (the "Mode daily" section of the favie-ops skill).
// Saving a new version renders SKILL.md and publishes a new org-skill version; all agents follow latest.
export const agentPromptVersions = pgTable('agent_prompt_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  version: integer('version').notNull().unique(),
  body: text('body').notNull(),
  note: text('note'),
  skillVersion: text('skill_version'), // ZooWork skill version this became
  isActive: boolean('is_active').notNull().default(false),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Sysadmin-editable runtime settings (ZooWork key, default model, …). Secrets are stored encrypted
// with FAVIE_ENCRYPTION_KEY; environment variables remain the bootstrap fallback.
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // ciphertext when is_secret
  isSecret: boolean('is_secret').notNull().default(false),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
