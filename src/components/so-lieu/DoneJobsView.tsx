'use client'

import React from 'react'
import { Calendar, Check, CheckSquare, Clock, FileText, Layers, RefreshCw, Search, Square, X } from 'lucide-react'
import DoneSingleJobDetail from './DoneSingleJobDetail'
import { DeliveryJournalRecord } from './types'
import { formatDateTime } from './utils'

interface DoneJobsViewProps {
    doneViewMode: 'single' | 'by-date' | 'by-product' | 'custom'
    setDoneViewMode: (m: 'single' | 'by-date' | 'by-product' | 'custom') => void
    availableDates: string[]
    shiftsOnSelectedDate: any[]
    setByDateRange: React.Dispatch<React.SetStateAction<{ from: string; to: string }>>
    byDateRange: { from: string; to: string }
    setByDateMultiDates: React.Dispatch<React.SetStateAction<Set<string>>>
    byDateMultiDates: Set<string>
    byDateFilterType: 'range' | 'multi'
    setByDateFilterType: (t: 'range' | 'multi') => void
    byDateCustomAddInput: string
    setByDateCustomAddInput: (v: string) => void
    byDateReportInfo: { label: string; title: string; excelTitle: string; fileName: string }
    byDateLines: DeliveryJournalRecord[]
    byDateLoading: boolean
    customSelectedIds: Set<string>
    setCustomSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
    customSelectedShifts: any[]
    customLines: DeliveryJournalRecord[]
    customLoading: boolean
    pastShifts: any[]
    filteredPastShifts: any[]
    doneRange: 'today' | '7d' | '30d' | 'all'
    setDoneRange: (r: 'today' | '7d' | '30d' | 'all') => void
    loadPastShifts: (range: 'today' | '7d' | '30d' | 'all') => void
    doneSearch: string
    setDoneSearch: (s: string) => void
    doneListLoading: boolean
    doneStatusFilter: 'all' | 'closed' | 'open'
    setDoneStatusFilter: (f: 'all' | 'closed' | 'open') => void
    doneSelectedShift: any
    selectDoneShift: (shift: any) => void
    setDoneSelectedId: (id: string | null) => void
    doneLines: DeliveryJournalRecord[]
    doneSubShifts: any[]
    doneLinesLoading: boolean
    doneTab: 'summary' | 'lines'
    setDoneTab: (t: 'summary' | 'lines') => void
    journalTypeFilter: 'all' | 'in' | 'out'
    setJournalTypeFilter: (f: 'all' | 'in' | 'out') => void
    isMainSummaryExpanded: boolean
    setIsMainSummaryExpanded: (v: boolean) => void
    isTwoWayExpanded: boolean
    setIsTwoWayExpanded: (v: boolean) => void
    isUnitsExpanded: boolean
    setIsUnitsExpanded: (v: boolean) => void
    isProductsExpanded: boolean
    setIsProductsExpanded: (v: boolean) => void
    isDoneSubShiftsSectionExpanded: boolean
    setIsDoneSubShiftsSectionExpanded: (v: boolean) => void
    isInfoExpanded: boolean
    setIsInfoExpanded: (v: boolean) => void
    expandedDoneSubShifts: Set<string>
    toggleExpandDoneSubShift: (id: string) => void
    byProdTimeFilter: 'today' | '7days' | '30days' | 'all' | 'custom'
    setByProdTimeFilter: (t: 'today' | '7days' | '30days' | 'all' | 'custom') => void
    byProdRange: { from: string; to: string }
    setByProdRange: React.Dispatch<React.SetStateAction<{ from: string; to: string }>>
    shiftsForProductReport: any[]
    byProdSearch: string
    setByProdSearch: (s: string) => void
    aggregatedProductsForReport: any[]
    byProdLines: DeliveryJournalRecord[]
    byProdLoading: boolean
    getShiftLocalDateString: (isoString?: string) => string
    summarizeLines: (lines: DeliveryJournalRecord[], shift?: any) => any[]
    buildEffectiveSubShifts: (subShifts: any[], lines: DeliveryJournalRecord[], shift: any) => any[]
    renderAggregatedReportView: (
        title: string,
        shifts: any[],
        lines: DeliveryJournalRecord[],
        loading: boolean,
        onExport: () => void,
        exportButtonText: string
    ) => React.ReactNode
    onExportDoneShift: (shift: any, lines: DeliveryJournalRecord[]) => void
    onExportMultiShifts: (title: string, shifts: any[], lines: DeliveryJournalRecord[], fileName: string) => void
    onOpenImagesModal: () => void
    onReopenShift: (shift: any) => void
    onContinueActiveShift: (shiftId: string) => void
    onDeleteDoneShift: (shiftId: string) => void
    onOpenInboundModal: (shift: any, summaryRows: any[]) => void
    onOpenOutboundModal: (shift: any, summaryRows: any[]) => void
    onNavigateToSettlementPage: (shift: any, summaryRows: any[], type: 'in' | 'out') => void
    onStartEdit: (record: DeliveryJournalRecord) => void
    onDeleteJournal: (id: string) => void
    onUpdateShiftOpenedAt: (shift: any) => void
    onSelectAllCustomShifts: () => void
    onDeselectAllCustomShifts: () => void
    onToggleSelectShift: (id: string) => void
}

export default function DoneJobsView({
    doneViewMode,
    setDoneViewMode,
    availableDates,
    shiftsOnSelectedDate,
    setByDateRange,
    byDateRange,
    setByDateMultiDates,
    byDateMultiDates,
    byDateFilterType,
    setByDateFilterType,
    byDateCustomAddInput,
    setByDateCustomAddInput,
    byDateReportInfo,
    byDateLines,
    byDateLoading,
    customSelectedIds,
    setCustomSelectedIds,
    customSelectedShifts,
    customLines,
    customLoading,
    pastShifts,
    filteredPastShifts,
    doneRange,
    setDoneRange,
    loadPastShifts,
    doneSearch,
    setDoneSearch,
    doneListLoading,
    doneStatusFilter,
    setDoneStatusFilter,
    doneSelectedShift,
    selectDoneShift,
    setDoneSelectedId,
    doneLines,
    doneSubShifts,
    doneLinesLoading,
    doneTab,
    setDoneTab,
    journalTypeFilter,
    setJournalTypeFilter,
    isMainSummaryExpanded,
    setIsMainSummaryExpanded,
    isTwoWayExpanded,
    setIsTwoWayExpanded,
    isUnitsExpanded,
    setIsUnitsExpanded,
    isProductsExpanded,
    setIsProductsExpanded,
    isDoneSubShiftsSectionExpanded,
    setIsDoneSubShiftsSectionExpanded,
    isInfoExpanded,
    setIsInfoExpanded,
    expandedDoneSubShifts,
    toggleExpandDoneSubShift,
    byProdTimeFilter,
    setByProdTimeFilter,
    byProdRange,
    setByProdRange,
    shiftsForProductReport,
    byProdSearch,
    setByProdSearch,
    aggregatedProductsForReport,
    byProdLines,
    byProdLoading,
    getShiftLocalDateString,
    summarizeLines,
    buildEffectiveSubShifts,
    renderAggregatedReportView,
    onExportDoneShift,
    onExportMultiShifts,
    onOpenImagesModal,
    onReopenShift,
    onContinueActiveShift,
    onDeleteDoneShift,
    onOpenInboundModal,
    onOpenOutboundModal,
    onNavigateToSettlementPage,
    onStartEdit,
    onDeleteJournal,
    onUpdateShiftOpenedAt,
    onSelectAllCustomShifts,
    onDeselectAllCustomShifts,
    onToggleSelectShift,
}: DoneJobsViewProps) {
    return (
        <div className="space-y-4">
            {/* THANH MENU 3 CHẾ ĐỘ XEM TRONG TAB ĐÃ HOÀN THÀNH */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-xs">
                <div className="inline-flex p-1 bg-stone-100 dark:bg-zinc-800/80 rounded-xl gap-1">
                    <button
                        type="button"
                        onClick={() => setDoneViewMode('single')}
                        className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                            doneViewMode === 'single'
                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Từng công việc</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setDoneViewMode('by-date')
                            if (availableDates.length > 0 && !shiftsOnSelectedDate.length) {
                                const latest = availableDates[0]
                                setByDateRange({ from: latest, to: latest })
                                setByDateMultiDates(new Set([latest]))
                            }
                        }}
                        className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                            doneViewMode === 'by-date'
                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                        }`}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Báo cáo theo ngày</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setDoneViewMode('by-product')}
                        className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                            doneViewMode === 'by-product'
                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Báo cáo theo sản phẩm</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setDoneViewMode('custom')
                            if (customSelectedIds.size === 0 && pastShifts.length > 0) {
                                setCustomSelectedIds(new Set([pastShifts[0].id]))
                            }
                        }}
                        className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                            doneViewMode === 'custom'
                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                        }`}
                    >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Báo cáo tùy chọn {customSelectedIds.size > 0 && `(${customSelectedIds.size} CV)`}</span>
                    </button>
                </div>

                <div className="text-[11px] text-stone-500 flex items-center gap-2 px-2">
                    {doneViewMode === 'single' && <span>Xem chi tiết đối soát từng công việc</span>}
                    {doneViewMode === 'by-date' && <span>Gộp tất cả công việc trong ngày vào 1 bảng</span>}
                    {doneViewMode === 'by-product' && <span>Tổng hợp số liệu xuất/nhập chi tiết gom theo từng mặt hàng</span>}
                    {doneViewMode === 'custom' && <span>Tích chọn các công việc để gộp báo cáo & xuất Excel</span>}
                </div>
            </div>

            {/* 1. CHẾ ĐỘ: TỪNG CÔNG VIỆC */}
            {doneViewMode === 'single' && (
                <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-[340px_minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)] sm:gap-5 sm:items-start">
                    {/* Bộ lọc trên Mobile */}
                    {!doneSelectedShift && (
                        <div className="sm:hidden space-y-1.5">
                            <div className="grid grid-cols-4 gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-stone-200 dark:border-zinc-800 text-[11px] font-bold">
                                {([
                                    { id: 'today', label: 'Hôm nay' },
                                    { id: '7d', label: '7 ngày' },
                                    { id: '30d', label: '30 ngày' },
                                    { id: 'all', label: 'Tất cả' },
                                ] as const).map(r => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => { setDoneRange(r.id); loadPastShifts(r.id) }}
                                        className={`h-7 rounded-lg transition ${
                                            doneRange === r.id ? 'bg-indigo-600 text-white' : 'text-stone-600 dark:text-stone-300'
                                        }`}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                                <input
                                    type="text"
                                    value={doneSearch}
                                    onChange={e => setDoneSearch(e.target.value)}
                                    placeholder="Tìm công việc hoặc sản phẩm..."
                                    className="w-full h-9 pl-8 pr-8 text-xs bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                {doneSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setDoneSearch('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CỘT TRÁI: DANH SÁCH LỊCH SỬ CÁC CA / CÔNG VIỆC */}
                    <div className={`${doneSelectedShift ? 'hidden sm:block' : 'block'} bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs`}>
                        <div className="p-2.5 sm:p-3 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/60 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-stone-500">
                                    Danh sách công việc ({filteredPastShifts.length})
                                </span>
                                {doneListLoading && <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />}
                            </div>
                            <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 dark:bg-zinc-800 rounded-xl text-[10px] sm:text-[11px] font-bold">
                                {([
                                    { id: 'all', label: `Tất cả (${pastShifts.length})` },
                                    { id: 'closed', label: `Đã chốt (${pastShifts.filter(s => s.status === 'closed').length})` },
                                    { id: 'open', label: `Đang mở (${pastShifts.filter(s => s.status === 'open').length})` },
                                ] as const).map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setDoneStatusFilter(tab.id)}
                                        className={`h-7 rounded-lg transition ${
                                            doneStatusFilter === tab.id
                                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                                : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {filteredPastShifts.length === 0 ? (
                            <div className="p-8 text-center text-xs text-stone-400 space-y-2">
                                <p>Chưa có công việc nào trong bộ lọc này.</p>
                                {doneRange !== 'all' && (
                                    <button
                                        type="button"
                                        onClick={() => { setDoneRange('all'); loadPastShifts('all') }}
                                        className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                                    >
                                        Xem tất cả các ngày
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="divide-y divide-stone-100 dark:divide-zinc-800 max-h-[calc(100vh-245px)] overflow-y-auto">
                                {filteredPastShifts.map((shift, idx) => {
                                    const isSelected = doneSelectedShift?.id === shift.id
                                    const isClosed = shift.status === 'closed'
                                    const jobTitle = shift.summary_data?.job_name || shift.notes || `Công việc ${idx + 1}`
                                    const prodCount = Object.keys(shift.summary_data?.products_summary || {}).length
                                    const recCount = shift.summary_data?.total_records ?? 0
                                    return (
                                        <button
                                            key={shift.id || idx}
                                            type="button"
                                            onClick={() => selectDoneShift(shift)}
                                            className={`w-full text-left px-3.5 sm:px-4 py-3 sm:py-3.5 transition border-l-4 ${
                                                isSelected
                                                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-l-indigo-600'
                                                    : 'border-l-transparent hover:bg-stone-50 dark:hover:bg-zinc-800/40'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-white leading-snug break-words">
                                                    {jobTitle}
                                                </span>
                                                {isClosed ? (
                                                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                        Đã chốt
                                                    </span>
                                                ) : (
                                                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                        Đang mở
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] sm:text-[11px] text-stone-500 mt-1 flex items-center gap-1.5 flex-wrap">
                                                <Clock className="w-3 h-3 text-stone-400" />
                                                <span>
                                                    {formatDateTime(shift.opened_at)} → {shift.closed_at ? formatDateTime(shift.closed_at) : 'Hiện tại'}
                                                </span>
                                                {shift.closed_at && getShiftLocalDateString(shift.opened_at) !== getShiftLocalDateString(shift.closed_at) && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                        🌙 Đóng ca vào ngày hôm sau
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px] text-stone-400">
                                                <span>
                                                    {isClosed ? 'Người chốt: ' : 'Người mở: '}
                                                    <strong className="text-stone-600 dark:text-stone-300">
                                                        {shift.closed_by_name || shift.opened_by_name || 'Nhân viên'}
                                                    </strong>
                                                </span>
                                                {isClosed && <span>{prodCount} SP • {recCount} đợt</span>}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* CỘT PHẢI: CHI TIẾT BÁO CÁO CHỐT CA TẠM & ĐỐI SOÁT CẢ CA */}
                    <div className={`${doneSelectedShift ? 'block' : 'hidden sm:block'}`}>
                        <DoneSingleJobDetail
                            doneSelectedShift={doneSelectedShift}
                            doneLines={doneLines}
                            doneSubShifts={doneSubShifts}
                            doneLinesLoading={doneLinesLoading}
                            doneTab={doneTab}
                            setDoneTab={setDoneTab}
                            journalTypeFilter={journalTypeFilter}
                            setJournalTypeFilter={setJournalTypeFilter}
                            isMainSummaryExpanded={isMainSummaryExpanded}
                            setIsMainSummaryExpanded={setIsMainSummaryExpanded}
                            isTwoWayExpanded={isTwoWayExpanded}
                            setIsTwoWayExpanded={setIsTwoWayExpanded}
                            isUnitsExpanded={isUnitsExpanded}
                            setIsUnitsExpanded={setIsUnitsExpanded}
                            isProductsExpanded={isProductsExpanded}
                            setIsProductsExpanded={setIsProductsExpanded}
                            isDoneSubShiftsSectionExpanded={isDoneSubShiftsSectionExpanded}
                            setIsDoneSubShiftsSectionExpanded={setIsDoneSubShiftsSectionExpanded}
                            isInfoExpanded={isInfoExpanded}
                            setIsInfoExpanded={setIsInfoExpanded}
                            expandedDoneSubShifts={expandedDoneSubShifts}
                            toggleExpandDoneSubShift={toggleExpandDoneSubShift}
                            summarizeLines={summarizeLines}
                            buildEffectiveSubShifts={buildEffectiveSubShifts}
                            onBackMobile={() => setDoneSelectedId(null)}
                            onOpenImagesModal={onOpenImagesModal}
                            onExportExcel={onExportDoneShift}
                            onReopenShift={onReopenShift}
                            onContinueActiveShift={onContinueActiveShift}
                            onDeleteDoneShift={onDeleteDoneShift}
                            onOpenInboundModal={onOpenInboundModal}
                            onOpenOutboundModal={onOpenOutboundModal}
                            onNavigateToSettlementPage={onNavigateToSettlementPage}
                            onStartEdit={onStartEdit}
                            onDeleteJournal={onDeleteJournal}
                            onUpdateShiftOpenedAt={onUpdateShiftOpenedAt}
                        />
                    </div>
                </div>
            )}

            {/* 2. CHẾ ĐỘ: BÁO CÁO THEO NGÀY / KHOẢNG NGÀY / TÙY CHỌN NHIỀU NGÀY */}
            {doneViewMode === 'by-date' && (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-3.5 shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-stone-100 dark:border-zinc-800">
                            <div className="inline-flex p-0.5 bg-stone-100 dark:bg-zinc-800 rounded-lg gap-1 self-start">
                                <button
                                    type="button"
                                    onClick={() => setByDateFilterType('range')}
                                    className={`h-7 px-3 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
                                        byDateFilterType === 'range'
                                            ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                            : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                    }`}
                                >
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>Mốc thời gian (Từ ngày ➔ Đến ngày)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setByDateFilterType('multi')}
                                    className={`h-7 px-3 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
                                        byDateFilterType === 'multi'
                                            ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                            : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                    }`}
                                >
                                    <CheckSquare className="w-3.5 h-3.5" />
                                    <span>Tùy chọn nhiều ngày {byDateMultiDates.size > 0 && `(${byDateMultiDates.size})`}</span>
                                </button>
                            </div>

                            <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                                <span>Đang xem:</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/40">
                                    {byDateReportInfo.title.replace('Báo Cáo Tổng Hợp: ', '').replace('Báo Cáo Tổng Hợp Ngày: ', '')}
                                </span>
                            </div>
                        </div>

                        {byDateFilterType === 'range' ? (
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Từ:</span>
                                    <input
                                        type="date"
                                        value={byDateRange.from}
                                        onChange={e => setByDateRange(prev => ({ ...prev, from: e.target.value }))}
                                        className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Đến:</span>
                                    <input
                                        type="date"
                                        value={byDateRange.to}
                                        onChange={e => setByDateRange(prev => ({ ...prev, to: e.target.value }))}
                                        className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="flex items-center gap-1 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const todayStr = getShiftLocalDateString(new Date().toISOString())
                                            setByDateRange({ from: todayStr, to: todayStr })
                                        }}
                                        className={`h-8 px-2.5 rounded-lg border text-xs font-semibold transition ${
                                            byDateRange.from === byDateRange.to && byDateRange.from === getShiftLocalDateString(new Date().toISOString())
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-600 dark:text-stone-300'
                                        }`}
                                    >
                                        Hôm nay
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const yest = new Date()
                                            yest.setDate(yest.getDate() - 1)
                                            const yestStr = getShiftLocalDateString(yest.toISOString())
                                            setByDateRange({ from: yestStr, to: yestStr })
                                        }}
                                        className={`h-8 px-2.5 rounded-lg border text-xs font-semibold transition ${
                                            byDateRange.from === byDateRange.to && byDateRange.from !== getShiftLocalDateString(new Date().toISOString()) && availableDates.includes(byDateRange.from)
                                                ? 'bg-stone-200 dark:bg-zinc-700 text-stone-800 dark:text-stone-200 border-stone-300'
                                                : 'border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-600 dark:text-stone-300'
                                        }`}
                                    >
                                        Hôm qua
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const today = new Date()
                                            const past7 = new Date()
                                            past7.setDate(today.getDate() - 6)
                                            setByDateRange({
                                                from: getShiftLocalDateString(past7.toISOString()),
                                                to: getShiftLocalDateString(today.toISOString())
                                            })
                                        }}
                                        className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-xs font-semibold text-stone-600 dark:text-stone-300 transition"
                                    >
                                        7 ngày qua
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const today = new Date()
                                            const past30 = new Date()
                                            past30.setDate(today.getDate() - 29)
                                            setByDateRange({
                                                from: getShiftLocalDateString(past30.toISOString()),
                                                to: getShiftLocalDateString(today.toISOString())
                                            })
                                        }}
                                        className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-xs font-semibold text-stone-600 dark:text-stone-300 transition"
                                    >
                                        30 ngày qua
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const today = new Date()
                                            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
                                            setByDateRange({
                                                from: getShiftLocalDateString(firstDay.toISOString()),
                                                to: getShiftLocalDateString(today.toISOString())
                                            })
                                        }}
                                        className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-xs font-semibold text-stone-600 dark:text-stone-300 transition"
                                    >
                                        Tháng này
                                    </button>
                                </div>

                                {availableDates.length > 0 && (
                                    <div className="flex items-center gap-1 ml-auto overflow-x-auto py-0.5">
                                        <span className="text-[11px] text-stone-400 mr-1">Xem nhanh ngày:</span>
                                        {availableDates.slice(0, 6).map(dateStr => (
                                            <button
                                                key={dateStr}
                                                type="button"
                                                onClick={() => setByDateRange({ from: dateStr, to: dateStr })}
                                                className={`h-7 px-2 rounded-md text-[11px] font-semibold transition ${
                                                    byDateRange.from === dateStr && byDateRange.to === dateStr
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-zinc-700'
                                                }`}
                                            >
                                                {dateStr.split('-').reverse().slice(0, 2).join('/')}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                                            Bấm vào ngày để chọn/bỏ chọn (hỗ trợ chọn ngày ngắt quãng):
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setByDateMultiDates(new Set(availableDates))}
                                            className="h-7 px-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold hover:bg-indigo-100 transition"
                                        >
                                            Chọn tất cả ngày có dữ liệu ({availableDates.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setByDateMultiDates(new Set())}
                                            className="h-7 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800 text-[11px] font-semibold transition"
                                        >
                                            Bỏ chọn tất cả
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap p-2 bg-stone-50 dark:bg-zinc-800/60 rounded-xl border border-stone-200/80 dark:border-zinc-800">
                                    {availableDates.length === 0 ? (
                                        <span className="text-xs text-stone-400 italic">Chưa có ngày nào có dữ liệu công việc.</span>
                                    ) : (
                                        availableDates.map(dateStr => {
                                            const isSelected = byDateMultiDates.has(dateStr)
                                            const count = pastShifts.filter(s => {
                                                const op = getShiftLocalDateString(s.opened_at)
                                                const cl = getShiftLocalDateString(s.closed_at)
                                                return op === dateStr || cl === dateStr
                                            }).length

                                            return (
                                                <button
                                                    key={dateStr}
                                                    type="button"
                                                    onClick={() => {
                                                        setByDateMultiDates(prev => {
                                                            const next = new Set(prev)
                                                            if (next.has(dateStr)) next.delete(dateStr)
                                                            else next.add(dateStr)
                                                            return next
                                                        })
                                                    }}
                                                    className={`h-7 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                                                        isSelected
                                                            ? 'bg-indigo-600 text-white shadow-xs'
                                                            : 'bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800'
                                                    }`}
                                                >
                                                    {isSelected && <Check className="w-3.5 h-3.5" />}
                                                    <span>{dateStr.split('-').reverse().slice(0, 2).join('/')}</span>
                                                    <span className={`text-[10px] px-1 py-0.2 rounded-full ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-stone-100 dark:bg-zinc-800 text-stone-500'}`}>
                                                        {count} việc
                                                    </span>
                                                </button>
                                            )
                                        })
                                    )}

                                    <div className="flex items-center gap-1 ml-auto">
                                        <input
                                            type="date"
                                            value={byDateCustomAddInput}
                                            onChange={e => setByDateCustomAddInput(e.target.value)}
                                            className="h-7 px-2 rounded-md border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!byDateCustomAddInput) return
                                                setByDateMultiDates(prev => new Set([...prev, byDateCustomAddInput]))
                                                setByDateCustomAddInput('')
                                            }}
                                            className="h-7 px-2 rounded-md bg-stone-200 dark:bg-zinc-700 text-stone-700 dark:text-stone-200 text-xs font-bold hover:bg-stone-300 transition"
                                        >
                                            + Thêm
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {shiftsOnSelectedDate.length === 0 ? (
                        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-xs text-stone-400 space-y-2">
                            <Calendar className="w-8 h-8 text-stone-300 dark:text-zinc-700 mx-auto" />
                            <p className="font-semibold text-stone-600 dark:text-stone-300">
                                Không có công việc nào phát sinh trong {byDateReportInfo.label}
                            </p>
                            <p className="text-[11px] text-stone-400">
                                Vui lòng chọn mốc thời gian khác hoặc chuyển sang bộ lọc "Tất cả" trên thanh công cụ để tải thêm lịch sử.
                            </p>
                        </div>
                    ) : (
                        renderAggregatedReportView(
                            byDateReportInfo.title,
                            shiftsOnSelectedDate,
                            byDateLines,
                            byDateLoading,
                            () => onExportMultiShifts(
                                byDateReportInfo.excelTitle,
                                shiftsOnSelectedDate,
                                byDateLines,
                                byDateReportInfo.fileName
                            ),
                            'Xuất Excel Báo Cáo'
                        )
                    )}
                </div>
            )}

            {/* 2.5. CHẾ ĐỘ: BÁO CÁO THEO SẢN PHẨM */}
            {doneViewMode === 'by-product' && (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-3.5 shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-stone-100 dark:border-zinc-800">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-stone-700 dark:text-stone-300 mr-1">Thời gian:</span>
                                <div className="inline-flex p-0.5 bg-stone-100 dark:bg-zinc-800 rounded-lg gap-1">
                                    {(['today', '7days', '30days', 'all', 'custom'] as const).map(tf => {
                                        const label = tf === 'today' ? 'Hôm nay' : tf === '7days' ? '7 ngày' : tf === '30days' ? '30 ngày' : tf === 'all' ? 'Tất cả' : 'Khoảng ngày'
                                        return (
                                            <button
                                                key={tf}
                                                type="button"
                                                onClick={() => setByProdTimeFilter(tf)}
                                                className={`h-7 px-2.5 rounded-md text-xs font-bold transition ${
                                                    byProdTimeFilter === tf
                                                        ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                                        : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        )
                                    })}
                                </div>

                                {byProdTimeFilter === 'custom' && (
                                    <div className="flex items-center gap-1.5 ml-2">
                                        <input
                                            type="date"
                                            value={byProdRange.from}
                                            onChange={e => setByProdRange(prev => ({ ...prev, from: e.target.value }))}
                                            className="h-7 px-2 rounded-md border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-xs font-semibold"
                                        />
                                        <span className="text-stone-400 text-xs">➔</span>
                                        <input
                                            type="date"
                                            value={byProdRange.to}
                                            onChange={e => setByProdRange(prev => ({ ...prev, to: e.target.value }))}
                                            className="h-7 px-2 rounded-md border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-xs font-semibold"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                                <span>Gom từ:</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/40">
                                    {shiftsForProductReport.length} công việc
                                </span>
                            </div>
                        </div>

                        <div className="relative">
                            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                value={byProdSearch}
                                onChange={e => setByProdSearch(e.target.value)}
                                placeholder="Tìm kiếm theo tên sản phẩm, mã SKU hoặc tên công việc phát sinh..."
                                className="w-full h-9 pl-9 pr-8 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-xs text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                            />
                            {byProdSearch && (
                                <button
                                    type="button"
                                    onClick={() => setByProdSearch('')}
                                    className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {aggregatedProductsForReport.length === 0 ? (
                        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-xs text-stone-400 space-y-2">
                            <Layers className="w-8 h-8 text-stone-300 dark:text-zinc-700 mx-auto" />
                            <p className="font-semibold text-stone-600 dark:text-stone-300">
                                {byProdSearch.trim()
                                    ? `Không tìm thấy mặt hàng nào khớp với "${byProdSearch}"`
                                    : 'Không có phát sinh sản phẩm nào trong mốc thời gian này'}
                            </p>
                            <p className="text-[11px] text-stone-400">
                                Vui lòng chuyển mốc thời gian sang "Tất cả" hoặc xóa bộ lọc tìm kiếm.
                            </p>
                        </div>
                    ) : (
                        renderAggregatedReportView(
                            `Báo Cáo Tổng Hợp Theo Sản Phẩm (${aggregatedProductsForReport.length} Mặt Hàng)`,
                            shiftsForProductReport,
                            byProdLines,
                            byProdLoading,
                            () => onExportMultiShifts(
                                `BÁO CÁO TỔNG HỢP THEO MẶT HÀNG (${aggregatedProductsForReport.length} SẢN PHẨM)`,
                                shiftsForProductReport,
                                byProdLines,
                                `Bao_cao_san_pham_${byProdTimeFilter}`
                            ),
                            'Xuất Excel Báo Cáo Sản Phẩm'
                        )
                    )}
                </div>
            )}

            {/* 3. CHẾ ĐỘ: BÁO CÁO TÙY CHỌN (TÍCH CHỌN NHIỀU CÔNG VIỆC) */}
            {doneViewMode === 'custom' && (
                <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-[340px_minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)] sm:gap-5 sm:items-start">
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                        <div className="p-3 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/60 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wide text-stone-600 dark:text-stone-300">
                                    Tích chọn công việc ({customSelectedIds.size}/{filteredPastShifts.length})
                                </span>
                                {customLoading && <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />}
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-200 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={onSelectAllCustomShifts}
                                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                >
                                    <CheckSquare className="w-3.5 h-3.5" />
                                    Chọn tất cả ({filteredPastShifts.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={onDeselectAllCustomShifts}
                                    className="text-[11px] font-bold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                                >
                                    Bỏ chọn
                                </button>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                                <input
                                    type="text"
                                    value={doneSearch}
                                    onChange={e => setDoneSearch(e.target.value)}
                                    placeholder="Lọc danh sách..."
                                    className="w-full h-8 pl-8 pr-7 text-xs bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        {filteredPastShifts.length === 0 ? (
                            <div className="p-8 text-center text-xs text-stone-400">
                                Không tìm thấy công việc nào.
                            </div>
                        ) : (
                            <div className="divide-y divide-stone-100 dark:divide-zinc-800 max-h-[calc(100vh-280px)] overflow-y-auto">
                                {filteredPastShifts.map((shift, idx) => {
                                    const isChecked = customSelectedIds.has(shift.id)
                                    const jobTitle = shift.summary_data?.job_name || shift.notes || `Công việc #${idx + 1}`
                                    const pCount = Object.keys(shift.summary_data?.products_summary || {}).length
                                    const rCount = shift.summary_data?.total_records ?? 0
                                    const isClosed = shift.status === 'closed'
                                    return (
                                        <div
                                            key={shift.id || idx}
                                            onClick={() => onToggleSelectShift(shift.id)}
                                            className={`w-full text-left px-3.5 py-3 transition cursor-pointer flex items-start gap-3 border-l-4 ${
                                                isChecked
                                                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-indigo-600'
                                                    : 'border-l-transparent hover:bg-stone-50 dark:hover:bg-zinc-800/40'
                                            }`}
                                        >
                                            <div className="pt-0.5 shrink-0">
                                                {isChecked ? (
                                                    <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-stone-300 dark:text-zinc-600" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex items-start justify-between gap-1.5">
                                                    <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-white leading-snug break-words">
                                                        {jobTitle}
                                                    </span>
                                                    {isClosed ? (
                                                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                            Đã chốt
                                                        </span>
                                                    ) : (
                                                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                            Đang mở
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-stone-500 flex items-center gap-1.5 flex-wrap">
                                                    <Clock className="w-3 h-3 text-stone-400" />
                                                    <span>{formatDateTime(shift.opened_at)} → {shift.closed_at ? formatDateTime(shift.closed_at) : 'Hiện tại'}</span>
                                                </div>
                                                <div className="text-[10px] text-stone-400">
                                                    <span>{shift.closed_by_name || shift.opened_by_name || 'Nhân viên'} • {pCount} SP • {rCount} đợt</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div>
                        {customSelectedShifts.length === 0 ? (
                            <div className="bg-white dark:bg-zinc-900 border border-dashed border-stone-300 dark:border-zinc-800 rounded-2xl p-12 text-center text-xs text-stone-400 space-y-2">
                                <CheckSquare className="w-8 h-8 text-stone-300 dark:text-zinc-700 mx-auto" />
                                <p className="font-semibold text-stone-600 dark:text-stone-300">
                                    Chưa có công việc nào được chọn
                                </p>
                                <p className="text-[11px] text-stone-400">
                                    Hãy tích chọn ít nhất 1 công việc ở danh sách bên trái để tạo bảng báo cáo tổng hợp và xuất file Excel.
                                </p>
                            </div>
                        ) : (
                            renderAggregatedReportView(
                                `Báo Cáo Tổng Hợp: ${customSelectedShifts.length} Công Việc Đã Chọn`,
                                customSelectedShifts,
                                customLines,
                                customLoading,
                                () => onExportMultiShifts(
                                    `BÁO CÁO TỔNG HỢP (${customSelectedShifts.length} CÔNG VIỆC)`,
                                    customSelectedShifts,
                                    customLines,
                                    `Bao_cao_tuy_chon_${customSelectedShifts.length}_cong_viec`
                                ),
                                'Xuất Excel Báo Cáo Đã Chọn'
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
