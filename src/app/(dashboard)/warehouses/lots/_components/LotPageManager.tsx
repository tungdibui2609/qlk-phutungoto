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
        fetchCommonData
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
            fetchLots()
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
                showMobileFilters={showMobileFilters}
                toggleMobileFilters={() => setShowMobileFilters(!showMobileFilters)}
            />

            {/* Main Grid */}
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

            {/* QR Code Modal */}
            {qrLot && (
                <QrCodeModal
                    lot={qrLot}
                    onClose={() => setQrLot(null)}
                />
            )}

            {/* Lot Details Modal */}
            <LotDetailsModal
                lot={viewingLot}
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
                />
            )}
        </section>
    )
}
