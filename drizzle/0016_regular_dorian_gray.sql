ALTER TYPE "public"."menu_job_kind" ADD VALUE 'apply';--> statement-breakpoint
ALTER TABLE "platform_connections" ADD COLUMN "storefront_candidates" jsonb;--> statement-breakpoint
ALTER TABLE "platform_connections" ADD COLUMN "menu_editor_url" text;