'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { MapPin, Calendar, Building2, X, BarChart3 } from 'lucide-react'
import type { DateFilterType, ZoneItem, PositionItem } from './types'
import { DATE_FILTER_OPTIONS } from './types'
import { formatUnitsSummary } from './mapHelpers'

interface SearchStatsPanelProps {
  isSearchActive: boolean
  matchingPositions: PositionItem[]
  searchQuery: string
  hasActiveFilters: boolean
  filterDateType: DateFilterType
  filterStartDate: string
  filterEndDate: string
  filterRegion: string
  isFilterOpen: boolean
  setIsFilterOpen: React.Dispatch<React.SetStateAction<boolean>>
  handleClearAllSearchAndFilters: () => void
  searchTab: 'map' | 'breakdown'
  setSearchTab: React.Dispatch<React.SetStateAction<'map' | 'breakdown'>>
  breakdownReport: any
  warehouses: ZoneItem[]
  selectedWarehouseId: string | null
  setSelectedWarehouseId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedAisleId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedSlotId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedTierId: React.Dispatch<React.SetStateAction<string | null>>
  zoneMatchCountMap: Map<string, number>
}

export function SearchStatsPanel({
  isSearchActive,
  matchingPositions,
  searchQuery,
  hasActiveFilters,
  filterDateType,
  filterStartDate,
  filterEndDate,
  filterRegion,
  isFilterOpen,
  setIsFilterOpen,
  handleClearAllSearchAndFilters,
  searchTab,
  setSearchTab,
  breakdownReport,
  warehouses,
  selectedWarehouseId,
  setSelectedWarehouseId,
  setSelectedAisleId,
  setSelectedSlotId,
  setSelectedTierId,
  zoneMatchCountMap,
}: SearchStatsPanelProps) {
  return (
    <>
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
    </>
  )
}
