'use client'

import React from 'react'
import type { UnlinkedPalletGroup } from './types'
import { X, Loader2, Check, Tag } from 'lucide-react'

interface EditPalletInfoModalProps {
    editingPalletInfoGroup: UnlinkedPalletGroup | null
    setEditingPalletInfoGroup: React.Dispatch<React.SetStateAction<UnlinkedPalletGroup | null>>
    editPalletSTT: string
    setEditPalletSTT: React.Dispatch<React.SetStateAction<string>>
    editPalletTag: string
    setEditPalletTag: React.Dispatch<React.SetStateAction<string>>
    editPalletNotes: string
    setEditPalletNotes: React.Dispatch<React.SetStateAction<string>>
    isSavingPalletInfo: boolean
    handleSavePalletInfo: () => Promise<void>
}

export function EditPalletInfoModal({
    editingPalletInfoGroup,
    setEditingPalletInfoGroup,
    editPalletSTT,
    setEditPalletSTT,
    editPalletTag,
    setEditPalletTag,
    editPalletNotes,
    setEditPalletNotes,
    isSavingPalletInfo,
    handleSavePalletInfo,
}: EditPalletInfoModalProps) {
    if (!editingPalletInfoGroup) return null
    return (
        <>
            {editingPalletInfoGroup && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-stone-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100">
                                    Sửa Thông Tin Pallet
                                </h3>
                                <p className="text-xs text-stone-500">
                                    Cập nhật STT, mã phụ và ghi chú cho toàn bộ các thùng trong Pallet này
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingPalletInfoGroup(null)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 my-4">
                            <div>
                                <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                    Mã STT Pallet:
                                </label>
                                <input
                                    type="text"
                                    value={editPalletSTT}
                                    onChange={e => setEditPalletSTT(e.target.value.toUpperCase())}
                                    placeholder="VD: G38"
                                    className="w-full px-3 py-2 font-mono font-bold bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                    Mã Phụ (Tag):
                                </label>
                                <input
                                    type="text"
                                    value={editPalletTag}
                                    onChange={e => setEditPalletTag(e.target.value.toUpperCase())}
                                    placeholder="VD: IQF, XUAT_KHAU... (Để trống nếu không có)"
                                    className="w-full px-3 py-2 font-mono font-bold bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                    Ghi Chú Pallet:
                                </label>
                                <textarea
                                    value={editPalletNotes}
                                    onChange={e => setEditPalletNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Ghi chú thêm về đợt quét này..."
                                    className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <button
                                onClick={() => setEditingPalletInfoGroup(null)}
                                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSavePalletInfo}
                                disabled={isSavingPalletInfo}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {isSavingPalletInfo ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Lưu Pallet</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
