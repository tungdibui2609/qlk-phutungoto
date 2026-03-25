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
