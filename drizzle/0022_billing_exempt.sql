ALTER TABLE "restaurants" ADD COLUMN "billing_exempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Grandfather every restaurant that exists when this migration runs: they joined before billing went live.
UPDATE "restaurants" SET "billing_exempt" = true;
