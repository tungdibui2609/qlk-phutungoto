import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET() {
    // Check if there are unique constraints on product_units
    const { data: cols, error: errCols } = await supabase.rpc('get_table_info', { table_name: 'product_units' })

    // Also try an insert that might violate constraints
    // Actually just fetch any product_units to see what lives there.
    const { data: units, error: errUnits } = await supabase.from('product_units').select('*').limit(10)

    return NextResponse.json({
        units,
        errUnits,
        cols,
        errCols
    })
}
