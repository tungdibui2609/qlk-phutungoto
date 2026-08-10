-- Fix numeric quantity on inbound_order_items & outbound_order_items

-- 1. inbound_order_items
ALTER TABLE public.inbound_order_items DROP COLUMN IF EXISTS total_amount;
ALTER TABLE public.inbound_order_items ALTER COLUMN quantity TYPE numeric USING quantity::numeric;
ALTER TABLE public.inbound_order_items ALTER COLUMN quantity SET DEFAULT 1;
ALTER TABLE public.inbound_order_items ADD COLUMN total_amount numeric(15,2) GENERATED ALWAYS AS ((quantity * price)) STORED;

-- 2. outbound_order_items
ALTER TABLE public.outbound_order_items DROP COLUMN IF EXISTS total_amount;
ALTER TABLE public.outbound_order_items ALTER COLUMN quantity TYPE numeric USING quantity::numeric;
ALTER TABLE public.outbound_order_items ALTER COLUMN quantity SET DEFAULT 1;
ALTER TABLE public.outbound_order_items ADD COLUMN total_amount numeric(15,2) GENERATED ALWAYS AS ((quantity * price)) STORED;
