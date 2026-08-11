'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, MapPin, X, ArrowUpDown, Layers, Tag, FileText, Sparkles, Combine, QrCode, ChevronDown, Trash2, Lock, Unlock } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LotDetailsModal } from '@/components/warehouse/lots/LotDetailsModal'
import { LotTagModal } from '@/components/lots/LotTagModal'
import { LotMergeModal } from '@/components/warehouse/lots/LotMergeModal'
import { LotSplitModal } from '@/components/warehouse/lots/LotSplitModal'
import { LotExportModal } from '@/components/warehouse/lots/LotExportModal'
import { LotExportBuffer } from '@/components/warehouse/lots/LotExportBuffer'
import { LotBulkCloneModal } from '@/components/warehouse/lots/LotBulkCloneModal'
import { LotAssignPositionModal } from '@/components/warehouse/lots/LotAssignPositionModal'
import { LotBulkAssignModal } from '@/components/warehouse/lots/LotBulkAssignModal'
import { LotBulkAssignTagModal } from '@/components/warehouse/lots/LotBulkAssignTagModal'
import { LotReportModal } from '@/components/warehouse/lots/LotReportModal'
import { LotBulkChangeProductModal } from '@/components/warehouse/lots/LotBulkChangeProductModal'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import Protected from '@/components/auth/Protected'
import { useUser } from '@/contexts/UserContext'

// Modular Components
import { useLotManagement, Lot } from '../_hooks/useLotManagement'
import { LotFilter } from './LotFilter'
import { LotForm } from './LotForm'
import { LotList } from './LotList'
import { QrCodeModal } from './QrCodeModal'
import { OddLotSuggestions } from './OddLotSuggestions'

export function LotPageManager() {
    const { hasPermission } = useUser()
    // Logic & Data Hook
    const {
        lots,
        loading,
        searchTerm,
        setSearchTerm,
        searchMode,
        setSearchMode,
        positionFilter,
        setPositionFilter,
        lockFilter,
        setLockFilter,
        dateFilterField,
        setDateFilterField,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        selectedZoneId,
        setSelectedZoneId,
        fetchLots,
        fetchUnassignedLotsForBulkAssign,
        fetchUntaggedLotsForBulkAssign,
        handleDeleteLot,
        handleBulkDeleteLots,
        handleToggleLock,
        handleBulkToggleLock,
        handleToggleStar,
        isModuleEnabled,
        isUtilityEnabled,
        products,
        suppliers,
        qcList,
        units,
        productUnits,
        branches,
        fetchCommonData,
        existingTags,
        // Pagination
        page,
        setPage,
        pageSize,
        totalLots,
        unassignedTotal,
        // FIFO
        isFifoAvailable,
        isFifoActive,
        toggleFifo,
        productions,
        zones
    } = useLotManagement()

    const { currentSystem } = useSystem()
    const pathname = usePathname()
    const isSanxuat = pathname?.startsWith('/sanxuat') || false

    // UI States
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [showBulkAssign, setShowBulkAssign] = useState(false)
    const [showBulkAssignTag, setShowBulkAssignTag] = useState(false)
    const [showBulkChangeProduct, setShowBulkChangeProduct] = useState(false)
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const [editingLot, setEditingLot] = useState<Lot | null>(null)
    const [qrLot, setQrLot] = useState<Lot | null>(null)
    const [viewingLot, setViewingLot] = useState<Lot | null>(null)
    const [taggingLot, setTaggingLot] = useState<Lot | null>(null)
    const [mergingLot, setMergingLot] = useState<Lot | null>(null)
    const [mergeSourceLotIds, setMergeSourceLotIds] = useState<string[]>([])
    const [mergeSourceLots, setMergeSourceLots] = useState<Lot[]>([])
    const [splittingLot, setSplittingLot] = useState<Lot | null>(null)
    const [exportingLot, setExportingLot] = useState<Lot | null>(null)
    const [bulkCloningLot, setBulkCloningLot] = useState<Lot | null>(null)
    const [assigningLot, setAssigningLot] = useState<Lot | null>(null)
    const [showReportModal, setShowReportModal] = useState(false)
    const [showOddLotSuggestions, setShowOddLotSuggestions] = useState(false)
    const [showUtilityMenu, setShowUtilityMenu] = useState(false)
    const [showBulkMenu, setShowBulkMenu] = useState(false)
    const utilityMenuRef = useRef<HTMLDivElement>(null)
    const bulkMenuRef = useRef<HTMLDivElement>(null)

    // Selection States
    const [selectedLotIds, setSelectedLotIds] = useState<Set<string>>(new Set())
    const [bulkTagLotIds, setBulkTagLotIds] = useState<string[] | null>(null)

    // Selection Handlers
    const handleToggleSelect = (id: string) => {
        setSelectedLotIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const handleSelectAll = () => {
        setSelectedLotIds(new Set(lots.map(l => l.id)))
    }

    const handleClearSelection = () => {
        setSelectedLotIds(new Set())
    }

    const handleBulkDeleteSelected = async () => {
        const ids = Array.from(selectedLotIds)
        if (ids.length === 0) return
        const success = await handleBulkDeleteLots(ids)
        if (success) {
            setSelectedLotIds(new Set())
        }
    }

    const handleBulkLockSelected = async (lock: boolean) => {
        const ids = Array.from(selectedLotIds)
        if (ids.length === 0) return
        const success = await handleBulkToggleLock(ids, lock)
        if (success) {
            setSelectedLotIds(new Set())
        }
    }

    const handleBulkTagSelected = () => {
        const ids = Array.from(selectedLotIds)
        if (ids.length === 0) return
        setBulkTagLotIds(ids)
    }

    // Handle click outside for dropdown menus
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (utilityMenuRef.current && !utilityMenuRef.current.contains(event.target as Node)) {
                setShowUtilityMenu(false)
            }
            if (bulkMenuRef.current && !bulkMenuRef.current.contains(event.target as Node)) {
                setShowBulkMenu(false)
            }
        }
        if (showUtilityMenu || showBulkMenu) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showUtilityMenu, showBulkMenu])

    useEffect(() => {
        if (currentSystem?.code) {
            // fetchLots() - Hook handles this now via effects
        }
    }, [currentSystem])

    const toggleCreateForm = () => {
        if (!showCreateForm) {
            setEditingLot(null)
        }
        setShowCreateForm(!showCreateForm)
    }

    const handleEdit = (lot: Lot) => {
        setEditingLot(lot)
        setShowCreateForm(true)
    }

    const handleSuccess = async () => {
        await fetchLots()
        setShowCreateForm(false)
        setEditingLot(null)
    }

    const handleDelete = async (id: string) => {
        const success = await handleDeleteLot(id)
        if (success !== false) {
            setViewingLot(null)
            setShowCreateForm(false)
            setEditingLot(null)
        }
    }

    // Handlers for new actions
    const handleMerge = (lot: Lot) => {
        setMergingLot(lot)
    }

    const handleMergeFromSuggestions = (target: Lot, sourceIds: string[], sourceLots: Lot[]) => {
        setMergingLot(target)
        setMergeSourceLotIds(sourceIds)
        setMergeSourceLots(sourceLots)
    }

    const handleSplit = (lot: Lot) => {
        setSplittingLot(lot)
    }

    const handleExport = (lot: Lot) => {
        setExportingLot(lot)
    }

    const handleBulkClone = (lot: Lot) => {
        setBulkCloningLot(lot)
    }

    const totalPages = Math.ceil(totalLots / pageSize)

    return (
        <section className="space-y-6 pb-12">
            {/* Header Section */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                        Quản lý LOT
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                        Quản lý, theo dõi và xử lý các lô hàng trong kho.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Menu Tiện ích (Dropdown) */}
                    <div className="relative" ref={utilityMenuRef}>
                        <button
                            type="button"
                            onClick={() => {
                                setShowUtilityMenu(!showUtilityMenu)
                                setShowBulkMenu(false)
                            }}
                            className={`px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
                                showUtilityMenu
                                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 shadow-md'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <Sparkles size={16} className={showUtilityMenu ? 'text-amber-300 dark:text-amber-600' : 'text-amber-500'} />
                            <span>Tiện ích</span>
                            {showOddLotSuggestions && (
                                <span className="w-2 h-2 rounded-full bg-indigo-500" title="Gợi ý lot lẻ đang bật" />
                            )}
                            <ChevronDown size={14} className={`transition-transform duration-200 ${showUtilityMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {showUtilityMenu && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowOddLotSuggestions(!showOddLotSuggestions)
                                        setShowUtilityMenu(false)
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-2 text-xs sm:text-sm rounded-xl transition-colors text-left cursor-pointer ${
                                        showOddLotSuggestions
                                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 shrink-0">
                                            <Combine size={15} />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-900 dark:text-slate-100">Gợi ý Lot lẻ</div>
                                            <div className="text-[11px] text-slate-400">Xem gợi ý ghép các lot lẻ</div>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                        showOddLotSuggestions
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                    }`}>
                                        {showOddLotSuggestions ? 'BẬT' : 'TẮT'}
                                    </span>
                                </button>

                                <Link
                                    href="/warehouses/lots/scan"
                                    onClick={() => setShowUtilityMenu(false)}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left group"
                                >
                                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 group-hover:bg-emerald-100 transition-colors shrink-0">
                                        <QrCode size={15} />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-slate-900 dark:text-slate-100">Liên kết Tem</div>
                                        <div className="text-[11px] text-slate-400">Quét mã QR liên kết tem thùng</div>
                                    </div>
                                </Link>

                                <Link
                                    href="/warehouses/lots/export"
                                    onClick={() => setShowUtilityMenu(false)}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left group"
                                >
                                    <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 group-hover:bg-blue-100 transition-colors shrink-0">
                                        <ArrowUpDown size={15} />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-slate-900 dark:text-slate-100">Xuất kho LOT</div>
                                        <div className="text-[11px] text-slate-400">Màn hình xuất kho nhanh</div>
                                    </div>
                                </Link>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowUtilityMenu(false)
                                        setShowReportModal(true)
                                    }}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left group cursor-pointer"
                                >
                                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 group-hover:bg-emerald-100 transition-colors shrink-0">
                                        <FileText size={15} />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-slate-900 dark:text-slate-100">Báo cáo LOT</div>
                                        <div className="text-[11px] text-slate-400">Xem và xuất báo cáo tồn kho LOT</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Menu Thao tác hàng loạt (Dropdown) */}
                    {(hasPermission('warehouse_lot.manage') || hasPermission('warehouse_lot.create')) && (
                        <div className="relative" ref={bulkMenuRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowBulkMenu(!showBulkMenu)
                                    setShowUtilityMenu(false)
                                }}
                                className={`px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
                                    showBulkMenu
                                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 shadow-md'
                                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <Layers size={16} className={showBulkMenu ? 'text-white dark:text-slate-900' : 'text-teal-600'} />
                                <span>Thao tác hàng loạt</span>
                                <ChevronDown size={14} className={`transition-transform duration-200 ${showBulkMenu ? 'rotate-180' : ''}`} />
                            </button>

                            {showBulkMenu && (
                                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                                    {hasPermission('warehouse_lot.manage') && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowBulkMenu(false)
                                                setShowBulkChangeProduct(true)
                                            }}
                                            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 hover:bg-teal-50/60 dark:hover:bg-slate-800 rounded-xl transition-colors text-left group cursor-pointer"
                                        >
                                            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 group-hover:bg-teal-100 transition-colors shrink-0">
                                                <Layers size={15} />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-900 dark:text-slate-100">Đổi mã hàng loạt</div>
                                                <div className="text-[11px] text-slate-400">Đổi mã sản phẩm cho nhiều LOT</div>
                                            </div>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowBulkMenu(false)
                                            setShowBulkAssign(true)
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 hover:bg-indigo-50/60 dark:hover:bg-slate-800 rounded-xl transition-colors text-left group cursor-pointer"
                                    >
                                        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 group-hover:bg-indigo-100 transition-colors shrink-0">
                                            <MapPin size={15} />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-900 dark:text-slate-100">Vị trí hàng loạt</div>
                                            <div className="text-[11px] text-slate-400">Gán vị trí kho cho các LOT</div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowBulkMenu(false)
                                            setShowBulkAssignTag(true)
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 hover:bg-amber-50/60 dark:hover:bg-slate-800 rounded-xl transition-colors text-left group cursor-pointer"
                                    >
                                        <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 group-hover:bg-amber-100 transition-colors shrink-0">
                                            <Tag size={15} />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-900 dark:text-slate-100">Mã phụ hàng loạt</div>
                                            <div className="text-[11px] text-slate-400">Gán tag & mã phụ hàng loạt</div>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Nút Tạo LOT mới */}
                    {(hasPermission('warehouse_lot.manage') || hasPermission('warehouse_lot.create')) && (
                        <button
                            type="button"
                            onClick={toggleCreateForm}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all transform active:scale-95 cursor-pointer ${
                                showCreateForm
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                            }`}
                        >
                            {showCreateForm ? <X size={16} /> : <Plus size={16} className="stroke-[2.5]" />}
                            <span>{showCreateForm ? 'Đóng form' : 'Tạo LOT mới'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Create/Edit Form */}
            <LotForm
                isVisible={showCreateForm}
                editingLot={editingLot}
                onClose={() => setShowCreateForm(false)}
                onSuccess={handleSuccess}
                onDelete={handleDelete}
                products={products}
                suppliers={suppliers}
                qcList={qcList}
                units={units}
                productUnits={productUnits}
                branches={branches}
                existingTags={existingTags}
                productions={productions}
                managePermission={hasPermission('warehouse_lot.manage') || hasPermission('warehouse_lot.create') ? 'warehouse_lot.manage' : undefined}
            />

            {/* Filter Bar */}
            <LotFilter
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                searchMode={searchMode}
                onSearchModeChange={setSearchMode}
                positionFilter={positionFilter}
                onPositionFilterChange={setPositionFilter}
                lockFilter={lockFilter}
                onLockFilterChange={setLockFilter}
                selectedZoneId={selectedZoneId}
                onZoneSelect={setSelectedZoneId}
                dateFilterField={dateFilterField}
                onDateFieldChange={setDateFilterField}
                startDate={startDate}
                onStartDateChange={setStartDate}
                endDate={endDate}
                onEndDateChange={setEndDate}
                showMobileFilters={showMobileFilters}
                toggleMobileFilters={() => setShowMobileFilters(!showMobileFilters)}
                zones={zones}
            />

            {/* Gợi ý ghép Lot lẻ */}
            {showOddLotSuggestions && (
                <OddLotSuggestions
                    lots={lots}
                    products={products}
                    zones={zones}
                    onMerge={handleMergeFromSuggestions}
                    isSanxuat={isSanxuat}
                />
            )}

            {/* FIFO Toggle + Main Grid */}
            <div className="space-y-4">
                {isFifoAvailable && (
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <button
                            role="switch"
                            aria-checked={isFifoActive}
                            onClick={toggleFifo}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${isFifoActive
                                ? 'bg-emerald-600'
                                : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${isFifoActive ? 'translate-x-[22px]' : 'translate-x-[2px]'
                                    }`}
                            />
                        </button>
                        <span className={`text-sm font-semibold ${isFifoActive
                            ? 'text-slate-800 dark:text-slate-200'
                            : 'text-slate-400 dark:text-slate-500'
                            }`}>
                            Ưu tiên FIFO
                        </span>
                    </label>
                )}
                <LotList
                    loading={loading}
                    lots={lots}
                    isModuleEnabled={isModuleEnabled}
                    isUtilityEnabled={isUtilityEnabled}
                    selectedLotIds={selectedLotIds}
                    onToggleSelect={handleToggleSelect}
                    onSelectAll={handleSelectAll}
                    onClearSelection={handleClearSelection}
                    managePermission="warehouse_lot.manage"
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onView={setViewingLot}
                    onToggleStar={handleToggleStar}
                    onToggleLock={handleToggleLock}
                    onQr={setQrLot}
                    onAssignTag={setTaggingLot}
                    onMerge={handleMerge}
                    onSplit={handleSplit}
                    onExport={handleExport}
                    onBulkClone={handleBulkClone}
                    onAssignLocation={setAssigningLot}
                    searchTerm={searchTerm}
                />

                {/* Pagination Controls */}
                {!loading && totalLots > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Hiển thị <span className="font-bold text-slate-700 dark:text-slate-200">{page * pageSize + 1}</span> - <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min((page + 1) * pageSize, totalLots)}</span> trong tổng số <span className="font-bold text-slate-700 dark:text-slate-200">{totalLots}</span> LOT
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(Math.max(0, page - 1))}
                                disabled={page === 0}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                            >
                                Trước
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    // Logic to show generic page window around current page could be complex.
                                    // Simple logic: Show first 5 or logic like [1] ... [current] ... [last]
                                    // For now, let's keep it simple: Show current page number
                                    return null
                                })}
                                <span className="text-sm font-medium px-2 text-slate-600 dark:text-slate-300">
                                    Trang {page + 1} / {totalPages}
                                </span>
                            </div>

                            <button
                                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                                disabled={page >= totalPages - 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showBulkAssign && (
                <LotBulkAssignModal
                    onClose={() => setShowBulkAssign(false)}
                    onSuccess={(close = true) => {
                        if (close) setShowBulkAssign(false);
                        fetchLots();
                    }}
                    fetchUnassignedLots={fetchUnassignedLotsForBulkAssign}
                    initialUnassignedCount={unassignedTotal}
                />
            )}

            {showBulkAssignTag && (
                <LotBulkAssignTagModal
                    onClose={() => setShowBulkAssignTag(false)}
                    onSuccess={fetchLots}
                    fetchUntaggedLots={fetchUntaggedLotsForBulkAssign}
                />
            )}

            {/* QR Code Modal */}
            {qrLot && (
                <QrCodeModal
                    lot={qrLot}
                    onClose={() => setQrLot(null)}
                />
            )}

            {/* Lot Details Modal */}
            <LotDetailsModal
                lot={lots.find(l => l.id === viewingLot?.id) || viewingLot}
                onClose={() => setViewingLot(null)}
                onOpenQr={(lot) => {
                    setQrLot(lot as any);
                    setViewingLot(null);
                }}
                onDelete={handleDelete}
                isModuleEnabled={isModuleEnabled}
                managePermission="warehouse_lot.manage"
            />

            {taggingLot && (
                <LotTagModal
                    lotIds={[taggingLot.id]}
                    lotCodeDisplay={taggingLot.code}
                    onClose={() => setTaggingLot(null)}
                    onSuccess={() => {
                        fetchLots();
                    }}
                />
            )}

            {mergingLot && (
                <LotMergeModal
                    targetLot={mergingLot}
                    lots={lots}
                    initialSourceLotIds={mergeSourceLotIds}
                    initialSourceLots={mergeSourceLots}
                    onClose={() => {
                        setMergingLot(null);
                        setMergeSourceLotIds([]);
                        setMergeSourceLots([]);
                    }}
                    onSuccess={() => {
                        setMergingLot(null);
                        setMergeSourceLotIds([]);
                        setMergeSourceLots([]);
                        fetchLots();
                    }}
                />
            )}

            {splittingLot && (
                <LotSplitModal
                    lot={splittingLot}
                    onClose={() => setSplittingLot(null)}
                    onSuccess={() => {
                        setSplittingLot(null);
                        fetchLots();
                    }}
                    units={units}
                    productUnits={productUnits}
                    isUtilityEnabled={isUtilityEnabled}
                />
            )}

            {exportingLot && (
                <LotExportModal
                    lot={exportingLot}
                    onClose={() => setExportingLot(null)}
                    onSuccess={() => {
                        setExportingLot(null);
                        fetchLots();
                    }}
                    units={units}
                    productUnits={productUnits}
                    isUtilityEnabled={isUtilityEnabled}
                />
            )}

            {bulkCloningLot && (
                <LotBulkCloneModal
                    lot={bulkCloningLot}
                    onClose={() => setBulkCloningLot(null)}
                    onSuccess={() => {
                        setBulkCloningLot(null);
                        fetchLots();
                    }}
                />
            )}

            {assigningLot && (
                <LotAssignPositionModal
                    lot={assigningLot}
                    onClose={() => setAssigningLot(null)}
                    onSuccess={() => {
                        setAssigningLot(null);
                        fetchLots();
                    }}
                />
            )}

            {showReportModal && (
                <LotReportModal
                    onClose={() => setShowReportModal(false)}
                />
            )}

            {showBulkChangeProduct && (
                <LotBulkChangeProductModal
                    onClose={() => setShowBulkChangeProduct(false)}
                    onSuccess={fetchLots}
                    products={products}
                />
            )}

            {/* Bulk Tag Modal for Multi-Selected LOTs */}
            {bulkTagLotIds && (
                <LotTagModal
                    lotIds={bulkTagLotIds}
                    lotCodeDisplay={`Đã chọn ${bulkTagLotIds.length} LOT`}
                    onClose={() => setBulkTagLotIds(null)}
                    onSuccess={() => {
                        setBulkTagLotIds(null)
                        setSelectedLotIds(new Set())
                        fetchLots()
                    }}
                />
            )}

            {/* Floating Multi-Select Action Bar */}
            {selectedLotIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-200">
                    <div className="bg-slate-900/95 dark:bg-slate-800/95 text-white rounded-2xl shadow-2xl border border-slate-700/80 px-4 py-2.5 flex items-center gap-3 backdrop-blur-md">
                        <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
                                Đã chọn {selectedLotIds.size} LOT
                            </span>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            {(hasPermission('warehouse_lot.manage') || hasPermission('warehouse_lot.create')) && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleBulkDeleteSelected}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
                                        title="Xóa tất cả LOT đã chọn"
                                    >
                                        <Trash2 size={15} />
                                        <span>Xóa ({selectedLotIds.size})</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleBulkTagSelected}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
                                        title="Gán mã phụ cho các LOT đã chọn"
                                    >
                                        <Tag size={15} />
                                        <span>Gán mã phụ</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleBulkLockSelected(true)}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-all active:scale-95 cursor-pointer"
                                        title="Khóa các LOT đã chọn"
                                    >
                                        <Lock size={14} />
                                        <span>Khóa</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleBulkLockSelected(false)}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-all active:scale-95 cursor-pointer"
                                        title="Mở khóa các LOT đã chọn"
                                    >
                                        <Unlock size={14} />
                                        <span>Mở khóa</span>
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="pl-2 border-l border-slate-700">
                            <button
                                type="button"
                                onClick={handleClearSelection}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                                title="Bỏ chọn tất cả"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </section>
    )
}
