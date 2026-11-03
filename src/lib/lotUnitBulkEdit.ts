import { canonicalizeUnit, formatUnitWeight, normalizeUnit } from './unitConversion'

export interface UnitEditProductRef {
    id: string
    sku?: string | null
    name?: string | null
    unit?: string | null
    weight_kg?: number | null
}

export interface UnitEditLotItemRow {
    id: string
    lot_id: string
    product_id: string
    quantity: number | null
    unit: string | null
    lot_code?: string | null
}

export interface UnitEditUnitRef {
    id: string
    name: string
}

export interface UnitEditProductUnitRef {
    product_id: string
    unit_id: string
    conversion_rate: number | null
}

export interface UnitGroupDraft {
    key: string
    letter: string
    productId: string
    sku: string
    productName: string
    /** Chuỗi đơn vị đang lưu trong lot_items (lần gặp đầu tiên), rỗng nếu đang trống */
    currentUnit: string
    itemIds: string[]
    quantity: number
    lotCodes: string[]
    options: string[]
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function letterOf(index: number): string {
    if (index < LETTERS.length) return LETTERS[index]
    return `${LETTERS[Math.floor(index / LETTERS.length) - 1]}${LETTERS[index % LETTERS.length]}`
}

export const isSameUnit = (a: string | null | undefined, b: string | null | undefined): boolean =>
    canonicalizeUnit(a) === canonicalizeUnit(b)

function dedupeUnits(names: string[]): string[] {
    const seen = new Map<string, string>()
    names.forEach(name => {
        const key = canonicalizeUnit(name)
        if (key && !seen.has(key)) seen.set(key, name)
    })
    return Array.from(seen.values())
}

/**
 * Đơn vị gợi ý cho một sản phẩm: đơn vị gốc (kèm khối lượng) + các đơn vị quy đổi
 * trong product_units, cộng thêm đơn vị hiện đang lưu để không bao giờ mất lựa chọn gốc.
 */
export function buildUnitOptions(
    product: UnitEditProductRef | undefined,
    productUnits: UnitEditProductUnitRef[],
    units: UnitEditUnitRef[],
    currentUnit: string
): string[] {
    const collected: string[] = []
    const baseUnit = (product?.unit || '').trim()
    let baseWeight = Number(product?.weight_kg || 0)
    const normBase = normalizeUnit(baseUnit)
    if (baseWeight <= 0 && (normBase === 'kg' || normBase === 'kilogram')) baseWeight = 1

    if (baseUnit) collected.push(formatUnitWeight(baseUnit, baseWeight))

    productUnits
        .filter(pu => pu.product_id === product?.id)
        .forEach(pu => {
            const unit = units.find(u => u.id === pu.unit_id)
            if (!unit?.name) return
            if (normalizeUnit(unit.name) === normBase) return
            collected.push(formatUnitWeight(unit.name, (pu.conversion_rate || 1) * baseWeight))
        })

    if (currentUnit) collected.push(currentUnit)

    return dedupeUnits(collected)
}

/**
 * Gom các dòng lot_items thành từng nhóm "sản phẩm + đơn vị hiện tại" và gán nhãn A, B, C…
 * Hai chuỗi đơn vị chỉ khác hoa/thường/khoảng trắng được coi là cùng một nhóm.
 */
export function groupLotItemsForUnitChange(
    rows: UnitEditLotItemRow[],
    products: UnitEditProductRef[],
    productUnits: UnitEditProductUnitRef[],
    units: UnitEditUnitRef[]
): UnitGroupDraft[] {
    const productMap = new Map<string, UnitEditProductRef>(products.map(p => [p.id, p]))
    const draft: Record<string, UnitGroupDraft> = {}

    rows.forEach(row => {
        const product = productMap.get(row.product_id)
        const currentUnit = (row.unit || product?.unit || '').trim()
        const key = `${row.product_id}|${canonicalizeUnit(currentUnit)}`

        if (!draft[key]) {
            draft[key] = {
                key,
                letter: '',
                productId: row.product_id,
                sku: product?.sku || '',
                productName: product?.name || '(sản phẩm không tồn tại)',
                currentUnit,
                itemIds: [],
                quantity: 0,
                lotCodes: [],
                options: [],
            }
        }

        const group = draft[key]
        group.itemIds.push(row.id)
        group.quantity = Number((group.quantity + (row.quantity || 0)).toFixed(3))
        if (row.lot_code && !group.lotCodes.includes(row.lot_code)) group.lotCodes.push(row.lot_code)
    })

    const sorted = Object.values(draft).sort((a, b) =>
        `${a.productName}|${a.currentUnit}`.localeCompare(`${b.productName}|${b.currentUnit}`, 'vi')
    )
    sorted.forEach((group, index) => {
        group.letter = letterOf(index)
        group.options = buildUnitOptions(productMap.get(group.productId), productUnits, units, group.currentUnit)
    })

    return sorted
}

/** Danh sách đơn vị gộp của mọi nhóm, dùng cho ô "Áp dụng nhanh" */
export function collectAllUnitOptions(groups: UnitGroupDraft[]): string[] {
    const merged = new Map<string, string>()
    groups.forEach(g => g.options.forEach(o => {
        const key = canonicalizeUnit(o)
        if (key && !merged.has(key)) merged.set(key, o)
    }))
    return Array.from(merged.values()).sort((a, b) => a.localeCompare(b, 'vi'))
}
