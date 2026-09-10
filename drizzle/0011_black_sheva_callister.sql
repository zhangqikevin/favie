ALTER TYPE "public"."action_category" ADD VALUE 'recommendation';--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN "promo_spend_cents" integer;