'use client'

import { useState, useCallback, useEffect } from 'react'
import { supabase, TypedDatabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'
import { useRouter } from 'next/navigation'
import { logActivity } from '@/lib/audit'
import { getPhysicalInventorySnapshot } from '@/lib/inventoryService'

export type InventoryCheck = TypedDatabase['public']['Tables']['inventory_checks']['Row'] & {
    user_profiles?: { full_name: string | null }
    adjustment_inbound_order?: { code: string } | null
    adjustment_outbound_order?: { code: string } | null
    scope?: 'ALL' | 'PARTIAL' | null
    participants?: any
    stats?: {
        total: number
        counted: number
        progress: number
        balancing?: {
            total: number
            completed: number
            percent: number
            lotMismatchCount?: number
        }
    }
}

export type InventoryCheckItem = TypedDatabase['public']['Tables']['inventory_check_items']['Row'] & {
    lots?: { code: string; batch_code?: string | null } | null
    products?: { name: string; sku: string; unit: string | null; image_url?: string | null; product_media?: { url: string; type: string }[] } | null
    logs?: TypedDatabase['public']['Tables']['inventory_check_item_logs']['Row'][]
}

export function useAudit() {
    const { currentSystem } = useSystem()
    const { user, profile } = useUser()
    const { showToast, showConfirm } = useToast()
    const router = useRouter()

    const [loading, setLoading] = useState(false)
    const [sessions, setSessions] = useState<InventoryCheck[]>([])
    const [currentSession, setCurrentSession] = useState<InventoryCheck | null>(null)
    const [sessionItems, setSessionItems] = useState<InventoryCheckItem[]>([])

    // Automatically recalculate stats whenever items change to keep UI "live"
    useEffect(() => {
        if (currentSession && sessionItems.length > 0) {
            const total = sessionItems.length
            const counted = sessionItems.filter(i => i.actual_quantity !== null).length
            const progress = total > 0 ? Math.round((counted / total) * 100) : 0

            // Calculate balancing progress if needed
            let balancing = undefined
            if (['WAITING_FOR_APPROVAL', 'COMPLETED'].includes(currentSession.status)) {
                const hasSurplus = sessionItems.some(i => i.actual_quantity !== null && i.difference > 0)
                const hasLoss = sessionItems.some(i => i.actual_quantity !== null && i.difference < 0)
                const hasLotMismatch = sessionItems.some(i => i.actual_quantity !== null && i.actual_quantity !== i.lot_system_quantity)
                const lotMismatchCount = sessionItems.filter(i => i.actual_quantity !== null && i.actual_quantity !== i.lot_system_quantity).length

                const balTotal = (hasSurplus ? 1 : 0) + (hasLoss ? 1 : 0) + (hasLotMismatch ? 1 : 0)
                if (balTotal > 0) {
                    const balCompleted = (currentSession.adjustment_inbound_order_id ? 1 : 0) +
                        (currentSession.adjustment_outbound_order_id ? 1 : 0) +
                        (currentSession.lot_adjusted_at ? 1 : 0)
                    balancing = {
                        total: balTotal,
                        completed: balCompleted,
                        percent: Math.round((balCompleted / balTotal) * 100),
                        lotMismatchCount
                    }
                }
            }

            // Only update if stats actually changed to avoid infinite loop
            if (
                currentSession.stats?.counted !== counted ||
                currentSession.stats?.total !== total ||
                currentSession.stats?.progress !== progress ||
                JSON.stringify(currentSession.stats?.balancing) !== JSON.stringify(balancing)
            ) {
                setCurrentSession(prev => prev ? {
                    ...prev,
                    stats: { total, counted, progress, balancing }
                } : null)
            }
        }
    }, [sessionItems, currentSession?.id, currentSession?.status, currentSession?.adjustment_inbound_order_id, currentSession?.adjustment_outbound_order_id])

    // Subscribe to real-time changes for the current session
    useEffect(() => {
        if (!currentSession?.id) return

        const channel = supabase
            .channel(`audit_session_${currentSession.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'inventory_checks',
                    filter: `id=eq.${currentSession.id}`
                },
                (payload) => {
                    const newData = payload.new as InventoryCheck
                    setCurrentSession(prev => {
                        if (!prev) return null
                        // Keep the stats as they are calculated locally from items
                        return { ...prev, ...newData, stats: prev.stats }
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentSession?.id])

    // Subscribe to real-time changes for the sessions list
    useEffect(() => {
        if (!currentSystem?.code) return

        const channel = supabase
            .channel(`audit_sessions_list_${currentSystem.code}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'inventory_checks',
                    filter: `system_code=eq.${currentSystem.code}`
                },
                (payload) => {
                    const eventType = (payload as any).eventType
                    if (eventType === 'INSERT') {
                        const newSession = payload.new as InventoryCheck
                        setSessions(prev => [newSession, ...prev])
                    } else if (eventType === 'UPDATE') {
                        const updatedSession = payload.new as InventoryCheck
                        setSessions(prev => prev.map(s =>
                            s.id === updatedSession.id
                                ? { ...s, ...updatedSession, stats: s.stats }
                                : s
                        ))
                    } else if (eventType === 'DELETE') {
                        const deletedId = (payload.old as any).id
                        setSessions(prev => prev.filter(s => s.id !== deletedId))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentSystem?.code])

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
        } else if (data) {
            // Fetch stats for these sessions
            const sessionIds = data.map((s: any) => s.id)
            const { data: items } = await supabase
                .from('inventory_check_items')
                .select('check_id, actual_quantity, system_quantity, lot_system_quantity, difference')
                .in('check_id', sessionIds)

            const sessionsWithStats = data.map((s: any) => {
                const sItems = items?.filter(i => i.check_id === s.id) || []
                const total = sItems.length
                const counted = sItems.filter(i => i.actual_quantity !== null).length
                const progress = total > 0 ? Math.round((counted / total) * 100) : 0

                // Calculate balancing progress if applicable
                let balancing = undefined
                if (['WAITING_FOR_APPROVAL', 'COMPLETED'].includes(s.status)) {
                    const hasSurplus = sItems.some(i => i.actual_quantity !== null && i.difference > 0)
                    const hasLoss = sItems.some(i => i.actual_quantity !== null && i.difference < 0)
                    const hasLotMismatch = sItems.some(i => i.actual_quantity !== null && i.actual_quantity !== i.lot_system_quantity)
                    const lotMismatchCount = sItems.filter(i => i.actual_quantity !== null && i.actual_quantity !== i.lot_system_quantity).length

                    const balTotal = (hasSurplus ? 1 : 0) + (hasLoss ? 1 : 0) + (hasLotMismatch ? 1 : 0)
                    if (balTotal > 0) {
                        const balCompleted = (s.adjustment_inbound_order_id ? 1 : 0) +
                            (s.adjustment_outbound_order_id ? 1 : 0) +
                            (s.lot_adjusted_at ? 1 : 0)
                        balancing = {
                            total: balTotal,
                            completed: balCompleted,
                            percent: Math.round((balCompleted / balTotal) * 100),
                            lotMismatchCount
                        }
                    }
                }

                return {
                    ...s,
                    stats: { total, counted, progress, balancing }
                }
            })

            setSessions(sessionsWithStats as any)
        }
        setLoading(false)
    }, [currentSystem, showToast])

    // Create a new session
    const createSession = async (
        warehouseId: string | null,
        warehouseName: string | null,
        note: string,
        scope: 'ALL' | 'PARTIAL' = 'ALL',
        productIds: string[] = [],
        participants: any[] = [],
        productSelections?: { productId: string, units: string[] }[],
        globalUnitSelections?: string[]
    ) => {
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
                    status: 'IN_PROGRESS',
                    scope,
                    participants: participants as any // JSONB
                })
                .select()
                .single()

            if (checkError) throw checkError
            if (!checkData) throw new Error('No data returned from creation')

            const checkId = checkData.id

            // 2. Fetch Base Products (Those that SHOULD be in the check)
            let productsQuery = supabase
                .from('products')
                .select('id, name, sku, unit')
                .eq('system_type', currentSystem.code)

            if (scope === 'PARTIAL' && productIds.length > 0) {
                productsQuery = productsQuery.in('id', productIds)
            }

            const { data: baseProducts, error: prodError } = await productsQuery
            if (prodError) throw prodError
            if (!baseProducts || baseProducts.length === 0) {
                throw new Error('Không tìm thấy sản phẩm nào trong phạm vi đã chọn')
            }

            // 3. Fetch Accounting Inventory (Snapshot from API for balances)
            const dateTo = new Date().toISOString().split('T')[0]
            let apiUrl = `/api/inventory?dateTo=${dateTo}&systemType=${currentSystem.code}`
            if (warehouseName) {
                apiUrl += `&warehouse=${encodeURIComponent(warehouseName)}`
            }

            const accRes = await fetch(apiUrl)
            const accData = await accRes.json()
            const inventorySnapshot = accData.items || []

            // 3b. Fetch Physical Inventory (From Lots)
            let lotTotals = new Map<string, number>()
            try {
                lotTotals = await getPhysicalInventorySnapshot(supabase, currentSystem.code, warehouseName || undefined)
            } catch (err) {
                console.error('Error fetching lot snapshot:', err)
            }

            // 4. Prepare Bulk Insert
            const checkItems: any[] = []
            const processedKeys = new Set<string>() // PID_UNIT

            // Map for quick unit lookup in partial scope
            const allowedUnitsMap = new Map<string, Set<string>>()
            if (scope === 'PARTIAL' && productSelections) {
                productSelections.forEach(ps => {
                    allowedUnitsMap.set(ps.productId, new Set(ps.units))
                })
            }

            // 4a. Add rows for everything in the inventory snapshot
            inventorySnapshot.forEach((inv: any) => {
                const key = `${inv.productId}_${inv.unit || 'Cái'}`
                const physicalQty = lotTotals.get(key) || 0

                let shouldAdd = true

                // Primary Filter: Global Unit Selection
                if (globalUnitSelections && globalUnitSelections.length > 0) {
                    shouldAdd = globalUnitSelections.includes(inv.unit || 'Cái')
                }

                // Secondary Filter: Scope specific
                if (shouldAdd && scope === 'PARTIAL') {
                    const allowedUnits = allowedUnitsMap.get(inv.productId)
                    shouldAdd = !!(allowedUnits && allowedUnits.has(inv.unit || 'Cái'))
                }

                if (shouldAdd) {
                    checkItems.push({
                        check_id: checkId,
                        lot_id: null,
                        lot_item_id: null,
                        product_id: inv.productId,
                        product_sku: inv.productCode,
                        product_name: inv.productName,
                        system_quantity: inv.balance,
                        lot_system_quantity: physicalQty,
                        actual_quantity: null,
                        difference: 0 - inv.balance,
                        unit: inv.unit || 'Cái',
                        note: ''
                    })
                    processedKeys.add(key)
                }
            })

            // 4b. Add fallback rows for products in scope that weren't in the snapshot (or specifically selected zero units)
            if (scope === 'PARTIAL' && productSelections) {
                // For partial scope, we iterate through the selections to ensure all chosen units exist
                productSelections.forEach((ps: { productId: string, units: string[] }) => {
                    const p = baseProducts.find(bp => bp.id === ps.productId)
                    if (!p) return

                    ps.units.forEach((unit: string) => {
                        // Check global filter first
                        if (globalUnitSelections && globalUnitSelections.length > 0) {
                            if (!globalUnitSelections.includes(unit)) return
                        }

                        const key = `${ps.productId}_${unit}`
                        const physicalQty = lotTotals.get(key) || 0

                        if (!processedKeys.has(key)) {
                            checkItems.push({
                                check_id: checkId,
                                lot_id: null,
                                lot_item_id: null,
                                product_id: ps.productId,
                                product_sku: p.sku,
                                product_name: p.name,
                                system_quantity: 0,
                                lot_system_quantity: physicalQty,
                                actual_quantity: null,
                                difference: 0,
                                unit: unit,
                                note: ''
                            })
                            processedKeys.add(key)
                        }
                    })
                })
            } else {
                // For 'ALL' scope, we just add products that weren't in the snapshot at all (using default unit)
                baseProducts.forEach((p: any) => {
                    const defaultUnit = p.unit || 'Cái'
                    const key = `${p.id}_${defaultUnit}`

                    // Check global filter
                    if (globalUnitSelections && globalUnitSelections.length > 0) {
                        if (!globalUnitSelections.includes(defaultUnit)) return
                    }

                    // We only add if NO unit for this product was processed? 
                    // Actually, if it's 'ALL', we want to make sure the product exists at least once.
                    // If no unit for this product was found in the snapshot, add the default unit as 0.
                    const hasAnyUnit = Array.from(processedKeys).some(k => k.startsWith(p.id + '_'))

                    if (!hasAnyUnit) {
                        const physicalQty = lotTotals.get(key) || 0

                        checkItems.push({
                            check_id: checkId,
                            lot_id: null,
                            lot_item_id: null,
                            product_id: p.id,
                            product_sku: p.sku,
                            product_name: p.name,
                            system_quantity: 0,
                            lot_system_quantity: physicalQty,
                            actual_quantity: null,
                            difference: 0,
                            unit: defaultUnit,
                            note: ''
                        })
                        processedKeys.add(key)
                    }
                })
            }

            // Bulk insert in chunks of 100
            const chunkSize = 100
            for (let i = 0; i < checkItems.length; i += chunkSize) {
                const chunk = checkItems.slice(i, i + chunkSize)
                const { error: insertError } = await supabase
                    .from('inventory_check_items')
                    .insert(chunk)

                if (insertError) throw insertError
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
            .select(`
                *,
                user_profiles:created_by(full_name),
                adjustment_inbound_order:inbound_orders!adjustment_inbound_order_id(code),
                adjustment_outbound_order:outbound_orders!adjustment_outbound_order_id(code)
            `)
            .eq('id', id)
            .single()

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
                products (name, sku, unit, image_url, product_media (url, type)),
                logs:inventory_check_item_logs(*)
            `)
            .eq('check_id', id)
            .order('created_at')

        if (itemsError) {
            console.error('Error fetching items:', itemsError)
            showToast('Lỗi tải danh sách sản phẩm', 'error')
            setLoading(false)
            return
        }

        // Calculate stats for current session
        const total = rawItems.length
        const counted = rawItems.filter(i => i.actual_quantity !== null).length
        const progress = total > 0 ? Math.round((counted / total) * 100) : 0

        // Calculate balancing progress if applicable
        let balancing = undefined
        if (['WAITING_FOR_APPROVAL', 'COMPLETED'].includes((check as any).status)) {
            const hasSurplus = rawItems.some(i => i.actual_quantity !== null && i.difference > 0)
            const hasLoss = rawItems.some(i => i.actual_quantity !== null && i.difference < 0)
            const hasLotMismatch = rawItems.some(i => i.actual_quantity !== null && i.actual_quantity !== i.lot_system_quantity)
            const lotMismatchCount = rawItems.filter(i => i.actual_quantity !== null && i.actual_quantity !== i.lot_system_quantity).length

            const balTotal = (hasSurplus ? 1 : 0) + (hasLoss ? 1 : 0) + (hasLotMismatch ? 1 : 0)
            if (balTotal > 0) {
                const balCompleted = ((check as any).adjustment_inbound_order_id ? 1 : 0) +
                    ((check as any).adjustment_outbound_order_id ? 1 : 0) +
                    ((check as any).lot_adjusted_at ? 1 : 0)
                balancing = {
                    total: balTotal,
                    completed: balCompleted,
                    percent: Math.round((balCompleted / balTotal) * 100),
                    lotMismatchCount
                }
            }
        }

        setCurrentSession({
            ...check,
            stats: { total, counted, progress, balancing }
        } as any)
        setSessionItems(rawItems as any)

        if (rawItems) {
            // Manual Join for Lots (Due to loose coupling/missing FKs)
            const items = rawItems as any[]
            const lotIds = Array.from(new Set(items.map(i => i.lot_id).filter(Boolean)))

            let lotsMap: Record<string, any> = {}
            if (lotIds.length > 0) {
                const { data: lotsData } = await supabase
                    .from('lots')
                    .select('id, code, batch_code')
                    .in('id', lotIds)

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

    // Add Feedback (Discussion & Snapshot)
    const addFeedback = async (itemId: string, content: string, isReviewer: boolean = false) => {
        if (!content.trim() || !profile) return

        const oldItems = [...sessionItems]
        const targetIndex = sessionItems.findIndex(i => i.id === itemId)
        if (targetIndex === -1) return

        const item = sessionItems[targetIndex]

        // Find all sibling units for this product in the same check
        const siblingItems = sessionItems.filter(i =>
            i.check_id === item.check_id &&
            i.product_id === item.product_id &&
            i.lot_id === item.lot_id
        )

        // Create snapshot for ALL units
        const snapshotData = siblingItems.map(si => ({
            id: si.id,
            unit: si.unit,
            actual_quantity: si.actual_quantity,
            system_quantity: si.system_quantity,
            difference: si.difference
        }))

        // Optimistic update for UI
        const newLog = {
            id: 'temp-' + Date.now(),
            item_id: itemId,
            user_id: user?.id || null,
            user_name: profile.full_name,
            content: content,
            actual_quantity: item.actual_quantity,
            system_quantity: item.system_quantity,
            unit: item.unit,
            snapshot_data: snapshotData,
            is_reviewer: isReviewer,
            created_at: new Date().toISOString(),
            company_id: profile.company_id
        }

        const newItem = {
            ...item,
            [isReviewer ? 'reviewer_note' : 'note']: content,
            logs: [...(item.logs || []), newLog]
        }

        const newItems = [...sessionItems]
        newItems[targetIndex] = newItem as any
        setSessionItems(newItems)

        try {
            // 1. Update the main item note for quick view
            const { error: itemError } = await supabase
                .from('inventory_check_items')
                .update({ [isReviewer ? 'reviewer_note' : 'note']: content })
                .eq('id', itemId)

            if (itemError) throw itemError

            // 2. Add to logs for history & snapshot
            const { error: logError } = await supabase
                .from('inventory_check_item_logs')
                .insert({
                    item_id: itemId,
                    user_id: user?.id,
                    user_name: profile.full_name,
                    content: content,
                    actual_quantity: item.actual_quantity,
                    system_quantity: item.system_quantity,
                    unit: item.unit,
                    snapshot_data: snapshotData,
                    is_reviewer: isReviewer,
                    company_id: profile.company_id
                })

            if (logError) throw logError

        } catch (error) {
            console.error('Error adding feedback:', error)
            showToast('Lỗi gửi phản hồi', 'error')
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

    const linkAdjustmentTicket = async (checkId: string, orderId: string, orderType: 'INBOUND' | 'OUTBOUND') => {
        const field = orderType === 'INBOUND' ? 'adjustment_inbound_order_id' : 'adjustment_outbound_order_id'
        const { error } = await supabase
            .from('inventory_checks')
            .update({ [field]: orderId })
            .eq('id', checkId)

        if (error) {
            console.error(`Error linking ${orderType} ticket:`, error)
            showToast(`Lỗi liên kết phiếu ${orderType === 'INBOUND' ? 'nhập' : 'xuất'}`, 'error')
            return false
        }

        // Refresh detail to show the code
        await fetchSessionDetail(checkId)
        return true
    }

    // Approve Session
    const approveSession = async (checkId: string) => {
        if (!user) return
        if (!await showConfirm('Xác nhận duyệt phiếu và cân bằng kho?')) return

        setLoading(true)
        try {
            const { data, error } = await (supabase.rpc as any)('approve_inventory_check', {
                p_check_id: checkId,
                p_reviewer_id: user.id
            })

            if (error) throw error

            const result = data as any
            if (!result.success) {
                throw new Error(result.message)
            }

            // Log activity for the check itself (optional, the individual logs are harder via RPC without complex logic)
            await logActivity({
                supabase,
                tableName: 'inventory_checks',
                recordId: checkId,
                action: 'UPDATE',
                newData: { status: 'COMPLETED', approval_status: 'APPROVED' },
                oldData: { status: 'WAITING_FOR_APPROVAL' }
            })

            showToast(result.message || 'Đã duyệt và cân bằng kho thành công', 'success')
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

        try {
            // Bulk update using upsert or multiple update calls in chunks
            // Supabase doesn't support a true bulk UPDATE with different values easily in a single call 
            // without a specific RPC, but we can use upsert with id
            const updates = itemsToUpdate.map(item => ({
                id: item.id,
                check_id: item.check_id,
                product_id: item.product_id,
                actual_quantity: item.system_quantity,
                difference: 0
            }))

            const chunkSize = 100
            for (let i = 0; i < updates.length; i += chunkSize) {
                const chunk = updates.slice(i, i + chunkSize)
                const { error } = await supabase
                    .from('inventory_check_items')
                    .upsert(chunk, { onConflict: 'id' })

                if (error) throw error
            }

            showToast('Đã điền tự động', 'success')
        } catch (error: any) {
            console.error('Error in quickFill:', error)
            showToast('Lỗi điền tự động: ' + error.message, 'error')
            // Optionally revert sessionItems here, but since it's a large update, 
            // fetching the latest might be better
        } finally {
            setLoading(false)
        }
    }

    const confirmLotAdjustment = async (checkId: string) => {
        if (!user) return

        setLoading(true)
        try {
            const now = new Date().toISOString()
            const { error } = await supabase
                .from('inventory_checks')
                .update({
                    lot_adjusted_at: now,
                    lot_adjusted_by: user.id
                })
                .eq('id', checkId)

            if (error) throw error

            if (currentSession?.id === checkId) {
                setCurrentSession(prev => prev ? {
                    ...prev,
                    lot_adjusted_at: now,
                    lot_adjusted_by: user.id
                } : null)
            }

            showToast('Đã xác nhận rà soát LOT', 'success')
            logActivity({
                supabase,
                tableName: 'inventory_checks',
                recordId: checkId,
                action: 'UPDATE',
                userId: user.id,
                newData: { lot_adjusted_at: now, lot_adjusted_by: user.id }
            })
        } catch (error: any) {
            console.error('Error confirming LOT adjustment:', error)
            showToast('Lỗi xác nhận: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
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
        addFeedback,
        submitForApproval,
        approveSession,
        rejectSession,
        deleteSession,
        quickFill,
        linkAdjustmentTicket,
        confirmLotAdjustment
    }
}
