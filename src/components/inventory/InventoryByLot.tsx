'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Search, Loader2, MapPin } from 'lucide-react'
import { Database } from '@/lib/database.types'
import { useSystem } from '@/contexts/SystemContext'

type Lot = Database['public']['Tables']['lots']['Row'] & {
    lot_items: (Database['public']['Tables']['lot_items']['Row'] & {
        products: { name: string; unit: string; product_code?: string; sku: string } | null
    })[] | null
    suppliers: { name: string } | null
    positions: { code: string }[] | null
    // Legacy support
    products: { name: string; unit: string; product_code?: string; sku: string } | null
}

interface FlattenedLotItem {
    id: string
    lotCode: string
    productSku: string
    productName: string
    productUnit: string
    quantity: number
    batchCode: string
    inboundDate: string | null
    positions: { code: string }[] | null
    supplierName: string
}

export default function InventoryByLot() {
    const [lots, setLots] = useState<Lot[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const { systemType } = useSystem()

    useEffect(() => {
        fetchLots()
    }, [])

    async function fetchLots() {
        setLoading(true)
        const { data, error } = await supabase
            .from('lots')
            .select(`
                *,
                lot_items (
                    id,
                    quantity,
                    product_id,
                    products (
                        name,
                        unit,
                        sku,
                        product_code:id
                    )
                ),
                products!inner(name, unit, product_code:id, sku, system_type),
                suppliers(name),
                positions(code)
            `)
            .eq('status', 'active')
            // Use !inner to ensure we only get lots that have a product in the current system
            // Note: This relies on lots having a product_id. For lot_items, we might need a different strategy or rely on the fact that product creation is scoped.
            .eq('products.system_type', systemType)
            .order('created_at', { ascending: false })

        // Note: For lots with NO product_id (pure lot_items), this filter might hide them if we use !inner on products.
        // However, typically lots are created with a main product or we can adjust logic.
        // Ideally, we should add system_type to lots table. For now, assuming direct product link or manual management.

        if (error) {
            console.error('Error fetching lots:', error)
        } else if (data) {
            setLots(data as unknown as Lot[])
        }
        setLoading(false)
    }

    const filteredLots = lots.filter(lot =>
        lot.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lot.products?.name && lot.products.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lot.batch_code && lot.batch_code.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm">
                <div className="flex-1 w-full">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Tìm kiếm</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Mã LOT, Tên hàng, Batch..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </div>
                </div>
                {/* Add more filters here if needed later (e.g. Warehouse/Branch if LOTs are linked to them) */}
            </div>

            {/* Table */}
            <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 dark:text-stone-400 font-medium">
                            <tr>
                                <th className="px-4 py-3">Mã LOT</th>
                                <th className="px-4 py-3">Mã hàng</th>
                                <th className="px-4 py-3">Tên hàng</th>
                                <th className="px-4 py-3">Batch (NCC)</th>
                                <th className="px-4 py-3">Vị trí</th>
                                <th className="px-4 py-3">Ngày nhập</th>
                                <th className="px-4 py-3 text-right">Số lượng</th>
                                <th className="px-4 py-3 text-center">ĐVT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Đang tải dữ liệu...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredLots.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                                        Không tìm thấy tồn kho theo LOT nào.
                                    </td>
                                </tr>
                            ) : (
                                filteredLots.flatMap(lot => {
                                    // If we have lot_items, map them. Otherwise check for legacy product.
                                    if (lot.lot_items && lot.lot_items.length > 0) {
                                        return lot.lot_items.map((item, idx) => ({
                                            id: item.id || `${lot.id}-item-${idx}`,
                                            lotCode: lot.code,
                                            productSku: item.products?.sku || 'N/A',
                                            productName: item.products?.name || 'Unknown',
                                            productUnit: item.products?.unit || '-',
                                            quantity: item.quantity,
                                            batchCode: lot.batch_code || '-',
                                            inboundDate: lot.inbound_date,
                                            positions: lot.positions,
                                            supplierName: lot.suppliers?.name || '-'
                                        }))
                                    } else if (lot.products) {
                                        // Legacy fallback
                                        return [{
                                            id: lot.id,
                                            lotCode: lot.code,
                                            productSku: lot.products.sku || 'N/A',
                                            productName: lot.products.name,
                                            productUnit: lot.products.unit,
                                            quantity: lot.quantity,
                                            batchCode: lot.batch_code || '-',
                                            inboundDate: lot.inbound_date,
                                            positions: lot.positions,
                                            supplierName: lot.suppliers?.name || '-'
                                        }]
                                    }
                                    return []
                                }).map((item, idx) => (
                                    <tr key={`${item.id}-${idx}`} className="hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-emerald-600 font-medium">{item.lotCode}</td>
                                        <td className="px-4 py-3 font-mono text-stone-600 dark:text-stone-400">{item.productSku}</td>
                                        <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">{item.productName}</td>
                                        <td className="px-4 py-3 text-stone-600 dark:text-stone-400">{item.batchCode}</td>
                                        <td className="px-4 py-3">
                                            {item.positions && item.positions.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {item.positions.map((pos, pIdx) => (
                                                        <span key={pIdx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                                            <MapPin className="w-3 h-3 mr-1" />
                                                            {pos.code}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-stone-400 italic">Chưa xếp</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-stone-600 dark:text-stone-400">
                                            {item.inboundDate ? new Date(item.inboundDate).toLocaleDateString('vi-VN') : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-stone-900 dark:text-stone-100">
                                            {item.quantity?.toLocaleString() || 0}
                                        </td>
                                        <td className="px-4 py-3 text-center text-stone-500">{item.productUnit}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="text-xs text-stone-500 text-right mt-2">
                * Chỉ hiển thị các LOT đang có trạng thái "active".
            </div>
        </div>
    )
}
