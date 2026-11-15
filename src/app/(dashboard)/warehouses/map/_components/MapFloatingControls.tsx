'use client'

import React from 'react'
import {
    ChevronUp,
    ChevronDown,
    Layers,
    X,
    Maximize2,
    Bookmark,
    FileSpreadsheet,
    Printer,
    Trash2,
    Eye,
    ListFilter,
    PackageOpen,
} from 'lucide-react'
import { groupWarehouseData } from '@/lib/warehouseUtils'

interface MarkedFilterBannerProps {
    onlyShowMarked: boolean
    markedCount: number
    setIsMarkedListModalOpen: (open: boolean) => void
    printMarked: () => void
    onExportMarkedExcel: () => void
    setOnlyShowMarked: (val: boolean) => void
    clearAllMarks: () => void
}

export function MarkedFilterBanner({
    onlyShowMarked,
    markedCount,
    setIsMarkedListModalOpen,
    printMarked,
    onExportMarkedExcel,
    setOnlyShowMarked,
    clearAllMarks,
}: MarkedFilterBannerProps) {
    if (!onlyShowMarked) return null

    return (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                    <Bookmark size={20} className="fill-white" />
                </div>
                <div>
                    <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm sm:text-base">
                        <span>Đang lọc vị trí đánh dấu kiểm tra</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200">
                            {markedCount} vị trí
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Chỉ các vị trí bạn đã đánh dấu đang được hiển thị trên sơ đồ kho.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                    onClick={() => setIsMarkedListModalOpen(true)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    title="Xem danh sách và ghi chú các vị trí đánh dấu"
                >
                    <ListFilter size={14} />
                    <span>Danh sách & Ghi chú ({markedCount})</span>
                </button>

                <button
                    onClick={printMarked}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-900 dark:text-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    title="In sơ đồ các vị trí đánh dấu"
                >
                    <Printer size={14} className="text-amber-600 dark:text-amber-400" />
                    <span>In sơ đồ</span>
                </button>

                <button
                    onClick={onExportMarkedExcel}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    title="Xuất file Excel danh sách vị trí đánh dấu"
                >
                    <FileSpreadsheet size={14} />
                    <span>Xuất Excel</span>
                </button>

                <button
                    onClick={() => setOnlyShowMarked(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                    title="Hiển thị lại toàn bộ sơ đồ kho"
                >
                    <Eye size={14} />
                    <span>Hiện tất cả</span>
                </button>

                <button
                    onClick={clearAllMarks}
                    className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold transition-all"
                    title="Xóa toàn bộ các vị trí đã đánh dấu"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    )
}

interface MapFloatingControlsProps {
    isMapControlsOpen: boolean
    setIsMapControlsOpen: (open: boolean) => void
    zones: any[]
    filteredZones: any[]
    filteredPositions: any[]
    setCollapsedZones: React.Dispatch<React.SetStateAction<Set<string>>>
    isGrouped: boolean
    setIsGrouped: (grouped: boolean) => void
    mergedZones: Set<string>
    setMergedZones: React.Dispatch<React.SetStateAction<Set<string>>>
    loosePositions: Record<string, any>
    setAllLooseStatus: (isClosed: boolean) => void
}

export function MapFloatingControls({
    isMapControlsOpen,
    setIsMapControlsOpen,
    zones,
    filteredZones,
    filteredPositions,
    setCollapsedZones,
    isGrouped,
    setIsGrouped,
    mergedZones,
    setMergedZones,
    loosePositions,
    setAllLooseStatus,
}: MapFloatingControlsProps) {
    return (
        <div className="fixed bottom-6 right-6 z-60 shadow-2xl transition-all duration-300 hover:scale-[1.02] flex justify-end">
            {!isMapControlsOpen ? (
                <button
                    onClick={() => setIsMapControlsOpen(true)}
                    className="bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-100 rounded-full p-3 shadow-lg hover:scale-110 transition flex items-center justify-center border border-slate-600 dark:border-slate-500 hover:bg-slate-700 dark:hover:bg-slate-600 animate-in fade-in"
                    title="Mở công cụ bản đồ"
                >
                    <Layers size={22} className="text-emerald-400" />
                </button>
            ) : (
                <div className="flex bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full p-1 border border-slate-200 dark:border-slate-700 shadow-sm animate-in zoom-in-95 duration-200">
                    {/* Mở rộng Group */}
                    <div className="flex relative items-center mr-1 pr-2 border-r border-slate-300 dark:border-slate-600">
                        <span className="text-[10px] text-slate-500 font-bold px-3 uppercase tracking-wider">Mở</span>
                        <button
                            onClick={() => {
                                setCollapsedZones(new Set(zones.filter(z => z.parent_id).map(z => z.id)))
                            }}
                            className="px-3 py-2 rounded-full text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800"
                            title="Bung list Kho tải các Dãy (Ẩn Vị trí)"
                        >
                            <ChevronDown size={14} />
                            Cấp 1 (Dãy)
                        </button>
                        <button
                            onClick={() => {
                                setCollapsedZones(new Set())
                            }}
                            className="px-3 py-2 rounded-full text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition ml-1 flex items-center gap-1 font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            title="Mở bung toàn bộ mọi Vị trí"
                        >
                            <ChevronDown size={14} />
                            Cấp 2 (Vị trí)
                        </button>
                    </div>

                    {/* Gom ô Group */}
                    <div className="flex relative items-center ml-1 pl-2 border-l border-slate-300 dark:border-slate-600">
                        <button
                            onClick={() => setIsGrouped(!isGrouped)}
                            className={`px-3 py-2 rounded-full text-xs transition flex items-center gap-1 font-medium ${isGrouped ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} border border-transparent`}
                            title={isGrouped ? 'Tắt chế độ gom ô' : 'Bật chế độ gom ô'}
                        >
                            <Layers size={14} className={isGrouped ? 'text-white' : 'text-indigo-500'} />
                            {isGrouped ? 'Đang Gom ô' : 'Gom ô'}
                        </button>
                        {isGrouped && (
                            <button
                                onClick={() => {
                                    const { zones: displayZones } = groupWarehouseData(filteredZones, filteredPositions)
                                    const levelZoneIds = displayZones.filter((z: any) => z.id.startsWith('v-lvl-')).map((z: any) => z.id)
                                    const allMerged = levelZoneIds.every((id: string) => mergedZones.has(id))
                                    if (allMerged) {
                                        setMergedZones(new Set())
                                    } else {
                                        setMergedZones(prev => {
                                            const next = new Set(prev)
                                            levelZoneIds.forEach((id: string) => next.add(id))
                                            return next
                                        })
                                    }
                                }}
                                className={`px-3 py-2 rounded-full text-xs transition flex items-center gap-1 font-medium ml-1 ${
                                    mergedZones.size > 0
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                                }`}
                                title={mergedZones.size > 0 ? 'Tắt gộp ô toàn bộ' : 'Gộp ô toàn bộ (hàng cồng kềnh)'}
                            >
                                <Maximize2 size={14} />
                                {mergedZones.size > 0 ? 'Đang gộp hết' : 'Gộp ô hết'}
                            </button>
                        )}
                    </div>

                    {/* Quản lý Ô Hàng Lẻ (Đầu tháng chốt sổ / Trong tháng vận hành) */}
                    {Object.keys(loosePositions).length > 0 && (
                        <div className="flex relative items-center ml-1 pl-2 border-l border-slate-300 dark:border-slate-600">
                            <button
                                onClick={() => {
                                    const total = Object.keys(loosePositions).length
                                    const closedCount = Object.values(loosePositions).filter(c => c.isClosed).length
                                    const allClosed = closedCount === total
                                    if (allClosed) {
                                        if (confirm(`Đầu tháng chốt sổ:\nBạn có muốn MỞ toàn bộ ${total} ô hàng lẻ để tính vào báo cáo tồn kho?`)) {
                                            setAllLooseStatus(false)
                                        }
                                    } else {
                                        if (confirm(`Trong tháng vận hành:\nBạn có muốn ĐÓNG toàn bộ ${total} ô hàng lẻ (tạm ẩn khỏi báo cáo tồn kho)?`)) {
                                            setAllLooseStatus(true)
                                        }
                                    }
                                }}
                                className={`px-3 py-2 rounded-full text-xs transition flex items-center gap-1.5 font-bold cursor-pointer shadow-xs ${
                                    Object.values(loosePositions).some(c => !c.isClosed)
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-400 hover:bg-amber-500/30'
                                }`}
                                title="Đầu tháng: Bấm để Mở toàn bộ ô lẻ tính tồn kho chốt sổ. Trong tháng: Bấm để Đóng toàn bộ ô lẻ."
                            >
                                <PackageOpen size={14} />
                                <span>
                                    {Object.values(loosePositions).some(c => !c.isClosed)
                                        ? `Ô Lẻ: Đang MỞ (${Object.values(loosePositions).filter(c => !c.isClosed).length}/${Object.keys(loosePositions).length})`
                                        : `Ô Lẻ: Đang ĐÓNG (${Object.keys(loosePositions).length})`}
                                </span>
                            </button>
                        </div>
                    )}

                    {/* Thu gọn Group */}
                    <div className="flex relative items-center">
                        <span className="text-[10px] text-slate-500 font-bold px-3 uppercase tracking-wider">Thu</span>
                        <button
                            onClick={() => {
                                setCollapsedZones(new Set(zones.filter(z => z.parent_id).map(z => z.id)))
                            }}
                            className="px-3 py-2 text-slate-600 dark:text-slate-300 rounded-full text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 font-medium"
                            title="Thu gọn Vị trí (Chỉ xem Vỏ Sảnh/Dãy)"
                        >
                            <ChevronUp size={14} className="text-slate-400" />
                            Vị trí
                        </button>
                        <button
                            onClick={() => {
                                const allZoneIds = zones.map(z => z.id)
                                setCollapsedZones(new Set(allZoneIds))
                            }}
                            className="px-3 py-2 text-slate-600 dark:text-slate-300 rounded-full text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition ml-1 flex items-center gap-1 font-medium"
                            title="Thu gọn Tất cả (Chỉ nhìn thấy Kho)"
                        >
                            <ChevronUp size={14} className="text-slate-400" />
                            Kho
                        </button>

                        {/* Nút Đóng Mini Menu */}
                        <button
                            onClick={() => setIsMapControlsOpen(false)}
                            className="p-1.5 mx-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700"
                            title="Đóng công cụ"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
