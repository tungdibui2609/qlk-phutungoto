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
        // DB Triggers (trg_audit_lots_changes, trg_audit_lot_items_changes, trg_audit_positions_changes)
        // đã tự động ghi nhật ký 100% cho các thao tác này ở tầng PostgreSQL.
        // Bỏ qua ghi tay ở frontend để tránh sinh 2 dòng trùng lặp trong audit_logs.
        if (tableName === 'lots' && (action === 'CREATE' || action === 'UPDATE')) {
            return
        }
        if (
            tableName === 'positions' &&
            action === 'UPDATE' &&
            ((oldData && 'lot_id' in oldData) || (newData && 'lot_id' in newData))
        ) {
            return
        }

        // If userId is not provided, try to get it from the session
        let changedBy = userId
        if (!changedBy) {
            const { data: { session } } = await supabase.auth.getSession()
            changedBy = session?.user?.id
        }

        const { error } = await (supabase.from('audit_logs') as any).insert({
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
    const { data: logs, error: logError } = await (supabase
        .from('audit_logs') as any)
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
    const userIds = Array.from(new Set(logs.map((log: any) => log.changed_by).filter(Boolean))) as string[]

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

    const withUsers = logs.map((log: any) => ({
        ...log,
        changed_by_user: log.changed_by ? profileMap.get(log.changed_by) : null
    }))

    return enrichAuditLogs(supabase, withUsers)
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
    const { data: log, error: logError } = await (supabase
        .from('audit_logs') as any)
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

    const [enriched] = await enrichAuditLogs(supabase, [{
        ...log,
        changed_by_user: userProfile
    }])
    return enriched
}

const AUDIT_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Enriches audit_logs with position codes, lot codes, product names/SKUs and item summaries.
 */
async function enrichAuditLogs(
    supabase: SupabaseClient<TypedDatabase>,
    logs: any[]
): Promise<any[]> {
    if (!logs || logs.length === 0) return []

    const posIds = new Set<string>()
    const lotIds = new Set<string>()
    const productIds = new Set<string>()

    for (const log of logs) {
        if (log.table_name === 'positions' && log.record_id && AUDIT_UUID_REGEX.test(log.record_id)) {
            posIds.add(log.record_id)
        }
        if (log.table_name === 'lots' && log.record_id && AUDIT_UUID_REGEX.test(log.record_id)) {
            lotIds.add(log.record_id)
        }
        for (const snap of [log.old_data, log.new_data]) {
            if (!snap || typeof snap !== 'object') continue
            if (snap.lot_id && AUDIT_UUID_REGEX.test(snap.lot_id)) lotIds.add(snap.lot_id)
            if (snap.product_id && AUDIT_UUID_REGEX.test(snap.product_id)) productIds.add(snap.product_id)
            if (Array.isArray(snap.lot_items)) {
                for (const it of snap.lot_items) {
                    if (it?.product_id && AUDIT_UUID_REGEX.test(it.product_id)) productIds.add(it.product_id)
                }
            }
        }
    }

    const [posRes, lotsRes, prodRes] = await Promise.all([
        posIds.size > 0
            ? supabase.from('positions').select('id, code').in('id', Array.from(posIds))
            : Promise.resolve({ data: [] }),
        lotIds.size > 0
            ? supabase
                  .from('lots')
                  .select('id, code, daily_seq, products(name, sku, unit), lot_items(quantity, unit, products(name, sku, unit))')
                  .in('id', Array.from(lotIds))
            : Promise.resolve({ data: [] }),
        productIds.size > 0
            ? supabase.from('products').select('id, name, sku, unit').in('id', Array.from(productIds))
            : Promise.resolve({ data: [] })
    ])

    const posMap = new Map<string, string>(((posRes as any).data || []).map((p: any) => [p.id, p.code]))
    const lotMap = new Map<string, any>(((lotsRes as any).data || []).map((l: any) => [l.id, l]))
    const prodMap = new Map<string, any>(((prodRes as any).data || []).map((p: any) => [p.id, p]))

    const formatLotItems = (lotObj: any, snap?: any) => {
        const items = Array.isArray(snap?.lot_items) && snap.lot_items.length > 0
            ? snap.lot_items
            : lotObj?.lot_items || []
        if (items.length > 0) {
            return items.map((it: any) => {
                const p = it.products || prodMap.get(it.product_id)
                return {
                    sku: p?.sku || '-',
                    name: p?.name || 'Sản phẩm',
                    quantity: Number(it.quantity) || 0,
                    unit: it.unit || p?.unit || ''
                }
            })
        }
        const pid = snap?.product_id
        const p = snap?.products || (pid ? prodMap.get(pid) : null) || lotObj?.products
        const qty = snap?.quantity
        if (p?.name && qty !== undefined && qty !== null) {
            return [{ sku: p.sku || '-', name: p.name, quantity: Number(qty) || 0, unit: p.unit || '' }]
        }
        return []
    }

    return logs.map((log: any) => {
        const snap = log.new_data || log.old_data || {}
        const positionCode =
            log.table_name === 'positions'
                ? posMap.get(log.record_id) || snap._position_code || log.old_data?._position_code || null
                : null

        const oldLotId = log.old_data?.lot_id || null
        const newLotId = log.new_data?.lot_id || null
        const primaryLotId =
            log.table_name === 'lots'
                ? log.record_id
                : newLotId || oldLotId || snap.lot_id || null

        const lotObj = primaryLotId ? lotMap.get(primaryLotId) : null
        const oldLotObj = oldLotId ? lotMap.get(oldLotId) : null
        const newLotObj = newLotId ? lotMap.get(newLotId) : null

        const pid = snap.product_id || log.old_data?.product_id
        const prodObj = pid ? prodMap.get(pid) : null

        const lotPositions = Array.isArray(log.old_data?.positions)
            ? log.old_data.positions.map((p: any) => p.code).filter(Boolean)
            : Array.isArray(log.new_data?.positions)
            ? log.new_data.positions.map((p: any) => p.code).filter(Boolean)
            : []

        return {
            ...log,
            _enriched: {
                positionCode,
                lotCode: snap.code || snap._lot_code || lotObj?.code || null,
                dailySeq: snap.daily_seq ?? snap._daily_seq ?? lotObj?.daily_seq ?? null,
                oldLotCode: oldLotObj?.code || null,
                newLotCode: newLotObj?.code || null,
                lotPositions,
                productSku: prodObj?.sku || snap.products?.sku || null,
                productName: prodObj?.name || snap.products?.name || null,
                productUnit: prodObj?.unit || snap.unit || log.old_data?.unit || null,
                itemsSummary: formatLotItems(lotObj, log.action === 'DELETE' ? log.old_data : snap)
            }
        }
    })
}

/**
 * Fetches all actions performed BY a specific user.
 */
export async function getUserActivityLogs(
    supabase: SupabaseClient<TypedDatabase>,
    userId: string
) {
    const { data: logs, error: logError } = await (supabase
        .from('audit_logs') as any)
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

    return logs.map((log: any) => ({
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
    let query = (supabase
        .from('audit_logs') as any)
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
    const userIds = Array.from(new Set(logs.map((log: any) => log.changed_by).filter(Boolean))) as string[]

    if (userIds.length === 0) return enrichAuditLogs(supabase, logs)

    // 3. Fetch user profiles
    const { data: profiles, error: profileError } = await supabase
        .from('user_profiles' as any)
        .select('id, email, full_name, avatar_url')
        .in('id', userIds)

    if (profileError) {
        console.warn('Error fetching user profiles for audit logs:', profileError)
        return enrichAuditLogs(supabase, logs)
    }

    // 4. Map profiles to logs
    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]))

    const withUsers = logs.map((log: any) => ({
        ...log,
        changed_by_user: log.changed_by ? profileMap.get(log.changed_by) : null
    }))

    return enrichAuditLogs(supabase, withUsers)
}
