'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { formatQuantityFull } from '@/lib/numberUtils'

interface StockSlice {
    categoryId: string
    unit: string
    quantity: number
}

const CACHE_TTL_MS = 30_000
const cache = new Map<string, { at: number; rows: StockSlice[] }>()

async function fetchCategorizedStock(productId: string, systemCode: string): Promise<StockSlice[]> {
    const cacheKey = `${productId}|${systemCode}`
    const hit = cache.get(cacheKey)
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows

    const { data } = await (supabase.from('lot_items') as any)
        .select('quantity, unit, category_id, lots!inner(system_code, status)')
        .eq('product_id', productId)
        .eq('lots.system_code', systemCode)
        .eq('lots.status', 'active')
        .not('category_id', 'is', 'null')

    const merged = new Map<string, StockSlice>()
    ;(data || []).forEach((row: any) => {
        if (!row.category_id) return
        const unit = row.unit || ''
        const key = `${row.category_id}|${unit}`
        const prev = merged.get(key)
        if (prev) prev.quantity += Number(row.quantity || 0)
        else merged.set(key, { categoryId: row.category_id, unit, quantity: Number(row.quantity || 0) })
    })

    const rows = Array.from(merged.values())
    cache.set(cacheKey, { at: Date.now(), rows })
    return rows
}

/**
 * Cảnh báo MỀM (không chặn thao tác): sản phẩm này đang có tồn trong kho gắn danh mục
 * khác với danh mục vừa chọn trên dòng phiếu.
 */
export function CategoryStockHint({
    productId,
    categoryId,
    categories
}: {
    productId?: string | null
    categoryId?: string | null
    categories?: { id: string; name: string }[]
}) {
    const { systemType } = useSystem()
    const [rows, setRows] = useState<StockSlice[]>([])

    useEffect(() => {
        if (!productId || !systemType) {
            setRows([])
            return
        }
        let alive = true
        fetchCategorizedStock(productId, systemType).then(r => { if (alive) setRows(r) })
        return () => { alive = false }
    }, [productId, systemType])

    const others = useMemo(
        () => rows.filter(r => r.categoryId !== categoryId && r.quantity > 0),
        [rows, categoryId]
    )

    if (!categoryId || others.length === 0) return null

    const labelOf = (id: string) => categories?.find(c => c.id === id)?.name || 'Không rõ'

    return (
        <div className="mt-1 flex items-start gap-1 text-[9px] leading-snug text-amber-600 dark:text-amber-400">
            <AlertTriangle size={10} className="shrink-0 mt-0.5" />
            <span>
                Tồn đang gắn danh mục khác:{' '}
                {others.map((r, idx) => (
                    <span key={`${r.categoryId}-${r.unit}`}>
                        {idx > 0 && ', '}
                        <b className="font-semibold">{labelOf(r.categoryId)}</b>{' '}
                        {formatQuantityFull(r.quantity)} {r.unit}
                    </span>
                ))}
            </span>
        </div>
    )
}
