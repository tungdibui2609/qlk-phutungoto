import { supabase } from '@/lib/supabaseClient'
import { INBOUND_MODULES, OUTBOUND_MODULES } from '@/lib/order-modules'
import { LOT_MODULES } from '@/lib/lot-modules'
import { PRODUCT_MODULES } from '@/lib/product-modules'
import { DASHBOARD_MODULES } from '@/lib/dashboard-modules'
import { UTILITY_MODULES } from '@/lib/utility-modules'
import { PRINT_MODULES } from '@/lib/print-modules'
import { QR_MODULES } from '@/lib/qr-modules'
import { REPORT_MODULES } from '@/lib/report-modules'

export interface SystemCodeModule {
    id: string
    name: string
    description: string
    category: 'inbound' | 'outbound' | 'lot' | 'product' | 'dashboard' | 'utility' | 'info' | 'print' | 'qr' | 'report'
    is_basic: boolean
}

/**
 * Lấy toàn bộ danh sách module được định nghĩa trong mã nguồn code
 */
export function getAllCodeModules(): SystemCodeModule[] {
    return [
        ...INBOUND_MODULES.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            category: 'inbound' as const,
            is_basic: true // Mặc định từ giờ luôn là cơ bản
        })),
        ...OUTBOUND_MODULES.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            category: 'outbound' as const,
            is_basic: true
        })),
        ...LOT_MODULES.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            category: 'lot' as const,
            is_basic: true
        })),
        ...PRODUCT_MODULES.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            category: 'product' as const,
            is_basic: true
        })),
        ...DASHBOARD_MODULES.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            category: 'dashboard' as const,
            is_basic: true
        })),
        ...UTILITY_MODULES.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            category: (m.category === 'info' ? 'info' : 'utility') as 'utility' | 'info',
            is_basic: true
        })),
        ...PRINT_MODULES.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            category: 'print' as const,
            is_basic: true
        })),
        ...QR_MODULES.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            category: 'qr' as const,
            is_basic: true
        })),
        ...REPORT_MODULES.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            category: 'report' as const,
            is_basic: true
        }))
    ]
}

/**
 * Đồng bộ danh sách modules từ mã nguồn vào bảng app_modules trong Supabase:
 * - Module chưa có trong DB: TỰ ĐỘNG THÊM MỚI với is_basic = true (Cơ bản).
 * - Module đã có trong DB: Giữ nguyên is_basic của người dùng đã chỉnh, cập nhật name/description nếu có thay đổi.
 */
export async function syncAppModulesWithCode(): Promise<{ inserted: number; updated: number }> {
    const codeModules = getAllCodeModules()

    // 1. Lấy danh sách hiện tại từ DB
    const { data: dbModules, error } = await (supabase.from('app_modules' as any) as any)
        .select('*')

    if (error) {
        console.error('Error reading app_modules for sync:', error)
        throw error
    }

    const dbMap = new Map((dbModules || []).map((m: any) => [m.id, m]))
    let inserted = 0
    let updated = 0

    // 2. Kiểm tra và đồng bộ từng module
    for (const mod of codeModules) {
        const existing: any = dbMap.get(mod.id)
        if (!existing) {
            // Module mới -> Mặc định là cơ bản (is_basic: true) theo quy định
            const { error: insertErr } = await (supabase.from('app_modules' as any) as any)
                .insert({
                    id: mod.id,
                    name: mod.name,
                    description: mod.description,
                    category: mod.category,
                    is_basic: true // Mặc định là cơ bản
                })

            if (!insertErr) inserted++
            else console.error(`Error inserting module ${mod.id}:`, insertErr)
        } else {
            // Đã có -> Cập nhật tên hoặc mô tả nếu thay đổi, GIỮ NGUYÊN is_basic hiện tại
            const needsTextUpdate = existing.name !== mod.name || existing.description !== mod.description
            if (needsTextUpdate) {
                const { error: updateErr } = await (supabase.from('app_modules' as any) as any)
                    .update({
                        name: mod.name,
                        description: mod.description,
                        category: mod.category
                    })
                    .eq('id', mod.id)

                if (!updateErr) updated++
            }
        }
    }

    return { inserted, updated }
}
