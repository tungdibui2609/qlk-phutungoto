// Quick debug script to test the lots query used by warehouse-movements page
// Run: npx tsx scratch/debug_movements.ts

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

// Parse .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf-8')
envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=')
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim()
})

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function debug() {
    // Try with service role if available
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey
    )
    console.log('Using key type:', serviceKey === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'ANON' : 'SERVICE_ROLE')

    // 1. Get a few recent audit logs for positions
    const { data: logs, error: logsError } = await adminClient
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'positions')
        .order('created_at', { ascending: false })
        .limit(5)

    if (logsError) {
        console.error('❌ Audit logs error:', logsError)
        return
    }

    console.log(`✅ Found ${logs?.length || 0} audit logs`)

    // Collect lot IDs
    const lotIds = new Set<string>()
    logs?.forEach((l: any) => {
        if (l.old_data?.lot_id) lotIds.add(l.old_data.lot_id)
        if (l.new_data?.lot_id) lotIds.add(l.new_data.lot_id)
    })

    const lotIdArray = Array.from(lotIds)
    console.log(`\n📦 Lot IDs found: ${lotIdArray.join(', ')}`)

    if (lotIds.size === 0) {
        console.log('No lot IDs to test')
        return
    }

    // 2. Check if these lots actually exist
    console.log('\n--- Checking if lots exist at all ---')
    const { data: existCheck, error: existErr } = await adminClient
        .from('lots')
        .select('id, code, status')
        .in('id', lotIdArray)

    if (existErr) {
        console.error('❌ Exist check ERROR:', existErr)
    } else {
        console.log(`✅ Found ${existCheck?.length || 0} lots:`)
        existCheck?.forEach((l: any) => console.log(`  ${l.id} -> code: ${l.code}, status: ${l.status}`))
    }

    // 3. Test the exact query used by warehouse-movements page
    console.log('\n--- Testing FULL query (with productions:production_id) ---')
    const { data: lotsData, error: lotsError } = await adminClient
        .from('lots')
        .select(`
            id, code, production_code, production_lot_id,
            production_lots:production_lot_id(lot_code),
            productions:production_id(code),
            lot_items(quantity, unit, products(name, sku, weight_kg))
        `)
        .in('id', lotIdArray)

    if (lotsError) {
        console.error('❌ FULL query ERROR:', JSON.stringify(lotsError, null, 2))
    } else {
        console.log(`✅ FULL query returned ${lotsData?.length || 0} lots`)
        lotsData?.forEach((l: any) => {
            console.log(`  LOT ${l.code}:`)
            console.log(`    lot_items count: ${l.lot_items?.length || 0}`)
            l.lot_items?.forEach((li: any) => {
                console.log(`      products: ${JSON.stringify(li.products)}`)
                console.log(`      quantity: ${li.quantity}, unit: ${li.unit}`)
            })
        })
    }

    // 4. Test lot_items directly
    console.log('\n--- Testing lot_items directly ---')
    const { data: itemsData, error: itemsError } = await adminClient
        .from('lot_items')
        .select('id, lot_id, product_id, quantity, unit, products(name, sku)')
        .in('lot_id', lotIdArray)
        .limit(5)

    if (itemsError) {
        console.error('❌ lot_items direct ERROR:', JSON.stringify(itemsError, null, 2))
    } else {
        console.log(`✅ lot_items found: ${itemsData?.length || 0}`)
        itemsData?.forEach((li: any) => {
            console.log(`  item ${li.id}: product=${JSON.stringify(li.products)}, qty=${li.quantity}`)
        })
    }
}

debug().catch(console.error)
