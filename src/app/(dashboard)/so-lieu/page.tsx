'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
    Plus,
    Minus,
    Pin,
    PinOff,
    Search,
    Trash2,
    Pencil,
    RefreshCw,
    Clock,
    CheckCircle2,
    BarChart3,
    History,
    X,
    Check,
    Briefcase,
    Tag,
    ArrowDownLeft,
    ArrowUpRight,
    Play,
    StopCircle,
    Calendar,
    Layers,
    Download,
    RotateCcw,
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    User,
    FileText,
    ExternalLink,
    Settings2,
    AlertTriangle,
    Eye,
    Zap,
    CheckSquare,
    Square
} from 'lucide-react'

import Link from 'next/link'
import InboundOrderModal from '@/components/inventory/inbound/InboundOrderModal'
import OutboundOrderModal from '@/components/inventory/outbound/OutboundOrderModal'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { supabase } from '@/lib/supabaseClient'
import { matchSearch, calculateSearchScore } from '@/lib/searchUtils'
import { normalizeUnit, formatUnitWeight } from '@/lib/unitConversion'
import { getJobTemplates, JobTemplate } from '@/lib/jobTemplates'

// Hàm helper định dạng ngày giờ cho input datetime-local (theo múi giờ địa phương)
const formatDateTimeLocal = (d: Date = new Date()) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = d.getFullYear()
    const m = pad(d.getMonth() + 1)
    const day = pad(d.getDate())
    const hh = pad(d.getHours())
    const mm = pad(d.getMinutes())
    return `${y}-${m}-${day}T${hh}:${mm}`
}

interface ProductItem {
    id: string
    name: string
    sku?: string | null
    unit?: string | null
    weight_kg?: number | null
    aliases?: string | null
    internal_code?: string | null
    internal_name?: string | null
    available_units?: string[]
}

interface OrderTypeItem {
    id: string
    code: string | null
    name: string
    scope?: string | null
    system_code?: string | null
    is_active?: boolean
}

interface DeliveryJournalRecord {
    id: string
    delivery_code?: string | null
    item_name: string
    quantity_sent: number
    unit: string
    from_department: string
    to_department: string
    status: string
    notes: string | null
    sent_by_name: string | null
    sent_at: string
    received_by_warehouse_name?: string | null
    received_by_production_name?: string | null
    system_code?: string | null
    created_at?: string | null
}

export default function SoLieuPage() {
    const { currentSystem } = useSystem()
    const { profile } = useUser()

    // Định danh phân hệ riêng cho ca và nhật ký số liệu để hoàn toàn độc lập với trang giao nhận
    const shiftSystemCode = useMemo(() => {
        return currentSystem?.code ? `${currentSystem.code}__solieu` : null
    }, [currentSystem?.code])

    // 1. Quản lý danh sách các công việc đang mở (Multi-Job Shifts)
    const [openShifts, setOpenShifts] = useState<any[]>([])
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)

    // Công việc đang được chọn hiện tại
    const activeShift = useMemo(() => {
        if (!openShifts.length) return null
        if (selectedShiftId) {
            const found = openShifts.find(s => s.id === selectedShiftId)
            if (found) return found
        }
        return openShifts[0]
    }, [openShifts, selectedShiftId])

    // Modal mở thêm công việc mới
    const [openShiftModal, setOpenShiftModal] = useState(false)
    const [jobNameInput, setJobNameInput] = useState('')
    const [jobNotesInput, setJobNotesInput] = useState('')
    const [jobOpenedAtInput, setJobOpenedAtInput] = useState<string>(() => formatDateTimeLocal())
    const [jobTemplatesList, setJobTemplatesList] = useState<JobTemplate[]>([])
    const [selectedJobTemplate, setSelectedJobTemplate] = useState<JobTemplate | null>(null)
    const [jobOrderTypeId, setJobOrderTypeId] = useState<string>('')

    const handleOpenCreateShiftModal = () => {
        setJobOpenedAtInput(formatDateTimeLocal(new Date()))
        setOpenShiftModal(true)
    }

    // Danh sách Loại phiếu (Kế toán) theo phân hệ
    const [orderTypes, setOrderTypes] = useState<OrderTypeItem[]>([])
    const [closeOrderTypeId, setCloseOrderTypeId] = useState<string>('')

    const refreshOrderTypes = useCallback(async () => {
        if (!currentSystem?.code) return
        try {
            const { data } = await (supabase as any)
                .from('order_types')
                .select('id, code, name, scope, system_code, is_active')
                .eq('system_code', currentSystem.code)
                .eq('is_active', true)
                .order('code', { ascending: true })
            if (data) setOrderTypes(data)
        } catch (e) {
            console.error('Error fetching order types in so-lieu:', e)
        }
    }, [currentSystem?.code])

    useEffect(() => {
        refreshOrderTypes()
    }, [refreshOrderTypes])


    // Modal chốt sổ (hoàn thành công việc)
    const [closeShiftModal, setCloseShiftModal] = useState(false)
    const [closeNotes, setCloseNotes] = useState('')
    const [closeTimeInput, setCloseTimeInput] = useState<string>('')
    const [shiftSummary, setShiftSummary] = useState<any>(null)

    // Modal xác nhận xóa công việc đẹp mắt
    const [deleteTargetShift, setDeleteTargetShift] = useState<{ id: string; title: string; recordCount: number } | null>(null)
    const [isDeletingShift, setIsDeletingShift] = useState(false)

    // Chốt tạm cho công việc hiện tại
    const [subShifts, setSubShifts] = useState<any[]>([])
    const [interimCloseModal, setInterimCloseModal] = useState(false)
    const [interimNotes, setInterimNotes] = useState('')
    const [interimSummary, setInterimSummary] = useState<any>(null)
    const [showSubShiftsPanel, setShowSubShiftsPanel] = useState(false)
    const [viewMode, setViewMode] = useState<'sub-shift' | 'shift'>('sub-shift')

    // Modal xem lịch sử các công việc đã hoàn thành trong quá khứ
    const [showHistoryModal, setShowHistoryModal] = useState(false)
    const [pastShifts, setPastShifts] = useState<any[]>([])

    // Chế độ xem trang: Đang làm | Đã hoàn thành (tích hợp xem lại báo cáo CV đã chốt ngay trong trang)
    const [pageView, setPageView] = useState<'active' | 'done'>('active')
    const [doneRange, setDoneRange] = useState<'today' | '7d' | '30d' | 'all'>('7d')
    const [doneStatusFilter, setDoneStatusFilter] = useState<'all' | 'closed' | 'open'>('all')
    const [doneSearch, setDoneSearch] = useState('')
    const [doneSelectedId, setDoneSelectedId] = useState<string | null>(null)
    const [doneLines, setDoneLines] = useState<DeliveryJournalRecord[]>([])
    const [doneSubShifts, setDoneSubShifts] = useState<any[]>([])
    const [expandedDoneSubShifts, setExpandedDoneSubShifts] = useState<Set<string>>(new Set())
    const [isMainSummaryExpanded, setIsMainSummaryExpanded] = useState(false)
    const [isTwoWayExpanded, setIsTwoWayExpanded] = useState(false)
    const [isUnitsExpanded, setIsUnitsExpanded] = useState(false)
    const [isProductsExpanded, setIsProductsExpanded] = useState(false)
    const [isInfoExpanded, setIsInfoExpanded] = useState(false)
    const [isDoneSubShiftsSectionExpanded, setIsDoneSubShiftsSectionExpanded] = useState(false)
    const [expandedFeedSubShifts, setExpandedFeedSubShifts] = useState<Set<string>>(new Set())
    const [doneTab, setDoneTab] = useState<'summary' | 'lines'>('summary')
    const [doneListLoading, setDoneListLoading] = useState(false)
    const [doneLinesLoading, setDoneLinesLoading] = useState(false)

    // Chế độ xem trong phần Đã hoàn thành: 'single' (từng CV) | 'by-date' (báo cáo theo ngày) | 'by-product' (báo cáo theo sản phẩm) | 'custom' (báo cáo tùy chọn)
    const [doneViewMode, setDoneViewMode] = useState<'single' | 'by-date' | 'by-product' | 'custom'>('single')

    // Cho Báo cáo theo ngày (hỗ trợ cả 1 ngày, Khoảng ngày Từ - Đến, và Tùy chọn nhiều ngày):
    const [byDateFilterType, setByDateFilterType] = useState<'range' | 'multi'>('range')
    const [byDateRange, setByDateRange] = useState<{ from: string; to: string }>(() => {
        const today = new Date()
        const y = today.getFullYear()
        const m = String(today.getMonth() + 1).padStart(2, '0')
        const d = String(today.getDate()).padStart(2, '0')
        const todayStr = `${y}-${m}-${d}`
        return { from: todayStr, to: todayStr }
    })
    const [byDateMultiDates, setByDateMultiDates] = useState<Set<string>>(() => {
        const today = new Date()
        const y = today.getFullYear()
        const m = String(today.getMonth() + 1).padStart(2, '0')
        const d = String(today.getDate()).padStart(2, '0')
        return new Set([`${y}-${m}-${d}`])
    })
    const [byDateCustomAddInput, setByDateCustomAddInput] = useState<string>('')
    const [byDateLines, setByDateLines] = useState<DeliveryJournalRecord[]>([])
    const [byDateLoading, setByDateLoading] = useState(false)

    // Cho Báo cáo theo sản phẩm:
    const [byProdTimeFilter, setByProdTimeFilter] = useState<'today' | '7days' | '30days' | 'all' | 'custom'>('7days')
    const [byProdRange, setByProdRange] = useState<{ from: string; to: string }>(() => {
        const today = new Date()
        const past7 = new Date()
        past7.setDate(today.getDate() - 6)
        const format = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return { from: format(past7), to: format(today) }
    })
    const [byProdSearch, setByProdSearch] = useState<string>('')
    const [byProdLines, setByProdLines] = useState<DeliveryJournalRecord[]>([])
    const [byProdLoading, setByProdLoading] = useState<boolean>(false)
    const [expandedProdKeys, setExpandedProdKeys] = useState<Set<string>>(new Set())

    // Cho Báo cáo tùy chọn (tích chọn công việc):
    const [customSelectedIds, setCustomSelectedIds] = useState<Set<string>>(new Set())
    const [customLines, setCustomLines] = useState<DeliveryJournalRecord[]>([])
    const [customLoading, setCustomLoading] = useState(false)

    // Trạng thái mở rộng chi tiết của từng ca trong bảng danh sách các công việc báo cáo
    const [expandedShiftIdsInReport, setExpandedShiftIdsInReport] = useState<Set<string>>(new Set())

    // 1.1 Modal làm phiếu nhập / xuất kết toán cho công việc
    const [isInboundModalOpen, setIsInboundModalOpen] = useState(false)
    const [inboundInitialData, setInboundInitialData] = useState<any>(null)
    const [isOutboundModalOpen, setIsOutboundModalOpen] = useState(false)
    const [outboundInitialData, setOutboundInitialData] = useState<any>(null)
    const [settlementShiftId, setSettlementShiftId] = useState<string | null>(null)

    // 2. Danh mục sản phẩm & Bàn làm việc (Pinned Products)
    const [allProducts, setAllProducts] = useState<ProductItem[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<ProductItem[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [pinnedProducts, setPinnedProducts] = useState<ProductItem[]>([])

    // Chế độ thanh tìm kiếm:
    // 'filter': Tìm nhanh sản phẩm đã ghim để nhập số liệu (Chế độ 2)
    // 'pin': Tìm sản phẩm trong danh mục kho để ghim vào công việc (Chế độ 1)
    const [searchMode, setSearchMode] = useState<'filter' | 'pin'>('filter')

    // Danh sách sản phẩm ghim được hiển thị trên bảng (được lọc khi searchMode === 'filter')
    const displayedPinnedProducts = useMemo(() => {
        if (searchMode !== 'filter' || !searchQuery.trim()) return pinnedProducts
        const q = searchQuery.trim()
        return pinnedProducts.filter(p => matchSearch(p, q))
    }, [pinnedProducts, searchMode, searchQuery])


    // Danh mục đơn vị tính có sẵn
    const [availableUnits, setAvailableUnits] = useState<string[]>([
        'Kg', 'Thùng', 'Túi', 'Bao', 'Hộp', 'Cái', 'Cuộn', 'Cây', 'Tấn', 'Gam', 'Khay'
    ])
    // Đơn vị tính được chọn riêng cho từng sản phẩm trên bàn làm việc { [productId]: unit }
    const [selectedUnitMap, setSelectedUnitMap] = useState<Record<string, string>>({})

    // Số lượng đếm theo đợt cho từng sản phẩm ghim { [productId]: draftQty }
    const [draftQtyMap, setDraftQtyMap] = useState<Record<string, number>>({})

    // Hiệu ứng bấm nút: { [productId]: 'in' | 'out' | null }
    const [pulseEffect, setPulseEffect] = useState<Record<string, 'in' | 'out' | null>>({})

    // 3. Nhật ký dữ liệu của công việc đang chọn
    const [journalList, setJournalList] = useState<DeliveryJournalRecord[]>([])
    const [allJobJournals, setAllJobJournals] = useState<DeliveryJournalRecord[]>([])
    const [loadingData, setLoadingData] = useState(false)
    const [activeTab, setActiveTab] = useState<'feed' | 'summary'>('feed')
    const [journalTypeFilter, setJournalTypeFilter] = useState<'all' | 'in' | 'out'>('all')

    // Modal chỉnh sửa từng dòng nhật ký
    const [editingRecord, setEditingRecord] = useState<DeliveryJournalRecord | null>(null)
    const [editQuantity, setEditQuantity] = useState<number>(0)
    const [editUnit, setEditUnit] = useState<string>('Kg')
    const [editType, setEditType] = useState<'in' | 'out'>('in')
    const [editNotes, setEditNotes] = useState<string>('')
    const [savingEdit, setSavingEdit] = useState<boolean>(false)

    // Modal xem lịch sử nhập xuất của riêng từng sản phẩm
    const [historyModalProduct, setHistoryModalProduct] = useState<ProductItem | null>(null)
    const [historyProductFilter, setHistoryProductFilter] = useState<'all' | 'in' | 'out'>('all')

    // MOBILE: Bàn phím số nhập nhanh (bottom sheet), chọn CV, menu thao tác, thông báo
    const [padProduct, setPadProduct] = useState<ProductItem | null>(null)
    const [padValue, setPadValue] = useState<string>('')
    const [padUnit, setPadUnit] = useState<string>('Kg')
    const [padSaving, setPadSaving] = useState<boolean>(false)
    const [mobileJobSheet, setMobileJobSheet] = useState<boolean>(false)
    const [desktopJobDropdown, setDesktopJobDropdown] = useState<boolean>(false)
    const [mobileMenu, setMobileMenu] = useState<boolean>(false)
    const [toast, setToast] = useState<{ text: string; type: 'in' | 'out' } | null>(null)
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const showToast = (text: string, type: 'in' | 'out') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setToast({ text, type })
        toastTimerRef.current = setTimeout(() => setToast(null), 2500)
    }

    // ── CƠ CHẾ HOẠT ĐỘNG NGOẠI TUYẾN (OFFLINE CHO KHO ĐÔNG LẠNH) ──
    const [isOnline, setIsOnline] = useState<boolean>(true)
    const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0)
    const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false)

    interface WebOfflineAction {
        id: string
        type: 'CREATE_SHIFT' | 'SUBMIT_JOURNAL' | 'UPDATE_JOURNAL' | 'DELETE_JOURNAL' | 'CLOSE_SHIFT'
        payload: any
        shiftId?: string
        timestamp: number
    }

    const getWebOfflineQueue = useCallback((sysCode: string): WebOfflineAction[] => {
        if (typeof window === 'undefined') return []
        try {
            const raw = localStorage.getItem(`solieu_web_queue_${sysCode}`)
            return raw ? JSON.parse(raw) : []
        } catch {
            return []
        }
    }, [])

    const saveWebOfflineQueue = useCallback((sysCode: string, queue: WebOfflineAction[]) => {
        if (typeof window === 'undefined') return
        try {
            localStorage.setItem(`solieu_web_queue_${sysCode}`, JSON.stringify(queue))
        } catch (e) {
            console.warn('Lỗi lưu offline queue web:', e)
        }
    }, [])

    const refreshOfflineCount = useCallback(() => {
        if (!shiftSystemCode) return
        const q = getWebOfflineQueue(shiftSystemCode)
        setOfflineQueueCount(q.length)
    }, [shiftSystemCode, getWebOfflineQueue])

    // Đồng bộ toàn bộ dữ liệu ghi nhận ngoại tuyến lên máy chủ Supabase
    const syncOfflineWebData = useCallback(async () => {
        if (!shiftSystemCode || isSyncingOffline) return
        const queue = getWebOfflineQueue(shiftSystemCode)
        if (queue.length === 0) return

        setIsSyncingOffline(true)
        const tempShiftIdMap: Record<string, string> = {}
        const remainingQueue: WebOfflineAction[] = []
        let syncedCount = 0

        for (const action of queue) {
            try {
                if (action.type === 'CREATE_SHIFT') {
                    const { insertPayload, tempShiftId } = action.payload
                    const { data: realShift, error } = await (supabase as any)
                        .from('delivery_shifts')
                        .insert([insertPayload])
                        .select()
                        .single()
                    if (error) throw error
                    if (realShift) {
                        tempShiftIdMap[tempShiftId] = realShift.id
                        syncedCount++
                    }
                } else if (action.type === 'SUBMIT_JOURNAL') {
                    const origPayload = action.payload
                    const shiftId = action.shiftId || ''
                    const realShiftId = tempShiftIdMap[shiftId] || shiftId
                    let finalNotes = origPayload.notes || ''
                    if (shiftId && finalNotes.includes(shiftId)) {
                        finalNotes = finalNotes.replace(`[CV_ID: ${shiftId}]`, `[CV_ID: ${realShiftId}]`)
                    }
                    const payload = {
                        ...origPayload,
                        notes: finalNotes,
                    }
                    const { error } = await (supabase as any)
                        .from('delivery_journal')
                        .insert([payload])
                    if (error) throw error
                    syncedCount++
                } else if (action.type === 'UPDATE_JOURNAL') {
                    const { id, payload } = action.payload
                    const { error } = await (supabase as any)
                        .from('delivery_journal')
                        .update(payload)
                        .eq('id', id)
                    if (error) throw error
                    syncedCount++
                } else if (action.type === 'DELETE_JOURNAL') {
                    const { id } = action.payload
                    const { error } = await (supabase as any)
                        .from('delivery_journal')
                        .delete()
                        .eq('id', id)
                    if (error) throw error
                    syncedCount++
                } else if (action.type === 'CLOSE_SHIFT') {
                    const { payload, shiftId } = action.payload
                    const realShiftId = tempShiftIdMap[shiftId] || shiftId
                    const { error } = await (supabase as any)
                        .from('delivery_shifts')
                        .update(payload)
                        .eq('id', realShiftId)
                    if (error) throw error
                    syncedCount++
                }
            } catch (err: any) {
                console.warn('Lỗi sync action web:', action.type, err?.message)
                remainingQueue.push(action)
            }
        }

        saveWebOfflineQueue(shiftSystemCode, remainingQueue)
        setOfflineQueueCount(remainingQueue.length)
        setIsSyncingOffline(false)

        if (syncedCount > 0) {
            showToast(`Đã đồng bộ ${syncedCount} lượt số liệu lên máy chủ thành công!`, 'in')
            loadOpenShifts()
            loadJournalData()
        }
    }, [shiftSystemCode, isSyncingOffline, getWebOfflineQueue, saveWebOfflineQueue])

    useEffect(() => {
        if (typeof window === 'undefined') return
        setIsOnline(navigator.onLine)
        refreshOfflineCount()

        const handleOnline = () => {
            setIsOnline(true)
            syncOfflineWebData()
        }
        const handleOffline = () => {
            setIsOnline(false)
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [shiftSystemCode, refreshOfflineCount, syncOfflineWebData])

    // Helper làm sạch sai số số thực trong tên đơn vị (ví dụ: "Thùng (9.600000000000001kg)" -> "Thùng (9.6kg)")
    const cleanUnitLabel = (u?: string | null): string => {
        if (!u) return ''
        return u.replace(/\((\d+(?:\.\d+)?)kg\)/gi, (_, numStr) => {
            const cleaned = Number(Number(numStr).toFixed(4))
            return `(${cleaned}kg)`
        })
    }

    // Helper kiểm tra đơn vị có phải là Thùng không
    const isBoxUnit = (u?: string | null) => {
        if (!u) return false
        const lower = u.trim().toLowerCase()
        return lower.includes('thùng') || lower.startsWith('thung')
    }

    // Helper lấy đơn vị ưu tiên (ưu tiên đơn vị Thùng trước)
    const getPreferredUnit = (units: string[], fallbackUnit?: string | null): string => {
        const cleanFallback = cleanUnitLabel(fallbackUnit)
        if (!units || units.length === 0) return cleanFallback || 'Kg'
        const thungUnit = units.find(u => isBoxUnit(u))
        if (thungUnit) return thungUnit
        if (cleanFallback && units.includes(cleanFallback)) return cleanFallback
        return units[0] || cleanFallback || 'Kg'
    }

    // Lấy danh sách đơn vị của sản phẩm (sắp xếp ưu tiên đơn vị Thùng lên trước)
    const getProductUnits = (product: ProductItem): string[] => {
        let list: string[] = []
        if (product.id.startsWith('custom_')) list = availableUnits
        else if (product.available_units && product.available_units.length > 0) list = product.available_units
        else list = product.unit ? [product.unit] : ['Kg']

        const cleanedList = Array.from(new Set(list.map(u => cleanUnitLabel(u)).filter(Boolean)))

        return [...cleanedList].sort((a, b) => {
            const aIs = isBoxUnit(a)
            const bIs = isBoxUnit(b)
            if (aIs && !bIs) return -1
            if (!aIs && bIs) return 1
            return 0
        })
    }

    const realtimeRef = useRef<any>(null)

    // Tên công việc hiện tại của ca đang chọn
    const currentJobName = useMemo(() => {
        if (!activeShift) return ''
        return activeShift.summary_data?.job_name || activeShift.notes || 'Công việc số liệu'
    }, [activeShift])

    // Khóa lưu bàn làm việc riêng cho từng công việc cụ thể
    const storageKey = useMemo(() => {
        if (!activeShift?.id) return null
        return `so_lieu_pinned_job_${activeShift.id}`
    }, [activeShift?.id])

    // Ghi nhớ công việc đang chọn để khi F5 giữ nguyên đúng tab công việc đang làm
    useEffect(() => {
        if (selectedShiftId && shiftSystemCode && typeof window !== 'undefined') {
            try {
                localStorage.setItem(`so_lieu_selected_shift_${shiftSystemCode}`, selectedShiftId)
            } catch (e) {}
        }
    }, [selectedShiftId, shiftSystemCode])

    // Đồng bộ danh sách sản phẩm ghim lên summary_data của bảng delivery_shifts trên Supabase
    const syncPinnedToDb = useCallback(async (shiftId: string, currentSummary: any, list: ProductItem[]) => {
        if (!shiftId || !shiftSystemCode) return
        try {
            const nextSummary = {
                ...(currentSummary || {}),
                pinned_products: list,
            }
            setOpenShifts(prev => prev.map(s => s.id === shiftId ? { ...s, summary_data: nextSummary } : s))
            await (supabase as any)
                .from('delivery_shifts')
                .update({ summary_data: nextSummary })
                .eq('id', shiftId)
                .eq('system_code', shiftSystemCode)
        } catch (err) {
            console.error('Failed to sync pinned products to DB:', err)
        }
    }, [shiftSystemCode])

    // Load danh sách ghim của công việc đang chọn từ localStorage (hoặc tự khôi phục từ DB / Công việc mẫu / Lịch sử đợt khi F5)
    useEffect(() => {
        if (!storageKey || !activeShift) {
            setPinnedProducts([])
            return
        }
        const applySyncedPinned = (rawList: ProductItem[], persist = false, syncDb = false) => {
            const synced = rawList.map(p => {
                const found = allProducts.find(ap => ap.id === p.id || ap.name === p.name)
                const item = found || p
                const units = getProductUnits(item)
                const rawUnit = cleanUnitLabel(p.unit || item.unit)
                let prefUnit: string
                if (!rawUnit || !units.includes(rawUnit)) {
                    prefUnit = getPreferredUnit(units, item.unit)
                } else {
                    prefUnit = getPreferredUnit(units, rawUnit)
                }
                return {
                    ...item,
                    unit: prefUnit,
                    available_units: units,
                }
            })
            setPinnedProducts(synced)
            const unitMap: Record<string, string> = {}
            synced.forEach(p => {
                if (p.unit) unitMap[p.id] = p.unit
            })
            setSelectedUnitMap(prev => ({ ...prev, ...unitMap }))
            if (persist && synced.length > 0) {
                try {
                    localStorage.setItem(storageKey, JSON.stringify(synced))
                } catch (e) {}
            }
            if (syncDb && synced.length > 0 && activeShift?.id) {
                syncPinnedToDb(activeShift.id, activeShift.summary_data, synced)
            }
        }

        try {
            // 1. Đọc từ localStorage nếu có danh sách sản phẩm (> 0 phần tử)
            const saved = localStorage.getItem(storageKey)
            if (saved !== null) {
                const parsed: ProductItem[] = JSON.parse(saved)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    applySyncedPinned(parsed, allProducts.length > 0, false)
                    return
                }
            }

            // Nếu người dùng đã chủ động bấm "Xóa hết ghim" cho ca này thì tôn trọng lựa chọn đó
            const userCleared = localStorage.getItem(`${storageKey}_cleared`) === '1'
            if (userCleared) {
                setPinnedProducts([])
                return
            }

            // 2. Khôi phục từ summary_data.pinned_products trong Database (delivery_shifts)
            const savedPinned = activeShift.summary_data?.pinned_products
            if (Array.isArray(savedPinned) && savedPinned.length > 0) {
                applySyncedPinned(savedPinned, allProducts.length > 0, false)
                return
            }

            // Các bước khôi phục từ Công việc mẫu & Lịch sử đợt cần allProducts đã tải xong
            if (allProducts.length === 0) {
                return
            }

            const restoredMap = new Map<string, ProductItem>()

            // 3. Khôi phục từ Công việc mẫu (khớp theo template_id hoặc tên công việc)
            const tplId = activeShift.summary_data?.template_id
            const jobNameLower = (activeShift.summary_data?.job_name || activeShift.notes || '').trim().toLowerCase()
            const matchedTpl = jobTemplatesList.find(t =>
                (tplId && t.id === tplId) ||
                (jobNameLower && t.name.trim().toLowerCase() === jobNameLower)
            )
            if (matchedTpl?.pinned_product_ids && matchedTpl.pinned_product_ids.length > 0) {
                matchedTpl.pinned_product_ids.forEach(pid => {
                    const prod = allProducts.find(p => p.id === pid)
                    if (prod && !restoredMap.has(prod.id)) {
                        restoredMap.set(prod.id, prod)
                    }
                })
            }

            // 4. Khôi phục bổ sung từ các sản phẩm đã phát sinh nhập/xuất trong ca này
            if (allJobJournals.length > 0) {
                const jobTagId = `[CV_ID: ${activeShift.id}]`
                const jobTagName = currentJobName ? `[CV: ${currentJobName}]` : ''
                allJobJournals.forEach(r => {
                    const notesStr = r.notes || ''
                    const belongsToShift = notesStr.includes(jobTagId)
                    if (!belongsToShift) return
                    const itemName = (r.item_name || '').trim()
                    if (!itemName) return
                    const prod = allProducts.find(p => p.name.trim() === itemName)
                    if (prod && !restoredMap.has(prod.id)) {
                        restoredMap.set(prod.id, { ...prod, unit: r.unit || prod.unit })
                    }
                })
            }

            if (restoredMap.size > 0) {
                const restoredList = Array.from(restoredMap.values())
                applySyncedPinned(restoredList, true, true)
                return
            }

            // Mặc định công việc mới chưa có ghim: giữ bàn làm việc trống
            setPinnedProducts([])
        } catch (e) {
            console.error('Failed to load pinned products from storage', e)
            setPinnedProducts([])
        }
    }, [storageKey, activeShift, allProducts, jobTemplatesList, allJobJournals, currentJobName, syncPinnedToDb])

    // Lưu danh sách ghim vào localStorage và đồng bộ lên DB theo công việc
    const updatePinnedProducts = (newList: ProductItem[], isUserClear = false) => {
        setPinnedProducts(newList)
        if (storageKey) {
            try {
                localStorage.setItem(storageKey, JSON.stringify(newList))
                if (isUserClear || newList.length === 0) {
                    localStorage.setItem(`${storageKey}_cleared`, '1')
                } else {
                    localStorage.removeItem(`${storageKey}_cleared`)
                }
            } catch (e) {
                console.error('Failed to save pinned products to storage', e)
            }
        }
        if (activeShift?.id) {
            syncPinnedToDb(activeShift.id, activeShift.summary_data, newList)
        }
    }

    // Tải danh mục đơn vị tính từ hệ thống
    const loadUnits = useCallback(async () => {
        try {
            let query = (supabase as any).from('units').select('name')
            if (currentSystem?.code) {
                query = query.or(`system_code.eq.${currentSystem.code},system_code.is.null`)
            }
            const { data, error } = await query
            if (!error && data) {
                const names = data.map((u: any) => u.name).filter(Boolean)
                const baseUnits = ['Kg', 'Thùng', 'Túi', 'Bao', 'Hộp', 'Cái', 'Cuộn', 'Cây', 'Tấn', 'Gam', 'Khay']
                const merged = Array.from(new Set([...baseUnits, ...names]))
                setAvailableUnits(merged)
            }
        } catch (err) {
            console.error('Error loading units:', err)
        }
    }, [currentSystem])

    // Đổi đơn vị tính cho sản phẩm trên bàn làm việc (dùng functional state để không bao giờ ghi đè mảng rỗng khi chuyển tab)
    const handleUnitChange = (productId: string, newUnit: string) => {
        setSelectedUnitMap(prev => ({ ...prev, [productId]: newUnit }))
        setPinnedProducts(prev => {
            if (prev.length === 0 || !prev.some(p => p.id === productId)) return prev
            const updated = prev.map(p => p.id === productId ? { ...p, unit: newUnit } : p)
            if (storageKey) {
                try {
                    localStorage.setItem(storageKey, JSON.stringify(updated))
                } catch (e) {}
            }
            return updated
        })
    }

    // 4. Tải danh mục sản phẩm từ DB kèm cấu hình đơn vị tính quy đổi chính xác từ /products (product_units & weight_kg)
    const loadProducts = useCallback(async () => {
        if (!currentSystem) return
        try {
            let productsQuery = (supabase as any)
                .from('products')
                .select('id, name, sku, unit, weight_kg, aliases, internal_code, internal_name')
                .order('name', { ascending: true })

            if (currentSystem.code) {
                productsQuery = productsQuery.or(`system_code.eq.${currentSystem.code},system_type.eq.${currentSystem.code}`)
            }

            const [productsRes, unitsRes, prodUnitsRes] = await Promise.all([
                productsQuery,
                (supabase as any).from('units').select('id, name'),
                (supabase as any).from('product_units').select('product_id, unit_id, conversion_rate')
            ])

            const unitsList = unitsRes.data || []
            const prodUnitsList = prodUnitsRes.data || []

            if (productsRes.data) {
                const enrichedProducts: ProductItem[] = productsRes.data.map((product: any) => {
                    const baseUnit = (product.unit || '').trim()
                    let baseWeight = Number(product.weight_kg) || 0
                    const normBase = normalizeUnit(baseUnit)
                    if (baseWeight <= 0 && (normBase === 'kg' || normBase === 'kilogram')) {
                        baseWeight = 1
                    }

                    const availableUnits = new Set<string>()
                    const formattedBaseUnit = formatUnitWeight(baseUnit, baseWeight)
                    if (baseUnit) availableUnits.add(formattedBaseUnit)

                    const pUnitsOfProduct = prodUnitsList.filter((pu: any) => pu.product_id === product.id)
                    pUnitsOfProduct.forEach((pu: any) => {
                        const u = unitsList.find((unit: any) => unit.id === pu.unit_id)
                        if (u) {
                            const normU = normalizeUnit(u.name)
                            if (normU === normalizeUnit(baseUnit)) return // Bỏ qua đơn vị gốc nếu trùng

                            const weight = (Number(pu.conversion_rate) || 1) * (baseWeight || 1)
                            const labelStr = formatUnitWeight(u.name, weight)
                            availableUnits.add(labelStr)
                        }
                    })

                    const options = Array.from(availableUnits)
                    return {
                        ...product,
                        available_units: options.length > 0 ? options : (baseUnit ? [baseUnit] : ['Kg'])
                    }
                })
                setAllProducts(enrichedProducts)
            }
        } catch (err) {
            console.error('Error loading products with units:', err)
        }
    }, [currentSystem])

    // 4.1 Tải danh sách công việc mẫu (luôn cập nhật từ database và đồng bộ khi focus)
    const refreshJobTemplates = useCallback(async () => {
        const sysCode = currentSystem?.code || shiftSystemCode || 'COLD'
        const companyId = currentSystem?.company_id || profile?.company_id
        try {
            const list = await getJobTemplates(sysCode, companyId)
            setJobTemplatesList(list)
        } catch (e) {
            console.error('Lỗi tải công việc mẫu:', e)
        }
    }, [shiftSystemCode, currentSystem, profile])

    useEffect(() => {
        refreshJobTemplates()
    }, [refreshJobTemplates])

    // Tự động tải lại mẫu công việc khi mở modal tạo công việc
    useEffect(() => {
        if (openShiftModal) {
            refreshJobTemplates()
        }
    }, [openShiftModal, refreshJobTemplates])

    // Tự động làm mới mẫu công việc khi người dùng quay lại tab trình duyệt từ trang Quản lý mẫu
    useEffect(() => {
        const handleFocus = () => refreshJobTemplates()
        window.addEventListener('focus', handleFocus)
        return () => window.removeEventListener('focus', handleFocus)
    }, [refreshJobTemplates])

    // 4.2 Xử lý query param ?applyTemplate=tpl_xxx từ trang Quản lý mẫu
    useEffect(() => {
        if (typeof window === 'undefined' || jobTemplatesList.length === 0) return
        const params = new URLSearchParams(window.location.search)
        const tplId = params.get('applyTemplate')
        if (tplId) {
            const found = jobTemplatesList.find(t => t.id === tplId)
            if (found) {
                setJobNameInput(found.name)
                setJobNotesInput(found.notes || '')
                setSelectedJobTemplate(found)
                setJobOpenedAtInput(formatDateTimeLocal(new Date()))
                setOpenShiftModal(true)
                const cleanUrl = window.location.pathname
                window.history.replaceState({}, '', cleanUrl)
            }
        }
    }, [jobTemplatesList])

    // 5. Tải danh sách tất cả các công việc đang mở (Multi-Job Shifts)
    const loadOpenShifts = useCallback(async () => {
        const companyId = currentSystem?.company_id || profile?.company_id
        if (!companyId || !shiftSystemCode) return
        try {
            const { data, error } = await (supabase as any)
                .from('delivery_shifts')
                .select('*')
                .eq('company_id', companyId)
                .eq('system_code', shiftSystemCode)
                .eq('status', 'open')
                .order('opened_at', { ascending: true })

            if (!error && data) {
                setOpenShifts(data)
                if (data.length > 0) {
                    setSelectedShiftId(prev => {
                        if (prev && data.some((s: any) => s.id === prev)) return prev
                        if (typeof window !== 'undefined' && shiftSystemCode) {
                            try {
                                const savedId = localStorage.getItem(`so_lieu_selected_shift_${shiftSystemCode}`)
                                if (savedId && data.some((s: any) => s.id === savedId)) return savedId
                            } catch (e) {}
                        }
                        return data[0].id
                    })
                } else {
                    setSelectedShiftId(null)
                    setSubShifts([])
                }
            } else {
                setOpenShifts([])
                setSelectedShiftId(null)
                setSubShifts([])
            }
        } catch (err) {
            console.error('Error loading open job shifts:', err)
        }
    }, [shiftSystemCode, currentSystem, profile])

    // Tải các đợt chốt tạm của công việc đang chọn (nếu công việc đang mở mà có đợt cuối tự động tạo lúc Hoàn thành CV trước đó thì gỡ ra để tiếp tục đếm đợt đó)
    const loadSubShifts = useCallback(async (shiftId: string) => {
        if (!shiftSystemCode) return
        try {
            const { data, error } = await (supabase as any)
                .from('delivery_sub_shifts')
                .select('*')
                .eq('shift_id', shiftId)
                .eq('system_code', shiftSystemCode)
                .order('sub_shift_number', { ascending: true })
            if (!error && data) {
                const autoFinal = data.filter((ss: any) =>
                    typeof ss.notes === 'string' && ss.notes.includes('Chốt đợt cuối') && ss.notes.includes('(Hoàn thành CV)')
                )
                if (autoFinal.length > 0) {
                    const ids = autoFinal.map((ss: any) => ss.id)
                    await (supabase as any)
                        .from('delivery_sub_shifts')
                        .delete()
                        .in('id', ids)
                        .eq('system_code', shiftSystemCode)
                    setSubShifts(data.filter((ss: any) => !ids.includes(ss.id)))
                } else {
                    setSubShifts(data)
                }
            }
        } catch (err) {
            console.error('Error loading sub-shifts:', err)
        }
    }, [shiftSystemCode])

    // Tải nhật ký ghi nhận (Delivery Journal) của công việc đang chọn
    const loadJournalData = useCallback(async () => {
        if (!shiftSystemCode) return
        const companyId = currentSystem?.company_id || profile?.company_id
        if (!companyId || !activeShift) {
            setJournalList([])
            setAllJobJournals([])
            return
        }

        setLoadingData(true)
        try {
            // 1. Ưu tiên lọc tuyệt đối theo CV_ID của công việc hiện tại (đảm bảo cô lập 100% giữa các công việc cùng tên)
            let { data, error } = await (supabase as any)
                .from('delivery_journal')
                .select('*')
                .eq('company_id', companyId)
                .eq('system_code', shiftSystemCode)
                .ilike('notes', `%[CV_ID: ${activeShift.id}]%`)
                .order('sent_at', { ascending: false })

            // 2. Chỉ fallback theo tên công việc đối với các công việc cổ ngày xưa chưa từng được đánh tag CV_ID
            if (!error && (!data || data.length === 0) && currentJobName) {
                const { data: legacyData } = await (supabase as any)
                    .from('delivery_journal')
                    .select('*')
                    .eq('company_id', companyId)
                    .eq('system_code', shiftSystemCode)
                    .gte('sent_at', activeShift.opened_at)
                    .ilike('notes', `%[CV: ${currentJobName}]%`)
                    .not('notes', 'ilike', '%[CV_ID:%')
                    .order('sent_at', { ascending: false })
                if (legacyData && legacyData.length > 0) {
                    data = legacyData
                }
            }

            if (!error && data) {
                const allList = data as DeliveryJournalRecord[]
                setAllJobJournals(allList)
                if (viewMode === 'sub-shift' && subShifts.length > 0) {
                    const latestSub = subShifts[subShifts.length - 1]
                    setJournalList(allList.filter(l => l.sent_at >= latestSub.to_time))
                } else {
                    setJournalList(allList)
                }

                // TỰ ĐỘNG ĐỒNG BỘ ĐƠN VỊ TÍNH THEO NHẬT KÝ THỰC TẾ TRONG CA:
                // Nếu sản phẩm đã phát sinh số liệu với một đơn vị cụ thể trong ca (ví dụ Thùng 9.6kg),
                // tự động chuyển đơn vị trên bàn làm việc về đơn vị đó để khớp số liệu tức thì.
                if (allList.length > 0) {
                    const latestUnitByProduct: Record<string, string> = {}
                    // Duyệt từ cũ đến mới (để bản ghi mới nhất ghi đè)
                    const reversed = [...allList].reverse()
                    reversed.forEach(r => {
                        const name = (r.item_name || '').trim()
                        if (name && r.unit) {
                            latestUnitByProduct[name] = r.unit
                        }
                    })

                    setSelectedUnitMap(prev => {
                        const next = { ...prev }
                        let changed = false
                        pinnedProducts.forEach(p => {
                            const targetUnit = latestUnitByProduct[p.name.trim()]
                            if (targetUnit && next[p.id] !== targetUnit) {
                                next[p.id] = targetUnit
                                changed = true
                            }
                        })
                        return changed ? next : prev
                    })
                }
            }
        } catch (err) {
            console.error('Error loading journal data:', err)
        } finally {
            setLoadingData(false)
        }
    }, [shiftSystemCode, currentSystem, profile, activeShift, currentJobName, viewMode, subShifts])

    // Tải danh sách các công việc cho mục Báo cáo & Lịch sử ca (cả đang mở và đã hoàn thành)
    const loadPastShifts = async (range: 'today' | '7d' | '30d' | 'all' = doneRange) => {
        if (!shiftSystemCode) return
        const companyId = currentSystem?.company_id || profile?.company_id
        if (!companyId) return
        setDoneListLoading(true)
        try {
            let query = (supabase as any)
                .from('delivery_shifts')
                .select('*')
                .eq('company_id', companyId)
                .eq('system_code', shiftSystemCode)
                .order('opened_at', { ascending: false })
                .limit(200)

            if (range !== 'all') {
                const from = new Date()
                from.setHours(0, 0, 0, 0)
                if (range === '7d') from.setDate(from.getDate() - 6)
                if (range === '30d') from.setDate(from.getDate() - 29)
                query = query.gte('opened_at', from.toISOString())
            }

            const { data, error } = await query
            if (error) throw error
            const list = data || []
            setPastShifts(list)
            if (list.length > 0 && !doneSelectedId && typeof window !== 'undefined' && window.innerWidth >= 640) {
                selectDoneShift(list[0])
            }
        } catch (err) {
            console.error('Error loading past shifts:', err)
            setPastShifts([])
        } finally {
            setDoneListLoading(false)
        }
    }

    // Tải chi tiết các dòng số liệu & các lần chốt ca tạm của 1 công việc
    const loadDoneLines = async (shift: any) => {
        if (!shiftSystemCode || !shift) return
        const companyId = currentSystem?.company_id || profile?.company_id
        if (!companyId) return
        const jobName = shift.summary_data?.job_name || ''
        setDoneLinesLoading(true)
        try {
            // 1. Ưu tiên lọc tuyệt đối theo CV_ID của công việc
            const [idLinesRes, subRes] = await Promise.all([
                (supabase as any)
                    .from('delivery_journal')
                    .select('*')
                    .eq('company_id', companyId)
                    .eq('system_code', shiftSystemCode)
                    .ilike('notes', `%[CV_ID: ${shift.id}]%`)
                    .order('sent_at', { ascending: true }),
                (supabase as any)
                    .from('delivery_sub_shifts')
                    .select('*')
                    .eq('shift_id', shift.id)
                    .eq('system_code', shiftSystemCode)
                    .order('sub_shift_number', { ascending: true })
            ])

            let linesData = idLinesRes?.data || []
            // 2. Chỉ fallback theo tên công việc cho các ca cổ chưa có gắn tag CV_ID
            if (linesData.length === 0 && jobName) {
                let fallbackQuery = (supabase as any)
                    .from('delivery_journal')
                    .select('*')
                    .eq('company_id', companyId)
                    .eq('system_code', shiftSystemCode)
                    .gte('sent_at', shift.opened_at)
                    .ilike('notes', `%[CV: ${jobName}]%`)
                    .not('notes', 'ilike', '%[CV_ID:%')
                    .order('sent_at', { ascending: true })
                if (shift.closed_at) fallbackQuery = fallbackQuery.lte('sent_at', shift.closed_at)
                const { data: fbData } = await fallbackQuery
                linesData = fbData || []
            }
            setDoneLines(linesData)
            setDoneSubShifts(subRes?.data || [])
        } catch (err) {
            console.error('Error loading done job lines:', err)
            setDoneLines([])
            setDoneSubShifts([])
        } finally {
            setDoneLinesLoading(false)
        }
    }

    const toggleExpandDoneSubShift = (id: string) => {
        setExpandedDoneSubShifts(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleExpandFeedSubShift = (id: string) => {
        setExpandedFeedSubShifts(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const selectDoneShift = (shift: any) => {
        setDoneSelectedId(shift.id)
        setDoneTab('summary')
        setExpandedDoneSubShifts(new Set())
        setIsMainSummaryExpanded(false)
        setIsTwoWayExpanded(false)
        setIsUnitsExpanded(false)
        loadDoneLines(shift)
    }

    // Mở modal xác nhận xóa công việc đang làm (đẹp mắt, thay thế popup mặc định của trình duyệt)
    const handleDeleteOpenShift = (shiftId: string, shiftName?: string) => {
        const targetShift = openShifts.find(s => s.id === shiftId) || (activeShift?.id === shiftId ? activeShift : null)
        const jobTitle = shiftName || targetShift?.summary_data?.job_name || targetShift?.notes || 'Công việc'

        // Kiểm tra xem công việc này có phát sinh đợt số liệu nào chưa
        const shiftRecords = allJobJournals.filter(j =>
            j.notes && j.notes.includes(`[CV_ID: ${shiftId}]`)
        )

        setDeleteTargetShift({
            id: shiftId,
            title: jobTitle,
            recordCount: shiftRecords.length
        })
    }

    // Thực hiện xóa công việc sau khi bấm Xác nhận trên Modal
    const confirmDeleteShift = async () => {
        if (!deleteTargetShift) return
        const { id: shiftId, title: jobTitle } = deleteTargetShift
        setIsDeletingShift(true)

        try {
            if (shiftSystemCode) {
                // 1. Xóa các lượt ghi nhận số liệu của công việc này
                await (supabase as any)
                    .from('delivery_journal')
                    .delete()
                    .eq('system_code', shiftSystemCode)
                    .ilike('notes', `%[CV_ID: ${shiftId}]%`)

                // 2. Xóa các đợt chốt tạm
                await (supabase as any)
                    .from('delivery_sub_shifts')
                    .delete()
                    .eq('shift_id', shiftId)
                    .eq('system_code', shiftSystemCode)

                // 3. Xóa ca công việc
                const { error } = await (supabase as any)
                    .from('delivery_shifts')
                    .delete()
                    .eq('id', shiftId)
                    .eq('system_code', shiftSystemCode)

                if (error) throw error
            }

            // 4. Xóa dữ liệu lưu ghim trên máy
            try {
                localStorage.removeItem(`so_lieu_pinned_job_${shiftId}`)
                localStorage.removeItem(`so_lieu_pinned_job_${shiftId}_cleared`)
            } catch (e) {}

            showToast(`Đã xóa công việc "${jobTitle}"`, 'out')
            setDeleteTargetShift(null)

            // 5. Cập nhật state danh sách công việc đang mở
            const remaining = openShifts.filter(s => s.id !== shiftId)
            setOpenShifts(remaining)

            if (selectedShiftId === shiftId) {
                if (remaining.length > 0) {
                    setSelectedShiftId(remaining[0].id)
                } else {
                    setSelectedShiftId(null)
                    setPinnedProducts([])
                    setAllJobJournals([])
                    setJournalList([])
                    setSubShifts([])
                    setPadProduct(null)
                    setDraftQtyMap({})
                }
            }

            await Promise.all([loadOpenShifts(), loadPastShifts(doneRange)])
        } catch (err: any) {
            alert('Lỗi xóa công việc: ' + (err?.message || err))
        } finally {
            setIsDeletingShift(false)
        }
    }

    const handleDeleteDoneShift = async (shiftId: string) => {
        const password = prompt('Nhập mật khẩu xác nhận xóa báo cáo công việc:')
        if (password === null) return
        if (password !== 'Chanhthu@123') {
            alert('Mật khẩu không chính xác!')
            return
        }
        if (!confirm('Bạn có chắc chắn muốn xóa báo cáo công việc này? Hành động này không thể hoàn tác.')) return
        try {
            const { error } = await (supabase as any)
                .from('delivery_shifts')
                .delete()
                .eq('id', shiftId)
                .eq('system_code', shiftSystemCode)
            if (error) throw error
            setDoneSelectedId(null)
            await Promise.all([loadOpenShifts(), loadPastShifts(doneRange)])
            showToast('Đã xóa báo cáo công việc', 'out')
        } catch (err: any) {
            alert('Lỗi xóa báo cáo: ' + (err?.message || err))
        }
    }

    const openDoneView = () => {
        setPageView('done')
        loadPastShifts(doneRange)
    }

    // Mở lại công việc đã hoàn thành (nếu chốt nhầm)
    const handleReopenShift = async (shift: any) => {
        const jobName = shift.summary_data?.job_name || shift.notes || 'Công việc'
        if (!confirm(`Mở lại công việc "${jobName}" để tiếp tục nhập số liệu?`)) return
        try {
            const { error } = await (supabase as any)
                .from('delivery_shifts')
                .update({ status: 'open', closed_at: null, closed_by: null, closed_by_name: null })
                .eq('id', shift.id)
                .eq('system_code', shiftSystemCode)
            if (error) throw error

            // Nếu lúc bấm Hoàn thành CV hệ thống có tự chốt đợt cuối, gỡ đợt cuối đó ra để tiếp tục nhập vào đợt hiện tại
            await (supabase as any)
                .from('delivery_sub_shifts')
                .delete()
                .eq('shift_id', shift.id)
                .eq('system_code', shiftSystemCode)
                .ilike('notes', '%Chốt đợt cuối%(Hoàn thành CV)%')

            await Promise.all([loadOpenShifts(), loadPastShifts(doneRange)])
            setSelectedShiftId(shift.id)
            setDoneSelectedId(null)
            setPageView('active')
            showToast(`Đã mở lại công việc "${jobName}"`, 'in')
        } catch (err: any) {
            alert('Lỗi mở lại công việc: ' + (err?.message || err))
        }
    }

    // Đổi ngày & giờ mở công việc (hữu ích khi người dùng quên lùi ngày lúc tạo ca nhập bù)
    const handleUpdateShiftOpenedAt = async (shift: any) => {
        if (!shift?.id) return
        const currentOpenedVal = formatDateTimeLocal(new Date(shift.opened_at))
        const inputVal = window.prompt(
            'Nhập ngày & giờ mở công việc (Định dạng YYYY-MM-DDTHH:mm):\nVí dụ hôm qua lúc 8h sáng: 2026-11-09T08:00',
            currentOpenedVal
        )
        if (!inputVal) return
        const d = new Date(inputVal)
        if (isNaN(d.getTime())) {
            alert('Định dạng thời gian không hợp lệ!')
            return
        }
        try {
            const newIso = d.toISOString()
            const { error } = await (supabase.from('delivery_shifts') as any)
                .update({ opened_at: newIso })
                .eq('id', shift.id)
            if (error) throw error
            setPastShifts(prev => prev.map(s => s.id === shift.id ? { ...s, opened_at: newIso } : s))
            setOpenShifts(prev => prev.map(s => s.id === shift.id ? { ...s, opened_at: newIso } : s))
            showToast('Đã cập nhật ngày giờ mở công việc!', 'in')
        } catch (err: any) {
            alert('Lỗi cập nhật thời gian mở: ' + (err?.message || err))
        }
    }

    // Ghép danh sách các lần chốt ca tạm (tự động gom thêm đợt cuối nếu sau lần chốt tạm cuối cùng vẫn còn nhập liệu rồi bấm Hoàn thành CV luôn)
    const buildEffectiveSubShifts = (subShiftList: any[], lines: DeliveryJournalRecord[], shift: any) => {
        if (!subShiftList || subShiftList.length === 0) return []
        const result = subShiftList.map((ss, idx) => {
            const prevToTime = idx > 0 ? subShiftList[idx - 1].to_time : ss.from_time
            const subLines = lines.filter(l =>
                idx === 0
                    ? (l.sent_at >= ss.from_time && l.sent_at <= ss.to_time)
                    : (l.sent_at > prevToTime && l.sent_at <= ss.to_time)
            )
            return {
                ...ss,
                _subLines: subLines,
                is_auto_final: false,
            }
        })

        const lastSS = subShiftList[subShiftList.length - 1]
        const remainingLines = lines.filter(l => l.sent_at > lastSS.to_time)
        if (remainingLines.length > 0) {
            const lastLine = remainingLines[remainingLines.length - 1]
            const prodsMap: Record<string, { product_name: string; unit: string; in_qty: number; out_qty: number }> = {}
            remainingLines.forEach(l => {
                const u = l.unit || 'Thùng'
                const pName = l.item_name || 'Hàng hóa'
                const isImp = l.to_department === 'Kho'
                const q = Number(l.quantity_sent) || 0
                const key = `${pName}_${u}`
                if (!prodsMap[key]) prodsMap[key] = { product_name: pName, unit: u, in_qty: 0, out_qty: 0 }
                if (isImp) prodsMap[key].in_qty += q
                else prodsMap[key].out_qty += q
            })
            result.push({
                id: `auto_final_${shift?.id || 'shift'}`,
                shift_id: shift?.id,
                sub_shift_number: subShiftList.length + 1,
                from_time: lastSS.to_time,
                to_time: shift?.closed_at || lastLine.sent_at,
                closed_by_name: shift?.closed_by_name || lastLine.sent_by_name || 'Nhân viên',
                notes: shift?.status === 'closed'
                    ? 'Đợt cuối ca (tự động tính khi bấm Hoàn thành CV)'
                    : 'Đợt đang nhập (chưa bấm Chốt tạm)',
                summary_data: {
                    job_name: shift?.summary_data?.job_name || '',
                    total_records: remainingLines.length,
                    products_summary: prodsMap,
                },
                _subLines: remainingLines,
                is_auto_final: true,
            })
        }
        return result
    }

    // Xuất Excel báo cáo 1 công việc đã hoàn thành
    const handleExportDoneShift = async (shift: any, lines: DeliveryJournalRecord[]) => {
        try {
            const ExcelJS = (await import('exceljs')).default
            const wb = new ExcelJS.Workbook()
            const jobName = shift.summary_data?.job_name || shift.notes || 'Công việc'

            const ws1 = wb.addWorksheet('Tổng hợp')
            ws1.addRow([`BÁO CÁO CÔNG VIỆC: ${jobName}`]).font = { bold: true, size: 14 }
            ws1.addRow([`Kho: ${currentSystem?.name || ''}`])
            ws1.addRow([`Thời gian: ${formatDateTime(shift.opened_at)} → ${formatDateTime(shift.closed_at)}`])
            ws1.addRow([`Người chốt: ${shift.closed_by_name || ''}`])
            ws1.addRow([])
            const h1 = ws1.addRow(['STT', 'Sản phẩm', 'ĐVT', 'Tổng nhập (+)', 'Tổng xuất (-)', 'Số đợt'])
            h1.font = { bold: true }
            summarizeLines(lines).forEach((r, i) => ws1.addRow([i + 1, r.product_name, r.unit, r.in_qty, r.out_qty, r.count]))
            ws1.columns = [{ width: 6 }, { width: 50 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 10 }]

            const ws2 = wb.addWorksheet('Chi tiết')
            const h2 = ws2.addRow(['STT', 'Thời gian', 'Đợt', 'Sản phẩm', 'Loại', 'Số lượng', 'ĐVT', 'Người thực hiện'])
            h2.font = { bold: true }
            lines.forEach((l, i) => {
                const isImport = l.to_department === 'Kho'
                ws2.addRow([i + 1, formatDateTime(l.sent_at), l.delivery_code || '', l.item_name, isImport ? 'Nhập' : 'Xuất', l.quantity_sent, l.unit, l.sent_by_name || ''])
            })
            ws2.columns = [{ width: 6 }, { width: 20 }, { width: 10 }, { width: 50 }, { width: 8 }, { width: 10 }, { width: 16 }, { width: 22 }]

            const effectiveSubs = buildEffectiveSubShifts(doneSubShifts, lines, shift)
            if (effectiveSubs.length > 0) {
                const ws3 = wb.addWorksheet('Chốt ca tạm')
                const h3 = ws3.addRow(['Đợt chốt tạm', 'Từ lúc', 'Đến lúc', 'Người chốt tạm', 'Sản phẩm', 'ĐVT', 'Nhập (+)', 'Xuất (-)', 'Ghi chú'])
                h3.font = { bold: true }
                effectiveSubs.forEach(ss => {
                    const subLines: DeliveryJournalRecord[] = ss._subLines || []
                    const prods = subLines.length > 0
                        ? summarizeLines(subLines)
                        : Object.values(ss.summary_data?.products_summary || {}).map((p: any) => ({
                            product_name: p.product_name,
                            unit: p.unit,
                            in_qty: p.in_qty || 0,
                            out_qty: p.out_qty || 0,
                            count: (p.in_count || 0) + (p.out_count || 0)
                        }))
                    if (prods.length === 0) {
                        ws3.addRow([`Lần #${ss.sub_shift_number}`, formatDateTime(ss.from_time), formatDateTime(ss.to_time), ss.closed_by_name || '', '(Không phát sinh)', '', 0, 0, ss.notes || ''])
                    } else {
                        prods.forEach(p => {
                            ws3.addRow([`Lần #${ss.sub_shift_number}`, formatDateTime(ss.from_time), formatDateTime(ss.to_time), ss.closed_by_name || '', p.product_name, p.unit, p.in_qty, p.out_qty, ss.notes || ''])
                        })
                    }
                })
                ws3.columns = [{ width: 14 }, { width: 20 }, { width: 20 }, { width: 22 }, { width: 45 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 30 }]
            }

            const buf = await wb.xlsx.writeBuffer()
            const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            const day = shift.closed_at ? new Date(shift.closed_at).toISOString().slice(0, 10) : ''
            a.href = url
            a.download = `So-lieu_${jobName.replace(/[\\/:*?"<>|]/g, '_')}_${day}.xlsx`
            a.click()
            URL.revokeObjectURL(url)
        } catch (err: any) {
            alert('Lỗi xuất Excel: ' + (err?.message || err))
        }
    }

    // Helper lấy chuỗi YYYY-MM-DD theo giờ địa phương
    const getShiftLocalDateString = (isoString?: string) => {
        if (!isoString) return ''
        const d = new Date(isoString)
        if (isNaN(d.getTime())) return ''
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    }

    // Tải các dòng số liệu cho danh sách nhiều công việc (báo cáo ngày hoặc tùy chọn)
    const fetchLinesForShifts = useCallback(async (shifts: any[]): Promise<DeliveryJournalRecord[]> => {
        if (!shifts || shifts.length === 0 || !shiftSystemCode) return []
        const companyId = currentSystem?.company_id || profile?.company_id
        if (!companyId) return []

        try {
            const allLines: DeliveryJournalRecord[] = []

            await Promise.all(
                shifts.map(async s => {
                    const jobName = s.summary_data?.job_name || ''
                    // 1. Tìm theo CV_ID
                    const { data: idData } = await (supabase as any)
                        .from('delivery_journal')
                        .select('*')
                        .eq('company_id', companyId)
                        .eq('system_code', shiftSystemCode)
                        .ilike('notes', `%[CV_ID: ${s.id}]%`)
                        .order('sent_at', { ascending: true })

                    let sLines = (idData || []) as DeliveryJournalRecord[]

                    // 2. Fallback cho các ca cổ chưa được gắn tag CV_ID (giống loadDoneLines)
                    if (sLines.length === 0 && jobName) {
                        let fallbackQuery = (supabase as any)
                            .from('delivery_journal')
                            .select('*')
                            .eq('company_id', companyId)
                            .eq('system_code', shiftSystemCode)
                            .gte('sent_at', s.opened_at)
                            .ilike('notes', `%[CV: ${jobName}]%`)
                            .not('notes', 'ilike', '%[CV_ID:%')
                            .order('sent_at', { ascending: true })
                        if (s.closed_at) fallbackQuery = fallbackQuery.lte('sent_at', s.closed_at)
                        const { data: fbData } = await fallbackQuery
                        if (fbData && fbData.length > 0) {
                            sLines = fbData.map((l: any) => ({
                                ...l,
                                notes: `${l.notes || ''} [CV_ID: ${s.id}]`
                            }))
                        }
                    }

                    allLines.push(...sLines)
                })
            )

            return allLines
        } catch (err) {
            console.error('Lỗi tải nhật ký nhiều công việc:', err)
            return []
        }
    }, [currentSystem, profile, shiftSystemCode])

    // Helper tự động đối soát tìm mã SKU của sản phẩm theo tên hoặc ID
    const findProductSku = useCallback((pName: string, pId?: string, pinnedList?: any[]) => {
        const cleanName = (pName || '').trim().toLowerCase()
        if (!cleanName && !pId) return ''

        // 1. Tìm trong danh sách sản phẩm đã ghim của ca
        if (pinnedList && pinnedList.length > 0) {
            const foundPin = pinnedList.find((pin: any) =>
                (pId && pin.id === pId) ||
                ((pin.name || '').trim().toLowerCase() === cleanName)
            )
            if (foundPin?.sku) return foundPin.sku
        }

        // 2. Tìm trong danh mục sản phẩm toàn kho (allProducts)
        if (allProducts && allProducts.length > 0) {
            const foundAll = allProducts.find((ap: any) =>
                (pId && ap.id === pId) ||
                ((ap.name || '').trim().toLowerCase() === cleanName)
            )
            if (foundAll?.sku) return foundAll.sku
            if ((foundAll as any)?.code) return (foundAll as any).code

            // 3. Fallback tìm tương đối nếu tên có khác biệt nhẹ khoảng trắng/ký tự
            const foundApprox = allProducts.find((ap: any) => {
                const aName = (ap.name || '').trim().toLowerCase()
                return aName.length > 3 && (aName.includes(cleanName) || cleanName.includes(aName))
            })
            if (foundApprox?.sku) return foundApprox.sku
            if ((foundApprox as any)?.code) return (foundApprox as any).code
        }

        return ''
    }, [allProducts])

    // Hàm gom số liệu mặt hàng tổng hợp từ nhiều công việc (kết hợp thông minh giữa dòng nhật ký và summary_data của từng ca)
    const aggregateShiftsProducts = (shifts: any[], lines: DeliveryJournalRecord[]) => {
        const prodMap: Record<string, {
            product_id?: string;
            sku?: string;
            product_name: string;
            unit: string;
            in_qty: number;
            out_qty: number;
            count: number;
            jobs: { id: string; name: string; in_qty: number; out_qty: number }[];
        }> = {}

        shifts.forEach((s, sIdx) => {
            const jobName = s.summary_data?.job_name || s.notes?.replace(/\[CV:[^\]]*\]/g, '').replace(/\[CV_ID:[^\]]*\]/g, '').trim() || `Công việc #${sIdx + 1}`
            const sLines = lines.filter(l => (l.notes || '').includes(`[CV_ID: ${s.id}]`))
            const rawProds = sLines.length > 0
                ? summarizeLines(sLines, s)
                : Object.values(s.summary_data?.products_summary || {}).map((p: any) => ({
                    product_id: p.product_id,
                    sku: p.sku || '',
                    product_name: p.product_name,
                    unit: p.unit,
                    in_qty: Number(p.in_qty) || 0,
                    out_qty: Number(p.out_qty) || 0,
                    count: (Number(p.in_count) || 0) + (Number(p.out_count) || 0)
                }))

            rawProds.forEach(p => {
                const u = cleanUnitLabel(p.unit) || p.unit || 'ĐVT'
                const key = `${(p.product_name || '').trim()}___${u}`
                const inQ = Number(p.in_qty) || 0
                const outQ = Number(p.out_qty) || 0

                if (!prodMap[key]) {
                    prodMap[key] = {
                        product_id: p.product_id,
                        sku: p.sku || '',
                        product_name: p.product_name,
                        unit: u,
                        in_qty: 0,
                        out_qty: 0,
                        count: 0,
                        jobs: []
                    }
                }
                prodMap[key].in_qty += inQ
                prodMap[key].out_qty += outQ
                prodMap[key].count += Number(p.count) || 1

                // Ghi nhận tên công việc chứa sản phẩm này
                const existingJob = prodMap[key].jobs.find(j => j.id === s.id)
                if (!existingJob) {
                    prodMap[key].jobs.push({
                        id: s.id,
                        name: jobName,
                        in_qty: inQ,
                        out_qty: outQ
                    })
                } else {
                    existingJob.in_qty += inQ
                    existingJob.out_qty += outQ
                }
            })
        })

        return Object.values(prodMap)
    }

    // Xuất Excel tổng hợp cho nhiều công việc (Báo cáo theo ngày hoặc Báo cáo tùy chọn)
    const handleExportMultiShifts = async (
        reportTitle: string,
        shifts: any[],
        lines: DeliveryJournalRecord[],
        fileName: string
    ) => {
        try {
            const ExcelJS = (await import('exceljs')).default
            const wb = new ExcelJS.Workbook()

            // 1. Sheet Tổng hợp
            const ws1 = wb.addWorksheet('Tổng hợp')
            const titleRow = ws1.addRow([reportTitle.toUpperCase()])
            titleRow.font = { bold: true, size: 14 }
            ws1.addRow([`Kho: ${currentSystem?.name || ''}`])
            ws1.addRow([`Số công việc tham gia: ${shifts.length} công việc`])
            ws1.addRow([`Thời gian xuất: ${formatDateTime(new Date().toISOString())}`])
            ws1.addRow([])

            // Bảng mặt hàng
            const hSec1 = ws1.addRow(['1. TỔNG HỢP THEO MẶT HÀNG'])
            hSec1.font = { bold: true, size: 11 }
            const h1 = ws1.addRow(['STT', 'Sản phẩm', 'Công việc', 'ĐVT', 'Tổng nhập (+)', 'Tổng xuất (-)', 'Số đợt'])
            h1.font = { bold: true }
            h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }

            const prodRows = aggregateShiftsProducts(shifts, lines)

            prodRows.forEach((r, idx) => {
                const jobListStr = (r.jobs || []).map((j: any) => j.name).join(', ')
                ws1.addRow([
                    idx + 1,
                    r.product_name,
                    jobListStr,
                    r.unit,
                    r.in_qty,
                    r.out_qty,
                    r.count
                ])
            })
            ws1.addRow([])

            // Bảng Đơn vị tính
            const hSec2 = ws1.addRow(['2. TỔNG HỢP THEO ĐƠN VỊ TÍNH'])
            hSec2.font = { bold: true, size: 11 }
            const h2 = ws1.addRow(['STT', 'Đơn vị tính', 'Tổng nhập (+)', 'Tổng xuất (-)'])
            h2.font = { bold: true }
            h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }

            const unitMap: Record<string, { unit: string; in_qty: number; out_qty: number }> = {}
            prodRows.forEach(r => {
                const u = r.unit || 'ĐVT'
                if (!unitMap[u]) unitMap[u] = { unit: u, in_qty: 0, out_qty: 0 }
                unitMap[u].in_qty += r.in_qty
                unitMap[u].out_qty += r.out_qty
            })
            Object.values(unitMap).forEach((u, idx) => {
                ws1.addRow([
                    idx + 1,
                    u.unit,
                    u.in_qty,
                    u.out_qty
                ])
            })
            ws1.addRow([])

            // Bảng Danh sách công việc
            const hSec3 = ws1.addRow(['3. DANH SÁCH CÁC CÔNG VIỆC'])
            hSec3.font = { bold: true, size: 11 }
            const h3 = ws1.addRow(['STT', 'Tên công việc', 'Trạng thái', 'Mở lúc', 'Đóng lúc', 'Người phụ trách', 'Số SP', 'Số đợt'])
            h3.font = { bold: true }
            h3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }

            shifts.forEach((s, idx) => {
                const pCount = Object.keys(s.summary_data?.products_summary || {}).length
                const rCount = s.summary_data?.total_records ?? 0
                ws1.addRow([
                    idx + 1,
                    s.summary_data?.job_name || s.notes || `Công việc #${idx + 1}`,
                    s.status === 'closed' ? 'Đã chốt' : 'Đang mở',
                    formatDateTime(s.opened_at),
                    s.closed_at ? formatDateTime(s.closed_at) : 'Chưa chốt',
                    s.closed_by_name || s.opened_by_name || '',
                    pCount,
                    rCount
                ])
            })

            ws1.columns = [
                { width: 6 },
                { width: 45 },
                { width: 18 },
                { width: 14 },
                { width: 14 },
                { width: 14 },
                { width: 18 },
                { width: 10 }
            ]

            // 2. Sheet Chi tiết nhật ký
            if (lines.length > 0) {
                const ws2 = wb.addWorksheet('Chi tiết đợt')
                const hLine = ws2.addRow(['STT', 'Thời gian', 'Mã công việc', 'Đợt', 'Sản phẩm', 'Loại', 'Số lượng', 'ĐVT', 'Người thực hiện', 'Ghi chú'])
                hLine.font = { bold: true }
                hLine.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }

                const shiftMap: Record<string, string> = {}
                shifts.forEach(s => {
                    shiftMap[s.id] = s.summary_data?.job_name || s.notes || 'Công việc'
                })

                lines.forEach((l, idx) => {
                    const isImport = l.to_department === 'Kho'
                    const m = (l.notes || '').match(/\[CV_ID:\s*([^\]]+)\]/i)
                    const sId = m ? m[1].trim() : ''
                    const jName = shiftMap[sId] || ''
                    ws2.addRow([
                        idx + 1,
                        formatDateTime(l.sent_at),
                        jName,
                        l.delivery_code || '',
                        l.item_name,
                        isImport ? 'Nhập (+)' : 'Xuất (-)',
                        l.quantity_sent,
                        l.unit,
                        l.sent_by_name || '',
                        l.notes || ''
                    ])
                })

                ws2.columns = [
                    { width: 6 },
                    { width: 20 },
                    { width: 30 },
                    { width: 10 },
                    { width: 45 },
                    { width: 12 },
                    { width: 12 },
                    { width: 14 },
                    { width: 22 },
                    { width: 30 }
                ]
            }

            const buf = await wb.xlsx.writeBuffer()
            const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${fileName}.xlsx`
            a.click()
            URL.revokeObjectURL(url)
        } catch (err: any) {
            alert('Lỗi xuất Excel: ' + (err?.message || err))
        }
    }

    // Chuẩn bị dữ liệu phiếu kết toán Nhập / Xuất từ công việc đã chọn (Dựa trực tiếp vào MÃ SẢN PHẨM / ID đã ghim)
    const buildSettlementData = (shift: any, rows: any[], type: 'in' | 'out') => {
        const jobTitle = shift.summary_data?.job_name || shift.notes || 'Công việc'
        const isImport = type === 'in'
        const relevantRows = rows.filter(r => (Number(isImport ? r.in_qty : r.out_qty) || 0) > 0)
        const pinnedList: ProductItem[] = shift?.summary_data?.pinned_products || []

        const items = relevantRows.map((r, idx) => {
            const qty = Number(isImport ? r.in_qty : r.out_qty) || 0
            const rName = (r.product_name || '').trim().toLowerCase()
            const cleanUnit = cleanUnitLabel(r.unit) || r.unit

            // 1. ƯU TIÊN SỐ 1: Match trực tiếp theo product_id từ danh sách sản phẩm ĐÃ GHIM của công việc này
            let foundProd: any = r.product_id
                ? (pinnedList.find(p => p.id === r.product_id) || allProducts.find(p => p.id === r.product_id))
                : undefined

            // 2. ƯU TIÊN SỐ 2: Match theo mã SKU đã ghim trong công việc
            if (!foundProd && r.sku) {
                foundProd = pinnedList.find(p => p.sku === r.sku) || allProducts.find(p => p.sku === r.sku)
            }

            // 3. ƯU TIÊN SỐ 3: Tìm chính xác trong danh sách sản phẩm ĐÃ GHIM (pinned_products) của ca này
            if (!foundProd) {
                foundProd = pinnedList.find(p => (p.name || '').trim().toLowerCase() === rName)
            }

            // 4. ƯU TIÊN SỐ 4: Match chính xác 100% trong toàn bộ danh mục sản phẩm (theo ID, SKU, hoặc Tên)
            if (!foundProd) {
                foundProd = allProducts.find(p => (p.name || '').trim().toLowerCase() === rName) ||
                            allProducts.find(p => p.sku && p.sku.trim().toLowerCase() === rName)
            }

            // 5. Fallback cuối cùng: Match tương đối nhưng chọn candidate có tên dài nhất
            if (!foundProd) {
                const candidates = allProducts.filter(p => {
                    const pName = (p.name || '').trim().toLowerCase()
                    return pName.length > 3 && (rName.includes(pName) || pName.includes(rName))
                })
                if (candidates.length > 0) {
                    candidates.sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))
                    foundProd = candidates[0]
                }
            }

            return {
                id: `settle_${type}_${Date.now()}_${idx}`,
                productId: foundProd?.id || r.product_id || '',
                productName: foundProd?.name || r.product_name,
                unit: cleanUnit || foundProd?.unit || 'Kg',
                quantity: qty,
                document_quantity: qty,
                price: 0,
                note: '',
                categoryId: (foundProd as any)?.category_id || undefined,
            }
        })

        return {
            items,
            description: jobTitle,
            orderTypeName: shift?.summary_data?.order_type_name || 'Sản Xuất',
            orderTypeId: shift?.summary_data?.order_type_id || undefined,
            orderTypeCode: shift?.summary_data?.order_type_code || undefined,
            shiftId: shift.id,
            jobName: jobTitle,
            settlementType: type,
            targetUnit: 'Kg',
        }
    }

    // Mở Modal làm phiếu kết toán trực tiếp ngay tại trang Số Liệu
    const handleOpenInboundModal = (shift: any, rows: any[]) => {
        const data = buildSettlementData(shift, rows, 'in')
        if (data.items.length === 0) {
            alert('Công việc này không có số liệu nhập kho để làm phiếu kết toán.')
            return
        }
        setSettlementShiftId(shift.id)
        setInboundInitialData(data)
        setIsInboundModalOpen(true)
    }

    const handleOpenOutboundModal = (shift: any, rows: any[]) => {
        const data = buildSettlementData(shift, rows, 'out')
        if (data.items.length === 0) {
            alert('Công việc này không có số liệu xuất kho để làm phiếu kết toán.')
            return
        }
        setSettlementShiftId(shift.id)
        setOutboundInitialData(data)
        setIsOutboundModalOpen(true)
    }

    // Chuyển hướng sang trang /inbound hoặc /outbound để kết toán
    const handleNavigateToSettlementPage = (shift: any, rows: any[], type: 'in' | 'out') => {
        const data = buildSettlementData(shift, rows, type)
        if (data.items.length === 0) {
            alert(`Công việc này không có số liệu ${type === 'in' ? 'nhập' : 'xuất'} kho để làm phiếu kết toán.`)
            return
        }
        const storageKey = type === 'in' ? 'settlement_inbound_order' : 'settlement_outbound_order'
        try {
            sessionStorage.setItem(storageKey, JSON.stringify(data))
        } catch (e) {
            console.error('Không thể lưu session data', e)
        }
        const targetUrl = type === 'in' ? '/inbound?settlement=1' : '/outbound?settlement=1'
        window.open(targetUrl, '_blank')
    }

    // Callback khi tạo thành công phiếu nhập kết toán
    const handleInboundSettlementSuccess = async (orderId?: string) => {
        setIsInboundModalOpen(false)
        setInboundInitialData(null)
        if (!settlementShiftId) return

        try {
            let orderCode = ''
            if (orderId) {
                const { data } = await supabase.from('inbound_orders').select('code').eq('id', orderId).single()
                orderCode = (data as any)?.code || ''
            }

            const { data: shiftData } = await supabase.from('delivery_shifts').select('summary_data').eq('id', settlementShiftId).single()
            if (shiftData) {
                const currentSum = (shiftData as any)?.summary_data || {}
                const updatedSum = {
                    ...currentSum,
                    settlement_inbound_id: orderId || null,
                    settlement_inbound_code: orderCode || 'Đã lập phiếu',
                    settlement_inbound_at: new Date().toISOString(),
                }
                await (supabase.from('delivery_shifts') as any).update({ summary_data: updatedSum }).eq('id', settlementShiftId)

                setPastShifts(prev => prev.map(s => s.id === settlementShiftId ? { ...s, summary_data: updatedSum } : s))
            }
            showToast(`Lập phiếu nhập kết toán ${orderCode ? `(${orderCode}) ` : ''}thành công!`, 'in')
        } catch (e: any) {
            console.error('Lỗi khi ghi nhận mã phiếu nhập kết toán vào ca:', e)
        }
    }

    // Callback khi tạo thành công phiếu xuất kết toán
    const handleOutboundSettlementSuccess = async (orderId?: string) => {
        setIsOutboundModalOpen(false)
        setOutboundInitialData(null)
        if (!settlementShiftId) return

        try {
            let orderCode = ''
            if (orderId) {
                const { data } = await supabase.from('outbound_orders').select('code').eq('id', orderId).single()
                orderCode = (data as any)?.code || ''
            }

            const { data: shiftData } = await supabase.from('delivery_shifts').select('summary_data').eq('id', settlementShiftId).single()
            if (shiftData) {
                const currentSum = (shiftData as any)?.summary_data || {}
                const updatedSum = {
                    ...currentSum,
                    settlement_outbound_id: orderId || null,
                    settlement_outbound_code: orderCode || 'Đã lập phiếu',
                    settlement_outbound_at: new Date().toISOString(),
                }
                await (supabase.from('delivery_shifts') as any).update({ summary_data: updatedSum }).eq('id', settlementShiftId)

                setPastShifts(prev => prev.map(s => s.id === settlementShiftId ? { ...s, summary_data: updatedSum } : s))
            }
            showToast(`Lập phiếu xuất kết toán ${orderCode ? `(${orderCode}) ` : ''}thành công!`, 'out')
        } catch (e: any) {
            console.error('Lỗi khi ghi nhận mã phiếu xuất kết toán vào ca:', e)
        }
    }

    // Tổng hợp các dòng số liệu theo Sản phẩm + ĐVT (Tự động gán Product ID & SKU từ danh sách ghim của ca)
    const summarizeLines = (lines: DeliveryJournalRecord[], shift?: any) => {
        const pinnedList: ProductItem[] = shift?.summary_data?.pinned_products || pinnedProducts || []
        const map: Record<string, { product_id?: string; sku?: string; product_name: string; unit: string; in_qty: number; out_qty: number; count: number }> = {}
        lines.forEach(l => {
            // Trích xuất product_id từ tag [PID: ...] nếu có trong ghi chú
            const pidMatch = (l.notes || '').match(/\[PID:\s*([^\]]+)\]/i)
            const extractedPid = pidMatch ? pidMatch[1].trim() : undefined

            // Đối soát trong danh sách sản phẩm ĐÃ GHIM của công việc này
            const matchedPinned = (extractedPid ? pinnedList.find(p => p.id === extractedPid) : null) ||
                                  pinnedList.find(p => (p.name || '').trim().toLowerCase() === (l.item_name || '').trim().toLowerCase()) ||
                                  allProducts.find(p => (p.name || '').trim().toLowerCase() === (l.item_name || '').trim().toLowerCase())

            const finalPid = extractedPid || matchedPinned?.id
            const finalSku = matchedPinned?.sku
            const productName = matchedPinned?.name || l.item_name

            const key = finalPid ? `${finalPid}___${l.unit}` : `${l.item_name}___${l.unit}`
            if (!map[key]) {
                map[key] = {
                    product_id: finalPid || undefined,
                    sku: finalSku || undefined,
                    product_name: productName,
                    unit: l.unit,
                    in_qty: 0,
                    out_qty: 0,
                    count: 0
                }
            }
            if (l.to_department === 'Kho') map[key].in_qty += Number(l.quantity_sent) || 0
            else map[key].out_qty += Number(l.quantity_sent) || 0
            map[key].count += 1
        })
        return Object.values(map)
    }

    // Công việc đã hoàn thành đang được chọn để xem chi tiết
    const doneSelectedShift = useMemo(() => {
        if (!pastShifts.length) return null
        if (doneSelectedId) {
            const found = pastShifts.find(s => s.id === doneSelectedId)
            if (found) return found
        }
        return null
    }, [pastShifts, doneSelectedId])

    // Lọc danh sách công việc theo trạng thái & từ khóa tìm kiếm
    const filteredPastShifts = useMemo(() => {
        const q = doneSearch.trim().toLowerCase()
        return pastShifts.filter(s => {
            if (doneStatusFilter !== 'all' && s.status !== doneStatusFilter) return false
            if (!q) return true
            const title = (s.summary_data?.job_name || s.notes || '').toLowerCase()
            const closer = (s.closed_by_name || s.opened_by_name || '').toLowerCase()
            const prods = Object.values(s.summary_data?.products_summary || {})
                .map((p: any) => (p?.product_name || '').toLowerCase())
                .join(' ')
            return title.includes(q) || closer.includes(q) || prods.includes(q)
        })
    }, [pastShifts, doneSearch, doneStatusFilter])

    // Danh sách các ngày có công việc trong pastShifts
    const availableDates = useMemo(() => {
        const dates = new Set<string>()
        pastShifts.forEach(s => {
            const op = getShiftLocalDateString(s.opened_at)
            const cl = getShiftLocalDateString(s.closed_at)
            if (op) dates.add(op)
            if (cl) dates.add(cl)
        })
        return Array.from(dates).sort().reverse()
    }, [pastShifts])

    // Danh sách các công việc thuộc mốc thời gian đang chọn (Báo cáo theo ngày / khoảng ngày / tùy chọn nhiều ngày)
    const shiftsOnSelectedDate = useMemo(() => {
        return pastShifts.filter(s => {
            const op = getShiftLocalDateString(s.opened_at)
            const cl = getShiftLocalDateString(s.closed_at)
            if (byDateFilterType === 'range') {
                const minD = byDateRange.from <= byDateRange.to ? byDateRange.from : byDateRange.to
                const maxD = byDateRange.from <= byDateRange.to ? byDateRange.to : byDateRange.from
                const opMatch = op ? (op >= minD && op <= maxD) : false
                const clMatch = cl ? (cl >= minD && cl <= maxD) : false
                return opMatch || clMatch
            } else {
                return (op && byDateMultiDates.has(op)) || (cl && byDateMultiDates.has(cl))
            }
        })
    }, [pastShifts, byDateFilterType, byDateRange, byDateMultiDates])

    // Tiêu đề báo cáo và tên file xuất Excel tự động thích ứng:
    const byDateReportInfo = useMemo(() => {
        if (byDateFilterType === 'range') {
            const minD = byDateRange.from <= byDateRange.to ? byDateRange.from : byDateRange.to
            const maxD = byDateRange.from <= byDateRange.to ? byDateRange.to : byDateRange.from
            const fromDisplay = minD.split('-').reverse().join('/')
            const toDisplay = maxD.split('-').reverse().join('/')
            if (minD === maxD) {
                return {
                    title: `Báo Cáo Tổng Hợp Ngày: ${fromDisplay}`,
                    excelTitle: `BÁO CÁO TỔNG HỢP NGÀY ${fromDisplay}`,
                    fileName: `Bao_cao_ngay_${minD}`,
                    label: `ngày ${fromDisplay}`
                }
            }
            return {
                title: `Báo Cáo Tổng Hợp: Từ ${fromDisplay} đến ${toDisplay}`,
                excelTitle: `BÁO CÁO TỔNG HỢP TỪ ${fromDisplay} ĐẾN ${toDisplay}`,
                fileName: `Bao_cao_tu_${minD}_den_${maxD}`,
                label: `khoảng từ ${fromDisplay} đến ${toDisplay}`
            }
        } else {
            const sorted = Array.from(byDateMultiDates).sort()
            if (sorted.length === 0) {
                return {
                    title: 'Báo Cáo Tổng Hợp: Chưa chọn ngày nào',
                    excelTitle: 'BÁO CÁO TỔNG HỢP',
                    fileName: 'Bao_cao',
                    label: 'chưa chọn ngày nào'
                }
            }
            if (sorted.length === 1) {
                const dDisplay = sorted[0].split('-').reverse().join('/')
                return {
                    title: `Báo Cáo Tổng Hợp Ngày: ${dDisplay}`,
                    excelTitle: `BÁO CÁO TỔNG HỢP NGÀY ${dDisplay}`,
                    fileName: `Bao_cao_ngay_${sorted[0]}`,
                    label: `ngày ${dDisplay}`
                }
            }
            const dateListDisplay = sorted.map(d => d.split('-').reverse().slice(0, 2).join('/')).join(', ')
            return {
                title: `Báo Cáo Tổng Hợp: ${sorted.length} ngày (${dateListDisplay})`,
                excelTitle: `BÁO CÁO TỔNG HỢP ${sorted.length} NGÀY (${sorted.map(d => d.split('-').reverse().join('/')).join(', ')})`,
                fileName: `Bao_cao_${sorted.length}_ngay_${sorted.join('_')}`,
                label: `${sorted.length} ngày đã chọn`
            }
        }
    }, [byDateFilterType, byDateRange, byDateMultiDates])

    // Danh sách các công việc được tick chọn (Báo cáo tùy chọn)
    const customSelectedShifts = useMemo(() => {
        return pastShifts.filter(s => customSelectedIds.has(s.id))
    }, [pastShifts, customSelectedIds])

    // Danh sách các công việc theo mốc thời gian cho Báo cáo theo sản phẩm
    const shiftsForProductReport = useMemo(() => {
        if (byProdTimeFilter === 'all') return pastShifts
        const todayStr = getShiftLocalDateString(new Date().toISOString())
        if (byProdTimeFilter === 'today') {
            return pastShifts.filter(s => {
                const op = getShiftLocalDateString(s.opened_at)
                const cl = getShiftLocalDateString(s.closed_at)
                return op === todayStr || cl === todayStr
            })
        }
        let fromStr = byProdRange.from
        let toStr = byProdRange.to
        if (byProdTimeFilter === '7days') {
            const today = new Date()
            const past7 = new Date()
            past7.setDate(today.getDate() - 6)
            fromStr = getShiftLocalDateString(past7.toISOString())
            toStr = todayStr
        } else if (byProdTimeFilter === '30days') {
            const today = new Date()
            const past30 = new Date()
            past30.setDate(today.getDate() - 29)
            fromStr = getShiftLocalDateString(past30.toISOString())
            toStr = todayStr
        }
        const minD = fromStr <= toStr ? fromStr : toStr
        const maxD = fromStr <= toStr ? toStr : fromStr
        return pastShifts.filter(s => {
            const op = getShiftLocalDateString(s.opened_at)
            const cl = getShiftLocalDateString(s.closed_at)
            const opMatch = op ? (op >= minD && op <= maxD) : false
            const clMatch = cl ? (cl >= minD && cl <= maxD) : false
            return opMatch || clMatch
        })
    }, [pastShifts, byProdTimeFilter, byProdRange])

    // Danh sách sản phẩm tổng hợp có lọc theo tìm kiếm cho Báo cáo theo sản phẩm
    const aggregatedProductsForReport = useMemo(() => {
        const prods = aggregateShiftsProducts(shiftsForProductReport, byProdLines)
        if (!byProdSearch.trim()) return prods
        const q = byProdSearch.trim().toLowerCase()
        return prods.filter(p => {
            const name = (p.product_name || '').toLowerCase()
            const sku = (p.sku || '').toLowerCase()
            const jobs = (p.jobs || []).map((j: any) => j.name.toLowerCase()).join(' ')
            return name.includes(q) || sku.includes(q) || jobs.includes(q)
        })
    }, [shiftsForProductReport, byProdLines, byProdSearch])

    // Tự động tải nhật ký các dòng cho Báo cáo theo sản phẩm
    useEffect(() => {
        if (pageView !== 'done' || doneViewMode !== 'by-product') return
        let isMounted = true
        setByProdLoading(true)
        fetchLinesForShifts(shiftsForProductReport).then(lines => {
            if (isMounted) {
                setByProdLines(lines)
                setByProdLoading(false)
            }
        })
        return () => { isMounted = false }
    }, [pageView, doneViewMode, shiftsForProductReport, fetchLinesForShifts])

    // Tự động tải nhật ký các dòng cho Báo cáo theo ngày khi đổi ngày hoặc danh sách ca thay đổi
    useEffect(() => {
        if (pageView !== 'done' || doneViewMode !== 'by-date') return
        let isMounted = true
        setByDateLoading(true)
        fetchLinesForShifts(shiftsOnSelectedDate).then(lines => {
            if (isMounted) {
                setByDateLines(lines)
                setByDateLoading(false)
            }
        })
        return () => { isMounted = false }
    }, [pageView, doneViewMode, shiftsOnSelectedDate, fetchLinesForShifts])

    // Tự động tải nhật ký các dòng cho Báo cáo tùy chọn khi danh sách ca được tick thay đổi
    useEffect(() => {
        if (pageView !== 'done' || doneViewMode !== 'custom') return
        if (customSelectedShifts.length === 0) {
            setCustomLines([])
            setCustomLoading(false)
            return
        }
        let isMounted = true
        setCustomLoading(true)
        fetchLinesForShifts(customSelectedShifts).then(lines => {
            if (isMounted) {
                setCustomLines(lines)
                setCustomLoading(false)
            }
        })
        return () => { isMounted = false }
    }, [pageView, doneViewMode, customSelectedShifts, fetchLinesForShifts])

    // Toggle tick chọn 1 công việc
    const toggleSelectShift = (id: string) => {
        setCustomSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // Chọn tất cả các công việc đang hiển thị
    const handleSelectAllCustomShifts = () => {
        setCustomSelectedIds(new Set(filteredPastShifts.map(s => s.id)))
    }

    // Bỏ chọn tất cả
    const handleDeselectAllCustomShifts = () => {
        setCustomSelectedIds(new Set())
    }

    // Load ban đầu & Realtime subscription
    useEffect(() => {
        loadProducts()
        loadUnits()
        loadOpenShifts()
        loadPastShifts('7d')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadProducts, loadUnits, loadOpenShifts])

    // Tự động chọn công việc đã hoàn thành đầu tiên trên Desktop khi mở tab Đã hoàn thành
    useEffect(() => {
        if (pageView === 'done' && isDesktopView() && !doneSelectedId && pastShifts.length > 0) {
            selectDoneShift(pastShifts[0])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageView, pastShifts, doneSelectedId])

    useEffect(() => {
        if (activeShift?.id) {
            loadSubShifts(activeShift.id)
        } else {
            setSubShifts([])
        }
    }, [activeShift?.id, loadSubShifts])

    useEffect(() => {
        loadJournalData()
    }, [loadJournalData])

    useEffect(() => {
        const companyId = currentSystem?.company_id || profile?.company_id
        if (!companyId) return

        if (realtimeRef.current) {
            supabase.removeChannel(realtimeRef.current)
        }

        const channel = supabase
            .channel('so_lieu_realtime_multijob')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'delivery_journal',
                filter: `company_id=eq.${companyId}`,
            }, () => loadJournalData())
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'delivery_shifts',
                filter: `company_id=eq.${companyId}`,
            }, () => loadOpenShifts())
            .subscribe()

        realtimeRef.current = channel
        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentSystem, profile, loadJournalData, loadOpenShifts])

    // 6. Xử lý tìm kiếm sản phẩm thông minh (hỗ trợ tên viết tắt / aliases / không dấu)
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([])
            setIsSearching(false)
            return
        }
        setIsSearching(true)
        const q = searchQuery.trim()
        if (searchMode === 'pin') {
            // Chế độ 1: Tìm trong danh mục kho để ghim vào công việc
            const matches = allProducts
                .filter(p => matchSearch(p, q))
                .sort((a, b) => calculateSearchScore(b, q) - calculateSearchScore(a, q))
            setSearchResults(matches.slice(0, 15))
        } else {
            // Chế độ 2: Tìm trong các sản phẩm đã ghim để nhập số liệu nhanh
            const matches = pinnedProducts
                .filter(p => matchSearch(p, q))
                .sort((a, b) => calculateSearchScore(b, q) - calculateSearchScore(a, q))
            setSearchResults(matches.slice(0, 20))
        }
    }, [searchQuery, allProducts, pinnedProducts, searchMode])


    // Ghim sản phẩm vào bàn làm việc của công việc đang chọn
    const handlePinProduct = (product: ProductItem) => {
        if (!activeShift) {
            alert('Vui lòng Mở Công Việc trước khi ghim sản phẩm!')
            setOpenShiftModal(true)
            return
        }
        if (pinnedProducts.some(p => p.id === product.id)) return
        const available = getProductUnits(product)
        const initialUnit = getPreferredUnit(available, product.unit)
        const nextList = [...pinnedProducts, { ...product, unit: initialUnit, available_units: available }]
        setSelectedUnitMap(prev => ({ ...prev, [product.id]: initialUnit }))
        updatePinnedProducts(nextList)
        setSearchQuery('')
        setSearchResults([])
        setIsSearching(false)
    }

    // Bỏ ghim sản phẩm
    const handleUnpinProduct = (productId: string) => {
        const nextList = pinnedProducts.filter(p => p.id !== productId)
        updatePinnedProducts(nextList)
    }

    // Thêm sản phẩm tự do
    const handleAddCustomProduct = () => {
        if (!searchQuery.trim()) return
        const customItem: ProductItem = {
            id: `custom_${Date.now()}`,
            name: searchQuery.trim(),
            sku: 'TỰ DO',
            unit: 'Thùng'
        }
        handlePinProduct(customItem)
    }

    // Tăng giảm số lượng đếm đợt
    const handleAdjustDraftQty = (productId: string, delta: number) => {
        setDraftQtyMap(prev => {
            const current = prev[productId] || 0
            const nextVal = Math.max(0, current + delta)
            return { ...prev, [productId]: nextVal }
        })
    }

    const handleSetDraftQty = (productId: string, val: number) => {
        setDraftQtyMap(prev => ({ ...prev, [productId]: Math.max(0, val) }))
    }

    // 7. XÁC NHẬN CHỐT 1 ĐỢT (BẤM NÚT V ĐỒNG Ý) -> CHỈ LƯU 1 DÒNG DUY NHẤT KÈM ID CÔNG VIỆC
    const handleConfirmBatch = async (
        product: ProductItem,
        type: 'in' | 'out',
        qtyOverride?: number,
        unitOverride?: string
    ): Promise<boolean> => {
        if (!shiftSystemCode) return false
        if (!activeShift) {
            alert('Vui lòng Mở hoặc Chọn một Công Việc trước khi nhập dữ liệu!')
            setOpenShiftModal(true)
            return false
        }

        const qty = qtyOverride ?? (draftQtyMap[product.id] || 0)
        if (!qty || qty <= 0) {
            alert(`Vui lòng nhập số lượng của "${product.name}" trước khi bấm Đồng ý!`)
            return false
        }

        const companyId = currentSystem?.company_id || profile?.company_id || null
        const isImport = type === 'in'

        // Thời gian phát sinh của đợt nhập luôn là thời điểm thực tế hiện tại
        const nowStr = new Date().toISOString()

        // Tính số thứ tự đợt của sản phẩm này trong toàn bộ công việc (tăng dần liên tục)
        const productBatchCount = (allJobJournals.length > 0 ? allJobJournals : journalList).filter(j => j.item_name === product.name).length
        const batchNumber = productBatchCount + 1
        const batchCode = `Đợt ${batchNumber}`

        // Kích hoạt hiệu ứng visual pulse
        setPulseEffect(prev => ({ ...prev, [product.id]: type }))
        setTimeout(() => {
            setPulseEffect(prev => ({ ...prev, [product.id]: null }))
        }, 350)

        const currentUnit = unitOverride || selectedUnitMap[product.id] || product.unit || 'Kg'

        const payload = {
            system_code: shiftSystemCode,
            company_id: companyId,
            delivery_code: batchCode,
            item_name: product.name,
            quantity_sent: qty,
            unit: currentUnit,
            from_department: isImport ? 'Sản xuất' : 'Kho',
            to_department: isImport ? 'Kho' : 'Sản xuất',
            status: isImport ? 'received_by_warehouse' : 'received_by_production',
            notes: `[CV_ID: ${activeShift.id}] [PID: ${product.id}] [SKU: ${product.sku || ''}] [CV: ${currentJobName}] [${batchCode}] ${isImport ? 'Nhập kho' : 'Xuất kho'}`,

            sent_by: profile?.id || null,
            sent_by_name: profile?.full_name || 'Nhân viên',
            sent_at: nowStr,

            received_by_warehouse: isImport ? (profile?.id || null) : null,
            received_by_warehouse_name: isImport ? (profile?.full_name || 'Nhân viên') : null,
            received_by_warehouse_at: isImport ? nowStr : null,

            received_by_production: !isImport ? (profile?.id || null) : null,
            received_by_production_name: !isImport ? (profile?.full_name || 'Nhân viên') : null,
            received_by_production_at: !isImport ? nowStr : null,

            result_item_name: product.name,
            result_quantity: qty,
            result_unit: currentUnit,

            created_by: profile?.id || null,
            created_by_name: profile?.full_name || null,
        }

        try {
            // Nếu trình duyệt đang mất mạng, lưu ngay vào bộ nhớ máy ngoại tuyến
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error('OFFLINE_BROWSER')
            }

            const { error } = await (supabase as any)
                .from('delivery_journal')
                .insert([payload])

            if (error) throw error

            setDraftQtyMap(prev => ({ ...prev, [product.id]: 0 }))
            loadJournalData()
            showToast(
                `${isImport ? 'Đã NHẬP' : 'Đã XUẤT'} ${isImport ? '+' : '-'}${qty} ${currentUnit} • ${product.name}`,
                type
            )
            return true
        } catch (err: any) {
            console.warn('Lưu trực tiếp thất bại, chuyển sang lưu Ngoại Tuyến:', err)

            // Lưu ngoại tuyến vào React state để phản hồi 0ms
            const offlineRecordId = `offline_web_jn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
            const offlineRecord: DeliveryJournalRecord = {
                id: offlineRecordId,
                delivery_code: batchCode,
                item_name: product.name,
                quantity_sent: qty,
                unit: currentUnit,
                from_department: isImport ? 'Sản xuất' : 'Kho',
                to_department: isImport ? 'Kho' : 'Sản xuất',
                status: isImport ? 'received_by_warehouse' : 'received_by_production',
                notes: payload.notes,
                sent_by_name: profile?.full_name || 'Nhân viên',
                sent_at: nowStr,
                system_code: shiftSystemCode,
            }

            setJournalList(prev => [offlineRecord, ...prev])
            setAllJobJournals(prev => [offlineRecord, ...prev])
            setDraftQtyMap(prev => ({ ...prev, [product.id]: 0 }))

            // Đẩy vào hàng đợi ngoại tuyến của trình duyệt
            const queue = getWebOfflineQueue(shiftSystemCode)
            queue.push({
                id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                type: 'SUBMIT_JOURNAL',
                payload,
                shiftId: activeShift.id,
                timestamp: Date.now(),
            })
            saveWebOfflineQueue(shiftSystemCode, queue)
            setOfflineQueueCount(queue.length)

            showToast(
                `NGOẠI TUYẾN • ${isImport ? 'Đã NHẬP' : 'Đã XUẤT'} ${isImport ? '+' : '-'}${qty} ${currentUnit} • ${product.name} (Lưu máy)`,
                type
            )
            return true
        }
    }

    // ===== MOBILE & DESKTOP: Bàn phím số nhập nhanh =====
    const openPad = (product: ProductItem) => {
        const units = getProductUnits(product)
        setPadProduct(product)
        setPadValue('')

        // 1. Kiểm tra xem ca này đã có đợt ghi nhận nào cho sản phẩm này chưa
        const journalUnit = cleanUnitLabel(allJobJournals.find(j => j.item_name === product.name && j.unit)?.unit)
        const remembered = cleanUnitLabel(selectedUnitMap[product.id])

        let preferred = remembered
        if (journalUnit && units.includes(journalUnit)) {
            preferred = journalUnit
        } else if (!preferred || !units.includes(preferred)) {
            preferred = units.find(u => isBoxUnit(u)) || units[0] || 'Kg'
        } else if (!isBoxUnit(preferred)) {
            const thungUnit = units.find(u => isBoxUnit(u))
            if (thungUnit) preferred = thungUnit
        }

        setPadUnit(preferred)
        if (preferred && preferred !== remembered) {
            handleUnitChange(product.id, preferred)
        }
    }

    const handlePadKey = (key: string) => {
        setPadValue(prev => {
            if (key === 'del') return prev.slice(0, -1)
            if (key === 'clear') return ''
            if (key === '.') {
                if (prev.includes('.')) return prev
                return prev === '' ? '0.' : prev + '.'
            }
            if (prev === '0') return key
            if (prev.replace('.', '').length >= 7) return prev
            return prev + key
        })
    }

    const handlePadConfirm = async (type: 'in' | 'out') => {
        if (!padProduct || padSaving) return
        const qty = parseFloat(padValue)
        if (!qty || qty <= 0) return
        setPadSaving(true)
        if (padUnit !== (selectedUnitMap[padProduct.id] || padProduct.unit)) {
            handleUnitChange(padProduct.id, padUnit)
        }
        const ok = await handleConfirmBatch(padProduct, type, qty, padUnit)
        setPadSaving(false)
        if (ok) {
            // Desktop: giữ nguyên sản phẩm đang chọn để nhập tiếp; Mobile: đóng bàn phím
            if (!isDesktopView()) setPadProduct(null)
            setPadValue('')
        }
    }

    const isDesktopView = () =>
        typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches

    // DESKTOP: tự chọn sản phẩm đầu tiên trên bàn làm việc để bảng nhập số luôn sẵn sàng
    useEffect(() => {
        if (!isDesktopView()) return
        if (pinnedProducts.length === 0) {
            if (padProduct) setPadProduct(null)
            return
        }
        const matched = padProduct ? pinnedProducts.find(p => p.id === padProduct.id) : null
        if (!matched) {
            openPad(pinnedProducts[0])
        } else {
            if (matched !== padProduct) {
                setPadProduct(matched)
            }
            const cleanedPadUnit = cleanUnitLabel(padUnit)
            if (cleanedPadUnit && cleanedPadUnit !== padUnit) {
                setPadUnit(cleanedPadUnit)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pinnedProducts])

    // DESKTOP: hỗ trợ gõ bằng bàn phím máy tính (0-9, Backspace, Esc, ↑↓ chọn SP, + Nhập, - Xuất)
    const padKeyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {})
    padKeyHandlerRef.current = (e: KeyboardEvent) => {
        if (!isDesktopView() || !padProduct || pageView !== 'active') return
        if (openShiftModal || interimCloseModal || closeShiftModal || editingRecord || showHistoryModal || showSubShiftsPanel) return
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
        if (e.ctrlKey || e.metaKey || e.altKey) return

        if (/^[0-9]$/.test(e.key)) { e.preventDefault(); handlePadKey(e.key); return }
        if (e.key === '.' || e.key === ',') { e.preventDefault(); handlePadKey('.'); return }
        if (e.key === 'Backspace') { e.preventDefault(); handlePadKey('del'); return }
        if (e.key === 'Escape') { e.preventDefault(); handlePadKey('clear'); return }
        if (e.key === '+') { e.preventDefault(); handlePadConfirm('in'); return }
        if (e.key === '-') { e.preventDefault(); handlePadConfirm('out'); return }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const currentList = displayedPinnedProducts.length > 0 ? displayedPinnedProducts : pinnedProducts
            const idx = currentList.findIndex(p => p.id === padProduct.id)
            const next = e.key === 'ArrowDown'
                ? Math.min(currentList.length - 1, idx + 1)
                : Math.max(0, idx - 1)
            if (currentList[next] && next !== idx) openPad(currentList[next])
        }

    }
    useEffect(() => {
        const listener = (e: KeyboardEvent) => padKeyHandlerRef.current(e)
        window.addEventListener('keydown', listener)
        return () => window.removeEventListener('keydown', listener)
    }, [])

    // Hàm lọc sạch các tag kỹ thuật hệ thống ([CV_ID: ...], [PID: ...], [SKU: ...], [Đợt ...], Nhập/Xuất kho)
    // chỉ giữ lại ghi chú thực tế do người dùng tự gõ thêm
    const cleanUserNotes = (notes: string | null | undefined) => {
        if (!notes) return ''
        const cleaned = notes
            .replace(/\[CV_ID:\s*[^\]]+\]\s*/gi, '')
            .replace(/\[PID:\s*[^\]]+\]\s*/gi, '')
            .replace(/\[SKU:\s*[^\]]*\]\s*/gi, '')
            .replace(/\[CV:\s*[^\]]+\]\s*/gi, '')
            .replace(/\[Đợt\s*[^\]]*\]\s*/gi, '')
            .replace(/\[[^\]]+\]\s*/gi, '')
            .replace(/\b(nhập kho|xuất kho)\b\s*/gi, '')
            .trim()
        if (!cleaned || /^(nhập kho|xuất kho)$/i.test(cleaned)) return ''
        return cleaned
    }

    // Mở modal sửa từng dòng số liệu
    const handleStartEdit = (record: DeliveryJournalRecord) => {
        setEditingRecord(record)
        setEditQuantity(record.quantity_sent)
        setEditUnit(cleanUnitLabel(record.unit) || record.unit)
        setEditType(record.to_department === 'Kho' ? 'in' : 'out')
        setEditNotes(cleanUserNotes(record.notes))
    }

    // Lưu chỉnh sửa dòng số liệu
    const handleSaveEdit = async () => {
        if (!editingRecord || !shiftSystemCode) return
        const qty = Number(editQuantity) || 0
        if (qty <= 0) {
            alert('Vui lòng nhập số lượng lớn hơn 0!')
            return
        }
        setSavingEdit(true)
        try {
            const isImport = editType === 'in'
            const existingCvMatch = (editingRecord.notes || '').match(/\[CV_ID:\s*[^\]]+\]/i)
            const cvTag = existingCvMatch ? existingCvMatch[0] : (activeShift?.id ? `[CV_ID: ${activeShift.id}]` : '')
            const finalNotes = editNotes ? `${cvTag} ${editNotes.trim()}`.trim() : (cvTag || null)
            const payload = {
                quantity_sent: qty,
                unit: editUnit,
                result_quantity: qty,
                result_unit: editUnit,
                from_department: isImport ? 'Sản xuất' : 'Kho',
                to_department: isImport ? 'Kho' : 'Sản xuất',
                status: isImport ? 'received_by_warehouse' : 'received_by_production',
                notes: finalNotes,
            }

            const { error } = await (supabase as any)
                .from('delivery_journal')
                .update(payload)
                .eq('id', editingRecord.id)
                .eq('system_code', shiftSystemCode)

            if (error) throw error

            setEditingRecord(null)
            loadJournalData()
            if (doneSelectedShift) {
                loadDoneLines(doneSelectedShift)
            }
        } catch (err: any) {
            alert('Lỗi cập nhật dòng: ' + (err?.message || err))
        } finally {
            setSavingEdit(false)
        }
    }

    // Xóa một dòng bấm nhầm
    const handleDeleteJournal = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa lượt ghi nhận này không?')) return
        try {
            const { error } = await (supabase as any)
                .from('delivery_journal')
                .delete()
                .eq('id', id)
                .eq('system_code', shiftSystemCode)

            if (error) throw error
            loadJournalData()
            if (doneSelectedShift) {
                loadDoneLines(doneSelectedShift)
            }
        } catch (err: any) {
            alert('Lỗi xóa lượt ghi nhận: ' + (err?.message || err))
        }
    }

    // 8. Tính toán thống kê theo sản phẩm trong công việc đang chọn
    const productStats = useMemo(() => {
        const stats: Record<string, { inQty: number; outQty: number; inCount: number; outCount: number; unit: string }> = {}

        journalList.forEach(item => {
            const name = item.item_name
            const unit = item.unit || 'Thùng'
            const key = `${name}___${unit}`
            if (!stats[key]) {
                stats[key] = { inQty: 0, outQty: 0, inCount: 0, outCount: 0, unit }
            }

            const isImport = item.to_department === 'Kho'
            if (isImport) {
                stats[key].inQty += item.quantity_sent || 0
                stats[key].inCount += 1
            } else {
                stats[key].outQty += item.quantity_sent || 0
                stats[key].outCount += 1
            }
        })

        return stats
    }, [journalList])

    // Lấy số liệu nhập/xuất của 1 sản phẩm theo đúng đơn vị tính đang chọn
    const getProductCount = (productName: string, unit?: string | null) => {
        const u = (unit || '').trim()
        if (!u) return { inQty: 0, outQty: 0, inCount: 0, outCount: 0, unit: '' }
        const key = `${productName}___${u}`
        return productStats[key] || { inQty: 0, outQty: 0, inCount: 0, outCount: 0, unit: u }
    }

    // 9. XỬ LÝ MỞ THÊM CÔNG VIỆC MỚI (CÓ THỂ MỞ NHIỀU CÔNG VIỆC CÙNG LÚC - HỖ TRỢ OFFLINE KHO ĐÔNG)
    const handleOpenShift = async () => {
        if (!shiftSystemCode) return
        if (!jobNameInput.trim()) {
            alert('Vui lòng nhập Tên công việc trước khi bắt đầu!')
            return
        }

        const openedAtDate = jobOpenedAtInput ? new Date(jobOpenedAtInput) : new Date()
        const openedAtIso = isNaN(openedAtDate.getTime()) ? new Date().toISOString() : openedAtDate.toISOString()

        // Tìm mẫu công việc tương ứng (ưu tiên mẫu đang chọn, hoặc tự khớp theo tên công việc)
        const matchedTemplate = selectedJobTemplate || jobTemplatesList.find(
            t => t.name.trim().toLowerCase() === jobNameInput.trim().toLowerCase()
        )

        // Chuẩn bị danh sách sản phẩm ghim sẵn từ mẫu công việc trước khi lưu DB
        let initialPinned: ProductItem[] = []
        if (matchedTemplate?.pinned_product_ids && matchedTemplate.pinned_product_ids.length > 0) {
            initialPinned = matchedTemplate.pinned_product_ids
                .map(pid => allProducts.find(p => p.id === pid))
                .filter(Boolean)
                .map(p => {
                    const item = p as ProductItem
                    const units = getProductUnits(item)
                    const prefUnit = getPreferredUnit(units, item.unit)
                    return {
                        ...item,
                        unit: prefUnit,
                        available_units: units,
                    }
                })
        }

        const chosenType = orderTypes.find(t => t.id === jobOrderTypeId)
        const payload = {
            system_code: shiftSystemCode,
            company_id: currentSystem?.company_id || profile?.company_id || null,
            status: 'open',
            opened_by: profile?.id || null,
            opened_by_name: profile?.full_name || 'Nhân viên kho',
            opened_at: openedAtIso,
            notes: jobNameInput.trim(),
            summary_data: {
                job_name: jobNameInput.trim(),
                job_notes: jobNotesInput.trim() || null,
                template_id: matchedTemplate?.id || null,
                pinned_products: initialPinned,
                order_type_id: jobOrderTypeId || null,
                order_type_name: chosenType?.name || null,
                order_type_code: chosenType?.code || null,
            }
        }

        try {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error('OFFLINE_BROWSER')
            }

            const { data, error } = await (supabase as any)
                .from('delivery_shifts')
                .insert([payload])
                .select()
                .single()

            if (error) throw error

            setOpenShiftModal(false)
            setJobNameInput('')
            setJobNotesInput('')
            setJobOrderTypeId('')
            setJobOpenedAtInput(formatDateTimeLocal(new Date()))

            if (data?.id) {
                try {
                    localStorage.setItem(`so_lieu_pinned_job_${data.id}`, JSON.stringify(initialPinned))
                    localStorage.removeItem(`so_lieu_pinned_job_${data.id}_cleared`)
                    localStorage.setItem(`so_lieu_selected_shift_${shiftSystemCode}`, data.id)
                } catch (e) {}
                setPinnedProducts(initialPinned)
                setAllJobJournals([])
                setJournalList([])
                setSubShifts([])
                setPadProduct(null)
                setDraftQtyMap({})
                setSelectedShiftId(data.id)
            }

            // Nạp lại danh sách công việc sau khi đã lưu localStorage và setSelectedShiftId
            await loadOpenShifts()
            setSelectedJobTemplate(null)
            setPageView('active')
        } catch (err: any) {
            console.warn('Mở công việc online thất bại, chuyển sang chế độ Ngoại Tuyến:', err)
            const tempShiftId = `offline_shift_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
            const offlineShift = {
                id: tempShiftId,
                system_code: shiftSystemCode,
                company_id: currentSystem?.company_id || profile?.company_id || null,
                status: 'open',
                opened_by: profile?.id || null,
                opened_by_name: profile?.full_name || 'Nhân viên kho',
                opened_at: openedAtIso,
                notes: jobNameInput.trim(),
                summary_data: {
                    job_name: jobNameInput.trim(),
                    job_notes: jobNotesInput.trim() || null,
                    template_id: matchedTemplate?.id || null,
                    pinned_products: initialPinned,
                    order_type_id: jobOrderTypeId || null,
                    order_type_name: chosenType?.name || null,
                    order_type_code: chosenType?.code || null,
                    is_offline: true,
                }
            }

            setOpenShifts(prev => [offlineShift as any, ...prev])
            setSelectedShiftId(tempShiftId)
            setPinnedProducts(initialPinned)
            setAllJobJournals([])
            setJournalList([])
            setSubShifts([])
            setPadProduct(null)
            setDraftQtyMap({})
            setOpenShiftModal(false)
            setJobNameInput('')
            setJobNotesInput('')
            setJobOrderTypeId('')
            setPageView('active')

            const queue = getWebOfflineQueue(shiftSystemCode)
            queue.push({
                id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                type: 'CREATE_SHIFT',
                payload: { insertPayload: payload, tempShiftId },
                shiftId: tempShiftId,
                timestamp: Date.now(),
            })
            saveWebOfflineQueue(shiftSystemCode, queue)
            setOfflineQueueCount(queue.length)

            showToast('ĐÃ MỞ CÔNG VIỆC NGOẠI TUYẾN (Lưu an toàn trong máy)', 'in')
        }
    }

    // Tính toán summary cho chốt ca tạm
    const calculateInterimSummary = async () => {
        const companyId = currentSystem?.company_id || profile?.company_id
        if (!companyId || !activeShift || !shiftSystemCode) return
        try {
            const lastSubShift = subShifts.length > 0 ? subShifts[subShifts.length - 1] : null
            const fromTime = lastSubShift ? lastSubShift.to_time : activeShift.opened_at

            const { data, error } = await (supabase as any)
                .from('delivery_journal')
                .select('*')
                .eq('company_id', companyId)
                .eq('system_code', shiftSystemCode)
                .ilike('notes', `%[CV_ID: ${activeShift.id}]%`)
                .gte('sent_at', fromTime)

            if (error) throw error
            const list = (data || []) as any[]

            const units_summary: Record<string, { sent: number; received: number }> = {}
            const products_summary: Record<string, { product_name: string; unit: string; in_qty: number; out_qty: number }> = {}

            list.forEach(j => {
                const unit = j.unit || 'Thùng'
                const pName = j.item_name || 'Hàng hóa'
                const isImport = j.to_department === 'Kho'
                const qty = j.quantity_sent || 0

                if (!units_summary[unit]) {
                    units_summary[unit] = { sent: 0, received: 0 }
                }
                if (isImport) {
                    units_summary[unit].received += qty
                } else {
                    units_summary[unit].sent += qty
                }

                const pKey = `${pName}_${unit}`
                if (!products_summary[pKey]) {
                    products_summary[pKey] = { product_name: pName, unit, in_qty: 0, out_qty: 0 }
                }
                if (isImport) {
                    products_summary[pKey].in_qty += qty
                } else {
                    products_summary[pKey].out_qty += qty
                }
            })

            setInterimSummary({
                job_name: currentJobName,
                from_time: fromTime,
                to_time: new Date().toISOString(),
                total_records: list.length,
                units_summary,
                products_summary
            })
        } catch (err) {
            console.error('Error calculating interim summary:', err)
        }
    }

    const handleInterimClose = async () => {
        if (!activeShift || !shiftSystemCode) return
        try {
            const lastSubShift = subShifts.length > 0 ? subShifts[subShifts.length - 1] : null
            const fromTime = lastSubShift ? lastSubShift.to_time : activeShift.opened_at
            const toTime = new Date().toISOString()

            const payload = {
                shift_id: activeShift.id,
                system_code: shiftSystemCode,
                company_id: currentSystem?.company_id || profile?.company_id || null,
                sub_shift_number: subShifts.length + 1,
                from_time: fromTime,
                to_time: toTime,
                closed_by: profile?.id || null,
                closed_by_name: profile?.full_name || 'Nhân viên kho',
                summary_data: {
                    job_name: currentJobName,
                    ...(interimSummary || {})
                },
                notes: interimNotes ? `[CV: ${currentJobName}] ${interimNotes}` : `[CV: ${currentJobName}] Chốt đợt ${subShifts.length + 1}`,
            }
            const { error } = await (supabase as any)
                .from('delivery_sub_shifts')
                .insert([payload])
            if (error) throw error
            setInterimCloseModal(false)
            setInterimNotes('')
            setInterimSummary(null)
            loadSubShifts(activeShift.id)
            loadJournalData()
            loadPastShifts(doneRange)
            showToast(`Đã chốt ca tạm đợt #${subShifts.length + 1}`, 'in')
        } catch (err: any) {
            alert('Lỗi chốt ca tạm: ' + (err?.message || err))
        }
    }

    // Tính toán summary cho chốt sổ (Đóng công việc đang chọn)
    const calculateShiftSummary = async (openedAtStr: string) => {
        const companyId = currentSystem?.company_id || profile?.company_id
        if (!companyId || !shiftSystemCode || !activeShift) return
        try {
            const { data, error } = await (supabase as any)
                .from('delivery_journal')
                .select('*')
                .eq('company_id', companyId)
                .eq('system_code', shiftSystemCode)
                .ilike('notes', `%[CV_ID: ${activeShift.id}]%`)
                .gte('sent_at', openedAtStr)

            if (error) throw error
            const list = (data || []) as any[]

            const units_summary: Record<string, { sent: number; received: number }> = {}
            const products_summary: Record<string, { product_name: string; unit: string; in_qty: number; out_qty: number }> = {}

            list.forEach(j => {
                const unit = j.unit || 'Thùng'
                const pName = j.item_name || 'Hàng hóa'
                const isImport = j.to_department === 'Kho'
                const qty = j.quantity_sent || 0

                if (!units_summary[unit]) {
                    units_summary[unit] = { sent: 0, received: 0 }
                }
                if (isImport) {
                    units_summary[unit].received += qty
                } else {
                    units_summary[unit].sent += qty
                }

                const pKey = `${pName}_${unit}`
                if (!products_summary[pKey]) {
                    products_summary[pKey] = { product_name: pName, unit, in_qty: 0, out_qty: 0 }
                }
                if (isImport) {
                    products_summary[pKey].in_qty += qty
                } else {
                    products_summary[pKey].out_qty += qty
                }
            })

            // Gợi ý thời gian đóng ca: lấy thời điểm thực tế hiện tại
            const suggestedCloseTime = formatDateTimeLocal(new Date())
            setCloseTimeInput(suggestedCloseTime)

            setShiftSummary({
                job_name: currentJobName,
                from_time: openedAtStr,
                to_time: suggestedCloseTime ? new Date(suggestedCloseTime).toISOString() : new Date().toISOString(),
                total_records: list.length,
                units_summary,
                products_summary
            })
        } catch (err) {
            console.error('Error calculating shift summary:', err)
        }
    }

    // Đóng công việc hiện tại (Chốt sổ công việc này)
    const handleCloseShift = async () => {
        if (!activeShift) return
        try {
            const closedJobId = activeShift.id
            const closedAtDate = closeTimeInput ? new Date(closeTimeInput) : new Date()
            const closedAtStr = isNaN(closedAtDate.getTime()) ? new Date().toISOString() : closedAtDate.toISOString()
            const companyId = currentSystem?.company_id || profile?.company_id || null

            // Nếu công việc đã từng bấm Chốt tạm trước đó, tự động chốt luôn đợt cuối (từ lần chốt tạm cuối -> lúc bấm Hoàn thành CV) nếu có phát sinh số liệu
            if (subShifts.length > 0 && shiftSystemCode && companyId) {
                const lastSubShift = subShifts[subShifts.length - 1]
                const { data: remList } = await (supabase as any)
                    .from('delivery_journal')
                    .select('*')
                    .eq('company_id', companyId)
                    .eq('system_code', shiftSystemCode)
                    .ilike('notes', `%[CV_ID: ${closedJobId}]%`)
                    .gt('sent_at', lastSubShift.to_time)

                if (remList && remList.length > 0) {
                    const units_summary: Record<string, { sent: number; received: number }> = {}
                    const products_summary: Record<string, { product_name: string; unit: string; in_qty: number; out_qty: number }> = {}

                    remList.forEach((j: any) => {
                        const unit = j.unit || 'Thùng'
                        const pName = j.item_name || 'Hàng hóa'
                        const isImport = j.to_department === 'Kho'
                        const qty = Number(j.quantity_sent) || 0

                        if (!units_summary[unit]) units_summary[unit] = { sent: 0, received: 0 }
                        if (isImport) units_summary[unit].received += qty
                        else units_summary[unit].sent += qty

                        const pKey = `${pName}_${unit}`
                        if (!products_summary[pKey]) products_summary[pKey] = { product_name: pName, unit, in_qty: 0, out_qty: 0 }
                        if (isImport) products_summary[pKey].in_qty += qty
                        else products_summary[pKey].out_qty += qty
                    })

                    const finalSubNumber = subShifts.length + 1
                    await (supabase as any)
                        .from('delivery_sub_shifts')
                        .insert([{
                            shift_id: closedJobId,
                            system_code: shiftSystemCode,
                            company_id: companyId,
                            sub_shift_number: finalSubNumber,
                            from_time: lastSubShift.to_time,
                            to_time: closedAtStr,
                            closed_by: profile?.id || null,
                            closed_by_name: profile?.full_name || 'Nhân viên kho',
                            summary_data: {
                                job_name: currentJobName,
                                from_time: lastSubShift.to_time,
                                to_time: closedAtStr,
                                total_records: remList.length,
                                units_summary,
                                products_summary,
                            },
                            notes: closeNotes
                                ? `[CV: ${currentJobName}] Chốt đợt cuối #${finalSubNumber} (Hoàn thành CV): ${closeNotes}`
                                : `[CV: ${currentJobName}] Chốt đợt cuối #${finalSubNumber} (Hoàn thành CV)`,
                        }])
                }
            }

            const chosenCloseType = orderTypes.find(t => t.id === closeOrderTypeId)
            const payload = {
                status: 'closed',
                closed_by: profile?.id || null,
                closed_by_name: profile?.full_name || 'Nhân viên kho',
                closed_at: closedAtStr,
                summary_data: {
                    ...(activeShift?.summary_data || {}),
                    job_name: currentJobName,
                    pinned_products: pinnedProducts,
                    ...(shiftSummary || {}),
                    order_type_id: closeOrderTypeId || activeShift?.summary_data?.order_type_id || null,
                    order_type_name: chosenCloseType?.name || activeShift?.summary_data?.order_type_name || null,
                    order_type_code: chosenCloseType?.code || activeShift?.summary_data?.order_type_code || null,
                },
                notes: closeNotes ? `[CV: ${currentJobName}] ${closeNotes}` : `[CV: ${currentJobName}] Hoàn thành công việc`,
            }

            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error('OFFLINE_BROWSER')
            }

            const { data: closedShiftData, error } = await (supabase as any)
                .from('delivery_shifts')
                .update(payload)
                .eq('id', closedJobId)
                .select()
                .single()
            if (error) throw error

            setCloseShiftModal(false)
            setCloseNotes('')
            setCloseOrderTypeId('')
            setShiftSummary(null)

            // Nạp lại danh sách công việc đang mở & đã hoàn thành, chuyển sang xem công việc vừa hoàn thành
            await Promise.all([loadOpenShifts(), loadPastShifts(doneRange)])
            setPageView('done')
            setDoneSelectedId(closedJobId)
            if (closedShiftData) {
                loadDoneLines(closedShiftData)
            }
            showToast(`Đã hoàn thành "${currentJobName}" • Đang hiển thị báo cáo`, 'in')
        } catch (err: any) {
            console.warn('Chốt công việc online thất bại, chuyển sang chốt Ngoại Tuyến:', err)
            const closedJobId = activeShift.id
            const closedAtStr = new Date().toISOString()
            const payload = {
                status: 'closed',
                closed_by: profile?.id || null,
                closed_by_name: profile?.full_name || 'Nhân viên kho',
                closed_at: closedAtStr,
                summary_data: {
                    ...(activeShift?.summary_data || {}),
                    job_name: currentJobName,
                    pinned_products: pinnedProducts,
                    ...(shiftSummary || {}),
                },
                notes: closeNotes ? `[CV: ${currentJobName}] ${closeNotes}` : `[CV: ${currentJobName}] Hoàn thành công việc (Ngoại tuyến)`,
            }

            setOpenShifts(prev => prev.filter(s => s.id !== closedJobId))
            const closedShiftObj = {
                ...activeShift,
                ...payload,
            }
            setPastShifts(prev => [closedShiftObj as any, ...prev])

            if (shiftSystemCode) {
                const queue = getWebOfflineQueue(shiftSystemCode)
                queue.push({
                    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    type: 'CLOSE_SHIFT',
                    payload: { payload, shiftId: closedJobId },
                    shiftId: closedJobId,
                    timestamp: Date.now(),
                })
                saveWebOfflineQueue(shiftSystemCode, queue)
                setOfflineQueueCount(queue.length)
            }

            setCloseShiftModal(false)
            setCloseNotes('')
            setCloseOrderTypeId('')
            setShiftSummary(null)
            setPageView('done')
            setDoneSelectedId(closedJobId)
            showToast(`ĐÃ CHỐT CÔNG VIỆC NGOẠI TUYẾN • "${currentJobName}" (Lưu an toàn trong máy)`, 'in')
        }
    }

    const formatDateTime = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-'
        const d = new Date(dateStr)
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
        const date = d.toLocaleDateString('vi-VN')
        return `${time} ${date}`
    }

    const formatTimeOnly = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-'
        const d = new Date(dateStr)
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    }

    const formatCompactRange = (fromStr: string | null | undefined, toStr: string | null | undefined, isOngoing?: boolean) => {
        if (!fromStr) return '-'
        const d1 = new Date(fromStr)
        const t1 = d1.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
        const date1 = d1.toLocaleDateString('vi-VN')
        if (isOngoing || !toStr) {
            return `${t1} → Hiện tại (${date1})`
        }
        const d2 = new Date(toStr)
        const t2 = d2.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
        const date2 = d2.toLocaleDateString('vi-VN')
        if (date1 === date2) {
            return `${t1} → ${t2} (${date1})`
        }
        return `${t1} ${date1} → ${t2} ${date2}`
    }

    // Render bảng Báo cáo tổng hợp gộp nhiều công việc (Dùng cho cả Báo cáo theo ngày & Báo cáo tùy chọn)
    const renderAggregatedReportView = (
        title: string,
        shifts: any[],
        lines: DeliveryJournalRecord[],
        loading: boolean,
        onExport: () => void,
        exportButtonText: string
    ) => {
        // Tính toán số liệu mặt hàng
        const prodRows = aggregateShiftsProducts(shifts, lines)

        // Tính toán số liệu đơn vị tính
        const unitMap: Record<string, { unit: string; in_qty: number; out_qty: number; count: number }> = {}
        prodRows.forEach(r => {
            const u = r.unit || 'ĐVT'
            if (!unitMap[u]) unitMap[u] = { unit: u, in_qty: 0, out_qty: 0, count: 0 }
            unitMap[u].in_qty += r.in_qty
            unitMap[u].out_qty += r.out_qty
            unitMap[u].count += r.count
        })
        const unitRows = Object.values(unitMap)

        return (
            <div className="space-y-4">
                {/* Thanh tiêu đề báo cáo & Nút Xuất Excel */}
                <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                <BarChart3 className="w-5 h-5" />
                            </span>
                            <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white">
                                {title}
                            </h2>
                        </div>
                        <div className="text-xs text-stone-500 flex items-center gap-2 flex-wrap">
                            <span>Kho: <strong className="text-stone-700 dark:text-stone-300">{currentSystem?.name}</strong></span>
                            <span>•</span>
                            <span>Tổng số: <strong className="text-indigo-600 dark:text-indigo-400">{shifts.length} công việc</strong></span>
                            <span>•</span>
                            <span>Phát sinh: <strong className="text-emerald-600">{prodRows.length} mặt hàng</strong></span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onExport}
                            disabled={loading || prodRows.length === 0}
                            className="h-9 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            <span>{exportButtonText}</span>
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-xs text-stone-400 flex flex-col items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                        <span>Đang tổng hợp số liệu từ các công việc...</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* BẢNG 1: CHI TIẾT THEO MẶT HÀNG */}
                        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                            <div className="px-4 py-3 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/60 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-sky-500" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                                        1. Chi tiết theo Mặt Hàng
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                                        {prodRows.length} SP
                                    </span>
                                </div>
                            </div>

                            {prodRows.length === 0 ? (
                                <div className="p-8 text-center text-xs text-stone-400">
                                    Chưa có phát sinh số liệu trong danh sách công việc này.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-stone-50 dark:bg-zinc-950 text-stone-500 text-[11px] uppercase border-b border-stone-200 dark:border-zinc-800">
                                            <tr>
                                                <th className="py-2.5 px-3 font-semibold text-center w-12">STT</th>
                                                <th className="py-2.5 px-3 font-semibold">Sản phẩm</th>
                                                <th className="py-2.5 px-3 font-semibold text-center w-28">ĐVT</th>
                                                <th className="py-2.5 px-3 font-semibold text-right text-emerald-600 w-32">Nhập (+)</th>
                                                <th className="py-2.5 px-3 font-semibold text-right text-rose-600 w-32">Xuất (-)</th>
                                                <th className="py-2.5 px-3 font-semibold text-center w-24">Số đợt</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                            {prodRows.map((r, idx) => {
                                                return (
                                                    <tr key={`${r.product_name}_${r.unit}_${idx}`} className="hover:bg-stone-50/60 dark:hover:bg-zinc-800/40">
                                                        <td className="py-2.5 px-3 text-center text-stone-400 font-mono text-[11px]">{idx + 1}</td>
                                                        <td className="py-2.5 px-3">
                                                            <div className="font-semibold text-stone-900 dark:text-white leading-tight">
                                                                {r.product_name}
                                                            </div>
                                                            {r.jobs && r.jobs.length > 0 && (
                                                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                                                    {r.jobs.map((j: any, jIdx: number) => (
                                                                        <span
                                                                            key={jIdx}
                                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300 border border-stone-200/60 dark:border-zinc-700/60"
                                                                        >
                                                                            <Briefcase className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                                                            <span>{j.name}</span>
                                                                            {r.jobs.length > 1 && (
                                                                                <span className="text-[9px] text-stone-400 font-normal">
                                                                                    (N:{j.in_qty > 0 ? `+${j.in_qty}` : '0'}/X:{j.out_qty > 0 ? `-${j.out_qty}` : '0'})
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{r.unit}</td>
                                                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                                                            {r.in_qty > 0 ? `+${r.in_qty.toLocaleString('vi-VN')}` : '0'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                                                            {r.out_qty > 0 ? `-${r.out_qty.toLocaleString('vi-VN')}` : '0'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center text-stone-500">{r.count}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* BẢNG 2: TỔNG HỢP THEO ĐƠN VỊ TÍNH */}
                        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                            <div className="px-4 py-3 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/60 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-indigo-500" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                                        2. Tổng hợp theo Đơn Vị Tính
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                        {unitRows.length} ĐVT
                                    </span>
                                </div>
                            </div>

                            {unitRows.length === 0 ? (
                                <div className="p-8 text-center text-xs text-stone-400">
                                    Chưa có phát sinh số liệu.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-stone-50 dark:bg-zinc-950 text-stone-500 text-[11px] uppercase border-b border-stone-200 dark:border-zinc-800">
                                            <tr>
                                                <th className="py-2.5 px-3 font-semibold text-center w-12">STT</th>
                                                <th className="py-2.5 px-3 font-semibold">Đơn vị tính</th>
                                                <th className="py-2.5 px-3 font-semibold text-right text-emerald-600 w-36">Nhập (+)</th>
                                                <th className="py-2.5 px-3 font-semibold text-right text-rose-600 w-36">Xuất (-)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                            {unitRows.map((u, idx) => {
                                                return (
                                                    <tr key={`${u.unit}_${idx}`} className="hover:bg-stone-50/60 dark:hover:bg-zinc-800/40">
                                                        <td className="py-2.5 px-3 text-center text-stone-400 font-mono text-[11px]">{idx + 1}</td>
                                                        <td className="py-2.5 px-3 font-bold text-stone-900 dark:text-white">{u.unit}</td>
                                                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                                                            {u.in_qty > 0 ? `+${u.in_qty.toLocaleString('vi-VN')}` : '0'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                                                            {u.out_qty > 0 ? `-${u.out_qty.toLocaleString('vi-VN')}` : '0'}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* BẢNG 3: DANH SÁCH CÁC CÔNG VIỆC THAM GIA */}
                        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                            <div className="px-4 py-3 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/60 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-amber-500" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                                        3. Danh sách các công việc ({shifts.length})
                                    </span>
                                </div>
                            </div>

                            <div className="divide-y divide-stone-100 dark:divide-zinc-800">
                                {shifts.map((s, idx) => {
                                    const jobTitle = s.summary_data?.job_name || s.notes || `Công việc #${idx + 1}`
                                    const pCount = Object.keys(s.summary_data?.products_summary || {}).length
                                    const rCount = s.summary_data?.total_records ?? 0
                                    const isClosed = s.status === 'closed'
                                    const isExpanded = expandedShiftIdsInReport.has(s.id)

                                    // Lấy danh sách sản phẩm của riêng công việc này
                                    const shiftLines = lines.filter(l => (l.notes || '').includes(`[CV_ID: ${s.id}]`))
                                    const rawShiftProds: any[] = shiftLines.length > 0
                                        ? summarizeLines(shiftLines, s)
                                        : Object.values(s.summary_data?.products_summary || {})
                                    const shiftProdList = rawShiftProds.map((p: any) => ({
                                        ...p,
                                        sku: p.sku || findProductSku(p.product_name, p.product_id, s.summary_data?.pinned_products)
                                    }))

                                    return (
                                        <div key={s.id || idx} className="p-3.5 hover:bg-stone-50/50 dark:hover:bg-zinc-800/30 transition">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div
                                                    className="space-y-1 flex-1 cursor-pointer"
                                                    onClick={() => {
                                                        setExpandedShiftIdsInReport(prev => {
                                                            const next = new Set(prev)
                                                            if (next.has(s.id)) next.delete(s.id)
                                                            else next.add(s.id)
                                                            return next
                                                        })
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-white hover:text-indigo-600 transition">
                                                            {jobTitle}
                                                        </span>
                                                        {isClosed ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                Đã chốt
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                Đang mở
                                                            </span>
                                                        )}
                                                        {/* Chú ý: Đóng ca vào ngày hôm sau */}
                                                        {s.closed_at && getShiftLocalDateString(s.opened_at) !== getShiftLocalDateString(s.closed_at) && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                <span>🌙 Đóng ca vào ngày hôm sau ({formatDateTime(s.closed_at)})</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-stone-500 flex items-center gap-2 flex-wrap">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-stone-400" />
                                                            {formatDateTime(s.opened_at)} → {s.closed_at ? formatDateTime(s.closed_at) : 'Hiện tại'}
                                                        </span>
                                                        <span>•</span>
                                                        <span>Người chốt/mở: <strong className="text-stone-700 dark:text-stone-300">{s.closed_by_name || s.opened_by_name || 'Nhân viên'}</strong></span>
                                                        <span>•</span>
                                                        <span>{pCount} SP • {rCount} đợt</span>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setExpandedShiftIdsInReport(prev => {
                                                            const next = new Set(prev)
                                                            if (next.has(s.id)) next.delete(s.id)
                                                            else next.add(s.id)
                                                            return next
                                                        })
                                                    }}
                                                    className={`self-start sm:self-auto h-7 px-3 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 ${
                                                        isExpanded
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                                                            : 'border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-600 dark:text-stone-300'
                                                    }`}
                                                >
                                                    <Eye className="w-3.5 h-3.5 text-indigo-500" />
                                                    <span>{isExpanded ? 'Thu gọn kết quả' : 'Xem chi tiết ca'}</span>
                                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-500' : 'text-stone-400'}`} />
                                                </button>
                                            </div>

                                            {/* KHU VỰC MỞ RỘNG KẾT QUẢ CHI TIẾT NGAY TẠI CHỖ */}
                                            {isExpanded && (
                                                <div className="mt-3 pt-3 border-t border-stone-200/80 dark:border-zinc-800 bg-stone-50/70 dark:bg-zinc-950/50 -mx-3.5 -mb-3.5 p-3.5 rounded-b-xl space-y-3">
                                                    {/* Bảng sản phẩm của riêng công việc này */}
                                                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                                                        <div className="px-3 py-2 bg-stone-100/70 dark:bg-zinc-800/60 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between text-[11px] font-bold">
                                                            <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-200">
                                                                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                                                                <span>Chi tiết sản phẩm ({shiftProdList.length} SP)</span>
                                                            </div>
                                                            {shiftLines.length > 0 && (
                                                                <span className="text-stone-400 font-normal">{shiftLines.length} lượt ghi nhận</span>
                                                            )}
                                                        </div>

                                                        {shiftProdList.length === 0 ? (
                                                            <div className="p-3 text-center text-[11px] text-stone-400">
                                                                Chưa có phát sinh số liệu trong công việc này.
                                                            </div>
                                                        ) : (
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-[11px] text-left">
                                                                    <thead className="bg-stone-50 dark:bg-zinc-950 text-stone-400 text-[10px] uppercase border-b border-stone-100 dark:border-zinc-800">
                                                                        <tr>
                                                                            <th className="py-2 px-3 text-center w-8">STT</th>
                                                                            <th className="py-2 px-3">Sản phẩm</th>
                                                                            <th className="py-2 px-3 text-center w-24">ĐVT</th>
                                                                            <th className="py-2 px-3 text-right text-emerald-600 w-32">Nhập (+)</th>
                                                                            <th className="py-2 px-3 text-right text-rose-600 w-32">Xuất (-)</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/60">
                                                                        {shiftProdList.map((p: any, pIdx: number) => {
                                                                            const inQ = Number(p.in_qty) || 0
                                                                            const outQ = Number(p.out_qty) || 0
                                                                            return (
                                                                                <tr key={pIdx} className="hover:bg-stone-50/50 dark:hover:bg-zinc-800/30">
                                                                                    <td className="py-2 px-3 text-center text-stone-400 text-[10px]">{pIdx + 1}</td>
                                                                                    <td className="py-2 px-3 font-semibold text-stone-900 dark:text-white">
                                                                                        {p.product_name}
                                                                                    </td>
                                                                                    <td className="py-2 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{p.unit}</td>
                                                                                    <td className="py-2 px-3 text-right font-bold text-emerald-600">
                                                                                        {inQ > 0 ? `+${inQ.toLocaleString('vi-VN')}` : '0'}
                                                                                    </td>
                                                                                    <td className="py-2 px-3 text-right font-bold text-rose-600">
                                                                                        {outQ > 0 ? `-${outQ.toLocaleString('vi-VN')}` : '0'}
                                                                                    </td>
                                                                                </tr>
                                                                            )
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Ghi chú & Nút chuyển sang xem trang quản trị riêng nếu muốn */}
                                                    <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500 pt-1">
                                                        <span className="truncate italic">
                                                            {s.notes ? s.notes.replace(/\[CV:[^\]]*\]/g, '').replace(/\[CV_ID:[^\]]*\]/g, '').trim() || 'Không có ghi chú thêm.' : 'Không có ghi chú thêm.'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                selectDoneShift(s)
                                                                setDoneViewMode('single')
                                                            }}
                                                            className="shrink-0 text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                                                        >
                                                            <span>Mở trang chi tiết ca</span>
                                                            <ExternalLink className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-stone-50 dark:bg-zinc-950 text-stone-800 dark:text-stone-100">
            {/* ===== BANNER CẢNH BÁO CHẾ ĐỘ NGOẠI TUYẾN / KHO ĐÔNG LẠNH ===== */}
            {(!isOnline || offlineQueueCount > 0) && (
                <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-bold truncate">
                                {!isOnline
                                    ? '⚠️ Đang làm việc Ngoại Tuyến (Offline trong Kho Đông Lạnh)'
                                    : '📡 Có số liệu ngoại tuyến sẵn sàng đồng bộ'}
                            </div>
                            <div className="text-[11px] text-amber-700/80 dark:text-amber-300/80 truncate">
                                {offlineQueueCount > 0
                                    ? `Đang lưu an toàn ${offlineQueueCount} thao tác trong máy • Bấm Đồng bộ khi có sóng mạng.`
                                    : 'Mất sóng Internet. Bạn vẫn có thể nhập/xuất và mở/đóng ca bình thường không gián đoạn.'}
                            </div>
                        </div>
                    </div>

                    {offlineQueueCount > 0 && (
                        <button
                            type="button"
                            onClick={syncOfflineWebData}
                            disabled={isSyncingOffline}
                            className="shrink-0 h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOffline ? 'animate-spin' : ''}`} />
                            <span>{isSyncingOffline ? 'Đang gửi...' : 'Đồng bộ ngay'}</span>
                        </button>
                    )}
                </div>
            )}
            {/* ===== MOBILE HEADER GỌN: Chuyển chế độ Đang làm / Đã hoàn thành + chọn CV + tìm kiếm ===== */}
            <header className="sm:hidden sticky top-0 z-30 bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 px-3 pt-2 pb-2 space-y-1.5">
                {/* Chuyển nhanh: Đang làm | Đã hoàn thành */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 dark:bg-zinc-800 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setPageView('active')}
                        className={`h-7 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
                            pageView === 'active'
                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-stone-500 dark:text-stone-400'
                        }`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${openShifts.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'}`} />
                        Đang làm ({openShifts.length})
                    </button>
                    <button
                        type="button"
                        onClick={openDoneView}
                        className={`h-7 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
                            pageView === 'done'
                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-stone-500 dark:text-stone-400'
                        }`}
                    >
                        <CheckCircle2 className="w-3 h-3" />
                        Đã hoàn thành ({pastShifts.length})
                    </button>
                </div>

                {pageView === 'active' && (
                    <>
                        <div className="flex items-center gap-1.5">
                            {activeShift ? (
                                <button
                                    type="button"
                                    onClick={() => setMobileJobSheet(true)}
                                    className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-indigo-600 text-white flex items-center gap-2 active:scale-[0.98] transition"
                                >
                                    <Briefcase className="w-3.5 h-3.5 shrink-0 opacity-80" />
                                    <span className="flex-1 min-w-0 text-left">
                                        <span className="block text-[9px] leading-none opacity-75">
                                            Công việc {openShifts.length > 1 ? `(${openShifts.length} đang mở)` : ''}
                                        </span>
                                        <span className="block text-xs font-bold truncate leading-tight mt-0.5">{currentJobName}</span>
                                    </span>
                                    <span className="text-[11px] opacity-80 shrink-0">▼</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => handleOpenCreateShiftModal()}
                                    className="flex-1 h-10 px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Tạo công việc
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setMobileMenu(true)}
                                className="w-10 h-10 shrink-0 rounded-xl border border-stone-200 dark:border-zinc-700 flex items-center justify-center text-stone-600 dark:text-stone-300 text-lg font-bold leading-none"
                                aria-label="Thao tác"
                            >
                                ⋯
                            </button>
                        </div>

                        {activeShift && (
                            <div className="relative">
                                {/* Bấm vào kính lúp để đổi chế độ trên Mobile */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchMode(prev => prev === 'filter' ? 'pin' : 'filter')
                                        setSearchQuery('')
                                    }}
                                    title="Bấm chuyển đổi chế độ tìm kiếm"
                                    className={`absolute left-1.5 top-1/2 -translate-y-1/2 h-7 px-2 rounded-lg flex items-center gap-1 transition-all z-10 cursor-pointer shadow-2xs ${
                                        searchMode === 'filter'
                                            ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                            : 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    }`}
                                >
                                    <Search className="w-3.5 h-3.5 shrink-0" />
                                    <span className="text-[10px] font-black tracking-tight select-none">
                                        {searchMode === 'filter' ? 'Nhập' : 'Ghim'}
                                    </span>
                                </button>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            if (searchMode === 'filter') {
                                                const target = searchResults[0] || displayedPinnedProducts[0]
                                                if (target) {
                                                    openPad(target)
                                                    setSearchQuery('')
                                                }
                                            }
                                        }
                                    }}
                                    placeholder={
                                        searchMode === 'filter'
                                            ? 'Tìm SP đã ghim (Bấm 🔍 đổi chế độ)'
                                            : 'Tìm SP từ kho (Bấm 🔍 đổi chế độ)'
                                    }
                                    className={`w-full h-9 pl-[76px] pr-8 text-xs placeholder:text-[10.5px] placeholder:text-stone-400 dark:placeholder:text-zinc-500 bg-stone-100 dark:bg-zinc-800 border rounded-xl focus:outline-none transition ${
                                        searchMode === 'filter'
                                            ? 'border-indigo-300 dark:border-indigo-700/60 focus:border-indigo-500'
                                            : 'border-amber-300 dark:border-amber-700/60 focus:border-amber-500'
                                    }`}

                                />



                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-stone-400"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {isSearching && searchMode === 'pin' && (
                                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl shadow-xl z-40 overflow-hidden divide-y divide-stone-100 dark:divide-zinc-700/50 max-h-[60vh] overflow-y-auto">
                                            {searchResults.length > 0 ? (
                                                searchResults.map(p => {
                                                    const isPinned = pinnedProducts.some(pinned => pinned.id === p.id)
                                                    return (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (isPinned) handleUnpinProduct(p.id)
                                                                else handlePinProduct(p)
                                                            }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left active:bg-stone-100 dark:active:bg-zinc-700"
                                                        >
                                                            <span className="flex-1 min-w-0">
                                                                <span className="block text-xs font-semibold text-stone-900 dark:text-white leading-snug">{p.name}</span>
                                                                <span className="block text-[10px] text-stone-400 mt-0.5">{p.sku || 'Chưa có mã'}</span>
                                                            </span>
                                                            <span className={`shrink-0 h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                                                                isPinned ? 'bg-stone-200 dark:bg-zinc-700 text-stone-600 dark:text-stone-300' : 'bg-indigo-600 text-white'
                                                            }`}>
                                                                {isPinned ? <><Check className="w-3 h-3" /> Đã ghim</> : <><Pin className="w-3 h-3" /> Ghim</>}
                                                            </span>
                                                        </button>
                                                    )
                                                })
                                            ) : (
                                                <div className="p-3.5 text-center">
                                                    <p className="text-[11px] text-stone-500 mb-2">Không tìm thấy sản phẩm.</p>
                                                    <button
                                                        onClick={handleAddCustomProduct}
                                                        className="h-8 px-3 text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                                    >
                                                        + Ghim hàng tự do: "{searchQuery}"
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {isSearching && searchMode === 'filter' && (
                                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-xl z-40 overflow-hidden divide-y divide-stone-100 dark:divide-zinc-700/50 max-h-[60vh] overflow-y-auto">
                                            <div className="px-3 py-1.5 bg-indigo-50/70 dark:bg-indigo-950/40 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                                                <span>Tìm thấy {searchResults.length} sản phẩm đã ghim</span>
                                            </div>
                                            {searchResults.length > 0 ? (
                                                searchResults.map((p, sIdx) => {
                                                    const origIdx = pinnedProducts.findIndex(x => x.id === p.id)
                                                    const productUnits = getProductUnits(p)
                                                    const currentUnit = selectedUnitMap[p.id] || p.unit || productUnits[0] || 'Kg'
                                                    const counts = getProductCount(p.name, currentUnit)
                                                    return (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onClick={() => {
                                                                openPad(p)
                                                                setSearchQuery('')
                                                            }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left active:bg-indigo-50 dark:active:bg-zinc-700"
                                                        >
                                                            <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                                                {origIdx >= 0 ? origIdx + 1 : sIdx + 1}
                                                            </span>
                                                            <span className="flex-1 min-w-0">
                                                                <span className="block text-xs font-semibold text-stone-900 dark:text-white leading-snug">{p.name}</span>
                                                                <span className="block text-[10px] text-stone-400 mt-0.5">
                                                                    {p.sku || 'Chưa có mã'} • ĐVT: {currentUnit}
                                                                    {(counts.inQty > 0 || counts.outQty > 0) && (
                                                                        <span className="ml-1.5 font-bold">
                                                                            {counts.inQty > 0 && <span className="text-emerald-600 mr-1">+{counts.inQty}</span>}
                                                                            {counts.outQty > 0 && <span className="text-rose-600">-{counts.outQty}</span>}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </span>
                                                            <span className="shrink-0 h-7 px-2.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white flex items-center gap-1 shadow-xs">
                                                                <Zap className="w-3 h-3 fill-white" /> Nhập
                                                            </span>
                                                        </button>
                                                    )
                                                })
                                            ) : (
                                                <div className="p-3.5 text-center">
                                                    <p className="text-[11px] text-stone-500 mb-2">Không tìm thấy sản phẩm đã ghim nào khớp với "{searchQuery}".</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSearchMode('pin')}
                                                        className="h-8 px-3 text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                                    >
                                                        Tìm trong kho để ghim
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                        )}

                    </>
                )}
            </header>

            {/* ===== DESKTOP HEADER GỌN: Hàng 1 = Logo + Chuyển chế độ + Tab CV dạng 1 hàng + Thao tác ===== */}
            <header className="hidden sm:block bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 sticky top-0 z-30 shadow-xs">
                {/* Hàng 1: Điều hướng & Quản lý công việc (Siêu mỏng ~42px) */}
                <div className="max-w-7xl mx-auto px-6 py-1.5 flex items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                            <BarChart3 className="w-4 h-4" />
                        </div>
                        <h1 className="text-sm font-bold text-stone-900 dark:text-white whitespace-nowrap">Bàn Số Liệu</h1>
                    </div>

                    {/* Bộ chuyển chế độ: Đang làm | Đã hoàn thành */}
                    <div className="inline-flex p-0.5 bg-stone-100 dark:bg-zinc-800 rounded-lg shrink-0">
                        <button
                            type="button"
                            onClick={() => setPageView('active')}
                            className={`h-7 px-2.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
                                pageView === 'active'
                                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                            }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${openShifts.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'}`} />
                            Đang làm ({openShifts.length})
                        </button>
                        <button
                            type="button"
                            onClick={openDoneView}
                            className={`h-7 px-2.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
                                pageView === 'done'
                                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                            }`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã hoàn thành ({pastShifts.length})
                        </button>
                    </div>

                    <div className="w-px h-6 bg-stone-200 dark:bg-zinc-700 shrink-0" />

                    {pageView === 'active' ? (
                        <>
                            {/* Khoảng trống co giãn giữa bên trái và cụm thao tác bên phải */}
                            <div className="flex-1 min-w-0" />

                            {/* Cụm thao tác của CV đang chọn */}
                            {activeShift && (
                                <div className="shrink-0 flex items-center gap-1.5">
                                    {subShifts.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowSubShiftsPanel(true)}
                                            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center gap-1"
                                            title="Xem các lần chốt tạm"
                                        >
                                            <Layers className="w-3.5 h-3.5" /> {subShifts.length} lần chốt
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={async () => { await calculateInterimSummary(); setInterimCloseModal(true) }}
                                        className="h-8 px-2.5 rounded-lg text-xs font-semibold border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 flex items-center gap-1 transition"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Chốt tạm
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => { setCloseOrderTypeId(activeShift?.summary_data?.order_type_id || ''); await calculateShiftSummary(activeShift.opened_at); setCloseShiftModal(true) }}
                                        className="h-8 px-3 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 transition shadow-xs"
                                    >
                                        <StopCircle className="w-3.5 h-3.5" /> Hoàn thành CV
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteOpenShift(activeShift.id, currentJobName)}
                                        title={`Xóa nhanh công việc "${currentJobName}"`}
                                        className="h-8 w-8 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0 transition"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            {/* Cụm công cụ: Mẫu CV + Reload */}
                            <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-stone-200 dark:border-zinc-700">
                                <Link
                                    href="/so-lieu/mau-cong-viec"
                                    className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition"
                                    title="Quản lý và tạo mới các công việc mẫu"
                                >
                                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Mẫu CV</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => loadJournalData()}
                                    disabled={loadingData}
                                    title="Tải lại số liệu"
                                    className="w-8 h-8 rounded-lg border border-stone-200 dark:border-zinc-700 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Bộ lọc khi ở chế độ Đã hoàn thành */}
                            <div className="flex-1 flex items-center gap-2">
                                <div className="inline-flex rounded-lg border border-stone-200 dark:border-zinc-700 overflow-hidden text-xs font-semibold">
                                    {([
                                        { id: 'today', label: 'Hôm nay' },
                                        { id: '7d', label: '7 ngày' },
                                        { id: '30d', label: '30 ngày' },
                                        { id: 'all', label: 'Tất cả' },
                                    ] as const).map((r, i) => (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => { setDoneRange(r.id); loadPastShifts(r.id) }}
                                            className={`h-7 px-2.5 transition ${i > 0 ? 'border-l border-stone-200 dark:border-zinc-700' : ''} ${
                                                doneRange === r.id
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-white dark:bg-zinc-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
                                            }`}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative flex-1 max-w-xs">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                                    <input
                                        type="text"
                                        value={doneSearch}
                                        onChange={e => setDoneSearch(e.target.value)}
                                        placeholder="Tìm công việc hoặc sản phẩm..."
                                        className="w-full h-7 pl-8 pr-7 text-xs bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    {doneSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setDoneSearch('')}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                <Link
                                    href="/so-lieu/mau-cong-viec"
                                    className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition"
                                    title="Quản lý và tạo mới các công việc mẫu"
                                >
                                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Mẫu CV</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => handleOpenCreateShiftModal()}
                                    className="h-8 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Tạo công việc mới
                                </button>
                                <button
                                    type="button"
                                    onClick={() => loadPastShifts(doneRange)}
                                    disabled={doneListLoading}
                                    title="Tải lại danh sách"
                                    className="w-8 h-8 rounded-lg border border-stone-200 dark:border-zinc-700 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${doneListLoading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Hàng 2: Danh sách công việc (Dropdown) + Tìm kiếm & Ghim sản phẩm (Chỉ hiện khi Đang làm - Siêu mỏng ~34px) */}
                {pageView === 'active' && activeShift && (
                    <div className="border-t border-stone-100 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/40">
                        <div className="max-w-7xl mx-auto px-6 py-1 flex items-center gap-2.5">
                            {/* Cụm chọn công việc dạng SỔ XUỐNG (Dropdown): Kéo dài rộng rãi để đọc trọn vẹn tên CV */}
                            <div className="relative shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setDesktopJobDropdown(prev => !prev)}
                                    className="h-8 px-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-800 hover:bg-indigo-50/50 dark:hover:bg-zinc-700/60 text-stone-900 dark:text-white flex items-center justify-between gap-2.5 transition min-w-[260px] sm:min-w-[320px] lg:min-w-[380px] max-w-lg group shadow-2xs"
                                    title="Bấm để chọn hoặc chuyển sang công việc khác"
                                >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse shrink-0" />
                                        <span className="text-xs font-bold text-stone-900 dark:text-white truncate max-w-[200px] sm:max-w-[250px] lg:max-w-[300px]">
                                            {currentJobName}
                                        </span>
                                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">
                                            ({allJobJournals.length} đợt)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 pl-1">
                                        {openShifts.length > 1 && (
                                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                                {openShifts.length} việc
                                            </span>
                                        )}
                                        <ChevronDown className={`w-3.5 h-3.5 text-stone-400 group-hover:text-indigo-600 transition-transform duration-200 ${desktopJobDropdown ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>

                                {/* Dropdown Menu Sổ Xuống */}
                                {desktopJobDropdown && (
                                    <>
                                        {/* Backdrop trong suốt bắt click outside */}
                                        <div 
                                            className="fixed inset-0 z-40" 
                                            onClick={() => setDesktopJobDropdown(false)} 
                                        />
                                        <div className="absolute top-full left-0 mt-1.5 w-88 sm:w-[420px] bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-stone-100 dark:divide-zinc-800 animate-in fade-in zoom-in-95 duration-100">
                                            {/* Header dropdown */}
                                            <div className="px-3.5 py-2 bg-stone-50 dark:bg-zinc-850 flex items-center justify-between text-xs font-semibold text-stone-500">
                                                <span>Danh sách công việc ({openShifts.length} đang mở)</span>
                                                <button
                                                    type="button"
                                                    onClick={() => { setDesktopJobDropdown(false); handleOpenCreateShiftModal(); }}
                                                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Tạo mới
                                                </button>
                                            </div>

                                            {/* Danh sách các công việc */}
                                            <div className="max-h-72 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800/60">
                                                {openShifts.map((shift, idx) => {
                                                    const isSelected = activeShift?.id === shift.id
                                                    const jobTitle = shift.summary_data?.job_name || shift.notes || `Công việc ${idx + 1}`
                                                    return (
                                                        <div
                                                            key={shift.id}
                                                            onClick={() => {
                                                                if (activeShift?.id !== shift.id) {
                                                                    setPinnedProducts([])
                                                                    setAllJobJournals([])
                                                                    setJournalList([])
                                                                    setSubShifts([])
                                                                    setPadProduct(null)
                                                                    setDraftQtyMap({})
                                                                }
                                                                setSelectedShiftId(shift.id)
                                                                setDesktopJobDropdown(false)
                                                            }}
                                                            className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition ${
                                                                isSelected
                                                                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                                                                    : 'hover:bg-stone-50 dark:hover:bg-zinc-800/60'
                                                            }`}
                                                        >
                                                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isSelected ? 'bg-indigo-600 ring-2 ring-indigo-300' : 'bg-emerald-500'}`} />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className={`text-xs font-bold leading-snug break-words ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-stone-800 dark:text-stone-100'}`}>
                                                                        {jobTitle}
                                                                    </div>
                                                                    <div className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                                                                        <Clock className="w-3 h-3 shrink-0" />
                                                                        <span>Mở {formatTimeOnly(shift.opened_at)}</span>
                                                                        <span>•</span>
                                                                        <span>{isSelected ? `${allJobJournals.length} đợt` : 'Đang mở'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {isSelected && (
                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                                                                        Đang làm
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleDeleteOpenShift(shift.id, jobTitle)
                                                                    }}
                                                                    title={`Xóa công việc "${jobTitle}"`}
                                                                    className="w-7 h-7 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 flex items-center justify-center transition"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {/* Footer dropdown */}
                                            <div className="p-2 bg-stone-50/50 dark:bg-zinc-800/30">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDesktopJobDropdown(false)
                                                        handleOpenCreateShiftModal()
                                                    }}
                                                    className="w-full h-8 px-3 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center justify-center gap-1.5 transition"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    <span>Thêm công việc khác</span>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Nút [+] tạo công việc mới nhanh */}
                            <button
                                type="button"
                                onClick={() => handleOpenCreateShiftModal()}
                                title="Thêm công việc mới"
                                className="h-8 w-8 rounded-lg border-2 border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-center shrink-0 transition"
                            >
                                <Plus className="w-4 h-4" />
                            </button>

                            <div className="w-px h-5 bg-stone-200 dark:bg-zinc-700 shrink-0" />

                            {/* Ô tìm kiếm sản phẩm: Bấm vào kính lúp ở đầu ô để đổi chế độ */}
                            <div className="relative flex-1 min-w-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchMode(prev => prev === 'filter' ? 'pin' : 'filter')
                                        setSearchQuery('')
                                    }}
                                    title="Bấm chuyển đổi chế độ tìm kiếm"
                                    className={`absolute left-1.5 top-1/2 -translate-y-1/2 h-6 px-1.5 rounded-md flex items-center gap-1 transition-all z-10 cursor-pointer shadow-2xs ${
                                        searchMode === 'filter'
                                            ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                            : 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    }`}
                                >
                                    <Search className="w-3.5 h-3.5 shrink-0" />
                                    <span className="text-[10px] font-black tracking-tight select-none">
                                        {searchMode === 'filter' ? 'Nhập' : 'Ghim'}
                                    </span>
                                </button>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            if (searchMode === 'filter') {
                                                const target = searchResults[0] || displayedPinnedProducts[0]
                                                if (target) {
                                                    openPad(target)
                                                    setSearchQuery('')
                                                }
                                            }
                                        }
                                    }}
                                    placeholder={
                                        searchMode === 'filter'
                                            ? 'Tìm SP đã ghim để nhập số (Bấm 🔍 đổi chế độ)'
                                            : 'Tìm SP trong kho để ghim (Bấm 🔍 đổi chế độ)'
                                    }
                                    className={`w-full h-8 pl-[78px] pr-8 text-xs placeholder:text-[10.5px] placeholder:text-stone-400 dark:placeholder:text-zinc-500 bg-white dark:bg-zinc-800 border rounded-lg focus:ring-2 focus:border-transparent focus:outline-none transition ${
                                        searchMode === 'filter'
                                            ? 'border-indigo-200 dark:border-indigo-800/80 focus:ring-indigo-500'
                                            : 'border-amber-200 dark:border-amber-800/80 focus:ring-amber-500'
                                    }`}

                                />



                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {isSearching && searchMode === 'pin' && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl shadow-xl z-40 overflow-hidden divide-y divide-stone-100 dark:divide-zinc-700/50 max-h-[60vh] overflow-y-auto">
                                        {searchResults.length > 0 ? (
                                            searchResults.map(p => {
                                                const isPinned = pinnedProducts.some(pinned => pinned.id === p.id)
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isPinned) handleUnpinProduct(p.id)
                                                            else handlePinProduct(p)
                                                        }}
                                                        className="w-full flex items-center gap-3 px-3.5 py-2 text-left hover:bg-stone-50 dark:hover:bg-zinc-700/50"
                                                    >
                                                        <span className="flex-1 min-w-0">
                                                            <span className="block text-xs font-semibold text-stone-900 dark:text-white">{p.name}</span>
                                                            <span className="block text-[11px] text-stone-400 mt-0.5">
                                                                {p.sku || 'Chưa có mã'}
                                                                {p.available_units && p.available_units.length > 0 && ` • ${p.available_units.join(', ')}`}
                                                                {p.aliases && ` • Gõ tắt: ${p.aliases}`}
                                                            </span>
                                                        </span>
                                                        <span className={`shrink-0 h-7 px-2.5 rounded-md text-xs font-bold flex items-center gap-1 ${
                                                            isPinned ? 'bg-stone-200 dark:bg-zinc-700 text-stone-600 dark:text-stone-300' : 'bg-indigo-600 text-white'
                                                        }`}>
                                                            {isPinned ? <><Check className="w-3 h-3" /> Đã ghim</> : <><Pin className="w-3 h-3" /> Ghim</>}
                                                        </span>
                                                    </button>
                                                )
                                            })
                                        ) : (
                                            <div className="p-3 text-center">
                                                <p className="text-xs text-stone-500 mb-1.5">Không tìm thấy sản phẩm trong danh mục.</p>
                                                <button
                                                    onClick={handleAddCustomProduct}
                                                    className="h-7 px-3 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                                >
                                                    + Ghim hàng tự do: "{searchQuery}"
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {isSearching && searchMode === 'filter' && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-xl z-40 overflow-hidden divide-y divide-stone-100 dark:divide-zinc-700/50 max-h-[60vh] overflow-y-auto">
                                        <div className="px-3 py-1.5 bg-indigo-50/70 dark:bg-indigo-950/40 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                                            <span>Tìm thấy {searchResults.length} sản phẩm đã ghim (Bấm hoặc nhấn Enter để nhập số)</span>
                                            <span className="text-[10px] text-stone-400">Esc để đóng</span>
                                        </div>
                                        {searchResults.length > 0 ? (
                                            searchResults.map((p, sIdx) => {
                                                const origIdx = pinnedProducts.findIndex(x => x.id === p.id)
                                                const productUnits = getProductUnits(p)
                                                const currentUnit = selectedUnitMap[p.id] || p.unit || productUnits[0] || 'Kg'
                                                const counts = getProductCount(p.name, currentUnit)
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => {
                                                            openPad(p)
                                                            setSearchQuery('')
                                                        }}
                                                        className={`w-full flex items-center gap-3 px-3.5 py-2 text-left hover:bg-indigo-50/50 dark:hover:bg-zinc-700/50 transition ${
                                                            sIdx === 0 ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                                                        }`}
                                                    >
                                                        <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                                            {origIdx >= 0 ? origIdx + 1 : sIdx + 1}
                                                        </span>
                                                        <span className="flex-1 min-w-0">
                                                            <span className="block text-xs font-semibold text-stone-900 dark:text-white leading-snug">{p.name}</span>
                                                            <span className="block text-[11px] text-stone-400 mt-0.5">
                                                                {p.sku || 'Chưa có mã'} • ĐVT: <span className="font-semibold text-stone-600 dark:text-stone-300">{currentUnit}</span>
                                                                {(counts.inQty > 0 || counts.outQty > 0) && (
                                                                    <span className="ml-2 font-bold">
                                                                        {counts.inQty > 0 && <span className="text-emerald-600 mr-1.5">+{counts.inQty}</span>}
                                                                        {counts.outQty > 0 && <span className="text-rose-600">-{counts.outQty}</span>}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </span>
                                                        <span className="shrink-0 h-7 px-3 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-xs">
                                                            <Zap className="w-3 h-3 fill-white" /> Nhập số
                                                        </span>
                                                    </button>
                                                )
                                            })
                                        ) : (
                                            <div className="p-4 text-center">
                                                <p className="text-xs text-stone-500 mb-2">Không tìm thấy sản phẩm đã ghim nào khớp với "{searchQuery}".</p>
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchMode('pin')}
                                                    className="h-7 px-3 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                                >
                                                    Chuyển sang tìm trong kho để ghim SP này
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>


                            {subShifts.length > 0 && (
                                <div className="inline-flex rounded-lg border border-stone-200 dark:border-zinc-700 overflow-hidden text-xs font-semibold shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('sub-shift')}
                                        className={`h-7 px-2.5 ${viewMode === 'sub-shift' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-800 text-stone-600 dark:text-stone-300'}`}
                                    >
                                        Đợt hiện tại
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('shift')}
                                        className={`h-7 px-2.5 border-l border-stone-200 dark:border-zinc-700 ${viewMode === 'shift' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-800 text-stone-600 dark:text-stone-300'}`}
                                    >
                                        Toàn CV
                                    </button>
                                </div>
                            )}

                            <div className="ml-auto flex items-center gap-2 text-xs text-stone-500 shrink-0">
                                <span>Đã ghim: <strong className="text-stone-800 dark:text-white">{pinnedProducts.length} SP</strong></span>
                                {pinnedProducts.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirm(`⚠️ CẢNH BÁO: Bạn có chắc chắn muốn xóa toàn bộ danh sách ${pinnedProducts.length} sản phẩm đã ghim của công việc "${currentJobName}" không?\n\n(Thao tác này sẽ dọn sạch danh sách sản phẩm trên bàn làm việc!)`)) {
                                                updatePinnedProducts([])
                                            }
                                        }}
                                        title="Xóa toàn bộ danh sách sản phẩm đã ghim"
                                        className="w-7 h-7 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                        </div>
                    </div>
                )}
            </header>

            {/* 4. BÀN LÀM VIỆC CHÍNH & BÁO CÁO ĐÃ HOÀN THÀNH TÍCH HỢP */}
            <main className={`flex-1 p-3 sm:px-6 sm:pt-1 sm:pb-6 max-w-7xl mx-auto w-full pb-20 sm:pb-8 ${pageView === 'active' && activeShift && pinnedProducts.length > 0 ? 'sm:grid sm:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_360px] sm:gap-5 sm:items-start' : ''}`}>
                {pageView === 'done' ? (
                    <div className="space-y-4">
                        {/* THANH MENU 3 CHẾ ĐỘ XEM TRONG TAB ĐÃ HOÀN THÀNH */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-xs">
                            <div className="inline-flex p-1 bg-stone-100 dark:bg-zinc-800/80 rounded-xl gap-1">
                                <button
                                    type="button"
                                    onClick={() => setDoneViewMode('single')}
                                    className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                                        doneViewMode === 'single'
                                            ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                                    }`}
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Từng công việc</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDoneViewMode('by-date')
                                        if (availableDates.length > 0 && !shiftsOnSelectedDate.length) {
                                            const latest = availableDates[0]
                                            setByDateRange({ from: latest, to: latest })
                                            setByDateMultiDates(new Set([latest]))
                                        }
                                    }}
                                    className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                                        doneViewMode === 'by-date'
                                            ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                                    }`}
                                >
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>Báo cáo theo ngày</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDoneViewMode('by-product')}
                                    className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                                        doneViewMode === 'by-product'
                                            ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                                    }`}
                                >
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>Báo cáo theo sản phẩm</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDoneViewMode('custom')
                                        if (customSelectedIds.size === 0 && pastShifts.length > 0) {
                                            setCustomSelectedIds(new Set([pastShifts[0].id]))
                                        }
                                    }}
                                    className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                                        doneViewMode === 'custom'
                                            ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                                    }`}
                                >
                                    <CheckSquare className="w-3.5 h-3.5" />
                                    <span>Báo cáo tùy chọn {customSelectedIds.size > 0 && `(${customSelectedIds.size} CV)`}</span>
                                </button>
                            </div>

                            <div className="text-[11px] text-stone-500 flex items-center gap-2 px-2">
                                {doneViewMode === 'single' && (
                                    <span>Xem chi tiết đối soát từng công việc</span>
                                )}
                                {doneViewMode === 'by-date' && (
                                    <span>Gộp tất cả công việc trong ngày vào 1 bảng</span>
                                )}
                                {doneViewMode === 'by-product' && (
                                    <span>Tổng hợp số liệu xuất/nhập chi tiết gom theo từng mặt hàng</span>
                                )}
                                {doneViewMode === 'custom' && (
                                    <span>Tích chọn các công việc để gộp báo cáo & xuất Excel</span>
                                )}
                            </div>
                        </div>

                        {/* 1. CHẾ ĐỘ: TỪNG CÔNG VIỆC */}
                        {doneViewMode === 'single' && (
                            <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-[340px_minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)] sm:gap-5 sm:items-start">
                        {/* Bộ lọc trên Mobile cho tab Đã hoàn thành / Báo cáo */}
                        {!doneSelectedShift && (
                            <div className="sm:hidden space-y-1.5">
                                <div className="grid grid-cols-4 gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-stone-200 dark:border-zinc-800 text-[11px] font-bold">
                                    {([
                                        { id: 'today', label: 'Hôm nay' },
                                        { id: '7d', label: '7 ngày' },
                                        { id: '30d', label: '30 ngày' },
                                        { id: 'all', label: 'Tất cả' },
                                    ] as const).map(r => (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => { setDoneRange(r.id); loadPastShifts(r.id) }}
                                            className={`h-7 rounded-lg transition ${
                                                doneRange === r.id ? 'bg-indigo-600 text-white' : 'text-stone-600 dark:text-stone-300'
                                            }`}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                                    <input
                                        type="text"
                                        value={doneSearch}
                                        onChange={e => setDoneSearch(e.target.value)}
                                        placeholder="Tìm công việc hoặc sản phẩm..."
                                        className="w-full h-9 pl-8 pr-8 text-xs bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    {doneSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setDoneSearch('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* CỘT TRÁI: DANH SÁCH LỊCH SỬ CÁC CA / CÔNG VIỆC */}
                        <div className={`${doneSelectedShift ? 'hidden sm:block' : 'block'} bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs`}>
                            <div className="p-2.5 sm:p-3 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/60 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-stone-500">
                                        Danh sách công việc ({filteredPastShifts.length})
                                    </span>
                                    {doneListLoading && <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />}
                                </div>
                                <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 dark:bg-zinc-800 rounded-xl text-[10px] sm:text-[11px] font-bold">
                                    {([
                                        { id: 'all', label: `Tất cả (${pastShifts.length})` },
                                        { id: 'closed', label: `Đã chốt (${pastShifts.filter(s => s.status === 'closed').length})` },
                                        { id: 'open', label: `Đang mở (${pastShifts.filter(s => s.status === 'open').length})` },
                                    ] as const).map(tab => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setDoneStatusFilter(tab.id)}
                                            className={`h-7 rounded-lg transition ${
                                                doneStatusFilter === tab.id
                                                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {filteredPastShifts.length === 0 ? (
                                <div className="p-8 text-center text-xs text-stone-400 space-y-2">
                                    <p>Chưa có công việc nào trong bộ lọc này.</p>
                                    {doneRange !== 'all' && (
                                        <button
                                            type="button"
                                            onClick={() => { setDoneRange('all'); loadPastShifts('all') }}
                                            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                                        >
                                            Xem tất cả các ngày
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="divide-y divide-stone-100 dark:divide-zinc-800 max-h-[calc(100vh-245px)] overflow-y-auto">
                                    {filteredPastShifts.map((shift, idx) => {
                                        const isSelected = doneSelectedShift?.id === shift.id
                                        const isClosed = shift.status === 'closed'
                                        const jobTitle = shift.summary_data?.job_name || shift.notes || `Công việc ${idx + 1}`
                                        const prodCount = Object.keys(shift.summary_data?.products_summary || {}).length
                                        const recCount = shift.summary_data?.total_records ?? 0
                                        return (
                                            <button
                                                key={shift.id || idx}
                                                type="button"
                                                onClick={() => selectDoneShift(shift)}
                                                className={`w-full text-left px-3.5 sm:px-4 py-3 sm:py-3.5 transition border-l-4 ${
                                                    isSelected
                                                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-l-indigo-600'
                                                        : 'border-l-transparent hover:bg-stone-50 dark:hover:bg-zinc-800/40'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-white leading-snug break-words">
                                                        {jobTitle}
                                                    </span>
                                                    {isClosed ? (
                                                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                            Đã chốt
                                                        </span>
                                                    ) : (
                                                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                            Đang mở
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] sm:text-[11px] text-stone-500 mt-1 flex items-center gap-1.5 flex-wrap">
                                                    <Clock className="w-3 h-3 text-stone-400" />
                                                    <span>
                                                        {formatDateTime(shift.opened_at)} → {shift.closed_at ? formatDateTime(shift.closed_at) : 'Hiện tại'}
                                                    </span>
                                                    {shift.closed_at && getShiftLocalDateString(shift.opened_at) !== getShiftLocalDateString(shift.closed_at) && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                            🌙 Đóng ca vào ngày hôm sau
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px] text-stone-400">
                                                    <span>
                                                        {isClosed ? 'Người chốt: ' : 'Người mở: '}
                                                        <strong className="text-stone-600 dark:text-stone-300">
                                                            {shift.closed_by_name || shift.opened_by_name || 'Nhân viên'}
                                                        </strong>
                                                    </span>
                                                    {isClosed && <span>{prodCount} SP • {recCount} đợt</span>}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* CỘT PHẢI: CHI TIẾT BÁO CÁO CHỐT CA TẠM & ĐỐI SOÁT CẢ CA */}
                        <div className={`${doneSelectedShift ? 'block' : 'hidden sm:block'}`}>
                            {!doneSelectedShift ? (
                                <div className="bg-white dark:bg-zinc-900 border border-dashed border-stone-300 dark:border-zinc-800 rounded-2xl p-12 text-center text-sm text-stone-400">
                                    Chọn một công việc bên trái để xem chi tiết các lần chốt ca tạm và báo cáo đối soát cả ca
                                </div>
                            ) : (() => {
                                const jobTitle = doneSelectedShift.summary_data?.job_name || doneSelectedShift.notes || 'Công việc'
                                const isClosed = doneSelectedShift.status === 'closed'
                                const summaryRows = doneLines.length > 0
                                    ? summarizeLines(doneLines, doneSelectedShift)
                                    : Object.values(doneSelectedShift.summary_data?.products_summary || {}).map((p: any) => {
                                        const pinnedList: any[] = doneSelectedShift.summary_data?.pinned_products || []
                                        const matched = pinnedList.find((pinned: any) => pinned.name === p.product_name)
                                        return {
                                            product_id: matched?.id,
                                            sku: matched?.sku,
                                            product_name: p.product_name,
                                            unit: p.unit,
                                            in_qty: p.in_qty || 0,
                                            out_qty: p.out_qty || 0,
                                            count: (p.in_count || 0) + (p.out_count || 0)
                                        }
                                    })

                                // Tổng hợp theo Đơn vị tính & 2 hướng (Nhập kho / Xuất kho)
                                const unitsMap: Record<string, { unit: string; in_qty: number; out_qty: number; in_count: number; out_count: number }> = {}
                                let totalInCount = 0
                                let totalOutCount = 0
                                if (doneLines.length > 0) {
                                    doneLines.forEach(l => {
                                        const u = l.unit || 'ĐVT'
                                        if (!unitsMap[u]) unitsMap[u] = { unit: u, in_qty: 0, out_qty: 0, in_count: 0, out_count: 0 }
                                        const qty = Number(l.quantity_sent) || 0
                                        if (l.to_department === 'Kho') {
                                            unitsMap[u].in_qty += qty
                                            unitsMap[u].in_count += 1
                                            totalInCount += 1
                                        } else {
                                            unitsMap[u].out_qty += qty
                                            unitsMap[u].out_count += 1
                                            totalOutCount += 1
                                        }
                                    })
                                } else {
                                    summaryRows.forEach(r => {
                                        const u = r.unit || 'ĐVT'
                                        if (!unitsMap[u]) unitsMap[u] = { unit: u, in_qty: 0, out_qty: 0, in_count: 0, out_count: 0 }
                                        unitsMap[u].in_qty += Number(r.in_qty) || 0
                                        unitsMap[u].out_qty += Number(r.out_qty) || 0
                                        unitsMap[u].in_count += r.in_qty > 0 ? (r.count || 1) : 0
                                        unitsMap[u].out_count += r.out_qty > 0 ? (r.count || 1) : 0
                                    })
                                }
                                const unitsSummaryList = Object.values(unitsMap)
                                const totalBatchesCount = doneLines.length > 0
                                    ? doneLines.length
                                    : (doneSelectedShift.summary_data?.total_records ?? summaryRows.reduce((s, r) => s + (r.count || 0), 0))

                                const cleanShiftNotes = (doneSelectedShift.notes || '')
                                    .replace(/\[CV:\s*[^\]]+\]\s*/gi, '')
                                    .trim()

                                return (
                                    <div className="space-y-3 sm:space-y-4">
                                        {/* Nút quay lại danh sách trên Mobile */}
                                        <button
                                            type="button"
                                            onClick={() => setDoneSelectedId(null)}
                                            className="sm:hidden inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 py-0.5"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5" /> Danh sách công việc
                                        </button>

                                        {/* KHỐI CHÍNH BÁO CÁO ĐỐI SOÁT CA (GIỐNG /DELIVERY-SHIFTS) */}
                                        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-6 shadow-xs space-y-4 sm:space-y-6">
                                            {/* 1. Header: Tên công việc + Nút thao tác */}
                                            <div className="border-b border-stone-100 dark:border-zinc-800 pb-3 sm:pb-3.5">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h2 className="text-base sm:text-xl font-black text-stone-900 dark:text-white tracking-tight">
                                                                {jobTitle}
                                                            </h2>
                                                            {isClosed ? (
                                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0 whitespace-nowrap">
                                                                    ✓ Đã hoàn thành
                                                                </span>
                                                            ) : (
                                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                    Đang diễn ra
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleExportDoneShift(doneSelectedShift, doneLines)}
                                                            className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                                                        >
                                                            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Xuất Excel
                                                        </button>
                                                        {isClosed ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReopenShift(doneSelectedShift)}
                                                                title="Mở lại công việc này để tiếp tục nhập số liệu"
                                                                className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 whitespace-nowrap"
                                                            >
                                                                <RotateCcw className="w-3.5 h-3.5" /> Mở lại CV
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedShiftId(doneSelectedShift.id)
                                                                    setPageView('active')
                                                                }}
                                                                className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 whitespace-nowrap"
                                                            >
                                                                Tiếp tục nhập →
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteDoneShift(doneSelectedShift.id)}
                                                            title="Xóa báo cáo công việc (cần mật khẩu)"
                                                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 1. TỔNG HỢP ĐỐI SOÁT CẢ CA (SUM TỔNG) */}
                                            <div className="space-y-2.5 sm:space-y-3 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsMainSummaryExpanded(!isMainSummaryExpanded)}
                                                    className="w-full flex items-center justify-between py-1 text-left hover:opacity-80 transition group cursor-pointer"
                                                >
                                                    <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-[11px] sm:text-base">
                                                        <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 shrink-0" />
                                                        <span>Tổng hợp đối soát cả ca (Sum tổng)</span>
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-200 shrink-0">
                                                        <span className="text-[10px] sm:text-[11px] font-medium hidden sm:inline">
                                                            {isMainSummaryExpanded ? 'Thu lại' : 'Mở rộng'}
                                                        </span>
                                                        {isMainSummaryExpanded ? (
                                                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-stone-500" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-stone-500" />
                                                        )}
                                                    </div>
                                                </button>

                                                {isMainSummaryExpanded && (
                                                    <div className="space-y-2 sm:space-y-3 pt-1">
                                                        {/* 3.1. TỔNG HỢP SỐ LIỆU 2 HƯỚNG (NHẬP/XUẤT) */}
                                                        <div className="bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsTwoWayExpanded(!isTwoWayExpanded)}
                                                                className="w-full p-2.5 sm:p-3.5 flex items-center justify-between gap-2 text-left hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition"
                                                            >
                                                                <span className="text-[10px] sm:text-xs font-extrabold text-stone-700 dark:text-stone-300 uppercase tracking-wider truncate">
                                                                    📦 TỔNG HỢP 2 HƯỚNG (NHẬP/XUẤT)
                                                                </span>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <span className="text-[10px] sm:text-[11px] bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                                                        Tổng {totalBatchesCount} đợt
                                                                    </span>
                                                                    {isTwoWayExpanded ? (
                                                                        <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                                                                    ) : (
                                                                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                                                                    )}
                                                                </div>
                                                            </button>

                                                            {isTwoWayExpanded && (
                                                                <div className="p-2.5 sm:p-4 border-t border-stone-100 dark:border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 bg-stone-50/40 dark:bg-zinc-900/30">
                                                                    {/* Chiều 1: Nhập kho */}
                                                                    <div className="bg-emerald-50/40 dark:bg-emerald-950/15 border border-emerald-200/70 dark:border-emerald-900/40 rounded-xl p-2.5 sm:p-3.5 space-y-1.5 sm:space-y-2">
                                                                        <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-800/50 pb-1.5">
                                                                            <span className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                                                                                1. Nhập kho (SX → Kho)
                                                                            </span>
                                                                            <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                                                                {totalInCount} đợt
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                                            {unitsSummaryList.filter(u => u.in_qty > 0).length === 0 ? (
                                                                                <span className="text-[11px] sm:text-xs text-stone-400 italic">Không có phát sinh nhập</span>
                                                                            ) : (
                                                                                unitsSummaryList.filter(u => u.in_qty > 0).map(u => (
                                                                                    <span key={u.unit} className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                                                                        +{u.in_qty} {u.unit}
                                                                                    </span>
                                                                                ))
                                                                            )}
                                                                        </div>

                                                                        {unitsSummaryList.some(u => u.in_qty > 0) && (
                                                                            <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-between gap-2 flex-wrap">
                                                                                {doneSelectedShift.summary_data?.settlement_inbound_code ? (
                                                                                    <a
                                                                                        href={`/inbound?editCode=${doneSelectedShift.summary_data.settlement_inbound_code}`}
                                                                                        target="_blank"
                                                                                        rel="noreferrer"
                                                                                        className="text-[10px] sm:text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:underline flex items-center gap-1"
                                                                                    >
                                                                                        ✓ Đã lập: {doneSelectedShift.summary_data.settlement_inbound_code} <ExternalLink className="w-3 h-3" />
                                                                                    </a>
                                                                                ) : (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleOpenInboundModal(doneSelectedShift, summaryRows)}
                                                                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] sm:text-[11px] flex items-center gap-1 shadow-xs"
                                                                                    >
                                                                                        <ArrowDownLeft className="w-3 h-3" /> Làm phiếu nhập kết toán
                                                                                    </button>
                                                                                )}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleNavigateToSettlementPage(doneSelectedShift, summaryRows, 'in')}
                                                                                    className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                                                                                >
                                                                                    Mở trên /inbound <ExternalLink className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Chiều 2: Xuất kho */}
                                                                    <div className="bg-rose-50/40 dark:bg-rose-950/15 border border-rose-200/70 dark:border-rose-900/40 rounded-xl p-2.5 sm:p-3.5 space-y-1.5 sm:space-y-2">
                                                                        <div className="flex items-center justify-between border-b border-rose-200/60 dark:border-rose-800/50 pb-1.5">
                                                                            <span className="text-[11px] sm:text-xs font-bold text-rose-700 dark:text-rose-400 uppercase">
                                                                                2. Xuất kho (Kho → SX)
                                                                            </span>
                                                                            <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">
                                                                                {totalOutCount} đợt
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                                            {unitsSummaryList.filter(u => u.out_qty > 0).length === 0 ? (
                                                                                <span className="text-[11px] sm:text-xs text-stone-400 italic">Không có phát sinh xuất</span>
                                                                            ) : (
                                                                                unitsSummaryList.filter(u => u.out_qty > 0).map(u => (
                                                                                    <span key={u.unit} className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-800 text-[11px] sm:text-xs font-bold text-rose-700 dark:text-rose-300">
                                                                                        -{u.out_qty} {u.unit}
                                                                                    </span>
                                                                                ))
                                                                            )}
                                                                        </div>

                                                                        {unitsSummaryList.some(u => u.out_qty > 0) && (
                                                                            <div className="pt-2 border-t border-rose-200/60 dark:border-rose-800/50 flex items-center justify-between gap-2 flex-wrap">
                                                                                {doneSelectedShift.summary_data?.settlement_outbound_code ? (
                                                                                    <a
                                                                                        href={`/outbound?editCode=${doneSelectedShift.summary_data.settlement_outbound_code}`}
                                                                                        target="_blank"
                                                                                        rel="noreferrer"
                                                                                        className="text-[10px] sm:text-[11px] font-bold text-rose-800 dark:text-rose-300 hover:underline flex items-center gap-1"
                                                                                    >
                                                                                        ✓ Đã lập: {doneSelectedShift.summary_data.settlement_outbound_code} <ExternalLink className="w-3 h-3" />
                                                                                    </a>
                                                                                ) : (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleOpenOutboundModal(doneSelectedShift, summaryRows)}
                                                                                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] sm:text-[11px] flex items-center gap-1 shadow-xs"
                                                                                    >
                                                                                        <ArrowUpRight className="w-3 h-3" /> Làm phiếu xuất kết toán
                                                                                    </button>
                                                                                )}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleNavigateToSettlementPage(doneSelectedShift, summaryRows, 'out')}
                                                                                    className="text-[10px] sm:text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1"
                                                                                >
                                                                                    Mở trên /outbound <ExternalLink className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* 3.2. CHI TIẾT THEO ĐƠN VỊ HÀNG HÓA */}
                                                        <div className="bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsUnitsExpanded(!isUnitsExpanded)}
                                                                className="w-full p-2.5 sm:p-3.5 flex items-center justify-between gap-2 text-left hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition"
                                                            >
                                                                <span className="text-[10px] sm:text-xs font-extrabold text-stone-700 dark:text-stone-300 uppercase tracking-wider truncate">
                                                                    📊 CHI TIẾT THEO ĐƠN VỊ HÀNG HÓA
                                                                </span>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <span className="text-[10px] sm:text-[11px] bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                                                        {unitsSummaryList.length} Đơn vị
                                                                    </span>
                                                                    {isUnitsExpanded ? (
                                                                        <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                                                                    ) : (
                                                                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                                                                    )}
                                                                </div>
                                                            </button>

                                                            {isUnitsExpanded && (
                                                                <div className="p-2.5 sm:p-4 border-t border-stone-100 dark:border-zinc-800/80 bg-stone-50/40 dark:bg-zinc-900/30 overflow-x-auto">
                                                                    <table className="w-full text-left text-[11px] sm:text-sm">
                                                                        <thead>
                                                                            <tr className="border-b border-stone-200 dark:border-zinc-800 text-stone-400 uppercase text-[10px] sm:text-[11px]">
                                                                                <th className="pb-1.5 sm:pb-2">ĐVT</th>
                                                                                <th className="pb-1.5 sm:pb-2 text-right text-emerald-600">Nhập (+)</th>
                                                                                <th className="pb-1.5 sm:pb-2 text-right text-rose-600">Xuất (-)</th>
                                                                                <th className="pb-1.5 sm:pb-2 text-right">Số đợt</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                                            {unitsSummaryList.map(u => (
                                                                                <tr key={u.unit}>
                                                                                    <td className="py-2 font-bold text-stone-800 dark:text-stone-100">{u.unit}</td>
                                                                                    <td className="py-2 text-right font-black text-emerald-600">+{u.in_qty}</td>
                                                                                    <td className="py-2 text-right font-black text-rose-600">-{u.out_qty}</td>
                                                                                    <td className="py-2 text-right text-stone-500">{u.in_count + u.out_count} đợt</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* 3.3. ĐỐI SOÁT CHI TIẾT THEO SẢN PHẨM & TỪNG ĐỢT NHẬP/XUẤT */}
                                                        <div className="bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsProductsExpanded(!isProductsExpanded)}
                                                                className="w-full p-2.5 sm:p-3.5 flex items-center justify-between gap-2 text-left hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition"
                                                            >
                                                                <span className="text-[10px] sm:text-xs font-extrabold text-stone-700 dark:text-stone-300 uppercase tracking-wider truncate">
                                                                    📋 TỔNG HỢP THEO SẢN PHẨM (TOÀN CV)
                                                                </span>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <span className="text-[10px] sm:text-[11px] bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                                                        {summaryRows.length} SP
                                                                    </span>
                                                                    {isProductsExpanded ? (
                                                                        <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                                                                    ) : (
                                                                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                                                                    )}
                                                                </div>
                                                            </button>

                                                            {isProductsExpanded && (
                                                                <div className="border-t border-stone-100 dark:border-zinc-800/80">
                                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 dark:border-zinc-800 px-2.5 sm:px-4 py-2 bg-stone-50/50 dark:bg-zinc-900/50">
                                                                        <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-4 w-full sm:w-auto">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setDoneTab('summary')}
                                                                                className={`text-[11px] sm:text-sm font-bold flex items-center justify-center sm:justify-start gap-1.5 py-1.5 sm:py-0 sm:pb-1 rounded-lg sm:rounded-none sm:border-b-2 transition ${
                                                                                    doneTab === 'summary'
                                                                                        ? 'bg-indigo-50/80 dark:bg-indigo-950/50 sm:bg-transparent sm:border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                                                                        : 'border-transparent text-stone-500 hover:text-stone-800'
                                                                                }`}
                                                                            >
                                                                                <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                                                                <span>Tổng hợp SP ({summaryRows.length})</span>
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setDoneTab('lines')}
                                                                                className={`text-[11px] sm:text-sm font-bold flex items-center justify-center sm:justify-start gap-1.5 py-1.5 sm:py-0 sm:pb-1 rounded-lg sm:rounded-none sm:border-b-2 transition ${
                                                                                    doneTab === 'lines'
                                                                                        ? 'bg-indigo-50/80 dark:bg-indigo-950/50 sm:bg-transparent sm:border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                                                                        : 'border-transparent text-stone-500 hover:text-stone-800'
                                                                                }`}
                                                                            >
                                                                                <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                                                                <span>Từng đợt ({doneLines.length})</span>
                                                                            </button>
                                                                        </div>

                                                                        <div className="flex items-center justify-between sm:justify-end gap-2">
                                                                            {doneTab === 'lines' && (() => {
                                                                                const inCount = doneLines.filter(l => l.to_department === 'Kho').length
                                                                                const outCount = doneLines.filter(l => l.to_department !== 'Kho').length
                                                                                return (
                                                                                    <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 bg-stone-200/70 dark:bg-zinc-800 p-0.5 rounded-lg w-full sm:w-auto">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => setJournalTypeFilter('all')}
                                                                                            className={`px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold transition flex items-center justify-center gap-1 ${
                                                                                                journalTypeFilter === 'all'
                                                                                                    ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-white shadow-xs'
                                                                                                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                                                                            }`}
                                                                                        >
                                                                                            <span>Tất cả ({doneLines.length})</span>
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => setJournalTypeFilter('in')}
                                                                                            className={`px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold transition flex items-center justify-center gap-1 ${
                                                                                                journalTypeFilter === 'in'
                                                                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                                                                    : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40'
                                                                                            }`}
                                                                                        >
                                                                                            <ArrowDownLeft className="w-3 h-3 shrink-0" />
                                                                                            <span>Nhập ({inCount})</span>
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => setJournalTypeFilter('out')}
                                                                                            className={`px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold transition flex items-center justify-center gap-1 ${
                                                                                                journalTypeFilter === 'out'
                                                                                                    ? 'bg-rose-600 text-white shadow-xs'
                                                                                                    : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50/60 dark:hover:bg-rose-950/40'
                                                                                            }`}
                                                                                        >
                                                                                            <ArrowUpRight className="w-3 h-3 shrink-0" />
                                                                                            <span>Xuất ({outCount})</span>
                                                                                        </button>
                                                                                    </div>
                                                                                )
                                                                            })()}
                                                                            {doneLinesLoading && <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />}
                                                                        </div>
                                                                    </div>

                                                                    {doneTab === 'summary' ? (
                                                                        <div className="p-2.5 sm:p-4 bg-stone-50/40 dark:bg-zinc-900/30">
                                                                            {summaryRows.length === 0 ? (
                                                                                <div className="py-6 text-center text-[11px] sm:text-xs text-stone-400">
                                                                                    Không có dữ liệu số liệu trong công việc này.
                                                                                </div>
                                                                            ) : (
                                                                                <>
                                                                                    {/* Mobile: Danh sách thẻ gọn */}
                                                                                    <div className="sm:hidden divide-y divide-stone-200/70 dark:divide-zinc-800">
                                                                                        {summaryRows.map((row, idx) => (
                                                                                            <div key={idx} className="py-2 first:pt-0 last:pb-0 space-y-1">
                                                                                                <div className="text-[11px] font-bold text-stone-900 dark:text-white leading-snug">
                                                                                                    {row.product_name}
                                                                                                </div>
                                                                                                <div className="flex items-center justify-between text-[10px]">
                                                                                                    <span className="text-stone-500">
                                                                                                        ĐVT: <strong className="text-stone-700 dark:text-stone-300">{row.unit}</strong> • {row.count ? `${row.count} đợt` : '-'}
                                                                                                    </span>
                                                                                                    <div className="flex items-center gap-1.5">
                                                                                                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black">
                                                                                                            +{row.in_qty}
                                                                                                        </span>
                                                                                                        <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-black">
                                                                                                            -{row.out_qty}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>

                                                                                    {/* Desktop: Bảng 5 cột */}
                                                                                    <table className="hidden sm:table w-full text-left text-xs sm:text-sm">
                                                                                        <thead>
                                                                                            <tr className="border-b border-stone-200 dark:border-zinc-800 text-stone-400 font-semibold uppercase text-xs">
                                                                                                <th className="pb-2.5">Sản phẩm</th>
                                                                                                <th className="pb-2.5">ĐVT</th>
                                                                                                <th className="pb-2.5 text-right text-emerald-600">Tổng Nhập (+)</th>
                                                                                                <th className="pb-2.5 text-right text-rose-600">Tổng Xuất (-)</th>
                                                                                                <th className="pb-2.5 text-right">Số đợt</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                                                            {summaryRows.map((row, idx) => (
                                                                                                <tr key={idx} className="hover:bg-stone-50 dark:hover:bg-zinc-800/40">
                                                                                                    <td className="py-3 font-bold text-stone-900 dark:text-white pr-3">
                                                                                                        {row.product_name}
                                                                                                    </td>
                                                                                                    <td className="py-3 text-stone-500 whitespace-nowrap">{row.unit}</td>
                                                                                                    <td className="py-3 text-right font-black text-base text-emerald-600 tabular-nums">
                                                                                                        +{row.in_qty}
                                                                                                    </td>
                                                                                                    <td className="py-3 text-right font-black text-base text-rose-600 tabular-nums">
                                                                                                        -{row.out_qty}
                                                                                                    </td>
                                                                                                    <td className="py-3 text-right text-xs text-stone-400 whitespace-nowrap">
                                                                                                        {row.count ? `${row.count} đợt` : '-'}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            ))}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    ) : (() => {
                                                                        const filteredDoneLines = journalTypeFilter === 'in'
                                                                            ? doneLines.filter(l => l.to_department === 'Kho')
                                                                            : journalTypeFilter === 'out'
                                                                                ? doneLines.filter(l => l.to_department !== 'Kho')
                                                                                : doneLines
                                                                        return (
                                                                            <div className="divide-y divide-stone-100 dark:divide-zinc-800 max-h-[520px] overflow-y-auto">
                                                                                {filteredDoneLines.length === 0 ? (
                                                                                    <div className="p-6 text-center text-[11px] sm:text-xs text-stone-400">
                                                                                        Không có dòng nhật ký nào phù hợp bộ lọc.
                                                                                    </div>
                                                                                ) : (
                                                                                    filteredDoneLines.map(record => {
                                                                                    const isImport = record.to_department === 'Kho'
                                                                                    const userNote = cleanUserNotes(record.notes)
                                                                                    return (
                                                                                        <div
                                                                                            key={record.id}
                                                                                            className="px-2.5 sm:px-4 py-2.5 sm:py-3 flex items-start gap-2 sm:gap-2.5 hover:bg-stone-50 dark:hover:bg-zinc-800/40 text-[11px] sm:text-xs"
                                                                                        >
                                                                                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-bold shrink-0 mt-0.5 ${
                                                                                                isImport
                                                                                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                                                                                    : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                                                                                            }`}>
                                                                                                {isImport ? <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                                                                                            </div>

                                                                                            <div className="min-w-0 flex-1 space-y-1">
                                                                                                {/* Hàng 1: Tên sản phẩm + Nút thao tác Sửa/Xóa (không bao giờ đè lên badge số lượng) */}
                                                                                                <div className="flex items-start justify-between gap-2">
                                                                                                    <span className="font-bold text-stone-900 dark:text-white break-words leading-snug min-w-0 flex-1">
                                                                                                        {record.item_name}
                                                                                                    </span>
                                                                                                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                                                                                        <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-md font-black text-[11px] whitespace-nowrap ${
                                                                                                            isImport
                                                                                                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                                                                                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                                                                                                        }`}>
                                                                                                            {isImport ? `+${record.quantity_sent}` : `-${record.quantity_sent}`} {record.unit}
                                                                                                        </span>
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => handleStartEdit(record)}
                                                                                                            title="Chỉnh sửa dòng này"
                                                                                                            className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-stone-100 hover:bg-indigo-50 dark:bg-zinc-800 text-stone-500 hover:text-indigo-600 flex items-center justify-center shrink-0"
                                                                                                        >
                                                                                                            <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                                                                        </button>
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => handleDeleteJournal(record.id)}
                                                                                                            title="Xóa dòng này"
                                                                                                            className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-stone-100 hover:bg-rose-50 dark:bg-zinc-800 text-stone-500 hover:text-rose-600 flex items-center justify-center shrink-0"
                                                                                                        >
                                                                                                            <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                                                                        </button>
                                                                                                    </div>
                                                                                                </div>

                                                                                                {/* Hàng 2 (Mobile): Badge số lượng */}
                                                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                                                    <span className={`sm:hidden px-1.5 py-0.5 rounded font-black text-[10px] whitespace-nowrap ${
                                                                                                        isImport
                                                                                                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                                                                                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                                                                                                    }`}>
                                                                                                        {isImport ? `+${record.quantity_sent}` : `-${record.quantity_sent}`} {record.unit}
                                                                                                    </span>
                                                                                                    <span className="hidden sm:inline text-[11px] text-stone-400">
                                                                                                        {formatDateTime(record.sent_at)} • {record.sent_by_name || 'Nhân viên'}
                                                                                                        {userNote ? ` • 💬 ${userNote}` : ''}
                                                                                                    </span>
                                                                                                </div>

                                                                                                {/* Hàng 3 (Mobile): Thời gian • Người nhập trên 1 dòng thoáng */}
                                                                                                <div className="sm:hidden text-[10px] text-stone-400 flex items-center gap-1.5 flex-wrap">
                                                                                                    <span>{formatDateTime(record.sent_at)}</span>
                                                                                                    <span>•</span>
                                                                                                    <span>{record.sent_by_name || 'Nhân viên'}</span>
                                                                                                    {userNote && <span>• 💬 {userNote}</span>}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    )
                                                                                })
                                                                            )}
                                                                        </div>
                                                                        )
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 2. CHI TIẾT CÁC LẦN CHỐT CA TẠM (ĐỔI CA) — TIMELINE ACCORDION */}
                                            <div className="pt-2 border-t border-stone-100 dark:border-zinc-800">
                                            {(() => {
                                                const effectiveSubShifts = buildEffectiveSubShifts(doneSubShifts, doneLines, doneSelectedShift)
                                                return (
                                                    <div className="space-y-2 sm:space-y-3">
                                                        <div
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => setIsDoneSubShiftsSectionExpanded(!isDoneSubShiftsSectionExpanded)}
                                                            className="flex items-center justify-between gap-2 cursor-pointer select-none group p-1 -m-1 rounded-lg hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                                                                <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-[11px] sm:text-sm min-w-0">
                                                                    <span className="truncate">Chi tiết các lần chốt ca tạm (đổi ca)</span>
                                                                </h4>
                                                                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold shrink-0 whitespace-nowrap">
                                                                    {effectiveSubShifts.length} lần chốt
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-200 shrink-0">
                                                                <span className="text-[10px] sm:text-[11px] font-medium hidden sm:inline">
                                                                    {isDoneSubShiftsSectionExpanded ? 'Thu lại' : 'Mở rộng'}
                                                                </span>
                                                                {isDoneSubShiftsSectionExpanded ? (
                                                                    <ChevronDown className="w-4 h-4 text-stone-500" />
                                                                ) : (
                                                                    <ChevronRight className="w-4 h-4 text-stone-500" />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {isDoneSubShiftsSectionExpanded && (
                                                            effectiveSubShifts.length === 0 ? (
                                                            <div className="bg-amber-50/40 dark:bg-amber-950/10 border border-dashed border-amber-200 dark:border-amber-900/40 rounded-xl px-3.5 py-2.5 text-[11px] sm:text-xs text-stone-500">
                                                                Công việc này chưa có lần bấm <strong>Chốt tạm</strong> (đổi ca) nào trước khi hoàn thành.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2 sm:space-y-3 relative sm:border-l-2 sm:border-amber-200 dark:sm:border-amber-800/60 sm:ml-2.5 sm:pl-5">
                                                                {effectiveSubShifts.map((ss: any) => {
                                                                    const isExpanded = expandedDoneSubShifts.has(ss.id)
                                                                    const subLines: DeliveryJournalRecord[] = ss._subLines || []
                                                                    const subProds = subLines.length > 0
                                                                        ? summarizeLines(subLines)
                                                                        : Object.values(ss.summary_data?.products_summary || {}).map((p: any) => ({
                                                                            product_name: p.product_name,
                                                                            unit: p.unit,
                                                                            in_qty: p.in_qty || 0,
                                                                            out_qty: p.out_qty || 0,
                                                                            count: (p.in_count || 0) + (p.out_count || 0)
                                                                        }))
                                                                    const totalIn = subProds.reduce((s, p) => s + (Number(p.in_qty) || 0), 0)
                                                                    const totalOut = subProds.reduce((s, p) => s + (Number(p.out_qty) || 0), 0)
                                                                    const totalCount = subLines.length > 0
                                                                        ? subLines.length
                                                                        : (ss.summary_data?.total_records ?? subProds.reduce((s, p) => s + (p.count || 0), 0))

                                                                    return (
                                                                        <div key={ss.id} className="relative bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
                                                                            <div className="hidden sm:block absolute -left-[27px] top-4 w-3 h-3 rounded-full bg-amber-500 ring-4 ring-white dark:ring-zinc-900" />

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => toggleExpandDoneSubShift(ss.id)}
                                                                                className="w-full p-2.5 sm:p-3.5 text-left hover:bg-stone-50 dark:hover:bg-zinc-900/60 transition space-y-1"
                                                                            >
                                                                                <div className="flex items-center justify-between gap-2">
                                                                                    <div className="text-[11px] sm:text-sm font-bold text-amber-700 dark:text-amber-500 flex items-center gap-1.5 flex-wrap min-w-0">
                                                                                        <span>Lần chốt ca tạm #{ss.sub_shift_number}</span>
                                                                                        {ss.is_auto_final && (
                                                                                            <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 whitespace-nowrap">
                                                                                                {isClosed ? 'Đợt cuối ca' : 'Đợt đang nhập'}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>

                                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                                        <div className="text-[10px] sm:text-xs bg-stone-100 dark:bg-zinc-800 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-medium text-stone-600 dark:text-stone-300 whitespace-nowrap">
                                                                                            <span className="hidden sm:inline">Nhập </span>
                                                                                            <strong className="text-emerald-600">+{totalIn}</strong>
                                                                                            <span className="mx-1 text-stone-300 dark:text-zinc-700">|</span>
                                                                                            <span className="hidden sm:inline">Xuất </span>
                                                                                            <strong className="text-rose-600">-{totalOut}</strong>
                                                                                            <span className="mx-1 text-stone-300 dark:text-zinc-700">|</span>
                                                                                            <strong>{totalCount}</strong> đợt
                                                                                        </div>
                                                                                        {isExpanded ? (
                                                                                            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400 shrink-0" />
                                                                                        ) : (
                                                                                            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400 shrink-0" />
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                <div className="text-[10px] sm:text-[11px] text-stone-400 flex items-center gap-1">
                                                                                    <Clock className="w-3 h-3 shrink-0" />
                                                                                    <span className="truncate">{formatCompactRange(ss.from_time, ss.to_time)}</span>
                                                                                </div>
                                                                            </button>

                                                                            {isExpanded && (
                                                                                <div className="px-2.5 sm:px-4 pb-3 pt-2 border-t border-stone-100 dark:border-zinc-800/80 space-y-2 bg-stone-50/40 dark:bg-zinc-900/30">
                                                                                    {subProds.length > 0 ? (
                                                                                        <div className="bg-white dark:bg-zinc-900 rounded-xl p-2.5 sm:p-3 border border-stone-200 dark:border-zinc-800">
                                                                                            <div className="text-[9px] sm:text-[11px] font-bold text-stone-400 uppercase mb-1.5">
                                                                                                Hàng hóa giao nhận trong đợt #{ss.sub_shift_number}
                                                                                            </div>

                                                                                            {/* Mobile: Danh sách thẻ gọn */}
                                                                                            <div className="sm:hidden divide-y divide-stone-100 dark:divide-zinc-800/60">
                                                                                                {subProds.map((p, pIdx) => (
                                                                                                    <div key={pIdx} className="py-1.5 first:pt-0 last:pb-0 space-y-0.5">
                                                                                                        <div className="text-[11px] font-bold text-stone-800 dark:text-stone-200 leading-snug">
                                                                                                            {p.product_name}
                                                                                                        </div>
                                                                                                        <div className="flex items-center justify-between text-[10px]">
                                                                                                            <span className="text-stone-500">
                                                                                                                ĐVT: <strong className="text-stone-700 dark:text-stone-300">{p.unit}</strong> • {p.count || 0} đợt
                                                                                                            </span>
                                                                                                            <div className="flex items-center gap-2 font-black">
                                                                                                                <span className="text-emerald-600">+{p.in_qty}</span>
                                                                                                                <span className="text-stone-300 dark:text-zinc-700">|</span>
                                                                                                                <span className="text-rose-600">-{p.out_qty}</span>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>

                                                                                            {/* Desktop: Bảng 5 cột */}
                                                                                            <table className="hidden sm:table w-full text-left text-xs">
                                                                                                <thead>
                                                                                                    <tr className="border-b border-stone-100 dark:border-zinc-800 text-stone-400">
                                                                                                        <th className="pb-1.5 font-semibold">Sản phẩm</th>
                                                                                                        <th className="pb-1.5 font-semibold">ĐVT</th>
                                                                                                        <th className="pb-1.5 font-semibold text-right text-emerald-600">Nhập (+)</th>
                                                                                                        <th className="pb-1.5 font-semibold text-right text-rose-600">Xuất (-)</th>
                                                                                                        <th className="pb-1.5 font-semibold text-right">Số đợt</th>
                                                                                                    </tr>
                                                                                                </thead>
                                                                                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/60">
                                                                                                    {subProds.map((p, pIdx) => (
                                                                                                        <tr key={pIdx}>
                                                                                                            <td className="py-2 font-bold text-stone-800 dark:text-stone-200 pr-2">{p.product_name}</td>
                                                                                                            <td className="py-2 text-stone-500 whitespace-nowrap">{p.unit}</td>
                                                                                                            <td className="py-2 text-right font-bold text-emerald-600">+{p.in_qty}</td>
                                                                                                            <td className="py-2 text-right font-bold text-rose-600">-{p.out_qty}</td>
                                                                                                            <td className="py-2 text-right text-stone-400">{p.count || 0} đợt</td>
                                                                                                        </tr>
                                                                                                    ))}
                                                                                                </tbody>
                                                                                            </table>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="text-xs text-stone-400 italic py-1">
                                                                                            Không có phát sinh hàng hóa trong đợt chốt tạm này.
                                                                                        </div>
                                                                                    )}

                                                                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-stone-500 bg-stone-100/70 dark:bg-zinc-900 px-3 py-2 rounded-lg">
                                                                                        <span>👤 Người bàn giao: <strong className="text-stone-700 dark:text-stone-200">{ss.closed_by_name || 'Nhân viên'}</strong></span>
                                                                                        {ss.notes && <span className="italic">💬 "{ss.notes}"</span>}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                                )
                                            })()}
                                            </div>

                                            {/* 3. THÔNG TIN CÔNG VIỆC (MỞ/CHỐT) */}
                                            <div className="space-y-2.5 sm:space-y-3 pt-2 border-t border-stone-100 dark:border-zinc-800">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                                                    className="w-full flex items-center justify-between py-1 text-left hover:opacity-80 transition group cursor-pointer"
                                                >
                                                    <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-[11px] sm:text-base">
                                                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 shrink-0" />
                                                        <span>Thông tin</span>
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-200 shrink-0">
                                                        <span className="text-[10px] sm:text-[11px] font-medium hidden sm:inline">
                                                            {isInfoExpanded ? 'Thu lại' : 'Mở rộng'}
                                                        </span>
                                                        {isInfoExpanded ? (
                                                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-stone-500" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-stone-500" />
                                                        )}
                                                    </div>
                                                </button>

                                                {isInfoExpanded && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-[11px] sm:text-xs pt-1">
                                                        <div className="bg-white dark:bg-zinc-950 p-2.5 sm:p-3 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-xs">
                                                            <div className="font-bold text-stone-400 uppercase mb-1 flex items-center justify-between">
                                                                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                                                    <span>Giờ mở công việc</span>
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleUpdateShiftOpenedAt(doneSelectedShift)
                                                                    }}
                                                                    title="Chỉnh sửa ngày & giờ mở công việc"
                                                                    className="text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5 flex items-center gap-1 font-normal lowercase text-[10px]"
                                                                >
                                                                    <Pencil className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                                                    <span>sửa ngày</span>
                                                                </button>
                                                            </div>
                                                            <div className="text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-100">
                                                                {formatDateTime(doneSelectedShift.opened_at)}
                                                            </div>
                                                            <div className="text-stone-500 mt-1 flex items-center gap-1.5">
                                                                <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-stone-400" />
                                                                <span>Người mở: <strong>{doneSelectedShift.opened_by_name || 'Nhân viên'}</strong></span>
                                                            </div>
                                                        </div>

                                                        <div className="bg-white dark:bg-zinc-950 p-2.5 sm:p-3 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-xs">
                                                            <div className="font-bold text-stone-400 uppercase mb-1 flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                                                                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                                                                <span>Giờ chốt công việc</span>
                                                            </div>
                                                            <div className="text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-100">
                                                                {doneSelectedShift.closed_at ? (
                                                                    formatDateTime(doneSelectedShift.closed_at)
                                                                ) : (
                                                                    <span className="text-amber-600 italic">Đang diễn ra...</span>
                                                                )}
                                                            </div>
                                                            {doneSelectedShift.closed_by_name && (
                                                                <div className="text-stone-500 mt-1 flex items-center gap-1.5">
                                                                    <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-stone-400" />
                                                                    <span>Người chốt: <strong>{doneSelectedShift.closed_by_name}</strong></span>
                                                                </div>
                                                            )}
                                                            {doneSelectedShift.summary_data?.order_type_name && (
                                                                <div className="text-stone-500 mt-1 flex items-center gap-1.5">
                                                                    <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500" />
                                                                    <span>Loại phiếu: <strong className="text-indigo-600 dark:text-indigo-400">{doneSelectedShift.summary_data.order_type_code ? `${doneSelectedShift.summary_data.order_type_code} - ` : ''}{doneSelectedShift.summary_data.order_type_name}</strong></span>
                                                                </div>
                                                            )}

                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 4. GHI CHÚ BÀN GIAO CUỐI CA */}
                                            <div className="space-y-1.5 sm:space-y-2 pt-2 border-t border-stone-100 dark:border-zinc-800">
                                                <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-xs sm:text-sm">
                                                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                                                    Ghi chú bàn giao cuối ca
                                                </h4>
                                                <div className="bg-blue-50/40 dark:bg-blue-950/15 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 sm:p-3.5 text-[11px] sm:text-xs text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
                                                    {cleanShiftNotes || <span className="italic text-stone-400">Không có ghi chú</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    </div>
                )}

                {/* 2. CHẾ ĐỘ: BÁO CÁO THEO NGÀY / KHOẢNG NGÀY / TÙY CHỌN NHIỀU NGÀY */}
                {doneViewMode === 'by-date' && (
                    <div className="space-y-4">
                        {/* Thanh điều khiển chọn thời gian */}
                        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-3.5 shadow-xs space-y-3">
                            {/* Phân nhánh: Khoảng ngày Từ - Đến HOẶC Tùy chọn nhiều ngày */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-stone-100 dark:border-zinc-800">
                                <div className="inline-flex p-0.5 bg-stone-100 dark:bg-zinc-800 rounded-lg gap-1 self-start">
                                    <button
                                        type="button"
                                        onClick={() => setByDateFilterType('range')}
                                        className={`h-7 px-3 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
                                            byDateFilterType === 'range'
                                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                                : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                        }`}
                                    >
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>Mốc thời gian (Từ ngày ➔ Đến ngày)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setByDateFilterType('multi')}
                                        className={`h-7 px-3 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
                                            byDateFilterType === 'multi'
                                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                                : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                        }`}
                                    >
                                        <CheckSquare className="w-3.5 h-3.5" />
                                        <span>Tùy chọn nhiều ngày {byDateMultiDates.size > 0 && `(${byDateMultiDates.size})`}</span>
                                    </button>
                                </div>

                                <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                                    <span>Đang xem:</span>
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/40">
                                        {byDateReportInfo.title.replace('Báo Cáo Tổng Hợp: ', '').replace('Báo Cáo Tổng Hợp Ngày: ', '')}
                                    </span>
                                </div>
                            </div>

                            {/* Khối điều khiển chi tiết theo chế độ */}
                            {byDateFilterType === 'range' ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Từ:</span>
                                        <input
                                            type="date"
                                            value={byDateRange.from}
                                            onChange={e => setByDateRange(prev => ({ ...prev, from: e.target.value }))}
                                            className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Đến:</span>
                                        <input
                                            type="date"
                                            value={byDateRange.to}
                                            onChange={e => setByDateRange(prev => ({ ...prev, to: e.target.value }))}
                                            className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>

                                    {/* Các nút chọn nhanh */}
                                    <div className="flex items-center gap-1 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const todayStr = getShiftLocalDateString(new Date().toISOString())
                                                setByDateRange({ from: todayStr, to: todayStr })
                                            }}
                                            className={`h-8 px-2.5 rounded-lg border text-xs font-semibold transition ${
                                                byDateRange.from === byDateRange.to && byDateRange.from === getShiftLocalDateString(new Date().toISOString())
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-600 dark:text-stone-300'
                                            }`}
                                        >
                                            Hôm nay
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const yest = new Date()
                                                yest.setDate(yest.getDate() - 1)
                                                const yestStr = getShiftLocalDateString(yest.toISOString())
                                                setByDateRange({ from: yestStr, to: yestStr })
                                            }}
                                            className={`h-8 px-2.5 rounded-lg border text-xs font-semibold transition ${
                                                byDateRange.from === byDateRange.to && byDateRange.from !== getShiftLocalDateString(new Date().toISOString()) && availableDates.includes(byDateRange.from)
                                                    ? 'bg-stone-200 dark:bg-zinc-700 text-stone-800 dark:text-stone-200 border-stone-300'
                                                    : 'border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-600 dark:text-stone-300'
                                            }`}
                                        >
                                            Hôm qua
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const today = new Date()
                                                const past7 = new Date()
                                                past7.setDate(today.getDate() - 6)
                                                setByDateRange({
                                                    from: getShiftLocalDateString(past7.toISOString()),
                                                    to: getShiftLocalDateString(today.toISOString())
                                                })
                                            }}
                                            className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-xs font-semibold text-stone-600 dark:text-stone-300 transition"
                                        >
                                            7 ngày qua
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const today = new Date()
                                                const past30 = new Date()
                                                past30.setDate(today.getDate() - 29)
                                                setByDateRange({
                                                    from: getShiftLocalDateString(past30.toISOString()),
                                                    to: getShiftLocalDateString(today.toISOString())
                                                })
                                            }}
                                            className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-xs font-semibold text-stone-600 dark:text-stone-300 transition"
                                        >
                                            30 ngày qua
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const today = new Date()
                                                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
                                                setByDateRange({
                                                    from: getShiftLocalDateString(firstDay.toISOString()),
                                                    to: getShiftLocalDateString(today.toISOString())
                                                })
                                            }}
                                            className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-xs font-semibold text-stone-600 dark:text-stone-300 transition"
                                        >
                                            Tháng này
                                        </button>
                                    </div>

                                    {/* Các ngày gần đây có công việc (Click nhanh để xem đơn ngày) */}
                                    {availableDates.length > 0 && (
                                        <div className="flex items-center gap-1 ml-auto overflow-x-auto py-0.5">
                                            <span className="text-[11px] text-stone-400 mr-1">Xem nhanh ngày:</span>
                                            {availableDates.slice(0, 6).map(dateStr => (
                                                <button
                                                    key={dateStr}
                                                    type="button"
                                                    onClick={() => setByDateRange({ from: dateStr, to: dateStr })}
                                                    className={`h-7 px-2 rounded-md text-[11px] font-semibold transition ${
                                                        byDateRange.from === dateStr && byDateRange.to === dateStr
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-zinc-700'
                                                    }`}
                                                >
                                                    {dateStr.split('-').reverse().slice(0, 2).join('/')}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Chế độ TÙY CHỌN NHIỀU NGÀY */
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                                                Bấm vào ngày để chọn/bỏ chọn (hỗ trợ chọn ngày ngắt quãng):
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setByDateMultiDates(new Set(availableDates))}
                                                className="h-7 px-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold hover:bg-indigo-100 transition"
                                            >
                                                Chọn tất cả ngày có dữ liệu ({availableDates.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setByDateMultiDates(new Set())}
                                                className="h-7 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800 text-[11px] font-semibold transition"
                                            >
                                                Bỏ chọn tất cả
                                            </button>
                                        </div>
                                    </div>

                                    {/* Danh sách ngày có dữ liệu để tick chọn */}
                                    <div className="flex items-center gap-1.5 flex-wrap p-2 bg-stone-50 dark:bg-zinc-800/60 rounded-xl border border-stone-200/80 dark:border-zinc-800">
                                        {availableDates.length === 0 ? (
                                            <span className="text-xs text-stone-400 italic">Chưa có ngày nào có dữ liệu công việc.</span>
                                        ) : (
                                            availableDates.map(dateStr => {
                                                const isSelected = byDateMultiDates.has(dateStr)
                                                // Đếm số ca của ngày này
                                                const count = pastShifts.filter(s => {
                                                    const op = getShiftLocalDateString(s.opened_at)
                                                    const cl = getShiftLocalDateString(s.closed_at)
                                                    return op === dateStr || cl === dateStr
                                                }).length

                                                return (
                                                    <button
                                                        key={dateStr}
                                                        type="button"
                                                        onClick={() => {
                                                            setByDateMultiDates(prev => {
                                                                const next = new Set(prev)
                                                                if (next.has(dateStr)) next.delete(dateStr)
                                                                else next.add(dateStr)
                                                                return next
                                                            })
                                                        }}
                                                        className={`h-7 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                                                            isSelected
                                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                                : 'bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800'
                                                        }`}
                                                    >
                                                        {isSelected && <Check className="w-3.5 h-3.5" />}
                                                        <span>{dateStr.split('-').reverse().slice(0, 2).join('/')}</span>
                                                        <span className={`text-[10px] px-1 py-0.2 rounded-full ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-stone-100 dark:bg-zinc-800 text-stone-500'}`}>
                                                            {count} việc
                                                        </span>
                                                    </button>
                                                )
                                            })
                                        )}

                                        {/* Ô chọn thêm ngày tự do nếu cần */}
                                        <div className="flex items-center gap-1 ml-auto">
                                            <input
                                                type="date"
                                                value={byDateCustomAddInput}
                                                onChange={e => setByDateCustomAddInput(e.target.value)}
                                                className="h-7 px-2 rounded-md border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold focus:outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!byDateCustomAddInput) return
                                                    setByDateMultiDates(prev => new Set([...prev, byDateCustomAddInput]))
                                                    setByDateCustomAddInput('')
                                                }}
                                                className="h-7 px-2 rounded-md bg-stone-200 dark:bg-zinc-700 text-stone-700 dark:text-stone-200 text-xs font-bold hover:bg-stone-300 transition"
                                            >
                                                + Thêm
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {shiftsOnSelectedDate.length === 0 ? (
                            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-xs text-stone-400 space-y-2">
                                <Calendar className="w-8 h-8 text-stone-300 dark:text-zinc-700 mx-auto" />
                                <p className="font-semibold text-stone-600 dark:text-stone-300">
                                    Không có công việc nào phát sinh trong {byDateReportInfo.label}
                                </p>
                                <p className="text-[11px] text-stone-400">
                                    Vui lòng chọn mốc thời gian khác hoặc chuyển sang bộ lọc "Tất cả" trên thanh công cụ để tải thêm lịch sử.
                                </p>
                            </div>
                        ) : (
                            renderAggregatedReportView(
                                byDateReportInfo.title,
                                shiftsOnSelectedDate,
                                byDateLines,
                                byDateLoading,
                                () => handleExportMultiShifts(
                                    byDateReportInfo.excelTitle,
                                    shiftsOnSelectedDate,
                                    byDateLines,
                                    byDateReportInfo.fileName
                                ),
                                'Xuất Excel Báo Cáo'
                            )
                        )}
                    </div>
                )}

                {/* 2.5. CHẾ ĐỘ: BÁO CÁO THEO SẢN PHẨM */}
                {doneViewMode === 'by-product' && (
                    <div className="space-y-4">
                        {/* Thanh điều khiển thời gian & Tìm kiếm sản phẩm */}
                        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-3.5 shadow-xs space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-stone-100 dark:border-zinc-800">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300 mr-1">Thời gian:</span>
                                    <div className="inline-flex p-0.5 bg-stone-100 dark:bg-zinc-800 rounded-lg gap-1">
                                        {(['today', '7days', '30days', 'all', 'custom'] as const).map(tf => {
                                            const label = tf === 'today' ? 'Hôm nay' : tf === '7days' ? '7 ngày' : tf === '30days' ? '30 ngày' : tf === 'all' ? 'Tất cả' : 'Khoảng ngày'
                                            return (
                                                <button
                                                    key={tf}
                                                    type="button"
                                                    onClick={() => setByProdTimeFilter(tf)}
                                                    className={`h-7 px-2.5 rounded-md text-xs font-bold transition ${
                                                        byProdTimeFilter === tf
                                                            ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                                            : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {byProdTimeFilter === 'custom' && (
                                        <div className="flex items-center gap-1.5 ml-2">
                                            <input
                                                type="date"
                                                value={byProdRange.from}
                                                onChange={e => setByProdRange(prev => ({ ...prev, from: e.target.value }))}
                                                className="h-7 px-2 rounded-md border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-xs font-semibold"
                                            />
                                            <span className="text-stone-400 text-xs">➔</span>
                                            <input
                                                type="date"
                                                value={byProdRange.to}
                                                onChange={e => setByProdRange(prev => ({ ...prev, to: e.target.value }))}
                                                className="h-7 px-2 rounded-md border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-xs font-semibold"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                                    <span>Gom từ:</span>
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/40">
                                        {shiftsForProductReport.length} công việc
                                    </span>
                                </div>
                            </div>

                            {/* Ô tìm kiếm mặt hàng */}
                            <div className="relative">
                                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                                <input
                                    type="text"
                                    value={byProdSearch}
                                    onChange={e => setByProdSearch(e.target.value)}
                                    placeholder="Tìm kiếm theo tên sản phẩm, mã SKU hoặc tên công việc phát sinh..."
                                    className="w-full h-9 pl-9 pr-8 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-xs text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                                />
                                {byProdSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setByProdSearch('')}
                                        className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Nội dung báo cáo theo sản phẩm */}
                        {aggregatedProductsForReport.length === 0 ? (
                            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-xs text-stone-400 space-y-2">
                                <Layers className="w-8 h-8 text-stone-300 dark:text-zinc-700 mx-auto" />
                                <p className="font-semibold text-stone-600 dark:text-stone-300">
                                    {byProdSearch.trim()
                                        ? `Không tìm thấy mặt hàng nào khớp với "${byProdSearch}"`
                                        : 'Không có phát sinh sản phẩm nào trong mốc thời gian này'}
                                </p>
                                <p className="text-[11px] text-stone-400">
                                    Vui lòng chuyển mốc thời gian sang "Tất cả" hoặc xóa bộ lọc tìm kiếm.
                                </p>
                            </div>
                        ) : (
                            renderAggregatedReportView(
                                `Báo Cáo Tổng Hợp Theo Sản Phẩm (${aggregatedProductsForReport.length} Mặt Hàng)`,
                                shiftsForProductReport,
                                byProdLines,
                                byProdLoading,
                                () => handleExportMultiShifts(
                                    `BÁO CÁO TỔNG HỢP THEO MẶT HÀNG (${aggregatedProductsForReport.length} SẢN PHẨM)`,
                                    shiftsForProductReport,
                                    byProdLines,
                                    `Bao_cao_san_pham_${byProdTimeFilter}`
                                ),
                                'Xuất Excel Báo Cáo Sản Phẩm'
                            )
                        )}
                    </div>
                )}

                {/* 3. CHẾ ĐỘ: BÁO CÁO TÙY CHỌN (TÍCH CHỌN NHIỀU CÔNG VIỆC) */}
                {doneViewMode === 'custom' && (
                    <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-[340px_minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)] sm:gap-5 sm:items-start">
                        {/* CỘT TRÁI: DANH SÁCH CÔNG VIỆC CÓ CHECKBOX */}
                        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                            <div className="p-3 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/60 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wide text-stone-600 dark:text-stone-300">
                                        Tích chọn công việc ({customSelectedIds.size}/{filteredPastShifts.length})
                                    </span>
                                    {customLoading && <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />}
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-200 dark:border-zinc-800">
                                    <button
                                        type="button"
                                        onClick={handleSelectAllCustomShifts}
                                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                    >
                                        <CheckSquare className="w-3.5 h-3.5" />
                                        Chọn tất cả ({filteredPastShifts.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDeselectAllCustomShifts}
                                        className="text-[11px] font-bold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                                    >
                                        Bỏ chọn
                                    </button>
                                </div>

                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                                    <input
                                        type="text"
                                        value={doneSearch}
                                        onChange={e => setDoneSearch(e.target.value)}
                                        placeholder="Lọc danh sách..."
                                        className="w-full h-8 pl-8 pr-7 text-xs bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {filteredPastShifts.length === 0 ? (
                                <div className="p-8 text-center text-xs text-stone-400">
                                    Không tìm thấy công việc nào.
                                </div>
                            ) : (
                                <div className="divide-y divide-stone-100 dark:divide-zinc-800 max-h-[calc(100vh-280px)] overflow-y-auto">
                                    {filteredPastShifts.map((shift, idx) => {
                                        const isChecked = customSelectedIds.has(shift.id)
                                        const jobTitle = shift.summary_data?.job_name || shift.notes || `Công việc #${idx + 1}`
                                        const pCount = Object.keys(shift.summary_data?.products_summary || {}).length
                                        const rCount = shift.summary_data?.total_records ?? 0
                                        const isClosed = shift.status === 'closed'
                                        return (
                                            <div
                                                key={shift.id || idx}
                                                onClick={() => toggleSelectShift(shift.id)}
                                                className={`w-full text-left px-3.5 py-3 transition cursor-pointer flex items-start gap-3 border-l-4 ${
                                                    isChecked
                                                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-indigo-600'
                                                        : 'border-l-transparent hover:bg-stone-50 dark:hover:bg-zinc-800/40'
                                                }`}
                                            >
                                                <div className="pt-0.5 shrink-0">
                                                    {isChecked ? (
                                                        <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-stone-300 dark:text-zinc-600" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <div className="flex items-start justify-between gap-1.5">
                                                        <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-white leading-snug break-words">
                                                            {jobTitle}
                                                        </span>
                                                        {isClosed ? (
                                                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                Đã chốt
                                                            </span>
                                                        ) : (
                                                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                Đang mở
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-stone-500 flex items-center gap-1.5 flex-wrap">
                                                        <Clock className="w-3 h-3 text-stone-400" />
                                                        <span>{formatDateTime(shift.opened_at)} → {shift.closed_at ? formatDateTime(shift.closed_at) : 'Hiện tại'}</span>
                                                    </div>
                                                    <div className="text-[10px] text-stone-400">
                                                        <span>{shift.closed_by_name || shift.opened_by_name || 'Nhân viên'} • {pCount} SP • {rCount} đợt</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* CỘT PHẢI: BÁO CÁO CÁC CÔNG VIỆC ĐÃ TÍCH */}
                        <div>
                            {customSelectedShifts.length === 0 ? (
                                <div className="bg-white dark:bg-zinc-900 border border-dashed border-stone-300 dark:border-zinc-800 rounded-2xl p-12 text-center text-xs text-stone-400 space-y-2">
                                    <CheckSquare className="w-8 h-8 text-stone-300 dark:text-zinc-700 mx-auto" />
                                    <p className="font-semibold text-stone-600 dark:text-stone-300">
                                        Chưa có công việc nào được chọn
                                    </p>
                                    <p className="text-[11px] text-stone-400">
                                        Hãy tích chọn ít nhất 1 công việc ở danh sách bên trái để tạo bảng báo cáo tổng hợp và xuất file Excel.
                                    </p>
                                </div>
                            ) : (
                                renderAggregatedReportView(
                                    `Báo Cáo Tổng Hợp: ${customSelectedShifts.length} Công Việc Đã Chọn`,
                                    customSelectedShifts,
                                    customLines,
                                    customLoading,
                                    () => handleExportMultiShifts(
                                        `BÁO CÁO TỔNG HỢP (${customSelectedShifts.length} CÔNG VIỆC)`,
                                        customSelectedShifts,
                                        customLines,
                                        `Bao_cao_tuy_chon_${customSelectedShifts.length}_cong_viec`
                                    ),
                                    'Xuất Excel Báo Cáo Đã Chọn'
                                )
                            )}
                        </div>
                    </div>
                )}
            </div>
        ) : !activeShift ? (
                    <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center border-2 border-dashed border-stone-200 dark:border-zinc-800 rounded-2xl bg-white/60 dark:bg-zinc-900/40 p-5 sm:p-6">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-50 dark:bg-indigo-950/60 rounded-2xl flex items-center justify-center text-indigo-600 mb-3 sm:mb-4 shadow-sm">
                            <Briefcase className="w-6 h-6 sm:w-8 sm:h-8" />
                        </div>
                        <h2 className="text-sm sm:text-xl font-bold text-stone-800 dark:text-stone-100 mb-1.5 sm:mb-2">
                            Chưa có Công Việc nào đang mở
                        </h2>
                        <p className="text-[11px] sm:text-sm text-stone-500 dark:text-stone-400 max-w-md mb-4 sm:mb-5">
                            Bạn có thể tạo công việc mới để bắt đầu đếm số lượng, hoặc xem lại báo cáo các công việc đã hoàn thành ngay tại trang này.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                            <button
                                onClick={() => handleOpenCreateShiftModal()}
                                className="px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/25 active:scale-95 transition flex items-center gap-1.5 sm:gap-2"
                            >
                                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" />
                                <span>+ Tạo Công Việc Mới</span>
                            </button>
                            {pastShifts.length > 0 && (
                                <button
                                    type="button"
                                    onClick={openDoneView}
                                    className="px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-bold bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 hover:border-indigo-400 text-stone-700 dark:text-stone-200 rounded-xl transition flex items-center gap-1.5 sm:gap-2"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                                    <span>Xem CV đã hoàn thành ({pastShifts.length})</span>
                                </button>
                            )}
                        </div>
                    </div>
                ) : pinnedProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 sm:py-14 text-center border-2 border-dashed border-stone-200 dark:border-zinc-800 rounded-2xl bg-white/50 dark:bg-zinc-900/40 p-5 sm:p-6">
                        <div className="w-11 h-11 sm:w-14 sm:h-14 bg-indigo-50 dark:bg-indigo-950/60 rounded-2xl flex items-center justify-center text-indigo-500 mb-2.5 sm:mb-3">
                            <Pin className="w-5 h-5 sm:w-7 sm:h-7" />
                        </div>
                        <h2 className="text-sm sm:text-lg font-bold text-stone-800 dark:text-stone-100 mb-1">
                            Bàn làm việc của "{currentJobName}" đang trống
                        </h2>
                        <p className="text-[11px] sm:text-sm text-stone-500 dark:text-stone-400 max-w-md mb-3.5 sm:mb-4">
                            Tìm và ghim các sản phẩm phục vụ riêng cho công việc này ở ô tìm kiếm phía trên để bắt đầu đếm số lượng.
                        </p>
                        {allProducts.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-w-lg">
                                <span className="text-[11px] sm:text-xs text-stone-400 w-full mb-0.5 sm:mb-1">Gợi ý ghim nhanh:</span>
                                {allProducts.slice(0, 5).map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handlePinProduct(p)}
                                        className="px-2 py-1 text-[11px] sm:text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 hover:border-indigo-400 rounded-lg transition"
                                    >
                                        + {p.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                    {/* ===== MOBILE: DANH SÁCH GỌN - CHẠM VÀO DÒNG ĐỂ NHẬP SỐ ===== */}
                    <div className="sm:hidden mb-3.5">
                        <div className="flex items-center justify-between px-1 mb-1.5 text-[10px] text-stone-500">
                            <span>Chạm vào sản phẩm để nhập số</span>
                            <span className="flex items-center gap-2.5">
                                <span className="text-emerald-600 font-bold">N = Nhập</span>
                                <span className="text-rose-600 font-bold">X = Xuất</span>
                            </span>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl divide-y divide-stone-200 dark:divide-zinc-700/80 overflow-hidden shadow-xs">
                            {displayedPinnedProducts.length === 0 ? (
                                <div className="p-6 text-center text-xs text-stone-500">
                                    <p className="font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Không tìm thấy sản phẩm đã ghim nào khớp với "{searchQuery}"
                                    </p>
                                    <div className="flex items-center justify-center gap-2 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 font-semibold text-xs"
                                        >
                                            Xóa tìm kiếm
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSearchMode('pin')}
                                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs"
                                        >
                                            Tìm trong kho để ghim
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                displayedPinnedProducts.map((product, idx) => {
                                    const origIdx = pinnedProducts.findIndex(p => p.id === product.id)
                                    const displayIdx = origIdx >= 0 ? origIdx + 1 : idx + 1
                                    const productUnits = getProductUnits(product)
                                    const currentUnit = selectedUnitMap[product.id] || product.unit || productUnits[0] || 'Kg'
                                    const effect = pulseEffect[product.id]
                                    const isAltRow = idx % 2 === 1

                                    // Lấy tất cả các đơn vị đã phát sinh số liệu trong ca
                                    const activeUnits = productUnits.filter(u => {
                                        const s = getProductCount(product.name, u)
                                        return s.inQty > 0 || s.outQty > 0
                                    })
                                    // Hiển thị tất cả các đơn vị có số liệu + đơn vị đang chọn
                                    const displayUnits = Array.from(new Set([
                                        ...(activeUnits.length > 0 ? activeUnits : [currentUnit]),
                                        currentUnit
                                    ]))

                                    return (
                                        <div
                                            key={product.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => openPad(product)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault()
                                                    openPad(product)
                                                }
                                            }}
                                            className={`w-full p-3 text-left cursor-pointer select-none transition-colors border-l-4 active:bg-indigo-100/60 dark:active:bg-indigo-950/60 ${
                                                effect === 'in'
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-emerald-500'
                                                    : effect === 'out'
                                                    ? 'bg-rose-50 dark:bg-rose-950/40 border-l-rose-500'
                                                    : isAltRow
                                                    ? 'bg-amber-50/35 dark:bg-zinc-800/50 border-l-amber-500'
                                                    : 'bg-white dark:bg-zinc-900 border-l-indigo-600'
                                            }`}
                                        >
                                            <div className="w-full">
                                                <div className="flex items-start gap-2">
                                                    <span className={`w-5 h-5 shrink-0 rounded-md text-[10px] font-black flex items-center justify-center mt-0.5 ${
                                                        isAltRow
                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                                                    }`}>
                                                        {displayIdx}
                                                    </span>

                                                <div className="min-w-0 flex-1">
                                                    <span className="block text-[13px] font-bold text-stone-900 dark:text-white leading-snug break-words">
                                                        {product.name}
                                                    </span>
                                                    {product.sku && (
                                                        <span className="block text-[10px] text-stone-400 font-mono mt-0.5">{product.sku}</span>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={e => {
                                                        e.stopPropagation()
                                                        setHistoryModalProduct(product)
                                                        setHistoryProductFilter('all')
                                                    }}
                                                    title="Xem lịch sử nhập xuất của riêng sản phẩm này"
                                                    className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-indigo-50 dark:bg-zinc-800 flex items-center justify-center text-stone-500 hover:text-indigo-600 shrink-0 transition"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {/* Danh sách hiển thị số lượng của từng loại đơn vị */}
                                            <div className="mt-2 space-y-1.5">
                                                {displayUnits.map(u => {
                                                    const uStats = getProductCount(product.name, u)
                                                    const isSelected = currentUnit === u
                                                    return (
                                                        <div
                                                            key={u}
                                                            className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-xl border transition ${
                                                                isSelected
                                                                    ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800'
                                                                    : 'bg-stone-50 dark:bg-zinc-800/60 border-stone-200 dark:border-zinc-700'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-1.5 font-bold">
                                                                <span className={isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-stone-700 dark:text-stone-300'}>
                                                                    {u}
                                                                </span>
                                                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0 animate-pulse" />}
                                                            </div>
                                                            <div className="flex items-center gap-2.5 text-xs font-black tabular-nums">
                                                                <span className={uStats.inQty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-zinc-600'}>
                                                                    Nhập: +{uStats.inQty}
                                                                </span>
                                                                <span className="text-stone-300 dark:text-zinc-700">|</span>
                                                                <span className={uStats.outQty > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-400 dark:text-zinc-600'}>
                                                                    Xuất: -{uStats.outQty}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                        </div>
                    </div>

                    {/* ===== DESKTOP: BẢNG DANH SÁCH SẢN PHẨM GỌN - CLICK ĐỂ CHỌN, NHẬP Ở BẢNG BÊN PHẢI ===== */}
                    <div className="hidden sm:block sm:col-start-1 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden mb-3.5">
                        <div className="grid grid-cols-[minmax(0,1fr)_32px_102px_68px_68px_48px_28px] items-center gap-2 px-3 py-1.5 bg-stone-50 dark:bg-zinc-950/60 border-b border-stone-200 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                            <span>Sản phẩm</span>
                            <span className="text-center" title="Lịch sử nhập xuất">LS</span>
                            <span className="text-center">ĐVT</span>
                            <span className="text-center text-emerald-600">Đã nhập</span>
                            <span className="text-center text-rose-600">Đã xuất</span>
                            <span className="text-center">Số đợt</span>
                            <span />
                        </div>
                        <div className="divide-y divide-stone-100 dark:divide-zinc-800/80">
                            {displayedPinnedProducts.length === 0 ? (
                                <div className="p-8 text-center text-xs text-stone-500">
                                    <p className="font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Không tìm thấy sản phẩm đã ghim nào khớp với "{searchQuery}"
                                    </p>
                                    <p className="text-[11px] text-stone-400 mb-3">
                                        Sản phẩm này chưa được ghim vào công việc hoặc gõ sai từ khóa.
                                    </p>
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 font-semibold text-xs hover:bg-stone-200"
                                        >
                                            Xóa tìm kiếm
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSearchMode('pin')}
                                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
                                        >
                                            Tìm trong kho để ghim
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                displayedPinnedProducts.map((product, idx) => {
                                    const origIdx = pinnedProducts.findIndex(p => p.id === product.id)
                                    const displayIdx = origIdx >= 0 ? origIdx + 1 : idx + 1
                                    const productUnits = getProductUnits(product)
                                    const currentUnit = selectedUnitMap[product.id] || product.unit || productUnits[0] || 'Kg'
                                    const isActive = padProduct?.id === product.id
                                    const rowUnit = isActive ? padUnit : currentUnit
                                    const effect = pulseEffect[product.id]
                                    const batchCount = journalList.filter(j => j.item_name === product.name).length

                                    // Lấy tất cả các đơn vị đã phát sinh số liệu trong ca
                                    const activeUnits = productUnits.filter(u => {
                                        const s = getProductCount(product.name, u)
                                        return s.inQty > 0 || s.outQty > 0
                                    })

                                    // Danh sách các đơn vị sẽ hiển thị trên dòng:
                                    // Bao gồm đơn vị đang active trên pad/selected, cộng với TẤT CẢ các đơn vị đã phát sinh số liệu
                                    const displayUnits = Array.from(new Set([
                                        rowUnit,
                                        ...activeUnits
                                    ]))

                                    return (
                                        <div
                                            key={product.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => openPad(product)}
                                            className={`group grid grid-cols-[minmax(0,1fr)_32px_102px_68px_68px_48px_28px] items-center gap-2 px-3 py-1.5 cursor-pointer border-l-4 transition-colors ${
                                                effect === 'in'
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-emerald-500'
                                                    : effect === 'out'
                                                    ? 'bg-rose-50 dark:bg-rose-950/40 border-l-rose-500'
                                                    : isActive
                                                    ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-l-indigo-600'
                                                    : idx % 2 === 1
                                                    ? 'bg-amber-50/25 dark:bg-zinc-800/40 border-l-amber-400 hover:bg-amber-50/40'
                                                    : 'bg-white dark:bg-zinc-900 border-l-indigo-300 dark:border-l-indigo-800/60 hover:bg-stone-50 dark:hover:bg-zinc-800/40'
                                            }`}
                                        >
                                            {/* Cột 1: STT + Tên sản phẩm + SKU (Siêu gọn) */}
                                            <div className="min-w-0 flex items-center gap-2">
                                                <span className={`w-5 h-5 shrink-0 rounded text-[10px] font-black flex items-center justify-center ${
                                                    isActive
                                                        ? 'bg-indigo-600 text-white shadow-xs'
                                                        : idx % 2 === 1
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                                                }`}>
                                                    {displayIdx}
                                                </span>

                                            <div className="min-w-0 flex-1">
                                                <p className={`text-xs font-bold leading-tight break-words ${isActive ? 'text-indigo-900 dark:text-indigo-100' : 'text-stone-900 dark:text-white'}`}>
                                                    {product.name}
                                                </p>
                                                {product.sku && (
                                                    <p className="text-[10px] text-stone-400 font-mono leading-none mt-0.5">{product.sku}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Cột 2: Con mắt xem lịch sử riêng sản phẩm */}
                                        <div className="flex items-center justify-center">
                                            <button
                                                type="button"
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    setHistoryModalProduct(product)
                                                    setHistoryProductFilter('all')
                                                }}
                                                title="Xem lịch sử nhập xuất của riêng sản phẩm này"
                                                className="w-6 h-6 rounded-md flex items-center justify-center text-stone-400 hover:text-indigo-600 hover:bg-indigo-100/70 dark:hover:bg-zinc-800 transition"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {/* Cột 3: ĐVT (Căn giữa, hiện đầy đủ tên đơn vị kể cả khi đang chọn) */}
                                        <div className="flex flex-col gap-1 justify-center" onClick={e => e.stopPropagation()}>
                                            {displayUnits.map(u => {
                                                const isPadActive = isActive && padUnit === u
                                                const isSelected = rowUnit === u
                                                return (
                                                    <button
                                                        key={u}
                                                        type="button"
                                                        onClick={() => {
                                                            handleUnitChange(product.id, u)
                                                            setPadProduct(product)
                                                            setPadUnit(u)
                                                        }}
                                                        className={`w-full text-center text-[11px] font-bold px-1.5 h-6 rounded-md border transition whitespace-nowrap flex items-center justify-center ${
                                                            isPadActive
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                                : isSelected
                                                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                                                                : 'bg-stone-50 dark:bg-zinc-800/70 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-zinc-700 hover:border-indigo-300'
                                                        }`}
                                                        title={`Bấm để chọn nhập theo ${u}`}
                                                    >
                                                        <span>{u}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        {/* Cột 4: ĐÃ NHẬP (Căn giữa) */}
                                        <div className="flex flex-col gap-1 justify-center text-center">
                                            {displayUnits.map(u => {
                                                const uStats = getProductCount(product.name, u)
                                                return (
                                                    <div key={u} className="h-6 flex items-center justify-center">
                                                        <span className={`text-sm font-black tabular-nums ${
                                                            uStats.inQty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-300 dark:text-zinc-700 font-semibold text-xs'
                                                        }`}>
                                                            {uStats.inQty > 0 ? `+${uStats.inQty}` : '0'}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Cột 5: ĐÃ XUẤT (Căn giữa) */}
                                        <div className="flex flex-col gap-1 justify-center text-center">
                                            {displayUnits.map(u => {
                                                const uStats = getProductCount(product.name, u)
                                                return (
                                                    <div key={u} className="h-6 flex items-center justify-center">
                                                        <span className={`text-sm font-black tabular-nums ${
                                                            uStats.outQty > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-300 dark:text-zinc-700 font-semibold text-xs'
                                                        }`}>
                                                            {uStats.outQty > 0 ? `-${uStats.outQty}` : '0'}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Cột 6: SỐ ĐỢT (Căn giữa) */}
                                        <span className="text-center text-[11px] text-stone-400 tabular-nums">{batchCount}</span>

                                        {/* Cột 7: BỎ GHIM (Nút h-6 w-6 căn giữa) */}
                                        <div className="flex items-center justify-center">
                                            <button
                                                type="button"
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    if (confirm(`Bỏ ghim "${product.name}" khỏi công việc này?`)) handleUnpinProduct(product.id)
                                                }}
                                                title="Bỏ ghim"
                                                className="w-6 h-6 rounded-md flex items-center justify-center text-stone-300 opacity-0 group-hover:opacity-100 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                            >
                                                <PinOff className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                        </div>
                    </div>
                    </>

                )}

                {/* 5. NHẬT KÝ VÀ BẢNG TỔNG HỢP CỦA CÔNG VIỆC ĐANG CHỌN */}
                {pageView === 'active' && activeShift && (
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden sm:col-start-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 dark:border-zinc-800 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-stone-50/50 dark:bg-zinc-950/50">
                            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 sm:gap-4 w-full sm:w-auto">
                                <button
                                    onClick={() => setActiveTab('feed')}
                                    className={`text-[11px] sm:text-sm font-bold flex items-center justify-center sm:justify-start gap-1.5 py-1 sm:py-0 sm:pb-1 rounded-lg sm:rounded-none sm:border-b-2 transition ${
                                        activeTab === 'feed'
                                            ? 'bg-indigo-50/80 dark:bg-indigo-950/50 sm:bg-transparent sm:border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                            : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                    }`}
                                >
                                    <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                    <span>Lịch sử đợt ({allJobJournals.length > 0 ? allJobJournals.length : journalList.length})</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('summary')}
                                    className={`text-[11px] sm:text-sm font-bold flex items-center justify-center sm:justify-start gap-1.5 py-1 sm:py-0 sm:pb-1 rounded-lg sm:rounded-none sm:border-b-2 transition ${
                                        activeTab === 'summary'
                                            ? 'bg-indigo-50/80 dark:bg-indigo-950/50 sm:bg-transparent sm:border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                            : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                    }`}
                                >
                                    <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                    <span className="sm:hidden">Báo cáo tổng hợp</span>
                                    <span className="hidden sm:inline">Báo cáo: {currentJobName}</span>
                                </button>
                            </div>

                            {/* Bộ lọc Tất cả / Nhập / Xuất cho Lịch sử đợt */}
                            {activeTab === 'feed' && (() => {
                                const baseLines = allJobJournals.length > 0 ? allJobJournals : journalList
                                const inCount = baseLines.filter(l => l.to_department === 'Kho').length
                                const outCount = baseLines.filter(l => l.to_department !== 'Kho').length
                                return (
                                    <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 bg-stone-200/70 dark:bg-zinc-800 p-0.5 rounded-lg w-full sm:w-auto shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setJournalTypeFilter('all')}
                                            className={`px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold transition flex items-center justify-center gap-1 ${
                                                journalTypeFilter === 'all'
                                                    ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-white shadow-xs'
                                                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                            }`}
                                        >
                                            <span>Tất cả ({baseLines.length})</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setJournalTypeFilter('in')}
                                            className={`px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold transition flex items-center justify-center gap-1 ${
                                                journalTypeFilter === 'in'
                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                    : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40'
                                            }`}
                                        >
                                            <ArrowDownLeft className="w-3 h-3 shrink-0" />
                                            <span>Nhập ({inCount})</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setJournalTypeFilter('out')}
                                            className={`px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold transition flex items-center justify-center gap-1 ${
                                                journalTypeFilter === 'out'
                                                    ? 'bg-rose-600 text-white shadow-xs'
                                                    : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50/60 dark:hover:bg-rose-950/40'
                                            }`}
                                        >
                                            <ArrowUpRight className="w-3 h-3 shrink-0" />
                                            <span>Xuất ({outCount})</span>
                                        </button>
                                    </div>
                                )
                            })()}
                        </div>

                        {/* Tab 1: Realtime Feed (Lịch sử vừa bấm) */}
                        {activeTab === 'feed' && (() => {
                            const filterLines = (lines: DeliveryJournalRecord[]) => {
                                if (journalTypeFilter === 'in') return lines.filter(l => l.to_department === 'Kho')
                                if (journalTypeFilter === 'out') return lines.filter(l => l.to_department !== 'Kho')
                                return lines
                            }

                            const renderJournalRow = (record: DeliveryJournalRecord) => {
                                const isImport = record.to_department === 'Kho'
                                const userNote = cleanUserNotes(record.notes)
                                return (
                                    <div
                                        key={record.id}
                                        className="px-2.5 sm:px-4 py-2 sm:py-3 flex items-start gap-2 sm:gap-2.5 hover:bg-stone-50 dark:hover:bg-zinc-800/40 transition text-[11px] sm:text-xs"
                                    >
                                        <div
                                            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-bold shrink-0 mt-0.5 ${
                                                isImport
                                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                                            }`}
                                        >
                                            {isImport ? (
                                                <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            ) : (
                                                <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
                                            {/* Hàng 1: Tên sản phẩm + Nút Sửa/Xóa (không đè lên badge số lượng) */}
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="font-bold text-stone-900 dark:text-white break-words leading-snug min-w-0 flex-1">
                                                    {record.item_name}
                                                </span>
                                                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                                    <span
                                                        className={`hidden sm:inline-flex px-2 py-0.5 rounded-md font-black text-[11px] whitespace-nowrap ${
                                                            isImport
                                                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                                                        }`}
                                                    >
                                                        {isImport ? `+${record.quantity_sent}` : `-${record.quantity_sent}`} {record.unit}
                                                    </span>
                                                    <button
                                                        onClick={() => handleStartEdit(record)}
                                                        title="Chỉnh sửa dòng này"
                                                        className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-stone-100 hover:bg-indigo-50 dark:bg-zinc-800 dark:hover:bg-indigo-950/50 text-stone-500 hover:text-indigo-600 dark:text-stone-400 dark:hover:text-indigo-300 flex items-center justify-center active:scale-90 transition shrink-0"
                                                    >
                                                        <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteJournal(record.id)}
                                                        title="Xóa lượt bấm này nếu bấm nhầm"
                                                        className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-stone-100 hover:bg-rose-50 dark:bg-zinc-800 dark:hover:bg-rose-950/50 text-stone-500 hover:text-rose-600 dark:text-stone-400 dark:hover:text-rose-300 flex items-center justify-center active:scale-90 transition shrink-0"
                                                    >
                                                        <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Hàng 2 (Mobile): Badge số lượng */}
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span
                                                    className={`sm:hidden px-1.5 py-0.5 rounded-md font-black text-[10px] whitespace-nowrap ${
                                                        isImport
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                                                    }`}
                                                >
                                                    {isImport ? `+${record.quantity_sent}` : `-${record.quantity_sent}`} {record.unit}
                                                </span>
                                                <span className="hidden sm:inline text-[11px] text-stone-400">
                                                    {formatDateTime(record.sent_at)} • {record.sent_by_name || 'Nhân viên'}
                                                    {userNote ? ` • 💬 ${userNote}` : ''}
                                                </span>
                                            </div>

                                            {/* Hàng 3 (Mobile): Thời gian • Người nhập trên 1 dòng thoáng */}
                                            <div className="sm:hidden text-[10px] text-stone-400 flex items-center gap-1.5 flex-wrap">
                                                <span>{formatDateTime(record.sent_at)}</span>
                                                <span>•</span>
                                                <span>{record.sent_by_name || 'Nhân viên'}</span>
                                                {userNote && <span>• 💬 {userNote}</span>}
                                            </div>
                                        </div>
                                    </div>
                                )
                            }

                            if (allJobJournals.length === 0 && journalList.length === 0) {
                                return (
                                    <div className="p-6 sm:p-8 text-center text-[11px] sm:text-xs text-stone-400">
                                        Chưa có đợt ghi nhận nào trong công việc "{currentJobName}".
                                    </div>
                                )
                            }

                            // Nếu chưa có lần chốt tạm nào: hiển thị danh sách phẳng thông thường
                            if (subShifts.length === 0) {
                                const linesToShow = filterLines(allJobJournals.length > 0 ? allJobJournals : journalList)
                                if (linesToShow.length === 0) {
                                    return (
                                        <div className="p-6 sm:p-8 text-center text-[11px] sm:text-xs text-stone-400">
                                            Không có đợt {journalTypeFilter === 'in' ? 'Nhập' : 'Xuất'} nào khớp với bộ lọc.
                                        </div>
                                    )
                                }
                                return (
                                    <div className="divide-y divide-stone-100 dark:divide-zinc-800 max-h-96 overflow-y-auto">
                                        {linesToShow.map(record => renderJournalRow(record))}
                                    </div>
                                )
                            }

                            // Nếu đã có các lần chốt tạm: phân chia thành Đợt hiện tại và Khung các lần chốt tạm (có thể thu lại / mở rộng)
                            const latestSub = subShifts[subShifts.length - 1]
                            const rawCurrentBatchLines = allJobJournals.filter(l => l.sent_at > latestSub.to_time)
                            const currentBatchLines = filterLines(rawCurrentBatchLines)

                            return (
                                <div className="p-2.5 sm:p-4 space-y-3.5 sm:space-y-4 max-h-[560px] overflow-y-auto">
                                    {/* 1. Đợt hiện tại đang nhập */}
                                    <div className="space-y-1.5 sm:space-y-2">
                                        <div className="flex items-center justify-between px-1 text-[11px] sm:text-xs">
                                            <span className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                Đang nhập: Đợt #{subShifts.length + 1}
                                            </span>
                                            <span className="text-[10px] sm:text-[11px] text-stone-400">
                                                {currentBatchLines.length} đợt phát sinh
                                            </span>
                                        </div>

                                        {currentBatchLines.length === 0 ? (
                                            <div className="p-3 text-center text-[11px] sm:text-xs text-stone-400 bg-stone-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-stone-200 dark:border-zinc-700/60">
                                                {rawCurrentBatchLines.length === 0
                                                    ? 'Chưa có phát sinh số liệu mới sau lần chốt tạm gần nhất.'
                                                    : `Không có đợt ${journalTypeFilter === 'in' ? 'Nhập' : 'Xuất'} nào trong đợt hiện tại.`}
                                            </div>
                                        ) : (
                                            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl divide-y divide-stone-100 dark:divide-zinc-800 overflow-hidden shadow-xs">
                                                {currentBatchLines.map(record => renderJournalRow(record))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Khung các lần chốt tạm đã lưu (bao bọc trong khung có thể mở rộng / thu lại) */}
                                    <div className="space-y-2 sm:space-y-2.5 pt-2 border-t border-stone-100 dark:border-zinc-800">
                                        <div className="text-[10px] sm:text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1 flex items-center justify-between gap-2">
                                            <span className="flex items-center gap-1.5">
                                                <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                Các lần chốt ca tạm đã lưu ({subShifts.length})
                                            </span>
                                            <span className="hidden sm:inline text-[10px] text-stone-400 normal-case font-normal">
                                                Bấm vào khung để mở rộng / thu lại
                                            </span>
                                        </div>

                                        <div className="space-y-2 sm:space-y-2.5">
                                            {[...subShifts].reverse().map((ss: any) => {
                                                const isExpanded = expandedFeedSubShifts.has(ss.id)
                                                const originalIdx = subShifts.findIndex(s => s.id === ss.id)
                                                const prevToTime = originalIdx > 0 ? subShifts[originalIdx - 1].to_time : ss.from_time
                                                const rawSubLines = allJobJournals.filter(l =>
                                                    originalIdx === 0
                                                        ? (l.sent_at >= ss.from_time && l.sent_at <= ss.to_time)
                                                        : (l.sent_at > prevToTime && l.sent_at <= ss.to_time)
                                                )
                                                const subLines = filterLines(rawSubLines)
                                                const totalIn = rawSubLines.filter(l => l.to_department === 'Kho').reduce((s, l) => s + (Number(l.quantity_sent) || 0), 0)
                                                const totalOut = rawSubLines.filter(l => l.to_department !== 'Kho').reduce((s, l) => s + (Number(l.quantity_sent) || 0), 0)

                                                return (
                                                    <div
                                                        key={ss.id}
                                                        className="bg-white dark:bg-zinc-950 border border-amber-200/80 dark:border-amber-900/50 rounded-xl overflow-hidden shadow-xs transition"
                                                    >
                                                        {/* Header khung chốt tạm: Gọn 2 hàng trên Mobile, không bao giờ gãy chữ */}
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleExpandFeedSubShift(ss.id)}
                                                            className="w-full p-2.5 sm:p-3 text-left bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/35 transition space-y-1"
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <span className="text-[11px] sm:text-sm font-bold text-amber-800 dark:text-amber-400 truncate">
                                                                        Lần chốt ca tạm #{ss.sub_shift_number}
                                                                    </span>
                                                                    <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold shrink-0 whitespace-nowrap">
                                                                        {subLines.length} đợt
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <div className="bg-white dark:bg-zinc-900 px-1.5 sm:px-2 py-0.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40 font-medium text-stone-600 dark:text-stone-300 text-[10px] sm:text-[11px] whitespace-nowrap">
                                                                        <strong className="text-emerald-600">+{totalIn}</strong>
                                                                        <span className="mx-1 text-stone-300 dark:text-zinc-700">|</span>
                                                                        <strong className="text-rose-600">-{totalOut}</strong>
                                                                    </div>
                                                                    {isExpanded ? (
                                                                        <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400 shrink-0" />
                                                                    ) : (
                                                                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400 shrink-0" />
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="text-[10px] sm:text-[11px] text-stone-400 flex items-center gap-1">
                                                                <Clock className="w-3 h-3 shrink-0" />
                                                                <span className="truncate">{formatCompactRange(ss.from_time, ss.to_time)}</span>
                                                            </div>
                                                        </button>

                                                        {/* Nội dung danh sách các đợt khi mở rộng khung */}
                                                        {isExpanded && (
                                                            <div className="border-t border-amber-100 dark:border-amber-900/40 divide-y divide-stone-100 dark:divide-zinc-800/80">
                                                                {subLines.length === 0 ? (
                                                                    <div className="p-3 sm:p-4 text-center text-[11px] sm:text-xs text-stone-400 italic">
                                                                        {rawSubLines.length === 0
                                                                            ? 'Không có đợt ghi nhận nào trong lần chốt này.'
                                                                            : `Không có đợt ${journalTypeFilter === 'in' ? 'Nhập' : 'Xuất'} nào trong lần chốt này.`}
                                                                    </div>
                                                                ) : (
                                                                    subLines.map(record => renderJournalRow(record))
                                                                )}

                                                                <div className="p-2 sm:p-2.5 bg-stone-50/70 dark:bg-zinc-900/60 text-[10px] sm:text-[11px] text-stone-500 flex flex-wrap items-center justify-between gap-2 px-2.5 sm:px-3">
                                                                    <span>👤 Người chốt tạm: <strong className="text-stone-700 dark:text-stone-200">{ss.closed_by_name || 'Nhân viên'}</strong></span>
                                                                    {ss.notes && <span className="italic">💬 "{ss.notes}"</span>}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Tab 2: Báo cáo chi tiết các đợt chốt tạm & Tổng hợp đối soát toàn công việc */}
                        {activeTab === 'summary' && (() => {
                            const sortedAllLines = [...allJobJournals].sort((a, b) => a.sent_at.localeCompare(b.sent_at))
                            const activeEffectiveSubShifts = buildEffectiveSubShifts(subShifts, sortedAllLines, activeShift)
                            const fullSummaryRows = summarizeLines(sortedAllLines)

                            const unitsMap: Record<string, { unit: string; in_qty: number; out_qty: number; in_count: number; out_count: number }> = {}
                            let totalInCount = 0
                            let totalOutCount = 0
                            sortedAllLines.forEach(l => {
                                const u = l.unit || 'ĐVT'
                                if (!unitsMap[u]) unitsMap[u] = { unit: u, in_qty: 0, out_qty: 0, in_count: 0, out_count: 0 }
                                const qty = Number(l.quantity_sent) || 0
                                if (l.to_department === 'Kho') {
                                    unitsMap[u].in_qty += qty
                                    unitsMap[u].in_count += 1
                                    totalInCount += 1
                                } else {
                                    unitsMap[u].out_qty += qty
                                    unitsMap[u].out_count += 1
                                    totalOutCount += 1
                                }
                            })
                            const unitsSummaryList = Object.values(unitsMap)

                            return (
                                <div className="p-3 sm:p-5 space-y-3.5 sm:space-y-5">
                                    <div className="pb-2.5 sm:pb-3 border-b border-stone-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 text-[11px] sm:text-xs">
                                        <span className="text-stone-500">
                                            Công việc: <strong className="text-stone-900 dark:text-white font-bold">{currentJobName}</strong>
                                        </span>
                                        <span className="text-stone-400">
                                            Bắt đầu: {formatDateTime(activeShift.opened_at)} • Tổng: <strong className="text-stone-700 dark:text-stone-200">{sortedAllLines.length} đợt</strong>
                                        </span>
                                    </div>

                                    {/* 1. CHI TIẾT CÁC LẦN CHỐT CA TẠM (ĐỔI CA) */}
                                    <div className="space-y-2 sm:space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-[11px] sm:text-sm min-w-0">
                                                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                                                <span className="truncate">Chi tiết các lần chốt ca tạm (đổi ca)</span>
                                            </h4>
                                            <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold shrink-0 whitespace-nowrap">
                                                {subShifts.length} lần chốt tạm
                                            </span>
                                        </div>

                                        {activeEffectiveSubShifts.length === 0 ? (
                                            <div className="bg-amber-50/40 dark:bg-amber-950/10 border border-dashed border-amber-200 dark:border-amber-900/40 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-[11px] sm:text-xs text-stone-500">
                                                Chưa có lần bấm <strong>Chốt tạm</strong> nào trong công việc này. Khi đổi ca hoặc nghỉ giữa ca, bấm nút <strong>Chốt tạm</strong> ở góc trên để lưu mốc từng đợt.
                                            </div>
                                        ) : (
                                            <div className="space-y-2 sm:space-y-3 relative sm:border-l-2 sm:border-amber-200 dark:sm:border-amber-800/60 sm:ml-2.5 sm:pl-5">
                                                {activeEffectiveSubShifts.map((ss: any) => {
                                                    const isExpanded = expandedDoneSubShifts.has(ss.id)
                                                    const subLines: DeliveryJournalRecord[] = ss._subLines || []
                                                    const subProds = subLines.length > 0
                                                        ? summarizeLines(subLines)
                                                        : Object.values(ss.summary_data?.products_summary || {}).map((p: any) => ({
                                                            product_name: p.product_name,
                                                            unit: p.unit,
                                                            in_qty: p.in_qty || 0,
                                                            out_qty: p.out_qty || 0,
                                                            count: (p.in_count || 0) + (p.out_count || 0)
                                                        }))
                                                    const totalIn = subProds.reduce((s, p) => s + (Number(p.in_qty) || 0), 0)
                                                    const totalOut = subProds.reduce((s, p) => s + (Number(p.out_qty) || 0), 0)
                                                    const totalCount = subLines.length > 0
                                                        ? subLines.length
                                                        : (ss.summary_data?.total_records ?? subProds.reduce((s, p) => s + (p.count || 0), 0))

                                                    return (
                                                        <div key={ss.id} className="relative bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
                                                            <div className="hidden sm:block absolute -left-[27px] top-4 w-3 h-3 rounded-full bg-amber-500 ring-4 ring-white dark:ring-zinc-900" />

                                                            <button
                                                                type="button"
                                                                onClick={() => toggleExpandDoneSubShift(ss.id)}
                                                                className="w-full p-2.5 sm:p-3.5 text-left hover:bg-stone-50 dark:hover:bg-zinc-900/60 transition space-y-1"
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="text-[11px] sm:text-sm font-bold text-amber-700 dark:text-amber-500 flex items-center gap-1.5 flex-wrap min-w-0">
                                                                        <span>{ss.is_auto_final ? `Đợt #${ss.sub_shift_number} (Đang nhập)` : `Lần chốt ca tạm #${ss.sub_shift_number}`}</span>
                                                                        {ss.is_auto_final && (
                                                                            <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 whitespace-nowrap">
                                                                                Chưa chốt tạm
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        <div className="text-[10px] sm:text-xs bg-stone-100 dark:bg-zinc-800 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-medium text-stone-600 dark:text-stone-300 whitespace-nowrap">
                                                                            <span className="hidden sm:inline">Nhập </span>
                                                                            <strong className="text-emerald-600">+{totalIn}</strong>
                                                                            <span className="mx-1 text-stone-300 dark:text-zinc-700">|</span>
                                                                            <span className="hidden sm:inline">Xuất </span>
                                                                            <strong className="text-rose-600">-{totalOut}</strong>
                                                                            <span className="mx-1 text-stone-300 dark:text-zinc-700">|</span>
                                                                            <strong>{totalCount}</strong> đợt
                                                                        </div>
                                                                        {isExpanded ? (
                                                                            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400 shrink-0" />
                                                                        ) : (
                                                                            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400 shrink-0" />
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="text-[10px] sm:text-[11px] text-stone-400 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3 shrink-0" />
                                                                    <span className="truncate">{formatCompactRange(ss.from_time, ss.to_time, ss.is_auto_final)}</span>
                                                                </div>
                                                            </button>

                                                            {isExpanded && (
                                                                <div className="px-2.5 sm:px-4 pb-3 pt-2 border-t border-stone-100 dark:border-zinc-800/80 space-y-2 bg-stone-50/40 dark:bg-zinc-900/30">
                                                                    {subProds.length > 0 ? (
                                                                        <div className="bg-white dark:bg-zinc-900 rounded-xl p-2 sm:p-3 border border-stone-200 dark:border-zinc-800">
                                                                            <div className="text-[9px] sm:text-[11px] font-bold text-stone-400 uppercase mb-1.5 sm:mb-2">
                                                                                Hàng hóa trong đợt #{ss.sub_shift_number}
                                                                            </div>

                                                                            {/* Mobile: Danh sách thẻ gọn */}
                                                                            <div className="sm:hidden divide-y divide-stone-100 dark:divide-zinc-800/60">
                                                                                {subProds.map((p, pIdx) => (
                                                                                    <div key={pIdx} className="py-1.5 first:pt-0 last:pb-0 space-y-0.5">
                                                                                        <div className="text-[11px] font-bold text-stone-800 dark:text-stone-200 leading-snug">
                                                                                            {p.product_name}
                                                                                        </div>
                                                                                        <div className="flex items-center justify-between text-[10px]">
                                                                                            <span className="text-stone-500">
                                                                                                ĐVT: <strong className="text-stone-700 dark:text-stone-300">{p.unit}</strong> • {p.count || 0} đợt
                                                                                            </span>
                                                                                            <div className="flex items-center gap-1.5 font-black">
                                                                                                <span className="text-emerald-600">+{p.in_qty}</span>
                                                                                                <span className="text-stone-300 dark:text-zinc-700">|</span>
                                                                                                <span className="text-rose-600">-{p.out_qty}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>

                                                                            {/* Desktop: Bảng 5 cột */}
                                                                            <table className="hidden sm:table w-full text-left text-xs">
                                                                                <thead>
                                                                                    <tr className="border-b border-stone-100 dark:border-zinc-800 text-stone-400">
                                                                                        <th className="pb-1.5 font-semibold">Sản phẩm</th>
                                                                                        <th className="pb-1.5 font-semibold">ĐVT</th>
                                                                                        <th className="pb-1.5 font-semibold text-right text-emerald-600">Nhập (+)</th>
                                                                                        <th className="pb-1.5 font-semibold text-right text-rose-600">Xuất (-)</th>
                                                                                        <th className="pb-1.5 font-semibold text-right">Số đợt</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/60">
                                                                                    {subProds.map((p, pIdx) => (
                                                                                        <tr key={pIdx}>
                                                                                            <td className="py-2 font-bold text-stone-800 dark:text-stone-200 pr-2">{p.product_name}</td>
                                                                                            <td className="py-2 text-stone-500 whitespace-nowrap">{p.unit}</td>
                                                                                            <td className="py-2 text-right font-bold text-emerald-600">+{p.in_qty}</td>
                                                                                            <td className="py-2 text-right font-bold text-rose-600">-{p.out_qty}</td>
                                                                                            <td className="py-2 text-right text-stone-400">{p.count || 0} đợt</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-[11px] sm:text-xs text-stone-400 italic py-1">
                                                                            Không có phát sinh hàng hóa trong đợt này.
                                                                        </div>
                                                                    )}

                                                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs text-stone-500 bg-stone-100/70 dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg">
                                                                        <span>👤 Người thực hiện: <strong className="text-stone-700 dark:text-stone-200">{ss.closed_by_name || 'Nhân viên'}</strong></span>
                                                                        {ss.notes && <span className="italic">💬 "{ss.notes}"</span>}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. TỔNG HỢP ĐỐI SOÁT CẢ CA (CỘNG DỒN TẤT CẢ CÁC ĐỢT CHỐT TẠM + ĐỢT HIỆN TẠI) */}
                                    <div className="space-y-2 sm:space-y-3 pt-2.5 sm:pt-3 border-t border-stone-100 dark:border-zinc-800">
                                        <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-[11px] sm:text-sm">
                                            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 shrink-0" />
                                            <span>Tổng hợp đối soát cả ca (Sum tổng)</span>
                                        </h4>

                                        {/* 2.1. Tổng hợp 2 hướng */}
                                        <div className="bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                                            <button
                                                type="button"
                                                onClick={() => setIsTwoWayExpanded(!isTwoWayExpanded)}
                                                className="w-full p-2.5 sm:p-3.5 flex items-center justify-between gap-2 text-left hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition"
                                            >
                                                <span className="text-[10px] sm:text-xs font-extrabold text-stone-700 dark:text-stone-300 uppercase tracking-wider truncate">
                                                    📦 TỔNG HỢP 2 HƯỚNG (NHẬP/XUẤT)
                                                </span>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span className="text-[10px] sm:text-[11px] bg-stone-100 dark:bg-zinc-800 px-1.5 sm:px-2 py-0.5 rounded font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                                        Tổng {sortedAllLines.length} đợt
                                                    </span>
                                                    {isTwoWayExpanded ? <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" /> : <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />}
                                                </div>
                                            </button>
                                            {isTwoWayExpanded && (
                                                <div className="p-2.5 sm:p-4 border-t border-stone-100 dark:border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 bg-stone-50/40 dark:bg-zinc-900/30">
                                                    <div className="bg-emerald-50/40 dark:bg-emerald-950/15 border border-emerald-200/70 dark:border-emerald-900/40 rounded-xl p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
                                                        <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-800/50 pb-1">
                                                            <span className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">1. Nhập kho (SX → Kho)</span>
                                                            <span className="text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">{totalInCount} đợt</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {unitsSummaryList.filter(u => u.in_qty > 0).length === 0 ? (
                                                                <span className="text-[11px] sm:text-xs text-stone-400 italic">Chưa phát sinh nhập</span>
                                                            ) : (
                                                                unitsSummaryList.filter(u => u.in_qty > 0).map(u => (
                                                                    <span key={u.unit} className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                                                        +{u.in_qty} {u.unit}
                                                                    </span>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="bg-rose-50/40 dark:bg-rose-950/15 border border-rose-200/70 dark:border-rose-900/40 rounded-xl p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
                                                        <div className="flex items-center justify-between border-b border-rose-200/60 dark:border-rose-800/50 pb-1">
                                                            <span className="text-[11px] sm:text-xs font-bold text-rose-700 dark:text-rose-400 uppercase">2. Xuất kho (Kho → SX)</span>
                                                            <span className="text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">{totalOutCount} đợt</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {unitsSummaryList.filter(u => u.out_qty > 0).length === 0 ? (
                                                                <span className="text-[11px] sm:text-xs text-stone-400 italic">Chưa phát sinh xuất</span>
                                                            ) : (
                                                                unitsSummaryList.filter(u => u.out_qty > 0).map(u => (
                                                                    <span key={u.unit} className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-800 text-[11px] sm:text-xs font-bold text-rose-700 dark:text-rose-300">
                                                                        -{u.out_qty} {u.unit}
                                                                    </span>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* 2.2. Chi tiết theo đơn vị hàng hóa */}
                                        <div className="bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                                            <button
                                                type="button"
                                                onClick={() => setIsUnitsExpanded(!isUnitsExpanded)}
                                                className="w-full p-2.5 sm:p-3.5 flex items-center justify-between gap-2 text-left hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition"
                                            >
                                                <span className="text-[10px] sm:text-xs font-extrabold text-stone-700 dark:text-stone-300 uppercase tracking-wider truncate">
                                                    📊 CHI TIẾT THEO ĐƠN VỊ HÀNG HÓA
                                                </span>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span className="text-[10px] sm:text-[11px] bg-stone-100 dark:bg-zinc-800 px-1.5 sm:px-2 py-0.5 rounded font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                                        {unitsSummaryList.length} Đơn vị
                                                    </span>
                                                    {isUnitsExpanded ? <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" /> : <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />}
                                                </div>
                                            </button>
                                            {isUnitsExpanded && (
                                                <div className="p-2.5 sm:p-4 border-t border-stone-100 dark:border-zinc-800/80 bg-stone-50/40 dark:bg-zinc-900/30 overflow-x-auto">
                                                    <table className="w-full text-left text-[11px] sm:text-xs">
                                                        <thead>
                                                            <tr className="border-b border-stone-200 dark:border-zinc-800 text-stone-400 uppercase text-[10px] sm:text-[11px]">
                                                                <th className="pb-1.5 sm:pb-2">ĐVT</th>
                                                                <th className="pb-1.5 sm:pb-2 text-right text-emerald-600">Nhập (+)</th>
                                                                <th className="pb-1.5 sm:pb-2 text-right text-rose-600">Xuất (-)</th>
                                                                <th className="pb-1.5 sm:pb-2 text-right">Số đợt</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                            {unitsSummaryList.map(u => (
                                                                <tr key={u.unit}>
                                                                    <td className="py-1.5 sm:py-2 font-bold text-stone-800 dark:text-stone-100">{u.unit}</td>
                                                                    <td className="py-1.5 sm:py-2 text-right font-black text-emerald-600">+{u.in_qty}</td>
                                                                    <td className="py-1.5 sm:py-2 text-right font-black text-rose-600">-{u.out_qty}</td>
                                                                    <td className="py-1.5 sm:py-2 text-right text-stone-500">{u.in_count + u.out_count} đợt</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>

                                        {/* 2.3. Bảng tổng hợp theo sản phẩm (toàn công việc) */}
                                        <div className="bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                                            <button
                                                type="button"
                                                onClick={() => setIsProductsExpanded(!isProductsExpanded)}
                                                className="w-full p-2.5 sm:p-3.5 flex items-center justify-between gap-2 text-left hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition"
                                            >
                                                <span className="text-[10px] sm:text-xs font-extrabold text-stone-700 dark:text-stone-300 uppercase tracking-wider truncate">
                                                    📋 TỔNG HỢP THEO SẢN PHẨM (TOÀN CV)
                                                </span>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span className="text-[10px] sm:text-[11px] bg-stone-100 dark:bg-zinc-800 px-1.5 sm:px-2 py-0.5 rounded font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                                        {fullSummaryRows.length} SP
                                                    </span>
                                                    {isProductsExpanded ? <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" /> : <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />}
                                                </div>
                                            </button>
                                            {isProductsExpanded && (
                                                <div className="p-2.5 sm:p-4 border-t border-stone-100 dark:border-zinc-800/80 bg-stone-50/40 dark:bg-zinc-900/30">
                                                    {fullSummaryRows.length === 0 ? (
                                                        <div className="py-5 text-center text-[11px] sm:text-xs text-stone-400">
                                                            Chưa có dữ liệu thống kê cho công việc này.
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {/* Mobile: Hiển thị dạng danh sách thẻ rõ ràng, không gãy cột */}
                                                            <div className="sm:hidden divide-y divide-stone-200/70 dark:divide-zinc-800">
                                                                {fullSummaryRows.map((row, idx) => (
                                                                    <div key={idx} className="py-2 first:pt-0 last:pb-0 space-y-1">
                                                                        <div className="text-[11px] font-bold text-stone-900 dark:text-white leading-snug">
                                                                            {row.product_name}
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-[10px]">
                                                                            <span className="text-stone-500">
                                                                                ĐVT: <strong className="text-stone-700 dark:text-stone-300">{row.unit}</strong> • {row.count} đợt
                                                                            </span>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black">
                                                                                    +{row.in_qty}
                                                                                </span>
                                                                                <span className="px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-black">
                                                                                    -{row.out_qty}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Desktop: Bảng 5 cột */}
                                                            <table className="hidden sm:table w-full text-left text-xs">
                                                                <thead>
                                                                    <tr className="border-b border-stone-200 dark:border-zinc-800 text-stone-400 font-semibold uppercase">
                                                                        <th className="pb-2">Sản phẩm</th>
                                                                        <th className="pb-2">ĐVT</th>
                                                                        <th className="pb-2 text-right text-emerald-600">Tổng Nhập (+)</th>
                                                                        <th className="pb-2 text-right text-rose-600">Tổng Xuất (-)</th>
                                                                        <th className="pb-2 text-right">Số đợt chốt</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                                    {fullSummaryRows.map((row, idx) => (
                                                                        <tr key={idx} className="hover:bg-stone-50 dark:hover:bg-zinc-800/40">
                                                                            <td className="py-2.5 font-bold text-stone-900 dark:text-white pr-2">
                                                                                {row.product_name}
                                                                            </td>
                                                                            <td className="py-2.5 text-stone-500 whitespace-nowrap">{row.unit}</td>
                                                                            <td className="py-2.5 text-right font-black text-emerald-600">
                                                                                +{row.in_qty}
                                                                            </td>
                                                                            <td className="py-2.5 text-right font-black text-rose-600">
                                                                                -{row.out_qty}
                                                                            </td>
                                                                            <td className="py-2.5 text-right text-stone-400 whitespace-nowrap">
                                                                                {row.count} đợt
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                )}

                {/* ===== DESKTOP: BẢNG NHẬP SỐ CỐ ĐỊNH BÊN PHẢI (VỪA KHÍT TẦM MẮT, BÀN PHÍM RỘNG RÃI DỄ BẤM) ===== */}
                {pageView === 'active' && activeShift && pinnedProducts.length > 0 && (
                    <aside className="hidden sm:block sm:col-start-2 sm:row-start-1 sm:row-span-2 sticky top-[76px] max-h-[calc(100vh-82px)] overflow-y-auto scrollbar-none">
                        {padProduct ? (() => {
                            const units = getProductUnits(padProduct)
                            const qtyNum = parseFloat(padValue) || 0
                            const stats = getProductCount(padProduct.name, padUnit)
                            const canSave = qtyNum > 0 && !padSaving
                            return (
                                <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-sm p-3 space-y-1">
                                    {/* Hàng 1: Tên sản phẩm (khung viền border & màu nền nổi bật) */}
                                    <div className="px-2.5 py-1.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs">
                                        <h3 className="text-xs font-bold text-indigo-950 dark:text-indigo-100 leading-snug line-clamp-2 break-words" title={padProduct.name}>
                                            {padProduct.name}
                                        </h3>
                                    </div>

                                    {/* Hàng 2: Chọn ĐVT & Thống kê đã nhập/xuất (+/-) */}
                                    <div className="flex items-center justify-between gap-1.5 py-0.5">
                                        <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase shrink-0">ĐVT:</span>
                                            <div className="flex flex-wrap gap-1">
                                                {units.map(u => (
                                                    <button
                                                        key={u}
                                                        type="button"
                                                        onClick={() => {
                                                            setPadUnit(u)
                                                            if (padProduct) handleUnitChange(padProduct.id, u)
                                                        }}
                                                        className={`h-6 px-2 rounded-lg text-[11px] font-bold border transition ${
                                                            padUnit === u
                                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                                                : 'bg-stone-50 dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-300 hover:border-indigo-300'
                                                        }`}
                                                    >
                                                        {u}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-900/40 text-[11px] font-black text-emerald-700 dark:text-emerald-300 tabular-nums" title="Tổng đã nhập">
                                                +{stats.inQty}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200/60 dark:border-rose-900/40 text-[11px] font-black text-rose-700 dark:text-rose-300 tabular-nums" title="Tổng đã xuất">
                                                -{stats.outQty}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Hàng 3: Màn hình số & Nút xóa nhanh */}
                                    <div className="h-9 rounded-xl bg-stone-100 dark:bg-zinc-800/80 border border-stone-200/80 dark:border-zinc-700 flex items-center justify-between px-3">
                                        <div className="flex items-center gap-1">
                                            {padValue ? (
                                                <button 
                                                    type="button" 
                                                    onClick={() => handlePadKey('clear')}
                                                    className="px-2 py-0.5 rounded bg-stone-200 hover:bg-rose-100 dark:bg-zinc-700 dark:hover:bg-rose-950/60 text-stone-600 hover:text-rose-600 dark:text-stone-300 dark:hover:text-rose-400 text-[10px] font-bold transition leading-none"
                                                    title="Xóa số (Esc)"
                                                >
                                                    XÓA
                                                </button>
                                            ) : (
                                                <span className="text-[11px] font-semibold text-stone-400">Số lượng:</span>
                                            )}
                                        </div>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className={`text-xl font-black tabular-nums tracking-tight ${padValue ? 'text-stone-900 dark:text-white' : 'text-stone-300 dark:text-zinc-600'}`}>
                                                {padValue || '0'}
                                            </span>
                                            <span className="text-xs font-bold text-stone-500">{padUnit}</span>
                                        </div>
                                    </div>

                                    {/* Hàng 3.5: Các nút cộng dồn nhanh số lượng (+1, +5, +10, +50, +100) */}
                                    <div className="grid grid-cols-5 gap-1">
                                        {[1, 5, 10, 50, 100].map(n => (
                                            <button
                                                key={n}
                                                type="button"
                                                onClick={() => {
                                                    const cur = parseFloat(padValue) || 0
                                                    setPadValue(String(cur + n))
                                                }}
                                                className="h-5.5 rounded-md bg-stone-50 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-stone-200/70 dark:border-zinc-700 text-[11px] font-bold text-stone-700 dark:text-stone-300 transition active:scale-95 flex items-center justify-center leading-none"
                                                title={`Cộng thêm ${n}`}
                                            >
                                                +{n}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Hàng 4: Bàn phím số 3x4 (Chiều cao phím vừa vặn h-8.5) */}
                                    <div className="grid grid-cols-3 gap-1">
                                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map(k => (
                                            <button
                                                key={k}
                                                type="button"
                                                onClick={() => handlePadKey(k)}
                                                className={`h-8.5 rounded-lg text-base font-bold active:scale-95 transition select-none flex items-center justify-center ${
                                                    k === 'del'
                                                        ? 'bg-stone-200 hover:bg-stone-300 dark:bg-zinc-700 text-stone-700 dark:text-stone-200'
                                                        : 'bg-white hover:bg-stone-100 dark:bg-zinc-800/90 dark:hover:bg-zinc-700 border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-white shadow-2xs'
                                                }`}
                                            >
                                                {k === 'del' ? '⌫' : k === '.' ? ',' : k}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Hàng 5: Hai nút hành động XUẤT | NHẬP (Cao h-9 vừa vặn, không bị đụng đáy) */}
                                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                                        <button
                                            type="button"
                                            disabled={!canSave}
                                            onClick={() => handlePadConfirm('out')}
                                            className="h-9 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold transition disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 flex items-center justify-center gap-1.5 shadow-xs"
                                            title="Xác nhận Xuất (Phím trừ -)"
                                        >
                                            <ArrowUpRight className="w-4 h-4 shrink-0" />
                                            <span className="text-xs sm:text-sm font-black">XUẤT {qtyNum > 0 ? `(-${padValue})` : ''}</span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!canSave}
                                            onClick={() => handlePadConfirm('in')}
                                            className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold transition disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 flex items-center justify-center gap-1.5 shadow-xs"
                                            title="Xác nhận Nhập (Phím cộng +)"
                                        >
                                            <ArrowDownLeft className="w-4 h-4 shrink-0" />
                                            <span className="text-xs sm:text-sm font-black">NHẬP {qtyNum > 0 ? `(+${padValue})` : ''}</span>
                                        </button>
                                    </div>

                                    {/* Gợi ý phím tắt */}
                                    <p className="text-[10px] text-stone-400 text-center leading-tight pt-0.5">
                                        Phím tắt: Số • <kbd className="px-1 rounded bg-stone-100 dark:bg-zinc-800 font-mono text-[9px]">+</kbd> Nhập • <kbd className="px-1 rounded bg-stone-100 dark:bg-zinc-800 font-mono text-[9px]">−</kbd> Xuất • <kbd className="px-1 rounded bg-stone-100 dark:bg-zinc-800 font-mono text-[9px]">↑↓</kbd> Đổi SP • <kbd className="px-1 rounded bg-stone-100 dark:bg-zinc-800 font-mono text-[9px]">Esc</kbd> Xóa
                                    </p>
                                </div>
                            )
                        })() : (
                            <div className="bg-white dark:bg-zinc-900 border border-dashed border-stone-300 dark:border-zinc-700 rounded-2xl p-6 text-center text-sm text-stone-400">
                                Chọn một sản phẩm bên trái để nhập số
                            </div>
                        )}
                    </aside>
                )}
            </main>

            {/* 6. MODAL MỞ THÊM CÔNG VIỆC MỚI */}
            {openShiftModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
                        {/* Thanh handle cho mobile */}
                        <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100 dark:border-zinc-800 shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2.5 sm:p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                                    <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-base sm:text-xl text-stone-900 dark:text-white truncate">
                                        {openShifts.length > 0 ? 'Mở Thêm Công Việc Mới' : 'Mở Ca Công Việc Đầu Tiên'}
                                    </h3>
                                    <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400">Mỗi công việc có bàn ghim và số liệu thống kê riêng</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpenShiftModal(false)}
                                className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition shrink-0"
                                title="Đóng"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
                            {/* 1. Tên công việc */}
                            <div>
                                <label className="block text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                                    Tên công việc <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        autoFocus
                                        list="job-templates-datalist"
                                        value={jobNameInput}
                                        onChange={e => {
                                            const val = e.target.value
                                            setJobNameInput(val)
                                            const match = jobTemplatesList.find(t => t.name.toLowerCase() === val.toLowerCase().trim())
                                            if (match) {
                                                if (match.notes && !jobNotesInput) setJobNotesInput(match.notes)
                                                setSelectedJobTemplate(match)
                                            }
                                        }}
                                        placeholder="Ví dụ: Đóng gói sầu riêng xuất khẩu, Sơ chế mít..."
                                        className="w-full text-sm sm:text-base font-semibold px-3.5 py-3 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-stone-900 dark:text-white"
                                    />
                                    <datalist id="job-templates-datalist">
                                        {jobTemplatesList.map(tpl => (
                                            <option key={tpl.id} value={tpl.name} />
                                        ))}
                                    </datalist>
                                </div>

                                {/* Gợi ý mẫu công việc từ danh sách quản lý */}
                                <div className="mt-3 bg-stone-50/80 dark:bg-zinc-800/50 p-3 sm:p-3.5 rounded-xl border border-stone-200/70 dark:border-zinc-800">
                                    <div className="flex items-center justify-between mb-2.5">
                                        <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                                            <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                                            <span>Chọn nhanh từ mẫu công việc:</span>
                                        </span>
                                        <Link
                                            href="/so-lieu/mau-cong-viec"
                                            target="_blank"
                                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                            title="Mở trang quản lý & tạo mới công việc mẫu"
                                        >
                                            <Settings2 className="w-3.5 h-3.5" />
                                            <span>Quản lý mẫu</span>
                                        </Link>
                                    </div>
                                    {jobTemplatesList.length === 0 ? (
                                        <p className="text-xs text-stone-400 dark:text-zinc-500 italic">
                                            Chưa có công việc mẫu cho kho này — bấm &ldquo;Quản lý mẫu&rdquo; để tạo mới.
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {jobTemplatesList.map(tpl => {
                                                const isSelected = selectedJobTemplate?.id === tpl.id || jobNameInput.trim().toLowerCase() === tpl.name.trim().toLowerCase()
                                                return (
                                                    <button
                                                        key={tpl.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected && jobNameInput.trim() === tpl.name.trim()) {
                                                                // Bấm lại để bỏ chọn
                                                                setJobNameInput('')
                                                                setSelectedJobTemplate(null)
                                                            } else {
                                                                setJobNameInput(tpl.name)
                                                                if (tpl.notes) setJobNotesInput(tpl.notes)
                                                                setSelectedJobTemplate(tpl)
                                                            }
                                                        }}
                                                        className={`text-xs px-3 py-1.5 rounded-lg transition active:scale-95 flex items-center gap-2 border shadow-2xs ${
                                                            isSelected
                                                                ? 'bg-indigo-600 border-indigo-600 text-white font-bold'
                                                                : 'bg-white hover:bg-stone-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-stone-200 font-medium'
                                                        }`}
                                                    >
                                                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                        <span>{tpl.name}</span>
                                                        {tpl.pinned_product_ids && tpl.pinned_product_ids.length > 0 && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isSelected ? 'bg-indigo-800 text-white' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'}`}>
                                                                {tpl.pinned_product_ids.length} SP
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Loại phiếu kế toán (Tự động điền khi tạo phiếu kết toán) */}
                            <div>
                                <label className="text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
                                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                                    <span>Loại phiếu (Kế toán)</span>
                                </label>
                                <select
                                    value={jobOrderTypeId}
                                    onChange={e => setJobOrderTypeId(e.target.value)}
                                    className="w-full text-xs sm:text-sm px-3 py-2 sm:py-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-stone-800 dark:text-stone-100"
                                >
                                    <option value="">-- Mặc định (hoặc chọn khi chốt ca / làm phiếu) --</option>
                                    {orderTypes.map(ot => (
                                        <option key={ot.id} value={ot.id}>
                                            {ot.code ? `${ot.code} - ` : ''}{ot.name}{ot.scope && ot.scope !== 'both' ? ` (${ot.scope === 'inbound' ? 'Nhập' : 'Xuất'})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-stone-400 mt-1">
                                    Gán trước loại phiếu để tự động điền sẵn khi tạo phiếu nhập/xuất kho kế toán.
                                </p>
                            </div>

                            {/* 2. Thời gian bắt đầu công việc (Hỗ trợ nhập bù) */}
                            <div>
                                <div className="flex flex-wrap items-center justify-between mb-1.5 gap-2">
                                    <label className="text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                                        <span>Thời gian bắt đầu (Ngày & Giờ)</span>
                                    </label>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setJobOpenedAtInput(formatDateTimeLocal(new Date()))}
                                            className="text-xs px-2.5 py-1 rounded-md font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition"
                                        >
                                            Hiện tại
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const d = new Date()
                                                d.setDate(d.getDate() - 1)
                                                setJobOpenedAtInput(formatDateTimeLocal(d))
                                            }}
                                            className="text-xs px-2.5 py-1 rounded-md font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-zinc-700 transition"
                                        >
                                            Hôm qua
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const d = new Date()
                                                d.setDate(d.getDate() - 2)
                                                setJobOpenedAtInput(formatDateTimeLocal(d))
                                            }}
                                            className="text-xs px-2.5 py-1 rounded-md font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-zinc-700 transition"
                                        >
                                            2 ngày trước
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="datetime-local"
                                    value={jobOpenedAtInput}
                                    onChange={e => setJobOpenedAtInput(e.target.value)}
                                    className="w-full text-sm font-semibold p-2.5 sm:p-3 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-stone-800 dark:text-stone-100"
                                />
                                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1.5">
                                    <span>💡</span> <span>Bạn có thể lùi ngày &amp; giờ để <strong>nhập bù số liệu</strong> cho các ca làm việc trước đó.</span>
                                </p>
                            </div>

                            {/* 3. Ghi chú thêm */}
                            <div>
                                <label className="block text-xs sm:text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                                    Ghi chú thêm (tùy chọn):
                                </label>
                                <textarea
                                    value={jobNotesInput}
                                    onChange={e => setJobNotesInput(e.target.value)}
                                    placeholder="Ghi chú về tổ phụ trách, địa điểm xưởng, ca làm..."
                                    rows={2}
                                    className="w-full text-xs sm:text-sm p-3 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-4 mt-3 border-t border-stone-100 dark:border-zinc-800 shrink-0">
                            <button
                                onClick={() => setOpenShiftModal(false)}
                                className="h-11 px-4 text-sm font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl transition flex items-center justify-center border border-stone-200 dark:border-zinc-700"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleOpenShift}
                                disabled={!jobNameInput.trim()}
                                className="h-11 px-5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center"
                            >
                                Bắt Đầu CV
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. MODAL CHỐT CA TẠM (CHO CÔNG VIỆC ĐANG CHỌN) */}
            {interimCloseModal && interimSummary && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 max-h-[92vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
                        {/* Thanh handle cho mobile */}
                        <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800 mb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0" />
                                <div>
                                    <h3 className="font-bold text-base text-stone-900 dark:text-white">
                                        Báo Cáo Chốt Tạm (Đợt {subShifts.length + 1})
                                    </h3>
                                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold truncate">
                                        Công việc: {currentJobName}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setInterimCloseModal(false)} className="text-stone-400 hover:text-stone-600 p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="text-xs text-stone-500 mb-3 flex items-center justify-between shrink-0">
                            <span>Từ: <strong>{formatDateTime(interimSummary.from_time)}</strong></span>
                            <span>Đến: <strong>{formatDateTime(interimSummary.to_time)}</strong></span>
                        </div>

                        {/* Bảng tổng hợp theo sản phẩm trong đợt này (Không tính tồn) */}
                        <div className="flex-1 overflow-y-auto mb-3 border border-stone-100 dark:border-zinc-800 rounded-xl p-3 bg-stone-50/50 dark:bg-zinc-950/50">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b text-stone-400 uppercase font-semibold">
                                        <th className="pb-1.5">Sản phẩm</th>
                                        <th className="pb-1.5 text-right">Nhập (+)</th>
                                        <th className="pb-1.5 text-right">Xuất (-)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                    {Object.values(interimSummary.products_summary || {}).map((item: any, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2 font-medium text-stone-800 dark:text-stone-200">
                                                {item.product_name} ({item.unit})
                                            </td>
                                            <td className="py-2 text-right text-emerald-600 font-bold">+{item.in_qty}</td>
                                            <td className="py-2 text-right text-rose-600 font-bold">-{item.out_qty}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mb-3 shrink-0">
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Ghi chú đợt chốt tạm:
                            </label>
                            <input
                                type="text"
                                value={interimNotes}
                                onChange={e => setInterimNotes(e.target.value)}
                                placeholder="Ví dụ: Chốt giữa ca ăn trưa..."
                                className="w-full text-xs p-3 sm:p-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800 shrink-0">
                            <button
                                onClick={() => setInterimCloseModal(false)}
                                className="h-11 sm:h-9 px-4 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl flex items-center justify-center"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleInterimClose}
                                className="h-11 sm:h-9 px-5 text-xs font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl shadow-md flex items-center justify-center"
                            >
                                Xác nhận Chốt Tạm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 8. MODAL CHỐT SỔ (HOÀN THÀNH CÔNG VIỆC ĐANG CHỌN) */}
            {closeShiftModal && shiftSummary && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 max-h-[92vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
                        {/* Thanh handle cho mobile */}
                        <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800 mb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <StopCircle className="w-5 h-5 text-rose-600 shrink-0" />
                                <div>
                                    <h3 className="font-bold text-base text-stone-900 dark:text-white">
                                        Báo Cáo Tổng Kết Hoàn Thành
                                    </h3>
                                    <p className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 font-bold truncate">
                                        {currentJobName}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setCloseShiftModal(false)} className="text-stone-400 hover:text-stone-600 p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="text-xs text-stone-500 mb-3 bg-stone-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-stone-200 dark:border-zinc-700/60 flex flex-col gap-1.5 shrink-0">
                            <div>Thời gian bắt đầu: <strong>{formatDateTime(shiftSummary.from_time)}</strong></div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-1 border-t border-stone-200 dark:border-zinc-700/50">
                                <label className="font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                    <span>Thời gian chốt CV:</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={closeTimeInput}
                                    onChange={e => setCloseTimeInput(e.target.value)}
                                    className="text-xs font-semibold p-1.5 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-lg text-stone-800 dark:text-stone-200"
                                />
                            </div>
                            <div>Người thực hiện: <strong>{profile?.full_name || 'Nhân viên kho'}</strong></div>
                        </div>

                        {/* Bảng tổng kết toàn ca công việc (Không tính tồn) */}
                        <div className="flex-1 overflow-y-auto mb-3 border border-stone-100 dark:border-zinc-800 rounded-xl p-3 bg-stone-50/50 dark:bg-zinc-950/50">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b text-stone-400 uppercase font-semibold">
                                        <th className="pb-1.5">Sản phẩm</th>
                                        <th className="pb-1.5 text-right">Tổng Nhập (+)</th>
                                        <th className="pb-1.5 text-right">Tổng Xuất (-)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                    {Object.values(shiftSummary.products_summary || {}).map((item: any, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2 font-bold text-stone-800 dark:text-stone-200">
                                                {item.product_name} ({item.unit})
                                            </td>
                                            <td className="py-2 text-right text-emerald-600 font-bold">+{item.in_qty}</td>
                                            <td className="py-2 text-right text-rose-600 font-bold">-{item.out_qty}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                                                {/* Chọn / đổi loại phiếu trước khi đóng */}
                        <div className="mb-3 shrink-0">
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Loại phiếu kế toán:
                            </label>
                            <select
                                value={closeOrderTypeId}
                                onChange={e => setCloseOrderTypeId(e.target.value)}
                                className="w-full text-xs p-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-stone-800 dark:text-stone-100"
                            >
                                <option value="">-- Mặc định (hoặc chọn loại phiếu) --</option>
                                {orderTypes.map(ot => (
                                    <option key={ot.id} value={ot.id}>
                                        {ot.code ? `${ot.code} - ` : ''}{ot.name}{ot.scope && ot.scope !== 'both' ? ` (${ot.scope === 'inbound' ? 'Nhập' : 'Xuất'})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-3 shrink-0">
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Ghi chú hoàn thành công việc:
                            </label>
                            <input
                                type="text"
                                value={closeNotes}
                                onChange={e => setCloseNotes(e.target.value)}
                                placeholder="Ghi chú tổng kết sau khi làm xong..."
                                className="w-full text-xs p-3 sm:p-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800 shrink-0">
                            <button
                                onClick={() => setCloseShiftModal(false)}
                                className="h-11 sm:h-9 px-4 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl flex items-center justify-center"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleCloseShift}
                                className="h-11 sm:h-9 px-4 text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow-md flex items-center justify-center"
                            >
                                Xác Nhận Đóng CV
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 9. PANEL LỊCH SỬ CÁC ĐỢT CHỐT TẠM TRONG CÔNG VIỆC NÀY */}
            {showSubShiftsPanel && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 max-h-[85vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
                        {/* Thanh handle cho mobile */}
                        <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800 mb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <History className="w-5 h-5 text-indigo-600 shrink-0" />
                                <div>
                                    <h3 className="font-bold text-base text-stone-900 dark:text-white">
                                        Các Đợt Chốt Tạm
                                    </h3>
                                    <p className="text-xs text-stone-500 truncate">{currentJobName}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowSubShiftsPanel(false)} className="text-stone-400 hover:text-stone-600 p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3">
                            {subShifts.length === 0 ? (
                                <p className="text-xs text-stone-400 text-center py-6">Chưa có đợt chốt tạm nào.</p>
                            ) : (
                                subShifts.map((sub, idx) => (
                                    <div
                                        key={sub.id || idx}
                                        className="p-3 bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700/60 rounded-xl text-xs"
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                Đợt {sub.sub_shift_number || idx + 1}
                                            </span>
                                            <span className="text-stone-400 text-[11px]">
                                                {formatDateTime(sub.to_time)}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-stone-500 mb-1">
                                            Chốt bởi: {sub.closed_by_name || 'Nhân viên'}
                                            {sub.notes && ` • Ghi chú: ${sub.notes}`}
                                        </div>

                                        {/* Chi tiết đợt */}
                                        {sub.summary_data?.products_summary && (
                                            <div className="mt-2 pt-2 border-t border-stone-200 dark:border-zinc-700/50 space-y-1">
                                                {Object.values(sub.summary_data.products_summary).map((p: any, pIdx) => (
                                                    <div key={pIdx} className="flex items-center justify-between text-[11px]">
                                                        <span className="text-stone-700 dark:text-stone-300">{p.product_name}:</span>
                                                        <span className="font-semibold text-stone-900 dark:text-white">
                                                            +{p.in_qty} / -{p.out_qty} {p.unit}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-3 border-t border-stone-200 dark:border-zinc-800 text-right shrink-0">
                            <button
                                onClick={() => setShowSubShiftsPanel(false)}
                                className="w-full sm:w-auto h-11 sm:h-9 px-5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 rounded-xl flex items-center justify-center"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 10. MODAL XEM LỊCH SỬ TẤT CẢ CÁC CÔNG VIỆC ĐÃ HOÀN THÀNH */}
            {showHistoryModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 max-h-[85vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
                        {/* Thanh handle cho mobile */}
                        <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800 mb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <History className="w-5 h-5 text-indigo-600 shrink-0" />
                                <div>
                                    <h3 className="font-bold text-base text-stone-900 dark:text-white">
                                        Lịch Sử Các Công Việc Đã Hoàn Thành
                                    </h3>
                                    <p className="text-xs text-stone-500">Danh sách báo cáo các công việc đã đóng</p>
                                </div>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)} className="text-stone-400 hover:text-stone-600 p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3">
                            {pastShifts.length === 0 ? (
                                <p className="text-xs text-stone-400 text-center py-8">Chưa có công việc nào được chốt sổ trước đó.</p>
                            ) : (
                                pastShifts.map((shift, idx) => {
                                    const jobTitle = shift.summary_data?.job_name || shift.notes || 'Công việc'
                                    const productsSum = shift.summary_data?.products_summary || {}
                                    return (
                                        <div
                                            key={shift.id || idx}
                                            className="p-3.5 bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700/60 rounded-xl text-xs space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Briefcase className="w-4 h-4 text-indigo-600" />
                                                    <span className="font-bold text-sm text-stone-900 dark:text-white">
                                                        {jobTitle}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-stone-400">
                                                    Hoàn thành: {formatDateTime(shift.closed_at)}
                                                </span>
                                            </div>

                                            <div className="text-[11px] text-stone-500">
                                                Thời gian: {formatTimeOnly(shift.opened_at)} - {formatTimeOnly(shift.closed_at)} • Người làm: {shift.closed_by_name || 'Nhân viên'}
                                            </div>

                                            {/* Bảng tóm tắt số liệu công việc */}
                                            {Object.keys(productsSum).length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-stone-200 dark:border-zinc-700/50">
                                                    <div className="text-[11px] font-semibold text-stone-400 mb-1">Số liệu tổng kết:</div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                        {Object.values(productsSum).map((p: any, pIdx) => (
                                                            <div key={pIdx} className="flex items-center justify-between bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-stone-100 dark:border-zinc-800 text-[11px]">
                                                                <span className="font-medium text-stone-700 dark:text-stone-300 truncate mr-2">{p.product_name}</span>
                                                                <span className="font-bold text-stone-900 dark:text-white whitespace-nowrap">
                                                                    +{p.in_qty} / -{p.out_qty} {p.unit}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        <div className="pt-3 border-t border-stone-200 dark:border-zinc-800 text-right shrink-0">
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="w-full sm:w-auto h-11 sm:h-9 px-5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 rounded-xl flex items-center justify-center"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 11. MODAL CHỈNH SỬA TỪNG DÒNG NHẬT KÝ */}
            {editingRecord && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
                        {/* Thanh handle cho mobile */}
                        <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800 mb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
                                    <Pencil className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-stone-900 dark:text-white">
                                        Chỉnh Sửa Dòng Số Liệu
                                    </h3>
                                    <p className="text-xs text-stone-400">
                                        {editingRecord.delivery_code || 'Ghi nhận đợt'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingRecord(null)}
                                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3.5 overflow-y-auto flex-1 pr-0.5">
                            {/* Tên sản phẩm */}
                            <div>
                                <label className="block text-xs font-semibold text-stone-500 mb-1">
                                    Sản phẩm
                                </label>
                                <div className="p-2.5 bg-stone-50 dark:bg-zinc-800/60 rounded-xl font-bold text-xs text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-zinc-700/60 break-words">
                                    {editingRecord.item_name}
                                </div>
                            </div>

                            {/* Chiều Nhập / Xuất */}
                            <div>
                                <label className="block text-xs font-semibold text-stone-500 mb-1.5">
                                    Phân loại thao tác
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditType('in')}
                                        className={`h-11 sm:h-9 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition border ${
                                            editType === 'in'
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                : 'bg-white dark:bg-zinc-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-zinc-700 hover:bg-stone-50'
                                        }`}
                                    >
                                        <ArrowDownLeft className="w-4 h-4" />
                                        Nhập kho (+)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditType('out')}
                                        className={`h-11 sm:h-9 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition border ${
                                            editType === 'out'
                                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                                : 'bg-white dark:bg-zinc-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-zinc-700 hover:bg-stone-50'
                                        }`}
                                    >
                                        <ArrowUpRight className="w-4 h-4" />
                                        Xuất kho (-)
                                    </button>
                                </div>
                            </div>

                            {/* Số lượng & Đơn vị tính */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-stone-500 mb-1">
                                        Số lượng
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={editQuantity}
                                        onChange={e => setEditQuantity(parseFloat(e.target.value) || 0)}
                                        className="w-full text-base font-bold p-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-stone-500 mb-1">
                                        Đơn vị tính
                                    </label>
                                    {(() => {
                                        // Ưu tiên tìm trong pinnedProducts trước, rồi đến allProducts
                                        const prod = pinnedProducts.find(p => p.name === editingRecord.item_name) ||
                                                     allProducts.find(p => p.name === editingRecord.item_name)

                                        // Lấy danh sách đơn vị riêng của sản phẩm này (đã chuẩn hóa & ưu tiên Thùng lên đầu)
                                        const productUnits = prod ? getProductUnits(prod) : []

                                        // Nếu sản phẩm có đơn vị riêng thì CHỈ hiện đơn vị của sản phẩm đó
                                        // Chỉ fallback về danh sách đơn vị hệ thống khi sản phẩm tự do hoặc không có đơn vị nào
                                        const baseUnits = productUnits.length > 0 
                                            ? productUnits 
                                            : (prod?.id?.startsWith('custom_') ? availableUnits : (prod?.unit ? [prod.unit] : availableUnits))

                                        const currentCleanUnit = cleanUnitLabel(editUnit) || editUnit
                                        const unitsToShow = Array.from(new Set([
                                            currentCleanUnit,
                                            ...baseUnits
                                        ].map(u => cleanUnitLabel(u)).filter(Boolean)))

                                        return (
                                            <select
                                                value={editUnit}
                                                onChange={e => setEditUnit(e.target.value)}
                                                className="w-full text-xs font-bold p-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 h-[42px]"
                                            >
                                                {unitsToShow.map(u => (
                                                    <option key={u} value={u}>
                                                        {u}
                                                    </option>
                                                ))}
                                            </select>
                                        )
                                    })()}
                                </div>
                            </div>

                            {/* Ghi chú */}
                            <div>
                                <label className="block text-xs font-semibold text-stone-500 mb-1">
                                    Ghi chú
                                </label>
                                <input
                                    type="text"
                                    value={editNotes}
                                    onChange={e => setEditNotes(e.target.value)}
                                    placeholder="Ghi chú đợt (nếu có)..."
                                    className="w-full text-xs p-3 sm:p-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Nút hành động */}
                        <div className="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-stone-100 dark:border-zinc-800 shrink-0">
                            <button
                                type="button"
                                onClick={() => setEditingRecord(null)}
                                className="h-11 sm:h-9 px-4 text-xs font-semibold text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl flex items-center justify-center"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                disabled={savingEdit}
                                onClick={handleSaveEdit}
                                className="h-11 sm:h-9 px-5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center"
                            >
                                {savingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MOBILE: BÀN PHÍM SỐ NHẬP NHANH ===== */}
            {padProduct && (() => {
                const units = getProductUnits(padProduct)
                const qtyNum = parseFloat(padValue) || 0
                const stats = getProductCount(padProduct.name, padUnit)
                const canSave = qtyNum > 0 && !padSaving
                return (
                    <div className="sm:hidden fixed inset-0 z-[60] flex flex-col justify-end">
                        <div className="absolute inset-0 bg-black/50" onClick={() => !padSaving && setPadProduct(null)} />
                        <div className="relative bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-8 duration-200">
                            <div className="w-9 h-1 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-2.5" />

                            {/* Tên sản phẩm + đã nhập/xuất */}
                            <div className="flex items-start gap-2 mb-2.5">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-stone-900 dark:text-white leading-snug break-words">
                                        {padProduct.name}
                                    </h3>
                                    <p className="text-[11px] text-stone-500 mt-0.5">
                                        Đã nhập <strong className="text-emerald-600">{stats.inQty}</strong>
                                        {' • '}
                                        Đã xuất <strong className="text-rose-600">{stats.outQty}</strong>
                                        {' '}({padUnit})
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPadProduct(null)}
                                    className="w-8 h-8 shrink-0 rounded-full bg-stone-100 dark:bg-zinc-800 flex items-center justify-center text-stone-500"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Chọn đơn vị tính (chỉ hiện khi có nhiều ĐVT) */}
                            {units.length > 1 && (
                                <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-3.5 px-3.5 mb-2.5">
                                    {units.map(u => (
                                        <button
                                            key={u}
                                            type="button"
                                            onClick={() => {
                                                setPadUnit(u)
                                                if (padProduct) handleUnitChange(padProduct.id, u)
                                            }}
                                            className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold border transition ${
                                                padUnit === u
                                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                                    : 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-300'
                                            }`}
                                        >
                                            {u}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Màn hình số */}
                            <div className="h-16 rounded-2xl bg-stone-100 dark:bg-zinc-800 flex items-center justify-end gap-2 px-3.5 mb-2.5">
                                <span className={`text-4xl font-black tabular-nums tracking-tight ${padValue ? 'text-stone-900 dark:text-white' : 'text-stone-300 dark:text-zinc-600'}`}>
                                    {padValue || '0'}
                                </span>
                                <span className="text-xs font-bold text-stone-500 pb-0.5 self-end mb-3">{padUnit}</span>
                            </div>

                            {/* Bàn phím số */}
                            <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map(k => (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => handlePadKey(k)}
                                        onContextMenu={e => { if (k === 'del') { e.preventDefault(); handlePadKey('clear') } }}
                                        className={`h-12 rounded-xl text-xl font-bold active:scale-95 transition select-none ${
                                            k === 'del'
                                                ? 'bg-stone-200 dark:bg-zinc-700 text-stone-700 dark:text-stone-200 text-base'
                                                : 'bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-white'
                                        }`}
                                    >
                                        {k === 'del' ? '⌫' : k === '.' ? ',' : k}
                                    </button>
                                ))}
                            </div>

                            {/* 2 nút chốt: Xuất | Nhập */}
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    disabled={!canSave}
                                    onClick={() => handlePadConfirm('out')}
                                    className="h-14 rounded-2xl bg-rose-600 text-white font-black active:scale-95 transition disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 flex flex-col items-center justify-center leading-tight"
                                >
                                    <span className="text-sm flex items-center gap-1"><ArrowUpRight className="w-4 h-4" /> XUẤT</span>
                                    {qtyNum > 0 && <span className="text-[11px] font-semibold opacity-90">-{padValue} {padUnit}</span>}
                                </button>
                                <button
                                    type="button"
                                    disabled={!canSave}
                                    onClick={() => handlePadConfirm('in')}
                                    className="h-14 rounded-2xl bg-emerald-600 text-white font-black active:scale-95 transition disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 flex flex-col items-center justify-center leading-tight"
                                >
                                    <span className="text-sm flex items-center gap-1"><ArrowDownLeft className="w-4 h-4" /> NHẬP</span>
                                    {qtyNum > 0 && <span className="text-[11px] font-semibold opacity-90">+{padValue} {padUnit}</span>}
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm(`Bỏ ghim "${padProduct.name}" khỏi công việc này?`)) {
                                        handleUnpinProduct(padProduct.id)
                                        setPadProduct(null)
                                    }
                                }}
                                className="w-full mt-1.5 h-8 text-[11px] text-stone-400 flex items-center justify-center gap-1"
                            >
                                <PinOff className="w-3 h-3" /> Bỏ ghim sản phẩm này
                            </button>
                        </div>
                    </div>
                )
            })()}

            {/* ===== MOBILE: SHEET CHỌN CÔNG VIỆC ===== */}
            {mobileJobSheet && (
                <div className="sm:hidden fixed inset-0 z-[60] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setMobileJobSheet(false)} />
                    <div className="relative bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-8 duration-200">
                        <div className="w-9 h-1 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-2.5" />
                        <h3 className="text-xs font-bold text-stone-500 mb-2 px-1">Chọn công việc</h3>
                        <div className="flex-1 overflow-y-auto space-y-1.5">
                            {openShifts.map((shift, idx) => {
                                const isSelected = activeShift?.id === shift.id
                                const title = shift.summary_data?.job_name || shift.notes || `Công việc ${idx + 1}`
                                return (
                                    <div key={shift.id} className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (activeShift?.id !== shift.id) {
                                                    setPinnedProducts([])
                                                    setAllJobJournals([])
                                                    setJournalList([])
                                                    setSubShifts([])
                                                    setPadProduct(null)
                                                    setDraftQtyMap({})
                                                }
                                                setSelectedShiftId(shift.id);
                                                setMobileJobSheet(false);
                                            }}
                                            className={`flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border transition ${
                                                isSelected
                                                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-800'
                                                    : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-800'
                                            }`}
                                        >
                                            <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-stone-300'}`}>
                                                {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-xs font-bold text-stone-900 dark:text-white leading-snug">{title}</span>
                                                <span className="block text-[10px] text-stone-400">Mở lúc {formatTimeOnly(shift.opened_at)}</span>
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleDeleteOpenShift(shift.id, title)
                                            }}
                                            title={`Xóa "${title}"`}
                                            className="w-10 h-10 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => { setMobileJobSheet(false); handleOpenCreateShiftModal(); }}
                            className="mt-2.5 h-10 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5" /> Thêm công việc mới
                        </button>
                    </div>
                </div>
            )}

            {/* ===== MOBILE: MENU THAO TÁC ===== */}
            {mobileMenu && (
                <div className="sm:hidden fixed inset-0 z-[60] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenu(false)} />
                    <div className="relative bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-8 duration-200">
                        <div className="w-9 h-1 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-2.5" />
                        {activeShift && (
                            <p className="text-[11px] text-stone-500 px-1 mb-1.5">
                                <strong className="text-stone-800 dark:text-stone-200">{currentJobName}</strong> • mở lúc {formatTimeOnly(activeShift.opened_at)}
                                {subShifts.length > 0 && ` • ${subShifts.length} lần chốt tạm`}
                            </p>
                        )}
                        <div className="divide-y divide-stone-100 dark:divide-zinc-800">
                            {activeShift && (
                                <>
                                    <button
                                        type="button"
                                        onClick={async () => { setMobileMenu(false); await calculateInterimSummary(); setInterimCloseModal(true) }}
                                        className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold"
                                    >
                                        <CheckCircle2 className="w-4 h-4 text-amber-500" /> Chốt tạm (Đợt {subShifts.length + 1})
                                    </button>
                                    {subShifts.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => { setMobileMenu(false); setShowSubShiftsPanel(true) }}
                                            className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold"
                                        >
                                            <Layers className="w-4 h-4 text-indigo-500" /> Xem các đợt chốt tạm
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={async () => { setMobileMenu(false); setCloseOrderTypeId(activeShift?.summary_data?.order_type_id || ''); await calculateShiftSummary(activeShift.opened_at); setCloseShiftModal(true) }}
                                        className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold text-rose-600"
                                    >
                                        <StopCircle className="w-4 h-4" /> Hoàn thành công việc
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMobileMenu(false)
                                            handleDeleteOpenShift(activeShift.id, currentJobName)
                                        }}
                                        className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold text-rose-600"
                                    >
                                        <Trash2 className="w-4 h-4 text-rose-600" /> Xóa công việc này
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => { setMobileMenu(false); openDoneView() }}
                                className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold"
                            >
                                <History className="w-4 h-4 text-stone-500" /> Xem công việc đã hoàn thành ({pastShifts.length})
                            </button>
                            <Link
                                href="/so-lieu/mau-cong-viec"
                                onClick={() => setMobileMenu(false)}
                                className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                            >
                                <Briefcase className="w-4 h-4" /> Quản lý công việc mẫu
                            </Link>
                            <button
                                type="button"
                                onClick={() => { setMobileMenu(false); loadJournalData() }}
                                className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold"
                            >
                                <RefreshCw className="w-4 h-4 text-stone-500" /> Tải lại số liệu
                            </button>
                            {pinnedProducts.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMobileMenu(false)
                                        if (confirm(`Bỏ ghim toàn bộ sản phẩm của "${currentJobName}"?`)) updatePinnedProducts([])
                                    }}
                                    className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold text-stone-400"
                                >
                                    <Trash2 className="w-4 h-4" /> Xóa hết ghim ({pinnedProducts.length})
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== THÔNG BÁO XÁC NHẬN ĐÃ LƯU ===== */}
            {toast && (
                <div className="fixed left-3 right-3 sm:left-auto sm:right-6 sm:w-96 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[70] pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <div className={`px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl shadow-xl text-white text-xs sm:text-sm font-bold flex items-center gap-2 ${
                        toast.type === 'in' ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}>
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                        <span className="leading-snug">{toast.text}</span>
                    </div>
                </div>
            )}

            {/* ===== MODAL LÀM PHIẾU NHẬP KẾT TOÁN CHO CÔNG VIỆC ===== */}
            {isInboundModalOpen && (
                <InboundOrderModal
                    isOpen={isInboundModalOpen}
                    onClose={() => { setIsInboundModalOpen(false); setInboundInitialData(null); }}
                    onSuccess={(id) => handleInboundSettlementSuccess(id)}
                    initialData={inboundInitialData}
                    systemCode={currentSystem?.code || 'COLD'}
                />
            )}

            {/* ===== MODAL LÀM PHIẾU XUẤT KẾT TOÁN CHO CÔNG VIỆC ===== */}
            {isOutboundModalOpen && (
                <OutboundOrderModal
                    isOpen={isOutboundModalOpen}
                    onClose={() => { setIsOutboundModalOpen(false); setOutboundInitialData(null); }}
                    onSuccess={(id) => handleOutboundSettlementSuccess(id)}
                    initialData={outboundInitialData}
                    systemCode={currentSystem?.code || 'COLD'}
                />
            )}

            {/* ===== MODAL XÁC NHẬN XÓA CÔNG VIỆC (ĐẸP MẮT & ĐỒNG BỘ UI) ===== */}
            {deleteTargetShift && (
                <div 
                    className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
                    onClick={() => { if (!isDeletingShift) setDeleteTargetShift(null) }}
                >
                    <div 
                        className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Thanh handle bar vuốt chạm trên Mobile */}
                        <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />
                        
                        <div className="flex items-start gap-3.5 mb-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/50">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-base text-stone-900 dark:text-white leading-snug">
                                    Xác nhận xóa công việc?
                                </h3>
                                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed break-words">
                                    Bạn có chắc chắn muốn xóa công việc <strong className="text-stone-800 dark:text-stone-200 font-bold">"{deleteTargetShift.title}"</strong> không?
                                </p>
                            </div>
                        </div>

                        {deleteTargetShift.recordCount > 0 && (
                            <div className="p-3 mb-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                                <span className="leading-relaxed">
                                    Công việc này đang có <strong className="font-bold text-amber-900 dark:text-amber-200">{deleteTargetShift.recordCount} đợt số liệu</strong> đã ghi nhận. Khi xóa, toàn bộ số liệu của công việc này sẽ bị xóa vĩnh viễn khỏi hệ thống!
                                </span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-stone-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={() => setDeleteTargetShift(null)}
                                disabled={isDeletingShift}
                                className="h-10 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl transition disabled:opacity-50"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteShift}
                                disabled={isDeletingShift}
                                className="h-10 text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                                {isDeletingShift ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Đang xóa...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Xác Nhận Xóa</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL LỊCH SỬ NHẬP XUẤT RIÊNG CHO SẢN PHẨM ===== */}
            {historyModalProduct && (() => {
                const baseLines = allJobJournals.length > 0 ? allJobJournals : journalList
                // Lọc các đợt phát sinh của riêng sản phẩm này
                const productLines = baseLines.filter(l => 
                    l.item_name === historyModalProduct.name || 
                    (l.notes && l.notes.includes(historyModalProduct.id))
                )

                // Tính các ĐVT có số liệu của sản phẩm này
                const units = getProductUnits(historyModalProduct)
                const activeUnits = units.filter(u => {
                    const s = getProductCount(historyModalProduct.name, u)
                    return s.inQty > 0 || s.outQty > 0
                })
                const displayUnits = activeUnits.length > 0 ? activeUnits : [historyModalProduct.unit || 'Kg']

                // Lọc theo tab (Tất cả / Nhập / Xuất)
                const inLines = productLines.filter(l => l.to_department === 'Kho')
                const outLines = productLines.filter(l => l.to_department !== 'Kho')
                const filtered = historyProductFilter === 'in' 
                    ? inLines 
                    : historyProductFilter === 'out' 
                    ? outLines 
                    : productLines

                return (
                    <div 
                        className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
                        onClick={() => setHistoryModalProduct(null)}
                    >
                        <div 
                            className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Handle bar vuốt chạm mobile */}
                            <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                            {/* Header modal */}
                            <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200 dark:border-zinc-800 shrink-0">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-0.5">
                                        <Eye className="w-3.5 h-3.5" /> Lịch sử nhập xuất sản phẩm
                                    </div>
                                    <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white leading-snug break-words">
                                        {historyModalProduct.name}
                                    </h3>
                                    {historyModalProduct.sku && (
                                        <p className="text-[11px] text-stone-400 font-mono mt-0.5">SKU: {historyModalProduct.sku}</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setHistoryModalProduct(null)}
                                    className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center justify-center transition shrink-0"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Tổng hợp số lượng theo các ĐVT */}
                            <div className="py-2.5 px-3 bg-stone-50 dark:bg-zinc-800/50 rounded-xl my-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                                <span className="font-bold text-stone-500 dark:text-stone-400">Tổng đã phát sinh:</span>
                                <div className="flex flex-wrap gap-2">
                                    {displayUnits.map(u => {
                                        const s = getProductCount(historyModalProduct.name, u)
                                        return (
                                            <div key={u} className="flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-zinc-900 rounded-lg border border-stone-200 dark:border-zinc-700 font-bold">
                                                <span className="text-stone-600 dark:text-stone-300">{u}:</span>
                                                <span className="text-emerald-600 dark:text-emerald-400">+{s.inQty}</span>
                                                <span className="text-stone-300 dark:text-zinc-600">/</span>
                                                <span className="text-rose-600 dark:text-rose-400">-{s.outQty}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Bộ lọc Tất cả / Nhập / Xuất */}
                            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-zinc-800/80 rounded-xl mb-2.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setHistoryProductFilter('all')}
                                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition ${
                                        historyProductFilter === 'all'
                                            ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                                    }`}
                                >
                                    Tất cả ({productLines.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHistoryProductFilter('in')}
                                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                                        historyProductFilter === 'in'
                                            ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                                            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                                    }`}
                                >
                                    <ArrowDownLeft className="w-3.5 h-3.5" /> Nhập ({inLines.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHistoryProductFilter('out')}
                                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                                        historyProductFilter === 'out'
                                            ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-2xs'
                                            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                                    }`}
                                >
                                    <ArrowUpRight className="w-3.5 h-3.5" /> Xuất ({outLines.length})
                                </button>
                            </div>

                            {/* Danh sách các đợt phát sinh */}
                            <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800 -mx-4 sm:-mx-6 px-4 sm:px-6">
                                {filtered.length === 0 ? (
                                    <div className="py-10 text-center text-xs text-stone-400">
                                        Chưa có đợt nhập/xuất nào cho sản phẩm này.
                                    </div>
                                ) : (
                                    filtered.map(record => {
                                        const isImport = record.to_department === 'Kho'
                                        const userNote = cleanUserNotes(record.notes)
                                        return (
                                            <div
                                                key={record.id}
                                                className="py-2.5 flex items-start gap-2.5 hover:bg-stone-50 dark:hover:bg-zinc-800/40 text-xs transition"
                                            >
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold shrink-0 mt-0.5 ${
                                                    isImport
                                                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                                        : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                                                }`}>
                                                    {isImport ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                                </div>

                                                <div className="min-w-0 flex-1 space-y-0.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className={`px-2 py-0.5 rounded-md font-black text-xs tabular-nums ${
                                                            isImport
                                                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                                                        }`}>
                                                            {isImport ? `+${record.quantity_sent}` : `-${record.quantity_sent}`} {record.unit}
                                                        </span>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setHistoryModalProduct(null)
                                                                    handleStartEdit(record)
                                                                }}
                                                                title="Chỉnh sửa đợt này"
                                                                className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-indigo-50 dark:bg-zinc-800 text-stone-500 hover:text-indigo-600 flex items-center justify-center"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteJournal(record.id)}
                                                                title="Xóa đợt này"
                                                                className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-rose-50 dark:bg-zinc-800 text-stone-500 hover:text-rose-600 flex items-center justify-center"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="text-[11px] text-stone-400 flex items-center gap-1.5 flex-wrap">
                                                        <span>{formatDateTime(record.sent_at)}</span>
                                                        <span>•</span>
                                                        <span>{record.sent_by_name || 'Nhân viên'}</span>
                                                        {userNote && <span className="text-stone-600 dark:text-stone-300 font-medium">💬 {userNote}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            {/* Nút đóng ở dưới */}
                            <div className="pt-3 border-t border-stone-200 dark:border-zinc-800 mt-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setHistoryModalProduct(null)}
                                    className="w-full h-9 rounded-xl bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-200 text-xs font-bold transition"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
