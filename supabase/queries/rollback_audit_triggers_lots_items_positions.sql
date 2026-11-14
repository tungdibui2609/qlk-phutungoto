-- Gỡ bỏ toàn bộ 3 Audit Triggers nếu cần quay về trạng thái trước đó
DROP TRIGGER IF EXISTS trg_audit_lots_changes ON public.lots;
DROP TRIGGER IF EXISTS trg_audit_lot_items_changes ON public.lot_items;
DROP TRIGGER IF EXISTS trg_audit_positions_changes ON public.positions;
DROP TRIGGER IF EXISTS trg_audit_inbound_orders_changes ON public.inbound_orders;
DROP TRIGGER IF EXISTS trg_audit_outbound_orders_changes ON public.outbound_orders;
DROP TRIGGER IF EXISTS trg_audit_delivery_shifts_changes ON public.delivery_shifts;
DROP TRIGGER IF EXISTS trg_audit_delivery_journal_changes ON public.delivery_journal;
DROP TRIGGER IF EXISTS trg_audit_shift_tasks_changes ON public.shift_tasks;

DROP FUNCTION IF EXISTS public.fn_audit_lots_trigger();
DROP FUNCTION IF EXISTS public.fn_audit_lot_items_trigger();
DROP FUNCTION IF EXISTS public.fn_audit_positions_trigger();
DROP FUNCTION IF EXISTS public.fn_audit_orders_trigger();
DROP FUNCTION IF EXISTS public.fn_audit_delivery_shifts_trigger();
DROP FUNCTION IF EXISTS public.fn_audit_delivery_journal_trigger();
DROP FUNCTION IF EXISTS public.fn_audit_shift_tasks_trigger();
