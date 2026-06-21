-- Migration: Thêm cột is_locked vào bảng lots để hỗ trợ tính năng Khóa LOT và các trigger ràng buộc vị trí
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
COMMENT ON COLUMN public.lots.is_locked IS 'Trạng thái khóa của Lot. Khi bị khóa, số lượng tồn kho của Lot này không được cập nhật và vị trí bị giải phóng.';

-- 1. Hàm trigger để tự động giải phóng vị trí khi LOT bị khóa (is_locked chuyển từ false/null sang true)
CREATE OR REPLACE FUNCTION public.handle_lot_lock_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_locked = true AND (OLD.is_locked IS NULL OR OLD.is_locked = false) THEN
        UPDATE public.positions
        SET lot_id = NULL
        WHERE lot_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger trên bảng lots
DROP TRIGGER IF EXISTS trg_handle_lot_lock_change ON public.lots;
CREATE TRIGGER trg_handle_lot_lock_change
    AFTER UPDATE OF is_locked ON public.lots
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_lot_lock_change();

-- 2. Hàm trigger để chặn gán vị trí mới cho LOT đã bị khóa
CREATE OR REPLACE FUNCTION public.check_position_lot_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_is_locked BOOLEAN;
BEGIN
    IF NEW.lot_id IS NOT NULL THEN
        SELECT is_locked INTO v_is_locked
        FROM public.lots
        WHERE id = NEW.lot_id;
        
        IF v_is_locked = true THEN
            RAISE EXCEPTION 'Không thể gán vị trí cho lô hàng đang bị khóa.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger trên bảng positions
DROP TRIGGER IF EXISTS trg_check_position_lot_lock ON public.positions;
CREATE TRIGGER trg_check_position_lot_lock
    BEFORE INSERT OR UPDATE OF lot_id ON public.positions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_position_lot_lock();
