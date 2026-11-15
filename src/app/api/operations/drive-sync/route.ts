import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { webhookUrl, rootFolder, folderPath, filename, mimeType, base64 } = body || {}

    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
      return NextResponse.json(
        { success: false, error: 'Webhook URL không hợp lệ' },
        { status: 400 }
      )
    }

    const upstreamRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rootFolder,
        folderPath,
        filename,
        mimeType: mimeType || 'image/jpeg',
        base64,
      }),
      redirect: 'follow',
    })

    const text = await upstreamRes.text()
    try {
      const parsed = JSON.parse(text)
      return NextResponse.json(parsed, { status: upstreamRes.ok ? 200 : 502 })
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: `Apps Script trả về dữ liệu không phải JSON (HTTP ${upstreamRes.status})`,
          raw: text.slice(0, 300),
        },
        { status: 502 }
      )
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi kết nối Google Drive Webhook' },
      { status: 500 }
    )
  }
}
