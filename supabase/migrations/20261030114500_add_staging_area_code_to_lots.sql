-- Tách "Hàng chờ xếp kho (Khu vực Chờ)" ra khỏi chi nhánh:
-- lots.warehouse_name từ nay CHỈ chứa chi nhánh (cấp công ty), còn nơi LOT đang chờ xếp
-- (thường là mã warehouse_layouts, VD: KBB1) nằm ở cột riêng.
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS staging_area_code TEXT;

COMMENT ON COLUMN public.lots.staging_area_code IS
    'Mã khu vực chờ xếp của kho (thường là mã warehouse_layouts) khi LOT chưa được xếp vào ô kệ. Không liên quan tới chi nhánh (warehouse_name).';
