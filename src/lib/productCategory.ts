/**
 * Quy tắc suy danh mục DUY NHẤT của toàn hệ thống.
 *
 * Ưu tiên: (1) danh mục gán trên dòng LOT / dòng phiếu -> thắng tuyệt đối, trả về đúng một danh mục;
 * (2) products.category_id; (3) product_category_rel có is_primary; (4) phần tử rel đầu tiên.
 *
 * Mọi màn hình đọc danh mục (tồn kho, kho theo lot, bản đồ kho, trạng thái kho, báo cáo in)
 * phải đi qua file này — mỗi nơi tự suy là nguyên nhân gây lệch số liệu giữa các báo cáo.
 */

export interface CategoryRel {
    category_id?: string | null
    is_primary?: boolean | null
    categories?: { id?: string | null; name?: string | null } | null
}

export interface CategoryBearing {
    category_id?: string | null
    categories?: { id?: string | null; name?: string | null } | null
    product_category_rel?: CategoryRel[] | CategoryRel | null
}

export interface ResolvedCategories {
    ids: string[]
    names: string[]
    primaryId: string | null
    primaryName: string | null
}

const EMPTY: ResolvedCategories = { ids: [], names: [], primaryId: null, primaryName: null }

const relId = (rel: CategoryRel) => rel.category_id || rel.categories?.id || null
const isPrimaryRel = (rel: CategoryRel) => rel.is_primary === true || (rel.is_primary as unknown) === 'true'

function nameOf(id: string | null, product?: CategoryBearing | null, nameMap?: Record<string, string>): string | null {
    if (!id) return null
    if (nameMap?.[id]) return nameMap[id]
    if (product?.categories?.id === id && product.categories.name) return product.categories.name
    const rel = relsOf(product).find(r => relId(r) === id)
    return rel?.categories?.name || null
}

function relsOf(product?: CategoryBearing | null): CategoryRel[] {
    const rel = product?.product_category_rel
    if (!rel) return []
    return (Array.isArray(rel) ? rel : [rel]).filter(Boolean)
}

export function resolveCategories(
    product?: CategoryBearing | null,
    lineCategoryId?: string | null,
    nameMap?: Record<string, string>
): ResolvedCategories {
    if (lineCategoryId) {
        const name = nameOf(lineCategoryId, product, nameMap)
        return { ids: [lineCategoryId], names: name ? [name] : [], primaryId: lineCategoryId, primaryName: name }
    }

    if (!product) return EMPTY

    const ids: string[] = []
    const names: string[] = []
    const push = (id: string | null) => {
        if (!id || ids.includes(id)) return
        ids.push(id)
        const name = nameOf(id, product, nameMap)
        if (name && !names.includes(name)) names.push(name)
    }

    push(product.category_id || product.categories?.id || null)
    const rels = relsOf(product)
    rels.filter(isPrimaryRel).forEach(rel => push(relId(rel)))
    rels.filter(rel => !isPrimaryRel(rel)).forEach(rel => push(relId(rel)))

    if (ids.length === 0) return EMPTY

    return { ids, names, primaryId: ids[0], primaryName: nameOf(ids[0], product, nameMap) }
}

/**
 * Tương thích ngược cho giao diện bản đồ kho / in bản đồ kho.
 */
export function extractProductCategories(prod: any, lineCategoryId?: string | null) {
    const r = resolveCategories(prod, lineCategoryId)
    return {
        categoryNames: r.names,
        categoryIds: r.ids,
        primary_category_id: r.primaryId,
        primary_category_name: r.primaryName
    }
}
