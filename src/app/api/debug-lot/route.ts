import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
    const { data: lots, error } = await supabase
        .from('lots')
        .select('id, code, daily_seq, positions(code)')
        .ilike('code', 'DL-LOT-040426-125%')
        
    return NextResponse.json({ lots, error });
}
