
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for schema check
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
    // Check audit_logs columns
    const { data, error } = await supabase.rpc('get_table_info', { t_name: 'audit_logs' })
    if (error) {
        // If RPC not exists, try a simple query to see column names
        const { data: sample } = await supabase.from('audit_logs').select('*').limit(1)
        console.log('Audit logs columns:', Object.keys(sample?.[0] || {}))
    } else {
        console.log('Audit logs schema:', data)
    }
}

checkSchema()
