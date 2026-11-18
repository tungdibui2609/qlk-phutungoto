import { createClient } from '@supabase/supabase-js'
import { getServerSupabaseUrl } from '@/lib/supabaseUrl'
import { DEFAULT_STAMP_DICT, decodeStampBox, parseGeminiApiKeys } from '@/lib/stampDecoder'
import { cleanStampNumericString } from '@/lib/ocrParser'

export function createAdminSupabaseClient() {
  const url = getServerSupabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export { parseGeminiApiKeys }

export interface GeminiConfig {
  apiKey: string
  apiKeys: string[]
  model: string
}

export async function resolveGeminiConfig(companyId?: string | null): Promise<GeminiConfig | null> {
  // 1. Ưu tiên đọc từ bảng company_ai_settings (do Admin cấu hình trên Web mẹ)
  try {
    const admin = createAdminSupabaseClient()
    let query = admin
      .from('company_ai_settings')
      .select('gemini_api_key, gemini_model, is_enabled')
      .eq('is_enabled', true)

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data } = await query.limit(1).maybeSingle()
    if (data && data.gemini_api_key && String(data.gemini_api_key).trim()) {
      const keys = parseGeminiApiKeys(String(data.gemini_api_key))
      if (keys.length > 0) {
        return {
          apiKey: keys[0],
          apiKeys: keys,
          model: String(data.gemini_model || 'gemini-2.0-flash').trim(),
        }
      }
    }
  } catch (err) {
    console.warn('[GeminiConfig] Không đọc được company_ai_settings:', err)
  }

  // 2. Fallback sang biến môi trường server (.env.local)
  const envKey = (process.env.GEMINI_API_KEY || '').trim()
  if (envKey) {
    const keys = parseGeminiApiKeys(envKey)
    if (keys.length > 0) {
      return {
        apiKey: keys[0],
        apiKeys: keys,
        model: (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim(),
      }
    }
  }

  return null
}

export async function fetchServerStampDictionary(
  companyId?: string | null
): Promise<Record<string, Record<string, string>>> {
  const merged: Record<string, Record<string, string>> = {}
  Object.keys(DEFAULT_STAMP_DICT).forEach(cat => {
    merged[cat] = { ...DEFAULT_STAMP_DICT[cat] }
  })

  try {
    const admin = createAdminSupabaseClient()
    let query = admin
      .from('stamp_dictionaries')
      .select('category, code, name')
      .eq('is_active', true)

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data } = await query
    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        const cat = String(item.category || '').trim()
        const rawCode = String(item.code || '').trim()
        const name = String(item.name || '').trim()
        if (!cat || !rawCode) return
        if (!merged[cat]) merged[cat] = {}
        merged[cat][rawCode] = name
        if (cat === 'special_12') {
          const clean12 = rawCode.replace(/[^0-9]/g, '').slice(0, 12)
          if (clean12.length === 12) merged[cat][clean12] = name
        }
      })
    }
  } catch (err) {
    console.warn('[GeminiStamp] Lỗi tải stamp_dictionaries:', err)
  }

  return merged
}

export async function recognizeStampWithGemini(params: {
  imageBase64: string
  mimeType?: string
  apiKey?: string
  apiKeys?: string[]
  model?: string
}): Promise<{ line1: string; line2: string; rawText: string; usedKeyIndex: number; usedModel: string }> {
  const { imageBase64, mimeType = 'image/jpeg', apiKey, apiKeys, model = 'gemini-3.5-flash' } = params
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  const candidateKeys: string[] = (apiKeys && apiKeys.length > 0)
    ? apiKeys
    : (apiKey ? [apiKey] : [])

  if (candidateKeys.length === 0) {
    throw new Error('Chưa cấu hình Gemini API Key hợp lệ.')
  }

  // Danh sách model ưu tiên (nếu model chỉ định bị 404 hoặc 503, tự động chuyển sang model kế tiếp)
  const candidateModels = Array.from(new Set([
    model,
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-2.5-flash-lite',
    'gemini-pro-latest',
  ])).filter(Boolean)

  const prompt = [
    'Bạn là hệ thống OCR công nghiệp chuyên đọc dấu mực đóng trên thùng carton.',
    'Trong ảnh có 2 dòng chữ số đóng dấu mực gần nhau:',
    '- Dòng 1 (mã sản phẩm): thường gồm 12 chữ số, dấu gạch ngang "-", và 1 chữ số cuối (ví dụ: 102020301001-0 hoặc 102010402001-0).',
    '- Dòng 2 (dãy số truy xuất nguồn gốc): gồm 16 chữ số liền nhau (ví dụ: 2031103112600066 hoặc 2281021102600066).',
    'Hãy bỏ qua hoàn toàn các chữ/số watermark thời gian camera (như Timemark 09:46, ngày tháng năm chữ Việt) hoặc ký tự không thuộc dấu mực.',
    'Trả về JSON thuần theo đúng schema: {"line1": "...", "line2": "..."} (chỉ chứa chữ số 0-9 và dấu "-" ở line1, không giải thích thêm). Nếu không thấy dòng nào thì để chuỗi rỗng "".',
  ].join('\n')

  let lastError: any = null

  for (let keyIdx = 0; keyIdx < candidateKeys.length; keyIdx++) {
    const activeKey = candidateKeys[keyIdx]

    for (let modIdx = 0; modIdx < candidateModels.length; modIdx++) {
      const activeModel = candidateModels[modIdx]
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(activeModel)}:generateContent?key=${encodeURIComponent(activeKey)}`

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType,
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              responseMimeType: 'application/json',
            },
          }),
        })

        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          const is404 = res.status === 404
          const is503 = res.status === 503
          const isQuota =
            res.status === 429 ||
            res.status === 403 ||
            /RESOURCE_EXHAUSTED|quota|rate\s*limit|overloaded/i.test(errText)

          // Nếu model này bị 404 (không tồn tại) hoặc 503 (bận), thử model tiếp theo trong cùng key
          if ((is404 || is503) && modIdx < candidateModels.length - 1) {
            console.warn(`[GeminiOCR] Model ${activeModel} trả về ${res.status}. Tự động thử model dự phòng: ${candidateModels[modIdx + 1]}...`)
            lastError = new Error(`Model ${activeModel} lỗi ${res.status}: ${errText.slice(0, 120)}`)
            continue
          }

          // Nếu key này hết hạn mức (429/403), chuyển sang key tiếp theo
          if (isQuota && keyIdx < candidateKeys.length - 1) {
            console.warn(
              `[GeminiOCR] Key thứ ${keyIdx + 1}/${candidateKeys.length} đạt hạn mức (${res.status}). Tự động thử key dự phòng tiếp theo...`
            )
            lastError = new Error(`Key ${keyIdx + 1} hết hạn mức (${res.status}): ${errText.slice(0, 150)}`)
            break // nhảy sang key tiếp theo
          }

          throw new Error(
            `Gemini API lỗi (${res.status}) với model ${activeModel}: ${errText.slice(0, 200)}`
          )
        }

        const json: any = await res.json()
        const textOut: string = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''

        let parsed: any = {}
        try {
          parsed = JSON.parse(textOut)
        } catch {
          const match = textOut.match(/\{[\s\S]*\}/)
          if (match) {
            parsed = JSON.parse(match[0])
          }
        }

        const line1 = cleanStampNumericString(String(parsed?.line1 || ''))
        const line2 = cleanStampNumericString(String(parsed?.line2 || '')).replace(/-/g, '')

        return {
          line1,
          line2,
          rawText: `${line1}\n${line2}`.trim(),
          usedKeyIndex: keyIdx,
          usedModel: activeModel,
        }
      } catch (fetchErr: any) {
        lastError = fetchErr
        if (modIdx < candidateModels.length - 1) {
          console.warn(`[GeminiOCR] Lỗi với ${activeModel}: ${fetchErr?.message}. Thử model tiếp theo...`)
          continue
        }
      }
    }
  }

  throw lastError || new Error('Tất cả Gemini API Key và Model dự phòng đều gặp lỗi.')
}

export function buildDecodedStampPayload(
  line1: string,
  line2: string,
  dictMap: Record<string, Record<string, string>>
) {
  return decodeStampBox(
    {
      metadata: {
        scan_type: 'stamp',
        stamp_line1: line1,
        stamp_line2: line2,
      },
    },
    dictMap
  )
}
