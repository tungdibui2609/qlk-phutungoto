import { supabase } from './supabaseClient'

export type OperationalNote = {
    id: string
    content: string
    user_id: string
    parent_id: string | null
    images: string[]
    system_code: string | null
    created_at: string
    user?: {
        full_name: string | null
        avatar_url: string | null
        email?: string | null
    } | null
}

export async function getNotes(systemCode?: string): Promise<OperationalNote[]> {
    let query = supabase
        .from('operational_notes')
        .select(`
            *,
            user:user_profiles (
                full_name,
                avatar_url,
                email
            )
        `)

    if (systemCode) {
        query = query.or(`system_code.eq.${systemCode},system_code.is.null`)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching notes:', error)
        throw error
    }

    return data as unknown as OperationalNote[]
}

export async function createNote(content: string, parentId: string | null, images: string[] = [], systemCode?: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('operational_notes')
        .insert({
            content,
            user_id: user.id,
            parent_id: parentId,
            images,
            system_code: systemCode
        })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteNote(id: string) {
    const { error } = await supabase
        .from('operational_notes')
        .delete()
        .eq('id', id)

    if (error) throw error
}

export async function uploadNoteImage(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'operational-notes')

    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
    }

    const data = await response.json()
    return data.viewUrl
}
