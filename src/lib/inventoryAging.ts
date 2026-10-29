/**
 * Logic tính "tuổi tồn kho" (aging) cho báo cáo hàng tồn lâu ngày.
 *
 * Số ngày luôn tính lùi từ MỐC NGÀY CỦA BÁO CÁO (as-of date) về ngày đã chọn
 * trên LOT, nên cùng một dữ liệu có thể được xem ở nhiều thời điểm khác nhau.
 */

import { resolveCategories } from './productCategory'

export type AgingDateType = 'inbound_date' | 'production_date' | 'raw_material_date' | 'packaging_date'

export interface AgingDateOption {
    id: AgingDateType
    label: string
    shortLabel: string
    icon: string
    /** Module LOT điều khiển trường ngày này. null = trường cốt lõi, luôn khả dụng ở mọi phân hệ. */
    lotModuleId: string | null
}

export const AGING_DATE_OPTIONS: AgingDateOption[] = [
    { id: 'inbound_date', label: 'Ngày nhập kho', shortLabel: 'Nhập kho', icon: '📥', lotModuleId: null },
    { id: 'production_date', label: 'Ngày sản xuất', shortLabel: 'Sản xuất', icon: '🔪', lotModuleId: 'peeling_date' },
    { id: 'raw_material_date', label: 'Ngày nhập nguyên liệu', shortLabel: 'Nguyên liệu', icon: '🚛', lotModuleId: 'raw_material_date' },
    { id: 'packaging_date', label: 'Ngày đóng gói', shortLabel: 'Đóng gói', icon: '📦', lotModuleId: 'packaging_date' }
]

export const DEFAULT_AGING_THRESHOLDS = [30, 60, 90, 180]

export interface AgingBucket {
    index: number
    label: string
    shortLabel: string
    /** Số ngày nhỏ nhất thuộc nhóm (inclusive) */
    minDays: number
    /** Số ngày lớn nhất thuộc nhóm (inclusive); null = không chặn trên */
    maxDays: number | null
}

/** Ngưỡng cắt phải tăng dần, không trùng nhau và luôn dương. */
export function sanitizeThresholds(raw: number[]): number[] {
    return Array.from(new Set(raw.filter(n => Number.isFinite(n) && n > 0)))
        .sort((a, b) => a - b)
}

export function buildBuckets(thresholds: number[]): AgingBucket[] {
    const sorted = sanitizeThresholds(thresholds)
    if (sorted.length === 0) return []

    const buckets: AgingBucket[] = []
    let lower = 0
    sorted.forEach((upper, i) => {
        const minDays = i === 0 ? 0 : lower
        buckets.push({
            index: i,
            label: i === 0 ? `Từ 0 đến ${upper} ngày` : `Từ ${minDays} đến ${upper} ngày`,
            shortLabel: i === 0 ? `0-${upper}` : `${minDays}-${upper}`,
            minDays,
            maxDays: upper
        })
        lower = upper + 1
    })

    const last = sorted[sorted.length - 1]
    buckets.push({
        index: buckets.length,
        label: `Trên ${last} ngày`,
        shortLabel: `>${last}`,
        minDays: last + 1,
        maxDays: null
    })
    return buckets
}

/** Nhóm tuổi của một LOT; null = chưa xác định được ngày. */
export function assignBucketIndex(days: number | null, buckets: AgingBucket[]): number | null {
    if (days === null) return null
    const safeDays = Math.max(0, days)
    const hit = buckets.find(b => safeDays >= b.minDays && (b.maxDays === null || safeDays <= b.maxDays))
    if (hit) return hit.index
    return buckets.length > 0 ? buckets[buckets.length - 1].index : null
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/
const DMY_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

/**
 * Chuẩn hoá về yyyy-MM-dd.
 * Cột timestamp của dự án được ghi ở nửa đêm UTC (vd `2026-10-29 00:00:00+00`),
 * nên cắt 10 ký tự đầu cho đúng ngày mà quản lý LOT đã nhập — không convert múi giờ.
 */
export function normalizeAgingDate(raw?: string | number | null): string | null {
    if (raw === null || raw === undefined) return null
    const str = String(raw).trim()
    if (!str) return null

    const iso = str.match(ISO_DATE_RE)
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

    const dmy = str.match(DMY_DATE_RE)
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`

    const parsed = new Date(str)
    if (!isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
    }
    return null
}

function toUTCDay(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number)
    return Date.UTC(y, (m || 1) - 1, d || 1)
}

/** Số ngày giữa hai mốc yyyy-MM-dd (as-of trừ ngày của LOT); âm nếu LOT mang ngày tương lai. */
export function diffDays(fromDate: string | null, asOfDate: string): number | null {
    if (!fromDate) return null
    const from = toUTCDay(fromDate)
    const asOf = toUTCDay(asOfDate)
    if (isNaN(from) || isNaN(asOf)) return null
    return Math.round((asOf - from) / 86_400_000)
}

export interface AgingProductSource {
    id?: string | null
    sku?: string | null
    name?: string | null
    unit?: string | null
    category_id?: string | null
    product_category_rel?: { category_id: string }[] | null
}

export interface AgingLotItemSource {
    id: string
    product_id?: string | null
    quantity?: number | null
    unit?: string | null
    category_id?: string | null
    products?: AgingProductSource | null
}

export interface AgingLotSource {
    id: string
    code: string
    production_code?: string | null
    batch_code?: string | null
    warehouse_name?: string | null
    is_locked?: boolean | null
    quantity?: number | null
    inbound_date?: string | null
    peeling_date?: string | null
    raw_material_date?: string | null
    packaging_date?: string | null
    /** Ngày sản xuất suy từ production_lots qua lots.production_lot_id */
    production_lot_date?: string | null
    metadata?: { peeling_dates?: string[] } | null
    products?: AgingProductSource | null
    lot_items?: AgingLotItemSource[]
    positions?: { code?: string | null }[]
}

/**
 * Lấy ngày của LOT theo loại ngày được chọn.
 * "Ngày sản xuất" ưu tiên cột peeling_date, rồi tới metadata.peeling_dates (sớm nhất),
 * cuối cùng là production_date của lệnh sản xuất — khớp cách trang Sơ đồ kho vẫn đọc.
 */
export function resolveLotDate(lot: AgingLotSource, type: AgingDateType): string | null {
    if (type === 'inbound_date') return normalizeAgingDate(lot.inbound_date)
    if (type === 'raw_material_date') return normalizeAgingDate(lot.raw_material_date)
    if (type === 'packaging_date') return normalizeAgingDate(lot.packaging_date)

    const peeling = normalizeAgingDate(lot.peeling_date)
    if (peeling) return peeling

    const metaDates = Array.isArray(lot.metadata?.peeling_dates)
        ? (lot.metadata!.peeling_dates.map(d => normalizeAgingDate(d)).filter(Boolean) as string[])
        : []
    if (metaDates.length > 0) return metaDates.sort()[0]

    return normalizeAgingDate(lot.production_lot_date)
}

export interface AgingLine {
    lotId: string
    lotCode: string
    productionCode: string | null
    warehouseName: string | null
    isLocked: boolean
    positionCodes: string[]
    productId: string | null
    sku: string
    name: string
    unit: string
    quantity: number
    kg: number
    categoryIds: string[]
    categoryName: string
    dateValue: string | null
    days: number | null
    bucketIndex: number | null
}

export interface BuildAgingLinesOptions {
    dateType: AgingDateType
    asOfDate: string
    buckets: AgingBucket[]
    categoryMap: Record<string, string>
    /** hàm quy đổi ra Kg của đơn vị sản phẩm; trả 0/không số nếu không quy đổi được */
    kgOf?: (args: { productId: string | null; unit: string; qty: number; baseUnit: string | null }) => number
}

export function buildAgingLines(lots: AgingLotSource[], opts: BuildAgingLinesOptions): AgingLine[] {
    const { dateType, asOfDate, buckets, categoryMap, kgOf } = opts
    const lines: AgingLine[] = []

    lots.forEach(lot => {
        const dateValue = resolveLotDate(lot, dateType)
        const days = diffDays(dateValue, asOfDate)
        const bucketIndex = assignBucketIndex(days, buckets)
        const positionCodes = (lot.positions || [])
            .map(p => p?.code)
            .filter((c): c is string => Boolean(c))

        const pushLine = (product: AgingProductSource | null, qty: number, unit: string | null, lineCategoryId: string | null) => {
            if (!product && !lot.products) return
            const p = product || lot.products || {}
            if (qty <= 0) return

            const resolvedUnit = unit || p.unit || ''
            const cats = resolveCategories(
                { category_id: p.category_id ?? null, product_category_rel: p.product_category_rel ?? null },
                lineCategoryId,
                categoryMap
            )

            lines.push({
                lotId: lot.id,
                lotCode: lot.code,
                productionCode: lot.production_code || lot.batch_code || null,
                warehouseName: lot.warehouse_name || null,
                isLocked: lot.is_locked === true,
                positionCodes,
                productId: p.id || null,
                sku: p.sku || '---',
                name: p.name || '(Chưa đặt tên)',
                unit: resolvedUnit,
                quantity: qty,
                kg: kgOf ? kgOf({ productId: p.id || null, unit: resolvedUnit, qty, baseUnit: p.unit || null }) : 0,
                categoryIds: cats.ids,
                categoryName: cats.primaryName || 'Chưa phân loại',
                dateValue,
                days,
                bucketIndex
            })
        }

        if (Array.isArray(lot.lot_items) && lot.lot_items.length > 0) {
            lot.lot_items.forEach(item => {
                pushLine(
                    item.products || null,
                    Number(item.quantity) || 0,
                    item.unit || item.products?.unit || null,
                    item.category_id ?? null
                )
            })
        } else {
            pushLine(lot.products || null, Number(lot.quantity) || 0, lot.products?.unit || null, null)
        }
    })

    return lines
}

export interface AgingLotItemLabel {
    name: string
    sku: string
    quantity: number
    unit: string
}

export interface AgingLotRow {
    lotId: string
    lotCode: string
    productionCode: string | null
    warehouseName: string | null
    isLocked: boolean
    positionCodes: string[]
    items: AgingLotItemLabel[]
    quantity: number
    kg: number
    unitSet: string[]
    categoryIds: string[]
    categoryName: string
    dateValue: string | null
    days: number | null
    bucketIndex: number | null
    lineCount: number
}

/** Một dòng = một LOT/pallet (mỗi mã LOT xuất hiện duy nhất một lần). */
export function summarizeByLot(lines: AgingLine[]): AgingLotRow[] {
    const map = new Map<string, AgingLotRow>()

    lines.forEach(l => {
        const existing = map.get(l.lotId)
        if (!existing) {
            map.set(l.lotId, {
                lotId: l.lotId,
                lotCode: l.lotCode,
                productionCode: l.productionCode,
                warehouseName: l.warehouseName,
                isLocked: l.isLocked,
                positionCodes: l.positionCodes,
                items: [{ name: l.name, sku: l.sku, quantity: l.quantity, unit: l.unit }],
                quantity: l.quantity,
                kg: l.kg,
                unitSet: [l.unit],
                categoryIds: [...l.categoryIds],
                categoryName: l.categoryName,
                dateValue: l.dateValue,
                days: l.days,
                bucketIndex: l.bucketIndex,
                lineCount: 1
            })
            return
        }
        existing.items.push({ name: l.name, sku: l.sku, quantity: l.quantity, unit: l.unit })
        existing.quantity += l.quantity
        existing.kg += l.kg
        if (l.unit && !existing.unitSet.includes(l.unit)) existing.unitSet.push(l.unit)
        l.categoryIds.forEach(cid => {
            if (!existing.categoryIds.includes(cid)) existing.categoryIds.push(cid)
        })
        existing.lineCount += 1
    })

    return Array.from(map.values()).sort((a, b) => (b.days ?? -1) - (a.days ?? -1))
}

export interface AgingProductRow {
    key: string
    sku: string
    name: string
    unit: string
    categoryIds: string[]
    categoryName: string
    quantity: number
    kg: number
    lotCount: number
    lotCodes: string[]
    oldestDate: string | null
    maxDays: number | null
    /** Số lượng tồn đang nằm ở từng nhóm tuổi */
    qtyByBucket: number[]
    /** Số LOT đang nằm ở từng nhóm tuổi */
    lotCountByBucket: number[]
}

/**
 * Một dòng = một sản phẩm (theo SKU + ĐVT).
 * Những dòng chưa xác định được ngày (bucketIndex = null) không được cộng vào ma trận nhóm tuổi.
 */
export function summarizeByProduct(lines: AgingLine[], bucketCount: number): AgingProductRow[] {
    const map = new Map<string, AgingProductRow>()
    const lotsByBucket = new Map<string, Set<string>[]>()

    lines.forEach(l => {
        const key = `${l.sku}__${l.unit}`
        let row = map.get(key)
        if (!row) {
            row = {
                key,
                sku: l.sku,
                name: l.name,
                unit: l.unit,
                categoryIds: [...l.categoryIds],
                categoryName: l.categoryName,
                quantity: 0,
                kg: 0,
                lotCount: 0,
                lotCodes: [],
                oldestDate: null,
                maxDays: null,
                qtyByBucket: new Array(bucketCount).fill(0),
                lotCountByBucket: new Array(bucketCount).fill(0)
            }
            map.set(key, row)
            lotsByBucket.set(key, new Array(bucketCount).fill(null).map(() => new Set<string>()))
        }

        const acc = row
        acc.quantity += l.quantity
        acc.kg += l.kg
        if (!acc.lotCodes.includes(l.lotId)) {
            acc.lotCodes.push(l.lotId)
            acc.lotCount += 1
        }
        l.categoryIds.forEach(cid => {
            if (!acc.categoryIds.includes(cid)) acc.categoryIds.push(cid)
        })

        if (l.days === null) return
        if (acc.maxDays === null || l.days > acc.maxDays) {
            acc.maxDays = l.days
            acc.oldestDate = l.dateValue
        }
        if (l.bucketIndex !== null && l.bucketIndex < bucketCount) {
            acc.qtyByBucket[l.bucketIndex] += l.quantity
            lotsByBucket.get(key)![l.bucketIndex].add(l.lotId)
        }
    })

    const rows = Array.from(map.values())
    rows.forEach(r => {
        r.lotCountByBucket = (lotsByBucket.get(r.key) || []).map(s => s.size)
    })

    return rows.sort((a, b) => (b.maxDays ?? -1) - (a.maxDays ?? -1))
}

export interface AgingStats {
    lotCount: number
    quantity: number
    kg: number
    undatedLotCount: number
    /** Số LOT và số lượng vượt từng ngưỡng (tính dồn từ trên xuống) */
    overThresholds: { threshold: number; lotCount: number; quantity: number; kg: number }[]
    bucketTotals: { index: number; lotCount: number; quantity: number; kg: number }[]
}

export function computeStats(lotRows: AgingLotRow[], buckets: AgingBucket[]): AgingStats {
    const thresholds = buckets.filter(b => b.maxDays !== null).map(b => b.maxDays as number)

    return {
        lotCount: lotRows.length,
        quantity: lotRows.reduce((s, r) => s + r.quantity, 0),
        kg: lotRows.reduce((s, r) => s + r.kg, 0),
        undatedLotCount: lotRows.filter(r => r.bucketIndex === null).length,
        overThresholds: thresholds.map(t => {
            const hit = lotRows.filter(r => (r.days ?? 0) > t)
            return {
                threshold: t,
                lotCount: hit.length,
                quantity: hit.reduce((s, r) => s + r.quantity, 0),
                kg: hit.reduce((s, r) => s + r.kg, 0)
            }
        }),
        bucketTotals: buckets.map(b => {
            const hit = lotRows.filter(r => r.bucketIndex === b.index)
            return {
                index: b.index,
                lotCount: hit.length,
                quantity: hit.reduce((s, r) => s + r.quantity, 0),
                kg: hit.reduce((s, r) => s + r.kg, 0)
            }
        })
    }
}
