'use client'

import React from 'react'
import type { BoxLabelItem, UnlinkedPalletGroup } from './types'
import { Trash2, X, Edit3, Tag, Sliders } from 'lucide-react'
import { getBoxIndex } from './palletHelpers'

interface UnlinkedBoxesDetailModalProps {
    previewGroup: UnlinkedPalletGroup | null
    setPreviewGroup: React.Dispatch<React.SetStateAction<UnlinkedPalletGroup | null>>
    selectedBoxIds: Set<string>
    setSelectedBoxIds: React.Dispatch<React.SetStateAction<Set<string>>>
    handleOpenEditPalletInfo: (group: UnlinkedPalletGroup) => void
    handleOpenBulkEdit: (group: UnlinkedPalletGroup) => void
    handleOpenEditBox: (box: BoxLabelItem) => void
    handleDeleteSingleBox: (box: BoxLabelItem) => Promise<void>
}

export function UnlinkedBoxesDetailModal({
    previewGroup,
    setPreviewGroup,
    selectedBoxIds,
    setSelectedBoxIds,
    handleOpenEditPalletInfo,
    handleOpenBulkEdit,
    handleOpenEditBox,
    handleDeleteSingleBox,
}: UnlinkedBoxesDetailModalProps) {
    if (!previewGroup) return null
    return (
        <>
            {previewGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-4xl p-5 shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100 flex items-center gap-2 flex-wrap">
                                    <span>Thông Tin Quét STT:</span>
                                    <span className="font-mono text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-lg text-sm">
                                        {previewGroup.pallet_stt}
                                    </span>
                                    {previewGroup.pallet_tag ? (
                                        <span className="text-xs font-bold text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/60 px-2.5 py-0.5 rounded-lg border border-orange-200 dark:border-orange-800 flex items-center gap-1">
                                            <Tag size={12} /> {previewGroup.pallet_tag}
                                        </span>
                                    ) : null}
                                    {previewGroup.pallet_notes ? (
                                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                                            📝 {previewGroup.pallet_notes}
                                        </span>
                                    ) : null}
                                    <button
                                        onClick={() => handleOpenEditPalletInfo(previewGroup)}
                                        title="Sửa STT / Mã phụ (Tag) / Ghi chú Pallet"
                                        className="p-1 text-stone-400 hover:text-emerald-600 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                </h3>
                                <p className="text-xs text-stone-500 mt-0.5">
                                    Đã quét {previewGroup.boxes.length} thùng · Tổng trọng lượng: {previewGroup.total_weight.toFixed(1)} Kg
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleOpenBulkEdit(previewGroup)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                                >
                                    <Sliders size={14} />
                                    <span>Sửa Hàng Loạt {selectedBoxIds.size > 0 ? `(${selectedBoxIds.size} thùng)` : `(${previewGroup.boxes.length} thùng)`}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setPreviewGroup(null)
                                        setSelectedBoxIds(new Set())
                                    }}
                                    className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Thanh công cụ lựa chọn thùng */}
                        <div className="flex items-center justify-between px-3 py-2 bg-stone-50 dark:bg-zinc-800/60 rounded-xl border border-stone-200/80 dark:border-zinc-700/60 text-xs my-2">
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-stone-700 dark:text-zinc-300">
                                    <input
                                        type="checkbox"
                                        checked={previewGroup.boxes.length > 0 && selectedBoxIds.size === previewGroup.boxes.length}
                                        onChange={e => {
                                            if (e.target.checked) {
                                                setSelectedBoxIds(new Set(previewGroup.boxes.map(b => b.id)))
                                            } else {
                                                setSelectedBoxIds(new Set())
                                            }
                                        }}
                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span>Chọn tất cả ({previewGroup.boxes.length} thùng)</span>
                                </label>
                                {selectedBoxIds.size > 0 && (
                                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md">
                                        Đã chọn: {selectedBoxIds.size} / {previewGroup.boxes.length}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedBoxIds.size > 0 && (
                                    <button
                                        onClick={() => setSelectedBoxIds(new Set())}
                                        className="text-[11px] text-stone-500 hover:text-stone-700 dark:hover:text-zinc-300 underline cursor-pointer"
                                    >
                                        Bỏ chọn
                                    </button>
                                )}
                                <span className="text-[11px] text-stone-400 hidden sm:inline">
                                    💡 Sửa lẻ bằng nút ✏️ trên thẻ thùng, hoặc bấm &quot;Sửa Hàng Loạt&quot; để sửa chung.
                                </span>
                            </div>
                        </div>

                        {/* Danh sách thẻ thùng chi tiết */}
                        <div className="flex-1 overflow-y-auto p-2 my-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {previewGroup.boxes.map(box => {
                                const idx = getBoxIndex(box)
                                const meta = box.metadata || {}
                                const isSelected = selectedBoxIds.has(box.id)
                                return (
                                    <div
                                        key={box.id}
                                        className={`p-2.5 rounded-xl border text-xs transition-all relative ${
                                            isSelected 
                                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-500/20' 
                                                : 'bg-stone-50 dark:bg-zinc-800/50 border-stone-200 dark:border-zinc-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        setSelectedBoxIds(prev => {
                                                            const next = new Set(prev)
                                                            if (next.has(box.id)) next.delete(box.id)
                                                            else next.add(box.id)
                                                            return next
                                                        })
                                                    }}
                                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                />
                                                <span className="font-black text-xs bg-emerald-600 text-white w-6 h-6 flex items-center justify-center rounded-md">
                                                    #{idx}
                                                </span>
                                                <span className="font-black text-emerald-600 dark:text-emerald-400">
                                                    {Number(box.quantity).toFixed(1)} {box.unit}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleOpenEditBox(box)}
                                                    title="Sửa thông tin thùng này"
                                                    className="p-1 text-stone-400 hover:text-emerald-600 rounded-md hover:bg-white dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSingleBox(box)}
                                                    title="Xóa thùng này khỏi đợt quét"
                                                    className="p-1 text-stone-400 hover:text-rose-600 rounded-md hover:bg-white dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="font-mono font-bold text-[11px] text-stone-800 dark:text-zinc-200 truncate mb-1" title={box.code}>
                                            {box.code}
                                        </p>
                                        {meta.scan_type === 'stamp' ? (
                                            <div className="bg-amber-50/80 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200/80 dark:border-amber-800/60 text-[10px] space-y-1 mb-1">
                                                <p className="truncate"><strong className="text-stone-500">Dòng 1:</strong> <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">{meta.stamp_line1 || '---'}</span></p>
                                                <p className="truncate"><strong className="text-stone-500">Dòng 2:</strong> <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">{meta.stamp_line2 || '---'}</span></p>
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-stone-500 space-y-0.5">
                                                <p>LOT tem: <strong className="text-stone-700 dark:text-zinc-300">{box.finished_lot_code || box.semi_finished_lot_code || '---'}</strong></p>
                                                <p>Quy cách: <strong className="text-stone-700 dark:text-zinc-300">{meta.spec || '---'}</strong></p>
                                                <p>Tổ: <strong className="text-stone-700 dark:text-zinc-300">{meta.shift_group || '---'}</strong></p>
                                                <p>Ngày SX: <strong className="text-amber-600 dark:text-amber-400">{meta.production_date || '---'}</strong></p>
                                                <p>Ngày ĐG: <strong className="text-stone-700 dark:text-zinc-300">{meta.packaging_date || '---'}</strong></p>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <span className="text-xs text-stone-400">
                                Dữ liệu quét lưu trên hệ thống, có thể sửa đổi và đồng bộ trước khi duyệt tạo hoặc ghép vào LOT.
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleOpenBulkEdit(previewGroup)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                                >
                                    <Sliders size={14} />
                                    <span>Sửa Hàng Loạt</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setPreviewGroup(null)
                                        setSelectedBoxIds(new Set())
                                    }}
                                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold rounded-xl cursor-pointer"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
