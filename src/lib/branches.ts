export const BRANCH_FILTER_ALL = 'all'
export const BRANCH_FILTER_NONE = '__unassigned__'

export interface BranchLike {
    id?: string
    name?: string | null
    code?: string | null
    is_default?: boolean | null
    company_id?: string | null
}

/**
 * Chi nhánh là cấp CÔNG TY, không phải cấp phân hệ: một chi nhánh chứa nhiều kho
 * (Kho Đông Lạnh, Kho Bao Bì, Kho Nguyên Liệu...) nên LOT ở kho nào cũng chọn được chi nhánh.
 * Chỉ cô lập theo công ty (multi-tenant). CÔNG TY chưa khai báo chi nhánh → danh sách rỗng
 * → không ép bắt buộc, giữ hành vi cũ cho tenant chưa cấu hình.
 */
export function getBranchesOfCompany<T extends BranchLike>(
    branches: T[] | null | undefined,
    companyId?: string | null
): T[] {
    if (!Array.isArray(branches)) return []
    const company = (companyId || '').trim()
    return branches.filter(b => {
        if (!b?.name) return false
        if (!company) return true
        return (b.company_id || '').trim() === company
    })
}

export function getDefaultBranchName<T extends BranchLike>(
    branches: T[] | null | undefined,
    companyId?: string | null
): string {
    const scoped = getBranchesOfCompany(branches, companyId)
    const defaultBranch = scoped.find(b => b.is_default) || scoped[0]
    return defaultBranch?.name || ''
}

/** Đọc thẳng DB cho các luồng tạo LOT không có sẵn danh sách chi nhánh (vd. tạo LOT từ pallet). */
export async function fetchDefaultBranchName(client: any, companyId?: string | null): Promise<string> {
    try {
        const { data } = await (client.from('branches') as any)
            .select('id, name, is_default, company_id')
            .order('is_default', { ascending: false })
            .order('name')
        return getDefaultBranchName(data as BranchLike[], companyId)
    } catch (err) {
        console.error('Error fetching default branch:', err)
        return ''
    }
}
