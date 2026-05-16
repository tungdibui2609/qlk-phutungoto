import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testEmptyIn() {
    console.log('Testing .in() with empty array on user_profiles...')
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .in('id', [])
    
    if (error) {
        console.error('Empty .in() error:', JSON.stringify(error, null, 2))
    } else {
        console.log('Empty .in() ok, returned:', data?.length)
    }
}

testEmptyIn()
