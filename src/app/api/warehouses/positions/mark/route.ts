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
            return NextResponse.json({ markedPositionIds: [], markedNotes: {} })
        }

        const modules = (system.modules || {}) as Record<string, any>
        const rawMarked = modules.marked_positions || {}

        // Format rawMarked into ids and notes
        const markedNotes: Record<string, string> = {}
        const markedPositionIds: string[] = []

        if (Array.isArray(rawMarked)) {
            rawMarked.forEach((id: string) => {
                markedPositionIds.push(id)
                markedNotes[id] = ''
            })
        } else if (typeof rawMarked === 'object' && rawMarked !== null) {
            Object.entries(rawMarked).forEach(([id, val]) => {
                markedPositionIds.push(id)
                if (typeof val === 'string') {
                    markedNotes[id] = val
                } else if (typeof val === 'object' && val !== null && 'note' in val) {
                    markedNotes[id] = (val as any).note || ''
                } else {
                    markedNotes[id] = ''
                }
            })
        }

        return NextResponse.json({ markedPositionIds, markedNotes })
    } catch (e: any) {
        console.error('Error fetching marked positions:', e)
        return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { systemCode, positionIds, action, note, notes } = body

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
        let currentMarked: Record<string, { note: string; marked_at: string }> = {}

        if (Array.isArray(modules.marked_positions)) {
            modules.marked_positions.forEach((id: string) => {
                currentMarked[id] = { note: '', marked_at: new Date().toISOString() }
            })
        } else if (typeof modules.marked_positions === 'object' && modules.marked_positions !== null) {
            Object.entries(modules.marked_positions).forEach(([id, val]) => {
                if (typeof val === 'string') {
                    currentMarked[id] = { note: val, marked_at: new Date().toISOString() }
                } else if (typeof val === 'object' && val !== null) {
                    currentMarked[id] = {
                        note: (val as any).note || '',
                        marked_at: (val as any).marked_at || new Date().toISOString()
                    }
                }
            })
        }

        const now = new Date().toISOString()

        if (action === 'mark') {
            const ids: string[] = Array.isArray(positionIds) ? positionIds : []
            ids.forEach(id => {
                currentMarked[id] = {
                    note: (notes && notes[id]) !== undefined ? notes[id] : (note !== undefined ? note : (currentMarked[id]?.note || '')),
                    marked_at: currentMarked[id]?.marked_at || now
                }
            })
        } else if (action === 'unmark') {
            const ids: string[] = Array.isArray(positionIds) ? positionIds : []
            ids.forEach(id => {
                delete currentMarked[id]
            })
        } else if (action === 'update_note') {
            const ids: string[] = Array.isArray(positionIds) ? positionIds : []
            ids.forEach(id => {
                if (currentMarked[id]) {
                    currentMarked[id] = {
                        ...currentMarked[id],
                        note: note !== undefined ? note : (notes && notes[id]) || ''
                    }
                } else {
                    currentMarked[id] = {
                        note: note !== undefined ? note : (notes && notes[id]) || '',
                        marked_at: now
                    }
                }
            })
        } else if (action === 'clear') {
            currentMarked = {}
        } else if (action === 'set') {
            currentMarked = {}
            if (notes && typeof notes === 'object') {
                Object.entries(notes).forEach(([id, n]) => {
                    currentMarked[id] = { note: String(n), marked_at: now }
                })
            } else if (Array.isArray(positionIds)) {
                positionIds.forEach(id => {
                    currentMarked[id] = { note: note || '', marked_at: now }
                })
            }
        }

        const updatedModules = {
            ...modules,
            marked_positions: currentMarked
        }

        const { error: updateErr } = await supabase
            .from('systems')
            .update({ modules: updatedModules })
            .eq('id', system.id)

        if (updateErr) {
            console.error('Error updating system modules marked_positions:', updateErr)
            return NextResponse.json({ error: updateErr.message }, { status: 500 })
        }

        const markedPositionIds = Object.keys(currentMarked)
        const markedNotes: Record<string, string> = {}
        Object.entries(currentMarked).forEach(([id, item]) => {
            markedNotes[id] = item.note || ''
        })

        return NextResponse.json({
            success: true,
            markedPositionIds,
            markedNotes
        })
    } catch (e: any) {
        console.error('Error modifying marked positions:', e)
        return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
    }
}
