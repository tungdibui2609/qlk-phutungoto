'use client'

import React from 'react'
import { MapPin, Hash, Calendar, Package, Search, RefreshCcw, ChevronDown, History, Info, Plus, Download } from 'lucide-react'
import { type PendingAssignment, type Lot, safeFormatDate } from './helpers'
import { exportAssignmentHistoryToExcel } from '@/lib/assignmentExcelExport'
import { decodeSTT } from '@/lib/numberUtils'
import { TagDisplay } from '@/components/lots/TagDisplay'
import { useSystem } from '@/contexts/SystemContext'

interface AssignmentHistorySectionProps {
    showHistory: boolean
    setShowHistory: React.Dispatch<React.SetStateAction<boolean>>
    showDebugBox: boolean
    setShowDebugBox: React.Dispatch<React.SetStateAction<boolean>>
    debugInfo: {
        sysCode: string
        expandedDateFrom: string
        expandedDateTo: string
        knownLotIdsCount: number
        dailySeqsCount: number
        lotsError: string | null
        lotsCount: number
        fallbackLotsCount: number
        fallbackError: string | null
    } | null
    historyList: PendingAssignment[]
    filteredHistory: PendingAssignment[]
    historyLoading: boolean
    dateFilterType: 'created_at' | 'production_date'
    setDateFilterType: React.Dispatch<React.SetStateAction<'created_at' | 'production_date'>>
    historyDateFrom: string
    setHistoryDateFrom: React.Dispatch<React.SetStateAction<string>>
    historyDateTo: string
    setHistoryDateTo: React.Dispatch<React.SetStateAction<string>>
    historySearchTerm: string
    setHistorySearchTerm: React.Dispatch<React.SetStateAction<string>>
    historyProdOrderSearch: string
    setHistoryProdOrderSearch: React.Dispatch<React.SetStateAction<string>>
    historyProdLotSearch: string
    setHistoryProdLotSearch: React.Dispatch<React.SetStateAction<string>>
    fetchHistory: () => Promise<void>
}

export function AssignmentHistorySection({
    showHistory,
    setShowHistory,
    showDebugBox,
    setShowDebugBox,
    debugInfo,
    historyList,
    filteredHistory,
    historyLoading,
    dateFilterType,
    setDateFilterType,
    historyDateFrom,
    setHistoryDateFrom,
    historyDateTo,
    setHistoryDateTo,
    historySearchTerm,
    setHistorySearchTerm,
    historyProdOrderSearch,
    setHistoryProdOrderSearch,
    historyProdLotSearch,
    setHistoryProdLotSearch,
    fetchHistory,
}: AssignmentHistorySectionProps) {
    const { currentSystem } = useSystem()
    return (
        <>
            {/* History Section */}
            <div className="mt-12">
                <button onDoubleClick={() => setShowDebugBox(!showDebugBox)} onClick={() => {setShowHistory(!showHistory); if(!showHistory) fetchHistory();}} className="w-full flex items-center justify-between px-6 py-5 bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-3xl transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <div className="flex items-center gap-3"><History size={20} className="text-blue-600" /><span className="text-base font-black text-zinc-900 dark:text-white select-none">Lịch Sử Duyệt Gán</span></div>
                    <ChevronDown className={`transition-transform text-zinc-400 ${showHistory?'rotate-180':''}`} />
                </button>
                {showHistory && (
                    <div className="mt-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[32px] p-6 space-y-4 shadow-xl">
                        {/* Hộp chẩn đoán lỗi (Debug Box) */}
                        {showDebugBox && (
                            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-3xl text-xs font-semibold text-zinc-650 dark:text-zinc-400 space-y-3">
                            <div className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> HỘP CHẨN ĐOÁN LỖI LỊCH SỬ (NÂNG CẤP V2)
                            </div>

                            {/* Dòng 1: Client code, Lọc Ngày, Tổng số dòng */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                                <div>
                                    <span className="text-[9px] text-zinc-450 dark:text-zinc-500 block uppercase font-bold">Mã hệ thống thực tế (Client):</span>
                                    <code className="text-zinc-900 dark:text-white font-black">{currentSystem?.code || 'NULL'}</code>
                                </div>
                                <div>
                                    <span className="text-[9px] text-zinc-450 dark:text-zinc-500 block uppercase font-bold">Lọc Ngày Lịch Sử:</span>
                                    <code className="text-zinc-900 dark:text-white font-black">{historyDateFrom} → {historyDateTo}</code>
                                </div>
                                <div>
                                    <span className="text-[9px] text-zinc-450 dark:text-zinc-500 block uppercase font-bold">Dòng lịch sử:</span>
                                    <code className="text-zinc-900 dark:text-white font-black">{historyList.length}</code>
                                </div>
                                <div>
                                    <span className="text-[9px] text-zinc-450 dark:text-zinc-500 block uppercase font-bold">Số Lô Khớp Thành Công:</span>
                                    <code className={`${historyList.filter(h => h.lot).length > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} font-black`}>
                                        {historyList.filter(h => h.lot).length}
                                    </code>
                                </div>
                            </div>

                            {/* Dòng 2: Supabase Query Debug Info */}
                            {debugInfo && (
                                <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl space-y-2 text-[10px]">
                                    <div className="font-bold text-zinc-800 dark:text-zinc-200">Supabase Query Stats:</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-zinc-650 dark:text-zinc-450">
                                        <div>• sysCode chuẩn hóa: <code className="font-bold text-zinc-800 dark:text-zinc-300">{debugInfo.sysCode}</code></div>
                                        <div>• Khoảng Inbound: <code className="font-bold text-zinc-800 dark:text-zinc-300">{debugInfo.expandedDateFrom} → {debugInfo.expandedDateTo.split('T')[0]}</code></div>
                                        <div>• UUIDs / STTs: <code className="font-bold text-zinc-800 dark:text-zinc-300">{debugInfo.knownLotIdsCount} / {debugInfo.dailySeqsCount}</code></div>
                                        <div>• Số Lots Tìm Thấy: <code className="font-bold text-blue-600 dark:text-blue-400">{debugInfo.lotsCount} (Fallback: {debugInfo.fallbackLotsCount})</code></div>
                                    </div>

                                    {/* Báo lỗi query nếu có */}
                                    {debugInfo.lotsError && (
                                        <div className="text-red-500 font-mono text-[9px] mt-1 bg-red-50 dark:bg-red-900/10 p-2 rounded-lg border border-red-200/50">
                                            ⚠️ Lỗi Query Chính: {debugInfo.lotsError}
                                        </div>
                                    )}
                                    {debugInfo.fallbackError && (
                                        <div className="text-amber-500 font-mono text-[9px] mt-1 bg-amber-50 dark:bg-amber-900/10 p-2 rounded-lg border border-amber-200/50">
                                            ⚠️ Lỗi Fallback: {debugInfo.fallbackError}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80">
                                <span className="text-[9px] text-zinc-450 dark:text-zinc-500 block uppercase font-bold mb-1">Chuỗi Status chi tiết của các dòng:</span>
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl p-2.5 max-h-[100px] overflow-y-auto font-mono text-[9px] whitespace-pre-wrap break-all leading-normal text-zinc-700 dark:text-zinc-350">
                                    {historyList.length > 0 ? (
                                        historyList.map(h => `STT #${decodeSTT(h.lot_stt)} | Status: "${h.status}"`).join('\n')
                                    ) : (
                                        'Không có dòng lịch sử nào'
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="space-y-4 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 rounded-[32px] border border-zinc-100 dark:border-zinc-800">
                            {/* Dòng 1: Thời gian & Hành động */}
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm">
                                    <select 
                                        value={dateFilterType}
                                        onChange={(e) => setDateFilterType(e.target.value as 'created_at' | 'production_date')}
                                        className="bg-transparent border-none outline-none font-black text-[11px] text-zinc-700 dark:text-zinc-300 pr-2 cursor-pointer border-r border-zinc-200 dark:border-zinc-800 focus:ring-0"
                                    >
                                        <option value="created_at" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Ngày quét</option>
                                        <option value="production_date" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Ngày sản xuất</option>
                                    </select>
                                    <Calendar size={14} className="text-blue-500" />
                                    <div className="flex items-center gap-3">
                                        <input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)} className="bg-transparent text-[11px] font-black text-zinc-900 dark:text-white outline-none cursor-pointer" />
                                        <span className="text-zinc-300 font-bold">→</span>
                                        <input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)} className="bg-transparent text-[11px] font-black text-zinc-900 dark:text-white outline-none cursor-pointer" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => {
                                            exportAssignmentHistoryToExcel({
                                                systemName: currentSystem?.name || 'Unknown System',
                                                dateRange: `${safeFormatDate(historyDateFrom)} - ${safeFormatDate(historyDateTo)}`,
                                                items: filteredHistory
                                            });
                                        }} 
                                        className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 whitespace-nowrap"
                                    >
                                        <Download size={15} /> Xuất Excel
                                    </button>
                                    <button 
                                        onClick={fetchHistory} 
                                        className="h-11 w-11 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all shrink-0"
                                    >
                                        <RefreshCcw size={16} className={historyLoading ? "animate-spin" : ""} />
                                    </button>
                                </div>
                            </div>

                            {/* Dòng 2: Các ô tìm kiếm chi tiết */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={14} />
                                    <input 
                                        placeholder="Tìm vị trí, số STT, tên sản phẩm..." 
                                        value={historySearchTerm} 
                                        onChange={e => setHistorySearchTerm(e.target.value)} 
                                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl py-3 pl-11 pr-4 text-[11px] font-bold text-zinc-900 dark:text-white outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 shadow-sm transition-all" 
                                    />
                                </div>
                                <div className="relative group">
                                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={14} />
                                    <input 
                                        placeholder="Mã Lệnh Sản Xuất..." 
                                        value={historyProdOrderSearch} 
                                        onChange={e => setHistoryProdOrderSearch(e.target.value)} 
                                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl py-3 pl-11 pr-4 text-[11px] font-bold text-zinc-900 dark:text-white outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 shadow-sm transition-all" 
                                    />
                                </div>
                                <div className="relative group">
                                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={14} />
                                    <input 
                                        placeholder="Mã Lot Sản Xuất..." 
                                        value={historyProdLotSearch} 
                                        onChange={e => setHistoryProdLotSearch(e.target.value)} 
                                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl py-3 pl-11 pr-4 text-[11px] font-bold text-zinc-900 dark:text-white outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 shadow-sm transition-all" 
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded-2xl border border-zinc-100 dark:border-zinc-800">
                            <table className="w-full text-xs">
                                <thead className="bg-zinc-50 dark:bg-zinc-950">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">STT</th>
                                        <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Lệnh SX / Lot SX</th>
                                        <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Sản Phẩm</th>
                                        <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Số lượng</th>
                                        <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Quy đổi (kg)</th>
                                        <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Vị trí</th>
                                        <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Loại</th>
                                        <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Ngày SX</th>
                                        <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                                    {filteredHistory.map(h => (
                                            <tr key={h.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                                <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-300">#{decodeSTT(h.lot_stt)}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">
                                                            LSX: {h.lot?.production_order_code || '---'}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-zinc-500 uppercase">
                                                            LOT: {h.lot?.production_lot_code || '---'}
                                                        </span>
                                                        {h.lot?.production_code && h.lot?.production_code !== h.lot?.production_lot_code && (
                                                            <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400">
                                                                Mã phụ: {h.lot.production_code}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {h.lot ? (
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-zinc-900 dark:text-white uppercase">{h.lot.code}</span>
                                                            <span className="text-[10px] text-zinc-500 font-medium line-clamp-1">{h.lot.product_names?.join(', ') || '---'}</span>
                                                            {h.lot.tags && h.lot.tags.length > 0 && (
                                                                <div className="mt-1">
                                                                    <TagDisplay
                                                                        tags={h.lot.tags}
                                                                        variant="compact"
                                                                        placeholderMap={{ '@': h.lot.product_skus?.[0] || '' }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-400 italic">Không xác định</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-black text-zinc-900 dark:text-zinc-300">
                                                        {h.lot?.quantity_display || '---'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg">
                                                        {h.lot?.total_weight_kg ? `${h.lot.total_weight_kg.toLocaleString('vi-VN')} kg` : '---'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <MapPin size={12} className="text-emerald-500" />
                                                            <span className="font-bold text-zinc-900 dark:text-zinc-200 uppercase">{h.position?.code}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <span className="text-[9px] font-bold text-zinc-400 uppercase">
                                                                {h.assignment_type === 'move' ? 'Từ:' : 'Nguồn:'}
                                                            </span>
                                                            <span className={`text-[9px] font-black uppercase ${h.assignment_type === 'move' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                {h.old_position_code || 'Sảnh'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {h.status.startsWith('approved') ? (
                                                        h.assignment_type === 'move' ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-blue-600 dark:text-blue-400 font-black uppercase text-[9px] flex items-center gap-1">
                                                                    <RefreshCcw size={10} /> Di chuyển
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[9px] flex items-center gap-1">
                                                                <Plus size={10} /> Gán mới
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="text-zinc-400">---</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-zinc-500 font-medium">
                                                    {safeFormatDate(h.production_date)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${h.status.startsWith('approved') ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                                                        {h.status.startsWith('approved') ? 'Đã duyệt' : 'Đã hủy'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
