'use client'

import React from 'react'
import type { UnlinkedPalletGroup } from './types'
import { X, Loader2, Check } from 'lucide-react'

interface BulkEditBoxesModalProps {
    isBulkEditOpen: boolean
    setIsBulkEditOpen: React.Dispatch<React.SetStateAction<boolean>>
    previewGroup: UnlinkedPalletGroup | null
    selectedBoxIds: Set<string>
    bulkScope: 'all' | 'selected'
    setBulkScope: React.Dispatch<React.SetStateAction<'all' | 'selected'>>
    bulkStampLine1: string
    setBulkStampLine1: React.Dispatch<React.SetStateAction<string>>
    bulkStampLine2: string
    setBulkStampLine2: React.Dispatch<React.SetStateAction<string>>
    bulkLotCode: string
    setBulkLotCode: React.Dispatch<React.SetStateAction<string>>
    bulkWeight: string
    setBulkWeight: React.Dispatch<React.SetStateAction<string>>
    bulkSpec: string
    setBulkSpec: React.Dispatch<React.SetStateAction<string>>
    bulkShiftGroup: string
    setBulkShiftGroup: React.Dispatch<React.SetStateAction<string>>
    bulkProductionDate: string
    setBulkProductionDate: React.Dispatch<React.SetStateAction<string>>
    bulkPackagingDate: string
    setBulkPackagingDate: React.Dispatch<React.SetStateAction<string>>
    bulkRegenerateCode: boolean
    setBulkRegenerateCode: React.Dispatch<React.SetStateAction<boolean>>
    isSavingBulkEdit: boolean
    handleSaveBulkEdit: () => Promise<void>
    showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export function BulkEditBoxesModal({
    isBulkEditOpen,
    setIsBulkEditOpen,
    previewGroup,
    selectedBoxIds,
    bulkScope,
    setBulkScope,
    bulkStampLine1,
    setBulkStampLine1,
    bulkStampLine2,
    setBulkStampLine2,
    bulkLotCode,
    setBulkLotCode,
    bulkWeight,
    setBulkWeight,
    bulkSpec,
    setBulkSpec,
    bulkShiftGroup,
    setBulkShiftGroup,
    bulkProductionDate,
    setBulkProductionDate,
    bulkPackagingDate,
    setBulkPackagingDate,
    bulkRegenerateCode,
    setBulkRegenerateCode,
    isSavingBulkEdit,
    handleSaveBulkEdit,
    showToast,
}: BulkEditBoxesModalProps) {
    if (!isBulkEditOpen || !previewGroup) return null
    return (
        <>
            {isBulkEditOpen && previewGroup && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-xl p-6 shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                                    <span>⚡ Sửa Hàng Loạt Thùng Quét</span>
                                    <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                        STT: {previewGroup.pallet_stt}
                                    </span>
                                </h3>
                                <p className="text-xs text-stone-500">
                                    {(bulkScope === 'selected' && selectedBoxIds.size > 0)
                                        ? `Đang áp dụng cho ${selectedBoxIds.size} thùng đã chọn`
                                        : `Đang áp dụng cho toàn bộ ${previewGroup.boxes.length} thùng của Pallet`}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsBulkEditOpen(false)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Phạm vi áp dụng */}
                        <div className="flex flex-wrap items-center gap-4 px-3 py-2 mt-3 bg-stone-50 dark:bg-zinc-800/60 rounded-xl border border-stone-200/80 dark:border-zinc-700/60 text-xs">
                            <span className="font-bold text-stone-700 dark:text-zinc-300">Phạm vi:</span>
                            <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-stone-800 dark:text-zinc-200">
                                <input
                                    type="radio"
                                    name="bulkScope"
                                    checked={bulkScope === 'all'}
                                    onChange={() => setBulkScope('all')}
                                    className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <span>Toàn bộ Pallet ({previewGroup.boxes.length} thùng)</span>
                            </label>
                            {selectedBoxIds.size > 0 && (
                                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-stone-800 dark:text-zinc-200">
                                    <input
                                        type="radio"
                                        name="bulkScope"
                                        checked={bulkScope === 'selected'}
                                        onChange={() => setBulkScope('selected')}
                                        className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span>Chỉ {selectedBoxIds.size} thùng đang chọn</span>
                                </label>
                            )}
                        </div>

                        {/* Quick fill button */}
                        <div className="flex items-center justify-between p-2.5 my-3 bg-stone-50 dark:bg-zinc-800/60 rounded-xl border border-stone-200/80 dark:border-zinc-700/60 text-xs">
                            <span className="text-stone-600 dark:text-zinc-400">
                                💡 Nhập các trường cần sửa. Ô để trống sẽ giữ nguyên dữ liệu gốc.
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    const first = previewGroup.boxes[0]
                                    if (!first) return
                                    const m = first.metadata || {}
                                    if (m.stamp_line1) setBulkStampLine1(m.stamp_line1)
                                    if (m.stamp_line2) setBulkStampLine2(m.stamp_line2)
                                    if (first.quantity) setBulkWeight(String(first.quantity))
                                    const lot = first.finished_lot_code || first.semi_finished_lot_code
                                    if (lot) setBulkLotCode(lot)
                                    if (m.spec) setBulkSpec(m.spec)
                                    if (m.shift_group) setBulkShiftGroup(m.shift_group)
                                    if (m.production_date) setBulkProductionDate(m.production_date)
                                    if (m.packaging_date) setBulkPackagingDate(m.packaging_date)
                                    showToast('Đã sao chép mẫu từ Thùng #1!', 'info')
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-600 border border-stone-200 dark:border-zinc-600 rounded-lg font-bold text-stone-700 dark:text-zinc-200 cursor-pointer shadow-2xs"
                            >
                                <span>📋 Lấy mẫu từ Thùng #1</span>
                            </button>
                        </div>

                        {/* Body fields */}
                        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                            {/* Dành cho thùng con dấu */}
                            {previewGroup.boxes.some(b => b.metadata?.scan_type === 'stamp' || b.code?.startsWith('STAMP-')) ? (
                                <div className="space-y-3 p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-800/60">
                                    <div className="flex items-center justify-between">
                                        <span className="font-black text-xs text-amber-800 dark:text-amber-300">
                                            📦 ĐỒNG BỘ CON DẤU MỰC
                                        </span>
                                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                            Sửa số bị mờ / lệch
                                        </span>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                            Dòng 1 mới (Mã quy cách/SKU con dấu):
                                        </label>
                                        <input
                                            type="text"
                                            value={bulkStampLine1}
                                            onChange={e => setBulkStampLine1(e.target.value)}
                                            placeholder="(Để trống nếu không đổi)"
                                            className="w-full px-3 py-2 font-mono bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                            Dòng 2 mới (Mã ngày/LOT con dấu 16 số):
                                        </label>
                                        <input
                                            type="text"
                                            value={bulkStampLine2}
                                            onChange={e => setBulkStampLine2(e.target.value)}
                                            placeholder="(Để trống nếu không đổi)"
                                            className="w-full px-3 py-2 font-mono bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {/* Dành cho tem nhãn */}
                            {previewGroup.boxes.some(b => b.metadata?.scan_type !== 'stamp' && !b.code?.startsWith('STAMP-')) ? (
                                <div className="space-y-3 p-3.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-800/60">
                                    <span className="font-black text-xs text-blue-800 dark:text-blue-300 block">
                                        🏷️ ĐỒNG BỘ TEM NHÃN OCR
                                    </span>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Quy cách mới:
                                            </label>
                                            <input
                                                type="text"
                                                value={bulkSpec}
                                                onChange={e => setBulkSpec(e.target.value)}
                                                placeholder="(Giữ nguyên nếu để trống)"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Tổ / Ca mới:
                                            </label>
                                            <input
                                                type="text"
                                                value={bulkShiftGroup}
                                                onChange={e => setBulkShiftGroup(e.target.value)}
                                                placeholder="(Giữ nguyên nếu để trống)"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Ngày sản xuất mới:
                                            </label>
                                            <input
                                                type="text"
                                                value={bulkProductionDate}
                                                onChange={e => setBulkProductionDate(e.target.value)}
                                                placeholder="DD/MM/YYYY"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Ngày đóng gói mới:
                                            </label>
                                            <input
                                                type="text"
                                                value={bulkPackagingDate}
                                                onChange={e => setBulkPackagingDate(e.target.value)}
                                                placeholder="DD/MM/YYYY"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                        Khối lượng mỗi thùng ({previewGroup.boxes[0]?.unit || 'Kg'}):
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={bulkWeight}
                                        onChange={e => setBulkWeight(e.target.value)}
                                        placeholder="(Giữ nguyên nếu để trống)"
                                        className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                        Mã LOT chung:
                                    </label>
                                    <input
                                        type="text"
                                        value={bulkLotCode}
                                        onChange={e => setBulkLotCode(e.target.value)}
                                        placeholder="(Giữ nguyên nếu để trống)"
                                        className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-2 p-3 bg-stone-50 dark:bg-zinc-800/40 rounded-xl border border-stone-200/80 dark:border-zinc-700/60 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={bulkRegenerateCode}
                                    onChange={e => setBulkRegenerateCode(e.target.checked)}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <div className="text-xs">
                                    <span className="font-bold text-stone-800 dark:text-zinc-200 block">
                                        Tự động tái tạo lại Mã Barcode thùng theo dữ liệu mới
                                    </span>
                                    <span className="text-[11px] text-stone-400">
                                        Đồng bộ chuỗi STAMP-Dòng1-Dòng2-STT-STTThùng để mã barcode luôn khớp 100% với con dấu.
                                    </span>
                                </div>
                            </label>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <button
                                onClick={() => setIsBulkEditOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSaveBulkEdit}
                                disabled={isSavingBulkEdit}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {isSavingBulkEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Xác Nhận Áp Dụng</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
