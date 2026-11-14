import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServerSupabase() {
    const url = process.env.INTERNAL_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    return createClient(url, key, { auth: { persistSession: false } })
}

function buildFolderPathMap(folders: { id: string; parent_id?: string | null; name: string }[]): Map<string, string> {
    const byId = new Map<string, { id: string; parent_id?: string | null; name: string }>()
    folders.forEach((f) => byId.set(f.id, f))

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
    folders.forEach((f) => resolve(f.id))
    return cache
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { action } = body

        // 1. Test kết nối Webhook
        if (action === 'ping') {
            const webhookUrl = String(body.webhookUrl || '').trim()
            const rootFolder = String(body.rootFolderName || 'WMS_HinhAnh_Kho').trim()
            if (!webhookUrl) {
                return NextResponse.json({ success: false, error: 'Chưa nhập Webhook URL' }, { status: 400 })
            }
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ping', rootFolder }),
            })
            const data = await res.json()
            return NextResponse.json(data)
        }

        // 2. Upload trực tiếp từ Web/iOS lên Google Drive (KHÔNG lưu file lên Supabase Storage)
        if (action === 'upload_direct') {
            const systemCode = String(body.systemCode || '').replace(/__solieu$/i, '').trim()
            const base64 = String(body.base64 || '').trim()
            const mimeType = String(body.mimeType || 'image/jpeg')
            const meta = body.metadata || {}

            if (!systemCode || !base64) {
                return NextResponse.json(
                    { success: false, error: 'Thiếu systemCode hoặc dữ liệu ảnh base64' },
                    { status: 400 }
                )
            }

            const supabase = getServerSupabase()
            const { data: settings } = await supabase
                .from('operation_drive_settings')
                .select('*')
                .eq('system_code', systemCode)
                .maybeSingle()

            const webhookUrl = settings?.webhook_url?.trim()
            if (!webhookUrl) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Chưa cấu hình Google Drive Webhook URL cho kho này. Hãy vào Album Hình Ảnh -> Cài đặt Drive để dán URL Apps Script.',
                    },
                    { status: 400 }
                )
            }

            const rootFolder = settings?.root_folder_name?.trim() || 'WMS_HinhAnh_Kho'
            const dt = new Date(meta.captured_at || Date.now())
            const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`

            let customFolder = ''
            if (meta.folder_id) {
                const { data: folders } = await supabase
                    .from('operation_folders')
                    .select('id, parent_id, name')
                    .eq('system_code', systemCode)
                const folderPathMap = buildFolderPathMap(folders || [])
                customFolder = folderPathMap.get(meta.folder_id) || ''
            }

            const subName =
                customFolder ||
                (meta.job_name ? String(meta.job_name).replace(/[\\/:*?"<>|]/g, '_') : 'Chung')
            const folderPath = `${systemCode}/${ym}/${subName}`

            const safeItem = String(meta.item_name || meta.scope || 'anh')
                .replace(/[\\/:*?"<>|]/g, '_')
                .slice(0, 40)
            const filename = String(body.filename || `${safeItem}_${dt.getTime()}.jpg`)

            const driveRes = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rootFolder,
                    folderPath,
                    filename,
                    mimeType,
                    base64,
                }),
            })

            const driveJson = await driveRes.json()
            if (!driveJson?.success || !driveJson?.fileId) {
                return NextResponse.json(
                    { success: false, error: driveJson?.error || 'Google Drive Webhook trả về lỗi' },
                    { status: 502 }
                )
            }

            const directUrl =
                driveJson.directUrl ||
                `https://lh3.googleusercontent.com/d/${driveJson.fileId}=w1600`

            const { data: inserted, error: insErr } = await supabase
                .from('operation_images')
                .insert({
                    company_id: meta.company_id || null,
                    system_code: systemCode,
                    shift_id: meta.shift_id || null,
                    sub_shift_id: meta.sub_shift_id || null,
                    journal_id: meta.journal_id || null,
                    folder_id: meta.folder_id || null,
                    scope: meta.scope || 'shift',
                    direction: meta.direction || null,
                    job_name: meta.job_name || null,
                    item_name: meta.item_name || null,
                    item_sku: meta.item_sku || null,
                    quantity: meta.quantity ?? null,
                    unit: meta.unit || null,
                    notes: meta.notes || null,
                    storage_bucket: 'google-drive',
                    storage_path: '',
                    public_url: directUrl,
                    file_size: meta.file_size || null,
                    mime_type: mimeType,
                    captured_by: meta.captured_by || null,
                    captured_by_name: meta.captured_by_name || null,
                    captured_at: meta.captured_at || new Date().toISOString(),
                    drive_file_id: driveJson.fileId,
                    drive_web_url: driveJson.fileUrl || directUrl,
                    drive_synced_at: new Date().toISOString(),
                })
                .select('*')
                .single()

            if (insErr) throw insErr

            return NextResponse.json({
                success: true,
                image: inserted,
            })
        }

        // 3. Đồng bộ ảnh legacy lên Google Drive (nếu còn ảnh cũ có storage_path)
        const imageIds: string[] = Array.isArray(body.imageIds) ? body.imageIds : []
        const systemCode = String(body.systemCode || '').replace(/__solieu$/i, '').trim()

        if (!systemCode || imageIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Thiếu systemCode hoặc danh sách imageIds' },
                { status: 400 }
            )
        }

        const supabase = getServerSupabase()

        const { data: settings } = await supabase
            .from('operation_drive_settings')
            .select('*')
            .eq('system_code', systemCode)
            .maybeSingle()

        const webhookUrl = settings?.webhook_url?.trim()
        if (!webhookUrl) {
            return NextResponse.json(
                { success: false, error: 'Chưa cấu hình Google Drive Webhook URL cho kho này.' },
                { status: 400 }
            )
        }

        const rootFolder = settings?.root_folder_name?.trim() || 'WMS_HinhAnh_Kho'

        const [{ data: images, error: imgErr }, { data: folders }] = await Promise.all([
            supabase.from('operation_images').select('*').in('id', imageIds),
            supabase.from('operation_folders').select('id, parent_id, name').eq('system_code', systemCode),
        ])

        if (imgErr) throw imgErr
        const folderPathMap = buildFolderPathMap(folders || [])

        let syncedCount = 0
        let failedCount = 0
        const errors: string[] = []

        for (const img of images || []) {
            if (img.drive_file_id) {
                syncedCount++
                continue
            }

            try {
                // Tải file ảnh từ Supabase Storage
                const { data: fileBlob, error: dlErr } = await supabase.storage
                    .from(img.storage_bucket || 'operation-images')
                    .download(img.storage_path)

                if (dlErr || !fileBlob) {
                    throw new Error(dlErr?.message || 'Không tải được file từ Storage')
                }

                const arrBuf = await fileBlob.arrayBuffer()
                const base64 = Buffer.from(arrBuf).toString('base64')

                const dt = new Date(img.captured_at || Date.now())
                const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
                const customFolder = img.folder_id ? folderPathMap.get(img.folder_id) : null
                const subName = customFolder || (img.job_name ? img.job_name.replace(/[\\/:*?"<>|]/g, '_') : 'Chung')
                const folderPath = `${systemCode}/${ym}/${subName}`

                const safeItem = (img.item_name || img.scope || 'anh').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)
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

                const directUrl =
                    driveJson.directUrl ||
                    (driveJson.fileId ? `https://lh3.googleusercontent.com/d/${driveJson.fileId}=w1600` : null)

                await supabase
                    .from('operation_images')
                    .update({
                        drive_file_id: driveJson.fileId || null,
                        drive_web_url: driveJson.fileUrl || null,
                        ...(directUrl ? { public_url: directUrl } : {}),
                        drive_synced_at: new Date().toISOString(),
                    })
                    .eq('id', img.id)

                syncedCount++
            } catch (e: any) {
                failedCount++
                errors.push(`${img.item_name || img.id}: ${e?.message || e}`)
            }
        }

        return NextResponse.json({
            success: true,
            syncedCount,
            failedCount,
            errors,
        })
    } catch (err: any) {
        return NextResponse.json(
            { success: false, error: err?.message || 'Lỗi máy chủ đồng bộ Drive' },
            { status: 500 }
        )
    }
}
