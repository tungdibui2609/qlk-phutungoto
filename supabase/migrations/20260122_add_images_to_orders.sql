-- Add images column (JSONB) to inbound_orders and outbound_orders
-- This supports storing multiple image URLs (e.g. from Cloudinary)

ALTER TABLE "inbound_orders" 
ADD COLUMN IF NOT EXISTS "images" JSONB DEFAULT '[]'::jsonb;

ALTER TABLE "outbound_orders" 
ADD COLUMN IF NOT EXISTS "images" JSONB DEFAULT '[]'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN "inbound_orders"."images" IS 'List of image URLs (JSONB array)';
COMMENT ON COLUMN "outbound_orders"."images" IS 'List of image URLs (JSONB array)';
