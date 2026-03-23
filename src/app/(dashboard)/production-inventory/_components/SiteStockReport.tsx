'use client'

import React, { useState, useEffect } from 'react'
import { Package, Hash, Warehouse, Factory, FileText, Search, RefreshCw, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { productionLoanService } from '@/services/production-inventory/productionLoanService'
import { useSystem } from '@/contexts/SystemContext'
import { formatQuantityFull } from '@/lib/numberUtils'

export const SiteStockReport = () => {
    const { systemType } = useSystem()
    const [summary, setSummary] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        if (systemType) fetchData()
    }, [systemType])

    const fetchData = async () => {
        setLoading(true)
        try {
            const data = await productionLoanService.getSiteInventorySummary(supabase, systemType!)
            setSummary(data)
        } catch (error) {
            console.error('Error fetching site summary:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredSummary = summary.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <RefreshCw className="animate-spin text-orange-500 mb-4" size={32} />
                <p className="text-stone-500 font-medium">Đang tổng hợp dữ liệu tồn kho...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-[24px] border border-stone-100 dark:border-zinc-700 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600">
                            <Layers size={24} />
                        </div>
                        <div>
                            <div className="text-stone-500 text-sm font-bold">Tổng chủng loại</div>
                            <div className="text-2xl font-black text-stone-900 dark:text-white">{summary.length}</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-[24px] border border-stone-100 dark:border-zinc-700 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600">
                            <Warehouse size={24} />
                        </div>
                        <div>
                            <div className="text-stone-500 text-sm font-bold">Tổng tồn trong kho</div>
                            <div className="text-2xl font-black text-stone-900 dark:text-white">
                                {formatQuantityFull(summary.reduce((acc, curr) => acc + curr.inStock, 0))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-[24px] border border-stone-100 dark:border-zinc-700 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-2xl text-orange-600">
                            <Factory size={24} />
                        </div>
                        <div>
                            <div className="text-stone-500 text-sm font-bold">Tổng đang cấp phát</div>
                            <div className="text-2xl font-black text-stone-900 dark:text-white">
                                {formatQuantityFull(summary.reduce((acc, curr) => acc + curr.inUse, 0))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter & Actions */}
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-3xl border border-stone-100 dark:border-zinc-700 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                <div className="relative flex-1 w-full md:w-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm vật tư theo tên hoặc SKU..."
                        className="w-full pl-12 pr-4 py-3 bg-stone-50 dark:bg-zinc-900 border-none rounded-2xl font-medium outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <button 
                    onClick={() => fetchData()}
                    className="p-3 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-900 rounded-2xl transition-all"
                    title="Làm mới"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-800 rounded-[32px] border border-stone-100 dark:border-zinc-700 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-stone-50/50 dark:bg-zinc-900/50 text-stone-400 text-[11px] font-black uppercase tracking-widest">
                                <th className="px-6 py-5">Vật tư / Sản phẩm</th>
                                <th className="px-6 py-5">SKU</th>
                                <th className="px-6 py-5 text-right">Tồn trong kho</th>
                                <th className="px-6 py-5 text-right">Đang cấp phát</th>
                                <th className="px-6 py-5 text-right">Tổng tại Site</th>
                                <th className="px-6 py-5 text-center">ĐVT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50 dark:divide-zinc-800">
                            {filteredSummary.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center text-stone-400">
                                            <Package size={48} className="mb-4 opacity-20" />
                                            <p className="font-bold">Không tìm thấy vật tư nào</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSummary.map((item, idx) => (
                                    <tr key={item.productId} className="hover:bg-stone-50/50 dark:hover:bg-zinc-900/30 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-zinc-800 flex items-center justify-center text-stone-400 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/30 group-hover:text-orange-500 transition-colors">
                                                    <Package size={20} />
                                                </div>
                                                <div className="font-bold text-stone-800 dark:text-gray-200">{item.name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-sm font-mono text-stone-500 uppercase tracking-tighter">
                                            {item.sku || '-'}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className="font-black text-emerald-600 dark:text-emerald-500">
                                                {formatQuantityFull(item.inStock)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className="font-black text-orange-600 dark:text-orange-500">
                                                {formatQuantityFull(item.inUse)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="inline-block px-3 py-1 rounded-lg bg-stone-100 dark:bg-zinc-800 font-black text-stone-900 dark:text-white">
                                                {formatQuantityFull(item.inStock + item.inUse)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="text-xs font-bold px-2 py-1 bg-stone-50 dark:bg-zinc-900 rounded-md text-stone-500">
                                                {item.unit}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="p-4 bg-orange-50/50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/20">
                <p className="text-xs text-orange-700 dark:text-orange-400 flex items-center gap-2 font-medium">
                    <FileText size={14} /> 
                    Ghi chú: Báo cáo này tổng hợp dữ liệu từ "Hàng lẻ tại phân xưởng" (Kho) và "Sổ cấp phát" (Đang cấp phát). 
                    Giúp quản lý biết chính xác tổng số lượng vật tư thực tế đang có mặt tại khu vực sản xuất.
                </p>
            </div>
        </div>
    )
}
