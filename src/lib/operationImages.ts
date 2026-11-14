import { supabase } from './supabaseClient'

export const OPERATION_IMAGES_BUCKET = 'operation-images'

export type OperationImageScope = 'journal' | 'sub_shift' | 'shift'

export interface OperationImageRecord {
    id: string
    company_id?: string | null
    system_code: string
    shift_id: string
    sub_shift_id?: string | null
    journal_id?: string | null
    folder_id?: string | null
    scope: OperationImageScope
    direction?: 'in' | 'out' | null
    job_name?: string | null
    item_name?: string | null
    item_sku?: string | null
    quantity?: number | null
    unit?: string | null
    storage_bucket: string
    storage_path: string
    public_url: string
    file_size?: number | null
    mime_type?: string | null
    captured_by?: string | null
    captured_by_name?: string | null
    captured_at: string
    notes?: string | null
    drive_file_id?: string | null
    drive_web_url?: string | null
    drive_synced_at?: string | null
    created_at?: string
}

export interface PendingWebImage {
    localId: string
    file: File
    previewUrl: string
}

export function normalizeBaseSystemCode(systemCode?: string | null): string {
    return String(systemCode || '').replace(/__solieu$/i, '').trim()
}

export function generateUuidV4(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}

export interface WatermarkMeta {
    systemCode: string
    jobName?: string | null
    itemName?: string | null
    quantity?: number | null
    unit?: string | null
    direction?: 'in' | 'out' | null
    capturedByName?: string | null
    capturedAt?: Date
    verifyCode?: string
}

const WEEKDAYS_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

function drawWatermarkOnCanvas(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    meta: WatermarkMeta
) {
    const dt = meta.capturedAt || new Date()
    const hh = String(dt.getHours()).padStart(2, '0')
    const mm = String(dt.getMinutes()).padStart(2, '0')
    const timeStr = `${hh}:${mm}`
    const dateStr = `${dt.getDate()} Tháng ${dt.getMonth() + 1}, ${dt.getFullYear()}`
    const weekdayStr = WEEKDAYS_VI[dt.getDay()]

    // Scale theo cạnh ngắn hơn để ảnh dọc hay ngang đều cân đối
    const baseScale = Math.min(width, height) / 1080
    const pad = Math.round(34 * baseScale)

    // 1. Lớp nền gradient đen mờ ở đáy ảnh giúp chữ nổi bật
    const gradHeight = Math.round(height * 0.34)
    const grad = ctx.createLinearGradient(0, height - gradHeight, 0, height)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.45, 'rgba(0,0,0,0.42)')
    grad.addColorStop(1, 'rgba(0,0,0,0.78)')
    ctx.fillStyle = grad
    ctx.fillRect(0, height - gradHeight, width, gradHeight)

    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.75)'
    ctx.shadowBlur = Math.max(2, Math.round(6 * baseScale))
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = Math.max(1, Math.round(2 * baseScale))

    // Thu thập các dòng info ở dưới cùng (vẽ từ dưới lên)
    const lines: { text: string; color: string; bold?: boolean; size: number }[] = []

    if (meta.capturedByName) {
        lines.push({
            text: `👤 NV: ${meta.capturedByName}`,
            color: '#e2e8f0',
            size: Math.round(26 * baseScale),
        })
    }

    if (meta.itemName || meta.quantity != null) {
        const dirLabel = meta.direction === 'in' ? 'NHẬP +' : meta.direction === 'out' ? 'XUẤT -' : ''
        const qtyStr =
            meta.quantity != null ? `${dirLabel}${meta.quantity}${meta.unit ? ` ${meta.unit}` : ''}` : ''
        const itemText = [meta.itemName ? `📦 ${meta.itemName}` : '', qtyStr ? `SL: ${qtyStr}` : '']
            .filter(Boolean)
            .join('  |  ')
        lines.push({
            text: itemText,
            color: meta.direction === 'out' ? '#fda4af' : '#fbbf24',
            bold: true,
            size: Math.round(28 * baseScale),
        })
    }

    if (meta.jobName) {
        lines.push({
            text: `📍 ${meta.jobName}`,
            color: '#ffffff',
            bold: true,
            size: Math.round(28 * baseScale),
        })
    }

    // Vẽ các dòng từ dưới lên (dòng cuối nằm cách đáy `pad`)
    let cursorY = height - pad
    const maxTextWidth = width - pad * 2 - Math.round(140 * baseScale)
    for (const ln of lines) {
        ctx.font = `${ln.bold ? '700' : '500'} ${ln.size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        ctx.fillStyle = ln.color
        let txt = ln.text
        while (ctx.measureText(txt).width > maxTextWidth && txt.length > 8) {
            txt = txt.slice(0, -2) + '…'
        }
        ctx.textBaseline = 'bottom'
        ctx.fillText(txt, pad, cursorY)
        cursorY -= Math.round(ln.size * 1.38)
    }

    // 2. Vẽ Giờ to + vạch vàng + Ngày/Thứ ngay phía trên các dòng info
    const timeFontSize = Math.round(74 * baseScale)
    ctx.font = `800 ${timeFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'bottom'
    const timeY = cursorY - Math.round(8 * baseScale)
    ctx.fillText(timeStr, pad, timeY)
    const timeW = ctx.measureText(timeStr).width

    // Vạch vàng dọc
    const barX = pad + timeW + Math.round(16 * baseScale)
    const barW = Math.max(3, Math.round(6 * baseScale))
    const barH = Math.round(timeFontSize * 0.78)
    ctx.fillStyle = '#f59e0b'
    ctx.fillRect(barX, timeY - barH - Math.round(6 * baseScale), barW, barH)

    // Ngày & Thứ bên phải vạch vàng
    const dateX = barX + barW + Math.round(14 * baseScale)
    const dateFontSize = Math.round(27 * baseScale)
    ctx.font = `700 ${dateFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(dateStr, dateX, timeY - Math.round(dateFontSize * 1.15))
    ctx.font = `600 ${Math.round(25 * baseScale)}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.fillStyle = '#f8fafc'
    ctx.fillText(weekdayStr, dateX, timeY - Math.round(4 * baseScale))

    // 3. Nhãn xác thực góc phải dưới + chữ dọc nhỏ
    const badgeSize = Math.round(24 * baseScale)
    ctx.textAlign = 'right'
    ctx.font = `800 ${badgeSize}px system-ui, -apple-system, sans-serif`
    ctx.fillStyle = '#fbbf24'
    ctx.fillText('WMS Mark', width - pad, height - pad - Math.round(22 * baseScale))
    ctx.font = `600 ${Math.round(18 * baseScale)}px system-ui, -apple-system, sans-serif`
    ctx.fillStyle = '#e2e8f0'
    ctx.fillText('100% Chân thực', width - pad, height - pad)

    // Chữ dọc mờ bên cạnh phải
    const verifyCode = meta.verifyCode || Math.random().toString(36).substring(2, 10).toUpperCase()
    ctx.save()
    ctx.translate(width - Math.round(18 * baseScale), height - pad - Math.round(64 * baseScale))
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'left'
    ctx.font = `600 ${Math.round(16 * baseScale)}px monospace`
    ctx.fillStyle = 'rgba(255,255,255,0.68)'
    ctx.fillText(`© ${verifyCode}  WMS Verified`, 0, 0)
    ctx.restore()

    ctx.restore()
}

export async function compressImageFile(
    file: File,
    maxDimension = 1600,
    quality = 0.78,
    watermark?: WatermarkMeta | null
): Promise<{ blob: Blob; mimeType: string }> {
    if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
        return { blob: file, mimeType: file.type || 'image/jpeg' }
    }

    return new Promise((resolve) => {
        const img = new Image()
        const objectUrl = URL.createObjectURL(file)

        img.onload = () => {
            URL.revokeObjectURL(objectUrl)
            let { width, height } = img
            if (width > maxDimension || height > maxDimension) {
                if (width >= height) {
                    height = Math.round((height * maxDimension) / width)
                    width = maxDimension
                } else {
                    width = Math.round((width * maxDimension) / height)
                    height = maxDimension
                }
            }

            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                resolve({ blob: file, mimeType: file.type || 'image/jpeg' })
                return
            }
            ctx.drawImage(img, 0, 0, width, height)
            if (watermark) {
                try {
                    const enabled =
                        typeof window === 'undefined' ||
                        window.localStorage.getItem('wms_watermark_enabled') !== 'false'
                    if (enabled) {
                        drawWatermarkOnCanvas(ctx, width, height, watermark)
                    }
                } catch {
                    // Không làm gián đoạn upload nếu vẽ watermark lỗi
                }
            }
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve({ blob, mimeType: 'image/jpeg' })
                    } else {
                        resolve({ blob: file, mimeType: file.type || 'image/jpeg' })
                    }
                },
                'image/jpeg',
                quality
            )
        }

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            resolve({ blob: file, mimeType: file.type || 'image/jpeg' })
        }

        img.src = objectUrl
    })
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
            const result = typeof reader.result === 'string' ? reader.result : ''
            const commaIdx = result.indexOf(',')
            resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}

export function getOperationImageDisplayUrl(img: Partial<OperationImageRecord>): string {
    if (img.drive_file_id) {
        return `/api/so-lieu/drive-image?id=${encodeURIComponent(img.drive_file_id)}`
    }
    return img.public_url || ''
}

export function normalizeSearchText(str?: string | null): string {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim()
}

export function buildOperationImageFileName(params: {
    capturedAt?: Date
    direction?: 'in' | 'out' | null
    scope?: OperationImageScope
    itemSku?: string | null
    itemName?: string | null
    jobName?: string | null
    quantity?: number | null
    unit?: string | null
}): string {
    const dt = params.capturedAt || new Date()
    const stamp = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(
        dt.getDate()
    ).padStart(2, '0')}_${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}`
    const dirTag = params.direction === 'in' ? 'NHAP' : params.direction === 'out' ? 'XUAT' : 'CV'
    const rawCode = params.itemSku?.trim() || params.itemName?.trim() || params.jobName?.trim() || params.scope || 'ANH'
    const cleanCode = rawCode
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[\\/:*?"<>|\s]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32)
    const qtyTag =
        params.quantity != null
            ? `_${params.quantity}${
                  params.unit
                      ? params.unit
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .replace(/[\\/:*?"<>|\s]+/g, '')
                            .slice(0, 10)
                      : ''
              }`
            : ''
    const rand = Math.random().toString(36).slice(2, 6)
    return `${stamp}_${dirTag}_${cleanCode}${qtyTag}_${rand}.jpg`
}

export async function uploadOperationImages(params: {
    files: File[]
    systemCode: string
    companyId?: string | null
    shiftId: string
    subShiftId?: string | null
    journalId?: string | null
    folderId?: string | null
    scope: OperationImageScope
    direction?: 'in' | 'out' | null
    jobName?: string | null
    itemName?: string | null
    itemSku?: string | null
    quantity?: number | null
    unit?: string | null
    capturedBy?: string | null
    capturedByName?: string | null
    notes?: string | null
}): Promise<OperationImageRecord[]> {
    if (!params.files || params.files.length === 0) return []

    const baseSys = normalizeBaseSystemCode(params.systemCode)
    const now = new Date()
    const inserted: OperationImageRecord[] = []

    for (const file of params.files) {
        const { blob, mimeType } = await compressImageFile(file, 1600, 0.78, {
            systemCode: baseSys,
            jobName: params.jobName,
            itemName: params.itemName,
            quantity: params.quantity,
            unit: params.unit,
            direction: params.direction,
            capturedByName: params.capturedByName,
            capturedAt: now,
        })
        const base64 = await blobToBase64(blob)
        const fileName = buildOperationImageFileName({
            capturedAt: now,
            direction: params.direction,
            scope: params.scope,
            itemSku: params.itemSku,
            itemName: params.itemName,
            jobName: params.jobName,
            quantity: params.quantity,
            unit: params.unit,
        })

        const res = await fetch('/api/so-lieu/drive-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'upload_direct',
                systemCode: baseSys,
                base64,
                mimeType,
                filename: fileName,
                metadata: {
                    company_id: params.companyId || null,
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
                    file_size: blob.size || file.size || null,
                    captured_by: params.capturedBy || null,
                    captured_by_name: params.capturedByName || null,
                    captured_at: now.toISOString(),
                    notes: params.notes || null,
                },
            }),
        })

        const json = await res.json()
        if (!res.ok || !json?.success || !json?.image) {
            throw new Error(json?.error || 'Không thể tải ảnh lên Google Drive')
        }
        inserted.push(json.image as OperationImageRecord)
    }

    return inserted
}

export async function listOperationImages(params: {
    systemCode: string
    companyId?: string | null
    shiftId?: string
    folderId?: string | null
    fromDate?: string
    toDate?: string
    direction?: 'all' | 'in' | 'out' | 'shift'
    limit?: number
}): Promise<OperationImageRecord[]> {
    const baseSys = normalizeBaseSystemCode(params.systemCode)
    let query = (supabase.from('operation_images' as any) as any)
        .select('*')
        .eq('system_code', baseSys)
        .order('captured_at', { ascending: false })
        .limit(params.limit || 300)

    if (params.companyId) {
        query = query.eq('company_id', params.companyId)
    }
    if (params.shiftId) {
        query = query.eq('shift_id', params.shiftId)
    }
    if (params.folderId) {
        query = query.eq('folder_id', params.folderId)
    }
    if (params.fromDate) {
        query = query.gte('captured_at', `${params.fromDate}T00:00:00`)
    }
    if (params.toDate) {
        query = query.lte('captured_at', `${params.toDate}T23:59:59.999`)
    }
    if (params.direction === 'in') {
        query = query.eq('direction', 'in')
    } else if (params.direction === 'out') {
        query = query.eq('direction', 'out')
    } else if (params.direction === 'shift') {
        query = query.in('scope', ['shift', 'sub_shift'])
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as OperationImageRecord[]
}

export async function deleteOperationImage(image: OperationImageRecord): Promise<void> {
    if (image.storage_path) {
        await supabase.storage
            .from(image.storage_bucket || OPERATION_IMAGES_BUCKET)
            .remove([image.storage_path])
    }
    const { error } = await (supabase.from('operation_images' as any) as any)
        .delete()
        .eq('id', image.id)

    if (error) throw error
}

export async function moveOperationImageToFolder(imageId: string, folderId: string | null): Promise<void> {
    const { error } = await (supabase.from('operation_images' as any) as any)
        .update({ folder_id: folderId })
        .eq('id', imageId)

    if (error) throw error
}
