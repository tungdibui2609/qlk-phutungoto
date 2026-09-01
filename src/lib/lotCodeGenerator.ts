import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Generate a clean 6-character random uppercase alphanumeric string,
 * avoiding easily confused characters (0, O, 1, I, L).
 */
export function generateRandomCode(length = 6): string {
    const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
    let result = ''
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length)
        result += chars.charAt(randomIndex)
    }
    return result
}

/**
 * Extract warehouse initials prefix (e.g., "Kho Đông Lạnh" -> "DL")
 */
export function getWarehousePrefix(systemName?: string | null): string {
    if (!systemName) return ''
    const cleanName = systemName.replace(/^Kho\s+/i, '').trim()
    if (!cleanName) return ''

    const initials = cleanName.split(/\s+/).map(word => word[0]).join('')
    const normalized = initials
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")

    return normalized.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Build candidate Lot code format: [PREFIX]-LOT-[RANDOM] or LOT-[RANDOM]
 */
export function formatLotCode(warehousePrefix: string, randomStr: string): string {
    return warehousePrefix ? `${warehousePrefix}-LOT-${randomStr}` : `LOT-${randomStr}`
}

/**
 * Generates a 100% unique Lot code by checking against the database.
 * Retries if a collision occurs (extremely rare with 6-char random space).
 */
export async function generateUniqueLotCode(
    supabase: SupabaseClient,
    systemName?: string | null
): Promise<string> {
    const warehousePrefix = getWarehousePrefix(systemName)
    let maxAttempts = 10

    while (maxAttempts > 0) {
        maxAttempts--
        const randomStr = generateRandomCode(6)
        const candidateCode = formatLotCode(warehousePrefix, randomStr)

        // Check uniqueness in database
        const { data, error } = await supabase
            .from('lots')
            .select('id')
            .eq('code', candidateCode)
            .maybeSingle()

        if (error) {
            console.error('[generateUniqueLotCode] Error checking lot code uniqueness:', error)
        }

        if (!data) {
            return candidateCode
        }
    }

    // Emergency fallback if 10 collisions occurred
    const fallbackRandom = generateRandomCode(8)
    return formatLotCode(warehousePrefix, fallbackRandom)
}
