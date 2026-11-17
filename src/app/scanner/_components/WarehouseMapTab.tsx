'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  MapPin,
  RefreshCw,
  ChevronRight,
  Layers,
  Building2,
  CheckCircle2,
  ArrowLeft,
  Download,
  BarChart3,
  ChevronDown,
  ExternalLink,
  ClipboardEdit,
  ClipboardList,
  Send,
  Truck,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { decodeSTT } from '@/lib/numberUtils'
import { groupWarehouseData } from '@/lib/warehouseUtils'
import { saveWarehouseMapToOfflineDb, getWarehouseMapFromOfflineDb } from '@/lib/scanner-db'
import { fetchAllPagedRows, runWithConcurrency, saveWarehouseMapMeta } from './scannerUtils'
import {
  matchPalletSearch,
  calculateSearchScore,
  matchSearch,
  normalizeSearchString,
} from '@/lib/searchUtils'
import { formatMaterialZoneProvince } from '@/lib/provinces'

import {
  type DateFilterType,
  DATE_FILTER_OPTIONS,
  type UniqueProductItem,
  type UniqueSttItem,
  type UniqueTagItem,
  type WarehouseSearchMode,
  WAREHOUSE_SEARCH_MODES,
  type ZoneItem,
  type PositionItem,
  type WebWarehouseMapCache,
  type HallOption,
  type DraftProposal,
  type ProposalItem,
} from './warehouse-map/types'
import {
  isHallZone,
  formatDateVN,
  formatDateShortVN,
  getCleanUnitCategory,
  formatUnitsSummary,
  formatPositionQtyUnit,
  sortPositionsByDepthAndCol,
  getPositionTag,
  getPositionProductItems,
} from './warehouse-map/mapHelpers'
import {
  getDraftProposal,
  addOrUpdateDraftItem,
  removeDraftItem,
  clearDraftProposal,
  submitAdjustmentProposalToServer,
  syncOfflineAdjustmentProposals,
  fetchSubmittedProposals,
  syncOfflineHallLotUpdates,
} from './warehouse-map/warehouseAdjustmentService'
import { WarehouseSearchBar } from './warehouse-map/WarehouseSearchBar'
import { SearchStatsPanel } from './warehouse-map/SearchStatsPanel'
import { PositionDetailModal } from './warehouse-map/PositionDetailModal'
import HallLotInputModal from './warehouse-map/HallLotInputModal'
import WarehouseAdjustmentDraftModal from './warehouse-map/WarehouseAdjustmentDraftModal'
import WarehouseDraftListModal from './warehouse-map/WarehouseDraftListModal'

export type { DateFilterType, UniqueProductItem }
export {
  DATE_FILTER_OPTIONS,
  isHallZone,
  formatDateVN,
  formatDateShortVN,
  getCleanUnitCategory,
  formatUnitsSummary,
  formatPositionQtyUnit,
  sortPositionsByDepthAndCol,
  getPositionTag,
  getPositionProductItems,
}

const OFFLINE_CACHE_KEY = 'warehouse_map_offline_cache_v8'

let memoryWebWarehouseMapCache: WebWarehouseMapCache | null = null

const checkPositionsIncomplete = (posList: PositionItem[]): boolean => {
  if (!posList || posList.length === 0) return false
  const withLot = posList.filter(p => p.lot_id && p.lot_id !== 'pending')
  if (withLot.length === 0) return false
  const missingItems = withLot.filter(p => p.items === undefined)
  return missingItems.length > 0
}

function getInitialWebMapCache(): WebWarehouseMapCache | null {
  if (memoryWebWarehouseMapCache && !checkPositionsIncomplete(memoryWebWarehouseMapCache.positions)) {
    return memoryWebWarehouseMapCache
  }
  if (typeof window === 'undefined') return null
  try {
    const raw =
      localStorage.getItem(OFFLINE_CACHE_KEY) ||
      localStorage.getItem('warehouse_map_offline_cache_v7')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.zones && parsed.zones.length > 0) {
        const pos: PositionItem[] = parsed.positions || []
        if (!checkPositionsIncomplete(pos)) {
          memoryWebWarehouseMapCache = {
            zones: parsed.zones,
            positions: pos,
            cachedAt: parsed.cachedAt || null,
            timestamp: Date.now(),
          }
          return memoryWebWarehouseMapCache
        }
      }
    }
  } catch {
    // ignore
  }
  return null
}

const POS_CARD_PERF_STYLE: React.CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: '0 78px',
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
  const [onlyShowMatches, setOnlyShowMatches] = useState<boolean>(true)
  const [hallVisibleLimit, setHallVisibleLimit] = useState<number>(120)

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchMode, setSearchMode] = useState<WarehouseSearchMode>('all')
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

  // Hall LOT Input modal
  const [showHallLotModal, setShowHallLotModal] = useState(false)
  const [initialHallForModal, setInitialHallForModal] = useState<HallOption | null>(null)

  // Chế độ Ghi nháp điều chỉnh vị trí (Draft Adjustment Proposal)
  const [isDraftMode, setIsDraftMode] = useState(false)
  const [draftProposal, setDraftProposal] = useState<DraftProposal>({
    id: 'DRAFT-INIT',
    title: 'Phiếu điều chỉnh vị trí',
    created_by: 'Kiểm kho Mobile',
    created_at: new Date().toISOString(),
    items: [],
  })
  const [draftModalPos, setDraftModalPos] = useState<PositionItem | null>(null)
  const [showDraftListModal, setShowDraftListModal] = useState(false)
  const [draftListInitialTab, setDraftListInitialTab] = useState<'DRAFT' | 'SUBMITTED'>('DRAFT')

  // Offline support
  const [isOffline, setIsOffline] = useState<boolean>(false)
  const [cachedAt, setCachedAt] = useState<string | null>(() => initialCache?.cachedAt || null)
  const [downloadingOffline, setDownloadingOffline] = useState<boolean>(false)
  const [downloadToast, setDownloadToast] = useState<string | null>(null)

  // Load initial draft proposal & sync offline queues
  useEffect(() => {
    getDraftProposal().then(setDraftProposal)
    syncOfflineAdjustmentProposals().catch(() => {})
    syncOfflineHallLotUpdates().catch(() => {})
  }, [])

  const draftItemsMap = useMemo(() => {
    const map = new Map<string, ProposalItem>()
    for (const item of draftProposal.items) {
      map.set(item.position_id, item)
    }
    return map
  }, [draftProposal.items])

  const handleSaveDraftItem = useCallback(async (item: ProposalItem) => {
    const updated = await addOrUpdateDraftItem(item)
    setDraftProposal(updated)
  }, [])

  const handleRemoveDraftItem = useCallback(async (positionId: string) => {
    const updated = await removeDraftItem(positionId)
    setDraftProposal(updated)
  }, [])

  const handleClearAllDraft = useCallback(async () => {
    const fresh = await clearDraftProposal()
    setDraftProposal(fresh)
  }, [])

  const handleSubmitDraftProposal = useCallback(
    async (note: string) => {
      const res = await submitAdjustmentProposalToServer(draftProposal, note)
      if (res.success) {
        const fresh = await getDraftProposal()
        setDraftProposal(fresh)
        setIsDraftMode(false)
        setDownloadToast(res.message)
        setTimeout(() => setDownloadToast(null), 4000)
      } else {
        setDownloadToast(res.message)
        setTimeout(() => setDownloadToast(null), 4000)
      }
    },
    [draftProposal]
  )

  const loadWarehouseMapData = useCallback(
    async (isSilent = false, forceSync = false) => {
      if (
        !forceSync &&
        memoryWebWarehouseMapCache &&
        memoryWebWarehouseMapCache.zones.length > 0 &&
        !checkPositionsIncomplete(memoryWebWarehouseMapCache.positions)
      ) {
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

      let hasCache = Boolean(
        memoryWebWarehouseMapCache && memoryWebWarehouseMapCache.zones.length > 0
      )

      try {
        localStorage.removeItem('warehouse_map_offline_cache')
        const cachedRaw =
          localStorage.getItem(OFFLINE_CACHE_KEY) ||
          localStorage.getItem('warehouse_map_offline_cache_v7')
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
        } else {
          const idbCached = await getWarehouseMapFromOfflineDb()
          if (idbCached && idbCached.zones && idbCached.zones.length > 0) {
            setZones(idbCached.zones)
            setPositions(idbCached.positions || [])
            setCachedAt(idbCached.cachedAt || null)
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
        const [rawZones, rawPositions, zpList, pendingRes] = await Promise.all([
          fetchAllPagedRows((from, to) =>
            (supabase.from('zones') as any)
              .select('id, name, code, parent_id, system_type, display_order, is_hall')
              .eq('system_type', 'KHO_DONG_LANH')
              .order('id', { ascending: true })
              .range(from, to)
          ),
          fetchAllPagedRows((from, to) =>
            (supabase.from('positions') as any)
              .select('id, code, lot_id, system_type')
              .eq('system_type', 'KHO_DONG_LANH')
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
            .eq('system_code', 'KHO_DONG_LANH')
            .eq('status', 'pending'),
        ])

        setZones(rawZones)
        const pendingData = pendingRes.data || []

        const zpMap = new Map<string, string[]>()
        zpList.forEach((item: any) => {
          const list = zpMap.get(item.position_id) || []
          list.push(item.zone_id)
          zpMap.set(item.position_id, list)
        })

        const occupiedLotIds = Array.from(
          new Set(rawPositions.map((p: any) => p.lot_id).filter(Boolean))
        )
        const lotMap = new Map<string, any>()

        if (occupiedLotIds.length > 0) {
          const CHUNK_SIZE = 120
          const chunks: string[][] = []
          for (let i = 0; i < occupiedLotIds.length; i += CHUNK_SIZE) {
            chunks.push(occupiedLotIds.slice(i, i + CHUNK_SIZE))
          }
          const chunkResults = await runWithConcurrency(chunks, 6, (chunk) =>
            (supabase.from('lots') as any)
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
                lot_items ( product_id, quantity, unit, products ( name, sku, unit, aliases ) ),
                lot_tags ( tag )
              `)
              .in('id', chunk)
          )
          chunkResults.forEach((res: any) => {
            if (res.data) {
              res.data.forEach((l: any) => {
                const rawTags = [
                  ...(l.lot_tags || []).map((t: any) => t.tag),
                  l.metadata?.tag,
                  l.metadata?.pallet_tag,
                ].filter(Boolean)
                const tags = Array.from(new Set(rawTags.map(t => String(t).trim()))).filter(
                  t => t && !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:')
                )
                const tagsStr = tags.join(', ')

                const allItems = l.lot_items || []
                const allProdNames = Array.from(
                  new Set(
                    [
                      l.products?.name,
                      ...allItems.map((it: any) => it.products?.name),
                    ].filter(Boolean)
                  )
                ) as string[]
                const prodName =
                  allProdNames.length > 0
                    ? allProdNames.join(', ')
                    : tagsStr
                    ? `Hàng ${tagsStr}`
                    : 'Hàng đông lạnh'

                const allSkus = Array.from(
                  new Set(
                    [
                      l.products?.sku,
                      ...allItems.map((it: any) => it.products?.sku),
                    ].filter(Boolean)
                  )
                ) as string[]
                const sku =
                  allSkus.length > 0
                    ? allSkus.join(', ')
                    : tags.length > 0
                    ? tags[0]
                    : '---'

                const allAliases = Array.from(
                  new Set(
                    [
                      l.products?.aliases,
                      ...allItems.map((it: any) => it.products?.aliases),
                    ].filter(Boolean)
                  )
                ) as string[]
                const aliases = allAliases.length > 0 ? allAliases.join(', ') : null

                const itemUnit = allItems.map((it: any) => it.unit).find(Boolean)
                const unit =
                  itemUnit || l.metadata?.unit || l.products?.unit || 'Thùng'

                const peelingDate = l.peeling_date
                  ? String(l.peeling_date).split('T')[0]
                  : Array.isArray(l.metadata?.peeling_dates) && l.metadata.peeling_dates[0]
                  ? String(l.metadata.peeling_dates[0]).split('T')[0]
                  : l.metadata?.production_date
                  ? String(l.metadata.production_date).split('T')[0]
                  : null

                const rawMaterialDate = l.raw_material_date
                  ? String(l.raw_material_date).split('T')[0]
                  : l.metadata?.raw_material_date
                  ? String(l.metadata.raw_material_date).split('T')[0]
                  : null

                const metaZones: string[] = []
                if (Array.isArray(l.metadata?.material_zones)) {
                  l.metadata.material_zones.forEach((z: any) => {
                    if (typeof z === 'string' && z.trim()) metaZones.push(z.trim())
                  })
                } else if (
                  l.metadata?.material_zone &&
                  typeof l.metadata.material_zone === 'string'
                ) {
                  l.metadata.material_zone.split(',').forEach((z: string) => {
                    if (z.trim()) metaZones.push(z.trim())
                  })
                } else if (
                  l.metadata?.region &&
                  typeof l.metadata.region === 'string' &&
                  l.metadata.region !== '---'
                ) {
                  metaZones.push(l.metadata.region.trim())
                } else if (
                  l.metadata?.province &&
                  typeof l.metadata.province === 'string' &&
                  l.metadata.province !== '---'
                ) {
                  metaZones.push(l.metadata.province.trim())
                }

                const cleanZones = Array.from(
                  new Set(metaZones.map(z => formatMaterialZoneProvince(z)).filter(Boolean))
                ) as string[]

                const rawPlaces = l.metadata?.production_places
                const prodPlace =
                  Array.isArray(rawPlaces) && rawPlaces.length > 0
                    ? rawPlaces.join(', ')
                    : l.metadata?.production_place || null

                const itemsList =
                  allItems.length > 0
                    ? allItems.map((it: any) => ({
                        product_id: it.product_id || null,
                        sku: it.products?.sku || l.products?.sku || null,
                        product_name: it.products?.name || l.products?.name || null,
                        quantity: typeof it.quantity === 'number' ? it.quantity : null,
                        unit: it.unit || it.products?.unit || unit,
                      }))
                    : l.products
                    ? [
                        {
                          product_id: null,
                          sku: l.products.sku || null,
                          product_name: l.products.name || null,
                          quantity: typeof l.quantity === 'number' ? l.quantity : null,
                          unit,
                        },
                      ]
                    : []

                const totalQty =
                  allItems.length > 0
                    ? allItems.reduce(
                        (sum: number, it: any) =>
                          sum + (typeof it.quantity === 'number' ? it.quantity : 0),
                        0
                      )
                    : l.quantity ?? null

                lotMap.set(l.id, {
                  code: l.code,
                  stt: l.daily_seq ? decodeSTT(l.daily_seq) : null,
                  product_name: prodName,
                  sku,
                  aliases,
                  unit,
                  tags,
                  packaging_date: l.packaging_date
                    ? String(l.packaging_date).split('T')[0]
                    : null,
                  peeling_date: peelingDate,
                  raw_material_date: rawMaterialDate,
                  inbound_date: l.inbound_date
                    ? String(l.inbound_date).split('T')[0]
                    : null,
                  material_zones: cleanZones,
                  material_zone: cleanZones.length > 0 ? cleanZones.join(', ') : null,
                  production_code:
                    l.production_code || l.metadata?.production_code || null,
                  batch_code: l.batch_code || l.metadata?.batch_code || null,
                  production_place: prodPlace,
                  extra_info: l.metadata?.extra_info || l.notes || null,
                  quantity: totalQty,
                  items: itemsList,
                })
              })
            }
          })
        }

        const pendingMap = new Map<string, any>()
        pendingData.forEach((p: any) => {
          if (p.position_id) {
            pendingMap.set(p.position_id, {
              stt: decodeSTT(p.lot_stt),
              packaging_date: p.production_date,
            })
          }
        })

        const formattedPositions: PositionItem[] = rawPositions.map((p: any) => {
          const lotInfo = p.lot_id ? lotMap.get(p.lot_id) : null
          const pendInfo = pendingMap.get(p.id)

          const stt = lotInfo?.stt || pendInfo?.stt || null
          const lotCode = lotInfo?.code || (pendInfo ? 'Chờ duyệt LOT' : null)
          const productName =
            lotInfo?.product_name || (pendInfo ? 'Đang chờ gán LOT' : null)
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
            quantity: lotInfo?.quantity ?? null,
            items: lotInfo?.items || null,
          }
        })

        setPositions(formattedPositions)

        const now = new Date().toISOString()
        memoryWebWarehouseMapCache = {
          zones: rawZones,
          positions: formattedPositions,
          cachedAt: now,
          timestamp: Date.now(),
        }

        // Lưu vào IndexedDB (dung lượng lớn) + metadata nhẹ
        try {
          await saveWarehouseMapToOfflineDb({
            zones: rawZones,
            positions: formattedPositions,
            cachedAt: now,
            systemCode: 'KHO_DONG_LANH',
          })
          saveWarehouseMapMeta(rawZones, formattedPositions, now)
        } catch (idbErr) {
          console.warn('Lỗi lưu IndexedDB sơ đồ kho:', idbErr)
        }

        try {
          localStorage.removeItem('warehouse_map_offline_cache_v7')
          const snapshot = {
            zones: rawZones,
            positions: formattedPositions,
            cachedAt: now,
          }
          localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(snapshot))
          setCachedAt(now)
          setIsOffline(false)
        } catch (e) {
          console.warn('localStorage đầy, đã fallback IndexedDB:', e)
          setCachedAt(now)
          setIsOffline(false)
        }

        if (!selectedWarehouseId) {
          setSelectedWarehouseId('all')
        }
      } catch (err) {
        console.warn(
          'Lỗi tải dữ liệu Sơ đồ kho từ máy chủ, chuyển sang chế độ ngoại tuyến:',
          err
        )
        try {
          const cachedRaw =
            localStorage.getItem(OFFLINE_CACHE_KEY) ||
            localStorage.getItem('warehouse_map_offline_cache_v7')
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw)
            if (cached && cached.zones) {
              setZones(cached.zones)
              setPositions(cached.positions || [])
              setCachedAt(cached.cachedAt || null)
              setIsOffline(true)
              return
            }
          }
          const idbCached = await getWarehouseMapFromOfflineDb()
          if (idbCached && idbCached.zones && idbCached.zones.length > 0) {
            setZones(idbCached.zones)
            setPositions(idbCached.positions || [])
            setCachedAt(idbCached.cachedAt || null)
            setIsOffline(true)
          }
        } catch {
          // ignore
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [selectedWarehouseId]
  )

  const handleDownloadOffline = async () => {
    setDownloadingOffline(true)
    try {
      await loadWarehouseMapData(true, true)
      await syncOfflineAdjustmentProposals().catch(() => {})
      await fetchSubmittedProposals().catch(() => {})
      await syncOfflineHallLotUpdates().catch(() => {})
      setDownloadToast('Đã lưu toàn bộ sơ đồ kho & phiếu điều chỉnh vào máy để xem ngoại tuyến!')
      setTimeout(() => setDownloadToast(null), 4000)
    } finally {
      setDownloadingOffline(false)
    }
  }

  useEffect(() => {
    loadWarehouseMapData()
  }, [loadWarehouseMapData])

  // ── Ô Gộp (Grouped Warehouse Data) ───────────────────────────
  const { groupedZones, virtualToRealMap } = useMemo(() => {
    if (zones.length === 0) {
      return { groupedZones: [], virtualToRealMap: new Map<string, string[]>() }
    }
    const res = groupWarehouseData(zones as any, positions as any)
    return {
      groupedZones: (res.zones as ZoneItem[]) || zones,
      virtualToRealMap: res.virtualToRealMap || new Map<string, string[]>(),
    }
  }, [zones, positions])

  const activeZones = groupedZones.length > 0 ? groupedZones : zones

  const sortZones = (list: ZoneItem[]) =>
    [...list].sort((a, b) => {
      const oa = a.display_order ?? 0
      const ob = b.display_order ?? 0
      if (oa !== ob) return oa - ob
      return (a.name || a.code || '').localeCompare(b.name || b.code || '', undefined, {
        numeric: true,
      })
    })

  // ── Pre-compute Zone Descendants Map & Full Paths ONCE (O(1) lookups) ──
  const { zoneDescendantsMap, zonePathMap } = useMemo(() => {
    const rzMap = new Map(zones.map(z => [z.id, z]))

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

  const getDescendantZoneIds = useCallback(
    (targetZoneId: string): Set<string> => {
      return zoneDescendantsMap.get(targetZoneId) || new Set<string>([targetZoneId])
    },
    [zoneDescendantsMap]
  )

  const getPositionPath = useCallback(
    (pos: PositionItem) => {
      const leafZoneId = pos.zone_ids[0]
      if (!leafZoneId) return ''
      return zonePathMap.get(leafZoneId) || ''
    },
    [zonePathMap]
  )

  // ── Danh sách sản phẩm duy nhất đang có trong kho (tách từng mặt hàng trong pallet hỗn hợp) ──
  const uniqueProducts = useMemo(() => {
    const prodMap = new Map<string, UniqueProductItem>()

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]
      if (!p.lot_id) continue

      const subItems = getPositionProductItems(p)
      const seenNamesInPos = new Set<string>()

      for (let j = 0; j < subItems.length; j++) {
        const sub = subItems[j]
        const name = sub.name.trim()
        if (!name) continue

        const existing = prodMap.get(name)
        if (existing) {
          if (!seenNamesInPos.has(name)) {
            existing.positionCount++
            seenNamesInPos.add(name)
          }
          existing.totalQuantity += sub.quantity
          existing.unitsMap.set(
            sub.unit,
            (existing.unitsMap.get(sub.unit) || 0) + sub.quantity
          )
          if (!existing.aliases && sub.aliases) {
            existing.aliases = sub.aliases
            existing.aliasList = sub.aliases
              .split(',')
              .map(a => a.trim())
              .filter(Boolean)
              .map(a => ({
                raw: a,
                norm: normalizeSearchString(a),
                unacc: normalizeSearchString(a, true),
              }))
          }
          if (!existing.sku && sub.sku) {
            existing.sku = sub.sku
            existing.normSku = normalizeSearchString(sub.sku)
            existing.unaccSku = normalizeSearchString(sub.sku, true)
          }
        } else {
          seenNamesInPos.add(name)
          const aliasList = (sub.aliases || '')
            .split(',')
            .map(a => a.trim())
            .filter(Boolean)
            .map(a => ({
              raw: a,
              norm: normalizeSearchString(a),
              unacc: normalizeSearchString(a, true),
            }))
          const unitsMap = new Map<string, number>()
          unitsMap.set(sub.unit, sub.quantity)
          prodMap.set(name, {
            name,
            sku: sub.sku || null,
            aliases: sub.aliases || null,
            unit: sub.unit,
            positionCount: 1,
            totalQuantity: sub.quantity,
            unitsMap,
            normName: normalizeSearchString(name),
            unaccName: normalizeSearchString(name, true),
            normSku: normalizeSearchString(sub.sku || ''),
            unaccSku: normalizeSearchString(sub.sku || '', true),
            aliasList,
          })
        }
      }
    }

    return Array.from(prodMap.values())
  }, [positions])

  // ── Danh sách STT duy nhất đang có trong kho (cho gợi ý nhanh STT) ──
  const uniqueStts = useMemo(() => {
    const sttMap = new Map<string, UniqueSttItem>()

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]
      if (!p.lot_id || !p.stt) continue
      const sttStr = String(p.stt).trim()
      if (!sttStr) continue

      const existing = sttMap.get(sttStr)
      if (existing) {
        if (!existing.positionCodes.includes(p.code)) {
          existing.positionCodes.push(p.code)
        }
        existing.positionCount++
        existing.totalQuantity += p.quantity || 0
        if (!existing.productName && p.product_name) {
          existing.productName = p.product_name
        }
        if (!existing.sku && p.sku) {
          existing.sku = p.sku
        }
        if (!existing.lotCode && p.lot_code) {
          existing.lotCode = p.lot_code
        }
      } else {
        sttMap.set(sttStr, {
          stt: sttStr,
          normStt: normalizeSearchString(sttStr),
          positionCodes: [p.code],
          positionCount: 1,
          totalQuantity: p.quantity || 0,
          productName: p.product_name || null,
          sku: p.sku || null,
          lotCode: p.lot_code || null,
        })
      }
    }

    return Array.from(sttMap.values())
  }, [positions])

  // ── Danh sách Mã phụ (Tags) duy nhất đang có trong kho (cho gợi ý & tìm kiếm Mã phụ) ──
  const uniqueTags = useMemo(() => {
    const tagMap = new Map<string, UniqueTagItem>()

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]
      if (!p.lot_id) continue
      const tags = p.tags && Array.isArray(p.tags) ? p.tags : []

      for (let j = 0; j < tags.length; j++) {
        const rawTag = String(tags[j] || '').trim()
        if (!rawTag || rawTag.startsWith('MERGED_')) continue
        const key = rawTag.toUpperCase()
        const existing = tagMap.get(key)
        const qty = p.quantity || 0
        const uCat = getCleanUnitCategory(p.unit)

        if (existing) {
          existing.positionCount++
          existing.totalQuantity += qty
          existing.unitsMap.set(uCat, (existing.unitsMap.get(uCat) || 0) + qty)
          if (!existing.sampleProductName && p.product_name) {
            existing.sampleProductName = p.product_name
          }
        } else {
          const uMap = new Map<string, number>()
          if (qty > 0) uMap.set(uCat, qty)
          tagMap.set(key, {
            tag: rawTag,
            normTag: normalizeSearchString(rawTag),
            unaccTag: normalizeSearchString(rawTag, true),
            positionCount: 1,
            totalQuantity: qty,
            unitsMap: uMap,
            sampleProductName: p.product_name || null,
          })
        }
      }
    }

    return Array.from(tagMap.values()).sort((a, b) => b.positionCount - a.positionCount)
  }, [positions])

  const availableRegions = useMemo(() => {
    const regionCountMap = new Map<string, number>()
    positions.forEach(p => {
      const zs =
        p.material_zones && p.material_zones.length > 0
          ? p.material_zones
          : p.material_zone
          ? [p.material_zone]
          : []
      zs.forEach(z => {
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

  const handleSetDatePreset = useCallback(
    (preset: 'today' | 3 | 7 | 'this_month' | 'clear') => {
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
    },
    []
  )

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

  // Danh sách các Sảnh có trong hệ thống để chọn nhanh khi cập nhật LOT ở sảnh
  const availableHalls = useMemo<HallOption[]>(() => {
    const zMap = new Map(zones.map(z => [z.id, z]))
    const resolveRootWarehouse = (z: ZoneItem): ZoneItem | null => {
      let curr: ZoneItem | undefined = z
      while (curr && curr.parent_id) {
        curr = zMap.get(curr.parent_id)
      }
      return curr && curr.id !== z.id ? curr : null
    }

    return zones
      .filter(z => isHallZone(z))
      .map(z => {
        const wh = resolveRootWarehouse(z)
        const whName = wh?.name || null
        const fullPath = whName ? `${whName} › ${z.name}` : z.name
        return {
          id: z.id,
          name: z.name,
          warehouse_id: wh?.id || null,
          warehouse_name: whName,
          full_path: fullPath,
        }
      })
      .sort((a, b) =>
        (a.full_path || a.name).localeCompare(b.full_path || b.name, 'vi', {
          numeric: true,
        })
      )
  }, [zones])

  // ── Pre-compute Hierarchy Map & Ancestor Lookup ONCE in O(N) ──
  const { zoneHierarchyMap, realToActiveAncestorsMap } = useMemo(() => {
    const hierMap = new Map<
      string,
      { wh: ZoneItem; aisle: ZoneItem; slot: ZoneItem; tier?: ZoneItem }
    >()
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

      if (hasDateFilter) {
        let targetDate: string | null = null
        if (filterDateType === 'packaging_date') targetDate = p.packaging_date || null
        else if (filterDateType === 'peeling_date')
          targetDate = p.peeling_date || p.packaging_date || null
        else if (filterDateType === 'raw_material_date')
          targetDate = p.raw_material_date || null
        else if (filterDateType === 'inbound_date') targetDate = p.inbound_date || null

        if (!targetDate) continue
        if (filterStartDate && targetDate < filterStartDate) continue
        if (filterEndDate && targetDate > filterEndDate) continue
      }

      if (hasRegionFilter) {
        const pZones =
          p.material_zones && p.material_zones.length > 0
            ? p.material_zones
            : p.material_zone
            ? [p.material_zone]
            : []
        if (pZones.length === 0) continue

        const matchedRegion = pZones.some(z => {
          const normZ = normalizeSearchString(z, true)
          return normZ.includes(normRegionFilter) || normRegionFilter.includes(normZ)
        })
        if (!matchedRegion) continue
      }

    if (hasQuery) {
        if (searchMode === 'name') {
          // CHẾ ĐỘ: THEO TÊN (HỖ TRỢ ĐẦY ĐỦ TÊN VIẾT TẮT / ALIASES)
          if (isExactProductQuery) {
            const subItems = getPositionProductItems(p)
            if (subItems.some(sub => sub.name === q)) {
              matched.push({ pos: p, score: 2000 })
            }
            continue
          }

          const subItems = getPositionProductItems(p)
          let isNameMatch = false
          let bestScore = 0

          for (let sIdx = 0; sIdx < subItems.length; sIdx++) {
            const sub = subItems[sIdx]
            const nameObj = {
              name: sub.name,
              aliases: sub.aliases || p.aliases,
            }
            if (matchSearch(nameObj, q)) {
              isNameMatch = true
              const sc = calculateSearchScore(nameObj, q)
              if (sc > bestScore) bestScore = sc
            }
          }

          if (!isNameMatch && p.product_name) {
            const palletNameObj = {
              name: p.product_name,
              aliases: p.aliases,
            }
            if (matchSearch(palletNameObj, q)) {
              isNameMatch = true
              bestScore = calculateSearchScore(palletNameObj, q)
            }
          }

          if (isNameMatch) {
            matched.push({ pos: p, score: bestScore || 100 })
          }
        } else if (searchMode === 'code') {
          // CHẾ ĐỘ: THEO MÃ (SKU, MÃ LOT, MÃ VỊ TRÍ, BATCH CODE...)
          const qCleanNorm = normalizeSearchString(q, true)
          const posCodeNorm = normalizeSearchString(p.code, true)
          const lotCodeNorm = p.lot_code ? normalizeSearchString(p.lot_code, true) : ''
          const prodCodeNorm = p.production_code ? normalizeSearchString(p.production_code, true) : ''
          const batchCodeNorm = p.batch_code ? normalizeSearchString(p.batch_code, true) : ''
          const skuNorm = p.sku ? normalizeSearchString(p.sku, true) : ''

          let isCodeMatch = false
          let score = 0

          if (posCodeNorm.includes(qCleanNorm)) {
            isCodeMatch = true
            score = posCodeNorm === qCleanNorm ? 4000 : 2500
          } else if (lotCodeNorm && lotCodeNorm.includes(qCleanNorm)) {
            isCodeMatch = true
            score = lotCodeNorm === qCleanNorm ? 3800 : 2200
          } else if (skuNorm && skuNorm.includes(qCleanNorm)) {
            isCodeMatch = true
            score = skuNorm === qCleanNorm ? 3500 : 2000
          } else if (prodCodeNorm && prodCodeNorm.includes(qCleanNorm)) {
            isCodeMatch = true
            score = prodCodeNorm === qCleanNorm ? 3200 : 1800
          } else if (batchCodeNorm && batchCodeNorm.includes(qCleanNorm)) {
            isCodeMatch = true
            score = batchCodeNorm === qCleanNorm ? 3000 : 1600
          } else {
            // Kiểm tra SKU từng dòng con nếu là pallet hỗn hợp
            const subItems = getPositionProductItems(p)
            for (let sIdx = 0; sIdx < subItems.length; sIdx++) {
              const subSku = subItems[sIdx].sku ? normalizeSearchString(subItems[sIdx].sku!, true) : ''
              if (subSku && subSku.includes(qCleanNorm)) {
                isCodeMatch = true
                score = subSku === qCleanNorm ? 3500 : 2000
                break
              }
            }
          }

          if (isCodeMatch) {
            matched.push({ pos: p, score })
          }
        } else if (searchMode === 'tag') {
          // CHẾ ĐỘ: THEO MÃ PHỤ (TAG)
          const qTagNorm = normalizeSearchString(q, true)
          const tags = p.tags && Array.isArray(p.tags) ? p.tags : []
          let isTagMatch = false
          let score = 0

          for (let tIdx = 0; tIdx < tags.length; tIdx++) {
            const rawTag = String(tags[tIdx] || '').trim()
            if (!rawTag || rawTag.startsWith('MERGED_')) continue
            const tagNorm = normalizeSearchString(rawTag, true)
            if (tagNorm === qTagNorm) {
              isTagMatch = true
              score = 4500
              break
            } else if (tagNorm.includes(qTagNorm)) {
              isTagMatch = true
              score = 3000
            }
          }

          if (isTagMatch) {
            matched.push({ pos: p, score })
          }
        } else if (searchMode === 'stt') {
          // CHẾ ĐỘ: THEO STT CỦA LOT
          if (p.stt) {
            const rawStt = String(p.stt).trim()
            const sttNorm = normalizeSearchString(rawStt, true)
            const cleanQ = normalizeSearchString(q.replace(/^(#|stt[:\s-#]*)/i, '').trim(), true)

            if (!cleanQ || sttNorm === cleanQ) {
              matched.push({ pos: p, score: 5000 })
            } else if (sttNorm.startsWith(cleanQ)) {
              matched.push({ pos: p, score: 3800 })
            } else if (sttNorm.includes(cleanQ)) {
              matched.push({ pos: p, score: 2600 })
            }
          }
        } else {
          // CHẾ ĐỘ: TỔNG HỢP (HỖ TRỢ ĐẦY ĐỦ TÊN VIẾT TẮT, MÃ, MÃ PHỤ, STT, VỊ TRÍ)
          if (isExactProductQuery) {
            const subItems = getPositionProductItems(p)
            if (subItems.some(sub => sub.name === q)) {
              matched.push({ pos: p, score: 2000 })
            }
            continue
          }

          if (isSttPrefixQuery) {
            if (p.stt) {
              const sttNorm = String(p.stt).trim().toLowerCase()
              if (!cleanSttQuery || sttNorm.includes(cleanSttQuery)) {
                const score =
                  sttNorm === cleanSttQuery
                    ? 5000
                    : sttNorm.startsWith(cleanSttQuery)
                    ? 3800
                    : 2600
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
              aliases: p.aliases,
            })
            matched.push({ pos: p, score })
          }
        }
      } else {
        matched.push({ pos: p, score: 100 })
      }
    }

    if (hasQuery && !isExactProductQuery) {
      matched.sort((a, b) => b.score - a.score)
    }
    return matched.map(m => m.pos)
  }, [
    positions,
    searchQuery,
    searchMode,
    filterDateType,
    filterStartDate,
    filterEndDate,
    filterRegion,
    exactProductNamesSet,
  ])

  const matchingPosIds = useMemo(() => {
    return new Set(matchingPositions.map(p => p.id))
  }, [matchingPositions])

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

  // ── Thống kê phân bổ kết quả tìm kiếm (tách chính xác SL mặt hàng trong pallet hỗn hợp) ──
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
    const qClean = searchQuery.trim()
    const isExactProd = qClean.length > 0 && exactProductNamesSet.has(qClean)

    matchingPositions.forEach(p => {
      const subItems = getPositionProductItems(p)
      let itemsToSum: Array<{ quantity: number; unit: string }> = []

      if (subItems.length > 1 && qClean) {
        const matchedSubs = isExactProd
          ? subItems.filter(s => s.name === qClean)
          : subItems.filter(
              s =>
                matchSearch(s.name, qClean) ||
                (s.sku ? matchSearch(s.sku, qClean) : false)
            )
        if (matchedSubs.length > 0) {
          itemsToSum = matchedSubs.map(s => ({ quantity: s.quantity, unit: s.unit }))
        }
      }

      if (itemsToSum.length === 0) {
        itemsToSum = [{ quantity: p.quantity || 0, unit: getCleanUnitCategory(p.unit) }]
      }

      itemsToSum.forEach(it => addQtyToMap(grandUnitsMap, it.unit, it.quantity))

      let hier:
        | { wh: ZoneItem; aisle: ZoneItem; slot: ZoneItem; tier?: ZoneItem }
        | undefined
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
          whAcc = {
            warehouse: hier.wh,
            unitsMap: new Map(),
            positionCount: 0,
            aislesMap: new Map(),
          }
          whMap.set(hier.wh.id, whAcc)
        }
        itemsToSum.forEach(it => addQtyToMap(whAcc!.unitsMap, it.unit, it.quantity))
        whAcc.positionCount++

        let aisleAcc = whAcc.aislesMap.get(hier.aisle.id)
        if (!aisleAcc) {
          aisleAcc = {
            aisle: hier.aisle,
            unitsMap: new Map(),
            positionCount: 0,
            slotsMap: new Map(),
          }
          whAcc.aislesMap.set(hier.aisle.id, aisleAcc)
        }
        itemsToSum.forEach(it => addQtyToMap(aisleAcc!.unitsMap, it.unit, it.quantity))
        aisleAcc.positionCount++

        let slotAcc = aisleAcc.slotsMap.get(hier.slot.id)
        if (!slotAcc) {
          slotAcc = {
            slot: hier.slot,
            unitsMap: new Map(),
            positionCount: 0,
            positions: [],
            tiersMap: new Map(),
          }
          aisleAcc.slotsMap.set(hier.slot.id, slotAcc)
        }
        itemsToSum.forEach(it => addQtyToMap(slotAcc!.unitsMap, it.unit, it.quantity))
        slotAcc.positionCount++
        slotAcc.positions.push(p)

        if (hier.tier) {
          let tierAcc = slotAcc.tiersMap.get(hier.tier.id)
          if (!tierAcc) {
            tierAcc = {
              tier: hier.tier,
              unitsMap: new Map(),
              positionCount: 0,
              positions: [],
            }
            slotAcc.tiersMap.set(hier.tier.id, tierAcc)
          }
          itemsToSum.forEach(it => addQtyToMap(tierAcc!.unitsMap, it.unit, it.quantity))
          tierAcc.positionCount++
          tierAcc.positions.push(p)
        }
      }
    })

    const getMapTotal = (map: Map<string, number>) =>
      Array.from(map.values()).reduce((s, v) => s + v, 0)

    const sortedWhs = Array.from(whMap.values())
      .sort(
        (a, b) =>
          getMapTotal(b.unitsMap) - getMapTotal(a.unitsMap) ||
          b.positionCount - a.positionCount
      )
      .map(whAcc => {
        const sortedAisles = Array.from(whAcc.aislesMap.values())
          .sort(
            (a, b) =>
              getMapTotal(b.unitsMap) - getMapTotal(a.unitsMap) ||
              b.positionCount - a.positionCount
          )
          .map(aisleAcc => {
            const sortedSlots = Array.from(aisleAcc.slotsMap.values())
              .sort((a, b) => {
                const oa = a.slot.display_order ?? 0
                const ob = b.slot.display_order ?? 0
                if (oa !== ob) return oa - ob
                return (a.slot.name || '').localeCompare(b.slot.name || '', undefined, {
                  numeric: true,
                })
              })
              .map(slotAcc => {
                const sortedTiers = Array.from(slotAcc.tiersMap.values())
                  .sort((a, b) => {
                    const oa = a.tier.display_order ?? 0
                    const ob = b.tier.display_order ?? 0
                    if (oa !== ob) return oa - ob
                    return (a.tier.name || '').localeCompare(
                      b.tier.name || '',
                      undefined,
                      { numeric: true }
                    )
                  })
                  .map(tierAcc => ({
                    ...tierAcc,
                    positions: sortPositionsByDepthAndCol(tierAcc.positions),
                  }))

                return {
                  slot: slotAcc.slot,
                  unitsMap: slotAcc.unitsMap,
                  positionCount: slotAcc.positionCount,
                  positions: sortPositionsByDepthAndCol(slotAcc.positions),
                  tiers: sortedTiers,
                }
              })
            return {
              aisle: aisleAcc.aisle,
              unitsMap: aisleAcc.unitsMap,
              positionCount: aisleAcc.positionCount,
              slots: sortedSlots,
            }
          })
        return {
          warehouse: whAcc.warehouse,
          unitsMap: whAcc.unitsMap,
          positionCount: whAcc.positionCount,
          aisles: sortedAisles,
        }
      })

    const grandTotalQty = Array.from(grandUnitsMap.values()).reduce((s, v) => s + v, 0)

    return {
      grandUnitsMap,
      grandTotalQty,
      totalPositions: matchingPositions.length,
      warehouses: sortedWhs,
    }
  }, [
    isSearchActive,
    matchingPositions,
    zoneHierarchyMap,
    searchQuery,
    exactProductNamesSet,
  ])

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
      return (a.name || a.code || '').localeCompare(b.name || b.code || '', undefined, {
        numeric: true,
      })
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

  // 3. Slots (Level 3: parent_id === selectedAisleId)
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
          return (a.name || a.code || '').localeCompare(
            b.name || b.code || '',
            undefined,
            { numeric: true }
          )
        })
    }
    return sortZones(list)
  }, [activeZones, selectedAisleId, isSearchActive, zoneMatchCountMap])

  const selectedAisle = useMemo(() => {
    if (!selectedAisleId) return null
    return activeZones.find(z => z.id === selectedAisleId) || null
  }, [activeZones, selectedAisleId])

  const isSelectedAisleHall = useMemo(() => {
    if (!selectedAisle) return false
    const hasRealChildSlots = activeZones.some(z => z.parent_id === selectedAisle.id)
    return isHallZone(selectedAisle) || !hasRealChildSlots
  }, [selectedAisle, activeZones])

  // Reset hallVisibleLimit when switching aisle
  useEffect(() => {
    setHallVisibleLimit(120)
  }, [selectedAisleId])

  // 4. Tiers (Level 4: parent_id === selectedSlotId)
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
  }, [
    selectedSlotId,
    highlightedPosId,
    isSearchActive,
    tiers,
    positions,
    getDescendantZoneIds,
    zoneMatchCountMap,
  ])

  const zoneStatsMap = useMemo(() => {
    const map = new Map<string, { total: number; occupied: number; empty: number }>()
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

  const getWhBreakdown = useCallback(
    (whId: string) => {
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
    },
    [activeZones, zoneStatsMap]
  )

  const currentPositions = useMemo(() => {
    if (isSelectedAisleHall) {
      if (!selectedAisleId) return []
      const targetZoneIds = getDescendantZoneIds(selectedAisleId)
      let filtered = positions.filter(p => p.zone_ids.some(zid => targetZoneIds.has(zid)))
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

    let filtered = positions.filter(p => p.zone_ids.some(zid => targetZoneIds.has(zid)))

    if (onlyShowMatches && isSearchActive) {
      filtered = filtered.filter(p => matchingPosIds.has(p.id))
    }

    return sortPositionsByDepthAndCol(filtered)
  }, [
    isSelectedAisleHall,
    selectedAisleId,
    selectedSlotId,
    selectedTierId,
    positions,
    getDescendantZoneIds,
    onlyShowMatches,
    isSearchActive,
    matchingPosIds,
  ])

  const tierPositionsMap = useMemo(() => {
    const map = new Map<string, PositionItem[]>()
    if (!selectedSlotId) return map

    tiers.forEach(tier => {
      const descIds = getDescendantZoneIds(tier.id)
      const list = positions.filter(p => p.zone_ids.some(zid => descIds.has(zid)))
      map.set(tier.id, sortPositionsByDepthAndCol(list))
    })

    return map
  }, [selectedSlotId, tiers, positions, getDescendantZoneIds])

  const handlePositionPress = useCallback(
    (pos: PositionItem) => {
      if (isDraftMode) {
        setDraftModalPos(pos)
      } else {
        setSelectedPosDetail(pos)
      }
    },
    [isDraftMode]
  )

  const getZoneName = (id: string | null) =>
    activeZones.find(z => z.id === id)?.name || ''

  // Render body of a Position Card (supports mixed pallets with per-product lines & quantities)
  const renderPositionCardBody = (pos: PositionItem, isMatched: boolean) => {
    const subItems = getPositionProductItems(pos)
    const isMulti = subItems.length > 1
    const qClean = searchQuery.trim()
    const isExactProd = qClean.length > 0 && exactProductNamesSet.has(qClean)
    const tagStr = getPositionTag(pos)

    if (isMulti) {
      return (
        <div className="space-y-1 w-full mt-1">
          <div className="space-y-0.5">
            {subItems.map((sub, idx) => {
              const isSubMatched =
                isMatched &&
                qClean.length > 0 &&
                (isExactProd
                  ? sub.name === qClean
                  : matchSearch(sub.name, qClean) ||
                    (sub.sku ? matchSearch(sub.sku, qClean) : false))

              return (
                <div
                  key={idx}
                  className={`flex items-start justify-between gap-1 text-[9.5px] leading-tight rounded px-1 py-0.5 ${
                    isSubMatched
                      ? 'bg-amber-400/20 text-amber-200 font-black'
                      : 'text-slate-100 font-semibold'
                  }`}
                >
                  <span className="break-words flex-1">• {sub.name}</span>
                  <span
                    className={`font-mono font-bold shrink-0 ${
                      isSubMatched ? 'text-amber-300' : 'text-emerald-400'
                    }`}
                  >
                    {formatPositionQtyUnit(sub.quantity, sub.unit)}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between text-[9px] font-mono pt-0.5 border-t border-slate-700/60">
            {tagStr ? (
              <span
                className="truncate max-w-[90px] text-cyan-300 font-bold"
                title={tagStr}
              >
                TAG: {tagStr}
              </span>
            ) : (
              <span />
            )}
            {pos.quantity ? (
              <span className="text-amber-300 font-bold shrink-0">
                Tổng: {formatPositionQtyUnit(pos.quantity, pos.unit)}
              </span>
            ) : null}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-0.5 w-full mt-1">
        <p
          className="font-bold text-[9.5px] text-white break-words leading-tight"
          title={pos.product_name || ''}
        >
          {pos.product_name || 'Hàng đông lạnh'}
        </p>
        <div className="flex items-center justify-between text-[9px] font-mono pt-0.5">
          {tagStr ? (
            <span
              className="truncate max-w-[95px] text-cyan-300 font-bold"
              title={tagStr}
            >
              TAG: {tagStr}
            </span>
          ) : (
            <span />
          )}
          {pos.quantity ? (
            <span className="text-amber-300 font-bold shrink-0">
              {formatPositionQtyUnit(pos.quantity, pos.unit)}
            </span>
          ) : null}
        </div>
      </div>
    )
  }

  const renderPositionCard = (pos: PositionItem) => {
    const isOccupied = !!pos.lot_id
    const isHighlighted = pos.id === highlightedPosId
    const isMatched = matchingPosIds.has(pos.id)
    const draftItem = draftItemsMap.get(pos.id)

    return (
      <button
        key={pos.id}
        type="button"
        style={POS_CARD_PERF_STYLE}
        onClick={() => handlePositionPress(pos)}
        className={`p-2.5 rounded-xl border text-left transition relative active:scale-[0.98] flex flex-col justify-between min-h-[74px] ${
          draftItem
            ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/40 shadow-md'
            : isHighlighted
            ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/50 shadow-lg'
            : isMatched
            ? 'border-amber-400/90 ring-1 ring-amber-400/50 bg-gradient-to-b from-amber-950/50 to-[#131d33] shadow-md shadow-amber-500/20'
            : isOccupied
            ? 'bg-[#131d33] border-cyan-500/50 hover:border-cyan-400'
            : 'bg-slate-900/60 border-slate-700/80 hover:border-emerald-500/60'
        }`}
      >
        <div className="flex items-center justify-between gap-1 w-full">
          <div className="flex items-center gap-1 min-w-0 pr-1 flex-wrap">
            <span
              className="font-mono font-bold text-[9px] text-slate-200 truncate"
              title={pos.code}
            >
              {pos.code}
            </span>
            {pos.inbound_date && (
              <span
                className="px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 font-mono font-bold text-[7.8px] shrink-0"
                title={`Nhập kho: ${formatDateVN(pos.inbound_date)}`}
              >
                {formatDateShortVN(pos.inbound_date)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {draftItem && (
              <span className="px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[8px]">
                ✏️ Nháp
              </span>
            )}
            {isMatched && !draftItem && (
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
          renderPositionCardBody(pos, isMatched)
        ) : (
          <div className="w-full text-center py-1 text-[10px] text-emerald-500/70 font-medium">
            + Vị trí trống
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0f1d] text-slate-100 overflow-hidden relative">
      {/* ── TOP HEADER & QUICK STATS ────────────────────────────── */}
      <div className="p-2.5 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm shrink-0">
            <MapPin size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span className="truncate">Sơ Đồ Kho</span>
              <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold shrink-0">
                ĐÔNG LẠNH
              </span>
            </h2>
            <p className="text-[10px] text-slate-400 truncate">
              Tổng {positions.length} · {positions.filter(p => p.lot_id).length} có hàng ·{' '}
              {positions.filter(p => !p.lot_id).length} trống
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Nút bật/tắt chế độ Ghi nháp điều chỉnh vị trí */}
          <button
            type="button"
            onClick={() => setIsDraftMode(!isDraftMode)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition active:scale-95 ${
              isDraftMode
                ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-md shadow-amber-400/20'
                : 'bg-slate-800/80 text-amber-300 border-amber-500/40 hover:bg-slate-800'
            }`}
            title="Chế độ ghi nháp điều chỉnh vị trí"
          >
            <ClipboardEdit size={14} />
            <span>{isDraftMode ? 'Đang nháp' : 'Ghi nháp'}</span>
            {draftProposal.items.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black font-mono ${
                  isDraftMode ? 'bg-slate-950 text-amber-300' : 'bg-amber-400 text-slate-950'
                }`}
              >
                {draftProposal.items.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadOffline}
            disabled={downloadingOffline}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-500/50 active:scale-95 transition flex items-center gap-1 text-xs font-bold"
            title="Tải về máy để xem khi vào kho đông không có mạng"
          >
            <Download
              size={14}
              className={downloadingOffline ? 'animate-bounce text-emerald-400' : ''}
            />
            <span className="hidden sm:inline">Offline</span>
          </button>

          <button
            type="button"
            onClick={() => loadWarehouseMapData(true, true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95 transition"
            title="Tải lại sơ đồ kho"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-cyan-400' : ''} />
          </button>
        </div>
      </div>

      {/* ── DRAFT MODE ACTIVE BANNER ── */}
      {isDraftMode && (
        <div className="bg-amber-500/15 border-b border-amber-500/40 px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-amber-200 shrink-0">
          <div className="flex items-center gap-1.5 font-bold min-w-0">
            <ClipboardEdit size={14} className="text-amber-400 shrink-0" />
            <span className="truncate">Chạm vào ô bất kỳ để ghi nháp</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraftListInitialTab(draftProposal.items.length > 0 ? 'DRAFT' : 'SUBMITTED')
              setShowDraftListModal(true)
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1 shrink-0 active:scale-95"
          >
            <ClipboardList size={12} />
            <span>
              {draftProposal.items.length > 0
                ? `Phiếu nháp (${draftProposal.items.length})`
                : 'Phiếu đã gửi'}
            </span>
          </button>
        </div>
      )}

      {/* ── OFFLINE STATUS BANNER ── */}
      {isOffline && (
        <div className="bg-amber-950/80 border-b border-amber-500/50 px-3 py-2 flex items-center justify-between text-xs text-amber-200 shrink-0">
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
                  Bản lưu lúc: {new Date(cachedAt).toLocaleTimeString('vi-VN')}{' '}
                  {new Date(cachedAt).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadWarehouseMapData(true, true)}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-bold active:scale-95 transition"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* ── SUCCESS DOWNLOAD / SUBMIT TOAST ── */}
      {downloadToast && (
        <div className="bg-emerald-950 border-b border-emerald-500/50 px-3 py-2 flex items-center gap-2 text-xs text-emerald-200 animate-in fade-in shrink-0">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span className="font-semibold">{downloadToast}</span>
        </div>
      )}

      {/* ── ISOLATED SEARCH BAR ── */}
      <WarehouseSearchBar
        uniqueProducts={uniqueProducts}
        uniqueStts={uniqueStts}
        uniqueTags={uniqueTags}
        searchQuery={searchQuery}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
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

      <SearchStatsPanel
        isSearchActive={isSearchActive}
        matchingPositions={matchingPositions}
        searchQuery={searchQuery}
        hasActiveFilters={hasActiveFilters}
        filterDateType={filterDateType}
        filterStartDate={filterStartDate}
        filterEndDate={filterEndDate}
        filterRegion={filterRegion}
        isFilterOpen={isFilterOpen}
        setIsFilterOpen={setIsFilterOpen}
        handleClearAllSearchAndFilters={handleClearAllSearchAndFilters}
        searchTab={searchTab}
        setSearchTab={setSearchTab}
        breakdownReport={breakdownReport}
        warehouses={warehouses}
        selectedWarehouseId={selectedWarehouseId}
        setSelectedWarehouseId={setSelectedWarehouseId}
        setSelectedAisleId={setSelectedAisleId}
        setSelectedSlotId={setSelectedSlotId}
        setSelectedTierId={setSelectedTierId}
        zoneMatchCountMap={zoneMatchCountMap}
      />

      {/* ── BREADCRUMB NAVIGATION (Kho > Dãy > Ô > Tầng) ─────────── */}
      {(!isSearchActive || searchTab === 'map') && (
        <div className="px-3 py-2 bg-[#0c1322] border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => {
              setSelectedWarehouseId('all')
              setSelectedAisleId(null)
              setSelectedSlotId(null)
              setSelectedTierId(null)
            }}
            className={`shrink-0 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
              !selectedWarehouseId || selectedWarehouseId === 'all'
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
                type="button"
                onClick={() => {
                  setSelectedAisleId(null)
                  setSelectedSlotId(null)
                  setSelectedTierId(null)
                }}
                className={`shrink-0 px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                  !selectedAisleId
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
                type="button"
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
                type="button"
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
      )}

      {/* ── MAIN CONTENT AREA (Optimized for 60-120fps iOS Safari scrolling) ── */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain p-3 space-y-3 pb-24">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-2 text-slate-400">
            <RefreshCw size={28} className="animate-spin text-cyan-400" />
            <p className="text-xs">Đang tải sơ đồ kho...</p>
          </div>
        ) : isSearchActive && searchTab === 'breakdown' && breakdownReport ? (
          /* ── BẢNG THỐNG KÊ KẾ TOÁN: PHÂN BỔ TỒN KHO (KHO -> DÃY -> Ô) ── */
          <div className="space-y-3 animate-in fade-in pb-10">
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
                  const entries = Array.from(breakdownReport.grandUnitsMap.entries()).filter(
                    ([_, q]) => q > 0
                  )
                  entries.sort(([uA], [uB]) => {
                    const priority = (u: string) =>
                      u === 'Thùng' ? 1 : u === 'Kg' ? 2 : u === 'Sọt' ? 3 : 4
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
                          {Number.isInteger(qty)
                            ? qty.toLocaleString('vi-VN')
                            : Number(qty.toFixed(2)).toLocaleString('vi-VN')}
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
                          <div
                            key={u}
                            className="text-xs font-black text-amber-300 font-mono leading-tight truncate"
                          >
                            {Number.isInteger(q)
                              ? q.toLocaleString('vi-VN')
                              : Number(q.toFixed(2)).toLocaleString('vi-VN')}{' '}
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
                        >
                          <MapPin size={11} />
                          <span>Sơ đồ</span>
                        </button>
                      </div>
                    </div>

                    {isWhExpanded && (
                      <div className="p-2 space-y-2 border-t border-slate-800/70 bg-slate-950/40">
                        {whAcc.aisles.map(aisleAcc => {
                          const isAisleExpanded = expandedAisleIds.has(aisleAcc.aisle.id)
                          return (
                            <div
                              key={aisleAcc.aisle.id}
                              className="rounded-xl border border-slate-800/80 bg-[#0e182b] overflow-hidden"
                            >
                              <div className="flex items-center justify-between p-2 hover:bg-slate-800/30 transition gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleAisleExpand(aisleAcc.aisle.id)}
                                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left active:scale-[0.99] transition"
                                >
                                  <span className="text-slate-500">
                                    {isAisleExpanded ? (
                                      <ChevronDown size={14} />
                                    ) : (
                                      <ChevronRight size={14} />
                                    )}
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
                                  >
                                    <ExternalLink size={12} />
                                  </button>
                                </div>
                              </div>

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
                                            <span
                                              className={
                                                isSlotExpanded ? 'text-cyan-400' : 'text-slate-500'
                                              }
                                            >
                                              {isSlotExpanded ? (
                                                <ChevronDown size={13} />
                                              ) : (
                                                <ChevronRight size={13} />
                                              )}
                                            </span>
                                            <span
                                              className={`font-semibold truncate ${
                                                isSlotExpanded ? 'text-cyan-300' : 'text-slate-300'
                                              }`}
                                            >
                                              {slotAcc.slot.name}
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                              ({slotAcc.positionCount} vị trí
                                              {hasTiers ? ` · ${slotAcc.tiers.length} tầng` : ''})
                                            </span>
                                          </button>

                                          <div className="flex items-center gap-2 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => toggleSlotExpand(slotAcc.slot.id)}
                                              className="text-right font-mono"
                                            >
                                              <span className="font-bold text-emerald-400">
                                                {formatUnitsSummary(slotAcc.unitsMap, {
                                                  short: true,
                                                })}
                                              </span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedWarehouseId(whAcc.warehouse.id)
                                                setSelectedAisleId(aisleAcc.aisle.id)
                                                if (
                                                  isHallZone(aisleAcc.aisle) ||
                                                  slotAcc.slot.id === aisleAcc.aisle.id
                                                ) {
                                                  setSelectedSlotId(null)
                                                } else {
                                                  setSelectedSlotId(slotAcc.slot.id)
                                                }
                                                setSelectedTierId(null)
                                                setSearchTab('map')
                                              }}
                                              className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline px-1 py-0.5 active:scale-95 transition"
                                            >
                                              Xem vị trí
                                            </button>
                                          </div>
                                        </div>

                                        {isSlotExpanded && (
                                          <div className="px-2 pb-2 pt-1.5 space-y-1.5 border-t border-slate-800/70 bg-[#060b16]">
                                            {hasTiers ? (
                                              slotAcc.tiers.map(tierAcc => {
                                                const isTierExpanded =
                                                  expandedBreakdownTierIds.has(tierAcc.tier.id)

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
                                                        onClick={() =>
                                                          toggleBreakdownTierExpand(tierAcc.tier.id)
                                                        }
                                                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                                                      >
                                                        <span
                                                          className={
                                                            isTierExpanded
                                                              ? 'text-amber-400'
                                                              : 'text-slate-400'
                                                          }
                                                        >
                                                          {isTierExpanded ? (
                                                            <ChevronDown size={13} />
                                                          ) : (
                                                            <ChevronRight size={13} />
                                                          )}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-[10.5px] font-extrabold text-amber-300">
                                                          <Layers
                                                            size={11}
                                                            className="text-amber-400"
                                                          />
                                                          {tierAcc.tier.name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                          ({tierAcc.positionCount} vị trí)
                                                        </span>
                                                      </button>

                                                      <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            toggleBreakdownTierExpand(
                                                              tierAcc.tier.id
                                                            )
                                                          }
                                                          className="text-xs font-extrabold text-amber-400 font-mono"
                                                        >
                                                          {formatUnitsSummary(tierAcc.unitsMap, {
                                                            short: true,
                                                          })}
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setSelectedWarehouseId(
                                                              whAcc.warehouse.id
                                                            )
                                                            setSelectedAisleId(aisleAcc.aisle.id)
                                                            setSelectedSlotId(slotAcc.slot.id)
                                                            setSelectedTierId(tierAcc.tier.id)
                                                            setExpandedTierIds(
                                                              new Set([tierAcc.tier.id])
                                                            )
                                                            if (tierAcc.positions[0]) {
                                                              setHighlightedPosId(
                                                                tierAcc.positions[0].id
                                                              )
                                                            }
                                                            setSearchTab('map')
                                                          }}
                                                          className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/70 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition"
                                                        >
                                                          Xem tầng
                                                        </button>
                                                      </div>
                                                    </div>

                                                    {isTierExpanded && (
                                                      <div className="px-2 pb-2 pt-1.5 space-y-1 border-t border-slate-800/70 bg-[#070c17]">
                                                        {sortPositionsByDepthAndCol(
                                                          tierAcc.positions
                                                        ).map(pos => (
                                                          <button
                                                            key={pos.id}
                                                            type="button"
                                                            onClick={() =>
                                                              handlePositionPress(pos)
                                                            }
                                                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-800/80 text-xs transition"
                                                          >
                                                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                              <MapPin
                                                                size={11}
                                                                className="text-sky-400 shrink-0"
                                                              />
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
                                                                  {pos.packaging_date
                                                                    .split('-')
                                                                    .reverse()
                                                                    .slice(0, 2)
                                                                    .join('/')}
                                                                </span>
                                                              )}
                                                            </div>
                                                            <span className="font-mono font-extrabold text-emerald-400 shrink-0">
                                                              {pos.quantity || 0}{' '}
                                                              {getCleanUnitCategory(pos.unit) ===
                                                              'Thùng'
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
                                                {sortPositionsByDepthAndCol(
                                                  slotAcc.positions
                                                ).map(pos => (
                                                  <button
                                                    key={pos.id}
                                                    type="button"
                                                    onClick={() => handlePositionPress(pos)}
                                                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-800/80 text-xs transition"
                                                  >
                                                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                      <MapPin
                                                        size={11}
                                                        className="text-sky-400 shrink-0"
                                                      />
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
        ) : !selectedWarehouseId || selectedWarehouseId === 'all' ? (
          /* ── LEVEL 0: DANH SÁCH TẤT CẢ CÁC KHO ── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={14} className="text-cyan-400" />
                <span>CHỌN KHO ĐỂ XEM DÃY / KỆ:</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {visibleWarehouses.length} kho
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {visibleWarehouses.map(wh => {
                const stats = zoneStatsMap.get(wh.id) || { total: 0, occupied: 0, empty: 0 }
                const pct =
                  stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0
                const whMatchCount = zoneMatchCountMap.get(wh.id) || 0
                const breakdown = getWhBreakdown(wh.id)

                return (
                  <button
                    key={wh.id}
                    type="button"
                    onClick={() => {
                      setSelectedWarehouseId(wh.id)
                      setSelectedAisleId(null)
                      setSelectedSlotId(null)
                      setSelectedTierId(null)
                    }}
                    className={`p-3 rounded-xl bg-[#111827] border text-left transition hover:bg-slate-900 active:scale-[0.99] space-y-2 group ${
                      whMatchCount > 0
                        ? 'border-cyan-500/80 shadow-lg shadow-cyan-500/10'
                        : 'border-slate-800 hover:border-cyan-500/50'
                    }`}
                  >
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

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Tổng: <strong className="text-white font-mono">{stats.total}</strong>
                      </span>
                      <span>
                        Đã chứa:{' '}
                        <strong className="text-amber-400 font-mono">{stats.occupied}</strong>
                      </span>
                      <span>
                        Còn trống:{' '}
                        <strong className="text-emerald-400 font-mono">{stats.empty}</strong>
                      </span>
                    </div>

                    {(breakdown.rackTotal > 0 || breakdown.hallTotal > 0) && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400/90 pt-1 border-t border-slate-800/60">
                        <span>
                          Kệ: <strong className="text-slate-300 font-mono">{breakdown.rackTotal}</strong>{' '}
                          ({breakdown.rackOccupied} có hàng)
                        </span>
                        {breakdown.hallTotal > 0 && (
                          <span className="text-emerald-400 font-medium">
                            Sảnh: <strong className="font-mono">{breakdown.hallTotal}</strong> (
                            {breakdown.hallOccupied})
                          </span>
                        )}
                      </div>
                    )}

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
                type="button"
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

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-cyan-400" />
                <span>CHỌN DÃY / SẢNH ({getZoneName(selectedWarehouseId)}):</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  const firstHallInSelectedWh =
                    availableHalls.find(h => h.warehouse_id === selectedWarehouseId) ||
                    availableHalls[0] ||
                    null
                  setInitialHallForModal(firstHallInSelectedWh)
                  setShowHallLotModal(true)
                }}
                className="px-2.5 py-1 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-orange-300 text-[11px] font-black flex items-center gap-1 shrink-0 active:scale-95"
              >
                <Truck size={13} />
                <span>LOT Sảnh</span>
              </button>
            </div>

            {/* Switch Warehouse Pills */}
            {warehouses.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
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
                      type="button"
                      onClick={() => {
                        setSelectedWarehouseId(wh.id)
                        setSelectedAisleId(null)
                        setSelectedSlotId(null)
                        setSelectedTierId(null)
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition flex items-center gap-1.5 ${
                        wh.id === selectedWarehouseId
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
                const pct =
                  stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0
                const aisleMatchCount = zoneMatchCountMap.get(aisle.id) || 0
                const isHall = isHallZone(aisle)

                return (
                  <div
                    key={aisle.id}
                    onClick={() => {
                      setSelectedAisleId(aisle.id)
                      setSelectedSlotId(null)
                      setSelectedTierId(null)
                    }}
                    className={`p-3.5 rounded-2xl bg-[#111827] border text-left transition hover:bg-slate-900 active:scale-[0.99] space-y-2 group cursor-pointer ${
                      aisleMatchCount > 0
                        ? 'border-cyan-500/80 shadow-lg shadow-cyan-500/10'
                        : 'border-slate-800 hover:border-cyan-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-sm text-white group-hover:text-cyan-300 transition flex items-center gap-1.5 min-w-0 truncate">
                        {isHall ? '🏢' : '🚪'} {aisle.name}
                        {isHall && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            SẢNH
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isHall && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              const matchedHall = availableHalls.find(h => h.id === aisle.id)
                              const whObj = warehouses.find(w => w.id === selectedWarehouseId)
                              setInitialHallForModal(
                                matchedHall || {
                                  id: aisle.id,
                                  name: aisle.name,
                                  warehouse_id: whObj?.id || null,
                                  warehouse_name: whObj?.name || null,
                                  full_path: whObj
                                    ? `${whObj.name} › ${aisle.name}`
                                    : aisle.name,
                                }
                              )
                              setShowHallLotModal(true)
                            }}
                            className="px-2 py-0.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-[10px] font-black flex items-center gap-1 active:scale-95"
                          >
                            <Truck size={11} />
                            <span>Cập nhật</span>
                          </button>
                        )}
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
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Tổng: <strong className="text-white font-mono">{stats.total}</strong>
                      </span>
                      <span>
                        Đã chứa:{' '}
                        <strong className="text-amber-400 font-mono">{stats.occupied}</strong>
                      </span>
                      <span>
                        Còn trống:{' '}
                        <strong className="text-emerald-400 font-mono">{stats.empty}</strong>
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : isSelectedAisleHall ? (
          /* ── LEVEL 2-HALL: LƯỚI VỊ TRÍ TRONG SẢNH ── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
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
                    type="button"
                    onClick={() => setOnlyShowMatches(!onlyShowMatches)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                      onlyShowMatches
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
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-xs uppercase shadow-sm shrink-0">
                  SẢNH
                </span>
                <div className="min-w-0">
                  {selectedWarehouseId && selectedWarehouseId !== 'all' && (
                    <div className="text-[9px] font-bold text-amber-300/80 uppercase truncate">
                      📍 {getZoneName(selectedWarehouseId)}
                    </div>
                  )}
                  <div className="font-black text-sm text-white uppercase tracking-wide truncate">
                    {getZoneName(selectedAisleId)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const matchedHall = availableHalls.find(h => h.id === selectedAisleId)
                    const whObj = warehouses.find(w => w.id === selectedWarehouseId)
                    const hallName = getZoneName(selectedAisleId)
                    setInitialHallForModal(
                      matchedHall || {
                        id: selectedAisleId || 'hall',
                        name: hallName,
                        warehouse_id: whObj?.id || null,
                        warehouse_name: whObj?.name || null,
                        full_path: whObj ? `${whObj.name} › ${hallName}` : hallName,
                      }
                    )
                    setShowHallLotModal(true)
                  }}
                  className="px-2.5 py-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-black flex items-center gap-1 shadow-sm active:scale-95"
                >
                  <Truck size={12} />
                  <span>Cập nhật LOT</span>
                </button>

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
            </div>

            {currentPositions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Chưa có dữ liệu vị trí nào trong sảnh này.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {currentPositions.slice(0, hallVisibleLimit).map(pos => renderPositionCard(pos))}
                </div>
                {currentPositions.length > hallVisibleLimit && (
                  <button
                    type="button"
                    onClick={() => setHallVisibleLimit(prev => prev + 160)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-bold transition"
                  >
                    Xem thêm ({currentPositions.length - hallVisibleLimit} vị trí còn lại)
                  </button>
                )}
              </>
            )}
          </div>
        ) : !selectedSlotId ? (
          /* ── LEVEL 2: DANH SÁCH Ô TRONG DÃY / SẢNH ── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
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
                const pct =
                  stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0
                const slotMatchCount = zoneMatchCountMap.get(slot.id) || 0

                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => {
                      setSelectedSlotId(slot.id)
                      setSelectedTierId(null)
                    }}
                    className={`p-3.5 rounded-2xl bg-[#111827] border text-center transition hover:bg-slate-900 active:scale-[0.98] space-y-1.5 group shadow-sm flex flex-col items-center justify-between min-h-[112px] ${
                      slotMatchCount > 0
                        ? 'border-cyan-500/80 shadow-md shadow-cyan-500/10'
                        : 'border-slate-800 hover:border-emerald-500/80'
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
                      <span className="whitespace-nowrap">
                        {stats.occupied}/{stats.total} vị trí
                      </span>
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
          /* ── LEVEL 3: LƯỚI VỊ TRÍ CỤ THỂ TRONG TỪNG TẦNG CỦA Ô ── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedSlotId(null)}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
              >
                <ArrowLeft size={14} />
                <span>Quay lại Ô kệ</span>
              </button>
              <div className="flex items-center gap-2">
                {isSearchActive && (
                  <button
                    type="button"
                    onClick={() => setOnlyShowMatches(!onlyShowMatches)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                      onlyShowMatches
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
                type="button"
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
                const tierMatchCount = zoneMatchCountMap.get(tier.id) || 0
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedTierId(tier.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                      selectedTierId === tier.id
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{tier.name}</span>
                    <span className="text-[10px] opacity-80 font-mono">
                      ({stats.occupied}/{stats.total})
                    </span>
                    {isSearchActive && tierMatchCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black">
                        {tierMatchCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {currentPositions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Chưa có dữ liệu vị trí nào trong khu vực này.
              </div>
            ) : !selectedTierId ? (
              <div className="space-y-2.5">
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
                      className={`rounded-2xl bg-[#0f172a] border transition-all shadow-sm overflow-hidden ${
                        isExpanded
                          ? 'border-slate-800/90'
                          : 'border-slate-800/60 hover:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTierExpand(tier.id)}
                        className={`w-full p-3 flex items-center justify-between text-left transition select-none group ${
                          isExpanded
                            ? 'border-b border-slate-800/80 bg-slate-900/40'
                            : 'hover:bg-slate-800/30'
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

                      {isExpanded && (
                        <div className="p-3 grid grid-cols-2 gap-2 animate-in fade-in duration-150">
                          {tierPositions.map(pos => renderPositionCard(pos))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="font-black text-xs text-cyan-300 uppercase flex items-center gap-1.5">
                    <span>🏢 {getZoneName(selectedTierId)}</span>
                    <span className="text-[10px] text-slate-400 font-mono font-normal">
                      ({currentPositions.filter(p => p.lot_id).length}/{currentPositions.length} vị
                      trí có hàng)
                    </span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    {currentPositions.filter(p => !p.lot_id).length} trống
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {currentPositions.map(pos => renderPositionCard(pos))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── FLOATING BOTTOM BAR WHEN DRAFT HAS ITEMS ── */}
      {draftProposal.items.length > 0 && (
        <div className="absolute bottom-3 left-3 right-3 z-40 bg-slate-900/95 backdrop-blur-md border border-amber-500/50 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between gap-2 animate-in fade-in slide-in-from-bottom-2">
          <button
            type="button"
            onClick={() => {
              setDraftListInitialTab('DRAFT')
              setShowDraftListModal(true)
            }}
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
          >
            <span className="w-7 h-7 rounded-xl bg-amber-400 text-slate-950 font-black font-mono text-xs flex items-center justify-center shrink-0">
              {draftProposal.items.length}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-black text-white truncate">
                Phiếu nháp điều chỉnh
              </div>
              <div className="text-[10px] text-amber-300/90 truncate">
                Chạm để kiểm tra &amp; gửi Web duyệt
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setDraftListInitialTab('DRAFT')
                setShowDraftListModal(true)
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1"
            >
              <ClipboardList size={14} />
              <span>Xem</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftListInitialTab('DRAFT')
                setShowDraftListModal(true)
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black flex items-center gap-1 shadow-sm"
            >
              <Send size={13} />
              <span>Gửi duyệt</span>
            </button>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      <PositionDetailModal
        selectedPosDetail={selectedPosDetail}
        setSelectedPosDetail={setSelectedPosDetail}
        hasDraftItem={
          selectedPosDetail ? draftItemsMap.has(selectedPosDetail.id) : false
        }
        onOpenDraftForPosition={pos => setDraftModalPos(pos)}
      />

      <HallLotInputModal
        visible={showHallLotModal}
        onClose={() => setShowHallLotModal(false)}
        halls={availableHalls}
        initialHall={initialHallForModal}
      />

      <WarehouseAdjustmentDraftModal
        visible={!!draftModalPos}
        position={draftModalPos}
        zonePath={draftModalPos ? getPositionPath(draftModalPos) : ''}
        existingDraftItem={
          draftModalPos ? draftItemsMap.get(draftModalPos.id) || null : null
        }
        availablePositions={positions}
        onClose={() => setDraftModalPos(null)}
        onSaveItem={handleSaveDraftItem}
        onRemoveItem={handleRemoveDraftItem}
      />

      <WarehouseDraftListModal
        visible={showDraftListModal}
        draft={draftProposal}
        initialTab={draftListInitialTab}
        onClose={() => setShowDraftListModal(false)}
        onEditItem={item => {
          setShowDraftListModal(false)
          const foundPos = positions.find(p => p.id === item.position_id)
          if (foundPos) {
            setDraftModalPos(foundPos)
          }
        }}
        onRemoveItem={handleRemoveDraftItem}
        onClearAll={handleClearAllDraft}
        onSubmitProposal={handleSubmitDraftProposal}
      />
    </div>
  )
}
