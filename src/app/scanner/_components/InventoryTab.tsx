'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  RefreshCw,
  Plus,
  CloudUpload,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Layers,
  Check,
  X,
  Search,
  Loader2,
  Building2,
  Grid,
  List,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Volume2,
  Trash2,
  Cpu,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import {
  saveWarehouseMapToOfflineDb,
  getWarehouseMapFromOfflineDb,
  OfflineInventoryVoiceItem,
  saveOfflineInventoryVoice,
  getOfflineInventoryVoicesBySession,
  getOfflineVoiceCountsBySession,
  deleteOfflineInventoryVoiceByKey,
  remapOfflineInventoryVoiceSession,
  parseVoiceNoteUrls,
  appendVoiceNoteUrl,
} from '@/lib/scanner-db'
import { fetchAllPagedRows, runWithConcurrency, saveWarehouseMapMeta } from './scannerUtils'
import HallLotInputModal, {
  HallOption,
  syncOfflineHallLotUpdatesWeb,
} from './inventory/HallLotInputModal'
import {
  ShiftProductItem,
  getWarehouseProducts,
  normalizeViText,
} from './operations/operationsService'
import { VoiceMicButton, OfflineVoicePayload } from './VoiceMicButton'
import { appendWarehouseVoiceText, normalizeWarehouseVoiceText } from './voiceTextNormalizer'

export interface InventoryTabProps {
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
}

interface ZoneItem {
  id: string
  name: string
  code?: string
  parent_id: string | null
  system_type?: string
  display_order?: number | null
  is_hall?: boolean | null
}

interface PositionItem {
  id: string
  code: string
  lot_id: string | null
  zone_ids: string[]
  stt?: string | null
  lot_code?: string | null
  product_name?: string | null
  sku?: string | null
  aliases?: string | null
  internal_code?: string | null
  internal_name?: string | null
  unit?: string | null
  tags?: string[]
  packaging_date?: string | null
  peeling_date?: string | null
  quantity?: number | null
  items?: {
    product_id?: string | null
    sku?: string | null
    product_name?: string | null
    quantity?: number | null
    unit?: string | null
  }[]
}

const INVENTORY_KEYS = {
  SESSIONS: 'offline_inventory_sessions_v1',
  RESULTS: 'offline_inventory_results_v1',
  DIRTY: 'offline_inventory_dirty_v1',
  USERS_MAP: 'offline_inventory_users_map_v1',
  MEMBERS_MAP: 'offline_inventory_members_map_v1',
  MAP_CACHE: 'warehouse_map_offline_cache_v8',
}

const isUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''))

export const PRODUCT_DOT_PALETTE = [
  '#f59e0b',
  '#06b6d4',
  '#d946ef',
  '#a855f7',
  '#84cc16',
  '#f97316',
  '#38bdf8',
  '#ec4899',
]

export function getProductKey(slot: any): string {
  if (!slot || !slot.lot_id) return ''
  const sku = (slot.sku || '').trim()
  if (sku) return sku
  const name = (slot.product_name || '').trim()
  if (name) return name
  return 'PRODUCT_DEFAULT'
}

export function sortPositionsByDepthAndCol<T extends { code?: string | null }>(list: T[]): T[] {
  return [...list].sort((pa, pb) => {
    const codeA = (pa.code || '').trim().toUpperCase()
    const codeB = (pb.code || '').trim().toUpperCase()

    const matchA = codeA.match(/(\d{2})$/)
    const matchB = codeB.match(/(\d{2})$/)
    const depthA = matchA ? parseInt(matchA[1], 10) : 0
    const depthB = matchB ? parseInt(matchB[1], 10) : 0

    if (depthA !== depthB) {
      return depthB - depthA
    }

    const colMatchA =
      codeA.match(/D\d+([A-Z])/i) ||
      codeA.match(/([A-Z])\d{2}T/i) ||
      codeA.match(/([A-Z])\d+/i)
    const colMatchB =
      codeB.match(/D\d+([A-Z])/i) ||
      codeB.match(/([A-Z])\d{2}T/i) ||
      codeB.match(/([A-Z])\d+/i)
    const colA = colMatchA ? colMatchA[1].toUpperCase() : ''
    const colB = colMatchB ? colMatchB[1].toUpperCase() : ''

    if (colA && colB && colA !== colB) {
      return colA.localeCompare(colB)
    }

    return codeA.localeCompare(codeB, undefined, { numeric: true })
  })
}

function groupInventoryWarehouseData(
  zones: ZoneItem[],
  positions: PositionItem[]
): {
  zones: ZoneItem[]
  positions: (PositionItem & {
    zone_id: string | null
    real_zone_id: string | null
    real_bin_id: string | null
  })[]
} {
  const parentToChildren = new Map<string, ZoneItem[]>()
  const zoneParentMap = new Map<string, string>()

  zones.forEach(z => {
    if (z.parent_id) {
      zoneParentMap.set(z.id, z.parent_id)
      const list = parentToChildren.get(z.parent_id) || []
      list.push(z)
      parentToChildren.set(z.parent_id, list)
    }
  })

  const finalZones: ZoneItem[] = []
  const zoneIdMap = new Map<string, string>()
  const processedOldZoneIds = new Set<string>()

  const getChildren = (parentId: string): ZoneItem[] => parentToChildren.get(parentId) || []

  const processZoneRecursively = (zone: ZoneItem) => {
    if (processedOldZoneIds.has(zone.id)) return

    finalZones.push(zone)
    processedOldZoneIds.add(zone.id)

    const children = getChildren(zone.id)
    if (children.length === 0) return

    const isGroupingContainer = /DÃY|SẢNH|KỆ|KHU|SÀNH/i.test(zone.name || '')

    if (isGroupingContainer) {
      const binGroups: Record<string, ZoneItem[]> = {}
      children.forEach(c => {
        const match = (c.name || '').match(/\d+$/)
        const suffix = match ? match[0] : c.name
        binGroups[suffix] = binGroups[suffix] || []
        binGroups[suffix].push(c)
      })

      Object.entries(binGroups).forEach(([suffix, members]) => {
        if (members.length > 1) {
          const vBinId = `v-bin-${zone.id}-${suffix}`
          finalZones.push({
            ...members[0],
            id: vBinId,
            parent_id: zone.id,
            name: `Ô ${suffix}`,
          })

          const levelGroups: Record<string, ZoneItem[]> = {}
          members.forEach(m => {
            const mChildren = getChildren(m.id)
            mChildren.forEach(lvl => {
              const key = (lvl.name || '').trim().toUpperCase()
              levelGroups[key] = levelGroups[key] || []
              levelGroups[key].push(lvl)
            })
            processedOldZoneIds.add(m.id)
            zoneIdMap.set(m.id, vBinId)
          })

          Object.entries(levelGroups).forEach(([lvlName, lMembers]) => {
            const vLvlId = `v-lvl-${vBinId}-${lvlName}`
            finalZones.push({
              ...lMembers[0],
              id: vLvlId,
              parent_id: vBinId,
              name: lMembers[0].name,
            })

            lMembers.forEach(lm => {
              zoneIdMap.set(lm.id, vLvlId)
              processedOldZoneIds.add(lm.id)
            })
          })
        } else {
          processZoneRecursively(members[0])
        }
      })
    } else {
      children.forEach(c => processZoneRecursively(c))
    }
  }

  const roots = zones.filter(z => !z.parent_id)
  roots.forEach(processZoneRecursively)

  zones.forEach(z => {
    if (!processedOldZoneIds.has(z.id)) finalZones.push(z)
  })

  const finalPositions = positions.map(p => {
    const rawZoneId = p.zone_ids && p.zone_ids.length > 0 ? p.zone_ids[0] : null
    const targetZoneId = (rawZoneId && zoneIdMap.get(rawZoneId)) || rawZoneId
    const realBinId = rawZoneId ? zoneParentMap.get(rawZoneId) || null : null
    return {
      ...p,
      real_zone_id: rawZoneId,
      real_bin_id: realBinId,
      zone_id: targetZoneId,
    }
  })

  return { zones: finalZones, positions: finalPositions }
}

// ── MODAL KIỂM KÊ CHI TIẾT TỪNG TẦNG ──────────────────────────
function LevelInventoryModal({
  level,
  visible,
  onClose,
  inventoryResults,
  systemCode,
  sessionId,
  sessionName,
  companyId,
  voiceVocabulary,
  pendingVoicesMap,
  transcribingVoicesMap,
  togglePositionChecked,
  updatePositionNote,
  onSaveVoiceResult,
  onSaveOfflineVoice,
  onDeleteOfflineVoice,
  onTranscribeOfflineVoice,
  bulkCheckPositions,
}: {
  level: any
  visible: boolean
  onClose: () => void
  inventoryResults: Record<string, { checked?: boolean; note?: string; voice_note_url?: string | null }>
  systemCode: string
  sessionId: string | null
  sessionName?: string | null
  companyId?: string | null
  voiceVocabulary?: string[]
  pendingVoicesMap: Record<string, OfflineInventoryVoiceItem[]>
  transcribingVoicesMap: Record<string, boolean>
  togglePositionChecked: (posId: string) => void
  updatePositionNote: (posId: string, note: string) => void
  onSaveVoiceResult: (posId: string, spokenText: string, voiceUrl?: string | null, voiceKey?: string) => void
  onSaveOfflineVoice: (posId: string, payload: OfflineVoicePayload) => void
  onDeleteOfflineVoice: (posId: string, voiceKey: string) => void
  onTranscribeOfflineVoice: (posId: string, voiceKey: string, positionCode?: string | null) => void
  bulkCheckPositions: (posIds: string[], checked: boolean) => void
}) {
  const [fetchedLotItemsMap, setFetchedLotItemsMap] = useState<Record<string, any[]>>({})
  const fetchedLotItemsRef = useRef<Record<string, any[]>>({})
  const [playingPosId, setPlayingPosId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!visible && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingPosId(null)
    }
  }, [visible])

  const handleTogglePlayAudio = (posId: string, src: string) => {
    if (playingPosId === posId && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingPosId(null)
      return
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    try {
      const audio = new Audio(src)
      audio.onended = () => {
        setPlayingPosId(null)
        audioRef.current = null
      }
      audio.onerror = () => {
        setPlayingPosId(null)
        audioRef.current = null
      }
      audioRef.current = audio
      setPlayingPosId(posId)
      void audio.play().catch(() => {
        setPlayingPosId(null)
        audioRef.current = null
      })
    } catch {
      setPlayingPosId(null)
    }
  }

  useEffect(() => {
    if (!visible || !level?.slots || level.slots.length === 0) return

    const neededLotIds: string[] = []
      ; (level.slots || []).forEach((s: any) => {
        if (!s.lot_id || s.lot_id === 'pending') return
        const hasValidItems =
          Array.isArray(s.items) &&
          s.items.length > 0 &&
          s.items.some((it: any) => it.quantity !== null && it.quantity !== undefined)
        if (
          !hasValidItems &&
          !fetchedLotItemsRef.current[s.lot_id] &&
          !neededLotIds.includes(s.lot_id)
        ) {
          neededLotIds.push(s.lot_id)
        }
      })

    if (neededLotIds.length === 0) return
      ; (supabase.from('lot_items') as any)
        .select('lot_id, product_id, quantity, unit, products ( name, sku, unit )')
        .in('lot_id', neededLotIds)
        .then(({ data, error }: any) => {
          if (error || !data || data.length === 0) return
          const newMap: Record<string, any[]> = {}
          data.forEach((it: any) => {
            if (!newMap[it.lot_id]) newMap[it.lot_id] = []
            newMap[it.lot_id].push({
              product_id: it.product_id,
              sku: it.products?.sku || '',
              product_name: it.products?.name || 'Hàng đông lạnh',
              quantity: it.quantity ?? 0,
              unit: it.unit || it.products?.unit || 'Thùng',
            })
          })
          fetchedLotItemsRef.current = { ...fetchedLotItemsRef.current, ...newMap }
          setFetchedLotItemsMap(prev => ({ ...prev, ...newMap }))
        })
        .catch(() => { })
  }, [visible, level?.slots])

  if (!visible || !level) return null

  const sortedSlots = sortPositionsByDepthAndCol(level.slots || [])
  const allSlotIds: string[] = sortedSlots.map((s: any) => s.id)
  const allChecked = allSlotIds.length > 0 && allSlotIds.every(id => inventoryResults[id]?.checked)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
      <div className="w-full max-w-lg bg-[#0f172a] border border-slate-700 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3 bg-[#1e293b] border-b border-slate-700 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-white truncate">
              {level.binName ? `${level.binName} · ${level.name}` : level.name}
            </div>
            <div className="text-[11px] text-slate-400">
              Tổng: {sortedSlots.length} vị trí • Có hàng:{' '}
              {sortedSlots.filter((s: any) => !!s.lot_id).length}
            </div>
          </div>

          <button
            type="button"
            onClick={() => bulkCheckPositions(allSlotIds, !allChecked)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 border ${allChecked
              ? 'bg-slate-800 border-slate-600 text-slate-300'
              : 'bg-emerald-600 border-emerald-400 text-white'
              }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{allChecked ? 'Bỏ tích tất cả' : 'Tích tất cả'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slots List */}
        <div className="p-3 overflow-y-auto overscroll-contain space-y-2.5 flex-1">
          {sortedSlots.map((slot: any) => {
            const res = inventoryResults[slot.id] || {}
            const isChecked = !!res.checked
            const hasNote = !!(res.note && res.note.trim())
            const hasLot = !!slot.lot_id
            const detailedItems =
              (Array.isArray(slot.items) && slot.items.length > 0
                ? slot.items
                : slot.lot_id
                  ? fetchedLotItemsMap[slot.lot_id]
                  : null) || []

            const cleanTags: string[] = (slot.tags || []).filter(
              (t: string) => t && !t.startsWith('MERGED_') && !t.startsWith('SPLIT_')
            )

            // Tính nhãn vị trí tóm tắt siêu gọn (VD: "A2", "B2", "C2") từ zone_name hoặc trực tiếp từ slot.code (K2D5B08T202)
            const shortPosLabel = (() => {
              const posCode = String(slot.code || '').trim().toUpperCase()
              const rawSuffix = posCode ? posCode.slice(-2) : ''
              const posNum =
                rawSuffix && /^\d+$/.test(rawSuffix)
                  ? String(parseInt(rawSuffix, 10))
                  : rawSuffix

              if (slot.zone_name) {
                const cleanZone = String(slot.zone_name).replace(/^Ô\s*/i, '').trim()
                const m = cleanZone.match(/^([A-Za-z]+)(\d+)$/)
                if (m) return `${m[1].toUpperCase()}${posNum}`
                if (cleanZone) return `${cleanZone}${posNum ? `-${posNum}` : ''}`
              }

              // Parse trực tiếp từ mã vị trí chuẩn kho lạnh: K2D5B08T202 -> B2
              const mCode = posCode.match(/D\d+([A-Z])(\d{2})T\d+?(\d{2})$/) || posCode.match(/([A-Z])(\d{2})T\d+?(\d{2})$/)
              if (mCode) {
                const col = mCode[1]
                const depthNum = String(parseInt(mCode[3], 10))
                return `${col}${depthNum}`
              }
              return null
            })()

            const formattedDate = slot.packaging_date
              ? String(slot.packaging_date).includes('-')
                ? String(slot.packaging_date).split('-').reverse().join('/')
                : String(slot.packaging_date)
              : null

            return (
              <div
                key={slot.id}
                className={`p-2.5 rounded-xl border transition space-y-2 ${hasNote
                  ? 'bg-rose-950/25 border-rose-500/60'
                  : isChecked
                    ? 'bg-emerald-950/25 border-emerald-500/60'
                    : hasLot
                      ? 'bg-[#111c33] border-slate-700/80'
                      : 'bg-[#111c33]/60 border-slate-800'
                  }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Hàng 1: Mã vị trí + Huy hiệu đỏ tóm tắt (Ô 08 - B2) + #STT + Mã phụ */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[12px] font-bold text-sky-400 font-mono tracking-tight">
                        {slot.code}
                      </span>
                      {shortPosLabel && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold leading-none">
                          {shortPosLabel}
                        </span>
                      )}
                      {slot.stt && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-bold leading-none">
                          #{slot.stt}
                        </span>
                      )}
                      {cleanTags.map((tag: string, tIdx: number) => (
                        <span
                          key={`tag-${tIdx}`}
                          className="px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-500/60 text-[10px] font-bold text-amber-300 leading-none"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Hàng 2: Tên sản phẩm (vạch màu bên trái giống App, không SKU/LOT) + SL & ĐG */}
                    {hasLot ? (
                      <div className="border-l-[2.5px] border-sky-400/80 pl-2 space-y-0.5">
                        {detailedItems.length > 1 ? (
                          detailedItems.map((it: any, idx: number) => (
                            <div
                              key={idx}
                              className="text-[11.5px] font-semibold text-white flex items-center justify-between gap-2 bg-[#0f172a]/70 px-2 py-0.5 rounded-md"
                            >
                              <span className="break-words">
                                {it.product_name}
                                {it.sku ? (
                                  <span className="ml-1.5 text-[10px] font-mono font-medium text-indigo-300/90">
                                    ({it.sku})
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-emerald-400 font-bold shrink-0">
                                {it.quantity} {it.unit || 'Thùng'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-[12px] font-semibold text-white leading-snug break-words">
                            {slot.product_name || 'Hàng đông lạnh'}
                            {slot.sku ? (
                              <span className="ml-1.5 text-[10.5px] font-mono font-medium text-indigo-300/90">
                                ({slot.sku})
                              </span>
                            ) : null}
                          </div>
                        )}
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] leading-tight">
                          {slot.quantity != null && (
                            <span className="text-slate-400">
                              SL:{' '}
                              <span className="text-emerald-400 font-bold">
                                {slot.quantity} {slot.unit || 'Thùng'}
                              </span>
                            </span>
                          )}
                          {formattedDate && (
                            <span className="text-amber-300/90 font-semibold">
                              ĐG: {formattedDate}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic leading-tight">Vị trí trống</div>
                    )}
                  </div>

                  {/* Nút tích vuông giống 100% App Android */}
                  <button
                    type="button"
                    onClick={() => togglePositionChecked(slot.id)}
                    aria-label={isChecked ? 'Bỏ tích đã kiểm' : 'Tích đã kiểm'}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition ${isChecked
                      ? 'bg-emerald-500 border-emerald-400 text-white shadow-sm'
                      : 'bg-[#1e293b] border-slate-600/80 text-slate-400 hover:border-slate-500'
                      }`}
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {/* Hàng 3: Ô ghi chú sai lệch + Nút Micro nhập giọng nói */}
                <div className="flex items-start gap-1.5">
                  <textarea
                    rows={Math.min(6, Math.max(1, (res.note || '').split(/\r?\n/).length))}
                    value={res.note || ''}
                    onChange={e => updatePositionNote(slot.id, e.target.value)}
                    placeholder="Ghi chú sai lệch (gõ hoặc bấm Micro)..."
                    className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-[11px] border focus:outline-none resize-none leading-snug ${hasNote
                      ? 'bg-rose-950/40 border-rose-500/60 text-rose-200 placeholder-rose-400/60'
                      : 'bg-[#0f172a] border-slate-700/80 text-white placeholder-slate-500'
                      }`}
                  />
                  {hasNote && (
                    <button
                      type="button"
                      onClick={() => updatePositionNote(slot.id, '')}
                      title="Xóa ghi chú"
                      className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/35 text-rose-400 flex items-center justify-center shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <VoiceMicButton
                    size="sm"
                    saveToServer
                    systemCode={systemCode}
                    sessionId={sessionId}
                    sessionName={sessionName}
                    positionId={slot.id}
                    positionCode={slot.code}
                    companyId={companyId}
                    vocabulary={voiceVocabulary}
                    onResult={(spoken, voiceUrl) =>
                      onSaveVoiceResult(slot.id, spoken, voiceUrl)
                    }
                    onOfflineAudio={payload => onSaveOfflineVoice(slot.id, payload)}
                  />
                </div>

                {/* Danh sách ghi âm (Đã lưu trên Drive + Local chờ dịch — hỗ trợ nhiều đoạn / 1 vị trí) */}
                {(() => {
                  const savedUrls = parseVoiceNoteUrls(res.voice_note_url)
                  const pendingList = pendingVoicesMap[slot.id] || []
                  if (savedUrls.length === 0 && pendingList.length === 0) return null
                  return (
                    <div className="space-y-1.5">
                      {savedUrls.map((sUrl, sIdx) => {
                        const playKey = `saved-${slot.id}-${sIdx}`
                        const isPlaying = playingPosId === playKey
                        return (
                          <div
                            key={playKey}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] bg-sky-500/10 border-sky-500/35 text-sky-300"
                          >
                            <button
                              type="button"
                              onClick={() => handleTogglePlayAudio(playKey, sUrl)}
                              className="flex items-center gap-1.5 font-extrabold min-w-0 flex-1 text-left"
                            >
                              <Volume2 className={`w-3.5 h-3.5 shrink-0 ${isPlaying ? 'animate-pulse' : ''}`} />
                              <span className="truncate">
                                {isPlaying
                                  ? 'Đang phát... (bấm dừng)'
                                  : savedUrls.length > 1
                                    ? `Ghi âm đã lưu #${sIdx + 1}`
                                    : 'Nghe lại ghi âm đã lưu'}
                              </span>
                            </button>
                          </div>
                        )
                      })}

                      {pendingList.map((pv, pIdx) => {
                        const audioSrc = `data:${pv.mimeType};base64,${pv.audioBase64}`
                        const isPlaying = playingPosId === pv.key
                        const isTranscribing = Boolean(transcribingVoicesMap[pv.key])
                        return (
                          <div
                            key={pv.key}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] bg-amber-500/10 border-amber-500/35 text-amber-300"
                          >
                            <button
                              type="button"
                              onClick={() => handleTogglePlayAudio(pv.key, audioSrc)}
                              className="flex items-center gap-1.5 font-extrabold min-w-0 flex-1 text-left"
                            >
                              <Volume2 className={`w-3.5 h-3.5 shrink-0 ${isPlaying ? 'animate-pulse' : ''}`} />
                              <span className="truncate">
                                {isPlaying
                                  ? 'Đang phát... (bấm dừng)'
                                  : pendingList.length > 1
                                    ? `Ghi âm #${pIdx + 1} (${pv.durationSec}s)`
                                    : `Nghe lại (${pv.durationSec}s)`}
                              </span>
                            </button>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={isTranscribing}
                                onClick={() => onTranscribeOfflineVoice(slot.id, pv.key, slot.code)}
                                title="Gửi AI dịch & lưu Google Drive ngay"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/25 border border-violet-400/50 text-violet-100 hover:bg-violet-500/35 font-extrabold text-[11px] disabled:opacity-60"
                              >
                                {isTranscribing ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Cpu className="w-3 h-3" />
                                )}
                                <span>{isTranscribing ? 'Đang dịch...' : 'Dịch'}</span>
                              </button>
                              {!isTranscribing && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteOfflineVoice(slot.id, pv.key)}
                                  title="Xóa ghi âm tạm"
                                  className="text-rose-400 hover:text-rose-300 p-0.5 shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>

        {/* Footer HOÀN TẤT giống App Android */}
        <div className="px-3.5 py-2.5 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold tracking-wide transition active:scale-[0.99]"
          >
            HOÀN TẤT
          </button>
        </div>
      </div>
    </div>
  )
}

// ── COMPONENT CHÍNH: INVENTORY TAB ────────────────────────────
const compareZoneOrder = (a: ZoneItem, b: ZoneItem): number => {
  const oa = a.display_order ?? 0
  const ob = b.display_order ?? 0
  if (oa !== ob) return oa - ob
  return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
}

export function InventoryTab({
  isActive = true,
  systemCode = 'KHO_DONG_LANH',
  userProfile,
}: InventoryTabProps) {
  const [zones, setZones] = useState<ZoneItem[]>([])
  const [positions, setPositions] = useState<PositionItem[]>([])
  const [warehouseProducts, setWarehouseProducts] = useState<ShiftProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Sessions & Results
  const [sessions, setSessions] = useState<any[]>([])
  const [allSessionResults, setAllSessionResults] = useState<
    Record<string, Record<string, { checked?: boolean; note?: string; voice_note_url?: string | null }>>
  >({})
  // Danh sách position_id đã chỉnh sửa trên máy nhưng chưa đồng bộ thành công lên server
  const [dirtyBySession, setDirtyBySession] = useState<Record<string, string[]>>({})
  // Ghi âm offline của phiên hiện tại đang chờ gửi lên Server & AI dịch
  const [pendingVoicesMap, setPendingVoicesMap] = useState<Record<string, OfflineInventoryVoiceItem[]>>({})
  const [pendingVoiceCountBySession, setPendingVoiceCountBySession] = useState<Record<string, number>>({})
  const [transcribingVoicesMap, setTranscribingVoicesMap] = useState<Record<string, boolean>>({})
  const [transcribingSessionId, setTranscribingSessionId] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list')

  // Detail state
  const [isGrouped, setIsGrouped] = useState(true)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)
  const [selectedDetailZoneId, setSelectedDetailZoneId] = useState<string | null>(null)
  const [selectedKhuId, setSelectedKhuId] = useState<string>('ALL')
  const [showHallSummary, setShowHallSummary] = useState(false)
  const [addedHallExtraIds, setAddedHallExtraIds] = useState<string[]>([])
  const [expandedLegendRowIds, setExpandedLegendRowIds] = useState<Record<string, boolean>>({})

  // Tìm kiếm Sản Phẩm theo tên viết tắt + Autocomplete trong Kiểm kê
  const [invSearchQuery, setInvSearchQuery] = useState('')
  const [showInvSuggestions, setShowInvSuggestions] = useState(false)

  // Modals
  const [newSessionModalOpen, setNewSessionModalOpen] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')
  const [newSessionZoneId, setNewSessionZoneId] = useState<string>('ALL')
  const [selectedLevelModalData, setSelectedLevelModalData] = useState<any | null>(null)
  const [hallModalOpen, setHallModalOpen] = useState(false)
  const [hallModalDefaultId, setHallModalDefaultId] = useState<string | null>(null)

  // Long-press helper refs cho ô Tầng (nhấn giữ ~450ms để tích nhanh cả tầng giống App Android)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggeredRef = useRef(false)

  const clearLevelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }, [])

  // ── LOAD SƠ ĐỒ KHO & PHIÊN KIỂM KÊ ──
  const loadLocalCache = useCallback(async (): Promise<boolean> => {
    let hasMap = false
    try {
      const sRaw = localStorage.getItem(INVENTORY_KEYS.SESSIONS)
      if (sRaw) setSessions(JSON.parse(sRaw))
      const rRaw = localStorage.getItem(INVENTORY_KEYS.RESULTS)
      if (rRaw) setAllSessionResults(JSON.parse(rRaw))
      const dRaw = localStorage.getItem(INVENTORY_KEYS.DIRTY)
      if (dRaw) setDirtyBySession(JSON.parse(dRaw))

      // Nạp sẵn danh mục sản phẩm cache để tìm kiếm theo aliases hoạt động cả khi offline
      const pRaw = localStorage.getItem('cached_products')
      if (pRaw) {
        const parsedProds = JSON.parse(pRaw)
        if (Array.isArray(parsedProds) && parsedProds.length > 0) {
          setWarehouseProducts(parsedProds)
        }
      }

      // Ưu tiên IndexedDB (chứa trọn 7.000+ vị trí), fallback localStorage
      const idbSnap = await getWarehouseMapFromOfflineDb().catch(() => null)
      if (idbSnap && idbSnap.zones?.length > 0 && idbSnap.positions?.length > 0) {
        setZones(idbSnap.zones)
        setPositions(idbSnap.positions)
        hasMap = true
      } else {
        const mRaw =
          localStorage.getItem(INVENTORY_KEYS.MAP_CACHE) ||
          localStorage.getItem('warehouse_map_offline_cache_v7')
        if (mRaw) {
          const parsed = JSON.parse(mRaw)
          if (parsed?.zones?.length > 0 && parsed?.positions?.length > 0) {
            setZones(parsed.zones)
            setPositions(parsed.positions)
            hasMap = true
          }
        }
      }
    } catch { }
    return hasMap
  }, [])

  const fetchOnlineData = useCallback(
    async (forceRefreshMap = false, cachedHasMap?: boolean) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setLoading(false)
        if (forceRefreshMap) {
          showToast('Đang mất mạng — sử dụng dữ liệu đã lưu trong máy')
        }
        return
      }
      setLoading(true)
      try {
        await syncOfflineHallLotUpdatesWeb().catch(() => { })
        const prods = await getWarehouseProducts(systemCode).catch(() => [])
        if (prods.length > 0) {
          setWarehouseProducts(prods)
        }

        // 1. Tải danh sách phiên kiểm kê từ Supabase (cô lập theo system_code)
        const { data: remoteSessions } = await (
          supabase.from('internal_inventory_sessions') as any
        )
          .select('*')
          .eq('status', 'active')
          .eq('system_code', systemCode)
          .order('created_at', { ascending: false })

        let mergedSessions: any[] = []
        const localSessions: any[] = (() => {
          try {
            return JSON.parse(localStorage.getItem(INVENTORY_KEYS.SESSIONS) || '[]')
          } catch {
            return []
          }
        })()

        if (remoteSessions) {
          const localOnly = localSessions.filter(
            ls => !isUUID(ls.id) && !remoteSessions.some((rs: any) => rs.id === ls.id)
          )
          mergedSessions = [...localOnly, ...remoteSessions]
          setSessions(mergedSessions)
          localStorage.setItem(INVENTORY_KEYS.SESSIONS, JSON.stringify(mergedSessions))

          // Tải items của các phiên UUID (phân trang tránh giới hạn 1.000 dòng)
          const uuidIds = remoteSessions.map((s: any) => s.id).filter(isUUID)
          if (uuidIds.length > 0) {
            const itemsData = await fetchAllPagedRows((from, to) =>
              (supabase.from('internal_inventory_items') as any)
                .select('session_id, position_id, checked, note, voice_note_url')
                .in('session_id', uuidIds)
                .order('id', { ascending: true })
                .range(from, to)
            )

            if (itemsData.length > 0) {
              // Đọc danh sách vị trí đang sửa offline chưa đồng bộ -> TUYỆT ĐỐI KHÔNG GHI ĐÈ
              const dirtyMap: Record<string, string[]> = (() => {
                try {
                  return JSON.parse(localStorage.getItem(INVENTORY_KEYS.DIRTY) || '{}')
                } catch {
                  return {}
                }
              })()
              setAllSessionResults(prev => {
                const next = { ...prev }
                itemsData.forEach((it: any) => {
                  const dirtySet = new Set(dirtyMap[it.session_id] || [])
                  if (dirtySet.has(it.position_id)) return
                  if (!next[it.session_id]) next[it.session_id] = {}
                  next[it.session_id][it.position_id] = {
                    checked: !!it.checked,
                    note: it.note || '',
                    voice_note_url: it.voice_note_url || null,
                  }
                })
                try {
                  localStorage.setItem(INVENTORY_KEYS.RESULTS, JSON.stringify(next))
                } catch { }
                return next
              })
            }
          }
        }

        // 2. Nếu chưa có sơ đồ kho trong cache hoặc yêu cầu tải mới -> tải từ Supabase (có phân trang cho 7000+ vị trí)
        const hasMap =
          cachedHasMap !== undefined ? cachedHasMap : zones.length > 0 && positions.length > 0
        if (!hasMap || forceRefreshMap) {
          const [rawZones, rawPositions, zpList, pendRes] = await Promise.all([
            fetchAllPagedRows((from, to) =>
              (supabase.from('zones') as any)
                .select('id, name, parent_id, system_type, display_order, is_hall')
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
                .order('zone_id', { ascending: true })
                .range(from, to)
            ),
            (supabase.from('pending_assignments') as any)
              .select('position_id, lot_stt, production_date')
              .eq('system_code', systemCode)
              .eq('status', 'pending'),
          ])

          const zpMap = new Map<string, string[]>()
          zpList.forEach(item => {
            const arr = zpMap.get(item.position_id) || []
            arr.push(item.zone_id)
            zpMap.set(item.position_id, arr)
          })

          const occupiedLotIds = Array.from(
            new Set(rawPositions.map(p => p.lot_id).filter(Boolean))
          )
          const lotMap = new Map<string, any>()
          if (occupiedLotIds.length > 0) {
            const CHUNK = 120
            const chunks: string[][] = []
            for (let i = 0; i < occupiedLotIds.length; i += CHUNK) {
              chunks.push(occupiedLotIds.slice(i, i + CHUNK))
            }
            const chunkResults = await runWithConcurrency(chunks, 6, (chunk) =>
              (supabase.from('lots') as any)
                .select(
                  `
                  id, code, daily_seq, packaging_date, peeling_date, quantity, metadata,
                  products ( name, sku, unit, aliases, internal_code, internal_name ),
                  lot_items ( product_id, quantity, unit, products ( name, sku, unit, aliases ) ),
                  lot_tags ( tag )
                `
                )
                .in('id', chunk)
            )
            chunkResults.forEach((res: any) => {
              ; (res?.data || []).forEach((l: any) => {
                const allItems = l.lot_items || []
                const prodName =
                  l.products?.name ||
                  allItems[0]?.products?.name ||
                  l.metadata?.product_name ||
                  'Hàng đông lạnh'
                const sku = l.products?.sku || allItems[0]?.products?.sku || null
                const aliases = l.products?.aliases || allItems[0]?.products?.aliases || null
                const unit = allItems[0]?.unit || l.products?.unit || 'Thùng'
                const itemsList = allItems.map((it: any) => ({
                  product_id: it.product_id,
                  sku: it.products?.sku || '',
                  product_name: it.products?.name || 'Hàng đông lạnh',
                  quantity: it.quantity ?? 0,
                  unit: it.unit || unit,
                }))
                const tagsList: string[] = Array.from(
                  new Set(
                    (l.lot_tags || [])
                      .map((t: any) => String(t?.tag || '').trim())
                      .filter(Boolean)
                  )
                )
                lotMap.set(l.id, {
                  code: l.code,
                  stt: l.daily_seq ? String(l.daily_seq) : null,
                  product_name: prodName,
                  sku,
                  aliases,
                  internal_code: l.products?.internal_code || null,
                  internal_name: l.products?.internal_name || null,
                  unit,
                  packaging_date: l.packaging_date ? String(l.packaging_date).split('T')[0] : null,
                  quantity: l.quantity ?? null,
                  items: itemsList,
                  tags: tagsList,
                })
              })
            })
          }

          const pendMap = new Map<string, any>()
            ; (pendRes.data || []).forEach((p: any) => {
              if (p.position_id) {
                pendMap.set(p.position_id, {
                  stt: String(p.lot_stt || ''),
                  packaging_date: p.production_date,
                })
              }
            })

          const formattedPos: PositionItem[] = rawPositions.map(p => {
            const lInfo = p.lot_id ? lotMap.get(p.lot_id) : null
            const pInfo = pendMap.get(p.id)
            return {
              id: p.id,
              code: p.code,
              lot_id: p.lot_id || (pInfo ? 'pending' : null),
              zone_ids: zpMap.get(p.id) || [],
              stt: lInfo?.stt || pInfo?.stt || null,
              lot_code: lInfo?.code || (pInfo ? 'Chờ duyệt LOT' : null),
              product_name: lInfo?.product_name || (pInfo ? 'Đang chờ gán LOT' : null),
              sku: lInfo?.sku || null,
              aliases: lInfo?.aliases || null,
              internal_code: lInfo?.internal_code || null,
              internal_name: lInfo?.internal_name || null,
              unit: lInfo?.unit || 'Thùng',
              packaging_date: lInfo?.packaging_date || pInfo?.packaging_date || null,
              quantity: lInfo?.quantity || null,
              items: lInfo?.items || [],
              tags: lInfo?.tags || [],
            }
          })

          setZones(rawZones)
          setPositions(formattedPos)
          const now = new Date().toISOString()
          try {
            await saveWarehouseMapToOfflineDb({
              zones: rawZones,
              positions: formattedPos,
              cachedAt: now,
              systemCode,
            })
            saveWarehouseMapMeta(rawZones, formattedPos, now)
          } catch { }
          try {
            localStorage.setItem(
              INVENTORY_KEYS.MAP_CACHE,
              JSON.stringify({
                zones: rawZones,
                positions: formattedPos,
                cachedAt: now,
              })
            )
          } catch { }
        }
      } finally {
        setLoading(false)
      }
    },
    [systemCode, zones.length, positions.length]
  )

  useEffect(() => {
    let mounted = true
    void (async () => {
      const hasMap = await loadLocalCache()
      if (mounted) {
        void fetchOnlineData(false, hasMap)
      }
    })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── DANH SÁCH KHO GỐC & SẢNH ──
  const rootWarehouses = useMemo(
    () =>
      zones
        .filter(z => !z.parent_id)
        .sort(compareZoneOrder),
    [zones]
  )

  // Phạm vi kho/khu vực của phiếu kiểm kê hiện tại (hỗ trợ cả warehouse_id, zone_id và note.v giống App Android)
  const effectiveWhId = useMemo(() => {
    const activeSess = sessions.find(s => s.id === currentSessionId) || null
    if (!activeSess) return null
    let virtualWhId: string | null = null
    try {
      if (activeSess.note && String(activeSess.note).startsWith('{')) {
        const parsed = JSON.parse(activeSess.note)
        virtualWhId = parsed?.v || null
      }
    } catch { }
    return activeSess.warehouse_id || activeSess.zone_id || virtualWhId || null
  }, [sessions, currentSessionId])

  // Danh sách kho gốc được phép xem trong phiếu hiện tại (nếu phiếu khóa 1 kho -> chỉ hiện đúng kho đó)
  const scopedWarehouses = useMemo(() => {
    if (!effectiveWhId) return rootWarehouses
    const zoneMap = new Map(zones.map(z => [z.id, z]))
    let cur: string | null = effectiveWhId
    let rootId: string | null = null
    while (cur) {
      const z = zoneMap.get(cur)
      if (!z) break
      if (!z.parent_id) {
        rootId = z.id
        break
      }
      cur = z.parent_id
    }
    if (rootId) {
      return rootWarehouses.filter(w => w.id === rootId)
    }
    return rootWarehouses
  }, [effectiveWhId, zones, rootWarehouses])

  useEffect(() => {
    if (scopedWarehouses.length === 0) return
    if (!selectedWarehouseId || !scopedWarehouses.some(w => w.id === selectedWarehouseId)) {
      setSelectedWarehouseId(scopedWarehouses[0].id)
    }
  }, [scopedWarehouses, selectedWarehouseId])

  const allHalls: HallOption[] = useMemo(() => {
    const zMap = new Map(zones.map(z => [z.id, z]))
    const findRoot = (z: ZoneItem): ZoneItem | null => {
      let cur: ZoneItem | undefined = z
      while (cur && cur.parent_id) {
        cur = zMap.get(cur.parent_id)
      }
      return cur || null
    }
    return zones
      .filter(z => z.is_hall || /s[ảàa]nh/i.test(z.name || ''))
      .map(z => {
        const root = findRoot(z)
        return {
          id: z.id,
          name: z.name,
          warehouseId: root?.id || null,
          warehouseName: root?.name || null,
        }
      })
  }, [zones])

  // ── GROUPED VS UNGROUPED DATA ──
  const { activeZones, activePositions } = useMemo(() => {
    if (isGrouped) {
      const grouped = groupInventoryWarehouseData(zones, positions)
      return { activeZones: grouped.zones, activePositions: grouped.positions }
    }
    const rawMapped = positions.map(p => ({
      ...p,
      real_zone_id: p.zone_ids?.[0] || null,
      real_bin_id: null,
      zone_id: p.zone_ids?.[0] || null,
    }))
    return { activeZones: zones, activePositions: rawMapped }
  }, [isGrouped, zones, positions])

  // Helper lấy toàn bộ zone con của 1 zone
  const getDescendantIds = useCallback(
    (rootId: string, zList: ZoneItem[]): Set<string> => {
      const childrenMap = new Map<string, string[]>()
      zList.forEach(z => {
        if (z.parent_id) {
          const arr = childrenMap.get(z.parent_id) || []
          arr.push(z.id)
          childrenMap.set(z.parent_id, arr)
        }
      })
      const result = new Set<string>([rootId])
      const stack = [rootId]
      while (stack.length > 0) {
        const curr = stack.pop()!
        const kids = childrenMap.get(curr) || []
        for (const k of kids) {
          if (!result.has(k)) {
            result.add(k)
            stack.push(k)
          }
        }
      }
      return result
    },
    []
  )

  const currentSession = useMemo(
    () => sessions.find(s => s.id === currentSessionId) || null,
    [sessions, currentSessionId]
  )

  const currentResults = useMemo(
    () => (currentSessionId ? allSessionResults[currentSessionId] || {} : {}),
    [allSessionResults, currentSessionId]
  )

  // ── THAO TÁC TÍCH KIỂM & GHI CHÚ ──
  const markPositionsDirty = (sessionId: string, posIds: string[]) => {
    const validIds = posIds.filter(id => !id.startsWith('summary|') && isUUID(id))
    if (validIds.length === 0) return
    setDirtyBySession(prev => {
      const curSet = new Set(prev[sessionId] || [])
      validIds.forEach(id => curSet.add(id))
      const next = { ...prev, [sessionId]: Array.from(curSet) }
      try {
        localStorage.setItem(INVENTORY_KEYS.DIRTY, JSON.stringify(next))
      } catch { }
      return next
    })
  }

  const saveResultsToStorage = (
    sessionId: string,
    nextSessionRes: Record<string, { checked?: boolean; note?: string; voice_note_url?: string | null }>
  ) => {
    setAllSessionResults(prev => {
      const next = { ...prev, [sessionId]: nextSessionRes }
      try {
        localStorage.setItem(INVENTORY_KEYS.RESULTS, JSON.stringify(next))
      } catch { }
      return next
    })
  }

  // Nạp danh sách ghi âm offline đang chờ AI dịch của phiên hiện tại từ IndexedDB
  useEffect(() => {
    if (!currentSessionId) {
      setPendingVoicesMap({})
      return
    }
    let cancelled = false
    void getOfflineInventoryVoicesBySession(currentSessionId).then(list => {
      if (cancelled) return
      const map: Record<string, OfflineInventoryVoiceItem[]> = {}
      list.forEach(v => {
        if (!map[v.positionId]) map[v.positionId] = []
        map[v.positionId].push(v)
      })
      setPendingVoicesMap(map)
    })
    return () => {
      cancelled = true
    }
  }, [currentSessionId])

  const handleSaveVoiceResult = (
    posId: string,
    spokenText: string,
    voiceUrl?: string | null,
    voiceKey?: string
  ) => {
    if (!currentSessionId) return
    const cur = currentResults[posId] || {}
    const nextNote = spokenText ? appendWarehouseVoiceText(cur.note || '', spokenText) : cur.note || ''
    const nextVoiceUrl = appendVoiceNoteUrl(cur.voice_note_url, voiceUrl)
    const nextRes = {
      ...currentResults,
      [posId]: {
        ...cur,
        note: nextNote,
        voice_note_url: nextVoiceUrl,
        checked: nextNote.trim() || nextVoiceUrl ? true : cur.checked,
      },
    }
    saveResultsToStorage(currentSessionId, nextRes)
    markPositionsDirty(currentSessionId, [posId])
    if (voiceKey && (spokenText || voiceUrl)) {
      void deleteOfflineInventoryVoiceByKey(voiceKey)
      setPendingVoicesMap(prev => {
        const arr = prev[posId]
        if (!arr || arr.length === 0) return prev
        const filtered = arr.filter(x => x.key !== voiceKey)
        const next = { ...prev }
        if (filtered.length > 0) next[posId] = filtered
        else delete next[posId]
        return next
      })
    }
  }

  const handleSaveOfflineVoice = async (posId: string, payload: OfflineVoicePayload) => {
    if (!currentSessionId) return
    try {
      const saved = await saveOfflineInventoryVoice({
        sessionId: currentSessionId,
        positionId: posId,
        audioBase64: payload.audioBase64,
        mimeType: payload.mimeType,
        durationSec: payload.durationSec,
        createdAt: new Date().toISOString(),
      })
      setPendingVoicesMap(prev => ({
        ...prev,
        [posId]: [...(prev[posId] || []), saved],
      }))

      // Tự tích đã kiểm vị trí này & đánh dấu chờ đồng bộ
      const cur = currentResults[posId] || {}
      const nextRes = {
        ...currentResults,
        [posId]: { ...cur, checked: true },
      }
      saveResultsToStorage(currentSessionId, nextRes)
      markPositionsDirty(currentSessionId, [posId])
      showToast(`Đã lưu ghi âm (${payload.durationSec}s) — nghe lại rồi bấm "Dịch" hoặc Đồng bộ sau!`)
    } catch {
      showToast('Không thể lưu ghi âm tạm trên máy')
    }
  }

  const handleTranscribeOfflineVoice = async (
    posId: string,
    voiceKey: string,
    positionCode?: string | null
  ) => {
    if (!currentSessionId || !voiceKey) return
    const pv = (pendingVoicesMap[posId] || []).find(x => x.key === voiceKey)
    if (!pv) return

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('Đang không có mạng — file vẫn giữ an toàn trên máy để Đồng bộ sau!')
      return
    }

    setTranscribingVoicesMap(prev => ({ ...prev, [voiceKey]: true }))
    try {
      const res = await fetch('/api/voice-transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: pv.audioBase64,
          mimeType: pv.mimeType,
          companyId: userProfile?.companyId || null,
          saveToServer: true,
          systemCode,
          sessionId: currentSessionId,
          sessionName: currentSession?.name || null,
          positionId: posId,
          positionCode: positionCode || null,
          vocabulary: voiceVocabulary,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data?.error || 'Không thể dịch AI lúc này — file vẫn được giữ trên máy.')
        return
      }
      const rawText = String(data?.text || '').trim()
      const normalized = rawText ? normalizeWarehouseVoiceText(rawText) : ''
      const voiceUrl = data?.voiceUrl ? String(data.voiceUrl) : null
      if (normalized || voiceUrl) {
        handleSaveVoiceResult(posId, normalized, voiceUrl, voiceKey)
        showToast(normalized ? 'Đã dịch AI & lưu Drive thành công!' : 'Đã tải file ghi âm lên Drive!')
      } else {
        showToast('AI không nghe rõ nội dung — file vẫn giữ lại trên máy.')
      }
    } catch {
      showToast('Lỗi kết nối khi dịch AI — file vẫn giữ an toàn trên máy.')
    } finally {
      setTranscribingVoicesMap(prev => {
        const next = { ...prev }
        delete next[voiceKey]
        return next
      })
    }
  }

  const handleDeleteOfflineVoice = async (posId: string, voiceKey: string) => {
    if (!currentSessionId || !voiceKey) return
    await deleteOfflineInventoryVoiceByKey(voiceKey)
    setPendingVoicesMap(prev => {
      const arr = prev[posId]
      if (!arr) return prev
      const filtered = arr.filter(x => x.key !== voiceKey)
      const next = { ...prev }
      if (filtered.length > 0) next[posId] = filtered
      else delete next[posId]
      return next
    })
  }

  const togglePositionChecked = (posId: string) => {
    if (!currentSessionId) return
    const cur = currentResults[posId] || {}
    const nextRes = {
      ...currentResults,
      [posId]: { ...cur, checked: !cur.checked },
    }
    saveResultsToStorage(currentSessionId, nextRes)
    markPositionsDirty(currentSessionId, [posId])
  }

  const updatePositionNote = (posId: string, note: string) => {
    if (!currentSessionId) return
    const cur = currentResults[posId] || {}
    const nextRes = {
      ...currentResults,
      [posId]: { ...cur, note, checked: note.trim() ? true : cur.checked },
    }
    saveResultsToStorage(currentSessionId, nextRes)
    markPositionsDirty(currentSessionId, [posId])
  }

  const bulkCheckPositions = (posIds: string[], checked: boolean) => {
    if (!currentSessionId) return
    const nextRes = { ...currentResults }
    posIds.forEach(id => {
      nextRes[id] = { ...(nextRes[id] || {}), checked }
    })
    saveResultsToStorage(currentSessionId, nextRes)
    markPositionsDirty(currentSessionId, posIds)
  }

  const startLevelLongPress = (rowName: string, lvl: any, allDone: boolean) => {
    clearLevelLongPress()
    longPressTriggeredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      const total = lvl.slots.length
      const msg = allDone
        ? `Bỏ tích toàn bộ ${total} vị trí ở ${rowName} - ${lvl.name}?`
        : `Xác nhận đã kiểm toàn bộ ${total} vị trí ở ${rowName} - ${lvl.name}?`
      if (window.confirm(msg)) {
        bulkCheckPositions(
          lvl.slots.map((s: any) => s.id),
          !allDone
        )
      }
    }, 450)
  }

  // ── TẠO PHIẾU KIỂM KÊ MỚI ──
  const handleCreateNewSession = async () => {
    if (!newSessionName.trim()) return
    const payload = {
      name: newSessionName.trim(),
      warehouse_id: newSessionZoneId === 'ALL' ? null : newSessionZoneId,
      system_code: systemCode,
      company_id: userProfile?.companyId || null,
      status: 'active',
      created_by: userProfile?.id || null,
    }

    try {
      const { data, error } = await (supabase.from('internal_inventory_sessions') as any)
        .insert([payload])
        .select('*')
        .single()
      if (error) throw error
      const updated = [data, ...sessions]
      setSessions(updated)
      localStorage.setItem(INVENTORY_KEYS.SESSIONS, JSON.stringify(updated))
      setCurrentSessionId(data.id)
      setNewSessionModalOpen(false)
      setNewSessionName('')
      setViewMode('detail')
      showToast('Đã tạo phiếu kiểm kê mới!')
    } catch {
      const localSess = {
        id: `local_inv_${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
      }
      const updated = [localSess, ...sessions]
      setSessions(updated)
      localStorage.setItem(INVENTORY_KEYS.SESSIONS, JSON.stringify(updated))
      setCurrentSessionId(localSess.id)
      setNewSessionModalOpen(false)
      setNewSessionName('')
      setViewMode('detail')
      showToast('Đã tạo phiếu kiểm kê ngoại tuyến!')
    }
  }

  const refreshPendingVoiceCounts = useCallback(async () => {
    try {
      const counts = await getOfflineVoiceCountsBySession()
      setPendingVoiceCountBySession(counts)
    } catch { }
  }, [])

  useEffect(() => {
    void refreshPendingVoiceCounts()
  }, [refreshPendingVoiceCounts, sessions.length, viewMode, pendingVoicesMap])

  // ── BƯỚC 1 (TÁCH RIÊNG): GỬI TOÀN BỘ FILE GHI ÂM LÊN DRIVE & DỊCH AI VỀ MÁY KIỂM TRA ──
  const handleTranscribeSessionVoices = async (sessionObj: any) => {
    if (transcribingSessionId || !sessionObj?.id) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('Đang mất mạng — vui lòng bật mạng rồi bấm Dịch ghi âm!')
      return
    }
    const sid = sessionObj.id
    const pendingVoices = await getOfflineInventoryVoicesBySession(sid)
    if (pendingVoices.length === 0) {
      showToast('Không còn đoạn ghi âm nào đang chờ dịch!')
      return
    }

    setTranscribingSessionId(sid)
    try {
      const resMap: Record<
        string,
        { checked?: boolean; note?: string; voice_note_url?: string | null }
      > = { ...(allSessionResults[sid] || {}) }
      const dirtySet = new Set(dirtyBySession[sid] || [])
      let syncedVoicesCount = 0

      const VOICE_BATCH = 10
      const totalBatches = Math.ceil(pendingVoices.length / VOICE_BATCH)
      for (let b = 0; b < pendingVoices.length; b += VOICE_BATCH) {
        const batch = pendingVoices.slice(b, b + VOICE_BATCH)
        const batchIndex = Math.floor(b / VOICE_BATCH) + 1
        showToast(
          totalBatches > 1
            ? `Đang gửi lô ${batchIndex}/${totalBatches} (${batch.length} ghi âm) cho AI dịch...`
            : `Đang tải & dịch AI ${batch.length} ghi âm kiểm kê...`
        )
        try {
          const resp = await fetch('/api/voice-transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: batch.map(pv => ({
                itemId: pv.key,
                positionId: pv.positionId,
                positionCode: positions.find(p => p.id === pv.positionId)?.code || null,
                audioBase64: pv.audioBase64,
                mimeType: pv.mimeType,
              })),
              companyId: userProfile?.companyId || null,
              saveToServer: true,
              systemCode: sessionObj.system_code || systemCode,
              sessionId: sid,
              sessionName: sessionObj.name || null,
              vocabulary: voiceVocabulary,
            }),
          })
          const data = await resp.json().catch(() => ({}))
          if (!resp.ok || !Array.isArray(data?.results)) continue

          for (const itemRes of data.results) {
            const pid = String(itemRes?.positionId || '')
            const voiceKey = String(itemRes?.itemId || '')
            if (!pid) continue
            const rawText = String(itemRes?.text || '').trim()
            const normalized = rawText ? normalizeWarehouseVoiceText(rawText) : ''
            const voiceUrl = itemRes?.voiceUrl ? String(itemRes.voiceUrl) : null

            if (normalized || voiceUrl) {
              const prevItem = resMap[pid] || {}
              resMap[pid] = {
                ...prevItem,
                checked: true,
                note: normalized
                  ? appendWarehouseVoiceText(prevItem.note || '', normalized)
                  : prevItem.note || '',
                voice_note_url: appendVoiceNoteUrl(prevItem.voice_note_url, voiceUrl),
              }
              dirtySet.add(pid)
              if (voiceKey) await deleteOfflineInventoryVoiceByKey(voiceKey)
              syncedVoicesCount++
            }
          }
        } catch { }
      }

      if (syncedVoicesCount > 0) {
        saveResultsToStorage(sid, resMap)
        markPositionsDirty(sid, Array.from(dirtySet))
        if (currentSessionId === sid) {
          const remainingVoices = await getOfflineInventoryVoicesBySession(sid)
          const remMap: Record<string, OfflineInventoryVoiceItem[]> = {}
          remainingVoices.forEach(v => {
            if (!remMap[v.positionId]) remMap[v.positionId] = []
            remMap[v.positionId].push(v)
          })
          setPendingVoicesMap(remMap)
        }
        await refreshPendingVoiceCounts()
        showToast(
          `Đã dịch ${syncedVoicesCount} ghi âm! Hãy kiểm tra lại chữ rồi bấm "Đồng bộ lên Web".`
        )
      } else {
        showToast('Không dịch được file ghi âm nào — vui lòng kiểm tra mạng hoặc API Key.')
      }
    } finally {
      setTranscribingSessionId(null)
    }
  }

  // ── BƯỚC 2 (TÁCH RIÊNG): ĐỒNG BỘ SỐ LIỆU KIỂM KÊ LÊN WEB ──
  const handleSyncSessionToCloud = async (sessionObj: any) => {
    if (syncing) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('Đang mất mạng — vui lòng bật mạng rồi bấm Đồng bộ lại!')
      return
    }
    const pendingCount = pendingVoiceCountBySession[sessionObj.id] || 0
    if (pendingCount > 0) {
      const proceed = window.confirm(
        `Phiếu "${sessionObj.name}" còn ${pendingCount} ghi âm chưa dịch sang chữ.\n\nBạn nên bấm "Dịch ghi âm (${pendingCount})" để kiểm tra lại nội dung trước khi đồng bộ lên Web.\n\nBấm OK để vẫn đồng bộ số liệu hiện tại, hoặc Hủy để dịch ghi âm trước.`
      )
      if (!proceed) return
    }
    setSyncing(true)
    try {
      let realSessionId = sessionObj.id
      let createdSessionRow: any = null
      if (!isUUID(realSessionId)) {
        const { data: created, error } = await (
          supabase.from('internal_inventory_sessions') as any
        )
          .insert([
            {
              name: sessionObj.name,
              warehouse_id: sessionObj.warehouse_id || sessionObj.zone_id || null,
              system_code: sessionObj.system_code || systemCode,
              company_id: userProfile?.companyId || null,
              status: 'active',
              created_by: userProfile?.id || null,
            },
          ])
          .select('*')
          .single()
        if (error) throw error
        realSessionId = created.id
        createdSessionRow = created
        await remapOfflineInventoryVoiceSession(sessionObj.id, realSessionId)
      }

      const resMap: Record<
        string,
        { checked?: boolean; note?: string; voice_note_url?: string | null }
      > = { ...(allSessionResults[sessionObj.id] || {}) }
      const syncedVoicesCount = 0
      const dirtySet = new Set(dirtyBySession[sessionObj.id] || [])

      const posById = new Map(positions.map(p => [p.id, p]))
      const rows = Object.entries(resMap)
        .filter(
          ([posId, v]) =>
            !posId.startsWith('summary|') &&
            isUUID(posId) &&
            (dirtySet.has(posId) || v.checked || (v.note && v.note.trim()) || v.voice_note_url)
        )
        .map(([posId, v]) => {
          const pos = posById.get(posId)
          return {
            session_id: realSessionId,
            position_id: posId,
            zone_id: pos?.zone_ids?.[0] || null,
            checked: !!v.checked,
            note: v.note?.trim() || null,
            voice_note_url: v.voice_note_url || null,
            checked_by: userProfile?.id || null,
            checked_at: new Date().toISOString(),
            lot_id_snapshot: pos?.lot_id || null,
          }
        })

      if (rows.length > 0) {
        const CHUNK = 200
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK)
          const { error } = await (supabase.from('internal_inventory_items') as any).upsert(
            chunk,
            { onConflict: 'session_id,position_id' }
          )
          if (error) throw error
        }
      }

      // Lưu resMap mới nhất (đã gồm text AI dịch & voice_note_url) vào state + localStorage
      setAllSessionResults(prev => {
        const next = { ...prev }
        next[realSessionId] = { ...(next[realSessionId] || {}), ...resMap }
        if (realSessionId !== sessionObj.id) {
          delete next[sessionObj.id]
        }
        try {
          localStorage.setItem(INVENTORY_KEYS.RESULTS, JSON.stringify(next))
        } catch { }
        return next
      })

      // Đã đẩy thành công -> xóa danh sách dirty của phiếu này
      setDirtyBySession(prev => {
        const next = { ...prev }
        delete next[sessionObj.id]
        delete next[realSessionId]
        try {
          localStorage.setItem(INVENTORY_KEYS.DIRTY, JSON.stringify(next))
        } catch { }
        return next
      })

      // Nếu vừa chuyển phiếu offline -> UUID thật trên server, cập nhật danh sách phiên local
      if (realSessionId !== sessionObj.id) {
        setSessions(prev => {
          const next = prev.map(s =>
            s.id === sessionObj.id ? createdSessionRow || { ...s, id: realSessionId } : s
          )
          try {
            localStorage.setItem(INVENTORY_KEYS.SESSIONS, JSON.stringify(next))
          } catch { }
          return next
        })
        if (currentSessionId === sessionObj.id) {
          setCurrentSessionId(realSessionId)
        }
      }

      await syncOfflineHallLotUpdatesWeb().catch(() => { })
      await fetchOnlineData(false, true)
      showToast(
        syncedVoicesCount > 0
          ? `Đã lưu & dịch AI ${syncedVoicesCount} ghi âm + đồng bộ ${rows.length} vị trí!`
          : `Đã đồng bộ ${rows.length} vị trí kiểm kê lên Web thành công!`
      )
    } catch (e: any) {
      alert('Lỗi đồng bộ kiểm kê: ' + (e?.message || e))
    } finally {
      setSyncing(false)
    }
  }

  // Từ điển tên sản phẩm & tên viết tắt (aliases) thật của kho gửi kèm cho Gemini Voice AI
  const voiceVocabulary = useMemo(() => {
    const terms = new Set<string>()
    for (const p of warehouseProducts) {
      if (p.aliases) {
        p.aliases
          .split(/[,;/|]+/)
          .map(s => s.trim())
          .filter(Boolean)
          .forEach(s => terms.add(s))
      }
      if (p.name) terms.add(p.name.trim())
    }
    return Array.from(terms).slice(0, 120)
  }, [warehouseProducts])

  // ── TÌM KIẾM SẢN PHẨM & AUTOCOMPLETE TRONG KIỂM KÊ ──
  const inventoryProductSuggestions = useMemo(() => {
    const qNorm = normalizeViText(invSearchQuery)
    if (!qNorm) return []
    const tokens = qNorm.split(' ').filter(Boolean)
    if (tokens.length === 0) return []

    // Kết hợp từ danh mục sản phẩm và các vị trí đang có hàng trong kho
    const map = new Map<
      string,
      { name: string; sku: string; aliases: string; count: number; score: number }
    >()

    for (const p of warehouseProducts) {
      const aliasNorm = normalizeViText(p.aliases || '')
      const skuNorm = normalizeViText(p.sku || '')
      const intNorm = normalizeViText(`${p.internal_code || ''} ${p.internal_name || ''}`)
      const nameNorm = normalizeViText(p.name || '')
      const full = `${aliasNorm} ${skuNorm} ${intNorm} ${nameNorm}`
      if (!tokens.every(t => full.includes(t))) continue
      let score = 10
      if (aliasNorm && tokens.every(t => aliasNorm.includes(t))) score += 60
      if (skuNorm && tokens.every(t => skuNorm.includes(t))) score += 30
      map.set(p.name, {
        name: p.name,
        sku: p.sku || '',
        aliases: p.aliases || '',
        count: 0,
        score,
      })
    }

    for (const pos of positions) {
      if (!pos.lot_id || !pos.product_name) continue
      const aliasNorm = normalizeViText(pos.aliases || '')
      const skuNorm = normalizeViText(pos.sku || '')
      const nameNorm = normalizeViText(pos.product_name || '')
      const sttNorm = normalizeViText(pos.stt || '')
      const full = `${aliasNorm} ${skuNorm} ${nameNorm} ${sttNorm}`
      if (!tokens.every(t => full.includes(t))) continue

      const existing = map.get(pos.product_name)
      if (existing) {
        existing.count += 1
        existing.score += 5
      } else {
        map.set(pos.product_name, {
          name: pos.product_name,
          sku: pos.sku || '',
          aliases: pos.aliases || '',
          count: 1,
          score: 25,
        })
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.score - a.score || b.count - a.count)
      .slice(0, 8)
  }, [invSearchQuery, warehouseProducts, positions])

  const matchSlotBySearch = useCallback(
    (slot: any): boolean => {
      if (!invSearchQuery.trim()) return true
      const qNorm = normalizeViText(invSearchQuery)
      const tokens = qNorm.split(' ').filter(Boolean)
      if (tokens.length === 0) return true
      const hay = normalizeViText(
        [
          slot.code,
          slot.stt,
          slot.lot_code,
          slot.product_name,
          slot.sku,
          slot.aliases,
          slot.internal_code,
          slot.internal_name,
        ]
          .filter(Boolean)
          .join(' ')
      )
      return tokens.every(t => hay.includes(t))
    },
    [invSearchQuery]
  )

  // ── SUMMARY CARDS CHO CÁC DÃY / SẢNH TRONG KHO ĐANG CHỌN ──
  const summaryCards = useMemo(() => {
    if (!selectedWarehouseId) return []
    let childZones = activeZones
      .filter(z => z.parent_id === selectedWarehouseId)
      .sort(compareZoneOrder)

    // Nếu phiếu chỉ kiểm 1 dãy/khu con cụ thể bên trong kho -> chỉ hiện đúng nhánh đó giống App Android
    if (effectiveWhId && effectiveWhId !== selectedWarehouseId) {
      const isDescendantOrSelf = (childId: string, ancestorId: string): boolean => {
        if (childId === ancestorId) return true
        let cur: string | null = childId
        while (cur) {
          const z = activeZones.find(x => x.id === cur)
          if (!z || !z.parent_id) break
          if (z.parent_id === ancestorId) return true
          cur = z.parent_id
        }
        return false
      }
      childZones = childZones.filter(
        c =>
          c.id === effectiveWhId ||
          isDescendantOrSelf(c.id, effectiveWhId) ||
          isDescendantOrSelf(effectiveWhId, c.id)
      )
    }

    return childZones.map(cz => {
      const descIds = getDescendantIds(cz.id, activeZones)
      const zonePos = activePositions.filter(
        p => p.zone_id && descIds.has(p.zone_id) && matchSlotBySearch(p)
      )
      const total = zonePos.length
      const occupied = zonePos.filter(p => !!p.lot_id).length
      let checked = 0
      let discrepancy = 0
      zonePos.forEach(p => {
        const r = currentResults[p.id]
        if (r?.checked) checked++
        if (r?.note && r.note.trim()) discrepancy++
      })
      const pct = total > 0 ? Math.round((checked / total) * 100) : 0
      return {
        zone: cz,
        total,
        occupied,
        checked,
        discrepancy,
        pct,
      }
    })
  }, [
    selectedWarehouseId,
    effectiveWhId,
    activeZones,
    activePositions,
    getDescendantIds,
    currentResults,
    matchSlotBySearch,
  ])

  // ── DỮ LIỆU CHI TIẾT DÃY / SẢNH ĐANG MỞ (`selectedDetailZoneId`) ──
  const selectedDetailZone = useMemo(
    () => activeZones.find(z => z.id === selectedDetailZoneId) || null,
    [activeZones, selectedDetailZoneId]
  )

  const isSelectedDetailHall = useMemo(() => {
    if (!selectedDetailZone) return false
    return !!(
      selectedDetailZone.is_hall || /s[ảàa]nh/i.test(selectedDetailZone.name || '')
    )
  }, [selectedDetailZone])

  const detailStructure = useMemo(() => {
    if (!selectedDetailZoneId) {
      return { khuOptions: [], sections: [], hallPositions: [], totalCount: 0 }
    }

    const directChildren = activeZones
      .filter(z => z.parent_id === selectedDetailZoneId)
      .sort(compareZoneOrder)

    // Kiểm tra xem có cấp KHU trung gian hay trực tiếp là Ô kệ
    const hasSubKhu = directChildren.some(c => /khu|dãy|kệ/i.test(c.name || ''))
    // Luôn hiển thị dải lọc ngang các Khu/Ô con (Tất cả, Ô 01, Ô 02...) giống App Android
    const khuOptions = directChildren

    const targetContainers = hasSubKhu
      ? selectedKhuId === 'ALL'
        ? directChildren
        : directChildren.filter(c => c.id === selectedKhuId)
      : [selectedDetailZone!]

    const sections = targetContainers.map(container => {
      const bins = (
        hasSubKhu
          ? activeZones.filter(z => z.parent_id === container.id)
          : selectedKhuId === 'ALL'
            ? directChildren
            : directChildren.filter(c => c.id === selectedKhuId)
      ).sort(compareZoneOrder)

      const rows = bins
        .map(bin => {
          const levels = activeZones
            .filter(z => z.parent_id === bin.id)
            .sort(compareZoneOrder)

          const levelCells = (levels.length > 0 ? levels : [bin]).map(lvl => {
            const slots = activePositions.filter(
              p => p.zone_id === lvl.id && matchSlotBySearch(p)
            )
            return {
              id: lvl.id,
              name: lvl.name,
              binName: bin.name,
              slots,
            }
          })

          const allRowSlots = levelCells.flatMap(l => l.slots)
          return {
            bin,
            levels: levelCells,
            allRowSlots,
          }
        })
        .filter(r => r.allRowSlots.length > 0)

      return {
        container,
        rows,
      }
    })

    const allDesc = getDescendantIds(selectedDetailZoneId, activeZones)
    const hallPositions = activePositions.filter(
      p => p.zone_id && allDesc.has(p.zone_id) && matchSlotBySearch(p)
    )

    return { khuOptions, sections, hallPositions, totalCount: hallPositions.length }
  }, [
    selectedDetailZoneId,
    selectedDetailZone,
    activeZones,
    activePositions,
    selectedKhuId,
    getDescendantIds,
    matchSlotBySearch,
  ])

  return (
    <div className="scanner-inventory-compact flex flex-col h-full bg-[#0b1120] text-slate-100 select-none overflow-hidden">
      {toastMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold shadow-xl border border-emerald-400">
          {toastMsg}
        </div>
      )}

      {viewMode === 'list' ? (
        /* =========================================================
         * MODE 1: DANH SÁCH PHIÊN KIỂM KÊ
         * ========================================================= */
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-black text-white tracking-wide">
                KIỂM KÊ KHO - THEO TẦNG &amp; PHIÊN
              </div>
              <div className="text-[11px] text-slate-400">
                {positions.length.toLocaleString('vi-VN')} vị trí • {rootWarehouses.length} kho
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setHallModalDefaultId(null)
                  setHallModalOpen(true)
                }}
                className="px-2.5 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 text-xs font-extrabold flex items-center gap-1"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>LOT Sảnh</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => fetchOnlineData(true)}
                className="px-2.5 py-1.5 rounded-xl bg-[#1e293b] border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
                <span>Tải mới</span>
              </button>

              <button
                type="button"
                onClick={() => setNewSessionModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo phiếu</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2.5 pb-20">
            {loading && sessions.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
                <span className="text-xs">Đang tải danh sách phiên kiểm kê...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="text-xs text-slate-400">Chưa có phiên kiểm kê nào đang mở.</div>
                <button
                  type="button"
                  onClick={() => setNewSessionModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tạo Phiếu Kiểm Kê Đầu Tiên</span>
                </button>
              </div>
            ) : (
              sessions.map(sess => {
                const resMap = allSessionResults[sess.id] || {}
                const scopeZoneId = sess.warehouse_id || sess.zone_id || null
                const scopePos = scopeZoneId
                  ? (() => {
                    const dIds = getDescendantIds(scopeZoneId, zones)
                    return positions.filter(p => p.zone_ids?.some(zid => dIds.has(zid)))
                  })()
                  : positions
                const sTotal = scopePos.length
                let sChecked = 0
                let sDiscrepancy = 0
                scopePos.forEach(p => {
                  const r = resMap[p.id]
                  if (r?.checked) sChecked++
                  if (r?.note && r.note.trim()) sDiscrepancy++
                })
                const pct = sTotal > 0 ? Math.round((sChecked / sTotal) * 100) : 0
                const scopeZoneName = scopeZoneId
                  ? zones.find(z => z.id === scopeZoneId)?.name || 'Theo khu vực'
                  : 'Toàn bộ kho'

                return (
                  <div
                    key={sess.id}
                    className="p-3.5 rounded-2xl bg-[#1e293b] border border-slate-700 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentSessionId(sess.id)
                          if (scopeZoneId && rootWarehouses.some(w => w.id === scopeZoneId)) {
                            setSelectedWarehouseId(scopeZoneId)
                          }
                          setViewMode('detail')
                        }}
                        className="text-left flex-1 min-w-0"
                      >
                        <div className="text-sm font-black text-white truncate">{sess.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          📍 {scopeZoneName} •{' '}
                          {sess.created_at
                            ? new Date(sess.created_at).toLocaleDateString('vi-VN')
                            : ''}
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {(pendingVoiceCountBySession[sess.id] || 0) > 0 && (
                          <button
                            type="button"
                            disabled={transcribingSessionId === sess.id}
                            onClick={() => handleTranscribeSessionVoices(sess)}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[11px] font-extrabold flex items-center gap-1 shrink-0 disabled:opacity-60"
                          >
                            {transcribingSessionId === sess.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Cpu className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {transcribingSessionId === sess.id
                                ? 'Đang dịch...'
                                : `Dịch (${pendingVoiceCountBySession[sess.id]})`}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={syncing}
                          onClick={() => handleSyncSessionToCloud(sess)}
                          className="px-2.5 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-extrabold flex items-center gap-1 shrink-0"
                        >
                          {syncing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CloudUpload className="w-3.5 h-3.5" />
                          )}
                          <span>Đồng bộ lên Web</span>
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentSessionId(sess.id)
                        setViewMode('detail')
                      }}
                      className="w-full text-left space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-400">
                          Đã kiểm: {sChecked} / {sTotal} vị trí ({pct}%)
                        </span>
                        {sDiscrepancy > 0 && (
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-black">
                            ⚠️ {sDiscrepancy} SAI LỆCH
                          </span>
                        )}
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#0f172a] overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : (
        /* =========================================================
         * MODE 2: CHI TIẾT PHIÊN KIỂM KÊ THEO KHO / DÃY / SẢNH
         * ========================================================= */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header Phiên */}
          <div className="px-3 py-2.5 bg-[#0f172a] border-b border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDetailZoneId(null)
                  setViewMode('list')
                }}
                className="flex items-center gap-1.5 text-xs font-extrabold text-slate-300 min-w-0"
              >
                <ArrowLeft className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="truncate max-w-[200px]">
                  {currentSession?.name || 'Danh sách phiên'}
                </span>
              </button>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setHallModalDefaultId(null)
                    setHallModalOpen(true)
                  }}
                  className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-extrabold"
                >
                  LOT Sảnh
                </button>

                {currentSession && (() => {
                  const pendingDirtyCount = (dirtyBySession[currentSession.id] || []).length
                  const pendingVoiceCount = Object.values(pendingVoicesMap).reduce(
                    (sum, arr) => sum + (arr?.length || 0),
                    0
                  )
                  const isLocalOnly = !isUUID(currentSession.id)
                  return (
                    <>
                      {pendingVoiceCount > 0 && (
                        <button
                          type="button"
                          disabled={transcribingSessionId === currentSession.id}
                          onClick={() => handleTranscribeSessionVoices(currentSession)}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-extrabold flex items-center gap-1 disabled:opacity-60"
                        >
                          {transcribingSessionId === currentSession.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Cpu className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {transcribingSessionId === currentSession.id
                              ? 'Đang dịch...'
                              : `Dịch (${pendingVoiceCount})`}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={syncing}
                        onClick={() => handleSyncSessionToCloud(currentSession)}
                        className={`px-2.5 py-1 rounded-lg text-white text-[11px] font-extrabold flex items-center gap-1 ${pendingDirtyCount > 0 || isLocalOnly
                          ? 'bg-sky-600'
                          : 'bg-emerald-600'
                          }`}
                      >
                        <CloudUpload className="w-3.5 h-3.5" />
                        <span>
                          {syncing
                            ? 'Đang đồng bộ...'
                            : pendingDirtyCount > 0
                              ? `Đồng bộ (${pendingDirtyCount})`
                              : 'Đồng bộ'}
                        </span>
                      </button>
                    </>
                  )
                })()}

                <button
                  type="button"
                  onClick={() => setIsGrouped(v => !v)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${isGrouped
                    ? 'bg-indigo-600 border-indigo-400 text-white'
                    : 'bg-[#1e293b] border-slate-700 text-slate-300'
                    }`}
                >
                  {isGrouped ? 'Đang Gộp Ô' : 'Tách Kệ'}
                </button>
              </div>
            </div>

            {/* Ô tìm kiếm sản phẩm theo tên viết tắt + Autocomplete + Micro */}
            <div className="relative">
              <div className="flex items-center gap-1.5 px-2.5 h-9 rounded-xl bg-[#1e293b] border border-slate-700">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={invSearchQuery}
                  onChange={e => {
                    setInvSearchQuery(e.target.value)
                    setShowInvSuggestions(true)
                  }}
                  onFocus={() => setShowInvSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowInvSuggestions(false), 180)}
                  placeholder="Lọc vị trí theo alias, SKU, STT, tên SP..."
                  className="flex-1 min-w-0 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                {invSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setInvSearchQuery('')
                      setShowInvSuggestions(false)
                    }}
                    className="text-slate-400 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <VoiceMicButton
                  size="sm"
                  companyId={userProfile?.companyId}
                  vocabulary={voiceVocabulary}
                  title="Nói tên sản phẩm hoặc STT để lọc (AI)"
                  onResult={spoken => {
                    setInvSearchQuery(spoken)
                    setShowInvSuggestions(true)
                  }}
                  onError={msg => showToast(msg)}
                />
              </div>

              {showInvSuggestions &&
                invSearchQuery.trim() &&
                inventoryProductSuggestions.length > 0 && (
                  <div className="mt-1 rounded-xl bg-[#1e293b] border border-sky-500/70 shadow-2xl overflow-hidden z-40 max-h-52 overflow-y-auto">
                    <div className="px-3 py-1 bg-[#0f172a] text-[10px] font-extrabold text-slate-400 border-b border-slate-700">
                      GỢI Ý SẢN PHẨM TRONG KHO ({inventoryProductSuggestions.length})
                    </div>
                    {inventoryProductSuggestions.map(sug => (
                      <button
                        key={`${sug.sku}_${sug.name}`}
                        type="button"
                        onMouseDown={() => {
                          setInvSearchQuery(sug.name)
                          setShowInvSuggestions(false)
                        }}
                        onClick={() => {
                          setInvSearchQuery(sug.name)
                          setShowInvSuggestions(false)
                        }}
                        className="w-full px-3 py-2 text-left border-b border-slate-700/60 last:border-0 hover:bg-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {sug.aliases && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-extrabold">
                                {sug.aliases}
                              </span>
                            )}
                            <span className="text-xs font-bold text-white truncate">
                              {sug.name}
                            </span>
                          </div>
                          {sug.sku && (
                            <div className="text-[10px] text-slate-400">SKU: {sug.sku}</div>
                          )}
                        </div>
                        {sug.count > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold shrink-0">
                            {sug.count} vị trí
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
            </div>

            {/* Chọn Kho (Kho 1, Kho 2...) */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {scopedWarehouses.map(wh => {
                const active = wh.id === selectedWarehouseId
                return (
                  <button
                    key={wh.id}
                    type="button"
                    onClick={() => {
                      setSelectedWarehouseId(wh.id)
                      setSelectedDetailZoneId(null)
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap border transition flex items-center gap-1.5 ${active
                      ? 'bg-sky-600 border-sky-400 text-white'
                      : 'bg-[#1e293b] border-slate-700 text-slate-400'
                      }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{wh.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Danh sách thẻ Dãy / Sảnh (Sảnh tô màu hổ phách nổi bật riêng biệt) */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-2.5 space-y-2 pb-20">
            {summaryCards.map(card => {
              const isHallCard = Boolean(
                card.zone.is_hall || /s[ảàa]nh/i.test(card.zone.name || '')
              )
              return (
              <button
                key={card.zone.id}
                type="button"
                onClick={() => {
                  setSelectedDetailZoneId(card.zone.id)
                  setSelectedKhuId('ALL')
                  setShowHallSummary(isHallCard)
                  setAddedHallExtraIds([])
                }}
                className={`w-full px-3 py-2 rounded-xl border text-left space-y-1.5 transition ${
                  isHallCard
                    ? 'bg-amber-950/45 border-amber-500/60 hover:border-amber-400'
                    : 'bg-[#1e293b] border-slate-700/80 hover:border-sky-500/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`text-xs font-bold truncate ${
                        isHallCard ? 'text-amber-200' : 'text-white'
                      }`}
                    >
                      {card.zone.name}
                    </span>
                    {isHallCard && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/50 text-amber-300 text-[9px] font-bold uppercase shrink-0">
                        Sảnh
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold shrink-0 ${
                      isHallCard
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/15 text-emerald-400'
                    }`}
                  >
                    {card.pct}% Đã kiểm
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <div className={`py-1 px-1 rounded-lg ${isHallCard ? 'bg-amber-950/60' : 'bg-[#0f172a]'}`}>
                    <div className="text-[9px] font-medium text-slate-400 leading-tight">TỔNG</div>
                    <div className="text-xs font-bold text-white leading-tight mt-0.5">{card.total}</div>
                  </div>
                  <div className={`py-1 px-1 rounded-lg ${isHallCard ? 'bg-amber-950/60' : 'bg-[#0f172a]'}`}>
                    <div className="text-[9px] font-medium text-amber-400 leading-tight">CÓ HÀNG</div>
                    <div className="text-xs font-bold text-amber-300 leading-tight mt-0.5">{card.occupied}</div>
                  </div>
                  <div className={`py-1 px-1 rounded-lg ${isHallCard ? 'bg-amber-950/60' : 'bg-[#0f172a]'}`}>
                    <div className="text-[9px] font-medium text-emerald-400 leading-tight">ĐÃ KIỂM</div>
                    <div className="text-xs font-bold text-emerald-400 leading-tight mt-0.5">{card.checked}</div>
                  </div>
                  <div className={`py-1 px-1 rounded-lg ${isHallCard ? 'bg-amber-950/60' : 'bg-[#0f172a]'} ${card.discrepancy > 0 ? 'ring-1 ring-rose-500/50' : ''}`}>
                    <div className="text-[9px] font-medium text-rose-400 leading-tight">SAI LỆCH</div>
                    <div className="text-xs font-bold text-rose-400 leading-tight mt-0.5">{card.discrepancy}</div>
                  </div>
                </div>
              </button>
              )
            })}
          </div>
        </div>
      )}

      {/* =========================================================
       * MODAL CHI TIẾT DÃY / SẢNH (SƠ ĐỒ Ô KỆ & TẦNG T1..T5 GIỐNG APP ANDROID)
       * ========================================================= */}
      {selectedDetailZone && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#0b1120]">
          {/* Header Dãy / Sảnh */}
          <div className="px-3 py-2.5 bg-[#0f172a] border-b border-slate-800 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSelectedDetailZoneId(null)
                setShowHallSummary(false)
              }}
              aria-label="Quay lại"
              className="w-9 h-9 rounded-xl bg-[#1e293b] border border-slate-700 text-slate-200 flex items-center justify-center shrink-0 active:scale-95 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-white truncate leading-tight">
                Kiểm kê: {selectedDetailZone.name}
              </div>
              <div className="text-[11px] font-medium text-slate-400 truncate mt-0.5">
                {currentSession?.name || 'Kiểm kê'} · Nhấn giữ vào Tầng để tích nhanh cả tầng
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isSelectedDetailHall && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setHallModalDefaultId(selectedDetailZone.id)
                      setHallModalOpen(true)
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-sky-600 text-white text-[11px] font-extrabold"
                  >
                    Cập nhật LOT
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHallSummary(v => !v)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border ${showHallSummary
                      ? 'bg-amber-500 border-amber-400 text-slate-950'
                      : 'bg-[#1e293b] border-slate-700 text-slate-300'
                      }`}
                  >
                    Gom nhóm
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setIsGrouped(v => !v)}
                title={isGrouped ? 'Đang Gộp Ô (bấm để Tách Kệ)' : 'Đang Tách Kệ (bấm để Gộp Ô)'}
                aria-label={isGrouped ? 'Đang Gộp Ô' : 'Đang Tách Kệ'}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition ${isGrouped
                  ? 'bg-indigo-900/90 border-indigo-400 text-indigo-200'
                  : 'bg-[#1e293b] border-slate-700 text-slate-400'
                  }`}
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dải lọc ngang chọn nhanh Ô / Khu (Tất cả (390), Ô 01, Ô 02...) */}
          {detailStructure.khuOptions.length > 0 && !showHallSummary && (
            <div className="px-3 py-2 bg-[#0f172a] border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => setSelectedKhuId('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap border transition shrink-0 ${selectedKhuId === 'ALL'
                  ? 'bg-violet-600 border-violet-400 text-white'
                  : 'bg-[#1e293b] border-slate-700 text-slate-400'
                  }`}
              >
                Tất cả ({detailStructure.totalCount})
              </button>
              {detailStructure.khuOptions.map(k => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setSelectedKhuId(k.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap border transition shrink-0 ${selectedKhuId === k.id
                    ? 'bg-violet-600 border-violet-400 text-white'
                    : 'bg-[#1e293b] border-slate-700 text-slate-400'
                    }`}
                >
                  {k.name}
                </button>
              ))}
            </div>
          )}

          {/* Nội dung Sảnh gom nhóm hoặc Lưới Ô Kệ & Tầng */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3 pb-20">
            {isSelectedDetailHall && showHallSummary ? (
              /* Chế độ Gom Nhóm Sảnh theo Sản phẩm + Thẻ Hàng phát sinh ngoài danh sách */
              <div className="space-y-2.5">
                {(() => {
                  const groups = new Map<
                    string,
                    { product_name: string; sku: string; slots: any[] }
                  >()
                  detailStructure.hallPositions
                    .filter(p => !!p.lot_id)
                    .forEach(p => {
                      const k = `${p.sku || ''}___${p.product_name || 'Hàng sảnh'}`
                      const g = groups.get(k) || {
                        product_name: p.product_name || 'Hàng sảnh',
                        sku: p.sku || '',
                        slots: [],
                      }
                      g.slots.push(p)
                      groups.set(k, g)
                    })
                  const list = Array.from(groups.values())

                  // Vị trí trống đại diện của Sảnh dùng để ghi nhận hàng phát sinh / ngoài danh sách gom nhóm
                  const emptyHallSlots = detailStructure.hallPositions.filter(p => !p.lot_id)
                  const addedSet = new Set(addedHallExtraIds)
                  const activeExtraHallSlots = emptyHallSlots.filter(
                    p =>
                      addedSet.has(p.id) ||
                      Boolean(currentResults[p.id]?.note) ||
                      Boolean(currentResults[p.id]?.voice_note_url) ||
                      (pendingVoicesMap[p.id]?.length || 0) > 0
                  )
                  const extraSlots =
                    activeExtraHallSlots.length > 0
                      ? activeExtraHallSlots
                      : emptyHallSlots.length > 0
                        ? [emptyHallSlots[0]]
                        : detailStructure.hallPositions.length > 0
                          ? [detailStructure.hallPositions[0]]
                          : []
                  const chosenExtraIds = new Set(extraSlots.map(p => p.id))
                  const remainingEmptyHallSlots = emptyHallSlots.filter(
                    p => !chosenExtraIds.has(p.id)
                  )

                  return (
                    <>
                      {list.length === 0 && (
                        <div className="py-6 text-center text-xs text-slate-500">
                          Chưa có hàng hóa trên hệ thống tại sảnh này — bạn vẫn có thể ghi nhận hàng phát sinh bên dưới.
                        </div>
                      )}
                      {list.map(g => {
                        const ids = g.slots.map(s => s.id)
                        const allChecked = ids.every(id => currentResults[id]?.checked)
                        const primarySlot =
                          g.slots.find(
                            s =>
                              Boolean(currentResults[s.id]?.note) ||
                              Boolean(currentResults[s.id]?.voice_note_url) ||
                              (pendingVoicesMap[s.id]?.length || 0) > 0
                          ) || g.slots[0]
                        const primaryRes = currentResults[primarySlot.id] || {}
                        const savedUrls = parseVoiceNoteUrls(primaryRes.voice_note_url)
                        const pendingList = pendingVoicesMap[primarySlot.id] || []
                        const totalQty = g.slots.reduce(
                          (sum, s) => sum + (Number(s.quantity) || 0),
                          0
                        )
                        const unit = g.slots[0]?.unit || 'Thùng'
                        return (
                          <div
                            key={`${g.sku}_${g.product_name}`}
                            className="p-2.5 rounded-xl bg-[#1e293b] border border-slate-700/80 space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-[11.5px] font-semibold text-white leading-snug break-words">
                                  {g.product_name}
                                </div>
                                <div className="text-[10px] text-amber-300 font-medium mt-0.5 leading-snug break-words">
                                  {g.slots.length} LOT{totalQty > 0 ? ` · ${totalQty} ${unit}` : ''} • SKU: {g.sku || '---'}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => bulkCheckPositions(ids, !allChecked)}
                                className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold shrink-0 border ${allChecked
                                  ? 'bg-emerald-600 border-emerald-400 text-white'
                                  : 'bg-slate-800 border-slate-600 text-slate-200'
                                  }`}
                              >
                                {allChecked ? '✓ Đã kiểm' : 'Kiểm'}
                              </button>
                            </div>

                            <div className="flex items-start gap-1.5">
                              <textarea
                                rows={Math.min(6, Math.max(1, (primaryRes.note || '').split(/\r?\n/).length))}
                                value={primaryRes.note || ''}
                                onChange={e => updatePositionNote(primarySlot.id, e.target.value)}
                                placeholder="Ghi chú dòng tổng (gõ hoặc bấm Micro)..."
                                className={`flex-1 min-w-0 px-2.5 py-1 rounded-lg text-[11px] border focus:outline-none resize-none leading-snug ${primaryRes.note
                                  ? 'bg-rose-950/40 border-rose-500/60 text-rose-200 placeholder-rose-400/60'
                                  : 'bg-[#0f172a] border-slate-700 text-white placeholder-slate-500'
                                  }`}
                              />
                              <VoiceMicButton
                                size="sm"
                                saveToServer
                                systemCode={systemCode}
                                sessionId={currentSessionId}
                                sessionName={currentSession?.name || null}
                                positionId={primarySlot.id}
                                positionCode={primarySlot.code}
                                companyId={userProfile?.companyId}
                                vocabulary={voiceVocabulary}
                                onResult={(spoken, voiceUrl) =>
                                  handleSaveVoiceResult(primarySlot.id, spoken, voiceUrl)
                                }
                                onOfflineAudio={payload =>
                                  handleSaveOfflineVoice(primarySlot.id, payload)
                                }
                              />
                            </div>

                            {(savedUrls.length > 0 || pendingList.length > 0) && (
                              <div className="space-y-1.5">
                                {savedUrls.map((sUrl, sIdx) => (
                                  <div
                                    key={`hall-saved-${primarySlot.id}-${sIdx}`}
                                    className="rounded-xl bg-sky-500/10 border border-sky-500/35 px-2.5 py-1.5"
                                  >
                                    <div className="text-[10px] font-bold text-sky-300 mb-1">
                                      🎙️ {savedUrls.length > 1 ? `Ghi âm đã lưu #${sIdx + 1}` : 'Ghi âm đã lưu'}
                                    </div>
                                    <audio controls preload="metadata" src={sUrl} className="h-7 w-full" />
                                  </div>
                                ))}
                                {pendingList.map((pv, pIdx) => {
                                  const isTranscribing = Boolean(transcribingVoicesMap[pv.key])
                                  return (
                                    <div
                                      key={pv.key}
                                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] bg-amber-500/10 border-amber-500/35 text-amber-300"
                                    >
                                      <span className="truncate font-extrabold">
                                        {pendingList.length > 1
                                          ? `Ghi âm #${pIdx + 1} (${pv.durationSec}s)`
                                          : `Ghi âm local (${pv.durationSec}s)`}
                                      </span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          disabled={isTranscribing}
                                          onClick={() =>
                                            handleTranscribeOfflineVoice(
                                              primarySlot.id,
                                              pv.key,
                                              primarySlot.code
                                            )
                                          }
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/25 border border-violet-400/50 text-violet-100 font-extrabold text-[11px] disabled:opacity-60"
                                        >
                                          {isTranscribing ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <Cpu className="w-3 h-3" />
                                          )}
                                          <span>{isTranscribing ? 'Đang dịch...' : 'Dịch'}</span>
                                        </button>
                                        {!isTranscribing && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleDeleteOfflineVoice(primarySlot.id, pv.key)
                                            }
                                            className="text-rose-400 p-0.5"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
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

                      {/* Thẻ Hàng phát sinh / Ngoài danh sách gom nhóm */}
                      {extraSlots.map((extraSlot, eIdx) => {
                        const eRes = currentResults[extraSlot.id] || {}
                        const eSavedUrls = parseVoiceNoteUrls(eRes.voice_note_url)
                        const ePendingList = pendingVoicesMap[extraSlot.id] || []
                        return (
                          <div
                            key={`hall-extra-${extraSlot.id}`}
                            className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-[11.5px] font-semibold text-amber-200 leading-snug">
                                  ➕ Hàng phát sinh / Ngoài danh sách
                                  {extraSlots.length > 1 ? ` #${eIdx + 1}` : ''}
                                </div>
                                <div className="text-[10px] text-slate-400 leading-snug">
                                  Ô trống: {extraSlot.code || 'Sảnh'} · Đồng bộ lên Web
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => togglePositionChecked(extraSlot.id)}
                                className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold shrink-0 border ${eRes.checked
                                  ? 'bg-emerald-600 border-emerald-400 text-white'
                                  : 'bg-slate-800 border-slate-600 text-slate-200'
                                  }`}
                              >
                                {eRes.checked ? '✓ Đã kiểm' : 'Kiểm'}
                              </button>
                            </div>

                            <div className="flex items-start gap-1.5">
                              <textarea
                                rows={Math.min(6, Math.max(1, (eRes.note || '').split(/\r?\n/).length))}
                                value={eRes.note || ''}
                                onChange={e => updatePositionNote(extraSlot.id, e.target.value)}
                                placeholder="Ghi chú hoặc bấm Micro đọc hàng dư / ngoài danh sách..."
                                className={`flex-1 min-w-0 px-2.5 py-1 rounded-lg text-[11px] border focus:outline-none resize-none leading-snug ${eRes.note
                                  ? 'bg-rose-950/40 border-rose-500/60 text-rose-200 placeholder-rose-400/60'
                                  : 'bg-[#0f172a] border-slate-700 text-white placeholder-slate-400'
                                  }`}
                              />
                              <VoiceMicButton
                                size="sm"
                                saveToServer
                                systemCode={systemCode}
                                sessionId={currentSessionId}
                                sessionName={currentSession?.name || null}
                                positionId={extraSlot.id}
                                positionCode={extraSlot.code}
                                companyId={userProfile?.companyId}
                                vocabulary={voiceVocabulary}
                                onResult={(spoken, voiceUrl) =>
                                  handleSaveVoiceResult(extraSlot.id, spoken, voiceUrl)
                                }
                                onOfflineAudio={payload =>
                                  handleSaveOfflineVoice(extraSlot.id, payload)
                                }
                              />
                            </div>

                            {(eSavedUrls.length > 0 || ePendingList.length > 0) && (
                              <div className="space-y-1.5">
                                {eSavedUrls.map((sUrl, sIdx) => (
                                  <div
                                    key={`hall-extra-saved-${extraSlot.id}-${sIdx}`}
                                    className="rounded-xl bg-sky-500/10 border border-sky-500/35 px-2.5 py-1.5"
                                  >
                                    <div className="text-[10px] font-bold text-sky-300 mb-1">
                                      🎙️ {eSavedUrls.length > 1 ? `Ghi âm đã lưu #${sIdx + 1}` : 'Ghi âm đã lưu'}
                                    </div>
                                    <audio controls preload="metadata" src={sUrl} className="h-7 w-full" />
                                  </div>
                                ))}
                                {ePendingList.map((pv, pIdx) => {
                                  const isTranscribing = Boolean(transcribingVoicesMap[pv.key])
                                  return (
                                    <div
                                      key={pv.key}
                                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] bg-amber-500/10 border-amber-500/35 text-amber-300"
                                    >
                                      <span className="truncate font-extrabold">
                                        {ePendingList.length > 1
                                          ? `Ghi âm #${pIdx + 1} (${pv.durationSec}s)`
                                          : `Ghi âm local (${pv.durationSec}s)`}
                                      </span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          disabled={isTranscribing}
                                          onClick={() =>
                                            handleTranscribeOfflineVoice(
                                              extraSlot.id,
                                              pv.key,
                                              extraSlot.code
                                            )
                                          }
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/25 border border-violet-400/50 text-violet-100 font-extrabold text-[11px] disabled:opacity-60"
                                        >
                                          {isTranscribing ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <Cpu className="w-3 h-3" />
                                          )}
                                          <span>{isTranscribing ? 'Đang dịch...' : 'Dịch'}</span>
                                        </button>
                                        {!isTranscribing && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleDeleteOfflineVoice(extraSlot.id, pv.key)
                                            }
                                            className="text-rose-400 p-0.5"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
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

                      {remainingEmptyHallSlots.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextSlot = remainingEmptyHallSlots[0]
                            if (!nextSlot) return
                            setAddedHallExtraIds(prev =>
                              prev.includes(nextSlot.id) ? prev : [...prev, nextSlot.id]
                            )
                          }}
                          className="w-full py-3 px-4 rounded-2xl border border-dashed border-amber-400/50 bg-amber-500/10 text-amber-200 text-xs font-extrabold flex items-center justify-center gap-2 hover:bg-amber-500/15"
                        >
                          <Plus className="w-4 h-4 text-amber-300" />
                          <span>
                            Thêm hàng phát sinh mới (còn {remainingEmptyHallSlots.length} ô trống)
                          </span>
                        </button>
                      )}
                    </>
                  )
                })()}
              </div>
            ) : (
              /* Chế độ Lưới Ô kệ -> Các Tầng (T1..T5 trên 1 hàng gọn giống App Android) */
              detailStructure.sections.map(sec => (
                <div key={sec.container.id} className="space-y-2.5">
                  {!isSelectedDetailHall && (
                    <div className="flex items-center gap-2 px-0.5 pt-0.5">
                      <span className="w-6 h-[3px] rounded-full bg-violet-400 shrink-0" />
                      <span className="text-xs font-black text-white uppercase tracking-wide">
                        {sec.container.name}
                      </span>
                    </div>
                  )}

                  {sec.rows.map(row => {
                    // Tính danh sách các sản phẩm khác nhau trong Ô kệ này để tô màu chấm
                    const uniqueProdKeys: string[] = []
                    const prodInfoMap = new Map<
                      string,
                      {
                        name: string
                        sku: string
                        color: string
                        count: number
                        totalQty: number
                        unit: string
                      }
                    >()
                    row.allRowSlots.forEach(s => {
                      const pk = getProductKey(s)
                      if (!pk) return
                      if (!uniqueProdKeys.includes(pk)) uniqueProdKeys.push(pk)
                    })
                    const isMultiProdRow = uniqueProdKeys.length >= 2
                    uniqueProdKeys.forEach((pk, idx) => {
                      const color = PRODUCT_DOT_PALETTE[idx % PRODUCT_DOT_PALETTE.length]
                      const matching = row.allRowSlots.filter(s => getProductKey(s) === pk)
                      const sample = matching[0]
                      const totalQty = matching.reduce(
                        (sum, s) => sum + (Number(s.quantity) || 0),
                        0
                      )
                      prodInfoMap.set(pk, {
                        name: sample?.product_name || pk,
                        sku: sample?.sku || '',
                        color,
                        count: matching.length,
                        totalQty,
                        unit: sample?.unit || 'Thùng',
                      })
                    })
                    const productsInRow = Array.from(prodInfoMap.values())
                    const isLegendOpen = !!expandedLegendRowIds[row.bin.id]

                    return (
                      <div
                        key={row.bin.id}
                        className="p-2.5 rounded-2xl bg-[#1e293b]/70 border border-slate-800 space-y-2"
                      >
                        {!isSelectedDetailHall && (
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-black text-sky-400">
                                {row.bin.name}
                              </span>
                              {productsInRow.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedLegendRowIds(p => ({
                                      ...p,
                                      [row.bin.id]: !isLegendOpen,
                                    }))
                                  }
                                  className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold flex items-center gap-1.5 transition ${isMultiProdRow
                                    ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-200'
                                    : 'bg-[#1e293b] border-amber-500/40 text-amber-300'
                                    }`}
                                >
                                  <span className="flex items-center gap-[3px]">
                                    {productsInRow.slice(0, 4).map((prod, pidx) => (
                                      <span
                                        key={pidx}
                                        className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ backgroundColor: prod.color }}
                                      />
                                    ))}
                                  </span>
                                  <span>{productsInRow.length} loại SP</span>
                                  {isLegendOpen ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 truncate">
                              Chạm xem chi tiết · Nhấn giữ để tích cả tầng
                            </span>
                          </div>
                        )}

                        {/* Lưới các Tầng trong Ô: 5 cột trên 1 hàng (T1..T5) giống App Android */}
                        <div
                          className={`grid gap-1.5 ${isSelectedDetailHall ? 'grid-cols-2' : 'grid-cols-5'
                            }`}
                        >
                          {row.levels.map(lvl => {
                            const total = lvl.slots.length
                            const occupied = lvl.slots.filter((s: any) => !!s.lot_id).length
                            const checked = lvl.slots.filter(
                              (s: any) => currentResults[s.id]?.checked
                            ).length
                            const hasDiscrepancy = lvl.slots.some(
                              (s: any) =>
                                currentResults[s.id]?.note && currentResults[s.id]?.note?.trim()
                            )
                            const allDone = total > 0 && checked === total

                            return (
                              <button
                                key={lvl.id}
                                type="button"
                                onContextMenu={e => e.preventDefault()}
                                onPointerDown={() =>
                                  startLevelLongPress(row.bin.name, lvl, allDone)
                                }
                                onPointerUp={clearLevelLongPress}
                                onPointerLeave={clearLevelLongPress}
                                onPointerCancel={clearLevelLongPress}
                                onClick={() => {
                                  if (longPressTriggeredRef.current) {
                                    longPressTriggeredRef.current = false
                                    return
                                  }
                                  setSelectedLevelModalData(lvl)
                                }}
                                className={`px-1.5 py-2 rounded-xl border text-left flex flex-col justify-between gap-1.5 transition active:scale-[0.97] select-none ${hasDiscrepancy
                                  ? 'bg-rose-950/35 border-rose-500/60'
                                  : allDone
                                    ? 'bg-emerald-950/35 border-emerald-500/60'
                                    : checked > 0
                                      ? 'bg-sky-950/30 border-sky-500/50'
                                      : 'bg-[#0f172a] border-slate-700/80'
                                  }`}
                              >
                                <div className="flex items-center justify-between gap-0.5 w-full">
                                  <span className="text-[11px] font-black text-white leading-none">
                                    {isSelectedDetailHall
                                      ? lvl.name
                                      : lvl.name.replace(/Tầng\s*/i, 'T')}
                                  </span>
                                  <span
                                    className={`px-1 py-0.5 rounded text-[9px] font-extrabold leading-none ${allDone
                                      ? 'bg-emerald-500 text-emerald-950'
                                      : 'bg-[#1e293b] text-slate-300'
                                      }`}
                                  >
                                    {checked}/{total}
                                  </span>
                                </div>

                                {/* Thanh chấm màu các vị trí trong tầng */}
                                <div className="flex items-center gap-[2px] w-full h-[5px]">
                                  {sortPositionsByDepthAndCol(lvl.slots).map((s: any) => {
                                    const pk = getProductKey(s)
                                    const isSlotNote = !!(
                                      currentResults[s.id]?.note &&
                                      currentResults[s.id]?.note?.trim()
                                    )
                                    const isSlotChecked = !!currentResults[s.id]?.checked
                                    const occColor =
                                      isMultiProdRow && pk && prodInfoMap.get(pk)?.color
                                        ? prodInfoMap.get(pk)!.color
                                        : '#f59e0b'
                                    const dotColor = isSlotNote
                                      ? '#f43f5e'
                                      : isSlotChecked
                                        ? '#10b981'
                                        : s.lot_id
                                          ? occColor
                                          : '#334155'
                                    return (
                                      <span
                                        key={s.id}
                                        className="flex-1 h-full rounded-[2px]"
                                        style={{ backgroundColor: dotColor }}
                                      />
                                    )
                                  })}
                                </div>

                                <div className="text-[9px] font-semibold text-slate-400 text-center w-full truncate leading-none">
                                  {occupied} có hàng
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {/* Chú thích thông tin sản phẩm trong Ô (giống 100% App Android: đầy đủ tên + số vị trí + tổng số lượng) */}
                        {productsInRow.length > 0 && isLegendOpen && (
                          <div className="p-2 rounded-xl bg-[#0f172a] border border-slate-800 space-y-1.5">
                            {productsInRow.map((info, i) => (
                              <div
                                key={`${info.sku}-${i}`}
                                className="flex items-start gap-2 text-[10.5px]"
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0 mt-1"
                                  style={{ backgroundColor: info.color }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-slate-100 font-medium leading-snug break-words">
                                    {info.name}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] font-semibold">
                                    <span style={{ color: info.color }}>
                                      {info.count} vị trí
                                    </span>
                                    <span className="text-slate-600">•</span>
                                    <span className="text-slate-400">
                                      Tổng:{' '}
                                      <span style={{ color: info.color }}>
                                        {info.totalQty} {info.unit}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal tạo phiếu kiểm kê mới */}
      {newSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md bg-[#0f172a] border border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-white">Tạo Phiếu Kiểm Kê Mới</span>
              <button
                type="button"
                onClick={() => setNewSessionModalOpen(false)}
                className="text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Tên phiếu kiểm kê *
              </label>
              <input
                type="text"
                value={newSessionName}
                onChange={e => setNewSessionName(e.target.value)}
                placeholder="VD: Kiểm kê định kỳ Kho 1..."
                className="w-full px-3 py-2.5 rounded-xl bg-[#1e293b] border border-slate-700 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                Phạm vi kho kiểm kê:
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setNewSessionZoneId('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${newSessionZoneId === 'ALL'
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : 'bg-[#1e293b] border-slate-700 text-slate-300'
                    }`}
                >
                  🌐 Toàn bộ kho
                </button>
                {rootWarehouses.map(wh => (
                  <button
                    key={wh.id}
                    type="button"
                    onClick={() => setNewSessionZoneId(wh.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${newSessionZoneId === wh.id
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-[#1e293b] border-slate-700 text-slate-300'
                      }`}
                  >
                    🏢 {wh.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewSessionModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!newSessionName.trim()}
                onClick={handleCreateNewSession}
                className="flex-2 py-2.5 px-4 rounded-xl bg-emerald-600 disabled:bg-slate-700 text-white text-xs font-extrabold"
              >
                Tạo Phiếu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal kiểm kê từng tầng */}
      <LevelInventoryModal
        level={selectedLevelModalData}
        visible={!!selectedLevelModalData}
        onClose={() => setSelectedLevelModalData(null)}
        inventoryResults={currentResults}
        systemCode={systemCode}
        sessionId={currentSessionId}
        sessionName={currentSession?.name || null}
        companyId={userProfile?.companyId}
        voiceVocabulary={voiceVocabulary}
        pendingVoicesMap={pendingVoicesMap}
        transcribingVoicesMap={transcribingVoicesMap}
        togglePositionChecked={togglePositionChecked}
        updatePositionNote={updatePositionNote}
        onSaveVoiceResult={handleSaveVoiceResult}
        onSaveOfflineVoice={handleSaveOfflineVoice}
        onDeleteOfflineVoice={handleDeleteOfflineVoice}
        onTranscribeOfflineVoice={handleTranscribeOfflineVoice}
        bulkCheckPositions={bulkCheckPositions}
      />

      {/* Modal Kê khai LOT Sảnh */}
      <HallLotInputModal
        visible={hallModalOpen}
        onClose={() => setHallModalOpen(false)}
        halls={allHalls}
        defaultHallId={hallModalDefaultId}
        systemCode={systemCode}
        userProfile={userProfile}
        products={warehouseProducts}
        onSubmitted={msg => showToast(msg)}
      />
    </div>
  )
}

export default InventoryTab
