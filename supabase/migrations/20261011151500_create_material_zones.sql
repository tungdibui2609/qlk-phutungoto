-- Migration: Create material_zones table for planting areas and raw material sources
CREATE TABLE IF NOT EXISTS public.material_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT,                      -- Mã vùng trồng / PUC (VD: VN-TG-01, VNL-01)
    name TEXT NOT NULL,             -- Tên vùng trồng / Vùng nguyên liệu (VD: Vùng trồng Tiền Giang)
    location TEXT,                  -- Địa phương / Địa chỉ cụ thể
    province TEXT,                  -- Tỉnh / Thành phố (Tiền Giang, Bến Tre, Đắk Lắk, ...)
    area_ha NUMERIC(10, 2),         -- Diện tích (ha)
    farmer_name TEXT,               -- Chủ hộ / Đại diện / Hợp tác xã
    phone TEXT,                     -- Số điện thoại liên hệ
    certification TEXT,             -- Tiêu chuẩn chứng nhận (VietGAP, GlobalGAP, Mã PUC xuất khẩu, ...)
    notes TEXT,                     -- Ghi chú bổ sung
    is_active BOOLEAN DEFAULT TRUE,
    system_code TEXT,
    company_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching and filtering
CREATE INDEX IF NOT EXISTS idx_material_zones_code ON public.material_zones(code);
CREATE INDEX IF NOT EXISTS idx_material_zones_name ON public.material_zones(name);
CREATE INDEX IF NOT EXISTS idx_material_zones_system ON public.material_zones(system_code);

-- Grant permissions
GRANT ALL ON public.material_zones TO postgres, authenticated, service_role, anon;
