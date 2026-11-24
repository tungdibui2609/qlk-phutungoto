import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, resolveGeminiConfig } from '@/lib/geminiStampOcr'

export const runtime = 'nodejs'

const MAX_BATCH_SIZE = 10

// Bộ nhớ xoay vòng & tạm nghỉ key bị 429 (60s) để đợt sau nhảy thẳng sang key kế tiếp
let keyRoundRobinIdx = 0
const keyCooldownUntil = new Map<string, number>()

function getOrderedGeminiKeys(keys: string[]): string[] {
  if (keys.length <= 1) return keys
  const now = Date.now()
  const start = keyRoundRobinIdx % keys.length
  keyRoundRobinIdx = (keyRoundRobinIdx + 1) % keys.length
  const rotated = [...keys.slice(start), ...keys.slice(0, start)]
  const ready = rotated.filter(k => (keyCooldownUntil.get(k) || 0) <= now)
  const cooling = rotated.filter(k => (keyCooldownUntil.get(k) || 0) > now)
  return [...ready, ...cooling]
}

const BASE_WAREHOUSE_VOCAB = [
  'Dona',
  'Dona A',
  'Dona B',
  'Dona C',
  'Ri 6',
  'Ri 6 A',
  'Ri 6 B',
  'Ri 6 C',
  'Monthong',
  'Musang King',
  'Nito',
  'Múi',
  'Cơm sầu riêng',
  'Nguyên trái',
  'Thùng',
  'Kiện',
  'Pallet',
  'LOT',
  'STT',
  'Thiếu',
  'Dư',
  'Trống',
  'Sai vị trí',
  'Nhầm mã',
  'Rách thùng',
  'Móp thùng',
  'Hàng hồi',
]

function getExtFromMime(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'm4a'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('wav')) return 'wav'
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3'
  return 'webm'
}

interface VoiceDriveConfig {
  webhookUrl: string
  rootFolder: string
}

async function resolveVoiceDriveConfig(systemCode: string): Promise<VoiceDriveConfig | null> {
  try {
    const admin = createAdminSupabaseClient()
    const { data } = await admin
      .from('inventory_voice_drive_settings')
      .select('webhook_url, root_folder_name, is_enabled')
      .eq('system_code', systemCode)
      .maybeSingle()

    if (
      data &&
      data.is_enabled &&
      data.webhook_url &&
      String(data.webhook_url).trim().startsWith('http')
    ) {
      return {
        webhookUrl: String(data.webhook_url).trim(),
        rootFolder: String(data.root_folder_name || 'WMS_GhiAm_KiemKe').trim(),
      }
    }
  } catch (e) {
    console.warn('[VoiceTranscribe] Không đọc được inventory_voice_drive_settings:', e)
  }
  return null
}

function sanitizeDriveSegment(raw?: string | null, fallback = 'Khac', maxLen = 60): string {
  const cleaned = String(raw || '')
    .replace(/[\\/:*?"<>|#%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
  return cleaned || fallback
}

async function uploadAudioToGoogleDrive(
  driveCfg: VoiceDriveConfig | null,
  params: {
    audioBase64: string
    mimeType: string
    systemCode: string
    sessionId: string
    sessionName?: string | null
    positionId: string
    positionCode?: string | null
  }
): Promise<string | null> {
  if (!driveCfg) return null
  try {
    const ext = getExtFromMime(params.mimeType)
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const day = `${ym}-${String(now.getDate()).padStart(2, '0')}`
    const hhmmss = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    const rand = Math.random().toString(36).slice(2, 6)
    const sessionFolder = sanitizeDriveSegment(
      params.sessionName,
      params.sessionId.slice(0, 12),
      60
    )
    const posPrefix = sanitizeDriveSegment(
      params.positionCode,
      params.positionId.slice(0, 12),
      32
    ).replace(/\s+/g, '_')
    const folderPath = `${params.systemCode}/${ym}/${day}/${sessionFolder}`
    const filename = `${posPrefix}_${hhmmss}_${rand}.${ext}`

    const res = await fetch(driveCfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rootFolder: driveCfg.rootFolder,
        folderPath,
        filename,
        mimeType: params.mimeType || 'audio/webm',
        base64: params.audioBase64,
      }),
      redirect: 'follow',
    })

    const text = await res.text()
    const parsed = JSON.parse(text)
    if (parsed?.success && parsed?.fileId) {
      return `/api/voice-proxy?id=${encodeURIComponent(String(parsed.fileId))}`
    }
    console.warn('[VoiceTranscribe] Google Drive upload failed:', parsed?.error || text.slice(0, 200))
    return null
  } catch (e: any) {
    console.warn('[VoiceTranscribe] Google Drive upload exception:', e?.message || e)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const companyId = body?.companyId ? String(body.companyId) : null
    const saveToServer = Boolean(body?.saveToServer)
    const systemCode = String(body?.systemCode || 'KHO_DONG_LANH')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 40)
    const sessionId = String(body?.sessionId || 'misc')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 60)
    const sessionName = body?.sessionName ? String(body.sessionName).trim() : null

    const extraVocab: string[] = Array.isArray(body?.vocabulary)
      ? body.vocabulary
          .map((v: any) => String(v || '').trim())
          .filter((v: string) => v.length > 0 && v.length <= 32)
          .slice(0, 50)
      : []
    const mergedVocab = Array.from(new Set([...BASE_WAREHOUSE_VOCAB, ...extraVocab]))

    const driveCfg = saveToServer ? await resolveVoiceDriveConfig(systemCode) : null

    // ── CHẾ ĐỘ BATCH (GỘP TỐI ĐA 10 FILE GHI ÂM TRONG 1 REQUEST GEMINI) ──
    if (Array.isArray(body?.items)) {
      const batchItems = body.items
        .slice(0, MAX_BATCH_SIZE)
        .map((it: any, idx: number) => {
          const positionId = String(it?.positionId || '').trim()
          const itemId = String(it?.itemId || positionId || `item_${idx}`).trim()
          return {
            itemId,
            positionId,
            positionCode: it?.positionCode ? String(it.positionCode).trim() : null,
            audioBase64: String(it?.audioBase64 || '').trim(),
            mimeType: String(it?.mimeType || 'audio/webm').split(';')[0].trim(),
          }
        })
        .filter((it: any) => it.positionId && it.audioBase64)

      if (batchItems.length === 0) {
        return NextResponse.json({ error: 'Danh sách ghi âm rỗng' }, { status: 400 })
      }

      // 1. Upload song song file ghi âm lên Google Drive (nếu đã cấu hình trên /integrations)
      const voiceUrlMap: Record<string, string | null> = {}
      if (driveCfg) {
        await Promise.all(
          batchItems.map(async (it: any) => {
            voiceUrlMap[it.itemId] = await uploadAudioToGoogleDrive(driveCfg, {
              audioBase64: it.audioBase64,
              mimeType: it.mimeType,
              systemCode,
              sessionId,
              sessionName,
              positionId: it.positionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60),
              positionCode: it.positionCode,
            })
          })
        )
      }

      const geminiCfg = await resolveGeminiConfig(companyId)
      if (!geminiCfg || geminiCfg.apiKeys.length === 0) {
        return NextResponse.json({
          results: batchItems.map((it: any) => ({
            itemId: it.itemId,
            positionId: it.positionId,
            text: '',
            voiceUrl: voiceUrlMap[it.itemId] || null,
          })),
          engine: 'drive-only',
          warning: 'Chưa cấu hình Gemini API Key',
        })
      }

      const batchPrompt = [
        `Bạn sẽ nghe ${batchItems.length} đoạn ghi âm kiểm kê tiếng Việt của nhân viên KHO LẠNH, mỗi đoạn đi kèm một mã ID.`,
        `Từ khóa kho hay dùng: ${mergedVocab.join(', ')}.`,
        'Quy tắc: "đô na A"->"Dona A", "ri sáu"->"Ri 6", "lót"->"LOT", "ba lết"->"pallet"; viết số lượng bằng chữ số (0-9).',
        'Trả về DUY NHẤT một JSON object map chính xác từng ID sang nội dung tiếng Việt đã nghe được, ví dụ: {"<ID>": "Dona A thiếu 2 thùng"}. Nếu đoạn nào im lặng trả về chuỗi rỗng "".',
      ].join('\n')

      const parts: any[] = [{ text: batchPrompt }]
      for (const it of batchItems) {
        parts.push({ text: `ID: ${it.itemId}` })
        parts.push({
          inlineData: {
            mimeType: it.mimeType || 'audio/webm',
            data: it.audioBase64,
          },
        })
      }

      const model = geminiCfg.model || 'gemini-2.0-flash'
      let lastError = 'Không gọi được Gemini'

      for (const apiKey of getOrderedGeminiKeys(geminiCfg.apiKeys)) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            model
          )}:generateContent?key=${encodeURIComponent(apiKey)}`

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 1024,
                responseMimeType: 'application/json',
              },
            }),
          })

          if (res.status === 429) {
            keyCooldownUntil.set(apiKey, Date.now() + 60_000)
            lastError = 'Gemini API Key tạm hết hạn mức (429)'
            continue
          }
          if (!res.ok) {
            const errText = await res.text().catch(() => '')
            lastError = `Gemini HTTP ${res.status}: ${errText.slice(0, 160)}`
            continue
          }

          const json = await res.json()
          const rawText =
            json?.candidates?.[0]?.content?.parts
              ?.map((p: any) => p?.text || '')
              .join('')
              .trim() || '{}'

          let parsedMap: Record<string, string> = {}
          try {
            const cleanJson = rawText
              .replace(/^```(?:json)?\s*/i, '')
              .replace(/\s*```$/i, '')
              .trim()
            parsedMap = JSON.parse(cleanJson)
          } catch {
            parsedMap = {}
          }

          return NextResponse.json({
            results: batchItems.map((it: any) => ({
              itemId: it.itemId,
              positionId: it.positionId,
              text: String(parsedMap?.[it.itemId] || '').trim(),
              voiceUrl: voiceUrlMap[it.itemId] || null,
            })),
            engine: 'gemini-batch',
            model,
          })
        } catch (e: any) {
          lastError = e?.message || 'Lỗi mạng gọi Gemini'
        }
      }

      return NextResponse.json({
        results: batchItems.map((it: any) => ({
          positionId: it.positionId,
          text: '',
          voiceUrl: voiceUrlMap[it.positionId] || null,
        })),
        engine: 'drive-only',
        warning: lastError,
      })
    }

    // ── CHẾ ĐỘ ĐƠN LẺ (1 FILE GHI ÂM KHI NÓI TRỰC TIẾP ONLINE) ──
    const audioBase64 = String(body?.audioBase64 || '').trim()
    const rawMime = String(body?.mimeType || 'audio/webm').split(';')[0].trim()
    const positionId = String(body?.positionId || 'pos')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 60)
    const positionCode = body?.positionCode ? String(body.positionCode).trim() : null

    if (!audioBase64) {
      return NextResponse.json({ error: 'Thiếu dữ liệu âm thanh' }, { status: 400 })
    }

    const voiceUrl = driveCfg
      ? await uploadAudioToGoogleDrive(driveCfg, {
          audioBase64,
          mimeType: rawMime,
          systemCode,
          sessionId,
          sessionName,
          positionId,
          positionCode,
        })
      : null

    const geminiCfg = await resolveGeminiConfig(companyId)
    if (!geminiCfg || geminiCfg.apiKeys.length === 0) {
      if (voiceUrl) {
        return NextResponse.json({
          text: '',
          voiceUrl,
          engine: 'drive-only',
          warning: 'Chưa cấu hình Gemini API Key (đã lưu file ghi âm lên Google Drive)',
        })
      }
      return NextResponse.json(
        { error: 'Chưa cấu hình Gemini API Key', code: 'NO_GEMINI_KEY' },
        { status: 503 }
      )
    }

    const prompt = [
      'Chuyển đoạn ghi âm tiếng Việt của nhân viên KHO LẠNH sang văn bản ghi chú ngắn gọn, chính xác.',
      `Từ khóa kho hay dùng: ${mergedVocab.join(', ')}.`,
      'Quy tắc: "đô na A"->"Dona A", "ri sáu"->"Ri 6", "lót"->"LOT", "ba lết"->"pallet"; viết số lượng bằng chữ số (0-9).',
      'CHỈ trả về nội dung đã nghe, không giải thích, không ngoặc kép. Nếu im lặng trả về chuỗi rỗng.',
    ].join('\n')

    const model = geminiCfg.model || 'gemini-2.0-flash'
    let lastError = 'Không gọi được Gemini'

    for (const apiKey of getOrderedGeminiKeys(geminiCfg.apiKeys)) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(apiKey)}`

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: rawMime || 'audio/webm',
                      data: audioBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 160,
            },
          }),
        })

        if (res.status === 429) {
          keyCooldownUntil.set(apiKey, Date.now() + 60_000)
          lastError = 'Gemini API Key tạm hết hạn mức (429)'
          continue
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          lastError = `Gemini HTTP ${res.status}: ${errText.slice(0, 160)}`
          continue
        }

        const json = await res.json()
        const rawText =
          json?.candidates?.[0]?.content?.parts
            ?.map((p: any) => p?.text || '')
            .join(' ')
            .trim() || ''

        const cleaned = rawText.replace(/^["'`]+|["'`]+$/g, '').trim()
        return NextResponse.json({ text: cleaned, voiceUrl, engine: 'gemini', model })
      } catch (e: any) {
        lastError = e?.message || 'Lỗi mạng gọi Gemini'
      }
    }

    if (voiceUrl) {
      return NextResponse.json({
        text: '',
        voiceUrl,
        engine: 'drive-only',
        warning: lastError,
      })
    }

    return NextResponse.json({ error: lastError }, { status: 502 })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Lỗi xử lý giọng nói' },
      { status: 500 }
    )
  }
}
