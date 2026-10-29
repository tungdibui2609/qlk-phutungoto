'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  MapPin,
  Search,
  RefreshCw,
  ChevronRight,
  Layers,
  Boxes,
  Package,
  Calendar,
  Building2,
  X,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Info,
  Check,
  Download,
  WifiOff,
  List,
  Eye,
  Filter,
  BarChart3,
  ChevronDown,
  ExternalLink
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { decodeSTT } from '@/lib/numberUtils'
import { groupWarehouseData } from '@/lib/warehouseUtils'
import { matchPalletSearch, calculateSearchScore, matchSearch, normalizeSearchString } from '@/lib/searchUtils'
import { formatMaterialZoneProvince } from '@/lib/provinces'

export type DateFilterType = 'packaging_date' | 'peeling_date' | 'raw_material_date' | 'inbound_date'

export const DATE_FILTER_OPTIONS: { id: DateFilterType; label: string; shortLabel: string; icon: string }[] = [
  { id: 'packaging_date', label: 'Ngày đóng gói (DD/MM)', shortLabel: 'Đóng gói', icon: '📦' },
  { id: 'peeling_date', label: 'Ngày sản xuất (bóc múi)', shortLabel: 'Sản xuất', icon: '🔪' },
  { id: 'raw_material_date', label: 'Ngày nhập nguyên liệu', shortLabel: 'Nguyên liệu', icon: '🚛' },
  { id: 'inbound_date', label: 'Ngày nhập kho lạnh', shortLabel: 'Nhập kho', icon: '📥' }
]

export interface UniqueProductItem {
  name: string
  sku: string | null
  aliases: string | null
  unit: string
  positionCount: number
  totalQuantity: number
  normName: string
  unaccName: string
  normSku: string
  unaccSku: string
  aliasList: Array<{
    raw: string
    norm: string
    unacc: string
  }>
}

interface ZoneItem {
  id: string
  name: string
  parent_id: string | null
  system_type: string
  code?: string
  display_order?: number | null
  is_hall?: boolean | null
}

export const isHallZone = (z: ZoneItem | null | undefined): boolean => {
  if (!z) return false
  if (z.is_hall) return true
  const nameUpper = (z.name || '').trim().toUpperCase()
  return (
    nameUpper.startsWith('SẢNH') ||
    nameUpper.startsWith('SÀNH') ||
    nameUpper.startsWith('SANH') ||
    nameUpper.includes('SẢNH') ||
    nameUpper.includes('SÀNH')
  )
}

export const formatDateVN = (d?: string | null): string => {
  if (!d) return '--/--/----'
  const clean = String(d).split('T')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    const [y, m, day] = parts
    if (y.length === 4) return `${day.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
  }
  return d
}

export const formatDateShortVN = (d?: string | null): string => {
  if (!d) return ''
  const clean = String(d).split('T')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    const [y, m, day] = parts
    const shortYear = y.length === 4 ? y.slice(2) : y
    return `${day.padStart(2, '0')}/${m.padStart(2, '0')}/${shortYear}`
  }
  return d
}

export const getCleanUnitCategory = (rawUnit?: string | null): string => {
  if (!rawUnit) return 'Thùng'
  const u = rawUnit.trim()
  const lower = u.toLowerCase()
  if (lower.startsWith('thùng') || lower.startsWith('thung') || lower === 'th') return 'Thùng'
  if (lower === 'kg' || lower === 'kilogram' || lower === 'ký' || lower === 'ky') return 'Kg'
  if (lower.startsWith('sọt') || lower.startsWith('sot')) return 'Sọt'
  return u
}

export const formatUnitsSummary = (
  unitsMap: Map<string, number> | Record<string, number>,
  options?: { short?: boolean }
): string => {
  const entries = unitsMap instanceof Map ? Array.from(unitsMap.entries()) : Object.entries(unitsMap)
  const nonZero = entries.filter(([_, q]) => q > 0)
  if (nonZero.length === 0) return '0'

  // Ưu tiên hiển thị: Thùng trước, rồi đến Kg, Sọt, và các đơn vị khác
  nonZero.sort(([uA], [uB]) => {
    const priority = (u: string) => (u === 'Thùng' ? 1 : u === 'Kg' ? 2 : u === 'Sọt' ? 3 : 4)
    const pA = priority(uA)
    const pB = priority(uB)
    if (pA !== pB) return pA - pB
    return uA.localeCompare(uB)
  })

  return nonZero
    .map(([u, q]) => {
      const formattedQty = Number.isInteger(q)
        ? q.toLocaleString('vi-VN')
        : Number(q.toFixed(2)).toLocaleString('vi-VN')
      const displayUnit = options?.short && u === 'Thùng' ? 'th' : u
      return `${formattedQty} ${displayUnit}`
    })
    .join(' · ')
}

export const formatPositionQtyUnit = (qty?: number | null, unit?: string | null) => {
  if (qty === null || qty === undefined) return null
  const cleanCat = getCleanUnitCategory(unit)
  const displayUnit = cleanCat === 'Thùng' ? 'th' : cleanCat
  const formattedQty = Number.isInteger(qty)
    ? qty.toLocaleString('vi-VN')
    : Number(qty.toFixed(2)).toLocaleString('vi-VN')
  return `${formattedQty} ${displayUnit}`
}

/**
 * Sắp xếp các vị trí trong cùng 1 Ô / Tầng theo quy chuẩn thực tế kho:
 * 1. 2 số cuối cùng của mã vị trí: Nhóm 02 trước, nhóm 01 sau (xếp giảm dần 02 -> 01)
 * 2. Cùng số cuối: Xếp theo chữ cái kệ A -> B -> C
 * Kết quả: A02, B02, C02 rồi đến A01, B01, C01
 */
export function sortPositionsByDepthAndCol<T extends { code?: string | null }>(list: T[]): T[] {
  return [...list].sort((pa, pb) => {
    const codeA = (pa.code || '').trim().toUpperCase()
    const codeB = (pb.code || '').trim().toUpperCase()

    // 1. Lấy 2 số cuối cùng (ví dụ K1D1A08T502 -> 2, K1D1B08T501 -> 1)
    const matchA = codeA.match(/(\d{2})$/)
    const matchB = codeB.match(/(\d{2})$/)
    const depthA = matchA ? parseInt(matchA[1], 10) : 0
    const depthB = matchB ? parseInt(matchB[1], 10) : 0

    if (depthA !== depthB) {
      return depthB - depthA
    }

    // 2. Nếu cùng số cuối (cùng là 02 hoặc cùng là 01): xếp theo chữ cái kệ A -> B -> C
    const colMatchA = codeA.match(/D\d+([A-Z])/i) || codeA.match(/([A-Z])\d{2}T/i) || codeA.match(/([A-Z])\d+/i)
    const colMatchB = codeB.match(/D\d+([A-Z])/i) || codeB.match(/([A-Z])\d{2}T/i) || codeB.match(/([A-Z])\d+/i)
    const colA = colMatchA ? colMatchA[1].toUpperCase() : ''
    const colB = colMatchB ? colMatchB[1].toUpperCase() : ''

    if (colA && colB && colA !== colB) {
      return colA.localeCompare(colB)
    }

    return codeA.localeCompare(codeB, undefined, { numeric: true })
  })
}



interface PositionItem {
  id: string
  code: string
  lot_id: string | null
  zone_ids: string[]
  // Joined lot data
  stt?: string | null
  lot_code?: string | null
  product_name?: string | null
  sku?: string | null
  aliases?: string | null
  unit?: string | null
  tags?: string[]
  packaging_date?: string | null
  peeling_date?: string | null
  raw_material_date?: string | null
  inbound_date?: string | null
  material_zones?: string[]
  material_zone?: string | null
  production_code?: string | null
  batch_code?: string | null
  production_place?: string | null
  extra_info?: string | null
  quantity?: number | null
}

export const getPositionTag = (pos: PositionItem): string | null => {
  if (pos.tags && pos.tags.length > 0) {
    const validTags = pos.tags.filter(t => t && !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
    if (validTags.length > 0) return validTags.join(', ')
  }
  return null
}

// ── ISOLATED MEMOIZED SEARCH BAR (0ms Latency: typing updates only this component) ──
const WarehouseSearchBar = React.memo(function WarehouseSearchBar({
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

// ── IN-MEMORY MODULE LEVEL CACHE (0ms Immediate Switch) ───────
interface WebWarehouseMapCache {
  zones: ZoneItem[]
  positions: PositionItem[]
  cachedAt: string | null
  timestamp: number
}
let memoryWebWarehouseMapCache: WebWarehouseMapCache | null = null

function getInitialWebMapCache(): WebWarehouseMapCache | null {
  if (memoryWebWarehouseMapCache) return memoryWebWarehouseMapCache
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('warehouse_map_offline_cache_v7')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.zones && parsed.zones.length > 0) {
        memoryWebWarehouseMapCache = {
          zones: parsed.zones,
          positions: parsed.positions || [],
          cachedAt: parsed.cachedAt || null,
          timestamp: Date.now()
        }
        return memoryWebWarehouseMapCache
      }
    }
  } catch {}
  return null
}

export default function WarehouseMapTab() {
  const initialCache = getInitialWebMapCache()
  const [loading, setLoading] = useState<boolean>(() => !initialCache)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [zones, setZones] = useState<ZoneItem[]>(() => initialCache?.zones || [])
  const [positions, setPositions] = useState<PositionItem[]>(() => initialCache?.positions || [])

  // Hierarchy Navigation States: Kho -> Dãy / Sảnh -> Ô -> Tầng
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>('all')
  const [selectedAisleId, setSelectedAisleId] = useState<string | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null)
  const [onlyShowMatches, setOnlyShowMatches] = useState<boolean>(false)

  // Search state (searchQuery drives the map, while typing is fully isolated in WarehouseSearchBar)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchTab, setSearchTab] = useState<'map' | 'breakdown'>('breakdown')
  const [expandedWhIds, setExpandedWhIds] = useState<Set<string>>(new Set())
  const [expandedAisleIds, setExpandedAisleIds] = useState<Set<string>>(new Set())
  const [expandedSlotIds, setExpandedSlotIds] = useState<Set<string>>(new Set())
  const [expandedBreakdownTierIds, setExpandedBreakdownTierIds] = useState<Set<string>>(new Set())
  const [expandedTierIds, setExpandedTierIds] = useState<Set<string>>(new Set())
  const [highlightedPosId, setHighlightedPosId] = useState<string | null>(null)

  // Bộ lọc nâng cao: Ngày tháng & Vùng miền
  const [filterDateType, setFilterDateType] = useState<DateFilterType>('packaging_date')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [filterRegion, setFilterRegion] = useState<string>('all')
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false)

  // Position detail modal
  const [selectedPosDetail, setSelectedPosDetail] = useState<PositionItem | null>(null)

  // Offline support
  const [isOffline, setIsOffline] = useState<boolean>(false)
  const [cachedAt, setCachedAt] = useState<string | null>(() => initialCache?.cachedAt || null)
  const [downloadingOffline, setDownloadingOffline] = useState<boolean>(false)
  const [downloadToast, setDownloadToast] = useState<string | null>(null)

  // Offline cache key with versioning
  const OFFLINE_CACHE_KEY = 'warehouse_map_offline_cache_v7'
  const loadWarehouseMapData = useCallback(async (isSilent = false, forceSync = false) => {
    // 0. Nếu đã có cache trong RAM và còn mới (< 5 phút) và không ép sync -> dùng ngay, bỏ qua fetch mạng
    if (!forceSync && memoryWebWarehouseMapCache && memoryWebWarehouseMapCache.zones.length > 0) {
      const ageMs = Date.now() - memoryWebWarehouseMapCache.timestamp
      if (ageMs < 5 * 60 * 1000) {
        setZones(memoryWebWarehouseMapCache.zones)
        setPositions(memoryWebWarehouseMapCache.positions)
        setCachedAt(memoryWebWarehouseMapCache.cachedAt)
        setLoading(false)
        setRefreshing(false)
        return
      }
    }

    let hasCache = Boolean(memoryWebWarehouseMapCache && memoryWebWarehouseMapCache.zones.length > 0)

    // 1. Initial cached fallback - display immediately to eliminate load delay
    try {
      // Purge outdated v1 cache if exists
      localStorage.removeItem('warehouse_map_offline_cache')

      const cachedRaw = localStorage.getItem(OFFLINE_CACHE_KEY)
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw)
        if (cached && cached.zones && cached.zones.length > 0) {
          setZones(cached.zones)
          setPositions(cached.positions || [])
          setCachedAt(cached.cachedAt || null)
          if (!selectedWarehouseId) {
            setSelectedWarehouseId('all')
          }
          hasCache = true
          setLoading(false)
          setRefreshing(true)
        }
      }
    } catch {
      // ignore
    }

    if (!hasCache) {
      if (!isSilent) setLoading(true)
      else setRefreshing(true)
    }

    try {
      // 1. Fetch Zones, Positions, Zone associations, and Pending assignments in parallel
      const [zonesRes, posRes, zpRes, pendingRes] = await Promise.all([
        (supabase.from('zones') as any)
          .select('id, name, code, parent_id, system_type, display_order, is_hall')
          .eq('system_type', 'KHO_DONG_LANH'),
        (supabase.from('positions') as any)
          .select('id, code, lot_id, system_type')
          .eq('system_type', 'KHO_DONG_LANH'),
        (supabase.from('zone_positions') as any).select('position_id, zone_id'),
        (supabase.from('pending_assignments') as any)
          .select('position_id, lot_stt, production_date')
          .eq('system_code', 'KHO_DONG_LANH')
          .eq('status', 'pending')
      ])

      const rawZones: ZoneItem[] = zonesRes.data || []
      setZones(rawZones)

      const rawPositions = posRes.data || []
      const zpList = zpRes.data || []
      const pendingData = pendingRes.data || []

      // Map zone_ids to positions
      const zpMap = new Map<string, string[]>()
      zpList.forEach((item: any) => {
        const list = zpMap.get(item.position_id) || []
        list.push(item.zone_id)
        zpMap.set(item.position_id, list)
      })

      // 2. Fetch Lots information for occupied positions in parallel chunks of 100
      const occupiedLotIds = Array.from(
        new Set(rawPositions.map((p: any) => p.lot_id).filter(Boolean))
      )
      const lotMap = new Map<string, any>()

      if (occupiedLotIds.length > 0) {
        const CHUNK_SIZE = 80
        const chunkPromises: Promise<any>[] = []
        for (let i = 0; i < occupiedLotIds.length; i += CHUNK_SIZE) {
          const chunk = occupiedLotIds.slice(i, i + CHUNK_SIZE)
          chunkPromises.push(
            (supabase
              .from('lots') as any)
              .select(`
                id,
                code,
                daily_seq,
                packaging_date,
                peeling_date,
                raw_material_date,
                inbound_date,
                production_code,
                batch_code,
                notes,
                metadata,
                quantity,
                products ( name, sku, unit, aliases ),
                lot_items ( quantity, unit, products ( name, sku, unit, aliases ) ),
                lot_tags ( tag )
              `)
              .in('id', chunk)
          )
        }

        const chunkResults = await Promise.all(chunkPromises)
        chunkResults.forEach((res: any) => {
          if (res.data) {
            res.data.forEach((l: any) => {
              const rawTags = [
                ...(l.lot_tags || []).map((t: any) => t.tag),
                l.metadata?.tag,
                l.metadata?.pallet_tag
              ].filter(Boolean)
              const tags = Array.from(new Set(rawTags.map(t => String(t).trim()))).filter(t => 
                t && !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:')
              )
              const tagsStr = tags.join(', ')

              const allItems = l.lot_items || []
              const allProdNames = Array.from(new Set([
                l.products?.name,
                ...allItems.map((it: any) => it.products?.name)
              ].filter(Boolean))) as string[]
              const prodName = allProdNames.length > 0
                ? allProdNames.join(', ')
                : (tagsStr ? `Hàng ${tagsStr}` : 'Hàng đông lạnh')

              const allSkus = Array.from(new Set([
                l.products?.sku,
                ...allItems.map((it: any) => it.products?.sku)
              ].filter(Boolean))) as string[]
              const sku = allSkus.length > 0 ? allSkus.join(', ') : (tags.length > 0 ? tags[0] : '---')

              const allAliases = Array.from(new Set([
                l.products?.aliases,
                ...allItems.map((it: any) => it.products?.aliases)
              ].filter(Boolean))) as string[]
              const aliases = allAliases.length > 0 ? allAliases.join(', ') : null

              const itemUnit = allItems.map((it: any) => it.unit).find(Boolean)
              const unit =
                itemUnit ||
                l.metadata?.unit ||
                l.products?.unit ||
                'Thùng'

              // Trích xuất ngày sản xuất (bóc múi)
              const peelingDate = l.peeling_date
                ? String(l.peeling_date).split('T')[0]
                : (Array.isArray(l.metadata?.peeling_dates) && l.metadata.peeling_dates[0]
                  ? String(l.metadata.peeling_dates[0]).split('T')[0]
                  : (l.metadata?.production_date ? String(l.metadata.production_date).split('T')[0] : null))

              // Trích xuất ngày nhập nguyên liệu
              const rawMaterialDate = l.raw_material_date
                ? String(l.raw_material_date).split('T')[0]
                : (l.metadata?.raw_material_date ? String(l.metadata.raw_material_date).split('T')[0] : null)

              // Trích xuất vùng miền / vùng nguyên liệu
              const metaZones: string[] = []
              if (Array.isArray(l.metadata?.material_zones)) {
                l.metadata.material_zones.forEach((z: any) => {
                  if (typeof z === 'string' && z.trim()) metaZones.push(z.trim())
                })
              } else if (l.metadata?.material_zone && typeof l.metadata.material_zone === 'string') {
                l.metadata.material_zone.split(',').forEach((z: string) => {
                  if (z.trim()) metaZones.push(z.trim())
                })
              } else if (l.metadata?.region && typeof l.metadata.region === 'string' && l.metadata.region !== '---') {
                metaZones.push(l.metadata.region.trim())
              } else if (l.metadata?.province && typeof l.metadata.province === 'string' && l.metadata.province !== '---') {
                metaZones.push(l.metadata.province.trim())
              }

              const cleanZones = Array.from(new Set(metaZones.map(z => formatMaterialZoneProvince(z)).filter(Boolean))) as string[]

              const rawPlaces = l.metadata?.production_places
              const prodPlace = (Array.isArray(rawPlaces) && rawPlaces.length > 0)
                ? rawPlaces.join(', ')
                : (l.metadata?.production_place || null)

              lotMap.set(l.id, {
                code: l.code,
                stt: l.daily_seq ? decodeSTT(l.daily_seq) : null,
                product_name: prodName,
                sku,
                aliases,
                unit,
                tags,
                packaging_date: l.packaging_date ? String(l.packaging_date).split('T')[0] : null,
                peeling_date: peelingDate,
                raw_material_date: rawMaterialDate,
                inbound_date: l.inbound_date ? String(l.inbound_date).split('T')[0] : null,
                material_zones: cleanZones,
                material_zone: cleanZones.length > 0 ? cleanZones.join(', ') : null,
                production_code: l.production_code || l.metadata?.production_code || null,
                batch_code: l.batch_code || l.metadata?.batch_code || null,
                production_place: prodPlace,
                extra_info: l.metadata?.extra_info || l.notes || null,
                quantity: l.quantity || (l.lot_items?.[0]?.quantity ?? null)
              })
            })
          }
        })
      }

      // Map pending assignments for real-time STTs
      const pendingMap = new Map<string, any>()
      pendingData.forEach((p: any) => {
        if (p.position_id) {
          pendingMap.set(p.position_id, {
            stt: decodeSTT(p.lot_stt),
            packaging_date: p.production_date
          })
        }
      })

      // Combine into PositionItems
      const formattedPositions: PositionItem[] = rawPositions.map((p: any) => {
        const lotInfo = p.lot_id ? lotMap.get(p.lot_id) : null
        const pendInfo = pendingMap.get(p.id)

        const stt = lotInfo?.stt || pendInfo?.stt || null
        const lotCode = lotInfo?.code || (pendInfo ? 'Chờ duyệt LOT' : null)
        const productName = lotInfo?.product_name || (pendInfo ? 'Đang chờ gán LOT' : null)
        const sku = lotInfo?.sku || null
        const aliases = lotInfo?.aliases || null
        const unit = lotInfo?.unit || 'Thùng'
        const tags = lotInfo?.tags || []
        const pkgDate = lotInfo?.packaging_date || pendInfo?.packaging_date || null

        return {
          id: p.id,
          code: p.code,
          lot_id: p.lot_id || (pendInfo ? 'pending' : null),
          zone_ids: zpMap.get(p.id) || [],
          stt,
          lot_code: lotCode,
          product_name: productName,
          sku,
          aliases,
          unit,
          tags,
          packaging_date: pkgDate,
          peeling_date: lotInfo?.peeling_date || null,
          raw_material_date: lotInfo?.raw_material_date || null,
          inbound_date: lotInfo?.inbound_date || null,
          material_zones: lotInfo?.material_zones || [],
          material_zone: lotInfo?.material_zone || null,
          production_code: lotInfo?.production_code || null,
          batch_code: lotInfo?.batch_code || null,
          production_place: lotInfo?.production_place || null,
          extra_info: lotInfo?.extra_info || null,
          quantity: lotInfo?.quantity || null
        }
      })

      setPositions(formattedPositions)

      // Save snapshot to in-memory RAM cache & local storage for offline use
      const now = new Date().toISOString()
      memoryWebWarehouseMapCache = {
        zones: rawZones,
        positions: formattedPositions,
        cachedAt: now,
        timestamp: Date.now()
      }

      try {
        const snapshot = {
          zones: rawZones,
          positions: formattedPositions,
          cachedAt: now
        }
        localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(snapshot))
        setCachedAt(now)
        setIsOffline(false)
      } catch (e) {
        console.warn('Lỗi lưu cache sơ đồ kho:', e)
      }

      // Auto-select 'all' warehouses if none selected
      if (!selectedWarehouseId) {
        setSelectedWarehouseId('all')
      }
    } catch (err) {
      console.warn('Lỗi tải dữ liệu Sơ đồ kho từ máy chủ, chuyển sang chế độ ngoại tuyến:', err)
      try {
        const cachedRaw = localStorage.getItem(OFFLINE_CACHE_KEY)
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw)
          if (cached && cached.zones) {
            setZones(cached.zones)
            setPositions(cached.positions || [])
            setCachedAt(cached.cachedAt || null)
            setIsOffline(true)
          }
        }
      } catch { }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedWarehouseId])

  const handleDownloadOffline = async () => {
    setDownloadingOffline(true)
    try {
      await loadWarehouseMapData(true, true)
      setDownloadToast('Đã lưu toàn bộ sơ đồ kho vào máy để xem ngoại tuyến!')
      setTimeout(() => setDownloadToast(null), 4000)
    } finally {
      setDownloadingOffline(false)
    }
  }

  useEffect(() => {
    loadWarehouseMapData()
  }, [])

  // ── Ô Gộp (Grouped Warehouse Data) ───────────────────────────
  const { groupedZones, virtualToRealMap } = useMemo(() => {
    if (zones.length === 0) {
      return { groupedZones: [], virtualToRealMap: new Map<string, string[]>() }
    }
    const res = groupWarehouseData(zones as any, positions as any)
    return {
      groupedZones: (res.zones as ZoneItem[]) || zones,
      virtualToRealMap: res.virtualToRealMap || new Map<string, string[]>()
    }
  }, [zones, positions])

  const activeZones = groupedZones.length > 0 ? groupedZones : zones

  // ── Zones Hierarchy Sorting & Filtering ───────────────────────
  const sortZones = (list: ZoneItem[]) =>
    [...list].sort((a, b) => {
      const oa = a.display_order ?? 0
      const ob = b.display_order ?? 0
      if (oa !== ob) return oa - ob
      return (a.name || a.code || '').localeCompare(b.name || b.code || '', undefined, { numeric: true })
    })

  // ── Pre-compute Zone Descendants Map & Full Paths ONCE (O(1) lookups) ──
  const { zoneDescendantsMap, zonePathMap } = useMemo(() => {
    const rzMap = new Map(zones.map(z => [z.id, z]))

    // 1. Precompute full path string for every real zone
    const pathMap = new Map<string, string>()
    zones.forEach(z => {
      const names: string[] = []
      let curr: ZoneItem | undefined = z
      while (curr) {
        names.unshift(curr.name)
        curr = curr.parent_id ? rzMap.get(curr.parent_id) : undefined
      }
      pathMap.set(z.id, names.join(' · '))
    })

    // 2. Precompute children map for tree traversal
    const childrenMap = new Map<string, string[]>()
    zones.forEach(z => {
      if (z.parent_id) {
        const list = childrenMap.get(z.parent_id) || []
        list.push(z.id)
        childrenMap.set(z.parent_id, list)
      }
    })

    const getRealChildren = (parentId: string): string[] => {
      const result: string[] = []
      const stack = [parentId]
      while (stack.length > 0) {
        const curr = stack.pop()!
        const kids = childrenMap.get(curr)
        if (kids) {
          for (let i = 0; i < kids.length; i++) {
            result.push(kids[i])
            stack.push(kids[i])
          }
        }
      }
      return result
    }

    // 3. Precompute descendant set for all active zones (including virtual/grouped ones)
    const descMap = new Map<string, Set<string>>()
    activeZones.forEach(z => {
      const realIds = virtualToRealMap.get(z.id) || [z.id]
      const allDesc = new Set<string>(realIds)
      realIds.forEach(rid => {
        const children = getRealChildren(rid)
        for (let i = 0; i < children.length; i++) {
          allDesc.add(children[i])
        }
      })
      descMap.set(z.id, allDesc)
    })

    return { zoneDescendantsMap: descMap, zonePathMap: pathMap }
  }, [zones, activeZones, virtualToRealMap])

  // Helper to get ALL real zone descendants (O(1) lookup)
  const getDescendantZoneIds = useCallback(
    (targetZoneId: string): Set<string> => {
      return zoneDescendantsMap.get(targetZoneId) || new Set<string>([targetZoneId])
    },
    [zoneDescendantsMap]
  )

  // Helper to get full zone path string (O(1) lookup)
  const getPositionPath = useCallback(
    (pos: PositionItem) => {
      const leafZoneId = pos.zone_ids[0]
      if (!leafZoneId) return ''
      return zonePathMap.get(leafZoneId) || ''
    },
    [zonePathMap]
  )

  // ── Danh sách sản phẩm duy nhất đang có trong kho (Pre-indexed cho gợi ý 0ms) ──────────────
  const uniqueProducts = useMemo(() => {
    const prodMap = new Map<string, UniqueProductItem>()

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]
      if (p.product_name && p.lot_id) {
        const name = p.product_name.trim()
        const existing = prodMap.get(name)
        if (existing) {
          existing.positionCount++
          existing.totalQuantity += (p.quantity || 0)
          if (!existing.aliases && p.aliases) {
            existing.aliases = p.aliases
            existing.aliasList = p.aliases.split(',').map(a => a.trim()).filter(Boolean).map(a => ({
              raw: a,
              norm: normalizeSearchString(a),
              unacc: normalizeSearchString(a, true)
            }))
          }
          if (!existing.sku && p.sku) {
            existing.sku = p.sku
            existing.normSku = normalizeSearchString(p.sku)
            existing.unaccSku = normalizeSearchString(p.sku, true)
          }
        } else {
          const aliasList = (p.aliases || '').split(',').map(a => a.trim()).filter(Boolean).map(a => ({
            raw: a,
            norm: normalizeSearchString(a),
            unacc: normalizeSearchString(a, true)
          }))
          prodMap.set(name, {
            name,
            sku: p.sku || null,
            aliases: p.aliases || null,
            unit: p.unit || 'Thùng',
            positionCount: 1,
            totalQuantity: p.quantity || 0,
            normName: normalizeSearchString(name),
            unaccName: normalizeSearchString(name, true),
            normSku: normalizeSearchString(p.sku || ''),
            unaccSku: normalizeSearchString(p.sku || '', true),
            aliasList
          })
        }
      }
    }

    return Array.from(prodMap.values())
  }, [positions])

  // Tính toán danh sách vùng miền thực tế có trong kho cùng số lượng pallet
  const availableRegions = useMemo(() => {
    const regionCountMap = new Map<string, number>()
    positions.forEach(p => {
      const zones = p.material_zones && p.material_zones.length > 0 ? p.material_zones : (p.material_zone ? [p.material_zone] : [])
      zones.forEach(z => {
        if (z && z !== '---') {
          regionCountMap.set(z, (regionCountMap.get(z) || 0) + 1)
        }
      })
    })

    return Array.from(regionCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }, [positions])

  const hasActiveFilters = useMemo(() => {
    return !!(filterStartDate || filterEndDate || (filterRegion && filterRegion !== 'all'))
  }, [filterStartDate, filterEndDate, filterRegion])

  const handleSetDatePreset = useCallback((preset: 'today' | 3 | 7 | 'this_month' | 'clear') => {
    if (preset === 'clear') {
      setFilterStartDate('')
      setFilterEndDate('')
      return
    }

    const today = new Date()
    const formatDate = (d: Date) => d.toISOString().split('T')[0]
    const todayStr = formatDate(today)

    if (preset === 'today') {
      setFilterStartDate(todayStr)
      setFilterEndDate(todayStr)
    } else if (typeof preset === 'number') {
      const start = new Date()
      start.setDate(today.getDate() - (preset - 1))
      setFilterStartDate(formatDate(start))
      setFilterEndDate(todayStr)
    } else if (preset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      setFilterStartDate(formatDate(start))
      setFilterEndDate(todayStr)
    }
  }, [])

  const handleResetFilters = useCallback(() => {
    setFilterStartDate('')
    setFilterEndDate('')
    setFilterRegion('all')
  }, [])

  const handleClearAllSearchAndFilters = useCallback(() => {
    setSearchQuery('')
    setHighlightedPosId(null)
    setFilterStartDate('')
    setFilterEndDate('')
    setFilterRegion('all')
    setSearchTab('breakdown')
  }, [])

  // Thực hiện tìm kiếm (cập nhật searchQuery để sơ đồ lọc và đếm vị trí)
  const handleExecuteSearch = useCallback((term: string) => {
    const q = term.trim()
    setSearchQuery(q)
    if (q) {
      setSearchTab('breakdown')
    }
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    setHighlightedPosId(null)
    setSearchTab('breakdown')
  }, [])

  // 1. Warehouses (Level 1: parent_id is null)
  const warehouses = useMemo(
    () => sortZones(activeZones.filter(z => !z.parent_id)),
    [activeZones]
  )

  // ── Pre-compute Hierarchy Map & Ancestor Lookup ONCE in O(N) ──
  const { zoneHierarchyMap, realToActiveAncestorsMap } = useMemo(() => {
    const hierMap = new Map<string, { wh: ZoneItem; aisle: ZoneItem; slot: ZoneItem; tier?: ZoneItem }>()
    const ancestorsMap = new Map<string, string[]>()

    const activeChildrenByParent = new Map<string, ZoneItem[]>()
    for (let i = 0; i < activeZones.length; i++) {
      const z = activeZones[i]
      if (z.parent_id) {
        const list = activeChildrenByParent.get(z.parent_id)
        if (list) list.push(z)
        else activeChildrenByParent.set(z.parent_id, [z])
      }
    }

    const addAncestor = (realZid: string, activeZid: string) => {
      const list = ancestorsMap.get(realZid)
      if (list) {
        if (!list.includes(activeZid)) list.push(activeZid)
      } else {
        ancestorsMap.set(realZid, [activeZid])
      }
    }

    warehouses.forEach(wh => {
      const whDesc = zoneDescendantsMap.get(wh.id)
      if (whDesc) whDesc.forEach(zid => addAncestor(zid, wh.id))

      const whAisles = activeChildrenByParent.get(wh.id) || []
      whAisles.forEach(aisle => {
        const aisleDesc = zoneDescendantsMap.get(aisle.id)
        if (aisleDesc) aisleDesc.forEach(zid => addAncestor(zid, aisle.id))

        const aisleSlots = activeChildrenByParent.get(aisle.id) || []
        if (aisleSlots.length > 0) {
          aisleSlots.forEach(slot => {
            const desc = zoneDescendantsMap.get(slot.id)
            if (desc) {
              desc.forEach(zid => {
                hierMap.set(zid, { wh, aisle, slot })
                addAncestor(zid, slot.id)
              })
            }
            const slotTiers = activeChildrenByParent.get(slot.id) || []
            slotTiers.forEach(tier => {
              const tierDesc = zoneDescendantsMap.get(tier.id)
              if (tierDesc) {
                tierDesc.forEach(zid => {
                  hierMap.set(zid, { wh, aisle, slot, tier })
                  addAncestor(zid, tier.id)
                })
              }
            })
          })
        } else {
          if (aisleDesc) {
            aisleDesc.forEach(zid => {
              hierMap.set(zid, { wh, aisle, slot: aisle })
            })
          }
        }
      })
    })

    return { zoneHierarchyMap: hierMap, realToActiveAncestorsMap: ancestorsMap }
  }, [warehouses, activeZones, zoneDescendantsMap])

  const exactProductNamesSet = useMemo(
    () => new Set(uniqueProducts.map(up => up.name)),
    [uniqueProducts]
  )

  // ── Search & Filter Logic (High Performance 0ms Fast-Path) ──
  const isSearchActive = !!searchQuery.trim() || hasActiveFilters

  const matchingPositions = useMemo(() => {
    const q = searchQuery.trim()
    const hasQuery = q.length > 0
    const hasDateFilter = !!(filterStartDate || filterEndDate)
    const hasRegionFilter = !!(filterRegion && filterRegion !== 'all')

    if (!hasQuery && !hasDateFilter && !hasRegionFilter) return []

    const isExactProductQuery = hasQuery && exactProductNamesSet.has(q)
    const isSttPrefixQuery = hasQuery && /^(#|stt[:\s-#]+)/i.test(q)
    const cleanSttQuery = isSttPrefixQuery
      ? normalizeSearchString(q, true).replace(/^(#|stt[:\s-#]*)/i, '').trim()
      : ''
    const isLikelyPositionCodeQuery = hasQuery && /^k\d/i.test(q)
    const normRegionFilter = hasRegionFilter ? normalizeSearchString(filterRegion, true) : ''

    const matched: { pos: PositionItem; score: number }[] = []

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]

      if (!p.lot_id && (hasDateFilter || hasRegionFilter || !isLikelyPositionCodeQuery)) {
        continue
      }

      // 1. Lọc theo Mốc ngày (Đóng gói, Sản xuất, Nguyên liệu, Nhập kho)
      if (hasDateFilter) {
        let targetDate: string | null = null
        if (filterDateType === 'packaging_date') targetDate = p.packaging_date || null
        else if (filterDateType === 'peeling_date') targetDate = p.peeling_date || p.packaging_date || null
        else if (filterDateType === 'raw_material_date') targetDate = p.raw_material_date || null
        else if (filterDateType === 'inbound_date') targetDate = p.inbound_date || null

        if (!targetDate) continue
        if (filterStartDate && targetDate < filterStartDate) continue
        if (filterEndDate && targetDate > filterEndDate) continue
      }

      // 2. Lọc theo Vùng miền / Vùng nguyên liệu
      if (hasRegionFilter) {
        const pZones = p.material_zones && p.material_zones.length > 0 ? p.material_zones : (p.material_zone ? [p.material_zone] : [])
        if (pZones.length === 0) continue

        const matchedRegion = pZones.some(z => {
          const normZ = normalizeSearchString(z, true)
          return normZ.includes(normRegionFilter) || normRegionFilter.includes(normZ)
        })
        if (!matchedRegion) continue
      }

      // 3. Lọc theo Từ khóa tìm kiếm (Sản phẩm, LOT, vị trí...)
      if (hasQuery) {
        if (isExactProductQuery) {
          if (p.product_name && p.product_name.trim() === q) {
            matched.push({ pos: p, score: 2000 })
          }
          continue
        }

        if (isSttPrefixQuery) {
          if (p.stt) {
            const sttNorm = String(p.stt).trim().toLowerCase()
            if (!cleanSttQuery || sttNorm.includes(cleanSttQuery)) {
              const score = sttNorm === cleanSttQuery ? 5000 : sttNorm.startsWith(cleanSttQuery) ? 3800 : 2600
              matched.push({ pos: p, score })
            }
          }
          continue
        }

        if (matchPalletSearch(p, q)) {
          const score = calculateSearchScore(p, q, {
            name: p.product_name,
            code: p.code,
            lot_code: p.lot_code,
            aliases: p.aliases
          })
          matched.push({ pos: p, score })
        }
      } else {
        matched.push({ pos: p, score: 100 })
      }
    }

    if (hasQuery && !isExactProductQuery) {
      matched.sort((a, b) => b.score - a.score)
    }
    return matched.map(m => m.pos)
  }, [positions, searchQuery, filterDateType, filterStartDate, filterEndDate, filterRegion, exactProductNamesSet])

  const matchingPosIds = useMemo(() => {
    return new Set(matchingPositions.map(p => p.id))
  }, [matchingPositions])

  // Fast count matches per zone in O(matchingPositions)
  const zoneMatchCountMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!isSearchActive || matchingPositions.length === 0) return map

    for (let i = 0; i < matchingPositions.length; i++) {
      const p = matchingPositions[i]
      const countedForPos = new Set<string>()
      for (let j = 0; j < p.zone_ids.length; j++) {
        const ancestors = realToActiveAncestorsMap.get(p.zone_ids[j])
        if (ancestors) {
          for (let k = 0; k < ancestors.length; k++) {
            countedForPos.add(ancestors[k])
          }
        }
      }
      countedForPos.forEach(azId => {
        map.set(azId, (map.get(azId) || 0) + 1)
      })
    }
    return map
  }, [isSearchActive, matchingPositions, realToActiveAncestorsMap])

  // ── Thống kê phân bổ kết quả tìm kiếm (Báo cáo Kế toán: Kho -> Dãy -> Ô -> Tầng) ──
  const breakdownReport = useMemo(() => {
    if (!isSearchActive || matchingPositions.length === 0) return null

    interface TierAcc {
      tier: ZoneItem
      unitsMap: Map<string, number>
      positionCount: number
      positions: PositionItem[]
    }
    interface SlotAcc {
      slot: ZoneItem
      unitsMap: Map<string, number>
      positionCount: number
      positions: PositionItem[]
      tiersMap: Map<string, TierAcc>
    }
    interface AisleAcc {
      aisle: ZoneItem
      unitsMap: Map<string, number>
      positionCount: number
      slotsMap: Map<string, SlotAcc>
    }
    interface WhAcc {
      warehouse: ZoneItem
      unitsMap: Map<string, number>
      positionCount: number
      aislesMap: Map<string, AisleAcc>
    }

    const addQtyToMap = (map: Map<string, number>, unit: string, qty: number) => {
      map.set(unit, (map.get(unit) || 0) + qty)
    }

    const whMap = new Map<string, WhAcc>()
    const grandUnitsMap = new Map<string, number>()

    matchingPositions.forEach(p => {
      const qty = p.quantity || 0
      const unitCat = getCleanUnitCategory(p.unit)
      addQtyToMap(grandUnitsMap, unitCat, qty)

      let hier: { wh: ZoneItem; aisle: ZoneItem; slot: ZoneItem; tier?: ZoneItem } | undefined
      for (let i = 0; i < p.zone_ids.length; i++) {
        const found = zoneHierarchyMap.get(p.zone_ids[i])
        if (found) {
          hier = found
          if (found.tier) break
        }
      }

      if (hier) {
        let whAcc = whMap.get(hier.wh.id)
        if (!whAcc) {
          whAcc = { warehouse: hier.wh, unitsMap: new Map(), positionCount: 0, aislesMap: new Map() }
          whMap.set(hier.wh.id, whAcc)
        }
        addQtyToMap(whAcc.unitsMap, unitCat, qty)
        whAcc.positionCount++

        let aisleAcc = whAcc.aislesMap.get(hier.aisle.id)
        if (!aisleAcc) {
          aisleAcc = { aisle: hier.aisle, unitsMap: new Map(), positionCount: 0, slotsMap: new Map() }
          whAcc.aislesMap.set(hier.aisle.id, aisleAcc)
        }
        addQtyToMap(aisleAcc.unitsMap, unitCat, qty)
        aisleAcc.positionCount++

        let slotAcc = aisleAcc.slotsMap.get(hier.slot.id)
        if (!slotAcc) {
          slotAcc = { slot: hier.slot, unitsMap: new Map(), positionCount: 0, positions: [], tiersMap: new Map() }
          aisleAcc.slotsMap.set(hier.slot.id, slotAcc)
        }
        addQtyToMap(slotAcc.unitsMap, unitCat, qty)
        slotAcc.positionCount++
        slotAcc.positions.push(p)

        if (hier.tier) {
          let tierAcc = slotAcc.tiersMap.get(hier.tier.id)
          if (!tierAcc) {
            tierAcc = { tier: hier.tier, unitsMap: new Map(), positionCount: 0, positions: [] }
            slotAcc.tiersMap.set(hier.tier.id, tierAcc)
          }
          addQtyToMap(tierAcc.unitsMap, unitCat, qty)
          tierAcc.positionCount++
          tierAcc.positions.push(p)
        }
      }
    })

    const getMapTotal = (map: Map<string, number>) => Array.from(map.values()).reduce((s, v) => s + v, 0)

    const sortedWhs = Array.from(whMap.values())
      .sort((a, b) => getMapTotal(b.unitsMap) - getMapTotal(a.unitsMap) || b.positionCount - a.positionCount)
      .map(whAcc => {
        const sortedAisles = Array.from(whAcc.aislesMap.values())
          .sort((a, b) => getMapTotal(b.unitsMap) - getMapTotal(a.unitsMap) || b.positionCount - a.positionCount)
          .map(aisleAcc => {
            const sortedSlots = Array.from(aisleAcc.slotsMap.values())
              .sort((a, b) => {
                const oa = a.slot.display_order ?? 0
                const ob = b.slot.display_order ?? 0
                if (oa !== ob) return oa - ob
                return (a.slot.name || '').localeCompare(b.slot.name || '', undefined, { numeric: true })
              })
              .map(slotAcc => {
                const sortedTiers = Array.from(slotAcc.tiersMap.values())
                  .sort((a, b) => {
                    const oa = a.tier.display_order ?? 0
                    const ob = b.tier.display_order ?? 0
                    if (oa !== ob) return oa - ob
                    return (a.tier.name || '').localeCompare(b.tier.name || '', undefined, { numeric: true })
                  })
                  .map(tierAcc => ({
                    ...tierAcc,
                    positions: sortPositionsByDepthAndCol(tierAcc.positions)
                  }))

                return {
                  slot: slotAcc.slot,
                  unitsMap: slotAcc.unitsMap,
                  positionCount: slotAcc.positionCount,
                  positions: sortPositionsByDepthAndCol(slotAcc.positions),
                  tiers: sortedTiers
                }
              })
            return {
              aisle: aisleAcc.aisle,
              unitsMap: aisleAcc.unitsMap,
              positionCount: aisleAcc.positionCount,
              slots: sortedSlots
            }
          })
        return {
          warehouse: whAcc.warehouse,
          unitsMap: whAcc.unitsMap,
          positionCount: whAcc.positionCount,
          aisles: sortedAisles
        }
      })

    const grandTotalQty = Array.from(grandUnitsMap.values()).reduce((s, v) => s + v, 0)

    return {
      grandUnitsMap,
      grandTotalQty,
      totalPositions: matchingPositions.length,
      warehouses: sortedWhs
    }
  }, [isSearchActive, matchingPositions, zoneHierarchyMap])

  // Mặc định THU GỌN HẾT các kho khi tìm kiếm (gọn gàng, dễ nhìn theo từng thẻ Kho)
  useEffect(() => {
    if (breakdownReport?.warehouses) {
      setExpandedWhIds(new Set())
      setExpandedAisleIds(new Set())
      setExpandedSlotIds(new Set())
      setExpandedBreakdownTierIds(new Set())
    }
  }, [breakdownReport])

  const toggleWarehouseExpand = useCallback((whId: string) => {
    setExpandedWhIds(prev => {
      const next = new Set(prev)
      if (next.has(whId)) next.delete(whId)
      else next.add(whId)
      return next
    })
  }, [])

  const toggleAisleExpand = useCallback((aisleId: string) => {
    setExpandedAisleIds(prev => {
      const next = new Set(prev)
      if (next.has(aisleId)) next.delete(aisleId)
      else next.add(aisleId)
      return next
    })
  }, [])

  const toggleSlotExpand = useCallback((slotId: string) => {
    setExpandedSlotIds(prev => {
      const next = new Set(prev)
      if (next.has(slotId)) next.delete(slotId)
      else next.add(slotId)
      return next
    })
  }, [])

  const toggleBreakdownTierExpand = useCallback((tierId: string) => {
    setExpandedBreakdownTierIds(prev => {
      const next = new Set(prev)
      if (next.has(tierId)) next.delete(tierId)
      else next.add(tierId)
      return next
    })
  }, [])

  const handleExpandAll = useCallback(() => {
    if (breakdownReport) {
      setExpandedWhIds(new Set(breakdownReport.warehouses.map(w => w.warehouse.id)))
      const allAisles = new Set<string>()
      const allSlots = new Set<string>()
      breakdownReport.warehouses.forEach(w =>
        w.aisles.forEach(a => {
          allAisles.add(a.aisle.id)
          a.slots.forEach(s => allSlots.add(s.slot.id))
        })
      )
      setExpandedAisleIds(allAisles)
      setExpandedSlotIds(allSlots)
    }
  }, [breakdownReport])

  const handleCollapseAll = useCallback(() => {
    setExpandedWhIds(new Set())
    setExpandedAisleIds(new Set())
    setExpandedSlotIds(new Set())
    setExpandedBreakdownTierIds(new Set())
  }, [])

  const visibleWarehouses = useMemo(() => {
    if (!isSearchActive) return warehouses
    return warehouses.filter(wh => (zoneMatchCountMap.get(wh.id) || 0) > 0)
  }, [warehouses, isSearchActive, zoneMatchCountMap])

  // 2. Aisles / Halls (Level 2: parent_id === selectedWarehouseId)
  const aisles = useMemo(() => {
    if (!selectedWarehouseId || selectedWarehouseId === 'all') return []
    const list = activeZones.filter(z => z.parent_id === selectedWarehouseId)

    const compareAisles = (a: ZoneItem, b: ZoneItem) => {
      const oa = a.display_order ?? 0
      const ob = b.display_order ?? 0
      if (oa !== ob) return oa - ob
      return (a.name || a.code || '').localeCompare(b.name || b.code || '', undefined, { numeric: true })
    }

    if (isSearchActive) {
      return list
        .filter(z => (zoneMatchCountMap.get(z.id) || 0) > 0)
        .sort((a, b) => {
          const countA = zoneMatchCountMap.get(a.id) || 0
          const countB = zoneMatchCountMap.get(b.id) || 0
          if (countB !== countA) return countB - countA
          return compareAisles(a, b)
        })
    }
    return [...list].sort(compareAisles)
  }, [activeZones, selectedWarehouseId, isSearchActive, zoneMatchCountMap])

  // 3. Slots (Level 3: parent_id === selectedAisleId) -> Ô GỘP: Ô 01, Ô 02...
  const slots = useMemo(() => {
    if (!selectedAisleId) return []
    const list = activeZones.filter(z => z.parent_id === selectedAisleId)
    if (isSearchActive) {
      return list
        .filter(z => (zoneMatchCountMap.get(z.id) || 0) > 0)
        .sort((a, b) => {
          const countA = zoneMatchCountMap.get(a.id) || 0
          const countB = zoneMatchCountMap.get(b.id) || 0
          if (countB !== countA) return countB - countA
          const oa = a.display_order ?? 0
          const ob = b.display_order ?? 0
          if (oa !== ob) return oa - ob
          return (a.name || a.code || '').localeCompare(b.name || b.code || '', undefined, { numeric: true })
        })
    }
    return sortZones(list)
  }, [activeZones, selectedAisleId, isSearchActive, zoneMatchCountMap])

  // Selected Aisle Item & Hall Detection (Khu vực Sảnh)
  const selectedAisle = useMemo(() => {
    if (!selectedAisleId) return null
    return activeZones.find(z => z.id === selectedAisleId) || null
  }, [activeZones, selectedAisleId])

  const isSelectedAisleHall = useMemo(() => {
    if (!selectedAisle) return false
    const hasRealChildSlots = activeZones.some(z => z.parent_id === selectedAisle.id)
    return isHallZone(selectedAisle) || !hasRealChildSlots
  }, [selectedAisle, activeZones])

  // 4. Tiers (Level 4: parent_id === selectedSlotId) -> Tầng của Ô gộp
  // Sắp xếp tầng từ thấp đến cao (Tầng 1 -> Tầng 5)
  const tiers = useMemo(() => {
    if (!selectedSlotId) return []
    let list = activeZones.filter(z => z.parent_id === selectedSlotId)
    if (isSearchActive && onlyShowMatches) {
      list = list.filter(z => (zoneMatchCountMap.get(z.id) || 0) > 0)
    }
    return [...list].sort((a, b) => {
      const oa = a.display_order ?? 0
      const ob = b.display_order ?? 0
      if (oa !== ob) return oa - ob
      return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
    })
  }, [activeZones, selectedSlotId, isSearchActive, onlyShowMatches, zoneMatchCountMap])

  // ── Thu gọn / Mở rộng các Tầng ───────────────────────────────────
  const toggleTierExpand = useCallback((tierId: string) => {
    setExpandedTierIds(prev => {
      const next = new Set(prev)
      if (next.has(tierId)) next.delete(tierId)
      else next.add(tierId)
      return next
    })
  }, [])

  const handleExpandAllTiers = useCallback(() => {
    setExpandedTierIds(new Set(tiers.map(t => t.id)))
  }, [tiers])

  const handleCollapseAllTiers = useCallback(() => {
    setExpandedTierIds(new Set())
  }, [])

  // Tự động mở rộng tầng khi có vị trí highlight hoặc kết quả tìm kiếm khớp
  useEffect(() => {
    if (!selectedSlotId || tiers.length === 0) return

    if (highlightedPosId) {
      const targetPos = positions.find(p => p.id === highlightedPosId)
      if (targetPos) {
        const matchingTier = tiers.find(tier => {
          const desc = getDescendantZoneIds(tier.id)
          return targetPos.zone_ids.some(zid => desc.has(zid))
        })
        if (matchingTier) {
          setExpandedTierIds(prev => new Set([...prev, matchingTier.id]))
          return
        }
      }
    }

    if (isSearchActive) {
      const matchedTiers = tiers.filter(t => (zoneMatchCountMap.get(t.id) || 0) > 0)
      if (matchedTiers.length > 0) {
        setExpandedTierIds(new Set(matchedTiers.map(t => t.id)))
      }
    }
  }, [selectedSlotId, highlightedPosId, isSearchActive, tiers, positions, getDescendantZoneIds, zoneMatchCountMap])

  // ── Stats Calculator (Total, Occupied, Empty) per Zone (O(Positions) Single-Pass) ──
  const zoneStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { total: number; occupied: number; empty: number }
    >()
    if (activeZones.length === 0 || positions.length === 0) return map

    for (let i = 0; i < activeZones.length; i++) {
      map.set(activeZones[i].id, { total: 0, occupied: 0, empty: 0 })
    }

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]
      const isOcc = Boolean(p.lot_id)
      const seenActiveZones = new Set<string>()

      for (let j = 0; j < p.zone_ids.length; j++) {
        const realZid = p.zone_ids[j]
        const ancestors = realToActiveAncestorsMap.get(realZid)
        if (ancestors) {
          for (let k = 0; k < ancestors.length; k++) {
            seenActiveZones.add(ancestors[k])
          }
        }
        if (map.has(realZid)) {
          seenActiveZones.add(realZid)
        }
      }

      seenActiveZones.forEach(azId => {
        const st = map.get(azId)
        if (st) {
          st.total++
          if (isOcc) st.occupied++
        }
      })
    }

    map.forEach(st => {
      st.empty = Math.max(0, st.total - st.occupied)
    })

    return map
  }, [activeZones, positions, realToActiveAncestorsMap])

  // Thống kê phân loại (Kệ vs Sảnh) cho từng Kho (đặt sau zoneStatsMap)
  const getWhBreakdown = useCallback((whId: string) => {
    const directChildren = activeZones.filter(z => z.parent_id === whId)
    let rackTotal = 0
    let rackOccupied = 0
    let hallTotal = 0
    let hallOccupied = 0

    directChildren.forEach(child => {
      const isHall = isHallZone(child)
      const stats = zoneStatsMap.get(child.id) || { total: 0, occupied: 0, empty: 0 }
      if (isHall) {
        hallTotal += stats.total
        hallOccupied += stats.occupied
      } else {
        rackTotal += stats.total
        rackOccupied += stats.occupied
      }
    })

    return { rackTotal, rackOccupied, hallTotal, hallOccupied }
  }, [activeZones, zoneStatsMap])

  // ── Positions in Current View (Slot / Tier / Hall) ────────────────────
  const currentPositions = useMemo(() => {
    // Nếu đang vào Sảnh (hoặc khu vực không phân chia ô tầng)
    if (isSelectedAisleHall) {
      if (!selectedAisleId) return []
      const targetZoneIds = getDescendantZoneIds(selectedAisleId)
      let filtered = positions.filter(p =>
        p.zone_ids.some(zid => targetZoneIds.has(zid))
      )
      if (onlyShowMatches && isSearchActive) {
        filtered = filtered.filter(p => matchingPosIds.has(p.id))
      }
      return filtered.sort((a, b) =>
        a.code.localeCompare(b.code, undefined, { numeric: true })
      )
    }

    if (!selectedSlotId) return []

    const targetZoneId = selectedTierId || selectedSlotId
    const targetZoneIds = getDescendantZoneIds(targetZoneId)

    let filtered = positions.filter(p =>
      p.zone_ids.some(zid => targetZoneIds.has(zid))
    )

    if (onlyShowMatches && isSearchActive) {
      filtered = filtered.filter(p => matchingPosIds.has(p.id))
    }

    return filtered.sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true })
    )
  }, [
    isSelectedAisleHall,
    selectedAisleId,
    selectedSlotId,
    selectedTierId,
    positions,
    getDescendantZoneIds,
    onlyShowMatches,
    isSearchActive,
    matchingPosIds
  ])

  // Map positions by tier for grouped rack display
  const tierPositionsMap = useMemo(() => {
    const map = new Map<string, PositionItem[]>()
    if (!selectedSlotId) return map

    tiers.forEach(tier => {
      const descIds = getDescendantZoneIds(tier.id)
      const list = positions
        .filter(p => p.zone_ids.some(zid => descIds.has(zid)))
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      map.set(tier.id, list)
    })

    return map
  }, [selectedSlotId, tiers, positions, getDescendantZoneIds])

  const handleSelectSearchResult = (pos: PositionItem) => {
    // Find zone hierarchy for this position
    const leafZoneId = pos.zone_ids[0]
    if (leafZoneId) {
      const realZoneMap = new Map(zones.map(z => [z.id, z]))
      let curr = realZoneMap.get(leafZoneId)
      const realPath: ZoneItem[] = []

      while (curr) {
        realPath.unshift(curr)
        curr = curr.parent_id ? realZoneMap.get(curr.parent_id) : undefined
      }

      // realPath is [Warehouse, Aisle, RealSlot(e.g. Ô A01), RealTier(e.g. Tầng 1)]
      if (realPath.length >= 1) setSelectedWarehouseId(realPath[0].id)
      if (realPath.length >= 2) {
        const aisleId = realPath[1].id
        setSelectedAisleId(aisleId)

        if (realPath.length >= 3) {
          const realSlotId = realPath[2].id
          // Find corresponding Ô Gộp under aisle
          const vSlot = activeZones.find(
            z => z.parent_id === aisleId && (z.id === realSlotId || virtualToRealMap.get(z.id)?.includes(realSlotId))
          )
          if (vSlot) {
            setSelectedSlotId(vSlot.id)

            if (realPath.length >= 4) {
              const realTierId = realPath[3].id
              const vTier = activeZones.find(
                z => z.parent_id === vSlot.id && (z.id === realTierId || virtualToRealMap.get(z.id)?.includes(realTierId))
              )
              setSelectedTierId(vTier ? vTier.id : null)
            } else {
              setSelectedTierId(null)
            }
          }
        }
      }
    }

    setHighlightedPosId(pos.id)
    setSelectedPosDetail(pos)
  }

  const handleJumpToMap = (pos: PositionItem) => {
    handleSelectSearchResult(pos)
    setSearchTab('map')
  }

  // ── Helper to resolve Zone Names ──────────────────────────────
  const getZoneName = (id: string | null) =>
    activeZones.find(z => z.id === id)?.name || ''

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0f1d] text-slate-100 overflow-hidden">
      {/* ── TOP HEADER & QUICK STATS ────────────────────────────── */}
      <div className="p-3 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
            <MapPin size={18} />
          </div>
          <div>
            <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Sơ Đồ Vị Trí Kho</span>
              <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                KHO ĐÔNG LẠNH
              </span>
            </h2>
            <p className="text-[10px] text-slate-400">
              Tổng {positions.length} vị trí · {positions.filter(p => p.lot_id).length} có hàng · {positions.filter(p => !p.lot_id).length} trống
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadOffline}
            disabled={downloadingOffline}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-500/50 active:scale-95 transition flex items-center gap-1.5 text-xs font-bold"
            title="Tải về máy để xem khi vào kho đông không có mạng"
          >
            <Download size={14} className={downloadingOffline ? 'animate-bounce text-emerald-400' : ''} />
            <span className="hidden sm:inline">Tải xem Offline</span>
          </button>

          <button
            onClick={() => loadWarehouseMapData(true, true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95 transition"
            title="Tải lại sơ đồ kho"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-cyan-400' : ''} />
          </button>
        </div>
      </div>

      {/* ── OFFLINE STATUS BANNER (When inside cold storage without network) ── */}
      {isOffline && (
        <div className="bg-amber-950/80 border-b border-amber-500/50 px-3 py-2 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-sm">❄️</span>
            <div>
              <div className="flex items-center gap-1.5">
                <span>Đang xem Ngoại Tuyến (Offline)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 font-mono">
                  Kho đông lạnh
                </span>
              </div>
              {cachedAt && (
                <p className="text-[10px] text-amber-300/80 font-normal">
                  Bản lưu lúc: {new Date(cachedAt).toLocaleTimeString('vi-VN')} {new Date(cachedAt).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => loadWarehouseMapData(true, true)}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-bold active:scale-95 transition"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* ── SUCCESS DOWNLOAD TOAST ─────────────────────────────── */}
      {downloadToast && (
        <div className="bg-emerald-950 border-b border-emerald-500/50 px-3 py-2 flex items-center gap-2 text-xs text-emerald-200 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span className="font-semibold">{downloadToast}</span>
        </div>
      )}

      {/* ── ISOLATED SEARCH BAR (0ms Latency: typing updates only search bar) ── */}
      <WarehouseSearchBar
        uniqueProducts={uniqueProducts}
        searchQuery={searchQuery}
        onExecuteSearch={handleExecuteSearch}
        onClearSearch={handleClearSearch}
        filterDateType={filterDateType}
        onFilterDateTypeChange={setFilterDateType}
        filterStartDate={filterStartDate}
        onFilterStartDateChange={setFilterStartDate}
        filterEndDate={filterEndDate}
        onFilterEndDateChange={setFilterEndDate}
        filterRegion={filterRegion}
        onFilterRegionChange={setFilterRegion}
        availableRegions={availableRegions}
        hasActiveFilters={hasActiveFilters}
        onSetDatePreset={handleSetDatePreset}
        onResetFilters={handleResetFilters}
        isFilterOpen={isFilterOpen}
        onToggleFilterOpen={() => setIsFilterOpen(prev => !prev)}
      />

      {/* ── BỘ THỐNG KÊ KẾT QUẢ TÌM KIẾM THEO KHO (SEARCH STATS PANEL) ── */}
      {isSearchActive && (
        <div className="bg-[#0b1324] border-b border-slate-800 px-3 py-2 space-y-2 shrink-0 animate-in fade-in">
          {/* Dòng 1: Tên từ khóa & Tổng số vị trí khớp & Nút xóa */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <div className="truncate text-xs">
                {searchQuery.trim() ? (
                  <>
                    <span className="text-slate-400">Kết quả cho: </span>
                    <span className="text-amber-300 font-bold">&quot;{searchQuery}&quot;</span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-400">Lọc theo: </span>
                    <span className="text-amber-300 font-bold">
                      {(filterStartDate || filterEndDate) ? DATE_FILTER_OPTIONS.find(o => o.id === filterDateType)?.shortLabel : ''}
                      {filterRegion !== 'all' ? ` · Vùng ${filterRegion}` : ''}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-md border border-cyan-800/50">
                {matchingPositions.length} vị trí khớp
              </span>
              <button
                onClick={handleClearAllSearchAndFilters}
                className="text-[11px] font-bold text-slate-400 hover:text-rose-400 flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg hover:bg-slate-800 transition"
                title="Xóa tìm kiếm & bộ lọc"
              >
                <X size={13} />
                <span>Xóa</span>
              </button>
            </div>
          </div>

          {/* Dòng 1B: Thanh mở bộ lọc ngày tháng & vùng miền nhanh */}
          <div className="flex items-center justify-between gap-1.5 text-xs bg-slate-900/80 px-2 py-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setIsFilterOpen(prev => !prev)}
              className="text-[11px] font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 active:scale-95 transition truncate text-left"
            >
              <Calendar size={13} className="text-amber-400 shrink-0" />
              <span className="truncate">
                {hasActiveFilters
                  ? `Đang lọc: ${(filterStartDate || filterEndDate) ? DATE_FILTER_OPTIONS.find(o => o.id === filterDateType)?.shortLabel : ''}${filterRegion !== 'all' ? ` · Vùng ${filterRegion}` : ''}`
                  : 'Lọc Ngày (Đóng gói / SX / Nguyên liệu) & Vùng'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsFilterOpen(prev => !prev)}
              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 transition active:scale-95 border border-amber-500/40 shrink-0"
            >
              {isFilterOpen ? 'Đóng bộ lọc' : 'Mở bộ lọc'}
            </button>
          </div>

          {/* Dòng 2: Chuyển đổi giữa 2 tab: [Thống kê phân bổ] và [Sơ đồ vị trí] */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setSearchTab('breakdown')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${searchTab === 'breakdown'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 font-black'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <BarChart3 size={13} />
              <span>Thống kê phân bổ</span>
              {breakdownReport && breakdownReport.grandTotalQty > 0 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-black ${searchTab === 'breakdown' ? 'bg-slate-950/20 text-slate-950' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                  {formatUnitsSummary(breakdownReport.grandUnitsMap, { short: true })}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setSearchTab('map')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${searchTab === 'map'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-black'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <MapPin size={13} />
              <span>Sơ đồ vị trí</span>
            </button>
          </div>

          {/* Dòng 3: Bộ thống kê từng kho (Chỉ hiện khi ở tab Sơ đồ để click chuyển kho trên map) */}
          {searchTab === 'map' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs pt-0.5">
              <button
                onClick={() => {
                  setSelectedWarehouseId('all')
                  setSelectedAisleId(null)
                  setSelectedSlotId(null)
                  setSelectedTierId(null)
                }}
                className={`shrink-0 px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 active:scale-95 ${(!selectedWarehouseId || selectedWarehouseId === 'all')
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-black'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                  }`}
              >
                <Building2 size={12} />
                <span>Tất cả kho</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${(!selectedWarehouseId || selectedWarehouseId === 'all')
                    ? 'bg-slate-950/30 text-slate-950'
                    : 'bg-slate-800 text-cyan-300'
                  }`}>
                  {matchingPositions.length}
                </span>
              </button>

              {warehouses.map(wh => {
                const matchCount = zoneMatchCountMap.get(wh.id) || 0
                if (matchCount === 0) return null
                const isSelected = selectedWarehouseId === wh.id

                return (
                  <button
                    key={wh.id}
                    onClick={() => {
                      setSelectedWarehouseId(wh.id)
                      setSelectedAisleId(null)
                      setSelectedSlotId(null)
                      setSelectedTierId(null)
                    }}
                    className={`shrink-0 px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 active:scale-95 ${isSelected
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-amber-500/50'
                      }`}
                  >
                    <span>{wh.name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${isSelected
                        ? 'bg-slate-950/30 text-slate-950'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                      🔥 {matchCount}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── BREADCRUMB NAVIGATION (Kho > Dãy > Ô > Tầng) ─────────── */}
      {(!isSearchActive || searchTab === 'map') && (
        <div className="px-3 py-2 bg-[#0c1322] border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none text-xs">
          <button
            onClick={() => {
              setSelectedWarehouseId('all')
              setSelectedAisleId(null)
              setSelectedSlotId(null)
              setSelectedTierId(null)
            }}
            className={`shrink-0 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${(!selectedWarehouseId || selectedWarehouseId === 'all')
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
          >
            <Building2 size={13} />
            <span>Tất cả Kho</span>
          </button>

          {selectedWarehouseId && selectedWarehouseId !== 'all' && (
            <>
              <ChevronRight size={13} className="text-slate-600 shrink-0" />
              <button
                onClick={() => {
                  setSelectedAisleId(null)
                  setSelectedSlotId(null)
                  setSelectedTierId(null)
                }}
                className={`shrink-0 px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${!selectedAisleId
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
              >
                <span>{getZoneName(selectedWarehouseId)}</span>
              </button>
            </>
          )}

          {selectedAisleId && (
            <>
              <ChevronRight size={13} className="text-slate-600 shrink-0" />
              <button
                onClick={() => {
                  setSelectedSlotId(null)
                  setSelectedTierId(null)
                }}
                className={`shrink-0 px-2.5 py-1 rounded-lg font-bold transition ${!selectedSlotId
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
              >
                {getZoneName(selectedAisleId)}
              </button>
            </>
          )}

          {selectedSlotId && (
            <>
              <ChevronRight size={13} className="text-slate-600 shrink-0" />
              <button
                onClick={() => setSelectedTierId(null)}
                className={`shrink-0 px-2.5 py-1 rounded-lg font-bold transition ${!selectedTierId
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
              >
                {getZoneName(selectedSlotId)}
              </button>
            </>
          )}

          {selectedTierId && (
            <>
              <ChevronRight size={13} className="text-slate-600 shrink-0" />
              <span className="shrink-0 px-2.5 py-1 rounded-lg bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30">
                {getZoneName(selectedTierId)}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── MAIN CONTENT AREA ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-2 text-slate-400">
            <RefreshCw size={28} className="animate-spin text-cyan-400" />
            <p className="text-xs">Đang tải sơ đồ kho...</p>
          </div>
        ) : (isSearchActive && searchTab === 'breakdown' && breakdownReport) ? (
          /* ── BẢNG THỐNG KÊ KẾ TOÁN: PHÂN BỔ TỒN KHO (KHO -> DÃY -> Ô) ── */
          <div className="space-y-3 animate-in fade-in pb-10">
            {/* Header Tổng Quan Kế Toán */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-[#0e1726] border border-amber-500/30 rounded-2xl p-3 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 size={14} className="text-amber-400" />
                  <span>BẢNG THỐNG KÊ PHÂN BỔ TỒN KHO</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExpandAll}
                    className="text-[10px] text-slate-400 hover:text-cyan-300 underline active:scale-95 transition"
                  >
                    Mở rộng
                  </button>
                  <span className="text-slate-600 text-[10px]">•</span>
                  <button
                    type="button"
                    onClick={handleCollapseAll}
                    className="text-[10px] text-slate-400 hover:text-cyan-300 underline active:scale-95 transition"
                  >
                    Thu gọn
                  </button>
                </div>
              </div>

              {/* 3 Thẻ số liệu KPI */}
              <div className="grid grid-cols-3 gap-2">
                {(() => {
                  const entries = Array.from(breakdownReport.grandUnitsMap.entries()).filter(([_, q]) => q > 0)
                  entries.sort(([uA], [uB]) => {
                    const priority = (u: string) => (u === 'Thùng' ? 1 : u === 'Kg' ? 2 : u === 'Sọt' ? 3 : 4)
                    const pA = priority(uA)
                    const pB = priority(uB)
                    if (pA !== pB) return pA - pB
                    return uA.localeCompare(uB)
                  })

                  if (entries.length <= 1) {
                    const [unit, qty] = entries[0] || ['Thùng', 0]
                    return (
                      <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-2.5 text-center flex flex-col justify-center min-h-[72px]">
                        <div className="text-[10px] text-slate-400 font-medium">TỔNG TỒN</div>
                        <div className="text-base font-black text-amber-300 font-mono leading-tight mt-0.5 truncate">
                          {Number.isInteger(qty) ? qty.toLocaleString('vi-VN') : Number(qty.toFixed(2)).toLocaleString('vi-VN')}
                        </div>
                        <div className="text-[10px] text-amber-400/80 font-medium">{unit}</div>
                      </div>
                    )
                  }

                  return (
                    <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-2 text-center flex flex-col justify-center min-h-[72px]">
                      <div className="text-[10px] text-slate-400 font-medium">TỔNG TỒN</div>
                      <div className="space-y-0.5 mt-0.5 overflow-y-auto max-h-[38px] scrollbar-none">
                        {entries.map(([u, q]) => (
                          <div key={u} className="text-xs font-black text-amber-300 font-mono leading-tight truncate">
                            {Number.isInteger(q) ? q.toLocaleString('vi-VN') : Number(q.toFixed(2)).toLocaleString('vi-VN')}{' '}
                            <span className="text-[10px] text-amber-400/80 font-medium">{u}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-2.5 text-center flex flex-col justify-center min-h-[72px]">
                  <div className="text-[10px] text-slate-400 font-medium">VỊ TRÍ LƯU</div>
                  <div className="text-base font-black text-cyan-300 font-mono leading-tight mt-0.5">
                    {breakdownReport.totalPositions}
                  </div>
                  <div className="text-[10px] text-cyan-400/80 font-medium">vị trí (ô)</div>
                </div>

                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-2.5 text-center flex flex-col justify-center min-h-[72px]">
                  <div className="text-[10px] text-slate-400 font-medium">SỐ KHO</div>
                  <div className="text-base font-black text-emerald-300 font-mono leading-tight mt-0.5">
                    {breakdownReport.warehouses.length}
                  </div>
                  <div className="text-[10px] text-emerald-400/80 font-medium">kho có hàng</div>
                </div>
              </div>
            </div>

            {/* Cây phân cấp Kho -> Dãy -> Ô */}
            <div className="space-y-2.5">
              {breakdownReport.warehouses.map(whAcc => {
                const isWhExpanded = expandedWhIds.has(whAcc.warehouse.id)
                return (
                  <div
                    key={whAcc.warehouse.id}
                    className="rounded-2xl border border-slate-800 bg-[#0c1424] overflow-hidden shadow-sm"
                  >
                    {/* Hàng Tiêu đề KHO */}
                    <div className="flex items-center justify-between p-2.5 hover:bg-slate-800/40 transition gap-2">
                      <button
                        type="button"
                        onClick={() => toggleWarehouseExpand(whAcc.warehouse.id)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left active:scale-[0.99] transition"
                      >
                        <span className="text-slate-400">
                          {isWhExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                        <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                          <Building2 size={13} className="text-cyan-400" />
                        </div>
                        <span className="text-xs font-bold text-white uppercase truncate">
                          {whAcc.warehouse.name}
                        </span>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-black text-amber-300 font-mono">
                            {formatUnitsSummary(whAcc.unitsMap)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {whAcc.positionCount} ô
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWarehouseId(whAcc.warehouse.id)
                            setSelectedAisleId(null)
                            setSelectedSlotId(null)
                            setSelectedTierId(null)
                            setSearchTab('map')
                          }}
                          className="px-2 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-800/60 text-[10px] font-bold flex items-center gap-1 transition shrink-0 active:scale-95"
                          title="Xem trên sơ đồ kho"
                        >
                          <MapPin size={11} />
                          <span>Sơ đồ</span>
                        </button>
                      </div>
                    </div>

                    {/* Danh sách DÃY trong kho */}
                    {isWhExpanded && (
                      <div className="p-2 space-y-2 border-t border-slate-800/70 bg-slate-950/40">
                        {whAcc.aisles.map(aisleAcc => {
                          const isAisleExpanded = expandedAisleIds.has(aisleAcc.aisle.id)
                          return (
                            <div
                              key={aisleAcc.aisle.id}
                              className="rounded-xl border border-slate-800/80 bg-[#0e182b] overflow-hidden"
                            >
                              {/* Hàng DÃY */}
                              <div className="flex items-center justify-between p-2 hover:bg-slate-800/30 transition gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleAisleExpand(aisleAcc.aisle.id)}
                                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left active:scale-[0.99] transition"
                                >
                                  <span className="text-slate-500">
                                    {isAisleExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </span>
                                  <span className="text-xs font-bold text-slate-200 truncate">
                                    {aisleAcc.aisle.name}
                                  </span>
                                </button>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right">
                                    <span className="text-xs font-bold text-amber-300 font-mono">
                                      {formatUnitsSummary(aisleAcc.unitsMap, { short: true })}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono ml-1.5">
                                      ({aisleAcc.positionCount} ô)
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedWarehouseId(whAcc.warehouse.id)
                                      setSelectedAisleId(aisleAcc.aisle.id)
                                      setSelectedSlotId(null)
                                      setSelectedTierId(null)
                                      setSearchTab('map')
                                    }}
                                    className="p-1 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition active:scale-95"
                                    title="Xem dãy này trên sơ đồ"
                                  >
                                    <ExternalLink size={12} />
                                  </button>
                                </div>
                              </div>

                              {/* Danh sách Ô trong dãy (bấm vào Ô để xổ chi tiết từng Tầng 1, Tầng 2...) */}
                              {isAisleExpanded && (
                                <div className="p-1.5 space-y-1.5 border-t border-slate-800/50 bg-[#080e1a]">
                                  {aisleAcc.slots.map(slotAcc => {
                                    const isSlotExpanded = expandedSlotIds.has(slotAcc.slot.id)
                                    const hasTiers = slotAcc.tiers && slotAcc.tiers.length > 0
                                    return (
                                      <div
                                        key={slotAcc.slot.id}
                                        className={`rounded-lg border transition overflow-hidden ${
                                          isSlotExpanded
                                            ? 'bg-[#0c1629] border-cyan-500/40'
                                            : 'bg-slate-900/60 border-slate-800/60 hover:border-cyan-500/30'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between px-2.5 py-1.5 text-xs gap-2">
                                          <button
                                            type="button"
                                            onClick={() => toggleSlotExpand(slotAcc.slot.id)}
                                            className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                                          >
                                            <span className={isSlotExpanded ? 'text-cyan-400' : 'text-slate-500'}>
                                              {isSlotExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                            </span>
                                            <span
                                              className={`font-semibold truncate ${
                                                isSlotExpanded ? 'text-cyan-300' : 'text-slate-300'
                                              }`}
                                            >
                                              {slotAcc.slot.name}
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                              ({slotAcc.positionCount} vị trí{hasTiers ? ` · ${slotAcc.tiers.length} tầng` : ''})
                                            </span>
                                          </button>

                                          <div className="flex items-center gap-2 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => toggleSlotExpand(slotAcc.slot.id)}
                                              className="text-right font-mono"
                                            >
                                              <span className="font-bold text-emerald-400">
                                                {formatUnitsSummary(slotAcc.unitsMap, { short: true })}
                                              </span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedWarehouseId(whAcc.warehouse.id)
                                                setSelectedAisleId(aisleAcc.aisle.id)
                                                if (isHallZone(aisleAcc.aisle) || slotAcc.slot.id === aisleAcc.aisle.id) {
                                                  setSelectedSlotId(null)
                                                } else {
                                                  setSelectedSlotId(slotAcc.slot.id)
                                                }
                                                setSelectedTierId(null)
                                                setSearchTab('map')
                                              }}
                                              className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline px-1 py-0.5 active:scale-95 transition"
                                              title="Nhảy đến vị trí này trên sơ đồ"
                                            >
                                              Xem vị trí
                                            </button>
                                          </div>
                                        </div>

                                        {/* Danh sách TẦNG bên trong Ô (bấm vào Tầng để xổ chi tiết Mã vị trí & Số lượng) */}
                                        {isSlotExpanded && (
                                          <div className="px-2 pb-2 pt-1.5 space-y-1.5 border-t border-slate-800/70 bg-[#060b16]">
                                            {hasTiers ? (
                                              slotAcc.tiers.map(tierAcc => {
                                                const isTierExpanded = expandedBreakdownTierIds.has(tierAcc.tier.id)

                                                return (
                                                  <div
                                                    key={tierAcc.tier.id}
                                                    className={`rounded-lg border transition overflow-hidden ${
                                                      isTierExpanded
                                                        ? 'bg-[#111b2e] border-amber-500/40'
                                                        : 'bg-[#0d1729] border-slate-800/80 hover:border-amber-500/30'
                                                    }`}
                                                  >
                                                    <div className="flex items-center justify-between px-2 py-1.5 gap-2">
                                                      <button
                                                        type="button"
                                                        onClick={() => toggleBreakdownTierExpand(tierAcc.tier.id)}
                                                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                                                      >
                                                        <span className={isTierExpanded ? 'text-amber-400' : 'text-slate-400'}>
                                                          {isTierExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-[10.5px] font-extrabold text-amber-300">
                                                          <Layers size={11} className="text-amber-400" />
                                                          {tierAcc.tier.name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                          ({tierAcc.positionCount} vị trí)
                                                        </span>
                                                      </button>

                                                      <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                          type="button"
                                                          onClick={() => toggleBreakdownTierExpand(tierAcc.tier.id)}
                                                          className="text-xs font-extrabold text-amber-400 font-mono"
                                                        >
                                                          {formatUnitsSummary(tierAcc.unitsMap, { short: true })}
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setSelectedWarehouseId(whAcc.warehouse.id)
                                                            setSelectedAisleId(aisleAcc.aisle.id)
                                                            setSelectedSlotId(slotAcc.slot.id)
                                                            setSelectedTierId(tierAcc.tier.id)
                                                            setExpandedTierIds(new Set([tierAcc.tier.id]))
                                                            if (tierAcc.positions[0]) {
                                                              setHighlightedPosId(tierAcc.positions[0].id)
                                                            }
                                                            setSearchTab('map')
                                                          }}
                                                          className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/70 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition"
                                                        >
                                                          Xem tầng
                                                        </button>
                                                      </div>
                                                    </div>

                                                    {/* Bấm vào Tầng mới hiện chi tiết từng Mã vị trí + Số lượng */}
                                                    {isTierExpanded && (
                                                      <div className="px-2 pb-2 pt-1.5 space-y-1 border-t border-slate-800/70 bg-[#070c17]">
                                                        {sortPositionsByDepthAndCol(tierAcc.positions).map(pos => (
                                                          <button
                                                            key={pos.id}
                                                            type="button"
                                                            onClick={() => setSelectedPosDetail(pos)}
                                                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-800/80 text-xs transition"
                                                          >
                                                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                              <MapPin size={11} className="text-sky-400 shrink-0" />
                                                              <span className="font-mono font-extrabold text-sky-300">
                                                                {pos.code}
                                                              </span>
                                                              {pos.stt && (
                                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 font-bold">
                                                                  #{pos.stt}
                                                                </span>
                                                              )}
                                                              {pos.material_zone && (
                                                                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium">
                                                                  {pos.material_zone}
                                                                </span>
                                                              )}
                                                              {pos.packaging_date && (
                                                                <span className="text-[9px] text-slate-400 font-mono">
                                                                  {pos.packaging_date.split('-').reverse().slice(0, 2).join('/')}
                                                                </span>
                                                              )}
                                                            </div>
                                                            <span className="font-mono font-extrabold text-emerald-400 shrink-0">
                                                              {pos.quantity || 0}{' '}
                                                              {getCleanUnitCategory(pos.unit) === 'Thùng'
                                                                ? 'th'
                                                                : getCleanUnitCategory(pos.unit)}
                                                            </span>
                                                          </button>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </div>
                                                )
                                              })
                                            ) : (
                                              <div className="space-y-1 pt-0.5">
                                                {sortPositionsByDepthAndCol(slotAcc.positions).map(pos => (
                                                  <button
                                                    key={pos.id}
                                                    type="button"
                                                    onClick={() => setSelectedPosDetail(pos)}
                                                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-800/80 text-xs transition"
                                                  >
                                                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                      <MapPin size={11} className="text-sky-400 shrink-0" />
                                                      <span className="font-mono font-extrabold text-sky-300">
                                                        {pos.code}
                                                      </span>
                                                      {pos.stt && (
                                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 font-bold">
                                                          #{pos.stt}
                                                        </span>
                                                      )}
                                                    </div>
                                                    <span className="font-mono font-extrabold text-emerald-400 shrink-0">
                                                      {pos.quantity || 0}{' '}
                                                      {getCleanUnitCategory(pos.unit) === 'Thùng'
                                                        ? 'th'
                                                        : getCleanUnitCategory(pos.unit)}
                                                    </span>
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (!selectedWarehouseId || selectedWarehouseId === 'all') ? (
          /* ── LEVEL 0: DANH SÁCH CÁC KHO (TẤT CẢ KHO) ──────────────── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={14} className="text-cyan-400" />
                <span>CHỌN KHO (TẤT CẢ KHO):</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {visibleWarehouses.length} kho
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {visibleWarehouses.map(wh => {
                const stats = zoneStatsMap.get(wh.id) || { total: 0, occupied: 0, empty: 0 }
                const pct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0
                const whMatchCount = zoneMatchCountMap.get(wh.id) || 0
                const breakdown = getWhBreakdown(wh.id)

                return (
                  <button
                    key={wh.id}
                    onClick={() => {
                      setSelectedWarehouseId(wh.id)
                      setSelectedAisleId(null)
                      setSelectedSlotId(null)
                      setSelectedTierId(null)
                    }}
                    className={`p-3 rounded-xl bg-[#111827] border text-left transition hover:bg-slate-900 active:scale-[0.99] space-y-2 group ${whMatchCount > 0 ? 'border-cyan-500/80 shadow-lg shadow-cyan-500/10' : 'border-slate-800 hover:border-cyan-500/50'
                      }`}
                  >
                    {/* Header: Tên Kho & Nút Xem Dãy */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-cyan-400 shrink-0">
                          <Building2 size={16} />
                        </span>
                        <span className="font-black text-sm text-white group-hover:text-cyan-300 transition truncate">
                          {wh.name}
                        </span>
                      </div>
                      {isSearchActive && whMatchCount > 0 ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black shrink-0 animate-pulse">
                          🔥 {whMatchCount} khớp
                        </span>
                      ) : (
                        <span className="text-xs text-cyan-400 font-bold flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                          <span>Xem Dãy →</span>
                        </span>
                      )}
                    </div>

                    {/* Thống kê Tổng, Đã chứa, Trống */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Tổng: <strong className="text-white font-mono">{stats.total}</strong></span>
                      <span>Đã chứa: <strong className="text-amber-400 font-mono">{stats.occupied}</strong></span>
                      <span>Còn trống: <strong className="text-emerald-400 font-mono">{stats.empty}</strong></span>
                    </div>

                    {/* Chi tiết phụ: Kệ & Sảnh */}
                    {(breakdown.rackTotal > 0 || breakdown.hallTotal > 0) && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400/90 pt-1 border-t border-slate-800/60">
                        <span>Kệ: <strong className="text-slate-300 font-mono">{breakdown.rackTotal}</strong> ({breakdown.rackOccupied} có hàng)</span>
                        {breakdown.hallTotal > 0 && (
                          <span className="text-emerald-400 font-medium">Sảnh: <strong className="font-mono">{breakdown.hallTotal}</strong> ({breakdown.hallOccupied})</span>
                        )}
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : !selectedAisleId ? (
          /* ── LEVEL 1: DANH SÁCH DÃY / SẢNH TRONG KHO ĐANG CHỌN ────── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedWarehouseId('all')
                  setSelectedAisleId(null)
                  setSelectedSlotId(null)
                  setSelectedTierId(null)
                }}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
              >
                <ArrowLeft size={14} />
                <span>Quay lại danh sách Kho</span>
              </button>
              <span className="text-[10px] text-slate-500 font-mono">
                {aisles.length} phân khu
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-cyan-400" />
                <span>
                  CHỌN DÃY / SẢNH ({getZoneName(selectedWarehouseId)}):
                </span>
              </span>
            </div>

            {/* Switch Warehouse Pills */}
            {warehouses.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => {
                    setSelectedWarehouseId('all')
                    setSelectedAisleId(null)
                    setSelectedSlotId(null)
                    setSelectedTierId(null)
                  }}
                  className="px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition flex items-center gap-1.5 bg-slate-800 text-slate-400 hover:text-white"
                >
                  <ArrowLeft size={13} />
                  <span>TẤT CẢ KHO</span>
                </button>

                {warehouses.map(wh => {
                  const whMatchCount = zoneMatchCountMap.get(wh.id) || 0
                  return (
                    <button
                      key={wh.id}
                      onClick={() => {
                        setSelectedWarehouseId(wh.id)
                        setSelectedAisleId(null)
                        setSelectedSlotId(null)
                        setSelectedTierId(null)
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition flex items-center gap-1.5 ${wh.id === selectedWarehouseId
                          ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/30'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                    >
                      <Building2 size={13} />
                      <span>{wh.name}</span>
                      {isSearchActive && whMatchCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                          {whMatchCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2.5">
              {aisles.map(aisle => {
                const stats = zoneStatsMap.get(aisle.id) || { total: 0, occupied: 0, empty: 0 }
                const pct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0
                const aisleMatchCount = zoneMatchCountMap.get(aisle.id) || 0
                const isHall = isHallZone(aisle)

                return (
                  <button
                    key={aisle.id}
                    onClick={() => {
                      setSelectedAisleId(aisle.id)
                      setSelectedSlotId(null)
                      setSelectedTierId(null)
                    }}
                    className={`p-3.5 rounded-2xl bg-[#111827] border text-left transition hover:bg-slate-900 active:scale-[0.99] space-y-2 group ${aisleMatchCount > 0 ? 'border-cyan-500/80 shadow-lg shadow-cyan-500/10' : 'border-slate-800 hover:border-cyan-500/50'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-white group-hover:text-cyan-300 transition flex items-center gap-1.5">
                        {isHall ? '🏢' : '🚪'} {aisle.name}
                        {isHall && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            SẢNH
                          </span>
                        )}
                      </span>
                      {isSearchActive && aisleMatchCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black animate-pulse">
                          🔥 {aisleMatchCount} khớp
                        </span>
                      ) : (
                        <span className="text-xs text-cyan-400 font-bold flex items-center gap-0.5">
                          {isHall ? 'Xem vị trí →' : 'Xem Ô →'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Tổng: <strong className="text-white font-mono">{stats.total}</strong></span>
                      <span>Đã chứa: <strong className="text-amber-400 font-mono">{stats.occupied}</strong></span>
                      <span>Còn trống: <strong className="text-emerald-400 font-mono">{stats.empty}</strong></span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : isSelectedAisleHall ? (
          /* ── LEVEL 2-HALL: LƯỚI VỊ TRÍ TRONG SẢNH (HALL POSITIONS) ────────────────── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedAisleId(null)
                  setSelectedSlotId(null)
                  setSelectedTierId(null)
                }}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
              >
                <ArrowLeft size={14} />
                <span>Quay lại Dãy / Sảnh</span>
              </button>
              <div className="flex items-center gap-2">
                {isSearchActive && (
                  <button
                    onClick={() => setOnlyShowMatches(!onlyShowMatches)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${onlyShowMatches
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30'
                        : 'bg-amber-950/40 text-amber-300 border border-amber-500/40 hover:bg-amber-900/40'
                      }`}
                  >
                    ⭐ {onlyShowMatches ? 'Hiện tất cả' : 'Chỉ vị trí khớp'}
                  </button>
                )}
                <span className="text-[10px] text-slate-400 font-mono">
                  {currentPositions.length} vị trí
                </span>
              </div>
            </div>

            {/* Hall Banner / Info */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-xs uppercase shadow-sm">
                  SẢNH
                </span>
                <span className="font-black text-sm text-white uppercase tracking-wide">
                  {getZoneName(selectedAisleId)}
                </span>
              </div>
              <div className="text-right text-xs font-mono">
                <span className="text-amber-400 font-bold">
                  {currentPositions.filter(p => p.lot_id).length} có hàng
                </span>
                <span className="text-slate-500 mx-1">/</span>
                <span className="text-emerald-400 font-bold">
                  {currentPositions.filter(p => !p.lot_id).length} trống
                </span>
              </div>
            </div>

            {/* Visual Grid of Positions in Hall */}
            {currentPositions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Chưa có dữ liệu vị trí nào trong sảnh này.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {currentPositions.map(pos => {
                  const isOccupied = !!pos.lot_id
                  const isHighlighted = pos.id === highlightedPosId
                  const isMatched = matchingPosIds.has(pos.id)

                  return (
                    <button
                      key={pos.id}
                      onClick={() => setSelectedPosDetail(pos)}
                      className={`p-2.5 rounded-xl border text-left transition relative active:scale-[0.98] flex flex-col justify-between min-h-[74px] ${isHighlighted
                          ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/50 shadow-lg'
                          : isMatched
                            ? 'border-amber-400/90 ring-1 ring-amber-400/50 bg-gradient-to-b from-amber-950/50 to-[#131d33] shadow-md shadow-amber-500/20'
                            : isOccupied
                              ? 'bg-[#131d33] border-cyan-500/50 hover:border-cyan-400'
                              : 'bg-slate-900/60 border-slate-700/80 hover:border-emerald-500/60'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-1 w-full">
                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                          <span className="font-mono font-bold text-[9px] text-slate-200 truncate" title={pos.code}>
                            {pos.code}
                          </span>
                          {pos.inbound_date && (
                            <span className="px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 font-mono font-bold text-[7.8px] shrink-0" title={`Nhập kho: ${formatDateVN(pos.inbound_date)}`}>
                              {formatDateShortVN(pos.inbound_date)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isMatched && (
                            <span className="px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[8px] animate-pulse">
                              ⭐ Khớp
                            </span>
                          )}
                          {isOccupied ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-black text-[9px] shadow-xs">
                              #{pos.stt || 'LOT'}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[8px] font-bold">
                              TRỐNG
                            </span>
                          )}
                        </div>
                      </div>

                      {isOccupied ? (
                        <div className="space-y-0.5 w-full mt-1">
                          <p className="font-bold text-[9.5px] text-white break-words leading-tight" title={pos.product_name || ''}>
                            {pos.product_name || 'Hàng đông lạnh'}
                          </p>
                          <div className="flex items-center justify-between text-[9px] font-mono pt-0.5">
                            {getPositionTag(pos) ? (
                              <span className="truncate max-w-[95px] text-cyan-300 font-bold" title={getPositionTag(pos)!}>
                                TAG: {getPositionTag(pos)}
                              </span>
                            ) : <span />}
                            {pos.quantity ? <span className="text-amber-300 font-bold shrink-0">{formatPositionQtyUnit(pos.quantity, pos.unit)}</span> : null}
                          </div>
                        </div>
                      ) : (
                        <div className="w-full text-center py-1 text-[10px] text-emerald-500/70 font-medium">
                          + Vị trí trống
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : !selectedSlotId ? (
          /* ── LEVEL 2: DANH SÁCH Ô TRONG DÃY / SẢNH ────────────────── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedAisleId(null)}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
              >
                <ArrowLeft size={14} />
                <span>Quay lại Dãy</span>
              </button>
              <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">
                Bước 3: Chọn Ô ({getZoneName(selectedAisleId)})
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {slots.length} ô gộp
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {slots.map(slot => {
                const stats = zoneStatsMap.get(slot.id) || { total: 0, occupied: 0, empty: 0 }
                const pct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0
                const slotMatchCount = zoneMatchCountMap.get(slot.id) || 0

                return (
                  <button
                    key={slot.id}
                    onClick={() => {
                      setSelectedSlotId(slot.id)
                      setSelectedTierId(null)
                    }}
                    className={`p-3.5 rounded-2xl bg-[#111827] border text-center transition hover:bg-slate-900 active:scale-[0.98] space-y-1.5 group shadow-sm flex flex-col items-center justify-between min-h-[112px] ${slotMatchCount > 0 ? 'border-cyan-500/80 shadow-md shadow-cyan-500/10' : 'border-slate-800 hover:border-emerald-500/80'
                      }`}
                  >
                    <div className="font-black text-base uppercase text-white group-hover:text-emerald-300 transition tracking-wide flex items-center justify-center gap-1.5 w-full">
                      <span>{slot.name}</span>
                      {isSearchActive && slotMatchCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                          ⚡ {slotMatchCount}
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-bold text-emerald-400 font-mono">
                      Trống {stats.empty}
                    </div>

                    <div className="w-full flex items-center justify-between text-[11px] text-slate-400 font-mono pt-0.5">
                      <span className="whitespace-nowrap">{stats.occupied}/{stats.total} vị trí</span>
                      <span className="whitespace-nowrap">{pct}%</span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          /* ── LEVEL 3: LƯỚI VỊ TRÍ CỤ THỂ TRONG TỪNG TẦNG CỦA Ô ─────── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedSlotId(null)}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
              >
                <ArrowLeft size={14} />
                <span>Quay lại Ô kệ</span>
              </button>
              <div className="flex items-center gap-2">
                {isSearchActive && (
                  <button
                    onClick={() => setOnlyShowMatches(!onlyShowMatches)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${onlyShowMatches
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30'
                        : 'bg-amber-950/40 text-amber-300 border border-amber-500/40 hover:bg-amber-900/40'
                      }`}
                  >
                    ⭐ {onlyShowMatches ? 'Hiện tất cả' : 'Chỉ vị trí khớp'}
                  </button>
                )}
                <span className="text-[10px] text-slate-400 font-mono">
                  {currentPositions.length} vị trí
                </span>
              </div>
            </div>

            {/* Horizontal Tiers Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                onClick={() => setSelectedTierId(null)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${!selectedTierId
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
              >
                Tất cả các Tầng ({currentPositions.length})
              </button>

              {tiers.map(tier => {
                const stats = zoneStatsMap.get(tier.id) || { total: 0, occupied: 0, empty: 0 }
                const tierMatchCount = zoneMatchCountMap.get(tier.id) || 0
                return (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTierId(tier.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${selectedTierId === tier.id
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                  >
                    <span>{tier.name}</span>
                    <span className="text-[10px] opacity-80 font-mono">({stats.occupied}/{stats.total})</span>
                    {isSearchActive && tierMatchCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black">
                        {tierMatchCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Visual Grid of Positions in this Tier/Slot */}
            {currentPositions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Chưa có dữ liệu vị trí nào trong khu vực này.
              </div>
            ) : !selectedTierId ? (
              /* When "Tất cả các tầng": Render as clean vertical shelves with expand/collapse control */
              <div className="space-y-2.5">
                {/* 2 nút Mở tất cả & Thu tất cả */}
                <div className="flex items-center justify-between px-1 text-xs pb-0.5">
                  <span className="text-[11px] font-bold text-slate-400">
                    Chi tiết theo tầng ({tiers.length} tầng):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleExpandAllTiers}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-cyan-300 hover:bg-slate-700 border border-slate-700 transition active:scale-95 flex items-center gap-1 shadow-xs"
                    >
                      <span>+ Mở tất cả</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCollapseAllTiers}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition active:scale-95 flex items-center gap-1 shadow-xs"
                    >
                      <span>− Thu tất cả</span>
                    </button>
                  </div>
                </div>

                {tiers.map(tier => {
                  let tierPositions = tierPositionsMap.get(tier.id) || []
                  if (onlyShowMatches && isSearchActive) {
                    tierPositions = tierPositions.filter(p => matchingPosIds.has(p.id))
                  }
                  const stats = zoneStatsMap.get(tier.id) || { total: 0, occupied: 0, empty: 0 }
                  const tierMatchCount = zoneMatchCountMap.get(tier.id) || 0
                  const isExpanded = expandedTierIds.has(tier.id)
                  if (tierPositions.length === 0) return null

                  return (
                    <div
                      key={tier.id}
                      className={`rounded-2xl bg-[#0f172a] border transition-all shadow-sm overflow-hidden ${isExpanded ? 'border-slate-800/90' : 'border-slate-800/60 hover:border-slate-700'
                        }`}
                    >
                      {/* Tiêu đề tầng bấm vào để thu gọn / mở rộng */}
                      <button
                        type="button"
                        onClick={() => toggleTierExpand(tier.id)}
                        className={`w-full p-3 flex items-center justify-between text-left transition select-none group ${isExpanded ? 'border-b border-slate-800/80 bg-slate-900/40' : 'hover:bg-slate-800/30'
                          }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-slate-500 group-hover:text-cyan-400 transition shrink-0">
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </span>
                          <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                          <span className="font-black text-xs text-white uppercase tracking-wider group-hover:text-cyan-300 transition">
                            {tier.name}
                          </span>
                          <span className="text-[10px] text-cyan-300 font-mono">
                            ({stats.occupied}/{stats.total} vị trí có hàng)
                          </span>
                          {isSearchActive && tierMatchCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black shrink-0">
                              ⚡ {tierMatchCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold text-emerald-400 font-mono">
                            {stats.empty} trống
                          </span>
                        </div>
                      </button>

                      {/* Lưới các vị trí trong tầng - chỉ hiện khi mở rộng */}
                      {isExpanded && (
                        <div className="p-3 grid grid-cols-2 gap-2 animate-in fade-in duration-150">
                          {tierPositions.map(pos => {
                            const isOccupied = !!pos.lot_id
                            const isHighlighted = pos.id === highlightedPosId
                            const isMatched = matchingPosIds.has(pos.id)

                            return (
                              <button
                                key={pos.id}
                                onClick={() => setSelectedPosDetail(pos)}
                                className={`p-2.5 rounded-xl border text-left transition relative active:scale-[0.98] flex flex-col justify-between min-h-[74px] ${isHighlighted
                                    ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/50 shadow-lg'
                                    : isMatched
                                      ? 'border-amber-400/90 ring-1 ring-amber-400/50 bg-gradient-to-b from-amber-950/50 to-[#131d33] shadow-md shadow-amber-500/20'
                                      : isOccupied
                                        ? 'bg-[#131d33] border-cyan-500/50 hover:border-cyan-400'
                                        : 'bg-slate-900/60 border-slate-700/80 hover:border-emerald-500/60'
                                  }`}
                              >
                                <div className="flex items-center justify-between gap-1 w-full">
                                  <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                    <span className="font-mono font-bold text-[9px] text-slate-200 truncate" title={pos.code}>
                                      {pos.code}
                                    </span>
                                    {pos.inbound_date && (
                                      <span className="px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 font-mono font-bold text-[7.8px] shrink-0" title={`Nhập kho: ${formatDateVN(pos.inbound_date)}`}>
                                        {formatDateShortVN(pos.inbound_date)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {isOccupied ? (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-black text-[9px] shadow-xs">
                                        #{pos.stt || 'LOT'}
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[8px] font-bold">
                                        TRỐNG
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {isOccupied ? (
                                  <div className="space-y-0.5 w-full mt-1">
                                    <p className="font-bold text-[9.5px] text-white break-words leading-tight" title={pos.product_name || ''}>
                                      {pos.product_name || 'Hàng đông lạnh'}
                                    </p>
                                    <div className="flex items-center justify-between text-[9px] font-mono pt-0.5">
                                      {getPositionTag(pos) ? (
                                        <span className="truncate max-w-[95px] text-cyan-300 font-bold" title={getPositionTag(pos)!}>
                                          TAG: {getPositionTag(pos)}
                                        </span>
                                      ) : <span />}
                                      {pos.quantity ? <span className="text-amber-300 font-bold shrink-0">{formatPositionQtyUnit(pos.quantity, pos.unit)}</span> : null}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-full text-center py-1 text-[10px] text-emerald-500/70 font-medium">
                                    + Vị trí trống
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              /* When specific Tier selected: Render only that Tier */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="font-black text-xs text-cyan-300 uppercase flex items-center gap-1.5">
                    <span>🏢 {getZoneName(selectedTierId)}</span>
                    <span className="text-[10px] text-slate-400 font-mono font-normal">
                      ({currentPositions.filter(p => p.lot_id).length}/{currentPositions.length} vị trí có hàng)
                    </span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    {currentPositions.filter(p => !p.lot_id).length} trống
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {currentPositions.map(pos => {
                    const isOccupied = !!pos.lot_id
                    const isHighlighted = pos.id === highlightedPosId
                    const isMatched = matchingPosIds.has(pos.id)

                    return (
                      <button
                        key={pos.id}
                        onClick={() => setSelectedPosDetail(pos)}
                        className={`p-2.5 rounded-xl border text-left transition relative active:scale-[0.98] flex flex-col justify-between min-h-[74px] ${isHighlighted
                            ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/50 shadow-lg'
                            : isMatched
                              ? 'border-amber-400/90 ring-1 ring-amber-400/50 bg-gradient-to-b from-amber-950/50 to-[#131d33] shadow-md shadow-amber-500/20'
                              : isOccupied
                                ? 'bg-[#131d33] border-cyan-500/50 hover:border-cyan-400'
                                : 'bg-slate-900/60 border-slate-700/80 hover:border-emerald-500/60'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            <span className="font-mono font-bold text-[9px] text-slate-200 truncate" title={pos.code}>
                              {pos.code}
                            </span>
                            {pos.inbound_date && (
                              <span className="px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 font-mono font-bold text-[7.8px] shrink-0" title={`Nhập kho: ${formatDateVN(pos.inbound_date)}`}>
                                {formatDateShortVN(pos.inbound_date)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isOccupied ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-black text-[9px] shadow-xs">
                                #{pos.stt || 'LOT'}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[8px] font-bold">
                                TRỐNG
                              </span>
                            )}
                          </div>
                        </div>

                        {isOccupied ? (
                          <div className="space-y-0.5 w-full mt-1">
                            <p className="font-bold text-[9.5px] text-white break-words leading-tight" title={pos.product_name || ''}>
                              {pos.product_name || 'Hàng đông lạnh'}
                            </p>
                            <div className="flex items-center justify-between text-[9px] font-mono pt-0.5">
                              {getPositionTag(pos) ? (
                                <span className="truncate max-w-[95px] text-cyan-300 font-bold" title={getPositionTag(pos)!}>
                                  TAG: {getPositionTag(pos)}
                                </span>
                              ) : <span />}
                              {pos.quantity ? <span className="text-amber-300 font-bold shrink-0">{formatPositionQtyUnit(pos.quantity, pos.unit)}</span> : null}
                            </div>
                          </div>
                        ) : (
                          <div className="w-full text-center py-1 text-[10px] text-emerald-500/70 font-medium">
                            + Vị trí trống
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL: CHI TIẾT VỊ TRÍ KHO & PALLET ───────────────────── */}
      {selectedPosDetail && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-cyan-500/40 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-cyan-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                  VỊ TRÍ: {selectedPosDetail.code}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPosDetail(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Status Pill */}
            {selectedPosDetail.lot_id ? (
              <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-amber-400" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">TRẠNG THÁI:</span>
                    <strong className="text-xs text-amber-300">ĐÃ CÓ PALLET HÀNG</strong>
                  </div>
                </div>
                {selectedPosDetail.stt && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-mono font-black text-sm shadow-md">
                    STT: {selectedPosDetail.stt}
                  </span>
                )}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center gap-2 text-emerald-300 text-xs font-bold">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <span>Vị trí hiện đang TRỐNG · Sẵn sàng để xếp Pallet mới</span>
              </div>
            )}

            {/* Position Details if Occupied */}
            {selectedPosDetail.lot_id && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">SẢN PHẨM / PHÂN LOẠI:</span>
                  <p className="font-bold text-white text-sm leading-snug">
                    {selectedPosDetail.product_name || 'Hàng đông lạnh'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">MÃ LOT:</span>
                    <strong className="text-cyan-300 font-mono font-bold text-xs">
                      {selectedPosDetail.lot_code || '---'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">SKU:</span>
                    <strong className="text-slate-200 font-mono">
                      {selectedPosDetail.sku || '---'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">SỐ LƯỢNG:</span>
                    <strong className="text-emerald-400 font-mono font-bold text-xs">
                      {selectedPosDetail.quantity ? `${selectedPosDetail.quantity} ${selectedPosDetail.unit || 'Thùng'}` : '---'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">NGÀY ĐÓNG GÓI:</span>
                    <strong className="text-amber-400 font-mono">
                      {formatDateVN(selectedPosDetail.packaging_date)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">NGÀY SX (BÓC MÚI):</span>
                    <strong className="text-amber-300 font-mono">
                      {formatDateVN(selectedPosDetail.peeling_date)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">NGÀY NGUYÊN LIỆU:</span>
                    <strong className="text-slate-300 font-mono">
                      {formatDateVN(selectedPosDetail.raw_material_date)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">NGÀY NHẬP KHO:</span>
                    <strong className="text-slate-300 font-mono">
                      {formatDateVN(selectedPosDetail.inbound_date)}
                    </strong>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-800 grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 block text-[10px] font-semibold mb-0.5"># MÃ SẢN XUẤT</span>
                      <strong className="text-slate-200 text-xs font-mono">
                        {selectedPosDetail.production_code || '---'}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 block text-[10px] font-semibold mb-0.5">📍 VÙNG NGUYÊN LIỆU</span>
                      <strong className="text-emerald-400 text-xs font-medium">
                        {selectedPosDetail.material_zone || '---'}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 block text-[10px] font-semibold mb-0.5">🏭 NƠI SẢN XUẤT</span>
                      <strong className="text-blue-400 text-xs font-medium">
                        {selectedPosDetail.production_place || '---'}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 block text-[10px] font-semibold mb-0.5">ℹ️ THÔNG TIN THÊM</span>
                      <strong className="text-slate-300 text-xs">
                        {selectedPosDetail.extra_info || '---'}
                      </strong>
                    </div>
                  </div>

                  {selectedPosDetail.tags && selectedPosDetail.tags.length > 0 && (
                    <div className="col-span-2 pt-1 border-t border-slate-800">
                      <span className="text-slate-500 block text-[10px] mb-1">THẺ PHÂN LOẠI (TAGS):</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedPosDetail.tags.map((tg, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold"
                          >
                            🏷️ {tg}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedPosDetail(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
