ALTER TYPE "public"."action_category" ADD VALUE 'dispute_filed';--> statement-breakpoint
ALTER TYPE "public"."action_category" ADD VALUE 'dispute_resolved';--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"order_external_id" text NOT NULL,
	"order_date" date,
	"kind" text DEFAULT 'other' NOT NULL,
	"amount_cents" integer,
	"recovered_cents" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"reason" text,
	"evidence" text,
	"deadline" date,
	"filed_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"run_id" uuid,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_order_uq" ON "disputes" USING btree ("restaurant_id","platform","order_external_id");--> statement-breakpoint
CREATE INDEX "disputes_restaurant_idx" ON "disputes" USING btree ("restaurant_id","created_at");