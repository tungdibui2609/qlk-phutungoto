/**
 * IndexedDB storage for Chánh Thu Mobile Scanner (Web PWA)
 * Enables 100% offline scanning, local LOT search, and offline sync queue.
 */

const DB_NAME = 'chanhthu_scanner_db'
const DB_VERSION = 4

export interface OfflinePallet {
    id: string
    stt: string
    lot_code?: string | null
    lot_id?: string | null
    boxes_count: number
    total_weight: number
    is_linked: boolean
    status?: string | null
    product_name?: string | null
    sku?: string | null
    product_aliases?: string | null
    aliases?: string | null
    tag?: string | null
    notes?: string | null
    production_place?: string | null
    material_zone?: string | null
    packaging_date?: string | null
    production_date?: string | null
    location_code?: string | null
    scan_type?: 'stamp' | 'label'
    is_special_12?: boolean
    created_at: string
    cached_at?: string
}

export interface OfflinePendingPallet {
    client_id: string
    stt: string
    lot_code?: string | null
    boxes_count: number
    boxes: Array<{
        code: string
        weight: number
        time: string
        system_code?: string
        metadata?: any
    }>
    product_name?: string
    sku?: string
    tag?: string
    scan_type?: 'stamp' | 'label'
    photo_base64?: string
    crop_base64?: string
    notes?: string
    created_at: string
    status: 'pending_create' | 'pending_link' | 'syncing' | 'failed'
    error_message?: string
}

export interface OfflineLot {
    id: string
    lot_code: string
    product_name?: string
    sku?: string
    quantity?: number
    customer_id?: string
    status?: string
    created_at?: string
    updated_at?: string
}

export interface OfflineStampQueueItem {
    id: string
    pallet_stt: string
    pallet_tag?: string | null
    pallet_notes?: string | null
    box_count: number
    box_weight: number
    photo_base64: string
    crop_base64?: string | null
    system_code?: string
    stamp_line1?: string | null
    stamp_line2?: string | null
    created_at: string
    status: 'pending' | 'uploading' | 'error' | 'decoded'
    error_message?: string | null
    retry_count?: number
}

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            return reject(new Error('IndexedDB không được hỗ trợ trên trình duyệt này'))
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION)

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result

            // Store 1: Cached Pallets from Cloud
            if (!db.objectStoreNames.contains('pallets')) {
                const store = db.createObjectStore('pallets', { keyPath: 'stt' })
                store.createIndex('lot_code', 'lot_code', { unique: false })
                store.createIndex('created_at', 'created_at', { unique: false })
            }

            // Store 2: Cached LOTs for instant offline search & suggest
            if (!db.objectStoreNames.contains('lots')) {
                const store = db.createObjectStore('lots', { keyPath: 'id' })
                store.createIndex('lot_code', 'lot_code', { unique: false })
                store.createIndex('product_name', 'product_name', { unique: false })
                store.createIndex('sku', 'sku', { unique: false })
            }

            // Store 3: Pending Pallets / Offline Queue
            if (!db.objectStoreNames.contains('pending_pallets')) {
                const store = db.createObjectStore('pending_pallets', { keyPath: 'client_id' })
                store.createIndex('status', 'status', { unique: false })
                store.createIndex('created_at', 'created_at', { unique: false })
            }

            // Store 4: Metadata (timestamps, counts, configs)
            if (!db.objectStoreNames.contains('meta')) {
                db.createObjectStore('meta', { keyPath: 'key' })
            }

            // Store 5: Cached Warehouse Map (zones + positions) — tránh giới hạn 5MB của localStorage
            if (!db.objectStoreNames.contains('warehouse_map')) {
                db.createObjectStore('warehouse_map', { keyPath: 'key' })
            }

            // Store 6: Stamp Queue Offline (đợt chụp ảnh con dấu chờ gửi AI)
            if (!db.objectStoreNames.contains('stamp_queue')) {
                const store = db.createObjectStore('stamp_queue', { keyPath: 'id' })
                store.createIndex('pallet_stt', 'pallet_stt', { unique: false })
                store.createIndex('created_at', 'created_at', { unique: false })
            }

            // Store 7: Offline Inventory Voice Notes (ghi âm kiểm kê chờ đồng bộ lên Server & dịch AI)
            if (!db.objectStoreNames.contains('offline_inventory_voices')) {
                const store = db.createObjectStore('offline_inventory_voices', { keyPath: 'key' })
                store.createIndex('sessionId', 'sessionId', { unique: false })
                store.createIndex('createdAt', 'createdAt', { unique: false })
            }
        }

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

// ── PALLETS CACHE ──────────────────────────────────────────────────────────

export async function savePalletsToOfflineDb(pallets: OfflinePallet[]): Promise<void> {
    if (!pallets || pallets.length === 0) return
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['pallets', 'meta'], 'readwrite')
        const store = tx.objectStore('pallets')
        const metaStore = tx.objectStore('meta')

        // Clear and rewrite with latest
        store.clear()
        for (const p of pallets) {
            store.put(p)
        }

        metaStore.put({ key: 'pallets_last_synced_at', value: new Date().toISOString() })
        metaStore.put({ key: 'pallets_count', value: pallets.length })

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function getPalletsFromOfflineDb(): Promise<OfflinePallet[]> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pallets', 'readonly')
        const store = tx.objectStore('pallets')
        const request = store.getAll()

        request.onsuccess = () => {
            const list: OfflinePallet[] = request.result || []
            list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            resolve(list)
        }
        request.onerror = () => reject(request.error)
    })
}

// ── LOTS CACHE ─────────────────────────────────────────────────────────────

export async function saveLotsToOfflineDb(lots: OfflineLot[], isIncremental = false): Promise<void> {
    if (!lots || lots.length === 0) return
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['lots', 'meta'], 'readwrite')
        const store = tx.objectStore('lots')
        const metaStore = tx.objectStore('meta')

        if (!isIncremental) {
            store.clear()
        }

        for (const lot of lots) {
            store.put(lot)
        }

        metaStore.put({ key: 'lots_last_synced_at', value: new Date().toISOString() })

        tx.oncomplete = async () => {
            // Count total
            try {
                const count = await getLotsCountFromOfflineDb()
                const db2 = await openDatabase()
                const tx2 = db2.transaction('meta', 'readwrite')
                tx2.objectStore('meta').put({ key: 'lots_count', value: count })
            } catch {}
            resolve()
        }
        tx.onerror = () => reject(tx.error)
    })
}

export async function getLotsCountFromOfflineDb(): Promise<number> {
    const db = await openDatabase()
    return new Promise((resolve) => {
        const tx = db.transaction('lots', 'readonly')
        const store = tx.objectStore('lots')
        const req = store.count()
        req.onsuccess = () => resolve(req.result || 0)
        req.onerror = () => resolve(0)
    })
}

export async function searchLotsFromOfflineDb(query: string, limit = 20): Promise<OfflineLot[]> {
    const clean = query.trim().toLowerCase()
    if (!clean) return []

    const db = await openDatabase()
    return new Promise((resolve) => {
        const tx = db.transaction('lots', 'readonly')
        const store = tx.objectStore('lots')
        const req = store.openCursor()
        const results: OfflineLot[] = []

        req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest).result as IDBCursorWithValue | null
            if (cursor && results.length < limit) {
                const lot = cursor.value as OfflineLot
                const lotCode = (lot.lot_code || '').toLowerCase()
                const prodName = (lot.product_name || '').toLowerCase()
                const sku = (lot.sku || '').toLowerCase()

                if (lotCode.includes(clean) || prodName.includes(clean) || sku.includes(clean)) {
                    results.push(lot)
                }
                cursor.continue()
            } else {
                resolve(results)
            }
        }
        req.onerror = () => resolve([])
    })
}

// ── PENDING PALLETS (OFFLINE QUEUE) ─────────────────────────────────────────

export async function addPendingPallet(pallet: Omit<OfflinePendingPallet, 'client_id' | 'created_at' | 'status'>): Promise<OfflinePendingPallet> {
    const db = await openDatabase()
    const cleanStt = (pallet.stt || '').trim().toUpperCase()

    return new Promise((resolve, reject) => {
        const tx = db.transaction('pending_pallets', 'readwrite')
        const store = tx.objectStore('pending_pallets')
        const getAllReq = store.getAll()

        let resultItem: OfflinePendingPallet | null = null

        getAllReq.onsuccess = () => {
            const all: OfflinePendingPallet[] = getAllReq.result || []
            const existing = all.find(
                p => (p.stt || '').trim().toUpperCase() === cleanStt && p.status !== 'syncing'
            )

            if (existing) {
                const mergedBoxes = [...(existing.boxes || []), ...(pallet.boxes || [])]
                existing.boxes = mergedBoxes
                existing.boxes_count = mergedBoxes.length
                existing.status = 'pending_create'
                if (pallet.lot_code) existing.lot_code = pallet.lot_code
                if (pallet.product_name) existing.product_name = pallet.product_name
                if (pallet.sku) existing.sku = pallet.sku
                if (pallet.photo_base64) existing.photo_base64 = pallet.photo_base64
                if (pallet.crop_base64) existing.crop_base64 = pallet.crop_base64
                existing.error_message = undefined
                store.put(existing)
                resultItem = existing
            } else {
                const item: OfflinePendingPallet = {
                    ...pallet,
                    stt: cleanStt,
                    boxes_count: pallet.boxes?.length ?? pallet.boxes_count ?? 0,
                    client_id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    created_at: new Date().toISOString(),
                    status: 'pending_create'
                }
                store.put(item)
                resultItem = item
            }
        }

        tx.oncomplete = () => resolve(resultItem!)
        tx.onerror = () => reject(tx.error)
    })
}

export async function removeBoxFromPendingPallet(stt: string, boxCode: string): Promise<void> {
    const db = await openDatabase()
    const cleanStt = (stt || '').trim().toUpperCase()

    return new Promise((resolve, reject) => {
        const tx = db.transaction('pending_pallets', 'readwrite')
        const store = tx.objectStore('pending_pallets')
        const getAllReq = store.getAll()

        getAllReq.onsuccess = () => {
            const all: OfflinePendingPallet[] = getAllReq.result || []
            for (const p of all) {
                if ((p.stt || '').trim().toUpperCase() === cleanStt && p.status !== 'syncing') {
                    const filtered = (p.boxes || []).filter(b => b.code !== boxCode)
                    if (filtered.length !== (p.boxes || []).length) {
                        if (filtered.length === 0) {
                            store.delete(p.client_id)
                        } else {
                            p.boxes = filtered
                            p.boxes_count = filtered.length
                            store.put(p)
                        }
                    }
                }
            }
        }

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function getPendingPallets(): Promise<OfflinePendingPallet[]> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pending_pallets', 'readonly')
        const req = tx.objectStore('pending_pallets').getAll()
        req.onsuccess = () => resolve(req.result || [])
        req.onerror = () => reject(req.error)
    })
}

export async function removePendingPallet(clientId: string): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pending_pallets', 'readwrite')
        tx.objectStore('pending_pallets').delete(clientId)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function updatePendingPalletStatus(
    clientId: string,
    status: OfflinePendingPallet['status'],
    errorMessage?: string
): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pending_pallets', 'readwrite')
        const store = tx.objectStore('pending_pallets')
        const req = store.get(clientId)

        req.onsuccess = () => {
            const item = req.result as OfflinePendingPallet | undefined
            if (item) {
                item.status = status
                if (errorMessage !== undefined) item.error_message = errorMessage
                store.put(item)
            }
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

// ── METADATA ───────────────────────────────────────────────────────────────

export async function getOfflineMeta(key: string): Promise<any> {
    try {
        const db = await openDatabase()
        return new Promise((resolve) => {
            const tx = db.transaction('meta', 'readonly')
            const req = tx.objectStore('meta').get(key)
            req.onsuccess = () => resolve(req.result ? req.result.value : null)
            req.onerror = () => resolve(null)
        })
    } catch {
        return null
    }
}

export async function setOfflineMeta(key: string, value: any): Promise<void> {
    try {
        const db = await openDatabase()
        return new Promise((resolve, reject) => {
            const tx = db.transaction('meta', 'readwrite')
            tx.objectStore('meta').put({ key, value })
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
        })
    } catch {}
}

// ── WAREHOUSE MAP CACHE ────────────────────────────────────────────────────

export interface OfflineWarehouseMapSnapshot {
    zones: any[]
    positions: any[]
    cachedAt: string
    systemCode?: string
}

export async function saveWarehouseMapToOfflineDb(
    snapshot: OfflineWarehouseMapSnapshot,
    cacheKey = 'default'
): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['warehouse_map', 'meta'], 'readwrite')
        tx.objectStore('warehouse_map').put({ key: cacheKey, ...snapshot })
        tx.objectStore('meta').put({ key: 'warehouse_map_last_synced_at', value: snapshot.cachedAt })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function getWarehouseMapFromOfflineDb(
    cacheKey = 'default'
): Promise<OfflineWarehouseMapSnapshot | null> {
    try {
        const db = await openDatabase()
        return new Promise((resolve) => {
            const tx = db.transaction('warehouse_map', 'readonly')
            const req = tx.objectStore('warehouse_map').get(cacheKey)
            req.onsuccess = () => {
                const res = req.result
                if (res && Array.isArray(res.zones)) {
                    resolve({
                        zones: res.zones,
                        positions: Array.isArray(res.positions) ? res.positions : [],
                        cachedAt: res.cachedAt || '',
                        systemCode: res.systemCode,
                    })
                } else {
                    resolve(null)
                }
            }
            req.onerror = () => resolve(null)
        })
    } catch {
        return null
    }
}

// ── STAMP QUEUE OFFLINE (Web PWA matching Android Stamp Queue) ─────────────

export async function saveOfflineStampQueueItem(item: OfflineStampQueueItem): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction('stamp_queue', 'readwrite')
        tx.objectStore('stamp_queue').put(item)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function getOfflineStampQueue(): Promise<OfflineStampQueueItem[]> {
    try {
        const db = await openDatabase()
        return new Promise((resolve) => {
            const tx = db.transaction('stamp_queue', 'readonly')
            const req = tx.objectStore('stamp_queue').getAll()
            req.onsuccess = () => resolve((req.result || []) as OfflineStampQueueItem[])
            req.onerror = () => resolve([])
        })
    } catch {
        return []
    }
}

export async function removeOfflineStampQueueItem(id: string): Promise<void> {
    try {
        const db = await openDatabase()
        return new Promise((resolve, reject) => {
            const tx = db.transaction('stamp_queue', 'readwrite')
            tx.objectStore('stamp_queue').delete(id)
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
        })
    } catch {}
}

export async function syncSingleOfflineStampQueueItem(id: string): Promise<boolean> {
    const list = await getOfflineStampQueue()
    const target = list.find(i => i.id === id)
    if (!target) return false

    try {
        const res = await fetch('/api/stamp-queue/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageBase64: target.photo_base64,
                croppedBase64: target.crop_base64 || target.photo_base64,
                palletStt: target.pallet_stt,
                palletTag: target.pallet_tag || null,
                palletNotes: target.pallet_notes || null,
                boxCount: target.box_count || 1,
                boxWeight: target.box_weight || 20,
                systemCode: target.system_code || 'KHO_DONG_LANH',
                stampLine1: target.stamp_line1 || null,
                stampLine2: target.stamp_line2 || null,
            }),
        })
        const data = await res.json()
        if (data.success) {
            await removeOfflineStampQueueItem(id)
            return true
        } else {
            target.status = 'error'
            target.error_message = data.error || 'Server từ chối'
            target.retry_count = (target.retry_count || 0) + 1
            await saveOfflineStampQueueItem(target)
            return false
        }
    } catch (err: any) {
        target.status = 'error'
        target.error_message = err.message || 'Mất kết nối mạng'
        target.retry_count = (target.retry_count || 0) + 1
        await saveOfflineStampQueueItem(target)
        return false
    }
}

export async function syncAllOfflineStampQueue(): Promise<{ synced: number; failed: number }> {
    const list = await getOfflineStampQueue()
    if (list.length === 0) return { synced: 0, failed: 0 }

    let synced = 0
    let failed = 0
    for (const item of list) {
        const ok = await syncSingleOfflineStampQueueItem(item.id)
        if (ok) synced++
        else failed++
    }
    return { synced, failed }
}

// ── OFFLINE INVENTORY VOICE NOTES (GHI ÂM KIỂM KÊ CHỜ ĐỒNG BỘ & DỊCH AI) ──

export interface OfflineInventoryVoiceItem {
    key: string // `${sessionId}__${positionId}__${ts}_${rand}` (hỗ trợ nhiều ghi âm / 1 vị trí)
    sessionId: string
    positionId: string
    audioBase64: string
    mimeType: string
    durationSec: number
    createdAt: string
}

export function parseVoiceNoteUrls(raw?: string | null): string[] {
    const s = String(raw || '').trim()
    if (!s) return []
    if (s.startsWith('[')) {
        try {
            const arr = JSON.parse(s)
            if (Array.isArray(arr)) {
                return Array.from(new Set(arr.map(x => String(x || '').trim()).filter(Boolean)))
            }
        } catch {}
    }
    return [s]
}

export function appendVoiceNoteUrl(
    existingRaw: string | null | undefined,
    incoming: string | string[] | null | undefined
): string | null {
    const current = parseVoiceNoteUrls(existingRaw)
    const additions = Array.isArray(incoming)
        ? incoming.map(x => String(x || '').trim()).filter(Boolean)
        : incoming
          ? [String(incoming).trim()].filter(Boolean)
          : []
    const merged = Array.from(new Set([...current, ...additions]))
    if (merged.length === 0) return null
    if (merged.length === 1) return merged[0]
    return JSON.stringify(merged)
}

export async function saveOfflineInventoryVoice(
    item: Omit<OfflineInventoryVoiceItem, 'key'>
): Promise<OfflineInventoryVoiceItem> {
    const db = await openDatabase()
    const rand = Math.random().toString(36).slice(2, 6)
    const fullItem: OfflineInventoryVoiceItem = {
        ...item,
        key: `${item.sessionId}__${item.positionId}__${Date.now()}_${rand}`,
    }
    return new Promise((resolve, reject) => {
        const tx = db.transaction('offline_inventory_voices', 'readwrite')
        tx.objectStore('offline_inventory_voices').put(fullItem)
        tx.oncomplete = () => resolve(fullItem)
        tx.onerror = () => reject(tx.error)
    })
}

export async function getOfflineInventoryVoicesBySession(
    sessionId: string
): Promise<OfflineInventoryVoiceItem[]> {
    try {
        const db = await openDatabase()
        return new Promise((resolve) => {
            const tx = db.transaction('offline_inventory_voices', 'readonly')
            const idx = tx.objectStore('offline_inventory_voices').index('sessionId')
            const req = idx.getAll(IDBKeyRange.only(sessionId))
            req.onsuccess = () => {
                const list: OfflineInventoryVoiceItem[] = req.result || []
                list.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
                resolve(list)
            }
            req.onerror = () => resolve([])
        })
    } catch {
        return []
    }
}

export async function getOfflineVoiceCountsBySession(): Promise<Record<string, number>> {
    try {
        const db = await openDatabase()
        return new Promise((resolve) => {
            const tx = db.transaction('offline_inventory_voices', 'readonly')
            const req = tx.objectStore('offline_inventory_voices').getAll()
            req.onsuccess = () => {
                const list: OfflineInventoryVoiceItem[] = req.result || []
                const counts: Record<string, number> = {}
                for (const it of list) {
                    if (!it.sessionId) continue
                    counts[it.sessionId] = (counts[it.sessionId] || 0) + 1
                }
                resolve(counts)
            }
            req.onerror = () => resolve({})
        })
    } catch {
        return {}
    }
}

export async function deleteOfflineInventoryVoiceByKey(voiceKey: string): Promise<void> {
    try {
        const db = await openDatabase()
        return new Promise((resolve) => {
            const tx = db.transaction('offline_inventory_voices', 'readwrite')
            tx.objectStore('offline_inventory_voices').delete(voiceKey)
            tx.oncomplete = () => resolve()
            tx.onerror = () => resolve()
        })
    } catch {}
}

export async function deleteOfflineInventoryVoice(
    sessionId: string,
    positionId: string
): Promise<void> {
    try {
        const items = await getOfflineInventoryVoicesBySession(sessionId)
        const targets = items.filter(x => x.positionId === positionId)
        if (targets.length === 0) return
        const db = await openDatabase()
        return new Promise((resolve) => {
            const tx = db.transaction('offline_inventory_voices', 'readwrite')
            const store = tx.objectStore('offline_inventory_voices')
            for (const t of targets) store.delete(t.key)
            tx.oncomplete = () => resolve()
            tx.onerror = () => resolve()
        })
    } catch {}
}

export async function remapOfflineInventoryVoiceSession(
    oldSessionId: string,
    newSessionId: string
): Promise<void> {
    if (oldSessionId === newSessionId) return
    const items = await getOfflineInventoryVoicesBySession(oldSessionId)
    if (items.length === 0) return
    const db = await openDatabase()
    return new Promise((resolve) => {
        const tx = db.transaction('offline_inventory_voices', 'readwrite')
        const store = tx.objectStore('offline_inventory_voices')
        const prefix = `${oldSessionId}__`
        for (const it of items) {
            store.delete(it.key)
            const suffix = it.key.startsWith(prefix) ? it.key.slice(prefix.length) : it.positionId
            store.put({
                ...it,
                sessionId: newSessionId,
                key: `${newSessionId}__${suffix}`,
            })
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
    })
}
