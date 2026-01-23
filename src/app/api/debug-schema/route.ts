
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

export async function GET() {
    // Try to select the specific column. If it fails, it doesn't exist.
    const { data, error } = await supabase
        .from('lot_tags')
        .select('lot_item_id')
        .limit(1);

    return NextResponse.json({
        ok: !error,
        error: error ? error.message : null,
        data
    });
}
