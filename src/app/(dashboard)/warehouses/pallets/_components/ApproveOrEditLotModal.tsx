'use client'

import React from 'react'
import type { PalletLot, UnlinkedPalletGroup, WarehouseProduct, ApproveLotProductLine } from './types'
import { RefreshCw, Layers, Trash2, X, Package, Loader2, Calendar, MapPin, Tag, CheckCircle2, AlertTriangle, Sparkles, Factory, Plus } from 'lucide-react'
import { getAvailableUnitsForProduct } from './palletHelpers'
import { Combobox } from '@/components/ui/Combobox'

export interface ProductComboboxOption {
    value: string
    label: string
    name: string
    sku: string
    unit: string
    aliases: string
    short_name: string
    rawAliases: string
    internal_name: string
    internal_code: string
}

interface ApproveOrEditLotModalProps {
    approveGroup: UnlinkedPalletGroup | null
    setApproveGroup: React.Dispatch<React.SetStateAction<UnlinkedPalletGroup | null>>
    editingLinkedPallet: PalletLot | null
    setEditingLinkedPallet: React.Dispatch<React.SetStateAction<PalletLot | null>>
    editLotSTT: string
    setEditLotSTT: React.Dispatch<React.SetStateAction<string>>
    proposedLotCode: string
    setProposedLotCode: React.Dispatch<React.SetStateAction<string>>
    customLotTag: string
    setCustomLotTag: React.Dispatch<React.SetStateAction<string>>
    approveProductLines: ApproveLotProductLine[]
    warehouseProducts: WarehouseProduct[]
    productOptions: ProductComboboxOption[]
    allUnits: any[]
    allProductUnits: any[]
    isStampModal: boolean
    isGeneratingCode: boolean
    isApproving: boolean
    isSavingLinkedLot: boolean
    customInboundDate: string
    setCustomInboundDate: React.Dispatch<React.SetStateAction<string>>
    customPackagingDates: string[]
    newPackagingDateInput: string
    setNewPackagingDateInput: React.Dispatch<React.SetStateAction<string>>
    customPeelingDates: string[]
    newPeelingDateInput: string
    setNewPeelingDateInput: React.Dispatch<React.SetStateAction<string>>
    customRawMaterialDates: string[]
    newRawMaterialDateInput: string
    setNewRawMaterialDateInput: React.Dispatch<React.SetStateAction<string>>
    customProductionPlace: string
    setCustomProductionPlace: React.Dispatch<React.SetStateAction<string>>
    customMaterialZone: string
    setCustomMaterialZone: React.Dispatch<React.SetStateAction<string>>
    customNotes: string
    setCustomNotes: React.Dispatch<React.SetStateAction<string>>
    handleRegenerateLotCode: () => Promise<void>
    handleAddProductLine: () => void
    handleRemoveProductLine: (lineId: string) => void
    handleUpdateProductLine: (lineId: string, updates: Partial<ApproveLotProductLine>) => void
    handleAddPackagingDate: () => void
    handleRemovePackagingDate: (dateToRemove: string) => void
    handleAddPeelingDate: () => void
    handleRemovePeelingDate: (dateToRemove: string) => void
    handleAddRawDate: () => void
    handleRemoveRawDate: (dateToRemove: string) => void
    handleSaveEditLinkedLot: () => Promise<void>
    handleConfirmCreateLot: () => Promise<void>
}

export function ApproveOrEditLotModal({
    approveGroup,
    setApproveGroup,
    editingLinkedPallet,
    setEditingLinkedPallet,
    editLotSTT,
    setEditLotSTT,
    proposedLotCode,
    setProposedLotCode,
    customLotTag,
    setCustomLotTag,
    approveProductLines,
    warehouseProducts,
    productOptions,
    allUnits,
    allProductUnits,
    isStampModal,
    isGeneratingCode,
    isApproving,
    isSavingLinkedLot,
    customInboundDate,
    setCustomInboundDate,
    customPackagingDates,
    newPackagingDateInput,
    setNewPackagingDateInput,
    customPeelingDates,
    newPeelingDateInput,
    setNewPeelingDateInput,
    customRawMaterialDates,
    newRawMaterialDateInput,
    setNewRawMaterialDateInput,
    customProductionPlace,
    setCustomProductionPlace,
    customMaterialZone,
    setCustomMaterialZone,
    customNotes,
    setCustomNotes,
    handleRegenerateLotCode,
    handleAddProductLine,
    handleRemoveProductLine,
    handleUpdateProductLine,
    handleAddPackagingDate,
    handleRemovePackagingDate,
    handleAddPeelingDate,
    handleRemovePeelingDate,
    handleAddRawDate,
    handleRemoveRawDate,
    handleSaveEditLinkedLot,
    handleConfirmCreateLot,
}: ApproveOrEditLotModalProps) {
    if (!approveGroup && !editingLinkedPallet) return null
    const modalSTT = editingLinkedPallet ? editLotSTT : (approveGroup?.pallet_stt || '')
    const modalBoxCount = editingLinkedPallet ? editingLinkedPallet.box_labels.length : (approveGroup?.boxes.length || 0)
    const modalTotalWeight = editingLinkedPallet 
        ? editingLinkedPallet.box_labels.reduce((s, b) => s + (Number(b.quantity) || 0), 0)
        : (approveGroup?.total_weight || 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-4xl p-5 sm:p-6 shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-stone-200/80 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0">
                            <Sparkles size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-zinc-100 tracking-tight">
                                    {editingLinkedPallet ? `Chỉnh Sửa Toàn Bộ LOT: ${editingLinkedPallet.code}` : 'Duyệt Tạo LOT Mới Từ Pallet'}
                                </h3>
                                <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                                    STT: {modalSTT}
                                </span>
                            </div>
                            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span>{editingLinkedPallet ? 'Cập nhật lại toàn bộ sản phẩm, ngày tháng, xuất xứ của LOT' : 'Kế thừa tự động từ app quét'}</span>
                                <span className="text-stone-300 dark:text-zinc-600">•</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{modalBoxCount} thùng</span>
                                <span className="text-stone-300 dark:text-zinc-600">•</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{modalTotalWeight.toFixed(1)} Kg</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setApproveGroup(null); setEditingLinkedPallet(null); }}
                        className="text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto py-3.5 space-y-3.5 pr-1">
                    {/* Cảnh báo nếu trùng STT với Lô đã có trong kho */}
                    {approveGroup?.isConflict && approveGroup.matchedLot && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
                            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-black text-amber-800 dark:text-amber-300">
                                    ⚠️ CẢNH BÁO: TRÙNG SỐ THỨ TỰ (STT {approveGroup.pallet_stt})
                                </p>
                                <p className="mt-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                                    Hệ thống phát hiện LOT <strong>&quot;{approveGroup.matchedLot.code}&quot;</strong> mang STT <strong>{approveGroup.pallet_stt}</strong> đã tồn tại trong kho ({approveGroup.matchedLot.existingBoxesCount || approveGroup.matchedLot.quantity || 0} thùng).
                                    <br />
                                    Nếu tiếp tục duyệt tại đây, hệ thống sẽ <strong>TÁCH RA THÀNH MỘT LOT MỚI RIÊNG BIỆT</strong>. Nếu bạn muốn GỘP hoặc THAY THẾ vào LOT cũ, vui lòng đóng hộp thoại này và chọn nút <strong>[Gộp]</strong> ngoài màn hình.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 1. Định danh LOT & STT & Mã Phụ (Tag) */}
                    <div className={`grid grid-cols-1 ${editingLinkedPallet ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3 p-3 bg-slate-50/80 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-700/60 shadow-2xs`}>
                        {editingLinkedPallet && (
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                                        <span>Số Thứ Tự (STT)</span>
                                        <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[10px] text-stone-400">VD: M22, C544...</span>
                                </div>
                                <input
                                    type="text"
                                    value={editLotSTT}
                                    onChange={e => setEditLotSTT(e.target.value.toUpperCase())}
                                    placeholder="VD: M22..."
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                />
                            </div>
                        )}

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                                    <span>Mã LOT Định Danh</span>
                                    <span className="text-rose-500">*</span>
                                </label>
                                <span className="text-[10px] text-stone-400">
                                    {editingLinkedPallet ? `Hiện tại: ${editingLinkedPallet.code}` : `Gắn STT: ${approveGroup?.pallet_stt}`}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="text"
                                    value={proposedLotCode}
                                    onChange={e => setProposedLotCode(e.target.value.toUpperCase())}
                                    placeholder="VD: DL-LOT-G22..."
                                    className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                />
                                {!editingLinkedPallet && (
                                    <button
                                        type="button"
                                        onClick={handleRegenerateLotCode}
                                        disabled={isGeneratingCode}
                                        title="Sinh lại mã ngẫu nhiên mới"
                                        className="p-2 bg-white dark:bg-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-700 border border-stone-200 dark:border-zinc-700 rounded-xl text-stone-600 dark:text-zinc-300 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                                    >
                                        <RefreshCw size={14} className={isGeneratingCode ? 'animate-spin text-indigo-600' : ''} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                                    <Tag size={13} className="text-amber-500" />
                                    <span>Mã Phụ (Tag):</span>
                                </label>
                                <span className="text-[10px] text-stone-400">Đồng bộ từ app quét</span>
                            </div>
                            <input
                                type="text"
                                value={customLotTag}
                                onChange={e => setCustomLotTag(e.target.value.toUpperCase())}
                                placeholder="VD: TAG-01, VUNG-TRONG-02..."
                                className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* 2. Danh Sách Sản Phẩm Của LOT (Hỗ trợ 1 hoặc nhiều sản phẩm trong cùng LOT) */}
                    <div className="p-3.5 bg-gradient-to-b from-indigo-50/50 to-indigo-50/20 dark:from-indigo-950/20 dark:to-transparent rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1 rounded-lg bg-indigo-600 text-white">
                                    <Package size={14} />
                                </div>
                                <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                                    Sản Phẩm Của LOT ({approveProductLines.length})
                                </span>
                                <span className="text-rose-500">*</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddProductLine}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs active:scale-95"
                            >
                                <Plus size={13} />
                                <span>Thêm sản phẩm</span>
                            </button>
                        </div>

                        {approveProductLines.length > 1 && (
                            <div className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs shadow-2xs">
                                <Sparkles size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div>
                                    <span className="font-bold">LOT hỗn hợp ({approveProductLines.length} sản phẩm):</span> {editingLinkedPallet ? `Gồm ${modalBoxCount} thùng với ${approveProductLines.length} dòng sản phẩm riêng biệt.` : `Tự động tách ${modalBoxCount} thùng thành ${approveProductLines.length} dòng sản phẩm riêng biệt.`}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2.5">
                            {approveProductLines.map((line, index) => {
                                const currentProd = warehouseProducts.find(p => p.id === line.product_id) || line.product
                                const lineWeightPerBox = line.quantity > 0 ? (line.weight / line.quantity) : 20
                                const availableUnits = getAvailableUnitsForProduct(currentProd, allProductUnits, allUnits, lineWeightPerBox)

                                return (
                                    <div
                                        key={line.id}
                                        className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-stone-200/90 dark:border-zinc-800 space-y-2.5 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
                                    >
                                        {/* Top row of card */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100 dark:border-zinc-800">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white shadow-2xs">
                                                    {index === 0 ? 'Sản phẩm #1 (Chính)' : `Sản phẩm #${index + 1}`}
                                                </span>
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 border border-stone-200/70 dark:border-zinc-700">
                                                    {line.quantity} thùng ({line.weight.toFixed(1)} Kg)
                                                </span>
                                                {line.stamp_code && (
                                                    <span className="text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                                        <span>Dấu:</span>
                                                        <strong>{line.stamp_code}</strong>
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {line.matchReason && (
                                                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 truncate max-w-xs md:max-w-md" title={line.matchReason}>
                                                        <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                                                        <span className="truncate">{line.matchReason}</span>
                                                    </span>
                                                )}
                                                {approveProductLines.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveProductLine(line.id)}
                                                        className="text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                                                        title="Xóa dòng sản phẩm này"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Combobox chọn sản phẩm */}
                                        <div>
                                            <Combobox
                                                options={productOptions}
                                                value={line.product_id}
                                                onChange={val => handleUpdateProductLine(line.id, { product_id: val || '' })}
                                                placeholder="Tìm kiếm sản phẩm (theo tên, mã SKU, tên viết tắt)..."
                                                className="w-full text-xs"
                                                renderValue={(option) => (
                                                    <div className="flex items-center justify-between w-full py-0.5 gap-2">
                                                        <span className="font-bold text-xs text-stone-900 dark:text-zinc-100 truncate">
                                                            {option.name}
                                                        </span>
                                                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded shrink-0 border border-indigo-200/60 dark:border-indigo-800/40">
                                                            {option.sku}
                                                        </span>
                                                    </div>
                                                )}
                                                renderOption={(option: any) => (
                                                    <div className="flex flex-col text-left w-full py-1">
                                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                                            <div className="text-xs font-black text-zinc-900 dark:text-zinc-100 font-mono leading-none uppercase">
                                                                {option.sku}
                                                            </div>
                                                            {option.rawAliases && (
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                                                                    ⚡ {option.rawAliases.split(/[,;\n]/)[0]?.trim()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-1 leading-tight font-medium">
                                                            {option.name}
                                                        </div>
                                                    </div>
                                                )}
                                            />
                                        </div>

                                        {/* 3 Điều khiển tinh chỉnh: Đơn vị tính, Số lượng, Khối lượng */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                                            {/* Đơn vị tính */}
                                            <div>
                                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                                    Đơn vị tính:
                                                </label>
                                                <select
                                                    value={line.unit}
                                                    onChange={e => handleUpdateProductLine(line.id, { unit: e.target.value })}
                                                    className="w-full h-9 px-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl font-bold text-stone-800 dark:text-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                                >
                                                    {availableUnits.length > 0 ? (
                                                        availableUnits.map(u => (
                                                            <option key={u} value={u}>{u}</option>
                                                        ))
                                                    ) : (
                                                        <>
                                                            <option value="Thùng (20kg)">Thùng (20kg)</option>
                                                            <option value="Kg">Kg</option>
                                                        </>
                                                    )}
                                                </select>
                                            </div>

                                            {/* Số lượng */}
                                            <div>
                                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                                    Số lượng ({line.unit || 'Thùng'}):
                                                </label>
                                                <input
                                                    type="number"
                                                    step="1"
                                                    value={line.quantity}
                                                    onChange={e => handleUpdateProductLine(line.id, { quantity: parseInt(e.target.value, 10) || 0 })}
                                                    className="w-full h-9 px-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-black text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                            </div>

                                            {/* Khối lượng */}
                                            <div>
                                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                                    Khối lượng (Kg):
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={line.weight}
                                                    onChange={e => handleUpdateProductLine(line.id, { weight: parseFloat(e.target.value) || 0 })}
                                                    className="w-full h-9 px-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-black text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Tổng kết toàn bộ dòng sản phẩm */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-emerald-50/80 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-emerald-950/40 rounded-2xl border border-indigo-200/70 dark:border-indigo-800/60 shadow-2xs">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950 dark:text-indigo-200">
                                <Layers size={14} className="text-indigo-600" />
                                <span>Tổng cộng Pallet:</span>
                            </div>
                            <div className="flex items-center gap-2 font-mono font-black text-xs">
                                <span className="px-2.5 py-1 bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200/80 dark:border-emerald-800 shadow-2xs">
                                    {approveProductLines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0)} thùng
                                </span>
                                <span className="px-2.5 py-1 bg-white dark:bg-zinc-800 text-indigo-700 dark:text-indigo-300 rounded-xl border border-indigo-200/80 dark:border-indigo-800 shadow-2xs">
                                    {approveProductLines.reduce((sum, l) => sum + (Number(l.weight) || 0), 0).toFixed(1)} Kg
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Thông tin ngày tháng của LOT */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {/* Ngày nhập kho */}
                        <div className="p-3 bg-slate-50/80 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 flex flex-col justify-between shadow-2xs">
                            <div>
                                <label className="text-[11px] font-bold text-stone-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
                                    <Calendar size={13} className="text-indigo-500 shrink-0" />
                                    <span>Ngày nhập kho:</span>
                                </label>
                                <input
                                    type="date"
                                    value={customInboundDate}
                                    onChange={e => setCustomInboundDate(e.target.value)}
                                    className="w-full h-8 px-2 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <span className="text-[10px] text-stone-400 mt-1 block">Ngày tạo LOT nhập kho</span>
                        </div>

                        {/* Ngày đóng gói */}
                        <div className="p-3 bg-slate-50/80 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 flex flex-col justify-between shadow-2xs">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                                        <Calendar size={13} className="text-amber-500 shrink-0" />
                                        <span>Ngày đóng gói:</span>
                                    </label>
                                    {customPackagingDates.length > 0 && (
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                            {customPackagingDates.length} ngày
                                        </span>
                                    )}
                                </div>

                                {/* Danh sách các ngày đóng gói đã có */}
                                {customPackagingDates.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-1.5 max-h-20 overflow-y-auto">
                                        {customPackagingDates.map(dStr => (
                                            <span key={dStr} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-800/60 rounded-lg text-[11px] font-bold text-amber-900 dark:text-amber-200 shadow-2xs">
                                                <span>{new Date(dStr).toLocaleDateString('vi-VN')}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePackagingDate(dStr)}
                                                    className="text-stone-400 hover:text-rose-600 cursor-pointer p-0.5 rounded"
                                                    title={`Xóa ngày ${new Date(dStr).toLocaleDateString('vi-VN')}`}
                                                >
                                                    <X size={11} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-1">
                                    <input
                                        type="date"
                                        value={newPackagingDateInput}
                                        onChange={e => setNewPackagingDateInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPackagingDate(); } }}
                                        className="w-full h-8 px-2 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddPackagingDate}
                                        disabled={!newPackagingDateInput}
                                        className="h-8 px-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-all shadow-xs"
                                        title="Thêm ngày đóng gói"
                                    >
                                        <Plus size={13} />
                                    </button>
                                </div>
                            </div>
                            <span className="text-[10px] text-stone-400 mt-1 block">{isStampModal ? 'Dấu mực: Dòng 2 (DDMM)' : 'Từ tem nhãn (NĐG)'}</span>
                        </div>

                        {/* Ngày sản xuất */}
                        <div className="p-3 bg-slate-50/80 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 flex flex-col justify-between shadow-2xs">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                                        <Calendar size={13} className="text-orange-500 shrink-0" />
                                        <span>Ngày sản xuất:</span>
                                    </label>
                                    {customPeelingDates.length > 0 && (
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                                            {customPeelingDates.length} ngày
                                        </span>
                                    )}
                                </div>

                                {/* Danh sách các ngày sản xuất đã có */}
                                {customPeelingDates.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-1.5 max-h-20 overflow-y-auto">
                                        {customPeelingDates.map(dStr => (
                                            <span key={dStr} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-orange-300 dark:border-orange-800/60 rounded-lg text-[11px] font-bold text-orange-900 dark:text-orange-200 shadow-2xs">
                                                <span>{new Date(dStr).toLocaleDateString('vi-VN')}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePeelingDate(dStr)}
                                                    className="text-stone-400 hover:text-rose-600 cursor-pointer p-0.5 rounded"
                                                    title={`Xóa ngày ${new Date(dStr).toLocaleDateString('vi-VN')}`}
                                                >
                                                    <X size={11} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-1">
                                    <input
                                        type="date"
                                        value={newPeelingDateInput}
                                        onChange={e => setNewPeelingDateInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPeelingDate(); } }}
                                        className="w-full h-8 px-2 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddPeelingDate}
                                        disabled={!newPeelingDateInput}
                                        className="h-8 px-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-all shadow-xs"
                                        title="Thêm ngày sản xuất"
                                    >
                                        <Plus size={13} />
                                    </button>
                                </div>
                            </div>
                            <span className="text-[10px] text-stone-400 mt-1 block">{isStampModal ? 'Dấu mực: để trống' : 'Từ tem nhãn (NSX)'}</span>
                        </div>

                        {/* Ngày nhập NL */}
                        <div className="p-3 bg-slate-50/80 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 flex flex-col justify-between shadow-2xs">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                                        <Calendar size={13} className="text-emerald-500 shrink-0" />
                                        <span>Ngày nhập NL:</span>
                                    </label>
                                    {customRawMaterialDates.length > 0 && (
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                            {customRawMaterialDates.length} ngày
                                        </span>
                                    )}
                                </div>

                                {/* Danh sách các ngày nhập NL đã có */}
                                {customRawMaterialDates.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-1.5 max-h-20 overflow-y-auto">
                                        {customRawMaterialDates.map(dStr => (
                                            <span key={dStr} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-emerald-300 dark:border-emerald-800/60 rounded-lg text-[11px] font-bold text-emerald-900 dark:text-emerald-200 shadow-2xs">
                                                <span>{new Date(dStr).toLocaleDateString('vi-VN')}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRawDate(dStr)}
                                                    className="text-stone-400 hover:text-rose-600 cursor-pointer p-0.5 rounded"
                                                    title={`Xóa ngày ${new Date(dStr).toLocaleDateString('vi-VN')}`}
                                                >
                                                    <X size={11} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-1">
                                    <input
                                        type="date"
                                        value={newRawMaterialDateInput}
                                        onChange={e => setNewRawMaterialDateInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRawDate(); } }}
                                        className="w-full h-8 px-2 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddRawDate}
                                        disabled={!newRawMaterialDateInput}
                                        className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-all shadow-xs"
                                        title="Thêm ngày nhập nguyên liệu"
                                    >
                                        <Plus size={13} />
                                    </button>
                                </div>
                            </div>
                            <span className="text-[10px] text-stone-400 mt-1 block">{isStampModal ? 'Dấu mực: Dòng 2 (DDMMYY)' : 'Tem nhãn: để trống'}</span>
                        </div>
                    </div>

                    {/* 4. Nơi sản xuất, Vùng nguyên liệu & Ghi chú */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50/80 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 shadow-2xs">
                            <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 block mb-1.5 flex items-center gap-1.5">
                                <Factory size={13} className="text-blue-500" />
                                <span>Nơi sản xuất / Tổ đóng gói:</span>
                            </label>
                            <input
                                type="text"
                                value={customProductionPlace}
                                onChange={e => setCustomProductionPlace(e.target.value)}
                                placeholder="VD: Tổ 1, Xưởng Chánh Thu..."
                                className="w-full h-9 px-3 bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="p-3 bg-slate-50/80 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 shadow-2xs">
                            <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 block mb-1.5 flex items-center gap-1.5">
                                <MapPin size={13} className="text-emerald-500" />
                                <span>Vùng nguyên liệu:</span>
                            </label>
                            <input
                                type="text"
                                value={customMaterialZone}
                                onChange={e => setCustomMaterialZone(e.target.value)}
                                placeholder="VD: Bến Tre, Tây Nguyên..."
                                className="w-full h-9 px-3 bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="p-3 bg-slate-50/80 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 shadow-2xs">
                        <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 block mb-1.5">
                            Ghi chú LOT hàng:
                        </label>
                        <textarea
                            value={customNotes}
                            onChange={e => setCustomNotes(e.target.value)}
                            placeholder="Nhập ghi chú cho LOT hàng (nếu có)..."
                            rows={2}
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none placeholder:text-stone-400"
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-stone-200/80 dark:border-zinc-800">
                    <span className="text-xs text-stone-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span>
                            {editingLinkedPallet
                                ? <>Cập nhật toàn bộ thông tin và đồng bộ <strong>{modalBoxCount} thùng</strong> của LOT</>
                                : <>Tự động liên kết và đồng bộ <strong>{modalBoxCount} thùng</strong> vào LOT</>}
                        </span>
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => { setApproveGroup(null); setEditingLinkedPallet(null); }}
                            className="px-4 py-2.5 text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            onClick={editingLinkedPallet ? handleSaveEditLinkedLot : handleConfirmCreateLot}
                            disabled={isApproving || isSavingLinkedLot}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-500/25 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                        >
                            {(isApproving || isSavingLinkedLot) ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                            <span>
                                {editingLinkedPallet
                                    ? (isSavingLinkedLot ? 'Đang lưu cập nhật...' : 'Lưu & Cập Nhật Tất Cả')
                                    : (isApproving ? 'Đang tạo LOT...' : 'Tạo LOT & Kết Nối Ngay')}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
