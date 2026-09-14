CREATE TABLE "menu_optimizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_by_user_id" uuid,
	"cancelled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_jobs" ADD COLUMN "scope" text;--> statement-breakpoint
ALTER TABLE "menu_optimizations" ADD CONSTRAINT "menu_optimizations_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_optimizations" ADD CONSTRAINT "menu_optimizations_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "menu_optimizations_restaurant_idx" ON "menu_optimizations" USING btree ("restaurant_id","created_at");--> statement-breakpoint
-- Re-judge existing photos under the stricter rule (dimensions were stored at pull time).
update menu_items set photo_poor = false where photo_poor and (raw->'photo'->>'width') is not null and (raw->'photo'->>'width')::int >= 300 and ((raw->'photo'->>'width')::numeric / nullif((raw->'photo'->>'height')::numeric, 0)) between 0.5 and 3;
