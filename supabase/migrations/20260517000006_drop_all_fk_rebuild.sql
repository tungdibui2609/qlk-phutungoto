-- Migration: Xóa TẤT CẢ FK constraints trên delivery_settings rồi tạo lại đúng
-- Vấn đề: FK mo_id có thể vẫn trỏ vào manufacturing_orders (constraint name khác nhau)
-- Giải pháp: Drop mọi FK liên quan đến mo_id, rồi tạo lại chuẩn

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Tìm và xóa TẤT CẢ foreign key constraints trên cột mo_id của delivery_settings
    FOR r IN (
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.constraint_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'delivery_settings'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND ccu.column_name = 'mo_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.delivery_settings DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
        RAISE NOTICE 'Dropped FK constraint: %', r.constraint_name;
    END LOOP;

    -- Tương tự cho production_lot_id
    FOR r IN (
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.constraint_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'delivery_settings'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND ccu.column_name = 'production_lot_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.delivery_settings DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
        RAISE NOTICE 'Dropped FK constraint: %', r.constraint_name;
    END LOOP;
END $$;

-- Tạo lại FK mo_id → productions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'delivery_settings_mo_id_productions_fkey'
        AND table_name = 'delivery_settings'
    ) THEN
        ALTER TABLE public.delivery_settings
            ADD CONSTRAINT delivery_settings_mo_id_productions_fkey
            FOREIGN KEY (mo_id) REFERENCES public.productions(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Đảm bảo mo_id là UUID
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.delivery_settings ALTER COLUMN mo_id TYPE UUID USING mo_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'mo_id already UUID or conversion failed';
    END;
END $$;

-- Tạo lại FK production_lot_id → production_lots
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'delivery_settings_lot_id_production_lots_fkey'
        AND table_name = 'delivery_settings'
    ) THEN
        ALTER TABLE public.delivery_settings
            ADD CONSTRAINT delivery_settings_lot_id_production_lots_fkey
            FOREIGN KEY (production_lot_id) REFERENCES public.production_lots(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Đảm bảo các index tồn tại
CREATE INDEX IF NOT EXISTS idx_ds_mo_id ON public.delivery_settings(mo_id);
CREATE INDEX IF NOT EXISTS idx_ds_lot_id ON public.delivery_settings(production_lot_id);