<<<<<<< HEAD
/* eslint-disable @typescript-eslint/no-explicit-any */
=======
>>>>>>> origin/main
'use client'

import { useState, useCallback } from 'react'
import { supabase, TypedDatabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'
import { useRouter } from 'next/navigation'
import { logActivity } from '@/lib/audit'

export type InventoryCheck = TypedDatabase['public']['Tables']['inventory_checks']['Row'] & {
    user_profiles?: { full_name: string | null }
    scope?: 'ALL' | 'PARTIAL' | null
    participants?: any
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
<<<<<<< HEAD

=======

>>>>>>> origin/main
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
<<<<<<< HEAD

=======

>>>>>>> origin/main
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
    const createSession = async (
<<<<<<< HEAD
        warehouseId: string | null,
        warehouseName: string | null,
=======
        warehouseId: string | null,
        warehouseName: string | null,
>>>>>>> origin/main
        note: string,
        scope: 'ALL' | 'PARTIAL' = 'ALL',
        productIds: string[] = [],
        participants: any[] = []
    ) => {
        if (!currentSystem?.code || !user) return null

        setLoading(true)
        try {
            // 1. Create the Check Record
            // Generate a code: KK-YYMMDD-XXXX
            const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
            const randomSuffix = Math.floor(1000 + Math.random() * 9000)
            const code = `KK-${dateStr}-${randomSuffix}`
<<<<<<< HEAD

=======

>>>>>>> origin/main
            const { data: checkData, error: checkError } = await supabase
                .from('inventory_checks')
                .insert({
                    code,
                    warehouse_id: warehouseId,
                    warehouse_name: warehouseName,
                    note,
                    system_code: currentSystem.code,
                    created_by: user.id,
                    status: 'IN_PROGRESS',
                    scope,
                    participants: participants as any // JSONB
                })
                .select()
                .single()

            if (checkError) throw checkError
            if (!checkData) throw new Error('No data returned from creation')

            const checkId = checkData.id

            // 2. Fetch Accounting Inventory (Snapshot from API)
            const dateTo = new Date().toISOString().split('T')[0]
            let apiUrl = `/api/inventory?dateTo=${dateTo}&systemType=${currentSystem.code}`
            if (warehouseName) {
                apiUrl += `&warehouse=${encodeURIComponent(warehouseName)}`
            }
<<<<<<< HEAD
            // Note: The API currently returns ALL aggregated items for the scope.
=======
            // Note: The API currently returns ALL aggregated items for the scope.
>>>>>>> origin/main
            // We do filtering client-side if scope is PARTIAL.

            const accRes = await fetch(apiUrl)
            const accData = await accRes.json()
<<<<<<< HEAD

=======

>>>>>>> origin/main
            if (!accData.ok) {
                throw new Error('Failed to fetch accounting inventory data')
            }

            let accountingItems = accData.items || []

            // Filter by selected products if PARTIAL
            if (scope === 'PARTIAL' && productIds.length > 0) {
                const allowedIds = new Set(productIds)
                accountingItems = accountingItems.filter((item: any) => allowedIds.has(item.productId))
            }

            // 3. Prepare Bulk Insert
            if (accountingItems.length > 0) {
                const checkItems = accountingItems.map((item: any) => ({
                    check_id: checkId,
                    lot_id: null, // Accounting is product-based
                    lot_item_id: null,
                    product_id: item.productId,
                    product_sku: item.productCode,
                    product_name: item.productName,
                    system_quantity: item.balance,
<<<<<<< HEAD
                    actual_quantity: null,
=======
                    actual_quantity: null,
>>>>>>> origin/main
                    difference: 0 - item.balance,
                    unit: item.unit || 'Cái',
                    note: ''
                }))

                // Bulk insert in chunks of 100
                const chunkSize = 100
                for (let i = 0; i < checkItems.length; i += chunkSize) {
                    const chunk = checkItems.slice(i, i + chunkSize)
                    const { error: insertError } = await supabase
                        .from('inventory_check_items')
                        .insert(chunk)
<<<<<<< HEAD

=======

>>>>>>> origin/main
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
<<<<<<< HEAD

=======

>>>>>>> origin/main
        if (checkError) {
            showToast('Không tìm thấy phiếu kiểm kê', 'error')
            setLoading(false)
            return
        }

        setCurrentSession(check as any)

        // Fetch Items
        const { data: rawItems, error: itemsError } = await supabase
            .from('inventory_check_items')
            .select(`
                *,
                products (name, sku, unit, image_url)
            `)
            .eq('check_id', id)
            .order('created_at')

        if (itemsError) {
            console.error('Error fetching items:', itemsError)
            showToast('Lỗi tải chi tiết sản phẩm', 'error')
        } else {
            // Manual Join for Lots (Due to loose coupling/missing FKs)
            const items = rawItems as any[]
            const lotIds = Array.from(new Set(items.map(i => i.lot_id).filter(Boolean)))
<<<<<<< HEAD

            const lotsMap: Record<string, any> = {}
=======

            let lotsMap: Record<string, any> = {}
>>>>>>> origin/main
            if (lotIds.length > 0) {
                const { data: lotsData } = await supabase
                   .from('lots')
                   .select('id, code, batch_code')
                   .in('id', lotIds)
<<<<<<< HEAD

=======

>>>>>>> origin/main
                if (lotsData) {
                    lotsData.forEach(l => { lotsMap[l.id] = l })
                }
            }

            const mergedItems = items.map(item => ({
                ...item,
                lots: item.lot_id ? lotsMap[item.lot_id] : null
            }))

            setSessionItems(mergedItems)
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
<<<<<<< HEAD

=======

>>>>>>> origin/main
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

    // Submit for Approval (Previously Complete Session)
    const submitForApproval = async (checkId: string) => {
        if (!await showConfirm('Bạn có chắc chắn muốn hoàn thành kiểm đếm và gửi duyệt phiếu này?')) return

        setLoading(true)
        try {
            await supabase
                .from('inventory_checks')
                .update({
                    status: 'WAITING_FOR_APPROVAL',
                    updated_at: new Date().toISOString()
                })
                .eq('id', checkId)

            showToast('Đã gửi phiếu kiểm kê chờ duyệt', 'success')
            router.push('/operations/audit')
        } catch (error: any) {
            console.error('Error submitting session:', error)
            showToast('Lỗi gửi duyệt: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    // Helper to create tickets
    const createAdjustmentTicket = async (checkId: string, items: any[], type: 'INBOUND' | 'OUTBOUND') => {
        if (!user || !currentSystem) return null

        // 1. Fetch appropriate Order Type
        const { data: typeData } = await (supabase.from('order_types') as any)
            .select('id')
            .eq('system_code', currentSystem.code)
            .eq('scope', type)
            .ilike('name', '%Kiểm kê%')
            .limit(1)
            .single()
<<<<<<< HEAD

=======

>>>>>>> origin/main
        let orderTypeId = typeData?.id
        if (!orderTypeId) {
             // Fallback: Get any valid type
             const { data: anyType } = await (supabase.from('order_types') as any)
                .select('id')
                .eq('system_code', currentSystem.code)
                .eq('scope', type)
                .limit(1)
                .single()
             orderTypeId = anyType?.id
        }

        if (!orderTypeId) {
            console.error(`Cannot find order type for ${type}`)
            return null
        }

        // 2. Fetch/Define Supplier or Customer
        // For Inbound: Need Supplier. Try finding 'Kho nội bộ' or take first.
        let supplierId = null
        if (type === 'INBOUND') {
             const { data: supp } = await supabase.from('suppliers')
                .select('id')
                .eq('system_code', currentSystem.code)
                .ilike('name', '%Nội bộ%')
                .limit(1)
                .single()
             supplierId = supp?.id
             if (!supplierId) {
                 const { data: firstSupp } = await supabase.from('suppliers').select('id').eq('system_code', currentSystem.code).limit(1).single()
                 supplierId = firstSupp?.id
             }
        }

        // 3. Create Header
        const table = type === 'INBOUND' ? 'inbound_orders' : 'outbound_orders'
        const codePrefix = type === 'INBOUND' ? 'NK-KK-' : 'XK-KK-'
        const code = `${codePrefix}${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`
<<<<<<< HEAD

=======

>>>>>>> origin/main
        const headerData: any = {
            code,
            system_code: currentSystem.code,
            created_by: user.id,
            status: 'COMPLETED', // Auto-complete
            order_type_id: orderTypeId,
            description: `Phiếu ${type === 'INBOUND' ? 'nhập' : 'xuất'} điều chỉnh từ kiểm kê (Ref: ${checkId})`
        }

        if (type === 'INBOUND') headerData.supplier_id = supplierId
        if (type === 'OUTBOUND') headerData.customer_name = 'Điều chỉnh kiểm kê'

        const { data: order, error: orderError } = await (supabase.from(table as any) as any)
            .insert(headerData)
            .select()
            .single()

        if (orderError || !order) {
            console.error(`Error creating ${type} ticket:`, orderError)
            return null
        }

        // 4. Create Items
        const itemsTable = type === 'INBOUND' ? 'inbound_order_items' : 'outbound_order_items'
        const orderItems = items.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            quantity: Math.abs(item.difference), // Always positive for ticket
            unit: item.unit,
            note: item.note
        }))

        await (supabase.from(itemsTable as any) as any).insert(orderItems)

        return order.id
    }

    // Approve Session
    const approveSession = async (checkId: string, method: 'DIRECT_ADJUSTMENT' | 'ACCOUNTING_TICKET') => {
        if (!user) return
        if (!await showConfirm('Xác nhận duyệt phiếu và cân bằng kho?')) return

        setLoading(true)
        try {
            // 1. Get latest items state
            const { data: items, error: itemsError } = await supabase
                .from('inventory_check_items')
                .select('*')
                .eq('check_id', checkId)

            if (itemsError) throw itemsError

            const affectedLotIds = new Set<string>()
            const surplusItems: any[] = []
            const lossItems: any[] = []

            // 2. Iterate and Update Lot Items (Parallel)
            const updatePromises = items.map(async (item) => {
                // Only process items that have been counted (actual_quantity !== null) AND have a difference
                if (item.actual_quantity !== null && item.difference !== 0 && item.lot_item_id) {
                    // Classify for Ticket
                    if (item.difference > 0) surplusItems.push(item)
                    else if (item.difference < 0) lossItems.push(item)

                    // Update Lot Item Quantity (Execution Phase - Always update physical stock)
                    const { error: updateError } = await supabase
                        .from('lot_items')
                        .update({ quantity: item.actual_quantity })
                        .eq('id', item.lot_item_id)

                    if (updateError) {
                        console.error(`Failed to update lot item ${item.lot_item_id}`, updateError)
                    } else if (item.lot_id) {
                        affectedLotIds.add(item.lot_id)
                    }
                }
            })
            await Promise.all(updatePromises)

            // 3. Sync Lots Quantity and Log Activity (Parallel by Lot)
            const syncPromises = Array.from(affectedLotIds).map(async (lotId) => {
                // Recalculate total quantity for the lot
                const { data: lotItemsData } = await supabase
                    .from('lot_items')
                    .select('quantity')
                    .eq('lot_id', lotId)

                if (lotItemsData) {
                    const newTotalQty = lotItemsData.reduce((sum, i) => sum + (i.quantity || 0), 0)

                    // Update Lot
                    await supabase
                        .from('lots')
                        .update({ quantity: newTotalQty })
                        .eq('id', lotId)

                    // Log
                    await logActivity({
                        supabase,
                        tableName: 'lots',
                        recordId: lotId,
                        action: 'UPDATE',
                        newData: { quantity: newTotalQty, note: 'Inventory Audit Adjustment (Approved)' },
                        oldData: { note: 'Previous Quantity Unknown' }
                    })
                }
            })
            await Promise.all(syncPromises)

            // 4. Handle Accounting Tickets if requested
            let inboundId = null
            let outboundId = null

            if (method === 'ACCOUNTING_TICKET') {
                if (surplusItems.length > 0) {
                    inboundId = await createAdjustmentTicket(checkId, surplusItems, 'INBOUND')
                }
                if (lossItems.length > 0) {
                    outboundId = await createAdjustmentTicket(checkId, lossItems, 'OUTBOUND')
                }
            }

            // 5. Mark Approved and Completed
            await supabase
                .from('inventory_checks')
                .update({
                    status: 'COMPLETED',
                    approval_status: 'APPROVED',
                    reviewer_id: user.id,
                    reviewed_at: new Date().toISOString(),
                    completed_at: new Date().toISOString(),
                    adjustment_inbound_order_id: inboundId,
                    adjustment_outbound_order_id: outboundId
                })
                .eq('id', checkId)

            showToast('Đã duyệt và cân bằng kho thành công', 'success')
            router.push('/operations/audit')

        } catch (error: any) {
            console.error('Error approving session:', error)
            showToast('Lỗi duyệt phiếu: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    // Reject Session
    const rejectSession = async (checkId: string, reason: string) => {
        if (!user) return
        if (!await showConfirm('Xác nhận từ chối duyệt phiếu này?')) return

        setLoading(true)
        try {
            await supabase
                .from('inventory_checks')
                .update({
                    status: 'REJECTED',
                    approval_status: 'REJECTED',
                    reviewer_id: user.id,
                    reviewed_at: new Date().toISOString(),
                    rejection_reason: reason
                })
                .eq('id', checkId)

            showToast('Đã từ chối phiếu kiểm kê', 'success')
            router.push('/operations/audit')
        } catch (error: any) {
            console.error('Error rejecting session:', error)
            showToast('Lỗi từ chối phiếu: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    // Delete Session
    const deleteSession = async (checkId: string) => {
        if (!await showConfirm('Bạn có chắc chắn muốn xóa phiếu kiểm kê này? Hành động này không thể hoàn tác.')) return

        setLoading(true)
        try {
            const { error } = await supabase
                .from('inventory_checks')
                .delete()
                .eq('id', checkId)

            if (error) throw error

            showToast('Đã xóa phiếu kiểm kê', 'success')
            setSessions(prev => prev.filter(s => s.id !== checkId))
        } catch (error: any) {
            console.error('Error deleting session:', error)
            showToast('Lỗi xóa phiếu: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }
<<<<<<< HEAD

=======

>>>>>>> origin/main
    // Quick Fill (Set all nulls to system qty)
    const quickFill = async () => {
         const itemsToUpdate = sessionItems.filter(i => i.actual_quantity === null)
         if (itemsToUpdate.length === 0) return

         if (!await showConfirm(`Tự động điền số lượng hệ thống cho ${itemsToUpdate.length} dòng chưa kiểm?`)) return
<<<<<<< HEAD

         setLoading(true)

=======

         setLoading(true)

>>>>>>> origin/main
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
<<<<<<< HEAD
             const promises = chunk.map(item =>
=======
             const promises = chunk.map(item =>
>>>>>>> origin/main
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

<<<<<<< HEAD
    // Live Inventory Check Logic
    const [liveMismatches, setLiveMismatches] = useState<Record<string, number>>({})

    const checkLiveInventory = async () => {
        if (!currentSession || !currentSystem) return

        setLoading(true)
        try {
            // Fetch current accounting inventory
            const dateTo = new Date().toISOString().split('T')[0]
            let apiUrl = `/api/inventory?dateTo=${dateTo}&systemType=${currentSystem.code}`
            if (currentSession.warehouse_name) {
                apiUrl += `&warehouse=${encodeURIComponent(currentSession.warehouse_name)}`
            }

            const res = await fetch(apiUrl)
            const data = await res.json()

            if (!data.ok) throw new Error('Failed to fetch live data')
            const liveItems = data.items || []

            // Build Map for O(1) Lookup: ProductID -> Balance
            // Note: API aggregates by Product+Warehouse+Unit+Status.
            // Audit Items are snapshot rows. We match by ProductID (and Unit ideally).
            const liveMap = new Map<string, number>()
            liveItems.forEach((li: any) => {
                // Key needs to be specific enough.
                // Audit items distinguish by productId.
                // However, Audit items might have duplicate productIds if unit differs?
                // Assuming Audit maps 1-to-1 with the API response lines effectively.
                // Let's match by ProductID for now as primary key.
                liveMap.set(li.productId, li.balance)
            })

            const mismatches: Record<string, number> = {}
            let count = 0

            sessionItems.forEach(item => {
                // Find live balance for this item's product
                const liveQty = liveMap.get(item.product_id)
                // If liveQty exists and differs from stored system_quantity
                // Note: If liveQty is undefined (product gone?), treat as 0?
                // Or maybe the API only returns non-zero.
                // If item.system_quantity is 0 and live is undefined -> match.

                const currentLive = liveQty ?? 0
                if (currentLive !== item.system_quantity) {
                    mismatches[item.id] = currentLive
                    count++
                }
            })

            setLiveMismatches(mismatches)

            if (count > 0) {
                showToast(`Phát hiện ${count} mục thay đổi tồn kho hệ thống`, 'warning')
            } else {
                showToast('Dữ liệu hệ thống đã đồng bộ', 'success')
            }

        } catch (error) {
            console.error('Check live error:', error)
            showToast('Lỗi kiểm tra dữ liệu thực tế', 'error')
        } finally {
            setLoading(false)
        }
    }

    const syncSystemQuantity = async () => {
        if (Object.keys(liveMismatches).length === 0) return
        if (!await showConfirm('Cập nhật số lượng hệ thống mới nhất cho các mục bị lệch?')) return

        setLoading(true)
        try {
            // Update DB
            const updates = Object.entries(liveMismatches).map(([id, newQty]) => {
                // Calculate new difference if actual exists
                const item = sessionItems.find(i => i.id === id)
                const actual = item?.actual_quantity
                const diff = actual !== null && actual !== undefined ? actual - newQty : 0 - newQty

                return supabase.from('inventory_check_items')
                    .update({
                        system_quantity: newQty,
                        difference: diff
                    })
                    .eq('id', id)
            })

            await Promise.all(updates)

            // Update Local State
            const newItems = sessionItems.map(item => {
                if (liveMismatches[item.id] !== undefined) {
                    const newQty = liveMismatches[item.id]
                    const diff = item.actual_quantity !== null ? item.actual_quantity - newQty : 0 - newQty
                    return { ...item, system_quantity: newQty, difference: diff }
                }
                return item
            })
            setSessionItems(newItems)
            setLiveMismatches({})

            showToast('Đã cập nhật số lượng hệ thống', 'success')

        } catch (error) {
            console.error('Sync error:', error)
            showToast('Lỗi cập nhật', 'error')
        } finally {
            setLoading(false)
        }
    }

=======
>>>>>>> origin/main
    return {
        loading,
        sessions,
        currentSession,
        sessionItems,
<<<<<<< HEAD
        liveMismatches,
=======
>>>>>>> origin/main
        fetchSessions,
        createSession,
        fetchSessionDetail,
        updateItem,
        submitForApproval,
        approveSession,
        rejectSession,
        deleteSession,
<<<<<<< HEAD
        quickFill,
        checkLiveInventory,
        syncSystemQuantity
=======
        quickFill
>>>>>>> origin/main
    }
}
