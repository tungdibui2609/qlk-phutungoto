import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testQueries() {
    console.log('Testing audit_logs query...')
    const { data: logs, error: logsError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'positions')
        .limit(1)
    
    if (logsError) {
        console.error('audit_logs error:', logsError)
    } else {
        console.log('audit_logs ok, found:', logs?.length)
    }

    console.log('Testing lots query...')
    const { data: lotTest, error: lotTestError } = await supabase
        .from('lots')
        .select('id, code')
        .limit(1)
    
    if (lotTestError) {
        console.error('Simple lots error:', lotTestError)
    } else {
        console.log('Simple lots ok')
    }

    console.log('Testing complex lots query...')
    const { data: complexLots, error: complexLotsError } = await supabase.from('lots').select(`
        id, code, production_code, production_lot_id,
        production_lots:production_lot_id(lot_code),
        productions:production_id(code),
        lot_items(quantity, unit, products(name, sku))
    `).limit(1)

    if (complexLotsError) {
        console.error('Complex lots error:', JSON.stringify(complexLotsError, null, 2))
    } else {
        console.log('Complex lots ok')
    }
}

testQueries()
