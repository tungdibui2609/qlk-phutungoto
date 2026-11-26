'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
    X,
    Search,
    Layers,
    Zap,
    Truck,
    RefreshCw,
    Plus,
    Trash2,
    Check,
    Edit3,
    ExternalLink,
    MapPin,
    Calendar,
    Package,
    AlertTriangle,
    CheckCircle2,
    ArrowRightCircle,
    Loader2,
    Filter,
    Boxes
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { calculateSearchScore, matchPalletSearch, matchSearch } from '@/lib/searchUtils'
import {
    fetchAvailableLotsForStaging,
    pushAllocationsToExportTask,
    recalculatePlanAggregates,
    syncExportedQuantitiesFromTasks
} from '@/lib/productionPlanService'
import {
    AllocationStatus,
    AvailableLotStockItem,
    PLAN_MODE_CONFIG,
    PLAN_STATUS_CONFIG,
    ProductionPlan,
    ProductionPlanAllocation,
    ProductionPlanInput
} from './types'

export interface StagingAllocationModalProps {
    isOpen: boolean
    onClose: () => void
    plan: ProductionPlan | null
    onUpdated: () => void
}

const ALLOCATION_STATUS_CONFIG: Record<
    AllocationStatus,
    { label: string; badgeClass: string }
> = {
    RESERVED: {
        label: 'Đã giữ chỗ',
        badgeClass:
            'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800'
    },
    STAGED: {
        label: 'Đã đẩy Lệnh xuất / Hạ sảnh',
        badgeClass:
            'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800'
    },
    PARTIAL_ISSUED: {
        label: 'Đang rút dở',
        badgeClass:
            'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
    },
    ISSUED: {
        label: 'Đã cấp hết ra chuyền',
        badgeClass:
            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
    },
    RETURNED: {
        label: 'Có trả dư',
        badgeClass:
            'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800'
    },
    RELEASED: {
        label: 'Đã hủy giữ chỗ',
        badgeClass:
            'bg-stone-100 text-stone-500 border-stone-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
    }
}

function formatQty(val: number | null | undefined): string {
    const n = Number(val) || 0
    return n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
}

function formatDateVN(iso: string | null | undefined): string {
    if (!iso) return '---'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '---'
    return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    })
}

function calcStorageDays(inboundIso: string | null | undefined, createdAtIso: string): number {
    const ref = inboundIso || createdAtIso
    const ms = new Date(ref).getTime()
    if (Number.isNaN(ms)) return 0
    return Math.max(0, Math.floor((Date.now() - ms) / 86400000))
}

interface SearchSuggestionItem {
    lotItem: AvailableLotStockItem
    fifoRank: number
    matchedAlias?: string
    score: number
}

export function StagingAllocationModal({
    isOpen,
    onClose,
    plan,
    onUpdated
}: StagingAllocationModalProps) {
    const { user, profile } = useUser()
    const { showToast, showConfirm } = useToast()

    const [loading, setLoading] = useState(false)
    const [busyAction, setBusyAction] = useState<string | null>(null)

    const [availableLots, setAvailableLots] = useState<AvailableLotStockItem[]>([])
    const [inputs, setInputs] = useState<ProductionPlanInput[]>([])
    const [allocations, setAllocations] = useState<ProductionPlanAllocation[]>([])
    const [livePlanStatus, setLivePlanStatus] = useState<ProductionPlan['status']>('DRAFT')
    const [liveActualStartAt, setLiveActualStartAt] = useState<string | null>(null)

    // Bộ lọc tab nguyên liệu: 'ALL_PLAN' | 'ALL_WAREHOUSE' | input.id
    const [selectedTab, setSelectedTab] = useState<string>('ALL_PLAN')
    const [onlyAvailableStock, setOnlyAvailableStock] = useState<boolean>(true)
    const [showReleasedAllocs, setShowReleasedAllocs] = useState<boolean>(false)

    // Tìm kiếm thông minh + Autocomplete gợi ý
    const [searchQuery, setSearchQuery] = useState('')
    const [isSuggestOpen, setIsSuggestOpen] = useState(false)
    const [highlightIdx, setHighlightIdx] = useState(0)
    const [pinnedLotItemId, setPinnedLotItemId] = useState<string | null>(null)
    const searchWrapRef = useRef<HTMLDivElement>(null)

    // Số lượng muốn soạn trên từng dòng LOT khả dụng
    const [draftQtyMap, setDraftQtyMap] = useState<Record<string, string>>({})
    // Số lượng mục tiêu khi bấm Tự động FIFO cho chế độ xuất mở (is_open_quantity)
    const [openModeAutoTargetKg, setOpenModeAutoTargetKg] = useState<string>('')

    // Chỉnh sửa số lượng giữ trên bảng đã phân bổ
    const [editingAllocId, setEditingAllocId] = useState<string | null>(null)
    const [editingAllocQty, setEditingAllocQty] = useState<string>('')

    // Banner kết quả vừa tạo Lệnh xuất kho
    const [lastCreatedTask, setLastCreatedTask] = useState<{ taskId: string; taskCode: string } | null>(null)

    const isReadOnly = livePlanStatus === 'COMPLETED' || livePlanStatus === 'CANCELED'

    // Đóng dropdown gợi ý khi click ra ngoài
    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
                setIsSuggestOpen(false)
            }
        }
        document.addEventListener('mousedown', handleOutside)
        return () => document.removeEventListener('mousedown', handleOutside)
    }, [])

    const loadModalData = useCallback(
        async (keepTab = true) => {
            if (!plan) return
            setLoading(true)
            try {
                const [lotsData, inputsRes, allocsRes, planRowRes] = await Promise.all([
                    fetchAvailableLotsForStaging(plan.system_code),
                    (supabase.from('production_plan_inputs' as any) as any)
                        .select(
                            '*, products(id, name, sku, unit, aliases, internal_code, internal_name, weight_kg)'
                        )
                        .eq('plan_id', plan.id)
                        .eq('system_code', plan.system_code)
                        .order('sort_order', { ascending: true }),
                    (supabase.from('production_plan_allocations' as any) as any)
                        .select(
                            '*, products(id, name, sku, unit, aliases, internal_code), export_tasks(id, code, status)'
                        )
                        .eq('plan_id', plan.id)
                        .eq('system_code', plan.system_code)
                        .order('allocated_at', { ascending: true }),
                    (supabase.from('production_plans' as any) as any)
                        .select('id, status, actual_start_at')
                        .eq('id', plan.id)
                        .eq('system_code', plan.system_code)
                        .maybeSingle()
                ])

                if (inputsRes.error) throw inputsRes.error
                if (allocsRes.error) throw allocsRes.error

                const nextInputs: ProductionPlanInput[] =
                    inputsRes.data || plan.production_plan_inputs || []
                const nextAllocs: ProductionPlanAllocation[] = allocsRes.data || []

                setAvailableLots(lotsData)
                setInputs(nextInputs)
                setAllocations(nextAllocs)
                setLivePlanStatus(planRowRes.data?.status || plan.status)
                setLiveActualStartAt(
                    planRowRes.data?.actual_start_at ?? plan.actual_start_at ?? null
                )

                if (!keepTab) {
                    if (nextInputs.length > 0) {
                        const firstIncomplete = nextInputs.find(inp => {
                            if (inp.is_open_quantity) return true
                            return (Number(inp.allocated_quantity) || 0) < (Number(inp.required_quantity) || 0)
                        })
                        setSelectedTab((firstIncomplete || nextInputs[0]).id)
                    } else {
                        setSelectedTab('ALL_WAREHOUSE')
                    }
                }
            } catch (err: any) {
                console.error('Lỗi tải dữ liệu soạn hàng tồn kho:', err)
                showToast(err?.message || 'Không thể tải dữ liệu tồn kho LOT.', 'error')
            } finally {
                setLoading(false)
            }
        },
        [plan, showToast]
    )

    useEffect(() => {
        if (isOpen && plan) {
            setLastCreatedTask(null)
            setEditingAllocId(null)
            setSearchQuery('')
            setPinnedLotItemId(null)
            setDraftQtyMap({})
            setLivePlanStatus(plan.status)
            setLiveActualStartAt(plan.actual_start_at ?? null)
            void loadModalData(false)
        }
    }, [isOpen, plan?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    // Dòng nguyên liệu đang được chọn trên tab
    const selectedInput = useMemo(
        () => inputs.find(i => i.id === selectedTab) || null,
        [inputs, selectedTab]
    )

    // Tính số lượng đang được giữ bởi CHÍNH kế hoạch này trên từng (lot_id + product_id)
    const heldByThisPlanMap = useMemo(() => {
        const map = new Map<string, number>()
        for (const a of allocations) {
            if (!['RESERVED', 'STAGED', 'PARTIAL_ISSUED'].includes(a.status)) continue
            const key = `${a.lot_id}_${a.product_id}`
            const hold = Math.max(0, (Number(a.allocated_quantity) || 0) - (Number(a.issued_quantity) || 0))
            map.set(key, (map.get(key) || 0) + hold)
        }
        return map
    }, [allocations])

    // Thống kê tiến độ soạn cho từng dòng nguyên liệu đầu vào (tính trực tiếp từ allocations hiệu lực để luôn tức thời)
    const inputProgressMap = useMemo(() => {
        const map = new Map<
            string,
            {
                requiredQty: number
                allocatedQty: number
                remainingQty: number
                requiredKg: number
                allocatedKg: number
                remainingKg: number
                percent: number
            }
        >()

        const activeAllocs = allocations.filter(a => a.status !== 'RELEASED')

        for (const inp of inputs) {
            const inpWeight = Number(inp.weight_per_unit_kg) > 0 ? Number(inp.weight_per_unit_kg) : 1
            const reqQty = Number(inp.required_quantity) || 0
            const reqKg = reqQty * inpWeight

            const matchedAllocs = activeAllocs.filter(
                a => a.plan_input_id === inp.id || (!a.plan_input_id && a.product_id === inp.product_id)
            )

            let allocKg = 0
            let allocInInputUnit = 0
            for (const a of matchedAllocs) {
                const aQty = Number(a.allocated_quantity) || 0
                const aW = Number(a.weight_per_unit_kg) > 0 ? Number(a.weight_per_unit_kg) : 1
                const rowKg = aQty * aW
                allocKg += rowKg
                if (a.unit.trim().toLowerCase() === inp.unit.trim().toLowerCase()) {
                    allocInInputUnit += aQty
                } else {
                    allocInInputUnit += inpWeight > 0 ? rowKg / inpWeight : aQty
                }
            }

            const remQty = inp.is_open_quantity ? 0 : Math.max(0, Math.round((reqQty - allocInInputUnit) * 1000) / 1000)
            const remKg = inp.is_open_quantity ? 0 : Math.max(0, Math.round((reqKg - allocKg) * 100) / 100)
            const pct =
                inp.is_open_quantity
                    ? allocKg > 0
                        ? 100
                        : 0
                    : reqKg > 0
                      ? Math.min(100, Math.round((allocKg / reqKg) * 100))
                      : 0

            map.set(inp.id, {
                requiredQty: reqQty,
                allocatedQty: Math.round(allocInInputUnit * 1000) / 1000,
                remainingQty: remQty,
                requiredKg: Math.round(reqKg * 100) / 100,
                allocatedKg: Math.round(allocKg * 100) / 100,
                remainingKg: remKg,
                percent: pct
            })
        }

        return map
    }, [inputs, allocations])

    const selectedProgress = selectedInput ? inputProgressMap.get(selectedInput.id) || null : null

    // Thứ hạng FIFO cho từng sản phẩm (LOT cũ nhất của sản phẩm đó = FIFO #1, #2...)
    const fifoRankByLotItemId = useMemo(() => {
        const rankMap = new Map<string, number>()
        const counterByProduct = new Map<string, number>()
        for (const item of availableLots) {
            const nextRank = (counterByProduct.get(item.productId) || 0) + 1
            counterByProduct.set(item.productId, nextRank)
            rankMap.set(item.lotItemId, nextRank)
        }
        return rankMap
    }, [availableLots])

    // Danh sách LOT cơ sở theo Tab đang chọn (trước khi gõ ô tìm kiếm)
    const tabFilteredLots = useMemo(() => {
        const planProductIds = new Set(inputs.map(i => i.product_id))
        return availableLots.filter(item => {
            if (onlyAvailableStock && item.availableQuantity <= 0) return false
            if (selectedInput) {
                return item.productId === selectedInput.product_id
            }
            if (selectedTab === 'ALL_PLAN' && planProductIds.size > 0) {
                return planProductIds.has(item.productId)
            }
            return true
        })
    }, [availableLots, inputs, onlyAvailableStock, selectedInput, selectedTab])

    // Helper khớp tìm kiếm không dấu theo aliases, SKU, mã Pallet, mã Lot SX gốc, vị trí kệ
    const matchesLotQuery = useCallback((item: AvailableLotStockItem, term: string): boolean => {
        const q = term.trim()
        if (!q) return true

        const searchObj = {
            name: item.productName,
            sku: item.sku,
            code: item.lotCode,
            internal_code: item.internalCode,
            aliases: item.aliases,
            batch_code: item.productionCode || item.batchCode,
            label: item.positionCode,
            description: `${item.lotCode} ${item.productionCode || ''} ${item.positionCode} ${item.warehouseName || ''}`
        }

        if (matchSearch(searchObj, q)) return true

        return matchPalletSearch(
            {
                lot_code: `${item.lotCode} ${item.productionCode || ''}`,
                product_name: item.productName,
                sku: item.sku,
                aliases: item.aliases,
                location_code: item.positionCode,
                notes: item.warehouseName
            },
            q
        )
    }, [])

    // Dropdown gợi ý Autocomplete bên dưới ô tìm kiếm
    const searchSuggestions = useMemo<SearchSuggestionItem[]>(() => {
        const term = searchQuery.trim()
        const source = tabFilteredLots

        if (!term) {
            return source.slice(0, 10).map(lotItem => {
                const firstAlias = lotItem.aliases
                    ? String(lotItem.aliases)
                          .split(/[,;\n]/)
                          .map(s => s.trim())
                          .filter(Boolean)[0]
                    : undefined
                return {
                    lotItem,
                    fifoRank: fifoRankByLotItemId.get(lotItem.lotItemId) || 1,
                    matchedAlias: firstAlias,
                    score: 1
                }
            })
        }

        const results: SearchSuggestionItem[] = []
        for (const lotItem of source) {
            if (!matchesLotQuery(lotItem, term)) continue
            const score = calculateSearchScore(
                {
                    name: lotItem.productName,
                    sku: lotItem.sku,
                    code: lotItem.lotCode,
                    internal_code: lotItem.internalCode,
                    aliases: lotItem.aliases,
                    label: lotItem.productionCode || lotItem.positionCode
                },
                term,
                { stt: lotItem.positionCode }
            )

            let matchedAlias: string | undefined
            if (lotItem.aliases) {
                const aliasList = String(lotItem.aliases)
                    .split(/[,;\n]/)
                    .map(s => s.trim())
                    .filter(Boolean)
                matchedAlias = aliasList.find(a => matchSearch(a, term)) || aliasList[0]
            }

            results.push({
                lotItem,
                fifoRank: fifoRankByLotItemId.get(lotItem.lotItemId) || 1,
                matchedAlias,
                score: Math.max(1, score)
            })
        }

        return results
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score
                return a.fifoRank - b.fifoRank
            })
            .slice(0, 12)
    }, [tabFilteredLots, searchQuery, fifoRankByLotItemId, matchesLotQuery])

    // Danh sách LOT hiển thị trên bảng bên trái (vẫn giữ chuẩn thứ tự ưu tiên FIFO)
    const displayedLots = useMemo(() => {
        if (pinnedLotItemId) {
            const pinned = tabFilteredLots.filter(l => l.lotItemId === pinnedLotItemId)
            if (pinned.length > 0) return pinned
        }
        const term = searchQuery.trim()
        if (!term) return tabFilteredLots
        return tabFilteredLots.filter(item => matchesLotQuery(item, term))
    }, [tabFilteredLots, searchQuery, pinnedLotItemId, matchesLotQuery])

    // Giá trị mặc định cho ô số lượng muốn soạn của 1 LOT: min(khả dụng, lượng còn thiếu của input tương ứng) hoặc toàn bộ pallet
    const getSuggestedQtyForLot = useCallback(
        (item: AvailableLotStockItem): number => {
            if (item.availableQuantity <= 0) return 0
            const matchedInp =
                (selectedInput && selectedInput.product_id === item.productId ? selectedInput : null) ||
                inputs.find(i => i.product_id === item.productId) ||
                null

            if (matchedInp && !matchedInp.is_open_quantity) {
                const prog = inputProgressMap.get(matchedInp.id)
                if (prog && prog.remainingKg > 0) {
                    const lotUnitWeight = item.weightPerUnitKg > 0 ? item.weightPerUnitKg : 1
                    const neededInLotUnit =
                        matchedInp.unit.trim().toLowerCase() === item.unit.trim().toLowerCase()
                            ? prog.remainingQty
                            : Math.round((prog.remainingKg / lotUnitWeight) * 1000) / 1000
                    if (neededInLotUnit > 0) {
                        return Math.min(item.availableQuantity, neededInLotUnit)
                    }
                }
            }
            return item.availableQuantity
        },
        [selectedInput, inputs, inputProgressMap]
    )

    const resolveDraftQtyValue = useCallback(
        (item: AvailableLotStockItem): string => {
            if (draftQtyMap[item.lotItemId] !== undefined) {
                return draftQtyMap[item.lotItemId]
            }
            const suggested = getSuggestedQtyForLot(item)
            return suggested > 0 ? String(suggested) : ''
        },
        [draftQtyMap, getSuggestedQtyForLot]
    )

    const resolveCurrentUserId = async (): Promise<string | null> => {
        if (user?.id) return user.id
        const { data } = await supabase.auth.getUser()
        return data.user?.id || null
    }

    // Thêm 1 LOT vào danh sách soạn (production_plan_allocations)
    const handleAllocateSingleLot = async (item: AvailableLotStockItem) => {
        if (!plan || isReadOnly) return
        const rawStr = resolveDraftQtyValue(item)
        const qty = Number(rawStr)

        if (!Number.isFinite(qty) || qty <= 0) {
            showToast('Vui lòng nhập số lượng soạn lớn hơn 0.', 'warning')
            return
        }
        if (qty > item.availableQuantity + 0.0001) {
            showToast(
                `Số lượng vượt quá mức khả dụng của Pallet ${item.lotCode} (tối đa ${formatQty(item.availableQuantity)} ${item.unit}).`,
                'warning'
            )
            return
        }

        // Kiểm tra cảnh báo nhẹ nếu bỏ qua lô FIFO cũ hơn còn khả dụng của cùng sản phẩm
        const currentRank = fifoRankByLotItemId.get(item.lotItemId) || 1
        const olderAvailableLot = availableLots.find(
            other =>
                other.productId === item.productId &&
                other.availableQuantity > 0 &&
                (fifoRankByLotItemId.get(other.lotItemId) || 999999) < currentRank
        )
        if (olderAvailableLot) {
            const ok = await showConfirm(
                `Pallet ${item.lotCode} là lô FIFO #${currentRank}, trong kho vẫn còn Pallet cũ hơn (${olderAvailableLot.lotCode} tại ${olderAvailableLot.positionCode}). Bạn vẫn muốn chọn lô này?`
            )
            if (!ok) return
        }

        setBusyAction(`add_${item.lotItemId}`)
        try {
            const uid = await resolveCurrentUserId()
            const matchedInp =
                (selectedInput && selectedInput.product_id === item.productId ? selectedInput : null) ||
                inputs.find(i => i.product_id === item.productId) ||
                null

            // Nếu đã có dòng RESERVED chưa gắn lệnh xuất cho cùng lot_id + product_id thì cộng dồn gọn gàng
            const existingReserved = allocations.find(
                a =>
                    a.lot_id === item.lotId &&
                    a.product_id === item.productId &&
                    a.status === 'RESERVED' &&
                    !a.export_task_id
            )

            if (existingReserved) {
                const mergedQty =
                    Math.round(((Number(existingReserved.allocated_quantity) || 0) + qty) * 1000) / 1000
                const { error } = await (supabase.from('production_plan_allocations' as any) as any)
                    .update({
                        allocated_quantity: mergedQty,
                        position_id: item.positionId,
                        position_code: item.positionCode
                    })
                    .eq('id', existingReserved.id)
                if (error) throw error
            } else {
                const { error } = await (supabase.from('production_plan_allocations' as any) as any).insert({
                    system_code: plan.system_code,
                    plan_id: plan.id,
                    plan_input_id: matchedInp?.id || null,
                    lot_id: item.lotId,
                    position_id: item.positionId || null,
                    product_id: item.productId,
                    lot_code: item.lotCode,
                    production_code: item.productionCode || null,
                    position_code: item.positionCode,
                    allocated_quantity: Math.round(qty * 1000) / 1000,
                    issued_quantity: 0,
                    returned_quantity: 0,
                    unit: item.unit,
                    weight_per_unit_kg: item.weightPerUnitKg > 0 ? item.weightPerUnitKg : 1,
                    status: 'RESERVED',
                    allocated_by: uid
                })
                if (error) throw error
            }

            if (livePlanStatus === 'DRAFT' || livePlanStatus === 'APPROVED') {
                await (supabase.from('production_plans' as any) as any)
                    .update({ status: 'STAGING', updated_at: new Date().toISOString() })
                    .eq('id', plan.id)
                setLivePlanStatus('STAGING')
            }

            await recalculatePlanAggregates(plan.id)

            // Xóa draft tay của dòng này để tự tính lại gợi ý phần còn thiếu
            setDraftQtyMap(prev => {
                const next = { ...prev }
                delete next[item.lotItemId]
                return next
            })

            showToast(
                `Đã giữ chỗ ${formatQty(qty)} ${item.unit} từ Pallet ${item.lotCode}.`,
                'success'
            )
            await loadModalData(true)
            onUpdated()
        } catch (err: any) {
            console.error('Lỗi giữ chỗ LOT:', err)
            showToast(err?.message || 'Không thể giữ chỗ LOT này.', 'error')
        } finally {
            setBusyAction(null)
        }
    }

    // Tự động chọn nhanh theo FIFO cho nguyên liệu đang chọn (hoặc tất cả nguyên liệu còn thiếu của kế hoạch)
    const handleAutoPickFIFO = async () => {
        if (!plan || isReadOnly) return

        // Danh sách các dòng nguyên liệu cần chạy FIFO
        const targetInputs: ProductionPlanInput[] = selectedInput
            ? [selectedInput]
            : inputs.filter(i => !i.is_open_quantity)

        if (targetInputs.length === 0) {
            showToast(
                'Hãy chọn một tab Nguyên liệu cụ thể để chạy Tự động chọn nhanh theo FIFO.',
                'warning'
            )
            return
        }

        setBusyAction('auto_fifo')
        try {
            const uid = await resolveCurrentUserId()
            let totalPickedPallets = 0
            let totalPickedKg = 0

            // Bản sao khả dụng tạm thời để không cấp trùng khi 2 dòng input dùng chung 1 mã hàng
            const remainingAvailByLotItem = new Map<string, number>()
            for (const l of availableLots) {
                remainingAvailByLotItem.set(l.lotItemId, l.availableQuantity)
            }

            const rowsToInsert: any[] = []
            const rowsToUpdate: Array<{ id: string; newQty: number; posId: string | null; posCode: string }> = []

            for (const inp of targetInputs) {
                const prog = inputProgressMap.get(inp.id)
                let neededKg = 0

                if (inp.is_open_quantity) {
                    const customKg = Number(openModeAutoTargetKg)
                    if (!Number.isFinite(customKg) || customKg <= 0) {
                        showToast(
                            'Chế độ xuất mở: Vui lòng nhập số Kg muốn soạn thêm theo FIFO ở ô kế bên nút.',
                            'warning'
                        )
                        setBusyAction(null)
                        return
                    }
                    neededKg = customKg
                } else {
                    neededKg = prog ? prog.remainingKg : 0
                }

                if (neededKg <= 0.0001) continue

                // availableLots đã được sắp xếp chuẩn FIFO từ fetchAvailableLotsForStaging
                const candidateLots = availableLots.filter(l => l.productId === inp.product_id)

                for (const lot of candidateLots) {
                    if (neededKg <= 0.0001) break
                    const avail = remainingAvailByLotItem.get(lot.lotItemId) || 0
                    if (avail <= 0) continue

                    const unitW = lot.weightPerUnitKg > 0 ? lot.weightPerUnitKg : 1
                    const neededInLotUnit =
                        inp.unit.trim().toLowerCase() === lot.unit.trim().toLowerCase() && !inp.is_open_quantity
                            ? Math.round((neededKg / (Number(inp.weight_per_unit_kg) || 1)) * 1000) / 1000
                            : Math.round((neededKg / unitW) * 1000) / 1000

                    const takeQty = Math.min(avail, Math.max(0, neededInLotUnit))
                    if (takeQty <= 0) continue

                    const takeKg = takeQty * unitW
                    remainingAvailByLotItem.set(lot.lotItemId, Math.max(0, avail - takeQty))
                    neededKg = Math.max(0, neededKg - takeKg)

                    const existingReserved = allocations.find(
                        a =>
                            a.lot_id === lot.lotId &&
                            a.product_id === lot.productId &&
                            a.status === 'RESERVED' &&
                            !a.export_task_id
                    )

                    if (existingReserved) {
                        const prevPlanned = rowsToUpdate.find(u => u.id === existingReserved.id)
                        const baseQty = prevPlanned
                            ? prevPlanned.newQty
                            : Number(existingReserved.allocated_quantity) || 0
                        const nextQty = Math.round((baseQty + takeQty) * 1000) / 1000
                        if (prevPlanned) {
                            prevPlanned.newQty = nextQty
                        } else {
                            rowsToUpdate.push({
                                id: existingReserved.id,
                                newQty: nextQty,
                                posId: lot.positionId,
                                posCode: lot.positionCode
                            })
                        }
                    } else {
                        rowsToInsert.push({
                            system_code: plan.system_code,
                            plan_id: plan.id,
                            plan_input_id: inp.id,
                            lot_id: lot.lotId,
                            position_id: lot.positionId || null,
                            product_id: lot.productId,
                            lot_code: lot.lotCode,
                            production_code: lot.productionCode || null,
                            position_code: lot.positionCode,
                            allocated_quantity: Math.round(takeQty * 1000) / 1000,
                            issued_quantity: 0,
                            returned_quantity: 0,
                            unit: lot.unit,
                            weight_per_unit_kg: unitW,
                            status: 'RESERVED',
                            allocated_by: uid
                        })
                    }

                    totalPickedPallets += 1
                    totalPickedKg += takeKg
                }
            }

            if (rowsToInsert.length === 0 && rowsToUpdate.length === 0) {
                showToast(
                    'Nguyên liệu đã được soạn đủ định mức hoặc không còn LOT khả dụng trong kho.',
                    'info'
                )
                setBusyAction(null)
                return
            }

            for (const upd of rowsToUpdate) {
                const { error } = await (supabase.from('production_plan_allocations' as any) as any)
                    .update({
                        allocated_quantity: upd.newQty,
                        position_id: upd.posId,
                        position_code: upd.posCode
                    })
                    .eq('id', upd.id)
                if (error) throw error
            }

            if (rowsToInsert.length > 0) {
                const { error } = await (supabase.from('production_plan_allocations' as any) as any).insert(
                    rowsToInsert
                )
                if (error) throw error
            }

            if (livePlanStatus === 'DRAFT' || livePlanStatus === 'APPROVED') {
                await (supabase.from('production_plans' as any) as any)
                    .update({ status: 'STAGING', updated_at: new Date().toISOString() })
                    .eq('id', plan.id)
                setLivePlanStatus('STAGING')
            }

            await recalculatePlanAggregates(plan.id)
            setOpenModeAutoTargetKg('')
            setDraftQtyMap({})

            showToast(
                `⚡ Đã tự động giữ chỗ ${totalPickedPallets} LOT theo chuẩn FIFO (tổng ~${formatQty(Math.round(totalPickedKg * 100) / 100)} Kg).`,
                'success'
            )
            await loadModalData(true)
            onUpdated()
        } catch (err: any) {
            console.error('Lỗi tự động chọn FIFO:', err)
            showToast(err?.message || 'Lỗi khi tự động chọn LOT theo FIFO.', 'error')
        } finally {
            setBusyAction(null)
        }
    }

    // Lưu chỉnh sửa số lượng giữ trên dòng đã phân bổ
    const handleSaveAllocationQty = async (alloc: ProductionPlanAllocation) => {
        if (!plan || isReadOnly) return
        const nextQty = Number(editingAllocQty)
        const currentIssued = Number(alloc.issued_quantity) || 0
        const currentAlloc = Number(alloc.allocated_quantity) || 0

        if (!Number.isFinite(nextQty) || nextQty <= 0) {
            showToast('Số lượng giữ phải lớn hơn 0 (hoặc dùng nút Hủy giữ chỗ).', 'warning')
            return
        }
        if (nextQty < currentIssued - 0.0001) {
            showToast(
                `Không thể giảm số lượng giữ xuống thấp hơn số đã cấp ra chuyền (${formatQty(currentIssued)} ${alloc.unit}).`,
                'warning'
            )
            return
        }

        // Kiểm tra tồn khả dụng nếu tăng số lượng giữ
        const deltaIncrease = nextQty - currentAlloc
        if (deltaIncrease > 0.0001) {
            const matchedStock = availableLots.find(
                l => l.lotId === alloc.lot_id && l.productId === alloc.product_id
            )
            const maxIncrease = matchedStock ? matchedStock.availableQuantity : 0
            if (deltaIncrease > maxIncrease + 0.0001) {
                showToast(
                    `Phần tăng thêm vượt quá lượng còn khả dụng của LOT này (còn trống ${formatQty(maxIncrease)} ${alloc.unit}).`,
                    'warning'
                )
                return
            }
        }

        setBusyAction(`edit_${alloc.id}`)
        try {
            const nextStatus: AllocationStatus =
                currentIssued > 0
                    ? nextQty <= currentIssued + 0.0001
                        ? 'ISSUED'
                        : 'PARTIAL_ISSUED'
                    : alloc.status

            const roundedNext = Math.round(nextQty * 1000) / 1000
            const { error } = await (supabase.from('production_plan_allocations' as any) as any)
                .update({
                    allocated_quantity: roundedNext,
                    status: nextStatus
                })
                .eq('id', alloc.id)
            if (error) throw error

            // Nếu đã đẩy sang Lệnh xuất kho mà dòng lệnh vẫn đang Pending, đồng bộ luôn số lượng cần lấy cho đội xe nâng
            if (alloc.export_task_id) {
                await (supabase.from('export_task_items' as any) as any)
                    .update({ quantity: roundedNext })
                    .eq('task_id', alloc.export_task_id)
                    .eq('lot_id', alloc.lot_id)
                    .eq('product_id', alloc.product_id)
                    .eq('status', 'Pending')
            }

            await recalculatePlanAggregates(plan.id)
            setEditingAllocId(null)
            setEditingAllocQty('')
            showToast(`Đã cập nhật số lượng giữ cho Pallet ${alloc.lot_code || ''}.`, 'success')
            await loadModalData(true)
            onUpdated()
        } catch (err: any) {
            console.error('Lỗi cập nhật số lượng phân bổ:', err)
            showToast(err?.message || 'Không thể cập nhật số lượng giữ.', 'error')
        } finally {
            setBusyAction(null)
        }
    }

    // Hủy giữ chỗ 1 dòng phân bổ
    const handleReleaseAllocation = async (alloc: ProductionPlanAllocation) => {
        if (!plan || isReadOnly) return
        const issuedQty = Number(alloc.issued_quantity) || 0

        const msg =
            issuedQty > 0
                ? `Pallet ${alloc.lot_code || ''} đã xuất ${formatQty(issuedQty)} ${alloc.unit} ra chuyền. Bạn muốn giải phóng phần còn lại chưa xuất về kho khả dụng?`
                : `Xác nhận hủy giữ chỗ Pallet ${alloc.lot_code || ''} (${formatQty(alloc.allocated_quantity)} ${alloc.unit})?`

        const ok = await showConfirm(msg)
        if (!ok) return

        setBusyAction(`release_${alloc.id}`)
        try {
            if (issuedQty === 0 && !alloc.export_task_id) {
                // Xóa hẳn bản ghi nếu chưa xuất và chưa gắn lệnh xuất kho
                const { error } = await (supabase.from('production_plan_allocations' as any) as any)
                    .delete()
                    .eq('id', alloc.id)
                if (error) throw error
            } else if (issuedQty === 0) {
                // Đã từng gắn lệnh xuất kho nhưng chưa xuất -> chuyển status RELEASED
                const { error } = await (supabase.from('production_plan_allocations' as any) as any)
                    .update({ status: 'RELEASED' })
                    .eq('id', alloc.id)
                if (error) throw error
            } else {
                // Đã rút một phần -> chốt allocated_quantity = issued_quantity để nhả phần dư về kho
                const { error } = await (supabase.from('production_plan_allocations' as any) as any)
                    .update({
                        allocated_quantity: issuedQty,
                        status: 'ISSUED'
                    })
                    .eq('id', alloc.id)
                if (error) throw error
            }

            await recalculatePlanAggregates(plan.id)
            showToast(`Đã giải phóng giữ chỗ Pallet ${alloc.lot_code || ''}.`, 'success')
            await loadModalData(true)
            onUpdated()
        } catch (err: any) {
            console.error('Lỗi hủy giữ chỗ:', err)
            showToast(err?.message || 'Không thể hủy giữ chỗ dòng này.', 'error')
        } finally {
            setBusyAction(null)
        }
    }

    // 1. Nút chủ lực WMS: Đẩy sang Lệnh Xuất Kho (/work/export-order)
    const handlePushToExportOrder = async () => {
        if (!plan || isReadOnly) return
        const pendingAllocs = allocations.filter(
            a => !a.export_task_id && ['RESERVED', 'STAGED'].includes(a.status) && a.allocated_quantity > 0
        )

        if (pendingAllocs.length === 0) {
            showToast('Không có Pallet/LOT mới nào đang chờ đẩy sang Lệnh xuất kho.', 'warning')
            return
        }

        const ok = await showConfirm(
            `Tạo Lệnh xuất kho cho ${pendingAllocs.length} Pallet đang giữ chỗ để đội xe nâng trên Web, /scanner và App Android nhận lệnh hạ hàng ngay?`
        )
        if (!ok) return

        setBusyAction('push_export')
        try {
            const uid = await resolveCurrentUserId()
            if (!uid) {
                throw new Error('Không xác định được tài khoản đăng nhập hiện tại.')
            }

            const result = await pushAllocationsToExportTask({
                plan: { ...plan, status: livePlanStatus },
                allocations,
                userId: uid
            })

            setLastCreatedTask(result)
            showToast(
                `Đã tạo Lệnh xuất kho ${result.taskCode} cho ${pendingAllocs.length} Pallet!`,
                'success'
            )
            await loadModalData(true)
            onUpdated()
        } catch (err: any) {
            console.error('Lỗi đẩy Lệnh xuất kho:', err)
            showToast(err?.message || 'Không thể tạo Lệnh xuất kho.', 'error')
        } finally {
            setBusyAction(null)
        }
    }

    // 2. Nút chủ lực WMS: Đồng bộ số lượng thực tế đã xuất từ Lệnh xuất kho
    const handleSyncFromExportTasks = async () => {
        if (!plan || isReadOnly) return
        const linkedCount = allocations.filter(a => !!a.export_task_id && a.status !== 'RELEASED').length
        if (linkedCount === 0) {
            showToast('Chưa có Pallet nào gắn với Lệnh xuất kho để đồng bộ.', 'info')
            return
        }

        setBusyAction('sync_export')
        try {
            const res = await syncExportedQuantitiesFromTasks(
                { ...plan, status: livePlanStatus, actual_start_at: liveActualStartAt },
                allocations,
                inputs
            )

            if (res.syncedCount > 0) {
                showToast(
                    `Đã đồng bộ ${res.syncedCount} Pallet từ Lệnh xuất (+${formatQty(res.addedKg)} Kg ra chuyền SX)!`,
                    'success'
                )
                await loadModalData(true)
                onUpdated()
            } else {
                showToast('Chưa phát sinh lượng xuất mới từ đội xe nâng / Lệnh xuất kho.', 'info')
            }
        } catch (err: any) {
            console.error('Lỗi đồng bộ Lệnh xuất:', err)
            showToast(err?.message || 'Không thể đồng bộ số liệu từ Lệnh xuất kho.', 'error')
        } finally {
            setBusyAction(null)
        }
    }

    // 3. Nút chủ lực WMS: Cấp thẳng 1 Pallet đã soạn ra chuyền sản xuất (Xuất nhanh)
    const handleDirectIssueToLine = async (alloc: ProductionPlanAllocation) => {
        if (!plan || isReadOnly) return
        const remainingToIssue =
            Math.round(((Number(alloc.allocated_quantity) || 0) - (Number(alloc.issued_quantity) || 0)) * 1000) /
            1000

        if (remainingToIssue <= 0) {
            showToast('Pallet này đã được cấp hết ra chuyền.', 'info')
            return
        }

        const ok = await showConfirm(
            `Cấp thẳng ${formatQty(remainingToIssue)} ${alloc.unit} từ Pallet ${alloc.lot_code || ''} ra chuyền sản xuất ngay bây giờ?`
        )
        if (!ok) return

        setBusyAction(`issue_${alloc.id}`)
        try {
            const uid = await resolveCurrentUserId()
            const matchedInputId =
                alloc.plan_input_id ||
                inputs.find(i => i.product_id === alloc.product_id)?.id ||
                null
            const unitW = Number(alloc.weight_per_unit_kg) > 0 ? Number(alloc.weight_per_unit_kg) : 1
            const weightKg = Math.round(remainingToIssue * unitW * 100) / 100
            const nowIso = new Date().toISOString()

            const { error: updErr } = await (supabase.from('production_plan_allocations' as any) as any)
                .update({
                    issued_quantity: alloc.allocated_quantity,
                    status: 'ISSUED'
                })
                .eq('id', alloc.id)
            if (updErr) throw updErr

            const { error: logErr } = await (supabase.from('production_plan_logs' as any) as any).insert({
                system_code: plan.system_code,
                plan_id: plan.id,
                log_type: 'ISSUE_INPUT',
                plan_input_id: matchedInputId,
                allocation_id: alloc.id,
                lot_id: alloc.lot_id,
                product_id: alloc.product_id,
                item_name: alloc.products?.name || 'Nguyên liệu cấp ra chuyền',
                lot_code: alloc.lot_code || null,
                production_code: alloc.production_code || null,
                position_code: alloc.position_code || null,
                quantity: remainingToIssue,
                unit: alloc.unit,
                weight_kg: weightKg,
                shift_name: 'Xuất nhanh tại kho',
                operator_name: profile?.full_name || user?.email || null,
                event_at: nowIso,
                notes: `Thủ kho cấp thẳng Pallet ${alloc.lot_code || ''} đã soạn ra chuyền sản xuất`,
                created_by: uid
            })
            if (logErr) throw logErr

            if (livePlanStatus !== 'IN_PROGRESS' || !liveActualStartAt) {
                const startAt = liveActualStartAt || nowIso
                const { error: planErr } = await (supabase.from('production_plans' as any) as any)
                    .update({
                        status: 'IN_PROGRESS',
                        actual_start_at: startAt,
                        updated_at: nowIso
                    })
                    .eq('id', plan.id)
                if (planErr) throw planErr
                setLivePlanStatus('IN_PROGRESS')
                setLiveActualStartAt(startAt)
            }

            await recalculatePlanAggregates(plan.id)

            showToast(
                `Đã cấp ${formatQty(remainingToIssue)} ${alloc.unit} (${formatQty(weightKg)} Kg) từ Pallet ${alloc.lot_code || ''} ra chuyền!`,
                'success'
            )
            await loadModalData(true)
            onUpdated()
        } catch (err: any) {
            console.error('Lỗi cấp thẳng Pallet ra chuyền:', err)
            showToast(err?.message || 'Không thể cấp thẳng Pallet ra chuyền.', 'error')
        } finally {
            setBusyAction(null)
        }
    }

    // Thống kê nhanh bên cột Đã soạn
    const activeAllocations = useMemo(
        () => allocations.filter(a => a.status !== 'RELEASED'),
        [allocations]
    )
    const releasedCount = allocations.length - activeAllocations.length
    const visibleAllocations = showReleasedAllocs ? allocations : activeAllocations

    const pendingPushCount = useMemo(
        () =>
            activeAllocations.filter(
                a => !a.export_task_id && ['RESERVED', 'STAGED'].includes(a.status) && a.allocated_quantity > 0
            ).length,
        [activeAllocations]
    )

    const linkedTasksSummary = useMemo(() => {
        const map = new Map<string, { id: string; code: string; status: string; count: number }>()
        for (const a of activeAllocations) {
            if (a.export_task_id && a.export_tasks?.code) {
                const cur = map.get(a.export_task_id)
                if (cur) cur.count += 1
                else {
                    map.set(a.export_task_id, {
                        id: a.export_task_id,
                        code: a.export_tasks.code,
                        status: a.export_tasks.status,
                        count: 1
                    })
                }
            }
        }
        return Array.from(map.values())
    }, [activeAllocations])

    const totalStagedKg = useMemo(
        () =>
            Math.round(
                activeAllocations.reduce(
                    (s, a) => s + (Number(a.allocated_quantity) || 0) * (Number(a.weight_per_unit_kg) || 1),
                    0
                ) * 100
            ) / 100,
        [activeAllocations]
    )

    const totalIssuedKg = useMemo(
        () =>
            Math.round(
                activeAllocations.reduce(
                    (s, a) => s + (Number(a.issued_quantity) || 0) * (Number(a.weight_per_unit_kg) || 1),
                    0
                ) * 100
            ) / 100,
        [activeAllocations]
    )

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isSuggestOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            setIsSuggestOpen(true)
            return
        }
        if (!isSuggestOpen) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlightIdx(prev => (prev < searchSuggestions.length - 1 ? prev + 1 : 0))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightIdx(prev =>
                prev > 0 ? prev - 1 : Math.max(0, searchSuggestions.length - 1)
            )
        } else if (e.key === 'Enter') {
            const picked = searchSuggestions[highlightIdx]
            if (picked) {
                e.preventDefault()
                setSearchQuery(picked.lotItem.lotCode)
                setPinnedLotItemId(picked.lotItem.lotItemId)
                setIsSuggestOpen(false)
            }
        } else if (e.key === 'Escape') {
            setIsSuggestOpen(false)
        }
    }

    if (!isOpen || !plan) return null

    const statusBadge = PLAN_STATUS_CONFIG[livePlanStatus] || PLAN_STATUS_CONFIG.DRAFT
    const modeBadge = PLAN_MODE_CONFIG[plan.plan_mode] || PLAN_MODE_CONFIG.INPUT_DRIVEN

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-sm">
            <div className="w-full max-w-[1480px] h-[94vh] bg-stone-50 dark:bg-zinc-950 rounded-3xl shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col overflow-hidden">
                {/* HEADER */}
                <div className="px-5 py-3.5 bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-4 shrink-0">
                    <div className="min-w-0 flex items-center gap-3 flex-wrap">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                            <Boxes size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-stone-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                                    {plan.code}
                                </span>
                                <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-zinc-100 truncate">
                                    Kho Soạn Hàng Tồn Kho & Giữ Chỗ LOT (FIFO)
                                </h2>
                                <span
                                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadge.badgeClass}`}
                                >
                                    {statusBadge.label}
                                </span>
                                <span
                                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${modeBadge.badgeClass}`}
                                >
                                    {modeBadge.shortLabel}
                                </span>
                            </div>
                            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5 truncate">
                                Kế hoạch: <strong className="text-stone-700 dark:text-zinc-200">{plan.name}</strong>
                                {plan.work_area_name ? ` • Khu vực SX: ${plan.work_area_name}` : ''}
                                {plan.requested_by_name ? ` • Người yêu cầu: ${plan.requested_by_name}` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => void loadModalData(true)}
                            disabled={loading || !!busyAction}
                            className="px-3 py-2 rounded-xl text-xs font-bold border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-700 dark:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            title="Làm mới tồn kho & phân bổ"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline">Tải lại tồn kho</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-stone-400 hover:text-stone-800 dark:hover:text-zinc-100 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                            aria-label="Đóng"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* THANH TAB NGUYÊN LIỆU + TIẾN ĐỘ SOẠN + TỰ ĐỘNG FIFO */}
                <div className="px-5 py-3 bg-white/90 dark:bg-zinc-900/90 border-b border-stone-200 dark:border-zinc-800 space-y-2.5 shrink-0">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {inputs.map(inp => {
                            const prog = inputProgressMap.get(inp.id)
                            const isSelected = selectedTab === inp.id
                            const firstAlias = inp.products?.aliases
                                ? String(inp.products.aliases).split(/[,;\n]/)[0]?.trim()
                                : null
                            const isDone =
                                !inp.is_open_quantity && prog && prog.requiredKg > 0 && prog.remainingKg <= 0.01

                            return (
                                <button
                                    key={inp.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedTab(inp.id)
                                        setPinnedLotItemId(null)
                                    }}
                                    className={`shrink-0 px-3 py-2 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                                            : 'bg-stone-50 dark:bg-zinc-800/80 text-stone-700 dark:text-zinc-200 border-stone-200 dark:border-zinc-700 hover:border-indigo-300'
                                    }`}
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            {firstAlias && (
                                                <span
                                                    className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                                        isSelected
                                                            ? 'bg-white/20 text-white'
                                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                                    }`}
                                                >
                                                    ⚡ {firstAlias}
                                                </span>
                                            )}
                                            <span className="text-xs font-extrabold truncate max-w-[180px]">
                                                {inp.products?.name || 'Nguyên liệu'}
                                            </span>
                                        </div>
                                        <div
                                            className={`text-[10px] font-semibold mt-0.5 ${
                                                isSelected
                                                    ? 'text-indigo-100'
                                                    : 'text-stone-500 dark:text-zinc-400'
                                            }`}
                                        >
                                            {inp.is_open_quantity
                                                ? `Xuất mở • Đã giữ: ${formatQty(prog?.allocatedQty)} ${inp.unit}`
                                                : `Đã giữ: ${formatQty(prog?.allocatedQty)} / ${formatQty(prog?.requiredQty)} ${inp.unit}`}
                                        </div>
                                    </div>
                                    {isDone && (
                                        <CheckCircle2
                                            size={16}
                                            className={isSelected ? 'text-emerald-300' : 'text-emerald-600'}
                                        />
                                    )}
                                </button>
                            )
                        })}

                        <button
                            type="button"
                            onClick={() => {
                                setSelectedTab('ALL_PLAN')
                                setPinnedLotItemId(null)
                            }}
                            className={`shrink-0 px-3 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                                selectedTab === 'ALL_PLAN'
                                    ? 'bg-stone-900 text-white border-stone-900 dark:bg-zinc-100 dark:text-zinc-900'
                                    : 'bg-stone-50 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 border-stone-200 dark:border-zinc-700 hover:bg-stone-100'
                            }`}
                        >
                            Tất cả NL kế hoạch ({inputs.length})
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setSelectedTab('ALL_WAREHOUSE')
                                setPinnedLotItemId(null)
                            }}
                            className={`shrink-0 px-3 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                selectedTab === 'ALL_WAREHOUSE'
                                    ? 'bg-orange-600 text-white border-orange-600'
                                    : 'bg-stone-50 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 border-stone-200 dark:border-zinc-700 hover:bg-stone-100'
                            }`}
                            title="Mở rộng tìm mọi LOT trong phân hệ kho nếu cần cấp bổ sung mã hàng ngoài danh mục ban đầu"
                        >
                            <Filter size={13} />
                            Toàn bộ kho ({availableLots.length})
                        </button>
                    </div>

                    {/* Thanh Tiến Độ Soạn Hàng Của Nguyên Liệu Đang Chọn + Nút Tự Động FIFO */}
                    {selectedInput && selectedProgress ? (
                        <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/25 border border-indigo-200/80 dark:border-indigo-900/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-1.5">
                                {selectedInput.is_open_quantity ? (
                                    <div className="flex items-center gap-2 flex-wrap text-xs">
                                        <span className="font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/40 px-2 py-0.5 rounded-lg">
                                            Chế độ xuất mở theo mục tiêu đầu ra • Đã soạn sẵn:{' '}
                                            {formatQty(selectedProgress.allocatedKg)} Kg
                                        </span>
                                        {plan.production_plan_outputs && plan.production_plan_outputs.length > 0 && (
                                            <span className="text-stone-600 dark:text-zinc-300 font-semibold">
                                                (Mục tiêu cần đạt:{' '}
                                                {plan.production_plan_outputs
                                                    .filter(o => o.output_type === 'PRIMARY')
                                                    .map(
                                                        o =>
                                                            `${formatQty(o.target_quantity)} ${o.unit} ${o.item_name}`
                                                    )
                                                    .join(', ')}
                                                )
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                                            <div className="font-bold text-stone-800 dark:text-zinc-100 flex items-center gap-2 flex-wrap">
                                                <span>
                                                    Cần soạn:{' '}
                                                    <strong className="text-indigo-700 dark:text-indigo-300">
                                                        {formatQty(selectedProgress.requiredQty)} {selectedInput.unit}
                                                    </strong>
                                                    {selectedInput.unit.toLowerCase() !== 'kg' &&
                                                        ` (${formatQty(selectedProgress.requiredKg)} Kg)`}
                                                </span>
                                                <span className="text-stone-300 dark:text-zinc-600">|</span>
                                                <span>
                                                    Đã giữ:{' '}
                                                    <strong className="text-emerald-600 dark:text-emerald-400">
                                                        {formatQty(selectedProgress.allocatedQty)} {selectedInput.unit}
                                                    </strong>
                                                </span>
                                                <span className="text-stone-300 dark:text-zinc-600">|</span>
                                                <span>
                                                    Còn thiếu:{' '}
                                                    <strong
                                                        className={
                                                            selectedProgress.remainingQty > 0
                                                                ? 'text-rose-600 dark:text-rose-400'
                                                                : 'text-emerald-600 dark:text-emerald-400'
                                                        }
                                                    >
                                                        {formatQty(selectedProgress.remainingQty)} {selectedInput.unit}
                                                    </strong>
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-300">
                                                {selectedProgress.percent}%
                                            </span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-white dark:bg-zinc-800 overflow-hidden border border-indigo-100 dark:border-zinc-700">
                                            <div
                                                className={`h-full transition-all duration-300 ${
                                                    selectedProgress.percent >= 100
                                                        ? 'bg-emerald-500'
                                                        : 'bg-indigo-600'
                                                }`}
                                                style={{ width: `${selectedProgress.percent}%` }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {!isReadOnly && (
                                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                    {selectedInput.is_open_quantity && (
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={openModeAutoTargetKg}
                                            onChange={e => setOpenModeAutoTargetKg(e.target.value)}
                                            placeholder="Nhập số Kg cần lấy..."
                                            className="w-40 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                                        />
                                    )}
                                    <button
                                        type="button"
                                        disabled={
                                            !!busyAction ||
                                            (!selectedInput.is_open_quantity &&
                                                selectedProgress.remainingKg <= 0.01)
                                        }
                                        onClick={() => void handleAutoPickFIFO()}
                                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-sm shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {busyAction === 'auto_fifo' ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Zap size={14} />
                                        )}
                                        ⚡ Tự động chọn nhanh theo FIFO
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        inputs.some(i => !i.is_open_quantity) &&
                        !isReadOnly && (
                            <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-2 rounded-2xl bg-stone-100/80 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700 text-xs">
                                <span className="font-semibold text-stone-600 dark:text-zinc-300">
                                    Đang xem tổng hợp nguyên liệu • Tổng đã giữ chỗ:{' '}
                                    <strong className="text-indigo-600 dark:text-indigo-400">
                                        {formatQty(totalStagedKg)} Kg
                                    </strong>{' '}
                                    ({activeAllocations.length} Pallet)
                                </span>
                                <button
                                    type="button"
                                    disabled={!!busyAction}
                                    onClick={() => void handleAutoPickFIFO()}
                                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {busyAction === 'auto_fifo' ? (
                                        <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                        <Zap size={13} />
                                    )}
                                    ⚡ Tự động chọn nhanh theo FIFO (Tất cả NL còn thiếu)
                                </button>
                            </div>
                        )
                    )}
                </div>

                {/* NỘI DUNG 2 CỘT CHÍNH: TRÁI (TỒN KHO LOT FIFO) - PHẢI (DANH SÁCH ĐÃ SOẠN & ĐẨY LỆNH XUẤT) */}
                <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-stone-200 dark:divide-zinc-800 overflow-y-auto xl:overflow-hidden">
                    {/* CỘT TRÁI: TỒN KHO LOT KHẢ DỤNG (FIFO) */}
                    <div className="xl:col-span-7 flex flex-col min-h-[420px] xl:min-h-0 bg-white dark:bg-zinc-900/40">
                        {/* Thanh tìm kiếm LOT + Autocomplete gợi ý */}
                        <div className="p-3.5 border-b border-stone-200 dark:border-zinc-800 space-y-2 shrink-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
                                    <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-zinc-100 uppercase tracking-tight">
                                        Tồn kho LOT khả dụng (Ưu tiên FIFO cũ nhất)
                                    </h3>
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300">
                                        {displayedLots.length} LOT
                                    </span>
                                </div>
                                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-zinc-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={onlyAvailableStock}
                                        onChange={e => setOnlyAvailableStock(e.target.checked)}
                                        className="rounded border-stone-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Ẩn LOT đã giữ kín hết
                                </label>
                            </div>

                            <div ref={searchWrapRef} className="relative">
                                <div className="relative flex items-center">
                                    <Search
                                        size={15}
                                        className="absolute left-3.5 text-stone-400 pointer-events-none"
                                    />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        placeholder="Tìm tên gõ tắt (aliases), SKU, mã Pallet (DL-LOT...), mã Lot SX gốc, vị trí kệ..."
                                        onFocus={() => {
                                            setIsSuggestOpen(true)
                                            setHighlightIdx(0)
                                        }}
                                        onChange={e => {
                                            setSearchQuery(e.target.value)
                                            setPinnedLotItemId(null)
                                            setIsSuggestOpen(true)
                                            setHighlightIdx(0)
                                        }}
                                        onKeyDown={handleSearchKeyDown}
                                        className="w-full pl-9 pr-9 py-2 text-xs font-semibold rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all"
                                    />
                                    {(searchQuery || pinnedLotItemId) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchQuery('')
                                                setPinnedLotItemId(null)
                                                setIsSuggestOpen(false)
                                            }}
                                            className="absolute right-2.5 p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200"
                                            title="Xóa từ khóa lọc"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Dropdown Gợi ý Tìm kiếm (Autocomplete) */}
                                {isSuggestOpen && (
                                    <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800">
                                        <div className="px-3 py-1.5 bg-stone-50 dark:bg-zinc-800/80 flex items-center justify-between text-[10px] font-bold text-stone-500 dark:text-zinc-400">
                                            <span>
                                                GỢI Ý NHANH THEO TÊN VIẾT TẮT • MÃ PALLET • MÃ LOT SX • VỊ TRÍ
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setIsSuggestOpen(false)}
                                                className="text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                Đóng gợi ý
                                            </button>
                                        </div>
                                        {searchSuggestions.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-stone-400">
                                                Không tìm thấy LOT nào khớp từ khóa &ldquo;{searchQuery}&rdquo;
                                            </div>
                                        ) : (
                                            searchSuggestions.map((sug, idx) => {
                                                const it = sug.lotItem
                                                const isActive = idx === highlightIdx
                                                return (
                                                    <button
                                                        key={it.lotItemId}
                                                        type="button"
                                                        onMouseEnter={() => setHighlightIdx(idx)}
                                                        onClick={() => {
                                                            setSearchQuery(it.lotCode)
                                                            setPinnedLotItemId(it.lotItemId)
                                                            setIsSuggestOpen(false)
                                                        }}
                                                        className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                                            isActive
                                                                ? 'bg-indigo-50/90 dark:bg-indigo-950/40'
                                                                : 'hover:bg-stone-50 dark:hover:bg-zinc-800/50'
                                                        }`}
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                                                                    FIFO #{sug.fifoRank}
                                                                </span>
                                                                {sug.matchedAlias && (
                                                                    <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-[10px] font-black">
                                                                        ⚡ {sug.matchedAlias}
                                                                    </span>
                                                                )}
                                                                <span className="text-xs font-extrabold text-stone-800 dark:text-zinc-100 truncate">
                                                                    {it.productName}
                                                                </span>
                                                                <span className="font-mono text-[10px] font-bold text-stone-500 dark:text-zinc-400">
                                                                    ({it.sku})
                                                                </span>
                                                            </div>
                                                            <div className="mt-0.5 flex items-center gap-2 flex-wrap text-[11px] text-stone-500 dark:text-zinc-400">
                                                                <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                                                                    Pallet: {it.lotCode}
                                                                </span>
                                                                {it.productionCode && (
                                                                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                                                        • Lot SX: {it.productionCode}
                                                                    </span>
                                                                )}
                                                                <span className="font-semibold text-stone-700 dark:text-zinc-300">
                                                                    • Kệ: {it.positionCode}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                                {formatQty(it.availableQuantity)} {it.unit}
                                                            </div>
                                                            <div className="text-[10px] text-stone-400">
                                                                Nhập: {formatDateVN(it.inboundDate || it.createdAt)}
                                                            </div>
                                                        </div>
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bảng LOT khả dụng */}
                        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800/80">
                            {loading ? (
                                <div className="py-16 flex flex-col items-center justify-center gap-2 text-stone-400">
                                    <Loader2 size={26} className="animate-spin text-indigo-600" />
                                    <p className="text-xs font-bold">
                                        Đang tải danh sách LOT khả dụng theo chuẩn FIFO...
                                    </p>
                                </div>
                            ) : displayedLots.length === 0 ? (
                                <div className="py-16 px-6 text-center space-y-2">
                                    <Package size={32} className="mx-auto text-stone-300 dark:text-zinc-700" />
                                    <p className="text-sm font-bold text-stone-600 dark:text-zinc-300">
                                        Không có LOT khả dụng nào khớp bộ lọc hiện tại
                                    </p>
                                    <p className="text-xs text-stone-400">
                                        Bạn có thể bỏ tích &ldquo;Ẩn LOT đã giữ kín hết&rdquo; hoặc chuyển sang tab
                                        &ldquo;Toàn bộ kho&rdquo; để kiểm tra rộng hơn.
                                    </p>
                                </div>
                            ) : (
                                displayedLots.map(item => {
                                    const fifoRank = fifoRankByLotItemId.get(item.lotItemId) || 1
                                    const heldThisPlan =
                                        heldByThisPlanMap.get(`${item.lotId}_${item.productId}`) || 0
                                    const reservedOtherPlans = Math.max(
                                        0,
                                        Math.round((item.reservedElsewhere - heldThisPlan) * 1000) / 1000
                                    )
                                    const storageDays = calcStorageDays(item.inboundDate, item.createdAt)
                                    const draftVal = resolveDraftQtyValue(item)
                                    const isAddingThis = busyAction === `add_${item.lotItemId}`
                                    const firstAlias = item.aliases
                                        ? String(item.aliases).split(/[,;\n]/)[0]?.trim()
                                        : null

                                    return (
                                        <div
                                            key={item.lotItemId}
                                            className={`p-3.5 hover:bg-stone-50/90 dark:hover:bg-zinc-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                                fifoRank === 1
                                                    ? 'bg-amber-50/30 dark:bg-amber-950/10'
                                                    : ''
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1 space-y-1.5">
                                                {/* Dòng 1: FIFO badge + Mã Pallet + Mã Lot SX gốc + Vị trí kệ */}
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span
                                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                                                            fifoRank === 1
                                                                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                                                : fifoRank <= 3
                                                                  ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                                                                  : 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                                                        }`}
                                                    >
                                                        FIFO #{fifoRank}
                                                    </span>

                                                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                                                        Pallet: {item.lotCode}
                                                    </span>

                                                    {item.productionCode && (
                                                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800">
                                                            Lot SX: {item.productionCode}
                                                        </span>
                                                    )}

                                                    <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-zinc-800 text-stone-800 dark:text-zinc-200">
                                                        <MapPin size={12} className="text-orange-500" />
                                                        {item.positionCode}
                                                    </span>
                                                </div>

                                                {/* Dòng 2: Tên sản phẩm + Tên gõ tắt + SKU */}
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {firstAlias && (
                                                        <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-[10px] font-black">
                                                            ⚡ {firstAlias}
                                                        </span>
                                                    )}
                                                    <span className="text-xs font-bold text-stone-800 dark:text-zinc-100">
                                                        {item.productName}
                                                    </span>
                                                    <span className="font-mono text-[11px] font-semibold text-stone-400">
                                                        ({item.sku})
                                                    </span>
                                                </div>

                                                {/* Dòng 3: Ngày nhập kho + Tồn thực tế / Giữ KH khác / Khả dụng */}
                                                <div className="flex items-center gap-3 flex-wrap text-[11px] text-stone-500 dark:text-zinc-400">
                                                    <span className="inline-flex items-center gap-1 font-medium">
                                                        <Calendar size={12} className="text-stone-400" />
                                                        Nhập: {formatDateVN(item.inboundDate || item.createdAt)}
                                                        {storageDays > 0 && (
                                                            <span className="text-[10px] text-stone-400">
                                                                ({storageDays} ngày)
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span>
                                                        Tồn kệ:{' '}
                                                        <strong className="text-stone-700 dark:text-zinc-200">
                                                            {formatQty(item.quantityOnHand)} {item.unit}
                                                        </strong>
                                                    </span>
                                                    {reservedOtherPlans > 0 && (
                                                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                                                            • Đang giữ KH khác: {formatQty(reservedOtherPlans)}{' '}
                                                            {item.unit}
                                                        </span>
                                                    )}
                                                    {heldThisPlan > 0 && (
                                                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                                            • Đã giữ KH này: {formatQty(heldThisPlan)} {item.unit}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Khối thao tác nhập số lượng & đưa vào danh sách soạn */}
                                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                                <div className="text-right mr-1">
                                                    <div className="text-[10px] font-bold uppercase text-stone-400">
                                                        Khả dụng
                                                    </div>
                                                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                        {formatQty(item.availableQuantity)} {item.unit}
                                                    </div>
                                                    {item.unit.toLowerCase() !== 'kg' && item.weightPerUnitKg > 0 && (
                                                        <div className="text-[10px] text-stone-400">
                                                            ~{formatQty(item.availableQuantity * item.weightPerUnitKg)}{' '}
                                                            Kg
                                                        </div>
                                                    )}
                                                </div>

                                                {!isReadOnly && item.availableQuantity > 0 && (
                                                    <>
                                                        <div className="w-24">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={item.availableQuantity}
                                                                step="any"
                                                                value={draftVal}
                                                                onChange={e =>
                                                                    setDraftQtyMap(prev => ({
                                                                        ...prev,
                                                                        [item.lotItemId]: e.target.value
                                                                    }))
                                                                }
                                                                className="w-full px-2.5 py-2 rounded-xl text-xs font-black text-right bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                                                                aria-label={`Số lượng soạn cho ${item.lotCode}`}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={!!busyAction}
                                                            onClick={() => void handleAllocateSingleLot(item)}
                                                            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                                                        >
                                                            {isAddingThis ? (
                                                                <Loader2 size={14} className="animate-spin" />
                                                            ) : (
                                                                <Plus size={14} />
                                                            )}
                                                            <span>Đưa vào danh sách soạn</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* CỘT PHẢI: DANH SÁCH PALLET/LOT ĐÃ SOẠN & HÀNH ĐỘNG CHỦ LỰC WMS */}
                    <div className="xl:col-span-5 flex flex-col min-h-[420px] xl:min-h-0 bg-stone-50/60 dark:bg-zinc-950/60">
                        {/* Header cột Đã soạn + Nút chủ lực WMS */}
                        <div className="p-3.5 bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 space-y-3 shrink-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div>
                                    <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-zinc-100 uppercase tracking-tight">
                                        Pallet / LOT Đã Soạn Cho Kế Hoạch ({activeAllocations.length})
                                    </h3>
                                    <p className="text-[11px] font-semibold text-stone-500 dark:text-zinc-400">
                                        Tổng giữ:{' '}
                                        <strong className="text-indigo-600 dark:text-indigo-400">
                                            {formatQty(totalStagedKg)} Kg
                                        </strong>{' '}
                                        • Đã cấp ra chuyền:{' '}
                                        <strong className="text-emerald-600 dark:text-emerald-400">
                                            {formatQty(totalIssuedKg)} Kg
                                        </strong>
                                    </p>
                                </div>

                                {releasedCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowReleasedAllocs(v => !v)}
                                        className="text-[11px] font-bold text-stone-500 hover:text-stone-800 dark:hover:text-zinc-200 underline cursor-pointer"
                                    >
                                        {showReleasedAllocs
                                            ? 'Ẩn dòng đã hủy'
                                            : `Hiện ${releasedCount} dòng đã hủy giữ`}
                                    </button>
                                )}
                            </div>

                            {/* 2 NÚT HÀNH ĐỘNG CHỦ LỰC WMS */}
                            {!isReadOnly && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        disabled={!!busyAction || pendingPushCount === 0}
                                        onClick={() => void handlePushToExportOrder()}
                                        className="px-3 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-md shadow-sky-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-45"
                                    >
                                        {busyAction === 'push_export' ? (
                                            <Loader2 size={15} className="animate-spin shrink-0" />
                                        ) : (
                                            <Truck size={15} className="shrink-0" />
                                        )}
                                        <span className="truncate">
                                            Đẩy sang Lệnh Xuất Kho ({pendingPushCount})
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={!!busyAction || linkedTasksSummary.length === 0}
                                        onClick={() => void handleSyncFromExportTasks()}
                                        className="px-3 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-45"
                                    >
                                        {busyAction === 'sync_export' ? (
                                            <Loader2 size={15} className="animate-spin shrink-0" />
                                        ) : (
                                            <RefreshCw size={15} className="shrink-0" />
                                        )}
                                        <span className="truncate">Đồng bộ số đã xuất từ Lệnh xuất</span>
                                    </button>
                                </div>
                            )}

                            {/* Banner thông báo mã Lệnh xuất kho vừa tạo + danh sách Lệnh xuất đang liên kết */}
                            {lastCreatedTask && (
                                <div className="p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center justify-between gap-2">
                                    <div className="text-xs font-bold text-sky-800 dark:text-sky-200">
                                        Đã đẩy lệnh xe nâng:{' '}
                                        <span className="font-mono font-black">{lastCreatedTask.taskCode}</span>
                                    </div>
                                    <Link
                                        href="/work/export-order"
                                        className="px-2.5 py-1 rounded-xl bg-sky-600 text-white text-[11px] font-black inline-flex items-center gap-1 hover:bg-sky-700 shrink-0"
                                    >
                                        Mở Lệnh Xuất Kho
                                        <ExternalLink size={12} />
                                    </Link>
                                </div>
                            )}

                            {!lastCreatedTask && linkedTasksSummary.length > 0 && (
                                <div className="flex items-center justify-between gap-2 flex-wrap px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-zinc-800/80 text-[11px]">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-stone-500 dark:text-zinc-400">
                                            Lệnh xuất đã tạo:
                                        </span>
                                        {linkedTasksSummary.map(t => (
                                            <span
                                                key={t.id}
                                                className="font-mono font-black px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-sky-700 dark:text-sky-300"
                                            >
                                                {t.code} ({t.count})
                                            </span>
                                        ))}
                                    </div>
                                    <Link
                                        href="/work/export-order"
                                        className="font-black text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                                    >
                                        /work/export-order
                                        <ExternalLink size={11} />
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Danh sách các dòng production_plan_allocations */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                            {visibleAllocations.length === 0 ? (
                                <div className="py-16 px-4 text-center space-y-2">
                                    <AlertTriangle
                                        size={30}
                                        className="mx-auto text-stone-300 dark:text-zinc-700"
                                    />
                                    <p className="text-sm font-bold text-stone-600 dark:text-zinc-300">
                                        Chưa có Pallet / LOT nào được soạn cho kế hoạch này
                                    </p>
                                    <p className="text-xs text-stone-400">
                                        Hãy bấm <strong>⚡ Tự động chọn nhanh theo FIFO</strong> hoặc chọn từng LOT ở
                                        bảng bên trái để bắt đầu giữ chỗ.
                                    </p>
                                </div>
                            ) : (
                                visibleAllocations.map(alloc => {
                                    const stCfg =
                                        ALLOCATION_STATUS_CONFIG[alloc.status] ||
                                        ALLOCATION_STATUS_CONFIG.RESERVED
                                    const isEditing = editingAllocId === alloc.id
                                    const allocQty = Number(alloc.allocated_quantity) || 0
                                    const issuedQty = Number(alloc.issued_quantity) || 0
                                    const returnedQty = Number(alloc.returned_quantity) || 0
                                    const canIssueDirect =
                                        !isReadOnly &&
                                        alloc.status !== 'RELEASED' &&
                                        allocQty - issuedQty > 0.0001
                                    const canEditOrRelease =
                                        !isReadOnly &&
                                        alloc.status !== 'RELEASED' &&
                                        alloc.status !== 'ISSUED' &&
                                        alloc.status !== 'RETURNED'

                                    return (
                                        <div
                                            key={alloc.id}
                                            className={`p-3 rounded-2xl border bg-white dark:bg-zinc-900 shadow-xs space-y-2 transition-all ${
                                                alloc.status === 'RELEASED'
                                                    ? 'opacity-55 border-stone-200 dark:border-zinc-800'
                                                    : 'border-stone-200 dark:border-zinc-800'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-mono text-xs font-black text-indigo-700 dark:text-indigo-300">
                                                            {alloc.lot_code || 'LOT'}
                                                        </span>
                                                        {alloc.production_code && (
                                                            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                                                Lot SX: {alloc.production_code}
                                                            </span>
                                                        )}
                                                        {alloc.position_code && (
                                                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300">
                                                                Kệ: {alloc.position_code}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-bold text-stone-800 dark:text-zinc-100 truncate">
                                                        {alloc.products?.name || 'Nguyên liệu'}
                                                        {alloc.products?.sku ? (
                                                            <span className="ml-1 font-mono text-[10px] text-stone-400">
                                                                ({alloc.products.sku})
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                <span
                                                    className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border ${stCfg.badgeClass}`}
                                                >
                                                    {stCfg.label}
                                                </span>
                                            </div>

                                            {/* Số lượng giữ / đã cấp / lệnh xuất */}
                                            <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-1 border-t border-stone-100 dark:border-zinc-800">
                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <input
                                                                type="number"
                                                                min={issuedQty}
                                                                step="any"
                                                                value={editingAllocQty}
                                                                onChange={e =>
                                                                    setEditingAllocQty(e.target.value)
                                                                }
                                                                className="w-24 px-2 py-1 rounded-lg text-xs font-black bg-stone-50 dark:bg-zinc-800 border border-indigo-400 text-stone-900 dark:text-zinc-100 focus:outline-none"
                                                            />
                                                            <span className="text-[11px] font-bold text-stone-500">
                                                                {alloc.unit}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                disabled={busyAction === `edit_${alloc.id}`}
                                                                onClick={() =>
                                                                    void handleSaveAllocationQty(alloc)
                                                                }
                                                                className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                                                title="Lưu số lượng giữ"
                                                            >
                                                                <Check size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingAllocId(null)
                                                                    setEditingAllocQty('')
                                                                }}
                                                                className="p-1 rounded-lg bg-stone-200 dark:bg-zinc-700 text-stone-600 dark:text-zinc-200"
                                                                title="Hủy sửa"
                                                            >
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="font-semibold text-stone-600 dark:text-zinc-300">
                                                            Giữ:{' '}
                                                            <strong className="text-stone-900 dark:text-white">
                                                                {formatQty(allocQty)} {alloc.unit}
                                                            </strong>
                                                        </span>
                                                    )}

                                                    <span className="text-stone-300 dark:text-zinc-700">•</span>
                                                    <span className="font-semibold text-stone-600 dark:text-zinc-300">
                                                        Đã cấp:{' '}
                                                        <strong className="text-emerald-600 dark:text-emerald-400">
                                                            {formatQty(issuedQty)} {alloc.unit}
                                                        </strong>
                                                    </span>

                                                    {returnedQty > 0 && (
                                                        <span className="font-semibold text-teal-600 dark:text-teal-400">
                                                            • Trả dư: {formatQty(returnedQty)} {alloc.unit}
                                                        </span>
                                                    )}
                                                </div>

                                                {alloc.export_tasks?.code && (
                                                    <Link
                                                        href="/work/export-order"
                                                        className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 inline-flex items-center gap-1 hover:underline"
                                                        title={`Trạng thái lệnh xuất: ${alloc.export_tasks.status}`}
                                                    >
                                                        {alloc.export_tasks.code}
                                                        <ExternalLink size={10} />
                                                    </Link>
                                                )}
                                            </div>

                                            {/* Hàng nút thao tác trên từng Pallet đã soạn */}
                                            {(canIssueDirect || canEditOrRelease) && (
                                                <div className="flex items-center justify-between gap-2 pt-1">
                                                    <div className="flex items-center gap-1.5">
                                                        {canEditOrRelease && !isEditing && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    disabled={!!busyAction}
                                                                    onClick={() => {
                                                                        setEditingAllocId(alloc.id)
                                                                        setEditingAllocQty(String(allocQty))
                                                                    }}
                                                                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-200 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                                >
                                                                    <Edit3 size={12} />
                                                                    Sửa SL
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={!!busyAction}
                                                                    onClick={() =>
                                                                        void handleReleaseAllocation(alloc)
                                                                    }
                                                                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                                >
                                                                    {busyAction === `release_${alloc.id}` ? (
                                                                        <Loader2
                                                                            size={12}
                                                                            className="animate-spin"
                                                                        />
                                                                    ) : (
                                                                        <Trash2 size={12} />
                                                                    )}
                                                                    Hủy giữ chỗ
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>

                                                    {canIssueDirect && (
                                                        <button
                                                            type="button"
                                                            disabled={!!busyAction}
                                                            onClick={() => void handleDirectIssueToLine(alloc)}
                                                            className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black inline-flex items-center gap-1 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                                            title="Xuất nhanh Pallet này ra thẳng chuyền sản xuất & tự động ghi nhật ký ISSUE_INPUT"
                                                        >
                                                            {busyAction === `issue_${alloc.id}` ? (
                                                                <Loader2 size={12} className="animate-spin" />
                                                            ) : (
                                                                <ArrowRightCircle size={13} />
                                                            )}
                                                            Cấp thẳng ra chuyền (Xuất nhanh)
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StagingAllocationModal
