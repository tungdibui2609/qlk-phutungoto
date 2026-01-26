import { SupabaseClient } from '@supabase/supabase-js'
import { TypedDatabase } from './supabaseClient'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'

interface LogActivityParams {
    supabase: SupabaseClient<TypedDatabase>
    tableName: string
    recordId: string
    action: AuditAction
    oldData?: any | null
    newData?: any | null
    userId?: string
}

/**
 * Records an activity to the audit_logs table.
 */
export async function logActivity({
    supabase,
    tableName,
    recordId,
    action,
    oldData = null,
    newData = null,
    userId
}: LogActivityParams) {
    try {
        // If userId is not provided, try to get it from the session
        let changedBy = userId
        if (!changedBy) {
            const { data: { session } } = await supabase.auth.getSession()
            changedBy = session?.user?.id
        }

        const { error } = await supabase.from('audit_logs').insert({
            table_name: tableName,
            record_id: recordId,
            action,
            old_data: oldData,
            new_data: newData,
            changed_by: changedBy
        })

        if (error) {
            console.error('Failed to create audit log:', error)
        }
    } catch (err) {
        console.error('Error in logActivity:', err)
    }
}

/**
 * Fetches audit logs for a specific record.
 * Uses a two-step fetch to get user details from 'user_profiles' table (or just ID if not found)
 * to avoid joining on restricted auth.users table.
 */
export async function getAuditLogs(
    supabase: SupabaseClient<TypedDatabase>,
    tableName: string,
    recordId: string
) {
    // 1. Fetch Logs
    const { data: logs, error: logError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false })

    if (logError) {
        console.error('Error fetching audit logs:', logError)
        return []
    }

    if (!logs || logs.length === 0) return []

    // 2. Collect unique user IDs
    const userIds = Array.from(new Set(logs.map(log => log.changed_by).filter(Boolean))) as string[]

    if (userIds.length === 0) return logs

    // 3. Fetch user profiles
    // We check 'user_profiles' table based on database.types.ts
    const { data: profiles, error: profileError } = await supabase
        .from('user_profiles' as any) // Casting as any for now just to be safe if types aren't fully perfectly aligned yet in TypedDatabase expansion
        .select('id, email, full_name')
        .in('id', userIds)

    if (profileError) {
         console.warn('Error fetching user profiles for audit logs:', profileError)
         // Return logs without enriched user data if profile fetch fails
         return logs
    }

    // 4. Map profiles to logs
    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]))

    return logs.map(log => ({
        ...log,
        changed_by_user: log.changed_by ? profileMap.get(log.changed_by) : null
    }))
}
