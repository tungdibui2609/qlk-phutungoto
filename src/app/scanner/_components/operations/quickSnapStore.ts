import type { PickedOperationPhoto } from './operationImagesService'

export interface QuickSnapItem {
  id: string
  shiftId: string
  jobName: string
  systemCode: string
  capturedAt: string
  photo: PickedOperationPhoto
}

const DB_NAME = 'wms_quick_snaps_db'
const STORE_NAME = 'quick_snaps'
const LS_FALLBACK_KEY = 'wms_quick_snaps_fallback_v1'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = window.indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('by_shift', 'shiftId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'))
  })
}

function stripBlob(item: QuickSnapItem): QuickSnapItem {
  return {
    ...item,
    photo: {
      dataUrl: item.photo.dataUrl,
      width: item.photo.width,
      height: item.photo.height,
      fileSize: item.photo.fileSize,
      mimeType: item.photo.mimeType,
    },
  }
}

export async function getAllQuickSnaps(): Promise<QuickSnapItem[]> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => {
        const items = ((req.result as QuickSnapItem[]) || []).sort((a, b) =>
          a.capturedAt.localeCompare(b.capturedAt)
        )
        resolve(items)
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY)
      const all: QuickSnapItem[] = raw ? JSON.parse(raw) : []
      return all.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    } catch {
      return []
    }
  }
}

export async function getQuickSnapsForShift(shiftId: string): Promise<QuickSnapItem[]> {
  if (!shiftId) return []
  const all = await getAllQuickSnaps()
  return all.filter(x => x.shiftId === shiftId)
}

export async function addQuickSnap(item: QuickSnapItem): Promise<void> {
  const clean = stripBlob(item)
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(clean)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY)
      const all: QuickSnapItem[] = raw ? JSON.parse(raw) : []
      all.push(clean)
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(all))
    } catch {}
  }
}

export async function updateQuickSnapShift(
  id: string,
  shiftId: string,
  jobName: string
): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(id)
      getReq.onsuccess = () => {
        const existing = getReq.result as QuickSnapItem | undefined
        if (existing) {
          store.put({ ...existing, shiftId, jobName })
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY)
      const all: QuickSnapItem[] = raw ? JSON.parse(raw) : []
      localStorage.setItem(
        LS_FALLBACK_KEY,
        JSON.stringify(all.map(x => (x.id === id ? { ...x, shiftId, jobName } : x)))
      )
    } catch {}
  }
}

export async function removeQuickSnap(id: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY)
      const all: QuickSnapItem[] = raw ? JSON.parse(raw) : []
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(all.filter(x => x.id !== id)))
    } catch {}
  }
}
