import { SupabaseClient } from '@supabase/supabase-js'
import { startOfDay, endOfDay, parseISO } from 'date-fns'
import { canonicalizeUnit } from './unitConversion'
import { decodeSTT } from './numberUtils'

export type FluctuationCategory =
    | 'create'
    | 'adjust_up'
    | 'adjust_down'
    | 'adjust_mixed'
    | 'export'
    | 'delete'
    | 'position_assign'
    | 'position_unassign'
    | 'position_replace'
    | 'edit_info'

export interface ProductDelta {
    productId: string
    sku: string
    name: string
    unit: string
    oldQty: number
    newQty: number
    deltaQty: number
}

export interface FluctuationPerformer {
    id: string
    name: string
    email: string
}

export interface FluctuationEvent {
    id: string
    timestamp: string
    sortTime: number
    category: FluctuationCategory
    lotId: string
    lotCode: string
    dailySeq: number | null
    positions: string[]
    performedBy: FluctuationPerformer | null
    title: string
    description: string
    customer?: string | null
    deltas: ProductDelta[]
    /** Thông tin bổ sung cho thao tác vị trí */
    positionDetail?: {
        positionCode: string
        oldLotId?: string | null
        oldLotCode?: string | null
        newLotId?: string | null
        newLotCode?: string | null
    }
}

export interface ProductFluctuationSummary {
    key: string
    productId: string
    sku: string
    name: string
    unit: string
    createdQty: number
    adjustedUpQty: number
    adjustedDownQty: number
    exportedQty: number
    deletedQty: number
    netDelta: number
    eventCount: number
}

export interface DailyFluctuationResult {
    events: FluctuationEvent[]
    productSummaries: ProductFluctuationSummary[]
    performers: FluctuationPerformer[]
}

type ProductMeta = { id: string; name: string; sku: string; unit: string }
type LotMeta = { id: string; code: string; daily_seq?: number | null; positions?: Array<{ id: string; code: string }> }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function extractItemsMap(
    data: any,
    productMap: Map<string, ProductMeta>
): Map<string, { productId: string; sku: string; name: string; unit: string; qty: number }> {
    const map = new Map<string, { productId: string; sku: string; name: string; unit: string; qty: number }>()
    if (!data) return map

    const items = Array.isArray(data.lot_items) ? data.lot_items : []
    if (items.length > 0) {
        for (const item of items) {
            const pid = item.product_id || item.products?.id || data.product_id
            if (!pid) continue
            const pMeta = productMap.get(pid)
            const unit = item.unit || item.products?.unit || pMeta?.unit || 'Đơn vị'
            const sku = item.products?.sku || pMeta?.sku || '-'
            const name = item.products?.name || pMeta?.name || 'Sản phẩm'
            const qty = Number(item.quantity) || 0
            const key = `${pid}_${canonicalizeUnit(unit)}`
            const existing = map.get(key)
            if (existing) {
                existing.qty += qty
            } else {
                map.set(key, { productId: pid, sku, name, unit, qty })
            }
        }
        return map
    }

    // Fallback: legacy lot without lot_items
    const pid = data.product_id
    const qty = Number(data.quantity) || 0
    if (pid && qty !== 0) {
        const pMeta = productMap.get(pid)
        const unit = data.products?.unit || pMeta?.unit || 'Đơn vị'
        const sku = data.products?.sku || pMeta?.sku || '-'
        const name = data.products?.name || pMeta?.name || 'Sản phẩm'
        const key = `${pid}_${canonicalizeUnit(unit)}`
        map.set(key, { productId: pid, sku, name, unit, qty })
    }
    return map
}

export function buildProductSummaries(events: FluctuationEvent[]): ProductFluctuationSummary[] {
    const summaryMap = new Map<string, ProductFluctuationSummary>()

    for (const ev of events) {
        if (!ev.deltas || ev.deltas.length === 0) continue

        for (const d of ev.deltas) {
            const key = `${d.productId}_${canonicalizeUnit(d.unit)}`
            let entry = summaryMap.get(key)
            if (!entry) {
                entry = {
                    key,
                    productId: d.productId,
                    sku: d.sku,
                    name: d.name,
                    unit: d.unit,
                    createdQty: 0,
                    adjustedUpQty: 0,
                    adjustedDownQty: 0,
                    exportedQty: 0,
                    deletedQty: 0,
                    netDelta: 0,
                    eventCount: 0
                }
                summaryMap.set(key, entry)
            }

            if (entry.sku === '-' && d.sku !== '-') entry.sku = d.sku
            if (entry.name === 'Sản phẩm' && d.name !== 'Sản phẩm') entry.name = d.name

            if (ev.category === 'create') {
                entry.createdQty += Math.max(0, d.deltaQty)
            } else if (ev.category === 'export') {
                entry.exportedQty += Math.abs(d.deltaQty)
            } else if (ev.category === 'delete') {
                entry.deletedQty += Math.abs(d.deltaQty)
            } else if (d.deltaQty > 0) {
                entry.adjustedUpQty += d.deltaQty
            } else if (d.deltaQty < 0) {
                entry.adjustedDownQty += Math.abs(d.deltaQty)
            }

            entry.netDelta = Number(
                (entry.createdQty + entry.adjustedUpQty - entry.adjustedDownQty - entry.exportedQty - entry.deletedQty).toFixed(6)
            )
            entry.eventCount += 1
        }
    }

    return Array.from(summaryMap.values()).sort((a, b) => {
        const absDiff = Math.abs(b.netDelta) - Math.abs(a.netDelta)
        if (absDiff !== 0) return absDiff
        return b.eventCount - a.eventCount
    })
}

export async function fetchDailyFluctuation(params: {
    supabase: SupabaseClient<any>
    systemCode: string
    dateFrom: string
    dateTo: string
}): Promise<DailyFluctuationResult> {
    const { supabase, systemCode, dateFrom, dateTo } = params
    const fromIso = startOfDay(parseISO(dateFrom)).toISOString()
    const toIso = endOfDay(parseISO(dateTo)).toISOString()
    const fromMs = new Date(fromIso).getTime()
    const toMs = new Date(toIso).getTime()

    // 1. Fetch audit_logs for lots & positions in the date range
    const { data: rawLogs, error: logsError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('system_code', systemCode)
        .in('table_name', ['lots', 'positions'])
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false })
        .limit(2000)

    if (logsError) throw logsError
    const logs = rawLogs || []

    // 2. Fetch lots of this system (to capture exports inside metadata.system_history.exports & current positions/codes)
    const { data: systemLots, error: lotsError } = await supabase
        .from('lots')
        .select(`
            id,
            code,
            daily_seq,
            product_id,
            quantity,
            status,
            metadata,
            products (id, name, sku, unit),
            positions!positions_lot_id_fkey (id, code),
            lot_items (
                id,
                product_id,
                quantity,
                unit,
                products (id, name, sku, unit)
            )
        `)
        .eq('system_code', systemCode)
        .order('created_at', { ascending: false })
        .limit(3000)

    if (lotsError) throw lotsError

    // Build lookup maps
    const lotMap = new Map<string, LotMeta>()
    const productMap = new Map<string, ProductMeta>()

    for (const l of systemLots || []) {
        lotMap.set(l.id, {
            id: l.id,
            code: l.code,
            daily_seq: l.daily_seq,
            positions: l.positions || []
        })
        const lotProd = Array.isArray(l.products) ? l.products[0] : l.products
        if (lotProd?.id) {
            productMap.set(lotProd.id, lotProd)
        }
        for (const item of l.lot_items || []) {
            const itemProd = Array.isArray(item.products) ? item.products[0] : item.products
            if (itemProd?.id) {
                productMap.set(itemProd.id, itemProd)
            }
        }
    }

    // Collect missing IDs from audit_logs (deleted lots, position ids, user ids, product ids)
    const userIds = new Set<string>()
    const posIds = new Set<string>()
    const missingProductIds = new Set<string>()
    const missingLotIds = new Set<string>()

    for (const log of logs) {
        if (log.changed_by && UUID_REGEX.test(log.changed_by)) {
            userIds.add(log.changed_by)
        }
        if (log.table_name === 'positions') {
            if (log.record_id && UUID_REGEX.test(log.record_id)) {
                posIds.add(log.record_id)
            }
            const oldLotId = log.old_data?.lot_id
            const newLotId = log.new_data?.lot_id
            if (oldLotId && UUID_REGEX.test(oldLotId) && !lotMap.has(oldLotId)) {
                missingLotIds.add(oldLotId)
            }
            if (newLotId && UUID_REGEX.test(newLotId) && !lotMap.has(newLotId)) {
                missingLotIds.add(newLotId)
            }
        }
        if (log.table_name === 'lots') {
            for (const snap of [log.old_data, log.new_data]) {
                if (!snap) continue
                if (snap.id && snap.code && !lotMap.has(snap.id)) {
                    lotMap.set(snap.id, {
                        id: snap.id,
                        code: snap.code,
                        daily_seq: snap.daily_seq,
                        positions: snap.positions || []
                    })
                }
                if (snap.product_id && !productMap.has(snap.product_id)) {
                    if (snap.products?.name) {
                        productMap.set(snap.product_id, {
                            id: snap.product_id,
                            name: snap.products.name,
                            sku: snap.products.sku || '-',
                            unit: snap.products.unit || 'Đơn vị'
                        })
                    } else {
                        missingProductIds.add(snap.product_id)
                    }
                }
                for (const it of snap.lot_items || []) {
                    if (it.product_id && !productMap.has(it.product_id)) {
                        if (it.products?.name) {
                            productMap.set(it.product_id, {
                                id: it.product_id,
                                name: it.products.name,
                                sku: it.products.sku || '-',
                                unit: it.products.unit || it.unit || 'Đơn vị'
                            })
                        } else {
                            missingProductIds.add(it.product_id)
                        }
                    }
                }
            }
        }
    }

    // Parallel enrichment queries
    const [profilesRes, positionsRes, missingProductsRes, deletedLotAuditsRes] = await Promise.all([
        userIds.size > 0
            ? supabase.from('user_profiles').select('id, full_name, email').in('id', Array.from(userIds))
            : Promise.resolve({ data: [] }),
        posIds.size > 0
            ? supabase.from('positions').select('id, code').in('id', Array.from(posIds))
            : Promise.resolve({ data: [] }),
        missingProductIds.size > 0
            ? supabase.from('products').select('id, name, sku, unit').in('id', Array.from(missingProductIds))
            : Promise.resolve({ data: [] }),
        missingLotIds.size > 0
            ? supabase
                  .from('audit_logs')
                  .select('record_id, old_data')
                  .eq('table_name', 'lots')
                  .eq('action', 'DELETE')
                  .in('record_id', Array.from(missingLotIds))
            : Promise.resolve({ data: [] })
    ])

    const userMap = new Map<string, FluctuationPerformer>()
    for (const p of (profilesRes as any).data || []) {
        userMap.set(p.id, {
            id: p.id,
            name: p.full_name || p.email || 'Nhân viên',
            email: p.email || ''
        })
    }

    const posCodeMap = new Map<string, string>()
    for (const pos of (positionsRes as any).data || []) {
        posCodeMap.set(pos.id, pos.code)
    }

    for (const prod of (missingProductsRes as any).data || []) {
        productMap.set(prod.id, prod)
    }

    for (const dLog of (deletedLotAuditsRes as any).data || []) {
        if (dLog.record_id && dLog.old_data?.code && !lotMap.has(dLog.record_id)) {
            lotMap.set(dLog.record_id, {
                id: dLog.record_id,
                code: dLog.old_data.code,
                daily_seq: dLog.old_data.daily_seq,
                positions: dLog.old_data.positions || []
            })
        }
    }

    const events: FluctuationEvent[] = []
    const exportTimestampsByLot = new Map<string, number[]>()

    // 3. Extract export events from lots.metadata.system_history.exports within [fromMs, toMs]
    for (const lot of systemLots || []) {
        const exportsArr = lot.metadata?.system_history?.exports
        if (!Array.isArray(exportsArr)) continue

        exportsArr.forEach((exp: any, idx: number) => {
            if (!exp?.date) return
            const expTime = new Date(exp.date).getTime()
            if (isNaN(expTime) || expTime < fromMs || expTime > toMs) return

            const deltas: ProductDelta[] = []
            const itemsObj = exp.items && typeof exp.items === 'object' ? Object.values(exp.items) : []

            for (const item of itemsObj as any[]) {
                const qty = Number(item.exported_quantity ?? item.quantity ?? 0)
                if (qty <= 0) continue
                const pid = item.product_id || lot.product_id || 'unknown'
                const pMeta = productMap.get(pid)
                const sku = item.product_sku || pMeta?.sku || '-'
                const name = item.product_name || pMeta?.name || 'Sản phẩm'
                const unit = item.unit || pMeta?.unit || 'Đơn vị'
                deltas.push({
                    productId: pid,
                    sku,
                    name,
                    unit,
                    oldQty: qty,
                    newQty: 0,
                    deltaQty: -qty
                })
            }

            if (deltas.length === 0) return

            if (!exportTimestampsByLot.has(lot.id)) {
                exportTimestampsByLot.set(lot.id, [])
            }
            exportTimestampsByLot.get(lot.id)!.push(expTime)

            const posList = (lot.positions || []).map((p: any) => p.code).filter(Boolean)
            if (posList.length === 0 && exp.location_code) {
                posList.push(exp.location_code)
            }

            const customerText = exp.customer ? ` cho ${exp.customer}` : ''
            events.push({
                id: `export_${lot.id}_${exp.id || idx}_${expTime}`,
                timestamp: exp.date,
                sortTime: expTime,
                category: 'export',
                lotId: lot.id,
                lotCode: lot.code,
                dailySeq: lot.daily_seq ?? null,
                positions: posList,
                performedBy: null,
                title: `Xuất bán${customerText}`,
                description: exp.description || `Xuất hàng từ LOT ${lot.code}${customerText}`,
                customer: exp.customer || null,
                deltas
            })
        })
    }

    // 4. Process audit_logs events
    for (const log of logs) {
        const logTime = new Date(log.created_at).getTime()
        const performer = log.changed_by ? userMap.get(log.changed_by) || null : null

        if (log.table_name === 'positions' && log.action === 'UPDATE') {
            const oldLotId = log.old_data?.lot_id || null
            const newLotId = log.new_data?.lot_id || null
            if (oldLotId === newLotId) continue

            const posCode = posCodeMap.get(log.record_id) || 'Vị trí'
            const oldLot = oldLotId ? lotMap.get(oldLotId) : null
            const newLot = newLotId ? lotMap.get(newLotId) : null

            let category: FluctuationCategory = 'position_assign'
            let title = 'Gán vị trí'
            let description = ''
            let primaryLotId = newLotId || oldLotId || ''
            let primaryLotCode = newLot?.code || oldLot?.code || (primaryLotId ? `LOT-${primaryLotId.slice(0, 6)}` : '')
            let primaryDailySeq = newLot?.daily_seq ?? oldLot?.daily_seq ?? null

            if (!oldLotId && newLotId) {
                category = 'position_assign'
                title = `Xếp vào vị trí ${posCode}`
                description = `Đưa LOT ${primaryLotCode} vào vị trí ${posCode}`
            } else if (oldLotId && !newLotId) {
                category = 'position_unassign'
                title = `Gỡ khỏi vị trí ${posCode}`
                description = `Gỡ LOT ${primaryLotCode} ra khỏi vị trí ${posCode}`
            } else {
                category = 'position_replace'
                title = `Đổi hàng tại vị trí ${posCode}`
                const oldCode = oldLot?.code || `LOT-${String(oldLotId).slice(0, 6)}`
                const newCode = newLot?.code || `LOT-${String(newLotId).slice(0, 6)}`
                description = `Thay LOT ${oldCode} bằng LOT ${newCode} tại vị trí ${posCode}`
            }

            events.push({
                id: `audit_${log.id}`,
                timestamp: log.created_at,
                sortTime: logTime,
                category,
                lotId: primaryLotId,
                lotCode: primaryLotCode,
                dailySeq: primaryDailySeq,
                positions: [posCode],
                performedBy: performer,
                title,
                description,
                deltas: [],
                positionDetail: {
                    positionCode: posCode,
                    oldLotId,
                    oldLotCode: oldLot?.code || null,
                    newLotId,
                    newLotCode: newLot?.code || null
                }
            })
            continue
        }

        if (log.table_name === 'lots') {
            const lotId = log.record_id
            const lotMeta = lotMap.get(lotId)
            const snap = log.new_data || log.old_data || {}
            const lotCode = snap.code || lotMeta?.code || `LOT-${String(lotId).slice(0, 6)}`
            const dailySeq = snap.daily_seq ?? lotMeta?.daily_seq ?? null
            const posList = (lotMeta?.positions || snap.positions || [])
                .map((p: any) => p.code)
                .filter(Boolean)

            if (log.action === 'CREATE') {
                const newMap = extractItemsMap(log.new_data, productMap)
                const deltas: ProductDelta[] = Array.from(newMap.values()).map(v => ({
                    productId: v.productId,
                    sku: v.sku,
                    name: v.name,
                    unit: v.unit,
                    oldQty: 0,
                    newQty: v.qty,
                    deltaQty: v.qty
                }))

                events.push({
                    id: `audit_${log.id}`,
                    timestamp: log.created_at,
                    sortTime: logTime,
                    category: 'create',
                    lotId,
                    lotCode,
                    dailySeq,
                    positions: posList,
                    performedBy: performer,
                    title: 'Tạo LOT mới',
                    description: `Nhập/tạo mới LOT ${lotCode}`,
                    deltas
                })
                continue
            }

            if (log.action === 'DELETE') {
                const oldMap = extractItemsMap(log.old_data, productMap)
                const deltas: ProductDelta[] = Array.from(oldMap.values()).map(v => ({
                    productId: v.productId,
                    sku: v.sku,
                    name: v.name,
                    unit: v.unit,
                    oldQty: v.qty,
                    newQty: 0,
                    deltaQty: -v.qty
                }))

                events.push({
                    id: `audit_${log.id}`,
                    timestamp: log.created_at,
                    sortTime: logTime,
                    category: 'delete',
                    lotId,
                    lotCode,
                    dailySeq,
                    positions: posList,
                    performedBy: performer,
                    title: 'Xóa LOT',
                    description: posList.length > 0
                        ? `Xóa LOT ${lotCode} tại vị trí ${posList.join(', ')}`
                        : `Xóa LOT ${lotCode}`,
                    deltas
                })
                continue
            }

            if (log.action === 'UPDATE') {
                const hasLotItems = Boolean(log.old_data?.lot_items || log.new_data?.lot_items)

                // Tránh trùng lặp với sự kiện xuất bán đã trích từ metadata.system_history.exports
                if (!hasLotItems) {
                    const expTimes = exportTimestampsByLot.get(lotId) || []
                    const isDuplicateExport = expTimes.some(t => Math.abs(t - logTime) <= 90_000)
                    if (isDuplicateExport) {
                        continue
                    }
                }

                const oldMap = extractItemsMap(log.old_data, productMap)
                const newMap = extractItemsMap(log.new_data, productMap)
                const allKeys = new Set([...Array.from(oldMap.keys()), ...Array.from(newMap.keys())])
                const deltas: ProductDelta[] = []

                for (const k of Array.from(allKeys)) {
                    const o = oldMap.get(k)
                    const n = newMap.get(k)
                    const oldQty = o?.qty ?? 0
                    const newQty = n?.qty ?? 0
                    const deltaQty = Number((newQty - oldQty).toFixed(6))
                    if (Math.abs(deltaQty) <= 0.000001) continue

                    deltas.push({
                        productId: (n || o)!.productId,
                        sku: (n || o)!.sku,
                        name: (n || o)!.name,
                        unit: (n || o)!.unit,
                        oldQty,
                        newQty,
                        deltaQty
                    })
                }

                if (deltas.length > 0) {
                    const hasUp = deltas.some(d => d.deltaQty > 0)
                    const hasDown = deltas.some(d => d.deltaQty < 0)
                    const category: FluctuationCategory = hasUp && hasDown
                        ? 'adjust_mixed'
                        : hasUp
                        ? 'adjust_up'
                        : 'adjust_down'

                    const title = category === 'adjust_up'
                        ? 'Bỏ thêm / Tăng SL'
                        : category === 'adjust_down'
                        ? 'Bớt ra / Giảm SL'
                        : 'Điều chỉnh tăng/giảm'

                    const summaryText = deltas
                        .map(d => `${d.name}: ${d.deltaQty > 0 ? '+' : ''}${d.deltaQty} ${d.unit}`)
                        .join('; ')

                    events.push({
                        id: `audit_${log.id}`,
                        timestamp: log.created_at,
                        sortTime: logTime,
                        category,
                        lotId,
                        lotCode,
                        dailySeq,
                        positions: posList,
                        performedBy: performer,
                        title,
                        description: summaryText,
                        deltas
                    })
                }
            }
        }
    }

    // Sort newest first
    events.sort((a, b) => b.sortTime - a.sortTime)

    const productSummaries = buildProductSummaries(events)

    const performerMap = new Map<string, FluctuationPerformer>()
    for (const ev of events) {
        if (ev.performedBy) {
            performerMap.set(ev.performedBy.id, ev.performedBy)
        }
    }

    return {
        events,
        productSummaries,
        performers: Array.from(performerMap.values())
    }
}

export function formatLotSttLabel(dailySeq: number | null | undefined): string | null {
    if (dailySeq === null || dailySeq === undefined) return null
    return decodeSTT(dailySeq)
}
