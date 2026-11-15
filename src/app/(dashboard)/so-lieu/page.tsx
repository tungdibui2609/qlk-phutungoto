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
    Square,
    Camera,
    Images
} from 'lucide-react'

import Link from 'next/link'
import EditJournalModal from '@/components/so-lieu/EditJournalModal'
import ProductHistoryModal from '@/components/so-lieu/ProductHistoryModal'
import FeedTab from '@/components/so-lieu/FeedTab'
import SummaryTab from '@/components/so-lieu/SummaryTab'
import ShiftModals from '@/components/so-lieu/ShiftModals'
import ReconcileTab, { type ReconcileEntry } from '@/components/so-lieu/ReconcileTab'
import InboundOrderModal from '@/components/inventory/inbound/InboundOrderModal'
import OutboundOrderModal from '@/components/inventory/outbound/OutboundOrderModal'
import OperationImageUploader from '@/components/so-lieu/OperationImageUploader'
import OperationImagesModal, { WebJournalImageTarget } from '@/components/so-lieu/OperationImagesModal'
import DesktopNumpad from '@/components/so-lieu/DesktopNumpad'
import MobileNumpadSheet from '@/components/so-lieu/MobileNumpadSheet'
import PastShiftsHistoryModal from '@/components/so-lieu/PastShiftsHistoryModal'
import DeleteShiftModal from '@/components/so-lieu/DeleteShiftModal'
import { MobileJobSheet, MobileMenuSheet } from '@/components/so-lieu/MobileSheets'
import AggregatedReportView from '@/components/so-lieu/AggregatedReportView'
import PinnedProductsPanel from '@/components/so-lieu/PinnedProductsPanel'
import DoneJobsView from '@/components/so-lieu/DoneJobsView'
import { exportDoneShiftToExcel, exportMultiShiftsToExcel } from '@/components/so-lieu/excelExport'
import {
    ProductItem,
    OrderTypeItem,
    DeliveryJournalRecord,
} from '@/components/so-lieu/types'
import {
    formatDateTimeLocal,
    cleanUnitLabel,
    isBoxUnit,
    cleanUserNotes,
    formatDateTime,
    formatTimeOnly,
    formatCompactRange,
} from '@/components/so-lieu/utils'
import {
    PendingWebImage,
    OperationImageRecord,
    generateUuidV4,
    uploadOperationImages,
    listOperationImages,
    getOperationImageDisplayUrl,
} from '@/lib/operationImages'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { supabase } from '@/lib/supabaseClient'
import { matchSearch, calculateSearchScore } from '@/lib/searchUtils'
import { normalizeUnit, formatUnitWeight } from '@/lib/unitConversion'
import { getJobTemplates, JobTemplate } from '@/lib/jobTemplates'

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
    const [padImages, setPadImages] = useState<PendingWebImage[]>([])
    const [interimImages, setInterimImages] = useState<PendingWebImage[]>([])
    const [closeImages, setCloseImages] = useState<PendingWebImage[]>([])
    const [imagesModalOpen, setImagesModalOpen] = useState(false)
    const [imageJournalTarget, setImageJournalTarget] = useState<WebJournalImageTarget | null>(null)
    const [shiftImageCount, setShiftImageCount] = useState(0)
    const [journalImageCounts, setJournalImageCounts] = useState<Record<string, number>>({})
    const [reconcileImagesMap, setReconcileImagesMap] = useState<Record<string, { start: OperationImageRecord[]; end: OperationImageRecord[] }>>({})
    const [uploadingReconcileKey, setUploadingReconcileKey] = useState<string | null>(null)

    const refreshShiftImageCounts = useCallback(async (targetShiftId?: string | null) => {
        const sId = targetShiftId || activeShift?.id
        if (!sId || !currentSystem?.code || String(sId).startsWith('offline_')) {
            setShiftImageCount(0)
            setJournalImageCounts({})
            setReconcileImagesMap({})
            return
        }
        try {
            const list = await listOperationImages({
                systemCode: currentSystem.code,
                companyId: currentSystem?.company_id || profile?.company_id || null,
                shiftId: sId,
                limit: 300,
            })
            setShiftImageCount(list.length)
            const map: Record<string, number> = {}
            const refMap: Record<string, { start: OperationImageRecord[]; end: OperationImageRecord[] }> = {}
            for (const img of list) {
                if (img.journal_id) {
                    map[img.journal_id] = (map[img.journal_id] || 0) + 1
                }
                const m = img.notes?.match(/^\[THAM_CHIEU:([^\]:]+)(?::(start|end))?\]/)
                if (m && m[1]) {
                    const k = m[1]
                    const phase = m[2] === 'end' ? 'end' : 'start'
                    if (!refMap[k]) refMap[k] = { start: [], end: [] }
                    refMap[k][phase].push(img)
                }
            }
            setJournalImageCounts(map)
            setReconcileImagesMap(refMap)
        } catch {
            // ignore
        }
    }, [activeShift?.id, currentSystem?.code, currentSystem?.company_id, profile?.company_id])

    useEffect(() => {
        refreshShiftImageCounts(activeShift?.id)
    }, [refreshShiftImageCounts, activeShift?.id])
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
    const [activeTab, setActiveTab] = useState<'feed' | 'summary' | 'reconcile'>('feed')
    const [reconcileMap, setReconcileMap] = useState<Record<string, ReconcileEntry>>({})
    const [savingReconcile, setSavingReconcile] = useState(false)
    const [expandedReconcileKeys, setExpandedReconcileKeys] = useState<Record<string, boolean>>({})

    useEffect(() => {
        if (!activeShift?.id) {
            setReconcileMap({})
            return
        }
        const fromShift = activeShift?.summary_data?.reconciliations
        if (fromShift && typeof fromShift === 'object') {
            setReconcileMap(fromShift)
            return
        }
        try {
            const cached = localStorage.getItem(`op_reconcile_${activeShift.id}`)
            setReconcileMap(cached ? JSON.parse(cached) : {})
        } catch {
            setReconcileMap({})
        }
    }, [activeShift?.id])

    const handleSaveReconcile = async () => {
        if (!activeShift?.id) return
        setSavingReconcile(true)
        try {
            try {
                localStorage.setItem(`op_reconcile_${activeShift.id}`, JSON.stringify(reconcileMap))
            } catch {
                // ignore storage quota
            }
            const nextSummary = { ...(activeShift.summary_data || {}), reconciliations: reconcileMap }
            if (!String(activeShift.id).startsWith('offline_')) {
                const { error } = await (supabase as any)
                    .from('delivery_shifts')
                    .update({ summary_data: nextSummary })
                    .eq('id', activeShift.id)
                if (error) throw error
                setOpenShifts((prev: any[]) => prev.map(s => (s.id === activeShift.id ? { ...s, summary_data: nextSummary } : s)))
            }
            showToast('Đã lưu dữ liệu tham chiếu!', 'in')
        } catch (err: any) {
            alert('Lỗi lưu tham chiếu: ' + (err?.message || err))
        } finally {
            setSavingReconcile(false)
        }
    }

    const handleUploadReconcileImages = async (
        reconcileKey: string,
        phase: 'start' | 'end',
        itemName: string,
        unit: string,
        fileList: FileList | null
    ) => {
        if (!fileList || fileList.length === 0 || !activeShift?.id || !currentSystem?.code) return
        setUploadingReconcileKey(`${reconcileKey}:${phase}`)
        try {
            await uploadOperationImages({
                systemCode: currentSystem.code,
                companyId: currentSystem?.company_id || profile?.company_id || null,
                shiftId: activeShift.id,
                jobName: activeShift.summary_data?.job_name || activeShift.notes || '',
                scope: 'shift',
                itemName: reconcileKey === '__TOTAL__' ? 'Tham chiếu tổng' : itemName,
                unit,
                notes: `[THAM_CHIEU:${reconcileKey}:${phase}]`,
                files: Array.from(fileList),
                capturedBy: profile?.id || null,
                capturedByName: profile?.full_name || null,
            })
            await refreshShiftImageCounts(activeShift.id)
            showToast(`Đã tải lên ${fileList.length} ảnh tham chiếu ${phase === 'start' ? 'đầu' : 'cuối'}!`, 'in')
        } catch (err: any) {
            alert('Lỗi tải ảnh tham chiếu: ' + (err?.message || err))
        } finally {
            setUploadingReconcileKey(null)
        }
    }
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
    const [historyModalTab, setHistoryModalTab] = useState<'history' | 'images'>('history')
    const [historyProductImages, setHistoryProductImages] = useState<OperationImageRecord[]>([])
    const [historyImagesLoading, setHistoryImagesLoading] = useState(false)
    const [previewHistoryImage, setPreviewHistoryImage] = useState<OperationImageRecord | null>(null)

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
        await exportDoneShiftToExcel({
            systemName: currentSystem?.name || '',
            shift,
            lines,
            doneSubShifts,
            buildEffectiveSubShifts,
            summarizeLines,
        })
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
        await exportMultiShiftsToExcel({
            systemName: currentSystem?.name || '',
            reportTitle,
            shifts,
            lines,
            fileName,
            aggregateShiftsProducts,
        })
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

    useEffect(() => {
        if (!historyModalProduct) {
            setHistoryProductImages([])
            setPreviewHistoryImage(null)
            return
        }
        setHistoryModalTab('history')
        setPreviewHistoryImage(null)
        const targetShiftId = pageView === 'done' ? doneSelectedShift?.id : activeShift?.id
        if (!targetShiftId || !currentSystem?.code || String(targetShiftId).startsWith('offline_')) {
            setHistoryProductImages([])
            return
        }
        setHistoryImagesLoading(true)
        listOperationImages({
            systemCode: currentSystem.code,
            companyId: currentSystem?.company_id || profile?.company_id || null,
            shiftId: targetShiftId,
            limit: 200,
        })
            .then((list) => {
                const pSku = (historyModalProduct.sku || '').trim().toLowerCase()
                const pName = (historyModalProduct.name || '').trim().toLowerCase()
                const matched = list.filter((img) => {
                    const iSku = (img.item_sku || '').trim().toLowerCase()
                    const iName = (img.item_name || '').trim().toLowerCase()
                    if (pSku && iSku && pSku === iSku) return true
                    if (pName && iName && pName === iName) return true
                    return false
                })
                setHistoryProductImages(matched)
            })
            .catch(() => setHistoryProductImages([]))
            .finally(() => setHistoryImagesLoading(false))
    }, [historyModalProduct, pageView, doneSelectedShift?.id, activeShift?.id, currentSystem?.code, currentSystem?.company_id, profile?.company_id])

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
        unitOverride?: string,
        extraNote?: string
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
        const clientJournalId = generateUuidV4()

        const payload = {
            id: clientJournalId,
            system_code: shiftSystemCode,
            company_id: companyId,
            delivery_code: batchCode,
            item_name: product.name,
            quantity_sent: qty,
            unit: currentUnit,
            from_department: isImport ? 'Sản xuất' : 'Kho',
            to_department: isImport ? 'Kho' : 'Sản xuất',
            status: isImport ? 'received_by_warehouse' : 'received_by_production',
            notes: `[CV_ID: ${activeShift.id}] [PID: ${product.id}] [SKU: ${product.sku || ''}] [CV: ${currentJobName}] [${batchCode}] ${isImport ? 'Nhập kho' : 'Xuất kho'}${extraNote ? ` | ${extraNote}` : ''}`,

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

            if (padImages.length > 0 && currentSystem?.code) {
                const filesToUpload = padImages.map(p => p.file)
                setPadImages([])
                uploadOperationImages({
                    files: filesToUpload,
                    systemCode: currentSystem.code,
                    companyId,
                    shiftId: activeShift.id,
                    journalId: clientJournalId,
                    scope: 'journal',
                    direction: type,
                    jobName: currentJobName,
                    itemName: product.name,
                    itemSku: product?.sku || null,
                    quantity: qty,
                    unit: currentUnit,
                    capturedBy: profile?.id || null,
                    capturedByName: profile?.full_name || 'Nhân viên',
                })
                    .then((uploaded) => {
                        if (uploaded.length > 0) setShiftImageCount(c => c + uploaded.length)
                    })
                    .catch(e => console.warn('Upload journal images error:', e))
            }

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
                setReconcileMap({})
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
            setReconcileMap({})
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
            const { data: insertedSub, error } = await (supabase as any)
                .from('delivery_sub_shifts')
                .insert([payload])
                .select('id')
                .single()
            if (error) throw error
            if (interimImages.length > 0 && currentSystem?.code) {
                const filesToUpload = interimImages.map(p => p.file)
                setInterimImages([])
                await uploadOperationImages({
                    files: filesToUpload,
                    systemCode: currentSystem.code,
                    companyId: currentSystem?.company_id || profile?.company_id || null,
                    shiftId: activeShift.id,
                    subShiftId: insertedSub?.id || null,
                    scope: 'sub_shift',
                    jobName: currentJobName,
                    capturedBy: profile?.id || null,
                    capturedByName: profile?.full_name || 'Nhân viên kho',
                    notes: interimNotes || `Chốt tạm đợt ${subShifts.length + 1}`,
                }).catch(e => console.warn('Upload interim images error:', e))
                setShiftImageCount(c => c + filesToUpload.length)
            }
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

            if (closeImages.length > 0 && currentSystem?.code) {
                const filesToUpload = closeImages.map(p => p.file)
                setCloseImages([])
                await uploadOperationImages({
                    files: filesToUpload,
                    systemCode: currentSystem.code,
                    companyId: currentSystem?.company_id || profile?.company_id || null,
                    shiftId: closedJobId,
                    scope: 'shift',
                    jobName: currentJobName,
                    capturedBy: profile?.id || null,
                    capturedByName: profile?.full_name || 'Nhân viên kho',
                    notes: closeNotes || 'Ảnh hoàn thành công việc',
                }).catch(e => console.warn('Upload close images error:', e))
            }

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

    // Render bảng Báo cáo tổng hợp gộp nhiều công việc (Dùng cho cả Báo cáo theo ngày & Báo cáo tùy chọn)
    const renderAggregatedReportView = (
        title: string,
        shifts: any[],
        lines: DeliveryJournalRecord[],
        loading: boolean,
        onExport: () => void,
        exportButtonText: string
    ) => (
        <AggregatedReportView
            title={title}
            systemName={currentSystem?.name || ''}
            shifts={shifts}
            lines={lines}
            loading={loading}
            onExport={onExport}
            exportButtonText={exportButtonText}
            aggregateShiftsProducts={aggregateShiftsProducts}
            summarizeLines={summarizeLines}
            findProductSku={findProductSku}
            getShiftLocalDateString={getShiftLocalDateString}
            expandedShiftIdsInReport={expandedShiftIdsInReport}
            setExpandedShiftIdsInReport={setExpandedShiftIdsInReport}
            onOpenSingleShift={(s) => {
                selectDoneShift(s)
                setDoneViewMode('single')
            }}
        />
    )

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
                                        onClick={() => setImagesModalOpen(true)}
                                        className="h-8 px-2.5 rounded-lg text-xs font-semibold border border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300 flex items-center gap-1 transition"
                                        title="Xem & chụp ảnh chứng minh của công việc"
                                    >
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>Ảnh{shiftImageCount > 0 ? ` (${shiftImageCount})` : ''}</span>
                                    </button>
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

                            {/* Cụm công cụ: Album ảnh + Mẫu CV + Reload */}
                            <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-stone-200 dark:border-zinc-700">
                                <Link
                                    href="/so-lieu/album-anh"
                                    className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition"
                                    title="Quản lý Album hình ảnh nhập xuất"
                                >
                                    <Images className="w-3.5 h-3.5 text-sky-500" />
                                    <span>Album ảnh</span>
                                </Link>
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
                    <DoneJobsView
                        doneViewMode={doneViewMode}
                        setDoneViewMode={setDoneViewMode}
                        availableDates={availableDates}
                        shiftsOnSelectedDate={shiftsOnSelectedDate}
                        setByDateRange={setByDateRange}
                        byDateRange={byDateRange}
                        setByDateMultiDates={setByDateMultiDates}
                        byDateMultiDates={byDateMultiDates}
                        byDateFilterType={byDateFilterType}
                        setByDateFilterType={setByDateFilterType}
                        byDateCustomAddInput={byDateCustomAddInput}
                        setByDateCustomAddInput={setByDateCustomAddInput}
                        byDateReportInfo={byDateReportInfo}
                        byDateLines={byDateLines}
                        byDateLoading={byDateLoading}
                        customSelectedIds={customSelectedIds}
                        setCustomSelectedIds={setCustomSelectedIds}
                        customSelectedShifts={customSelectedShifts}
                        customLines={customLines}
                        customLoading={customLoading}
                        pastShifts={pastShifts}
                        filteredPastShifts={filteredPastShifts}
                        doneRange={doneRange}
                        setDoneRange={setDoneRange}
                        loadPastShifts={loadPastShifts}
                        doneSearch={doneSearch}
                        setDoneSearch={setDoneSearch}
                        doneListLoading={doneListLoading}
                        doneStatusFilter={doneStatusFilter}
                        setDoneStatusFilter={setDoneStatusFilter}
                        doneSelectedShift={doneSelectedShift}
                        selectDoneShift={selectDoneShift}
                        setDoneSelectedId={setDoneSelectedId}
                        doneLines={doneLines}
                        doneSubShifts={doneSubShifts}
                        doneLinesLoading={doneLinesLoading}
                        doneTab={doneTab}
                        setDoneTab={setDoneTab}
                        journalTypeFilter={journalTypeFilter}
                        setJournalTypeFilter={setJournalTypeFilter}
                        isMainSummaryExpanded={isMainSummaryExpanded}
                        setIsMainSummaryExpanded={setIsMainSummaryExpanded}
                        isTwoWayExpanded={isTwoWayExpanded}
                        setIsTwoWayExpanded={setIsTwoWayExpanded}
                        isUnitsExpanded={isUnitsExpanded}
                        setIsUnitsExpanded={setIsUnitsExpanded}
                        isProductsExpanded={isProductsExpanded}
                        setIsProductsExpanded={setIsProductsExpanded}
                        isDoneSubShiftsSectionExpanded={isDoneSubShiftsSectionExpanded}
                        setIsDoneSubShiftsSectionExpanded={setIsDoneSubShiftsSectionExpanded}
                        isInfoExpanded={isInfoExpanded}
                        setIsInfoExpanded={setIsInfoExpanded}
                        expandedDoneSubShifts={expandedDoneSubShifts}
                        toggleExpandDoneSubShift={toggleExpandDoneSubShift}
                        byProdTimeFilter={byProdTimeFilter}
                        setByProdTimeFilter={setByProdTimeFilter}
                        byProdRange={byProdRange}
                        setByProdRange={setByProdRange}
                        shiftsForProductReport={shiftsForProductReport}
                        byProdSearch={byProdSearch}
                        setByProdSearch={setByProdSearch}
                        aggregatedProductsForReport={aggregatedProductsForReport}
                        byProdLines={byProdLines}
                        byProdLoading={byProdLoading}
                        getShiftLocalDateString={getShiftLocalDateString}
                        summarizeLines={summarizeLines}
                        buildEffectiveSubShifts={buildEffectiveSubShifts}
                        renderAggregatedReportView={renderAggregatedReportView}
                        onExportDoneShift={handleExportDoneShift}
                        onExportMultiShifts={handleExportMultiShifts}
                        onOpenImagesModal={() => setImagesModalOpen(true)}
                        onReopenShift={handleReopenShift}
                        onContinueActiveShift={(id) => {
                            setSelectedShiftId(id)
                            setPageView('active')
                        }}
                        onDeleteDoneShift={handleDeleteDoneShift}
                        onOpenInboundModal={handleOpenInboundModal}
                        onOpenOutboundModal={handleOpenOutboundModal}
                        onNavigateToSettlementPage={handleNavigateToSettlementPage}
                        onStartEdit={handleStartEdit}
                        onDeleteJournal={handleDeleteJournal}
                        onUpdateShiftOpenedAt={handleUpdateShiftOpenedAt}
                        onSelectAllCustomShifts={handleSelectAllCustomShifts}
                        onDeselectAllCustomShifts={handleDeselectAllCustomShifts}
                        onToggleSelectShift={toggleSelectShift}
                    />
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
                ) : (
                    <PinnedProductsPanel
                        currentJobName={currentJobName}
                        allProducts={allProducts}
                        pinnedProducts={pinnedProducts}
                        displayedPinnedProducts={displayedPinnedProducts}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        setSearchMode={setSearchMode}
                        selectedUnitMap={selectedUnitMap}
                        pulseEffect={pulseEffect}
                        padProduct={padProduct}
                        setPadProduct={setPadProduct}
                        padUnit={padUnit}
                        setPadUnit={setPadUnit}
                        journalList={journalList}
                        getProductUnits={getProductUnits}
                        getProductCount={getProductCount}
                        onPinProduct={handlePinProduct}
                        onUnpinProduct={handleUnpinProduct}
                        onOpenPad={openPad}
                        onUnitChange={handleUnitChange}
                        onOpenProductHistory={(product) => {
                            setHistoryModalProduct(product)
                            setHistoryProductFilter('all')
                        }}
                    />
                )}

                {/* 5. NHẬT KÝ VÀ BẢNG TỔNG HỢP CỦA CÔNG VIỆC ĐANG CHỌN */}
                {pageView === 'active' && activeShift && (
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden sm:col-start-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 dark:border-zinc-800 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-stone-50/50 dark:bg-zinc-950/50">
                            <div className="grid grid-cols-3 sm:flex sm:items-center gap-1 sm:gap-4 w-full sm:w-auto">
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
                                    <span className="sm:hidden">Báo cáo</span>
                                    <span className="hidden sm:inline">Báo cáo: {currentJobName}</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('reconcile')}
                                    className={`text-[11px] sm:text-sm font-bold flex items-center justify-center sm:justify-start gap-1.5 py-1 sm:py-0 sm:pb-1 rounded-lg sm:rounded-none sm:border-b-2 transition ${
                                        activeTab === 'reconcile'
                                            ? 'bg-amber-50/80 dark:bg-amber-950/50 sm:bg-transparent sm:border-amber-500 text-amber-600 dark:text-amber-400'
                                            : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                    }`}
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                    <span>Tham chiếu</span>
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
                        {activeTab === 'feed' && (
                            <FeedTab
                                journalTypeFilter={journalTypeFilter}
                                allJobJournals={allJobJournals}
                                journalList={journalList}
                                currentJobName={currentJobName}
                                subShifts={subShifts}
                                expandedFeedSubShifts={expandedFeedSubShifts}
                                toggleExpandFeedSubShift={toggleExpandFeedSubShift}
                                allProducts={allProducts}
                                journalImageCounts={journalImageCounts}
                                cleanUserNotes={cleanUserNotes}
                                formatDateTime={formatDateTime}
                                formatCompactRange={formatCompactRange}
                                onOpenImageModal={(target) => {
                                    setImageJournalTarget(target)
                                    setImagesModalOpen(true)
                                }}
                                onStartEdit={handleStartEdit}
                                onDeleteJournal={handleDeleteJournal}
                            />
                        )}

                        {/* Tab 2: Báo cáo chi tiết các đợt chốt tạm & Tổng hợp đối soát toàn công việc */}
                        {activeTab === 'summary' && (
                            <SummaryTab
                                allJobJournals={allJobJournals}
                                subShifts={subShifts}
                                activeShift={activeShift}
                                currentJobName={currentJobName}
                                expandedDoneSubShifts={expandedDoneSubShifts}
                                toggleExpandDoneSubShift={toggleExpandDoneSubShift}
                                isTwoWayExpanded={isTwoWayExpanded}
                                setIsTwoWayExpanded={setIsTwoWayExpanded}
                                isUnitsExpanded={isUnitsExpanded}
                                setIsUnitsExpanded={setIsUnitsExpanded}
                                isProductsExpanded={isProductsExpanded}
                                setIsProductsExpanded={setIsProductsExpanded}
                                buildEffectiveSubShifts={buildEffectiveSubShifts}
                                summarizeLines={summarizeLines}
                                formatDateTime={formatDateTime}
                                formatCompactRange={formatCompactRange}
                            />
                        )}

                        {/* Tab 3: Dữ liệu Đối Chiếu / Tham chiếu (Số đầu - Số đuôi) */}
                        {activeTab === 'reconcile' && (
                            <ReconcileTab
                                summarizedRows={summarizeLines([...(allJobJournals.length > 0 ? allJobJournals : journalList)].sort((a, b) => a.sent_at.localeCompare(b.sent_at)))}
                                pinnedProducts={pinnedProducts}
                                getProductUnits={getProductUnits}
                                reconcileMap={reconcileMap}
                                setReconcileMap={setReconcileMap}
                                reconcileImagesMap={reconcileImagesMap}
                                uploadingReconcileKey={uploadingReconcileKey}
                                savingReconcile={savingReconcile}
                                expandedReconcileKeys={expandedReconcileKeys}
                                setExpandedReconcileKeys={setExpandedReconcileKeys}
                                onSaveReconcile={handleSaveReconcile}
                                onUploadReconcileImages={handleUploadReconcileImages}
                                onPreviewImage={setPreviewHistoryImage}
                            />
                        )}
                    </div>
                )}

                {/* ===== DESKTOP: BẢNG NHẬP SỐ CỐ ĐỊNH BÊN PHẢI (VỪA KHÍT TẦM MẮT, BÀN PHÍM RỘNG RÃI DỄ BẤM) ===== */}
                {pageView === 'active' && activeShift && pinnedProducts.length > 0 && (
                    <DesktopNumpad
                        padProduct={padProduct}
                        padUnit={padUnit}
                        setPadUnit={setPadUnit}
                        padValue={padValue}
                        setPadValue={setPadValue}
                        padSaving={padSaving}
                        getProductUnits={getProductUnits}
                        getProductCount={getProductCount}
                        onUnitChange={handleUnitChange}
                        onPadKey={handlePadKey}
                        onPadConfirm={handlePadConfirm}
                    />
                )}
            </main>

            {/* 6-9. MODALS MỞ CA / CHỐT TẠM / ĐÓNG CA / LỊCH SỬ CHỐT TẠM */}
            <ShiftModals
                openShifts={openShifts}
                currentJobName={currentJobName}
                orderTypes={orderTypes}
                subShifts={subShifts}
                profile={profile}
                formatDateTime={formatDateTime}
                formatDateTimeLocal={formatDateTimeLocal}
                openShiftModal={openShiftModal}
                setOpenShiftModal={setOpenShiftModal}
                jobNameInput={jobNameInput}
                setJobNameInput={setJobNameInput}
                jobTemplatesList={jobTemplatesList}
                selectedJobTemplate={selectedJobTemplate}
                setSelectedJobTemplate={setSelectedJobTemplate}
                jobNotesInput={jobNotesInput}
                setJobNotesInput={setJobNotesInput}
                jobOrderTypeId={jobOrderTypeId}
                setJobOrderTypeId={setJobOrderTypeId}
                jobOpenedAtInput={jobOpenedAtInput}
                setJobOpenedAtInput={setJobOpenedAtInput}
                handleOpenShift={handleOpenShift}
                interimCloseModal={interimCloseModal}
                setInterimCloseModal={setInterimCloseModal}
                interimSummary={interimSummary}
                interimNotes={interimNotes}
                setInterimNotes={setInterimNotes}
                handleInterimClose={handleInterimClose}
                closeShiftModal={closeShiftModal}
                setCloseShiftModal={setCloseShiftModal}
                shiftSummary={shiftSummary}
                closeTimeInput={closeTimeInput}
                setCloseTimeInput={setCloseTimeInput}
                closeOrderTypeId={closeOrderTypeId}
                setCloseOrderTypeId={setCloseOrderTypeId}
                closeNotes={closeNotes}
                setCloseNotes={setCloseNotes}
                handleCloseShift={handleCloseShift}
                showSubShiftsPanel={showSubShiftsPanel}
                setShowSubShiftsPanel={setShowSubShiftsPanel}
            />
            {/* 10. MODAL XEM LỊCH SỬ TẤT CẢ CÁC CÔNG VIỆC ĐÃ HOÀN THÀNH */}
            <PastShiftsHistoryModal
                isOpen={showHistoryModal}
                pastShifts={pastShifts}
                formatDateTime={formatDateTime}
                formatTimeOnly={formatTimeOnly}
                onClose={() => setShowHistoryModal(false)}
            />

            {/* 11. MODAL CHỈNH SỬA TỪNG DÒNG NHẬT KÝ */}
            <EditJournalModal
                editingRecord={editingRecord}
                editType={editType}
                setEditType={setEditType}
                editQuantity={editQuantity}
                setEditQuantity={setEditQuantity}
                editUnit={editUnit}
                setEditUnit={setEditUnit}
                editNotes={editNotes}
                setEditNotes={setEditNotes}
                savingEdit={savingEdit}
                pinnedProducts={pinnedProducts}
                allProducts={allProducts}
                availableUnits={availableUnits}
                getProductUnits={getProductUnits}
                cleanUnitLabel={cleanUnitLabel}
                onClose={() => setEditingRecord(null)}
                onSave={handleSaveEdit}
            />
            {/* ===== MOBILE: BÀN PHÍM SỐ NHẬP NHANH ===== */}
            <MobileNumpadSheet
                padProduct={padProduct}
                padUnit={padUnit}
                setPadUnit={setPadUnit}
                padValue={padValue}
                padSaving={padSaving}
                getProductUnits={getProductUnits}
                getProductCount={getProductCount}
                onClose={() => setPadProduct(null)}
                onUnitChange={handleUnitChange}
                onPadKey={handlePadKey}
                onPadConfirm={handlePadConfirm}
                onUnpinProduct={handleUnpinProduct}
            />

            {/* ===== MOBILE: SHEET CHỌN CÔNG VIỆC ===== */}
            <MobileJobSheet
                isOpen={mobileJobSheet}
                openShifts={openShifts}
                activeShift={activeShift}
                formatTimeOnly={formatTimeOnly}
                onClose={() => setMobileJobSheet(false)}
                onSelectShift={(shift) => {
                    if (activeShift?.id !== shift.id) {
                        setPinnedProducts([])
                        setAllJobJournals([])
                        setJournalList([])
                        setSubShifts([])
                        setPadProduct(null)
                        setDraftQtyMap({})
                    }
                    setSelectedShiftId(shift.id)
                }}
                onDeleteShift={(shiftId, title) => handleDeleteOpenShift(shiftId, title)}
                onOpenCreateShift={handleOpenCreateShiftModal}
            />

            {/* ===== MOBILE: MENU THAO TÁC ===== */}
            <MobileMenuSheet
                isOpen={mobileMenu}
                activeShift={activeShift}
                currentJobName={currentJobName}
                subShiftsCount={subShifts.length}
                pastShiftsCount={pastShifts.length}
                pinnedProductsCount={pinnedProducts.length}
                formatTimeOnly={formatTimeOnly}
                onClose={() => setMobileMenu(false)}
                onOpenInterimClose={async () => {
                    await calculateInterimSummary()
                    setInterimCloseModal(true)
                }}
                onShowSubShifts={() => setShowSubShiftsPanel(true)}
                onOpenCloseShift={async () => {
                    setCloseOrderTypeId(activeShift?.summary_data?.order_type_id || '')
                    await calculateShiftSummary(activeShift.opened_at)
                    setCloseShiftModal(true)
                }}
                onDeleteShift={() => handleDeleteOpenShift(activeShift.id, currentJobName)}
                onOpenDoneView={openDoneView}
                onReloadData={loadJournalData}
                onClearAllPins={() => updatePinnedProducts([])}
            />

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
            <DeleteShiftModal
                targetShift={deleteTargetShift}
                isDeleting={isDeletingShift}
                onClose={() => setDeleteTargetShift(null)}
                onConfirm={confirmDeleteShift}
            />

            {/* ===== MODAL LỊCH SỬ NHẬP XUẤT RIÊNG CHO SẢN PHẨM ===== */}
            {historyModalProduct && (
                <ProductHistoryModal
                    product={historyModalProduct}
                    allJobJournals={allJobJournals}
                    journalList={journalList}
                    historyModalTab={historyModalTab}
                    setHistoryModalTab={setHistoryModalTab}
                    historyProductFilter={historyProductFilter}
                    setHistoryProductFilter={setHistoryProductFilter}
                    historyProductImages={historyProductImages}
                    historyImagesLoading={historyImagesLoading}
                    getProductUnits={getProductUnits}
                    getProductCount={getProductCount}
                    cleanUserNotes={cleanUserNotes}
                    formatDateTime={formatDateTime}
                    onClose={() => setHistoryModalProduct(null)}
                    onStartEdit={handleStartEdit}
                    onDeleteJournal={handleDeleteJournal}
                    onPreviewImage={setPreviewHistoryImage}
                />
            )}
            {previewHistoryImage && (
                <div
                    className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4"
                    onClick={() => setPreviewHistoryImage(null)}
                >
                    <img
                        src={previewHistoryImage.public_url}
                        alt={previewHistoryImage.item_name || ''}
                        className="max-w-full max-h-[85vh] rounded-2xl object-contain"
                    />
                </div>
            )}

            <OperationImagesModal
                isOpen={Boolean(imageJournalTarget)}
                onClose={() => setImageJournalTarget(null)}
                systemCode={currentSystem?.code || ''}
                companyId={currentSystem?.company_id || profile?.company_id || null}
                shiftId={(pageView === 'done' ? doneSelectedShift?.id : activeShift?.id) || ''}
                jobName={(pageView === 'done' ? (doneSelectedShift?.summary_data?.job_name || doneSelectedShift?.notes) : (activeShift?.summary_data?.job_name || activeShift?.notes)) || ''}
                userId={profile?.id || null}
                userName={profile?.full_name || null}
                journalTarget={imageJournalTarget}
            />
        </div>
    )
}
