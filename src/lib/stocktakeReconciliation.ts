import { ParsedStocktake, StocktakeRow, StocktakeFormat, FORMAT_LABEL, foldText } from './stocktakeSnapshotParser'

/**
 * So sánh 2 mốc sơ đồ kho (trước kiểm kê ↔ sau kiểm kê) đã đọc bằng
 * src/lib/stocktakeSnapshotParser.ts và liệt kê chỗ lệch số lượng.
 */

export const QTY_EPSILON = 0.001

export type DiffKind = 'changed' | 'only_before' | 'only_after' | 'same'

export interface StocktakeDiffRow {
    key: string
    warehouse: string
    rowName: string
    binName: string
    levelName: string
    positionCode: string
    lotCode: string
    sku: string
    productName: string
    unit: string
    beforeQty: number
    afterQty: number
    diff: number
    kind: DiffKind
    /** Chỉ file LOT: cột "Quy đổi (Kg)" của sheet Tổng hợp tại 2 mốc. */
    beforeKg: number
    afterKg: number
    beforePallets: number | null
    afterPallets: number | null
    /** Chỉ dùng cho file tồn theo LOT: các khối "DANH MỤC:" chứa sản phẩm này. */
    category: string
    /** Dòng trên file gốc sinh ra mục này — giữ nguyên thứ tự dòng khi liệt kê biên bản. */
    srcRow: number
}

export interface UnitTotal {
    unit: string
    beforeQty: number
    afterQty: number
    diff: number
}

export interface StocktakeReconciliation {
    format: StocktakeFormat
    before: ParsedStocktake
    after: ParsedStocktake
    allRows: StocktakeDiffRow[]
    diffRows: StocktakeDiffRow[]
    changedCount: number
    onlyBeforeCount: number
    onlyAfterCount: number
    sameCount: number
    positionCount: number
    byUnit: UnitTotal[]
    warnings: string[]
}

interface SideAggregate {
    row: StocktakeRow
    quantity: number
    /** Chỉ file LOT: cột "Quy đổi (Kg)" trên sheet Tổng hợp. */
    kg: number
    pallets: number | null
    /** Chỉ file LOT: các khối "DANH MỤC:" mà sản phẩm này xuất hiện bên trong. */
    categories: Set<string>
}

function round3(value: number): number {
    return Math.round(value * 1000) / 1000
}

/**
 * Khoá so khớp.
 * - File tồn theo LOT: chỉ sản phẩm × ĐVT (báo cáo gộp mọi LOT nên không còn toạ độ hay mã lot).
 * - Sơ đồ kho: toạ độ + (mã vị trí, mã lot nếu có) + sản phẩm + đơn vị.
 */
export function buildRowKey(row: StocktakeRow, format: StocktakeFormat): string {
    if (format === 'lot') {
        return [row.sku || row.productName, row.productName, row.unit]
            .map(part => foldText(part))
            .join('|')
    }
    const productKey = format === 'table' ? (row.sku || row.productName) : row.productName
    return [
        row.warehouse,
        row.rowName,
        row.binName,
        row.levelName,
        row.positionCode,
        row.lotCode,
        productKey,
        row.unit,
    ].map(part => foldText(part)).join('|')
}

function aggregateSide(snapshot: ParsedStocktake): Map<string, SideAggregate> {
    const map = new Map<string, SideAggregate>()
    snapshot.rows.forEach(row => {
        const key = buildRowKey(row, snapshot.format)
        const existing = map.get(key)
        if (existing) {
            existing.quantity += row.quantity
            existing.kg += row.kg ?? 0
            if (row.pallets !== null) {
                existing.pallets = (existing.pallets ?? 0) + row.pallets
            }
            if (row.category) existing.categories.add(row.category)
        } else {
            map.set(key, {
                row,
                quantity: row.quantity,
                kg: row.kg ?? 0,
                pallets: row.pallets,
                categories: new Set<string>(row.category ? [row.category] : []),
            })
        }
    })
    return map
}

/** Tên khối DANH MỤC chung của 2 mốc, dùng làm cột "Danh mục" trong sheet chi tiết. */
function mergeCategories(before: SideAggregate | undefined, after: SideAggregate | undefined): string {
    const set = new Set<string>()
    before?.categories.forEach(item => set.add(item))
    after?.categories.forEach(item => set.add(item))
    return Array.from(set).sort(naturalCompare).join(' | ')
}

function naturalCompare(a: string, b: string): number {
    return (a || '').localeCompare(b || '', undefined, { numeric: true, sensitivity: 'base' })
}

function sortDiffRows(rows: StocktakeDiffRow[], format: StocktakeFormat): StocktakeDiffRow[] {
    return rows.sort((a, b) => {
        const byCategory = naturalCompare(a.category, b.category)
        if (byCategory !== 0) return byCategory
        const byPositionCode = naturalCompare(a.positionCode, b.positionCode)
        if (byPositionCode !== 0) return byPositionCode
        const byWarehouse = naturalCompare(a.warehouse, b.warehouse)
        if (byWarehouse !== 0) return byWarehouse
        const byRow = naturalCompare(a.rowName, b.rowName)
        if (byRow !== 0) return byRow
        const byBin = naturalCompare(a.binName, b.binName)
        if (byBin !== 0) return byBin
        const byLevel = naturalCompare(a.levelName, b.levelName)
        if (byLevel !== 0) return byLevel
        const byLot = naturalCompare(a.lotCode, b.lotCode)
        if (byLot !== 0) return byLot
        // File LOT không còn toạ độ: giữ đúng thứ dòng trong sheet Tổng hợp để đối chiếu với giấy đếm
        if (format === 'lot') return a.srcRow - b.srcRow
        return naturalCompare(a.productName || a.sku, b.productName || b.sku)
    })
}

function labelOverlapRatio(before: ParsedStocktake, after: ParsedStocktake, format: StocktakeFormat): number {
    const labelOf = (row: StocktakeRow) => foldText(format === 'grid' ? row.productName : (row.sku || row.productName))
    const beforeLabels = new Set(before.rows.map(labelOf).filter(Boolean))
    const afterLabels = new Set(after.rows.map(labelOf).filter(Boolean))
    if (beforeLabels.size === 0 || afterLabels.size === 0) return 1
    let shared = 0
    beforeLabels.forEach(label => {
        if (afterLabels.has(label)) shared++
    })
    return shared / Math.min(beforeLabels.size, afterLabels.size)
}

export function reconcileStocktake(before: ParsedStocktake, after: ParsedStocktake): StocktakeReconciliation {
    const warnings: string[] = []

    if (before.format !== after.format) {
        throw new Error(
            `Hai file khác định dạng (${FORMAT_LABEL[before.format]} vs ${FORMAT_LABEL[after.format]}). ` +
            `Mỗi lượt đối chiếu cần 2 file cùng định dạng.`
        )
    }

    const format = before.format
    const systemBefore = foldText(before.systemName)
    const systemAfter = foldText(after.systemName)
    if (systemBefore && systemAfter && systemBefore !== systemAfter) {
        warnings.push(`Hai file thuộc 2 phân hệ khác nhau ("${before.systemName}" và "${after.systemName}") — kết quả đối chiếu có thể không có ý nghĩa.`)
    }
    if (before.zoneName && after.zoneName && foldText(before.zoneName) !== foldText(after.zoneName)) {
        warnings.push(`Hai file được lọc theo 2 phạm vi khác nhau ("${before.zoneName}" và "${after.zoneName}").`)
    }

    const beforeMap = aggregateSide(before)
    const afterMap = aggregateSide(after)
    const keys = new Set<string>([...beforeMap.keys(), ...afterMap.keys()])

    const allRows: StocktakeDiffRow[] = []
    keys.forEach(key => {
        const beforeSide = beforeMap.get(key)
        const afterSide = afterMap.get(key)
        const source = beforeSide?.row ?? afterSide!.row
        const beforeQty = round3(beforeSide?.quantity ?? 0)
        const afterQty = round3(afterSide?.quantity ?? 0)
        const diff = round3(afterQty - beforeQty)
        const beforeKg = round3(beforeSide?.kg ?? 0)
        const afterKg = round3(afterSide?.kg ?? 0)

        let kind: DiffKind
        if (!beforeSide) kind = 'only_after'
        else if (!afterSide) kind = 'only_before'
        else kind = Math.abs(diff) < QTY_EPSILON ? 'same' : 'changed'

        allRows.push({
            key,
            warehouse: source.warehouse,
            rowName: source.rowName,
            binName: source.binName,
            levelName: source.levelName,
            positionCode: source.positionCode,
            lotCode: source.lotCode,
            sku: source.sku,
            productName: source.productName,
            unit: source.unit,
            beforeQty,
            afterQty,
            diff,
            kind,
            beforeKg,
            afterKg,
            beforePallets: beforeSide?.pallets ?? null,
            afterPallets: afterSide?.pallets ?? null,
            category: mergeCategories(beforeSide, afterSide),
            srcRow: source.srcRow,
        })
    })

    sortDiffRows(allRows, format)
    const diffRows = allRows.filter(row => row.kind !== 'same' && Math.abs(row.diff) >= QTY_EPSILON)

    // Tổng hợp theo từng đơn vị — tuyệt đối không cộng xuyên đơn vị
    const unitMap = new Map<string, UnitTotal>()
    allRows.forEach(row => {
        const unit = row.unit || '(không rõ ĐVT)'
        const existing = unitMap.get(unit)
        if (existing) {
            existing.beforeQty += row.beforeQty
            existing.afterQty += row.afterQty
        } else {
            unitMap.set(unit, { unit, beforeQty: row.beforeQty, afterQty: row.afterQty, diff: 0 })
        }
    })
    const byUnit = Array.from(unitMap.values())
        .map(item => ({ ...item, beforeQty: round3(item.beforeQty), afterQty: round3(item.afterQty), diff: round3(item.afterQty - item.beforeQty) }))
        .sort((a, b) => naturalCompare(a.unit, b.unit))

    const positionKeys = new Set(diffRows.map(row => [
        foldText(row.warehouse), foldText(row.rowName), foldText(row.binName),
        foldText(row.levelName), foldText(row.positionCode),
    ].join('|')))
    const productKeys = new Set(diffRows.map(row => row.key))

    const changedCount = diffRows.filter(row => row.kind === 'changed').length
    const onlyBeforeCount = diffRows.filter(row => row.kind === 'only_before').length
    const onlyAfterCount = diffRows.filter(row => row.kind === 'only_after').length
    const sameCount = allRows.length - diffRows.length

    if (format === 'table' && before.declaredTotal !== null) {
        const gap = Math.abs(round3(before.declaredTotal - before.parsedTotal))
        if (gap >= QTY_EPSILON) warnings.push(`File Bảng "trước" có dòng tổng ghi ${round3(before.declaredTotal)} nhưng đọc được ${round3(before.parsedTotal)} (lệch ${gap}).`)
    }
    if (format === 'table' && after.declaredTotal !== null) {
        const gap = Math.abs(round3(after.declaredTotal - after.parsedTotal))
        if (gap >= QTY_EPSILON) warnings.push(`File Bảng "sau" có dòng tổng ghi ${round3(after.declaredTotal)} nhưng đọc được ${round3(after.parsedTotal)} (lệch ${gap}).`)
    }

    const overlap = labelOverlapRatio(before, after, format)
    if (overlap < 0.2) {
        warnings.push(
            format === 'grid'
                ? 'Rất ít tên hàng khớp nhau giữa 2 file lưới. File Lưới hiển thị tên hàng (hoặc Mã nội bộ) — nếu 2 lần xuất chọn cấu hình "Mã nội bộ" khác nhau thì không đối chiếu được.'
                : 'Rất ít mã hàng khớp nhau giữa 2 file. Kiểm tra 2 file có cùng bộ lọc/khu vực khi xuất hay không.'
        )
    }

    if (format === 'grid') {
        warnings.push('File dạng Lưới không chứa Mã vị trí và Số lô, nên sai lệch chỉ truy vết tới cấp Dãy / Ô / Tầng và theo tên hàng — không định danh được pallet nào.')
    }

    if (format === 'lot') {
        warnings.push('Báo cáo tồn theo LOT gộp toàn bộ mọi LOT của một sản phẩm trong kho, nên sai lệch chỉ truy vết tới cấp Sản phẩm × ĐVT — không chỉ được pallet hay vị trí nào lệch.')
        warnings.push('Số liệu đọc từ sheet "Tổng hợp": mỗi sản phẩm một dòng, không thấy được tháng nhập / LSX / mã phụ nào lệch. Muốn soi chi tiết đó thì dùng lượt đối chiếu dạng Bảng.')
    }

    return {
        format,
        before,
        after,
        allRows,
        diffRows,
        changedCount,
        onlyBeforeCount,
        onlyAfterCount,
        sameCount,
        positionCount: format === 'lot' ? productKeys.size : positionKeys.size,
        byUnit,
        warnings: [...warnings, ...before.warnings.map(w => `File trước: ${w}`), ...after.warnings.map(w => `File sau: ${w}`)],
    }
}

/** Nhãn vị trí dùng chung cho UI và file Excel báo cáo. */
export function describeLocation(row: StocktakeDiffRow): string {
    if (row.positionCode) return row.positionCode
    const parts = [row.warehouse, row.rowName, row.binName, row.levelName].filter(Boolean)
    return parts.length ? parts.join(' / ') : '(chưa rõ vị trí)'
}

export function describeProduct(row: StocktakeDiffRow): string {
    if (row.productName && row.sku && row.productName !== row.sku) return `${row.productName} (${row.sku})`
    return row.productName || row.sku || '(không rõ hàng)'
}

export function describeKind(kind: DiffKind): string {
    switch (kind) {
        case 'changed': return 'Lệch số lượng'
        case 'only_before': return 'Mất ở mốc sau'
        case 'only_after': return 'Phát sinh ở mốc sau'
        default: return 'Không đổi'
    }
}
