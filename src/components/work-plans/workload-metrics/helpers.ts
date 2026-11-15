import type { WorkloadDifficulty } from '../types'

export function toDateStr(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

export function shiftDays(baseDateStr: string, offset: number): string {
    const d = new Date(`${baseDateStr}T00:00:00`)
    if (isNaN(d.getTime())) return baseDateStr
    d.setDate(d.getDate() + offset)
    return toDateStr(d)
}


export type ProofSourceTab =
    | 'export_order'
    | 'inbound'
    | 'outbound'
    | 'lots_by_date'
    | 'approved_assignments'
    | 'manual_entry'

export const DIFFICULTY_KEYS: WorkloadDifficulty[] = ['light', 'medium', 'heavy', 'very_heavy']

// Quy đổi mặc định khi nhập tay (người dùng chốt: 1 pallet/vị trí/LOT = 600 kg, 1 thùng/kiện = 20 kg)
export const MANUAL_KG_PER_PALLET = 600
export const MANUAL_KG_PER_PACKAGE = 20
