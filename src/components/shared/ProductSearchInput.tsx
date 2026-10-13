'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, Lightbulb, CornerDownLeft, Loader2 } from 'lucide-react'
import { calculateSearchScore, matchSearch } from '@/lib/searchUtils'

export interface ProductSearchInputProps {
    value: string
    onChange: (value: string) => void
    onSearch?: (value: string) => void
    products?: any[]
    searchMode?: 'all' | 'name' | 'code' | string
    placeholder?: string
    className?: string
    inputClassName?: string
    iconSize?: number
    theme?: 'orange' | 'indigo' | 'emerald' | 'blue'
    showSearchButton?: boolean
    autoFocus?: boolean
    disabled?: boolean
    id?: string
}

export function ProductSearchInput({
    value,
    onChange,
    onSearch,
    products = [],
    searchMode = 'all',
    placeholder = 'Tìm kiếm sản phẩm (hỗ trợ tên viết tắt)...',
    className = '',
    inputClassName = '',
    iconSize = 16,
    theme = 'orange',
    showSearchButton = false,
    autoFocus = false,
    disabled = false,
    id
}: ProductSearchInputProps) {
    const [localValue, setLocalValue] = useState(value)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Sync local state when external value changes
    useEffect(() => {
        setLocalValue(value)
    }, [value])

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Calculate smart suggestions
    const suggestions = useMemo(() => {
        const term = localValue.trim()
        if (!term || !products || products.length === 0) return []

        // If searchMode is something specific like position/tag/category and not all/name/code, don't show product suggestions
        if (searchMode !== 'all' && searchMode !== 'name' && searchMode !== 'code') {
            return []
        }

        const list: Array<{
            product: any
            score: number
            fillValue: string
            displayTitle: string
            displaySubtitle?: string
            badgeType?: 'alias' | 'sku' | 'internal_code'
            badgeText?: string
        }> = []

        if (searchMode === 'code') {
            for (const p of products) {
                const skuMatch = p.sku && matchSearch(p.sku, term)
                const codeMatch = p.internal_code && matchSearch(p.internal_code, term)

                if (skuMatch || codeMatch) {
                    let fillValue = ''
                    let badgeType: 'sku' | 'internal_code' = 'sku'
                    let badgeText = ''

                    if (codeMatch && (!skuMatch || matchSearch(p.internal_code, term))) {
                        fillValue = p.internal_code
                        badgeType = 'internal_code'
                        badgeText = 'Mã NB'
                    } else if (skuMatch) {
                        fillValue = p.sku
                        badgeType = 'sku'
                        badgeText = 'SKU'
                    }

                    let score = 1000
                    if (p.sku && p.sku.toLowerCase() === term.toLowerCase()) score += 2000
                    if (p.internal_code && p.internal_code.toLowerCase() === term.toLowerCase()) score += 2000

                    list.push({
                        product: p,
                        score,
                        fillValue,
                        displayTitle: fillValue,
                        displaySubtitle: p.name,
                        badgeType,
                        badgeText
                    })
                }
            }
        } else if (searchMode === 'name') {
            for (const p of products) {
                const nameObj = {
                    name: p.name,
                    internal_name: p.internal_name,
                    aliases: p.aliases || p.short_name
                }
                const score = calculateSearchScore(nameObj, term)

                if (score > 0) {
                    let badgeText: string | undefined
                    const rawAliases = p.aliases || p.short_name
                    if (rawAliases) {
                        const aliasItems = String(rawAliases).split(/[,;]/).map((a: string) => a.trim()).filter(Boolean)
                        const found = aliasItems.find((a: string) => matchSearch(a, term))
                        if (found) badgeText = `⚡ ${found}`
                    }

                    list.push({
                        product: p,
                        score,
                        fillValue: p.name,
                        displayTitle: p.name,
                        displaySubtitle: p.sku ? `SKU: ${p.sku}${p.internal_code ? ` | NB: ${p.internal_code}` : ''}` : undefined,
                        badgeType: badgeText ? 'alias' : undefined,
                        badgeText
                    })
                }
            }
        } else {
            // searchMode === 'all'
            for (const p of products) {
                const score = calculateSearchScore(p, term)

                if (score > 0) {
                    let badgeText: string | undefined
                    let badgeType: 'alias' | 'sku' | 'internal_code' | undefined
                    let fillValue = p.name

                    const rawAliases = p.aliases || p.short_name
                    if (rawAliases) {
                        const aliasItems = String(rawAliases).split(/[,;]/).map((a: string) => a.trim()).filter(Boolean)
                        const found = aliasItems.find((a: string) => matchSearch(a, term))
                        if (found) {
                            badgeType = 'alias'
                            badgeText = `⚡ ${found}`
                            fillValue = p.name
                        }
                    }

                    if (!badgeType) {
                        if (p.internal_code && matchSearch(p.internal_code, term)) {
                            badgeType = 'internal_code'
                            badgeText = `NB: ${p.internal_code}`
                            fillValue = p.internal_code
                        } else if (p.sku && matchSearch(p.sku, term)) {
                            badgeType = 'sku'
                            badgeText = `SKU: ${p.sku}`
                            fillValue = p.sku
                        }
                    }

                    list.push({
                        product: p,
                        score,
                        fillValue,
                        displayTitle: p.name,
                        displaySubtitle: p.sku ? `SKU: ${p.sku}${p.internal_code ? ` | NB: ${p.internal_code}` : ''}` : undefined,
                        badgeType,
                        badgeText
                    })
                }
            }
        }

        return list
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
    }, [localValue, products, searchMode])

    const handleApplySearch = (termToSearch?: string) => {
        const target = termToSearch !== undefined ? termToSearch : localValue
        onChange(target)
        if (onSearch) {
            onSearch(target)
        }
        setShowSuggestions(false)
    }

    const handleSelectSuggestion = (item: typeof suggestions[0]) => {
        const targetValue = item.fillValue
        setLocalValue(targetValue)
        handleApplySearch(targetValue)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0))
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1))
                return
            }
            if (e.key === 'Enter') {
                e.preventDefault()
                if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                    handleSelectSuggestion(suggestions[highlightedIndex])
                    return
                }
            }
            if (e.key === 'Escape') {
                e.preventDefault()
                setShowSuggestions(false)
                return
            }
        }

        if (e.key === 'Enter') {
            handleApplySearch()
        }
    }

    // Theme style mapping
    const themeStyles = {
        orange: {
            focusRing: 'focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20',
            highlightBg: 'bg-orange-50/80 dark:bg-orange-950/40 text-orange-900 dark:text-orange-100',
            headerText: 'text-orange-600 dark:text-orange-400',
            aliasBadge: 'bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300',
            btnBg: 'bg-orange-600 hover:bg-orange-700 text-white',
            arrowIcon: 'text-orange-600 dark:text-orange-400',
            accentText: 'text-orange-500'
        },
        indigo: {
            focusRing: 'focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20',
            highlightBg: 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100',
            headerText: 'text-indigo-600 dark:text-indigo-400',
            aliasBadge: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300',
            btnBg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
            arrowIcon: 'text-indigo-600 dark:text-indigo-400',
            accentText: 'text-indigo-500'
        },
        emerald: {
            focusRing: 'focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20',
            highlightBg: 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100',
            headerText: 'text-emerald-600 dark:text-emerald-400',
            aliasBadge: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
            btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
            arrowIcon: 'text-emerald-600 dark:text-emerald-400',
            accentText: 'text-emerald-500'
        },
        blue: {
            focusRing: 'focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20',
            highlightBg: 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100',
            headerText: 'text-blue-600 dark:text-blue-400',
            aliasBadge: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300',
            btnBg: 'bg-blue-600 hover:bg-blue-700 text-white',
            arrowIcon: 'text-blue-600 dark:text-blue-400',
            accentText: 'text-blue-500'
        }
    }[theme]

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div className={`relative flex items-center transition-all ${themeStyles.focusRing}`}>
                <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
                    size={iconSize}
                />
                <input
                    ref={inputRef}
                    id={id}
                    type="text"
                    disabled={disabled}
                    autoFocus={autoFocus}
                    placeholder={placeholder}
                    value={localValue}
                    onChange={(e) => {
                        const val = e.target.value
                        setLocalValue(val)
                        onChange(val)
                        setShowSuggestions(true)
                        setHighlightedIndex(-1)
                    }}
                    onFocus={() => {
                        if (localValue.trim().length > 0) {
                            setShowSuggestions(true)
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    className={`w-full pl-9 pr-14 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-800/50 text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-none transition-all ${inputClassName}`}
                />

                <div className="absolute right-1.5 flex items-center gap-1">
                    {localValue && (
                        <button
                            type="button"
                            onClick={() => {
                                setLocalValue('')
                                onChange('')
                                if (onSearch) onSearch('')
                                setShowSuggestions(false)
                                inputRef.current?.focus()
                            }}
                            className="text-stone-400 hover:text-red-500 transition-colors rounded-full p-1"
                            title="Xóa tìm kiếm"
                        >
                            <X size={14} />
                        </button>
                    )}

                    {showSearchButton && (
                        <button
                            type="button"
                            onClick={() => handleApplySearch()}
                            className={`${themeStyles.btnBg} text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all shadow-sm active:scale-95 flex items-center gap-1`}
                        >
                            <Search size={12} />
                            Tìm
                        </button>
                    )}
                </div>
            </div>

            {/* Autocomplete Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-2 bg-stone-50 dark:bg-slate-800/70 border-b border-stone-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-stone-500 dark:text-slate-400">
                        <span className={`flex items-center gap-1.5 ${themeStyles.headerText}`}>
                            <Lightbulb size={13} />
                            {searchMode === 'code' ? 'Gợi ý mã sản phẩm' : 'Gợi ý sản phẩm'} ({suggestions.length})
                        </span>
                        <span className="text-[10px] font-normal text-stone-400">
                            Dùng ↑↓ để chọn, Enter để tìm
                        </span>
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-stone-100 dark:divide-slate-800/60 [scrollbar-width:thin]">
                        {suggestions.map((item, idx) => {
                            const isHighlighted = idx === highlightedIndex
                            const p = item.product

                            return (
                                <div
                                    key={p.id || idx}
                                    onClick={() => handleSelectSuggestion(item)}
                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                    className={`px-3 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                                        isHighlighted
                                            ? themeStyles.highlightBg
                                            : 'hover:bg-stone-50 dark:hover:bg-slate-800/50 text-stone-800 dark:text-stone-200'
                                    }`}
                                >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-semibold text-xs leading-snug break-words">
                                                    {item.displayTitle}
                                                </span>
                                                {item.badgeText ? (
                                                    <span
                                                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wide shrink-0 ${
                                                            item.badgeType === 'alias'
                                                                ? themeStyles.aliasBadge
                                                                : 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                                                        }`}
                                                    >
                                                        {item.badgeText}
                                                    </span>
                                                ) : null}
                                            </div>

                                            {item.displaySubtitle && (
                                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-stone-500 dark:text-stone-400 flex-wrap">
                                                    <span>{item.displaySubtitle}</span>
                                                </div>
                                            )}
                                        </div>

                                    <CornerDownLeft
                                        size={13}
                                        className={`shrink-0 transition-opacity ${
                                            isHighlighted ? `opacity-100 ${themeStyles.arrowIcon}` : 'opacity-0'
                                        }`}
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
