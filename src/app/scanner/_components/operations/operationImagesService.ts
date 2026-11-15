import { supabase } from '@/lib/supabaseClient'

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
  storage_path: string
  public_url: string
  file_size_bytes?: number | null
  width?: number | null
  height?: number | null
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

const STORAGE_BUCKET = 'operation-proofs'
const WATERMARK_ENABLED_KEY = 'op_watermark_enabled_v1'
const LOCAL_AUTO_DELETE_DAYS_KEY = 'op_local_auto_delete_days_v1'
const OFFLINE_IMAGES_KEY = 'op_offline_images_queue_v1'

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

export async function getWatermarkEnabled(): Promise<boolean> {
  try {
    const v = localStorage.getItem(WATERMARK_ENABLED_KEY)
    if (v === null) return true
    return v === '1' || v === 'true'
  } catch {
    return true
  }
}

export async function setWatermarkEnabled(enabled: boolean): Promise<void> {
  try {
    localStorage.setItem(WATERMARK_ENABLED_KEY, enabled ? '1' : '0')
  } catch {}
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
    return `https://drive.google.com/thumbnail?id=${img.drive_file_id}&sz=w1200`
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
  const wmEnabled = await getWatermarkEnabled()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh'))
    reader.onload = () => {
      const srcUrl = String(reader.result || '')
      const img = new window.Image()
      img.onerror = () => reject(new Error('Không thể giải mã ảnh'))
      img.onload = () => {
        const maxDim = 1600
        let w = img.naturalWidth || img.width || 1200
        let h = img.naturalHeight || img.height || 900
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round((h * maxDim) / w)
            w = maxDim
          } else {
            w = Math.round((w * maxDim) / h)
            h = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve({ dataUrl: srcUrl, width: w, height: h, fileSize: file.size, mimeType: 'image/jpeg' })
          return
        }

        ctx.drawImage(img, 0, 0, w, h)

        if (wmEnabled && watermarkMeta) {
          const lines: string[] = []
          const nowStr = new Date().toLocaleString('vi-VN')
          const sysLabel = normalizeBaseSystemCode(watermarkMeta.systemCode)
          lines.push(`🕒 ${nowStr} • ${sysLabel}`)
          if (watermarkMeta.jobName) {
            lines.push(`📋 CV: ${watermarkMeta.jobName}`)
          }
          if (watermarkMeta.itemName) {
            const dirStr =
              watermarkMeta.direction === 'in'
                ? 'NHẬP (+)'
                : watermarkMeta.direction === 'out'
                  ? 'XUẤT (-)'
                  : ''
            const qtyStr =
              watermarkMeta.quantity != null
                ? `${watermarkMeta.quantity} ${watermarkMeta.unit || ''}`
                : ''
            lines.push(`📦 ${dirStr} ${watermarkMeta.itemName} ${qtyStr}`.trim())
          }
          if (watermarkMeta.userName) {
            lines.push(`👤 ${watermarkMeta.userName}`)
          }

          const fontSize = Math.max(14, Math.round(Math.min(w, h) * 0.024))
          const lineHeight = Math.round(fontSize * 1.38)
          const pad = Math.round(fontSize * 0.8)
          const boxH = lines.length * lineHeight + pad * 1.6

          ctx.fillStyle = 'rgba(15, 23, 42, 0.72)'
          ctx.fillRect(0, h - boxH, w, boxH)

          ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
          ctx.fillStyle = '#f8fafc'
          lines.forEach((line, i) => {
            ctx.fillText(line, pad, h - boxH + pad + (i + 0.8) * lineHeight)
          })
        }

        const outDataUrl = canvas.toDataURL('image/jpeg', 0.82)
        canvas.toBlob(
          blob => {
            resolve({
              dataUrl: outDataUrl,
              blob: blob || undefined,
              width: w,
              height: h,
              fileSize: blob?.size || file.size,
              mimeType: 'image/jpeg',
            })
          },
          'image/jpeg',
          0.82
        )
      }
      img.src = srcUrl
    }
    reader.readAsDataURL(file)
  })
}

export async function capturePhotoWithCamera(): Promise<PickedOperationPhoto | null> {
  const files = await pickFilesViaInput({ capture: true, multiple: false, maxCount: 1 })
  if (!files.length) return null
  return processFileToPhoto(files[0])
}

export async function pickPhotosFromLibrary(maxCount = 8): Promise<PickedOperationPhoto[]> {
  const files = await pickFilesViaInput({ capture: false, multiple: true, maxCount })
  if (!files.length) return []
  const results: PickedOperationPhoto[] = []
  for (const f of files) {
    try {
      const p = await processFileToPhoto(f)
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

    try {
      const blob = img.blob || dataUrlToBlob(img.dataUrl)
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false })
      if (upErr) throw upErr

      const { data: pubData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
      const publicUrl = pubData?.publicUrl || ''

      const insertRow = {
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
        storage_path: storagePath,
        public_url: publicUrl,
        file_size_bytes: img.fileSize || blob.size || null,
        width: img.width || null,
        height: img.height || null,
        mime_type: 'image/jpeg',
        notes: params.notes || null,
        captured_by: params.user?.id || null,
        captured_by_name: params.user?.full_name || params.user?.email || 'Nhân viên',
        captured_at: now.toISOString(),
      }

      const { data: rowData, error: dbErr } = await (supabase.from('operation_images') as any)
        .insert([insertRow])
        .select('*')
        .single()
      if (dbErr) throw dbErr
      createdRecords.push(rowData as OperationImageRecord)
    } catch (e) {
      console.warn('Upload operation image failed, saving offline:', e)
      const offlineRec: OperationImageRecord = {
        id: `local_img_${Date.now()}_${rand}`,
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
        storage_path: storagePath,
        public_url: img.dataUrl,
        local_data_url: img.dataUrl,
        file_size_bytes: img.fileSize || null,
        width: img.width || null,
        height: img.height || null,
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

export async function syncOfflineOperationImages(): Promise<number> {
  try {
    const raw = localStorage.getItem(OFFLINE_IMAGES_KEY)
    if (!raw) return 0
    const queue: OperationImageRecord[] = JSON.parse(raw)
    if (!queue.length) return 0

    const remaining: OperationImageRecord[] = []
    let synced = 0

    for (const item of queue) {
      if (!item.local_data_url) continue
      try {
        const blob = dataUrlToBlob(item.local_data_url)
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(item.storage_path, blob, { contentType: 'image/jpeg', upsert: true })
        if (upErr) throw upErr
        const { data: pubData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(item.storage_path)

        const { error: dbErr } = await (supabase.from('operation_images') as any).insert([
          {
            company_id: item.company_id || null,
            system_code: item.system_code,
            shift_id: item.shift_id,
            sub_shift_id: item.sub_shift_id || null,
            journal_id: item.journal_id || null,
            folder_id: item.folder_id || null,
            scope: item.scope,
            direction: item.direction || null,
            job_name: item.job_name || null,
            item_name: item.item_name || null,
            item_sku: item.item_sku || null,
            quantity: item.quantity ?? null,
            unit: item.unit || null,
            storage_path: item.storage_path,
            public_url: pubData?.publicUrl || '',
            file_size_bytes: item.file_size_bytes || blob.size || null,
            width: item.width || null,
            height: item.height || null,
            mime_type: 'image/jpeg',
            notes: item.notes || null,
            captured_by: item.captured_by || null,
            captured_by_name: item.captured_by_name || 'Nhân viên',
            captured_at: item.captured_at,
          },
        ])
        if (dbErr) throw dbErr
        synced++
      } catch {
        remaining.push(item)
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
    return [...localForShift, ...((data || []) as OperationImageRecord[])]
  } catch {
    return localForShift
  }
}

export async function listSystemOperationImages(params: {
  systemCode: string
  companyId?: string | null
  limit?: number
}): Promise<OperationImageRecord[]> {
  const baseSys = normalizeBaseSystemCode(params.systemCode)
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
    return (data || []) as OperationImageRecord[]
  } catch {
    return []
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

  if (img.storage_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([img.storage_path]).catch(() => {})
  }
  const { error } = await (supabase.from('operation_images') as any).delete().eq('id', img.id)
  if (error) throw error
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
      const res = await fetch(img.public_url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
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

      const driveRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootFolder,
          folderPath,
          filename,
          mimeType: img.mime_type || 'image/jpeg',
          base64,
        }),
      })

      const driveJson = await driveRes.json()
      if (!driveJson?.success) {
        throw new Error(driveJson?.error || 'Apps Script trả về lỗi')
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
