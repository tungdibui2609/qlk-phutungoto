import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testAuditLogsWithSystem() {
    console.log('Testing audit_logs with system_code...')
    const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'positions')
        .eq('system_code', 'FROZEN') // Giả sử dùng code này
        .limit(1)
    
    if (error) {
        console.error('audit_logs system_code error:', JSON.stringify(error, null, 2))
    } else {
        console.log('audit_logs system_code ok, found:', data?.length)
    }
}

testAuditLogsWithSystem()
