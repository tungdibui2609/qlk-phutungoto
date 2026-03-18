import { supabase } from './supabaseClient'

/**
 * Generates an order code following the format: xxxx/mmyy/A or xxxx/mmyy/B
 * xxxx: 4-digit sequential number
 * mmyy: month and last two digits of year
 * A: Inbound (PNK), B: Outbound (PXK)
 */
export async function generateOrderCode(type: 'PNK' | 'PXK' | 'SITE', systemCode?: string) {
    const today = new Date()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const year = String(today.getFullYear()).slice(-2)
    const mmyy = `${month}${year}`
    
    let suffix = 'A'
    let tableName = 'inbound_orders'
    let prefix = ''

    if (type === 'PNK') {
        suffix = 'A'
        tableName = 'inbound_orders'
    } else if (type === 'PXK') {
        suffix = 'B'
        tableName = 'outbound_orders'
    } else if (type === 'SITE') {
        suffix = 'S'
        tableName = 'lots'
        prefix = 'SITE-'
    }

    // Query for the latest code in the current month/year to determine the STT
    const pattern = prefix ? `${prefix}%/${mmyy}/${suffix}` : `%/${mmyy}/${suffix}`

    const { data, error } = await supabase
        .from(tableName as any)
        .select('code')
        .like('code', pattern)
        .order('code', { ascending: false })
        .limit(1)

    let nextStt = 1

    if (data && (data as any[]).length > 0) {
        const lastCode = (data as any[])[0].code
        const parts = lastCode.split('/')
        const sttPart = prefix ? parts[0].replace(prefix, '') : parts[0]
        const lastStt = parseInt(sttPart, 10)
        if (!isNaN(lastStt)) {
            nextStt = lastStt + 1
        }
    }

    const xxxx = String(nextStt).padStart(4, '0')
    return `${prefix}${xxxx}/${mmyy}/${suffix}`
}
