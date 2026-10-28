/**
 * IndexedDB storage for Chánh Thu Mobile Scanner (Web PWA)
 * Enables 100% offline scanning, local LOT search, and offline sync queue.
 */

const DB_NAME = 'chanhthu_scanner_db'
const DB_VERSION = 1

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
    const item: OfflinePendingPallet = {
        ...pallet,
        client_id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        created_at: new Date().toISOString(),
        status: 'pending_create'
    }

    return new Promise((resolve, reject) => {
        const tx = db.transaction('pending_pallets', 'readwrite')
        tx.objectStore('pending_pallets').put(item)
        tx.oncomplete = () => resolve(item)
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
