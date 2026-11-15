'use client'

import React from 'react'
import {
    Search,
    Layers,
    X,
    Loader2,
    ArrowLeft,
    Edit3,
    FileSpreadsheet,
    Unlink,
} from 'lucide-react'
import { decodeSTT } from '@/lib/numberUtils'
import { getBoxIndex } from './palletHelpers'
import type { BoxLabelItem, PalletLot } from './types'

interface LinkedPalletsTabProps {
    isLoading: boolean
    filteredLinkedPallets: PalletLot[]
    selectedPallet: PalletLot | null
    setSelectedPallet: (pallet: PalletLot | null) => void
    showMobileDetail: boolean
    setShowMobileDetail: (show: boolean) => void
    searchQuery: string
    setSearchQuery: (q: string) => void
    boxSearchQuery: string
    setBoxSearchQuery: (q: string) => void
    filteredBoxes: BoxLabelItem[]
    isExporting: boolean
    isUnlinkingId: string | null
    handleOpenEditLinkedLot: (pallet: PalletLot) => void
    handleExportExcel: (pallet: PalletLot) => void
    handleUnlinkEntirePallet: (pallet: PalletLot) => void
    handleOpenEditBox: (box: BoxLabelItem) => void
    handleUnlinkBox: (box: BoxLabelItem) => void
}

export function LinkedPalletsTab({
    isLoading,
    filteredLinkedPallets,
    selectedPallet,
    setSelectedPallet,
    showMobileDetail,
    setShowMobileDetail,
    searchQuery,
    setSearchQuery,
    boxSearchQuery,
    setBoxSearchQuery,
    filteredBoxes,
    isExporting,
    isUnlinkingId,
    handleOpenEditLinkedLot,
    handleExportExcel,
    handleUnlinkEntirePallet,
    handleOpenEditBox,
    handleUnlinkBox,
}: LinkedPalletsTabProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
            {/* PANEL TRÁI: DANH SÁCH LOT / PALLET ĐÃ KẾT NỐI (4 Cols) */}
            <div className={`lg:col-span-4 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs overflow-hidden ${showMobileDetail ? 'hidden lg:flex' : 'flex'}`}>
                {/* Search Bar */}
                <div className="p-3 border-b border-stone-100 dark:border-zinc-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
                        <input
                            type="text"
                            placeholder="Tìm theo STT (C544, F3219...), mã LOT..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700 rounded-xl text-xs text-stone-800 dark:text-zinc-200 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                    </div>
                </div>

                {/* Pallet List */}
                <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800/60 p-2 space-y-1.5">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-stone-400">
                            <Loader2 className="animate-spin mb-2" size={24} />
                            <span className="text-xs">Đang tải danh sách Pallet...</span>
                        </div>
                    ) : filteredLinkedPallets.length === 0 ? (
                        <div className="text-center py-16 px-4">
                            <Layers className="mx-auto text-stone-300 dark:text-zinc-600 mb-2" size={36} />
                            <p className="text-xs font-bold text-stone-600 dark:text-zinc-400">
                                Không tìm thấy Pallet nào đã kết nối
                            </p>
                            <p className="text-[11px] text-stone-400 dark:text-zinc-500 mt-1">
                                Hãy quét tem và đồng bộ từ App di động, hoặc kiểm tra tab "Chưa kết nối".
                            </p>
                        </div>
                    ) : (
                        filteredLinkedPallets.map(pallet => {
                            const isSelected = selectedPallet?.id === pallet.id
                            const count = pallet.box_labels.length
                            const isFull = count >= 30
                            const totalWeight = pallet.box_labels.reduce((s, b) => s + (Number(b.quantity) || 0), 0)
                            const sttDisplay = pallet.daily_seq ? decodeSTT(pallet.daily_seq) : pallet.code

                            return (
                                <div
                                    key={pallet.id}
                                    onClick={() => {
                                        setSelectedPallet(pallet)
                                        setShowMobileDetail(true)
                                    }}
                                    className={`p-3 rounded-xl cursor-pointer transition-all border ${
                                        isSelected
                                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/40 shadow-xs'
                                            : 'bg-white dark:bg-zinc-900 border-stone-100 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-zinc-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200/50 dark:border-emerald-800/40">
                                                STT: {sttDisplay}
                                            </span>
                                            <span className="font-mono text-xs text-stone-500 dark:text-zinc-400">
                                                ({pallet.code})
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setSelectedPallet(pallet)
                                                    handleOpenEditLinkedLot(pallet)
                                                }}
                                                className="p-1 text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                                title="Sửa toàn bộ thông tin LOT này"
                                            >
                                                <Edit3 size={13} />
                                            </button>
                                            {pallet.status === 'exported' && (
                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                    Đã xuất kho
                                                </span>
                                            )}
                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                                isFull
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                            }`}>
                                                {count}/30 thùng
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-xs font-bold text-stone-800 dark:text-zinc-200 truncate mb-2">
                                        {pallet.products?.name || 'Sản phẩm chưa định danh'}
                                    </p>

                                    <div className="w-full bg-stone-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mb-2">
                                        <div
                                            className={`h-full transition-all duration-300 ${isFull ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                            style={{ width: `${Math.min(100, (count / 30) * 100)}%` }}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-zinc-400 pt-1 border-t border-stone-100 dark:border-zinc-800/60">
                                        <span>KL: <strong className="text-stone-800 dark:text-zinc-200">{totalWeight.toFixed(1)} Kg</strong></span>
                                        <span>{new Date(pallet.created_at).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* PANEL PHẢI: CHI TIẾT 30 THÙNG CỦA PALLET ĐANG CHỌN (8 Cols) */}
            <div className={`lg:col-span-8 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs overflow-hidden ${showMobileDetail ? 'flex' : 'hidden lg:flex'}`}>
                {!selectedPallet ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-stone-400 py-20">
                        <Layers size={40} className="text-stone-300 dark:text-zinc-600 mb-2" />
                        <p className="text-xs font-bold text-stone-600 dark:text-zinc-400">
                            Chọn một Pallet ở cột bên trái để xem chi tiết 30 thùng
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Header Panel Phải */}
                        <div className="p-4 border-b border-stone-100 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900/50">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowMobileDetail(false)}
                                        className="lg:hidden p-1.5 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-black text-stone-900 dark:text-zinc-100">
                                                Pallet STT: {selectedPallet.daily_seq ? decodeSTT(selectedPallet.daily_seq) : selectedPallet.code}
                                            </h2>
                                            <span className="font-mono text-xs text-stone-500 dark:text-zinc-400">
                                                [LOT: {selectedPallet.code}]
                                            </span>
                                            {selectedPallet.status === 'exported' && (
                                                <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                    🚢 Đã xuất kho / Đã bán
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-stone-600 dark:text-zinc-400 font-medium">
                                            {selectedPallet.products?.name || 'Chưa gán tên sản phẩm'} · Tiến độ: {selectedPallet.box_labels.length}/30 thùng · Tổng: {selectedPallet.box_labels.reduce((s, b) => s + (Number(b.quantity) || 0), 0).toFixed(1)} Kg
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleOpenEditLinkedLot(selectedPallet)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                                        title="Chỉnh sửa toàn bộ thông tin LOT (Sản phẩm, ngày tháng, xuất xứ...)"
                                    >
                                        <Edit3 size={14} />
                                        <span>Sửa thông tin LOT</span>
                                    </button>

                                    <button
                                        onClick={() => handleExportExcel(selectedPallet)}
                                        disabled={isExporting}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                                        <span>Xuất Excel Pallet</span>
                                    </button>

                                    <button
                                        onClick={() => handleUnlinkEntirePallet(selectedPallet)}
                                        title="Hủy liên kết Pallet (Chuyển về Chưa kết nối)"
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                                    >
                                        <Unlink size={14} />
                                        <span>Hủy liên kết LOT</span>
                                    </button>
                                </div>
                            </div>

                            {/* Search thùng */}
                            <div className="mt-3 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Tìm nhanh trong 30 thùng: STT, mã thùng, quy cách, tổ..."
                                    value={boxSearchQuery}
                                    onChange={e => setBoxSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl text-xs text-stone-800 dark:text-zinc-200 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Danh sách 30 thẻ thùng */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {filteredBoxes.length === 0 ? (
                                <div className="text-center py-12 text-stone-400 text-xs">
                                    Không có thùng nào khớp với từ khóa tìm kiếm.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {filteredBoxes.map(box => {
                                        const idx = getBoxIndex(box)
                                        const meta = box.metadata || {}

                                        return (
                                            <div
                                                key={box.id}
                                                className="p-3 bg-stone-50/70 dark:bg-zinc-800/40 rounded-xl border border-stone-200/80 dark:border-zinc-800 hover:border-emerald-400 transition-all group"
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-7 h-7 flex items-center justify-center font-black text-xs bg-emerald-600 text-white rounded-lg">
                                                            #{idx}
                                                        </span>
                                                        <div>
                                                            <p className="font-mono font-bold text-xs text-stone-800 dark:text-zinc-200 truncate max-w-[130px]" title={box.code}>
                                                                {box.code}
                                                            </p>
                                                            <p className="text-[10px] text-stone-500">
                                                                LOT: <strong className="text-stone-700 dark:text-zinc-300">{box.finished_lot_code || box.semi_finished_lot_code || '---'}</strong>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleOpenEditBox(box)}
                                                            title="Sửa thông tin thùng"
                                                            className="p-1 text-stone-400 hover:text-emerald-600 rounded-md hover:bg-white dark:hover:bg-zinc-700"
                                                        >
                                                            <Edit3 size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleUnlinkBox(box)}
                                                            disabled={isUnlinkingId === box.id}
                                                            title="Gỡ thùng này ra khỏi Pallet"
                                                            className="p-1 text-stone-400 hover:text-rose-600 rounded-md hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-50"
                                                        >
                                                            {isUnlinkingId === box.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {meta.scan_type === 'stamp' ? (
                                                    <div className="bg-amber-50/80 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200/80 dark:border-amber-800/60 text-[10px] space-y-1 mb-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-extrabold text-[10px] text-amber-700 dark:text-amber-400">📦 ĐÓNG DẤU MỰC</span>
                                                            <span className="font-mono text-stone-500">#{idx}</span>
                                                        </div>
                                                        <p className="truncate"><strong className="text-stone-500">Dòng 1:</strong> <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">{meta.stamp_line1 || '---'}</span></p>
                                                        <p className="truncate"><strong className="text-stone-500">Dòng 2:</strong> <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">{meta.stamp_line2 || '---'}</span></p>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-2 gap-1 text-[10px] bg-white dark:bg-zinc-800/80 p-2 rounded-lg border border-stone-100 dark:border-zinc-700/60 mb-2">
                                                        <div>
                                                            <span className="text-stone-400 block">Quy cách:</span>
                                                            <span className="font-bold text-stone-700 dark:text-zinc-300 truncate block">{meta.spec || '---'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-stone-400 block">Tổ / Ca:</span>
                                                            <span className="font-bold text-stone-700 dark:text-zinc-300 truncate block">{meta.shift_group || '---'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-stone-400 block">Ngày SX:</span>
                                                            <span className="font-bold text-amber-600 dark:text-amber-400 truncate block">{meta.production_date || '---'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-stone-400 block">Ngày ĐG:</span>
                                                            <span className="font-bold text-stone-700 dark:text-zinc-300 truncate block">{meta.packaging_date || '---'}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between text-[11px] pt-1">
                                                    <span className="text-stone-400 text-[10px]">Trọng lượng:</span>
                                                    <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                                                        {Number(box.quantity || 20).toFixed(1)} {box.unit}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
