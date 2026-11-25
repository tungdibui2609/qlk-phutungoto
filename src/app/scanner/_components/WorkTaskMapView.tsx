'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  MapPin,
  Package,
  X,
} from 'lucide-react'
import { groupWarehouseData } from '@/lib/warehouseUtils'

export interface WorkMapTaskItem {
  id: string
  lot_id: string | null
  lot_code: string
  lot_stt?: string | null
  production_code?: string | null
  tags?: string[]
  position_id: string | null
  position_name: string
  current_position_name: string
  product_name: string
  sku: string
  quantity: number
  unit: string
  priority?: number | null
  status?: string
  display_status: 'Pending' | 'Moved to Hall' | 'Exported'
}

interface WorkTaskMapViewProps {
  taskItems: WorkMapTaskItem[]
  zones: any[]
  positions: any[]
  isDark: boolean
  loading: boolean
  onHaSanh: (lotCode: string) => void
  onHaSanhAll?: (lotCodes: string[]) => void
}

interface ZoneStats {
  total: number
  pending: number
  moved: number
  exported: number
  totalQty: number
  unit: string
}

function getPriorityBadge(priority?: number | null) {
  switch (priority) {
    case 1:
      return { label: 'UT1', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.16)', border: '#ef4444' }
    case 2:
      return { label: 'UT2', color: '#eab308', bg: 'rgba(234, 179, 8, 0.16)', border: '#eab308' }
    case 3:
      return { label: 'UT3', color: '#a16207', bg: 'rgba(161, 98, 7, 0.18)', border: '#a16207' }
    case 4:
      return { label: 'UT4', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.16)', border: '#a855f7' }
    default:
      return null
  }
}

export function WorkTaskMapView({
  taskItems,
  zones: rawZones,
  positions: rawPositions,
  isDark,
  loading,
  onHaSanh,
  onHaSanhAll,
}: WorkTaskMapViewProps) {
  // 2 tab con giống kết quả tìm kiếm Sơ Đồ Kho: "Thống kê phân bổ" | "Sơ đồ vị trí"
  const [subTab, setSubTab] = useState<'stats' | 'map'>('stats')

  // State mở rộng cho cây phân bổ (Kho -> Dãy -> Ô)
  const [expandedStatsZones, setExpandedStatsZones] = useState<Record<string, boolean>>({})

  // State điều hướng cho tab "Sơ đồ vị trí"
  const [selectedWhId, setSelectedWhId] = useState<string | null>(null)
  const [selectedAisleId, setSelectedAisleId] = useState<string | null>(null)
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null)
  const [activeLevelFilter, setActiveLevelFilter] = useState<string>('ALL')
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({})

  // Chuẩn hóa positions và gom ô (groupWarehouseData) giống Sơ Đồ Kho
  const { zones, positions, realToVirtualZone } = useMemo(() => {
    const normPos = (rawPositions || []).map((p: any) => ({
      ...p,
      id: p.position_id || p.id,
      code: p.positions?.code || p.code || '',
      zone_id: p.zone_id || (Array.isArray(p.zone_ids) ? p.zone_ids[0] : null),
      lot_id: p.positions?.lot_id !== undefined ? p.positions?.lot_id : p.lot_id,
    }))

    const grouped = groupWarehouseData((rawZones || []) as any, normPos as any)
    const r2v = new Map<string, string>()
    if (grouped.virtualToRealMap) {
      grouped.virtualToRealMap.forEach((realIds, vId) => {
        realIds.forEach(rId => r2v.set(rId, vId))
      })
    }

    return {
      zones: grouped.zones || rawZones || [],
      positions: grouped.positions || normPos,
      realToVirtualZone: r2v,
    }
  }, [rawZones, rawPositions])

  // Map position_id / position_code -> TaskItem
  const taskItemByPosId = useMemo(() => {
    const map = new Map<string, WorkMapTaskItem>()
    taskItems.forEach(it => {
      if (it.position_id) map.set(it.position_id, it)
      if (it.position_name) map.set(it.position_name.toUpperCase(), it)
    })
    return map
  }, [taskItems])

  // Map zoneId -> zone & children & direct positions
  const { zoneMap, childrenMap, directPositionsMap } = useMemo(() => {
    const zMap = new Map<string, any>()
    const cMap = new Map<string, any[]>()
    const pMap = new Map<string, any[]>()

    zones.forEach((z: any) => {
      zMap.set(z.id, z)
      if (z.parent_id) {
        const list = cMap.get(z.parent_id) || []
        list.push(z)
        cMap.set(z.parent_id, list)
      }
    })

    cMap.forEach(list => {
      list.sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
      )
    })

    positions.forEach((p: any) => {
      const rawZId = p.zone_id || (Array.isArray(p.zone_ids) ? p.zone_ids[0] : null)
      if (!rawZId) return
      const targetZId = zMap.has(rawZId) ? rawZId : realToVirtualZone.get(rawZId) || rawZId
      const list = pMap.get(targetZId) || []
      list.push(p)
      pMap.set(targetZId, list)
    })

    pMap.forEach(list => {
      list.sort((a, b) =>
        (a.code || '').localeCompare(b.code || '', undefined, { numeric: true })
      )
    })

    return { zoneMap: zMap, childrenMap: cMap, directPositionsMap: pMap }
  }, [zones, positions, realToVirtualZone])

  // Tính thống kê số LOT & tổng số lượng thuộc lệnh xuất trong từng zone (đệ quy)
  const zoneExportStats = useMemo(() => {
    const cache = new Map<string, ZoneStats>()

    const compute = (zoneId: string): ZoneStats => {
      if (cache.has(zoneId)) return cache.get(zoneId)!
      let total = 0
      let pending = 0
      let moved = 0
      let exported = 0
      let totalQty = 0
      let unit = ''

      const directPos = directPositionsMap.get(zoneId) || []
      directPos.forEach(p => {
        const match =
          taskItemByPosId.get(p.id) || (p.code ? taskItemByPosId.get(p.code.toUpperCase()) : undefined)
        if (match) {
          total++
          totalQty += Number(match.quantity) || 0
          if (!unit && match.unit) unit = match.unit
          if (match.display_status === 'Exported') exported++
          else if (match.display_status === 'Moved to Hall') moved++
          else pending++
        }
      })

      const children = childrenMap.get(zoneId) || []
      children.forEach(c => {
        const sub = compute(c.id)
        total += sub.total
        pending += sub.pending
        moved += sub.moved
        exported += sub.exported
        totalQty += sub.totalQty
        if (!unit && sub.unit) unit = sub.unit
      })

      const res: ZoneStats = { total, pending, moved, exported, totalQty, unit }
      cache.set(zoneId, res)
      return res
    }

    zones.forEach((z: any) => compute(z.id))
    return cache
  }, [zones, directPositionsMap, childrenMap, taskItemByPosId])

  // Danh sách Kho (root zones) có chứa hàng của Lệnh Xuất
  const rootWarehouses = useMemo(() => {
    return zones
      .filter((z: any) => !z.parent_id && (zoneExportStats.get(z.id)?.total || 0) > 0)
      .sort((a: any, b: any) =>
        (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
      )
  }, [zones, zoneExportStats])

  // Tổng quan toàn lệnh xuất
  const summaryStats = useMemo(() => {
    const totalQty = taskItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
    const unit = taskItems.find(it => it.unit)?.unit || 'Thùng'
    const pendingCount = taskItems.filter(it => it.display_status === 'Pending').length
    return {
      totalQty,
      unit,
      totalPositions: taskItems.length,
      pendingCount,
      warehousesCount: rootWarehouses.length,
    }
  }, [taskItems, rootWarehouses.length])

  // Các LOT không tìm thấy vị trí trên sơ đồ
  const unmappedTaskItems = useMemo(() => {
    const mappedIds = new Set<string>()
    positions.forEach((p: any) => {
      const m =
        taskItemByPosId.get(p.id) || (p.code ? taskItemByPosId.get(p.code.toUpperCase()) : undefined)
      if (m) mappedIds.add(m.id)
    })
    return taskItems.filter(it => !mappedIds.has(it.id))
  }, [positions, taskItems, taskItemByPosId])

  // Nhảy trực tiếp từ bảng Thống kê phân bổ sang Sơ đồ vị trí tại đúng Kho / Dãy / Ô / Tầng
  const jumpToMap = (
    whId: string | null,
    aisleId: string | null = null,
    binId: string | null = null,
    levelId: string | null = null
  ) => {
    setSelectedWhId(whId)
    setSelectedAisleId(aisleId)
    setSelectedBinId(binId)
    if (levelId) {
      setTimeout(() => {
        setActiveLevelFilter(levelId)
        setExpandedLevels({ [levelId]: true })
      }, 0)
    }
    setSubTab('map')
  }

  // Mở rộng / Thu gọn toàn bộ cây Thống kê phân bổ (Kho -> Dãy -> Ô -> Tầng)
  const toggleAllStatsTree = (expand: boolean) => {
    if (!expand) {
      setExpandedStatsZones({})
      return
    }
    const next: Record<string, boolean> = {}
    rootWarehouses.forEach((wh: any) => {
      next[wh.id] = true
      const aisles = (childrenMap.get(wh.id) || []).filter(
        a => (zoneExportStats.get(a.id)?.total || 0) > 0
      )
      aisles.forEach((a: any) => {
        next[a.id] = true
        const bins = (childrenMap.get(a.id) || []).filter(
          b => (zoneExportStats.get(b.id)?.total || 0) > 0
        )
        bins.forEach((b: any) => {
          next[b.id] = true
          const lvls = (childrenMap.get(b.id) || []).filter(
            l => (zoneExportStats.get(l.id)?.total || 0) > 0
          )
          lvls.forEach((l: any) => {
            next[l.id] = true
          })
        })
      })
    })
    setExpandedStatsZones(next)
  }

  // Các Dãy trong Kho đang chọn (Tab Sơ đồ vị trí)
  const activeAisles = useMemo(() => {
    if (!selectedWhId) return []
    return (childrenMap.get(selectedWhId) || []).filter(
      c => (zoneExportStats.get(c.id)?.total || 0) > 0
    )
  }, [selectedWhId, childrenMap, zoneExportStats])

  // Các Ô kệ trong Dãy đang chọn
  const activeBins = useMemo(() => {
    if (!selectedAisleId) return []
    return (childrenMap.get(selectedAisleId) || []).filter(
      c => (zoneExportStats.get(c.id)?.total || 0) > 0
    )
  }, [selectedAisleId, childrenMap, zoneExportStats])

  // Các Tầng trong Ô đang chọn (chỉ giữ lại các tầng có vị trí thuộc lệnh xuất)
  const activeLevels = useMemo(() => {
    if (!selectedBinId) return []
    const children = childrenMap.get(selectedBinId) || []
    if (children.length > 0) {
      return children
        .map(lvl => ({
          id: lvl.id,
          name: lvl.name,
          positions: directPositionsMap.get(lvl.id) || [],
          stats: zoneExportStats.get(lvl.id) || {
            total: 0,
            pending: 0,
            moved: 0,
            exported: 0,
            totalQty: 0,
            unit: '',
          },
        }))
        .filter(lvl => lvl.stats.total > 0)
    }
    const binObj = zoneMap.get(selectedBinId)
    const binStats = zoneExportStats.get(selectedBinId) || {
      total: 0,
      pending: 0,
      moved: 0,
      exported: 0,
      totalQty: 0,
      unit: '',
    }
    if (binStats.total === 0) return []
    return [
      {
        id: selectedBinId,
        name: binObj?.name || 'Danh sách ô',
        positions: directPositionsMap.get(selectedBinId) || [],
        stats: binStats,
      },
    ]
  }, [selectedBinId, childrenMap, directPositionsMap, zoneExportStats, zoneMap])

  useEffect(() => {
    if (!selectedBinId) return
    setActiveLevelFilter('ALL')
    const initialExpanded: Record<string, boolean> = {}
    activeLevels.forEach(lvl => {
      if (lvl.stats.total > 0) initialExpanded[lvl.id] = true
    })
    setExpandedLevels(initialExpanded)
  }, [selectedBinId, activeLevels])

  const selectedWh = selectedWhId ? zoneMap.get(selectedWhId) : null
  const selectedAisle = selectedAisleId ? zoneMap.get(selectedAisleId) : null
  const selectedBin = selectedBinId ? zoneMap.get(selectedBinId) : null

  const toggleAllLevels = (expand: boolean) => {
    const next: Record<string, boolean> = {}
    activeLevels.forEach(lvl => {
      next[lvl.id] = expand
    })
    setExpandedLevels(next)
  }

  const displayedLevels = useMemo(() => {
    if (activeLevelFilter === 'ALL') return activeLevels
    return activeLevels.filter(l => l.id === activeLevelFilter)
  }, [activeLevels, activeLevelFilter])

  const totalPositionsInBin = useMemo(
    () => activeLevels.reduce((sum, l) => sum + l.positions.length, 0),
    [activeLevels]
  )

  return (
    <div className="space-y-3">
      {/* Thanh 2 tab giống Sơ Đồ Kho: "Thống kê phân bổ" | "Sơ đồ vị trí" */}
      <div
        className={`grid grid-cols-2 p-1 rounded-2xl border ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-zinc-200 shadow-2xs'
        }`}
      >
        <button
          type="button"
          onClick={() => setSubTab('stats')}
          className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
            subTab === 'stats'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : isDark
              ? 'text-slate-400 hover:text-slate-200'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <BarChart3 size={14} />
          <span>Thống kê phân bổ</span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
              subTab === 'stats'
                ? 'bg-amber-600/20 text-slate-950'
                : isDark
                ? 'bg-slate-800 text-amber-400'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {summaryStats.totalQty.toLocaleString('vi-VN')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('map')}
          className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
            subTab === 'map'
              ? 'bg-emerald-600 text-white shadow-sm'
              : isDark
              ? 'text-slate-400 hover:text-slate-200'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <MapPin size={14} />
          <span>Sơ đồ vị trí</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: BẢNG THỐNG KÊ PHÂN BỔ LỆNH XUẤT (GIỐNG ẢNH TÌM KIẾM SƠ ĐỒ)  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'stats' && (
        <div className="space-y-2.5">
          {/* Card Tổng hợp 3 chỉ số (Siêu gọn) */}
          <div
            className={`px-2.5 py-2 rounded-xl border ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-zinc-200 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1 text-[10px] font-black text-amber-500 uppercase tracking-wide whitespace-nowrap truncate">
                <BarChart3 size={12} className="shrink-0" />
                <span className="truncate">Phân bổ lệnh xuất</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold shrink-0 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleAllStatsTree(true)}
                  className="text-sky-500 hover:underline whitespace-nowrap"
                >
                  Mở rộng
                </button>
                <span className="text-slate-500">•</span>
                <button
                  type="button"
                  onClick={() => toggleAllStatsTree(false)}
                  className="text-slate-400 hover:underline whitespace-nowrap"
                >
                  Thu gọn
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <div
                className={`px-1.5 py-1.5 rounded-lg border text-center ${
                  isDark
                    ? 'bg-amber-950/25 border-amber-500/30'
                    : 'bg-amber-50/70 border-amber-200'
                }`}
              >
                <div className="text-[8px] font-bold text-slate-400 uppercase leading-none">
                  Tổng xuất
                </div>
                <div className="text-sm font-black text-amber-500 leading-tight mt-0.5">
                  {summaryStats.totalQty.toLocaleString('vi-VN')}
                </div>
                <div className="text-[9px] font-semibold text-amber-600/80 dark:text-amber-400/80 truncate leading-tight">
                  {summaryStats.unit}
                </div>
              </div>

              <div
                className={`px-1.5 py-1.5 rounded-lg border text-center ${
                  isDark
                    ? 'bg-emerald-950/25 border-emerald-500/30'
                    : 'bg-emerald-50/70 border-emerald-200'
                }`}
              >
                <div className="text-[8px] font-bold text-slate-400 uppercase leading-none">
                  Vị trí lấy
                </div>
                <div className="text-sm font-black text-emerald-500 leading-tight mt-0.5">
                  {summaryStats.totalPositions}
                </div>
                <div className="text-[9px] font-semibold text-emerald-600/80 dark:text-emerald-400/80 leading-tight">
                  hạ {summaryStats.pendingCount} ô
                </div>
              </div>

              <div
                className={`px-1.5 py-1.5 rounded-lg border text-center ${
                  isDark
                    ? 'bg-sky-950/25 border-sky-500/30'
                    : 'bg-sky-50/70 border-sky-200'
                }`}
              >
                <div className="text-[8px] font-bold text-slate-400 uppercase leading-none">
                  Số kho
                </div>
                <div className="text-sm font-black text-sky-500 leading-tight mt-0.5">
                  {summaryStats.warehousesCount}
                </div>
                <div className="text-[9px] font-semibold text-sky-600/80 dark:text-sky-400/80 leading-tight">
                  kho hàng
                </div>
              </div>
            </div>
          </div>

          {/* Danh sách Kho dạng Accordion kèm nút "Sơ đồ" */}
          <div className="space-y-2">
            {rootWarehouses.map((wh: any) => {
              const whStats = zoneExportStats.get(wh.id) || {
                total: 0,
                pending: 0,
                moved: 0,
                exported: 0,
                totalQty: 0,
                unit: summaryStats.unit,
              }
              const isWhExpanded = Boolean(expandedStatsZones[wh.id])
              const aisles = (childrenMap.get(wh.id) || []).filter(
                a => (zoneExportStats.get(a.id)?.total || 0) > 0
              )

              return (
                <div
                  key={wh.id}
                  className={`rounded-2xl border overflow-hidden ${
                    isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-zinc-200 shadow-2xs'
                  }`}
                >
                  {/* Hàng Kho */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedStatsZones(prev => ({ ...prev, [wh.id]: !prev[wh.id] }))
                    }
                    className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isWhExpanded ? (
                        <ChevronDown size={16} className="text-emerald-500 shrink-0" />
                      ) : (
                        <ChevronRight size={16} className="text-slate-400 shrink-0" />
                      )}
                      <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0">
                        <Building2 size={14} />
                      </div>
                      <span className="font-black text-sm truncate">{wh.name}</span>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-amber-500 whitespace-nowrap">
                        {whStats.totalQty.toLocaleString('vi-VN')} {whStats.unit || summaryStats.unit}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                        {whStats.total} ô{' '}
                        {whStats.pending > 0 ? `(cần hạ ${whStats.pending})` : '(đã hạ)'}
                      </div>
                    </div>
                  </button>

                  {/* Danh sách Dãy bên trong Kho */}
                  {isWhExpanded && aisles.length > 0 && (
                    <div
                      className={`border-t px-2 py-2 space-y-1.5 ${
                        isDark ? 'border-slate-800 bg-slate-950/40' : 'border-zinc-100 bg-zinc-50/70'
                      }`}
                    >
                      {aisles.map((aisle: any) => {
                        const aStats = zoneExportStats.get(aisle.id) || {
                          total: 0,
                          pending: 0,
                          moved: 0,
                          exported: 0,
                          totalQty: 0,
                          unit: whStats.unit,
                        }
                        const isAisleExpanded = Boolean(expandedStatsZones[aisle.id])
                        const bins = (childrenMap.get(aisle.id) || []).filter(
                          b => (zoneExportStats.get(b.id)?.total || 0) > 0
                        )

                        return (
                          <div
                            key={aisle.id}
                            className={`rounded-xl border overflow-hidden ${
                              isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-zinc-200'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedStatsZones(prev => ({
                                  ...prev,
                                  [aisle.id]: !prev[aisle.id],
                                }))
                              }
                              className="w-full px-2.5 py-2 flex items-center justify-between gap-2 text-left"
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                {isAisleExpanded ? (
                                  <ChevronDown size={14} className="text-sky-500 shrink-0" />
                                ) : (
                                  <ChevronRight size={14} className="text-slate-400 shrink-0" />
                                )}
                                <span className="font-bold text-xs whitespace-nowrap">{aisle.name}</span>
                                <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                                  ({aStats.total} ô)
                                </span>
                              </div>

                              <span className="text-xs font-black text-amber-500 whitespace-nowrap shrink-0">
                                {aStats.totalQty.toLocaleString('vi-VN')} {aStats.unit || summaryStats.unit}
                              </span>
                            </button>

                            {/* Danh sách Ô kệ bên trong Dãy */}
                            {isAisleExpanded && bins.length > 0 && (
                              <div
                                className={`border-t px-2 py-1.5 space-y-1.5 ${
                                  isDark ? 'border-slate-800/80' : 'border-zinc-100'
                                }`}
                              >
                                {bins.map((bin: any) => {
                                  const bStats = zoneExportStats.get(bin.id) || {
                                    total: 0,
                                    pending: 0,
                                    moved: 0,
                                    exported: 0,
                                    totalQty: 0,
                                    unit: aStats.unit,
                                  }
                                  const isBinExpanded = Boolean(expandedStatsZones[bin.id])
                                  const rawLvlChildren = (childrenMap.get(bin.id) || []).filter(
                                    l => (zoneExportStats.get(l.id)?.total || 0) > 0
                                  )
                                  const binLevels =
                                    rawLvlChildren.length > 0
                                      ? rawLvlChildren.map(l => ({
                                          id: l.id,
                                          name: l.name,
                                          positions: directPositionsMap.get(l.id) || [],
                                          stats: zoneExportStats.get(l.id)!,
                                        }))
                                      : [
                                          {
                                            id: bin.id,
                                            name: bin.name,
                                            positions: directPositionsMap.get(bin.id) || [],
                                            stats: bStats,
                                          },
                                        ]

                                  return (
                                    <div
                                      key={bin.id}
                                      className={`rounded-xl border overflow-hidden ${
                                        isBinExpanded
                                          ? isDark
                                            ? 'bg-slate-950/70 border-emerald-500/40'
                                            : 'bg-emerald-50/30 border-emerald-300'
                                          : isDark
                                          ? 'bg-slate-950/40 border-slate-800'
                                          : 'bg-zinc-50 border-zinc-200'
                                      }`}
                                    >
                                      {/* Hàng Ô kệ */}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedStatsZones(prev => ({
                                            ...prev,
                                            [bin.id]: !prev[bin.id],
                                          }))
                                        }
                                        className="w-full px-2.5 py-2 flex items-center justify-between gap-2 text-left"
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                          {isBinExpanded ? (
                                            <ChevronDown size={14} className="text-emerald-500 shrink-0" />
                                          ) : (
                                            <ChevronRight size={14} className="text-slate-400 shrink-0" />
                                          )}
                                          <span className="font-black text-xs whitespace-nowrap shrink-0">
                                            {bin.name}
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap truncate">
                                            ({bStats.total} ô • {binLevels.length} tầng)
                                          </span>
                                        </div>

                                        <span className="text-xs font-black text-emerald-500 whitespace-nowrap shrink-0">
                                          {bStats.totalQty.toLocaleString('vi-VN')}{' '}
                                          {bStats.unit || summaryStats.unit}
                                        </span>
                                      </button>

                                      {/* Danh sách Tầng bên trong Ô */}
                                      {isBinExpanded && (
                                        <div className="px-2 pb-2 space-y-1.5">
                                          {binLevels.map(lvl => {
                                            const lvlExpanded = Boolean(expandedStatsZones[lvl.id])
                                            const lvlExportPositions = lvl.positions
                                              .map((p: any) => {
                                                const match =
                                                  taskItemByPosId.get(p.id) ||
                                                  (p.code
                                                    ? taskItemByPosId.get(p.code.toUpperCase())
                                                    : undefined)
                                                return match ? { pos: p, match } : null
                                              })
                                              .filter(Boolean) as {
                                              pos: any
                                              match: WorkMapTaskItem
                                            }[]

                                            return (
                                              <div
                                                key={lvl.id}
                                                className={`rounded-xl border overflow-hidden ${
                                                  isDark
                                                    ? 'bg-slate-900/90 border-slate-800'
                                                    : 'bg-white border-zinc-200'
                                                }`}
                                              >
                                                {/* Hàng Tầng gọn đúng 2 dòng, nút Hạ hết cao cân đối */}
                                                <div className="px-2.5 py-1.5 flex items-stretch justify-between gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setExpandedStatsZones(prev => ({
                                                        ...prev,
                                                        [lvl.id]: !prev[lvl.id],
                                                      }))
                                                    }
                                                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                                                  >
                                                    {lvlExpanded ? (
                                                      <ChevronDown
                                                        size={12}
                                                        className="text-amber-500 shrink-0"
                                                      />
                                                    ) : (
                                                      <ChevronRight
                                                        size={12}
                                                        className="text-slate-400 shrink-0"
                                                      />
                                                    )}
                                                    <div className="min-w-0 flex-1 space-y-0.5">
                                                      <div className="flex items-center gap-1.5 flex-nowrap overflow-hidden">
                                                        <span className="px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[9px] font-black flex items-center gap-0.5 whitespace-nowrap shrink-0">
                                                          <Layers size={9} />
                                                          {lvl.name}
                                                        </span>
                                                        <span className="text-[10px] font-black text-amber-500 whitespace-nowrap truncate">
                                                          {lvl.stats.totalQty.toLocaleString('vi-VN')}{' '}
                                                          {lvl.stats.unit || summaryStats.unit}
                                                        </span>
                                                      </div>
                                                      <div className="text-[9px] text-slate-400 font-semibold leading-tight">
                                                        {lvl.stats.total} vị trí •{' '}
                                                        {lvl.stats.pending > 0
                                                          ? `Còn hạ ${lvl.stats.pending}`
                                                          : 'Đã hạ đủ'}
                                                      </div>
                                                    </div>
                                                  </button>

                                                  {lvl.stats.pending > 0 && onHaSanhAll ? (
                                                    <button
                                                      type="button"
                                                      disabled={loading}
                                                      onClick={() => {
                                                        const pendingCodes = lvlExportPositions
                                                          .filter(
                                                            x =>
                                                              x.match.display_status === 'Pending'
                                                          )
                                                          .map(x => x.match.lot_code)
                                                        if (pendingCodes.length > 0) {
                                                          onHaSanhAll(pendingCodes)
                                                        }
                                                      }}
                                                      className="px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black whitespace-nowrap shrink-0 flex items-center justify-center active:scale-95 transition"
                                                    >
                                                      Hạ hết ({lvl.stats.pending})
                                                    </button>
                                                  ) : (
                                                    <span className="px-1.5 text-[10px] font-black text-emerald-500 whitespace-nowrap flex items-center">
                                                      Đã hạ xong
                                                    </span>
                                                  )}
                                                </div>

                                                {/* Danh sách TẤT CẢ vị trí trong Tầng (vị trí không thuộc lệnh ghi KHÔNG LẤY) */}
                                                {lvlExpanded && lvl.positions.length > 0 && (
                                                  <div className="px-2 pb-2 space-y-1.5">
                                                    {lvl.positions.map((pos: any) => {
                                                      const match =
                                                        taskItemByPosId.get(pos.id) ||
                                                        (pos.code
                                                          ? taskItemByPosId.get(
                                                              pos.code.toUpperCase()
                                                            )
                                                          : undefined)

                                                      if (!match) {
                                                        return (
                                                          <div
                                                            key={pos.id}
                                                            className={`px-2 py-1.5 rounded-lg border border-dashed flex items-center justify-between gap-2 opacity-75 ${
                                                              isDark
                                                                ? 'bg-slate-950/40 border-slate-800 text-slate-500'
                                                                : 'bg-zinc-50 border-zinc-200 text-zinc-400'
                                                            }`}
                                                          >
                                                            <div className="flex items-center gap-1 min-w-0">
                                                              <MapPin
                                                                size={10}
                                                                className="text-slate-500 shrink-0"
                                                              />
                                                              <span className="font-mono text-[10px] font-bold whitespace-nowrap">
                                                                {pos.code}
                                                              </span>
                                                            </div>
                                                            <span
                                                              className={`px-1.5 py-0.5 rounded text-[9px] font-black whitespace-nowrap flex items-center gap-0.5 shrink-0 ${
                                                                isDark
                                                                  ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                                                                  : 'bg-rose-50 text-rose-600 border border-rose-200'
                                                              }`}
                                                            >
                                                              <X size={9} strokeWidth={3} />
                                                              <span>KHÔNG LẤY</span>
                                                            </span>
                                                          </div>
                                                        )
                                                      }

                                                      const isPending =
                                                        match.display_status === 'Pending'
                                                      const isExported =
                                                        match.display_status === 'Exported'
                                                      const displayStt =
                                                        match.lot_stt || pos.stt || null
                                                      const displayTags: string[] =
                                                        match.tags && match.tags.length > 0
                                                          ? match.tags
                                                          : Array.isArray(pos.tags)
                                                          ? pos.tags
                                                          : []

                                                      return (
                                                        <div
                                                          key={pos.id}
                                                          className={`px-2 py-1.5 rounded-lg border space-y-0.5 ${
                                                            isDark
                                                              ? 'bg-slate-950/80 border-slate-800/90'
                                                              : 'bg-zinc-50 border-zinc-200'
                                                          }`}
                                                        >
                                                          <div className="flex items-center justify-between gap-1.5">
                                                            <div className="flex items-center gap-1 min-w-0 flex-nowrap overflow-hidden">
                                                              <MapPin
                                                                size={10}
                                                                className="text-sky-500 shrink-0"
                                                              />
                                                              <span className="font-mono text-[10px] font-black text-sky-500 dark:text-sky-400 whitespace-nowrap">
                                                                {pos.code}
                                                              </span>
                                                              {displayStt && (
                                                                <span className="px-1 py-0 rounded bg-amber-500/20 border border-amber-500/35 text-amber-500 text-[8px] font-black font-mono shrink-0">
                                                                  #{displayStt}
                                                                </span>
                                                              )}
                                                            </div>

                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                              <span className="text-[10px] font-black text-emerald-500 whitespace-nowrap">
                                                                {match.quantity} {match.unit}
                                                              </span>
                                                              {isPending ? (
                                                                <button
                                                                  type="button"
                                                                  disabled={loading}
                                                                  onClick={() =>
                                                                    onHaSanh(match.lot_code)
                                                                  }
                                                                  className="px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[9px] font-black whitespace-nowrap active:scale-95"
                                                                >
                                                                  Hạ sảnh
                                                                </button>
                                                              ) : (
                                                                <span
                                                                  className={`px-1.5 py-0.5 rounded text-[8px] font-black whitespace-nowrap ${
                                                                    isExported
                                                                      ? 'bg-emerald-500/20 text-emerald-500'
                                                                      : 'bg-amber-500/20 text-amber-500'
                                                                  }`}
                                                                >
                                                                  {isExported ? 'Đã xuất' : 'Ở sảnh'}
                                                                </span>
                                                              )}
                                                            </div>
                                                          </div>

                                                          <div
                                                            className={`text-[10px] font-semibold leading-snug break-words pl-3.5 ${
                                                              isDark
                                                                ? 'text-slate-200'
                                                                : 'text-zinc-700'
                                                            }`}
                                                          >
                                                            <span>{match.product_name}</span>
                                                            {displayTags.map((tag, tIdx) => (
                                                              <span
                                                                key={`${tag}-${tIdx}`}
                                                                className={`inline-block align-middle ml-1 px-1 py-0 rounded text-[8px] leading-tight font-bold font-mono ${
                                                                  isDark
                                                                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                                                    : 'bg-violet-50 text-violet-700 border border-violet-200'
                                                                }`}
                                                              >
                                                                {tag}
                                                              </span>
                                                            ))}
                                                          </div>
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

          {/* Danh sách LOT chưa rõ vị trí trên sơ đồ (nếu có) */}
          {unmappedTaskItems.length > 0 && (
            <div
              className={`p-3 rounded-2xl border space-y-2 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-zinc-200'
              }`}
            >
              <div className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                <Package size={14} />
                Chưa định vị được trên sơ đồ ({unmappedTaskItems.length} LOT)
              </div>
              <div className="space-y-1.5">
                {unmappedTaskItems.map(item => {
                  const isPending = item.display_status === 'Pending'
                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                        isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-black text-blue-500 truncate">
                          {item.position_name}{' '}
                          {item.lot_stt ? (
                            <span className="text-amber-500">#{item.lot_stt}</span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-slate-400 break-words">
                          {item.product_name}
                        </div>
                      </div>
                      {isPending ? (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => onHaSanh(item.lot_code)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-black shrink-0"
                        >
                          Hạ sảnh
                        </button>
                      ) : (
                        <span className="text-[10px] font-black text-emerald-500 shrink-0">
                          {item.display_status === 'Exported' ? 'Đã xuất' : 'Ở sảnh'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: SƠ ĐỒ VỊ TRÍ (KHO -> DÃY -> Ô -> TẦNG & LƯỚI VỊ TRÍ)        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'map' && (
        <div className="space-y-3">
          {/* Breadcrumb điều hướng Kho > Dãy > Ô */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setSelectedWhId(null)
                setSelectedAisleId(null)
                setSelectedBinId(null)
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition ${
                !selectedWhId
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-300'
                  : 'bg-white border-zinc-200 text-zinc-700'
              }`}
            >
              <Building2 size={13} />
              <span>Tất cả Kho ({rootWarehouses.length})</span>
            </button>

            {selectedWh && (
              <>
                <ChevronRight size={14} className="text-slate-500" />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAisleId(null)
                    setSelectedBinId(null)
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-black border transition ${
                    selectedWhId && !selectedAisleId
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : isDark
                      ? 'bg-slate-900 border-slate-800 text-slate-300'
                      : 'bg-white border-zinc-200 text-zinc-700'
                  }`}
                >
                  {selectedWh.name}
                </button>
              </>
            )}

            {selectedAisle && (
              <>
                <ChevronRight size={14} className="text-slate-500" />
                <button
                  type="button"
                  onClick={() => setSelectedBinId(null)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-black border transition ${
                    selectedAisleId && !selectedBinId
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : isDark
                      ? 'bg-slate-900 border-slate-800 text-slate-300'
                      : 'bg-white border-zinc-200 text-zinc-700'
                  }`}
                >
                  {selectedAisle.name}
                </button>
              </>
            )}

            {selectedBin && (
              <>
                <ChevronRight size={14} className="text-slate-500" />
                <span className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white border border-emerald-500">
                  {selectedBin.name}
                </span>
              </>
            )}
          </div>

          {/* CẤP 1: CHỌN KHO */}
          {!selectedWhId && (
            <div className="grid grid-cols-2 gap-2.5">
              {rootWarehouses.map((wh: any) => {
                const st = zoneExportStats.get(wh.id) || {
                  total: 0,
                  pending: 0,
                  moved: 0,
                  exported: 0,
                  totalQty: 0,
                  unit: '',
                }
                const doneCount = st.moved + st.exported
                const isAllDone = st.total > 0 && st.pending === 0
                return (
                  <button
                    key={wh.id}
                    type="button"
                    onClick={() => setSelectedWhId(wh.id)}
                    className={`p-3.5 rounded-2xl border text-left transition active:scale-[0.98] ${
                      isAllDone
                        ? isDark
                          ? 'bg-emerald-950/30 border-emerald-700/50'
                          : 'bg-emerald-50 border-emerald-200'
                        : isDark
                        ? 'bg-slate-900 border-slate-800 hover:border-emerald-500/50'
                        : 'bg-white border-zinc-200 shadow-2xs hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                        <Building2 size={16} />
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                          isAllDone
                            ? 'bg-emerald-500/20 text-emerald-500'
                            : 'bg-blue-500/15 text-blue-500'
                        }`}
                      >
                        {doneCount}/{st.total} hạ
                      </span>
                    </div>
                    <div className="font-black text-sm truncate">{wh.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Còn <strong className="text-amber-500">{st.pending}</strong> LOT cần lấy
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* CẤP 2: CHỌN DÃY TRONG KHO */}
          {selectedWhId && !selectedAisleId && (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setSelectedWhId(null)}
                className="text-xs font-bold text-emerald-500 flex items-center gap-1"
              >
                <ArrowLeft size={14} /> Quay lại danh sách Kho
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                {activeAisles.map((aisle: any) => {
                  const st = zoneExportStats.get(aisle.id) || {
                    total: 0,
                    pending: 0,
                    moved: 0,
                    exported: 0,
                    totalQty: 0,
                    unit: '',
                  }
                  const doneCount = st.moved + st.exported
                  const isAllDone = st.total > 0 && st.pending === 0
                  return (
                    <button
                      key={aisle.id}
                      type="button"
                      onClick={() => setSelectedAisleId(aisle.id)}
                      className={`p-3.5 rounded-2xl border text-left transition active:scale-[0.98] ${
                        isAllDone
                          ? isDark
                            ? 'bg-emerald-950/30 border-emerald-700/50'
                            : 'bg-emerald-50 border-emerald-200'
                          : isDark
                          ? 'bg-slate-900 border-slate-800 hover:border-emerald-500/50'
                          : 'bg-white border-zinc-200 shadow-2xs hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-black text-sm truncate">{aisle.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
                            isAllDone
                              ? 'bg-emerald-500/20 text-emerald-500'
                              : 'bg-blue-500/15 text-blue-500'
                          }`}
                        >
                          {doneCount}/{st.total}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {st.pending > 0 ? (
                          <>
                            Cần lấy: <strong className="text-amber-500">{st.pending} LOT</strong>
                          </>
                        ) : (
                          <span className="text-emerald-500 font-bold">Đã hạ hết dãy</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* CẤP 3: CHỌN Ô KỆ TRONG DÃY */}
          {selectedWhId && selectedAisleId && !selectedBinId && (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setSelectedAisleId(null)}
                className="text-xs font-bold text-emerald-500 flex items-center gap-1"
              >
                <ArrowLeft size={14} /> Quay lại danh sách Dãy
              </button>

              <div className="grid grid-cols-3 gap-2">
                {activeBins.map((bin: any) => {
                  const st = zoneExportStats.get(bin.id) || {
                    total: 0,
                    pending: 0,
                    moved: 0,
                    exported: 0,
                    totalQty: 0,
                    unit: '',
                  }
                  const doneCount = st.moved + st.exported
                  const isAllDone = st.total > 0 && st.pending === 0
                  return (
                    <button
                      key={bin.id}
                      type="button"
                      onClick={() => setSelectedBinId(bin.id)}
                      className={`p-3 rounded-2xl border text-center transition active:scale-95 ${
                        isAllDone
                          ? isDark
                            ? 'bg-emerald-950/30 border-emerald-700/60'
                            : 'bg-emerald-50 border-emerald-200'
                          : isDark
                          ? 'bg-slate-900 border-slate-800 hover:border-emerald-500/60'
                          : 'bg-white border-zinc-200 shadow-2xs hover:border-emerald-400'
                      }`}
                    >
                      <div className="font-black text-sm">{bin.name}</div>
                      <div
                        className={`mt-1 text-[11px] font-black ${
                          isAllDone ? 'text-emerald-500' : 'text-amber-500'
                        }`}
                      >
                        {doneCount}/{st.total} LOT
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* CẤP 4: CHI TIẾT TỪNG TẦNG & Ô VỊ TRÍ */}
          {selectedWhId && selectedAisleId && selectedBinId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedBinId(null)}
                  className="text-xs font-bold text-emerald-500 flex items-center gap-1"
                >
                  <ArrowLeft size={14} /> Quay lại Ô kệ
                </button>
                <span className="text-xs font-bold text-slate-400">
                  {totalPositionsInBin} vị trí
                </span>
              </div>

              {/* Thanh chọn nhanh Tầng */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <button
                  type="button"
                  onClick={() => setActiveLevelFilter('ALL')}
                  className={`px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap border transition ${
                    activeLevelFilter === 'ALL'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : isDark
                      ? 'bg-slate-900 border-slate-800 text-slate-300'
                      : 'bg-white border-zinc-200 text-zinc-700'
                  }`}
                >
                  Tất cả tầng ({totalPositionsInBin})
                </button>
                {activeLevels.map(lvl => {
                  const isAct = activeLevelFilter === lvl.id
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => {
                        setActiveLevelFilter(lvl.id)
                        setExpandedLevels(prev => ({ ...prev, [lvl.id]: true }))
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap border transition ${
                        isAct
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : isDark
                          ? 'bg-blue-950/50 border-blue-700/50 text-blue-300'
                          : 'bg-blue-50 border-blue-200 text-blue-700'
                      }`}
                    >
                      {lvl.name} ({lvl.stats.total}/{lvl.positions.length})
                    </button>
                  )
                })}
              </div>

              {/* Thanh Mở tất cả / Thu tất cả */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">
                  Chi tiết theo tầng ({activeLevels.length} tầng):
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleAllLevels(true)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-emerald-400'
                        : 'bg-white border-zinc-200 text-emerald-600'
                    }`}
                  >
                    + Mở tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAllLevels(false)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-slate-300'
                        : 'bg-white border-zinc-200 text-zinc-600'
                    }`}
                  >
                    − Thu tất cả
                  </button>
                </div>
              </div>

              {/* Danh sách từng Tầng dạng Accordion với lưới 2 cột vị trí */}
              <div className="space-y-2.5">
                {displayedLevels.map(lvl => {
                  const isExpanded = Boolean(expandedLevels[lvl.id])
                  const hasExportInLevel = lvl.stats.total > 0

                  return (
                    <div
                      key={lvl.id}
                      className={`rounded-2xl border overflow-hidden ${
                        hasExportInLevel
                          ? isDark
                            ? 'bg-slate-900/90 border-emerald-500/40'
                            : 'bg-white border-emerald-300 shadow-xs'
                          : isDark
                          ? 'bg-slate-900/50 border-slate-800'
                          : 'bg-white border-zinc-200'
                      }`}
                    >
                      {/* Header Tầng */}
                      <div className="w-full px-3 py-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedLevels(prev => ({ ...prev, [lvl.id]: !prev[lvl.id] }))
                          }
                          className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown size={15} className="text-emerald-500 shrink-0" />
                          ) : (
                            <ChevronRight size={15} className="text-slate-400 shrink-0" />
                          )}
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              lvl.stats.pending > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                          <span className="text-xs font-black uppercase tracking-wide">
                            {lvl.name}
                          </span>
                          <span className="text-[11px] text-slate-400 font-semibold">
                            ({lvl.stats.total}/{lvl.positions.length})
                          </span>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          {lvl.stats.pending > 0 && onHaSanhAll ? (
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => {
                                const pendingCodes = lvl.positions
                                  .map(
                                    (p: any) =>
                                      taskItemByPosId.get(p.id) ||
                                      (p.code ? taskItemByPosId.get(p.code.toUpperCase()) : undefined)
                                  )
                                  .filter((m): m is WorkMapTaskItem =>
                                    Boolean(m && m.display_status === 'Pending')
                                  )
                                  .map(m => m.lot_code)
                                if (pendingCodes.length > 0) {
                                  onHaSanhAll(pendingCodes)
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black whitespace-nowrap active:scale-95 transition shadow-xs"
                            >
                              Hạ hết ({lvl.stats.pending})
                            </button>
                          ) : (
                            <span
                              className={`text-[11px] font-black shrink-0 ${
                                lvl.stats.pending > 0 ? 'text-amber-500' : 'text-emerald-500'
                              }`}
                            >
                              {lvl.stats.pending > 0 ? `Cần hạ ${lvl.stats.pending}` : 'Đã hạ xong'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Lưới 2 cột các vị trí trong Tầng */}
                      {isExpanded && (
                        <div className="px-2 pb-2 pt-0.5 grid grid-cols-2 gap-1.5">
                          {lvl.positions.map((pos: any) => {
                            const match =
                              taskItemByPosId.get(pos.id) ||
                              (pos.code ? taskItemByPosId.get(pos.code.toUpperCase()) : undefined)

                            if (!match) {
                              return (
                                <div
                                  key={pos.id}
                                  className={`px-2 py-1.5 rounded-lg border border-dashed flex flex-col justify-between ${
                                    isDark
                                      ? 'bg-slate-950/40 border-slate-800 text-slate-500'
                                      : 'bg-zinc-50 border-zinc-200 text-zinc-400'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-mono text-[10px] font-bold truncate opacity-75">
                                      {pos.code}
                                    </span>
                                    <span
                                      className={`px-1 py-0.5 rounded text-[8px] font-black shrink-0 flex items-center gap-0.5 ${
                                        isDark
                                          ? 'bg-rose-950/50 text-rose-400/80'
                                          : 'bg-rose-50 text-rose-500'
                                      }`}
                                    >
                                      <X size={9} strokeWidth={3} />
                                      <span>KHÔNG LẤY</span>
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-center py-1.5 opacity-45">
                                    <X
                                      size={20}
                                      strokeWidth={2.5}
                                      className={isDark ? 'text-rose-400' : 'text-rose-500'}
                                    />
                                  </div>
                                </div>
                              )
                            }

                            const isPending = match.display_status === 'Pending'
                            const isExported = match.display_status === 'Exported'
                            const pBadge = getPriorityBadge(match.priority)
                            const displayStt = match.lot_stt || pos.stt || null
                            const displayTags: string[] =
                              match.tags && match.tags.length > 0
                                ? match.tags
                                : Array.isArray(pos.tags)
                                ? pos.tags
                                : []

                            return (
                              <div
                                key={pos.id}
                                className={`px-2 py-1.5 rounded-lg border flex flex-col justify-between gap-1 transition ${
                                  isExported
                                    ? isDark
                                      ? 'bg-emerald-950/35 border-emerald-500/50'
                                      : 'bg-emerald-50 border-emerald-300'
                                    : !isPending
                                    ? isDark
                                      ? 'bg-amber-950/35 border-amber-500/50'
                                      : 'bg-amber-50 border-amber-300'
                                    : isDark
                                    ? 'bg-blue-950/40 border-blue-500/60'
                                    : 'bg-blue-50/70 border-blue-300'
                                }`}
                              >
                                {/* Dòng 1: Mã vị trí + Mã phụ (Tags) + STT LOT / Ưu tiên */}
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                  <div className="flex items-center gap-1 min-w-0 flex-wrap">
                                    <span className="font-mono text-[10px] font-black shrink-0">
                                      {pos.code}
                                    </span>
                                    {displayTags.map((tag, tIdx) => (
                                      <span
                                        key={`${tag}-${tIdx}`}
                                        className={`px-1 py-0 rounded text-[8px] leading-tight font-bold font-mono break-all ${
                                          isDark
                                            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                            : 'bg-violet-50 text-violet-700 border border-violet-200'
                                        }`}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>

                                  {(displayStt || pBadge) && (
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      {displayStt && (
                                        <span className="px-1 py-0 rounded bg-amber-500/20 border border-amber-500/35 text-amber-500 text-[8px] font-black font-mono">
                                          #{displayStt}
                                        </span>
                                      )}
                                      {pBadge && (
                                        <span
                                          className="px-1 py-0 rounded text-[8px] font-black"
                                          style={{
                                            backgroundColor: pBadge.bg,
                                            color: pBadge.color,
                                            border: `1px solid ${pBadge.border}`,
                                          }}
                                        >
                                          {pBadge.label}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Dòng 2: Tên sản phẩm đầy đủ */}
                                <div
                                  className={`text-[10px] font-semibold leading-snug break-words ${
                                    isDark ? 'text-slate-100' : 'text-zinc-800'
                                  }`}
                                >
                                  {match.product_name}
                                </div>

                                {/* Dòng 3: Số lượng + ĐVT + Nút Hạ sảnh / Trạng thái */}
                                <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-500/15">
                                  <span className="text-[10px] font-black text-sky-500 leading-tight min-w-0">
                                    {match.quantity} {match.unit}
                                  </span>

                                  {isPending ? (
                                    <button
                                      type="button"
                                      disabled={loading}
                                      onClick={() => onHaSanh(match.lot_code)}
                                      className="px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black whitespace-nowrap shrink-0 active:scale-95 transition"
                                    >
                                      Hạ sảnh
                                    </button>
                                  ) : (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-black whitespace-nowrap shrink-0 flex items-center gap-0.5 ${
                                        isExported
                                          ? 'bg-emerald-500/20 text-emerald-500'
                                          : 'bg-amber-500/20 text-amber-500'
                                      }`}
                                    >
                                      <CheckCircle2 size={9} />
                                      {isExported ? 'Đã xuất' : 'Ở sảnh'}
                                    </span>
                                  )}
                                </div>
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
          )}
        </div>
      )}

      {rootWarehouses.length === 0 && unmappedTaskItems.length === 0 && (
        <div className="py-10 text-center text-xs text-slate-400">
          Không có dữ liệu vị trí nào trong lệnh xuất này.
        </div>
      )}
    </div>
  )
}
