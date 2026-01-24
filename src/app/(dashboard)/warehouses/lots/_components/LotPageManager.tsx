'use client'

import { useState } from 'react'
import { Plus, MapPin, X } from 'lucide-react'
import Link from 'next/link'
import { LotDetailsModal } from '@/components/warehouse/lots/LotDetailsModal'
import { LotTagModal } from '@/components/lots/LotTagModal'

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
        isModuleEnabled,
        products,
        suppliers,
        qcList,
        units,
        productUnits,
        branches
    } = useLotManagement()

    // UI States
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const [editingLot, setEditingLot] = useState<Lot | null>(null)
    const [qrLot, setQrLot] = useState<Lot | null>(null)
    const [viewingLot, setViewingLot] = useState<Lot | null>(null)
    const [taggingLot, setTaggingLot] = useState<Lot | null>(null)

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

                <div className="flex items-center gap-3">
                    <Link
                        href="/warehouses/map"
                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm flex items-center gap-2"
                    >
                        <MapPin size={18} />
                        Sơ đồ vị trí
                    </Link>
                    <button
                        onClick={toggleCreateForm}
                        className={`px-5 py-2.5 rounded-xl font-medium shadow-lg active:scale-95 transition-all flex items-center gap-2 ${showCreateForm
                            ? "bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 hover:border-rose-200 shadow-rose-500/10"
                            : "bg-orange-600 text-white hover:bg-orange-700 shadow-orange-500/20"
                            }`}
                    >
                        {showCreateForm ? (
                            <>
                                <X size={20} />
                                Đóng form
                            </>
                        ) : (
                            <>
                                <Plus size={20} />
                                Tạo LOT mới
                            </>
                        )}
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
                onEdit={handleEdit}
                onDelete={handleDeleteLot}
                onView={setViewingLot}
                onQr={setQrLot}
                onAssignTag={setTaggingLot}
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
        </section>
    )
}
