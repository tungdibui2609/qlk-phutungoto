import { calculateSearchScore, matchSearch, normalizeSearchString } from '@/lib/searchUtils'
import { supabase } from '@/lib/supabaseClient'
import { decodeSTT } from '@/lib/numberUtils'
import { formatMaterialZoneProvince } from '@/lib/provinces'
import { DEFAULT_STAMP_DICT } from '@/lib/stampDecoder'
import type { OfflinePendingPallet } from '@/lib/scanner-db'
import type { PalletItem, ProductSuggestion, ProductSuggestionItem } from './types'

export { DEFAULT_STAMP_DICT }

export async function updatePendingPalletOffline(pallet: OfflinePendingPallet): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open('chanhthu_scanner_db', 1)
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

export const WAREHOUSE_MAP_CACHE_KEY = 'warehouse_map_offline_cache_v7'

export function getWarehouseMapOfflineInfo(): {
  count: number
  warehousesCount: number
  lastSyncedAt: string | null
} {
  if (typeof window === 'undefined') {
    return { count: 0, warehousesCount: 0, lastSyncedAt: null }
  }
  try {
    const raw = localStorage.getItem(WAREHOUSE_MAP_CACHE_KEY)
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
    const [zonesRes, posRes, zpRes, pendingRes] = await Promise.all([
      (supabase.from('zones') as any)
        .select('id, name, code, parent_id, system_type, display_order, is_hall')
        .eq('system_type', systemCode),
      (supabase.from('positions') as any)
        .select('id, code, lot_id, system_type')
        .eq('system_type', systemCode),
      (supabase.from('zone_positions') as any).select('position_id, zone_id'),
      (supabase.from('pending_assignments') as any)
        .select('position_id, lot_stt, production_date')
        .eq('system_code', systemCode)
        .eq('status', 'pending'),
    ])

    if (posRes.error) throw posRes.error

    const rawZones = zonesRes.data || []
    const rawPositions = posRes.data || []
    const zpList = zpRes.data || []
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
      const CHUNK_SIZE = 80
      const chunkPromises: Promise<any>[] = []
      for (let i = 0; i < occupiedLotIds.length; i += CHUNK_SIZE) {
        const chunk = occupiedLotIds.slice(i, i + CHUNK_SIZE)
        chunkPromises.push(
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
              l.metadata?.pallet_tag,
            ].filter(Boolean)
            const tags = Array.from(new Set(rawTags.map((t: any) => String(t).trim()))).filter(
              (t) => t && !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:')
            )
            const allItems = l.lot_items || []
            const allProdNames = Array.from(
              new Set(
                [l.products?.name, ...allItems.map((it: any) => it.products?.name)].filter(Boolean)
              )
            ) as string[]
            const prodName =
              allProdNames.length > 0
                ? allProdNames.join(', ')
                : tags.length > 0
                ? `Hàng ${tags.join(', ')}`
                : 'Hàng đông lạnh'

            const allSkus = Array.from(
              new Set([l.products?.sku, ...allItems.map((it: any) => it.products?.sku)].filter(Boolean))
            ) as string[]
            const allAliases = Array.from(
              new Set(
                [
                  l.products?.aliases,
                  ...allItems.map((it: any) => it.products?.aliases),
                ].filter(Boolean)
              )
            ) as string[]

            const rawZonesMeta = [
              l.metadata?.material_zone,
              l.metadata?.region,
              l.metadata?.province,
            ].filter(Boolean)
            const formattedZones = Array.from(
              new Set(rawZonesMeta.map((z: any) => formatMaterialZoneProvince(String(z))))
            ).filter(Boolean) as string[]

            lotMap.set(l.id, {
              code: l.code,
              stt: decodeSTT(l.daily_seq) || l.metadata?.pallet_stt || l.code,
              product_name: prodName,
              sku: allSkus.join(', ') || null,
              aliases: allAliases.join(', ') || null,
              unit: l.products?.unit || allItems[0]?.unit || 'Thùng',
              tags,
              packaging_date: l.packaging_date || l.metadata?.packaging_date || null,
              peeling_date: l.peeling_date || null,
              raw_material_date: l.raw_material_date || l.metadata?.raw_material_date || null,
              inbound_date: l.inbound_date || null,
              material_zones: formattedZones,
              material_zone: formattedZones[0] || null,
              production_code: l.production_code || null,
              batch_code: l.batch_code || null,
              production_place: l.metadata?.production_place || l.metadata?.factory || null,
              extra_info: l.notes || null,
              quantity: l.quantity || null,
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
        quantity: lotInfo?.quantity || null,
      }
    })

    const now = new Date().toISOString()
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        WAREHOUSE_MAP_CACHE_KEY,
        JSON.stringify({
          zones: rawZones,
          positions: formattedPositions,
          cachedAt: now,
        })
      )
    }

    const rootWarehouses = rawZones.filter((z: any) => !z.parent_id).length || 6
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
