import 'server-only'

/**
 * Gọi Gemini, xoay vòng nhiều API key — CHỈ CHẠY Ở SERVER.
 * Key lấy từ biến môi trường GEMINI_API_KEYS (nhiều key cách nhau bởi dấu phẩy).
 * Key hết hạn mức (429) hoặc bị từ chối được tạm nghỉ để lần gọi sau thử key khác.
 * Cách làm theo app training-plan (generateContent + responseJsonSchema) và diet-plan.
 */
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash'
const FALLBACK_MODEL = 'gemini-3.5-flash-lite'
const PER_ATTEMPT_TIMEOUT_MS = 40_000

/** Lỗi có thông điệp tiếng Việt an toàn để hiện cho người dùng */
export class GeminiError extends Error {
  constructor(message: string, public status = 502) { super(message); this.name = 'GeminiError' }
}

const cooldown = new Map<string, number>() // key → thời điểm được dùng lại
let cursor = 0

export function geminiConfigured(): boolean {
  return keys().length > 0
}

function keys(): string[] {
  return (process.env.GEMINI_API_KEYS ?? '').split(',').map((k) => k.trim()).filter(Boolean)
}

type Options = {
  system: string
  prompt: string
  schema?: Record<string, unknown>
  temperature?: number
  maxOutputTokens?: number
  budgetMs?: number
}

/** Trả về JSON đã parse; ném GeminiError nếu không gọi được. */
export async function generateGeminiJson(opts: Options): Promise<unknown> {
  const all = keys()
  if (!all.length) throw new GeminiError('Chưa cấu hình GEMINI_API_KEYS.', 503)
  const deadline = Date.now() + (opts.budgetMs ?? 50_000)
  const primary = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
  const models = primary === FALLBACK_MODEL ? [primary] : [primary, FALLBACK_MODEL]
  const start = cursor++ % all.length
  const ordered = [...all.slice(start), ...all.slice(0, start)]
  let last = ''

  for (const model of models) {
    for (const key of ordered) {
      if ((cooldown.get(key) ?? 0) > Date.now()) continue
      const remaining = deadline - Date.now()
      if (remaining < 6_000) throw new GeminiError('AI phản hồi quá chậm, vui lòng thử lại.', 504)
      let res: Response
      try {
        res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: opts.system }] },
            contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              ...(opts.schema ? { responseJsonSchema: opts.schema } : {}),
              temperature: opts.temperature ?? 0.7,
              maxOutputTokens: opts.maxOutputTokens ?? 8000,
            },
          }),
          signal: AbortSignal.timeout(Math.min(PER_ATTEMPT_TIMEOUT_MS, remaining - 2_000)),
        })
      } catch {
        last = 'không kết nối được tới Gemini'
        continue
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        if (res.status === 429) { cooldown.set(key, Date.now() + (/per day|daily/i.test(body) ? 6 * 3600_000 : 90_000)); last = 'hết hạn mức'; continue }
        if (res.status === 401 || res.status === 403 || (res.status === 400 && /api[ _-]?key/i.test(body))) { cooldown.set(key, Date.now() + 3600_000); last = 'key bị từ chối'; continue }
        if (res.status === 404) { last = `không có model ${model}`; break }
        if (res.status >= 500) { last = 'Gemini đang quá tải'; continue }
        throw new GeminiError('Gemini từ chối yêu cầu. Vui lòng thử lại.')
      }
      const data = (await res.json().catch(() => null)) as { candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[] } | null
      const cand = data?.candidates?.[0]
      const text = (cand?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('')
        .trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      if (cand?.finishReason === 'MAX_TOKENS') throw new GeminiError('AI trả lời chưa trọn vẹn (kế hoạch quá dài). Hãy giảm số buổi hoặc số bài rồi thử lại.')
      if (!text) { last = 'AI không trả về nội dung'; continue }
      try { return JSON.parse(text) } catch { last = 'AI trả về sai định dạng'; continue }
    }
  }
  throw new GeminiError(`Không gọi được AI${last ? ` (${last})` : ''}. Vui lòng thử lại sau ít phút.`, last === 'hết hạn mức' ? 429 : 502)
}
