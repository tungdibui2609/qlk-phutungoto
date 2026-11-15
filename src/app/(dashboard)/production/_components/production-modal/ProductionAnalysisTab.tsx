'use client'

import React from 'react'
import { Calendar, Activity, Package, Warehouse, Scale, TrendingUp, PieChart, ArrowRight } from 'lucide-react'
import { formatQuantityFull } from '@/lib/numberUtils'

interface ProductionAnalysisTabProps {
    analysisSummary: any
    summary: any
    dailyStats: any[]
    productionType: 'NEW' | 'RE_SORT'
    name: string
    startDate: string
    endDate: string
}

export function ProductionAnalysisTab({
    analysisSummary,
    summary,
    dailyStats,
    productionType,
    name,
    startDate,
    endDate,
}: ProductionAnalysisTabProps) {
    return (
        <>
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                {/* Progress Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[32px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-500/10 rounded-lg">
                                    <PieChart size={18} className="text-emerald-600" />
                                </div>
                                <span className="text-xs font-black uppercase tracking-widest text-stone-500">Tiến độ sản xuất</span>
                            </div>
                            <span className="text-lg font-black text-emerald-600">{summary.rate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-stone-100 dark:bg-zinc-700 h-3 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(100, summary.rate)}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-stone-400">
                            <span>THỰC TẾ: {summary.actual.toLocaleString('vi-VN')} KG</span>
                            <span>KẾ HOẠCH: {summary.planned.toLocaleString('vi-VN')} KG</span>
                        </div>
                    </div>

                    <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[32px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <Calendar size={18} className="text-blue-600" />
                                </div>
                                <span className="text-xs font-black uppercase tracking-widest text-stone-500">Tiến độ thời gian</span>
                            </div>
                            <span className="text-lg font-black text-blue-600">{analysisSummary.timeProgress.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-stone-100 dark:bg-zinc-700 h-3 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${analysisSummary.timeProgress}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-stone-400">
                            <span>BẮT ĐẦU: {startDate ? new Date(startDate).toLocaleDateString('vi-VN') : '---'}</span>
                            <span>KẾ THÚC: {endDate ? new Date(endDate).toLocaleDateString('vi-VN') : '---'}</span>
                        </div>
                    </div>
                </div>

                {/* Material Analysis (Production Loans) */}
                <div className="p-8 bg-black/5 dark:bg-white/5 rounded-[32px] border border-stone-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm text-emerald-600">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <h3 className="font-black text-stone-900 dark:text-white uppercase tracking-widest text-sm">Phân tích tỉ lệ tiêu hao Vật tư</h3>
                            <p className="text-xs text-stone-500 font-bold italic">Dựa trên {analysisSummary?.actualTons.toFixed(2)} tấn thành phẩm thực tế</p>
                        </div>
                    </div>

                    {!analysisSummary || analysisSummary.materials.length === 0 ? (
                        <div className="p-12 text-center text-stone-400 font-bold bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-stone-300 dark:border-zinc-700">
                            Chưa có dữ liệu cấp phát vật tư để phân tích.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {analysisSummary.materials.map((m: any, idx: number) => (
                                <div key={idx} className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-stone-100 dark:border-zinc-700 shadow-sm flex flex-col gap-3 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Package size={48} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-tighter truncate">{m.name}</span>
                                        <span className="text-[9px] font-mono text-stone-300">{m.sku}</span>
                                    </div>

                                    <div className="flex items-center gap-4 mt-2">
                                        <div className="flex-1 flex flex-col items-center">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase">TIÊU THỤ</span>
                                            <span className="text-sm font-black text-stone-700 dark:text-stone-200">{formatQuantityFull(m.total)} <span className="text-[10px]">{m.unit}</span></span>
                                        </div>
                                        <ArrowRight size={16} className="text-stone-200" />
                                        <div className="flex-1 flex flex-col items-center">
                                            <span className="text-[10px] font-black text-emerald-600 uppercase">TỈ LỆ / TẤN</span>
                                            <span className="text-lg font-black text-emerald-600">
                                                {m.perTon.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                                                <span className="text-[10px] ml-1 font-bold">{m.unit}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Daily Productivity Analysis */}
                <div className="p-8 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-[32px] border border-emerald-100 dark:border-emerald-900/20">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm text-emerald-600">
                                <Activity size={24} />
                            </div>
                            <div>
                                <h3 className="font-black text-stone-900 dark:text-white uppercase tracking-widest text-sm">Năng suất sản xuất hàng ngày</h3>
                                <p className="text-xs text-stone-500 font-bold italic">Thống kê sản lượng thực tế theo ngày nhập kho</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Trung bình/Ngày</div>
                                <div className="text-sm font-black text-emerald-600">
                                    {analysisSummary.avgOutput.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} Kg
                                </div>
                            </div>
                            <div className="w-px h-8 bg-stone-200 dark:bg-zinc-800" />
                            <div className="text-right">
                                <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Ngày cao điểm</div>
                                <div className="text-sm font-black text-orange-600">
                                    {analysisSummary.peakDay ? formatQuantityFull(analysisSummary.peakDay.quantity) : 0} Kg
                                </div>
                            </div>
                        </div>
                    </div>

                    {dailyStats.length === 0 ? (
                        <div className="p-12 text-center text-stone-400 font-bold bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-stone-300 dark:border-zinc-700">
                            Chưa có dữ liệu sản lượng hàng ngày.
                        </div>
                    ) : (
                        <div className="flex flex-col lg:flex-row gap-8">
                            {/* Daily Bar Chart with Grid */}
                            <div className="flex-1 bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-stone-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                                {/* Background Grid Lines */}
                                <div className="absolute inset-x-8 inset-y-8 flex flex-col justify-between pointer-events-none">
                                    {[0, 1, 2, 3, 4].map((i) => (
                                        <div key={i} className="w-full h-px bg-stone-50 dark:bg-zinc-800/50" />
                                    ))}
                                </div>

                                <div className="h-64 w-full flex items-end gap-3 px-2 relative z-10">
                                    {dailyStats.map((s, idx) => {
                                        const height = analysisSummary.peakDay ? (s.quantity / analysisSummary.peakDay.quantity) * 100 : 0;
                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                                {/* Tooltip */}
                                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 shadow-xl scale-90 group-hover:scale-100">
                                                    {formatQuantityFull(s.quantity)} Kg
                                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 rotate-45" />
                                                </div>

                                                {/* Bar with gradient and shadow */}
                                                <div 
                                                    className="w-full max-w-[40px] bg-gradient-to-t from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 rounded-t-xl transition-all duration-700 cursor-help shadow-[0_-4px_12px_rgba(16,185,129,0.2)]"
                                                    style={{ height: `${Math.max(8, height)}%` }}
                                                />

                                                {/* Date Label */}
                                                <div className="absolute -bottom-10 flex flex-col items-center">
                                                    <div className="text-[9px] font-black text-stone-400 uppercase tracking-tighter">
                                                        {new Date(s.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                {/* Legend spacing */}
                                <div className="h-8" /> 
                            </div>

                            {/* Daily List */}
                            <div className="w-full lg:w-72 flex flex-col gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                {dailyStats.map((s, idx) => (
                                    <div key={idx} className="bg-white/50 dark:bg-zinc-800/40 p-3 rounded-xl border border-stone-100 dark:border-zinc-800 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-stone-500 uppercase tracking-tight">
                                                {new Date(s.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                            </span>
                                            <span className="text-[9px] text-stone-400 font-bold">{s.date}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-black text-stone-800 dark:text-gray-200">{formatQuantityFull(s.quantity)} <span className="text-[9px] text-stone-400">Kg</span></div>
                                            {analysisSummary.peakDay?.date === s.date && (
                                                <div className="text-[8px] text-orange-500 font-bold uppercase tracking-tighter">Cao điểm 🏆</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Raw Material Input Analysis (Only for RE_SORT) */}
                {productionType === 'RE_SORT' && analysisSummary && (
                    <div className="p-8 bg-orange-500/5 dark:bg-orange-500/10 rounded-[32px] border border-orange-200 dark:border-orange-900/20">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm text-orange-600">
                                <Warehouse size={24} />
                            </div>
                            <div>
                                <h3 className="font-black text-stone-900 dark:text-white uppercase tracking-widest text-sm">Phân tích nguyên liệu đầu vào (Từ Kho)</h3>
                                <p className="text-xs text-stone-500 font-bold italic">Tổng cộng {formatQuantityFull(summary.totalInputWeight)} Kg nguyên liệu</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(analysisSummary.inputStats || []).map((s: any, idx: number) => (
                                <div key={idx} className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-stone-100 dark:border-zinc-700 shadow-sm flex flex-col gap-3 relative overflow-hidden group">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-tighter truncate">{s.name}</span>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-[14px] font-black text-stone-800 dark:text-gray-100">
                                                {formatQuantityFull(s.totalWeight)} Kg
                                            </span>
                                            <span className="text-[10px] bg-orange-100/50 dark:bg-orange-950/30 text-orange-600 px-2 py-0.5 rounded-lg font-bold">
                                                {s.lotCount} LOT
                                            </span>
                                        </div>
                                    </div>

                                    <div className="h-px bg-stone-50 dark:bg-zinc-800 w-full" />

                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-stone-400 uppercase">Tỉ lệ so với thành phẩm</span>
                                        <span className="text-sm font-black text-stone-800 dark:text-white">
                                            {summary.actual > 0 ? ((s.totalWeight / summary.actual) * 100).toFixed(1) : 0}%
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {/* Summary Card for RE_SORT */}
                            <div className="bg-gradient-to-br from-orange-600 to-orange-700 p-6 rounded-2xl shadow-lg text-white flex flex-col justify-between relative overflow-hidden">
                                <div className="absolute -right-4 -bottom-4 opacity-10">
                                    <Scale size={86} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Hao hụt sản xuất</span>
                                <div className="mt-2">
                                    <div className="text-2xl font-black">{formatQuantityFull(summary.lossWeight)} Kg</div>
                                    <div className="text-xs font-bold opacity-80">Tương đương {summary.lossRate.toFixed(1)}%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
