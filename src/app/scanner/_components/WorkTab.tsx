'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Briefcase,
  RefreshCw,
  FileText,
  ChevronRight,
  ArrowLeft,
  BarChart2,
  Camera,
  Keyboard,
  UploadCloud,
  CheckCircle2,
  ArrowDown,
  Pause,
  Play,
  Layers,
  X,
  Check,
  AlertTriangle,
  CloudUpload,
  WifiOff,
  Search,
  MapPin,
  Map as MapIcon,
  List as ListIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { groupWarehouseData } from '@/lib/warehouseUtils'
import { decodeSTT } from '@/lib/numberUtils'
import { useScannerTheme } from './ScannerThemeContext'
import { getWarehouseMapFromOfflineDb } from '@/lib/scanner-db'
import { fetchAllPagedRows } from './scannerUtils'
import { WorkTaskMapView } from './WorkTaskMapView'

export interface WorkTabProps {
  isActive?: boolean
  systemCode?: string
  userProfile?: {
    id?: string
    fullName?: string
    email?: string
    companyId?: string | null
    companyCode?: string
    companyName?: string
    roleName?: string
  } | null
  triggerToast?: (msg: string) => void
}

export interface ExportTask {
  id: string
  code: string
  status: string
  system_code?: string
  created_at: string
  notes?: string | null
  items_count: number
  items?: any[]
}

export interface TaskItem {
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

export interface PendingWorkOp {
  id: string
  type: 'HA_SANH' | 'XUAT_KHO'
  payload: any
  timestamp: string
  status: 'pending' | 'failed'
  error?: string
}

const WORK_STORAGE_KEYS = {
  TASKS: 'scanner_work_export_tasks_v1',
  OPS_QUEUE: 'scanner_work_pending_ops_v1',
  ZONES: 'scanner_work_zones_v1',
  POSITIONS: 'scanner_work_positions_v1',
  MAP_CACHE: 'warehouse_map_offline_cache_v8',
}

const PRIORITY_COLORS = [
  { level: 1, label: 'Đỏ', hex: '#ef4444', textHex: '#b91c1c', bgHex: '#fef2f2', borderHex: '#fca5a5' },
  { level: 2, label: 'Vàng', hex: '#eab308', textHex: '#a16207', bgHex: '#fefce8', borderHex: '#fde047' },
  { level: 3, label: 'Nâu', hex: '#b45309', textHex: '#78350f', bgHex: '#fffbeb', borderHex: '#fcd34d' },
  { level: 4, label: 'Tím', hex: '#c084fc', textHex: '#7e22ce', bgHex: '#faf5ff', borderHex: '#e9d5ff' },
]

function getPriorityConfig(level?: number | null) {
  if (!level) return undefined
  return PRIORITY_COLORS.find(p => p.level === level)
}

export function extractLotCode(raw: string): string {
  if (!raw) return ''
  let code = raw.trim()
  if (code.toLowerCase().startsWith('http')) {
    try {
      const url = new URL(code)
      let path = url.pathname
      if (path.endsWith('/')) path = path.slice(0, -1)
      const parts = path.split('/')
      const lastPart = parts.pop()
      if (lastPart) code = lastPart
    } catch {
      let clean = code
      if (clean.endsWith('/')) clean = clean.slice(0, -1)
      const lastSlash = clean.lastIndexOf('/')
      if (lastSlash !== -1) {
        const afterSlash = clean.substring(lastSlash + 1)
        const qIdx = afterSlash.indexOf('?')
        code = qIdx !== -1 ? afterSlash.substring(0, qIdx) : afterSlash
      }
    }
  }
  return code.toUpperCase()
}

const isHallZone = (z: any): boolean => {
  if (!z) return false
  if (z.is_hall) return true
  const nameUpper = String(z.name || '').trim().toUpperCase()
  return (
    nameUpper.startsWith('SẢNH') ||
    nameUpper.startsWith('SÀNH') ||
    nameUpper.startsWith('SANH') ||
    nameUpper.includes('SẢNH') ||
    nameUpper.includes('SÀNH')
  )
}

// ── MODAL THỐNG KÊ CHI TIẾT LỆNH XUẤT KHO (GIỐNG ExportOrderStatsModal CỦA QLK-APP) ──
function ExportOrderStatsModal({
  visible,
  taskCode,
  taskItems,
  zones,
  positions,
  isDark,
  onClose,
  onUpdatePriority,
}: {
  visible: boolean
  taskCode: string
  taskItems: TaskItem[]
  zones: any[]
  positions: any[]
  isDark: boolean
  onClose: () => void
  onUpdatePriority: (posId: string, level: number | null) => void
}) {
  const [isGrouped, setIsGrouped] = useState(true)
  const [completedZones, setCompletedZones] = useState<Set<string>>(new Set())
  const [selectedZoneForDetail, setSelectedZoneForDetail] = useState<any | null>(null)

  const normalizedPositions = useMemo(() => {
    return (positions || []).map((p: any) => ({
      id: p.position_id || p.id,
      code: p.positions?.code || p.code || '',
      zone_id: p.zone_id || (Array.isArray(p.zone_ids) ? p.zone_ids[0] : null),
      lot_id: p.positions?.lot_id !== undefined ? p.positions?.lot_id : p.lot_id,
    }))
  }, [positions])

  const { displayZones, displayPositions } = useMemo(() => {
    if (!isGrouped) return { displayZones: zones, displayPositions: normalizedPositions }
    const res = groupWarehouseData(zones as any, normalizedPositions as any)
    return {
      displayZones: res.zones || zones,
      displayPositions: res.positions || normalizedPositions,
    }
  }, [zones, normalizedPositions, isGrouped])

  const exportPositionIds = useMemo(
    () => new Set(taskItems.map(i => i.position_id).filter((id): id is string => Boolean(id))),
    [taskItems]
  )

  const exportItemInfoMap = useMemo(() => {
    const map: Record<string, TaskItem> = {}
    taskItems.forEach(item => {
      if (item.position_id) map[item.position_id] = item
    })
    return map
  }, [taskItems])

  const zoneTree = useMemo(() => {
    const map = new Map<string, any>()
    displayZones.forEach((z: any) => map.set(z.id, { ...z, children: [], positions: [] }))

    displayPositions.forEach((p: any) => {
      const zId = p.zone_id || (Array.isArray(p.zone_ids) ? p.zone_ids[0] : null)
      if (zId && map.has(zId)) {
        map.get(zId)!.positions.push({
          id: p.id,
          zone_id: zId,
          code: p.code || '',
          realIds: p.realIds,
        })
      }
    })

    displayZones.forEach((z: any) => {
      if (z.parent_id && map.has(z.parent_id)) {
        map.get(z.parent_id)!.children.push(map.get(z.id)!)
      }
    })

    const rootZones = displayZones
      .filter((z: any) => !z.parent_id || !map.has(z.parent_id))
      .map((z: any) => map.get(z.id)!)

    const sortByCode = (a: any, b: any) =>
      (a.code || a.name || '').localeCompare(b.code || b.name || '', undefined, { numeric: true })
    map.forEach(node => {
      node.children.sort(sortByCode)
      node.positions.sort(sortByCode)
    })

    return rootZones.sort(sortByCode)
  }, [displayZones, displayPositions])

  const isPosExport = useCallback(
    (pos: any) => {
      if (exportPositionIds.has(pos.id)) return true
      if (Array.isArray(pos.realIds)) {
        return pos.realIds.some((rid: string) => exportPositionIds.has(rid))
      }
      return false
    },
    [exportPositionIds]
  )

  const getPosExportInfo = useCallback(
    (pos: any): TaskItem | undefined => {
      if (exportItemInfoMap[pos.id]) return exportItemInfoMap[pos.id]
      if (Array.isArray(pos.realIds)) {
        for (const rid of pos.realIds) {
          if (exportItemInfoMap[rid]) return exportItemInfoMap[rid]
        }
      }
      return undefined
    },
    [exportItemInfoMap]
  )

  const getAllPositions = useCallback((zone: any): any[] => {
    let result = [...(zone.positions || [])]
    ;(zone.children || []).forEach((c: any) => {
      result = [...result, ...getAllPositions(c)]
    })
    return result
  }, [])

  const countExportPositions = useCallback(
    (zone: any): number => {
      const allPos = getAllPositions(zone)
      return allPos.filter(p => isPosExport(p)).length
    },
    [getAllPositions, isPosExport]
  )

  const isPositionInHall = useCallback(
    (pos: any): boolean => {
      let currentZoneId: string | null = pos.zone_id
      const zoneMap = new Map<string, any>()
      displayZones.forEach((z: any) => zoneMap.set(z.id, z))
      while (currentZoneId) {
        const z = zoneMap.get(currentZoneId)
        if (!z) break
        if (isHallZone(z)) return true
        currentZoneId = z.parent_id
      }
      return false
    },
    [displayZones]
  )

  const computeZoneStats = useCallback(
    (allPos: any[]) => {
      const exportPos = allPos.filter(p => isPosExport(p))
      let totalQty = 0
      let totalUnit = ''
      let shelfCount = 0
      let hallCount = 0

      exportPos.forEach(p => {
        const info = getPosExportInfo(p)
        if (info) {
          totalQty += info.quantity || 0
          if (!totalUnit && info.unit) totalUnit = info.unit
        }
        if (isPositionInHall(p)) hallCount++
        else shelfCount++
      })

      return {
        totalPositions: exportPos.length,
        totalQty,
        totalUnit,
        shelfCount,
        hallCount,
      }
    },
    [isPosExport, getPosExportInfo, isPositionInHall]
  )

  const getCellColors = (pos: any, isZoneCompleted = false) => {
    const isExp = isPosExport(pos)
    if (isZoneCompleted && isExp) {
      return {
        bg: '#f0fdf4',
        border: '#86efac',
        dot: '#22c55e',
        textBold: true,
        textColor: '#0f172a',
      }
    }
    const info = getPosExportInfo(pos)
    const pc = getPriorityConfig(info?.priority)
    if (pc) {
      return {
        bg: pc.bgHex,
        border: pc.borderHex,
        dot: pc.hex,
        textBold: true,
        textColor: '#0f172a',
      }
    }
    if (isExp) {
      return {
        bg: '#eff6ff',
        border: '#93c5fd',
        dot: '#3b82f6',
        textBold: true,
        textColor: '#0f172a',
      }
    }
    return {
      bg: isDark ? '#1e293b' : '#ffffff',
      border: isDark ? '#334155' : '#e2e8f0',
      dot: isDark ? '#475569' : '#cbd5e1',
      textBold: false,
      textColor: isDark ? '#94a3b8' : '#64748b',
    }
  }

  const renderGroupedZone = (zone: any) => {
    const allPositions = getAllPositions(zone)
    if (allPositions.length === 0) return null
    const exportCountInGroup = allPositions.filter(p => isPosExport(p)).length
    if (exportCountInGroup === 0) return null

    const isCompleted = completedZones.has(zone.id)
    const toggleCompleted = (e: React.MouseEvent) => {
      e.stopPropagation()
      setCompletedZones(prev => {
        const next = new Set(prev)
        if (next.has(zone.id)) next.delete(zone.id)
        else next.add(zone.id)
        return next
      })
    }

    return (
      <div
        key={zone.id}
        onClick={() => setSelectedZoneForDetail(zone)}
        className={`mb-2.5 p-3 rounded-xl border cursor-pointer transition active:scale-[0.99] ${
          isCompleted
            ? 'bg-emerald-500/10 border-emerald-500/40'
            : isDark
            ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
            : 'bg-white border-slate-200 hover:border-blue-300 shadow-2xs'
        }`}
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className={`text-xs font-black ${
                isCompleted
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : isDark
                  ? 'text-slate-100'
                  : 'text-slate-800'
              }`}
            >
              {zone.code || zone.name}
            </span>
            <button
              type="button"
              onClick={toggleCompleted}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 border transition ${
                isCompleted
                  ? 'bg-emerald-500 text-white border-emerald-600'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <span>Đã hạ</span>
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-white text-emerald-600' : 'bg-slate-400/30'
                }`}
              >
                {isCompleted && <Check size={10} />}
              </span>
            </button>
          </div>

          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
              isCompleted
                ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                : 'bg-blue-500/15 text-blue-500 border-blue-500/30'
            }`}
          >
            {exportCountInGroup}/{allPositions.length}
          </span>
        </div>

        <div className="flex gap-1 h-2">
          {allPositions.map((pos, idx) => {
            const colors = getCellColors(pos, isCompleted)
            return (
              <div
                key={pos.id || idx}
                className="flex-1 h-full rounded-xs"
                style={{ backgroundColor: colors.dot }}
              />
            )
          })}
        </div>
      </div>
    )
  }

  const renderZone = (zone: any, depth = 0, breadcrumb: string[] = []): React.ReactNode => {
    const hasChildren = zone.children && zone.children.length > 0
    const hasPositions = zone.positions && zone.positions.length > 0
    const currentBreadcrumb = [...breadcrumb, zone.name]
    const exportCountInZone = countExportPositions(zone)

    if (exportCountInZone === 0) return null

    if (hasPositions && !hasChildren && depth > 0) {
      return renderGroupedZone(zone)
    }

    if (depth === 0) {
      const zoneStats = computeZoneStats(getAllPositions(zone))
      return (
        <div
          key={zone.id}
          className={`mb-4 rounded-2xl border overflow-hidden ${
            isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div
            className={`p-3 border-b ${
              isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50/70'
            }`}
          >
            <div className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {zone.name}
            </div>
            <div className="flex items-center flex-wrap gap-2 mt-1 text-xs text-slate-500">
              <span>
                Tổng:{' '}
                <strong className={isDark ? 'text-slate-200' : 'text-slate-900'}>
                  {zoneStats.totalPositions}
                </strong>{' '}
                vị trí
                {zoneStats.totalQty > 0 ? ` (${zoneStats.totalQty} ${zoneStats.totalUnit})` : ''}
              </span>
              <span>|</span>
              <span>
                Trên kệ:{' '}
                <strong className={isDark ? 'text-slate-200' : 'text-slate-900'}>
                  {zoneStats.shelfCount}
                </strong>
              </span>
              <span>|</span>
              <span>
                Sảnh:{' '}
                <strong className={isDark ? 'text-slate-200' : 'text-slate-900'}>
                  {zoneStats.hallCount}
                </strong>
              </span>
            </div>
          </div>
          <div className="p-3">
            {zone.children.map((child: any) => renderZone(child, depth + 1, currentBreadcrumb))}
          </div>
        </div>
      )
    }

    const hasShelfChildren = zone.children.some(
      (c: any) => c.positions?.length > 0 && (!c.children || c.children.length === 0)
    )

    return (
      <div key={zone.id}>
        {hasShelfChildren && (
          <div
            className={`mb-2.5 mt-3 px-2.5 py-1.5 rounded-lg border-l-4 border-sky-500 text-[11px] font-black uppercase tracking-wider ${
              isDark ? 'bg-sky-950/40 text-sky-300' : 'bg-sky-50 text-sky-800'
            }`}
          >
            {currentBreadcrumb.join(' • ')}
          </div>
        )}
        <div>
          {zone.children.map((child: any) => renderZone(child, depth + 1, currentBreadcrumb))}
        </div>
      </div>
    )
  }

  if (!visible) return null

  const subModalPositions = selectedZoneForDetail
    ? getAllPositions(selectedZoneForDetail).filter(p => isPosExport(p))
    : []

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`flex-1 flex flex-col w-full max-w-lg mx-auto overflow-hidden ${
          isDark ? 'bg-[#0b1120] text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-4 py-3.5 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <BarChart2 size={14} />
              <span>THỐNG KÊ CHI TIẾT</span>
            </div>
            <h3 className="text-lg font-black mt-0.5">{taskCode}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGrouped(!isGrouped)}
              className={`p-2 rounded-xl border transition ${
                isGrouped
                  ? 'bg-blue-600 text-white border-blue-500'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title="Gộp / Tách ô kệ"
            >
              <Layers size={17} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-full ${
                isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div
          className={`px-4 py-3 border-b shrink-0 space-y-2 ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center flex-wrap gap-3 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              <span>
                Vị trí xuất: <strong className="text-blue-500">{exportPositionIds.size}</strong>
              </span>
            </div>
            {PRIORITY_COLORS.map(pc => {
              const count = taskItems.filter(i => i.priority === pc.level).length
              return (
                <div key={pc.level} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: pc.hex }}
                  />
                  <span>
                    {pc.label} ({pc.level}): <strong>{count}</strong>
                  </span>
                </div>
              )
            })}
          </div>
          <div
            className={`pt-2 border-t text-[11px] ${
              isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
            }`}
          >
            <strong className="uppercase mr-1">Cấp độ ưu tiên:</strong>
            <span className="text-red-500 font-bold">1-Đỏ</span> Lấy trước →{' '}
            <span className="text-amber-500 font-bold">2-Vàng</span> Lấy sau →{' '}
            <span className="text-amber-700 font-bold">3-Nâu</span> Lấy cuối →{' '}
            <span className="text-blue-500 font-bold">Xanh</span> Mặc định →{' '}
            <span className="text-purple-500 font-bold">4-Tím</span> Tạm giữ
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3.5">
          {zoneTree.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Chưa có dữ liệu phân bổ vị trí kho cho lệnh này.
            </div>
          ) : (
            zoneTree.map(z => renderZone(z))
          )}
        </div>
      </div>

      {/* Sub-Modal Chi tiết từng vị trí xuất trong Tầng/Ô */}
      {selectedZoneForDetail && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/60 p-0">
          <div
            className={`w-full max-w-lg rounded-t-3xl p-4 max-h-[82dvh] flex flex-col shadow-2xl ${
              isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-black">{selectedZoneForDetail.name}</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {subModalPositions.length} vị trí xuất
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedZoneForDetail(null)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {subModalPositions.map(pos => {
                const info = getPosExportInfo(pos)
                const curPriority = info?.priority || null
                return (
                  <div
                    key={pos.id}
                    className={`p-3 rounded-xl border ${
                      isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-black font-mono">{pos.code}</div>
                        {info && (
                          <>
                            <div className="text-xs text-slate-400 mt-0.5">
                              <strong className="text-blue-500">{info.sku}</strong> -{' '}
                              {info.product_name}
                            </div>
                            <div className="text-xs font-bold mt-1">
                              LOT: <span className="font-mono text-amber-500">{info.lot_code}</span>{' '}
                              • SL:{' '}
                              <span className="text-blue-500">
                                {info.quantity} {info.unit}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {info?.position_id && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[10px] font-bold text-slate-400 mr-1">Ưu tiên:</span>
                        <button
                          type="button"
                          onClick={() => onUpdatePriority(info.position_id!, null)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            curPriority === null
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-transparent text-slate-400 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          Mặc định
                        </button>
                        {PRIORITY_COLORS.map(pc => (
                          <button
                            key={pc.level}
                            type="button"
                            onClick={() => onUpdatePriority(info.position_id!, pc.level)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition`}
                            style={
                              curPriority === pc.level
                                ? {
                                    backgroundColor: pc.hex,
                                    color: '#fff',
                                    borderColor: pc.hex,
                                  }
                                : {
                                    backgroundColor: pc.bgHex,
                                    color: pc.textHex,
                                    borderColor: pc.borderHex,
                                  }
                            }
                          >
                            {pc.level}-{pc.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT CHÍNH: TAB CÔNG VIỆC (LỆNH XUẤT KHO, QUÉT HẠ SẢNH & XUẤT KHO)
// ═══════════════════════════════════════════════════════════════════════════
export default function WorkTab({
  isActive = true,
  systemCode = 'KHO_DONG_LANH',
  userProfile,
  triggerToast,
}: WorkTabProps) {
  const { isDark } = useScannerTheme()
  const [step, setStep] = useState<'select' | 'scan'>('select')
  const [useCamera, setUseCamera] = useState<boolean>(false)
  const [isCameraPaused, setIsCameraPaused] = useState<boolean>(false)
  const [manualCode, setManualCode] = useState<string>('')
  const [itemFilterQuery, setItemFilterQuery] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [syncingOps, setSyncingOps] = useState<boolean>(false)
  const [paused, setPaused] = useState<boolean>(false)
  const [showScanFeedback, setShowScanFeedback] = useState<boolean>(false)
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')

  const [tasks, setTasks] = useState<ExportTask[]>([])
  const [selectedTask, setSelectedTask] = useState<ExportTask | null>(null)
  const [taskItems, setTaskItems] = useState<TaskItem[]>([])
  const [zones, setZones] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [pendingOps, setPendingOps] = useState<PendingWorkOp[]>([])

  // Camera BarcodeDetector / Video stream ref
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanTimerRef = useRef<any>(null)

  const notify = useCallback(
    (msg: string) => {
      if (triggerToast) triggerToast(msg)
    },
    [triggerToast]
  )

  // Load pending operations queue from localStorage
  const loadPendingOps = useCallback((): PendingWorkOp[] => {
    try {
      const raw = localStorage.getItem(WORK_STORAGE_KEYS.OPS_QUEUE)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [])

  const savePendingOps = useCallback((ops: PendingWorkOp[]) => {
    setPendingOps(ops)
    try {
      localStorage.setItem(WORK_STORAGE_KEYS.OPS_QUEUE, JSON.stringify(ops))
    } catch {}
  }, [])

  const enqueueWorkOp = useCallback(
    (type: PendingWorkOp['type'], payload: any) => {
      const cur = loadPendingOps()
      const next: PendingWorkOp[] = [
        ...cur,
        {
          id: 'wop_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          type,
          payload,
          timestamp: new Date().toISOString(),
          status: 'pending',
        },
      ]
      savePendingOps(next)
      return next
    },
    [loadPendingOps, savePendingOps]
  )

  // Execute a single operation against Supabase
  const executeWorkOperationOnline = useCallback(
    async (type: PendingWorkOp['type'], payload: any) => {
      if (type === 'HA_SANH') {
        const { lot_id, old_position_id, target_position_id } = payload
        if (old_position_id) {
          await (supabase.from('positions') as any)
            .update({ lot_id: null })
            .eq('id', old_position_id)
        } else if (lot_id) {
          await (supabase.from('positions') as any).update({ lot_id: null }).eq('lot_id', lot_id)
        }
        const { error } = await (supabase.from('positions') as any)
          .update({ lot_id })
          .eq('id', target_position_id)
        if (error) throw error
      } else if (type === 'XUAT_KHO') {
        const { lot_id, lot_items, position_code } = payload
        const exportItemsData: Record<string, any> = {}

        if (Array.isArray(lot_items) && lot_items.length > 0) {
          for (const item of lot_items) {
            const expQty = Number(item.exported_qty ?? item.quantity) || 0
            const origQty = Number(item.original_qty ?? item.quantity) || expQty
            if (expQty > 0) {
              exportItemsData[item.id] = {
                product_id: item.product_id || null,
                product_sku: item.product_sku || '',
                product_name: item.product_name || '',
                exported_quantity: expQty,
                unit: item.unit || '',
                cost_price: 0,
              }
              const remain = origQty - expQty
              if (item.id && !String(item.id).startsWith('task_item_')) {
                if (remain > 0) {
                  await (supabase.from('lot_items') as any)
                    .update({ quantity: remain })
                    .eq('id', item.id)
                } else {
                  await (supabase.from('lot_items') as any).delete().eq('id', item.id)
                }
              }
            }
          }
        } else {
          await (supabase.from('lot_items') as any).delete().eq('lot_id', lot_id)
        }

        const { data: currentItems } = await (supabase.from('lot_items') as any)
          .select('quantity')
          .eq('lot_id', lot_id)
        let totalRemaining = 0
        if (currentItems) {
          currentItems.forEach((i: any) => {
            totalRemaining += i.quantity || 0
          })
        }

        const { data: lotData } = await (supabase.from('lots') as any)
          .select('metadata, status')
          .eq('id', lot_id)
          .maybeSingle()

        if (lotData) {
          const metadata = lotData.metadata ? { ...lotData.metadata } : {}
          if (!metadata.system_history) metadata.system_history = {}
          if (!metadata.system_history.exports) metadata.system_history.exports = []

          metadata.system_history.exports.push({
            id: 'app_exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
            customer: 'Khách qua App',
            description: 'Quét xuất kho qua App Mobile / Scanner',
            location_code: position_code || null,
            items: exportItemsData,
            date: new Date().toISOString(),
            draft: true,
            order_id: null,
          })

          await (supabase.from('lots') as any)
            .update({
              quantity: totalRemaining,
              metadata,
              status: totalRemaining <= 0 ? 'exported' : lotData.status,
            })
            .eq('id', lot_id)

          if (totalRemaining <= 0) {
            await (supabase.from('positions') as any)
              .update({ lot_id: null })
              .eq('lot_id', lot_id)

            const { data: pendingTaskItems } = await (supabase.from('export_task_items') as any)
              .select('id')
              .eq('lot_id', lot_id)
              .eq('status', 'Pending')

            if (pendingTaskItems && pendingTaskItems.length > 0) {
              const itemIds = pendingTaskItems.map((it: any) => it.id)
              await (supabase.from('export_task_items') as any)
                .update({ status: 'Exported' })
                .in('id', itemIds)
            }
          }
        }
      }
    },
    []
  )

  // Đồng bộ hàng đợi thao tác Hạ sảnh / Xuất kho lên Supabase
  const syncPendingWorkOperations = useCallback(
    async (silent = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!silent) notify('🟠 Máy đang ngoại tuyến, các thao tác đã được lưu an toàn trong máy.')
        return
      }
      const queue = loadPendingOps()
      if (queue.length === 0) return

      setSyncingOps(true)
      const remaining: PendingWorkOp[] = []
      let syncedCount = 0

      for (const op of queue) {
        try {
          await executeWorkOperationOnline(op.type, op.payload)
          syncedCount++
        } catch (err: any) {
          remaining.push({
            ...op,
            status: 'failed',
            error: err?.message || 'Lỗi đồng bộ',
          })
        }
      }

      savePendingOps(remaining)
      setSyncingOps(false)

      if (syncedCount > 0 && !silent) {
        notify(`✅ Đã đồng bộ ${syncedCount} thao tác công việc lên hệ thống!`)
      }
    },
    [loadPendingOps, executeWorkOperationOnline, savePendingOps, notify]
  )

  // Nạp dữ liệu Sơ đồ kho (zones + positions) từ cache hoặc từ Supabase
  const loadZonesAndPositions = useCallback(async () => {
    try {
      // 1. Thử đọc từ cache Sơ đồ kho có sẵn (warehouse_map_offline_cache_v8 hoặc IndexedDB)
      const rawMap = localStorage.getItem(WORK_STORAGE_KEYS.MAP_CACHE)
      if (rawMap) {
        const parsed = JSON.parse(rawMap)
        if (parsed?.zones?.length > 0 && parsed?.positions?.length > 0) {
          setZones(parsed.zones)
          setPositions(parsed.positions)
          return { zones: parsed.zones, positions: parsed.positions }
        }
      }

      const idbMap = await getWarehouseMapFromOfflineDb()
      if (idbMap?.zones?.length && idbMap?.positions?.length) {
        setZones(idbMap.zones)
        setPositions(idbMap.positions)
        return { zones: idbMap.zones, positions: idbMap.positions }
      }

      const cachedZ = localStorage.getItem(WORK_STORAGE_KEYS.ZONES)
      const cachedP = localStorage.getItem(WORK_STORAGE_KEYS.POSITIONS)
      if (cachedZ && cachedP) {
        const z = JSON.parse(cachedZ)
        const p = JSON.parse(cachedP)
        if (z.length > 0 && p.length > 0) {
          setZones(z)
          setPositions(p)
          return { zones: z, positions: p }
        }
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { zones: [], positions: [] }
      }

      // 2. Nếu chưa có cache, tải từ Supabase
      const [zData, pData, zpData] = await Promise.all([
        fetchAllPagedRows((from, to) =>
          (supabase.from('zones') as any)
            .select('id, name, code, parent_id, system_type, display_order, is_hall')
            .eq('system_type', systemCode)
            .order('id', { ascending: true })
            .range(from, to)
        ),
        fetchAllPagedRows((from, to) =>
          (supabase.from('positions') as any)
            .select('id, code, lot_id, system_type')
            .eq('system_type', systemCode)
            .order('id', { ascending: true })
            .range(from, to)
        ),
        fetchAllPagedRows((from, to) =>
          (supabase.from('zone_positions') as any)
            .select('position_id, zone_id')
            .order('position_id', { ascending: true })
            .range(from, to)
        ),
      ])

      const zpMap = new Map<string, string>()
      zpData.forEach((zp: any) => {
        if (zp.position_id && zp.zone_id) zpMap.set(zp.position_id, zp.zone_id)
      })

      const formattedPos = pData.map((p: any) => ({
        id: p.id,
        position_id: p.id,
        code: p.code,
        lot_id: p.lot_id,
        zone_id: zpMap.get(p.id) || null,
        zone_ids: zpMap.get(p.id) ? [zpMap.get(p.id)!] : [],
        positions: { id: p.id, code: p.code, lot_id: p.lot_id },
      }))

      setZones(zData)
      setPositions(formattedPos)
      try {
        localStorage.setItem(WORK_STORAGE_KEYS.ZONES, JSON.stringify(zData))
        localStorage.setItem(WORK_STORAGE_KEYS.POSITIONS, JSON.stringify(formattedPos))
      } catch {}
      return { zones: zData, positions: formattedPos }
    } catch {
      return { zones: [], positions: [] }
    }
  }, [systemCode])

  const formatRawTaskItems = useCallback((rawItems: any[]): TaskItem[] => {
    return (rawItems || [])
      .map((item: any) => {
        const origPos = item.positions?.code || item.position_name || 'N/A'
        const lotPosArr = item.lots?.positions
        const currPos =
          (Array.isArray(lotPosArr) ? lotPosArr[0]?.code : lotPosArr?.code) ||
          item.current_position_name ||
          origPos
        const isExported = item.status === 'Exported' || item.display_status === 'Exported'
        const isMoved =
          !isExported && (origPos !== currPos || item.display_status === 'Moved to Hall')
        const rawStt = item.lots?.daily_seq ? decodeSTT(item.lots.daily_seq) : item.lot_stt || null
        const rawTags: string[] = Array.isArray(item.lots?.lot_tags)
          ? Array.from(
              new Set(
                item.lots.lot_tags
                  .map((lt: any) => (lt?.tag || '').trim())
                  .filter(Boolean)
              )
            )
          : Array.isArray(item.tags)
          ? item.tags
          : []

        return {
          id: item.id,
          lot_id: item.lots?.id || item.lot_id || null,
          lot_code: item.lots?.code || item.lot_code || 'N/A',
          lot_stt: rawStt,
          production_code: item.lots?.production_code || item.production_code || null,
          tags: rawTags,
          position_id: item.position_id || null,
          position_name: origPos,
          current_position_name: currPos,
          product_name: item.products?.name || item.product_name || 'N/A',
          sku: item.products?.sku || item.sku || '',
          quantity: Number(item.quantity) || 0,
          unit: item.unit || '',
          priority: item.priority ?? null,
          status: item.status || 'Pending',
          display_status: (isExported ? 'Exported' : isMoved ? 'Moved to Hall' : 'Pending') as
            | 'Pending'
            | 'Moved to Hall'
            | 'Exported',
        }
      })
      .sort((a, b) =>
        (a.position_name || '').localeCompare(b.position_name || '', undefined, { numeric: true })
      )
  }, [])

  // Nạp danh sách Lệnh xuất kho (Hỗ trợ cả Online & Offline Cache)
  const fetchTasks = useCallback(
    async (forceOnline = false) => {
      setLoading(true)
      try {
        // 1. Đọc từ cache máy trước để hiển thị ngay 0ms
        const cachedRaw = localStorage.getItem(WORK_STORAGE_KEYS.TASKS)
        if (cachedRaw && !forceOnline) {
          const parsed: ExportTask[] = JSON.parse(cachedRaw)
          const filtered = parsed.filter(t => !t.system_code || t.system_code === systemCode)
          setTasks(filtered)
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setLoading(false)
          return
        }

        // Đồng bộ hàng đợi trước khi tải mới
        await syncPendingWorkOperations(true)

        // 2. Tải danh sách export_tasks đang Pending / In Progress từ Supabase
        const { data: tasksData, error: tErr } = await (supabase.from('export_tasks') as any)
          .select('*')
          .eq('system_code', systemCode)
          .in('status', ['Pending', 'In Progress', 'Processing'])
          .order('created_at', { ascending: false })

        if (tErr) throw tErr

        const taskList = tasksData || []
        if (taskList.length === 0) {
          setTasks([])
          localStorage.setItem(WORK_STORAGE_KEYS.TASKS, JSON.stringify([]))
          setLoading(false)
          return
        }

        const taskIds = taskList.map((t: any) => t.id)
        const { data: itemsData, error: iErr } = await (supabase.from('export_task_items') as any)
          .select(
            `
            id,
            task_id,
            quantity,
            unit,
            status,
            priority,
            lot_id,
            position_id,
            positions:positions!export_task_items_position_id_fkey (code),
            lots (
              id,
              code,
              daily_seq,
              production_code,
              lot_tags (tag),
              positions!positions_lot_id_fkey (code),
              lot_items (id, product_id, quantity, unit, products (name, sku))
            ),
            products (name, sku)
          `
          )
          .in('task_id', taskIds)

        if (iErr) throw iErr

        const allItems = itemsData || []
        const enrichedTasks: ExportTask[] = taskList.map((t: any) => {
          const tItems = allItems.filter((it: any) => it.task_id === t.id)
          return {
            id: t.id,
            code: t.code,
            status: t.status,
            system_code: t.system_code,
            created_at: t.created_at,
            notes: t.notes,
            items_count: tItems.length,
            items: tItems,
          }
        })

        setTasks(enrichedTasks)
        try {
          localStorage.setItem(WORK_STORAGE_KEYS.TASKS, JSON.stringify(enrichedTasks))
        } catch {}

        // Nếu đang mở 1 lệnh, cập nhật luôn danh sách LOT của lệnh đó
        if (selectedTask) {
          const found = enrichedTasks.find(t => t.id === selectedTask.id)
          if (found && found.items) {
            setTaskItems(formatRawTaskItems(found.items))
          }
        }
      } catch (err: any) {
        notify('⚠️ Lỗi tải lệnh xuất kho: ' + (err?.message || 'Đã chuyển sang dữ liệu lưu máy'))
      } finally {
        setLoading(false)
      }
    },
    [systemCode, selectedTask, formatRawTaskItems, notify, syncPendingWorkOperations]
  )

  useEffect(() => {
    setPendingOps(loadPendingOps())
    void loadZonesAndPositions()
    void fetchTasks(false)
  }, [loadPendingOps, loadZonesAndPositions, fetchTasks])

  // Tự động đồng bộ khi có mạng lại
  useEffect(() => {
    const onOnline = () => {
      void syncPendingWorkOperations(false)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [syncPendingWorkOperations])

  const selectTask = async (task: ExportTask) => {
    setSelectedTask(task)
    if (task.items && task.items.length > 0) {
      setTaskItems(formatRawTaskItems(task.items))
    } else {
      try {
        const cachedRaw = localStorage.getItem(WORK_STORAGE_KEYS.TASKS)
        if (cachedRaw) {
          const allTasks: ExportTask[] = JSON.parse(cachedRaw)
          const found = allTasks.find(t => t.id === task.id)
          if (found?.items) {
            setTaskItems(formatRawTaskItems(found.items))
          }
        }
      } catch {}
    }
    setStep('scan')
  }

  const handleReset = () => {
    setStep('select')
    setSelectedTask(null)
    setTaskItems([])
    setManualCode('')
    setItemFilterQuery('')
    setPaused(false)
    setUseCamera(false)
  }

  // Lưu thay đổi vào cache localStorage cho tasks & positions
  const updateLocalCachesAfterMove = (
    taskId: string,
    itemId: string,
    lotId: string,
    targetPosId: string,
    targetPosCode: string
  ) => {
    setPositions(prev => {
      const next = prev.map((p: any) => {
        const pid = p.position_id || p.id
        const curLotId = p.positions?.lot_id !== undefined ? p.positions?.lot_id : p.lot_id
        if (pid === targetPosId) {
          return {
            ...p,
            lot_id: lotId,
            positions: p.positions ? { ...p.positions, lot_id: lotId } : undefined,
          }
        }
        if (curLotId === lotId) {
          return {
            ...p,
            lot_id: null,
            positions: p.positions ? { ...p.positions, lot_id: null } : undefined,
          }
        }
        return p
      })
      try {
        localStorage.setItem(WORK_STORAGE_KEYS.POSITIONS, JSON.stringify(next))
      } catch {}
      return next
    })

    try {
      const cachedTasksRaw = localStorage.getItem(WORK_STORAGE_KEYS.TASKS)
      if (cachedTasksRaw) {
        const allTasks: ExportTask[] = JSON.parse(cachedTasksRaw)
        const updatedTasks = allTasks.map(t => {
          if (t.id === taskId && Array.isArray(t.items)) {
            return {
              ...t,
              items: t.items.map((i: any) => {
                if (i.id === itemId) {
                  return {
                    ...i,
                    status: 'Pending',
                    current_position_name: targetPosCode,
                    display_status: 'Moved to Hall',
                    lots: i.lots ? { ...i.lots, positions: [{ code: targetPosCode }] } : undefined,
                  }
                }
                return i
              }),
            }
          }
          return t
        })
        localStorage.setItem(WORK_STORAGE_KEYS.TASKS, JSON.stringify(updatedTasks))
        setTasks(updatedTasks)
      }
    } catch {}
  }

  // Xử lý quét / nhập mã LOT hoặc mã STT hoặc mã vị trí để Hạ sảnh (Giống 100% WorkScreen của qlk-app)
  const processLot = useCallback(
    async (rawInput: string) => {
      const code = extractLotCode(rawInput)
      if (!code) return

      setLoading(true)
      try {
        const cleanStt = code.replace(/^(#|STT[:\s-#]*)/i, '').trim()
        const item = taskItems.find(
          i =>
            i.lot_code.toUpperCase() === code ||
            (i.production_code && i.production_code.toUpperCase() === code) ||
            (i.lot_stt && i.lot_stt.toUpperCase() === cleanStt) ||
            (i.position_name && i.position_name.toUpperCase() === code)
        )

        if (!item) {
          notify(`❌ Mã "${code}" không thuộc lệnh xuất ${selectedTask?.code || ''}`)
          setPaused(false)
          return
        }
        if (!item.lot_id) {
          notify(`❌ LOT "${item.lot_code}" không có dữ liệu ID hợp lệ`)
          setPaused(false)
          return
        }
        if (item.display_status === 'Exported') {
          notify(`ℹ️ LOT "${item.lot_code}" đã được xuất kho trước đó`)
          setPaused(false)
          return
        }

        let curZones = zones
        let curPositions = positions
        if (curZones.length === 0 || curPositions.length === 0) {
          const loaded = await loadZonesAndPositions()
          curZones = loaded.zones
          curPositions = loaded.positions
        }

        const hallZones = curZones.filter((z: any) => isHallZone(z))
        if (hallZones.length === 0) {
          notify('❌ Không tìm thấy khu vực Sảnh trong sơ đồ kho!')
          setPaused(false)
          return
        }

        // Lấy tất cả zone con của Sảnh
        const targetZoneIds = new Set<string>(hallZones.map((z: any) => z.id))
        let added = true
        while (added) {
          added = false
          for (const z of curZones) {
            if (z.parent_id && targetZoneIds.has(z.parent_id) && !targetZoneIds.has(z.id)) {
              targetZoneIds.add(z.id)
              added = true
            }
          }
        }

        // Tìm vị trí trống trong Sảnh
        const avail = curPositions.find((p: any) => {
          const zId = p.zone_id || (Array.isArray(p.zone_ids) ? p.zone_ids[0] : null)
          const hasLot = p.positions?.lot_id !== undefined ? Boolean(p.positions?.lot_id) : Boolean(p.lot_id)
          return zId && targetZoneIds.has(zId) && !hasLot
        })

        if (!avail) {
          notify('❌ Không còn vị trí trống nào trong Sảnh!')
          setPaused(false)
          return
        }

        const targetPosId = avail.position_id || avail.id
        const targetPosCode = avail.positions?.code || avail.code

        const opPayload = {
          lot_id: item.lot_id,
          lot_code: item.lot_code,
          old_position_id: item.position_id,
          target_position_id: targetPosId,
        }

        // 1. Cập nhật Optimistic UI ngay lập tức (0ms)
        setTaskItems(prev =>
          prev.map(i =>
            i.id === item.id
              ? { ...i, current_position_name: targetPosCode, display_status: 'Moved to Hall' }
              : i
          )
        )
        if (selectedTask) {
          updateLocalCachesAfterMove(
            selectedTask.id,
            item.id,
            item.lot_id,
            targetPosId,
            targetPosCode
          )
        }

        // 2. Nếu có mạng thì đẩy trực tiếp, nếu lỗi hoặc mất mạng thì lưu vào hàng đợi Offline
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            await executeWorkOperationOnline('HA_SANH', opPayload)
            notify(`✅ Đã hạ sảnh ${item.lot_code} → ${targetPosCode}!`)
          } catch {
            enqueueWorkOp('HA_SANH', opPayload)
            notify(`✅ Đã hạ sảnh ${item.lot_code} → ${targetPosCode} (Đã lưu hàng chờ offline)!`)
          }
        } else {
          enqueueWorkOp('HA_SANH', opPayload)
          notify(`✅ Đã hạ sảnh ${item.lot_code} → ${targetPosCode} (Lưu ngoại tuyến)!`)
        }
      } catch (err: any) {
        notify('❌ Lỗi hạ sảnh: ' + (err?.message || 'Không xác định'))
      } finally {
        setLoading(false)
        setShowScanFeedback(true)
        setTimeout(() => setShowScanFeedback(false), 600)
        setTimeout(() => setPaused(false), 1800)
      }
    },
    [
      taskItems,
      selectedTask,
      zones,
      positions,
      loadZonesAndPositions,
      executeWorkOperationOnline,
      enqueueWorkOp,
      notify,
    ]
  )

  const handleScan = useCallback(
    async (rawCode: string) => {
      if (loading || paused || !rawCode || !rawCode.trim()) return
      setPaused(true)
      setManualCode('')
      await processLot(rawCode)
    },
    [loading, paused, processLot]
  )

  // Hạ sảnh hàng loạt cho nhiều LOT (VD: bấm "Hạ hết" của 1 tầng)
  const handleBulkHaSanh = useCallback(
    async (lotCodes: string[]) => {
      if (loading || !lotCodes || lotCodes.length === 0) return
      const targetCodeSet = new Set(lotCodes.map(c => c.toUpperCase()))
      const itemsToMove = taskItems.filter(
        i =>
          i.display_status === 'Pending' &&
          i.lot_id &&
          targetCodeSet.has(i.lot_code.toUpperCase())
      )
      if (itemsToMove.length === 0) return

      setLoading(true)
      try {
        let curZones = zones
        let curPositions = positions
        if (curZones.length === 0 || curPositions.length === 0) {
          const loaded = await loadZonesAndPositions()
          curZones = loaded.zones
          curPositions = loaded.positions
        }

        const hallZones = curZones.filter((z: any) => isHallZone(z))
        if (hallZones.length === 0) {
          notify('❌ Không tìm thấy khu vực Sảnh trong sơ đồ kho!')
          return
        }

        const targetZoneIds = new Set<string>(hallZones.map((z: any) => z.id))
        let added = true
        while (added) {
          added = false
          for (const z of curZones) {
            if (z.parent_id && targetZoneIds.has(z.parent_id) && !targetZoneIds.has(z.id)) {
              targetZoneIds.add(z.id)
              added = true
            }
          }
        }

        const availList = curPositions.filter((p: any) => {
          const zId = p.zone_id || (Array.isArray(p.zone_ids) ? p.zone_ids[0] : null)
          const hasLot =
            p.positions?.lot_id !== undefined ? Boolean(p.positions?.lot_id) : Boolean(p.lot_id)
          return zId && targetZoneIds.has(zId) && !hasLot
        })

        if (availList.length < itemsToMove.length) {
          notify(
            `❌ Cần ${itemsToMove.length} vị trí trống ở Sảnh nhưng chỉ còn ${availList.length} ô trống!`
          )
          return
        }

        const assignments = itemsToMove.map((item, idx) => {
          const avail = availList[idx]
          return {
            item,
            targetPosId: avail.position_id || avail.id,
            targetPosCode: avail.positions?.code || avail.code,
          }
        })

        // 1. Cập nhật Optimistic UI ngay lập tức
        const movedByItemId = new Map<string, string>()
        assignments.forEach(a => movedByItemId.set(a.item.id, a.targetPosCode))

        setTaskItems(prev =>
          prev.map(i => {
            const nextPosCode = movedByItemId.get(i.id)
            if (!nextPosCode) return i
            return { ...i, current_position_name: nextPosCode, display_status: 'Moved to Hall' }
          })
        )

        if (selectedTask) {
          assignments.forEach(a => {
            if (a.item.lot_id) {
              updateLocalCachesAfterMove(
                selectedTask.id,
                a.item.id,
                a.item.lot_id,
                a.targetPosId,
                a.targetPosCode
              )
            }
          })
        }

        // 2. Thực thi Online hoặc đẩy vào hàng đợi Offline
        let offlineCount = 0
        for (const a of assignments) {
          const opPayload = {
            lot_id: a.item.lot_id,
            lot_code: a.item.lot_code,
            old_position_id: a.item.position_id,
            target_position_id: a.targetPosId,
          }
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            try {
              await executeWorkOperationOnline('HA_SANH', opPayload)
            } catch {
              enqueueWorkOp('HA_SANH', opPayload)
              offlineCount++
            }
          } else {
            enqueueWorkOp('HA_SANH', opPayload)
            offlineCount++
          }
        }

        if (offlineCount > 0) {
          notify(
            `✅ Đã hạ sảnh ${assignments.length} LOT (${offlineCount} thao tác lưu hàng chờ offline)!`
          )
        } else {
          notify(`✅ Đã hạ sảnh toàn bộ ${assignments.length} LOT!`)
        }
      } catch (err: any) {
        notify('❌ Lỗi hạ sảnh hàng loạt: ' + (err?.message || 'Không xác định'))
      } finally {
        setLoading(false)
      }
    },
    [
      loading,
      taskItems,
      zones,
      positions,
      selectedTask,
      loadZonesAndPositions,
      executeWorkOperationOnline,
      enqueueWorkOp,
      notify,
    ]
  )

  // Xuất kho hàng loạt cho các LOT đã Hạ sảnh ('Moved to Hall')
  const handleBulkExport = async () => {
    const itemsToExport = taskItems.filter(i => i.display_status === 'Moved to Hall')
    if (itemsToExport.length === 0) return

    setLoading(true)
    try {
      // Tìm thông tin lot_items từ cache tasks nếu có
      let rawTaskItemsInCache: any[] = []
      try {
        const cachedTasksRaw = localStorage.getItem(WORK_STORAGE_KEYS.TASKS)
        if (cachedTasksRaw && selectedTask) {
          const allTasks: ExportTask[] = JSON.parse(cachedTasksRaw)
          const found = allTasks.find(t => t.id === selectedTask.id)
          if (found?.items) rawTaskItemsInCache = found.items
        }
      } catch {}

      const opsToRun: Array<{ type: 'XUAT_KHO'; payload: any }> = []

      for (const item of itemsToExport) {
        if (!item.lot_id) continue
        const rawMatch = rawTaskItemsInCache.find(r => r.id === item.id)
        const lotItemsFromDb = rawMatch?.lots?.lot_items

        const exportItems =
          Array.isArray(lotItemsFromDb) && lotItemsFromDb.length > 0
            ? lotItemsFromDb.map((li: any) => ({
                id: li.id,
                original_qty: li.quantity,
                exported_qty: li.quantity,
                product_id: li.product_id,
                product_sku: li.products?.sku || item.sku,
                product_name: li.products?.name || item.product_name,
                unit: li.unit || item.unit,
              }))
            : [
                {
                  id: `task_item_${item.id}`,
                  original_qty: item.quantity,
                  exported_qty: item.quantity,
                  product_id: null,
                  product_sku: item.sku,
                  product_name: item.product_name,
                  unit: item.unit,
                },
              ]

        opsToRun.push({
          type: 'XUAT_KHO',
          payload: {
            lot_id: item.lot_id,
            lot_code: item.lot_code,
            position_code: item.current_position_name,
            lot_items: exportItems,
          },
        })
      }

      // 1. Optimistic update
      const lotIdsToClear = new Set(itemsToExport.map(i => i.lot_id))
      setTaskItems(prev =>
        prev.map(i =>
          i.display_status === 'Moved to Hall' ? { ...i, display_status: 'Exported' } : i
        )
      )

      setPositions(prev => {
        const next = prev.map((p: any) => {
          const curLotId = p.positions?.lot_id !== undefined ? p.positions?.lot_id : p.lot_id
          if (curLotId && lotIdsToClear.has(curLotId)) {
            return {
              ...p,
              lot_id: null,
              positions: p.positions ? { ...p.positions, lot_id: null } : undefined,
            }
          }
          return p
        })
        try {
          localStorage.setItem(WORK_STORAGE_KEYS.POSITIONS, JSON.stringify(next))
        } catch {}
        return next
      })

      try {
        const cachedTasksRaw = localStorage.getItem(WORK_STORAGE_KEYS.TASKS)
        if (cachedTasksRaw && selectedTask) {
          const allTasks: ExportTask[] = JSON.parse(cachedTasksRaw)
          const updatedTasks = allTasks.map(t => {
            if (t.id === selectedTask.id && Array.isArray(t.items)) {
              return {
                ...t,
                items: t.items.map((i: any) => {
                  const lid = i.lots?.id || i.lot_id
                  if (lid && lotIdsToClear.has(lid)) {
                    return { ...i, status: 'Exported', display_status: 'Exported' }
                  }
                  return i
                }),
              }
            }
            return t
          })
          localStorage.setItem(WORK_STORAGE_KEYS.TASKS, JSON.stringify(updatedTasks))
          setTasks(updatedTasks)
        }
      } catch {}

      // 2. Thực thi Online hoặc đưa vào Queue Offline
      let onlineSuccess = 0
      for (const op of opsToRun) {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            await executeWorkOperationOnline(op.type, op.payload)
            onlineSuccess++
          } catch {
            enqueueWorkOp(op.type, op.payload)
          }
        } else {
          enqueueWorkOp(op.type, op.payload)
        }
      }

      if (onlineSuccess === opsToRun.length) {
        notify(`✅ Đã xuất kho thành công ${itemsToExport.length} LOT!`)
      } else {
        notify(`✅ Đã xuất ${itemsToExport.length} LOT (Lưu hàng đợi đồng bộ)!`)
      }
    } catch (err: any) {
      notify('❌ Lỗi xuất kho: ' + (err?.message || 'Không xác định'))
    } finally {
      setLoading(false)
    }
  }

  // Cập nhật mức độ ưu tiên vị trí xuất
  const handleUpdatePriority = async (posId: string, level: number | null) => {
    setTaskItems(prev =>
      prev.map(it => (it.position_id === posId ? { ...it, priority: level } : it))
    )
    const targetItem = taskItems.find(it => it.position_id === posId)
    if (!targetItem) return

    try {
      const cachedTasksRaw = localStorage.getItem(WORK_STORAGE_KEYS.TASKS)
      if (cachedTasksRaw) {
        const allTasks: ExportTask[] = JSON.parse(cachedTasksRaw)
        const updated = allTasks.map(t => ({
          ...t,
          items: Array.isArray(t.items)
            ? t.items.map((i: any) => (i.id === targetItem.id ? { ...i, priority: level } : i))
            : t.items,
        }))
        localStorage.setItem(WORK_STORAGE_KEYS.TASKS, JSON.stringify(updated))
      }
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await (supabase.from('export_task_items') as any)
          .update({ priority: level })
          .eq('id', targetItem.id)
      }
    } catch {}
  }

  // Quản lý Camera Barcode Scanner trên Web
  useEffect(() => {
    const stopCam = () => {
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current)
        scanTimerRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }

    if (!isActive || step !== 'scan' || !useCamera || isCameraPaused) {
      stopCam()
      return
    }

    let isCancelled = false
    const startCam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (isCancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }

        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'code_128', 'ean_13'],
          })
          scanTimerRef.current = setInterval(async () => {
            if (!videoRef.current || paused || loading) return
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes && codes.length > 0 && codes[0].rawValue) {
                void handleScan(codes[0].rawValue)
              }
            } catch {}
          }, 350)
        }
      } catch {
        notify('⚠️ Không thể mở Camera, đã chuyển sang chế độ nhập mã.')
        setUseCamera(false)
      }
    }

    void startCam()
    return () => {
      isCancelled = true
      stopCam()
    }
  }, [isActive, step, useCamera, isCameraPaused, paused, loading, handleScan, notify])

  const scannedCount = taskItems.filter(i => i.display_status !== 'Pending').length
  const movedToHallCount = taskItems.filter(i => i.display_status === 'Moved to Hall').length

  const filteredTaskItems = useMemo(() => {
    const q = itemFilterQuery.trim().toLowerCase()
    if (!q) return taskItems
    return taskItems.filter(
      i =>
        i.lot_code.toLowerCase().includes(q) ||
        (i.lot_stt && i.lot_stt.toLowerCase().includes(q)) ||
        i.position_name.toLowerCase().includes(q) ||
        i.current_position_name.toLowerCase().includes(q) ||
        i.product_name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q)
    )
  }, [taskItems, itemFilterQuery])

  // ═════════════════════════════════════════════════════════════════════
  // MÀN HÌNH 1: DANH SÁCH LỆNH XUẤT KHO (STEP === 'SELECT')
  // ═════════════════════════════════════════════════════════════════════
  if (step === 'select') {
    return (
      <div
        className={`flex-1 flex flex-col h-full overflow-y-auto overscroll-y-contain px-3 pt-2.5 pb-24 ${
          isDark ? 'bg-[#0a0f1d] text-slate-100' : 'bg-zinc-50 text-zinc-900'
        }`}
      >
        {/* Header siêu gọn 1 dòng */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-500 flex items-center justify-center shrink-0">
              <Briefcase size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black tracking-tight truncate">Công Việc</h1>
                <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-500 text-[10px] font-black">
                  {tasks.length} lệnh
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                Chọn lệnh xuất để hạ sảnh & xuất kho
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchTasks(true)}
            disabled={loading}
            className="px-3 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-1.5 shadow-xs active:scale-95 transition shrink-0"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Tải lại</span>
          </button>
        </div>

        {/* Thanh đồng bộ hàng đợi Offline nếu có */}
        {pendingOps.length > 0 && (
          <div
            className={`mb-2.5 px-3 py-2 rounded-xl border flex items-center justify-between gap-2 ${
              isDark
                ? 'bg-amber-950/50 border-amber-500/40 text-amber-200'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <WifiOff size={15} className="text-amber-500 shrink-0" />
              <div className="text-xs font-black truncate">
                {pendingOps.length} thao tác chờ đồng bộ
              </div>
            </div>
            <button
              type="button"
              onClick={() => syncPendingWorkOperations(false)}
              disabled={syncingOps}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1 shrink-0 active:scale-95 transition"
            >
              <CloudUpload size={13} className={syncingOps ? 'animate-bounce' : ''} />
              <span>{syncingOps ? 'Đang đẩy...' : 'Đồng bộ'}</span>
            </button>
          </div>
        )}

        {loading && tasks.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-blue-500" />
            <span className="text-xs text-slate-400 font-semibold">
              Đang tải danh sách lệnh xuất kho...
            </span>
          </div>
        ) : tasks.length === 0 ? (
          <div
            className={`py-14 rounded-2xl border text-center flex flex-col items-center justify-center ${
              isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-zinc-200'
            }`}
          >
            <FileText size={32} className="text-slate-500 mb-2" />
            <p className="font-bold text-sm text-slate-400">Không có lệnh xuất kho mới</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Khi quản lý tạo lệnh xuất kho trên hệ thống, lệnh sẽ hiển thị tại đây.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => {
              const formattedItems = Array.isArray(task.items) ? formatRawTaskItems(task.items) : []
              const totalLot = formattedItems.length || task.items_count || 0
              const doneLot = formattedItems.filter(
                it => it.display_status === 'Moved to Hall' || it.display_status === 'Exported'
              ).length
              const totalQty = formattedItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
              const unit = formattedItems.find(it => it.unit)?.unit || ''
              const pct = totalLot > 0 ? Math.round((doneLot / totalLot) * 100) : 0

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => selectTask(task)}
                  className={`w-full px-3 py-2.5 rounded-2xl border text-left transition active:scale-[0.99] space-y-2 ${
                    isDark
                      ? 'bg-slate-900/90 border-slate-800 hover:border-blue-500/50'
                      : 'bg-white border-zinc-200 shadow-2xs hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0">
                        <FileText size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black truncate">{task.code}</div>
                        <div className="text-[10px] text-slate-400 font-semibold truncate">
                          {new Date(task.created_at).toLocaleDateString('vi-VN')}
                          {task.notes ? ` • ${task.notes}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        {totalQty > 0 && (
                          <div className="text-xs font-black text-amber-500 whitespace-nowrap">
                            {totalQty.toLocaleString('vi-VN')} {unit}
                          </div>
                        )}
                        <div className="text-[10px] font-bold text-blue-500 whitespace-nowrap">
                          {doneLot}/{totalLot} LOT hạ
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400 shrink-0" />
                    </div>
                  </div>

                  {/* Thanh tiến độ mảnh */}
                  <div
                    className={`h-1.5 w-full rounded-full overflow-hidden ${
                      isDark ? 'bg-slate-800' : 'bg-zinc-100'
                    }`}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ═════════════════════════════════════════════════════════════════════
  // MÀN HÌNH 2: CHI TIẾT LỆNH & QUÉT HẠ SẢNH / XUẤT KHO (STEP === 'SCAN')
  // ═════════════════════════════════════════════════════════════════════
  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-y-auto overscroll-y-contain px-3 pt-2.5 pb-24 ${
        isDark ? 'bg-[#0a0f1d] text-slate-100' : 'bg-zinc-50 text-zinc-900'
      }`}
    >
      {/* Header siêu gọn (1 dòng: Back + Tên lệnh + Tiến độ + Nút Thống kê/Camera/Xuất kho) */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleReset}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition active:scale-95 ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-300'
                : 'bg-white border-zinc-200 text-zinc-700'
            }`}
          >
            <ArrowLeft size={16} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-black truncate">{selectedTask?.code}</span>
              <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-500 text-[10px] font-black whitespace-nowrap shrink-0">
                {scannedCount}/{taskItems.length} hạ
              </span>
            </div>
            <div
              className={`h-1.5 w-full mt-1 rounded-full overflow-hidden ${
                isDark ? 'bg-slate-800' : 'bg-zinc-200'
              }`}
            >
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{
                  width:
                    taskItems.length > 0 ? `${(scannedCount / taskItems.length) * 100}%` : '0%',
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {movedToHallCount > 0 && (
            <button
              type="button"
              onClick={handleBulkExport}
              disabled={loading}
              className="px-2.5 h-8 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition"
            >
              <UploadCloud size={13} />
              <span>Xuất ({movedToHallCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowStatsModal(true)}
            className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-500 flex items-center justify-center active:scale-95 transition"
            title="Bảng thống kê ưu tiên kệ"
          >
            <BarChart2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => setUseCamera(!useCamera)}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center active:scale-95 transition ${
              useCamera
                ? 'bg-blue-600 text-white border-blue-500'
                : isDark
                ? 'bg-slate-900 border-slate-800 text-slate-300'
                : 'bg-white border-zinc-200 text-zinc-700'
            }`}
            title={useCamera ? 'Ẩn Camera' : 'Bật Camera quét QR / Barcode'}
          >
            {useCamera ? <Keyboard size={15} /> : <Camera size={15} />}
          </button>
        </div>
      </div>

      {/* Khung Camera Quét Mã (chỉ hiện khi bấm nút Camera) */}
      {useCamera && (
        <div className="mb-2.5 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-lg relative aspect-video max-h-56 mx-auto w-full bg-black">
          {!isCameraPaused ? (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {showScanFeedback && (
                <div className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center z-10">
                  <div className="bg-white p-3 rounded-full shadow-lg text-emerald-600">
                    <Check size={32} />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsCameraPaused(true)}
                className="absolute top-2.5 right-2.5 bg-black/50 p-2 rounded-xl border border-white/20 text-white"
              >
                <Pause size={16} />
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900">
              <button
                type="button"
                onClick={() => setIsCameraPaused(false)}
                className="bg-blue-600/20 p-4 rounded-full border border-blue-500/30 text-blue-500"
              >
                <Play size={28} />
              </button>
              <span className="text-blue-400 font-black text-[10px] mt-2 uppercase tracking-widest">
                Chạm để bật lại camera
              </span>
            </div>
          )}
        </div>
      )}

      {/* Thanh gộp 1 dòng: Nhập mã hạ sảnh / Lọc nhanh + Nút chuyển Sơ đồ / Danh sách */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <div
          className={`flex-1 flex items-center gap-1.5 px-2.5 h-9 rounded-xl border min-w-0 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-zinc-200'
          }`}
        >
          <Search size={13} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={manualCode}
            onChange={e => {
              const v = e.target.value
              setManualCode(v.toUpperCase())
              setItemFilterQuery(v)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && manualCode.trim()) {
                void handleScan(manualCode)
              }
            }}
            placeholder="Lọc hoặc nhập LOT / STT / vị trí..."
            className="bg-transparent outline-none text-xs font-semibold flex-1 min-w-0"
          />
          {manualCode && (
            <button
              type="button"
              onClick={() => {
                setManualCode('')
                setItemFilterQuery('')
              }}
              className="text-slate-400 hover:text-slate-200 shrink-0"
            >
              <X size={13} />
            </button>
          )}
          {manualCode.trim() && (
            <button
              type="button"
              onClick={() => handleScan(manualCode)}
              disabled={loading}
              className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black whitespace-nowrap shrink-0 active:scale-95"
            >
              Hạ nhanh
            </button>
          )}
        </div>

        <div
          className={`inline-flex p-0.5 rounded-xl border shrink-0 h-9 items-center ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-zinc-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`px-2.5 h-7 rounded-lg text-[11px] font-black flex items-center gap-1 transition ${
              viewMode === 'map'
                ? 'bg-emerald-600 text-white'
                : isDark
                ? 'text-slate-400'
                : 'text-zinc-500'
            }`}
            title="Xem dạng Sơ đồ kho"
          >
            <MapIcon size={13} />
            <span>Sơ đồ</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-2.5 h-7 rounded-lg text-[11px] font-black flex items-center gap-1 transition ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : isDark
                ? 'text-slate-400'
                : 'text-zinc-500'
            }`}
            title="Xem dạng Danh sách LOT"
          >
            <ListIcon size={13} />
            <span>DS</span>
          </button>
        </div>
      </div>

      {/* Nội dung chính: Sơ Đồ Kho (Mặc định) / Danh Sách LOT */}
      <div className="space-y-2.5">
        {viewMode === 'map' ? (
          <WorkTaskMapView
            taskItems={filteredTaskItems}
            zones={zones}
            positions={positions}
            isDark={isDark}
            loading={loading}
            onHaSanh={lotCode => {
              void handleScan(lotCode)
            }}
            onHaSanhAll={lotCodes => {
              void handleBulkHaSanh(lotCodes)
            }}
          />
        ) : (
          <div className="space-y-2.5">
            {filteredTaskItems.map(item => {
          const isPending = item.display_status === 'Pending'
          const isExported = item.display_status === 'Exported'
          const pc = getPriorityConfig(item.priority)

          return (
            <div
              key={item.id}
              className={`flex items-center p-3.5 rounded-2xl border gap-3 transition ${
                isExported
                  ? isDark
                    ? 'bg-emerald-950/30 border-emerald-800/50'
                    : 'bg-green-50 border-green-100'
                  : !isPending
                  ? isDark
                    ? 'bg-amber-950/30 border-amber-800/50'
                    : 'bg-amber-50 border-amber-100'
                  : isDark
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-zinc-100 shadow-2xs'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isPending
                    ? isDark
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-zinc-100 text-zinc-400'
                    : isExported
                    ? 'bg-emerald-500/20 text-emerald-500'
                    : 'bg-amber-500/20 text-amber-500'
                }`}
              >
                {isPending ? <ArrowDown size={16} /> : <CheckCircle2 size={16} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`font-mono text-sm font-black ${
                      isPending
                        ? 'text-blue-600 dark:text-blue-400'
                        : isExported
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {item.lot_code}
                  </span>
                  {item.lot_stt && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 text-[10px] font-black font-mono">
                      #{item.lot_stt}
                    </span>
                  )}
                  <span className="text-slate-400">•</span>
                  <span className="text-[11px] font-mono font-bold text-slate-400 flex items-center gap-0.5">
                    <MapPin size={10} />
                    {item.position_name}
                    {!isPending && item.current_position_name !== item.position_name
                      ? ` → ${item.current_position_name}`
                      : ''}
                  </span>
                  {pc && (
                    <span
                      className="px-1.5 py-0.2 rounded text-[9px] font-black"
                      style={{
                        backgroundColor: pc.bgHex,
                        color: pc.textHex,
                        border: `1px solid ${pc.borderHex}`,
                      }}
                    >
                      Ưu tiên {pc.level}-{pc.label}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 truncate mt-0.5">
                  <strong className={isDark ? 'text-slate-200' : 'text-zinc-700'}>
                    {item.sku}
                  </strong>{' '}
                  – {item.product_name}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-black">{item.quantity}</div>
                  <div className="text-[10px] text-slate-400">{item.unit}</div>
                </div>

                {isPending && (
                  <button
                    type="button"
                    onClick={() => handleScan(item.lot_code)}
                    disabled={loading}
                    className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black shadow-2xs active:scale-95 transition"
                    title="Hạ sảnh nhanh LOT này"
                  >
                    Hạ sảnh
                  </button>
                )}
              </div>
            </div>
          )
        })}
          </div>
        )}
      </div>

      {/* Modal Thống Kê Chi Tiết Lệnh Xuất Kho */}
      <ExportOrderStatsModal
        visible={showStatsModal}
        taskCode={selectedTask?.code || ''}
        taskItems={taskItems}
        zones={zones}
        positions={positions}
        isDark={isDark}
        onClose={() => setShowStatsModal(false)}
        onUpdatePriority={handleUpdatePriority}
      />
    </div>
  )
}
