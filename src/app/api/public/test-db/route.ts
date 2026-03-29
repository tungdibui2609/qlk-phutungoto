import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET() {
    const { data: batches, error: batchError } = await supabase
        .from('fresh_material_batches')
        .select('id, batch_code, document_urls')
        .order('created_at', { ascending: false })
        .limit(5)
        
    const { data: stages, error: stageError } = await supabase
        .from('fresh_material_stages')
        .select('id, document_urls')
        .order('created_at', { ascending: false })
        .limit(5)
        
    const { data: receivings, error: recError } = await supabase
        .from('fresh_material_receivings')
        .select('id, document_urls')
        .order('created_at', { ascending: false })
        .limit(5)

    return NextResponse.json({ batches, stages, receivings, errors: { batchError, stageError, recError } })
}
