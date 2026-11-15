'use client'

import React from 'react'
import Link from 'next/link'
import {
    Plus,
    Pin,
    Search,
    Trash2,
    RefreshCw,
    Clock,
    CheckCircle2,
    BarChart3,
    X,
    Check,
    Briefcase,
    StopCircle,
    Layers,
    ChevronDown,
    AlertTriangle,
    Zap,
    Camera,
    Images,
} from 'lucide-react'
import { ProductItem } from './types'
import { formatTimeOnly } from './utils'

interface SoLieuHeaderProps {
    isOnline: boolean
    offlineQueueCount: number
    isSyncingOffline: boolean
    onSyncOffline: () => void
    pageView: 'active' | 'done'
    setPageView: (view: 'active' | 'done') => void
    openDoneView: () => void
    openShifts: any[]
    pastShiftsCount: number
    activeShift: any
    currentJobName: string
    allJobJournalsCount: number
    subShiftsCount: number
    shiftImageCount: number
    loadingData: boolean
    doneRange: 'today' | '7d' | '30d' | 'all'
    setDoneRange: (r: 'today' | '7d' | '30d' | 'all') => void
    loadPastShifts: (r: 'today' | '7d' | '30d' | 'all') => void
    doneSearch: string
    setDoneSearch: (s: string) => void
    doneListLoading: boolean
    searchMode: 'filter' | 'pin'
    setSearchMode: React.Dispatch<React.SetStateAction<'filter' | 'pin'>>
    searchQuery: string
    setSearchQuery: (q: string) => void
    isSearching: boolean
    searchResults: ProductItem[]
    pinnedProducts: ProductItem[]
    displayedPinnedProducts: ProductItem[]
    selectedUnitMap: Record<string, string>
    viewMode: 'sub-shift' | 'shift'
    setViewMode: (m: 'sub-shift' | 'shift') => void
    desktopJobDropdown: boolean
    setDesktopJobDropdown: React.Dispatch<React.SetStateAction<boolean>>
    setMobileJobSheet: (open: boolean) => void
    setMobileMenu: (open: boolean) => void
    getProductUnits: (p: ProductItem) => string[]
    getProductCount: (name: string, unit?: string | null) => { inQty: number; outQty: number; inCount: number; outCount: number; unit: string }
    onOpenPad: (p: ProductItem) => void
    onPinProduct: (p: ProductItem) => void
    onUnpinProduct: (id: string) => void
    onAddCustomProduct: () => void
    onClearAllPins: () => void
    onOpenCreateShiftModal: () => void
    onSelectActiveShift: (shiftId: string) => void
    onDeleteOpenShift: (shiftId: string, title?: string) => void
    onShowSubShiftsPanel: () => void
    onOpenImagesModal: () => void
    onOpenInterimCloseModal: () => void
    onOpenCloseShiftModal: () => void
    onReloadJournalData: () => void
}

export default function SoLieuHeader({
    isOnline,
    offlineQueueCount,
    isSyncingOffline,
    onSyncOffline,
    pageView,
    setPageView,
    openDoneView,
    openShifts,
    pastShiftsCount,
    activeShift,
    currentJobName,
    allJobJournalsCount,
    subShiftsCount,
    shiftImageCount,
    loadingData,
    doneRange,
    setDoneRange,
    loadPastShifts,
    doneSearch,
    setDoneSearch,
    doneListLoading,
    searchMode,
    setSearchMode,
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
    pinnedProducts,
    displayedPinnedProducts,
    selectedUnitMap,
    viewMode,
    setViewMode,
    desktopJobDropdown,
    setDesktopJobDropdown,
    setMobileJobSheet,
    setMobileMenu,
    getProductUnits,
    getProductCount,
    onOpenPad,
    onPinProduct,
    onUnpinProduct,
    onAddCustomProduct,
    onClearAllPins,
    onOpenCreateShiftModal,
    onSelectActiveShift,
    onDeleteOpenShift,
    onShowSubShiftsPanel,
    onOpenImagesModal,
    onOpenInterimCloseModal,
    onOpenCloseShiftModal,
    onReloadJournalData,
}: SoLieuHeaderProps) {
    return (
        <>
            {/* ===== BANNER CẢNH BÁO CHẾ ĐỘ NGOẠI TUYẾN / KHO ĐÔNG LẠNH ===== */}
            {(!isOnline || offlineQueueCount > 0) && (
                <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-bold truncate">
                                {!isOnline
                                    ? '⚠️ Đang làm việc Ngoại Tuyến (Offline trong Kho Đông Lạnh)'
                                    : '📡 Có số liệu ngoại tuyến sẵn sàng đồng bộ'}
                            </div>
                            <div className="text-[11px] text-amber-700/80 dark:text-amber-300/80 truncate">
                                {offlineQueueCount > 0
                                    ? `Đang lưu an toàn ${offlineQueueCount} thao tác trong máy • Bấm Đồng bộ khi có sóng mạng.`
                                    : 'Mất sóng Internet. Bạn vẫn có thể nhập/xuất và mở/đóng ca bình thường không gián đoạn.'}
                            </div>
                        </div>
                    </div>

                    {offlineQueueCount > 0 && (
                        <button
                            type="button"
                            onClick={onSyncOffline}
                            disabled={isSyncingOffline}
                            className="shrink-0 h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOffline ? 'animate-spin' : ''}`} />
                            <span>{isSyncingOffline ? 'Đang gửi...' : 'Đồng bộ ngay'}</span>
                        </button>
                    )}
                </div>
            )}

            {/* ===== MOBILE HEADER GỌN: Chuyển chế độ Đang làm / Đã hoàn thành + chọn CV + tìm kiếm ===== */}
            <header className="sm:hidden sticky top-0 z-30 bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 px-3 pt-2 pb-2 space-y-1.5">
                <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 dark:bg-zinc-800 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setPageView('active')}
                        className={`h-7 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
                            pageView === 'active'
                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-stone-500 dark:text-stone-400'
                        }`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${openShifts.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'}`} />
                        Đang làm ({openShifts.length})
                    </button>
                    <button
                        type="button"
                        onClick={openDoneView}
                        className={`h-7 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
                            pageView === 'done'
                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-stone-500 dark:text-stone-400'
                        }`}
                    >
                        <CheckCircle2 className="w-3 h-3" />
                        Đã hoàn thành ({pastShiftsCount})
                    </button>
                </div>

                {pageView === 'active' && (
                    <>
                        <div className="flex items-center gap-1.5">
                            {activeShift ? (
                                <button
                                    type="button"
                                    onClick={() => setMobileJobSheet(true)}
                                    className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-indigo-600 text-white flex items-center gap-2 active:scale-[0.98] transition"
                                >
                                    <Briefcase className="w-3.5 h-3.5 shrink-0 opacity-80" />
                                    <span className="flex-1 min-w-0 text-left">
                                        <span className="block text-[9px] leading-none opacity-75">
                                            Công việc {openShifts.length > 1 ? `(${openShifts.length} đang mở)` : ''}
                                        </span>
                                        <span className="block text-xs font-bold truncate leading-tight mt-0.5">{currentJobName}</span>
                                    </span>
                                    <span className="text-[11px] opacity-80 shrink-0">▼</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={onOpenCreateShiftModal}
                                    className="flex-1 h-10 px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Tạo công việc
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setMobileMenu(true)}
                                className="w-10 h-10 shrink-0 rounded-xl border border-stone-200 dark:border-zinc-700 flex items-center justify-center text-stone-600 dark:text-stone-300 text-lg font-bold leading-none"
                                aria-label="Thao tác"
                            >
                                ⋯
                            </button>
                        </div>

                        {activeShift && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchMode(prev => prev === 'filter' ? 'pin' : 'filter')
                                        setSearchQuery('')
                                    }}
                                    title="Bấm chuyển đổi chế độ tìm kiếm"
                                    className={`absolute left-1.5 top-1/2 -translate-y-1/2 h-7 px-2 rounded-lg flex items-center gap-1 transition-all z-10 cursor-pointer shadow-2xs ${
                                        searchMode === 'filter'
                                            ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                            : 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    }`}
                                >
                                    <Search className="w-3.5 h-3.5 shrink-0" />
                                    <span className="text-[10px] font-black tracking-tight select-none">
                                        {searchMode === 'filter' ? 'Nhập' : 'Ghim'}
                                    </span>
                                </button>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            if (searchMode === 'filter') {
                                                const target = searchResults[0] || displayedPinnedProducts[0]
                                                if (target) {
                                                    onOpenPad(target)
                                                    setSearchQuery('')
                                                }
                                            }
                                        }
                                    }}
                                    placeholder={
                                        searchMode === 'filter'
                                            ? 'Tìm SP đã ghim (Bấm 🔍 đổi chế độ)'
                                            : 'Tìm SP từ kho (Bấm 🔍 đổi chế độ)'
                                    }
                                    className={`w-full h-9 pl-[76px] pr-8 text-xs placeholder:text-[10.5px] placeholder:text-stone-400 dark:placeholder:text-zinc-500 bg-stone-100 dark:bg-zinc-800 border rounded-xl focus:outline-none transition ${
                                        searchMode === 'filter'
                                            ? 'border-indigo-300 dark:border-indigo-700/60 focus:border-indigo-500'
                                            : 'border-amber-300 dark:border-amber-700/60 focus:border-amber-500'
                                    }`}
                                />

                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-stone-400"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {isSearching && searchMode === 'pin' && (
                                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl shadow-xl z-40 overflow-hidden divide-y divide-stone-100 dark:divide-zinc-700/50 max-h-[60vh] overflow-y-auto">
                                        {searchResults.length > 0 ? (
                                            searchResults.map(p => {
                                                const isPinned = pinnedProducts.some(pinned => pinned.id === p.id)
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isPinned) onUnpinProduct(p.id)
                                                            else onPinProduct(p)
                                                        }}
                                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left active:bg-stone-100 dark:active:bg-zinc-700"
                                                    >
                                                        <span className="flex-1 min-w-0">
                                                            <span className="block text-xs font-semibold text-stone-900 dark:text-white leading-snug">{p.name}</span>
                                                            <span className="block text-[10px] text-stone-400 mt-0.5">
                                                                {p.sku || 'Chưa có mã'}
                                                                {p.aliases && ` • Gõ tắt: ${p.aliases}`}
                                                            </span>
                                                        </span>
                                                        <span className={`shrink-0 h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                                                            isPinned ? 'bg-stone-200 dark:bg-zinc-700 text-stone-600 dark:text-stone-300' : 'bg-indigo-600 text-white'
                                                        }`}>
                                                            {isPinned ? <><Check className="w-3 h-3" /> Đã ghim</> : <><Pin className="w-3 h-3" /> Ghim</>}
                                                        </span>
                                                    </button>
                                                )
                                            })
                                        ) : (
                                            <div className="p-3.5 text-center">
                                                <p className="text-[11px] text-stone-500 mb-2">Không tìm thấy sản phẩm.</p>
                                                <button
                                                    onClick={onAddCustomProduct}
                                                    className="h-8 px-3 text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                                >
                                                    + Ghim hàng tự do: "{searchQuery}"
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {isSearching && searchMode === 'filter' && (
                                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-xl z-40 overflow-hidden divide-y divide-stone-100 dark:divide-zinc-700/50 max-h-[60vh] overflow-y-auto">
                                        <div className="px-3 py-1.5 bg-indigo-50/70 dark:bg-indigo-950/40 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                                            <span>Tìm thấy {searchResults.length} sản phẩm đã ghim</span>
                                        </div>
                                        {searchResults.length > 0 ? (
                                            searchResults.map((p, sIdx) => {
                                                const origIdx = pinnedProducts.findIndex(x => x.id === p.id)
                                                const productUnits = getProductUnits(p)
                                                const currentUnit = selectedUnitMap[p.id] || p.unit || productUnits[0] || 'Kg'
                                                const counts = getProductCount(p.name, currentUnit)
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => {
                                                            onOpenPad(p)
                                                            setSearchQuery('')
                                                        }}
                                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left active:bg-indigo-50 dark:active:bg-zinc-700"
                                                    >
                                                        <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                                            {origIdx >= 0 ? origIdx + 1 : sIdx + 1}
                                                        </span>
                                                        <span className="flex-1 min-w-0">
                                                            <span className="block text-xs font-semibold text-stone-900 dark:text-white leading-snug">{p.name}</span>
                                                            <span className="block text-[10px] text-stone-400 mt-0.5">
                                                                {p.sku || 'Chưa có mã'}
                                                                {p.aliases && ` (${p.aliases})`}
                                                                {' • ĐVT: '}{currentUnit}
                                                                {(counts.inQty > 0 || counts.outQty > 0) && (
                                                                    <span className="ml-1.5 font-bold">
                                                                        {counts.inQty > 0 && <span className="text-emerald-600 mr-1">+{counts.inQty}</span>}
                                                                        {counts.outQty > 0 && <span className="text-rose-600">-{counts.outQty}</span>}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </span>
                                                        <span className="shrink-0 h-7 px-2.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white flex items-center gap-1 shadow-xs">
                                                            <Zap className="w-3 h-3 fill-white" /> Nhập
                                                        </span>
                                                    </button>
                                                )
                                            })
                                        ) : (
                                            <div className="p-3.5 text-center">
                                                <p className="text-[11px] text-stone-500 mb-2">Không tìm thấy sản phẩm đã ghim nào khớp với "{searchQuery}".</p>
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchMode('pin')}
                                                    className="h-8 px-3 text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                                >
                                                    Tìm trong kho để ghim
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </header>

            {/* ===== DESKTOP HEADER GỌN ===== */}
            <header className="hidden sm:block bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 sticky top-0 z-30 shadow-xs">
                <div className="max-w-7xl mx-auto px-6 py-1.5 flex items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                            <BarChart3 className="w-4 h-4" />
                        </div>
                        <h1 className="text-sm font-bold text-stone-900 dark:text-white whitespace-nowrap">Bàn Số Liệu</h1>
                    </div>

                    <div className="inline-flex p-0.5 bg-stone-100 dark:bg-zinc-800 rounded-lg shrink-0">
                        <button
                            type="button"
                            onClick={() => setPageView('active')}
                            className={`h-7 px-2.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
                                pageView === 'active'
                                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                            }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${openShifts.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'}`} />
                            Đang làm ({openShifts.length})
                        </button>
                        <button
                            type="button"
                            onClick={openDoneView}
                            className={`h-7 px-2.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
                                pageView === 'done'
                                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                            }`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã hoàn thành ({pastShiftsCount})
                        </button>
                    </div>

                    <div className="w-px h-6 bg-stone-200 dark:bg-zinc-700 shrink-0" />

                    {pageView === 'active' ? (
                        <>
                            <div className="flex-1 min-w-0" />

                            {activeShift && (
                                <div className="shrink-0 flex items-center gap-1.5">
                                    {subShiftsCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={onShowSubShiftsPanel}
                                            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center gap-1"
                                            title="Xem các lần chốt tạm"
                                        >
                                            <Layers className="w-3.5 h-3.5" /> {subShiftsCount} lần chốt
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={onOpenImagesModal}
                                        className="h-8 px-2.5 rounded-lg text-xs font-semibold border border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300 flex items-center gap-1 transition"
                                        title="Xem & chụp ảnh chứng minh của công việc"
                                    >
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>Ảnh{shiftImageCount > 0 ? ` (${shiftImageCount})` : ''}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onOpenInterimCloseModal}
                                        className="h-8 px-2.5 rounded-lg text-xs font-semibold border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 flex items-center gap-1 transition"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Chốt tạm
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onOpenCloseShiftModal}
                                        className="h-8 px-3 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 transition shadow-xs"
                                    >
                                        <StopCircle className="w-3.5 h-3.5" /> Hoàn thành CV
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDeleteOpenShift(activeShift.id, currentJobName)}
                                        title={`Xóa nhanh công việc "${currentJobName}"`}
                                        className="h-8 w-8 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0 transition"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-stone-200 dark:border-zinc-700">
                                <Link
                                    href="/so-lieu/album-anh"
                                    className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition"
                                    title="Quản lý Album hình ảnh nhập xuất"
                                >
                                    <Images className="w-3.5 h-3.5 text-sky-500" />
                                    <span>Album ảnh</span>
                                </Link>
                                <Link
                                    href="/so-lieu/mau-cong-viec"
                                    className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition"
                                    title="Quản lý và tạo mới các công việc mẫu"
                                >
                                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Mẫu CV</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={onReloadJournalData}
                                    disabled={loadingData}
                                    title="Tải lại số liệu"
                                    className="w-8 h-8 rounded-lg border border-stone-200 dark:border-zinc-700 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex-1 flex items-center gap-2">
                                <div className="inline-flex rounded-lg border border-stone-200 dark:border-zinc-700 overflow-hidden text-xs font-semibold">
                                    {([
                                        { id: 'today', label: 'Hôm nay' },
                                        { id: '7d', label: '7 ngày' },
                                        { id: '30d', label: '30 ngày' },
                                        { id: 'all', label: 'Tất cả' },
                                    ] as const).map((r, i) => (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => { setDoneRange(r.id); loadPastShifts(r.id) }}
                                            className={`h-7 px-2.5 transition ${i > 0 ? 'border-l border-stone-200 dark:border-zinc-700' : ''} ${
                                                doneRange === r.id
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-white dark:bg-zinc-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
                                            }`}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative flex-1 max-w-xs">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                                    <input
                                        type="text"
                                        value={doneSearch}
                                        onChange={e => setDoneSearch(e.target.value)}
                                        placeholder="Tìm công việc hoặc sản phẩm..."
                                        className="w-full h-7 pl-8 pr-7 text-xs bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    {doneSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setDoneSearch('')}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                <Link
                                    href="/so-lieu/mau-cong-viec"
                                    className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition"
                                    title="Quản lý và tạo mới các công việc mẫu"
                                >
                                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Mẫu CV</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={onOpenCreateShiftModal}
                                    className="h-8 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Tạo công việc mới
                                </button>
                                <button
                                    type="button"
                                    onClick={() => loadPastShifts(doneRange)}
                                    disabled={doneListLoading}
                                    title="Tải lại danh sách"
                                    className="w-8 h-8 rounded-lg border border-stone-200 dark:border-zinc-700 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${doneListLoading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Hàng 2: Danh sách công việc (Dropdown) + Tìm kiếm & Ghim sản phẩm */}
                {pageView === 'active' && activeShift && (
                    <div className="border-t border-stone-100 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/40">
                        <div className="max-w-7xl mx-auto px-6 py-1 flex items-center gap-2.5">
                            <div className="relative shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setDesktopJobDropdown(prev => !prev)}
                                    className="h-8 px-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-800 hover:bg-indigo-50/50 dark:hover:bg-zinc-700/60 text-stone-900 dark:text-white flex items-center justify-between gap-2.5 transition min-w-[260px] sm:min-w-[320px] lg:min-w-[380px] max-w-lg group shadow-2xs"
                                    title="Bấm để chọn hoặc chuyển sang công việc khác"
                                >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse shrink-0" />
                                        <span className="text-xs font-bold text-stone-900 dark:text-white truncate max-w-[200px] sm:max-w-[250px] lg:max-w-[300px]">
                                            {currentJobName}
                                        </span>
                                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">
                                            ({allJobJournalsCount} đợt)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 pl-1">
                                        {openShifts.length > 1 && (
                                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                                {openShifts.length} việc
                                            </span>
                                        )}
                                        <ChevronDown className={`w-3.5 h-3.5 text-stone-400 group-hover:text-indigo-600 transition-transform duration-200 ${desktopJobDropdown ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>

                                {desktopJobDropdown && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setDesktopJobDropdown(false)}
                                        />
                                        <div className="absolute top-full left-0 mt-1.5 w-88 sm:w-[420px] bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-stone-100 dark:divide-zinc-800 animate-in fade-in zoom-in-95 duration-100">
                                            <div className="px-3.5 py-2 bg-stone-50 dark:bg-zinc-850 flex items-center justify-between text-xs font-semibold text-stone-500">
                                                <span>Danh sách công việc ({openShifts.length} đang mở)</span>
                                                <button
                                                    type="button"
                                                    onClick={() => { setDesktopJobDropdown(false); onOpenCreateShiftModal(); }}
                                                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Tạo mới
                                                </button>
                                            </div>

                                            <div className="max-h-72 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800/60">
                                                {openShifts.map((shift, idx) => {
                                                    const isSelected = activeShift?.id === shift.id
                                                    const jobTitle = shift.summary_data?.job_name || shift.notes || `Công việc ${idx + 1}`
                                                    return (
                                                        <div
                                                            key={shift.id}
                                                            onClick={() => {
                                                                onSelectActiveShift(shift.id)
                                                                setDesktopJobDropdown(false)
                                                            }}
                                                            className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition ${
                                                                isSelected
                                                                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                                                                    : 'hover:bg-stone-50 dark:hover:bg-zinc-800/60'
                                                            }`}
                                                        >
                                                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isSelected ? 'bg-indigo-600 ring-2 ring-indigo-300' : 'bg-emerald-500'}`} />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className={`text-xs font-bold leading-snug break-words ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-stone-800 dark:text-stone-100'}`}>
                                                                        {jobTitle}
                                                                    </div>
                                                                    <div className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                                                                        <Clock className="w-3 h-3 shrink-0" />
                                                                        <span>Mở {formatTimeOnly(shift.opened_at)}</span>
                                                                        <span>•</span>
                                                                        <span>{isSelected ? `${allJobJournalsCount} đợt` : 'Đang mở'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {isSelected && (
                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                                                                        Đang làm
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        onDeleteOpenShift(shift.id, jobTitle)
                                                                    }}
                                                                    title={`Xóa công việc "${jobTitle}"`}
                                                                    className="w-7 h-7 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 flex items-center justify-center transition"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            <div className="p-2 bg-stone-50/50 dark:bg-zinc-800/30">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDesktopJobDropdown(false)
                                                        onOpenCreateShiftModal()
                                                    }}
                                                    className="w-full h-8 px-3 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center justify-center gap-1.5 transition"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    <span>Thêm công việc khác</span>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={onOpenCreateShiftModal}
                                title="Thêm công việc mới"
                                className="h-8 w-8 rounded-lg border-2 border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-center shrink-0 transition"
                            >
                                <Plus className="w-4 h-4" />
                            </button>

                            <div className="w-px h-5 bg-stone-200 dark:bg-zinc-700 shrink-0" />

                            <div className="relative flex-1 min-w-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchMode(prev => prev === 'filter' ? 'pin' : 'filter')
                                        setSearchQuery('')
                                    }}
                                    title="Bấm chuyển đổi chế độ tìm kiếm"
                                    className={`absolute left-1.5 top-1/2 -translate-y-1/2 h-6 px-1.5 rounded-md flex items-center gap-1 transition-all z-10 cursor-pointer shadow-2xs ${
                                        searchMode === 'filter'
                                            ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                            : 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    }`}
                                >
                                    <Search className="w-3.5 h-3.5 shrink-0" />
                                    <span className="text-[10px] font-black tracking-tight select-none">
                                        {searchMode === 'filter' ? 'Nhập' : 'Ghim'}
                                    </span>
                                </button>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            if (searchMode === 'filter') {
                                                const target = searchResults[0] || displayedPinnedProducts[0]
                                                if (target) {
                                                    onOpenPad(target)
                                                    setSearchQuery('')
                                                }
                                            }
                                        }
                                    }}
                                    placeholder={
                                        searchMode === 'filter'
                                            ? 'Tìm SP đã ghim để nhập số (Bấm 🔍 đổi chế độ)'
                                            : 'Tìm SP trong kho để ghim (Bấm 🔍 đổi chế độ)'
                                    }
                                    className={`w-full h-8 pl-[78px] pr-8 text-xs placeholder:text-[10.5px] placeholder:text-stone-400 dark:placeholder:text-zinc-500 bg-white dark:bg-zinc-800 border rounded-lg focus:ring-2 focus:border-transparent focus:outline-none transition ${
                                        searchMode === 'filter'
                                            ? 'border-indigo-200 dark:border-indigo-800/80 focus:ring-indigo-500'
                                            : 'border-amber-200 dark:border-amber-800/80 focus:ring-amber-500'
                                    }`}
                                />

                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {isSearching && searchMode === 'pin' && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl shadow-xl z-40 overflow-hidden divide-y divide-stone-100 dark:divide-zinc-700/50 max-h-[60vh] overflow-y-auto">
                                        {searchResults.length > 0 ? (
                                            searchResults.map(p => {
                                                const isPinned = pinnedProducts.some(pinned => pinned.id === p.id)
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isPinned) onUnpinProduct(p.id)
                                                            else onPinProduct(p)
                                                        }}
                                                        className="w-full flex items-center gap-3 px-3.5 py-2 text-left hover:bg-stone-50 dark:hover:bg-zinc-700/50"
                                                    >
                                                        <span className="flex-1 min-w-0">
                                                            <span className="block text-xs font-semibold text-stone-900 dark:text-white">{p.name}</span>
                                                            <span className="block text-[11px] text-stone-400 mt-0.5">
                                                                {p.sku || 'Chưa có mã'}
                                                                {p.available_units && p.available_units.length > 0 && ` • ${p.available_units.join(', ')}`}
                                                                {p.aliases && ` • Gõ tắt: ${p.aliases}`}
                                                            </span>
                                                        </span>
                                                        <span className={`shrink-0 h-7 px-2.5 rounded-md text-xs font-bold flex items-center gap-1 ${
                                                            isPinned ? 'bg-stone-200 dark:bg-zinc-700 text-stone-600 dark:text-stone-300' : 'bg-indigo-600 text-white'
                                                        }`}>
                                                            {isPinned ? <><Check className="w-3 h-3" /> Đã ghim</> : <><Pin className="w-3 h-3" /> Ghim</>}
                                                        </span>
                                                    </button>
                                                )
                                            })
                                        ) : (
                                            <div className="p-3 text-center">
                                                <p className="text-xs text-stone-500 mb-1.5">Không tìm thấy sản phẩm trong danh mục.</p>
                                                <button
                                                    onClick={onAddCustomProduct}
                                                    className="h-7 px-3 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                                >
                                                    + Ghim hàng tự do: "{searchQuery}"
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {isSearching && searchMode === 'filter' && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-xl z-40 overflow-hidden divide-y divide-stone-100 dark:divide-zinc-700/50 max-h-[60vh] overflow-y-auto">
                                        <div className="px-3 py-1.5 bg-indigo-50/70 dark:bg-indigo-950/40 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                                            <span>Tìm thấy {searchResults.length} sản phẩm đã ghim (Bấm hoặc nhấn Enter để nhập số)</span>
                                            <span className="text-[10px] text-stone-400">Esc để đóng</span>
                                        </div>
                                        {searchResults.length > 0 ? (
                                            searchResults.map((p, sIdx) => {
                                                const origIdx = pinnedProducts.findIndex(x => x.id === p.id)
                                                const productUnits = getProductUnits(p)
                                                const currentUnit = selectedUnitMap[p.id] || p.unit || productUnits[0] || 'Kg'
                                                const counts = getProductCount(p.name, currentUnit)
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => {
                                                            onOpenPad(p)
                                                            setSearchQuery('')
                                                        }}
                                                        className={`w-full flex items-center gap-3 px-3.5 py-2 text-left hover:bg-indigo-50/50 dark:hover:bg-zinc-700/50 transition ${
                                                            sIdx === 0 ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                                                        }`}
                                                    >
                                                        <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                                            {origIdx >= 0 ? origIdx + 1 : sIdx + 1}
                                                        </span>
                                                        <span className="flex-1 min-w-0">
                                                            <span className="block text-xs font-semibold text-stone-900 dark:text-white leading-snug">{p.name}</span>
                                                            <span className="block text-[11px] text-stone-400 mt-0.5">
                                                                {p.sku || 'Chưa có mã'}
                                                                {p.aliases && ` (${p.aliases})`}
                                                                {' • ĐVT: '}<span className="font-semibold text-stone-600 dark:text-stone-300">{currentUnit}</span>
                                                                {(counts.inQty > 0 || counts.outQty > 0) && (
                                                                    <span className="ml-2 font-bold">
                                                                        {counts.inQty > 0 && <span className="text-emerald-600 mr-1.5">+{counts.inQty}</span>}
                                                                        {counts.outQty > 0 && <span className="text-rose-600">-{counts.outQty}</span>}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </span>
                                                        <span className="shrink-0 h-7 px-3 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-xs">
                                                            <Zap className="w-3 h-3 fill-white" /> Nhập số
                                                        </span>
                                                    </button>
                                                )
                                            })
                                        ) : (
                                            <div className="p-4 text-center">
                                                <p className="text-xs text-stone-500 mb-2">Không tìm thấy sản phẩm đã ghim nào khớp với "{searchQuery}".</p>
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchMode('pin')}
                                                    className="h-7 px-3 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                                >
                                                    Chuyển sang tìm trong kho để ghim SP này
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {subShiftsCount > 0 && (
                                <div className="inline-flex rounded-lg border border-stone-200 dark:border-zinc-700 overflow-hidden text-xs font-semibold shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('sub-shift')}
                                        className={`h-7 px-2.5 ${viewMode === 'sub-shift' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-800 text-stone-600 dark:text-stone-300'}`}
                                    >
                                        Đợt hiện tại
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('shift')}
                                        className={`h-7 px-2.5 border-l border-stone-200 dark:border-zinc-700 ${viewMode === 'shift' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-800 text-stone-600 dark:text-stone-300'}`}
                                    >
                                        Toàn CV
                                    </button>
                                </div>
                            )}

                            <div className="ml-auto flex items-center gap-2 text-xs text-stone-500 shrink-0">
                                <span>Đã ghim: <strong className="text-stone-800 dark:text-white">{pinnedProducts.length} SP</strong></span>
                                {pinnedProducts.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={onClearAllPins}
                                        title="Xóa toàn bộ danh sách sản phẩm đã ghim"
                                        className="w-7 h-7 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </header>
        </>
    )
}
