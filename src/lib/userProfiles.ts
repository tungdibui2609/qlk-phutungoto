import { supabase } from '@/lib/supabaseClient'

export interface UserProfileLite {
    username: string | null
    full_name: string | null
}

type ProfileRow = UserProfileLite & { id: string }

// Kong local từ chối URL quá dài: .in() với ~250 UUID trả "URI too long" nên phải chia nhỏ.
const ID_CHUNK_SIZE = 100

/**
 * Tra hồ sơ người dùng theo id.
 * Dùng khi cột FK trỏ thẳng auth.users (PostgREST không nhúng được bảng schema auth,
 * cũng không resolve user_profiles qua FK đó) nên phải tách thành truy vấn riêng.
 */
export async function fetchUserProfilesByIds(
    ids: Iterable<string | null | undefined>
): Promise<Map<string, UserProfileLite>> {
    const unique = Array.from(new Set(
        Array.from(ids).filter((id): id is string => typeof id === 'string' && id.length > 0)
    ))
    const map = new Map<string, UserProfileLite>()
    for (let i = 0; i < unique.length; i += ID_CHUNK_SIZE) {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('id, username, full_name')
            .in('id', unique.slice(i, i + ID_CHUNK_SIZE))
        if (error) throw error
        for (const u of (data || []) as ProfileRow[]) {
            map.set(u.id, { username: u.username ?? null, full_name: u.full_name ?? null })
        }
    }
    return map
}

export function formatProfileName(profile: UserProfileLite | undefined): string {
    return profile?.full_name || profile?.username || 'Không rõ'
}
