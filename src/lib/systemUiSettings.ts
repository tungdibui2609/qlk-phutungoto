import { supabase } from '@/lib/supabaseClient'

/**
 * Cấu hình giao diện theo phân hệ kho (danh mục cần theo dõi, danh mục được phép hiển thị…).
 * Lưu ở bảng riêng `system_ui_settings` thay vì jsonb `systems.modules` vì bản ghi đó
 * chỉ admin (account_level 1-2) mới được UPDATE và trang Cài đặt tính năng ghi đè cả khối.
 */

export type UiConfig = Record<string, any>

const rowId = (systemCode: string) => `ui_${systemCode}`

export async function readUiConfig(systemCode?: string | null): Promise<UiConfig> {
    if (!systemCode) return {}
    const { data, error } = await (supabase.from('system_ui_settings') as any)
        .select('config')
        .eq('id', rowId(systemCode))
        .maybeSingle()

    if (error) throw new Error(error.message)

    const config = data?.config
    if (typeof config === 'string') {
        try {
            return JSON.parse(config)
        } catch {
            return {}
        }
    }
    return (config as UiConfig) || {}
}

/**
 * Ghi từng khóa một, giữ nguyên các khóa khác, rồi đọc lại xác nhận.
 * RLS chặn ghi sẽ trả về 200 không kèm error -> nếu không đọc lại thì UI báo "đã lưu" giả.
 */
export async function writeUiConfig(systemCode: string, patch: UiConfig): Promise<UiConfig> {
    const merged: UiConfig = { ...(await readUiConfig(systemCode)), ...patch }

    const { error } = await (supabase.from('system_ui_settings') as any).upsert(
        {
            id: rowId(systemCode),
            system_code: systemCode,
            config: merged,
            updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
    )
    if (error) throw new Error(error.message)

    const saved = await readUiConfig(systemCode)
    const persisted = Object.keys(patch).every(key => JSON.stringify(saved[key]) === JSON.stringify(merged[key]))
    if (!persisted) {
        throw new Error('Máy chủ không ghi được cấu hình (thiếu quyền trên bảng system_ui_settings).')
    }

    return saved
}
