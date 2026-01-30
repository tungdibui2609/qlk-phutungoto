-- Final Migration: THE "NUCLEAR" SOLUTION
-- This version uses type-agnostic conversion to safely move data.

DO $$
BEGIN
    -- 1. Ensure systems table has the columns
    ALTER TABLE systems ADD COLUMN IF NOT EXISTS inbound_modules text[] DEFAULT ARRAY[]::text[];
    ALTER TABLE systems ADD COLUMN IF NOT EXISTS outbound_modules text[] DEFAULT ARRAY[]::text[];
    ALTER TABLE systems ADD COLUMN IF NOT EXISTS dashboard_modules text[] DEFAULT ARRAY[]::text[];
    ALTER TABLE systems ADD COLUMN IF NOT EXISTS lot_modules text[] DEFAULT ARRAY[]::text[];

    -- 2. Migrate using a type-agnostic approach:
    -- We convert everything to JSONB first using (to_jsonb), then extract text elements into an array.
    -- This works whether the source column is JSONB or TEXT[].
    UPDATE systems s
    SET 
        inbound_modules = (
            SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(to_jsonb(sc.inbound_modules))), ARRAY[]::text[])
        ),
        outbound_modules = (
            SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(to_jsonb(sc.outbound_modules))), ARRAY[]::text[])
        ),
        dashboard_modules = (
            SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(to_jsonb(sc.dashboard_modules))), ARRAY[]::text[])
        ),
        lot_modules = (
            SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(to_jsonb(sc.lot_modules))), ARRAY[]::text[])
        )
    FROM system_configs sc
    WHERE s.code = sc.system_code
    AND (s.company_id = sc.company_id OR (s.company_id IS NULL AND sc.company_id IS NULL));

    RAISE NOTICE 'Dữ liệu đã được gộp thành công bằng phương thức đồng nhất JSON!';

    -- 3. Cleanup
    DROP TABLE IF EXISTS public.system_configs CASCADE;
    
    RAISE NOTICE 'Đã xóa bảng system_configs.';

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Lỗi Migration: %', SQLERRM;
END $$;
