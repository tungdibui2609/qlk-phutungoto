import { supabase } from './supabaseClient'

export const MONTH_MAP: Record<number, string> = {
    1: 'AA', 2: 'BB', 3: 'CC', 4: 'DD', 5: 'EE', 6: 'FF',
    7: 'GG', 8: 'HH', 9: 'KK', 10: 'LL', 11: 'MM', 12: 'NN'
}

export function encodeMonth(month: number) {
    return MONTH_MAP[month] || 'XX'
}

/**
 * Finds the next available STT for a NEW production code in the current month, 
 * or returns the existing STT if this combination of levels already exists.
 */
/**
 * Finds the next available STT for production code.
 * "Tăng theo mã sản xuất": counts how many UNIQUE production codes exist this month and adds 1.
 */
export async function getProductionCodeSTT(companyId: string, systemCode: string, levelsPrefix: string) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    try {
        // Find all production codes starting with 'L' this month across ALL systems
        // (Production and Warehouse share data)
        const { data, error } = await supabase
            .from('lots')
            .select('production_code')
            .eq('company_id', companyId)
            // .eq('system_code', systemCode) // REMOVED: Shared data between systems
            .gte('created_at', startOfMonth)
            .lte('created_at', endOfMonth)
            .not('production_code', 'is', null)
            .like('production_code', 'L%')
            .limit(5000) // Increase limit for high-volume months

        if (error) throw error

        let nextSTT = 1
        if (data && data.length > 0) {
            // Find the MAXIMUM STT used so far this month
            let maxSTT = 0
            
            // Optimization: Filter unique values first to speed up loop
            const uniqueCodes = Array.from(new Set(data.map(item => item.production_code)))
            
            uniqueCodes.forEach(code => {
                const match = code?.match(/^L(\d+)/)
                if (match) {
                    const val = parseInt(match[1], 10)
                    if (val > maxSTT) maxSTT = val
                }
            })
            
            nextSTT = maxSTT + 1
        }

        return String(nextSTT).padStart(3, '0')
    } catch (err) {
        console.error('Error fetching STT:', err)
        return '001'
    }
}

/**
 * Legacy wrapper for compatibility (counts total lots)
 */
export async function getNextProductionSTT(companyId: string, systemCode: string) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    try {
        const { count, error } = await supabase
            .from('lots')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('system_code', systemCode)
            .gte('created_at', startOfMonth)
            .lte('created_at', endOfMonth)

        if (error) throw error
        const nextSTT = (count || 0) + 1
        return String(nextSTT).padStart(3, '0')
    } catch (err) {
        console.error('Error fetching STT:', err)
        return '001'
    }
}

/**
 * Generates a full production code
 */
export function generateFullProductionCode(stt: string, allLevelsPrefix: string) {
    const now = new Date()
    const monthCode = encodeMonth(now.getMonth() + 1)
    const yearCode = String(now.getFullYear()).slice(-2)
    return `L${stt}${monthCode}${yearCode}${allLevelsPrefix}`
}

export function extractLevelsFromCode(code: string): string {
    if (!code || !code.startsWith('L')) return ''
    
    // Pattern: L [STT: digits] [Month: AA-NN] [Year: digits] [Levels: mixed]
    // Example: L2549CC261DL -> Level 1: 1, Level 2: D, Level 3: L
    
    const match = code.match(/^L(\d+)([A-Z]{2})(\d{2})(.*)$/)
    if (match) {
        return match[4]
    }
    
    return ''
}
