-- Migration to enable Realtime replication for Warehouse Map tables
DO $$
BEGIN
    -- Ensure publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Enable Realtime for positions
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'positions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.positions;
    END IF;

    -- Enable Realtime for lots
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lots') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lots;
    END IF;

    -- Enable Realtime for lot_items
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lot_items') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lot_items;
    END IF;

    -- Enable Realtime for export_tasks
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'export_tasks') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.export_tasks;
    END IF;

    -- Enable Realtime for export_task_items
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'export_task_items') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.export_task_items;
    END IF;

    -- Enable Realtime for zones
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'zones') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.zones;
    END IF;

    -- Enable Realtime for zone_positions
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'zone_positions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.zone_positions;
    END IF;
END $$;
