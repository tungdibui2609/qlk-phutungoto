'use client'

import React from 'react'
import type { BoxLabelItem, UnlinkedPalletGroup } from './types'
import { X, Loader2, Check } from 'lucide-react'
import { getBoxIndex } from './palletHelpers'

interface EditSingleBoxModalProps {
    editingBox: BoxLabelItem | null
    setEditingBox: React.Dispatch<React.SetStateAction<BoxLabelItem | null>>
    previewGroup: UnlinkedPalletGroup | null
    editBoxCode: string
    setEditBoxCode: React.Dispatch<React.SetStateAction<string>>
    editStampLine1: string
    setEditStampLine1: React.Dispatch<React.SetStateAction<string>>
    editStampLine2: string
    setEditStampLine2: React.Dispatch<React.SetStateAction<string>>
    editLotCode: string
    setEditLotCode: React.Dispatch<React.SetStateAction<string>>
    editWeight: string
    setEditWeight: React.Dispatch<React.SetStateAction<string>>
    editSpec: string
    setEditSpec: React.Dispatch<React.SetStateAction<string>>
    editShiftGroup: string
    setEditShiftGroup: React.Dispatch<React.SetStateAction<string>>
    editProductionDate: string
    setEditProductionDate: React.Dispatch<React.SetStateAction<string>>
    editPackagingDate: string
    setEditPackagingDate: React.Dispatch<React.SetStateAction<string>>
    editApplyToAllInPallet: boolean
    setEditApplyToAllInPallet: React.Dispatch<React.SetStateAction<boolean>>
    isSavingEdit: boolean
    handleSaveBoxEdit: () => Promise<void>
}

export function EditSingleBoxModal({
    editingBox,
    setEditingBox,
    previewGroup,
    editBoxCode,
    setEditBoxCode,
    editStampLine1,
    setEditStampLine1,
    editStampLine2,
    setEditStampLine2,
    editLotCode,
    setEditLotCode,
    editWeight,
    setEditWeight,
    editSpec,
    setEditSpec,
    editShiftGroup,
    setEditShiftGroup,
    editProductionDate,
    setEditProductionDate,
    editPackagingDate,
    setEditPackagingDate,
    editApplyToAllInPallet,
    setEditApplyToAllInPallet,
    isSavingEdit,
    handleSaveBoxEdit,
}: EditSingleBoxModalProps) {
    if (!editingBox) return null
    return (
        <>
            {editingBox && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                                    <span>Sửa Thùng #{getBoxIndex(editingBox)}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 truncate max-w-[200px]" title={editingBox.code}>
                                        {editingBox.code}
                                    </span>
                                </h3>
                                <p className="text-xs text-stone-400">
                                    Điều chỉnh các chỉ số bị lệch do hình ảnh chụp mờ hoặc sai OCR
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingBox(null)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 my-4 overflow-y-auto pr-1">
                            {/* Dành cho thùng đóng dấu mực */}
                            {(editingBox.metadata?.scan_type === 'stamp' || editingBox.code?.startsWith('STAMP-') || editStampLine1 || editStampLine2) ? (
                                <div className="space-y-3 p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-800/60">
                                    <div className="flex items-center justify-between">
                                        <span className="font-black text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                            📦 THÔNG TIN CON DẤU MỰC
                                        </span>
                                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                            Khớp với ảnh chụp thực tế
                                        </span>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                            Dòng 1 (Mã quy cách / SKU sản phẩm):
                                        </label>
                                        <input
                                            type="text"
                                            value={editStampLine1}
                                            onChange={e => setEditStampLine1(e.target.value)}
                                            placeholder="VD: 102010402001-0"
                                            className="w-full px-3 py-2 font-mono bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                            Dòng 2 (Mã ngày &amp; Barcode 16 số):
                                        </label>
                                        <input
                                            type="text"
                                            value={editStampLine2}
                                            onChange={e => {
                                                setEditStampLine2(e.target.value)
                                                if (!editLotCode || editLotCode === editStampLine2) {
                                                    setEditLotCode(e.target.value)
                                                }
                                            }}
                                            placeholder="VD: 2231015102600066"
                                            className="w-full px-3 py-2 font-mono bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>

                                    {previewGroup && previewGroup.boxes.length > 1 && (
                                        <label className="flex items-center gap-2 p-2 bg-amber-100/70 dark:bg-amber-900/40 rounded-lg text-xs font-bold text-amber-900 dark:text-amber-200 cursor-pointer select-none border border-amber-300/80 dark:border-amber-700/60">
                                            <input
                                                type="checkbox"
                                                checked={editApplyToAllInPallet}
                                                onChange={e => setEditApplyToAllInPallet(e.target.checked)}
                                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                                            />
                                            <span>Đồng bộ Dòng 1 &amp; Dòng 2 cho toàn bộ {previewGroup.boxes.length} thùng của Pallet {previewGroup.pallet_stt}</span>
                                        </label>
                                    )}
                                </div>
                            ) : (
                                /* Dành cho tem nhãn in OCR */
                                <div className="space-y-3 p-3.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-800/60">
                                    <span className="font-black text-xs text-blue-800 dark:text-blue-300 block">
                                        🏷️ THÔNG TIN TEM NHÃN OCR
                                    </span>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Quy cách:
                                            </label>
                                            <input
                                                type="text"
                                                value={editSpec}
                                                onChange={e => setEditSpec(e.target.value)}
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Tổ / Ca:
                                            </label>
                                            <input
                                                type="text"
                                                value={editShiftGroup}
                                                onChange={e => setEditShiftGroup(e.target.value)}
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Ngày sản xuất:
                                            </label>
                                            <input
                                                type="text"
                                                value={editProductionDate}
                                                onChange={e => setEditProductionDate(e.target.value)}
                                                placeholder="DD/MM/YYYY"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Ngày đóng gói:
                                            </label>
                                            <input
                                                type="text"
                                                value={editPackagingDate}
                                                onChange={e => setEditPackagingDate(e.target.value)}
                                                placeholder="DD/MM/YYYY"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                        Khối lượng ({editingBox.unit}):
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={editWeight}
                                        onChange={e => setEditWeight(e.target.value)}
                                        className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                        Mã LOT:
                                    </label>
                                    <input
                                        type="text"
                                        value={editLotCode}
                                        onChange={e => setEditLotCode(e.target.value)}
                                        className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-stone-600 dark:text-zinc-400">
                                        Mã Barcode Thùng (Code):
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const idxStr = String(getBoxIndex(editingBox)).padStart(3, '0')
                                            const stt = (editingBox.metadata?.pallet_stt || 'PALLET').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                                            if (editStampLine1 || editStampLine2) {
                                                const l1 = editStampLine1.replace(/[^a-zA-Z0-9]/g, '')
                                                const l2 = editStampLine2.replace(/[^a-zA-Z0-9]/g, '')
                                                setEditBoxCode(`STAMP-${l1}-${l2}-${stt}-${idxStr}`)
                                            } else {
                                                const lot = (editLotCode || 'LOT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                                                const sku = (editingBox.metadata?.sku || editingBox.products?.sku || 'SKU').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                                                setEditBoxCode(`BOX-${lot}-${sku}-${stt}-${idxStr}`)
                                            }
                                        }}
                                        className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                                    >
                                        ⚡ Tự tạo lại mã theo dữ liệu mới
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={editBoxCode}
                                    onChange={e => setEditBoxCode(e.target.value)}
                                    className="w-full px-3 py-2 font-mono text-xs text-stone-800 dark:text-zinc-200 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <button
                                onClick={() => setEditingBox(null)}
                                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSaveBoxEdit}
                                disabled={isSavingEdit}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Lưu Thay Đổi</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
