import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { subscription, user_id, user_name, team_names, system_code, company_id } = body

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: 'Subscription endpoint is required' }, { status: 400 })
        }

        const endpoint = subscription.endpoint
        const now = new Date().toISOString()

        // Check if subscription already exists for this endpoint
        const { data: existing } = await supabaseAdmin
            .from('audit_logs')
            .select('id, new_data')
            .eq('table_name', 'push_subscriptions')
            .limit(100)

        const matched = existing?.find(row => {
            const data = row.new_data as any
            return data && data.endpoint === endpoint
        })

        const subscriptionData = {
            endpoint: subscription.endpoint,
            keys: subscription.keys || {},
            user_id: user_id || null,
            user_name: user_name || 'Nhân viên',
            team_names: Array.isArray(team_names) ? team_names : [],
            system_code: system_code || 'sanxuat',
            company_id: company_id || null,
            updated_at: now,
            is_active: true,
        }

        if (matched) {
            // Update existing record
            await supabaseAdmin
                .from('audit_logs')
                .update({
                    record_id: user_id || matched.id,
                    new_data: subscriptionData,
                    action: 'UPDATE_SUBSCRIBE',
                })
                .eq('id', matched.id)
        } else {
            // Insert new record
            await supabaseAdmin
                .from('audit_logs')
                .insert({
                    table_name: 'push_subscriptions',
                    record_id: user_id || 'anonymous',
                    action: 'SUBSCRIBE',
                    new_data: subscriptionData,
                    system_code: system_code || 'sanxuat',
                    company_id: company_id || null,
                    created_at: now,
                })
        }

        return NextResponse.json({ success: true, message: 'Subscribed successfully' })
    } catch (err: any) {
        console.error('Error in /api/notifications/subscribe POST:', err)
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json()
        const { endpoint } = body

        if (!endpoint) {
            return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 })
        }

        const { data: existing } = await supabaseAdmin
            .from('audit_logs')
            .select('id, new_data')
            .eq('table_name', 'push_subscriptions')
            .limit(100)

        const matched = existing?.filter(row => {
            const data = row.new_data as any
            return data && data.endpoint === endpoint
        })

        if (matched && matched.length > 0) {
            for (const item of matched) {
                await supabaseAdmin
                    .from('audit_logs')
                    .delete()
                    .eq('id', item.id)
            }
        }

        return NextResponse.json({ success: true, message: 'Unsubscribed successfully' })
    } catch (err: any) {
        console.error('Error in /api/notifications/subscribe DELETE:', err)
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}
