'use client'

import React from 'react'
import { Eye, Pin, PinOff } from 'lucide-react'
import { DeliveryJournalRecord, ProductItem } from './types'

interface PinnedProductsPanelProps {
    currentJobName: string
    allProducts: ProductItem[]
    pinnedProducts: ProductItem[]
    displayedPinnedProducts: ProductItem[]
    searchQuery: string
    setSearchQuery: (q: string) => void
    setSearchMode: (m: 'pin' | 'filter') => void
    selectedUnitMap: Record<string, string>
    pulseEffect: Record<string, 'in' | 'out' | null>
    padProduct: ProductItem | null
    setPadProduct: (p: ProductItem | null) => void
    padUnit: string
    setPadUnit: (u: string) => void
    journalList: DeliveryJournalRecord[]
    getProductUnits: (product: ProductItem) => string[]
    getProductCount: (productName: string, unit: string) => { inQty: number; outQty: number }
    onPinProduct: (product: ProductItem) => void
    onUnpinProduct: (productId: string) => void
    onOpenPad: (product: ProductItem) => void
    onUnitChange: (productId: string, unit: string) => void
    onOpenProductHistory: (product: ProductItem) => void
}

export default function PinnedProductsPanel({
    currentJobName,
    allProducts,
    pinnedProducts,
    displayedPinnedProducts,
    searchQuery,
    setSearchQuery,
    setSearchMode,
    selectedUnitMap,
    pulseEffect,
    padProduct,
    setPadProduct,
    padUnit,
    setPadUnit,
    journalList,
    getProductUnits,
    getProductCount,
    onPinProduct,
    onUnpinProduct,
    onOpenPad,
    onUnitChange,
    onOpenProductHistory,
}: PinnedProductsPanelProps) {
    if (pinnedProducts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 sm:py-14 text-center border-2 border-dashed border-stone-200 dark:border-zinc-800 rounded-2xl bg-white/50 dark:bg-zinc-900/40 p-5 sm:p-6">
                <div className="w-11 h-11 sm:w-14 sm:h-14 bg-indigo-50 dark:bg-indigo-950/60 rounded-2xl flex items-center justify-center text-indigo-500 mb-2.5 sm:mb-3">
                    <Pin className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <h2 className="text-sm sm:text-lg font-bold text-stone-800 dark:text-stone-100 mb-1">
                    Bàn làm việc của "{currentJobName}" đang trống
                </h2>
                <p className="text-[11px] sm:text-sm text-stone-500 dark:text-stone-400 max-w-md mb-3.5 sm:mb-4">
                    Tìm và ghim các sản phẩm phục vụ riêng cho công việc này ở ô tìm kiếm phía trên để bắt đầu đếm số lượng.
                </p>
                {allProducts.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-w-lg">
                        <span className="text-[11px] sm:text-xs text-stone-400 w-full mb-0.5 sm:mb-1">Gợi ý ghim nhanh:</span>
                        {allProducts.slice(0, 5).map(p => (
                            <button
                                key={p.id}
                                onClick={() => onPinProduct(p)}
                                className="px-2 py-1 text-[11px] sm:text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 hover:border-indigo-400 rounded-lg transition"
                            >
                                + {p.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <>
            {/* ===== MOBILE: DANH SÁCH GỌN - CHẠM VÀO DÒNG ĐỂ NHẬP SỐ ===== */}
            <div className="sm:hidden mb-3.5">
                <div className="flex items-center justify-between px-1 mb-1.5 text-[10px] text-stone-500">
                    <span>Chạm vào sản phẩm để nhập số</span>
                    <span className="flex items-center gap-2.5">
                        <span className="text-emerald-600 font-bold">N = Nhập</span>
                        <span className="text-rose-600 font-bold">X = Xuất</span>
                    </span>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl divide-y divide-stone-200 dark:divide-zinc-700/80 overflow-hidden shadow-xs">
                    {displayedPinnedProducts.length === 0 ? (
                        <div className="p-6 text-center text-xs text-stone-500">
                            <p className="font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Không tìm thấy sản phẩm đã ghim nào khớp với "{searchQuery}"
                            </p>
                            <div className="flex items-center justify-center gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 font-semibold text-xs"
                                >
                                    Xóa tìm kiếm
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSearchMode('pin')}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs"
                                >
                                    Tìm trong kho để ghim
                                </button>
                            </div>
                        </div>
                    ) : (
                        displayedPinnedProducts.map((product, idx) => {
                            const origIdx = pinnedProducts.findIndex(p => p.id === product.id)
                            const displayIdx = origIdx >= 0 ? origIdx + 1 : idx + 1
                            const productUnits = getProductUnits(product)
                            const currentUnit = selectedUnitMap[product.id] || product.unit || productUnits[0] || 'Kg'
                            const effect = pulseEffect[product.id]
                            const isAltRow = idx % 2 === 1

                            const activeUnits = productUnits.filter(u => {
                                const s = getProductCount(product.name, u)
                                return s.inQty > 0 || s.outQty > 0
                            })
                            const displayUnits = Array.from(new Set([
                                ...(activeUnits.length > 0 ? activeUnits : [currentUnit]),
                                currentUnit
                            ]))

                            return (
                                <div
                                    key={product.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onOpenPad(product)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            onOpenPad(product)
                                        }
                                    }}
                                    className={`w-full p-3 text-left cursor-pointer select-none transition-colors border-l-4 active:bg-indigo-100/60 dark:active:bg-indigo-950/60 ${
                                        effect === 'in'
                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-emerald-500'
                                            : effect === 'out'
                                            ? 'bg-rose-50 dark:bg-rose-950/40 border-l-rose-500'
                                            : isAltRow
                                            ? 'bg-amber-50/35 dark:bg-zinc-800/50 border-l-amber-500'
                                            : 'bg-white dark:bg-zinc-900 border-l-indigo-600'
                                    }`}
                                >
                                    <div className="w-full">
                                        <div className="flex items-start gap-2">
                                            <span className={`w-5 h-5 shrink-0 rounded-md text-[10px] font-black flex items-center justify-center mt-0.5 ${
                                                isAltRow
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                                    : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                                            }`}>
                                                {displayIdx}
                                            </span>

                                            <div className="min-w-0 flex-1">
                                                <span className="block text-[13px] font-bold text-stone-900 dark:text-white leading-snug break-words">
                                                    {product.name}
                                                </span>
                                                {product.sku && (
                                                    <span className="block text-[10px] text-stone-400 font-mono mt-0.5">{product.sku}</span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    onOpenProductHistory(product)
                                                }}
                                                title="Xem lịch sử nhập xuất của riêng sản phẩm này"
                                                className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-indigo-50 dark:bg-zinc-800 flex items-center justify-center text-stone-500 hover:text-indigo-600 shrink-0 transition"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <div className="mt-2 space-y-1.5">
                                            {displayUnits.map(u => {
                                                const uStats = getProductCount(product.name, u)
                                                const isSelected = currentUnit === u
                                                return (
                                                    <div
                                                        key={u}
                                                        className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-xl border transition ${
                                                            isSelected
                                                                ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800'
                                                                : 'bg-stone-50 dark:bg-zinc-800/60 border-stone-200 dark:border-zinc-700'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1.5 font-bold">
                                                            <span className={isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-stone-700 dark:text-stone-300'}>
                                                                {u}
                                                            </span>
                                                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0 animate-pulse" />}
                                                        </div>
                                                        <div className="flex items-center gap-2.5 text-xs font-black tabular-nums">
                                                            <span className={uStats.inQty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-zinc-600'}>
                                                                Nhập: +{uStats.inQty}
                                                            </span>
                                                            <span className="text-stone-300 dark:text-zinc-700">|</span>
                                                            <span className={uStats.outQty > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-400 dark:text-zinc-600'}>
                                                                Xuất: -{uStats.outQty}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* ===== DESKTOP: BẢNG DANH SÁCH SẢN PHẨM GỌN - CLICK ĐỂ CHỌN, NHẬP Ở BẢNG BÊN PHẢI ===== */}
            <div className="hidden sm:block sm:col-start-1 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden mb-3.5">
                <div className="grid grid-cols-[minmax(0,1fr)_32px_102px_68px_68px_48px_28px] items-center gap-2 px-3 py-1.5 bg-stone-50 dark:bg-zinc-950/60 border-b border-stone-200 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    <span>Sản phẩm</span>
                    <span className="text-center" title="Lịch sử nhập xuất">LS</span>
                    <span className="text-center">ĐVT</span>
                    <span className="text-center text-emerald-600">Đã nhập</span>
                    <span className="text-center text-rose-600">Đã xuất</span>
                    <span className="text-center">Số đợt</span>
                    <span />
                </div>
                <div className="divide-y divide-stone-100 dark:divide-zinc-800/80">
                    {displayedPinnedProducts.length === 0 ? (
                        <div className="p-8 text-center text-xs text-stone-500">
                            <p className="font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Không tìm thấy sản phẩm đã ghim nào khớp với "{searchQuery}"
                            </p>
                            <p className="text-[11px] text-stone-400 mb-3">
                                Sản phẩm này chưa được ghim vào công việc hoặc gõ sai từ khóa.
                            </p>
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 font-semibold text-xs hover:bg-stone-200"
                                >
                                    Xóa tìm kiếm
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSearchMode('pin')}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
                                >
                                    Tìm trong kho để ghim
                                </button>
                            </div>
                        </div>
                    ) : (
                        displayedPinnedProducts.map((product, idx) => {
                            const origIdx = pinnedProducts.findIndex(p => p.id === product.id)
                            const displayIdx = origIdx >= 0 ? origIdx + 1 : idx + 1
                            const productUnits = getProductUnits(product)
                            const currentUnit = selectedUnitMap[product.id] || product.unit || productUnits[0] || 'Kg'
                            const isActive = padProduct?.id === product.id
                            const rowUnit = isActive ? padUnit : currentUnit
                            const effect = pulseEffect[product.id]
                            const batchCount = journalList.filter(j => j.item_name === product.name).length

                            const activeUnits = productUnits.filter(u => {
                                const s = getProductCount(product.name, u)
                                return s.inQty > 0 || s.outQty > 0
                            })

                            const displayUnits = Array.from(new Set([
                                rowUnit,
                                ...activeUnits
                            ]))

                            return (
                                <div
                                    key={product.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onOpenPad(product)}
                                    className={`group grid grid-cols-[minmax(0,1fr)_32px_102px_68px_68px_48px_28px] items-center gap-2 px-3 py-1.5 cursor-pointer border-l-4 transition-colors ${
                                        effect === 'in'
                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-emerald-500'
                                            : effect === 'out'
                                            ? 'bg-rose-50 dark:bg-rose-950/40 border-l-rose-500'
                                            : isActive
                                            ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-l-indigo-600'
                                            : idx % 2 === 1
                                            ? 'bg-amber-50/25 dark:bg-zinc-800/40 border-l-amber-400 hover:bg-amber-50/40'
                                            : 'bg-white dark:bg-zinc-900 border-l-indigo-300 dark:border-l-indigo-800/60 hover:bg-stone-50 dark:hover:bg-zinc-800/40'
                                    }`}
                                >
                                    {/* Cột 1: STT + Tên sản phẩm + SKU */}
                                    <div className="min-w-0 flex items-center gap-2">
                                        <span className={`w-5 h-5 shrink-0 rounded text-[10px] font-black flex items-center justify-center ${
                                            isActive
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : idx % 2 === 1
                                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                                        }`}>
                                            {displayIdx}
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <p className={`text-xs font-bold leading-tight break-words ${isActive ? 'text-indigo-900 dark:text-indigo-100' : 'text-stone-900 dark:text-white'}`}>
                                                {product.name}
                                            </p>
                                            {product.sku && (
                                                <p className="text-[10px] text-stone-400 font-mono leading-none mt-0.5">{product.sku}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Cột 2: Con mắt xem lịch sử riêng sản phẩm */}
                                    <div className="flex items-center justify-center">
                                        <button
                                            type="button"
                                            onClick={e => {
                                                e.stopPropagation()
                                                onOpenProductHistory(product)
                                            }}
                                            title="Xem lịch sử nhập xuất của riêng sản phẩm này"
                                            className="w-6 h-6 rounded-md flex items-center justify-center text-stone-400 hover:text-indigo-600 hover:bg-indigo-100/70 dark:hover:bg-zinc-800 transition"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {/* Cột 3: ĐVT */}
                                    <div className="flex flex-col gap-1 justify-center" onClick={e => e.stopPropagation()}>
                                        {displayUnits.map(u => {
                                            const isPadActive = isActive && padUnit === u
                                            const isSelected = rowUnit === u
                                            return (
                                                <button
                                                    key={u}
                                                    type="button"
                                                    onClick={() => {
                                                        onUnitChange(product.id, u)
                                                        setPadProduct(product)
                                                        setPadUnit(u)
                                                    }}
                                                    className={`w-full text-center text-[11px] font-bold px-1.5 h-6 rounded-md border transition whitespace-nowrap flex items-center justify-center ${
                                                        isPadActive
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                            : isSelected
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                                                            : 'bg-stone-50 dark:bg-zinc-800/70 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-zinc-700 hover:border-indigo-300'
                                                    }`}
                                                    title={`Bấm để chọn nhập theo ${u}`}
                                                >
                                                    <span>{u}</span>
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Cột 4: ĐÃ NHẬP */}
                                    <div className="flex flex-col gap-1 justify-center text-center">
                                        {displayUnits.map(u => {
                                            const uStats = getProductCount(product.name, u)
                                            return (
                                                <div key={u} className="h-6 flex items-center justify-center">
                                                    <span className={`text-sm font-black tabular-nums ${
                                                        uStats.inQty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-300 dark:text-zinc-700 font-semibold text-xs'
                                                    }`}>
                                                        {uStats.inQty > 0 ? `+${uStats.inQty}` : '0'}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Cột 5: ĐÃ XUẤT */}
                                    <div className="flex flex-col gap-1 justify-center text-center">
                                        {displayUnits.map(u => {
                                            const uStats = getProductCount(product.name, u)
                                            return (
                                                <div key={u} className="h-6 flex items-center justify-center">
                                                    <span className={`text-sm font-black tabular-nums ${
                                                        uStats.outQty > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-300 dark:text-zinc-700 font-semibold text-xs'
                                                    }`}>
                                                        {uStats.outQty > 0 ? `-${uStats.outQty}` : '0'}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Cột 6: SỐ ĐỢT */}
                                    <span className="text-center text-[11px] text-stone-400 tabular-nums">{batchCount}</span>

                                    {/* Cột 7: BỎ GHIM */}
                                    <div className="flex items-center justify-center">
                                        <button
                                            type="button"
                                            onClick={e => {
                                                e.stopPropagation()
                                                if (confirm(`Bỏ ghim "${product.name}" khỏi công việc này?`)) onUnpinProduct(product.id)
                                            }}
                                            title="Bỏ ghim"
                                            className="w-6 h-6 rounded-md flex items-center justify-center text-stone-300 opacity-0 group-hover:opacity-100 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                        >
                                            <PinOff className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </>
    )
}
