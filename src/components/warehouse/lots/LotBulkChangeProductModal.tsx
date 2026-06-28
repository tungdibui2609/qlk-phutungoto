// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2, CheckCircle2, AlertTriangle, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { Product } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'

interface LotBulkChangeProductModalProps {
    onClose: () => void
    onSuccess: () => void
    products: Product[]
}

export function LotBulkChangeProductModal({ onClose, onSuccess, products }: LotBulkChangeProductModalProps) {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()
    const { user } = useUser()
    const [loading, setLoading] = useState(false)
    const [checking, setChecking] = useState(false)

    // Form states
    const [sourceProductId, setSourceProductId] = useState('')
    const [targetProductId, setTargetProductId] = useState('')

    // Thống kê ảnh hưởng
    const [affectedItems, setAffectedItems] = useState<any[]>([])
    const [affectedQty, setAffectedQty] = useState(0)

    // Trạng thái kết quả
    const [results, setResults] = useState<{
        updatedCount: number;
        mergedCount: number;
        deletedCount: number;
        success: boolean;
    } | null>(null)

    // Lọc danh sách sản phẩm thuộc hệ thống hiện tại (nếu có trường system_type hoặc system_code)
    // Hoặc đơn giản là hiển thị tất cả các sản phẩm có sẵn
    const activeProducts = products.filter(p => p.is_active !== false)

    // 1. Kiểm tra số lượng LOT bị ảnh hưởng khi chọn sản phẩm nguồn
    useEffect(() => {
        if (!sourceProductId || !currentSystem?.code) {
            setAffectedItems([])
            setAffectedQty(0)
            return
        }

        const checkAffectedLots = async () => {
            setChecking(true)
            try {
                const { data, error } = await supabase
                    .from('lot_items')
                    .select('id, lot_id, quantity, unit, lots!inner(code, system_code)')
                    .eq('product_id', sourceProductId)
                    .eq('lots.system_code', currentSystem.code)

                if (error) {
                    console.error('Error fetching affected lots:', error)
                    showToast('Không thể kiểm tra số lượng lô hàng bị ảnh hưởng.', 'error')
                    return
                }

                if (data) {
                    setAffectedItems(data)
                    const total = data.reduce((sum, item) => sum + (item.quantity || 0), 0)
                    setAffectedQty(total)
                }
            } catch (err) {
                console.error('Exception checking affected lots:', err)
            } finally {
                setChecking(false)
            }
        }

        checkAffectedLots()
    }, [sourceProductId, currentSystem?.code])

    // 2. Xử lý đổi mã hàng loạt
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!currentSystem?.code) {
            showToast('Không tìm thấy mã phân hệ kho hiện tại.', 'error')
            return
        }

        if (!sourceProductId || !targetProductId) {
            showToast('Vui lòng chọn đầy đủ sản phẩm nguồn và sản phẩm đích.', 'warning')
            return
        }

        if (sourceProductId === targetProductId) {
            showToast('Sản phẩm đích phải khác sản phẩm nguồn.', 'warning')
            return
        }

        if (affectedItems.length === 0) {
            showToast('Không có lô hàng nào chứa sản phẩm nguồn để thay đổi.', 'warning')
            return
        }

        setLoading(true)
        setResults(null)

        try {
            // Lấy toàn bộ các lot_items của sản phẩm đích trong hệ thống hiện hành để so sánh trùng lặp
            const { data: targetLotItems, error: targetError } = await supabase
                .from('lot_items')
                .select('id, lot_id, quantity, unit, lots!inner(code, system_code)')
                .eq('product_id', targetProductId)
                .eq('lots.system_code', currentSystem.code)

            if (targetError) {
                showToast('Lỗi khi kiểm tra trùng lặp lô hàng.', 'error')
                setLoading(false)
                return
            }

            // Tạo map các lot_id chứa sản phẩm đích để check trùng lặp nhanh
            const targetLotItemsMap: Record<string, any> = {}
            targetLotItems?.forEach(item => {
                targetLotItemsMap[item.lot_id] = item
            })

            let updatedCount = 0
            let mergedCount = 0
            let deletedCount = 0

            // Tiến hành cập nhật từng lot_item bị ảnh hưởng
            for (const sourceItem of affectedItems) {
                const duplicateTargetItem = targetLotItemsMap[sourceItem.lot_id]

                if (duplicateTargetItem) {
                    // TRƯỜNG HỢP TRÙNG LẶP: Cả 2 sản phẩm cùng tồn tại trong 1 lot
                    // -> Cộng dồn số lượng vào dòng sản phẩm đích
                    const newQty = (duplicateTargetItem.quantity || 0) + (sourceItem.quantity || 0)
                    
                    const { error: updateError } = await supabase
                        .from('lot_items')
                        .update({ quantity: newQty })
                        .eq('id', duplicateTargetItem.id)

                    if (updateError) {
                        console.error(`Error merging lot_item ${duplicateTargetItem.id}:`, updateError)
                        showToast(`Lỗi khi cộng dồn số lượng trong lô ${sourceItem.lots?.code}`, 'error')
                        continue
                    }

                    // -> Xóa dòng sản phẩm nguồn
                    const { error: deleteError } = await supabase
                        .from('lot_items')
                        .delete()
                        .eq('id', sourceItem.id)

                    if (deleteError) {
                        console.error(`Error deleting lot_item ${sourceItem.id}:`, deleteError)
                    } else {
                        deletedCount++
                    }

                    mergedCount++
                } else {
                    // TRƯỜNG HỢP KHÔNG TRÙNG LẶP: Lot chỉ chứa sản phẩm nguồn
                    // -> Chỉ cần cập nhật product_id thành sản phẩm đích
                    const { error: updateError } = await supabase
                        .from('lot_items')
                        .update({ product_id: targetProductId })
                        .eq('id', sourceItem.id)

                    if (updateError) {
                        console.error(`Error updating lot_item ${sourceItem.id}:`, updateError)
                        showToast(`Lỗi khi đổi mã trong lô ${sourceItem.lots?.code}`, 'error')
                        continue
                    }

                    updatedCount++
                }
            }

            // Ghi nhận Audit Log
            const sourceSku = products.find(p => p.id === sourceProductId)?.sku || sourceProductId
            const targetSku = products.find(p => p.id === targetProductId)?.sku || targetProductId
            
            await supabase.from('audit_logs').insert({
                action: 'UPDATE',
                table_name: 'lot_items',
                record_id: sourceProductId,
                changed_by: user?.email || 'system_bulk_change',
                old_data: { sku: sourceSku, count: affectedItems.length },
                new_data: { sku: targetSku, updatedCount, mergedCount },
                system_code: currentSystem.code
            })

            setResults({
                updatedCount,
                mergedCount,
                deletedCount,
                success: true
            })

            showToast(`Đổi mã thành công cho ${affectedItems.length} lô hàng!`, 'success')

        } catch (err) {
            console.error('Exception during bulk change product:', err)
            showToast('Đã xảy ra lỗi hệ thống khi đổi mã.', 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-teal-50 dark:bg-teal-950/30 rounded-lg text-teal-600 dark:text-teal-400">
                            <Layers size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                Đổi mã hàng hàng loạt
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Chỉ tác động tới dữ liệu trong quản lý lô hàng (LOT)
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {results && results.success ? (
                        /* Màn hình kết quả */
                        <div className="space-y-6 text-center py-4">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={30} />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Thực hiện đổi mã thành công!
                                </h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Dữ liệu của các lô hàng đã được cập nhật thành công.
                                </p>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 text-left border border-slate-150 dark:border-slate-800 space-y-2">
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                                    <span>Lô hàng cập nhật mã mới trực tiếp:</span>
                                    <span className="font-bold text-slate-950 dark:text-white">{results.updatedCount}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                                    <span>Lô hàng cộng dồn (trùng lặp):</span>
                                    <span className="font-bold text-slate-950 dark:text-white">{results.mergedCount}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                                    <span>Bản ghi lot_items cũ đã xóa:</span>
                                    <span className="font-bold text-slate-950 dark:text-white">{results.deletedCount}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    onSuccess()
                                    onClose()
                                }}
                                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    ) : (
                        /* Màn hình Form */
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Cảnh báo an toàn */}
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl flex gap-3 text-amber-800 dark:text-amber-300 text-xs">
                                <AlertTriangle size={18} className="shrink-0 text-amber-500" />
                                <div>
                                    <span className="font-bold">Cảnh báo:</span> Hành động này sẽ thay đổi trực tiếp sản phẩm của toàn bộ các lô hàng tương ứng trong phân hệ <span className="font-bold text-slate-900 dark:text-white">{(currentSystem?.name || currentSystem?.code)?.toUpperCase()}</span>. Vui lòng kiểm tra kỹ trước khi bấm xác nhận.
                                </div>
                            </div>

                            {/* Dropdown Sản phẩm nguồn */}
                            <div className="space-y-1.5">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Mã sản phẩm hiện tại (Nguồn)
                                </label>
                                <select
                                    value={sourceProductId}
                                    onChange={(e) => setSourceProductId(e.target.value)}
                                    disabled={loading}
                                    required
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 dark:focus:ring-teal-500/30 text-sm"
                                >
                                    <option value="">-- Chọn mã cần thay đổi --</option>
                                    {activeProducts.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            [{p.sku}] {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Thống kê ảnh hưởng */}
                            {sourceProductId && (
                                <div className="bg-teal-50/50 dark:bg-teal-950/10 rounded-xl p-3 border border-teal-100 dark:border-teal-900/30 space-y-1 text-xs">
                                    {checking ? (
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <Loader2 size={14} className="animate-spin text-teal-600" />
                                            Đang kiểm tra số lượng lô hàng ảnh hưởng...
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                                <span>Số lượng lô hàng chứa mã này:</span>
                                                <span className="font-bold text-teal-700 dark:text-teal-400">{affectedItems.length} lô</span>
                                            </div>
                                            <div className="flex justify-between text-slate-600 dark:text-slate-400 mt-1">
                                                <span>Tổng số lượng tồn kho (Thùng/Kg):</span>
                                                <span className="font-bold text-teal-700 dark:text-teal-400">
                                                    {affectedQty.toLocaleString('vi-VN')} {affectedItems[0]?.unit || ''}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Dropdown Sản phẩm đích */}
                            <div className="space-y-1.5">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Mã sản phẩm mới (Đích)
                                </label>
                                <select
                                    value={targetProductId}
                                    onChange={(e) => setTargetProductId(e.target.value)}
                                    disabled={loading}
                                    required
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 dark:focus:ring-teal-500/30 text-sm"
                                >
                                    <option value="">-- Chọn mã mới đổi sang --</option>
                                    {activeProducts
                                        .filter(p => p.id !== sourceProductId)
                                        .map((p) => (
                                            <option key={p.id} value={p.id}>
                                                [{p.sku}] {p.name}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={loading}
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm cursor-pointer disabled:opacity-50"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || checking || affectedItems.length === 0}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition-all text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-600/10"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Đang đổi mã...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            Xác nhận đổi mã
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
