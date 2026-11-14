-- Gỡ bỏ toàn bộ 3 Audit Triggers nếu cần quay về trạng thái trước đó
DROP TRIGGER IF EXISTS trg_audit_lots_changes ON public.lots;
DROP TRIGGER IF EXISTS trg_audit_lot_items_changes ON public.lot_items;
DROP TRIGGER IF EXISTS trg_audit_positions_changes ON public.positions;

DROP FUNCTION IF EXISTS public.fn_audit_lots_trigger();
DROP FUNCTION IF EXISTS public.fn_audit_lot_items_trigger();
DROP FUNCTION IF EXISTS public.fn_audit_positions_trigger();
