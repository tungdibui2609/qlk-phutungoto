'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  MapPin,
  Search,
  Calendar,
  X,
  ArrowRight,
  Filter,
  Layers,
  Package,
  Hash,
  Tag,
  ChevronDown,
  Check,
} from 'lucide-react'
import type {
  DateFilterType,
  UniqueProductItem,
  UniqueSttItem,
  UniqueTagItem,
  WarehouseSearchMode,
} from './types'
import { DATE_FILTER_OPTIONS, WAREHOUSE_SEARCH_MODES } from './types'
import { formatUnitsSummary } from './mapHelpers'
import { normalizeSearchString, matchPalletSearch } from '@/lib/searchUtils'

export const WarehouseSearchBar = React.memo(function WarehouseSearchBar({
  uniqueProducts,
  uniqueStts = [],
  uniqueTags = [],
  searchQuery,
  searchMode = 'all',
  onSearchModeChange,
  onExecuteSearch,
  onClearSearch,
  filterDateType,
  onFilterDateTypeChange,
  filterStartDate,
  onFilterStartDateChange,
  filterEndDate,
  onFilterEndDateChange,
  filterRegion,
  onFilterRegionChange,
  availableRegions,
  hasActiveFilters,
  onSetDatePreset,
  onResetFilters,
  isFilterOpen,
  onToggleFilterOpen
}: {
  uniqueProducts: UniqueProductItem[]
  uniqueStts?: UniqueSttItem[]
  uniqueTags?: UniqueTagItem[]
  searchQuery: string
  searchMode?: WarehouseSearchMode
  onSearchModeChange?: (mode: WarehouseSearchMode) => void
  onExecuteSearch: (query: string) => void
  onClearSearch: () => void
  filterDateType: DateFilterType
  onFilterDateTypeChange: (type: DateFilterType) => void
  filterStartDate: string
  onFilterStartDateChange: (date: string) => void
  filterEndDate: string
  onFilterEndDateChange: (date: string) => void
  filterRegion: string
  onFilterRegionChange: (region: string) => void
  availableRegions: Array<{ name: string; count: number }>
  hasActiveFilters: boolean
  onSetDatePreset: (preset: 'today' | 3 | 7 | 'this_month' | 'clear') => void
  onResetFilters: () => void
  isFilterOpen: boolean
  onToggleFilterOpen: () => void
}) {
  const [inputValue, setInputValue] = useState(searchQuery)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showModeMenu, setShowModeMenu] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeModeConfig =
    WAREHOUSE_SEARCH_MODES.find(m => m.id === searchMode) || WAREHOUSE_SEARCH_MODES[0]

  // Sync with outside reset (e.g. when user clicks "Xóa tìm kiếm")
  useEffect(() => {
    setInputValue(searchQuery)
  }, [searchQuery])

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        setShowModeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Fast pre-indexed STT suggestions (VD: gõ "25", "G55", "#25"...)
  const sttSuggestions = useMemo(() => {
    if (searchMode !== 'all' && searchMode !== 'stt') return []
    const raw = inputValue.trim()
    if (!raw) return []
    const qClean = raw.replace(/^(#|stt[:\s-#]*)/i, '').trim()
    if (!qClean) return []
    const normQ = normalizeSearchString(qClean, true)
    if (!normQ) return []

    const list: Array<{ item: UniqueSttItem; score: number }> = []
    for (let i = 0; i < uniqueStts.length; i++) {
      const s = uniqueStts[i]
      if (s.normStt === normQ) {
        list.push({ item: s, score: 5000 })
      } else if (s.normStt.startsWith(normQ)) {
        list.push({ item: s, score: 3500 - s.normStt.length })
      } else if (s.normStt.includes(normQ)) {
        list.push({ item: s, score: 2500 - s.normStt.length })
      }
    }

    return list.sort((a, b) => b.score - a.score).slice(0, 6)
  }, [inputValue, uniqueStts, searchMode])

  // Fast pre-indexed Tag (Mã phụ) suggestions
  const tagSuggestions = useMemo(() => {
    if (searchMode !== 'all' && searchMode !== 'tag') return []
    const raw = inputValue.trim()
    if (!raw || raw.startsWith('#')) return []
    const normQ = normalizeSearchString(raw)
    const unaccQ = normalizeSearchString(raw, true)
    if (!normQ && !unaccQ) return []

    const list: Array<{ item: UniqueTagItem; score: number }> = []
    for (let i = 0; i < uniqueTags.length; i++) {
      const t = uniqueTags[i]
      if (t.normTag === normQ || t.unaccTag === unaccQ) {
        list.push({ item: t, score: 4500 })
      } else if (t.normTag.startsWith(normQ) || t.unaccTag.startsWith(unaccQ)) {
        list.push({ item: t, score: 3200 - t.normTag.length })
      } else if (t.normTag.includes(normQ) || t.unaccTag.includes(unaccQ)) {
        list.push({ item: t, score: 2200 - t.normTag.length })
      }
    }

    return list.sort((a, b) => b.score - a.score).slice(0, searchMode === 'tag' ? 8 : 4)
  }, [inputValue, uniqueTags, searchMode])

  // Fast pre-indexed product suggestions (takes < 0.01ms, never lags typing)
  const suggestions = useMemo(() => {
    if (searchMode !== 'all' && searchMode !== 'name' && searchMode !== 'code') return []
    const q = inputValue.trim()
    if (!q || q.length < 1 || q.startsWith('#')) return []

    const normQ = normalizeSearchString(q)
    const unaccQ = normalizeSearchString(q, true)
    if (!normQ && !unaccQ) return []

    const list: Array<{
      product: UniqueProductItem
      score: number
      matchedAlias?: string
    }> = []

    for (let i = 0; i < uniqueProducts.length; i++) {
      const prod = uniqueProducts[i]
      let matched = false
      let score = 0
      let matchedAlias: string | undefined

      if (searchMode === 'code') {
        if (prod.normSku || prod.unaccSku) {
          if (prod.normSku === normQ || prod.unaccSku === unaccQ) {
            matched = true
            score = 3000
          } else if (prod.normSku.startsWith(normQ) || prod.unaccSku.startsWith(unaccQ)) {
            matched = true
            score = 2000
          } else if (prod.normSku.includes(normQ) || prod.unaccSku.includes(unaccQ)) {
            matched = true
            score = 1000
          }
        }
        if (matched) {
          list.push({ product: prod, score })
        }
        continue
      }

      // Chế độ 'all' (Tổng hợp) và 'name' (Theo Tên): Hỗ trợ đầy đủ Tên viết tắt (aliases)
      // 1. Alias check (tên viết tắt / gõ tắt: VD "đô c" -> "đô c có hạt")
      for (let j = 0; j < prod.aliasList.length; j++) {
        const al = prod.aliasList[j]
        if (al.norm === normQ || al.unacc === unaccQ) {
          matched = true
          score = 3000
          matchedAlias = al.raw
          break
        } else if (al.norm.startsWith(normQ) || al.unacc.startsWith(unaccQ)) {
          matched = true
          score = 2200
          matchedAlias = al.raw
          break
        } else if (al.norm.includes(normQ) || al.unacc.includes(unaccQ)) {
          matched = true
          score = 1500
          matchedAlias = al.raw
          break
        }
      }

      // 2. Name check
      if (!matched) {
        if (prod.normName === normQ || prod.unaccName === unaccQ) {
          matched = true
          score = 2000
        } else if (prod.normName.startsWith(normQ) || prod.unaccName.startsWith(unaccQ)) {
          matched = true
          score = 1200
        } else if (prod.normName.includes(normQ) || prod.unaccName.includes(unaccQ)) {
          matched = true
          score = 800
        }
      }

      // 3. SKU check (chỉ trong chế độ 'all')
      if (!matched && searchMode === 'all' && (prod.normSku || prod.unaccSku)) {
        if (prod.normSku === normQ || prod.unaccSku === unaccQ) {
          matched = true
          score = 1000
        } else if (prod.normSku.includes(normQ) || prod.unaccSku.includes(unaccQ)) {
          matched = true
          score = 500
        }
      }

      // 4. Smart multi-keyword / acronym alias check (VD: gõ "srmc", "do c", "mt a"...)
      if (!matched) {
        const isSmartMatch = matchPalletSearch(
          {
            product_name: prod.name,
            aliases: prod.aliases,
            sku: searchMode === 'all' ? prod.sku : '',
          },
          q
        )
        if (isSmartMatch) {
          matched = true
          score = 650
          if (prod.aliasList.length > 0) {
            matchedAlias = prod.aliasList[0].raw
          }
        }
      }

      if (matched) {
        list.push({ product: prod, score, matchedAlias })
      }
    }

    return list.sort((a, b) => b.score - a.score).slice(0, 8)
  }, [inputValue, uniqueProducts, searchMode])

  const totalSuggestionCount =
    sttSuggestions.length + tagSuggestions.length + suggestions.length

  const handleSelect = (prod: UniqueProductItem) => {
    const val =
      searchMode === 'code' && prod.sku && prod.sku !== '---' ? prod.sku : prod.name
    setInputValue(val)
    setShowSuggestions(false)
    onExecuteSearch(val)
  }

  const handleSelectStt = (stt: string) => {
    const query = searchMode === 'stt' ? stt : `#${stt}`
    setInputValue(query)
    setShowSuggestions(false)
    onExecuteSearch(query)
  }

  const handleSelectTag = (tag: string) => {
    setInputValue(tag)
    setShowSuggestions(false)
    onExecuteSearch(tag)
  }

  const handleSelectMode = (mode: WarehouseSearchMode) => {
    setShowModeMenu(false)
    onSearchModeChange?.(mode)
    if (inputValue.trim()) {
      onExecuteSearch(inputValue.trim())
    }
  }

  const renderModeIcon = (mode: WarehouseSearchMode, size = 13) => {
    if (mode === 'name') return <Package size={size} className="text-emerald-400 shrink-0" />
    if (mode === 'code') return <Hash size={size} className="text-purple-400 shrink-0" />
    if (mode === 'tag') return <Tag size={size} className="text-amber-400 shrink-0" />
    if (mode === 'stt') return <Hash size={size} className="text-rose-400 shrink-0" />
    return <Layers size={size} className="text-cyan-400 shrink-0" />
  }

  const handleSubmit = (customTerm?: string) => {
    const term = (customTerm !== undefined ? customTerm : inputValue).trim()
    if (!term && !hasActiveFilters) return
    setShowSuggestions(false)
    onExecuteSearch(term)
  }

  return (
    <div ref={containerRef} className="p-2.5 bg-[#0e1626] border-b border-slate-800/80 shrink-0 relative z-30">
      <div className="relative flex items-center gap-1.5">
        <div className="relative flex-1 flex items-center bg-slate-900 border border-slate-700 rounded-xl focus-within:border-cyan-500 transition p-0.5 min-w-0">
          {/* Nút Chọn Chế Độ Tìm Kiếm (Chuẩn Server - Hình 1) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowModeMenu(prev => !prev)
                setShowSuggestions(false)
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-bold text-slate-100 transition active:scale-95 cursor-pointer"
              title="Chọn chế độ tìm kiếm"
            >
              {renderModeIcon(searchMode, 13)}
              <span className="whitespace-nowrap">{activeModeConfig.shortLabel}</span>
              <ChevronDown
                size={12}
                className={`text-slate-400 transition-transform ${showModeMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showModeMenu && (
              <div className="absolute top-full left-0 mt-1.5 w-48 bg-[#0b1324] border border-cyan-500/40 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-2.5 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Chế độ tìm kiếm
                </div>
                <div className="divide-y divide-slate-800/60">
                  {WAREHOUSE_SEARCH_MODES.map(mode => {
                    const isSelected = mode.id === searchMode
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => handleSelectMode(mode.id)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs transition cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-300 font-black'
                            : 'text-slate-200 hover:bg-slate-800/80 font-semibold'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {renderModeIcon(mode.id, 14)}
                          <div className="min-w-0">
                            <div className="truncate">{mode.label}</div>
                            {mode.subHint && (
                              <div className="text-[9.5px] text-slate-400 font-normal truncate">
                                {mode.subHint}
                              </div>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check size={14} className="text-cyan-400 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Ô nhập từ khóa */}
          <div className="relative flex-1 flex items-center min-w-0">
            <Search size={14} className="ml-2 text-slate-400 pointer-events-none shrink-0" />
            <input
              type="text"
              value={inputValue}
              onChange={e => {
                setInputValue(e.target.value)
                setShowSuggestions(true)
                setShowModeMenu(false)
              }}
              onFocus={() => {
                setShowModeMenu(false)
                if (inputValue.trim().length > 0) setShowSuggestions(true)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                } else if (e.key === 'Escape') {
                  setShowSuggestions(false)
                  setShowModeMenu(false)
                }
              }}
              placeholder={activeModeConfig.placeholder}
              className="w-full pl-2 pr-7 py-1.5 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-hidden"
            />
            {inputValue && (
              <button
                type="button"
                onClick={() => {
                  setInputValue('')
                  setShowSuggestions(false)
                  onClearSearch()
                }}
                className="absolute right-1.5 p-1 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleSubmit()}
          className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-xs active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Search size={13} />
          <span>Tìm</span>
        </button>

        <button
          type="button"
          onClick={onToggleFilterOpen}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 relative active:scale-95 cursor-pointer ${hasActiveFilters
              ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/30'
              : isFilterOpen
                ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/30'
                : 'bg-slate-900 border border-amber-500/60 text-amber-300 hover:bg-slate-800 hover:text-amber-200'
            }`}
          title="Mở bộ lọc ngày tháng & vùng miền"
        >
          <Calendar size={14} className={hasActiveFilters || isFilterOpen ? 'text-slate-950' : 'text-amber-400'} />
          <span>Lọc ngày</span>
          {hasActiveFilters && (
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-slate-950 absolute -top-1 -right-1 animate-pulse" />
          )}
        </button>
      </div>

      {/* ── THANH CHIPS BỘ LỌC ĐANG HOẠT ĐỘNG (QUICK ACTIVE CHIPS) ── */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 scrollbar-none text-[11px]">
          <span className="text-slate-400 font-semibold text-[10px] shrink-0">Đang lọc:</span>
          {(filterStartDate || filterEndDate) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium shrink-0">
              <Calendar size={11} />
              <span>
                {DATE_FILTER_OPTIONS.find(o => o.id === filterDateType)?.shortLabel}:{' '}
                {filterStartDate ? filterStartDate.split('-').reverse().slice(0, 2).join('/') : '...'} →{' '}
                {filterEndDate ? filterEndDate.split('-').reverse().slice(0, 2).join('/') : '...'}
              </span>
              <button
                type="button"
                onClick={() => onSetDatePreset('clear')}
                className="hover:text-white ml-0.5"
                title="Xóa lọc ngày"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {filterRegion && filterRegion !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium shrink-0">
              <MapPin size={11} />
              <span>Vùng: {filterRegion}</span>
              <button
                type="button"
                onClick={() => onFilterRegionChange('all')}
                className="hover:text-white ml-0.5"
                title="Xóa lọc vùng"
              >
                <X size={11} />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={onResetFilters}
            className="text-[10px] text-slate-400 hover:text-rose-400 underline shrink-0 ml-auto"
          >
            Đặt lại
          </button>
        </div>
      )}

      {/* ── BỘ LỌC NÂNG CAO (DRAWER: NGÀY THÁNG, VÙNG MIỀN) ── */}
      {isFilterOpen && (
        <div className="mt-2.5 p-3 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl space-y-3 animate-in fade-in">
          {/* Header Drawer */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Filter size={13} className="text-cyan-400" />
              <span>BỘ LỌC NGÀY THÁNG & VÙNG MIỀN</span>
            </span>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="text-[10px] text-rose-400 hover:text-rose-300 underline font-medium active:scale-95 transition"
                >
                  Xóa bộ lọc
                </button>
              )}
              <button
                type="button"
                onClick={onToggleFilterOpen}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* 1. Mốc ngày & Khoảng ngày */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                <Calendar size={12} className="text-amber-400" />
                <span>Mốc ngày:</span>
              </span>
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {DATE_FILTER_OPTIONS.map(opt => {
                  const active = filterDateType === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onFilterDateTypeChange(opt.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap border transition ${
                        active
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {opt.icon} {opt.shortLabel}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Inputs: Từ ngày -> Đến ngày */}
            <div className="grid grid-cols-2 gap-2">
              <label
                onClick={e => {
                  const input = e.currentTarget.querySelector('input')
                  try { input?.showPicker?.() } catch { }
                }}
                className="bg-slate-950 border border-slate-800 hover:border-amber-500/60 rounded-xl px-2.5 py-1.5 cursor-pointer block transition group"
              >
                <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold mb-0.5">
                  <span className="uppercase tracking-wider">Từ ngày:</span>
                  <Calendar size={13} className="text-amber-400 group-hover:scale-110 transition shrink-0" />
                </div>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={e => onFilterStartDateChange(e.target.value)}
                  onClick={e => {
                    e.stopPropagation()
                    try { (e.currentTarget as any).showPicker?.() } catch { }
                  }}
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-transparent text-xs text-amber-200 font-mono font-bold outline-none cursor-pointer"
                />
              </label>

              <label
                onClick={e => {
                  const input = e.currentTarget.querySelector('input')
                  try { input?.showPicker?.() } catch { }
                }}
                className="bg-slate-950 border border-slate-800 hover:border-amber-500/60 rounded-xl px-2.5 py-1.5 cursor-pointer block transition group"
              >
                <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold mb-0.5">
                  <span className="uppercase tracking-wider">Đến ngày:</span>
                  <Calendar size={13} className="text-amber-400 group-hover:scale-110 transition shrink-0" />
                </div>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={e => onFilterEndDateChange(e.target.value)}
                  onClick={e => {
                    e.stopPropagation()
                    try { (e.currentTarget as any).showPicker?.() } catch { }
                  }}
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-transparent text-xs text-amber-200 font-mono font-bold outline-none cursor-pointer"
                />
              </label>
            </div>

            {/* Presets nhanh */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <button
                type="button"
                onClick={() => onSetDatePreset('today')}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition active:scale-95"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => onSetDatePreset(3)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition active:scale-95"
              >
                3 ngày
              </button>
              <button
                type="button"
                onClick={() => onSetDatePreset(7)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition active:scale-95"
              >
                7 ngày
              </button>
              <button
                type="button"
                onClick={() => onSetDatePreset('this_month')}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition active:scale-95"
              >
                Tháng này
              </button>
              {(filterStartDate || filterEndDate) && (
                <button
                  type="button"
                  onClick={() => onSetDatePreset('clear')}
                  className="px-2 py-1 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-[10px] font-semibold transition active:scale-95"
                >
                  ✕ Xóa ngày
                </button>
              )}
            </div>
          </div>

          {/* 2. Vùng miền / Vùng nguyên liệu */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <MapPin size={12} className="text-emerald-400" />
              <span>Vùng miền / Vùng nguyên liệu:</span>
            </span>

            {availableRegions.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => onFilterRegionChange('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition ${
                    filterRegion === 'all'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                      : 'bg-slate-950 text-slate-300 border-slate-800'
                  }`}
                >
                  Tất cả vùng miền
                </button>
                {availableRegions.map(r => (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() => onFilterRegionChange(r.name)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition ${
                      filterRegion === r.name
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    {r.name} ({r.count})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DROPDOWN GỢI Ý TÌM KIẾM (STT + MÃ PHỤ + SẢN PHẨM) ── */}
      {showSuggestions && inputValue.trim().length > 0 && (
        <div className="absolute top-full left-2.5 right-2.5 mt-1 bg-[#0b1324] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150 backdrop-blur-md">
          <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-[11px] font-bold text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Search size={13} className="text-cyan-400" />
              <span>
                {searchMode === 'name'
                  ? 'GỢI Ý TÊN & TÊN VIẾT TẮT'
                  : searchMode === 'code'
                  ? 'GỢI Ý MÃ SẢN PHẨM'
                  : searchMode === 'tag'
                  ? 'GỢI Ý MÃ PHỤ (TAG)'
                  : searchMode === 'stt'
                  ? 'GỢI Ý SỐ THỨ TỰ (STT)'
                  : 'GỢI Ý TÌM KIẾM'}{' '}
                ({totalSuggestionCount})
              </span>
            </span>
            <span className="text-[10px] font-normal text-slate-400">
              Chạm để chọn &amp; xem vị trí
            </span>
          </div>

          {totalSuggestionCount > 0 ? (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
              {/* 1. Gợi ý theo STT */}
              {sttSuggestions.map((sItem, sIdx) => {
                const s = sItem.item
                const posPreview =
                  s.positionCodes.length <= 3
                    ? s.positionCodes.join(', ')
                    : `${s.positionCodes.slice(0, 3).join(', ')} (+${s.positionCodes.length - 3})`

                return (
                  <div
                    key={`stt-${sIdx}`}
                    onClick={() => handleSelectStt(s.stt)}
                    className="p-3 hover:bg-cyan-950/40 cursor-pointer transition flex items-center justify-between gap-3 active:bg-cyan-900/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black font-mono">
                          STT #{s.stt}
                        </span>
                        <span className="font-bold text-xs text-white truncate">
                          {s.productName || 'Pallet hàng'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                          📍 {posPreview}
                        </span>
                        <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/40">
                          📦 {s.totalQuantity.toLocaleString('vi-VN')} th
                        </span>
                        {s.lotCode && (
                          <span className="text-slate-500 font-mono text-[10px]">
                            LOT: {s.lotCode}
                          </span>
                        )}
                      </p>
                    </div>
                    <ArrowRight size={15} className="text-amber-400 shrink-0" />
                  </div>
                )
              })}

              {/* 2. Gợi ý theo Mã phụ (Tag) */}
              {tagSuggestions.map((tItem, tIdx) => {
                const t = tItem.item
                return (
                  <div
                    key={`tag-${tIdx}`}
                    onClick={() => handleSelectTag(t.tag)}
                    className="p-3 hover:bg-cyan-950/40 cursor-pointer transition flex items-center justify-between gap-3 active:bg-cyan-900/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black font-mono">
                          🏷️ TAG: {t.tag}
                        </span>
                        {t.sampleProductName && (
                          <span className="text-[11px] text-slate-300 truncate">
                            {t.sampleProductName}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                          📍 {t.positionCount} vị trí
                        </span>
                        <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/40">
                          📦 {formatUnitsSummary(t.unitsMap, { short: true })}
                        </span>
                      </p>
                    </div>
                    <ArrowRight size={15} className="text-amber-400 shrink-0" />
                  </div>
                )
              })}

              {/* 3. Gợi ý theo Sản phẩm / Mã */}
              {suggestions.map((item, idx) => (
                <div
                  key={`prod-${idx}`}
                  onClick={() => handleSelect(item.product)}
                  className="p-3 hover:bg-cyan-950/40 cursor-pointer transition flex items-center justify-between gap-3 active:bg-cyan-900/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {searchMode === 'code' && item.product.sku && item.product.sku !== '---' ? (
                        <>
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-black font-mono">
                            SKU: {item.product.sku}
                          </span>
                          <span className="font-bold text-xs text-white">
                            {item.product.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-xs text-white">
                            {item.product.name}
                          </span>
                          {item.matchedAlias ? (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold">
                              ⚡ {item.matchedAlias}
                            </span>
                          ) : item.product.aliases ? (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
                              ⚡ {item.product.aliases}
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                      {item.product.sku && searchMode !== 'code' && (
                        <span className="text-slate-500 font-mono">SKU: {item.product.sku}</span>
                      )}
                      <span className="text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                        📍 {item.product.positionCount} vị trí
                      </span>
                      {item.product.unitsMap && (
                        <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/40">
                          📦 {formatUnitsSummary(item.product.unitsMap, { short: true })}
                        </span>
                      )}
                    </p>
                  </div>
                  <ArrowRight size={15} className="text-cyan-400 shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 text-center text-xs text-slate-400">
              Không có gợi ý nhanh cho &quot;{inputValue.trim()}&quot; trong chế độ{' '}
              <span className="text-cyan-300 font-bold">{activeModeConfig.label}</span>.
            </div>
          )}

          {/* Direct query search option */}
          <div
            onClick={() => handleSubmit()}
            className="p-2.5 bg-slate-900/90 border-t border-slate-800 hover:bg-slate-800/90 cursor-pointer transition flex items-center justify-between text-xs text-slate-300 font-medium"
          >
            <div className="flex items-center gap-2">
              <Search size={13} className="text-cyan-400" />
              <span>
                Tìm [{activeModeConfig.label}] cho &quot;{inputValue.trim()}&quot;
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono font-bold">
              Tìm ngay ↵
            </span>
          </div>
        </div>
      )}
    </div>
  )
})
