CREATE TABLE "ops_handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"requested_by_user_id" uuid,
	"session_id" text,
	"live_url" text,
	"target_url" text,
	"note" text,
	"error" text,
	"ready_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops_handoffs" ADD CONSTRAINT "ops_handoffs_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_handoffs" ADD CONSTRAINT "ops_handoffs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ops_handoffs_restaurant_idx" ON "ops_handoffs" USING btree ("restaurant_id","created_at");