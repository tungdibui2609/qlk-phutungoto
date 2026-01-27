alter table public.inventory_checks
    add column if not exists adjustment_inbound_order_id uuid references public.inbound_orders(id),
    add column if not exists adjustment_outbound_order_id uuid references public.outbound_orders(id);
