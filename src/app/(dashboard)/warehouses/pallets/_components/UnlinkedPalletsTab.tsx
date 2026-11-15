'use client'

import React from 'react'
import {
    Search,
    Trash2,
    Loader2,
    Check,
    Tag,
    Link2,
    CheckCircle2,
    AlertTriangle,
    Zap,
    Eye,
    Sparkles,
    Clock,
    LayoutGrid,
    List,
} from 'lucide-react'
import type { UnlinkedPalletGroup } from './types'

interface UnlinkedPalletsTabProps {
    isLoading: boolean
    unlinkedGroups: UnlinkedPalletGroup[]
    filteredUnlinkedGroups: UnlinkedPalletGroup[]
    paginatedUnlinkedGroups: UnlinkedPalletGroup[]
    isAutoLinking: boolean
    isLinking: boolean
    unlinkedDateFilter: 'all' | 'today' | '3days' | '7days'
    setUnlinkedDateFilter: (f: 'all' | 'today' | '3days' | '7days') => void
    unlinkedPage: number
    setUnlinkedPage: React.Dispatch<React.SetStateAction<number>>
    unlinkedPageSize: number
    setUnlinkedPageSize: (size: number) => void
    totalUnlinkedPages: number
    searchQuery: string
    setSearchQuery: (q: string) => void
    unlinkedViewMode: 'grid' | 'table'
    setUnlinkedViewMode: (mode: 'grid' | 'table') => void
    handleAutoLinkAll: () => void
    handleUpdateConflictLot: (group: UnlinkedPalletGroup, targetLotId: string) => void
    handleOpenApproveModal: (group: UnlinkedPalletGroup) => void
    handleLinkGroupToLot: (group: UnlinkedPalletGroup, targetLotId: string) => void
    handleDeleteUnlinkedGroup: (group: UnlinkedPalletGroup) => void
    onPreviewGroup: (group: UnlinkedPalletGroup) => void
    onOpenManualLink: (group: UnlinkedPalletGroup) => void
}

export function UnlinkedPalletsTab({
    isLoading,
    unlinkedGroups,
    filteredUnlinkedGroups,
    paginatedUnlinkedGroups,
    isAutoLinking,
    isLinking,
    unlinkedDateFilter,
    setUnlinkedDateFilter,
    unlinkedPage,
    setUnlinkedPage,
    unlinkedPageSize,
    setUnlinkedPageSize,
    totalUnlinkedPages,
    searchQuery,
    setSearchQuery,
    unlinkedViewMode,
    setUnlinkedViewMode,
    handleAutoLinkAll,
    handleUpdateConflictLot,
    handleOpenApproveModal,
    handleLinkGroupToLot,
    handleDeleteUnlinkedGroup,
    onPreviewGroup,
    onOpenManualLink,
}: UnlinkedPalletsTabProps) {
    return (
        <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs overflow-hidden">
            {/* Toolbar tab Chưa kết nối */}
            <div className="px-3 py-1.5 border-b border-stone-100 dark:border-zinc-800 bg-amber-50/40 dark:bg-amber-950/20 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 text-xs font-black text-amber-800 dark:text-amber-300">
                        <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                        <span>Chờ kết nối ({filteredUnlinkedGroups.length})</span>
                    </span>

                    <button
                        onClick={handleAutoLinkAll}
                        disabled={isAutoLinking || unlinkedGroups.filter(g => !!g.matchedLot).length === 0}
                        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-40"
                        title="Tự động kết nối tất cả các nhóm đã khớp STT"
                    >
                        {isAutoLinking ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                        <span>Tự động kết nối ({unlinkedGroups.filter(g => !!g.matchedLot).length})</span>
                    </button>
                </div>

                {/* Date Filter & Search & Chuyển đổi Dạng Lưới / Dạng Danh Sách */}
                <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end">
                    <div className="flex items-center gap-0.5 bg-stone-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-[11px] shrink-0">
                        <button
                            type="button"
                            onClick={() => { setUnlinkedDateFilter('all'); setUnlinkedPage(1); }}
                            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                                unlinkedDateFilter === 'all'
                                    ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-zinc-100 shadow-2xs'
                                    : 'text-stone-500 hover:text-stone-800 dark:text-zinc-400'
                            }`}
                        >
                            Tất cả
                        </button>
                        <button
                            type="button"
                            onClick={() => { setUnlinkedDateFilter('today'); setUnlinkedPage(1); }}
                            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                                unlinkedDateFilter === 'today'
                                    ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-zinc-100 shadow-2xs'
                                    : 'text-stone-500 hover:text-stone-800 dark:text-zinc-400'
                            }`}
                        >
                            Hôm nay
                        </button>
                        <button
                            type="button"
                            onClick={() => { setUnlinkedDateFilter('3days'); setUnlinkedPage(1); }}
                            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                                unlinkedDateFilter === '3days'
                                    ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-zinc-100 shadow-2xs'
                                    : 'text-stone-500 hover:text-stone-800 dark:text-zinc-400'
                            }`}
                        >
                            3 ngày
                        </button>
                        <button
                            type="button"
                            onClick={() => { setUnlinkedDateFilter('7days'); setUnlinkedPage(1); }}
                            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                                unlinkedDateFilter === '7days'
                                    ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-zinc-100 shadow-2xs'
                                    : 'text-stone-500 hover:text-stone-800 dark:text-zinc-400'
                            }`}
                        >
                            7 ngày
                        </button>
                    </div>

                    <div className="relative flex-1 min-w-[130px] max-w-[190px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" size={13} />
                        <input
                            type="text"
                            placeholder="Tìm STT (G56...)..."
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setUnlinkedPage(1); }}
                            className="w-full pl-8 pr-2.5 py-1 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs text-stone-800 dark:text-zinc-200 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                    </div>

                    <div className="flex items-center gap-0.5 bg-white dark:bg-zinc-800 p-0.5 rounded-lg border border-stone-200 dark:border-zinc-700 shrink-0 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setUnlinkedViewMode('grid')}
                            className={`flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded transition-all cursor-pointer ${
                                unlinkedViewMode === 'grid'
                                    ? 'bg-amber-500 text-white shadow-2xs'
                                    : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-700'
                            }`}
                            title="Xem dạng thẻ (3 cột - hiển thị nhiều hàng)"
                        >
                            <LayoutGrid size={12} />
                            <span>Thẻ</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setUnlinkedViewMode('table')}
                            className={`flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded transition-all cursor-pointer ${
                                unlinkedViewMode === 'table'
                                    ? 'bg-amber-500 text-white shadow-2xs'
                                    : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-700'
                            }`}
                            title="Xem dạng danh sách hàng ngang (nhiều hàng nhất)"
                        >
                            <List size={12} />
                            <span>Bảng</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Danh sách Pallet chưa kết nối */}
            <div className="flex-1 overflow-y-auto p-2 md:p-2.5">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-stone-400">
                        <Loader2 className="animate-spin mb-2" size={24} />
                        <span className="text-xs">Đang tải danh sách chờ kết nối...</span>
                    </div>
                ) : filteredUnlinkedGroups.length === 0 ? (
                    <div className="text-center py-16 px-4">
                        <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={36} />
                        <p className="text-sm font-bold text-stone-800 dark:text-zinc-200">
                            Tuyệt vời! Không có Pallet nào đang chờ kết nối
                        </p>
                        <p className="text-xs text-stone-400 dark:text-zinc-500 mt-1 max-w-md mx-auto">
                            Mọi đợt quét từ điện thoại đều đã được ghép đúng vào các LOT hàng trên Web mẹ.
                        </p>
                    </div>
                ) : unlinkedViewMode === 'table' ? (
                    /* DẠNG BẢNG DANH SÁCH HÀNG NGANG */
                    <div className="border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-stone-50 dark:bg-zinc-800/70 border-b border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-zinc-300 text-[11px] uppercase font-bold">
                                <tr>
                                    <th className="py-2 px-3">STT</th>
                                    <th className="py-2 px-3">Số lượng & Khối lượng</th>
                                    <th className="py-2 px-3">Ghi chú / Thẻ</th>
                                    <th className="py-2 px-3">Trạng thái</th>
                                    <th className="py-2 px-3 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                {paginatedUnlinkedGroups.map((group) => {
                                    const hasMatch = !!group.matchedLot
                                    return (
                                        <tr key={group.pallet_stt} className="hover:bg-amber-50/30 dark:hover:bg-zinc-800/40 transition-colors">
                                            <td className="py-1.5 px-3 font-mono font-black text-stone-900 dark:text-zinc-100">
                                                <span className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs shadow-2xs">
                                                    {group.pallet_stt}
                                                </span>
                                            </td>
                                            <td className="py-1.5 px-3">
                                                <span className="font-bold text-stone-700 dark:text-zinc-300">{group.boxes.length} thùng</span>
                                                <span className="mx-1.5 text-stone-300 dark:text-zinc-600">·</span>
                                                <span className="font-black text-emerald-600 dark:text-emerald-400">{group.total_weight.toFixed(1)} Kg</span>
                                            </td>
                                            <td className="py-1.5 px-3">
                                                {group.pallet_tag && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-700 dark:text-orange-400 bg-orange-100/70 dark:bg-orange-950/40 px-1.5 py-0.2 rounded border border-orange-200 dark:border-orange-800 mr-1.5">
                                                        <Tag size={10} /> {group.pallet_tag}
                                                    </span>
                                                )}
                                                {group.pallet_notes ? (
                                                    <span className="text-[11px] text-stone-600 dark:text-zinc-400 font-medium">
                                                        📝 {group.pallet_notes}
                                                    </span>
                                                ) : (
                                                    <span className="text-stone-300 dark:text-zinc-600 text-[11px]">---</span>
                                                )}
                                            </td>
                                            <td className="py-1.5 px-3">
                                                {group.isConflict ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                                        <AlertTriangle size={11} /> Trùng STT: {group.matchedLot!.code}
                                                    </span>
                                                ) : hasMatch ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                                        <Check size={11} /> Khớp LOT: {group.matchedLot!.code}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                        <Clock size={11} /> Chờ duyệt LOT
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-1.5 px-3 text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    {group.isConflict ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleUpdateConflictLot(group, group.matchedLot!.id)}
                                                                disabled={isLinking}
                                                                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold transition-all cursor-pointer"
                                                            >
                                                                Gộp
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenApproveModal(group)}
                                                                className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold transition-all cursor-pointer"
                                                            >
                                                                Tách
                                                            </button>
                                                        </>
                                                    ) : hasMatch ? (
                                                        <button
                                                            onClick={() => handleLinkGroupToLot(group, group.matchedLot!.id)}
                                                            disabled={isLinking}
                                                            className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                                        >
                                                            <Check size={11} />
                                                            <span>Ghép {group.matchedLot!.code}</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleOpenApproveModal(group)}
                                                            className="px-2.5 py-0.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                                                        >
                                                            <Sparkles size={11} />
                                                            <span>⚡ Duyệt Tạo LOT</span>
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => onPreviewGroup(group)}
                                                        className="p-1 text-stone-500 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded cursor-pointer"
                                                        title="Xem chi tiết các thùng"
                                                    >
                                                        <Eye size={12} />
                                                    </button>

                                                    <button
                                                        onClick={() => onOpenManualLink(group)}
                                                        className="p-1 text-stone-500 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded cursor-pointer"
                                                        title="Ghép thủ công vào LOT khác"
                                                    >
                                                        <Link2 size={12} />
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteUnlinkedGroup(group)}
                                                        className="p-1 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                                                        title="Xóa đợt này"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* DẠNG THẺ SIÊU GỌN */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {paginatedUnlinkedGroups.map(group => {
                            const hasMatch = !!group.matchedLot
                            return (
                                <div
                                    key={group.pallet_stt}
                                    className={`p-2 rounded-xl border transition-all flex flex-col justify-between shadow-2xs hover:shadow-xs ${
                                        group.isConflict
                                            ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700'
                                            : hasMatch
                                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                                                : 'bg-white dark:bg-zinc-800/70 border-stone-200 dark:border-zinc-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-1 mb-1.5">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                            <span className="font-mono font-black text-xs text-stone-900 dark:text-zinc-100 bg-stone-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded border border-stone-200 dark:border-zinc-600 shadow-2xs shrink-0">
                                                STT: {group.pallet_stt}
                                            </span>
                                            <span className="text-[11px] font-bold text-stone-600 dark:text-zinc-300 shrink-0">
                                                {group.boxes.length} th
                                            </span>
                                            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                                                {group.total_weight.toFixed(1)} Kg
                                            </span>
                                            {group.pallet_tag && (
                                                <span className="text-[9px] font-bold text-orange-700 dark:text-orange-400 bg-orange-100/90 dark:bg-orange-950/60 px-1 py-0.2 rounded border border-orange-200 dark:border-orange-800 shrink-0">
                                                    {group.pallet_tag}
                                                </span>
                                            )}
                                            {group.pallet_notes && (
                                                <span className="text-[9px] font-bold text-blue-700 dark:text-blue-400 bg-blue-100/90 dark:bg-blue-950/60 px-1 py-0.2 rounded border border-blue-200 dark:border-blue-800 max-w-[80px] truncate shrink-0" title={group.pallet_notes}>
                                                    📝 {group.pallet_notes}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => onPreviewGroup(group)}
                                                className="p-1 text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
                                                title={`Xem chi tiết ${group.boxes.length} thùng`}
                                            >
                                                <Eye size={12} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onOpenManualLink(group)}
                                                className="p-1 text-stone-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
                                                title="Ghép thủ công vào LOT khác"
                                            >
                                                <Link2 size={12} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteUnlinkedGroup(group)}
                                                className="p-1 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-colors cursor-pointer"
                                                title="Xóa đợt quét này"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>

                                    {group.isConflict ? (
                                        <div className="flex items-center justify-between gap-1 p-1 bg-amber-500/10 dark:bg-amber-950/40 rounded border border-amber-500/30 text-[10px]">
                                            <span className="font-bold text-amber-800 dark:text-amber-300 truncate max-w-[120px]" title={`Trùng STT: ${group.matchedLot!.code}`}>
                                                ⚠️ Trùng: {group.matchedLot!.code}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleUpdateConflictLot(group, group.matchedLot!.id)}
                                                    disabled={isLinking}
                                                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold cursor-pointer"
                                                    title="Gộp / Cập nhật vào LOT"
                                                >
                                                    Gộp
                                                </button>
                                                <button
                                                    onClick={() => handleOpenApproveModal(group)}
                                                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold cursor-pointer"
                                                    title="Tách LOT mới riêng"
                                                >
                                                    Tách
                                                </button>
                                            </div>
                                        </div>
                                    ) : hasMatch ? (
                                        <button
                                            onClick={() => handleLinkGroupToLot(group, group.matchedLot!.id)}
                                            disabled={isLinking}
                                            className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-98"
                                        >
                                            <Check size={12} />
                                            <span className="truncate">Ghép vào LOT {group.matchedLot!.code}</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleOpenApproveModal(group)}
                                            className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg font-bold text-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-98"
                                        >
                                            <Sparkles size={12} />
                                            <span>⚡ Duyệt Tạo LOT Ngay</span>
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Thanh Phân Trang Cố Định */}
            {filteredUnlinkedGroups.length > 0 && (
                <div className="px-3 py-1.5 border-t border-stone-200 dark:border-zinc-800 bg-stone-50/90 dark:bg-zinc-900/90 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-stone-500 dark:text-zinc-400">
                        <span>
                            Hiển thị <strong>{(unlinkedPage - 1) * unlinkedPageSize + 1} - {Math.min(unlinkedPage * unlinkedPageSize, filteredUnlinkedGroups.length)}</strong> trong <strong>{filteredUnlinkedGroups.length}</strong> Pallet
                        </span>

                        <select
                            value={unlinkedPageSize}
                            onChange={e => {
                                setUnlinkedPageSize(Number(e.target.value))
                                setUnlinkedPage(1)
                            }}
                            className="px-1.5 py-0.5 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-stone-700 dark:text-zinc-300"
                        >
                            <option value={18}>18 Pallet / trang (6 hàng)</option>
                            <option value={30}>30 Pallet / trang (10 hàng)</option>
                            <option value={60}>60 Pallet / trang</option>
                            <option value={9999}>Xem tất cả</option>
                        </select>
                    </div>

                    {totalUnlinkedPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setUnlinkedPage(p => Math.max(1, p - 1))}
                                disabled={unlinkedPage <= 1}
                                className="px-2 py-0.5 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold text-stone-700 dark:text-zinc-300 hover:bg-stone-100 disabled:opacity-40 cursor-pointer transition-colors"
                            >
                                ← Trước
                            </button>

                            <div className="flex items-center gap-0.5">
                                {Array.from({ length: totalUnlinkedPages }, (_, i) => i + 1)
                                    .filter(page => page === 1 || page === totalUnlinkedPages || Math.abs(page - unlinkedPage) <= 1)
                                    .map((page, idx, arr) => {
                                        const prevPage = arr[idx - 1]
                                        return (
                                            <span key={page} className="flex items-center">
                                                {prevPage && page - prevPage > 1 && (
                                                    <span className="px-1 text-stone-400">...</span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setUnlinkedPage(page)}
                                                    className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs cursor-pointer transition-all ${
                                                        unlinkedPage === page
                                                            ? 'bg-amber-500 text-white shadow-2xs'
                                                            : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-200 dark:hover:bg-zinc-800'
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            </span>
                                        )
                                    })}
                            </div>

                            <button
                                type="button"
                                onClick={() => setUnlinkedPage(p => Math.min(totalUnlinkedPages, p + 1))}
                                disabled={unlinkedPage >= totalUnlinkedPages}
                                className="px-2 py-0.5 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold text-stone-700 dark:text-zinc-300 hover:bg-stone-100 disabled:opacity-40 cursor-pointer transition-colors"
                            >
                                Sau →
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
