
import { supabase } from '../src/lib/supabaseClient'

async function checkZonesTable() {
  const { count, error } = await supabase.from('zones').select('*', { count: 'exact', head: true })
  if (error) {
    console.error('Error counting zones:', error)
    return
  }
  console.log('Total zones:', count)

  const { data: halls, error: hallError } = await supabase.from('zones').select('id, name, system_type, is_hall').eq('is_hall', true)
  if (hallError) {
    console.error('Error fetching halls:', hallError)
    return
  }
  console.log('Total halls found:', halls?.length)
  console.log('Halls:', halls)
}

checkZonesTable()
