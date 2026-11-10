import { supabase } from './supabaseClient'
import { readUiConfig, writeUiConfig } from './systemUiSettings'

export interface JobTemplate {
    id: string
    name: string
    notes?: string | null
    pinned_product_ids?: string[]
    company_id?: string | null
    system_code?: string
    order_index?: number
    created_at?: string
    updated_at?: string
}

export const DEFAULT_JOB_TEMPLATES: JobTemplate[] = []

/**
 * Chuẩn hóa mã phân hệ kho: giữ nguyên mã kho thực tế (KHO_DONG_LANH, KHO_BAO_BI, PACKAGING...),
 * chỉ cắt bỏ hậu tố kỹ thuật `__solieu` của trang Bàn Số Liệu.
 */
export const normalizeJobSystemCode = (code?: string | null): string => {
    if (!code) return ''
    return code.trim().replace(/__solieu$/, '')
}

const getStorageKey = (systemCode: string) => `job_templates_${normalizeJobSystemCode(systemCode)}`

/**
 * Đọc danh sách công việc mẫu theo đúng phân hệ kho hiện tại (`system_code`).
 * Mỗi kho (Kho Đông Lạnh, Kho Bao Bì, Kho Nhãn...) có bộ mẫu riêng biệt hoàn toàn.
 */
export async function getJobTemplates(systemCode?: string | null, companyId?: string | null): Promise<JobTemplate[]> {
    const cleanCode = normalizeJobSystemCode(systemCode)
    if (!cleanCode) return []

    // 1. Truy vấn trực tiếp từ bảng SQL `delivery_job_templates` theo đúng `system_code` của kho hiện tại
    try {
        let query = (supabase as any)
            .from('delivery_job_templates')
            .select('*')
            .eq('system_code', cleanCode)
            .order('order_index', { ascending: true })
            .order('created_at', { ascending: true })

        if (companyId) {
            query = query.or(`company_id.eq.${companyId},company_id.is.null`)
        }

        const { data, error } = await query
        if (!error && Array.isArray(data)) {
            const sqlList: JobTemplate[] = data.map((row: any) => ({
                id: row.id,
                name: row.name,
                notes: row.notes,
                pinned_product_ids: Array.isArray(row.pinned_product_ids) ? row.pinned_product_ids : [],
                company_id: row.company_id,
                system_code: row.system_code,
                order_index: row.order_index,
                created_at: row.created_at,
                updated_at: row.updated_at
            }))
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(getStorageKey(cleanCode), JSON.stringify(sqlList))
                } catch {}
            }
            return sqlList
        }
    } catch (e) {
        // Fallback nếu kết nối gián đoạn
    }

    // 2. Fallback đọc từ system_ui_settings của đúng kho đó
    try {
        const config = await readUiConfig(cleanCode)
        if (config?.job_templates && Array.isArray(config.job_templates)) {
            return config.job_templates as JobTemplate[]
        }
    } catch {}

    // 3. Fallback đọc từ LocalStorage của đúng kho đó
    if (typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem(getStorageKey(cleanCode))
            if (raw) {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) return parsed
            }
        } catch {}
    }

    return []
}

/**
 * Xóa một công việc mẫu khỏi bảng SQL `delivery_job_templates`
 */
export async function deleteJobTemplateSQL(id: string): Promise<boolean> {
    try {
        const { error } = await (supabase as any)
            .from('delivery_job_templates')
            .delete()
            .eq('id', id)

        return !error
    } catch {
        return false
    }
}

/**
 * Lưu danh sách công việc mẫu theo đúng phân hệ kho (`system_code`)
 */
export async function saveJobTemplates(systemCode: string, templates: JobTemplate[], companyId?: string | null): Promise<boolean> {
    const cleanCode = normalizeJobSystemCode(systemCode)
    if (!cleanCode) return false

    // 1. Lưu vào bảng SQL delivery_job_templates
    try {
        for (let idx = 0; idx < templates.length; idx++) {
            const t = templates[idx]
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.id)
            if (isUuid) {
                await (supabase as any)
                    .from('delivery_job_templates')
                    .upsert({
                        id: t.id,
                        name: t.name,
                        notes: t.notes || null,
                        pinned_product_ids: t.pinned_product_ids || [],
                        system_code: cleanCode,
                        company_id: companyId || t.company_id || null,
                        order_index: idx + 1,
                        updated_at: new Date().toISOString()
                    })
            } else {
                const { data } = await (supabase as any)
                    .from('delivery_job_templates')
                    .insert([{
                        name: t.name,
                        notes: t.notes || null,
                        pinned_product_ids: t.pinned_product_ids || [],
                        system_code: cleanCode,
                        company_id: companyId || t.company_id || null,
                        order_index: idx + 1,
                        updated_at: new Date().toISOString()
                    }])
                    .select()
                    .single()

                if (data?.id) {
                    t.id = data.id
                }
            }
        }
    } catch (err) {
        console.warn('Lỗi lưu SQL delivery_job_templates:', err)
    }

    // 2. Lưu LocalStorage sau khi đã cập nhật ID UUID từ SQL
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(getStorageKey(cleanCode), JSON.stringify(templates))
        } catch {}
    }

    // 3. Đồng bộ backup sang system_ui_settings
    try {
        await writeUiConfig(cleanCode, { job_templates: templates })
    } catch {}

    return true
}
