'use client'

import React from 'react'
import type { UnlinkedPalletGroup } from './types'
import { decodeSTT } from '@/lib/numberUtils'
import { Search, X, Loader2, Check, List } from 'lucide-react'

export interface ActiveLotOption {
    id: string
    code: string
    daily_seq: number | null
    status?: string | null
    product_name?: string
    quantity?: number
    created_at?: string
    existingBoxesCount?: number
    existingTotalWeight?: number
}

interface ManualLinkLotModalProps {
    groupToLink: UnlinkedPalletGroup | null
    setGroupToLink: React.Dispatch<React.SetStateAction<UnlinkedPalletGroup | null>>
    linkLotSearch: string
    setLinkLotSearch: React.Dispatch<React.SetStateAction<string>>
    selectedLotForLink: string | null
    setSelectedLotForLink: React.Dispatch<React.SetStateAction<string | null>>
    filteredLotsForModal: ActiveLotOption[]
    isLinking: boolean
    handleLinkGroupToLot: (group: UnlinkedPalletGroup, targetLotId: string) => Promise<void>
}

export function ManualLinkLotModal({
    groupToLink,
    setGroupToLink,
    linkLotSearch,
    setLinkLotSearch,
    selectedLotForLink,
    setSelectedLotForLink,
    filteredLotsForModal,
    isLinking,
    handleLinkGroupToLot,
}: ManualLinkLotModalProps) {
    if (!groupToLink) return null
    return (
        <>
            {groupToLink && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg p-5 shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100">
                                    Ghép Pallet STT: {groupToLink.pallet_stt} vào LOT
                                </h3>
                                <p className="text-xs text-stone-500">
                                    Tổng cộng {groupToLink.boxes.length} thùng ({groupToLink.total_weight.toFixed(1)} Kg)
                                </p>
                            </div>
                            <button
                                onClick={() => setGroupToLink(null)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Search Lots */}
                        <div className="my-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
                                <input
                                    type="text"
                                    placeholder="Tìm mã LOT, STT, tên sản phẩm..."
                                    value={linkLotSearch}
                                    onChange={e => setLinkLotSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl text-xs text-stone-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        {/* List of Lots to choose */}
                        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800 space-y-1 my-2">
                            {filteredLotsForModal.length === 0 ? (
                                <p className="text-center py-8 text-xs text-stone-400">
                                    Không tìm thấy LOT nào phù hợp.
                                </p>
                            ) : (
                                filteredLotsForModal.map(lot => {
                                    const isSelected = selectedLotForLink === lot.id
                                    const lotStt = lot.daily_seq ? decodeSTT(lot.daily_seq) : ''
                                    return (
                                        <div
                                            key={lot.id}
                                            onClick={() => setSelectedLotForLink(lot.id)}
                                            className={`p-3 rounded-xl cursor-pointer transition-all border ${
                                                isSelected
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500'
                                                    : 'hover:bg-stone-50 dark:hover:bg-zinc-800/60 border-transparent'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-xs text-stone-900 dark:text-zinc-100">
                                                        {lot.code}
                                                    </span>
                                                    {lotStt && (
                                                        <span className="font-mono text-[11px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                                                            STT: {lotStt}
                                                        </span>
                                                    )}
                                                </div>
                                                {isSelected && <Check size={16} className="text-emerald-600" />}
                                            </div>
                                            {lot.product_name && (
                                                <p className="text-[11px] text-stone-500 mt-1 truncate">
                                                    {lot.product_name}
                                                </p>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <button
                                onClick={() => setGroupToLink(null)}
                                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => selectedLotForLink && handleLinkGroupToLot(groupToLink, selectedLotForLink)}
                                disabled={!selectedLotForLink || isLinking}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {isLinking ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Xác Nhận Ghép Vào LOT</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
