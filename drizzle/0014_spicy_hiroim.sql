CREATE TYPE "public"."menu_item_status" AS ENUM('synced', 'draft', 'saving', 'saved', 'failed');--> statement-breakpoint
CREATE TYPE "public"."menu_job_kind" AS ENUM('pull', 'generate', 'save');--> statement-breakpoint
CREATE TYPE "public"."menu_job_status" AS ENUM('queued', 'running', 'done', 'failed');--> statement-breakpoint
ALTER TYPE "public"."action_category" ADD VALUE 'menu_item_updated';--> statement-breakpoint
ALTER TYPE "public"."onboarding_step" ADD VALUE 'menu' BEFORE 'preferences';--> statement-breakpoint
ALTER TYPE "public"."run_kind" ADD VALUE 'menu';--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"item_key" text NOT NULL,
	"external_id" text,
	"category" text,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer,
	"image_url" text,
	"availability" text,
	"unit" text,
	"position" integer,
	"order_cnt" integer,
	"raw" jsonb,
	"pulled_at" timestamp with time zone,
	"photo_missing" boolean DEFAULT false NOT NULL,
	"photo_poor" boolean DEFAULT false NOT NULL,
	"desc_missing" boolean DEFAULT false NOT NULL,
	"desc_thin" boolean DEFAULT false NOT NULL,
	"ai_description_en" text,
	"ai_description_zh" text,
	"ai_image_url" text,
	"custom_image_url" text,
	"draft_description" text,
	"draft_image_url" text,
	"status" "menu_item_status" DEFAULT 'synced' NOT NULL,
	"last_saved_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"kind" "menu_job_kind" NOT NULL,
	"menu_item_id" uuid,
	"status" "menu_job_status" DEFAULT 'queued' NOT NULL,
	"note" text,
	"error" text,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_jobs" ADD CONSTRAINT "menu_jobs_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_jobs" ADD CONSTRAINT "menu_jobs_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "menu_items_restaurant_platform_key_uq" ON "menu_items" USING btree ("restaurant_id","platform","item_key");--> statement-breakpoint
CREATE INDEX "menu_items_restaurant_idx" ON "menu_items" USING btree ("restaurant_id","platform");--> statement-breakpoint
CREATE INDEX "menu_jobs_restaurant_idx" ON "menu_jobs" USING btree ("restaurant_id","created_at");