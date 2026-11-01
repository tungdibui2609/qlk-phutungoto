/** Đọc hết một bảng qua Supabase PostgREST theo từng trang, cho các danh sách lớn hơn 1000 dòng. */
export const SUPABASE_PAGE_SIZE = 1000

export async function fetchAllPaged<T>(
    build: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> {
    const all: T[] = []
    let from = 0
    while (true) {
        const { data, error } = await build(from, from + SUPABASE_PAGE_SIZE - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < SUPABASE_PAGE_SIZE) break
        from += SUPABASE_PAGE_SIZE
    }
    return all
}
