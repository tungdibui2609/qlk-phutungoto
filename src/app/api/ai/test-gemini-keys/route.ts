import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function maskKey(k: string): string {
  if (k.length <= 14) return k
  return `${k.slice(0, 8)}...${k.slice(-4)}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rawKeys: string[] = Array.isArray(body?.apiKeys)
      ? body.apiKeys.map((k: any) => String(k || '').trim()).filter(Boolean).slice(0, 20)
      : []
    const model = String(body?.model || 'gemini-2.5-flash').trim()

    if (rawKeys.length === 0) {
      return NextResponse.json({ error: 'Chưa có API Key nào để kiểm tra' }, { status: 400 })
    }

    const results = await Promise.all(
      rawKeys.map(async (key, idx) => {
        const masked = maskKey(key)
        const t0 = Date.now()
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            model
          )}:generateContent?key=${encodeURIComponent(key)}`

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'Reply OK' }] }],
              generationConfig: { maxOutputTokens: 4, temperature: 0 },
            }),
          })
          const ms = Date.now() - t0

          if (res.ok) {
            return {
              index: idx + 1,
              masked,
              status: 'ok' as const,
              message: `Hoạt động tốt (${ms}ms)`,
            }
          }

          if (res.status === 429) {
            return {
              index: idx + 1,
              masked,
              status: 'quota' as const,
              message: `Key đúng nhưng đang hết lượt tạm thời (429 · ${ms}ms)`,
            }
          }

          if (res.status === 503) {
            return {
              index: idx + 1,
              masked,
              status: 'quota' as const,
              message: `Key đúng — Server Google đang quá tải tạm thời (503 · ${ms}ms)`,
            }
          }

          const errJson = await res.json().catch(() => null)
          const errMsg = errJson?.error?.message || `HTTP ${res.status}`
          return {
            index: idx + 1,
            masked,
            status: res.status === 400 || res.status === 403 ? ('invalid' as const) : ('error' as const),
            message: errMsg.slice(0, 140),
          }
        } catch (e: any) {
          return {
            index: idx + 1,
            masked,
            status: 'error' as const,
            message: e?.message || 'Lỗi kết nối mạng',
          }
        }
      })
    )

    return NextResponse.json({ results, model })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Lỗi kiểm tra API Key' },
      { status: 500 }
    )
  }
}
