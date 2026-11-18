import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import {
  createAdminSupabaseClient,
  resolveGeminiConfig,
  fetchServerStampDictionary,
  recognizeStampWithGemini,
  buildDecodedStampPayload,
} from '@/lib/geminiStampOcr'

async function imageUrlToBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  if (imageUrl.startsWith('data:')) {
    const match = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/)
    if (match) {
      return { mimeType: match[1], base64: match[2] }
    }
  }
  const res = await fetch(imageUrl)
  if (!res.ok) {
    throw new Error(`Không tải được ảnh (${res.status})`)
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const buf = Buffer.from(await res.arrayBuffer())
  return {
    mimeType: contentType.split(';')[0] || 'image/jpeg',
    base64: buf.toString('base64'),
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const admin = createAdminSupabaseClient()
    let companyId: string | null = null
    if (user?.id) {
      const { data: profile } = await admin
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle()
      companyId = (profile as any)?.company_id || null
    }
    const geminiCfg = await resolveGeminiConfig(companyId)

    if (!geminiCfg) {
      return NextResponse.json(
        {
          success: false,
          error: 'Chưa kích hoạt Gemini API Key. Vui lòng nhập Key ở mục Cấu hình Gemini AI ngay trên trang này.',
        },
        { status: 400 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const ids: string[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined
    const systemCode: string | undefined = body?.systemCode

    let query = admin
      .from('stamp_scan_queue')
      .select('*')
      .order('created_at', { ascending: true })

    if (ids && ids.length > 0) {
      // Khi chọn cụ thể các bản ghi để giải mã, lọc trực tiếp theo danh sách id
      query = query.in('id', ids)
    } else {
      // Quét lô hàng loạt: lấy các bản ghi của công ty hiện tại hoặc bản ghi cũ chưa gán company_id
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`)
      }
      if (systemCode) {
        query = query.eq('system_code', systemCode)
      }
      query = query.in('status', ['pending', 'error']).limit(20)
    }

    const { data: queueItems, error: fetchErr } = await query
    if (fetchErr) throw fetchErr

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        decodedCount: 0,
        errorCount: 0,
        message: 'Không có ảnh nào đang chờ giải mã.',
      })
    }

    const dict = await fetchServerStampDictionary(companyId)
    let decodedCount = 0
    let errorCount = 0

    for (let i = 0; i < queueItems.length; i++) {
      const item: any = queueItems[i]
      try {
        // Ưu tiên ảnh crop vùng con dấu để AI đọc siêu nhanh (~0.5s) và không bị nhiễu watermark ngày giờ
        const targetUrl = item.cropped_image_url || item.image_url
        let imgPayload = await imageUrlToBase64(targetUrl)

        let gemRes: any
        try {
          gemRes = await recognizeStampWithGemini({
            imageBase64: imgPayload.base64,
            mimeType: imgPayload.mimeType,
            apiKey: geminiCfg.apiKey,
            apiKeys: geminiCfg.apiKeys,
            model: geminiCfg.model,
          })
        } catch (firstErr) {
          // Nếu ảnh crop lỗi mà có ảnh gốc thì fallback sang đọc ảnh gốc
          if (item.cropped_image_url && item.image_url && targetUrl !== item.image_url) {
            console.warn('[stamp-queue/decode] Đọc ảnh crop thất bại, fallback sang ảnh gốc:', firstErr)
            imgPayload = await imageUrlToBase64(item.image_url)
            gemRes = await recognizeStampWithGemini({
              imageBase64: imgPayload.base64,
              mimeType: imgPayload.mimeType,
              apiKey: geminiCfg.apiKey,
              apiKeys: geminiCfg.apiKeys,
              model: geminiCfg.model,
            })
          } else {
            throw firstErr
          }
        }

        const decoded = buildDecodedStampPayload(gemRes.line1, gemRes.line2, dict)

        const updateData: any = {
          stamp_line1: gemRes.line1,
          stamp_line2: gemRes.line2,
          decoded_json: decoded,
          status: 'decoded',
          error_message: null,
        }
        if (!item.company_id && companyId) {
          updateData.company_id = companyId
        }

        await admin
          .from('stamp_scan_queue')
          .update(updateData)
          .eq('id', item.id)

        decodedCount++
      } catch (err: any) {
        errorCount++
        await admin
          .from('stamp_scan_queue')
          .update({
            status: 'error',
            error_message: err?.message || 'Lỗi giải mã Gemini',
          })
          .eq('id', item.id)
      }

      // Giãn nhẹ 350ms giữa các ảnh nếu chạy lô nhiều ảnh
      if (i < queueItems.length - 1) {
        await new Promise(r => setTimeout(r, 350))
      }
    }

    return NextResponse.json({
      success: true,
      total: queueItems.length,
      decodedCount,
      errorCount,
    })
  } catch (err: any) {
    console.error('[stamp-queue/decode] Error:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi xử lý giải mã hàng loạt' },
      { status: 500 }
    )
  }
}
