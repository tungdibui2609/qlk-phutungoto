'use client'

import React from 'react'
import { ArrowDownLeft, ArrowUpRight, PinOff, X } from 'lucide-react'
import { ProductItem } from './types'

interface MobileNumpadSheetProps {
    padProduct: ProductItem | null
    padUnit: string
    setPadUnit: (u: string) => void
    padValue: string
    padSaving: boolean
    getProductUnits: (product: ProductItem) => string[]
    getProductCount: (productName: string, unit: string) => { inQty: number; outQty: number }
    onClose: () => void
    onUnitChange: (productId: string, unit: string) => void
    onPadKey: (key: string) => void
    onPadConfirm: (type: 'in' | 'out') => void
    onUnpinProduct: (productId: string) => void
}

export default function MobileNumpadSheet({
    padProduct,
    padUnit,
    setPadUnit,
    padValue,
    padSaving,
    getProductUnits,
    getProductCount,
    onClose,
    onUnitChange,
    onPadKey,
    onPadConfirm,
    onUnpinProduct,
}: MobileNumpadSheetProps) {
    if (!padProduct) return null

    const units = getProductUnits(padProduct)
    const qtyNum = parseFloat(padValue) || 0
    const stats = getProductCount(padProduct.name, padUnit)
    const canSave = qtyNum > 0 && !padSaving

    return (
        <div className="sm:hidden fixed inset-0 z-[60] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => !padSaving && onClose()} />
            <div className="relative bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-8 duration-200">
                <div className="w-9 h-1 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-2.5" />

                {/* Tên sản phẩm + đã nhập/xuất */}
                <div className="flex items-start gap-2 mb-2.5">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-stone-900 dark:text-white leading-snug break-words">
                            {padProduct.name}
                        </h3>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                            Đã nhập <strong className="text-emerald-600">{stats.inQty}</strong>
                            {' • '}
                            Đã xuất <strong className="text-rose-600">{stats.outQty}</strong>
                            {' '}({padUnit})
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 shrink-0 rounded-full bg-stone-100 dark:bg-zinc-800 flex items-center justify-center text-stone-500"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Chọn đơn vị tính (chỉ hiện khi có nhiều ĐVT) */}
                {units.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-3.5 px-3.5 mb-2.5">
                        {units.map(u => (
                            <button
                                key={u}
                                type="button"
                                onClick={() => {
                                    setPadUnit(u)
                                    onUnitChange(padProduct.id, u)
                                }}
                                className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold border transition ${
                                    padUnit === u
                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                        : 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-300'
                                }`}
                            >
                                {u}
                            </button>
                        ))}
                    </div>
                )}

                {/* Màn hình số */}
                <div className="h-16 rounded-2xl bg-stone-100 dark:bg-zinc-800 flex items-center justify-end gap-2 px-3.5 mb-2.5">
                    <span className={`text-4xl font-black tabular-nums tracking-tight ${padValue ? 'text-stone-900 dark:text-white' : 'text-stone-300 dark:text-zinc-600'}`}>
                        {padValue || '0'}
                    </span>
                    <span className="text-xs font-bold text-stone-500 pb-0.5 self-end mb-3">{padUnit}</span>
                </div>

                {/* Bàn phím số */}
                <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map(k => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => onPadKey(k)}
                            onContextMenu={e => { if (k === 'del') { e.preventDefault(); onPadKey('clear') } }}
                            className={`h-12 rounded-xl text-xl font-bold active:scale-95 transition select-none ${
                                k === 'del'
                                    ? 'bg-stone-200 dark:bg-zinc-700 text-stone-700 dark:text-stone-200 text-base'
                                    : 'bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-white'
                            }`}
                        >
                            {k === 'del' ? '⌫' : k === '.' ? ',' : k}
                        </button>
                    ))}
                </div>

                {/* 2 nút chốt: Xuất | Nhập */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        disabled={!canSave}
                        onClick={() => onPadConfirm('out')}
                        className="h-14 rounded-2xl bg-rose-600 text-white font-black active:scale-95 transition disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 flex flex-col items-center justify-center leading-tight"
                    >
                        <span className="text-sm flex items-center gap-1"><ArrowUpRight className="w-4 h-4" /> XUẤT</span>
                        {qtyNum > 0 && <span className="text-[11px] font-semibold opacity-90">-{padValue} {padUnit}</span>}
                    </button>
                    <button
                        type="button"
                        disabled={!canSave}
                        onClick={() => onPadConfirm('in')}
                        className="h-14 rounded-2xl bg-emerald-600 text-white font-black active:scale-95 transition disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 flex flex-col items-center justify-center leading-tight"
                    >
                        <span className="text-sm flex items-center gap-1"><ArrowDownLeft className="w-4 h-4" /> NHẬP</span>
                        {qtyNum > 0 && <span className="text-[11px] font-semibold opacity-90">+{padValue} {padUnit}</span>}
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        if (confirm(`Bỏ ghim "${padProduct.name}" khỏi công việc này?`)) {
                            onUnpinProduct(padProduct.id)
                            onClose()
                        }
                    }}
                    className="w-full mt-1.5 h-8 text-[11px] text-stone-400 flex items-center justify-center gap-1"
                >
                    <PinOff className="w-3 h-3" /> Bỏ ghim sản phẩm này
                </button>
            </div>
        </div>
    )
}
