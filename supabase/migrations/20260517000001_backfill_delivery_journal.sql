-- Backfill module delivery_journal vào companies.unlocked_modules và systems.utility_modules
-- Module đã được seed vào app_modules với is_basic = true trong migration trước
-- Nhưng cần backfill vào company licenses và system config để hiển thị đúng

-- 1. Thêm delivery_journal vào companies.unlocked_modules (nếu chưa có)
UPDATE public.companies
SET unlocked_modules = ARRAY(
    SELECT DISTINCT unnest(
        CASE 
            WHEN unlocked_modules IS NULL THEN ARRAY['delivery_journal']
            ELSE array_append(unlocked_modules, 'delivery_journal')
        END
    )
)
WHERE NOT (unlocked_modules @> ARRAY['delivery_journal']);

-- 2. Thêm delivery_journal vào systems.modules -> utility_modules (nếu chưa có)
-- Trước tiên xử lý các systems có modules dạng object JSON
UPDATE public.systems
SET modules = jsonb_set(
    CASE 
        WHEN modules IS NULL THEN '{"utility_modules": ["delivery_journal"]}'::jsonb
        WHEN modules::text = '[]' THEN '{"utility_modules": ["delivery_journal"]}'::jsonb
        ELSE modules::jsonb
    END,
    '{utility_modules}',
    CASE
        WHEN modules IS NULL THEN '["delivery_journal"]'::jsonb
        WHEN modules::text = '[]' THEN '["delivery_journal"]'::jsonb
        WHEN modules::jsonb ? 'utility_modules' THEN
            -- Nếu đã có utility_modules nhưng chưa chứa delivery_journal
            CASE
                WHEN modules::jsonb->'utility_modules' @> '"delivery_journal"'::jsonb
                THEN modules::jsonb->'utility_modules'
                ELSE (modules::jsonb->'utility_modules') || '["delivery_journal"]'::jsonb
            END
        ELSE '["delivery_journal"]'::jsonb
    END
)
WHERE 
    -- Kiểm tra xem delivery_journal đã có trong utility_modules chưa
    NOT (
        modules::jsonb->'utility_modules' @> '"delivery_journal"'::jsonb
    );