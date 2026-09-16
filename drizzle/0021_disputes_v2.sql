ALTER TYPE "public"."run_kind" ADD VALUE 'disputes';--> statement-breakpoint
CREATE TABLE "dispute_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"date" date NOT NULL,
	"status" text DEFAULT 'done' NOT NULL,
	"found" integer DEFAULT 0 NOT NULL,
	"filed" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"won" integer DEFAULT 0 NOT NULL,
	"lost" integer DEFAULT 0 NOT NULL,
	"recovered_cents" integer DEFAULT 0 NOT NULL,
	"error" text,
	"run_id" uuid,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "reason_category" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "submitted_text" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "customer_note" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "customer_photo" boolean;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "items_total" integer;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "items_disputed" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "filed_by" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "decision_text" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "customer_type" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "disputes_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "disputes_intro_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dispute_checks" ADD CONSTRAINT "dispute_checks_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_checks_day_uq" ON "dispute_checks" USING btree ("restaurant_id","platform","date");--> statement-breakpoint
CREATE INDEX "dispute_checks_restaurant_idx" ON "dispute_checks" USING btree ("restaurant_id","date");