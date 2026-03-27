-- ============================================
-- Module Nguyên Liệu Tươi - Fresh Material Lifecycle
-- ============================================

-- 1. Lô nguyên liệu tươi (Batch)
CREATE TABLE IF NOT EXISTS fresh_material_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_code TEXT NOT NULL,
    system_code TEXT NOT NULL,
    company_id UUID NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    received_date TIMESTAMPTZ DEFAULT now(),
    total_initial_quantity NUMERIC DEFAULT 0,
    initial_unit TEXT DEFAULT 'Kg',
    status TEXT DEFAULT 'RECEIVING' CHECK (status IN ('RECEIVING', 'PROCESSING', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Lần nhập xe (Receiving)
CREATE TABLE IF NOT EXISTS fresh_material_receivings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES fresh_material_batches(id) ON DELETE CASCADE,
    receiving_order INT NOT NULL DEFAULT 1,
    vehicle_plate TEXT,
    driver_name TEXT,
    quantity NUMERIC NOT NULL DEFAULT 0,
    unit TEXT DEFAULT 'Kg',
    received_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Giai đoạn xử lý (Stage) - Tùy chỉnh
CREATE TABLE IF NOT EXISTS fresh_material_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES fresh_material_batches(id) ON DELETE CASCADE,
    stage_order INT NOT NULL DEFAULT 1,
    stage_name TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    input_quantity NUMERIC DEFAULT 0,
    input_unit TEXT DEFAULT 'Kg',
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'DONE')),
    notes TEXT,
    performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Sản phẩm đầu ra mỗi giai đoạn
CREATE TABLE IF NOT EXISTS fresh_material_stage_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES fresh_material_stages(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES fresh_material_batches(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    output_type TEXT DEFAULT 'PRODUCT' CHECK (output_type IN ('PRODUCT', 'WASTE', 'SAMPLE')),
    quantity NUMERIC NOT NULL DEFAULT 0,
    unit TEXT DEFAULT 'Kg',
    grade TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fm_batches_system ON fresh_material_batches(system_code);
CREATE INDEX IF NOT EXISTS idx_fm_batches_company ON fresh_material_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_fm_batches_status ON fresh_material_batches(status);
CREATE INDEX IF NOT EXISTS idx_fm_receivings_batch ON fresh_material_receivings(batch_id);
CREATE INDEX IF NOT EXISTS idx_fm_stages_batch ON fresh_material_stages(batch_id);
CREATE INDEX IF NOT EXISTS idx_fm_outputs_stage ON fresh_material_stage_outputs(stage_id);
CREATE INDEX IF NOT EXISTS idx_fm_outputs_batch ON fresh_material_stage_outputs(batch_id);

-- RLS (Row Level Security)
ALTER TABLE fresh_material_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE fresh_material_receivings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fresh_material_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE fresh_material_stage_outputs ENABLE ROW LEVEL SECURITY;

-- Policies: Allow all for authenticated users (further filtering by system_code in app layer)
CREATE POLICY "fm_batches_all" ON fresh_material_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "fm_receivings_all" ON fresh_material_receivings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "fm_stages_all" ON fresh_material_stages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "fm_outputs_all" ON fresh_material_stage_outputs FOR ALL USING (true) WITH CHECK (true);
