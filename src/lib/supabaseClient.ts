import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

// Fallback to prevent build errors when env vars are missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const createClient = () =>
    createBrowserClient<Database>(supabaseUrl, supabaseKey)

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseKey)
