import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getAdminClient() {
    return createClient(supabaseUrl, serviceRoleKey)
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
            return NextResponse.json({ lockedPositionIds: [] })
        }

        const modules = (system.modules || {}) as Record<string, any>
        const lockedPositionIds: string[] = Array.isArray(modules.locked_position_ids)
            ? modules.locked_position_ids
            : []

        return NextResponse.json({ lockedPositionIds })
    } catch (e: any) {
        console.error('Error fetching locked positions:', e)
        return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const { systemCode, positionIds, action } = await req.json()
        if (!systemCode || !Array.isArray(positionIds)) {
            return NextResponse.json({ error: 'Missing systemCode or positionIds' }, { status: 400 })
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
        const currentSet = new Set<string>(
            Array.isArray(modules.locked_position_ids) ? modules.locked_position_ids : []
        )

        if (action === 'lock') {
            positionIds.forEach(id => currentSet.add(id))
        } else if (action === 'unlock') {
            positionIds.forEach(id => currentSet.delete(id))
        } else if (action === 'set') {
            currentSet.clear()
            positionIds.forEach(id => currentSet.add(id))
        } else {
            // default toggle: if all are locked -> unlock, otherwise -> lock
            const allLocked = positionIds.every(id => currentSet.has(id))
            if (allLocked) {
                positionIds.forEach(id => currentSet.delete(id))
            } else {
                positionIds.forEach(id => currentSet.add(id))
            }
        }

        const newLockedArray = Array.from(currentSet)
        const updatedModules = {
            ...modules,
            locked_position_ids: newLockedArray
        }

        const { error: updateErr } = await supabase
            .from('systems')
            .update({ modules: updatedModules })
            .eq('id', system.id)

        if (updateErr) {
            console.error('Error updating system modules locked_position_ids:', updateErr)
            return NextResponse.json({ error: updateErr.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            lockedPositionIds: newLockedArray
        })
    } catch (e: any) {
        console.error('Error modifying locked positions:', e)
        return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
    }
}
