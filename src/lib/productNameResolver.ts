/**
 * Tiện ích chuẩn hóa và phân giải tên sản phẩm theo Mã Phụ (Lot Sub-Code / Tags)
 * Khi một mã phụ được kích hoạt cờ `append_to_product_name = true` trong master_tags,
 * dòng sản phẩm của LOT sẽ được hiển thị kèm mã đó: VD: "Đô Na A (TRUNG HÙNG)".
 * Đồng thời các báo cáo tồn kho sẽ tự động tách nhóm theo tên đã gắn kèm này.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface ResolvedProductNameResult {
    displayName: string
    affixedTags: string[]
    suffix: string | null
}

/**
 * Trích xuất các segment nguyên liệu từ một tag (hỗ trợ cả tag đơn lẻ và khuôn mẫu chuỗi dạng 'A>@>B')
 */
export function extractTagAtoms(rawTag: string): string[] {
    if (!rawTag) return []
    return rawTag
        .split('>')
        .map(seg => seg.replace(/@/g, '').trim().toUpperCase())
        .filter(Boolean)
}

/**
 * Lấy danh sách các mã phụ hợp lệ có kích hoạt cờ gắn kèm tên sản phẩm
 */
export function getMatchedAffixTags(
    tags: Array<string | { tag: string }> | undefined | null,
    affixTagSet: Set<string> | null | undefined
): string[] {
    if (!tags || tags.length === 0 || !affixTagSet || affixTagSet.size === 0) {
        return []
    }

    const matched = new Set<string>()

    tags.forEach(t => {
        const tagStr = typeof t === 'string' ? t : (t?.tag || '')
        if (!tagStr) return

        // Bỏ qua các tag nội bộ hệ thống (lịch sử tách/gộp)
        if (
            tagStr.startsWith('MERGED_') ||
            tagStr.startsWith('SPLIT_') ||
            tagStr.startsWith('MERGED_TO:') ||
            tagStr.startsWith('SPLIT_TO:')
        ) {
            return
        }

        const atoms = extractTagAtoms(tagStr)
        atoms.forEach(atom => {
            if (affixTagSet.has(atom)) {
                matched.add(atom)
            }
        })
    })

    return Array.from(matched)
}

/**
 * Phân giải tên hiển thị cho sản phẩm dựa vào tên gốc và danh sách tag của lô
 * Ví dụ: resolveDisplayProductName('Đô Na A', ['TRUNG HÙNG'], affixTagSet) -> "Đô Na A (TRUNG HÙNG)"
 */
export function resolveDisplayProductName(
    baseName: string | undefined | null,
    tags: Array<string | { tag: string }> | undefined | null,
    affixTagSet: Set<string> | null | undefined
): string {
    const rawName = (baseName || '').trim()
    if (!rawName) return ''

    const matched = getMatchedAffixTags(tags, affixTagSet)
    if (matched.length === 0) {
        return rawName
    }

    const suffix = matched.join(', ')

    // Tránh nối lặp nếu tên gốc đã vô tình chứa suffix này
    if (rawName.toUpperCase().includes(`(${suffix.toUpperCase()})`)) {
        return rawName
    }

    return `${rawName} (${suffix})`
}

/**
 * Sinh key gom nhóm báo cáo tồn kho có xét đến mã phụ gắn kèm tên
 */
export function buildAffixedGroupKey(
    baseKey: string,
    tags: Array<string | { tag: string }> | undefined | null,
    affixTagSet: Set<string> | null | undefined
): string {
    const matched = getMatchedAffixTags(tags, affixTagSet)
    if (matched.length === 0) {
        return baseKey
    }
    const tagPart = matched.sort().join('__')
    return `${baseKey}__AFFIX[${tagPart}]`
}

/**
 * Tải danh sách các tag có cờ append_to_product_name = true của phân hệ kho hiện hành
 */
export async function fetchAffixTagSet(
    supabase: SupabaseClient,
    systemCode: string
): Promise<Set<string>> {
    const set = new Set<string>()
    if (!systemCode) return set

    try {
        let sysCode = systemCode.trim()
        if (sysCode === 'FROZEN') sysCode = 'KHO_DONG_LANH'
        else if (sysCode === 'DRY') sysCode = 'KHO_VAT_TU_BAO_BI'

        const { data, error } = await supabase
            .from('master_tags')
            .select('name')
            .eq('system_code', sysCode)
            .eq('append_to_product_name', true)

        if (!error && data) {
            data.forEach((row: any) => {
                if (row.name) {
                    set.add(String(row.name).trim().toUpperCase())
                }
            })
        }
    } catch (err) {
        console.warn('[productNameResolver] Failed to fetch affix tags:', err)
    }

    return set
}

