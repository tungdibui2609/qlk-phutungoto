-- Migration: Create production_places table for factories, packaging plants, processing facilities
CREATE TABLE IF NOT EXISTS public.production_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT,                      -- Mã nhà máy / Cơ sở sản xuất (VD: NM-CT-01, CS-DL-02)
    name TEXT NOT NULL,             -- Tên cơ sở / Nhà máy chế biến (VD: Nhà máy Chánh Thu Bến Tre)
    address TEXT,                   -- Địa chỉ chi tiết
    location TEXT,                  -- Vị trí / Tọa độ / Khu công nghiệp
    province TEXT,                  -- Tỉnh / Thành phố
    contact_person TEXT,            -- Người đại diện / Quản đốc xưởng
    phone TEXT,                     -- Số điện thoại
    capacity TEXT,                  -- Công suất chế biến (tấn/ngày)
    certification TEXT,             -- Chứng chỉ chất lượng (HACCP, ISO 22000, BRC, FDA...)
    notes TEXT,                     -- Ghi chú bổ sung
    is_active BOOLEAN DEFAULT TRUE,
    system_code TEXT,
    company_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching and filtering
CREATE INDEX IF NOT EXISTS idx_production_places_code ON public.production_places(code);
CREATE INDEX IF NOT EXISTS idx_production_places_name ON public.production_places(name);
CREATE INDEX IF NOT EXISTS idx_production_places_system ON public.production_places(system_code);

-- Grant permissions
GRANT ALL ON public.production_places TO postgres, authenticated, service_role, anon;

-- Seed initial sample data for Chanh Thu Group
INSERT INTO public.production_places (code, name, address, province, certification, capacity, is_active)
VALUES 
    ('NM-BT-01', 'Nhà máy Chánh Thu - Bến Tre', 'Ấp Mỹ Thạnh, Xã Mỹ Thạnh, Huyện Giồng Trôm', 'Bến Tre', 'HACCP, ISO 22000, FDA', '50 tấn/ngày', true),
    ('CS-DL-01', 'Xưởng chế biến Cư M''gar - Đắk Lắk', 'Km 15, QL 14, Huyện Cư M''gar', 'Đắk Lắk', 'VietGAP, HACCP', '30 tấn/ngày', true),
    ('NM-TG-01', 'Nhà máy Đóng gói Tiền Giang', 'Khu Công nghiệp Mỹ Tho', 'Tiền Giang', 'HACCP, BRC', '40 tấn/ngày', true)
ON CONFLICT DO NOTHING;
