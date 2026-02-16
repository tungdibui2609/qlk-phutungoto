'use client'

import { useState, useEffect } from 'react'
import { Plus, MapPin, X } from 'lucide-react'
import Link from 'next/link'
import { LotDetailsModal } from '@/components/warehouse/lots/LotDetailsModal'
import { LotTagModal } from '@/components/lots/LotTagModal'
import { LotMergeModal } from '@/components/warehouse/lots/LotMergeModal'
import { LotSplitModal } from '@/components/warehouse/lots/LotSplitModal'
import { LotExportModal } from '@/components/warehouse/lots/LotExportModal'
import { LotExportBuffer } from '@/components/warehouse/lots/LotExportBuffer'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import Protected from '@/components/auth/Protected'

// Modular Components
import { useLotManagement, Lot } from '../_hooks/useLotManagement'
import { LotFilter } from './LotFilter'
import { LotForm } from './LotForm'
import { LotList } from './LotList'
import { QrCodeModal } from './QrCodeModal'

export function LotPageManager() {
    // Logic & Data Hook
    const {
        lots,
        loading,
        searchTerm,
        setSearchTerm,
        positionFilter,
        setPositionFilter,
        dateFilterField,
        setDateFilterField,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        selectedZoneId,
        setSelectedZoneId,
        fetchLots,
        handleDeleteLot,
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
        // Pagination
        page,
        setPage,
        pageSize,
        totalLots
    } = useLotManagement()

    const { currentSystem } = useSystem()

    // UI States
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const [editingLot, setEditingLot] = useState<Lot | null>(null)
    const [qrLot, setQrLot] = useState<Lot | null>(null)
    const [viewingLot, setViewingLot] = useState<Lot | null>(null)
    const [taggingLot, setTaggingLot] = useState<Lot | null>(null)
    const [mergingLot, setMergingLot] = useState<Lot | null>(null)
    const [splittingLot, setSplittingLot] = useState<Lot | null>(null)
    const [exportingLot, setExportingLot] = useState<Lot | null>(null)

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

    // Handlers for new actions
    const handleMerge = (lot: Lot) => {
        setMergingLot(lot)
    }

    const handleSplit = (lot: Lot) => {
        setSplittingLot(lot)
    }

    const handleExport = (lot: Lot) => {
        setExportingLot(lot)
    }

    const totalPages = Math.ceil(totalLots / pageSize)

    return (
        <section className="space-y-6 pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                        Quản lý LOT
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Quản lý, theo dõi và xử lý các lô hàng trong kho.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        href="/warehouses/map"
                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm flex items-center gap-2"
                    >
                        <MapPin size={18} />
                        Sơ đồ vị trí
                    </Link>

                    <Protected permission="lot.manage">
                        <button
                            onClick={toggleCreateForm}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all transform active:scale-95 ${showCreateForm
                                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                                : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/20'
                                }`}
                        >
                            {showCreateForm ? <X size={18} /> : <Plus size={18} />}
                            {showCreateForm ? 'Đóng form' : 'Tạo LOT mới'}
                        </button>
                    </Protected>
                </div>
            </div>

            {/* Create/Edit Form */}
            <LotForm
                isVisible={showCreateForm}
                editingLot={editingLot}
                onClose={() => setShowCreateForm(false)}
                onSuccess={handleSuccess}
                products={products}
                suppliers={suppliers}
                qcList={qcList}
                units={units}
                productUnits={productUnits}
                branches={branches}
                isModuleEnabled={isModuleEnabled}
            />

            {/* Filter Bar */}
            <LotFilter
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                positionFilter={positionFilter}
                onPositionFilterChange={setPositionFilter}
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
            />

            {/* Main Grid */}
            <div className="space-y-4">
                <LotList
                    loading={loading}
                    lots={lots}
                    isModuleEnabled={isModuleEnabled}
                    isUtilityEnabled={isUtilityEnabled}
                    onEdit={handleEdit}
                    onDelete={handleDeleteLot}
                    onView={setViewingLot}
                    onToggleStar={handleToggleStar}
                    onQr={setQrLot}
                    onAssignTag={setTaggingLot}
                    onMerge={handleMerge}
                    onSplit={handleSplit}
                    onExport={handleExport}
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
                isModuleEnabled={isModuleEnabled}
            />

            {taggingLot && (
                <LotTagModal
                    lotId={taggingLot.id}
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
                    onClose={() => setMergingLot(null)}
                    onSuccess={() => {
                        setMergingLot(null);
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
        </section>
    )
}
