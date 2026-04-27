-- ============================================================
-- Migration: Create position_history table (IDEMPOTENT)
-- Date: 2026-04-27
-- Purpose: Track position changes to view warehouse map history
-- Safe to run multiple times - uses IF NOT EXISTS / OR REPLACE
-- ============================================================

-- 1. Create position_history table
CREATE TABLE IF NOT EXISTS public.position_history (
    id BIGSERIAL PRIMARY KEY,
    position_id UUID NOT NULL,
    system_code TEXT NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    code TEXT,
    lot_id UUID,
    lot_code TEXT,
    zone_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add indexes (safe to re-run)
CREATE INDEX IF NOT EXISTS idx_position_history_system_date 
    ON public.position_history(system_code, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_position_history_position 
    ON public.position_history(position_id);
CREATE INDEX IF NOT EXISTS idx_position_history_snapshot_date 
    ON public.position_history(snapshot_date);

-- 3. Enable RLS
ALTER TABLE public.position_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies (idempotent: skip if already exists)
-- Fallback: allow all authenticated users to read
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'position_history' 
          AND policyname = 'Fallback read position_history'
    ) THEN
        CREATE POLICY "Fallback read position_history" ON public.position_history
            FOR SELECT
            USING (true);
    END IF;
END $$;

-- Per-system policies
DO $$
DECLARE
    sys_row RECORD;
    policy_name TEXT;
BEGIN
    FOR sys_row IN SELECT code FROM public.systems LOOP
        policy_name := 'Users can read position_history for ' || sys_row.code;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = 'position_history' 
              AND policyname = policy_name
        ) THEN
            EXECUTE format('
                CREATE POLICY %I ON public.position_history
                    FOR SELECT
                    USING (system_code = %L)
            ', policy_name, sys_row.code);
        END IF;
    END LOOP;
END $$;

-- 5. Function to capture daily snapshot of positions
CREATE OR REPLACE FUNCTION public.capture_daily_position_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_date DATE := CURRENT_DATE;
BEGIN
    -- Delete existing snapshot for today (idempotent)
    DELETE FROM public.position_history WHERE snapshot_date = target_date;

    -- Insert current position state for today
    -- Note: positions use system_type, not system_code
    -- zone_id comes from zone_positions join table
    INSERT INTO public.position_history (position_id, system_code, snapshot_date, code, lot_id, lot_code, zone_id)
    SELECT 
        p.id,
        COALESCE(p.system_type, 'default'),
        target_date,
        p.code,
        p.lot_id,
        l.code AS lot_code,
        zp.zone_id
    FROM public.positions p
    LEFT JOIN public.lots l ON l.id = p.lot_id
    LEFT JOIN public.zone_positions zp ON zp.position_id = p.id;
END;
$$;

-- 6. Function to get position history for a specific date
CREATE OR REPLACE FUNCTION public.get_position_history(
    p_system_code TEXT,
    p_snapshot_date DATE
)
RETURNS TABLE (
    position_id UUID,
    code TEXT,
    lot_id UUID,
    lot_code TEXT,
    zone_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.position_id,
        h.code,
        h.lot_id,
        h.lot_code,
        h.zone_id
    FROM public.position_history h
    WHERE h.system_code = p_system_code
      AND h.snapshot_date = p_snapshot_date;
END;
$$;

-- 7. Function to get available snapshot dates
CREATE OR REPLACE FUNCTION public.get_snapshot_dates(
    p_system_code TEXT
)
RETURNS TABLE (snapshot_date DATE, position_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.snapshot_date,
        COUNT(*)::BIGINT AS position_count
    FROM public.position_history h
    WHERE h.system_code = p_system_code
    GROUP BY h.snapshot_date
    ORDER BY h.snapshot_date DESC;
END;
$$;