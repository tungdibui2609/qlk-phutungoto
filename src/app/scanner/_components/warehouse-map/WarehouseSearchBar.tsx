'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { MapPin, Search, Calendar, X, ArrowRight, Sparkles, Filter } from 'lucide-react'
import type { DateFilterType, UniqueProductItem } from './types'
import { DATE_FILTER_OPTIONS } from './types'
import { normalizeSearchString } from '@/lib/searchUtils'

export const WarehouseSearchBar = React.memo(function WarehouseSearchBar({
  uniqueProducts,
  searchQuery,
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
  searchQuery: string
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
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync with outside reset (e.g. when user clicks "Xóa tìm kiếm")
  useEffect(() => {
    setInputValue(searchQuery)
  }, [searchQuery])

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Fast pre-indexed suggestions (takes < 0.01ms, never lags typing)
  const suggestions = useMemo(() => {
    const q = inputValue.trim()
    if (!q || q.length < 1) return []

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

      // 3. SKU check
      if (!matched && (prod.normSku || prod.unaccSku)) {
        if (prod.normSku === normQ || prod.unaccSku === unaccQ) {
          matched = true
          score = 1000
        } else if (prod.normSku.includes(normQ) || prod.unaccSku.includes(unaccQ)) {
          matched = true
          score = 500
        }
      }

      if (matched) {
        list.push({ product: prod, score, matchedAlias })
      }
    }

    return list.sort((a, b) => b.score - a.score).slice(0, 8)
  }, [inputValue, uniqueProducts])

  const handleSelect = (name: string) => {
    setInputValue(name)
    setShowSuggestions(false)
    onExecuteSearch(name)
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
        <div className="relative flex-1 flex items-center">
          <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={inputValue}
            onChange={e => {
              setInputValue(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => {
              if (inputValue.trim().length > 0) setShowSuggestions(true)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSubmit()
              } else if (e.key === 'Escape') {
                setShowSuggestions(false)
              }
            }}
            placeholder="Nhập tên sản phẩm (đô, ri6...), mã LOT, vị trí..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 transition"
          />
          {inputValue && (
            <button
              type="button"
              onClick={() => {
                setInputValue('')
                setShowSuggestions(false)
                onClearSearch()
              }}
              className="absolute right-2.5 p-1 text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
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
              <select
                value={filterDateType}
                onChange={e => onFilterDateTypeChange(e.target.value as DateFilterType)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-amber-300 outline-none cursor-pointer"
              >
                {DATE_FILTER_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
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
            <select
              value={filterRegion}
              onChange={e => onFilterRegionChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-emerald-300 outline-none cursor-pointer"
            >
              <option value="all">Tất cả vùng miền</option>
              {availableRegions.map(r => (
                <option key={r.name} value={r.name}>
                  {r.name} ({r.count} ô / pallet)
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── DROPDOWN GỢI Ý SẢN PHẨM (POPUP GỢI Ý KHI GÕ TỪ KHÓA) ── */}
      {showSuggestions && inputValue.trim().length > 0 && (
        <div className="absolute top-full left-2.5 right-2.5 mt-1 bg-[#0b1324] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150 backdrop-blur-md">
          <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-[11px] font-bold text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              <span>GỢI Ý SẢN PHẨM ({suggestions.length})</span>
            </span>
            <span className="text-[10px] font-normal text-slate-400">
              Chạm để chọn & xem tất cả vị trí
            </span>
          </div>

          {suggestions.length > 0 ? (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
              {suggestions.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelect(item.product.name)}
                  className="p-3 hover:bg-cyan-950/40 cursor-pointer transition flex items-center justify-between gap-3 active:bg-cyan-900/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
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
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                      {item.product.sku && (
                        <span className="text-slate-500 font-mono">SKU: {item.product.sku}</span>
                      )}
                      <span className="text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                        📍 {item.product.positionCount} vị trí trong kho
                      </span>
                    </p>
                  </div>
                  <ArrowRight size={15} className="text-cyan-400 shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 text-center text-xs text-slate-400">
              Không có sản phẩm nào khớp tên hoặc từ gõ tắt.
            </div>
          )}

          {/* Direct query search option */}
          <div
            onClick={() => handleSubmit()}
            className="p-2.5 bg-slate-900/90 border-t border-slate-800 hover:bg-slate-800/90 cursor-pointer transition flex items-center justify-between text-xs text-slate-300 font-medium"
          >
            <div className="flex items-center gap-2">
              <Search size={13} className="text-cyan-400" />
              <span>Tìm tất cả cho "{inputValue.trim()}" (STT, mã vị trí, mã lot...)</span>
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
