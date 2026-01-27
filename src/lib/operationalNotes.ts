import { supabase } from './supabaseClient'

export type OperationalNote = {
    id: string
    content: string
    user_id: string
    parent_id: string | null
    images: string[]
    created_at: string
    user?: {
        full_name: string | null
        avatar_url: string | null
        email?: string | null
    } | null
}

export async function getNotes(): Promise<OperationalNote[]> {
    const { data, error } = await supabase
        .from('operational_notes')
        .select(`
            *,
            user:user_profiles (
                full_name,
                avatar_url,
                email
            )
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching notes:', error)
        throw error
    }

    return data as unknown as OperationalNote[]
}

export async function createNote(content: string, parentId: string | null, images: string[] = []) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('operational_notes')
        .insert({
            content,
            user_id: user.id,
            parent_id: parentId,
            images
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
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `${fileName}`

    const { error: uploadError } = await supabase.storage
        .from('note-attachments')
        .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data } = supabase.storage
        .from('note-attachments')
        .getPublicUrl(filePath)

    return data.publicUrl
}
