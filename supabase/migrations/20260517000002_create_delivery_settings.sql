-- Migration: Bảng cấu hình sản phẩm giao/nhận cho lệnh sản xuất
CREATE TABLE IF NOT EXISTS public.delivery_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_code TEXT NOT NULL,
    company_id UUID,
    mo_id UUID REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
    mo_code TEXT NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    product_code TEXT,
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'Cái',
    direction TEXT NOT NULL DEFAULT 'warehouse_to_production' CHECK (direction IN ('warehouse_to_production', 'production_to_warehouse')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX IF NOT EXISTS idx_delivery_settings_system_code ON public.delivery_settings(system_code);
CREATE INDEX IF NOT EXISTS idx_delivery_settings_mo_id ON public.delivery_settings(mo_id);
CREATE INDEX IF NOT EXISTS idx_delivery_settings_product_id ON public.delivery_settings(product_id);

COMMENT ON TABLE public.delivery_settings IS 'Cấu hình sản phẩm giao nhận theo lệnh sản xuất';
COMMENT ON COLUMN public.delivery_settings.direction IS 'warehouse_to_production = Kho giao cho SX, production_to_warehouse = SX giao lại Kho';