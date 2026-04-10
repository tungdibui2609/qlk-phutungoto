
import { supabase } from '@/lib/supabaseClient'

export default async function Page() {
    const { data } = await supabase.from('production_lots').select('*').limit(1)
    return <pre>{JSON.stringify(data?.[0] || {}, null, 2)}</pre>
}
