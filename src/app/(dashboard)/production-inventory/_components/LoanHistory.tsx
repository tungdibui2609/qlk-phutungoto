'use client'

import React, { useState, useEffect } from 'react'
import { History, RefreshCw, Search, Factory } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { productionLoanService } from '@/services/production-inventory/productionLoanService'
import { useSystem } from '@/contexts/SystemContext'
import { format } from 'date-fns'

export const LoanHistory = () => {
    const { systemType } = useSystem()
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        if (systemType) fetchHistory()
    }, [systemType])

    const fetchHistory = async () => {
        setLoading(true)
        try {
            const data = await productionLoanService.getHistory(supabase, systemType!)
            setHistory(data || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const filteredHistory = history.filter(item =>
        item.worker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.products?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-stone-200 dark:border-zinc-700">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm lịch sử..."
                        className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border-none rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-stone-400" /></div>
            ) : filteredHistory.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-800 rounded-3xl border border-dashed border-stone-200 dark:border-zinc-700">
                    <History className="mx-auto text-stone-300 dark:text-zinc-600 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-stone-500 dark:text-zinc-400">Chưa có lịch sử cấp phát</h3>
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-stone-50 dark:bg-zinc-900 text-stone-500 dark:text-gray-400 text-xs font-bold uppercase">
                            <tr>
                                <th className="p-4">Thời gian</th>
                                <th className="p-4">Người nhận</th>
                                <th className="p-4">Lệnh sản xuất</th>
                                <th className="p-4">Sản phẩm</th>
                                <th className="p-4">Chi tiết Số lượng</th>
                                <th className="p-4">Trạng thái</th>
                                <th className="p-4">Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                            {filteredHistory.map(item => (
                                <tr key={item.id} className="hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition-colors">
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
                                            {item.products?.name}
                                            {item.tag && (
                                                <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-[9px] font-bold font-mono border border-orange-200 dark:border-orange-800/50">
                                                    {item.tag.replace('@', item.products?.sku || '')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-stone-500">{item.products?.sku}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-stone-500">Cấp phát:</span>
                                                <span className="font-bold text-orange-600">{item.quantity} {item.unit}</span>
                                            </div>
                                            
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-stone-500">Thu hồi:</span>
                                                <span className="font-bold text-emerald-600">{item.returned_quantity || 0} {item.unit}</span>
                                            </div>

                                            <div className="flex justify-between items-center text-[11px] border-t border-stone-100 dark:border-zinc-800 pt-1 mt-1">
                                                <span className="text-stone-500">{item.status === 'active' ? 'Đang tiêu dùng:' : 'Tiêu hao cuối:'}</span>
                                                <span className="font-bold text-red-600">
                                                    {(Number(item.quantity) - (Number(item.returned_quantity) || 0)).toFixed(2).replace(/\.00$/, '')} {item.unit}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                                item.status === 'active' 
                                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400'
                                                : item.status === 'returned'
                                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400'
                                            }`}>
                                            {item.status === 'active' ? 'Đang cấp phát' : item.status === 'returned' ? 'Hoàn tất' : 'Mất / Hỏng'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-stone-500 max-w-xs truncate" title={item.notes}>
                                        {item.notes || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
