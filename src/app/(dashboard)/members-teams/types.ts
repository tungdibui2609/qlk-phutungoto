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
    user_id?: string | null
    teams?: ConstructionTeam // For join
    user?: {
        id: string
        full_name: string
        username: string | null
        email: string | null
        employee_code?: string | null
        avatar_url?: string | null
    } | null
}
