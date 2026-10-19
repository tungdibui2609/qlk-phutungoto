'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  Sparkles,
  Info,
  Check
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { decodeSTT } from '@/lib/numberUtils'

interface ZoneItem {
  id: string
  name: string
  parent_id: string | null
  system_type: string
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
  packaging_date?: string | null
  inbound_date?: string | null
  quantity?: number | null
}

export default function WarehouseMapTab() {
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [zones, setZones] = useState<ZoneItem[]>([])
  const [positions, setPositions] = useState<PositionItem[]>([])

  // Hierarchy Navigation States: Kho -> Dãy / Sảnh -> Ô -> Tầng
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)
  const [selectedAisleId, setSelectedAisleId] = useState<string | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [highlightedPosId, setHighlightedPosId] = useState<string | null>(null)

  // Position detail modal
  const [selectedPosDetail, setSelectedPosDetail] = useState<PositionItem | null>(null)

  // ── Fetch Master Data (Zones, Positions, Lots, Pending) ─────────
  const loadWarehouseMapData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      // 1. Fetch Zones for Cold Storage
      const { data: zonesData } = await (supabase
        .from('zones') as any)
        .select('id, name, parent_id, system_type')
        .eq('system_type', 'KHO_DONG_LANH')

      const rawZones: ZoneItem[] = zonesData || []
      setZones(rawZones)

      // 2. Fetch all positions & zone associations
      const [posRes, zpRes] = await Promise.all([
        (supabase.from('positions') as any)
          .select('id, code, lot_id, system_type')
          .eq('system_type', 'KHO_DONG_LANH'),
        (supabase.from('zone_positions') as any).select('position_id, zone_id')
      ])

      const rawPositions = posRes.data || []
      const zpList = zpRes.data || []

      // Map zone_ids to positions
      const zpMap = new Map<string, string[]>()
      zpList.forEach((item: any) => {
        const list = zpMap.get(item.position_id) || []
        list.push(item.zone_id)
        zpMap.set(item.position_id, list)
      })

      // 3. Fetch Lots information for occupied positions
      const occupiedLotIds = Array.from(new Set(rawPositions.map((p: any) => p.lot_id).filter(Boolean)))
      let lotMap = new Map<string, any>()

      if (occupiedLotIds.length > 0) {
        // Chunk requests if large
        const { data: lotsData } = await supabase
          .from('lots')
          .select(`
            id,
            code,
            daily_seq,
            packaging_date,
            inbound_date,
            quantity,
            products ( name, sku ),
            lot_items ( products ( name, sku ) )
          `)
          .in('id', occupiedLotIds)

        lotsData?.forEach((l: any) => {
          const prodName =
            l.products?.name ||
            l.lot_items?.[0]?.products?.name ||
            'Hàng đông lạnh'
          const sku =
            l.products?.sku ||
            l.lot_items?.[0]?.products?.sku ||
            'SKU'

          lotMap.set(l.id, {
            code: l.code,
            stt: l.daily_seq ? decodeSTT(l.daily_seq) : null,
            product_name: prodName,
            sku,
            packaging_date: l.packaging_date,
            inbound_date: l.inbound_date,
            quantity: l.quantity
          })
        })
      }

      // 4. Fetch pending assignments for real-time STTs
      const { data: pendingData } = await (supabase.from('pending_assignments') as any)
        .select('position_id, lot_stt, production_date')
        .eq('system_code', 'KHO_DONG_LANH')
        .eq('status', 'pending')

      const pendingMap = new Map<string, any>()
      pendingData?.forEach((p: any) => {
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
          packaging_date: pkgDate,
          inbound_date: lotInfo?.inbound_date || null,
          quantity: lotInfo?.quantity || null
        }
      })

      setPositions(formattedPositions)

      // Auto-select first warehouse if none selected
      if (!selectedWarehouseId) {
        const firstWh = rawZones.find(z => !z.parent_id)
        if (firstWh) setSelectedWarehouseId(firstWh.id)
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu Sơ đồ kho:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedWarehouseId])

  useEffect(() => {
    loadWarehouseMapData()
  }, [])

  // ── Zones Hierarchy Sorting & Filtering ───────────────────────
  const sortZones = (list: ZoneItem[]) =>
    [...list].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
    )

  // 1. Warehouses (Level 1: parent_id is null)
  const warehouses = useMemo(
    () => sortZones(zones.filter(z => !z.parent_id)),
    [zones]
  )

  // 2. Aisles / Halls (Level 2: parent_id === selectedWarehouseId)
  const aisles = useMemo(() => {
    if (!selectedWarehouseId) return []
    return sortZones(zones.filter(z => z.parent_id === selectedWarehouseId))
  }, [zones, selectedWarehouseId])

  // 3. Slots (Level 3: parent_id === selectedAisleId)
  const slots = useMemo(() => {
    if (!selectedAisleId) return []
    return sortZones(zones.filter(z => z.parent_id === selectedAisleId))
  }, [zones, selectedAisleId])

  // 4. Tiers (Level 4: parent_id === selectedSlotId)
  const tiers = useMemo(() => {
    if (!selectedSlotId) return []
    return sortZones(zones.filter(z => z.parent_id === selectedSlotId))
  }, [zones, selectedSlotId])

  // Helper to get zone descendants
  const getDescendantZoneIds = useCallback(
    (targetZoneId: string): string[] => {
      const allIds = new Set<string>([targetZoneId])
      let added = true
      while (added) {
        added = false
        for (const z of zones) {
          if (z.parent_id && allIds.has(z.parent_id) && !allIds.has(z.id)) {
            allIds.add(z.id)
            added = true
          }
        }
      }
      return Array.from(allIds)
    },
    [zones]
  )

  // ── Stats Calculator (Total, Occupied, Empty) per Zone ─────────
  const zoneStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { total: number; occupied: number; empty: number }
    >()
    if (zones.length === 0 || positions.length === 0) return map

    zones.forEach(z => {
      const descIds = new Set(getDescendantZoneIds(z.id))
      let total = 0
      let occupied = 0

      positions.forEach(p => {
        if (p.zone_ids.some(zid => descIds.has(zid))) {
          total++
          if (p.lot_id) occupied++
        }
      })

      map.set(z.id, {
        total,
        occupied,
        empty: Math.max(0, total - occupied)
      })
    })

    return map
  }, [zones, positions, getDescendantZoneIds])

  // ── Positions in Current View (Slot / Tier) ────────────────────
  const currentPositions = useMemo(() => {
    if (!selectedSlotId) return []

    let targetZoneIds: Set<string>
    if (selectedTierId) {
      targetZoneIds = new Set([selectedTierId])
    } else {
      targetZoneIds = new Set(getDescendantZoneIds(selectedSlotId))
    }

    const filtered = positions.filter(p =>
      p.zone_ids.some(zid => targetZoneIds.has(zid))
    )

    return filtered.sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true })
    )
  }, [selectedSlotId, selectedTierId, positions, getDescendantZoneIds])

  // ── Search & Jump to Position Logic ───────────────────────────
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toUpperCase()
    if (!q || q.length < 1) return []

    return positions
      .filter(p => {
        const matchCode = p.code.toUpperCase().includes(q)
        const matchStt = p.stt && p.stt.toUpperCase().includes(q)
        const matchLot = p.lot_code && p.lot_code.toUpperCase().includes(q)
        const matchProd = p.product_name && p.product_name.toUpperCase().includes(q)
        return matchCode || matchStt || matchLot || matchProd
      })
      .slice(0, 15)
  }, [searchQuery, positions])

  const handleSelectSearchResult = (pos: PositionItem) => {
    // Find zone hierarchy for this position
    const leafZoneId = pos.zone_ids[0]
    if (leafZoneId) {
      const zoneMap = new Map(zones.map(z => [z.id, z]))
      let curr = zoneMap.get(leafZoneId)
      const path: ZoneItem[] = []

      while (curr) {
        path.unshift(curr)
        curr = curr.parent_id ? zoneMap.get(curr.parent_id) : undefined
      }

      // Hierarchy: [Warehouse, Aisle, Slot, Tier]
      if (path.length >= 1) setSelectedWarehouseId(path[0].id)
      if (path.length >= 2) setSelectedAisleId(path[1].id)
      if (path.length >= 3) setSelectedSlotId(path[2].id)
      if (path.length >= 4) setSelectedTierId(path[3].id)
      else setSelectedTierId(null)
    }

    setHighlightedPosId(pos.id)
    setSearchQuery('')
    setIsSearching(false)
    setSelectedPosDetail(pos)
  }

  // ── Helper to resolve Zone Names ──────────────────────────────
  const getZoneName = (id: string | null) =>
    zones.find(z => z.id === id)?.name || ''

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

        <button
          onClick={() => loadWarehouseMapData(true)}
          disabled={refreshing}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95 transition"
          title="Tải lại sơ đồ kho"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin text-cyan-400' : ''} />
        </button>
      </div>

      {/* ── SEARCH BAR WITH INSTANT MATCH (Pallet STT, Position, LOT) ── */}
      <div className="p-2.5 bg-[#0e1626] border-b border-slate-800/80 shrink-0 relative">
        <div className="relative flex items-center">
          <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value)
              setIsSearching(true)
            }}
            placeholder="Tìm theo STT (G22...), Mã vị trí, LOT, Sản phẩm..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('')
                setIsSearching(false)
              }}
              className="absolute right-2.5 p-1 text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {isSearching && searchQuery.trim() && (
          <div className="absolute top-full left-2.5 right-2.5 z-40 mt-1 max-h-72 overflow-y-auto bg-[#111827] border border-cyan-500/40 rounded-2xl shadow-2xl p-2 space-y-1.5 animate-in fade-in duration-150">
            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase flex justify-between border-b border-slate-800">
              <span>Kết quả tìm kiếm ({searchResults.length})</span>
              <span>Bấm để nhảy tới vị trí</span>
            </div>

            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Không tìm thấy vị trí hoặc Pallet nào khớp với &quot;{searchQuery}&quot;
              </div>
            ) : (
              searchResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelectSearchResult(p)}
                  className="w-full p-2.5 rounded-xl bg-slate-900/90 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-between text-left transition group"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-cyan-300">
                        📍 {p.code}
                      </span>
                      {p.stt ? (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-black">
                          STT: {p.stt}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          TRỐNG
                        </span>
                      )}
                    </div>
                    {p.lot_code && (
                      <p className="text-[11px] text-slate-300 font-bold truncate max-w-xs">
                        {p.product_name || p.lot_code}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={15} className="text-slate-500 group-hover:text-cyan-400 transition" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── BREADCRUMB NAVIGATION (Kho > Dãy > Ô > Tầng) ─────────── */}
      <div className="px-3 py-2 bg-[#0c1322] border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none text-xs">
        <button
          onClick={() => {
            setSelectedAisleId(null)
            setSelectedSlotId(null)
            setSelectedTierId(null)
          }}
          className={`shrink-0 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
            !selectedAisleId
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
              : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <Building2 size={13} />
          <span>{getZoneName(selectedWarehouseId) || 'Chọn Kho'}</span>
        </button>

        {selectedAisleId && (
          <>
            <ChevronRight size={13} className="text-slate-600 shrink-0" />
            <button
              onClick={() => {
                setSelectedSlotId(null)
                setSelectedTierId(null)
              }}
              className={`shrink-0 px-2.5 py-1 rounded-lg font-bold transition ${
                !selectedSlotId
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
              className={`shrink-0 px-2.5 py-1 rounded-lg font-bold transition ${
                !selectedTierId
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

      {/* ── MAIN CONTENT AREA BASED ON SELECTION LEVEL ───────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-2 text-slate-400">
            <RefreshCw size={28} className="animate-spin text-cyan-400" />
            <p className="text-xs">Đang tải sơ đồ kho...</p>
          </div>
        ) : !selectedAisleId ? (
          /* ── LEVEL 1: DANH SÁCH DÃY / SẢNH TRONG KHO ĐANG CHỌN ────── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-cyan-400" />
                <span>CHỌN DÃY / SẢNH (KHO {getZoneName(selectedWarehouseId)}):</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {aisles.length} phân khu
              </span>
            </div>

            {/* Switch Warehouse Pills if multiple warehouses */}
            {warehouses.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {warehouses.map(wh => (
                  <button
                    key={wh.id}
                    onClick={() => {
                      setSelectedWarehouseId(wh.id)
                      setSelectedAisleId(null)
                      setSelectedSlotId(null)
                      setSelectedTierId(null)
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition ${
                      wh.id === selectedWarehouseId
                        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🏢 {wh.name}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {aisles.map(aisle => {
                const stats = zoneStatsMap.get(aisle.id) || { total: 0, occupied: 0, empty: 0 }
                const pct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0

                return (
                  <button
                    key={aisle.id}
                    onClick={() => {
                      setSelectedAisleId(aisle.id)
                      setSelectedSlotId(null)
                      setSelectedTierId(null)
                    }}
                    className="p-3.5 rounded-2xl bg-[#111827] border border-slate-800 hover:border-cyan-500/50 text-left transition hover:bg-slate-900 active:scale-[0.99] space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-white group-hover:text-cyan-300 transition">
                        🚪 {aisle.name}
                      </span>
                      <span className="text-xs text-cyan-400 font-bold flex items-center gap-0.5">
                        Xem Ô →
                      </span>
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
              <span className="text-[10px] text-slate-500 font-mono">
                {slots.length} ô kệ
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {slots.map(slot => {
                const stats = zoneStatsMap.get(slot.id) || { total: 0, occupied: 0, empty: 0 }
                const pct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0

                return (
                  <button
                    key={slot.id}
                    onClick={() => {
                      setSelectedSlotId(slot.id)
                      setSelectedTierId(null)
                    }}
                    className="p-3 rounded-2xl bg-[#111827] border border-slate-800 hover:border-cyan-500/50 text-left transition hover:bg-slate-900 active:scale-[0.99] space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-white group-hover:text-cyan-300 transition">
                        📦 {slot.name}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400 font-bold">
                        {pct}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{stats.occupied}/{stats.total}</span>
                      <span className="text-emerald-400">{stats.empty} trống</span>
                    </div>

                    <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
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
              <span className="text-[10px] text-slate-400 font-mono">
                {currentPositions.length} vị trí
              </span>
            </div>

            {/* Horizontal Tiers Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                onClick={() => setSelectedTierId(null)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
                  !selectedTierId
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Tất cả các Tầng ({currentPositions.length})
              </button>

              {tiers.map(tier => {
                const stats = zoneStatsMap.get(tier.id) || { total: 0, occupied: 0, empty: 0 }
                return (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTierId(tier.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                      selectedTierId === tier.id
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{tier.name}</span>
                    <span className="text-[10px] opacity-80">({stats.occupied}/{stats.total})</span>
                  </button>
                )
              })}
            </div>

            {/* Visual Grid of Positions in this Tier/Slot */}
            {currentPositions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Chưa có dữ liệu vị trí nào trong khu vực này.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {currentPositions.map(pos => {
                  const isOccupied = !!pos.lot_id
                  const isHighlighted = pos.id === highlightedPosId

                  return (
                    <button
                      key={pos.id}
                      onClick={() => setSelectedPosDetail(pos)}
                      className={`p-3 rounded-2xl border text-left transition relative active:scale-[0.98] ${
                        isHighlighted
                          ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/40'
                          : isOccupied
                          ? 'bg-[#131d33] border-cyan-500/40 hover:border-cyan-400'
                          : 'bg-slate-900/60 border-dashed border-emerald-500/40 hover:border-emerald-400'
                      }`}
                    >
                      {/* Position Code Header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono font-black text-xs text-white">
                          {pos.code}
                        </span>
                        {isOccupied ? (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-black">
                            STT: {pos.stt || 'LOT'}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">
                            TRỐNG
                          </span>
                        )}
                      </div>

                      {/* Content Preview if Occupied */}
                      {isOccupied ? (
                        <div className="space-y-1">
                          <p className="font-bold text-[11px] text-slate-200 leading-snug line-clamp-2">
                            {pos.product_name || 'Hàng đông lạnh'}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>LOT: {pos.lot_code || '---'}</span>
                            {pos.quantity && <span>{pos.quantity} Thùng</span>}
                          </div>
                        </div>
                      ) : (
                        <div className="py-2 text-center text-[10px] text-emerald-400/80 font-medium">
                          + Sẵn sàng xếp hàng
                        </div>
                      )}
                    </button>
                  )
                })}
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
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">SẢN PHẨM:</span>
                  <p className="font-bold text-white text-sm leading-snug">
                    {selectedPosDetail.product_name || 'Hàng lưu kho'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">MÃ LOT:</span>
                    <strong className="text-slate-200 font-mono">{selectedPosDetail.lot_code || '---'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">SKU:</span>
                    <strong className="text-slate-200 font-mono">{selectedPosDetail.sku || '---'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">NGÀY ĐÓNG GÓI:</span>
                    <strong className="text-amber-400 font-mono">{selectedPosDetail.packaging_date || '---'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">SỐ LƯỢNG:</span>
                    <strong className="text-slate-200 font-mono">
                      {selectedPosDetail.quantity ? `${selectedPosDetail.quantity} Thùng` : '---'}
                    </strong>
                  </div>
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
