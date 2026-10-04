import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getAdminClient() {
    return createClient(supabaseUrl, serviceRoleKey)
}

export interface LoosePositionConfig {
    productId?: string | null
    productName: string
    sku?: string | null
    isClosed: boolean // true = Đóng (không tính tồn kho), false = Mở (tính vào tồn kho)
    note?: string
    updatedAt?: string
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const systemCode = searchParams.get('systemCode')
        if (!systemCode) {
            return NextResponse.json({ error: 'Missing systemCode' }, { status: 400 })
        }

        const supabase = getAdminClient()
        const { data: system, error } = await supabase
            .from('systems')
            .select('modules')
            .eq('code', systemCode)
            .single()

        if (error || !system) {
            return NextResponse.json({ loosePositions: {} })
        }

        const modules = (system.modules || {}) as Record<string, any>
        const loosePositions: Record<string, LoosePositionConfig> = modules.loose_positions && typeof modules.loose_positions === 'object'
            ? modules.loose_positions
            : {}

        return NextResponse.json({ loosePositions })
    } catch (e: any) {
        console.error('Error fetching loose positions:', e)
        return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const { systemCode, positionIds, action, config, isClosed } = await req.json()
        if (!systemCode) {
            return NextResponse.json({ error: 'Missing systemCode' }, { status: 400 })
        }

        const supabase = getAdminClient()
        const { data: system, error: fetchErr } = await supabase
            .from('systems')
            .select('id, modules')
            .eq('code', systemCode)
            .single()

        if (fetchErr || !system) {
            return NextResponse.json({ error: 'System not found' }, { status: 404 })
        }

        const modules = (system.modules || {}) as Record<string, any>
        const currentLoose: Record<string, LoosePositionConfig> = {
            ...(modules.loose_positions && typeof modules.loose_positions === 'object' ? modules.loose_positions : {})
        }

        const now = new Date().toISOString()

        if (action === 'set') {
            // Set loose positions configuration
            if (!Array.isArray(positionIds) || positionIds.length === 0) {
                return NextResponse.json({ error: 'Missing positionIds' }, { status: 400 })
            }
            positionIds.forEach(id => {
                currentLoose[id] = {
                    productId: config?.productId || null,
                    productName: config?.productName || 'Hàng lẻ',
                    sku: config?.sku || null,
                    isClosed: config?.isClosed !== undefined ? !!config.isClosed : true,
                    note: config?.note || '',
                    updatedAt: now
                }
            })
        } else if (action === 'toggle_status') {
            // Toggle open/closed status for given positions
            if (!Array.isArray(positionIds) || positionIds.length === 0) {
                return NextResponse.json({ error: 'Missing positionIds' }, { status: 400 })
            }
            positionIds.forEach(id => {
                if (currentLoose[id]) {
                    currentLoose[id] = {
                        ...currentLoose[id],
                        isClosed: isClosed !== undefined ? !!isClosed : !currentLoose[id].isClosed,
                        updatedAt: now
                    }
                }
            })
        } else if (action === 'set_all_status') {
            // Set all loose positions open/closed (for month-end inventory)
            const targetClosed = isClosed !== undefined ? !!isClosed : false
            Object.keys(currentLoose).forEach(id => {
                currentLoose[id] = {
                    ...currentLoose[id],
                    isClosed: targetClosed,
                    updatedAt: now
                }
            })
        } else if (action === 'remove') {
            // Remove loose position flag
            if (!Array.isArray(positionIds) || positionIds.length === 0) {
                return NextResponse.json({ error: 'Missing positionIds' }, { status: 400 })
            }
            positionIds.forEach(id => {
                delete currentLoose[id]
            })
        }

        const updatedModules = {
            ...modules,
            loose_positions: currentLoose
        }

        const { error: updateErr } = await supabase
            .from('systems')
            .update({ modules: updatedModules })
            .eq('id', system.id)

        if (updateErr) {
            console.error('Error updating loose_positions:', updateErr)
            return NextResponse.json({ error: updateErr.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            loosePositions: currentLoose
        })
    } catch (e: any) {
        console.error('Error handling loose positions:', e)
        return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
    }
}
