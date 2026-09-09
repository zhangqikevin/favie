CREATE TABLE "agent_prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"body" text NOT NULL,
	"note" text,
	"skill_version" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_prompt_versions_version_unique" UNIQUE("version")
);
--> statement-breakpoint
ALTER TABLE "agent_prompt_versions" ADD CONSTRAINT "agent_prompt_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurants" DROP COLUMN "custom_prompt";--> statement-breakpoint
ALTER TABLE "restaurants" DROP COLUMN "custom_prompt_updated_at";