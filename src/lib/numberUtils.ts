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

    // Replace comma with dot for standard float parsing
    const normalized = val.replace(',', '.')
    const parsed = parseFloat(normalized)

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
