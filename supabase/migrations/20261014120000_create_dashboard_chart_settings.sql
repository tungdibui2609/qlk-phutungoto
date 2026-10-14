-- Bảng lưu cấu hình cài đặt biểu đồ Dashboard (đồng bộ giữa các máy và người dùng)
CREATE TABLE IF NOT EXISTS public.dashboard_chart_settings (
    id TEXT PRIMARY KEY,
    system_code TEXT NOT NULL,
    category_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    pinned_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    top_n INTEGER NOT NULL DEFAULT 10,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.dashboard_chart_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.dashboard_chart_settings;
CREATE POLICY "Enable all access for all users" ON public.dashboard_chart_settings FOR ALL USING (true) WITH CHECK (true);
