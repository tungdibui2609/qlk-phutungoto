import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/geminiStampOcr'
import {
  uploadStampImageToGoogleDrive,
  getCompanyStampDriveWebhook,
} from '@/lib/stampDriveUpload'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      action,
      webhookUrl: inputWebhookUrl,
      imageBase64,
      croppedBase64,
      palletStt,
      palletTag,
      palletNotes,
      boxCount = 30,
      boxWeight = 20,
      systemCode = 'KHO_DONG_LANH',
      createdBy,
      createdByName,
      companyId,
    } = body

    // 1. Kiểm tra kết nối (Ping Google Apps Script)
    if (action === 'ping') {
      const targetUrl = (inputWebhookUrl || '').trim() || (await getCompanyStampDriveWebhook(companyId))
      if (!targetUrl) {
        return NextResponse.json(
          { success: false, error: 'Chưa có Webhook URL để kiểm tra' },
          { status: 400 }
        )
      }

      try {
        const pingRes = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'ping' }),
        })
        const pingData: any = await pingRes.json()
        if (pingData.success) {
          return NextResponse.json({
            success: true,
            message: pingData.message || 'Kết nối Google Drive thành công!',
            rootUrl: pingData.rootUrl,
          })
        }
        return NextResponse.json(
          { success: false, error: pingData.error || 'Google Apps Script trả về lỗi' },
          { status: 400 }
        )
      } catch (err: any) {
        return NextResponse.json(
          { success: false, error: `Lỗi kết nối: ${err.message}` },
          { status: 500 }
        )
      }
    }

    // 2. Tải ảnh lên và lưu vào Hàng đợi (Upload & Queue) hoặc Chỉ tải ảnh (Upload Only)
    if (!imageBase64) {
      return NextResponse.json(
        { success: false, error: 'Thiếu dữ liệu ảnh (imageBase64)' },
        { status: 400 }
      )
    }

    const cleanStt = (palletStt || '').trim().toUpperCase()
    if (!cleanStt) {
      return NextResponse.json(
        { success: false, error: 'Thiếu Số thứ tự (STT) Pallet' },
        { status: 400 }
      )
    }

    const admin = createAdminSupabaseClient()
    const webhookUrl = (inputWebhookUrl || '').trim() || (await getCompanyStampDriveWebhook(companyId))

    let finalImageUrl = ''
    let driveFileId: string | null = null
    let driveViewUrl: string | null = null

    // ƯU TIÊN 1: Đẩy thẳng lên Google Drive (Apps Script riêng của con dấu)
    if (webhookUrl) {
      const driveRes = await uploadStampImageToGoogleDrive({
        webhookUrl,
        base64Data: imageBase64,
        palletStt: cleanStt,
      })

      if (driveRes.success && driveRes.fileId) {
        driveFileId = driveRes.fileId
        driveViewUrl = driveRes.viewUrl || null
        finalImageUrl = driveRes.thumbnailUrl || driveRes.viewUrl || `https://drive.google.com/thumbnail?id=${driveRes.fileId}&sz=w1000`
      } else {
        console.warn('[StampQueue] Upload Google Drive thất bại, fallback sang Supabase:', driveRes.error)
      }
    }

    // FALLBACK 2: Lưu vào Supabase Storage nếu chưa có Google Drive webhook hoặc Drive lỗi
    if (!finalImageUrl) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(cleanBase64, 'base64')
      const filePath = `stamp-queue/${cleanStt}_${Date.now()}.jpg`

      const { error: uploadErr } = await admin.storage
        .from('operation-images')
        .upload(filePath, buffer, { contentType: 'image/jpeg', upsert: true })

      if (uploadErr) {
        throw new Error(`Lỗi tải ảnh lên Storage: ${uploadErr.message}`)
      }

      const { data: pubData } = admin.storage
        .from('operation-images')
        .getPublicUrl(filePath)

      finalImageUrl = pubData?.publicUrl || ''
    }

    if (!finalImageUrl) {
      throw new Error('Không tạo được đường dẫn ảnh con dấu')
    }

    // Nếu chỉ tải ảnh để gán vào thùng quét thường (không cần đưa vào hàng đợi duyệt AI)
    if (action === 'upload_only') {
      return NextResponse.json({
        success: true,
        fileId: driveFileId,
        viewUrl: driveViewUrl || finalImageUrl,
        imageUrl: finalImageUrl,
        isGoogleDrive: !!driveFileId,
      })
    }

    // Lưu ảnh crop vùng con dấu (nếu client có gửi) để AI đọc nhanh gấp 3 lần và không tạp âm
    let finalCropUrl: string | null = null
    if (croppedBase64 && typeof croppedBase64 === 'string') {
      try {
        const cleanCrop = croppedBase64.replace(/^data:image\/\w+;base64,/, '')
        const cropBuffer = Buffer.from(cleanCrop, 'base64')
        const cropFilePath = `stamp-queue/crops/${cleanStt}_${Date.now()}.jpg`
        const { error: cropErr } = await admin.storage
          .from('operation-images')
          .upload(cropFilePath, cropBuffer, { contentType: 'image/jpeg', upsert: true })
        if (!cropErr) {
          const { data: cropPub } = admin.storage.from('operation-images').getPublicUrl(cropFilePath)
          finalCropUrl = cropPub?.publicUrl || null
        }
      } catch (cropSaveErr) {
        console.warn('[StampQueue] Lỗi lưu ảnh crop:', cropSaveErr)
      }
    }

    // 3. Thêm bản ghi vào bảng stamp_scan_queue (Dành cho chế độ AI Web Mẹ duyệt)
    const insertPayload: any = {
      system_code: systemCode,
      pallet_stt: cleanStt,
      pallet_tag: palletTag || null,
      pallet_notes: palletNotes || null,
      box_count: Math.max(1, parseInt(String(boxCount), 10) || 30),
      box_weight: parseFloat(String(boxWeight)) || 20,
      image_url: finalImageUrl,
      cropped_image_url: finalCropUrl,
      drive_file_id: driveFileId,
      drive_view_url: driveViewUrl,
      status: 'pending',
      created_by: createdBy || null,
      created_by_name: createdByName || 'Kho',
    }

    let resolvedCompanyId = companyId || null
    if (!resolvedCompanyId && createdBy) {
      const { data: prof } = await admin
        .from('user_profiles')
        .select('company_id')
        .eq('id', createdBy)
        .maybeSingle()
      if (prof?.company_id) {
        resolvedCompanyId = prof.company_id
      }
    }
    if (!resolvedCompanyId) {
      const { data: aiCfg } = await admin
        .from('company_ai_settings')
        .select('company_id')
        .limit(1)
        .maybeSingle()
      if (aiCfg?.company_id) {
        resolvedCompanyId = aiCfg.company_id
      }
    }

    if (resolvedCompanyId) {
      insertPayload.company_id = resolvedCompanyId
    }

    const { data: inserted, error: insertErr } = await admin
      .from('stamp_scan_queue')
      .insert(insertPayload)
      .select()
      .single()

    if (insertErr) {
      throw new Error(`Lỗi lưu hàng đợi CSDL: ${insertErr.message}`)
    }

    return NextResponse.json({
      success: true,
      message: driveFileId
        ? `Đã lưu ảnh lên Google Drive (CON_DAU) và thêm vào Hàng Đợi!`
        : `Đã lưu ảnh và thêm vào Hàng Đợi!`,
      isGoogleDrive: !!driveFileId,
      item: inserted,
    })
  } catch (err: any) {
    console.error('[StampQueueUpload] Lỗi:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi xử lý tải ảnh con dấu' },
      { status: 500 }
    )
  }
}
