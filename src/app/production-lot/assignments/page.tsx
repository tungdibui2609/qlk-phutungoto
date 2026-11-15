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
import { logActivity } from '@/lib/audit'
import { decodeSTT, encodeSTT } from '@/lib/numberUtils'
import { TagDisplay } from '@/components/lots/TagDisplay'

import {
    type PendingAssignment,
    type Lot,
    extractLotTags,
    safeFormatDate,
    getLotDateStr,
} from './_components/helpers'
import { PendingAssignmentsList } from './_components/PendingAssignmentsList'
import { AssignmentHistorySection } from './_components/AssignmentHistorySection'
import { AssignmentModals } from './_components/AssignmentModals'

export default function AssignmentApprovalPage() {
    const { currentSystem } = useSystem()
    const { profile } = useUser()
    const { showToast, showConfirm } = useToast()

    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
    
    const [pendingList, setPendingList] = useState<PendingAssignment[]>([])
    const [pendingSearchTerm, setPendingSearchTerm] = useState('')
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
    const [dateFilterType, setDateFilterType] = useState<'created_at' | 'production_date'>('created_at')
    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'approved' | 'rejected'>('all')
    const [historySearchTerm, setHistorySearchTerm] = useState('')
    const [historyProdOrderSearch, setHistoryProdOrderSearch] = useState('')
    const [historyProdLotSearch, setHistoryProdLotSearch] = useState('')
    const [debugInfo, setDebugInfo] = useState<{
        sysCode: string,
        expandedDateFrom: string,
        expandedDateTo: string,
        knownLotIdsCount: number,
        dailySeqsCount: number,
        lotsError: string | null,
        lotsCount: number,
        fallbackLotsCount: number,
        fallbackError: string | null
    } | null>(null)
    const [showDebugBox, setShowDebugBox] = useState(false)
    
    // Global positions for manual join
    const [allPositions, setAllPositions] = useState<any[]>([])
    
    // Orphaned positions state
    const [orphanedPositions, setOrphanedPositions] = useState<any[]>([])
    const [showOrphanedModal, setShowOrphanedModal] = useState(false)
    const [checkingOrphans, setCheckingOrphans] = useState(false)
    
    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValues, setEditValues] = useState<{ lot_stt: string, position_id: string, position_code: string }>({ lot_stt: '', position_id: '', position_code: '' })
    const [manualEdits, setManualEdits] = useState<Record<string, { lot_stt: number, position_code: string }>>({})

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Helper lấy danh sách vị trí của một lô hàng
    const getLotPositions = (lot: Lot | undefined | null) => {
        if (!lot) return []
        if (lot.positions && lot.positions.length > 0) {
            return lot.positions
        }
        const found = allPositions.filter(p => p.lot_id === lot.id)
        return found.map(p => ({ id: p.id, code: p.code }))
    }

    // Danh sách các yêu cầu không tìm thấy lô hàng tương ứng (mục lỗi/rác)
    const unmatchedPendingList = useMemo(() => {
        return pendingList.filter(ass => {
            const targetStt = manualEdits[ass.id]?.lot_stt || ass.lot_stt
            const allMatchedLotsRaw = lotsInDay.filter(l => l.daily_seq === targetStt)
            return allMatchedLotsRaw.length === 0
        })
    }, [pendingList, lotsInDay, manualEdits])

    // Danh sách yêu cầu chờ duyệt sau khi lọc tìm kiếm (STT, vị trí, tên sản phẩm/lô)
    const filteredPendingList = useMemo(() => {
        if (!pendingSearchTerm.trim()) return pendingList
        const term = pendingSearchTerm.trim().toLowerCase().replace(/^#/, '')
        return pendingList.filter(ass => {
            const targetStt = manualEdits[ass.id]?.lot_stt || ass.lot_stt
            const sttDecoded = decodeSTT(targetStt).toLowerCase()
            const rawStt = String(targetStt).toLowerCase()
            const posCode = (manualEdits[ass.id]?.position_code || ass.position?.code || '').toLowerCase()

            // Khớp số thứ tự (ví dụ: "5", "#5") hoặc mã vị trí
            if (sttDecoded.includes(term) || rawStt.includes(term) || posCode.includes(term)) {
                return true
            }

            // Khớp mã lô, mã phụ hoặc tên sản phẩm liên kết, thẻ tag
            const matchedLots = lotsInDay.filter(l => l.daily_seq === targetStt)
            return matchedLots.some(l =>
                l.code.toLowerCase().includes(term) ||
                l.production_code?.toLowerCase().includes(term) ||
                l.tags?.some(t => t.toLowerCase().includes(term)) ||
                l.product_names?.some(p => p.toLowerCase().includes(term)) ||
                l.product_skus?.some(s => s.toLowerCase().includes(term))
            )
        })
    }, [pendingList, pendingSearchTerm, manualEdits, lotsInDay])

    const filteredHistory = useMemo(() => {
        return historyList.filter(h => {
            const matchesGeneral = !historySearchTerm || 
                h.position?.code?.toLowerCase().includes(historySearchTerm.toLowerCase()) || 
                decodeSTT(h.lot_stt).toLowerCase().includes(historySearchTerm.toLowerCase()) ||
                h.lot?.code?.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
                h.lot?.production_code?.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
                h.lot?.tags?.some(t => t.toLowerCase().includes(historySearchTerm.toLowerCase())) ||
                h.lot?.product_names?.some(p => p.toLowerCase().includes(historySearchTerm.toLowerCase()));
            
            const matchesProdOrder = !historyProdOrderSearch || 
                h.lot?.production_order_code?.toLowerCase().includes(historyProdOrderSearch.toLowerCase());
                
            const matchesProdLot = !historyProdLotSearch || 
                h.lot?.production_lot_code?.toLowerCase().includes(historyProdLotSearch.toLowerCase()) ||
                h.lot?.production_code?.toLowerCase().includes(historyProdLotSearch.toLowerCase());

            return matchesGeneral && matchesProdOrder && matchesProdLot;
        });
    }, [historyList, historySearchTerm, historyProdOrderSearch, historyProdLotSearch]);

    useEffect(() => {
        if (currentSystem?.code) {
            fetchData()
        }
    }, [currentSystem, dateFrom, dateTo, dateFilterType])

    useEffect(() => {
        if (showHistory && currentSystem?.code) {
            fetchHistory()
        }
    }, [showHistory, currentSystem, historyDateFrom, historyDateTo, dateFilterType])

    // Quét vị trí kẹt một lần ngầm sau khi trang tải xong 3 giây
    useEffect(() => {
        if (currentSystem?.code) {
            const timer = setTimeout(() => {
                checkOrphanedPositions(true)
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [currentSystem?.code])

    async function fetchData(silent = false) {
        if (!currentSystem?.code) {
            setLoading(false)
            return
        }
        if (!silent) setLoading(true)
        try {
            // 1. Fetch Assignments: Lấy toàn bộ các bản ghi đang chờ duyệt (pending) của phân hệ hiện tại bất kể thời gian
            const { data: pendingData, error: pendingErr } = await (supabase.from('pending_assignments') as any)
                .select('*')
                .eq('system_code', currentSystem.code)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })

            if (pendingErr) throw pendingErr

            // Lấy các bản ghi đã xử lý (approved, rejected) trong khoảng thời gian lọc
            let processedQuery = (supabase.from('pending_assignments') as any)
                .select('*')
                .eq('system_code', currentSystem.code)
                .neq('status', 'pending')

            if (dateFilterType === 'created_at') {
                processedQuery = processedQuery
                    .gte('created_at', dateFrom + 'T00:00:00+07:00')
                    .lte('created_at', dateTo + 'T23:59:59.999+07:00')
            } else {
                processedQuery = processedQuery
                    .gte('production_date', dateFrom)
                    .lte('production_date', dateTo)
            }

            const { data: processedData, error: processedErr } = await processedQuery
                .order('created_at', { ascending: false })
                .limit(2000)

            if (processedErr) throw processedErr

            const assignments = [...(pendingData || []), ...(processedData || [])]

            // 2. Fetch required positions for these assignments
            const posIds = Array.from(new Set(assignments.map((a: any) => a.position_id).filter(Boolean)))
            let posMap: Record<string, string> = {}
            if (posIds.length > 0) {
                let historyPosData: any[] = []
                for (let i = 0; i < posIds.length; i += 200) {
                    const chunk = posIds.slice(i, i + 200)
                    const { data } = await (supabase.from('positions') as any)
                        .select('id, code')
                        .in('id', chunk)
                        .limit(1000)
                    if (data) historyPosData.push(...data)
                }
                historyPosData.forEach((p: any) => {
                    posMap[p.id] = p.code
                })
            }

            // 3. Keep allPositions updated for dropdowns and edits
            const { data: allPosData } = await (supabase.from('positions') as any)
                .select('id, code, lot_id, lots!fk_positions_lot_id(id, code, daily_seq)')
                .eq('system_type', currentSystem.code)
                .limit(10000) // Support up to 10k positions to avoid limit 1000 issue
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

            const currentPending = enrichedAssignments.filter((a: any) => a.status === 'pending')
            setPendingList(currentPending)
            setSelectedIds(prev => {
                const currentIds = new Set(currentPending.map((a: any) => a.id))
                const next = new Set<string>()
                prev.forEach(id => {
                    if (currentIds.has(id)) next.add(id)
                })
                return next
            })
            setApprovedList(enrichedAssignments.filter((a: any) => a.status.startsWith('approved')))
            setRejectedList(enrichedAssignments.filter((a: any) => a.status === 'rejected'))

            const pendingStts = Array.from(new Set([
                ...assignments.map((a: any) => a.lot_stt),
                ...Object.values(manualEdits).map((m: any) => m.lot_stt)
            ]))
            
            // Tính toán ngày nhỏ nhất của các yêu cầu pending để lấy bổ sung lô hàng khớp STT
            const pendingDates = assignments.filter((a: any) => a.status === 'pending').map((a: any) => a.production_date).filter(Boolean)
            let minPendingDate = dateFrom
            if (pendingDates.length > 0) {
                pendingDates.forEach((d: string) => {
                    if (d < minPendingDate) minPendingDate = d
                })
            }
            const expandedLotDateFrom = format(subDays(new Date(minPendingDate), 45), 'yyyy-MM-dd')

            // === SPLIT INTO 2 QUERIES to avoid PostgREST .or() + .neq() interaction issues ===
            
            // Query 1: Lots in the selected date range
            const { data: dateRangeLots, error: lErr1 } = await supabase
                .from('lots')
                .select(`*, lot_items(products(name, sku)), lot_tags(tag, lot_item_id)`)
                .eq('system_code', currentSystem.code)
                .neq('status', 'hidden')
                .neq('status', 'exported')
                .gte('inbound_date', dateFrom)
                .lte('inbound_date', dateTo + 'T23:59:59')
                .order('inbound_date', { ascending: false })
                .order('daily_seq', { ascending: true })
                .limit(5000)

            if (lErr1) throw lErr1

            // Query 2: Lots matching pending STTs (không giới hạn thời gian để luôn tải được cả các lô nhập từ nhiều tháng trước)
            let sttMatchedLots: any[] = []
            if (pendingStts.length > 0) {
                // Batch STTs to avoid overly long URL filters
                for (let i = 0; i < pendingStts.length; i += 50) {
                    const sttChunk = pendingStts.slice(i, i + 50)
                    const { data: sttData, error: sttErr } = await supabase
                        .from('lots')
                        .select(`*, lot_items(products(name, sku)), lot_tags(tag, lot_item_id)`)
                        .eq('system_code', currentSystem.code)
                        .neq('status', 'hidden')
                        .neq('status', 'exported')
                        .in('daily_seq', sttChunk)
                        .order('inbound_date', { ascending: false })
                        .limit(5000)
                    
                    if (sttErr) {
                        console.error('[LOTS] STT query chunk error:', sttErr)
                    } else if (sttData) {
                        sttMatchedLots.push(...sttData)
                    }
                }
            }

            // Deduplicate by lot ID
            const seenLotIds = new Set<string>()
            const fetchedLots: any[] = []
            for (const lot of [...(dateRangeLots || []), ...sttMatchedLots]) {
                if (!seenLotIds.has(lot.id)) {
                    seenLotIds.add(lot.id)
                    fetchedLots.push(lot)
                }
            }
            
            const lotIds = fetchedLots.map((l: any) => l.id)
            console.log(`[LOTS] Fetched: ${fetchedLots.length} (dateRange=${(dateRangeLots||[]).length}, sttMatch=${sttMatchedLots.length}, pendingStts=${pendingStts.length})`)
            
            // Explicitly fetch the positions for THESE lots to bypass the 10k row limit on allPosData
            let assignedPosData: any[] = []
            if (lotIds.length > 0) {
                for (let i = 0; i < lotIds.length; i += 200) {
                    const chunk = lotIds.slice(i, i + 200)
                    const { data } = await supabase.from('positions').select('id, code, lot_id').in('lot_id', chunk).limit(1000)
                    if (data) assignedPosData.push(...data)
                }
            }

            const formattedLots: Lot[] = fetchedLots.map((l: any) => ({
                ...l,
                product_names: l.lot_items?.map((li: any) => li.products?.name).filter(Boolean) || [],
                product_skus: l.lot_items?.map((li: any) => li.products?.sku).filter(Boolean) || [],
                tags: extractLotTags(l),
                positions: assignedPosData.filter((p: any) => p.lot_id === l.id)
            }))

            setLotsInDay(formattedLots)
        } catch (e: any) {
            console.error('Fetch error:', e)
            if (!silent) showToast('Lỗi tải dữ liệu: ' + (e.message || 'Không xác định'), 'error')
        } finally {
            if (!silent) setLoading(false)
        }
    }

    async function fetchHistory() {
        if (!currentSystem?.code) return
        setHistoryLoading(true)
        let debugLotsErr: string | null = null
        let debugFallbackErr: string | null = null
        let debugLotsCount = 0
        let debugFallbackLotsCount = 0

        try {
            // Chuẩn hóa mã phân hệ để đảm bảo tương thích giữa FROZEN và KHO_DONG_LANH
            let sysCode = currentSystem.code
            if (sysCode === 'FROZEN') sysCode = 'KHO_DONG_LANH'

            let query = (supabase.from('pending_assignments') as any)
                .select('*')
                .in('system_code', [sysCode, 'FROZEN'])
                .neq('status', 'pending')

            if (dateFilterType === 'created_at') {
                query = query
                    .gte('created_at', historyDateFrom + 'T00:00:00+07:00')
                    .lte('created_at', historyDateTo + 'T23:59:59.999+07:00')
            } else {
                query = query
                    .gte('production_date', historyDateFrom)
                    .lte('production_date', historyDateTo)
            }

            query = query
                .order('created_at', { ascending: false })
                .limit(2000)
            
            if (historyStatusFilter !== 'all') query = query.eq('status', historyStatusFilter)

            const { data, error } = await query
            if (error) throw error
            const assignments = data || []

            if (assignments.length === 0) {
                setHistoryList([])
                setHistoryLoading(false)
                return
            }

            // Extract all unique position IDs from history
            const posIds = Array.from(new Set(assignments.map((a: any) => a.position_id).filter(Boolean)))
            
            let posMap: Record<string, string> = {}
            if (posIds.length > 0) {
                let posData: any[] = []
                for (let i = 0; i < posIds.length; i += 200) {
                    const chunk = posIds.slice(i, i + 200)
                    const { data } = await (supabase.from('positions') as any)
                        .select('id, code')
                        .in('id', chunk)
                        .limit(1000)
                    if (data) posData.push(...data)
                }
                posData.forEach((p: any) => {
                    posMap[p.id] = p.code
                })
            }

            // 4. Fetch LOTs for these dates to match product info
            const dailySeqs = Array.from(new Set(assignments.map((a: any) => a.lot_stt)))
            const knownLotIds = Array.from(new Set(assignments
                .map((a: any) => {
                    const status = a.status || ''
                    const parts = status.split(':')
                    // Format: "approved:new:LOT_ID" or "approved:move:OLD_POS:LOT_ID"
                    if (parts.length >= 3 && parts[0] === 'approved') {
                        const potentialId = parts[parts.length - 1]
                        // Kiểm tra UUID hợp lệ bằng regex để tránh crash query Supabase
                        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(potentialId)) {
                            return potentialId
                        }
                    }
                    return null
                })
                .filter(Boolean))) as string[]

            const expandedDateFrom = format(subDays(new Date(historyDateFrom), 45), 'yyyy-MM-dd')
            const expandedDateTo = format(parseISO(historyDateTo), 'yyyy-MM-dd') + 'T23:59:59'

            // 1. Lấy tất cả các lot trong khoảng thời gian gieo (Tránh Bad Request do URL quá dài khi lọc hàng trăm ID)
            let lotsQuery = supabase
                .from('lots')
                .select(`
                    id, code, daily_seq, inbound_date,
                    production_code,
                    production_lot_id,
                    metadata,
                    productions(code, production_lots(lot_code)),
                    lot_items(quantity, unit, products(name, sku, weight_kg)),
                    lot_tags(tag, lot_item_id)
                `)
                .eq('system_code', sysCode)
                .gte('inbound_date', expandedDateFrom)
                .lte('inbound_date', expandedDateTo)
                .order('inbound_date', { ascending: false })
                .limit(4000)

            let { data: fetchedLotsData, error: lotsErr } = await lotsQuery
            let lotsData: any[] = fetchedLotsData || []
            if (fetchedLotsData) debugLotsCount = fetchedLotsData.length
            
            if (lotsErr) {
                debugLotsErr = JSON.stringify(lotsErr)
                console.error('Lots fetch error in history:', lotsErr)
                
                // Fallback lấy dữ liệu đơn giản nếu query chính lỗi
                let fallbackQuery = supabase
                    .from('lots')
                    .select('id, code, daily_seq, inbound_date, production_code, metadata, lot_items(quantity, unit, products(name, sku, weight_kg)), lot_tags(tag, lot_item_id)')
                    .eq('system_code', sysCode)
                    .gte('inbound_date', expandedDateFrom)
                    .lte('inbound_date', expandedDateTo)
                    .limit(4000)

                const { data: simpleLotsData, error: fallbackErr } = await fallbackQuery
                if (simpleLotsData) {
                    lotsData = simpleLotsData as any
                    debugFallbackLotsCount = simpleLotsData.length
                }
                if (fallbackErr) {
                    debugFallbackErr = JSON.stringify(fallbackErr)
                }
            }

            // 2. Thuật toán Smart Lazy Loading: Lấy bổ sung các Lô hàng siêu cũ nằm ngoài khoảng 52 ngày
            const fetchedIds = new Set(lotsData.map((l: any) => l.id))
            const missingIds = knownLotIds.filter(id => !fetchedIds.has(id))

            if (missingIds.length > 0) {
                let additionalLots: any[] = []
                // Chia nhỏ chunk tối đa 100 ID mỗi lần để đảm bảo tuyệt đối không bao giờ bị Bad Request
                for (let i = 0; i < missingIds.length; i += 100) {
                    const chunk = missingIds.slice(i, i + 100)
                    const { data: chunkData } = await supabase
                        .from('lots')
                        .select(`
                            id, code, daily_seq, inbound_date,
                            production_code,
                            production_lot_id,
                            metadata,
                            productions(code, production_lots(lot_code)),
                            lot_items(quantity, unit, products(name, sku, weight_kg)),
                            lot_tags(tag, lot_item_id)
                        `)
                        .in('id', chunk)
                    if (chunkData) additionalLots.push(...chunkData)
                }
                if (additionalLots.length > 0) {
                    lotsData = [...lotsData, ...additionalLots]
                    debugLotsCount = lotsData.length
                }
            }

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
                    tags: extractLotTags(l),
                    total_quantity: totalQty,
                    total_weight_kg: totalWeightKg,
                    unit: unit,
                    quantity_display: `${totalQty} ${unit}`.trim() || '---',
                    production_order_code: (l as any).productions?.code || null,
                    production_lot_code: (Array.isArray((l as any).productions?.production_lots) ? (l as any).productions.production_lots[0]?.lot_code : (l as any).productions?.production_lots?.lot_code) || l.production_code || null
                }
            })

            const lotsMap: Record<string, any[]> = {}
            processedLots.forEach((l: any) => {
                const date = getLotDateStr(l)
                if (date) {
                    const key = `${date}_${l.daily_seq}`
                    if (!lotsMap[key]) lotsMap[key] = []
                    lotsMap[key].push(l)
                }
            })

            const enriched = assignments.map((h: any) => {
                // Decode status info to get Lot ID if stored
                const statusStr = h.status || ''
                const parts = statusStr.split(':')
                let explicitLotId: string | null = null
                if (parts.length >= 3 && parts[0] === 'approved') {
                    explicitLotId = parts[parts.length - 1]
                }

                let lot = null
                if (explicitLotId) {
                    lot = processedLots.find(l => l.id === explicitLotId)
                }

                // If no explicit lot ID or lot not found in current fetch, fallback to matching logic
                if (!lot) {
                    const date = h.production_date
                    const key = `${date}_${h.lot_stt}`
                    let matchedLots = lotsMap[key] || []
                    
                    // Smart Fallback: If exact date match fails, look for the same STT on any date (prioritize closest date)
                    if (matchedLots.length === 0 && processedLots.length > 0) {
                        matchedLots = processedLots
                            .filter(l => l.daily_seq === h.lot_stt)
                            .sort((a, b) => {
                                const timeA = new Date(a.inbound_date || a.created_at || 0).getTime() || 0;
                                const timeB = new Date(b.inbound_date || b.created_at || 0).getTime() || 0;
                                const targetTime = new Date(h.production_date || 0).getTime() || 0;
                                const distA = Math.abs(timeA - targetTime);
                                const distB = Math.abs(timeB - targetTime);
                                return distA - distB;
                            });
                    }
                    lot = matchedLots.length > 0 ? matchedLots[0] : null
                }

                // Decode assignment type and old position
                let assignment_type: 'new' | 'move' | undefined = undefined
                let old_position_code: string | undefined = undefined
                
                if (statusStr.startsWith('approved:move:')) {
                    assignment_type = 'move'
                    // For old format: approved:move:OLD_POS
                    // For new format: approved:move:OLD_POS:LOT_ID
                    if (parts.length >= 4) {
                        old_position_code = parts[2]
                    } else {
                        old_position_code = statusStr.replace('approved:move:', '')
                    }
                } else if (statusStr.startsWith('approved:new') || statusStr === 'approved') {
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
                        tags: lot.tags,
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
            setDebugInfo({
                sysCode,
                expandedDateFrom,
                expandedDateTo,
                knownLotIdsCount: knownLotIds.length,
                dailySeqsCount: dailySeqs.length,
                lotsError: debugLotsErr,
                lotsCount: debugLotsCount,
                fallbackLotsCount: debugFallbackLotsCount,
                fallbackError: debugFallbackErr
            })
        } catch (e: any) {
            showToast('Lỗi tải lịch sử: ' + e.message, 'error')
        } finally {
            setHistoryLoading(false)
        }
    }

    const startEdit = (ass: PendingAssignment) => {
        setEditingId(ass.id)
        setEditValues({
            lot_stt: decodeSTT(manualEdits[ass.id]?.lot_stt || ass.lot_stt),
            position_id: ass.position_id,
            position_code: manualEdits[ass.id]?.position_code || (ass.position as any)?.code || ''
        })
    }

    const handleSaveEdit = async (ass: PendingAssignment) => {
        const encodedStt = encodeSTT(editValues.lot_stt)
        const newCode = editValues.position_code.trim()
        if (encodedStt === null || isNaN(encodedStt) || !newCode) {
            showToast('Vui lòng nhập đầy đủ STT và Mã vị trí', 'error')
            return
        }

        // Tải lô hàng tương ứng với STT mới nếu chưa có trong lotsInDay
        const isLotAlreadyLoaded = lotsInDay.some(l => l.daily_seq === encodedStt)
        if (!isLotAlreadyLoaded && currentSystem?.code) {
            try {
                const pendingDates = pendingList.map((a: any) => a.production_date).filter(Boolean)
                let minPendingDate = dateFrom
                if (pendingDates.length > 0) {
                    pendingDates.forEach((d: string) => {
                        if (d < minPendingDate) minPendingDate = d
                    })
                }
                const expandedLotDateFrom = format(subDays(new Date(minPendingDate), 45), 'yyyy-MM-dd')

                const { data: newLots, error: fetchLotErr } = await supabase
                    .from('lots')
                    .select(`*, lot_items(products(name, sku)), lot_tags(tag, lot_item_id)`)
                    .eq('system_code', currentSystem.code)
                    .neq('status', 'hidden')
                    .neq('status', 'exported')
                    .eq('daily_seq', encodedStt)
                    .order('inbound_date', { ascending: false })
                
                if (fetchLotErr) {
                    console.error('[EDIT SAVE] Fetch custom lot error:', fetchLotErr)
                } else if (newLots && newLots.length > 0) {
                    const lotIds = newLots.map((l: any) => l.id)
                    const { data: posData } = await supabase
                        .from('positions')
                        .select('id, code, lot_id')
                        .in('lot_id', lotIds)
                    
                    const formattedNewLots: Lot[] = newLots.map((l: any) => ({
                        ...l,
                        product_names: l.lot_items?.map((li: any) => li.products?.name).filter(Boolean) || [],
                        product_skus: l.lot_items?.map((li: any) => li.products?.sku).filter(Boolean) || [],
                        tags: extractLotTags(l),
                        positions: posData?.filter((p: any) => p.lot_id === l.id) || []
                    }))

                    setLotsInDay(prev => {
                        const existIds = new Set(prev.map(p => p.id))
                        const filteredNew = formattedNewLots.filter(l => !existIds.has(l.id))
                        return [...prev, ...filteredNew]
                    })
                }
            } catch (e) {
                console.error('[EDIT SAVE] Fetch custom lot exception:', e)
            }
        }

        setManualEdits(prev => ({ ...prev, [ass.id]: { lot_stt: encodedStt, position_code: newCode } }))
        setEditingId(null)
        showToast(`Đã ghi nhận thay đổi. Nhấn Duyệt để hoàn tất.`, 'success')
    }

    const handleApprove = async (ass: PendingAssignment, lotId: string) => {
        if (!profile) {
            showToast('Vui lòng đăng nhập để thực hiện tác vụ này', 'error')
            return
        }
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
                    
                    // Audit Log for removal
                    await logActivity({
                        supabase,
                        tableName: 'positions',
                        recordId: oldPos.id,
                        action: 'UPDATE',
                        oldData: { lot_id: lotId },
                        newData: { lot_id: null },
                        systemCode: currentSystem?.code || ''
                    })
                }
            }

            // 4. Check target position availability
            if (targetPosInfo?.lot_id && targetPosInfo.lot_id !== lotId) {
                const confirmed = await showConfirm(`Vị trí ${targetPosInfo.code} hiện đang có một lô hàng khác đang ở đó. Bạn có muốn gỡ lô hàng cũ ra để gán lô mới vào không?`)
                if (!confirmed) {
                    setActionLoading(null)
                    return
                }
                const { error: unbindTargetErr } = await (supabase.from('positions') as any)
                    .update({ lot_id: null })
                    .eq('id', targetPosId)
                if (unbindTargetErr) throw new Error(`Lỗi khi gỡ lô cũ khỏi vị trí: ` + unbindTargetErr.message);
                await logActivity({
                    supabase,
                    tableName: 'positions',
                    recordId: targetPosId,
                    action: 'UPDATE',
                    oldData: { lot_id: targetPosInfo.lot_id },
                    newData: { lot_id: null },
                    systemCode: currentSystem?.code || ''
                })
            }

            // 5. EXECUTE UPDATES
            const { error: posUpdateErr } = await (supabase.from('positions') as any)
                .update({ lot_id: lotId })
                .eq('id', targetPosId)
            
            if (posUpdateErr) {
                throw new Error("KHÔNG THỂ GHI NHẬN VỊ TRÍ: " + posUpdateErr.message);
            }

            // Audit Log for new assignment
            await logActivity({
                supabase,
                tableName: 'positions',
                recordId: targetPosId,
                action: 'UPDATE',
                oldData: { lot_id: targetPosInfo?.lot_id || null },
                newData: { lot_id: lotId },
                systemCode: currentSystem?.code || ''
            })

            // Then, mark assignment as approved with metadata in status
            const isMove = otherPlacements.length > 0
            const oldPosCodes = otherPlacements.map((p: any) => p.code).join(', ')
            const finalStatus = isMove ? `approved:move:${oldPosCodes}:${lotId}` : `approved:new:${lotId}`

            const { error: statusUpdateErr } = await (supabase.from('pending_assignments') as any)
                .update({ status: finalStatus })
                .eq('id', ass.id)
            
            if (statusUpdateErr) {
                // Warning: position linked but assignment status failed to update
                showToast("Vị trí đã lưu nhưng lỗi cập nhật trạng thái: " + statusUpdateErr.message, "error");
                fetchData(true)
                return 
            }

            // OPTIMISTIC STATE UPDATE
            const targetPosCode = targetPosInfo?.code || manual?.position_code || ass.position?.code || ''
            setPendingList(prev => prev.filter(p => p.id !== ass.id))
            setSelectedIds(prev => {
                const next = new Set(prev)
                next.delete(ass.id)
                return next
            })
            setAllPositions(prev => prev.map(p => {
                if (p.id === targetPosId) return { ...p, lot_id: lotId }
                if (otherPlacements.some((o: any) => o.id === p.id)) return { ...p, lot_id: null }
                return p
            }))
            setLotsInDay(prev => prev.map(l => {
                if (l.id === lotId) {
                    return {
                        ...l,
                        positions: [{ id: targetPosId, code: targetPosCode }]
                    }
                }
                return l
            }))
            setApprovedList(prev => [{ ...ass, status: finalStatus, position: { id: targetPosId, code: targetPosCode } }, ...prev])

            showToast('Đã duyệt và ghi nhận vị trí thành công!', 'success')
            fetchData(true) 
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

            // OPTIMISTIC STATE UPDATE
            setPendingList(prev => prev.filter(p => p.id !== ass.id))
            setSelectedIds(prev => {
                const next = new Set(prev)
                next.delete(ass.id)
                return next
            })
            setRejectedList(prev => [{ ...ass, status: 'rejected' }, ...prev])

            showToast('Đã hủy yêu cầu', 'success')
            fetchData(true) 
        } catch (e: any) {
            showToast('Lỗi khi hủy: ' + e.message, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const handleDeleteAssignment = async (assId: string) => {
        const confirmed = await showConfirm('Lô hàng của yêu cầu này không tồn tại (có thể đã bị xóa trực tiếp). Bạn có chắc chắn muốn XÓA VĨNH VIỄN yêu cầu gán vị trí này khỏi hệ thống không?')
        if (!confirmed) return
        setActionLoading(assId)
        try {
            const { error } = await (supabase.from('pending_assignments') as any).delete().eq('id', assId)
            if (error) throw error
            setPendingList(prev => prev.filter(p => p.id !== assId))
            setSelectedIds(prev => {
                const next = new Set(prev)
                next.delete(assId)
                return next
            })
            showToast('Đã xóa vĩnh viễn yêu cầu gán vị trí', 'success')
            fetchData(true)
        } catch (e: any) {
            showToast('Lỗi khi xóa: ' + e.message, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    // Toggle multi-select for individual item
    const toggleSelect = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    // Select or deselect all items in filtered pending list
    const handleSelectAll = () => {
        const targetList = filteredPendingList
        if (targetList.length === 0) return

        const allTargetSelected = targetList.every(a => selectedIds.has(a.id))
        if (allTargetSelected) {
            setSelectedIds(prev => {
                const next = new Set(prev)
                targetList.forEach(a => next.delete(a.id))
                return next
            })
        } else {
            setSelectedIds(prev => {
                const next = new Set(prev)
                targetList.forEach(a => next.add(a.id))
                return next
            })
        }
    }

    // Select only unmatched / error items
    const handleSelectUnmatchedOnly = () => {
        if (unmatchedPendingList.length === 0) {
            showToast('Không có yêu cầu nào bị lỗi / thiếu lô hàng', 'info')
            return
        }
        setSelectedIds(new Set(unmatchedPendingList.map(a => a.id)))
        showToast(`Đã chọn ${unmatchedPendingList.length} yêu cầu không tìm thấy lô hàng`, 'info')
    }

    // Clear all selection
    const handleClearSelection = () => {
        setSelectedIds(new Set())
    }

    // Bulk Delete selected items or custom specified IDs
    const handleBulkDelete = async (customIds?: string[]) => {
        if (!currentSystem?.code) return
        const targetIds = customIds || Array.from(selectedIds)
        if (targetIds.length === 0) {
            showToast('Chưa chọn yêu cầu nào để xóa', 'error')
            return
        }

        const isAllUnmatched = customIds && customIds.length === unmatchedPendingList.length
        const message = isAllUnmatched
            ? `Bạn có chắc chắn muốn XÓA VĨNH VIỄN toàn bộ ${targetIds.length} yêu cầu không tìm thấy lô hàng khỏi hệ thống không? Dữ liệu đã xóa không thể khôi phục.`
            : `Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${targetIds.length} yêu cầu gán vị trí đã chọn khỏi hệ thống không? Dữ liệu đã xóa không thể khôi phục.`

        const confirmed = await showConfirm(message)
        if (!confirmed) return

        setActionLoading('bulk-delete')
        try {
            // Chia chunk 100 để tránh giới hạn kích thước URL PostgREST
            for (let i = 0; i < targetIds.length; i += 100) {
                const chunk = targetIds.slice(i, i + 100)
                const { error } = await (supabase.from('pending_assignments') as any)
                    .delete()
                    .eq('system_code', currentSystem.code)
                    .in('id', chunk)
                if (error) throw error
            }

            const targetSet = new Set(targetIds)
            setPendingList(prev => prev.filter(p => !targetSet.has(p.id)))
            setSelectedIds(prev => {
                const next = new Set(prev)
                targetIds.forEach(id => next.delete(id))
                return next
            })

            showToast(`Đã xóa vĩnh viễn ${targetIds.length} yêu cầu thành công!`, 'success')
            fetchData(true)
        } catch (e: any) {
            console.error('[BULK DELETE] Error:', e)
            showToast('Lỗi khi xóa hàng loạt: ' + (e.message || 'Không xác định'), 'error')
        } finally {
            setActionLoading(null)
        }
    }

    // Bulk Reject selected items
    const handleBulkReject = async (customIds?: string[]) => {
        if (!currentSystem?.code) return
        const targetIds = customIds || Array.from(selectedIds)
        if (targetIds.length === 0) {
            showToast('Chưa chọn yêu cầu nào để hủy', 'error')
            return
        }

        const confirmed = await showConfirm(`Bạn có chắc chắn muốn TỪ CHỐI / HỦY ${targetIds.length} yêu cầu đã chọn không?`)
        if (!confirmed) return

        setActionLoading('bulk-reject')
        try {
            for (let i = 0; i < targetIds.length; i += 100) {
                const chunk = targetIds.slice(i, i + 100)
                const { error } = await (supabase.from('pending_assignments') as any)
                    .update({ status: 'rejected' })
                    .eq('system_code', currentSystem.code)
                    .in('id', chunk)
                if (error) throw error
            }

            const targetSet = new Set(targetIds)
            const rejectedAsses = pendingList.filter(p => targetSet.has(p.id)).map(p => ({ ...p, status: 'rejected' }))
            setPendingList(prev => prev.filter(p => !targetSet.has(p.id)))
            setSelectedIds(prev => {
                const next = new Set(prev)
                targetIds.forEach(id => next.delete(id))
                return next
            })
            setRejectedList(prev => [...rejectedAsses, ...prev])

            showToast(`Đã hủy ${targetIds.length} yêu cầu thành công!`, 'success')
            fetchData(true)
        } catch (e: any) {
            console.error('[BULK REJECT] Error:', e)
            showToast('Lỗi khi hủy hàng loạt: ' + (e.message || 'Không xác định'), 'error')
        } finally {
            setActionLoading(null)
        }
    }

    async function checkOrphanedPositions(silent = false) {
        if (!currentSystem?.code) return
        if (!silent) setCheckingOrphans(true)
        try {
            // 1. Tải tất cả các vị trí đang có liên kết lot_id trong phân hệ hiện tại
            const { data: activePositions, error: posErr } = await (supabase.from('positions') as any)
                .select('id, code, lot_id')
                .eq('system_type', currentSystem.code)
                .not('lot_id', 'is', null)

            if (posErr) throw posErr
            const positionsList = activePositions || []

            if (positionsList.length === 0) {
                setOrphanedPositions([])
                if (!silent) showToast('Không phát hiện vị trí nào bị mắc kẹt dữ liệu.', 'success')
                return
            }

            // 2. Gom danh sách lot_id duy nhất
            const uniqueLotIds = Array.from(new Set(positionsList.map((p: any) => p.lot_id)))

            // 3. Kiểm tra sự tồn tại của các lot_id này trong bảng lots
            let existingLots: any[] = []
            if (uniqueLotIds.length > 0) {
                // Chia chunk 100 để tránh URL quá dài
                for (let i = 0; i < uniqueLotIds.length; i += 100) {
                    const chunk = uniqueLotIds.slice(i, i + 100)
                    const { data: lotsData, error: lotsErr } = await supabase
                        .from('lots')
                        .select('id')
                        .eq('system_code', currentSystem.code)
                        .in('id', chunk)
                    if (lotsErr) throw lotsErr
                    if (lotsData) existingLots.push(...lotsData)
                }
            }

            const existingLotIdsSet = new Set(existingLots.map((l: any) => l.id))

            // 4. Tìm các vị trí kho có lot_id không tồn tại trong existingLotIdsSet (lô hàng đã bị xóa trực tiếp)
            const orphans = positionsList.filter((p: any) => !existingLotIdsSet.has(p.lot_id))

            setOrphanedPositions(orphans)
            
            if (!silent) {
                if (orphans.length > 0) {
                    showToast(`Phát hiện ${orphans.length} vị trí kho bị mắc kẹt dữ liệu lô hàng đã xóa!`, 'warning')
                    setShowOrphanedModal(true)
                } else {
                    showToast('Tất cả vị trí kho đều ở trạng thái dữ liệu chính xác!', 'success')
                }
            }
        } catch (e: any) {
            console.error('[ORPHANS SCAN] Error:', e)
            if (!silent) showToast('Lỗi quét vị trí kẹt: ' + e.message, 'error')
        } finally {
            if (!silent) setCheckingOrphans(false)
        }
    }

    async function handleReleaseOrphanedPositions(targetPosIds: string[]) {
        if (!profile) {
            showToast('Vui lòng đăng nhập để thực hiện tác vụ này', 'error')
            return
        }
        const confirmed = await showConfirm(`Bạn có chắc chắn muốn giải phóng ${targetPosIds.length} vị trí kho này? Trạng thái vị trí sẽ được đưa về trống.`)
        if (!confirmed) return

        setActionLoading('orphans-release')
        try {
            let count = 0
            for (const posId of targetPosIds) {
                const targetPos = orphanedPositions.find((p: any) => p.id === posId)
                if (!targetPos) continue

                // 1. Cập nhật lot_id = null để giải phóng vị trí
                const { error: updateErr } = await (supabase.from('positions') as any)
                    .update({ lot_id: null })
                    .eq('id', posId)
                
                if (updateErr) throw new Error(`Lỗi cập nhật vị trí ${targetPos.code}: ${updateErr.message}`)

                // 2. Ghi audit log
                await logActivity({
                    supabase,
                    tableName: 'positions',
                    recordId: posId,
                    action: 'UPDATE',
                    oldData: { lot_id: targetPos.lot_id },
                    newData: { lot_id: null },
                    systemCode: currentSystem?.code || ''
                })
                count++
            }

            showToast(`Đã giải phóng thành công ${count} vị trí kho bị kẹt!`, 'success')
            setShowOrphanedModal(false)
            // Quét lại
            checkOrphanedPositions(true)
            // Tải lại dữ liệu trang
            fetchData(true)
        } catch (e: any) {
            console.error('[ORPHANS RELEASE] Error:', e)
            showToast('Lỗi giải phóng vị trí: ' + e.message, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    // Helper xác định lô hàng và vị trí ứng viên hợp lệ để duyệt tự động
    const getApprovedCandidate = (ass: PendingAssignment, allowMove = false) => {
        const targetStt = manualEdits[ass.id]?.lot_stt || ass.lot_stt
        const allMatchedLotsRaw = lotsInDay.filter(l => l.daily_seq === targetStt)
        const unassignedLots = allMatchedLotsRaw.filter(l => getLotPositions(l).length === 0)
        const allMatchedLots = showOnlyUnassigned && unassignedLots.length > 0 ? unassignedLots : allMatchedLotsRaw

        // Khớp chính xác ngày sản xuất (inbound_date hoặc created_at) với ngày quét (production_date)
        const dateMatchedLots = allMatchedLots.filter(l => getLotDateStr(l) === ass.production_date)
        let perfectMatch = dateMatchedLots.length === 1 ? dateMatchedLots[0] : null

        // Khi người dùng chủ động tích chọn (allowMove = true) và không có lô khớp ngày hôm nay:
        // Nếu trong kho chỉ duy nhất có đúng 1 lô mang STT này, chấp nhận lô đó vì người dùng đã chủ động chọn duyệt!
        if (!perfectMatch && allowMove && allMatchedLots.length === 1) {
            perfectMatch = allMatchedLots[0]
        }

        if (!perfectMatch) {
            return null // Không có hoặc có nhiều hơn 1 lô cùng ngày -> cần người dùng duyệt thủ công
        }

        // Nếu không cho phép di chuyển vị trí (trong duyệt nhanh), lô phải chưa có vị trí
        if (!allowMove && getLotPositions(perfectMatch).length > 0) {
            return null
        }

        // Xác định vị trí đích
        let targetPosId = ass.position_id
        let targetPosCode = ass.position?.code || ''
        const manual = manualEdits[ass.id]
        if (manual) {
            const foundPos = allPositions.find(p => p.code?.toLowerCase() === manual.position_code.trim().toLowerCase())
            if (foundPos) {
                targetPosId = foundPos.id
                targetPosCode = foundPos.code
            } else {
                return null // Không tìm thấy mã vị trí nhập tay
            }
        }

        // Vị trí đích không được đang chứa một lô khác
        const targetPos = allPositions.find(p => p.id === targetPosId)
        if (targetPos?.lot_id && targetPos.lot_id !== perfectMatch.id) {
            return null // Vị trí đã có lô khác chiếm giữ
        }

        return {
            ass,
            lot: perfectMatch,
            targetPosId,
            targetPosCode,
            manual
        }
    }

    // Số lượng yêu cầu hợp lệ có thể duyệt nhanh tự động (chính xác ngày, chưa có vị trí, vị trí trống)
    const validBulkCount = useMemo(() => {
        let count = 0
        const seenLots = new Set<string>()
        const seenPositions = new Set<string>()

        pendingList.forEach(ass => {
            const cand = getApprovedCandidate(ass, false)
            if (!cand) return
            if (seenLots.has(cand.lot.id) || seenPositions.has(cand.targetPosId)) return
            seenLots.add(cand.lot.id)
            seenPositions.add(cand.targetPosId)
            count++
        })
        return count
    }, [pendingList, lotsInDay, manualEdits, showOnlyUnassigned, allPositions])

    // Duyệt các yêu cầu đã chọn qua checkbox
    const handleBulkApprove = async () => {
        if (!profile) {
            showToast('Vui lòng đăng nhập để thực hiện tác vụ này', 'error')
            return
        }
        const targetIds = Array.from(selectedIds)
        if (targetIds.length === 0) {
            showToast('Chưa chọn yêu cầu nào để duyệt', 'error')
            return
        }

        const selectedAsses = pendingList.filter(a => selectedIds.has(a.id))
        const candidates: { ass: PendingAssignment, lot: Lot, targetPosId: string, targetPosCode: string, manual: any }[] = []
        const seenLots = new Set<string>()
        const seenPositions = new Set<string>()

        for (const ass of selectedAsses) {
            const cand = getApprovedCandidate(ass, true) // Cho phép chuyển vị trí nếu user đã chủ động tích chọn
            if (cand && !seenLots.has(cand.lot.id) && !seenPositions.has(cand.targetPosId)) {
                seenLots.add(cand.lot.id)
                seenPositions.add(cand.targetPosId)
                candidates.push(cand)
            }
        }

        const ambiguousCount = selectedAsses.length - candidates.length

        if (candidates.length === 0) {
            showToast(
                `Không thể duyệt tự động: Các yêu cầu đã chọn (${selectedAsses.length}) bị trùng nhiều lô, sai ngày SX hoặc vị trí bị chiếm. Vui lòng bấm Duyệt trên từng thẻ!`,
                'error'
            )
            return
        }

        let confirmMsg = `Duyệt ${candidates.length} yêu cầu gán vị trí đã chọn?`
        if (ambiguousCount > 0) {
            confirmMsg = `Trong ${selectedAsses.length} yêu cầu đã chọn:\n• ${candidates.length} yêu cầu hợp lệ (đúng ngày SX, đúng STT, vị trí trống).\n• ${ambiguousCount} yêu cầu bị trùng STT/khác ngày/vị trí bận (cần duyệt thủ công).\n\nBạn có muốn duyệt ${candidates.length} yêu cầu hợp lệ này không?`
        }

        const confirmed = await showConfirm(confirmMsg)
        if (!confirmed) return

        setActionLoading('bulk-approve')
        try {
            let successCount = 0
            const processedAssIds: string[] = []
            const updatedPositionsMap = new Map<string, string | null>()
            const updatedLotsMap = new Map<string, { id: string, code: string }[]>()

            // Chạy song song từng đợt 4 yêu cầu để tăng tốc gấp 4-5 lần
            const chunkSize = 4
            for (let i = 0; i < candidates.length; i += chunkSize) {
                const chunk = candidates.slice(i, i + chunkSize)
                await Promise.all(chunk.map(async ({ ass, lot, targetPosId, targetPosCode, manual }) => {
                    try {
                        if (manual) {
                            await (supabase.from('pending_assignments') as any)
                                .update({ position_id: targetPosId, lot_stt: manual.lot_stt })
                                .eq('id', ass.id)
                        }

                        // Gỡ khỏi các vị trí cũ của lô này nếu có
                        const { data: currentPosData } = await (supabase.from('positions') as any)
                            .select('id, code')
                            .eq('lot_id', lot.id)

                        const otherPlacements = (currentPosData || []).filter((p: any) => p.id !== targetPosId)
                        for (const oldPos of otherPlacements) {
                            await (supabase.from('positions') as any).update({ lot_id: null }).eq('id', oldPos.id)
                            updatedPositionsMap.set(oldPos.id, null)
                            await logActivity({
                                supabase,
                                tableName: 'positions',
                                recordId: oldPos.id,
                                action: 'UPDATE',
                                oldData: { lot_id: lot.id },
                                newData: { lot_id: null },
                                systemCode: currentSystem?.code || ''
                            })
                        }

                        // Gán vào vị trí đích
                        await (supabase.from('positions') as any).update({ lot_id: lot.id }).eq('id', targetPosId)
                        updatedPositionsMap.set(targetPosId, lot.id)
                        await logActivity({
                            supabase,
                            tableName: 'positions',
                            recordId: targetPosId,
                            action: 'UPDATE',
                            oldData: { lot_id: null },
                            newData: { lot_id: lot.id },
                            systemCode: currentSystem?.code || ''
                        })

                        const isMove = otherPlacements.length > 0
                        const oldPosCodes = otherPlacements.map((p: any) => p.code).join(', ')
                        const finalStatus = isMove ? `approved:move:${oldPosCodes}:${lot.id}` : `approved:new:${lot.id}`

                        await (supabase.from('pending_assignments') as any).update({
                            status: finalStatus,
                            position_id: targetPosId,
                            lot_stt: manual?.lot_stt || ass.lot_stt
                        }).eq('id', ass.id)

                        processedAssIds.push(ass.id)
                        updatedLotsMap.set(lot.id, [{ id: targetPosId, code: targetPosCode }])
                        successCount++
                    } catch (itemErr) {
                        console.error('Lỗi khi duyệt yêu cầu ID ' + ass.id, itemErr)
                    }
                }))
            }

            // OPTIMISTIC STATE UPDATE
            const processedSet = new Set(processedAssIds)
            setPendingList(prev => prev.filter(p => !processedSet.has(p.id)))
            setSelectedIds(prev => {
                const next = new Set(prev)
                processedAssIds.forEach(id => next.delete(id))
                return next
            })
            setAllPositions(prev => prev.map(p => {
                if (updatedPositionsMap.has(p.id)) {
                    return { ...p, lot_id: updatedPositionsMap.get(p.id) }
                }
                return p
            }))
            setLotsInDay(prev => prev.map(l => {
                if (updatedLotsMap.has(l.id)) {
                    return { ...l, positions: updatedLotsMap.get(l.id) }
                }
                return l
            }))

            showToast(`Đã duyệt thành công ${successCount}/${candidates.length} yêu cầu!`, successCount > 0 ? 'success' : 'error')
            fetchData(true)
        } catch (e: any) {
            console.error('[BULK APPROVE] Error:', e)
            showToast('Lỗi khi duyệt hàng loạt: ' + (e.message || 'Không xác định'), 'error')
        } finally {
            setActionLoading(null)
        }
    }

    // Duyệt nhanh tất cả các yêu cầu hợp lệ
    const handleApproveAll = async () => {
        if (!profile) {
            showToast('Vui lòng đăng nhập để thực hiện tác vụ này', 'error')
            return
        }

        const candidates: { ass: PendingAssignment, lot: Lot, targetPosId: string, targetPosCode: string, manual: any }[] = []
        const seenLots = new Set<string>()
        const seenPositions = new Set<string>()

        pendingList.forEach(ass => {
            const cand = getApprovedCandidate(ass, false)
            if (cand && !seenLots.has(cand.lot.id) && !seenPositions.has(cand.targetPosId)) {
                seenLots.add(cand.lot.id)
                seenPositions.add(cand.targetPosId)
                candidates.push(cand)
            }
        })

        if (candidates.length === 0) {
            showToast('Không có yêu cầu hợp lệ nào đủ điều kiện duyệt tự động.', 'info')
            return
        }

        const confirmed = await showConfirm(`Duyệt tự động ${candidates.length} yêu cầu hợp lệ này?`)
        if (!confirmed) return

        setActionLoading('bulk')
        try {
            let successCount = 0
            const processedAssIds: string[] = []
            const updatedPositionsMap = new Map<string, string | null>()
            const updatedLotsMap = new Map<string, { id: string, code: string }[]>()

            const chunkSize = 4
            for (let i = 0; i < candidates.length; i += chunkSize) {
                const chunk = candidates.slice(i, i + chunkSize)
                await Promise.all(chunk.map(async ({ ass, lot, targetPosId, targetPosCode, manual }) => {
                    try {
                        if (manual) {
                            await (supabase.from('pending_assignments') as any)
                                .update({ position_id: targetPosId, lot_stt: manual.lot_stt })
                                .eq('id', ass.id)
                        }

                        const { data: currentPosData } = await (supabase.from('positions') as any)
                            .select('id, code')
                            .eq('lot_id', lot.id)

                        const otherPlacements = (currentPosData || []).filter((p: any) => p.id !== targetPosId)
                        for (const oldPos of otherPlacements) {
                            await (supabase.from('positions') as any).update({ lot_id: null }).eq('id', oldPos.id)
                            updatedPositionsMap.set(oldPos.id, null)
                            await logActivity({
                                supabase,
                                tableName: 'positions',
                                recordId: oldPos.id,
                                action: 'UPDATE',
                                oldData: { lot_id: lot.id },
                                newData: { lot_id: null },
                                systemCode: currentSystem?.code || ''
                            })
                        }

                        await (supabase.from('positions') as any).update({ lot_id: lot.id }).eq('id', targetPosId)
                        updatedPositionsMap.set(targetPosId, lot.id)
                        await logActivity({
                            supabase,
                            tableName: 'positions',
                            recordId: targetPosId,
                            action: 'UPDATE',
                            oldData: { lot_id: null },
                            newData: { lot_id: lot.id },
                            systemCode: currentSystem?.code || ''
                        })

                        const isMove = otherPlacements.length > 0
                        const oldPosCodes = otherPlacements.map((p: any) => p.code).join(', ')
                        const finalStatus = isMove ? `approved:move:${oldPosCodes}:${lot.id}` : `approved:new:${lot.id}`

                        await (supabase.from('pending_assignments') as any).update({
                            status: finalStatus,
                            position_id: targetPosId,
                            lot_stt: manual?.lot_stt || ass.lot_stt
                        }).eq('id', ass.id)

                        processedAssIds.push(ass.id)
                        updatedLotsMap.set(lot.id, [{ id: targetPosId, code: targetPosCode }])
                        successCount++
                    } catch (itemErr) {
                        console.error('Lỗi khi duyệt nhanh yêu cầu ID ' + ass.id, itemErr)
                    }
                }))
            }

            const processedSet = new Set(processedAssIds)
            setPendingList(prev => prev.filter(p => !processedSet.has(p.id)))
            setSelectedIds(prev => {
                const next = new Set(prev)
                processedAssIds.forEach(id => next.delete(id))
                return next
            })
            setAllPositions(prev => prev.map(p => {
                if (updatedPositionsMap.has(p.id)) {
                    return { ...p, lot_id: updatedPositionsMap.get(p.id) }
                }
                return p
            }))
            setLotsInDay(prev => prev.map(l => {
                if (updatedLotsMap.has(l.id)) {
                    return { ...l, positions: updatedLotsMap.get(l.id) }
                }
                return l
            }))

            showToast(`Đã duyệt thành công ${successCount}/${candidates.length} yêu cầu!`, successCount > 0 ? 'success' : 'error')
            fetchData(true)
        } catch (e: any) {
            console.error('[HANDLE APPROVE ALL] Error:', e)
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
                <div className="flex items-center gap-3 flex-wrap">
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
                    {unmatchedPendingList.length > 0 && (
                        <button 
                            onClick={() => handleBulkDelete(unmatchedPendingList.map(a => a.id))} 
                            disabled={!!actionLoading} 
                            title="Xóa vĩnh viễn tất cả các yêu cầu không tìm thấy lô hàng"
                            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 font-black text-xs uppercase rounded-xl flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                        >
                            {actionLoading === 'bulk-delete' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            Xóa mục lỗi ({unmatchedPendingList.length})
                        </button>
                    )}
                    <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-2">
                        <select 
                            value={dateFilterType}
                            onChange={(e) => setDateFilterType(e.target.value as 'created_at' | 'production_date')}
                            className="bg-transparent border-none outline-none font-black text-xs text-zinc-700 dark:text-zinc-300 pr-2 cursor-pointer border-r border-zinc-200 dark:border-zinc-800 focus:ring-0"
                        >
                            <option value="created_at" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Ngày quét</option>
                            <option value="production_date" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">Ngày sản xuất</option>
                        </select>
                        <Calendar size={16} className="text-zinc-400" />
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent border-none outline-none font-bold text-xs text-zinc-900 dark:text-white" />
                        <span className="text-zinc-300">→</span>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent border-none outline-none font-bold text-xs text-zinc-900 dark:text-white" />
                    </div>
                    {/* Nút Kiểm tra & Dọn dẹp vị trí bị kẹt */}
                    <button 
                        onClick={() => {
                            if (orphanedPositions.length > 0) {
                                setShowOrphanedModal(true)
                            } else {
                                checkOrphanedPositions(false)
                            }
                        }}
                        disabled={checkingOrphans}
                        title="Kiểm tra và giải phóng vị trí bị mắc kẹt dữ liệu do lô hàng bị xóa"
                        className={`px-4 py-2.5 rounded-[12px] text-xs font-black uppercase flex items-center gap-2 border transition-all relative ${
                            orphanedPositions.length > 0 
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30' 
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                    >
                        {checkingOrphans ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <AlertTriangle size={16} className={orphanedPositions.length > 0 ? "text-red-500" : "text-zinc-400"} />
                        )}
                        Vị trí kẹt
                        {orphanedPositions.length > 0 && (
                            <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-650 text-white rounded-full flex items-center justify-center text-[9px] font-black tracking-normal shadow-md">
                                {orphanedPositions.length}
                            </span>
                        )}
                    </button>
                    <button onClick={() => fetchData(false)} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                        <RefreshCcw size={18} className={`${loading ? 'animate-spin' : ''} text-zinc-600 dark:text-zinc-400`} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <PendingAssignmentsList
                        loading={loading}
                        pendingList={pendingList}
                        filteredPendingList={filteredPendingList}
                        unmatchedPendingList={unmatchedPendingList}
                        lotsInDay={lotsInDay}
                        allPositions={allPositions}
                        pendingSearchTerm={pendingSearchTerm}
                        setPendingSearchTerm={setPendingSearchTerm}
                        showOnlyUnassigned={showOnlyUnassigned}
                        setShowOnlyUnassigned={setShowOnlyUnassigned}
                        selectedIds={selectedIds}
                        actionLoading={actionLoading}
                        manualEdits={manualEdits}
                        getLotPositions={getLotPositions}
                        toggleSelect={toggleSelect}
                        handleSelectAll={handleSelectAll}
                        handleSelectUnmatchedOnly={handleSelectUnmatchedOnly}
                        handleClearSelection={handleClearSelection}
                        handleBulkApprove={handleBulkApprove}
                        handleBulkReject={handleBulkReject}
                        handleBulkDelete={handleBulkDelete}
                        handleApprove={handleApprove}
                        handleReject={handleReject}
                        handleDeleteAssignment={handleDeleteAssignment}
                        startEdit={startEdit}
                    />

                    <AssignmentHistorySection
                        showHistory={showHistory}
                        setShowHistory={setShowHistory}
                        showDebugBox={showDebugBox}
                        setShowDebugBox={setShowDebugBox}
                        debugInfo={debugInfo}
                        historyList={historyList}
                        filteredHistory={filteredHistory}
                        historyLoading={historyLoading}
                        dateFilterType={dateFilterType}
                        setDateFilterType={setDateFilterType}
                        historyDateFrom={historyDateFrom}
                        setHistoryDateFrom={setHistoryDateFrom}
                        historyDateTo={historyDateTo}
                        setHistoryDateTo={setHistoryDateTo}
                        historySearchTerm={historySearchTerm}
                        setHistorySearchTerm={setHistorySearchTerm}
                        historyProdOrderSearch={historyProdOrderSearch}
                        setHistoryProdOrderSearch={setHistoryProdOrderSearch}
                        historyProdLotSearch={historyProdLotSearch}
                        setHistoryProdLotSearch={setHistoryProdLotSearch}
                        fetchHistory={fetchHistory}
                    />
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
                                .filter(l => {
                                    if (!lotSearchTerm) return true
                                    const term = lotSearchTerm.toLowerCase()
                                    return l.code.toLowerCase().includes(term) ||
                                        l.production_code?.toLowerCase().includes(term) ||
                                        l.tags?.some(t => t.toLowerCase().includes(term))
                                })
                                .filter(l => showOnlyUnassigned ? !l.positions?.[0] : true)
                                .map(lot => (
                                <div key={lot.id} className="p-4 bg-zinc-50/50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-900 transition-all flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-900 rounded-xl flex items-center justify-center font-black text-xs text-zinc-900 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 shadow-sm group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">#{decodeSTT(lot.daily_seq)}</div>
                                        <div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{lot.code}</span>
                                                {lot.production_code && (
                                                    <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 rounded text-[8px] font-bold" title="Mã phụ sản xuất">
                                                        {lot.production_code}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[9px] text-zinc-500 dark:text-zinc-500 font-bold uppercase tracking-wider">{safeFormatDate(lot.inbound_date || lot.created_at)}</div>
                                            {lot.tags && lot.tags.length > 0 && (
                                                <div className="mt-1">
                                                    <TagDisplay
                                                        tags={lot.tags}
                                                        variant="compact"
                                                        placeholderMap={{ '@': lot.product_skus?.[0] || '' }}
                                                    />
                                                </div>
                                            )}
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

            <AssignmentModals
                editingId={editingId}
                setEditingId={setEditingId}
                pendingList={pendingList}
                editValues={editValues}
                setEditValues={setEditValues}
                allPositions={allPositions}
                handleSaveEdit={handleSaveEdit}
                showOrphanedModal={showOrphanedModal}
                setShowOrphanedModal={setShowOrphanedModal}
                orphanedPositions={orphanedPositions}
                actionLoading={actionLoading}
                handleReleaseOrphanedPositions={handleReleaseOrphanedPositions}
            />
        </div>
    )
}
