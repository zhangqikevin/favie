CREATE TYPE "public"."action_category" AS ENUM('ad_budget_changed', 'ad_campaign_paused', 'ad_campaign_resumed', 'promo_changed', 'item_availability_flagged', 'store_status_checked', 'store_offline_flagged', 'review_flagged', 'issue_flagged', 'no_action', 'login_failed', 'store_not_visible', 'run_unparsed', 'interrupted');--> statement-breakpoint
CREATE TYPE "public"."action_platform" AS ENUM('uber_eats', 'doordash', 'none');--> statement-breakpoint
CREATE TYPE "public"."agent_kind" AS ENUM('delivery-ops');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('none', 'creating', 'created', 'running', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('not_started', 'awaiting_login', 'verifying', 'connected', 'broken');--> statement-breakpoint
CREATE TYPE "public"."restaurant_goal" AS ENUM('orders', 'profit');--> statement-breakpoint
CREATE TYPE "public"."metric_source" AS ENUM('zoodata', 'mock', 'platform_ui');--> statement-breakpoint
CREATE TYPE "public"."onboarding_step" AS ENUM('billing', 'profile', 'connect', 'done');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('uber_eats', 'doordash');--> statement-breakpoint
CREATE TYPE "public"."run_kind" AS ENUM('daily', 'verify', 'manual');--> statement-breakpoint
CREATE TYPE "public"."run_outcome" AS ENUM('succeeded', 'failed', 'aborted');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('discovered', 'running', 'finished', 'collected', 'parse_failed', 'timed_out', 'interrupted');--> statement-breakpoint
CREATE TYPE "public"."schedule_event_action" AS ENUM('auto_disable_billing', 'auto_enable_billing', 'auto_disable_connection', 'auto_enable_connection', 'admin_disable', 'admin_enable');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');--> statement-breakpoint
CREATE TABLE "ad_cap_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"old_cap_cents" integer,
	"new_cap_cents" integer,
	"changed_by_user_id" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_caps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"monthly_cap_cents" integer,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"restaurant_agent_id" uuid NOT NULL,
	"platform" "action_platform" DEFAULT 'none' NOT NULL,
	"action_date" date NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category" "action_category" NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"amount_cents" integer,
	"needs_attention" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"restaurant_agent_id" uuid NOT NULL,
	"zoowork_agent_id" text NOT NULL,
	"zoowork_session_id" text NOT NULL,
	"session_key" text,
	"channel" text,
	"kind" "run_kind" NOT NULL,
	"status" "run_status" DEFAULT 'discovered' NOT NULL,
	"run_status_raw" text,
	"outcome" "run_outcome",
	"run_date" date,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"collected_at" timestamp with time zone,
	"final_text" text,
	"summary_json" jsonb,
	"summary_parse_error" text,
	"tool_error_count" integer DEFAULT 0 NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"last_cursor" text,
	"token_usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_runs_zoowork_session_id_unique" UNIQUE("zoowork_session_id")
);
--> statement-breakpoint
CREATE TABLE "daily_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"date" date NOT NULL,
	"orders" integer,
	"gmv_cents" integer,
	"net_revenue_cents" integer,
	"commission_cents" integer,
	"refunds_cents" integer,
	"refund_cnt" integer,
	"aov_cents" integer,
	"ad_spend_cents" integer,
	"ad_attributed_orders" integer,
	"avg_rating" numeric(3, 2),
	"downtime_minutes" integer,
	"is_mature" boolean DEFAULT true NOT NULL,
	"source" "metric_source" NOT NULL,
	"raw" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digest_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"sent_at" timestamp with time zone,
	"provider_message_id" text,
	"stats" jsonb
);
--> statement-breakpoint
CREATE TABLE "platform_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"status" "connection_status" DEFAULT 'not_started' NOT NULL,
	"store_external_id" text,
	"store_name" text,
	"role_seen" text,
	"login_label" text,
	"handoff_session_id" text,
	"handoff_url" text,
	"handoff_started_at" timestamp with time zone,
	"login_confirmed_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"last_verify_run_id" uuid,
	"verify_attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"broken_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"kind" "agent_kind" DEFAULT 'delivery-ops' NOT NULL,
	"zoowork_agent_id" text,
	"agent_status" "agent_status" DEFAULT 'none' NOT NULL,
	"agent_error" text,
	"schedule_id" text DEFAULT 'daily-ops' NOT NULL,
	"ctx_token_hash" text,
	"ctx_token_rotated_at" timestamp with time zone,
	"cron_minute" smallint DEFAULT 0 NOT NULL,
	"skill_version_pinned" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address_line" text,
	"city" text,
	"state" text,
	"zip" text,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"cuisine" text,
	"goal" "restaurant_goal" DEFAULT 'orders' NOT NULL,
	"onboarding_step" "onboarding_step" DEFAULT 'billing' NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"terms_version" text,
	"zoodata_key_ciphertext" text,
	"service_disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_agent_id" uuid NOT NULL,
	"action" "schedule_event_action" NOT NULL,
	"actor_user_id" uuid,
	"reason" text,
	"schedule_update_ok" boolean,
	"schedule_enabled_after" boolean,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"created" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"status" "subscription_status" DEFAULT 'incomplete' NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"first_paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"last_stripe_event_created" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_restaurant_id_unique" UNIQUE("restaurant_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "zoowork_ops_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_agent_id" uuid,
	"op" text NOT NULL,
	"request" jsonb,
	"response" jsonb,
	"error" jsonb,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_cap_history" ADD CONSTRAINT "ad_cap_history_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_cap_history" ADD CONSTRAINT "ad_cap_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_caps" ADD CONSTRAINT "ad_caps_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_caps" ADD CONSTRAINT "ad_caps_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_restaurant_agent_id_restaurant_agents_id_fk" FOREIGN KEY ("restaurant_agent_id") REFERENCES "public"."restaurant_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_restaurant_agent_id_restaurant_agents_id_fk" FOREIGN KEY ("restaurant_agent_id") REFERENCES "public"."restaurant_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_sends" ADD CONSTRAINT "digest_sends_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_agents" ADD CONSTRAINT "restaurant_agents_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_restaurant_agent_id_restaurant_agents_id_fk" FOREIGN KEY ("restaurant_agent_id") REFERENCES "public"."restaurant_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoowork_ops_log" ADD CONSTRAINT "zoowork_ops_log_restaurant_agent_id_restaurant_agents_id_fk" FOREIGN KEY ("restaurant_agent_id") REFERENCES "public"."restaurant_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ad_caps_restaurant_platform_uq" ON "ad_caps" USING btree ("restaurant_id","platform");--> statement-breakpoint
CREATE INDEX "agent_actions_restaurant_date_idx" ON "agent_actions" USING btree ("restaurant_id","action_date");--> statement-breakpoint
CREATE INDEX "agent_runs_restaurant_date_idx" ON "agent_runs" USING btree ("restaurant_id","run_date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_metrics_restaurant_platform_date_uq" ON "daily_metrics" USING btree ("restaurant_id","platform","date");--> statement-breakpoint
CREATE UNIQUE INDEX "digest_sends_restaurant_week_uq" ON "digest_sends" USING btree ("restaurant_id","week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_connections_restaurant_platform_uq" ON "platform_connections" USING btree ("restaurant_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_agents_restaurant_kind_uq" ON "restaurant_agents" USING btree ("restaurant_id","kind");--> statement-breakpoint
CREATE INDEX "restaurants_owner_idx" ON "restaurants" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "zoowork_ops_log_agent_idx" ON "zoowork_ops_log" USING btree ("restaurant_agent_id","created_at");