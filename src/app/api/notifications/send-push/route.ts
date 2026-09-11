import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

import { VAPID_CONFIG } from '@/lib/constants'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || VAPID_CONFIG.publicKey
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || VAPID_CONFIG.privateKey
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || VAPID_CONFIG.subject

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    try {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    } catch (err) {
        console.error('Error setting VAPID details:', err)
    }
}

export async function POST(req: NextRequest) {
    try {
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
        }

        const body = await req.json()
        const {
            title = 'Thông Báo Việc Mới - Chánh Thu',
            body: messageBody = 'Bạn có công việc mới được phân công.',
            target_shifts = [],
            task_id = null,
            url = '/work/tasks',
            badgeCount = 1,
            is_test = false,
            user_id = null,
            user_name = null,
            subscription = null,
        } = body

        // If client sent its subscription directly (e.g. during test push), auto-upsert it
        if (subscription && subscription.endpoint && subscription.keys) {
            try {
                const { data: existing } = await supabaseAdmin
                    .from('audit_logs')
                    .select('id, new_data')
                    .eq('table_name', 'push_subscriptions')
                    .limit(50)

                const matched = existing?.find(r => (r.new_data as any)?.endpoint === subscription.endpoint)
                const subData = {
                    endpoint: subscription.endpoint,
                    keys: subscription.keys,
                    user_id: user_id || null,
                    user_name: user_name || 'Nhân viên',
                    team_names: Array.isArray(target_shifts) ? target_shifts : [],
                    system_code: 'sanxuat',
                    updated_at: new Date().toISOString(),
                    is_active: true,
                }

                if (matched) {
                    await supabaseAdmin
                        .from('audit_logs')
                        .update({ action: 'UPDATE', new_data: subData })
                        .eq('id', matched.id)
                } else {
                    await supabaseAdmin
                        .from('audit_logs')
                        .insert({
                            table_name: 'push_subscriptions',
                            record_id: user_id || 'anonymous',
                            action: 'CREATE',
                            new_data: subData,
                            system_code: 'sanxuat',
                            created_at: new Date().toISOString(),
                        })
                }
            } catch (syncErr) {
                console.warn('Could not auto-upsert direct subscription:', syncErr)
            }
        }

        // Fetch all active push subscriptions
        const { data: records, error } = await supabaseAdmin
            .from('audit_logs')
            .select('id, new_data')
            .eq('table_name', 'push_subscriptions')
            .order('created_at', { ascending: false })

        // If direct subscription was passed, construct list with at least this subscription
        let targets: any[] = []

        if (subscription && subscription.endpoint && subscription.keys) {
            targets = [{ id: 'direct', new_data: subscription }]
        } else if (records && records.length > 0) {
            // Filter valid active subscriptions
            const validRecords = records.filter(row => {
                const data = row.new_data as any
                return data && data.endpoint && data.keys && data.is_active !== false
            })

            if (is_test) {
                // If it's a test push, prioritize matching caller's user_id, or send to all valid records
                const userMatched = user_id ? validRecords.filter(r => (r.new_data as any)?.user_id === user_id) : []
                targets = userMatched.length > 0 ? userMatched : validRecords
            } else {
                // Normalize target teams
                const normalizedTargetTeams = (Array.isArray(target_shifts) ? target_shifts : [target_shifts])
                    .map((s: string) => (s || '').toLowerCase().replace(/^đội\s+/, '').trim())
                    .filter(Boolean)

                const hasSpecificTeams = normalizedTargetTeams.some(t => !t.startsWith('ca ') && t !== 'chung')

                targets = validRecords.filter(row => {
                    const data = row.new_data as any
                    if (hasSpecificTeams) {
                        const userTeams = (Array.isArray(data.team_names) ? data.team_names : [])
                            .map((t: string) => (t || '').toLowerCase().replace(/^đội\s+/, '').trim())

                        const matchesTeam = userTeams.some(myT =>
                            normalizedTargetTeams.some(targetT => myT === targetT || myT.includes(targetT) || targetT.includes(myT))
                        )
                        return matchesTeam
                    }
                    return true
                })
            }
        }

        if (targets.length === 0) {
            return NextResponse.json({
                success: true,
                sentCount: 0,
                message: is_test 
                    ? 'Chưa tìm thấy thiết bị nào đã đăng ký. Bạn hãy chắc chắn đã bấm Bật ngay và chọn Cho phép trên điện thoại nhé!'
                    : 'No matching subscribers for target teams'
            })
        }

        const payload = JSON.stringify({
            title,
            body: messageBody,
            url,
            taskId: task_id,
            badgeCount,
            icon: '/logoanywarehouse.png',
            badge: '/logoanywarehouse.png',
            timestamp: Date.now(),
        })

        let sentCount = 0
        const expiredRecordIds: string[] = []

        await Promise.all(
            targets.map(async (row) => {
                const subData = row.new_data as any
                const pushSubscription = {
                    endpoint: subData.endpoint,
                    keys: subData.keys,
                }

                try {
                    await webpush.sendNotification(pushSubscription, payload, {
                        TTL: 86400, // 24 hours
                        urgency: 'high',
                    })
                    sentCount++
                } catch (pushErr: any) {
                    console.error('Push error for subscriber:', subData.user_name, pushErr?.statusCode || pushErr?.message)
                    // If endpoint expired or gone (410 / 404), mark for cleanup
                    if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
                        expiredRecordIds.push(row.id)
                    }
                }
            })
        )

        // Clean up dead subscriptions
        if (expiredRecordIds.length > 0) {
            for (const id of expiredRecordIds) {
                await supabaseAdmin.from('audit_logs').delete().eq('id', id)
            }
        }

        return NextResponse.json({
            success: true,
            sentCount,
            totalSubscribers: targets.length,
            cleanedUp: expiredRecordIds.length,
        })
    } catch (err: any) {
        console.error('Error in /api/notifications/send-push POST:', err)
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}
