'use client'

import React, { useState, useEffect } from 'react'
import { History, RefreshCw, Search, ExternalLink, Building, Package, FileText, Trash2, Edit } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { productionLoanService } from '@/services/production-inventory/productionLoanService'
import { useSystem } from '@/contexts/SystemContext'
import { format } from 'date-fns'
import { EditSiteInboundModal } from './EditSiteInboundModal'

export const SiteInboundHistory = () => {
    const { systemType } = useSystem()
    const { showToast, showConfirm } = useToast()
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const [editingLot, setEditingLot] = useState<any>(null)

    useEffect(() => {
        if (systemType) fetchHistory()
    }, [systemType])

    const fetchHistory = async () => {
        setLoading(true)
        try {
            const data = await productionLoanService.getInboundHistory(supabase, systemType!)
            setHistory(data || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (lot: any) => {
        if (!await showConfirm(`Bạn có chắc muốn xóa phiếu nhập ${lot.code}? Thao tác này sẽ xóa vĩnh viễn dữ liệu tồn kho liên quan.`)) return

        setIsDeleting(lot.id)
        try {
            // Check if LOT has any issuance history (simple check via status or quantity)
            // If it's still 'active' and quantity matches initial? Hard to check exactly without logs.
            // But we can check if there are any site_loans associated with this LOT?
            // (Note: Currently site_loans don't link directly to LOT, they just subtract from the overall stock).
            // Actually, for Direct Site Inbound, the LOT IS the stock.
            
            // Delete lot_items first
            const { error: itemErr } = await supabase.from('lot_items').delete().eq('lot_id', lot.id)
            if (itemErr) throw itemErr

            // Delete the lot
            const { error: lotErr } = await supabase.from('lots').delete().eq('id', lot.id)
            if (lotErr) throw lotErr

            showToast('Đã xóa phiếu nhập và tồn kho liên quan', 'success')
            fetchHistory()
        } catch (error: any) {
            console.error(error)
            showToast('Lỗi khi xóa: ' + error.message, 'error')
        } finally {
            setIsDeleting(null)
        }
    }

    const filteredHistory = history.filter(item => {
        const productNames = item.lot_items?.map((li: any) => li.products?.name).join(' ').toLowerCase() || ''
        const supplierName = item.suppliers?.name?.toLowerCase() || ''
        const code = item.code.toLowerCase()
        const search = searchTerm.toLowerCase()
        return productNames.includes(search) || supplierName.includes(search) || code.includes(search)
    })

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-stone-200 dark:border-zinc-700 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm lịch sử nhập hàng (Mã LOT, Sản phẩm, Nhà cung cấp)..."
                        className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border-none rounded-xl font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <button 
                    onClick={fetchHistory}
                    className="p-2.5 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-900 rounded-xl transition-all"
                >
                    <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20 animate-pulse">
                    <RefreshCw className="animate-spin text-emerald-500 mb-4" size={32} />
                </div>
            ) : filteredHistory.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-800 rounded-[32px] border border-dashed border-stone-200 dark:border-zinc-700">
                    <History className="mx-auto text-stone-300 dark:text-zinc-600 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-stone-500 dark:text-zinc-400">Chưa có lịch sử nhập linh kiện / vật tư</h3>
                    <p className="text-sm text-stone-400 mt-1">Sử dụng nút "Nhập hàng trực tiếp" để bắt đầu.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-800 rounded-[32px] border border-stone-100 dark:border-zinc-700 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-stone-50/50 dark:bg-zinc-900/50 text-stone-400 text-[11px] font-black uppercase tracking-widest border-b border-stone-100 dark:border-zinc-800">
                                    <th className="px-6 py-5">Ngày Nhập</th>
                                    <th className="px-6 py-5">Mã Lô (LOT)</th>
                                    <th className="px-6 py-5">Sản phẩm / Vật tư</th>
                                    <th className="px-6 py-5">Nhà cung cấp</th>
                                    <th className="px-6 py-5 text-center">Bằng chứng / HĐ</th>
                                    <th className="px-6 py-5">Ghi chú</th>
                                    <th className="px-6 py-5 text-center">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-50 dark:divide-zinc-800">
                                {filteredHistory.map(item => (
                                    <tr key={item.id} className="hover:bg-stone-50/50 dark:hover:bg-zinc-900/30 transition-colors group">
                                        <td className="px-6 py-5 text-sm font-medium text-stone-500">
                                            {format(new Date(item.inbound_date || item.created_at), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="whitespace-nowrap font-mono text-xs font-bold bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-zinc-700">
                                                {item.code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            {item.lot_items?.map((li: any, idx: number) => (
                                                <div key={idx} className="flex items-center gap-2 mb-1 last:mb-0">
                                                    <Package size={14} className="text-stone-400" />
                                                    <div>
                                                        <div className="font-bold text-sm text-stone-800 dark:text-gray-200 leading-none">{li.products?.name}</div>
                                                        <div className="text-[10px] text-stone-500 uppercase tracking-tighter mt-1">
                                                            SL: {li.quantity} {li.unit} | SKU: {li.products?.sku || '-'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <Building size={16} className="text-stone-400" />
                                                <span className="text-sm font-bold text-stone-700 dark:text-gray-300">
                                                    {item.suppliers?.name || <span className="text-stone-400 font-normal italic">Không xác định</span>}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            {item.metadata?.invoice_view_link ? (
                                                <a 
                                                    href={item.metadata.invoice_view_link} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 transition-all font-bold text-xs"
                                                >
                                                    <ExternalLink size={14} />
                                                    Xem HĐ
                                                </a>
                                            ) : (
                                                <span className="text-stone-300 dark:text-zinc-700">
                                                    <FileText size={18} className="mx-auto opacity-20" />
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-sm text-stone-500 max-w-xs truncate italic" title={item.notes || item.metadata?.notes}>
                                            {item.notes || item.metadata?.notes || '-'}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => setEditingLot(item)}
                                                    className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                                    title="Chỉnh sửa phiếu nhập"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    disabled={isDeleting === item.id}
                                                    className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                    title="Xóa phiếu nhập"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {editingLot && (
                <EditSiteInboundModal
                    lot={editingLot}
                    isOpen={!!editingLot}
                    onClose={() => setEditingLot(null)}
                    onSuccess={fetchHistory}
                />
            )}
        </div>
    )
}
