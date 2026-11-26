'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, Package, Check } from 'lucide-react'
import { calculateSearchScore, matchSearch } from '@/lib/searchUtils'
import { ProductLite } from './types'

interface PlanProductAutocompleteProps {
    products: ProductLite[]
    selectedProductId: string | null | undefined
    onSelect: (product: ProductLite | null) => void
    placeholder?: string
    allowCustomFreeText?: boolean
    customTextValue?: string
    onCustomTextChange?: (text: string) => void
    disabled?: boolean
    className?: string
}

/**
 * Ô tìm kiếm & chọn sản phẩm hỗ trợ đầy đủ quy tắc bắt buộc:
 * - Khớp không dấu, đa từ khóa qua aliases (tên gõ tắt), internal_code, internal_name, sku, name
 * - Hiển thị gợi ý trực tiếp ngay bên dưới ô tìm kiếm kèm badge tên gõ tắt (⚡), tên đầy đủ và mã SKU
 */
export function PlanProductAutocomplete({
    products,
    selectedProductId,
    onSelect,
    placeholder = 'Gõ tên viết tắt, mã SKU hoặc tên sản phẩm...',
    allowCustomFreeText = false,
    customTextValue = '',
    onCustomTextChange,
    disabled = false,
    className = ''
}: PlanProductAutocompleteProps) {
    const selectedProduct = useMemo(
        () => products.find(p => p.id === selectedProductId) || null,
        [products, selectedProductId]
    )

    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const [highlightIdx, setHighlightIdx] = useState(0)
    const wrapRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (selectedProduct) {
            setQuery(selectedProduct.name)
        } else if (allowCustomFreeText) {
            setQuery(customTextValue || '')
        } else {
            setQuery('')
        }
    }, [selectedProduct, allowCustomFreeText, customTextValue])

    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false)
                // Khôi phục text hiển thị nếu không cho phép nhập tự do
                if (!allowCustomFreeText) {
                    setQuery(selectedProduct ? selectedProduct.name : '')
                }
            }
        }
        document.addEventListener('mousedown', handleOutside)
        return () => document.removeEventListener('mousedown', handleOutside)
    }, [selectedProduct, allowCustomFreeText])

    const suggestions = useMemo(() => {
        const term = query.trim()
        if (!term) {
            return products.slice(0, 12).map(p => {
                const firstAlias = p.aliases
                    ? String(p.aliases)
                          .split(/[,;\n]/)
                          .map(s => s.trim())
                          .filter(Boolean)[0]
                    : undefined
                return { product: p, score: 1, matchedAlias: firstAlias }
            })
        }

        const matched: Array<{ product: ProductLite; score: number; matchedAlias?: string }> = []
        for (const p of products) {
            if (!matchSearch(p, term)) continue
            const score = calculateSearchScore(p, term)
            if (score <= 0) continue

            let matchedAlias: string | undefined
            if (p.aliases) {
                const aliasList = String(p.aliases)
                    .split(/[,;\n]/)
                    .map(s => s.trim())
                    .filter(Boolean)
                matchedAlias = aliasList.find(a => matchSearch(a, term)) || aliasList[0]
            }

            matched.push({ product: p, score, matchedAlias })
        }

        return matched.sort((a, b) => b.score - a.score).slice(0, 12)
    }, [products, query])

    const handlePick = (p: ProductLite) => {
        setQuery(p.name)
        onSelect(p)
        if (allowCustomFreeText && onCustomTextChange) {
            onCustomTextChange(p.name)
        }
        setOpen(false)
    }

    const handleClear = () => {
        setQuery('')
        onSelect(null)
        if (allowCustomFreeText && onCustomTextChange) {
            onCustomTextChange('')
        }
        setOpen(true)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            setOpen(true)
            return
        }
        if (!open) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlightIdx(prev => (prev < suggestions.length - 1 ? prev + 1 : 0))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightIdx(prev => (prev > 0 ? prev - 1 : Math.max(0, suggestions.length - 1)))
        } else if (e.key === 'Enter') {
            if (suggestions[highlightIdx]) {
                e.preventDefault()
                handlePick(suggestions[highlightIdx].product)
            }
        } else if (e.key === 'Escape') {
            setOpen(false)
        }
    }

    return (
        <div ref={wrapRef} className={`relative ${className}`}>
            <div className="relative flex items-center">
                <Search size={15} className="absolute left-3 text-stone-400 pointer-events-none" />
                <input
                    type="text"
                    disabled={disabled}
                    value={query}
                    placeholder={placeholder}
                    onFocus={() => {
                        setOpen(true)
                        setHighlightIdx(0)
                    }}
                    onChange={e => {
                        const val = e.target.value
                        setQuery(val)
                        setOpen(true)
                        setHighlightIdx(0)
                        if (allowCustomFreeText && onCustomTextChange) {
                            onCustomTextChange(val)
                        }
                        if (!val.trim() && selectedProductId) {
                            onSelect(null)
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    className="w-full pl-9 pr-8 py-2 text-xs font-medium rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 disabled:opacity-60 transition-all"
                />
                {(query || selectedProductId) && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2.5 p-0.5 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200"
                        title="Xóa lựa chọn"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {selectedProduct && !open && (
                <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[10px] text-stone-500 dark:text-zinc-400">
                    <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300">
                        SKU: {selectedProduct.sku}
                    </span>
                    {selectedProduct.aliases && (
                        <span className="font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                            ⚡ {String(selectedProduct.aliases).split(/[,;\n]/)[0]?.trim()}
                        </span>
                    )}
                    {selectedProduct.internal_code && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold">
                            NB: {selectedProduct.internal_code}
                        </span>
                    )}
                </div>
            )}

            {open && !disabled && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800">
                    {suggestions.length === 0 ? (
                        <div className="p-3 text-center text-xs text-stone-400">
                            {allowCustomFreeText
                                ? `Sử dụng tên tự nhập: "${query}"`
                                : 'Không tìm thấy sản phẩm phù hợp (hỗ trợ tên gõ tắt, SKU, mã nội bộ)'}
                        </div>
                    ) : (
                        suggestions.map((item, idx) => {
                            const p = item.product
                            const isSelected = p.id === selectedProductId
                            const isActive = idx === highlightIdx
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onMouseEnter={() => setHighlightIdx(idx)}
                                    onClick={() => handlePick(p)}
                                    className={`w-full text-left px-3 py-2.5 flex items-start justify-between gap-2 transition-colors cursor-pointer ${
                                        isActive
                                            ? 'bg-orange-50/90 dark:bg-orange-950/40'
                                            : 'hover:bg-stone-50 dark:hover:bg-zinc-800/60'
                                    }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {item.matchedAlias && (
                                                <span className="px-1.5 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300 text-[10px] font-black">
                                                    ⚡ {item.matchedAlias}
                                                </span>
                                            )}
                                            <span className="text-xs font-bold text-stone-800 dark:text-zinc-100 truncate">
                                                {p.name}
                                            </span>
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-stone-500 dark:text-zinc-400 flex-wrap">
                                            <span className="font-mono font-semibold">SKU: {p.sku}</span>
                                            {p.internal_code && <span>• Mã NB: {p.internal_code}</span>}
                                            {p.unit && <span>• ĐVT gốc: {p.unit}</span>}
                                            {p.weight_kg ? <span>• {p.weight_kg} kg/{p.unit || 'đvt'}</span> : null}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                        {isSelected ? (
                                            <Check size={15} className="text-emerald-600" />
                                        ) : (
                                            <Package size={14} className="text-stone-300" />
                                        )}
                                    </div>
                                </button>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    )
}
