ALTER TYPE "public"."connection_status" ADD VALUE 'select_store' BEFORE 'connected';--> statement-breakpoint
ALTER TABLE "restaurants" ALTER COLUMN "onboarding_step" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "restaurants" ALTER COLUMN "onboarding_step" SET DEFAULT 'billing'::text;--> statement-breakpoint
DROP TYPE "public"."onboarding_step";--> statement-breakpoint
CREATE TYPE "public"."onboarding_step" AS ENUM('billing', 'connect', 'preferences', 'done');--> statement-breakpoint
ALTER TABLE "restaurants" ALTER COLUMN "onboarding_step" SET DEFAULT 'billing'::"public"."onboarding_step";--> statement-breakpoint
ALTER TABLE "restaurants" ALTER COLUMN "onboarding_step" SET DATA TYPE "public"."onboarding_step" USING "onboarding_step"::"public"."onboarding_step";--> statement-breakpoint
ALTER TABLE "platform_connections" ADD COLUMN "store_address" text;--> statement-breakpoint
ALTER TABLE "platform_connections" ADD COLUMN "store_candidates" jsonb;