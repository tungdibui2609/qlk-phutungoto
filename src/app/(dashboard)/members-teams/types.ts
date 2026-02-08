export interface ConstructionTeam {
    id: string
    name: string
    code: string | null
    description: string | null
    created_at: string
}

export interface ConstructionMember {
    id: string
    full_name: string
    phone: string | null
    role: string | null
    team_id: string | null
    is_active: boolean
    teams?: ConstructionTeam // For join
}
