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
    startDate,
    endDate,
}: ProductionAnalysisTabProps) {
    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-200">
            {/* Progress Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 bg-white dark:bg-zinc-800/40 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                                <PieChart size={15} className="text-emerald-600" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Tiến độ sản xuất</span>
                        </div>
                        <span className="text-sm font-bold text-emerald-600">{summary.rate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.min(100, summary.rate)}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] font-medium text-stone-500">
                        <span>Thực tế: <strong>{summary.actual.toLocaleString('vi-VN')} kg</strong></span>
                        <span>Kế hoạch: <strong>{summary.planned.toLocaleString('vi-VN')} kg</strong></span>
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-zinc-800/40 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-500/10 rounded-lg">
                                <Calendar size={15} className="text-blue-600" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Tiến độ thời gian</span>
                        </div>
                        <span className="text-sm font-bold text-blue-600">{analysisSummary.timeProgress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${analysisSummary.timeProgress}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] font-medium text-stone-500">
                        <span>Bắt đầu: {startDate ? new Date(startDate).toLocaleDateString('vi-VN') : '---'}</span>
                        <span>Kết thúc: {endDate ? new Date(endDate).toLocaleDateString('vi-VN') : '---'}</span>
                    </div>
                </div>
            </div>

            {/* Material Analysis */}
            <div className="p-4 bg-stone-50/80 dark:bg-zinc-800/30 rounded-xl border border-stone-200 dark:border-zinc-800">
                <div className="flex items-center gap-2.5 mb-3.5">
                    <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg shadow-xs text-emerald-600 border border-stone-200/70 dark:border-zinc-700">
                        <TrendingUp size={16} />
                    </div>
                    <div>
                        <h3 className="font-bold text-stone-800 dark:text-white text-xs uppercase tracking-wider">Phân tích tỉ lệ tiêu hao Vật tư</h3>
                        <p className="text-[11px] text-stone-500">Dựa trên {analysisSummary?.actualTons.toFixed(2)} tấn thành phẩm thực tế</p>
                    </div>
                </div>

                {!analysisSummary || analysisSummary.materials.length === 0 ? (
                    <div className="p-6 text-center text-xs text-stone-400 bg-white/60 dark:bg-zinc-900/50 rounded-lg border border-dashed border-stone-300 dark:border-zinc-700">
                        Chưa có dữ liệu cấp phát vật tư để phân tích.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {analysisSummary.materials.map((m: any, idx: number) => (
                            <div key={idx} className="bg-white dark:bg-zinc-800 p-3.5 rounded-xl border border-stone-200/80 dark:border-zinc-700 shadow-xs flex flex-col gap-2 relative overflow-hidden">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-stone-700 dark:text-zinc-200 truncate">{m.name}</span>
                                    <span className="text-[10px] font-mono text-stone-400">{m.sku}</span>
                                </div>

                                <div className="flex items-center gap-2 pt-1 border-t border-stone-100 dark:border-zinc-700/60">
                                    <div className="flex-1">
                                        <span className="text-[10px] text-stone-400 block">Tiêu thụ</span>
                                        <span className="text-xs font-bold text-stone-700 dark:text-stone-200">
                                            {formatQuantityFull(m.total)} <span className="text-[10px] font-normal">{m.unit}</span>
                                        </span>
                                    </div>
                                    <ArrowRight size={13} className="text-stone-300" />
                                    <div className="flex-1 text-right">
                                        <span className="text-[10px] text-emerald-600 block">Tỉ lệ / tấn</span>
                                        <span className="text-sm font-bold text-emerald-600">
                                            {m.perTon.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                                            <span className="text-[10px] ml-0.5 font-normal">{m.unit}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Daily Productivity Analysis */}
            <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-xl border border-emerald-200/60 dark:border-emerald-900/30">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg shadow-xs text-emerald-600 border border-emerald-100 dark:border-zinc-700">
                            <Activity size={16} />
                        </div>
                        <div>
                            <h3 className="font-bold text-stone-800 dark:text-white text-xs uppercase tracking-wider">Năng suất sản xuất hàng ngày</h3>
                            <p className="text-[11px] text-stone-500">Thống kê sản lượng thực tế theo ngày nhập kho</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-[10px] font-semibold text-stone-400 uppercase">TB / Ngày</div>
                            <div className="text-xs font-bold text-emerald-600">
                                {analysisSummary.avgOutput.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kg
                            </div>
                        </div>
                        <div className="w-px h-6 bg-stone-200 dark:bg-zinc-700" />
                        <div className="text-right">
                            <div className="text-[10px] font-semibold text-stone-400 uppercase">Cao điểm</div>
                            <div className="text-xs font-bold text-orange-600">
                                {analysisSummary.peakDay ? formatQuantityFull(analysisSummary.peakDay.quantity) : 0} kg
                            </div>
                        </div>
                    </div>
                </div>

                {dailyStats.length === 0 ? (
                    <div className="p-6 text-center text-xs text-stone-400 bg-white/60 dark:bg-zinc-900/50 rounded-lg border border-dashed border-stone-300 dark:border-zinc-700">
                        Chưa có dữ liệu sản lượng hàng ngày.
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-stone-200/80 dark:border-zinc-800 shadow-xs relative overflow-hidden">
                            <div className="h-44 w-full flex items-end gap-2 px-1 relative z-10">
                                {dailyStats.map((s, idx) => {
                                    const height = analysisSummary.peakDay ? (s.quantity / analysisSummary.peakDay.quantity) * 100 : 0;
                                    return (
                                        <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] font-semibold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow">
                                                {formatQuantityFull(s.quantity)} kg
                                            </div>
                                            <div
                                                className="w-full max-w-[32px] bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-md transition-all duration-500 cursor-help"
                                                style={{ height: `${Math.max(8, height)}%` }}
                                            />
                                            <div className="mt-1.5 text-[9px] font-semibold text-stone-400">
                                                {new Date(s.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="w-full lg:w-60 flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
                            {dailyStats.map((s, idx) => (
                                <div key={idx} className="bg-white dark:bg-zinc-800/50 px-3 py-2 rounded-lg border border-stone-200/70 dark:border-zinc-800 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-semibold text-stone-600 dark:text-zinc-300">
                                            {new Date(s.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-stone-800 dark:text-gray-200">
                                            {formatQuantityFull(s.quantity)} <span className="text-[10px] font-normal text-stone-400">kg</span>
                                        </div>
                                        {analysisSummary.peakDay?.date === s.date && (
                                            <div className="text-[9px] text-orange-500 font-semibold">Cao điểm</div>
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
                <div className="p-4 bg-orange-50/40 dark:bg-orange-950/10 rounded-xl border border-orange-200/70 dark:border-orange-900/30">
                    <div className="flex items-center gap-2.5 mb-3.5">
                        <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg shadow-xs text-orange-600 border border-orange-100 dark:border-zinc-700">
                            <Warehouse size={16} />
                        </div>
                        <div>
                            <h3 className="font-bold text-stone-800 dark:text-white text-xs uppercase tracking-wider">Phân tích nguyên liệu đầu vào (Từ Kho)</h3>
                            <p className="text-[11px] text-stone-500">Tổng cộng {formatQuantityFull(summary.totalInputWeight)} kg nguyên liệu</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {(analysisSummary.inputStats || []).map((s: any, idx: number) => (
                            <div key={idx} className="bg-white dark:bg-zinc-800 p-3.5 rounded-xl border border-stone-200/80 dark:border-zinc-700 shadow-xs flex flex-col gap-2">
                                <span className="text-xs font-bold text-stone-700 dark:text-zinc-200 truncate">{s.name}</span>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-stone-800 dark:text-gray-100">
                                        {formatQuantityFull(s.totalWeight)} kg
                                    </span>
                                    <span className="text-[10px] bg-orange-50 dark:bg-orange-950/30 text-orange-600 px-2 py-0.5 rounded font-semibold">
                                        {s.lotCount} LOT
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pt-1.5 border-t border-stone-100 dark:border-zinc-700/60 text-[11px]">
                                    <span className="text-stone-400">So với thành phẩm</span>
                                    <span className="font-bold text-stone-700 dark:text-white">
                                        {summary.actual > 0 ? ((s.totalWeight / summary.actual) * 100).toFixed(1) : 0}%
                                    </span>
                                </div>
                            </div>
                        ))}

                        <div className="bg-gradient-to-br from-orange-600 to-orange-700 p-3.5 rounded-xl shadow-sm text-white flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute -right-2 -bottom-2 opacity-15">
                                <Scale size={56} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">Hao hụt sản xuất</span>
                            <div className="mt-1">
                                <div className="text-lg font-bold">{formatQuantityFull(summary.lossWeight)} kg</div>
                                <div className="text-[11px] opacity-85">Tương đương {summary.lossRate.toFixed(1)}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
