'use client'

import React, { useState, useEffect } from 'react'
import { History, RefreshCw, Search, Factory, Trash2, CheckSquare, Square } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { productionLoanService } from '@/services/production-inventory/productionLoanService'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { format } from 'date-fns'

export const LoanHistory = () => {
    const { systemType } = useSystem()
    const { showToast } = useToast()
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [deleteConfirmItem, setDeleteConfirmItem] = useState<any | null>(null)
    const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false)
    const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false)

    useEffect(() => {
        if (systemType) fetchHistory()
    }, [systemType])

    const fetchHistory = async () => {
        setLoading(true)
        try {
            const data = await productionLoanService.getHistory(supabase, systemType!)
            setHistory(data || [])
            setSelectedIds(new Set())
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const filteredHistory = history.filter(item =>
        item.worker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.products?.name && item.products.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.products?.sku && item.products.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.productions?.code && item.productions.code.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const isAllSelected = filteredHistory.length > 0 && filteredHistory.every(item => selectedIds.has(item.id))

    const toggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds(new Set())
        } else {
            const next = new Set<string>()
            filteredHistory.forEach(item => next.add(item.id))
            setSelectedIds(next)
        }
    }

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const executeDeleteOne = async () => {
        if (!deleteConfirmItem) return
        try {
            const { error } = await supabase
                .from('production_loans')
                .delete()
                .eq('id', deleteConfirmItem.id)

            if (error) throw error
            showToast('Đã xóa 1 bản ghi lịch sử thành công!', 'success')
            setHistory(prev => prev.filter(h => h.id !== deleteConfirmItem.id))
            selectedIds.delete(deleteConfirmItem.id)
            setSelectedIds(new Set(selectedIds))
        } catch (err: any) {
            showToast('Lỗi khi xóa: ' + (err.message || 'Không thể xóa'), 'error')
        } finally {
            setDeleteConfirmItem(null)
        }
    }

    const executeBulkDelete = async () => {
        if (selectedIds.size === 0) return
        setDeleting(true)
        try {
            const idList = Array.from(selectedIds)
            const { error } = await supabase
                .from('production_loans')
                .delete()
                .in('id', idList)

            if (error) throw error
            showToast(`Đã xóa thành công ${idList.length} bản ghi lịch sử!`, 'success')
            fetchHistory()
        } catch (err: any) {
            showToast('Lỗi khi xóa: ' + (err.message || 'Không thể xóa'), 'error')
        } finally {
            setDeleting(false)
            setIsBulkDeleteConfirmOpen(false)
        }
    }

    const executeDeleteAll = async () => {
        if (!systemType) return
        setDeleting(true)
        try {
            const { error } = await supabase
                .from('production_loans')
                .delete()
                .eq('system_code', systemType)
                .eq('status', 'returned')

            if (error) throw error
            showToast('Đã dọn dẹp sạch toàn bộ lịch sử cấp phát của kho này!', 'success')
            fetchHistory()
        } catch (err: any) {
            showToast('Lỗi khi xóa: ' + (err.message || 'Không thể xóa'), 'error')
        } finally {
            setDeleting(false)
            setIsDeleteAllConfirmOpen(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-stone-200 dark:border-zinc-700 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm lịch sử theo người nhận, sản phẩm, lệnh SX..."
                        className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border-none rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={() => setIsBulkDeleteConfirmOpen(true)}
                            disabled={deleting}
                            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        >
                            <Trash2 size={16} />
                            Xóa ({selectedIds.size}) đã chọn
                        </button>
                    )}

                    {history.length > 0 && (
                        <button
                            onClick={() => setIsDeleteAllConfirmOpen(true)}
                            disabled={deleting}
                            className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-zinc-700 hover:bg-red-50 hover:text-red-600 text-stone-600 dark:text-stone-300 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all border border-stone-200 dark:border-zinc-600 active:scale-95 disabled:opacity-50"
                            title="Xóa toàn bộ lịch sử đã thu hồi/trả của kho này"
                        >
                            <Trash2 size={16} />
                            Xóa tất cả lịch sử ({history.length})
                        </button>
                    )}

                    <button
                        onClick={fetchHistory}
                        disabled={loading}
                        className="p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-900 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 border border-stone-200 dark:border-zinc-700 transition-colors"
                        title="Tải lại danh sách"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-stone-400" /></div>
            ) : filteredHistory.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-800 rounded-3xl border border-dashed border-stone-200 dark:border-zinc-700">
                    <History className="mx-auto text-stone-300 dark:text-zinc-600 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-stone-500 dark:text-zinc-400">Chưa có lịch sử cấp phát nào</h3>
                    <p className="text-xs text-stone-400 mt-1">Lịch sử cấp phát đã hoàn tất hoặc đã được xóa sạch.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-stone-50 dark:bg-zinc-900 text-stone-500 dark:text-gray-400 text-xs font-bold uppercase">
                            <tr>
                                <th className="p-4 w-12 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={toggleSelectAll}
                                        aria-label="Chọn tất cả"
                                        className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
                                    />
                                </th>
                                <th className="p-4">Thời gian</th>
                                <th className="p-4">Người nhận</th>
                                <th className="p-4">Lệnh sản xuất</th>
                                <th className="p-4">Sản phẩm</th>
                                <th className="p-4">Chi tiết Số lượng</th>
                                <th className="p-4">Ghi chú</th>
                                <th className="p-4 text-right w-24">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                            {filteredHistory.map(item => {
                                const isSelected = selectedIds.has(item.id)
                                return (
                                    <tr
                                        key={item.id}
                                        className={`transition-colors ${
                                            isSelected
                                                ? 'bg-orange-50/70 dark:bg-orange-950/20'
                                                : 'hover:bg-stone-50 dark:hover:bg-zinc-900/50'
                                        }`}
                                    >
                                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectOne(item.id)}
                                                aria-label={`Chọn bản ghi ${item.worker_name}`}
                                                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
                                            />
                                        </td>
                                        <td className="p-4 text-sm font-medium text-stone-500">
                                            {format(new Date(item.return_date || item.created_at), 'dd/MM/yyyy HH:mm')}
                                        </td>
                                        <td className="p-4 text-sm font-bold text-stone-800 dark:text-gray-200">
                                            {item.worker_name}
                                        </td>
                                        <td className="p-4">
                                            {item.productions ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                                        <Factory size={14} />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-stone-800 dark:text-gray-200">{item.productions.code}</div>
                                                        <div className="text-[10px] text-stone-500 truncate max-w-[120px]">{item.productions.name}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-stone-400 font-medium italic">Không gắn lệnh</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-sm text-stone-800 dark:text-gray-200 flex items-center gap-2">
                                                {item.products?.name || 'Sản phẩm đã gỡ liên kết'}
                                                {item.tag && (
                                                    <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-[9px] font-bold font-mono border border-orange-200 dark:border-orange-800/50">
                                                        {item.tag.replace('@', item.products?.sku || '')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-stone-500">{item.products?.sku}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1 pr-4">
                                                <div className="flex justify-between items-center text-[11px]">
                                                    <span className="text-stone-500 italic">Tổng cấp phát:</span>
                                                    <span className="font-bold text-orange-600">{item.quantity} {item.unit}</span>
                                                </div>
                                                
                                                <div className="flex justify-between items-center text-[11px]">
                                                    <span className="text-stone-500 italic">Tổng thu hồi:</span>
                                                    <span className="font-bold text-emerald-600">{item.returned_quantity || 0} {item.unit}</span>
                                                </div>

                                                <div className="flex justify-between items-center text-xs border-t border-stone-200 dark:border-zinc-700 pt-1.5 mt-1">
                                                    <span className="font-black text-stone-800 dark:text-gray-300">TIÊU HAO:</span>
                                                    <span className="font-black text-red-600 text-sm">
                                                        {(Number(item.quantity) - (Number(item.returned_quantity) || 0)).toFixed(2).replace(/\.00$/, '')} {item.unit}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-stone-500 max-w-xs truncate" title={item.notes}>
                                            {item.notes || '-'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => setDeleteConfirmItem(item)}
                                                className="p-2 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                                title="Xóa bản ghi này"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Confirm Single Delete */}
            <ConfirmDialog
                isOpen={!!deleteConfirmItem}
                title="Xóa bản ghi lịch sử"
                message={`Bạn có chắc muốn xóa lịch sử cấp phát của công nhân "${deleteConfirmItem?.worker_name}" cho sản phẩm "${deleteConfirmItem?.products?.name || 'này'}" không?`}
                confirmText="XÓA BẢN GHI"
                cancelText="HỦY BỎ"
                variant="danger"
                onConfirm={executeDeleteOne}
                onCancel={() => setDeleteConfirmItem(null)}
            />

            {/* Confirm Bulk Delete */}
            <ConfirmDialog
                isOpen={isBulkDeleteConfirmOpen}
                title="Xóa các bản ghi đã chọn"
                message={`Bạn có chắc muốn xóa vĩnh viễn ${selectedIds.size} bản ghi lịch sử cấp phát đã chọn?`}
                confirmText={deleting ? "ĐANG XÓA..." : `XÓA ${selectedIds.size} BẢN GHI`}
                cancelText="HỦY BỎ"
                variant="danger"
                onConfirm={executeBulkDelete}
                onCancel={() => {
                    if (!deleting) setIsBulkDeleteConfirmOpen(false)
                }}
            />

            {/* Confirm Delete All */}
            <ConfirmDialog
                isOpen={isDeleteAllConfirmOpen}
                title="Xóa toàn bộ lịch sử cấp phát"
                message={`Hành động này sẽ XÓA SẠCH toàn bộ ${history.length} bản ghi lịch sử cấp phát đã hoàn tất trong kho này. Hành động này không thể hoàn tác.`}
                confirmText={deleting ? "ĐANG XÓA..." : "XÓA TOÀN BỘ LỊCH SỬ"}
                cancelText="HỦY BỎ"
                variant="danger"
                onConfirm={executeDeleteAll}
                onCancel={() => {
                    if (!deleting) setIsDeleteAllConfirmOpen(false)
                }}
            />
        </div>
    )
}
