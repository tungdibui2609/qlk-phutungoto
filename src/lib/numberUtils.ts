/**
 * Utility functions for handling quantities throughout the application.
 * Supports dot (.) and comma (,) as decimal separators.
 */

/**
 * Parses a string or number into a float.
 * Handles both dot and comma as decimal separators.
 * @param val The value to parse
 * @returns A number (float) or 0 if invalid
 */
export function parseQuantity(val: string | number | undefined | null): number {
    if (val === undefined || val === null) return 0
    if (typeof val === 'number') return val

    let s = val.trim()
    if (!s) return 0

    // VIETNAMESE NUMERIC PARSING LOGIC:
    // 1. If comma exists: it's definitely the decimal separator (VN Standard).
    //    We remove all dots (thousand separators) and replace comma with dot for parseFloat.
    if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.')
    } else {
        // 2. If no comma exists, handle dots.
        const dots = s.match(/\./g)
        if (dots && dots.length > 1) {
            // Multiple dots -> always thousand separators.
            s = s.replace(/\./g, '')
        } else if (dots && dots.length === 1) {
            // Single dot: ambiguous. 
            // Heuristic: If followed by exactly 3 digits, it's likely a thousand separator in vi-VN.
            // e.g. "13.964" -> "13964", but "13.9" -> "13.9", "1.50" -> "1.50"
            const parts = s.split('.')
            if (parts[1].length === 3) {
                s = s.replace('.', '')
            }
        }
    }

    const parsed = parseFloat(s)
    return isNaN(parsed) ? 0 : parsed
}

/**
 * Formats a number for display.
 * Strips trailing zeros and handles precision.
 * @param val The number to format
 * @param precision Maximum decimal places (default 6)
 * @returns A formatted string
 */
export function formatQuantity(val: number | string | undefined | null, precision: number = 6): string {
    const num = typeof val === 'string' ? parseQuantity(val) : (val || 0)

    // Use Intl.NumberFormat for locale-aware formatting if desired, 
    // but often we just want a clean number for readability.
    // This approach: 12.500 -> 12.5, 12.000 -> 12
    return Number(num.toFixed(precision)).toString().replace('.', ',')
}

/**
 * Formats a number for display with thousand separators (Vietnamese style).
 * 1000.5 -> 1.000,5
 */
export function formatQuantityFull(val: number | string | undefined | null, precision: number = 6): string {
    const num = typeof val === 'string' ? parseQuantity(val) : (val || 0)

    return new Intl.NumberFormat('vi-VN', {
        maximumFractionDigits: precision,
        minimumFractionDigits: 0
    }).format(num)
}

/**
 * Mã hóa chuỗi STT (ví dụ: A100, B25) thành số nguyên INTEGER để lưu vào database.
 * @param sttStr Chuỗi STT cần mã hóa
 */
export function encodeSTT(sttStr: string | number | null | undefined): number | null {
    if (sttStr === null || sttStr === undefined || sttStr === '') return null
    const s = String(sttStr).trim().toUpperCase()
    if (!s) return null

    // Định dạng: 1 chữ cái in hoa + số thứ tự, ví dụ: A100, B5
    const match = s.match(/^([A-Z])(\d+)$/)
    if (match) {
        const char = match[1]
        const num = parseInt(match[2], 10)
        const charCode = char.charCodeAt(0) - 64 // A = 1, B = 2, ..., Z = 26
        return charCode * 100000 + num
    }

    // Nếu chỉ là số bình thường
    const num = parseInt(s, 10)
    if (!isNaN(num)) return num
    return null
}

/**
 * Giải mã số nguyên từ database thành chuỗi STT nguyên bản (ví dụ: A100, 100).
 * @param val Số nguyên cần giải mã
 */
export function decodeSTT(val: number | string | null | undefined): string {
    if (val === null || val === undefined || val === '') return ''
    const num = Number(val)
    if (isNaN(num)) return String(val)

    // Nếu lớn hơn hoặc bằng 100000, có khả năng chứa tiền tố chữ cái
    if (num >= 100000) {
        const prefixIndex = Math.floor(num / 100000)
        const seq = num % 100000
        if (prefixIndex >= 1 && prefixIndex <= 26) {
            const char = String.fromCharCode(64 + prefixIndex)
            return `${char}${seq}`
        }
    }
    return String(num)
}

