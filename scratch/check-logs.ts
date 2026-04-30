
import { supabase } from '../src/lib/supabaseClient'

async function checkLogs() {
    const { data, error } = await supabase
        .from('audit_logs')
        .select('id, table_name, action, created_at')
        .eq('table_name', 'positions')
        .limit(5)
    
    if (error) {
        console.error('Error fetching logs:', error)
    } else {
        console.log('Recent position logs:', data)
    }
}

checkLogs()
