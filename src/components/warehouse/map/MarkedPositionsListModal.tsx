'use client'

import React, { useState, useMemo } from 'react'
import {
    Bookmark, Search, Edit2, Trash2, FileSpreadsheet, Printer, X, Check,
    ArrowRight, ChevronDown, ChevronRight, Layers, LayoutGrid, Building2,
    ListFilter, Sparkles, Tag, CheckSquare
} from 'lucide-react'
import {
    parseDetailedPositionInfo,
    comparePositionsByBinAndLevel,
    DetailedPositionInfo
} from '@/lib/warehouseUtils'

export type GroupMode = 'bin_tier' | 'bin' | 'tier' | 'flat'

const QUICK_TAGS = [
    'Cập nhật LOT, ngày tháng',
    'Cần kiểm đếm lại',
    'Hàng rách bao / biến dạng',
    'Hàng ướt / ẩm mốc',
    'Chờ xuất gấp',
    'Sai lệch số lượng',
    'Hàng hết hạn / cận date',
    'Cần dọn vị trí / xếp lại'
]

export interface MarkedPositionItem {
    id: string
    code: string
    zone_id?: string | null
    realIds?: string[]
    info: DetailedPositionInfo
    lot: any | null
    note: string
}

interface MarkedPositionsListModalProps {
    isOpen: boolean
    onClose: () => void
    positions: any[]
    lotInfo: Record<string, any>
    zones?: any[]
    markedPositionIds: Set<string>
    markedNotes: Record<string, string>
    onUpdateNote: (posIdOrIds: string | string[], note: string) => void
    onUnmark: (posIdOrIds: string | string[]) => void
    onClearAll: () => void
    onExportExcel: () => void
    onPrint: () => void
    onSelectPosition?: (posId: string) => void
}

export function MarkedPositionsListModal({
    isOpen,
    onClose,
    positions,
    lotInfo,
    zones = [],
    markedPositionIds,
    markedNotes,
    onUpdateNote,
    onUnmark,
    onClearAll,
    onExportExcel,
    onPrint,
    onSelectPosition
}: MarkedPositionsListModalProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [groupMode, setGroupMode] = useState<GroupMode>('bin_tier')
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
    const [editingPosId, setEditingPosId] = useState<string | null>(null)
    const [editNoteText, setEditNoteText] = useState('')

    // Modal sửa ghi chú cho cả nhóm
    const [groupNoteModal, setGroupNoteModal] = useState<{
        groupLabel: string
        posIds: string[]
        currentNote: string
    } | null>(null)
    const [groupNoteInput, setGroupNoteInput] = useState('')

    // Zone map for fast lookup
    const zoneMap = useMemo(() => {
        const map = new Map<string, any>()
        zones.forEach(z => map.set(z.id, z))
        return map
    }, [zones])

    // Find and parse all marked position items, sorted strictly by Dãy -> Ô -> Tầng -> Mặt -> Vị trí con
    const markedItems = useMemo(() => {
        const items: MarkedPositionItem[] = []

        positions.forEach(p => {
            const isMarked = markedPositionIds.has(p.id) || (p.realIds && Array.isArray(p.realIds) && p.realIds.some((id: string) => markedPositionIds.has(id)))
            if (!isMarked) return

            const lot = p.lot_id ? lotInfo[p.lot_id] : null
            let note = markedNotes[p.id] || ''
            if (!note && p.realIds && Array.isArray(p.realIds)) {
                note = p.realIds.map((id: string) => markedNotes[id]).filter(Boolean).join('; ')
            }

            const info = parseDetailedPositionInfo(p.code, p.zone_id, zoneMap)

            items.push({
                id: p.id,
                code: p.code,
                zone_id: p.zone_id,
                realIds: p.realIds,
                info,
                lot,
                note
            })
        })

        // Sắp xếp tự nhiên để các ô cùng tầng, cùng ô không bao giờ bị nhảy lung tung
        return items.sort((a, b) => comparePositionsByBinAndLevel(a, b, zoneMap))
    }, [positions, markedPositionIds, markedNotes, zoneMap, lotInfo])

    // Filter by search
    const filteredItems = useMemo(() => {
        if (!searchTerm.trim()) return markedItems
        const term = searchTerm.toLowerCase().trim()
        return markedItems.filter(item => {
            const matchCode = item.code?.toLowerCase().includes(term)
            const matchBin = item.info.bin?.toLowerCase().includes(term)
            const matchLevel = item.info.level?.toLowerCase().includes(term)
            const matchRow = item.info.row?.toLowerCase().includes(term)
            const matchSlot = item.info.slotLabel?.toLowerCase().includes(term)
            const matchNote = item.note?.toLowerCase().includes(term)
            const matchLot = item.lot?.code?.toLowerCase().includes(term)
            const matchProd = item.lot?.product_name?.toLowerCase().includes(term) || (item.lot?.items && item.lot.items.some((it: any) => it.product_name?.toLowerCase().includes(term) || it.sku?.toLowerCase().includes(term)))
            return matchCode || matchBin || matchLevel || matchRow || matchSlot || matchNote || matchLot || matchProd
        })
    }, [markedItems, searchTerm])

    // Group items based on groupMode
    const groupedData = useMemo(() => {
        if (groupMode === 'flat') {
            return [{
                key: 'flat_all',
                label: 'Toàn bộ danh sách (Đã sắp xếp theo Ô & Tầng)',
                subLabel: '',
                items: filteredItems,
                allIds: filteredItems.map(it => it.id)
            }]
        }

        const groupsMap = new Map<string, {
            key: string
            label: string
            subLabel: string
            items: MarkedPositionItem[]
            allIds: string[]
        }>()

        filteredItems.forEach(item => {
            let key = item.info.groupBinTierKey
            let label = item.info.groupBinTierLabel
            let subLabel = item.info.warehouse || ''

            if (groupMode === 'bin') {
                key = item.info.groupBinKey
                label = item.info.groupBinLabel
            } else if (groupMode === 'tier') {
                key = item.info.groupTierKey
                label = item.info.groupTierLabel
            }

            if (!groupsMap.has(key)) {
                groupsMap.set(key, {
                    key,
                    label,
                    subLabel,
                    items: [],
                    allIds: []
                })
            }

            const grp = groupsMap.get(key)!
            grp.items.push(item)
            grp.allIds.push(item.id)
            if (item.realIds && Array.isArray(item.realIds)) {
                grp.allIds.push(...item.realIds)
            }
        })

        return Array.from(groupsMap.values())
    }, [filteredItems, groupMode])

    if (!isOpen) return null

    const handleStartEdit = (posId: string, currentNote: string) => {
        setEditingPosId(posId)
        setEditNoteText(currentNote || '')
    }

    const handleSaveEdit = (posId: string) => {
        onUpdateNote(posId, editNoteText.trim())
        setEditingPosId(null)
    }

    const toggleGroupCollapse = (groupKey: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev)
            if (next.has(groupKey)) next.delete(groupKey)
            else next.add(groupKey)
            return next
        })
    }

    const collapseAllGroups = () => {
        setCollapsedGroups(new Set(groupedData.map(g => g.key)))
    }

    const expandAllGroups = () => {
        setCollapsedGroups(new Set())
    }

    const handleOpenGroupNoteModal = (group: { label: string, allIds: string[], items: MarkedPositionItem[] }) => {
        // Tìm ghi chú phổ biến nhất trong nhóm làm giá trị khởi tạo
        const notes = group.items.map(it => it.note).filter(Boolean)
        const initialNote = notes.length > 0 ? notes[0] : ''
        setGroupNoteModal({
            groupLabel: group.label,
            posIds: Array.from(new Set(group.allIds)),
            currentNote: initialNote
        })
        setGroupNoteInput(initialNote)
    }

    const handleSaveGroupNote = () => {
        if (!groupNoteModal) return
        onUpdateNote(groupNoteModal.posIds, groupNoteInput.trim())
        setGroupNoteModal(null)
    }

    const handleUnmarkGroup = (group: { label: string, allIds: string[] }) => {
        const uniqueIds = Array.from(new Set(group.allIds))
        if (confirm(`Bạn có chắc chắn muốn bỏ đánh dấu toàn bộ ${uniqueIds.length} vị trí thuộc "${group.label}"?`)) {
            onUnmark(uniqueIds)
        }
    }

    return (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-amber-50/70 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                            <Bookmark size={20} className="fill-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                                    Danh sách vị trí đánh dấu kiểm tra
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200">
                                    {markedItems.length} vị trí
                                </span>
                                {groupedData.length > 1 && groupMode !== 'flat' && (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                        {groupedData.length} nhóm
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Các ô được tự động gom nhóm theo Ô và Tầng liền kề, thuận tiện kiểm đếm và quản lý.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={onPrint}
                            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-900 dark:text-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer"
                            title="In sơ đồ các vị trí đánh dấu"
                        >
                            <Printer size={14} className="text-amber-600 dark:text-amber-400" />
                            <span>In</span>
                        </button>

                        <button
                            onClick={onExportExcel}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer"
                            title="Xuất Excel danh sách đánh dấu"
                        >
                            <FileSpreadsheet size={14} />
                            <span>Excel</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition ml-1 cursor-pointer"
                            title="Đóng (Esc)"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Filter, Mode Switcher & Search Bar */}
                <div className="p-3 sm:px-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/20 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Tìm theo mã vị trí, ô, tầng, LOT, lý do..."
                            className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Grouping mode segmented controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300/60 dark:border-slate-700/60 text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => setGroupMode('bin_tier')}
                                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                                    groupMode === 'bin_tier'
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="Nhóm theo từng Ô và Tầng (Mặc định)"
                            >
                                <Layers size={13} />
                                <span>Theo Ô & Tầng</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setGroupMode('bin')}
                                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                                    groupMode === 'bin'
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="Nhóm theo từng Ô"
                            >
                                <LayoutGrid size={13} />
                                <span>Theo Ô</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setGroupMode('tier')}
                                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                                    groupMode === 'tier'
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="Nhóm theo từng Tầng"
                            >
                                <Building2 size={13} />
                                <span>Theo Tầng</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setGroupMode('flat')}
                                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                                    groupMode === 'flat'
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="Danh sách phẳng liên tục"
                            >
                                <ListFilter size={13} />
                                <span>Phẳng</span>
                            </button>
                        </div>

                        {/* Expand / Collapse all when in grouped mode */}
                        {groupMode !== 'flat' && groupedData.length > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={expandAllGroups}
                                    className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                                    title="Mở rộng toàn bộ các nhóm"
                                >
                                    Mở tất cả
                                </button>
                                <button
                                    type="button"
                                    onClick={collapseAllGroups}
                                    className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                                    title="Thu gọn toàn bộ các nhóm"
                                >
                                    Thu gọn
                                </button>
                            </div>
                        )}

                        {markedItems.length > 0 && (
                            <button
                                onClick={onClearAll}
                                className="px-3 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ml-auto cursor-pointer"
                                title="Xóa toàn bộ đánh dấu"
                            >
                                <Trash2 size={13} />
                                <span className="hidden sm:inline">Xóa toàn bộ</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Body Table with Groups */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
                    {filteredItems.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                            <Bookmark size={36} className="mx-auto mb-2 opacity-30 text-amber-500" />
                            <p className="font-semibold text-sm">
                                {searchTerm ? 'Không tìm thấy vị trí đánh dấu phù hợp' : 'Chưa có vị trí nào được đánh dấu'}
                            </p>
                            <p className="text-xs mt-1">
                                {searchTerm
                                    ? 'Hãy thử tìm kiếm với từ khóa khác'
                                    : 'Click chuột phải vào ô hoặc chọn nhiều ô để đánh dấu vị trí kiểm tra.'}
                            </p>
                        </div>
                    ) : (
                        groupedData.map(group => {
                            const isCollapsed = collapsedGroups.has(group.key)
                            // Check if all items in this group have the same non-empty note
                            const distinctNotes = Array.from(new Set(group.items.map(it => it.note).filter(Boolean)))
                            const commonNote = distinctNotes.length === 1 ? distinctNotes[0] : null

                            return (
                                <div
                                    key={group.key}
                                    className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-slate-900"
                                >
                                    {/* Group Header Bar (Only shown in grouped modes) */}
                                    {groupMode !== 'flat' && (
                                        <div
                                            className="px-4 py-2.5 bg-amber-50/60 dark:bg-amber-950/20 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-amber-100/50 dark:hover:bg-amber-950/30 transition-colors"
                                            onClick={() => toggleGroupCollapse(group.key)}
                                        >
                                            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                                                <button
                                                    type="button"
                                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                                                >
                                                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                                </button>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
                                                        {group.label}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-200/90 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200">
                                                        {group.items.length} vị trí
                                                    </span>
                                                </div>

                                                {commonNote && (
                                                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/40 px-2 py-0.5 rounded-md truncate max-w-xs font-medium">
                                                        <Tag size={11} className="shrink-0" />
                                                        <span className="truncate">Lý do: {commonNote}</span>
                                                    </span>
                                                )}
                                            </div>

                                            {/* Group Action Buttons */}
                                            <div
                                                className="flex items-center gap-1.5 shrink-0"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenGroupNoteModal(group)}
                                                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs active:scale-95 cursor-pointer"
                                                    title="Cập nhật chung ghi chú cho toàn bộ vị trí trong nhóm này"
                                                >
                                                    <Edit2 size={12} className="text-amber-600 dark:text-amber-400" />
                                                    <span>Ghi chú nhóm</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleUnmarkGroup(group)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                                                    title="Bỏ đánh dấu toàn bộ vị trí trong nhóm này"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Table of Items */}
                                    {!isCollapsed && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                                                        <th className="px-3.5 py-2.5 w-[20%]">Mã vị trí</th>
                                                        <th className="px-3.5 py-2.5 w-[28%]">LOT / Sản phẩm</th>
                                                        <th className="px-3.5 py-2.5">Lý do đánh dấu</th>
                                                        <th className="px-3.5 py-2.5 w-[12%] text-center">Thao tác</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                                    {group.items.map(item => {
                                                        const isEditing = editingPosId === item.id

                                                        return (
                                                            <tr
                                                                key={item.id}
                                                                className="hover:bg-amber-50/30 dark:hover:bg-amber-950/15 transition-colors"
                                                            >
                                                                {/* Mã vị trí */}
                                                                <td className="px-3.5 py-2.5 font-bold text-amber-700 dark:text-amber-400">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Bookmark size={13} className="fill-amber-500 text-amber-600 shrink-0" />
                                                                        {onSelectPosition ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    onSelectPosition(item.id)
                                                                                    onClose()
                                                                                }}
                                                                                className="hover:underline flex items-center gap-0.5 cursor-pointer text-left"
                                                                                title="Xem vị trí này trên sơ đồ"
                                                                            >
                                                                                <span>{item.code}</span>
                                                                                <ArrowRight size={11} className="opacity-60" />
                                                                            </button>
                                                                        ) : (
                                                                            <span>{item.code}</span>
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                {/* LOT / Sản phẩm */}
                                                                <td className="px-3.5 py-2.5">
                                                                    {item.lot ? (
                                                                        <div>
                                                                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                                                {item.lot.code}
                                                                            </span>
                                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                                                                                {item.lot.product_name || (item.lot.items && item.lot.items[0]?.product_name) || ''}
                                                                            </p>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="italic text-slate-400">Trống</span>
                                                                    )}
                                                                </td>

                                                                {/* Ghi chú đánh dấu */}
                                                                <td className="px-3.5 py-2.5">
                                                                    {isEditing ? (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <input
                                                                                type="text"
                                                                                value={editNoteText}
                                                                                onChange={e => setEditNoteText(e.target.value)}
                                                                                onKeyDown={e => {
                                                                                    if (e.key === 'Enter') handleSaveEdit(item.id)
                                                                                    else if (e.key === 'Escape') setEditingPosId(null)
                                                                                }}
                                                                                autoFocus
                                                                                placeholder="Nhập lý do đánh dấu..."
                                                                                className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-amber-400 dark:border-amber-600 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-slate-100"
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleSaveEdit(item.id)}
                                                                                className="p-1 bg-amber-500 text-white rounded-md hover:bg-amber-600 shrink-0 cursor-pointer"
                                                                                title="Lưu ghi chú"
                                                                            >
                                                                                <Check size={14} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setEditingPosId(null)}
                                                                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md shrink-0 cursor-pointer"
                                                                                title="Hủy"
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div
                                                                            className="flex items-center justify-between group cursor-pointer"
                                                                            onClick={() => handleStartEdit(item.id, item.note)}
                                                                            title="Bấm để sửa ghi chú cho ô này"
                                                                        >
                                                                            <span className={item.note ? "text-slate-700 dark:text-slate-200 font-medium" : "italic text-slate-400"}>
                                                                                {item.note || 'Chưa có ghi chú (Bấm để thêm)'}
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-amber-600 transition shrink-0 ml-1 cursor-pointer"
                                                                                title="Sửa ghi chú"
                                                                            >
                                                                                <Edit2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </td>

                                                                {/* Thao tác */}
                                                                <td className="px-3.5 py-2.5 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleStartEdit(item.id, item.note)}
                                                                            className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-md transition cursor-pointer"
                                                                            title="Sửa ghi chú ô này"
                                                                        >
                                                                            <Edit2 size={13} />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => onUnmark(item.id)}
                                                                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md transition cursor-pointer"
                                                                            title="Bỏ đánh dấu ô này"
                                                                        >
                                                                            <Trash2 size={13} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-500 shrink-0">
                    <span>
                        Hiển thị <strong>{filteredItems.length}</strong> / {markedItems.length} vị trí được đánh dấu
                        {groupedData.length > 1 && groupMode !== 'flat' && ` (trong ${groupedData.length} nhóm)`}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>

            {/* Modal Sửa ghi chú chung cho nhóm */}
            {groupNoteModal && (
                <div
                    className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
                    onClick={() => setGroupNoteModal(null)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                                    <Tag size={18} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                        Ghi chú cho {groupNoteModal.groupLabel}
                                    </h4>
                                    <p className="text-[11px] text-slate-500">
                                        Áp dụng cho toàn bộ {groupNoteModal.posIds.length} vị trí trong nhóm
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setGroupNoteModal(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Quick tags */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Chọn nhanh lý do:
                            </label>
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                                {QUICK_TAGS.map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setGroupNoteInput(tag)}
                                        className={`px-2.5 py-1 text-xs rounded-lg border transition cursor-pointer ${
                                            groupNoteInput === tag
                                                ? 'bg-amber-500 text-white border-amber-500 font-bold'
                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400'
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom input */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Hoặc nhập nội dung:
                            </label>
                            <textarea
                                value={groupNoteInput}
                                onChange={e => setGroupNoteInput(e.target.value)}
                                rows={2}
                                autoFocus
                                placeholder="Nhập lý do đánh dấu nhóm này..."
                                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-slate-100"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setGroupNoteModal(null)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveGroupNote}
                                className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                            >
                                Lưu cho cả nhóm ({groupNoteModal.posIds.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
