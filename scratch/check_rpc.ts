// Script kiểm tra hàm RPC capture_daily_position_snapshot
// Usage: npx tsx scratch/check_rpc.ts

import { createClient } from '@supabase/supabase-js'

// Dùng anon key từ env app
const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA5MjUwMzYsImV4cCI6MjA1NjUwMTAzNn0.IZA0OTYKtQb-HAI_ZFq0RNpEOf0UnKBZyUuvDNTN0G8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('=== Kiểm tra hàm RPC capture_daily_position_snapshot ===\n')

  // 1. Gọi RPC
  console.log('1. Gọi RPC capture_daily_position_snapshot():')
  const { data, error, status, statusText } = await supabase.rpc('capture_daily_position_snapshot')
  console.log('   data:', data)
  console.log('   error:', JSON.stringify(error, null, 2))
  console.log('   status:', status, statusText)
  if (error) {
    console.log('   error.code:', (error as any).code)
    console.log('   error.message:', (error as any).message)
    console.log('   error.details:', (error as any).details)
    console.log('   error.hint:', (error as any).hint)
    // Duyệt tất cả các thuộc tính
    console.log('   All error keys:', Object.getOwnPropertyNames(error))
    console.log('   All enumerable keys:', Object.keys(error))
  }

  // 2. Kiểm tra bảng position_history có tồn tại không
  console.log('\n2. Kiểm tra bảng position_history:')
  const { data: ph, error: phErr } = await supabase.from('position_history').select('count').limit(1)
  console.log('   data:', ph)
  console.log('   error:', phErr)

  // 3. Thử gọi SQL kiểm tra function tồn tại
  console.log('\n3. Kiểm tra function trực tiếp qua REST:')
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/capture_daily_position_snapshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({})
  })
  console.log('   HTTP status:', res.status, res.statusText)
  const resText = await res.text()
  console.log('   Body:', resText.substring(0, 500))
}

main().catch(e => {
  console.error('Fatal error:', e)
})