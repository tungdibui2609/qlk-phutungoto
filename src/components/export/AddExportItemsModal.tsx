'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/Dialog"
import { Loader2, Search, Plus, MapPin, Box } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { logActivity } from '@/lib/audit'

interface AddExportItemsModalProps {
    isOpen: boolean
    onClose: () => void
    taskId: string
    existingItems: Array<{
        lot_id?: string
        position_id?: string
        product_id?: string
        status: string
    }>
    onSuccess: () => void
}

interface AvailableItem {
    key: string // unique composite key: positionId_lotId_productId
    position_id: string
    position_code: string
    lot_id: string
    lot_code: string
    production_code: string | null
    product_id: string
    product_name: string
    sku: string
    stock_quantity: number
    unit: string
}

export function AddExportItemsModal({
    isOpen,
    onClose,
    taskId,
    existingItems,
    onSuccess
}: AddExportItemsModalProps) {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [availableItems, setAvailableItems] = useState<AvailableItem[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    
    // Track selected items: { [key]: exportQuantity }
    const [selectedQtys, setSelectedQtys] = useState<Record<string, number>>({})
    const [selectedChecks, setSelectedChecks] = useState<Record<string, boolean>>({})

    useEffect(() => {
        if (isOpen && currentSystem?.code) {
            fetchAvailableInventory()
            setSelectedQtys({})
            setSelectedChecks({})
            setSearchQuery('')
        }
    }, [isOpen, currentSystem])

    async function fetchAvailableInventory() {
        if (!currentSystem?.code) return
        setLoading(true)
        try {
            // Fetch positions that have lots in the current system (with pagination to fetch all)
            let allData: any[] = []
            let from = 0
            const pageSize = 1000
            let hasMore = true

            while (hasMore) {
                const { data, error } = await supabase
                    .from('positions')
                    .select(`
                        id,
                        code,
                        lot_id,
                        lots!positions_lot_id_fkey (
                            id,
                            code,
                            production_code,
                            status,
                            lot_items (
                                id,
                                quantity,
                                unit,
                                product_id,
                                products (
                                    id,
                                    name,
                                    sku
                                )
                            )
                        )
                    `)
                    .eq('system_type', currentSystem.code)
                    .not('lot_id', 'is', null)
                    .range(from, from + pageSize - 1)

                if (error) throw error

                if (data && data.length > 0) {
                    allData = [...allData, ...data]
                    if (data.length < pageSize) {
                        hasMore = false
                    } else {
                        from += pageSize
                    }
                } else {
                    hasMore = false
                }
            }

            // Flatten and aggregate data into individual selectable items (grouping duplicate products in the same lot & position)
            const itemsMap: Record<string, AvailableItem> = {}
            allData.forEach((pos: any) => {
                const lot = pos.lots
                if (lot && lot.status === 'active' && lot.lot_items) {
                    lot.lot_items.forEach((li: any) => {
                        const qty = Number(li.quantity || 0)
                        if (qty > 0.000001 && li.products) {
                            const key = `${pos.id}_${lot.id}_${li.products.id}`
                            if (itemsMap[key]) {
                                itemsMap[key].stock_quantity += qty
                            } else {
                                itemsMap[key] = {
                                    key,
                                    position_id: pos.id,
                                    position_code: pos.code,
                                    lot_id: lot.id,
                                    lot_code: lot.code,
                                    production_code: lot.production_code || null,
                                    product_id: li.products.id,
                                    product_name: li.products.name,
                                    sku: li.products.sku,
                                    stock_quantity: qty,
                                    unit: li.unit
                                }
                            }
                        }
                    })
                }
            })

            const items = Object.values(itemsMap)

            // Sort by position code
            items.sort((a, b) => a.position_code.localeCompare(b.position_code))
            setAvailableItems(items)

        } catch (error: any) {
            console.error('Error fetching inventory:', error)
            showToast('Lỗi tải danh sách tồn kho: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return availableItems

        const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
        return availableItems.filter(item => {
            const nameNorm = item.product_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            const skuNorm = item.sku.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            const lotNorm = item.lot_code.toLowerCase()
            const prodLotNorm = (item.production_code || '').toLowerCase()
            const posNorm = item.position_code.toLowerCase()

            return nameNorm.includes(q) || 
                   skuNorm.includes(q) || 
                   lotNorm.includes(q) || 
                   prodLotNorm.includes(q) || 
                   posNorm.includes(q)
        })
    }, [availableItems, searchQuery])

    const handleCheckboxChange = (item: AvailableItem, checked: boolean) => {
        setSelectedChecks(prev => ({ ...prev, [item.key]: checked }))
        setSelectedQtys(prev => {
            const next = { ...prev }
            if (checked) {
                // Default export quantity to the available stock
                next[item.key] = item.stock_quantity
            } else {
                delete next[item.key]
            }
            return next
        })
    }

    const handleQtyChange = (item: AvailableItem, val: string) => {
        const num = parseFloat(val)
        setSelectedQtys(prev => ({
            ...prev,
            [item.key]: isNaN(num) ? 0 : num
        }))
        if (!selectedChecks[item.key] && !isNaN(num) && num > 0) {
            setSelectedChecks(prev => ({ ...prev, [item.key]: true }))
        }
    }

    async function handleAdd() {
        const itemsToInsert: Array<{
            lot_id: string
            position_id: string
            product_id: string
            qty: number
            unit: string
            item_ref: AvailableItem
        }> = []

        // Validate selections
        for (const item of availableItems) {
            if (selectedChecks[item.key]) {
                const qty = selectedQtys[item.key] || 0
                if (qty <= 0) {
                    showToast(`Số lượng của mặt hàng ${item.sku} tại ${item.position_code} phải lớn hơn 0`, 'error')
                    return
                }
                if (qty > item.stock_quantity + 0.000001) {
                    showToast(`Số lượng xuất (${qty}) không được vượt quá tồn kho thực tế (${item.stock_quantity}) của mặt hàng ${item.sku} tại vị trí ${item.position_code}`, 'error')
                    return
                }
                itemsToInsert.push({
                    lot_id: item.lot_id,
                    position_id: item.position_id,
                    product_id: item.product_id,
                    qty,
                    unit: item.unit,
                    item_ref: item
                })
            }
        }

        if (itemsToInsert.length === 0) {
            showToast('Vui lòng chọn ít nhất một mặt hàng để thêm', 'warning')
            return
        }

        try {
            setSaving(true)

            // We need to check if there are already pending items in database for this task
            // so we can merge them instead of creating duplicates.
            const { data: dbExistingItems, error: fetchErr } = await (supabase
                .from('export_task_items') as any)
                .select('*')
                .eq('task_id', taskId)

            if (fetchErr) throw fetchErr

            const insertBatch: any[] = []
            const updatePromises: any[] = []

            for (const toAdd of itemsToInsert) {
                // Find if there's an existing item with same position + lot + product and status = 'Pending'
                const match = dbExistingItems?.find((existing: any) => 
                    existing.lot_id === toAdd.lot_id &&
                    existing.position_id === toAdd.position_id &&
                    existing.product_id === toAdd.product_id &&
                    existing.status === 'Pending'
                )

                if (match) {
                    // Update: add the quantities
                    const newQty = Number(match.quantity) + toAdd.qty
                    updatePromises.push(
                        (supabase
                            .from('export_task_items') as any)
                            .update({ quantity: newQty })
                            .eq('id', match.id)
                    )
                } else {
                    // Insert new row
                    insertBatch.push({
                        task_id: taskId,
                        lot_id: toAdd.lot_id,
                        position_id: toAdd.position_id,
                        product_id: toAdd.product_id,
                        quantity: toAdd.qty,
                        unit: toAdd.unit,
                        status: 'Pending'
                    })
                }
            }

            // Execute updates
            if (updatePromises.length > 0) {
                const results = await Promise.all(updatePromises)
                const firstErr = results.find(r => r.error)?.error
                if (firstErr) throw firstErr
            }

            // Execute inserts
            if (insertBatch.length > 0) {
                const { error: insertErr } = await (supabase
                    .from('export_task_items') as any)
                    .insert(insertBatch)
                
                if (insertErr) throw insertErr
            }

            // Log activity
            await logActivity({
                supabase,
                tableName: 'export_task_items',
                recordId: taskId,
                action: 'UPDATE',
                newData: {
                    added_items: itemsToInsert.map(i => ({
                        product_sku: i.item_ref.sku,
                        lot_code: i.item_ref.lot_code,
                        position: i.item_ref.position_code,
                        qty: i.qty
                    }))
                },
                systemCode: currentSystem?.code || null
            })

            showToast(`Đã thêm thành công ${itemsToInsert.length} dòng hàng hóa vào lệnh xuất`, 'success')
            onSuccess()
            onClose()

        } catch (error: any) {
            console.error('Error adding export items:', error)
            showToast('Lỗi thêm hàng hóa: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[85vh] min-h-[500px] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <Plus className="text-blue-500" size={20} />
                        Thêm Vị Trí / Hàng Hóa Xuất Kho
                    </DialogTitle>
                </DialogHeader>

                {/* Filter and Search */}
                <div className="px-6 py-4 bg-stone-50 dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800 flex items-center gap-3 shrink-0">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo mã vị trí, mã LOT, SKU, tên sản phẩm..."
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-stone-900 dark:text-stone-100"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Content List */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-stone-400">
                            <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
                            <span>Đang tải thông tin tồn kho...</span>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-stone-400">
                            <Box size={48} className="mb-2 text-stone-300 dark:text-stone-700" strokeWidth={1} />
                            <span>Không tìm thấy vị trí tồn kho phù hợp</span>
                        </div>
                    ) : (
                        <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden divide-y divide-stone-100 dark:divide-stone-800 bg-white dark:bg-stone-950">
                            {/* Table Header */}
                            <div className="bg-stone-50 dark:bg-stone-900/50 px-4 py-3 grid grid-cols-12 gap-3 text-xs font-bold text-stone-500 uppercase tracking-tight">
                                <div className="col-span-1 text-center">Chọn</div>
                                <div className="col-span-2">Vị trí</div>
                                <div className="col-span-3">Mã LOT / Lot SX</div>
                                <div className="col-span-4">Hàng hóa (SKU)</div>
                                <div className="col-span-2 text-right">SL Xuất / Tồn</div>
                            </div>
                            {/* Rows */}
                            <div className="divide-y divide-stone-100 dark:divide-stone-800">
                                {filteredItems.map(item => {
                                    const isChecked = selectedChecks[item.key] || false
                                    const qty = selectedQtys[item.key] !== undefined ? selectedQtys[item.key] : ''

                                    return (
                                        <div 
                                            key={item.key} 
                                            className={`px-4 py-3 grid grid-cols-12 gap-3 items-center text-sm transition-colors hover:bg-stone-50 dark:hover:bg-zinc-900/30
                                                ${isChecked ? 'bg-blue-50/20 dark:bg-blue-900/5' : ''}
                                            `}
                                        >
                                            {/* Checkbox */}
                                            <div className="col-span-1 flex justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => handleCheckboxChange(item, e.target.checked)}
                                                    className="rounded border-stone-300 dark:border-stone-700 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                                />
                                            </div>
                                            {/* Position */}
                                            <div className="col-span-2 flex items-center gap-1.5 font-mono font-bold text-stone-800 dark:text-stone-200">
                                                <MapPin size={14} className="text-amber-500 shrink-0" />
                                                <span>{item.position_code}</span>
                                            </div>
                                            {/* Lot Info */}
                                            <div className="col-span-3 flex flex-col min-w-0">
                                                <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold truncate leading-tight" title={item.lot_code}>{item.lot_code}</span>
                                                {item.production_code && (
                                                    <span className="text-[10px] text-stone-500 dark:text-stone-400 font-mono truncate mt-0.5">
                                                        SX: <span className="text-stone-700 dark:text-stone-300 font-bold">{item.production_code}</span>
                                                    </span>
                                                )}
                                            </div>
                                            {/* Product Info */}
                                            <div className="col-span-4 flex flex-col min-w-0">
                                                <span className="font-bold text-stone-900 dark:text-stone-100 truncate leading-tight" title={item.product_name}>{item.product_name}</span>
                                                <span className="text-xs font-mono text-stone-500 dark:text-stone-400 mt-0.5">SKU: {item.sku}</span>
                                            </div>
                                            {/* Quantity Selection */}
                                            <div className="col-span-2 flex items-center justify-end gap-1.5">
                                                <div className="flex flex-col items-end">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={qty}
                                                        onChange={(e) => handleQtyChange(item, e.target.value)}
                                                        placeholder="0"
                                                        className="w-20 text-right font-bold text-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded px-1.5 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                    />
                                                    <span className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                                                        Tồn: <span className="font-bold text-emerald-600 dark:text-emerald-400">{item.stock_quantity}</span> {item.unit}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 bg-stone-50 dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 gap-2 sm:gap-0 shrink-0">
                    <button
                        onClick={onClose}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-stone-200 bg-white hover:bg-stone-100 h-10 px-4 py-2 dark:border-stone-800 dark:bg-stone-950 dark:hover:bg-stone-800 dark:text-stone-100"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleAdd}
                        disabled={saving}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Thêm vào Lệnh Xuất
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
