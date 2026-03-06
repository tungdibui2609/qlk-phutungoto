'use client'

import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { LotForm } from '@/app/(dashboard)/warehouses/lots/_components/LotForm'
import { useLotManagement, Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { QrCodeModal } from '@/app/(dashboard)/warehouses/lots/_components/QrCodeModal'
import { MobileWorkAreaPicker } from '@/components/mobile/MobileWorkAreaPicker'
import { useState, useEffect } from 'react'
import { RotateCcw, Plus, Package, Calendar, MapPin, Edit, Trash2, Eye, QrCode as QrIcon, MapPinned } from 'lucide-react'
import { LotDetailsModal } from '@/components/warehouse/lots/LotDetailsModal'
import { TagDisplay } from '@/components/lots/TagDisplay'

// Helper for formatting dates cleanly
const formatDate = (dateString?: string | null) => {
    if (!dateString) return '---'
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export default function MobileCreateLotTab({ onCloseTab }: { onCloseTab?: () => void }) {
    const { currentSystem } = useSystem()
    const { showToast, showConfirm } = useToast()

    const [view, setView] = useState<'list' | 'form'>('list')
    const [editingLot, setEditingLot] = useState<Lot | null>(null)
    const [viewingLot, setViewingLot] = useState<Lot | null>(null)
    const [qrLot, setQrLot] = useState<Lot | null>(null)
    const [selectedWorkArea, setSelectedWorkArea] = useState<{ id: string, name: string } | null>(null)
    const [showAreaPicker, setShowAreaPicker] = useState(false)

    // Load work area from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('MOBILE_SELECTED_WORK_AREA')
        if (saved) {
            try {
                setSelectedWorkArea(JSON.parse(saved))
            } catch (e) {
                console.error('Failed to parse saved work area', e)
            }
        }
    }, [])

    const handleSelectArea = (area: { id: string, name: string }) => {
        setSelectedWorkArea(area)
        localStorage.setItem('MOBILE_SELECTED_WORK_AREA', JSON.stringify(area))
        setShowAreaPicker(false)
        showToast(`Đã chọn khu vực: ${area.name}`, 'success')
    }

    // Pull all needed data and actions from the hook
    const {
        lots,
        loading,
        products,
        suppliers,
        qcList,
        units,
        productUnits,
        branches,
        existingTags,
        isModuleEnabled,
        fetchCommonData,
        fetchLots,
        handleDeleteLot
    } = useLotManagement()

    const [formKey, setFormKey] = useState(0)

    const handleSuccess = (lot?: any) => {
        showToast(editingLot ? `Cập nhật LOT ${lot?.code || ''} thành công` : `Tạo LOT ${lot?.code || ''} thành công`, 'success')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        setFormKey(prev => prev + 1)
        setView('list')
        setEditingLot(null)
        fetchLots(false)
    }

    const handleCloseForm = () => {
        setFormKey(prev => prev + 1)
        setView('list')
        setEditingLot(null)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleRefresh = () => {
        if (view === 'list') {
            fetchLots()
        } else {
            fetchCommonData()
        }
        showToast('Đã làm mới dữ liệu', 'success')
    }

    const handleAddNew = () => {
        setEditingLot(null)
        setView('form')
    }

    const handleEditLot = (lot: Lot) => {
        setEditingLot(lot)
        setView('form')
    }

    const onDeleteWrapper = async (id: string) => {
        await handleDeleteLot(id)
    }

    return (
        <div className="mobile-animate-fade-in pb-24">
            {(!selectedWorkArea || showAreaPicker) && (
                <MobileWorkAreaPicker
                    onSelect={handleSelectArea}
                    onClose={selectedWorkArea ? () => setShowAreaPicker(false) : undefined}
                />
            )}

            <div className="mobile-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div className="mobile-header-brand">Sarita Workspace</div>
                        <div className="mobile-header-title">Quản lý Lot</div>
                        <div className="mobile-header-subtitle">{currentSystem?.name || ''}</div>
                        {selectedWorkArea && (
                            <button
                                onClick={() => setShowAreaPicker(true)}
                                className="mt-2 flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400"
                            >
                                <MapPinned size={12} />
                                {selectedWorkArea.name}
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {view === 'list' && (
                            <button
                                onClick={handleAddNew}
                                disabled={!selectedWorkArea}
                                className="w-10 h-10 flex items-center justify-center bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-xl hover:bg-orange-200 dark:hover:bg-orange-500/30 transition-colors disabled:opacity-50"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                        <button className="mobile-btn mobile-btn--ghost" onClick={handleRefresh}>
                            <RotateCcw size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-2 sm:p-4">
                {view === 'list' && (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="py-12 flex justify-center">
                                <div className="w-8 h-8 rounded-full border-4 border-orange-500/30 border-t-orange-500 animate-spin"></div>
                            </div>
                        ) : lots.length === 0 ? (
                            <div className="py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                                <Package className="w-12 h-12 mb-3 text-zinc-300 dark:text-zinc-700" />
                                <p className="font-medium">Chưa có Lot nào</p>
                                <p className="text-sm mt-1">Bấm nút + góc trên để tạo mới</p>
                            </div>
                        ) : (
                            lots.map(lot => (
                                <div key={lot.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                                    {/* Left accented border */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-400 to-rose-500"></div>

                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-zinc-900 dark:text-white text-base leading-none mb-1.5">{lot.code}</h3>
                                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                                                <Calendar size={12} />
                                                {formatDate(lot.created_at)}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setViewingLot(lot)}
                                                className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-emerald-600 bg-zinc-50 hover:bg-emerald-50 dark:bg-zinc-800/50 dark:hover:bg-emerald-500/20 rounded-lg transition-colors"
                                            >
                                                <Eye size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleEditLot(lot)}
                                                className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-orange-600 bg-zinc-50 hover:bg-orange-50 dark:bg-zinc-800/50 dark:hover:bg-orange-500/20 rounded-lg transition-colors"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => onDeleteWrapper(lot.id)}
                                                className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-red-600 bg-zinc-50 hover:bg-red-50 dark:bg-zinc-800/50 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mt-4">
                                        {lot.lot_items?.map((item: any, idx) => (
                                            <div key={idx} className="flex flex-col gap-1 py-3 px-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <span className="font-medium text-zinc-700 dark:text-zinc-300 text-sm truncate pr-2">
                                                            {item.products?.name || 'Sản phẩm không xác định'}
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setQrLot({
                                                                    ...lot,
                                                                    lot_items: [item]
                                                                } as any);
                                                            }}
                                                            className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
                                                            title="In mã QR sản phẩm"
                                                        >
                                                            <QrIcon size={14} />
                                                        </button>
                                                    </div>
                                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap ml-2">
                                                        {item.quantity} <span className="text-xs font-normal text-zinc-500">{item.unit || item.products?.unit}</span>
                                                    </span>
                                                </div>

                                                {/* Display SKU and tags aligned left */}
                                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                                    <span className="text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                                        {item.products?.internal_code || item.products?.sku || 'SKU'}
                                                    </span>

                                                    {lot.lot_tags && lot.lot_tags.some((t: any) => t.lot_item_id === item.id) && (
                                                        <TagDisplay
                                                            tags={lot.lot_tags
                                                                .filter((t: any) => t.lot_item_id === item.id)
                                                                .map((t: any) => t.tag)
                                                            }
                                                            placeholderMap={{ '@': item.products?.internal_code || item.products?.sku || '' }}
                                                            className="justify-start"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {lot.warehouse_name && (
                                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                                                <MapPin size={12} className="text-zinc-400" />
                                                <span>Kho: <span className="font-medium text-zinc-700 dark:text-zinc-300">{lot.warehouse_name}</span></span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {view === 'form' && (
                    <LotForm
                        key={`form-${editingLot ? editingLot.id : 'new'}-${formKey}`}
                        isVisible={true}
                        editingLot={editingLot}
                        onClose={handleCloseForm}
                        onSuccess={handleSuccess}
                        products={products}
                        suppliers={suppliers}
                        qcList={qcList}
                        units={units}
                        productUnits={productUnits}
                        branches={branches}
                        existingTags={existingTags}
                        isModuleEnabled={isModuleEnabled}
                    />
                )}
            </div>

            {/* View Modal */}
            {viewingLot && (
                <LotDetailsModal
                    lot={viewingLot}
                    onClose={() => setViewingLot(null)}
                    onOpenQr={(lot) => {
                        setQrLot(lot as any);
                        setViewingLot(null);
                    }}
                    isModuleEnabled={isModuleEnabled}
                />
            )}

            {/* QR Modal */}
            {qrLot && (
                <QrCodeModal
                    lot={qrLot}
                    workArea={selectedWorkArea}
                    onClose={() => setQrLot(null)}
                />
            )}
        </div>
    )
}
