import { supabase } from './supabaseClient'

/**
 * Generates an order code following the format: xxxx/mmyy/A or xxxx/mmyy/B
 * xxxx: 4-digit sequential number
 * mmyy: month and last two digits of year
 * A: Inbound (PNK), B: Outbound (PXK)
 */
export async function generateOrderCode(type: 'PNK' | 'PXK', systemCode?: string) {
    const today = new Date()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const year = String(today.getFullYear()).slice(-2)
    const mmyy = `${month}${year}`
    const suffix = type === 'PNK' ? 'A' : 'B'
    const tableName = type === 'PNK' ? 'inbound_orders' : 'outbound_orders'

    // Query for the latest code in the current month/year to determine the STT
    // We look for codes ending with /mmyy/suffix
    const pattern = `%/${mmyy}/${suffix}`

    const { data, error } = await supabase
        .from(tableName)
        .select('code')
        .like('code', pattern)
        .order('code', { ascending: false })
        .limit(1)

    let nextStt = 1

    if (data && data.length > 0) {
        const lastCode = data[0].code
        const sttPart = lastCode.split('/')[0]
        const lastStt = parseInt(sttPart, 10)
        if (!isNaN(lastStt)) {
            nextStt = lastStt + 1
        }
    }

    const xxxx = String(nextStt).padStart(4, '0')
    return `${xxxx}/${mmyy}/${suffix}`
}
