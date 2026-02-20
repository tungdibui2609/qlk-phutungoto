-- Migration: Add `is_hall` flag to `zones` table
ALTER TABLE "public"."zones"
ADD COLUMN "is_hall" BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN "public"."zones"."is_hall" IS 'Flag indicating if this zone is a Hall (Sảnh) used for lowering goods.';
