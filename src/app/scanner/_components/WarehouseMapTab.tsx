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
  Filter
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { decodeSTT } from '@/lib/numberUtils'
import { groupWarehouseData } from '@/lib/warehouseUtils'
import { matchPalletSearch, calculateSearchScore, matchSearch, normalizeSearchString } from '@/lib/searchUtils'

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
  inbound_date?: string | null
  quantity?: number | null
}

// ── ISOLATED MEMOIZED SEARCH BAR (0ms Latency: typing updates only this component) ──
const WarehouseSearchBar = React.memo(function WarehouseSearchBar({
  uniqueProducts,
  searchQuery,
  onExecuteSearch,
  onClearSearch
}: {
  uniqueProducts: UniqueProductItem[]
  searchQuery: string
  onExecuteSearch: (query: string) => void
  onClearSearch: () => void
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
    if (!term) return
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
          className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-xs active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Search size={13} />
          <span>Tìm</span>
        </button>
      </div>

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
                      {item.product.totalQuantity > 0 && (
                        <span className="text-slate-300">
                          · {item.product.totalQuantity} {item.product.unit}
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

export default function WarehouseMapTab() {
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [zones, setZones] = useState<ZoneItem[]>([])
  const [positions, setPositions] = useState<PositionItem[]>([])

  // Hierarchy Navigation States: Kho -> Dãy / Sảnh -> Ô -> Tầng
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>('all')
  const [selectedAisleId, setSelectedAisleId] = useState<string | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null)
  const [onlyShowMatches, setOnlyShowMatches] = useState<boolean>(false)

  // Search state (searchQuery drives the map, while typing is fully isolated in WarehouseSearchBar)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeView, setActiveView] = useState<'map' | 'search_list'>('map')
  const [searchFilterWhId, setSearchFilterWhId] = useState<string>('all')
  const [searchFilterStatus, setSearchFilterStatus] = useState<'all' | 'occupied' | 'empty'>('all')
  const [searchPageLimit, setSearchPageLimit] = useState<number>(60)
  const [highlightedPosId, setHighlightedPosId] = useState<string | null>(null)

  // Position detail modal
  const [selectedPosDetail, setSelectedPosDetail] = useState<PositionItem | null>(null)

  // Offline support
  const [isOffline, setIsOffline] = useState<boolean>(false)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [downloadingOffline, setDownloadingOffline] = useState<boolean>(false)
  const [downloadToast, setDownloadToast] = useState<string | null>(null)

  // ── Fetch Master Data (Zones, Positions, Lots, Pending) ─────────
  const loadWarehouseMapData = useCallback(async (isSilent = false) => {
    let hasCache = false

    // 1. Initial cached fallback - display immediately to eliminate load delay
    try {
      const cachedRaw = localStorage.getItem('warehouse_map_offline_cache')
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
          .select('id, name, parent_id, system_type')
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
        const CHUNK_SIZE = 100
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
                inbound_date,
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
              const tags = (l.lot_tags || []).map((t: any) => t.tag).filter(Boolean)
              const tagsStr = tags.join(', ')

              const allItems = l.lot_items || []
              const allProdNames = [
                l.products?.name,
                ...allItems.map((it: any) => it.products?.name)
              ].filter(Boolean)
              const prodName = allProdNames.length > 0
                ? allProdNames.join(', ')
                : (tagsStr ? `Hàng ${tagsStr}` : 'Hàng đông lạnh')

              const allSkus = [
                l.products?.sku,
                ...allItems.map((it: any) => it.products?.sku)
              ].filter(Boolean)
              const sku = allSkus.length > 0 ? allSkus.join(', ') : (tags.length > 0 ? tags[0] : '---')

              const allAliases = [
                l.products?.aliases,
                ...allItems.map((it: any) => it.products?.aliases)
              ].filter(Boolean)
              const aliases = allAliases.length > 0 ? allAliases.join(', ') : null

              const unit =
                l.products?.unit ||
                l.lot_items?.[0]?.unit ||
                'Thùng'

              lotMap.set(l.id, {
                code: l.code,
                stt: l.daily_seq ? decodeSTT(l.daily_seq) : null,
                product_name: prodName,
                sku,
                aliases,
                unit,
                tags,
                packaging_date: l.packaging_date ? String(l.packaging_date).split('T')[0] : null,
                inbound_date: l.inbound_date ? String(l.inbound_date).split('T')[0] : null,
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
          inbound_date: lotInfo?.inbound_date || null,
          quantity: lotInfo?.quantity || null
        }
      })

      setPositions(formattedPositions)

      // Save snapshot to local storage for offline use
      try {
        const now = new Date().toISOString()
        const snapshot = {
          zones: rawZones,
          positions: formattedPositions,
          cachedAt: now
        }
        localStorage.setItem('warehouse_map_offline_cache', JSON.stringify(snapshot))
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
        const cachedRaw = localStorage.getItem('warehouse_map_offline_cache')
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw)
          if (cached && cached.zones) {
            setZones(cached.zones)
            setPositions(cached.positions || [])
            setCachedAt(cached.cachedAt || null)
            setIsOffline(true)
          }
        }
      } catch {}
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedWarehouseId])

  const handleDownloadOffline = async () => {
    setDownloadingOffline(true)
    try {
      await loadWarehouseMapData(true)
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
    [...list].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
    )

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

  // Thực hiện tìm kiếm (chỉ cập nhật map khi người dùng chọn gợi ý hoặc ấn Tìm)
  const handleExecuteSearch = useCallback((term: string) => {
    const q = term.trim()
    if (!q) return
    setSearchQuery(q)
    setActiveView('search_list')
    setSearchPageLimit(60)
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    setActiveView('map')
    setHighlightedPosId(null)
  }, [])

  // ── Search & Filter Logic (High Performance with Pre-Scoring) ──
  const isSearchActive = !!searchQuery.trim()

  const matchingPositions = useMemo(() => {
    const q = searchQuery.trim()
    if (!q || q.length < 1) return []

    // Pre-calculate score only for matched positions (eliminates ~50,000 repeated calculations in sort)
    const matched: { pos: PositionItem; score: number }[] = []
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]
      if (matchPalletSearch(p, q)) {
        const score = calculateSearchScore(p, q, {
          name: p.product_name,
          code: p.code,
          lot_code: p.lot_code,
          aliases: p.aliases
        })
        matched.push({ pos: p, score })
      }
    }

    matched.sort((a, b) => b.score - a.score)
    return matched.map(m => m.pos)
  }, [searchQuery, positions])

  const matchingPosIds = useMemo(() => {
    return new Set(matchingPositions.map(p => p.id))
  }, [matchingPositions])

  const searchResults = useMemo(() => {
    return matchingPositions.slice(0, 50)
  }, [matchingPositions])

  // Filtered results for the dedicated Search Results View
  const filteredSearchResults = useMemo(() => {
    let list = matchingPositions
    if (searchFilterWhId !== 'all') {
      const descIds = getDescendantZoneIds(searchFilterWhId)
      list = list.filter(p => p.zone_ids.some(zid => descIds.has(zid)))
    }
    if (searchFilterStatus === 'occupied') {
      list = list.filter(p => !!p.lot_id)
    } else if (searchFilterStatus === 'empty') {
      list = list.filter(p => !p.lot_id)
    }
    return list
  }, [matchingPositions, searchFilterWhId, searchFilterStatus, getDescendantZoneIds])

  const searchStats = useMemo(() => {
    let occupied = 0
    let empty = 0
    matchingPositions.forEach(p => {
      if (p.lot_id) occupied++
      else empty++
    })
    return { total: matchingPositions.length, occupied, empty }
  }, [matchingPositions])

  // Fast count matches per zone (only loops over matching positions, NOT all positions)
  const zoneMatchCountMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!isSearchActive || activeZones.length === 0 || matchingPositions.length === 0) return map

    activeZones.forEach(z => {
      const descSet = zoneDescendantsMap.get(z.id)
      if (!descSet) return
      let matchCount = 0
      for (let i = 0; i < matchingPositions.length; i++) {
        const p = matchingPositions[i]
        if (p.zone_ids.some(zid => descSet.has(zid))) {
          matchCount++
        }
      }
      if (matchCount > 0) map.set(z.id, matchCount)
    })
    return map
  }, [isSearchActive, activeZones, matchingPositions, zoneDescendantsMap])

  // 1. Warehouses (Level 1: parent_id is null)
  const warehouses = useMemo(
    () => sortZones(activeZones.filter(z => !z.parent_id)),
    [activeZones]
  )

  // 2. Aisles / Halls (Level 2: parent_id === selectedWarehouseId or all)
  const aisles = useMemo(() => {
    let list: ZoneItem[] = []
    if (!selectedWarehouseId || selectedWarehouseId === 'all') {
      const whIds = new Set(warehouses.map(w => w.id))
      list = activeZones.filter(z => z.parent_id && whIds.has(z.parent_id))
    } else {
      list = activeZones.filter(z => z.parent_id === selectedWarehouseId)
    }

    if (isSearchActive) {
      return [...list].sort((a, b) => {
        const countA = zoneMatchCountMap.get(a.id) || 0
        const countB = zoneMatchCountMap.get(b.id) || 0
        if (countB !== countA) return countB - countA
        return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
      })
    }
    return sortZones(list)
  }, [activeZones, selectedWarehouseId, warehouses, isSearchActive, zoneMatchCountMap])

  // 3. Slots (Level 3: parent_id === selectedAisleId) -> Ô GỘP: Ô 01, Ô 02...
  const slots = useMemo(() => {
    if (!selectedAisleId) return []
    const list = activeZones.filter(z => z.parent_id === selectedAisleId)
    if (isSearchActive) {
      return [...list].sort((a, b) => {
        const countA = zoneMatchCountMap.get(a.id) || 0
        const countB = zoneMatchCountMap.get(b.id) || 0
        if (countB !== countA) return countB - countA
        return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
      })
    }
    return sortZones(list)
  }, [activeZones, selectedAisleId, isSearchActive, zoneMatchCountMap])

  // 4. Tiers (Level 4: parent_id === selectedSlotId) -> Tầng của Ô gộp
  // Sắp xếp tầng từ trên xuống dưới (Tầng 5 -> Tầng 1) để chuẩn kệ kho thực tế
  const tiers = useMemo(() => {
    if (!selectedSlotId) return []
    const list = activeZones.filter(z => z.parent_id === selectedSlotId)
    return [...list].sort((a, b) =>
      (b.name || '').localeCompare(a.name || '', undefined, { numeric: true })
    )
  }, [activeZones, selectedSlotId])

  // ── Stats Calculator (Total, Occupied, Empty) per Zone (O(1) Set Lookups) ──
  const zoneStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { total: number; occupied: number; empty: number }
    >()
    if (activeZones.length === 0 || positions.length === 0) return map

    activeZones.forEach(z => {
      const descSet = zoneDescendantsMap.get(z.id)
      let total = 0
      let occupied = 0

      if (descSet) {
        for (let i = 0; i < positions.length; i++) {
          const p = positions[i]
          if (p.zone_ids.some(zid => descSet.has(zid))) {
            total++
            if (p.lot_id) occupied++
          }
        }
      }

      map.set(z.id, {
        total,
        occupied,
        empty: Math.max(0, total - occupied)
      })
    })

    return map
  }, [activeZones, positions, zoneDescendantsMap])

  // ── Positions in Current View (Slot / Tier) ────────────────────
  const currentPositions = useMemo(() => {
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
  }, [selectedSlotId, selectedTierId, positions, getDescendantZoneIds, onlyShowMatches, isSearchActive, matchingPosIds])

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
    setActiveView('map')
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
            onClick={() => loadWarehouseMapData(true)}
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
            onClick={() => loadWarehouseMapData(true)}
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
      />

      {/* ── SEARCH VIEW TABS: DANH SÁCH KẾT QUẢ vs XEM TRÊN SƠ ĐỒ ── */}
      {isSearchActive && (
        <div className="bg-[#0b1324] border-b border-slate-800 px-3 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveView('search_list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeView === 'search_list'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List size={13} />
              <span>Danh sách kết quả ({matchingPositions.length})</span>
            </button>
            <button
              onClick={() => setActiveView('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeView === 'map'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapPin size={13} />
              <span>Xem trên sơ đồ kho</span>
            </button>
          </div>

          <button
            onClick={handleClearSearch}
            className="text-[11px] font-bold text-slate-400 hover:text-rose-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X size={13} />
            <span className="hidden sm:inline">Xóa tìm kiếm</span>
          </button>
        </div>
      )}

      {/* ── BREADCRUMB NAVIGATION (Kho > Dãy > Ô > Tầng) ─────────── */}
      {activeView === 'map' && (
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
            <span>{(!selectedWarehouseId || selectedWarehouseId === 'all') ? 'Tất cả Kho' : getZoneName(selectedWarehouseId)}</span>
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
      )}

      {/* ── MAIN CONTENT AREA ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-2 text-slate-400">
            <RefreshCw size={28} className="animate-spin text-cyan-400" />
            <p className="text-xs">Đang tải sơ đồ kho...</p>
          </div>
        ) : isSearchActive && activeView === 'search_list' ? (
          /* ── GIAO DIỆN HIỂN THỊ KẾT QUẢ TÌM KIẾM DÀNH RIÊNG ──────── */
          <div className="space-y-3">
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Search size={14} className="text-cyan-400" />
                  <span>Kết quả tìm kiếm cho &quot;{searchQuery}&quot;</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Tìm thấy <strong className="text-cyan-300">{filteredSearchResults.length}</strong> vị trí ({searchStats.occupied} có hàng, {searchStats.empty} trống)
                </p>
              </div>
              <button
                onClick={() => setActiveView('map')}
                className="px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition flex items-center gap-1 active:scale-95"
              >
                <MapPin size={13} />
                <span>Xem trên sơ đồ</span>
              </button>
            </div>

            {/* Warehouse Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                onClick={() => setSearchFilterWhId('all')}
                className={`shrink-0 px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                  searchFilterWhId === 'all'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>Tất cả kho</span>
                <span className="px-1 py-0.2 rounded text-[10px] bg-black/20 font-mono">
                  {matchingPositions.length}
                </span>
              </button>

              {warehouses.map(wh => {
                const matchCount = zoneMatchCountMap.get(wh.id) || 0
                if (matchCount === 0) return null
                return (
                  <button
                    key={wh.id}
                    onClick={() => setSearchFilterWhId(wh.id)}
                    className={`shrink-0 px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                      searchFilterWhId === wh.id
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{wh.name}</span>
                    <span className="px-1 py-0.2 rounded text-[10px] bg-black/20 font-mono">
                      {matchCount}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Status Filter Pills: All, Occupied, Empty */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setSearchFilterStatus('all')}
                className={`px-2.5 py-1 rounded-md font-bold transition text-[11px] ${
                  searchFilterStatus === 'all'
                    ? 'bg-slate-200 text-slate-900'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                Tất cả ({matchingPositions.length})
              </button>
              <button
                onClick={() => setSearchFilterStatus('occupied')}
                className={`px-2.5 py-1 rounded-md font-bold transition text-[11px] ${
                  searchFilterStatus === 'occupied'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-slate-900 text-amber-400/80 border border-slate-800 hover:text-amber-300'
                }`}
              >
                Có hàng ({searchStats.occupied})
              </button>
              <button
                onClick={() => setSearchFilterStatus('empty')}
                className={`px-2.5 py-1 rounded-md font-bold transition text-[11px] ${
                  searchFilterStatus === 'empty'
                    ? 'bg-emerald-500 text-slate-950 font-black'
                    : 'bg-slate-900 text-emerald-400/80 border border-slate-800 hover:text-emerald-300'
                }`}
              >
                Trống ({searchStats.empty})
              </button>
            </div>

            {/* Results Cards List */}
            {filteredSearchResults.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs space-y-2">
                <p>Không có vị trí nào thỏa mãn bộ lọc hiện tại.</p>
                <button
                  onClick={() => {
                    setSearchFilterWhId('all')
                    setSearchFilterStatus('all')
                  }}
                  className="text-cyan-400 underline font-bold"
                >
                  Đặt lại bộ lọc
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredSearchResults.slice(0, searchPageLimit).map(p => {
                  const isOccupied = !!p.lot_id
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-2xl border transition space-y-2.5 ${
                        isOccupied
                          ? 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/40 shadow-sm'
                          : 'bg-slate-950/60 border-slate-850 border-dashed hover:border-emerald-500/40'
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-sm text-cyan-300">
                            📍 {p.code}
                          </span>
                          {p.stt ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-black text-xs">
                              STT: #{p.stt}
                            </span>
                          ) : isOccupied ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[10px]">
                              CÓ HÀNG
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                              VỊ TRÍ TRỐNG
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono bg-slate-800/80 px-2 py-0.5 rounded-md">
                          {getPositionPath(p).split(' · ')[0] || ''}
                        </span>
                      </div>

                      {/* Location Path */}
                      <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1 flex-wrap">
                        <MapPin size={12} className="text-cyan-400 shrink-0" />
                        <span>{getPositionPath(p)}</span>
                      </div>

                      {/* Product & Lot Information */}
                      {isOccupied && (
                        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-white leading-snug">
                              {p.product_name || 'Hàng đông lạnh'}
                            </p>
                            {p.aliases && (
                              <span className="shrink-0 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
                                ⚡ {p.aliases}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-850 text-[10px]">
                            <div>
                              <span className="text-slate-500 block">Mã LOT:</span>
                              <span className="font-mono font-bold text-amber-300">{p.lot_code || '---'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Số lượng:</span>
                              <span className="font-mono font-bold text-slate-200">
                                {p.quantity ? `${p.quantity} Thùng` : '---'}
                              </span>
                            </div>
                            {(p.packaging_date || p.inbound_date) && (
                              <div className="col-span-2 sm:col-span-1">
                                <span className="text-slate-500 block">Ngày nhập/đóng:</span>
                                <span className="text-slate-300">
                                  {p.packaging_date || p.inbound_date || '---'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleJumpToMap(p)}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-900/30 active:scale-98 transition flex items-center justify-center gap-1.5"
                        >
                          <MapPin size={13} />
                          <span>Xem vị trí trên sơ đồ</span>
                        </button>

                        <button
                          onClick={() => setSelectedPosDetail(p)}
                          className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 active:scale-98 transition flex items-center gap-1"
                        >
                          <Info size={13} />
                          <span>Chi tiết</span>
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Load More Button */}
                {filteredSearchResults.length > searchPageLimit && (
                  <button
                    onClick={() => setSearchPageLimit(prev => prev + 60)}
                    className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-cyan-400 font-bold text-xs border border-slate-700/80 transition active:scale-98"
                  >
                    Xem thêm 60 vị trí tiếp theo (còn {filteredSearchResults.length - searchPageLimit} vị trí)
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── XEM TRÊN SƠ ĐỒ KHO ──────────────────────────────────── */
          <>
            {isSearchActive && (
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs animate-in fade-in">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span className="truncate">Đang xem sơ đồ cho: <strong className="text-white">&quot;{searchQuery}&quot;</strong> ({matchingPositions.length} vị trí)</span>
                </div>
                <button
                  onClick={() => setActiveView('search_list')}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1 active:scale-95 shrink-0"
                >
                  <List size={13} />
                  <span>Danh sách ({matchingPositions.length})</span>
                </button>
              </div>
            )}

            {!selectedAisleId ? (
          /* ── LEVEL 1: DANH SÁCH DÃY / SẢNH TRONG KHO ĐANG CHỌN ────── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-cyan-400" />
                <span>
                  CHỌN DÃY / SẢNH {(!selectedWarehouseId || selectedWarehouseId === 'all') ? '(TẤT CẢ KHO)' : `(KHO ${getZoneName(selectedWarehouseId)})`}:
                </span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {aisles.length} phân khu
              </span>
            </div>

            {/* Switch Warehouse Pills with 'Tất cả Kho' option */}
            {warehouses.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => {
                    setSelectedWarehouseId('all')
                    setSelectedAisleId(null)
                    setSelectedSlotId(null)
                    setSelectedTierId(null)
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition flex items-center gap-1.5 ${
                    (!selectedWarehouseId || selectedWarehouseId === 'all')
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/30'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers size={13} />
                  <span>TẤT CẢ KHO</span>
                  {isSearchActive && matchingPositions.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                      {matchingPositions.length}
                    </span>
                  )}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {aisles.map(aisle => {
                const stats = zoneStatsMap.get(aisle.id) || { total: 0, occupied: 0, empty: 0 }
                const pct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0
                const aisleWh = warehouses.find(w => w.id === aisle.parent_id)
                const aisleMatchCount = zoneMatchCountMap.get(aisle.id) || 0

                return (
                  <button
                    key={aisle.id}
                    onClick={() => {
                      if (aisle.parent_id) setSelectedWarehouseId(aisle.parent_id)
                      setSelectedAisleId(aisle.id)
                      setSelectedSlotId(null)
                      setSelectedTierId(null)
                    }}
                    className={`p-3.5 rounded-2xl bg-[#111827] border text-left transition hover:bg-slate-900 active:scale-[0.99] space-y-2 group ${
                      aisleMatchCount > 0 ? 'border-cyan-500/80 shadow-lg shadow-cyan-500/10' : 'border-slate-800 hover:border-cyan-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(!selectedWarehouseId || selectedWarehouseId === 'all') && aisleWh && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold text-[10px]">
                            {aisleWh.name}
                          </span>
                        )}
                        <span className="font-black text-sm text-white group-hover:text-cyan-300 transition">
                          🚪 {aisle.name}
                        </span>
                      </div>
                      {isSearchActive && aisleMatchCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black animate-pulse">
                          🔥 {aisleMatchCount} khớp
                        </span>
                      ) : (
                        <span className="text-xs text-cyan-400 font-bold flex items-center gap-0.5">
                          Xem Ô →
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

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
                    className={`p-3.5 rounded-2xl bg-[#111827] border text-center transition hover:bg-slate-900 active:scale-[0.98] space-y-1.5 group shadow-sm ${
                      slotMatchCount > 0 ? 'border-cyan-500/80 shadow-md shadow-cyan-500/10' : 'border-slate-700/80 hover:border-emerald-500/80'
                    }`}
                  >
                    <div className="font-black text-sm uppercase text-white group-hover:text-emerald-300 transition tracking-wide flex items-center justify-center gap-1.5">
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

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-0.5">
                      <span>{stats.occupied}/{stats.total} vị trí</span>
                      <span>{pct}%</span>
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
                    onClick={() => setSelectedTierId(tier.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                      selectedTierId === tier.id
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
              /* When "Tất cả các tầng": Render as clean vertical shelves (Tầng 5 -> Tầng 1) */
              <div className="space-y-3.5">
                {tiers.map(tier => {
                  let tierPositions = tierPositionsMap.get(tier.id) || []
                  if (onlyShowMatches && isSearchActive) {
                    tierPositions = tierPositions.filter(p => matchingPosIds.has(p.id))
                  }
                  const stats = zoneStatsMap.get(tier.id) || { total: 0, occupied: 0, empty: 0 }
                  if (tierPositions.length === 0) return null

                  return (
                    <div
                      key={tier.id}
                      className="p-3 rounded-2xl bg-[#0f172a] border border-slate-800/90 space-y-2.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          <span className="font-black text-xs text-white uppercase tracking-wider">
                            {tier.name}
                          </span>
                          <span className="text-[10px] text-cyan-300 font-mono">
                            ({stats.occupied}/{stats.total} vị trí có hàng)
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-400 font-mono">
                          {stats.empty} trống
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                        {tierPositions.map(pos => {
                          const isOccupied = !!pos.lot_id
                          const isHighlighted = pos.id === highlightedPosId
                          const isMatched = matchingPosIds.has(pos.id)

                          return (
                            <button
                              key={pos.id}
                              onClick={() => setSelectedPosDetail(pos)}
                              className={`p-2.5 rounded-xl border text-left transition relative active:scale-[0.98] flex flex-col justify-between min-h-[74px] ${
                                isHighlighted
                                  ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/50 shadow-lg'
                                  : isMatched
                                  ? 'border-amber-400/90 ring-1 ring-amber-400/50 bg-gradient-to-b from-amber-950/50 to-[#131d33] shadow-md shadow-amber-500/20'
                                  : isOccupied
                                  ? 'bg-[#131d33] border-cyan-500/50 hover:border-cyan-400'
                                  : 'bg-slate-900/60 border-slate-700/80 hover:border-emerald-500/60'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 w-full">
                                <span className="font-mono font-bold text-[11px] text-slate-200 truncate" title={pos.code}>
                                  {pos.code}
                                </span>
                                {isMatched && (
                                  <span className="shrink-0 px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[8px] animate-pulse">
                                    ⭐ Khớp
                                  </span>
                                )}
                                {isOccupied ? (
                                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-black text-[9px] shadow-xs">
                                    #{pos.stt || 'LOT'}
                                  </span>
                                ) : (
                                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[8px] font-bold">
                                    TRỐNG
                                  </span>
                                )}
                              </div>

                              {isOccupied ? (
                                <div className="space-y-0.5 w-full mt-1">
                                  <p className="font-bold text-[11px] text-white truncate leading-tight" title={pos.product_name || ''}>
                                    {pos.product_name || 'Hàng đông lạnh'}
                                  </p>
                                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono pt-0.5">
                                    <span className="truncate max-w-[85px]">LOT: {pos.lot_code || '---'}</span>
                                    {pos.quantity ? <span className="text-amber-300 font-bold shrink-0">{pos.quantity} th</span> : null}
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

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {currentPositions.map(pos => {
                    const isOccupied = !!pos.lot_id
                    const isHighlighted = pos.id === highlightedPosId
                    const isMatched = matchingPosIds.has(pos.id)

                    return (
                      <button
                        key={pos.id}
                        onClick={() => setSelectedPosDetail(pos)}
                        className={`p-2.5 rounded-xl border text-left transition relative active:scale-[0.98] flex flex-col justify-between min-h-[74px] ${
                          isHighlighted
                            ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/50 shadow-lg'
                            : isMatched
                            ? 'border-amber-400/90 ring-1 ring-amber-400/50 bg-gradient-to-b from-amber-950/50 to-[#131d33] shadow-md shadow-amber-500/20'
                            : isOccupied
                            ? 'bg-[#131d33] border-cyan-500/50 hover:border-cyan-400'
                            : 'bg-slate-900/60 border-slate-700/80 hover:border-emerald-500/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span className="font-mono font-bold text-[11px] text-slate-200 truncate" title={pos.code}>
                            {pos.code}
                          </span>
                          {isMatched && (
                            <span className="shrink-0 px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[8px] animate-pulse">
                              ⭐ Khớp
                            </span>
                          )}
                          {isOccupied ? (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-black text-[9px] shadow-xs">
                              #{pos.stt || 'LOT'}
                            </span>
                          ) : (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[8px] font-bold">
                              TRỐNG
                            </span>
                          )}
                        </div>

                        {isOccupied ? (
                          <div className="space-y-0.5 w-full mt-1">
                            <p className="font-bold text-[11px] text-white truncate leading-tight" title={pos.product_name || ''}>
                              {pos.product_name || 'Hàng đông lạnh'}
                            </p>
                            <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono pt-0.5">
                              <span className="truncate max-w-[85px]">LOT: {pos.lot_code || '---'}</span>
                              {pos.quantity ? <span className="text-amber-300 font-bold shrink-0">{pos.quantity} th</span> : null}
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
      </>
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
                    <span className="text-slate-500 block text-[10px]">NGÀY ĐÓNG GÓI (NSX):</span>
                    <strong className="text-amber-400 font-mono">
                      {selectedPosDetail.packaging_date || '---'}
                    </strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[10px]">NGÀY NHẬP KHO:</span>
                    <strong className="text-slate-300 font-mono">
                      {selectedPosDetail.inbound_date || '---'}
                    </strong>
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
