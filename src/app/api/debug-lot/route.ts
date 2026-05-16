import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
    // 1. Find specific lot by code
    const { data: specificLot } = await supabase
        .from('lots')
        .select('id, code, daily_seq, status, inbound_date, system_code')
        .ilike('code', '%160526-1070%')

    // 2. Find ALL lots with daily_seq = 42
    const { data: stt42Lots } = await supabase
        .from('lots')
        .select('id, code, daily_seq, status, inbound_date, system_code')
        .eq('daily_seq', 42)
        .order('inbound_date', { ascending: false })
        .limit(20)

    // 3. Find positions assigned to these lots
    const lotIds = [...(specificLot || []), ...(stt42Lots || [])].map(l => l.id)
    let positions: any[] = []
    if (lotIds.length > 0) {
        const { data } = await supabase
            .from('positions')
            .select('id, code, lot_id')
            .in('lot_id', lotIds)
        positions = data || []
    }
        
    return NextResponse.json({ 
        specificLot, 
        stt42Lots,
        positions,
        note: 'Check if DL-LOT-160526-1070 has daily_seq=42 and status is not hidden/exported'
    });
}
