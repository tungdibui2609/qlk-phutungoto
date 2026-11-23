import { supabase } from '@/lib/supabaseClient'
import {
  addHiddenId,
  canBypassOperationApproval,
  reconcileHiddenIds,
  submitScannerApprovalRequest,
} from './approvalService'
import {
  applyOperationWatermark,
  getWatermarkEnabled,
  setWatermarkEnabled,
} from '../OperationWatermarkOverlay'

export { getWatermarkEnabled, setWatermarkEnabled }

export interface OperationImageRecord {
  id: string
  company_id?: string | null
  system_code: string
  shift_id: string
  sub_shift_id?: string | null
  journal_id?: string | null
  folder_id?: string | null
  scope: 'shift' | 'sub_shift' | 'journal'
  direction?: 'in' | 'out' | null
  job_name?: string | null
  item_name?: string | null
  item_sku?: string | null
  quantity?: number | null
  unit?: string | null
  storage_bucket?: string
  storage_path: string
  public_url: string
  file_size?: number | null
  mime_type?: string | null
  notes?: string | null
  captured_by?: string | null
  captured_by_name?: string | null
  captured_at: string
  drive_file_id?: string | null
  drive_web_url?: string | null
  drive_synced_at?: string | null
  is_offline?: boolean
  local_data_url?: string
}

export interface PickedOperationPhoto {
  dataUrl: string
  blob?: Blob
  width?: number
  height?: number
  fileSize?: number
  mimeType: string
}

export interface OperationFolder {
  id: string
  company_id?: string | null
  system_code: string
  parent_id?: string | null
  name: string
  created_by?: string | null
  created_by_name?: string | null
  created_at?: string
}

export interface OperationDriveSettings {
  id?: string
  company_id?: string | null
  system_code: string
  webhook_url: string
  root_folder_name: string
  auto_sync_enabled: boolean
  auto_delete_local_days?: number | null
}

const STORAGE_BUCKET = 'operation-images'
const LOCAL_AUTO_DELETE_DAYS_KEY = 'op_local_auto_delete_days_v1'
const OFFLINE_IMAGES_KEY = 'op_offline_images_queue_v1'

export function parseRefPhase(notes?: string | null): 'start' | 'end' | 'legacy' | null {
  const m = notes?.match(/^\[THAM_CHIEU:([^\]:]+)(?::(start|end))?\]/)
  if (!m) return null
  if (m[2] === 'start') return 'start'
  if (m[2] === 'end') return 'end'
  return 'legacy'
}

export function normalizeBaseSystemCode(code?: string | null): string {
  if (!code) return 'KHO_DONG_LANH'
  return code.trim().replace(/__solieu$/i, '') || 'KHO_DONG_LANH'
}

export function normalizeSearchText(str?: string | null): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s\-_/.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function getLocalAutoDeleteDays(): Promise<number | null> {
  try {
    const v = localStorage.getItem(LOCAL_AUTO_DELETE_DAYS_KEY)
    if (!v) return null
    const n = Number(v)
    return !isNaN(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export async function setLocalAutoDeleteDays(days: number | null): Promise<void> {
  try {
    if (days == null || days <= 0) {
      localStorage.removeItem(LOCAL_AUTO_DELETE_DAYS_KEY)
    } else {
      localStorage.setItem(LOCAL_AUTO_DELETE_DAYS_KEY, String(days))
    }
  } catch {}
}

export function getOperationImageDisplayUrl(img: OperationImageRecord): string {
  if (img.local_data_url) return img.local_data_url
  if (img.public_url) return img.public_url
  if (img.drive_file_id) {
    return `https://lh3.googleusercontent.com/d/${img.drive_file_id}=w1600`
  }
  return ''
}

// ── CHỤP ẢNH / CHỌN ẢNH TRÊN WEB iOS SAFARI ──────────────────
function pickFilesViaInput(options: { capture?: boolean; multiple?: boolean; maxCount?: number }): Promise<File[]> {
  return new Promise(resolve => {
    if (typeof document === 'undefined') {
      resolve([])
      return
    }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    if (options.capture) {
      input.setAttribute('capture', 'environment')
    }
    if (options.multiple) {
      input.multiple = true
    }
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    document.body.appendChild(input)

    let settled = false
    const finish = (files: File[]) => {
      if (settled) return
      settled = true
      try {
        document.body.removeChild(input)
      } catch {}
      resolve(files)
    }

    input.onchange = () => {
      const list = input.files ? Array.from(input.files) : []
      const max = options.maxCount || 8
      finish(list.slice(0, max))
    }
    input.oncancel = () => finish([])
    input.click()
  })
}

async function processFileToPhoto(
  file: File,
  watermarkMeta?: {
    systemCode?: string
    jobName?: string | null
    itemName?: string | null
    quantity?: number | null
    unit?: string | null
    direction?: 'in' | 'out' | null
    userName?: string | null
  }
): Promise<PickedOperationPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh'))
    reader.onload = async () => {
      try {
        const srcUrl = String(reader.result || '')
        const stampedUrl = await applyOperationWatermark({
          uri: srcUrl,
          systemCode: normalizeBaseSystemCode(watermarkMeta?.systemCode),
          jobName: watermarkMeta?.jobName || null,
          itemName: watermarkMeta?.itemName || null,
          quantity: watermarkMeta?.quantity ?? null,
          unit: watermarkMeta?.unit || null,
          direction: watermarkMeta?.direction || null,
          capturedByName: watermarkMeta?.userName || null,
          capturedAt: new Date(),
        })
        const outUrl = stampedUrl || srcUrl
        const blob = dataUrlToBlob(outUrl)
        resolve({
          dataUrl: outUrl,
          blob,
          width: 1080,
          height: 1440,
          fileSize: blob.size || file.size,
          mimeType: 'image/jpeg',
        })
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Không thể xử lý ảnh'))
      }
    }
    reader.readAsDataURL(file)
  })
}

export interface WatermarkMeta {
  systemCode?: string
  jobName?: string | null
  itemName?: string | null
  quantity?: number | null
  unit?: string | null
  direction?: 'in' | 'out' | null
  userName?: string | null
}

export async function capturePhotoWithCamera(
  watermarkMeta?: WatermarkMeta
): Promise<PickedOperationPhoto | null> {
  const files = await pickFilesViaInput({ capture: true, multiple: false, maxCount: 1 })
  if (!files.length) return null
  return processFileToPhoto(files[0], watermarkMeta)
}

export async function pickPhotosFromLibrary(
  maxCount = 8,
  watermarkMeta?: WatermarkMeta
): Promise<PickedOperationPhoto[]> {
  const files = await pickFilesViaInput({ capture: false, multiple: true, maxCount })
  if (!files.length) return []
  const results: PickedOperationPhoto[] = []
  for (const f of files) {
    try {
      const p = await processFileToPhoto(f, watermarkMeta)
      results.push(p)
    } catch {}
  }
  return results
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mimeMatch = parts[0]?.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const bstr = atob(parts[1] || '')
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

export async function uploadOperationImages(params: {
  images: PickedOperationPhoto[]
  systemCode: string
  companyId?: string | null
  shiftId: string
  subShiftId?: string | null
  journalId?: string | null
  folderId?: string | null
  scope: 'shift' | 'sub_shift' | 'journal'
  direction?: 'in' | 'out' | null
  jobName?: string | null
  itemName?: string | null
  itemSku?: string | null
  quantity?: number | null
  unit?: string | null
  notes?: string | null
  user?: any
}): Promise<OperationImageRecord[]> {
  const baseSys = normalizeBaseSystemCode(params.systemCode)
  const createdRecords: OperationImageRecord[] = []

  for (const img of params.images) {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const rand = Math.random().toString(36).slice(2, 8)
    const storagePath = `${baseSys}/${y}-${m}-${d}/${params.shiftId}/${Date.now()}_${rand}.jpg`
    const clientImageId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
          })

    try {
      const blob = img.blob || dataUrlToBlob(img.dataUrl)
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr

      const { data: pubData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
      const publicUrl = pubData?.publicUrl || ''

      const validJournalId =
        params.journalId && !params.journalId.startsWith('local_') ? params.journalId : null

      const insertRow = {
        id: clientImageId,
        company_id: params.companyId || params.user?.company_id || null,
        system_code: baseSys,
        shift_id: params.shiftId,
        sub_shift_id: params.subShiftId && !params.subShiftId.startsWith('local_') ? params.subShiftId : null,
        journal_id: validJournalId,
        folder_id: params.folderId || null,
        scope: params.scope,
        direction: params.direction || null,
        job_name: params.jobName || null,
        item_name: params.itemName || null,
        item_sku: params.itemSku || null,
        quantity: params.quantity ?? null,
        unit: params.unit || null,
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        public_url: publicUrl,
        file_size: img.fileSize || blob.size || null,
        mime_type: 'image/jpeg',
        notes: params.notes || null,
        captured_by: params.user?.id || null,
        captured_by_name: params.user?.full_name || params.user?.email || 'Nhân viên',
        captured_at: now.toISOString(),
      }

      let { data: rowData, error: dbErr } = await (supabase.from('operation_images') as any)
        .insert([insertRow])
        .select('*')
        .single()
      if (dbErr && dbErr.code === '23503' && insertRow.journal_id) {
        const retryRes = await (supabase.from('operation_images') as any)
          .insert([{ ...insertRow, journal_id: null }])
          .select('*')
          .single()
        rowData = retryRes.data
        dbErr = retryRes.error
      }
      if (dbErr) throw dbErr
      createdRecords.push(rowData as OperationImageRecord)
    } catch (e) {
      console.warn('Upload operation image failed, saving offline:', e)
      const offlineRec: OperationImageRecord = {
        id: clientImageId,
        company_id: params.companyId || params.user?.company_id || null,
        system_code: baseSys,
        shift_id: params.shiftId,
        sub_shift_id: params.subShiftId || null,
        journal_id: params.journalId || null,
        folder_id: params.folderId || null,
        scope: params.scope,
        direction: params.direction || null,
        job_name: params.jobName || null,
        item_name: params.itemName || null,
        item_sku: params.itemSku || null,
        quantity: params.quantity ?? null,
        unit: params.unit || null,
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        public_url: img.dataUrl,
        local_data_url: img.dataUrl,
        file_size: img.fileSize || null,
        mime_type: 'image/jpeg',
        notes: params.notes || null,
        captured_by: params.user?.id || null,
        captured_by_name: params.user?.full_name || params.user?.email || 'Nhân viên',
        captured_at: now.toISOString(),
        is_offline: true,
      }
      try {
        const raw = localStorage.getItem(OFFLINE_IMAGES_KEY)
        const list: OperationImageRecord[] = raw ? JSON.parse(raw) : []
        list.push(offlineRec)
        localStorage.setItem(OFFLINE_IMAGES_KEY, JSON.stringify(list))
      } catch {}
      createdRecords.push(offlineRec)
    }
  }

  return createdRecords
}

export function getOfflineImagesCount(): number {
  try {
    const raw = localStorage.getItem(OFFLINE_IMAGES_KEY)
    if (!raw) return 0
    const queue: OperationImageRecord[] = JSON.parse(raw)
    return Array.isArray(queue) ? queue.length : 0
  } catch {
    return 0
  }
}

let inFlightWebImageSyncPromise: Promise<number> | null = null

export async function syncOfflineOperationImages(
  shiftIdMap?: Record<string, string>
): Promise<number> {
  if (inFlightWebImageSyncPromise) {
    return inFlightWebImageSyncPromise
  }

  inFlightWebImageSyncPromise = (async () => {
    try {
      const raw = localStorage.getItem(OFFLINE_IMAGES_KEY)
      if (!raw) return 0
      const queue: OperationImageRecord[] = JSON.parse(raw)
      if (!queue.length) return 0

      const remaining: OperationImageRecord[] = []
      let synced = 0

      for (const item of queue) {
        if (!item.local_data_url) continue
        const resolvedShiftId = shiftIdMap?.[item.shift_id] || item.shift_id
        if (String(resolvedShiftId).startsWith('local_')) {
          remaining.push(item)
          continue
        }
        const resolvedItem: OperationImageRecord = {
          ...item,
          shift_id: resolvedShiftId,
        }
        try {
          const blob = dataUrlToBlob(resolvedItem.local_data_url!)
          const { error: upErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(resolvedItem.storage_path, blob, { contentType: 'image/jpeg', upsert: true })
          if (upErr) throw upErr
          const { data: pubData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(resolvedItem.storage_path)

          const validJournalId =
            resolvedItem.journal_id && !resolvedItem.journal_id.startsWith('local_')
              ? resolvedItem.journal_id
              : null
          const validSubShiftId =
            resolvedItem.sub_shift_id && !resolvedItem.sub_shift_id.startsWith('local_')
              ? resolvedItem.sub_shift_id
              : null

          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              resolvedItem.id || ''
            )
          const { error: dbErr } = await (supabase.from('operation_images') as any).upsert(
            [
              {
                ...(isUuid ? { id: resolvedItem.id } : {}),
                company_id: resolvedItem.company_id || null,
                system_code: resolvedItem.system_code,
                shift_id: resolvedShiftId,
                sub_shift_id: validSubShiftId,
                journal_id: validJournalId,
                folder_id: resolvedItem.folder_id || null,
                scope: resolvedItem.scope,
                direction: resolvedItem.direction || null,
                job_name: resolvedItem.job_name || null,
                item_name: resolvedItem.item_name || null,
                item_sku: resolvedItem.item_sku || null,
                quantity: resolvedItem.quantity ?? null,
                unit: resolvedItem.unit || null,
                storage_bucket: STORAGE_BUCKET,
                storage_path: resolvedItem.storage_path,
                public_url: pubData?.publicUrl || '',
                file_size: resolvedItem.file_size || blob.size || null,
                mime_type: 'image/jpeg',
                notes: resolvedItem.notes || null,
                captured_by: resolvedItem.captured_by || null,
                captured_by_name: resolvedItem.captured_by_name || 'Nhân viên',
                captured_at: resolvedItem.captured_at,
              },
            ],
            { onConflict: 'id', ignoreDuplicates: true }
          )
          if (dbErr) throw dbErr
          synced++
        } catch {
          remaining.push(resolvedItem)
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem(OFFLINE_IMAGES_KEY, JSON.stringify(remaining))
      } else {
        localStorage.removeItem(OFFLINE_IMAGES_KEY)
      }
      return synced
    } catch {
      return 0
    }
  })()

  try {
    return await inFlightWebImageSyncPromise
  } finally {
    inFlightWebImageSyncPromise = null
  }
}

export async function getShiftOperationImages(shiftId: string): Promise<OperationImageRecord[]> {
  const localQueue: OperationImageRecord[] = (() => {
    try {
      const raw = localStorage.getItem(OFFLINE_IMAGES_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })()
  const localForShift = localQueue.filter(i => i.shift_id === shiftId)

  if (shiftId.startsWith('local_')) {
    return localForShift
  }

  try {
    const { data, error } = await (supabase.from('operation_images') as any)
      .select('*')
      .eq('shift_id', shiftId)
      .order('captured_at', { ascending: false })
    if (error) throw error
    const hidden = await reconcileHiddenIds('images', 'operation_images')
    return [...localForShift, ...((data || []) as OperationImageRecord[])].filter(
      img => !hidden.has(img.id)
    )
  } catch {
    const hidden = await reconcileHiddenIds('images', 'operation_images')
    return localForShift.filter(img => !hidden.has(img.id))
  }
}

export async function listSystemOperationImages(params: {
  systemCode: string
  companyId?: string | null
  limit?: number
}): Promise<OperationImageRecord[]> {
  const baseSys = normalizeBaseSystemCode(params.systemCode)
  const localForSys: OperationImageRecord[] = (() => {
    try {
      const raw = localStorage.getItem(OFFLINE_IMAGES_KEY)
      const list: OperationImageRecord[] = raw ? JSON.parse(raw) : []
      return list.filter(
        i =>
          normalizeBaseSystemCode(i.system_code) === baseSys &&
          (!params.companyId || !i.company_id || i.company_id === params.companyId)
      )
    } catch {
      return []
    }
  })()

  try {
    let query = (supabase.from('operation_images') as any)
      .select('*')
      .eq('system_code', baseSys)
      .order('captured_at', { ascending: false })
      .limit(params.limit || 300)

    if (params.companyId) {
      query = query.eq('company_id', params.companyId)
    }

    const { data, error } = await query
    if (error) throw error
    const hidden = await reconcileHiddenIds('images', 'operation_images')
    return [...localForSys, ...((data || []) as OperationImageRecord[])].filter(
      img => !hidden.has(img.id)
    )
  } catch {
    const hidden = await reconcileHiddenIds('images', 'operation_images')
    return localForSys.filter(img => !hidden.has(img.id))
  }
}

export async function deleteOperationImage(img: OperationImageRecord): Promise<void> {
  if (img.is_offline || img.id.startsWith('local_')) {
    try {
      const raw = localStorage.getItem(OFFLINE_IMAGES_KEY)
      if (raw) {
        const list: OperationImageRecord[] = JSON.parse(raw)
        localStorage.setItem(
          OFFLINE_IMAGES_KEY,
          JSON.stringify(list.filter(x => x.id !== img.id))
        )
      }
    } catch {}
    return
  }

  const bypass = await canBypassOperationApproval('delete_image', img.system_code)
  if (bypass) {
    if (img.storage_path) {
      await supabase.storage.from('operation-images').remove([img.storage_path]).catch(() => {})
    }
    const { error } = await (supabase.from('operation_images') as any).delete().eq('id', img.id)
    if (error) throw error
    return
  }

  await submitScannerApprovalRequest({
    systemCode: img.system_code,
    companyId: img.company_id || null,
    actionType: 'delete_image',
    targetTable: 'operation_images',
    targetId: img.id,
    shiftId: img.shift_id || null,
    shiftName: img.job_name || null,
    targetLabel: img.item_name
      ? `Ảnh SP: ${img.item_name}`
      : img.job_name
      ? `Ảnh công việc: ${img.job_name}`
      : 'Hình ảnh kho',
    beforeData: {
      id: img.id,
      image_url: img.public_url,
      storage_path: img.storage_path,
      item_name: img.item_name,
      shift_name: img.job_name,
      scope: img.scope,
    },
    requestedBy: (img as any).captured_by || null,
    requestedByName: img.captured_by_name || 'Nhân viên Scanner',
    sourceDevice: 'scanner',
  })
  addHiddenId('images', img.id)
}

export async function cleanupExpiredLocalOriginals(
  _systemCode: string,
  _days: number | null
): Promise<void> {
  // No-op on web (browser manages Blob/Storage cache automatically)
}

// ── FOLDERS & GOOGLE DRIVE SYNC ───────────────────────────────
export async function listOperationFolders(
  systemCode: string,
  companyId?: string | null
): Promise<OperationFolder[]> {
  const baseSys = normalizeBaseSystemCode(systemCode)
  let query = (supabase.from('operation_folders') as any)
    .select('*')
    .eq('system_code', baseSys)
    .order('name', { ascending: true })
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as OperationFolder[]
}

export async function createOperationFolder(params: {
  systemCode: string
  companyId?: string | null
  parentId?: string | null
  name: string
  user?: any
}): Promise<OperationFolder> {
  const baseSys = normalizeBaseSystemCode(params.systemCode)
  const { data, error } = await (supabase.from('operation_folders') as any)
    .insert([
      {
        system_code: baseSys,
        company_id: params.companyId || params.user?.company_id || null,
        parent_id: params.parentId || null,
        name: params.name.trim(),
        created_by: params.user?.id || null,
        created_by_name: params.user?.full_name || 'Nhân viên',
      },
    ])
    .select('*')
    .single()
  if (error) throw error
  return data as OperationFolder
}

export async function deleteOperationFolder(folderId: string): Promise<void> {
  const { error } = await (supabase.from('operation_folders') as any)
    .delete()
    .eq('id', folderId)
  if (error) throw error
}

export async function getDriveSettings(systemCode: string): Promise<OperationDriveSettings> {
  const baseSys = normalizeBaseSystemCode(systemCode)
  const { data } = await (supabase.from('operation_drive_settings') as any)
    .select('*')
    .eq('system_code', baseSys)
    .maybeSingle()

  return (
    (data as OperationDriveSettings) || {
      system_code: baseSys,
      webhook_url: '',
      root_folder_name: 'WMS_HinhAnh_Kho',
      auto_sync_enabled: false,
      auto_delete_local_days: null,
    }
  )
}

export async function saveDriveSettings(
  params: OperationDriveSettings & { userId?: string | null }
): Promise<void> {
  const baseSys = normalizeBaseSystemCode(params.system_code)
  const { error } = await (supabase.from('operation_drive_settings') as any).upsert(
    {
      system_code: baseSys,
      company_id: params.company_id || null,
      webhook_url: params.webhook_url.trim(),
      root_folder_name: params.root_folder_name.trim() || 'WMS_HinhAnh_Kho',
      auto_sync_enabled: !!params.auto_sync_enabled,
      auto_delete_local_days:
        params.auto_delete_local_days != null && params.auto_delete_local_days > 0
          ? Number(params.auto_delete_local_days)
          : null,
      updated_by: params.userId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'system_code' }
  )
  if (error) throw error
}

function buildFolderPathMap(folders: OperationFolder[]): Map<string, string> {
  const byId = new Map<string, OperationFolder>()
  folders.forEach(f => byId.set(f.id, f))
  const cache = new Map<string, string>()
  const resolve = (id: string, depth = 0): string => {
    if (depth > 10) return ''
    if (cache.has(id)) return cache.get(id)!
    const node = byId.get(id)
    if (!node) return ''
    const p = node.parent_id ? resolve(node.parent_id, depth + 1) : ''
    const full = p ? `${p}/${node.name}` : node.name
    cache.set(id, full)
    return full
  }
  folders.forEach(f => resolve(f.id))
  return cache
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const res = String(reader.result || '')
      const idx = res.indexOf('base64,')
      resolve(idx >= 0 ? res.slice(idx + 7) : res)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function syncImagesToGoogleDrive(params: {
  images: OperationImageRecord[]
  systemCode: string
  folders: OperationFolder[]
}): Promise<{ syncedCount: number; failedCount: number; errors: string[] }> {
  const baseSys = normalizeBaseSystemCode(params.systemCode)
  const settings = await getDriveSettings(baseSys)
  const webhookUrl = settings.webhook_url?.trim()
  if (!webhookUrl) {
    throw new Error('Chưa cấu hình Google Drive Webhook URL. Vui lòng nhập trong Cài đặt Drive.')
  }

  const rootFolder = settings.root_folder_name?.trim() || 'WMS_HinhAnh_Kho'
  const folderPathMap = buildFolderPathMap(params.folders)

  let syncedCount = 0
  let failedCount = 0
  const errors: string[] = []

  for (const img of params.images) {
    if (img.is_offline || img.drive_file_id) {
      if (img.drive_file_id) syncedCount++
      continue
    }

    try {
      let blob: Blob | null = null
      if (img.local_data_url) {
        blob = dataUrlToBlob(img.local_data_url)
      } else {
        try {
          const res = await fetch(img.public_url)
          if (res.ok) blob = await res.blob()
        } catch {}
        if (!blob && img.storage_path) {
          const bucket = img.storage_bucket || STORAGE_BUCKET
          const { data: dlData, error: dlErr } = await supabase.storage
            .from(bucket)
            .download(img.storage_path)
          if (!dlErr && dlData) {
            blob = dlData
          }
        }
      }
      if (!blob) {
        throw new Error('Không tải được file ảnh từ máy chủ')
      }
      const base64 = await blobToBase64(blob)

      const dt = new Date(img.captured_at || Date.now())
      const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      const customFolder = img.folder_id ? folderPathMap.get(img.folder_id) : null
      const subName =
        customFolder || (img.job_name ? img.job_name.replace(/[\\/:*?"<>|]/g, '_') : 'Chung')
      const folderPath = `${baseSys}/${ym}/${subName}`
      const safeItem = (img.item_name || img.scope || 'anh')
        .replace(/[\\/:*?"<>|]/g, '_')
        .slice(0, 40)
      const filename = `${safeItem}_${dt.getTime()}.jpg`

      const driveRes = await fetch('/api/operations/drive-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          rootFolder,
          folderPath,
          filename,
          mimeType: img.mime_type || 'image/jpeg',
          base64,
        }),
      })

      const driveJson = await driveRes.json()
      if (!driveRes.ok || !driveJson?.success) {
        throw new Error(driveJson?.error || `HTTP ${driveRes.status}`)
      }

      await (supabase.from('operation_images') as any)
        .update({
          drive_file_id: driveJson.fileId || null,
          drive_web_url: driveJson.fileUrl || null,
          drive_synced_at: new Date().toISOString(),
        })
        .eq('id', img.id)

      syncedCount++
    } catch (e: any) {
      failedCount++
      errors.push(`${img.item_name || img.id}: ${e?.message || e}`)
    }
  }

  return { syncedCount, failedCount, errors }
}
