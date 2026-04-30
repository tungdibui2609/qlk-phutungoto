'use client'

import React, { useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { MoreHorizontal, Plus, Edit, Tag as TagIcon, ArrowRightLeft, FileOutput, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { Database } from '@/lib/database.types'
import { logActivity } from '@/lib/audit'

import { LotForm } from '@/app/(dashboard)/warehouses/lots/_components/LotForm'
import { Lot, Product, Supplier, QCInfo, Unit, ProductUnit } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'

type Position = Database['public']['Tables']['positions']['Row']

interface UsePositionActionManagerProps {
    currentSystemCode?: string
    onRefreshMap: () => void
    onRefreshLot: (lotId: string) => void
}

export function usePositionActionManager({ currentSystemCode, onRefreshMap, onRefreshLot }: UsePositionActionManagerProps) {
    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{
        x: number
        y: number
        position: any | null
    } | null>(null)
    const { showToast, showConfirm } = useToast()

    // Lot Form State
    const [showLotForm, setShowLotForm] = useState(false)
    const [editingLot, setEditingLot] = useState<Lot | null>(null)
    const [targetPositionId, setTargetPositionId] = useState<string | string[] | null>(null)

    // Common Data for Lot Form
    const [commonData, setCommonData] = useState<{
        products: Product[]
        suppliers: Supplier[]
        qcList: QCInfo[]
        units: Unit[]
        productUnits: ProductUnit[]
        branches: any[]
    }>({
        products: [],
        suppliers: [],
        qcList: [],
        units: [],
        productUnits: [],
        branches: []
    })

    const commonDataLoaded = useRef(false)

    async function fetchCommonData() {
        if (!currentSystemCode || commonDataLoaded.current) return

        const [prodRes, suppRes, qcRes, branchRes, unitRes, pUnitRes] = await Promise.all([
            supabase.from('products').select('*').eq('system_type', currentSystemCode).order('name'),
            supabase.from('suppliers').select('*').eq('system_code', currentSystemCode).order('name'),
            supabase.from('qc_info').select('*').eq('system_code', currentSystemCode).order('name'),
            supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
            supabase.from('units').select('*'),
            supabase.from('product_units').select('*')
        ])

        setCommonData({
            products: prodRes.data as Product[] || [],
            suppliers: suppRes.data as Supplier[] || [],
            qcList: qcRes.data as QCInfo[] || [],
            branches: branchRes.data || [],
            units: unitRes.data as Unit[] || [],
            productUnits: pUnitRes.data as ProductUnit[] || []
        })
        commonDataLoaded.current = true
    }

    const handlePositionMenu = (pos: Position, e: React.MouseEvent) => {
        e.preventDefault()
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            position: pos
        })
    }

    const handleMenuAction = async (action: 'create' | 'edit' | 'assign' | 'move' | 'export' | 'delete') => {
        if (!contextMenu?.position) return
        const pos = contextMenu.position
        setContextMenu(null)

        if (action === 'delete') {
            const lotId = pos.lot_id
            if (!lotId) return

            if (!await showConfirm('Bạn có chắc chắn muốn xóa LOT này?')) return

            try {
                const realIds = (pos as any).realIds || [pos.id]
                // 1. Clear lot_id in positions (Reference)
                const { error: posError } = await supabase
                    .from('positions')
                    .update({ lot_id: null } as any)
                    .in('id', realIds)

                if (posError) throw posError

                // Audit Log for deletion (clearing positions)
                for (const id of realIds) {
                    await logActivity({
                        supabase,
                        tableName: 'positions',
                        recordId: id,
                        action: 'UPDATE',
                        oldData: { lot_id: lotId },
                        newData: { lot_id: null },
                        systemCode: currentSystemCode || ''
                    })
                }

                // 2. Delete lot_tags (Child)
                await supabase.from('lot_tags').delete().eq('lot_id', lotId)

                // 3. Delete lot_items (Child)
                const { error: itemError } = await supabase
                    .from('lot_items')
                    .delete()
                    .eq('lot_id', lotId)

                if (itemError) throw itemError

                // 4. Finally delete the lot (Owner)
                const { error: lotError } = await supabase
                    .from('lots')
                    .delete()
                    .eq('id', lotId)

                if (lotError) throw lotError

                showToast('Đã xóa LOT thành công', 'success')
                onRefreshMap()
            } catch (error: any) {
                console.error('Delete lot error:', error)
                showToast(error.message || "Lỗi khi xóa LOT (có thể do ràng buộc dữ liệu khác)", 'error')
            }
            return
        }

        if (action === 'export') {
            const lotId = pos.lot_id
            const realIds = (pos as any).realIds || [pos.id]
            window.location.href = `/work/export-order?posIds=${realIds.join(',')}&lotIds=${lotId || ''}`
            return
        }

        if (action === 'assign') {
            alert('Tính năng chọn LOT có sẵn đang phát triển')
            return
        }

        if (action === 'move') {
            const lotId = pos.lot_id
            if (lotId) {
                window.location.href = `/warehouses/map?assignLotId=${lotId}&mode=move`
            }
            return
        }

        if (action === 'create') {
            await fetchCommonData()
            setEditingLot(null)
            setTargetPositionId((pos as any).realIds || [pos.id])
            setShowLotForm(true)
        }

        if (action === 'edit') {
            if (!pos.lot_id) return
            await fetchCommonData()

            const { data } = await supabase
                .from('lots')
                .select(`
                    *,
                    lot_items (
                        id, quantity, product_id, unit,
                        products (name, unit, sku, product_code:id)
                    ),
                    lot_tags (*)
                `)
                .eq('id', pos.lot_id)
                .single()

            if (data) {
                setEditingLot(data as unknown as Lot)
                setTargetPositionId((pos as any).realIds || [pos.id])
                setShowLotForm(true)
            }
        }
    }

    const handleLotFormSuccess = async (lotData?: any) => {
        if (targetPositionId && lotData?.id) {
            const ids = Array.isArray(targetPositionId) ? targetPositionId : [targetPositionId]
            await supabase
                .from('positions')
                .update({ lot_id: lotData.id } as any)
                .in('id', ids)

            // Audit Log
            for (const id of ids) {
                await logActivity({
                    supabase,
                    tableName: 'positions',
                    recordId: id,
                    action: 'UPDATE',
                    oldData: { lot_id: editingLot?.id || null },
                    newData: { lot_id: lotData.id },
                    systemCode: currentSystemCode || ''
                })
            }
        }

        setShowLotForm(false)
        setEditingLot(null)
        setTargetPositionId(null)

        if (lotData?.id) {
            onRefreshLot(lotData.id)
        } else {
            onRefreshMap()
        }
    }

    const PositionActionUI = () => (
        <>
            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
                    <div
                        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-1 min-w-[150px] animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        {contextMenu.position?.lot_id ? (
                            <>
                                <button
                                    onClick={() => handleMenuAction('edit')}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-left"
                                >
                                    <Edit size={16} className="text-blue-500" />
                                    <span>Sửa thông tin LOT</span>
                                </button>
                                <button
                                    onClick={() => handleMenuAction('export')}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-left"
                                >
                                    <FileOutput size={16} className="text-emerald-500" />
                                    <span>Lệnh xuất kho</span>
                                </button>
                                <button
                                    onClick={() => handleMenuAction('move')}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-left"
                                >
                                    <ArrowRightLeft size={16} className="text-orange-500" />
                                    <span>Di chuyển sang vị trí khác</span>
                                </button>
                                <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                                <button
                                    onClick={() => handleMenuAction('delete')}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-colors text-left font-medium"
                                >
                                    <Trash2 size={16} />
                                    <span>Xóa LOT</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => handleMenuAction('create')}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-left"
                                >
                                    <Plus size={16} className="text-emerald-500" />
                                    <span>Tạo LOT mới</span>
                                </button>
                                <button
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed rounded-md text-left"
                                    disabled
                                >
                                    <TagIcon size={16} />
                                    <span>Gán LOT có sẵn</span>
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}

            {/* Lot Form Modal */}
            <LotForm
                isVisible={showLotForm}
                editingLot={editingLot}
                onClose={() => setShowLotForm(false)}
                onSuccess={handleLotFormSuccess}
                {...commonData}
            />
        </>
    )

    return {
        handlePositionMenu,
        PositionActionUI
    }
}
