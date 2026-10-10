import { Product, OrderItem } from '@/components/inventory/types'
import { parseQuantity } from '@/lib/numberUtils'

export interface ParsedPasteRow {
    productQuery: string
    quantity?: number
    unit?: string
    note?: string
    price?: number
}

/**
 * Parses multi-line text (e.g. copied from Excel cells) into structured rows.
 * Supports:
 * - 1 column: [SKU or Name]
 * - 2 columns: [SKU, Qty] or [SKU, Name]
 * - 3 columns: [SKU, Qty, Note] or [SKU, Unit, Qty] or [SKU, Name, Qty]
 * - 4+ columns: [SKU, Name, Unit, Qty, ...]
 */
export function parseClipboardText(text: string): ParsedPasteRow[] {
    if (!text) return []

    // Split lines by newline
    const lines = text.split(/\r\n|\n|\r/).map(l => l.trim()).filter(l => l.length > 0)
    if (lines.length === 0) return []

    return lines.map(line => {
        // Tab-separated columns
        const cells = line.split('\t').map(c => c.trim())

        // 1 Column
        if (cells.length === 1) {
            return { productQuery: cells[0] }
        }

        // 2 Columns: check if cell 2 is a number
        if (cells.length === 2) {
            const isSecondNumeric = /^[0-9]+([.,][0-9]+)?$/.test(cells[1])
            const num = parseQuantity(cells[1])
            if (isSecondNumeric || (num > 0 && !isNaN(num))) {
                return {
                    productQuery: cells[0],
                    quantity: num
                }
            }
            return {
                productQuery: cells[0],
                note: cells[1]
            }
        }

        // 3 Columns
        if (cells.length === 3) {
            const isCol1Numeric = /^[0-9]+([.,][0-9]+)?$/.test(cells[1])
            const isCol2Numeric = /^[0-9]+([.,][0-9]+)?$/.test(cells[2])

            if (isCol2Numeric) {
                // [SKU, Unit/Name, Qty]
                return {
                    productQuery: cells[0],
                    unit: cells[1],
                    quantity: parseQuantity(cells[2])
                }
            } else if (isCol1Numeric) {
                // [SKU, Qty, Note]
                return {
                    productQuery: cells[0],
                    quantity: parseQuantity(cells[1]),
                    note: cells[2]
                }
            }
            return {
                productQuery: cells[0],
                note: `${cells[1]} - ${cells[2]}`
            }
        }

        // 4 or more columns: find the first numeric cell for quantity
        let qtyIdx = -1
        for (let i = 1; i < cells.length; i++) {
            if (/^[0-9]+([.,][0-9]+)?$/.test(cells[i]) && parseQuantity(cells[i]) > 0) {
                qtyIdx = i
                break
            }
        }

        if (qtyIdx !== -1) {
            const qty = parseQuantity(cells[qtyIdx])
            const productQuery = cells[0]
            const midText = cells.slice(1, qtyIdx).filter(Boolean).join(' ')
            const afterText = cells.slice(qtyIdx + 1).filter(Boolean).join(' ')
            return {
                productQuery,
                unit: midText || undefined,
                quantity: qty,
                note: afterText || undefined
            }
        }

        return {
            productQuery: cells[0],
            note: cells.slice(1).filter(Boolean).join(' ')
        }
    })
}

/**
 * Parses multi-line numbers for quantity pasting.
 */
export function parseClipboardQuantities(text: string): number[] {
    if (!text) return []
    const lines = text.split(/\r\n|\n|\r/).map(l => l.trim()).filter(l => l.length > 0)
    if (lines.length === 0) return []

    return lines.map(line => {
        const cells = line.split('\t').map(c => c.trim())
        for (const c of cells) {
            if (/^[0-9]+([.,][0-9]+)?$/.test(c)) {
                return parseQuantity(c)
            }
        }
        return parseQuantity(line)
    })
}

/**
 * Robust matching of a product query against the products catalog.
 */
export function findMatchingProduct(rawQuery: string, products: Product[]): Product | undefined {
    if (!rawQuery) return undefined
    const q = rawQuery.trim().toLowerCase()
    if (!q) return undefined

    // 1. Exact match on sku, internal_code, barcode, part_number
    let found = products.find(p =>
        (p.sku && p.sku.trim().toLowerCase() === q) ||
        (p.internal_code && p.internal_code.trim().toLowerCase() === q) ||
        (p.part_number && p.part_number.trim().toLowerCase() === q) ||
        ((p as any).barcode && (p as any).barcode.trim().toLowerCase() === q)
    )
    if (found) return found

    // 2. Exact match on name, internal_name
    found = products.find(p =>
        (p.name && p.name.trim().toLowerCase() === q) ||
        (p.internal_name && p.internal_name.trim().toLowerCase() === q)
    )
    if (found) return found

    // 3. Format "SKU - Name"
    if (rawQuery.includes(' - ')) {
        const parts = rawQuery.split(' - ').map(s => s.trim().toLowerCase())
        const skuPart = parts[0]
        const namePart = parts.slice(1).join(' - ')
        found = products.find(p =>
            (p.sku && p.sku.trim().toLowerCase() === skuPart) ||
            (p.internal_code && p.internal_code.trim().toLowerCase() === skuPart) ||
            (p.name && p.name.trim().toLowerCase() === namePart)
        )
        if (found) return found
    }

    // 4. Aliases
    found = products.find(p => {
        if (!p.aliases) return false
        const aliasList = p.aliases.split(',').map(a => a.trim().toLowerCase())
        return aliasList.includes(q)
    })
    if (found) return found

    // 5. Code match ignoring punctuation / spaces (e.g. CC30100066 -> CC301.00066)
    const qClean = q.replace(/[^a-z0-9]/g, '')
    if (qClean.length >= 3) {
        found = products.find(p => {
            const skuClean = (p.sku || '').toLowerCase().replace(/[^a-z0-9]/g, '')
            const internalClean = (p.internal_code || '').toLowerCase().replace(/[^a-z0-9]/g, '')
            return (skuClean && skuClean === qClean) || (internalClean && internalClean === qClean)
        })
        if (found) return found
    }

    // 6. Unique prefix match (if unambiguous)
    const prefixMatches = products.filter(p =>
        (p.sku && p.sku.trim().toLowerCase().startsWith(q)) ||
        (p.internal_code && p.internal_code.trim().toLowerCase().startsWith(q))
    )
    if (prefixMatches.length === 1) return prefixMatches[0]

    return undefined
}

export interface ApplyProductPasteParams {
    currentItems: OrderItem[]
    startIndex: number
    parsedRows: ParsedPasteRow[]
    products: Product[]
    checkUnbundleFn?: (productId: string, unit: string, qty: number) => { needsUnbundle: boolean, unbundleInfo?: string }
}

export interface ApplyProductPasteResult {
    newItems: OrderItem[]
    matchedCount: number
    unmatchedCodes: string[]
}

/**
 * Applies multi-row product paste starting from startIndex.
 * Updates current items or appends new rows.
 */
export function applyProductPaste({
    currentItems,
    startIndex,
    parsedRows,
    products,
    checkUnbundleFn
}: ApplyProductPasteParams): ApplyProductPasteResult {
    const updated = [...currentItems]
    let matchedCount = 0
    const unmatchedCodes: string[] = []

    parsedRows.forEach((row, offset) => {
        const targetIndex = startIndex + offset
        const matched = findMatchingProduct(row.productQuery, products)

        if (matched) {
            matchedCount++
        } else {
            unmatchedCodes.push(row.productQuery)
        }

        const initialUnit = matched?.unit || row.unit || ''
        const initialQty = row.quantity !== undefined && row.quantity > 0 ? row.quantity : 1
        const initialPrice = matched ? ((matched as any).sale_price || (matched as any).wholesale_price || (matched as any).price || 0) : 0
        const initialCategory = matched?.category_id || null
        const initialNote = row.note || ''

        let unbundleData: { needsUnbundle: boolean, unbundleInfo?: string } = { needsUnbundle: false }
        if (checkUnbundleFn && matched) {
            unbundleData = checkUnbundleFn(matched.id, initialUnit, initialQty)
        }

        if (targetIndex < updated.length) {
            // Update existing row
            const existing = updated[targetIndex]
            updated[targetIndex] = {
                ...existing,
                productId: matched?.id || existing.productId || '',
                productName: matched?.name || existing.productName || row.productQuery,
                unit: initialUnit || existing.unit,
                quantity: row.quantity !== undefined ? initialQty : (existing.quantity || 1),
                document_quantity: row.quantity !== undefined ? initialQty : (existing.document_quantity || existing.quantity || 1),
                price: initialPrice || existing.price || 0,
                categoryId: initialCategory || existing.categoryId,
                note: initialNote || existing.note || '',
                needsUnbundle: unbundleData.needsUnbundle,
                unbundleInfo: unbundleData.unbundleInfo
            }
        } else {
            // Add new row
            const newItem: OrderItem = {
                id: crypto.randomUUID(),
                productId: matched?.id || '',
                productName: matched?.name || row.productQuery,
                unit: initialUnit,
                quantity: initialQty,
                document_quantity: initialQty,
                price: initialPrice,
                categoryId: initialCategory,
                note: initialNote,
                needsUnbundle: unbundleData.needsUnbundle,
                unbundleInfo: unbundleData.unbundleInfo
            }
            updated.push(newItem)
        }
    })

    return {
        newItems: updated,
        matchedCount,
        unmatchedCodes
    }
}

export interface ApplyQuantityPasteParams {
    currentItems: OrderItem[]
    startIndex: number
    quantities: number[]
    products?: Product[]
    checkUnbundleFn?: (productId: string, unit: string, qty: number) => { needsUnbundle: boolean, unbundleInfo?: string }
}

/**
 * Applies multi-row quantity paste starting from startIndex.
 */
export function applyQuantityPaste({
    currentItems,
    startIndex,
    quantities,
    checkUnbundleFn
}: ApplyQuantityPasteParams): { newItems: OrderItem[], updatedCount: number } {
    const updated = [...currentItems]
    let updatedCount = 0

    quantities.forEach((qty, offset) => {
        const targetIndex = startIndex + offset
        updatedCount++

        if (targetIndex < updated.length) {
            const existing = updated[targetIndex]
            let unbundleData: { needsUnbundle: boolean, unbundleInfo?: string } = { needsUnbundle: false }
            if (checkUnbundleFn && existing.productId) {
                unbundleData = checkUnbundleFn(existing.productId, existing.unit, qty)
            }

            updated[targetIndex] = {
                ...existing,
                quantity: qty,
                document_quantity: !existing.isDocQtyVisible ? qty : existing.document_quantity,
                needsUnbundle: unbundleData.needsUnbundle,
                unbundleInfo: unbundleData.unbundleInfo
            }
        } else {
            // Append a new item with this quantity
            updated.push({
                id: crypto.randomUUID(),
                productId: '',
                productName: '',
                unit: '',
                quantity: qty,
                document_quantity: qty,
                price: 0,
                note: '',
                categoryId: null
            })
        }
    })

    return {
        newItems: updated,
        updatedCount
    }
}
