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
    systemCode?: string | null
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
    userId,
    systemCode
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
            changed_by: changedBy,
            system_code: systemCode
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

/**
 * Fetches a single audit log entry by ID and enriches it with user details.
 * Useful for Realtime updates where we only get the new record ID.
 */
export async function getEnrichedAuditLogById(
    supabase: SupabaseClient<TypedDatabase>,
    logId: string
) {
    // 1. Fetch Log
    const { data: log, error: logError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('id', logId)
        .single()

    if (logError || !log) {
        console.error('Error fetching single audit log:', logError)
        return null
    }

    // 2. Fetch User Profile if needed
    let userProfile = null
    if (log.changed_by) {
        const { data: profile } = await supabase
            .from('user_profiles' as any)
            .select('id, email, full_name, avatar_url')
            .eq('id', log.changed_by)
            .single()

        userProfile = profile
    }

    return {
        ...log,
        changed_by_user: userProfile
    }
}

/**
 * Fetches all actions performed BY a specific user.
 */
export async function getUserActivityLogs(
    supabase: SupabaseClient<TypedDatabase>,
    userId: string
) {
    const { data: logs, error: logError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('changed_by', userId)
        .order('created_at', { ascending: false })
        .limit(100) // Limit to last 100 actions

    if (logError) {
        console.error('Error fetching user activity logs:', logError)
        return []
    }

    if (!logs || logs.length === 0) return []

    // For user activity, we might want to know WHO the user is (though we likely already know since we queried by ID),
    // but the existing UI expects 'changed_by_user' to be populated to show the avatar/name.
    // So we fetch the profile of the user (the actor).

    const { data: profile, error: profileError } = await supabase
        .from('user_profiles' as any)
        .select('id, email, full_name, avatar_url')
        .eq('id', userId)
        .single()

    if (profileError) {
        return logs
    }

    return logs.map(log => ({
        ...log,
        changed_by_user: profile
    }))
}

/**
 * Fetches the latest audit logs across the entire system.
 * Useful for the centralized Operation History dashboard.
 */
export async function getGlobalAuditLogs(
    supabase: SupabaseClient<TypedDatabase>,
    limit: number = 100,
    systemCode?: string
) {
    // 1. Fetch Logs
    let query = supabase
        .from('audit_logs')
        .select('*')

    if (systemCode) {
        query = query.or(`system_code.eq.${systemCode},system_code.is.null`)
    }

    const { data: logs, error: logError } = await query
        .order('created_at', { ascending: false })
        .limit(limit)

    if (logError) {
        console.error('Error fetching global audit logs:', logError)
        return []
    }

    if (!logs || logs.length === 0) return []

    // 2. Collect unique user IDs
    const userIds = Array.from(new Set(logs.map(log => log.changed_by).filter(Boolean))) as string[]

    if (userIds.length === 0) return logs

    // 3. Fetch user profiles
    const { data: profiles, error: profileError } = await supabase
        .from('user_profiles' as any)
        .select('id, email, full_name, avatar_url')
        .in('id', userIds)

    if (profileError) {
        console.warn('Error fetching user profiles for audit logs:', profileError)
        return logs
    }

    // 4. Map profiles to logs
    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]))

    return logs.map(log => ({
        ...log,
        changed_by_user: log.changed_by ? profileMap.get(log.changed_by) : null
    }))
}
