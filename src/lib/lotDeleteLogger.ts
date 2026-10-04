import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lưu toàn bộ snapshot thông tin của LOT (kèm sản phẩm, tem phụ, vị trí, số lượng, ngày tháng, ...)
 * vào bảng audit_logs với action = 'DELETE' trước khi xóa khỏi bảng lots.
 * Đảm bảo người dùng có thể tra cứu và khôi phục/tạo lại LOT bất cứ lúc nào trong Nhật ký xuất nhập LOT.
 */
export async function logLotsDeletion(supabase: SupabaseClient<any>, lotIds: string[]) {
    if (!lotIds || lotIds.length === 0) return
    try {
        const { data: snapshotLots, error } = await supabase
            .from('lots')
            .select(`
                *,
                suppliers (name),
                products (name, sku, unit),
                productions (code, name),
                positions!positions_lot_id_fkey (id, code),
                lot_items (
                    id,
                    quantity,
                    unit,
                    product_id,
                    products (name, sku, unit)
                ),
                lot_tags (tag, lot_item_id)
            `)
            .in('id', lotIds)

        if (error) {
            console.error('Error fetching snapshot before lot delete:', error)
            return
        }

        if (snapshotLots && snapshotLots.length > 0) {
            const { data: { session } } = await supabase.auth.getSession()
            const userId = session?.user?.id
            const logsToInsert = snapshotLots.map((l: any) => ({
                table_name: 'lots',
                record_id: l.id,
                action: 'DELETE',
                old_data: l,
                new_data: null,
                changed_by: userId,
                system_code: l.system_code
            }))
            const { error: insertErr } = await (supabase.from('audit_logs') as any).insert(logsToInsert)
            if (insertErr) {
                console.error('Error inserting delete audit log:', insertErr)
            }
        }
    } catch (e) {
        console.error('Failed to log lot deletion to audit_logs:', e)
    }
}
