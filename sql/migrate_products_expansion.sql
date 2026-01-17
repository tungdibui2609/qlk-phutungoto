-- ============================================
-- MIGRATION: Mở rộng Quản lý Sản phẩm Phụ tùng Ô tô
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Bảng Nhà cung cấp (Suppliers)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    tax_code VARCHAR(50),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bảng Dòng xe (Vehicles)
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year_from INTEGER,
    year_to INTEGER,
    engine_type VARCHAR(100),
    body_type VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(brand, model, year_from, year_to, engine_type)
);

-- 3. Bảng Tương thích sản phẩm - xe
CREATE TABLE IF NOT EXISTS product_vehicle_compatibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(product_id, vehicle_id)
);

-- 4. Mở rộng bảng Products
-- Thông tin kỹ thuật
ALTER TABLE products ADD COLUMN IF NOT EXISTS oem_number VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS origin_country VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS quality_grade VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_months INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions VARCHAR(100);

-- Thông tin kinh doanh
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS retail_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 0;

-- Trạng thái
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_returnable BOOLEAN DEFAULT true;

-- Mã tham chiếu
ALTER TABLE products ADD COLUMN IF NOT EXISTS cross_reference_numbers TEXT[];

-- 5. Indexes để tăng hiệu năng
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_vehicles_brand ON vehicles(brand);
CREATE INDEX IF NOT EXISTS idx_vehicles_brand_model ON vehicles(brand, model);
CREATE INDEX IF NOT EXISTS idx_product_vehicle_product ON product_vehicle_compatibility(product_id);
CREATE INDEX IF NOT EXISTS idx_product_vehicle_vehicle ON product_vehicle_compatibility(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- 6. Seed dữ liệu hãng xe phổ biến tại Việt Nam
INSERT INTO vehicles (brand, model, year_from, year_to, body_type) VALUES
-- Toyota
('Toyota', 'Vios', 2014, NULL, 'Sedan'),
('Toyota', 'Camry', 2012, NULL, 'Sedan'),
('Toyota', 'Corolla Cross', 2020, NULL, 'SUV'),
('Toyota', 'Fortuner', 2017, NULL, 'SUV'),
('Toyota', 'Innova', 2016, NULL, 'MPV'),
('Toyota', 'Hilux', 2015, NULL, 'Pickup'),
('Toyota', 'Land Cruiser', 2010, NULL, 'SUV'),
('Toyota', 'Yaris', 2014, NULL, 'Hatchback'),
-- Honda
('Honda', 'City', 2014, NULL, 'Sedan'),
('Honda', 'Civic', 2012, NULL, 'Sedan'),
('Honda', 'Accord', 2013, NULL, 'Sedan'),
('Honda', 'CR-V', 2013, NULL, 'SUV'),
('Honda', 'HR-V', 2018, NULL, 'SUV'),
('Honda', 'Jazz', 2014, 2020, 'Hatchback'),
-- Mazda
('Mazda', 'Mazda3', 2015, NULL, 'Sedan'),
('Mazda', 'Mazda6', 2015, NULL, 'Sedan'),
('Mazda', 'CX-5', 2013, NULL, 'SUV'),
('Mazda', 'CX-8', 2019, NULL, 'SUV'),
('Mazda', 'CX-30', 2020, NULL, 'SUV'),
('Mazda', 'BT-50', 2012, NULL, 'Pickup'),
-- Ford
('Ford', 'Ranger', 2012, NULL, 'Pickup'),
('Ford', 'Everest', 2015, NULL, 'SUV'),
('Ford', 'Territory', 2021, NULL, 'SUV'),
('Ford', 'Transit', 2010, NULL, 'Van'),
-- Hyundai
('Hyundai', 'Accent', 2018, NULL, 'Sedan'),
('Hyundai', 'Elantra', 2016, NULL, 'Sedan'),
('Hyundai', 'Tucson', 2016, NULL, 'SUV'),
('Hyundai', 'Santa Fe', 2013, NULL, 'SUV'),
('Hyundai', 'i10', 2014, NULL, 'Hatchback'),
('Hyundai', 'Stargazer', 2022, NULL, 'MPV'),
-- Kia
('Kia', 'Morning', 2011, NULL, 'Hatchback'),
('Kia', 'Seltos', 2020, NULL, 'SUV'),
('Kia', 'Sorento', 2014, NULL, 'SUV'),
('Kia', 'Sportage', 2016, NULL, 'SUV'),
('Kia', 'Carnival', 2019, NULL, 'MPV'),
('Kia', 'K3', 2013, NULL, 'Sedan'),
('Kia', 'K5', 2020, NULL, 'Sedan'),
-- Mitsubishi
('Mitsubishi', 'Xpander', 2018, NULL, 'MPV'),
('Mitsubishi', 'Triton', 2010, NULL, 'Pickup'),
('Mitsubishi', 'Outlander', 2014, NULL, 'SUV'),
('Mitsubishi', 'Pajero Sport', 2011, NULL, 'SUV'),
('Mitsubishi', 'Attrage', 2015, NULL, 'Sedan'),
-- Suzuki
('Suzuki', 'Swift', 2012, NULL, 'Hatchback'),
('Suzuki', 'Ertiga', 2019, NULL, 'MPV'),
('Suzuki', 'XL7', 2020, NULL, 'SUV'),
('Suzuki', 'Ciaz', 2016, NULL, 'Sedan'),
('Suzuki', 'Carry', 2000, NULL, 'Truck'),
-- VinFast
('VinFast', 'VF e34', 2021, NULL, 'SUV'),
('VinFast', 'VF 8', 2022, NULL, 'SUV'),
('VinFast', 'VF 9', 2022, NULL, 'SUV'),
('VinFast', 'Fadil', 2019, 2022, 'Hatchback'),
('VinFast', 'Lux A2.0', 2019, 2022, 'Sedan'),
('VinFast', 'Lux SA2.0', 2019, 2022, 'SUV'),
-- Mercedes-Benz (phổ biến)
('Mercedes-Benz', 'C-Class', 2010, NULL, 'Sedan'),
('Mercedes-Benz', 'E-Class', 2010, NULL, 'Sedan'),
('Mercedes-Benz', 'GLC', 2016, NULL, 'SUV'),
('Mercedes-Benz', 'GLE', 2016, NULL, 'SUV'),
-- BMW (phổ biến)
('BMW', '3 Series', 2010, NULL, 'Sedan'),
('BMW', '5 Series', 2010, NULL, 'Sedan'),
('BMW', 'X3', 2011, NULL, 'SUV'),
('BMW', 'X5', 2010, NULL, 'SUV'),
-- Isuzu
('Isuzu', 'D-Max', 2012, NULL, 'Pickup'),
('Isuzu', 'mu-X', 2014, NULL, 'SUV'),
-- Chevrolet
('Chevrolet', 'Colorado', 2012, 2020, 'Pickup'),
('Chevrolet', 'Trailblazer', 2012, 2020, 'SUV')
ON CONFLICT DO NOTHING;

-- Done!
SELECT 'Migration completed successfully!' as status;
