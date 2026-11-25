import { calculateSearchScore, matchSearch, normalizeSearchString } from '@/lib/searchUtils'
import { supabase } from '@/lib/supabaseClient'
import { decodeSTT } from '@/lib/numberUtils'
import { formatMaterialZoneProvince } from '@/lib/provinces'
import { DEFAULT_STAMP_DICT } from '@/lib/stampDecoder'
import {
  saveWarehouseMapToOfflineDb,
  getWarehouseMapFromOfflineDb,
  type OfflinePendingPallet,
} from '@/lib/scanner-db'
import type { PalletItem, ProductSuggestion, ProductSuggestionItem } from './types'

export { DEFAULT_STAMP_DICT }

export async function updatePendingPalletOffline(pallet: OfflinePendingPallet): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open('chanhthu_scanner_db')
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('pending_pallets', 'readwrite')
      tx.objectStore('pending_pallets').put(pallet)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
    req.onerror = () => reject(req.error)
  })
}

// Helper function to synthesize an audio beep on scan success
export function playScanSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12) // A6
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.13)
  } catch {}
}

export function triggerHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([40, 60, 40])
    } catch {}
  }
}

export function normalizeText(text?: string | null): string {
  return normalizeSearchString(text || '', true)
}

export function matchDate(dateStr?: string | null, filterStr?: string | null): boolean {
  if (!filterStr || !filterStr.trim()) return true
  if (!dateStr || !dateStr.trim()) return false

  const dNorm = normalizeText(dateStr)
  const fNorm = normalizeText(filterStr)

  if (dNorm.includes(fNorm)) return true

  // Filter format YYYY-MM-DD -> check DD/MM/YYYY và DD-MM-YYYY
  const ymdMatch = filterStr.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch
    const mPad = m.padStart(2, '0')
    const dPad = d.padStart(2, '0')
    const dmySlash = `${dPad}/${mPad}/${y}`
    const dmyDash = `${dPad}-${mPad}-${y}`
    const ymdDash = `${y}-${mPad}-${dPad}`
    if (
      dNorm.includes(normalizeText(dmySlash)) ||
      dNorm.includes(normalizeText(dmyDash)) ||
      dNorm.includes(normalizeText(ymdDash))
    ) {
      return true
    }
  }

  // Filter format DD/MM/YYYY -> check YYYY-MM-DD
  const dmyMatch = filterStr.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    const mPad = m.padStart(2, '0')
    const dPad = d.padStart(2, '0')
    const ymdDash = `${y}-${mPad}-${dPad}`
    if (dNorm.includes(normalizeText(ymdDash))) {
      return true
    }
  }

  return false
}

export function matchProductSearch(
  cp: {
    product_name?: string | null
    sku?: string | null
    product_aliases?: string | null
    aliases?: string | null
  },
  query: string,
  catalogProducts?: ProductSuggestion[]
): boolean {
  if (!query || !query.trim()) return true
  const cleanQ = query.trim()

  const pObj = {
    name: cp.product_name,
    sku: cp.sku,
    aliases: cp.product_aliases || cp.aliases,
  }

  if (calculateSearchScore(pObj, cleanQ) > 0) return true
  if (matchSearch(pObj, cleanQ)) return true

  if (catalogProducts && catalogProducts.length > 0 && (cp.sku || cp.product_name)) {
    const matchedCatalog = catalogProducts.find(
      p =>
        (cp.sku && p.sku && p.sku.toLowerCase() === cp.sku.toLowerCase()) ||
        (cp.product_name && p.name.toLowerCase() === cp.product_name.toLowerCase())
    )
    if (matchedCatalog) {
      if (calculateSearchScore(matchedCatalog, cleanQ) > 0) return true
      if (matchSearch(matchedCatalog, cleanQ)) return true
    }
  }

  return false
}

export function getProductSuggestions(
  term: string,
  products: ProductSuggestion[],
  limit = 8
): ProductSuggestionItem[] {
  const cleanTerm = term.trim()
  if (!cleanTerm || products.length === 0) return []

  const list: ProductSuggestionItem[] = []

  for (const p of products) {
    const score = calculateSearchScore(p, cleanTerm)
    if (score > 0 || matchSearch(p, cleanTerm)) {
      let badgeText: string | undefined
      let badgeType: 'alias' | 'sku' | undefined
      let fillValue = p.name

      if (p.aliases) {
        const aliasItems = String(p.aliases)
          .split(/[,;\n]/)
          .map((a: string) => a.trim())
          .filter(Boolean)
        const found = aliasItems.find((a: string) => matchSearch(a, cleanTerm))
        if (found) {
          badgeType = 'alias'
          badgeText = `⚡ ${found}`
          fillValue = p.name
        }
      }

      if (!badgeType) {
        if (p.sku && matchSearch(p.sku, cleanTerm)) {
          badgeType = 'sku'
          badgeText = `SKU: ${p.sku}`
          fillValue = p.sku
        }
      }

      list.push({
        product: p,
        score: score > 0 ? score : 100,
        fillValue,
        displayTitle: p.name,
        displaySubtitle: [
          p.sku ? `SKU: ${p.sku}` : null,
          p.aliases ? `Gõ tắt: ${p.aliases}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        badgeType,
        badgeText,
      })
    }
  }

  return list.sort((a, b) => b.score - a.score).slice(0, limit)
}

export function buildCombinedSearchSuggestions(
  query: string,
  cloudPallets: PalletItem[],
  allProducts: ProductSuggestion[],
  limit = 8
): ProductSuggestionItem[] {
  const cleanTerm = query.trim()
  if (!cleanTerm) return []

  const sttResults: ProductSuggestionItem[] = []
  const cleanSttQ = normalizeText(cleanTerm).replace(/^(#|stt[:\s-#]*)/i, '').trim()
  const isExplicitStt = /^(#|stt[:\s-#]+)/i.test(cleanTerm)

  if (cleanSttQ) {
    const seenStts = new Set<string>()
    for (const cp of cloudPallets) {
      if (!cp.stt) continue
      const sttKey = cp.stt.trim().toUpperCase()
      if (seenStts.has(sttKey)) continue
      const normStt = normalizeText(cp.stt)
      let sttScore = 0
      if (normStt === cleanSttQ) sttScore = 5000
      else if (normStt.startsWith(cleanSttQ)) sttScore = 4000 - normStt.length
      else if (normStt.includes(cleanSttQ)) sttScore = 3000 - normStt.length

      if (sttScore > 0) {
        seenStts.add(sttKey)
        sttResults.push({
          product: {
            id: 'stt_' + cp.id,
            name: cp.product_name || 'Hàng đông lạnh',
            sku: cp.sku || '',
            aliases: cp.product_aliases || cp.aliases || null,
          },
          score: sttScore,
          fillValue: `#${cp.stt}`,
          displayTitle: cp.product_name || 'Hàng đông lạnh',
          displaySubtitle: [
            cp.location_code ? `📍 ${cp.location_code}` : null,
            cp.boxes_count ? `📦 ${cp.boxes_count} thùng` : null,
            cp.lot_code ? `LOT: ${cp.lot_code}` : null,
          ]
            .filter(Boolean)
            .join('  ·  '),
          badgeType: 'stt',
          badgeText: `STT: #${cp.stt}`,
        })
      }
    }
    sttResults.sort((a, b) => b.score - a.score)
  }

  if (isExplicitStt) {
    return sttResults.slice(0, limit)
  }

  const prodResults = getProductSuggestions(cleanTerm, allProducts, limit)
  return [...sttResults.slice(0, 5), ...prodResults.slice(0, 5)].slice(0, limit)
}

export async function ensureProductsCatalogLoaded(forceRefresh = false): Promise<ProductSuggestion[]> {
  if (!forceRefresh && typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('cached_products')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch {}
  }

  try {
    const { data } = await supabase
      .from('products')
      .select('id, name, sku, aliases, internal_code, internal_name')
      .order('name')
      .limit(1000)

    if (data && data.length > 0) {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('cached_products', JSON.stringify(data))
        } catch {}
      }
      return data as ProductSuggestion[]
    }
  } catch {}

  return []
}

export const WAREHOUSE_MAP_CACHE_KEY = 'warehouse_map_offline_cache_v8'
export const WAREHOUSE_MAP_META_KEY = 'warehouse_map_offline_meta_v1'

export function saveWarehouseMapMeta(zones: any[], positions: any[], cachedAt: string) {
  if (typeof window === 'undefined') return
  try {
    const rootWarehouses = zones.filter((z: any) => !z.parent_id)
    const warehousesCount = rootWarehouses.length || (zones.length > 0 ? 6 : 0)
    localStorage.setItem(
      WAREHOUSE_MAP_META_KEY,
      JSON.stringify({
        count: positions.length,
        warehousesCount,
        lastSyncedAt: cachedAt,
      })
    )
  } catch {
    // ignore
  }
}

export function getWarehouseMapOfflineInfo(): {
  count: number
  warehousesCount: number
  lastSyncedAt: string | null
} {
  if (typeof window === 'undefined') {
    return { count: 0, warehousesCount: 0, lastSyncedAt: null }
  }
  try {
    const metaRaw = localStorage.getItem(WAREHOUSE_MAP_META_KEY)
    if (metaRaw) {
      const meta = JSON.parse(metaRaw)
      if (meta && typeof meta.count === 'number' && meta.count > 0) {
        return {
          count: meta.count,
          warehousesCount: meta.warehousesCount || 0,
          lastSyncedAt: meta.lastSyncedAt || null,
        }
      }
    }

    const raw =
      localStorage.getItem(WAREHOUSE_MAP_CACHE_KEY) ||
      localStorage.getItem('warehouse_map_offline_cache_v7')
    if (!raw) return { count: 0, warehousesCount: 0, lastSyncedAt: null }
    const parsed = JSON.parse(raw)
    const positions = Array.isArray(parsed?.positions) ? parsed.positions : []
    const zones = Array.isArray(parsed?.zones) ? parsed.zones : []
    const rootWarehouses = zones.filter((z: any) => !z.parent_id)
    return {
      count: positions.length,
      warehousesCount: rootWarehouses.length || (zones.length > 0 ? 6 : 0),
      lastSyncedAt: parsed?.cachedAt || null,
    }
  } catch {
    return { count: 0, warehousesCount: 0, lastSyncedAt: null }
  }
}

export async function getWarehouseMapOfflineInfoAsync(): Promise<{
  count: number
  warehousesCount: number
  lastSyncedAt: string | null
}> {
  const syncInfo = getWarehouseMapOfflineInfo()
  if (syncInfo.count > 0) return syncInfo

  const idbSnap = await getWarehouseMapFromOfflineDb()
  if (idbSnap && idbSnap.positions.length > 0) {
    const rootWarehouses = idbSnap.zones.filter((z: any) => !z.parent_id)
    const warehousesCount = rootWarehouses.length || (idbSnap.zones.length > 0 ? 6 : 0)
    saveWarehouseMapMeta(idbSnap.zones, idbSnap.positions, idbSnap.cachedAt)
    return {
      count: idbSnap.positions.length,
      warehousesCount,
      lastSyncedAt: idbSnap.cachedAt || null,
    }
  }

  return syncInfo
}

export async function fetchAllPagedRows(
  buildQuery: (from: number, to: number) => any,
  pageSize = 1000
): Promise<any[]> {
  const all: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIdx = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = nextIdx++
      if (idx >= items.length) break
      results[idx] = await worker(items[idx])
    }
  })
  await Promise.all(runners)
  return results
}

export async function syncWarehouseMapOfflineWeb(
  systemCode = 'KHO_DONG_LANH'
): Promise<{
  success: boolean
  totalPositions: number
  totalWarehouses: number
  lastSyncedAt: string
  message: string
}> {
  try {
    const [rawZones, rawPositions, zpList, pendingRes] = await Promise.all([
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
          .order('zone_id', { ascending: true })
          .range(from, to)
      ),
      (supabase.from('pending_assignments') as any)
        .select('position_id, lot_stt, production_date')
        .eq('system_code', systemCode)
        .eq('status', 'pending'),
    ])

    const pendingData = pendingRes.data || []

    const zpMap = new Map<string, string[]>()
    zpList.forEach((item: any) => {
      const list = zpMap.get(item.position_id) || []
      list.push(item.zone_id)
      zpMap.set(item.position_id, list)
    })

    const occupiedLotIds = Array.from(
      new Set(rawPositions.map((p: any) => p.lot_id).filter(Boolean))
    ) as string[]
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
            const tags = Array.from(new Set(rawTags.map((t: any) => String(t).trim()))).filter(
              (t) => t && !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:')
            )
            const tagsStr = tags.join(', ')
            const allItems = l.lot_items || []
            const itemProdNames = allItems.map((it: any) => it.products?.name).filter(Boolean)
            const allProdNames = Array.from(
              new Set(
                itemProdNames.length > 0
                  ? itemProdNames
                  : [l.products?.name, l.metadata?.product_name].filter(Boolean)
              )
            ) as string[]
            const prodName =
              allProdNames.length > 0
                ? allProdNames.join(', ')
                : tagsStr
                ? `Hàng ${tagsStr}`
                : 'Hàng đông lạnh'

            const itemSkus = allItems.map((it: any) => it.products?.sku).filter(Boolean)
            const allSkus = Array.from(
              new Set(
                itemSkus.length > 0
                  ? itemSkus
                  : [l.products?.sku].filter(Boolean)
              )
            ) as string[]
            const sku =
              allSkus.length > 0
                ? allSkus.join(', ')
                : tags.length > 0
                ? tags[0]
                : '---'
            const itemAliases = allItems.map((it: any) => it.products?.aliases).filter(Boolean)
            const allAliases = Array.from(
              new Set(
                itemAliases.length > 0
                  ? itemAliases
                  : [l.products?.aliases].filter(Boolean)
              )
            ) as string[]

            const itemUnit = allItems.map((it: any) => it.unit).find(Boolean)
            const unit = itemUnit || l.metadata?.unit || l.products?.unit || 'Thùng'

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

            const rawZonesMeta = [
              ...(Array.isArray(l.metadata?.material_zones) ? l.metadata.material_zones : []),
              l.metadata?.material_zone,
              l.metadata?.region,
              l.metadata?.province,
            ].filter(Boolean)
            const formattedZones = Array.from(
              new Set(rawZonesMeta.map((z: any) => formatMaterialZoneProvince(String(z))))
            ).filter(Boolean) as string[]

            const rawPlaces = l.metadata?.production_places
            const prodPlace =
              Array.isArray(rawPlaces) && rawPlaces.length > 0
                ? rawPlaces.join(', ')
                : l.metadata?.production_place || l.metadata?.factory || null

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
              stt: decodeSTT(l.daily_seq) || l.metadata?.pallet_stt || l.code,
              product_name: prodName,
              sku,
              aliases: allAliases.length > 0 ? allAliases.join(', ') : null,
              unit,
              tags,
              packaging_date: l.packaging_date ? String(l.packaging_date).split('T')[0] : l.metadata?.packaging_date || null,
              peeling_date: peelingDate,
              raw_material_date: rawMaterialDate,
              inbound_date: l.inbound_date ? String(l.inbound_date).split('T')[0] : null,
              material_zones: formattedZones,
              material_zone: formattedZones.length > 0 ? formattedZones.join(', ') : null,
              production_code: l.production_code || l.metadata?.production_code || null,
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

    const formattedPositions = rawPositions.map((p: any) => {
      const lotInfo = p.lot_id ? lotMap.get(p.lot_id) : null
      const pendInfo = pendingMap.get(p.id)
      return {
        id: p.id,
        code: p.code,
        lot_id: p.lot_id || (pendInfo ? 'pending' : null),
        zone_ids: zpMap.get(p.id) || [],
        stt: lotInfo?.stt || pendInfo?.stt || null,
        lot_code: lotInfo?.code || (pendInfo ? 'Chờ duyệt LOT' : null),
        product_name: lotInfo?.product_name || (pendInfo ? 'Đang chờ gán LOT' : null),
        sku: lotInfo?.sku || null,
        aliases: lotInfo?.aliases || null,
        unit: lotInfo?.unit || 'Thùng',
        tags: lotInfo?.tags || [],
        packaging_date: lotInfo?.packaging_date || pendInfo?.packaging_date || null,
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
        items: lotInfo?.items ?? null,
      }
    })

    const now = new Date().toISOString()

    // 1. Lưu vào IndexedDB (dung lượng lớn, không bị giới hạn 5MB như localStorage)
    await saveWarehouseMapToOfflineDb({
      zones: rawZones,
      positions: formattedPositions,
      cachedAt: now,
      systemCode,
    })

    // 2. Lưu metadata nhẹ và cố gắng lưu vào localStorage (xóa bản v7 cũ để giải phóng bộ nhớ)
    saveWarehouseMapMeta(rawZones, formattedPositions, now)
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('warehouse_map_offline_cache')
        localStorage.removeItem('warehouse_map_offline_cache_v7')
        localStorage.setItem(
          WAREHOUSE_MAP_CACHE_KEY,
          JSON.stringify({
            zones: rawZones,
            positions: formattedPositions,
            cachedAt: now,
          })
        )
      } catch (lsErr) {
        console.warn('localStorage đã đầy, dữ liệu sơ đồ kho đã được lưu an toàn trong IndexedDB:', lsErr)
      }
    }

    const rootWarehouses = rawZones.filter((z: any) => !z.parent_id).length || (rawZones.length > 0 ? 6 : 0)
    return {
      success: true,
      totalPositions: formattedPositions.length,
      totalWarehouses: rootWarehouses,
      lastSyncedAt: now,
      message: `Đã lưu ${formattedPositions.length} vị trí (${rootWarehouses} kho) vào bộ nhớ ngoại tuyến!`,
    }
  } catch (err: any) {
    return {
      success: false,
      totalPositions: 0,
      totalWarehouses: 0,
      lastSyncedAt: new Date().toISOString(),
      message: err?.message || 'Không thể tải sơ đồ kho ngoại tuyến',
    }
  }
}
