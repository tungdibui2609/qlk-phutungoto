'use client'

import React, { useState, useEffect } from 'react'
import { BarChart3, Factory, Package, ArrowUpRight, ArrowDownLeft, AlertTriangle, RefreshCw, Layers, History } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { productionLoanService } from '@/services/production-inventory/productionLoanService'
import { useSystem } from '@/contexts/SystemContext'
import { formatQuantityFull } from '@/lib/numberUtils'
import { LoanHistory } from './LoanHistory'
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
    PieChart, Pie
} from 'recharts'

export const AllocationStats = () => {
    const { systemType } = useSystem()
    const [stats, setStats] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (systemType) fetchStats()
    }, [systemType])

    const fetchStats = async () => {
        setLoading(true)
        try {
            const data = await productionLoanService.getAllocationStatsByProduction(supabase, systemType!)
            setStats(data || [])
        } catch (error) {
            console.error('Error fetching allocation stats:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw className="animate-spin text-orange-500 mb-4" size={32} />
                <p className="text-stone-500 font-medium">Đang tải dữ liệu thống kê...</p>
            </div>
        )
    }

    // Process data for charts
    const chartData = stats.reduce((acc: any[], curr: any) => {
        const existing = acc.find(item => item.production_code === curr.production_code)
        if (existing) {
            existing.issued += Number(curr.total_issued)
            existing.returned += Number(curr.total_returned)
            existing.lost += Number(curr.total_lost)
        } else {
            acc.push({
                production_code: curr.production_code,
                production_name: curr.production_name,
                issued: Number(curr.total_issued),
                returned: Number(curr.total_returned),
                lost: Number(curr.total_lost)
            })
        }
        return acc
    }, []).slice(0, 10) // Top 10 productions

    const totalStats = stats.reduce((acc, curr) => ({
        issued: acc.issued + Number(curr.total_issued),
        returned: acc.returned + Number(curr.total_returned),
        lost: acc.lost + Number(curr.total_lost)
    }), { issued: 0, returned: 0, lost: 0 })

    const COLORS = ['#f97316', '#10b981', '#ef4444']

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-[24px] border border-stone-100 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-all duration-500" />
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl text-orange-600">
                            <ArrowUpRight size={28} />
                        </div>
                        <div>
                            <div className="text-stone-500 text-xs font-black uppercase tracking-widest mb-1">Tổng cấp phát</div>
                            <div className="text-3xl font-black text-stone-900 dark:text-white leading-none">
                                {formatQuantityFull(totalStats.issued)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-800 p-6 rounded-[24px] border border-stone-100 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-500" />
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600">
                            <ArrowDownLeft size={28} />
                        </div>
                        <div>
                            <div className="text-stone-500 text-xs font-black uppercase tracking-widest mb-1">Tổng thu hồi</div>
                            <div className="text-3xl font-black text-stone-900 dark:text-white leading-none">
                                {formatQuantityFull(totalStats.returned)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-800 p-6 rounded-[24px] border border-stone-100 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-400/5 rounded-full blur-2xl group-hover:bg-red-400/10 transition-all duration-500" />
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl text-red-600">
                            <AlertTriangle size={28} />
                        </div>
                        <div>
                            <div className="text-stone-500 text-xs font-black uppercase tracking-widest mb-1">Thất thoát / Hỏng</div>
                            <div className="text-3xl font-black text-stone-900 dark:text-white leading-none">
                                {formatQuantityFull(totalStats.lost)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Bar Chart */}
                <div className="bg-white dark:bg-zinc-800 p-8 rounded-[32px] border border-stone-100 dark:border-zinc-700 shadow-xl">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
                                <BarChart3 className="text-orange-500" size={24} />
                                Cấp phát theo Lệnh
                            </h3>
                            <p className="text-sm text-stone-400 font-medium">Top 10 lệnh sản xuất có khối lượng cấp phát lớn nhất</p>
                        </div>
                    </div>
                    
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis 
                                    dataKey="production_code" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f8fafc' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 700 }} />
                                <Bar dataKey="issued" name="Đã cấp" fill="#f97316" radius={[6, 6, 0, 0]} barSize={24} />
                                <Bar dataKey="returned" name="Đã trả" fill="#10b981" radius={[6, 6, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status List */}
                <div className="bg-white dark:bg-zinc-800 p-8 rounded-[32px] border border-stone-100 dark:border-zinc-700 shadow-xl">
                    <h3 className="text-xl font-black text-stone-900 dark:text-white flex items-center gap-2 mb-8">
                        <Layers className="text-orange-500" size={24} />
                        Chi tiết từng Lệnh
                    </h3>
                    
                    <div className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                        {chartData.length === 0 ? (
                            <div className="text-center py-20 text-stone-400">Không có dữ liệu</div>
                        ) : (
                            chartData.map((item, idx) => {
                                const returnRate = item.issued > 0 ? Math.round((item.returned / item.issued) * 100) : 0
                                return (
                                    <div key={idx} className="p-4 rounded-2xl bg-stone-50 dark:bg-zinc-900/50 border border-stone-100 dark:border-zinc-800 hover:border-orange-200 transition-all group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center font-black text-orange-500 shadow-sm border border-stone-100 dark:border-zinc-700">
                                                    {item.production_code.slice(-2)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-stone-800 dark:text-white uppercase leading-tight">{item.production_code}</div>
                                                    <div className="text-[10px] text-stone-400 font-bold truncate max-w-[150px]">{item.production_name}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-stone-400 font-black uppercase tracking-widest mb-1">Tỷ lệ thu hồi</div>
                                                <div className={`text-sm font-black ${returnRate >= 90 ? 'text-emerald-500' : 'text-orange-500'}`}>
                                                    {returnRate}%
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="w-full h-1.5 bg-stone-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full transition-all duration-1000 ${returnRate >= 90 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                                                style={{ width: `${returnRate}%` }}
                                            />
                                        </div>
                                        
                                        <div className="mt-3 flex gap-4 text-[10px] font-black uppercase text-stone-400">
                                            <div className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-orange-500" />
                                                Cấp: {formatQuantityFull(item.issued)}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                Trả: {formatQuantityFull(item.returned)}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Product Summary Table */}
            <div className="bg-white dark:bg-zinc-800 rounded-[32px] border border-stone-100 dark:border-zinc-700 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-stone-50 dark:border-zinc-800 flex justify-between items-center">
                    <h3 className="text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
                        <Package className="text-orange-500" size={24} />
                        Vật tư cấp phát theo Sản phẩm
                    </h3>
                    <div className="px-4 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                        {stats.length} Loại vật tư
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-stone-50/50 dark:bg-zinc-900/50 text-stone-400 text-[10px] font-black uppercase tracking-widest">
                                <th className="px-8 py-5">Vật tư / Sản phẩm</th>
                                <th className="px-6 py-5">Mã lệnh</th>
                                <th className="px-6 py-5 text-right">Tổng cấp phát</th>
                                <th className="px-6 py-5 text-right">Tổng đã trả</th>
                                <th className="px-6 py-5 text-right">Thất thoát</th>
                                <th className="px-6 py-5 text-center">ĐVT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50 dark:divide-zinc-800">
                            {stats.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center text-stone-400 font-bold italic">
                                        Chưa có dữ liệu cấp phát
                                    </td>
                                </tr>
                            ) : (
                                stats.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="font-bold text-stone-800 dark:text-white group-hover:text-orange-600 transition-colors">{item.product_name}</div>
                                            <div className="text-[10px] text-stone-400 font-mono tracking-tighter uppercase">{item.product_sku || '-'}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-xs font-black px-2.5 py-1 bg-stone-100 dark:bg-zinc-800 rounded-lg text-stone-600 dark:text-stone-400">
                                                {item.production_code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right font-black text-stone-900 dark:text-white">
                                            {formatQuantityFull(item.total_issued)}
                                        </td>
                                        <td className="px-6 py-5 text-right font-black text-emerald-600">
                                            {formatQuantityFull(item.total_returned)}
                                        </td>
                                        <td className="px-6 py-5 text-right font-black text-red-500">
                                            {formatQuantityFull(item.total_lost)}
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="px-2 py-0.5 rounded bg-stone-50 dark:bg-zinc-900 text-[10px] font-bold text-stone-500">
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

            {/* Detailed Journal */}
            <div className="space-y-4">
                <h3 className="text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="text-orange-500" size={24} />
                    Nhật ký Cấp phát Chi tiết
                </h3>
                <LoanHistory />
            </div>
        </div>
    )
}
