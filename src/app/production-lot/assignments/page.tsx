'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { 
    CheckCircle2, MapPin, Hash, Calendar, Loader2, 
    Link as LinkIcon, AlertCircle, Trash2, Check, X, XCircle,
    ArrowRight, Package, Search, Filter, RefreshCcw,
    AlertTriangle, Edit2, Save, ChevronDown, Clock, History, Info, Plus, Download
} from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { format, subDays, isWithinInterval, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { exportAssignmentHistoryToExcel } from '@/lib/assignmentExcelExport'
import { extractWeightFromName } from '@/lib/unitConversion'

type PendingAssignment = {
    id: string
    position_id: string
    lot_stt: number
    production_date: string
    system_code: string
    created_at: string
    status: string
    position?: {
        code: string
        id: string
    }
    lot?: {
        id: string
        code: string
        product_names: string[]
        product_skus: string[]
        total_quantity: number
        total_weight_kg: number
        quantity_display: string
        production_code: string | null
        production_lot_code: string | null
        production_order_code: string | null
    }
    assignment_type?: 'new' | 'move'
    old_position_code?: string
}

type Lot = Database['public']['Tables']['lots']['Row'] & {
    product_names?: string[]
    positions?: { code: string }[]
}

export default function AssignmentApprovalPage() {
    const { currentSystem } = useSystem()
    const { profile } = useUser()
    const { showToast, showConfirm } = useToast()

    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
    
    const [pendingList, setPendingList] = useState<PendingAssignment[]>([])
    const [approvedList, setApprovedList] = useState<PendingAssignment[]>([])
    const [rejectedList, setRejectedList] = useState<PendingAssignment[]>([])
    const [lotsInDay, setLotsInDay] = useState<Lot[]>([])
    const [lotSearchTerm, setLotSearchTerm] = useState('')
    const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(true)
    
    // History state
    const [showHistory, setShowHistory] = useState(false)
    const [historyDateFrom, setHistoryDateFrom] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    const [historyDateTo, setHistoryDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
    const [historyList, setHistoryList] = useState<PendingAssignment[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'approved' | 'rejected'>('all')
    const [historySearchTerm, setHistorySearchTerm] = useState('')
    const [historyProdOrderSearch, setHistoryProdOrderSearch] = useState('')
    const [historyProdLotSearch, setHistoryProdLotSearch] = useState('')
    
    // Global positions for manual join
    const [allPositions, setAllPositions] = useState<any[]>([])
    
    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValues, setEditValues] = useState<{ lot_stt: string, position_id: string, position_code: string }>({ lot_stt: '', position_id: '', position_code: '' })
    const [manualEdits, setManualEdits] = useState<Record<string, { lot_stt: number, position_code: string }>>({})

    const filteredHistory = useMemo(() => {
        return historyList.filter(h => {
            const matchesGeneral = !historySearchTerm || 
                h.position?.code?.toLowerCase().includes(historySearchTerm.toLowerCase()) || 
                h.lot_stt.toString().includes(historySearchTerm) ||
                h.lot?.code?.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
                h.lot?.product_names?.some(p => p.toLowerCase().includes(historySearchTerm.toLowerCase()));
            
            const matchesProdOrder = !historyProdOrderSearch || 
                h.lot?.production_order_code?.toLowerCase().includes(historyProdOrderSearch.toLowerCase());
                
            const matchesProdLot = !historyProdLotSearch || 
                h.lot?.production_lot_code?.toLowerCase().includes(historyProdLotSearch.toLowerCase());

            return matchesGeneral && matchesProdOrder && matchesProdLot;
        });
    }, [historyList, historySearchTerm, historyProdOrderSearch, historyProdLotSearch]);

    useEffect(() => {
        if (currentSystem?.code) {
            fetchData()
        }
    }, [currentSystem, dateFrom, dateTo])

    async function fetchData() {
        if (!currentSystem?.code) {
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            // 1. Fetch Assignments
            const { data: pData, error: pErr } = await (supabase.from('pending_assignments') as any)
                .select('*')
                .eq('system_code', currentSystem.code)
                .gte('production_date', dateFrom)
                .lte('production_date', dateTo)
                .order('created_at', { ascending: false })

            if (pErr) throw pErr
            const assignments = pData || []

            // 2. Fetch required positions for these assignments
            const posIds = Array.from(new Set(assignments.map((a: any) => a.position_id).filter(Boolean)))
            let posMap: Record<string, string> = {}
            if (posIds.length > 0) {
                const { data: historyPosData } = await (supabase.from('positions') as any)
                    .select('id, code')
                    .in('id', posIds)
                if (historyPosData) {
                    historyPosData.forEach((p: any) => {
                        posMap[p.id] = p.code
                    })
                }
            }

            // 3. Keep allPositions updated for dropdowns and edits
            const { data: allPosData } = await (supabase.from('positions') as any)
                .select('id, code, lot_id')
                .eq('system_type', currentSystem.code)
            const safePosData = allPosData || []
            setAllPositions(safePosData)

            // 4. Manual Join Assignments with prioritized posMap
            const enrichedAssignments = assignments.map((ass: any) => ({
                ...ass,
                position: {
                    id: ass.position_id,
                    code: posMap[ass.position_id] || safePosData.find((p: any) => p.id === ass.position_id)?.code || '---'
                }
            }))

            setPendingList(enrichedAssignments.filter((a: any) => a.status === 'pending'))
            setApprovedList(enrichedAssignments.filter((a: any) => a.status.startsWith('approved')))
            setRejectedList(enrichedAssignments.filter((a: any) => a.status === 'rejected'))

            // 5. Fetch LOTs for matching list
            const { data: lData, error: lErr } = await supabase
                .from('lots')
                .select(`
                    *,
                    lot_items(products(name))
                `)
                .eq('system_code', currentSystem.code)
                .gte('inbound_date', dateFrom)
                .lte('inbound_date', dateTo + 'T23:59:59')
                .neq('status', 'hidden')
                .neq('status', 'exported')
                .order('daily_seq', { ascending: true })

            if (lErr) throw lErr

            const fetchedLots = lData || []
            const lotIds = fetchedLots.map((l: any) => l.id)
            
            // Explicitly fetch the positions for THESE lots to bypass the 1000 row limit on allPosData
            let assignedPosData: any[] = []
            if (lotIds.length > 0) {
                const { data } = await supabase.from('positions').select('id, code, lot_id').in('lot_id', lotIds)
                assignedPosData = data || []
            }

            const formattedLots: Lot[] = fetchedLots.map((l: any) => ({
                ...l,
                product_names: l.lot_items?.map((li: any) => li.products?.name).filter(Boolean) || [],
                positions: assignedPosData.filter((p: any) => p.lot_id === l.id)
            }))

            setLotsInDay(formattedLots)
        } catch (e: any) {
            console.error('Fetch error:', e)
            showToast('Lỗi tải dữ liệu: ' + (e.message || 'Không xác định'), 'error')
        } finally {
            setLoading(false)
        }
    }

    async function fetchHistory() {
        if (!currentSystem?.code) return
        setHistoryLoading(true)
        try {
            let query = (supabase.from('pending_assignments') as any)
                .select('*')
                .eq('system_code', currentSystem.code)
                .neq('status', 'pending')
                .gte('production_date', historyDateFrom)
                .lte('production_date', historyDateTo)
                .order('created_at', { ascending: false })
            
            if (historyStatusFilter !== 'all') query = query.eq('status', historyStatusFilter)

            const { data, error } = await query
            if (error) throw error
            const assignments = data || []

            // Extract all unique position IDs from history
            const posIds = Array.from(new Set(assignments.map((a: any) => a.position_id).filter(Boolean)))
            
            let posMap: Record<string, string> = {}
            if (posIds.length > 0) {
                const { data: posData } = await (supabase.from('positions') as any)
                    .select('id, code')
                    .in('id', posIds)
                
                if (posData) {
                    posData.forEach((p: any) => {
                        posMap[p.id] = p.code
                    })
                }
            }

            // 4. Fetch LOTs for these dates to match product info
            const { data: lotsData } = await supabase
                .from('lots')
                .select(`
                    id, code, daily_seq, inbound_date,
                    production_code,
                    production_lot_id,
                    production_lots:production_lot_id(lot_code),
                    productions:production_id(code),
                    lot_items(quantity, unit, products(name, sku, weight_kg))
                `)
                .eq('system_code', currentSystem.code)
                .in('daily_seq', Array.from(new Set(assignments.map((a: any) => a.lot_stt))))
            
            const processedLots = (lotsData || []).map((l: any) => {
                const totalQty = l.lot_items?.reduce((sum: number, li: any) => sum + (li.quantity || 0), 0) || 0
                const unit = l.lot_items?.[0]?.unit || ''
                
                // Calculate Weight in KG
                const totalWeightKg = l.lot_items?.reduce((sum: number, li: any) => {
                    const weightFactor = extractWeightFromName(li.unit) || li.products?.weight_kg || 0
                    return sum + ((li.quantity || 0) * weightFactor)
                }, 0) || 0

                return {
                    ...l,
                    product_names: l.lot_items?.map((li: any) => li.products?.name).filter(Boolean) || [],
                    product_skus: l.lot_items?.map((li: any) => li.products?.sku).filter(Boolean) || [],
                    total_quantity: totalQty,
                    total_weight_kg: totalWeightKg,
                    unit: unit,
                    quantity_display: `${totalQty} ${unit}`.trim() || '---',
                    production_order_code: (l as any).productions?.code || null,
                    production_lot_code: (l as any).production_lots?.lot_code || l.production_code || null
                }
            })

            const lotsMap: Record<string, any[]> = {}
            processedLots.forEach((l: any) => {
                const date = l.inbound_date?.split('T')[0]
                if (date) {
                    const key = `${date}_${l.daily_seq}`
                    if (!lotsMap[key]) lotsMap[key] = []
                    lotsMap[key].push(l)
                }
            })

            const enriched = assignments.map((h: any) => {
                const date = h.production_date
                const key = `${date}_${h.lot_stt}`
                let matchedLots = lotsMap[key] || []
                
                // Smart Fallback: If exact date match fails, look for the same STT on any date (prioritize closest date)
                if (matchedLots.length === 0 && processedLots.length > 0) {
                    matchedLots = processedLots
                        .filter(l => l.daily_seq === h.lot_stt)
                        .sort((a, b) => {
                            const distA = Math.abs(new Date(a.inbound_date).getTime() - new Date(h.production_date).getTime());
                            const distB = Math.abs(new Date(b.inbound_date).getTime() - new Date(h.production_date).getTime());
                            return distA - distB;
                        });
                }

                const lot = matchedLots.length > 0 ? matchedLots[0] : null

                // Decode status info: "approved:move:OLD_POS" or "approved:new"
                let assignment_type: 'new' | 'move' | undefined = undefined
                let old_position_code: string | undefined = undefined
                
                if (h.status.startsWith('approved:move:')) {
                    assignment_type = 'move'
                    old_position_code = h.status.replace('approved:move:', '')
                } else if (h.status === 'approved:new' || h.status === 'approved') {
                    assignment_type = 'new'
                }

                return {
                    ...h,
                    position: { 
                        id: h.position_id, 
                        code: posMap[h.position_id] || 'N/A' 
                    },
                    lot: lot ? {
                        id: lot.id,
                        code: lot.code,
                        product_names: lot.product_names,
                        product_skus: lot.product_skus,
                        total_quantity: lot.total_quantity,
                        total_weight_kg: lot.total_weight_kg,
                        quantity_display: lot.quantity_display,
                        production_code: lot.production_code,
                        production_lot_code: lot.production_lot_code,
                        production_order_code: lot.production_order_code
                    } : null,
                    assignment_type,
                    old_position_code
                }
            })
            setHistoryList(enriched)
        } catch (e: any) {
            showToast('Lỗi tải lịch sử: ' + e.message, 'error')
        } finally {
            setHistoryLoading(false)
        }
    }

    const startEdit = (ass: PendingAssignment) => {
        setEditingId(ass.id)
        setEditValues({
            lot_stt: ass.lot_stt.toString(),
            position_id: ass.position_id,
            position_code: (ass.position as any)?.code || ''
        })
    }

    const handleSaveEdit = (ass: PendingAssignment) => {
        const newStt = parseInt(editValues.lot_stt)
        const newCode = editValues.position_code.trim()
        if (isNaN(newStt) || !newCode) {
            showToast('Vui lòng nhập đầy đủ STT và Mã vị trí', 'error')
            return
        }
        setManualEdits(prev => ({ ...prev, [ass.id]: { lot_stt: newStt, position_code: newCode } }))
        setEditingId(null)
        showToast(`Đã ghi nhận thay đổi. Nhấn Duyệt để hoàn tất.`, 'success')
    }

    const handleApprove = async (ass: PendingAssignment, lotId: string) => {
        setActionLoading(ass.id)
        try {
            const manual = manualEdits[ass.id]
            let targetPosId = ass.position_id
            let targetStt = ass.lot_stt

            // 1. Handle manual edit resolution
            if (manual) {
                targetStt = manual.lot_stt
                const { data: matchedPos, error: posFindErr } = await (supabase.from('positions') as any)
                    .select('id')
                    .eq('system_type', currentSystem?.code)
                    .ilike('code', manual.position_code.trim())
                    .limit(1)
                    .single()
                
                if (posFindErr || !matchedPos) throw new Error(`Không thấy mã vị trí "${manual.position_code}"`);
                targetPosId = matchedPos.id

                const { error: assUpdErr } = await (supabase.from('pending_assignments') as any)
                    .update({ position_id: targetPosId, lot_stt: targetStt })
                    .eq('id', ass.id)
                if (assUpdErr) throw new Error("Lỗi cập nhật yêu cầu: " + assUpdErr.message);
            }

            // 2. Resolve Target Position Info for validation and messaging
            const { data: targetPosInfo, error: checkErr } = await (supabase.from('positions') as any)
                .select('code, lot_id')
                .eq('id', targetPosId)
                .single()
            if (checkErr) throw new Error("Lỗi kiểm tra vị trí: " + checkErr.message);

            // 3. Validate and handle existing placement
            // Check if this LOT is already assigned to ANY position
            const { data: currentPlacements, error: placementErr } = await (supabase.from('positions') as any)
                .select('id, code')
                .eq('lot_id', lotId)
            
            if (placementErr) throw new Error("Lỗi kiểm tra vị trí LOT: " + placementErr.message);
            
            // If it's already somewhere else, we must unbind it first
            const otherPlacements = (currentPlacements || []).filter((p: any) => p.id !== targetPosId)
            if (otherPlacements.length > 0) {
                const confirmed = await showConfirm(`Lô hàng này đang được ghi nhận ở vị trí: ${otherPlacements.map((p: any) => p.code).join(', ')}. Bạn có muốn chuyển nó sang vị trí mới (${targetPosInfo?.code || '---'}) không?`)
                if (!confirmed) {
                    setActionLoading(null) // Reset loading state
                    return // EXIT GRACEFULLY
                }
                
                // Unbind from all old positions
                for (const oldPos of otherPlacements) {
                    const { error: unbindErr } = await (supabase.from('positions') as any)
                        .update({ lot_id: null })
                        .eq('id', oldPos.id)
                    if (unbindErr) throw new Error(`Lỗi khi gỡ khỏi vị trí ${oldPos.code}: ` + unbindErr.message);
                }
            }

            // 4. Check target position availability
            if (targetPosInfo?.lot_id && targetPosInfo.lot_id !== lotId) {
                throw new Error(`Vị trí ${targetPosInfo.code} đã có Lô hàng khác đang ở đó! Hãy gỡ ra trước.`);
            }

            // 5. EXECUTE UPDATES
            const { error: posUpdateErr } = await (supabase.from('positions') as any)
                .update({ lot_id: lotId })
                .eq('id', targetPosId)
            
            if (posUpdateErr) {
                throw new Error("KHÔNG THỂ GHI NHẬN VỊ TRÍ: " + posUpdateErr.message);
            }

            // Then, mark assignment as approved with metadata in status
            const isMove = otherPlacements.length > 0
            const oldPosCodes = otherPlacements.map((p: any) => p.code).join(', ')
            const finalStatus = isMove ? `approved:move:${oldPosCodes}` : `approved:new`

            const { error: statusUpdateErr } = await (supabase.from('pending_assignments') as any)
                .update({ status: finalStatus })
                .eq('id', ass.id)
            
            if (statusUpdateErr) {
                // Warning: position linked but assignment status failed to update
                showToast("Vị trí đã lưu nhưng lỗi cập nhật trạng thái: " + statusUpdateErr.message, "error");
                throw new Error("Lỗi cập nhật trạng thái duyệt.");
            }

            showToast('Đã duyệt và ghi nhận vị trí thành công!', 'success')
            fetchData() 
        } catch (e: any) {
            showToast(e.message || 'Có lỗi xảy ra', 'error')
            console.error('Approval Process Error:', e)
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (ass: PendingAssignment) => {
        const confirmed = await showConfirm(`Bạn có chắc chắn muốn hủy yêu cầu này?`)
        if (!confirmed) return
        setActionLoading(ass.id)
        try {
            const { error } = await (supabase.from('pending_assignments') as any).update({ status: 'rejected' }).eq('id', ass.id)
            if (error) throw error
            showToast('Đã hủy yêu cầu', 'success')
            fetchData() 
        } catch (e: any) {
            showToast('Lỗi khi hủy: ' + e.message, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const validBulkCount = useMemo(() => {
        let count = 0;
        const seenLots = new Set()
        pendingList.forEach(ass => {
            const targetStt = manualEdits[ass.id]?.lot_stt || ass.lot_stt
            const allMatchedLotsRaw = lotsInDay.filter(l => l.daily_seq === targetStt)
            const allMatchedLots = showOnlyUnassigned ? allMatchedLotsRaw.filter(l => !l.positions?.[0]) : allMatchedLotsRaw
            const dateMatchedLots = allMatchedLots.filter(l => l.inbound_date?.split('T')[0] === ass.production_date)
            const perfectMatch = dateMatchedLots.length === 1 ? dateMatchedLots[0] : null
            
            if (perfectMatch && !perfectMatch.positions?.[0]) {
                if (!seenLots.has(perfectMatch.id)) {
                    seenLots.add(perfectMatch.id)
                    count++;
                }
            }
        })
        return count;
    }, [pendingList, lotsInDay, manualEdits, showOnlyUnassigned])

    const handleApproveAll = async () => {
        const validPairs: {ass: PendingAssignment, lot: Lot}[] = []
        const seenLots = new Set()
        
        pendingList.forEach(ass => {
            const targetStt = manualEdits[ass.id]?.lot_stt || ass.lot_stt
            const allMatchedLotsRaw = lotsInDay.filter(l => l.daily_seq === targetStt)
            const allMatchedLots = showOnlyUnassigned ? allMatchedLotsRaw.filter(l => !l.positions?.[0]) : allMatchedLotsRaw
            const dateMatchedLots = allMatchedLots.filter(l => l.inbound_date?.split('T')[0] === ass.production_date)
            const perfectMatch = dateMatchedLots.length === 1 ? dateMatchedLots[0] : null
            
            if (perfectMatch && !perfectMatch.positions?.[0]) {
                if (!seenLots.has(perfectMatch.id)) {
                    seenLots.add(perfectMatch.id)
                    validPairs.push({ ass, lot: perfectMatch })
                }
            }
        })
        
        if (validPairs.length === 0) return;
        
        const confirmed = await showConfirm(`Duyệt tự động ${validPairs.length} yêu cầu hợp lệ này?`)
        if (!confirmed) return;
        
        setActionLoading('bulk');
        try {
            let successCount = 0;
            for (const {ass, lot} of validPairs) {
                let targetPosId = ass.position_id;
                const manual = manualEdits[ass.id];
                if (manual) {
                    const { data: matchedPos } = await (supabase.from('positions') as any)
                        .select('id').eq('system_type', currentSystem?.code).ilike('code', manual.position_code.trim()).limit(1).single()
                    if (matchedPos) targetPosId = matchedPos.id
                }
                
                const { data: targetPosInfo } = await (supabase.from('positions') as any).select('lot_id').eq('id', targetPosId).single()
                if (targetPosInfo?.lot_id && targetPosInfo.lot_id !== lot.id) continue;
                
                await (supabase.from('positions') as any).update({ lot_id: lot.id }).eq('id', targetPosId)
                await (supabase.from('pending_assignments') as any).update({ 
                    status: 'approved:new', 
                    position_id: targetPosId, 
                    lot_stt: manual?.lot_stt || ass.lot_stt 
                }).eq('id', ass.id)
                successCount++;
            }
            showToast(`Đã duyệt thành công ${successCount}/${validPairs.length} yêu cầu.`, successCount > 0 ? 'success' : 'error')
            fetchData();
        } catch (e: any) {
            showToast('Có lỗi: ' + e.message, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    return (

        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-zinc-950 p-6 h-full transition-colors select-text">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
                        <LinkIcon className="text-blue-600" size={32} />
                        Duyệt Gán Vị Trí
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Kết nối dữ liệu thực tế với báo cáo từ Mobile.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowOnlyUnassigned(!showOnlyUnassigned)}
                        className={`px-4 py-2.5 rounded-[12px] text-xs font-black uppercase flex items-center gap-2 border transition-all ${showOnlyUnassigned ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                    >
                        {showOnlyUnassigned ? <CheckCircle2 size={16} /> : <Filter size={16} />}
                        Lô Chưa Gán
                    </button>
                    {validBulkCount > 0 && (
                        <button onClick={handleApproveAll} disabled={!!actionLoading} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
                            {actionLoading === 'bulk' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16}/>}
                            Duyệt Nhanh ({validBulkCount})
                        </button>
                    )}
                    <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center">
                        <Calendar size={16} className="text-zinc-400 mx-2" />
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent border-none outline-none font-bold text-xs text-zinc-900 dark:text-white" />
                        <span className="text-zinc-300 mx-1">→</span>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent border-none outline-none font-bold text-xs text-zinc-900 dark:text-white" />
                    </div>
                    <button onClick={fetchData} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                        <RefreshCcw size={18} className={`${loading ? 'animate-spin' : ''} text-zinc-600 dark:text-zinc-400`} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-2 px-2">Yêu cầu từ Mobile ({pendingList.length})</h2>
                    
                    {loading ? (
                        <div className="py-24 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                            <Loader2 className="animate-spin text-blue-600 mb-4" size={32} />
                            <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest">Đang tải dữ liệu...</p>
                        </div>
                    ) : pendingList.length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-[32px] border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-300">
                            <CheckCircle2 size={40} className="mb-4 opacity-20" />
                            <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest">Không có yêu cầu chờ duyệt</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingList.map((ass) => {
                                const targetStt = manualEdits[ass.id]?.lot_stt || ass.lot_stt
                                const allMatchedLotsRaw = lotsInDay.filter(l => l.daily_seq === targetStt)
                                const allMatchedLots = showOnlyUnassigned ? allMatchedLotsRaw.filter(l => !l.positions?.[0]) : allMatchedLotsRaw
                                const dateMatchedLots = allMatchedLots.filter(l => l.inbound_date?.split('T')[0] === ass.production_date)
                                const perfectMatch = dateMatchedLots.length === 1 ? dateMatchedLots[0] : null
                                const hasOtherMatches = allMatchedLots.length > 0

                                return (
                                    <div key={ass.id} className="bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-[28px] p-6 shadow-sm hover:shadow-md transition-all group">
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                            <div className="flex items-center gap-5">
                                                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/10 text-blue-600 border border-blue-100 dark:border-blue-900/20 flex flex-col items-center justify-center font-black">
                                                    <span className="text-[10px] opacity-50 uppercase text-zinc-500">STT</span>
                                                    <span className="text-2xl">#{manualEdits[ass.id]?.lot_stt || ass.lot_stt}</span>
                                                </div>
                                                <ArrowRight className="text-zinc-300 dark:text-zinc-700" />
                                                <div className="flex flex-col gap-2">
                                                    <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-all" onClick={() => startEdit(ass)}>
                                                        <div className="flex items-center gap-2">
                                                            <MapPin size={16} className="text-red-500" />
                                                            <span className="text-xl font-black uppercase text-zinc-900 dark:text-white">
                                                                {manualEdits[ass.id]?.position_code || ass.position?.code || '---'}
                                                            </span>
                                                        </div>
                                                        <div className="text-[9px] text-zinc-500 dark:text-zinc-500 font-bold uppercase mt-1 tracking-wider">SX: {format(new Date(ass.production_date), 'dd/MM/yyyy')}</div>
                                                    </div>
                                                    
                                                    {(() => {
                                                        const targetPosCode = manualEdits[ass.id]?.position_code || ass.position?.code
                                                        const pos = allPositions.find(p => p.code === targetPosCode)
                                                        if (pos?.lot_id) {
                                                            const occupant = lotsInDay.find(l => l.id === pos.lot_id)
                                                            return (
                                                                <div className="px-3 py-2 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl animate-in fade-in slide-in-from-top-1 duration-300">
                                                                    <div className="text-[8px] font-black text-red-600 dark:text-red-400 uppercase flex items-center gap-1.5"><AlertTriangle size={10} /> Vị trí này đang chứa:</div>
                                                                    <div className="text-[10px] font-black text-red-700 dark:text-red-300 mt-0.5">#{occupant?.daily_seq} | {occupant?.code}</div>
                                                                    <div className="text-[8px] text-red-500 font-bold leading-tight mt-1">{occupant?.product_names?.join(', ')}</div>
                                                                </div>
                                                            )
                                                        }
                                                        return null
                                                    })()}
                                                </div>
                                            </div>

                                            <div className="flex-1 w-full min-w-0">
                                                {perfectMatch ? (
                                                    <div className="p-5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-[24px] flex flex-col justify-center gap-3">
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                                                <CheckCircle2 size={14} /> KHỚP STT & NGÀY SẢN XUẤT
                                                            </div>
                                                            {perfectMatch.positions?.[0] ? (
                                                                <div className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-black rounded-lg flex items-center gap-1 border border-amber-200">
                                                                    <AlertTriangle size={12}/> ĐÃ GÁN VỊ TRÍ: {perfectMatch.positions[0].code}
                                                                </div>
                                                            ) : (
                                                                <div className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg flex items-center gap-1 border border-emerald-200">
                                                                    <CheckCircle2 size={12}/> CHƯA CÓ VỊ TRÍ
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <div className="min-w-0 pr-4">
                                                                <div className="text-sm font-black text-zinc-900 dark:text-white mb-0.5">{perfectMatch.code}</div>
                                                                <div className="text-[10px] text-zinc-600 dark:text-zinc-400 font-bold leading-relaxed">{perfectMatch.product_names?.join(', ')}</div>
                                                            </div>
                                                            <div className="flex gap-2 shrink-0">
                                                                <button onClick={() => handleApprove(ass, perfectMatch.id)} disabled={!!actionLoading} className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">DUYỆT NGAY</button>
                                                                <button onClick={() => handleReject(ass)} className="p-3 text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={20} /></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : hasOtherMatches ? (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between px-2">
                                                            <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2"><Info size={14} />PHÁT HIỆN {allMatchedLots.length} LÔ HÀNG TRÙNG STT</div>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => startEdit(ass)} className="p-1 text-zinc-400 hover:text-blue-500 transition-colors"><Edit2 size={14} /></button>
                                                                <button onClick={() => handleReject(ass)} className="p-1 text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
                                                            {allMatchedLots.sort((a,b)=>{
                                                                const aHasPos = a.positions?.[0] ? 1 : 0;
                                                                const bHasPos = b.positions?.[0] ? 1 : 0;
                                                                if (aHasPos !== bHasPos) return aHasPos - bHasPos;
                                                                return new Date(b.inbound_date||'').getTime()-new Date(a.inbound_date||'').getTime();
                                                            }).map(l=>(
                                                                <button key={l.id} onClick={() => handleApprove(ass, l.id)} className="w-full text-left p-4 bg-white dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-600 rounded-2xl transition-all group relative overflow-hidden">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <div className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[9px] font-black rounded-lg border border-blue-100 dark:border-blue-900/30">SX: {format(new Date(l.inbound_date||''), 'dd/MM/yyyy')}</div>
                                                                        {l.positions?.[0] ? (
                                                                            <div className="text-[10px] font-black text-amber-700 flex items-center gap-1 bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg"><MapPin size={12} className="text-amber-500" /> ĐÃ GÁN: {l.positions[0].code}</div>
                                                                        ) : (
                                                                            <div className="text-[10px] font-black text-emerald-700 flex items-center gap-1 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg"><CheckCircle2 size={12} className="text-emerald-500" /> CHƯA CÓ VỊ TRÍ</div>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs font-black text-zinc-900 dark:text-white mb-1">{l.code}</div>
                                                                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold leading-normal">{l.product_names?.join(', ')}</div>
                                                                    <div className="absolute top-0 right-0 h-full w-12 bg-gradient-to-l from-blue-500/10 to-transparent flex items-center justify-center translate-x-12 group-hover:translate-x-0 transition-transform">
                                                                        <CheckCircle2 size={24} className="text-blue-600" />
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between px-2">
                                                            <div className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                                                <AlertCircle size={14} /> KHÔNG TÌM THẤY LÔ HÀNG
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => startEdit(ass)} className="p-1.5 text-zinc-400 hover:text-blue-500 transition-colors"><Edit2 size={16} /></button>
                                                                <button onClick={() => handleReject(ass)} className="p-1.5 text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                                            </div>
                                                        </div>
                                                        <div className="bg-amber-50 dark:bg-amber-900/5 border border-amber-100 dark:border-amber-900/20 rounded-3xl p-6 text-center">
                                                            <XCircle size={32} className="mx-auto text-amber-400 mb-3 opacity-50" />
                                                            <p className="text-sm font-black text-zinc-900 dark:text-white mb-1">
                                                                Không có lô hàng mang STT #{targetStt}
                                                            </p>
                                                            <p className="text-[10px] text-zinc-500 font-bold max-w-[250px] mx-auto">
                                                                Vui lòng dùng công cụ chỉnh sửa để đổi số STT cho khớp, hoặc tạo Lô hàng tương ứng bên mục "Tạo Lô Hàng".
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* History Section */}
                    <div className="mt-12">
                        <button onClick={() => {setShowHistory(!showHistory); if(!showHistory) fetchHistory();}} className="w-full flex items-center justify-between px-6 py-5 bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-3xl transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                            <div className="flex items-center gap-3"><History size={20} className="text-blue-600" /><span className="text-base font-black text-zinc-900 dark:text-white">Lịch Sử Duyệt Gán</span></div>
                            <ChevronDown className={`transition-transform text-zinc-400 ${showHistory?'rotate-180':''}`} />
                        </button>
                        {showHistory && (
                            <div className="mt-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[32px] p-6 space-y-4 shadow-xl">
                                <div className="space-y-4 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 rounded-[32px] border border-zinc-100 dark:border-zinc-800">
                                    {/* Dòng 1: Thời gian & Hành động */}
                                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div className="flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm">
                                            <Calendar size={14} className="text-blue-500" />
                                            <div className="flex items-center gap-3">
                                                <input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)} className="bg-transparent text-[11px] font-black text-zinc-900 dark:text-white outline-none cursor-pointer" />
                                                <span className="text-zinc-300 font-bold">→</span>
                                                <input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)} className="bg-transparent text-[11px] font-black text-zinc-900 dark:text-white outline-none cursor-pointer" />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => {
                                                    exportAssignmentHistoryToExcel({
                                                        systemName: currentSystem?.name || 'Unknown System',
                                                        dateRange: `${format(new Date(historyDateFrom), 'dd/MM/yyyy')} - ${format(new Date(historyDateTo), 'dd/MM/yyyy')}`,
                                                        items: filteredHistory
                                                    });
                                                }} 
                                                className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 whitespace-nowrap"
                                            >
                                                <Download size={15} /> Xuất Excel
                                            </button>
                                            <button 
                                                onClick={fetchHistory} 
                                                className="h-11 w-11 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all shrink-0"
                                            >
                                                <RefreshCcw size={16} className={historyLoading ? "animate-spin" : ""} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Dòng 2: Các ô tìm kiếm chi tiết */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="relative group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={14} />
                                            <input 
                                                placeholder="Tìm vị trí, số STT, tên sản phẩm..." 
                                                value={historySearchTerm} 
                                                onChange={e => setHistorySearchTerm(e.target.value)} 
                                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl py-3 pl-11 pr-4 text-[11px] font-bold text-zinc-900 dark:text-white outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 shadow-sm transition-all" 
                                            />
                                        </div>
                                        <div className="relative group">
                                            <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={14} />
                                            <input 
                                                placeholder="Mã Lệnh Sản Xuất..." 
                                                value={historyProdOrderSearch} 
                                                onChange={e => setHistoryProdOrderSearch(e.target.value)} 
                                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl py-3 pl-11 pr-4 text-[11px] font-bold text-zinc-900 dark:text-white outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 shadow-sm transition-all" 
                                            />
                                        </div>
                                        <div className="relative group">
                                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={14} />
                                            <input 
                                                placeholder="Mã Lot Sản Xuất..." 
                                                value={historyProdLotSearch} 
                                                onChange={e => setHistoryProdLotSearch(e.target.value)} 
                                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl py-3 pl-11 pr-4 text-[11px] font-bold text-zinc-900 dark:text-white outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 shadow-sm transition-all" 
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                    <table className="w-full text-xs">
                                        <thead className="bg-zinc-50 dark:bg-zinc-950">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">STT</th>
                                                <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Lệnh SX / Lot SX</th>
                                                <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Sản Phẩm</th>
                                                <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Số lượng</th>
                                                <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Quy đổi (kg)</th>
                                                <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Vị trí</th>
                                                <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Loại</th>
                                                <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Ngày SX</th>
                                                <th className="px-4 py-3 text-left font-black text-zinc-400 uppercase tracking-widest text-[10px]">Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                                            {filteredHistory.map(h => (
                                                    <tr key={h.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                                        <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-300">#{h.lot_stt}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">
                                                                    LSX: {h.lot?.production_order_code || '---'}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-zinc-500 uppercase">
                                                                    LOT: {h.lot?.production_lot_code || '---'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {h.lot ? (
                                                                <div className="flex flex-col">
                                                                    <span className="font-black text-zinc-900 dark:text-white uppercase">{h.lot.code}</span>
                                                                    <span className="text-[10px] text-zinc-500 font-medium line-clamp-1">{h.lot.product_names?.join(', ') || '---'}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-zinc-400 italic">Không xác định</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="font-black text-zinc-900 dark:text-zinc-300">
                                                                {h.lot?.quantity_display || '---'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg">
                                                                {h.lot?.total_weight_kg ? `${h.lot.total_weight_kg.toLocaleString('vi-VN')} kg` : '---'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <MapPin size={12} className="text-emerald-500" />
                                                                    <span className="font-bold text-zinc-900 dark:text-zinc-200 uppercase">{h.position?.code}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    <span className="text-[9px] font-bold text-zinc-400 uppercase">
                                                                        {h.assignment_type === 'move' ? 'Từ:' : 'Nguồn:'}
                                                                    </span>
                                                                    <span className={`text-[9px] font-black uppercase ${h.assignment_type === 'move' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                        {h.old_position_code || 'Sảnh'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {h.status === 'approved' ? (
                                                                h.assignment_type === 'move' ? (
                                                                    <div className="flex flex-col">
                                                                        <span className="text-blue-600 dark:text-blue-400 font-black uppercase text-[9px] flex items-center gap-1">
                                                                            <RefreshCcw size={10} /> Di chuyển
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[9px] flex items-center gap-1">
                                                                        <Plus size={10} /> Gán mới
                                                                    </span>
                                                                )
                                                            ) : (
                                                                <span className="text-zinc-400">---</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-zinc-500 font-medium">
                                                            {format(new Date(h.production_date), 'dd/MM/yyyy')}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${h.status === 'approved' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                                                                {h.status === 'approved' ? 'Đã duyệt' : 'Đã hủy'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-100 dark:border-zinc-800 p-5 sticky top-6 shadow-sm">
                        <h2 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase px-2 mb-4 tracking-widest flex justify-between items-center">
                            Danh sách LOT ({lotsInDay.length})
                            <Package size={14} className="opacity-40" />
                        </h2>
                        <div className="relative mb-5">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                            <input placeholder="Tìm mã số LOT..." value={lotSearchTerm} onChange={e => setLotSearchTerm(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-black text-zinc-900 dark:text-white outline-none focus:border-blue-500 shadow-inner" />
                        </div>
                        <div className="max-h-[600px] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                            {lotsInDay
                                .filter(l => !lotSearchTerm || l.code.toLowerCase().includes(lotSearchTerm.toLowerCase()))
                                .filter(l => showOnlyUnassigned ? !l.positions?.[0] : true)
                                .map(lot => (
                                <div key={lot.id} className="p-4 bg-zinc-50/50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-900 transition-all flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-900 rounded-xl flex items-center justify-center font-black text-xs text-zinc-900 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 shadow-sm group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">#{lot.daily_seq}</div>
                                        <div>
                                            <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">{lot.code}</div>
                                            <div className="text-[9px] text-zinc-500 dark:text-zinc-500 font-bold uppercase tracking-wider">{lot.inbound_date ? format(new Date(lot.inbound_date), 'dd/MM/yyyy') : '---'}</div>
                                        </div>
                                    </div>
                                    {lot.positions?.[0]?.code ? (
                                        <div className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[9px] font-black rounded-lg uppercase border border-emerald-200 dark:border-emerald-900/30">
                                            {lot.positions[0].code}
                                        </div>
                                    ) : (
                                        <div className="w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {editingId && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-[40px] p-8 w-full max-w-md shadow-2xl border border-zinc-100 dark:border-zinc-800 animate-in zoom-in duration-300">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600"><Edit2 size={24} /></div>
                            <div>
                                <h3 className="text-2xl font-black text-zinc-900 dark:text-white">Chỉnh sửa yêu cầu</h3>
                                <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest mt-0.5">Mobile Assignment Fix</p>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-1.5 ml-1">Số STT Lô hàng</label>
                                <input type="number" value={editValues.lot_stt} onChange={e => setEditValues(prev => ({...prev, lot_stt: e.target.value}))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-base font-black text-zinc-900 dark:text-white outline-none focus:border-blue-500 shadow-inner" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-1.5 ml-1">Mã số vị trí kệ hàng</label>
                                <input value={editValues.position_code} list="edit-pos-list" onChange={e => setEditValues(prev => ({...prev, position_code: e.target.value}))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-base font-black uppercase text-zinc-900 dark:text-white outline-none focus:border-blue-500 shadow-inner" />
                                <datalist id="edit-pos-list">{allPositions.map(p => <option key={p.id} value={p.code} />)}</datalist>
                            </div>
                        </div>
                        <div className="flex gap-4 mt-10">
                            <button onClick={() => setEditingId(null)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-black rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-95">Hủy bỏ</button>
                            <button onClick={() => handleSaveEdit(pendingList.find(a => a.id === editingId)!)} className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all">Lưu nháp</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
