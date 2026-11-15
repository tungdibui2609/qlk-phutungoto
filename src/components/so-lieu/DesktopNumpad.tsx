'use client'

import React from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { ProductItem } from './types'

interface DesktopNumpadProps {
    padProduct: ProductItem | null
    padUnit: string
    setPadUnit: (u: string) => void
    padValue: string
    setPadValue: (v: string) => void
    padSaving: boolean
    getProductUnits: (product: ProductItem) => string[]
    getProductCount: (productName: string, unit: string) => { inQty: number; outQty: number }
    onUnitChange: (productId: string, unit: string) => void
    onPadKey: (key: string) => void
    onPadConfirm: (type: 'in' | 'out') => void
}

export default function DesktopNumpad({
    padProduct,
    padUnit,
    setPadUnit,
    padValue,
    setPadValue,
    padSaving,
    getProductUnits,
    getProductCount,
    onUnitChange,
    onPadKey,
    onPadConfirm,
}: DesktopNumpadProps) {
    return (
        <aside className="hidden sm:block sm:col-start-2 sm:row-start-1 sm:row-span-2 sticky top-[76px] max-h-[calc(100vh-82px)] overflow-y-auto scrollbar-none">
            {padProduct ? (() => {
                const units = getProductUnits(padProduct)
                const qtyNum = parseFloat(padValue) || 0
                const stats = getProductCount(padProduct.name, padUnit)
                const canSave = qtyNum > 0 && !padSaving
                return (
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-sm p-3 space-y-1">
                        {/* Hàng 1: Tên sản phẩm (khung viền border & màu nền nổi bật) */}
                        <div className="px-2.5 py-1.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs">
                            <h3 className="text-xs font-bold text-indigo-950 dark:text-indigo-100 leading-snug line-clamp-2 break-words" title={padProduct.name}>
                                {padProduct.name}
                            </h3>
                        </div>

                        {/* Hàng 2: Chọn ĐVT & Thống kê đã nhập/xuất (+/-) */}
                        <div className="flex items-center justify-between gap-1.5 py-0.5">
                            <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none">
                                <span className="text-[10px] font-bold text-stone-400 uppercase shrink-0">ĐVT:</span>
                                <div className="flex flex-wrap gap-1">
                                    {units.map(u => (
                                        <button
                                            key={u}
                                            type="button"
                                            onClick={() => {
                                                setPadUnit(u)
                                                if (padProduct) onUnitChange(padProduct.id, u)
                                            }}
                                            className={`h-6 px-2 rounded-lg text-[11px] font-bold border transition ${
                                                padUnit === u
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                                    : 'bg-stone-50 dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-300 hover:border-indigo-300'
                                            }`}
                                        >
                                            {u}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-900/40 text-[11px] font-black text-emerald-700 dark:text-emerald-300 tabular-nums" title="Tổng đã nhập">
                                    +{stats.inQty}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200/60 dark:border-rose-900/40 text-[11px] font-black text-rose-700 dark:text-rose-300 tabular-nums" title="Tổng đã xuất">
                                    -{stats.outQty}
                                </span>
                            </div>
                        </div>

                        {/* Hàng 3: Màn hình số & Nút xóa nhanh */}
                        <div className="h-9 rounded-xl bg-stone-100 dark:bg-zinc-800/80 border border-stone-200/80 dark:border-zinc-700 flex items-center justify-between px-3">
                            <div className="flex items-center gap-1">
                                {padValue ? (
                                    <button
                                        type="button"
                                        onClick={() => onPadKey('clear')}
                                        className="px-2 py-0.5 rounded bg-stone-200 hover:bg-rose-100 dark:bg-zinc-700 dark:hover:bg-rose-950/60 text-stone-600 hover:text-rose-600 dark:text-stone-300 dark:hover:text-rose-400 text-[10px] font-bold transition leading-none"
                                        title="Xóa số (Esc)"
                                    >
                                        XÓA
                                    </button>
                                ) : (
                                    <span className="text-[11px] font-semibold text-stone-400">Số lượng:</span>
                                )}
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className={`text-xl font-black tabular-nums tracking-tight ${padValue ? 'text-stone-900 dark:text-white' : 'text-stone-300 dark:text-zinc-600'}`}>
                                    {padValue || '0'}
                                </span>
                                <span className="text-xs font-bold text-stone-500">{padUnit}</span>
                            </div>
                        </div>

                        {/* Hàng 3.5: Các nút cộng dồn nhanh số lượng (+1, +5, +10, +50, +100) */}
                        <div className="grid grid-cols-5 gap-1">
                            {[1, 5, 10, 50, 100].map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => {
                                        const cur = parseFloat(padValue) || 0
                                        setPadValue(String(cur + n))
                                    }}
                                    className="h-5.5 rounded-md bg-stone-50 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-stone-200/70 dark:border-zinc-700 text-[11px] font-bold text-stone-700 dark:text-stone-300 transition active:scale-95 flex items-center justify-center leading-none"
                                    title={`Cộng thêm ${n}`}
                                >
                                    +{n}
                                </button>
                            ))}
                        </div>

                        {/* Hàng 4: Bàn phím số 3x4 (Chiều cao phím vừa vặn h-8.5) */}
                        <div className="grid grid-cols-3 gap-1">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map(k => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => onPadKey(k)}
                                    className={`h-8.5 rounded-lg text-base font-bold active:scale-95 transition select-none flex items-center justify-center ${
                                        k === 'del'
                                            ? 'bg-stone-200 hover:bg-stone-300 dark:bg-zinc-700 text-stone-700 dark:text-stone-200'
                                            : 'bg-white hover:bg-stone-100 dark:bg-zinc-800/90 dark:hover:bg-zinc-700 border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-white shadow-2xs'
                                    }`}
                                >
                                    {k === 'del' ? '⌫' : k === '.' ? ',' : k}
                                </button>
                            ))}
                        </div>

                        {/* Hàng 5: Hai nút hành động XUẤT | NHẬP (Cao h-9 vừa vặn, không bị đụng đáy) */}
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <button
                                type="button"
                                disabled={!canSave}
                                onClick={() => onPadConfirm('out')}
                                className="h-9 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold transition disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 flex items-center justify-center gap-1.5 shadow-xs"
                                title="Xác nhận Xuất (Phím trừ -)"
                            >
                                <ArrowUpRight className="w-4 h-4 shrink-0" />
                                <span className="text-xs sm:text-sm font-black">XUẤT {qtyNum > 0 ? `(-${padValue})` : ''}</span>
                            </button>
                            <button
                                type="button"
                                disabled={!canSave}
                                onClick={() => onPadConfirm('in')}
                                className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold transition disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 flex items-center justify-center gap-1.5 shadow-xs"
                                title="Xác nhận Nhập (Phím cộng +)"
                            >
                                <ArrowDownLeft className="w-4 h-4 shrink-0" />
                                <span className="text-xs sm:text-sm font-black">NHẬP {qtyNum > 0 ? `(+${padValue})` : ''}</span>
                            </button>
                        </div>

                        {/* Gợi ý phím tắt */}
                        <p className="text-[10px] text-stone-400 text-center leading-tight pt-0.5">
                            Phím tắt: Số • <kbd className="px-1 rounded bg-stone-100 dark:bg-zinc-800 font-mono text-[9px]">+</kbd> Nhập • <kbd className="px-1 rounded bg-stone-100 dark:bg-zinc-800 font-mono text-[9px]">−</kbd> Xuất • <kbd className="px-1 rounded bg-stone-100 dark:bg-zinc-800 font-mono text-[9px]">↑↓</kbd> Đổi SP • <kbd className="px-1 rounded bg-stone-100 dark:bg-zinc-800 font-mono text-[9px]">Esc</kbd> Xóa
                        </p>
                    </div>
                )
            })() : (
                <div className="bg-white dark:bg-zinc-900 border border-dashed border-stone-300 dark:border-zinc-700 rounded-2xl p-6 text-center text-sm text-stone-400">
                    Chọn một sản phẩm bên trái để nhập số
                </div>
            )}
        </aside>
    )
}
