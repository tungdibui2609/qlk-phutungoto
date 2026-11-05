-- Bảng lưu cấu hình giao diện theo phân hệ kho (danh mục cần theo dõi, danh mục được phép hiển thị).
-- Chuyển khỏi `systems.modules` vì ở đó cấu hình bị mất âm thầm:
--   1) RLS trên systems chỉ cho account_level 1-2 UPDATE -> nhân viên (level 3) bấm "Lưu hệ thống"
--      không báo lỗi nhưng 0 dòng được ghi.
--   2) Trang Cài đặt tính năng ghi đè toàn bộ jsonb `modules` bằng 5 khóa module -> xóa khóa cấu hình này.
--   3) Superadmin không có dòng systems nào -> currentSystem.id rỗng -> lệnh lưu bị bỏ qua từ đầu.
CREATE TABLE IF NOT EXISTS public.system_ui_settings (
    id TEXT PRIMARY KEY,
    system_code TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS system_ui_settings_system_code_idx
    ON public.system_ui_settings (system_code);

ALTER TABLE public.system_ui_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_ui_settings_write_authenticated" ON public.system_ui_settings;
CREATE POLICY "system_ui_settings_write_authenticated"
    ON public.system_ui_settings FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "system_ui_settings_read_all" ON public.system_ui_settings;
CREATE POLICY "system_ui_settings_read_all"
    ON public.system_ui_settings FOR SELECT TO anon, authenticated
    USING (true);

-- Giữ nguyên cấu hình đã lưu trước đây trong systems.modules
INSERT INTO public.system_ui_settings (id, system_code, config)
SELECT
    'ui_' || s.code,
    s.code,
    jsonb_strip_nulls(jsonb_build_object(
        'warehouse_status_config', s.modules -> 'warehouse_status_config',
        'dashboard_config', s.modules -> 'dashboard_config'
    ))
FROM public.systems s
WHERE jsonb_typeof(s.modules) = 'object'
  AND (s.modules ? 'warehouse_status_config' OR s.modules ? 'dashboard_config')
ON CONFLICT (id) DO NOTHING;
