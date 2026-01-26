import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

// Fallback to prevent build errors when env vars are missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Extend Database type to include any missing tables or columns manually if necessary
// This acts as a bridge until the official database.types.ts is regenerated
export type TypedDatabase = Database

export const createClient = () =>
    createBrowserClient<TypedDatabase>(supabaseUrl, supabaseKey)

// Export a typed client instance
export const supabase = createBrowserClient<TypedDatabase>(supabaseUrl, supabaseKey)
