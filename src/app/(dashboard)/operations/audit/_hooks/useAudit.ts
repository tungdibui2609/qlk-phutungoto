'use client'

import { useState, useCallback } from 'react'
import { supabase, TypedDatabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'
import { useRouter } from 'next/navigation'

export type InventoryCheck = TypedDatabase['public']['Tables']['inventory_checks']['Row'] & {
    user_profiles?: { full_name: string | null }
}

export type InventoryCheckItem = TypedDatabase['public']['Tables']['inventory_check_items']['Row'] & {
    lots?: { code: string; batch_code?: string | null } | null
    products?: { name: string; sku: string; unit: string | null; image_url?: string | null } | null
}

export function useAudit() {
    const { currentSystem } = useSystem()
    const { user } = useUser()
    const { showToast, showConfirm } = useToast()
    const router = useRouter()

    const [loading, setLoading] = useState(false)
    const [sessions, setSessions] = useState<InventoryCheck[]>([])
    const [currentSession, setCurrentSession] = useState<InventoryCheck | null>(null)
    const [sessionItems, setSessionItems] = useState<InventoryCheckItem[]>([])

    // Fetch list of sessions
    const fetchSessions = useCallback(async (status?: string) => {
        if (!currentSystem?.code) return

        setLoading(true)
        let query = supabase
            .from('inventory_checks')
            .select('*, user_profiles:created_by(full_name)')
            .eq('system_code', currentSystem.code)
            .order('created_at', { ascending: false })

        if (status && status !== 'ALL') {
            query = query.eq('status', status as any)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error fetching inventory checks:', error)
            showToast('Lỗi tải danh sách kiểm kê', 'error')
        } else {
            setSessions(data as any)
        }
        setLoading(false)
    }, [currentSystem, showToast])

    // Create a new session
    const createSession = async (warehouseId: string | null, warehouseName: string | null, note: string) => {
        if (!currentSystem?.code || !user) return null

        setLoading(true)
        try {
            // 1. Create the Check Record
            // Generate a code: KK-YYMMDD-XXXX
            const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
            const randomSuffix = Math.floor(1000 + Math.random() * 9000)
            const code = `KK-${dateStr}-${randomSuffix}`

            const { data: checkData, error: checkError } = await supabase
                .from('inventory_checks')
                .insert({
                    code,
                    warehouse_id: warehouseId,
                    warehouse_name: warehouseName,
                    note,
                    system_code: currentSystem.code,
                    created_by: user.id,
                    status: 'IN_PROGRESS'
                })
                .select()
                .single()

            if (checkError) throw checkError
            if (!checkData) throw new Error('No data returned from creation')

            const checkId = checkData.id

            // 2. Fetch existing Lot Items to snapshot
            let lotQuery = supabase
                .from('lot_items')
                .select(`
                    id,
                    quantity,
                    product_id,
                    unit,
                    lots!inner (
                        id,
                        system_code,
                        warehouse_name
                    )
                `)
                .eq('lots.system_code', currentSystem.code)
                .gt('quantity', 0) // Only snapshot items with quantity > 0? Standard practice involves listing 0 if it's supposed to be there, but usually we only list what system thinks we have.

            if (warehouseName) {
                lotQuery = lotQuery.eq('lots.warehouse_name', warehouseName)
            }

            const { data: itemsData, error: itemsError } = await lotQuery

            if (itemsError) throw itemsError

            // 3. Prepare Bulk Insert
            if (itemsData && itemsData.length > 0) {
                const checkItems = (itemsData as any[]).map(item => ({
                    check_id: checkId,
                    lot_id: (item.lots as any).id,
                    lot_item_id: item.id,
                    product_id: item.product_id,
                    system_quantity: item.quantity,
                    actual_quantity: null,
                    difference: 0 - item.quantity, // Initial diff logic: If we assume Actual is 0 until counted, diff is -Qty. But UI will show "Not Counted".
                    unit: item.unit || 'Cái',
                    note: ''
                }))

                // Bulk insert in chunks of 100 to avoid request size limits
                const chunkSize = 100
                for (let i = 0; i < checkItems.length; i += chunkSize) {
                    const chunk = checkItems.slice(i, i + chunkSize)
                    const { error: insertError } = await supabase
                        .from('inventory_check_items')
                        .insert(chunk)

                    if (insertError) throw insertError
                }
            }

            showToast('Đã tạo phiếu kiểm kê thành công', 'success')
            router.push(`/operations/audit/${checkId}`)
            return checkId

        } catch (error: any) {
            console.error('Error creating session:', error)
            showToast('Lỗi tạo phiếu: ' + error.message, 'error')
            return null
        } finally {
            setLoading(false)
        }
    }

    // Fetch detail
    const fetchSessionDetail = useCallback(async (id: string) => {
        setLoading(true)
        // Fetch Header
        const { data: check, error: checkError } = await supabase
            .from('inventory_checks')
            .select('*, user_profiles:created_by(full_name)')
            .eq('id', id)
            .single()

        if (checkError) {
            showToast('Không tìm thấy phiếu kiểm kê', 'error')
            setLoading(false)
            return
        }

        setCurrentSession(check as any)

        // Fetch Items
        const { data: items, error: itemsError } = await supabase
            .from('inventory_check_items')
            .select(`
                *,
                lots (code, batch_code),
                products (name, sku, unit, image_url)
            `)
            .eq('check_id', id)
            .order('created_at')

        if (itemsError) {
            showToast('Lỗi tải chi tiết sản phẩm', 'error')
        } else {
            setSessionItems(items as any)
        }
        setLoading(false)
    }, [showToast])

    // Update Item
    const updateItem = async (itemId: string, actualQty: number | null, note?: string) => {
        // Optimistic update
        const oldItems = [...sessionItems]
        const targetIndex = sessionItems.findIndex(i => i.id === itemId)
        if (targetIndex === -1) return

        const item = sessionItems[targetIndex]
        const difference = actualQty !== null ? actualQty - item.system_quantity : 0 - item.system_quantity

        const newItem = { ...item, actual_quantity: actualQty, difference, note: note ?? item.note }
        const newItems = [...sessionItems]
        newItems[targetIndex] = newItem
        setSessionItems(newItems)

        const { error } = await supabase
            .from('inventory_check_items')
            .update({ actual_quantity: actualQty, difference, note })
            .eq('id', itemId)

        if (error) {
            showToast('Lỗi lưu số lượng', 'error')
            setSessionItems(oldItems) // Revert
        }
    }

    // Complete Session
    const completeSession = async (checkId: string) => {
         if (!await showConfirm('Bạn có chắc chắn muốn hoàn thành và cân bằng kho? Hành động này sẽ cập nhật số lượng tồn kho thực tế.')) return

         setLoading(true)
         try {
             // 1. Get latest items state
             const { data: items, error: itemsError } = await supabase
                .from('inventory_check_items')
                .select('*')
                .eq('check_id', checkId)

            if (itemsError) throw itemsError

            // 2. Iterate and Update
            for (const item of items) {
                // Only process items that have been counted (actual_quantity !== null) AND have a difference
                if (item.actual_quantity !== null && item.difference !== 0 && item.lot_item_id) {
                     // Update Lot Item Quantity
                     const { error: updateError } = await supabase
                        .from('lot_items')
                        .update({ quantity: item.actual_quantity })
                        .eq('id', item.lot_item_id)

                     if (updateError) {
                         console.error(`Failed to update lot item ${item.lot_item_id}`, updateError)
                         // Continue or break? Continue to try best effort.
                     }

                     // Log activity? The audit_logs usually handled by triggers or manual.
                     // Since we don't have triggers set up for this specific mass update logic, we might want to log it.
                     // But let's assume the 'User Management' audit log is for user profiles.
                     // If we want system audit logs, we should insert into audit_logs.
                }
            }

            // 3. Mark Completed
             await supabase
                .from('inventory_checks')
                .update({
                    status: 'COMPLETED',
                    completed_at: new Date().toISOString()
                })
                .eq('id', checkId)

             showToast('Đã hoàn thành kiểm kê', 'success')
             router.push('/operations/audit')

         } catch (error: any) {
             console.error('Error completing session:', error)
             showToast('Lỗi: ' + error.message, 'error')
         } finally {
             setLoading(false)
         }
    }

    // Quick Fill (Set all nulls to system qty)
    const quickFill = async () => {
         const itemsToUpdate = sessionItems.filter(i => i.actual_quantity === null)
         if (itemsToUpdate.length === 0) return

         if (!await showConfirm(`Tự động điền số lượng hệ thống cho ${itemsToUpdate.length} dòng chưa kiểm?`)) return

         setLoading(true)

         // Optimistic Update
         const newItems = sessionItems.map(item => {
             if (item.actual_quantity === null) {
                 return { ...item, actual_quantity: item.system_quantity, difference: 0 }
             }
             return item
         })
         setSessionItems(newItems)

         // Chunked updates
         const chunkSize = 50 // Smaller chunks for updates
         for (let i = 0; i < itemsToUpdate.length; i += chunkSize) {
             const chunk = itemsToUpdate.slice(i, i + chunkSize)
             const promises = chunk.map(item =>
                 supabase.from('inventory_check_items').update({
                     actual_quantity: item.system_quantity,
                     difference: 0
                 }).eq('id', item.id)
             )
             await Promise.all(promises)
         }

         setLoading(false)
         showToast('Đã điền tự động', 'success')
    }

    return {
        loading,
        sessions,
        currentSession,
        sessionItems,
        fetchSessions,
        createSession,
        fetchSessionDetail,
        updateItem,
        completeSession,
        quickFill
    }
}
