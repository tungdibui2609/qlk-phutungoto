'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Camera,
  CloudDownload,
  CloudUpload,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  X,
  Pin,
  Eye,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Package,
  Layers,
  Calendar,
  Scale,
  Loader2,
  Image as ImageIcon,
  FolderOpen,
  Moon,
  CheckSquare,
  Square,
  BarChart3,
} from 'lucide-react'
import {
  DeliveryShift,
  DeliveryJobTemplate,
  OrderTypeOption,
  ShiftProductItem,
  JournalRecord,
  SubShiftRecord,
  ReconcileSession,
  getOpenShifts,
  getPastShifts,
  getJobTemplates,
  getOrderTypesForSystem,
  getWarehouseProducts,
  openDeliveryShift,
  updateShiftPinnedProducts,
  closeDeliveryShift,
  deleteDeliveryShift,
  getSubShifts,
  createSubShift,
  getShiftJournals,
  getMultiShiftsJournals,
  createShiftJournalEntry,
  updateShiftJournalEntry,
  deleteShiftJournalEntry,
  getShiftReconciliations,
  saveShiftReconciliations,
  clearShiftReconciliations,
  aggregateShiftsProducts,
  aggregateShiftsUnits,
  extractCleanUserNote,
  normalizeViText,
  pickDefaultProductUnit,
  getOfflineQueueCount,
  syncOperationsOfflineQueue,
  syncOperationsDataOffline,
  getActiveSystemCode,
} from './operations/operationsService'
import {
  OperationImageRecord,
  uploadOperationImages,
  getShiftOperationImages,
  syncOfflineOperationImages,
  getOperationImageDisplayUrl,
} from './operations/operationImagesService'
import {
  OperationNumberPadModal,
  OpenJobModal,
  CloseJobModal,
  InterimCloseModal,
  EditJournalModal,
  ProductHistoryModal,
  CalendarPickerModal,
  AggregatedReportModal,
  PastShiftDetailModal,
  ReconcileTabView,
  isOvernightShift,
} from './operations/OperationsModals'
import {
  OperationImagesModal,
  WarehouseAlbumModal,
  JournalImageTarget,
} from './operations/OperationsAlbumsModals'

export interface OperationsDataTabProps {
  isActive?: boolean
  systemCode?: string
  userProfile?: {
    id?: string
    fullName?: string
    email?: string
    companyId?: string | null
    companyCode?: string
    companyName?: string
    roleName?: string
  } | null
}

function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '-'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
    return `${time} ${date}`
  } catch {
    return isoString
  }
}

function toDateKey(isoString?: string | null): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

function formatDateKeyVN(dateKey: string): string {
  const parts = dateKey.split('-')
  if (parts.length !== 3) return dateKey
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export function OperationsDataTab({
  isActive = true,
  systemCode,
  userProfile,
}: OperationsDataTabProps) {
  const activeSysCode = useMemo(() => getActiveSystemCode(systemCode), [systemCode])

  const userObj = useMemo(
    () => ({
      id: userProfile?.id || null,
      full_name: userProfile?.fullName || userProfile?.email || 'Nhân viên',
      email: userProfile?.email || '',
      company_id: userProfile?.companyId || null,
    }),
    [userProfile]
  )

  // ── STATE CHÍNH ──
  const [mainTab, setMainTab] = useState<'active' | 'done'>('active')
  const [loading, setLoading] = useState(true)
  const [syncingOffline, setSyncingOffline] = useState(false)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const [openShifts, setOpenShifts] = useState<DeliveryShift[]>([])
  const [pastShifts, setPastShifts] = useState<DeliveryShift[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)
  const [showJobDropdown, setShowJobDropdown] = useState(false)

  const [allProducts, setAllProducts] = useState<ShiftProductItem[]>([])
  const [jobTemplates, setJobTemplates] = useState<DeliveryJobTemplate[]>([])
  const [orderTypes, setOrderTypes] = useState<OrderTypeOption[]>([])

  // Dữ liệu của Ca đang chọn
  const [allJournals, setAllJournals] = useState<JournalRecord[]>([])
  const [subShifts, setSubShifts] = useState<SubShiftRecord[]>([])
  const [reconcileSessions, setReconcileSessions] = useState<ReconcileSession[]>([])
  const [shiftImages, setShiftImages] = useState<OperationImageRecord[]>([])
  const [shiftImageCount, setShiftImageCount] = useState(0)

  // Tìm kiếm & Ghim SP trong tab Đang làm
  const [searchMode, setSearchMode] = useState<'filter' | 'pin'>('filter')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
  const [productDisplayLimit, setProductDisplayLimit] = useState(40)

  // Footer Báo cáo / Lịch sử / Tham chiếu trong tab Đang làm
  const [viewScope, setViewScope] = useState<'current_batch' | 'full_shift'>('current_batch')
  const [footerTab, setFooterTab] = useState<'history' | 'report' | 'reconcile'>('history')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'in' | 'out'>('all')
  const [expandedSubShiftIds, setExpandedSubShiftIds] = useState<Record<string, boolean>>({})
  const [expandRepProducts, setExpandRepProducts] = useState(true)
  const [expandRepUnits, setExpandRepUnits] = useState(true)
  const [expandRepSubShifts, setExpandRepSubShifts] = useState(false)

  // ── MODALS STATE ──
  const [numPadTarget, setNumPadTarget] = useState<{
    product: ShiftProductItem
    unit: string
  } | null>(null)
  const [openJobModalVisible, setOpenJobModalVisible] = useState(false)
  const [closeJobModalVisible, setCloseJobModalVisible] = useState(false)
  const [interimModalVisible, setInterimModalVisible] = useState(false)
  const [editJournalTarget, setEditJournalTarget] = useState<JournalRecord | null>(null)
  const [historyProductTarget, setHistoryProductTarget] = useState<ShiftProductItem | null>(null)
  const [pastDetailTarget, setPastDetailTarget] = useState<DeliveryShift | null>(null)
  const [imagesModalShift, setImagesModalShift] = useState<DeliveryShift | null>(null)
  const [imagesJournalTarget, setImagesJournalTarget] = useState<JournalImageTarget | null>(null)
  const [warehouseAlbumVisible, setWarehouseAlbumVisible] = useState(false)

  // ── STATE TAB ĐÃ HOÀN THÀNH (4 CHẾ ĐỘ: single | daily | product | custom) ──
  const [doneMode, setDoneMode] = useState<'single' | 'daily' | 'product' | 'custom'>('single')
  const [doneSearchQuery, setDoneSearchQuery] = useState('')
  const [multiShiftsJournalsCache, setMultiShiftsJournalsCache] = useState<JournalRecord[]>([])
  const [loadingMultiJournals, setLoadingMultiJournals] = useState(false)

  // Daily mode state
  const todayKey = useMemo(() => toDateKey(new Date().toISOString()), [])
  const [dailySelectType, setDailySelectType] = useState<'multi' | 'range'>('multi')
  const [selectedDailyDates, setSelectedDailyDates] = useState<string[]>([todayKey])
  const [dailyRangeStart, setDailyRangeStart] = useState<string>(todayKey)
  const [dailyRangeEnd, setDailyRangeEnd] = useState<string>(todayKey)
  const [calendarModalTarget, setCalendarModalTarget] = useState<
    'daily_multi' | 'daily_start' | 'daily_end' | 'prod_start' | 'prod_end' | null
  >(null)

  // Product report mode state
  const [prodTimePreset, setProdTimePreset] = useState<
    'today' | 'yesterday' | 'range' | '7d' | '30d' | 'all'
  >('7d')
  const [prodRangeStart, setProdRangeStart] = useState<string>(todayKey)
  const [prodRangeEnd, setProdRangeEnd] = useState<string>(todayKey)
  const [prodReportSearch, setProdReportSearch] = useState('')
  const [showProdReportSuggestions, setShowProdReportSuggestions] = useState(false)

  // Custom multi-select shifts state
  const [selectedCustomShiftIds, setSelectedCustomShiftIds] = useState<string[]>([])
  const [aggregatedModalVisible, setAggregatedModalVisible] = useState(false)

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }, [])

  // ── LOAD DATA ──
  const refreshPendingQueueCount = useCallback(async () => {
    const c = await getOfflineQueueCount()
    setPendingSyncCount(c)
  }, [])

  const loadInitialData = useCallback(async () => {
    setLoading(true)
    try {
      await refreshPendingQueueCount()
      const [openList, pastList, prods, tpls, oTypes] = await Promise.all([
        getOpenShifts(activeSysCode),
        getPastShifts(60, activeSysCode),
        getWarehouseProducts(activeSysCode),
        getJobTemplates(activeSysCode),
        getOrderTypesForSystem(activeSysCode),
      ])
      setOpenShifts(openList)
      setPastShifts(pastList)
      setAllProducts(prods)
      setJobTemplates(tpls)
      setOrderTypes(oTypes)

      setSelectedShiftId(prev => {
        if (prev && openList.some(s => s.id === prev)) return prev
        return openList[0]?.id || null
      })
    } finally {
      setLoading(false)
    }
  }, [activeSysCode, refreshPendingQueueCount])

  useEffect(() => {
    void loadInitialData()
  }, [loadInitialData])

  const selectedShift = useMemo(
    () => openShifts.find(s => s.id === selectedShiftId) || null,
    [openShifts, selectedShiftId]
  )

  const loadSelectedShiftDetails = useCallback(async (shift: DeliveryShift | null) => {
    if (!shift) {
      setAllJournals([])
      setSubShifts([])
      setReconcileSessions([])
      setShiftImages([])
      setShiftImageCount(0)
      return
    }
    const [jList, sList, rList, imgs] = await Promise.all([
      getShiftJournals(shift, activeSysCode),
      getSubShifts(shift.id),
      getShiftReconciliations(shift.id, shift),
      getShiftOperationImages(shift.id).catch(() => []),
    ])
    setAllJournals(jList)
    setSubShifts(sList)
    setReconcileSessions(rList)
    setShiftImages(imgs)
    setShiftImageCount(imgs.length)
  }, [activeSysCode])

  useEffect(() => {
    void loadSelectedShiftDetails(selectedShift)
  }, [selectedShift, loadSelectedShiftDetails])

  // Khi mở tab Đã hoàn thành ở chế độ daily / product / custom -> tải journals của pastShifts
  useEffect(() => {
    if (mainTab !== 'done' || doneMode === 'single' || pastShifts.length === 0) return
    setLoadingMultiJournals(true)
    getMultiShiftsJournals(pastShifts, activeSysCode)
      .then(setMultiShiftsJournalsCache)
      .finally(() => setLoadingMultiJournals(false))
  }, [mainTab, doneMode, pastShifts, activeSysCode])

  // ── OFFLINE SYNC HANDLERS ──
  const handleSyncOfflineQueueNow = async () => {
    if (syncingOffline) return
    setSyncingOffline(true)
    try {
      const res = await syncOperationsOfflineQueue()
      await syncOfflineOperationImages().catch(() => {})
      await loadInitialData()
      showToast(
        res.syncedCount > 0
          ? `Đã đồng bộ thành công ${res.syncedCount} thao tác lên máy chủ!`
          : 'Dữ liệu đã được đồng bộ mới nhất.'
      )
    } finally {
      setSyncingOffline(false)
    }
  }

  const handleDownloadOfflineAll = async () => {
    if (syncingOffline) return
    setSyncingOffline(true)
    try {
      const res = await syncOperationsDataOffline(activeSysCode)
      await loadInitialData()
      showToast(res.message)
    } finally {
      setSyncingOffline(false)
    }
  }

  // ── LOGIC LỌC ĐỢT HIỆN TẠI VS TOÀN CA ──
  const closedJournalIdsSet = useMemo(() => {
    const set = new Set<string>()
    subShifts.forEach(ss => {
      ;(ss.summary_data?.journal_ids || []).forEach(id => set.add(id))
    })
    return set
  }, [subShifts])

  const currentBatchJournals = useMemo(
    () => allJournals.filter(j => !closedJournalIdsSet.has(j.id)),
    [allJournals, closedJournalIdsSet]
  )

  const activeScopeJournals = useMemo(
    () => (viewScope === 'current_batch' && subShifts.length > 0 ? currentBatchJournals : allJournals),
    [viewScope, subShifts.length, currentBatchJournals, allJournals]
  )

  // ── TÍNH SỐ LIỆU NHẬP / XUẤT THEO SẢN PHẨM & ĐƠN VỊ ──
  const { productQtyMap, productStatsList, unitStatsList } = useMemo(() => {
    const qMap = new Map<string, { inQty: number; outQty: number; count: number }>()
    const uMap = new Map<string, { unit: string; inQty: number; outQty: number; count: number }>()

    for (const j of activeScopeJournals) {
      const pName = (j.item_name || '').trim()
      const uName = (j.unit || 'Thùng').trim()
      const key = `${pName}___${uName}`
      const qty = Number(j.quantity_sent) || 0

      const cur = qMap.get(key) || { inQty: 0, outQty: 0, count: 0 }
      if (j.direction === 'in') cur.inQty = Number((cur.inQty + qty).toFixed(2))
      else cur.outQty = Number((cur.outQty + qty).toFixed(2))
      cur.count += 1
      qMap.set(key, cur)

      const uCur = uMap.get(uName) || { unit: uName, inQty: 0, outQty: 0, count: 0 }
      if (j.direction === 'in') uCur.inQty = Number((uCur.inQty + qty).toFixed(2))
      else uCur.outQty = Number((uCur.outQty + qty).toFixed(2))
      uCur.count += 1
      uMap.set(uName, uCur)
    }

    const pList = Array.from(qMap.entries()).map(([k, v]) => {
      const [name, unit] = k.split('___')
      return { name, unit, ...v }
    })

    return {
      productQtyMap: qMap,
      productStatsList: pList,
      unitStatsList: Array.from(uMap.values()),
    }
  }, [activeScopeJournals])

  // ── DANH SÁCH SẢN PHẨM GHIM & TÌM KIẾM ĐA TỪ KHÓA + AUTOCOMPLETE ──
  const pinnedProducts: ShiftProductItem[] = useMemo(() => {
    const raw = selectedShift?.summary_data?.pinned_products
    if (Array.isArray(raw) && raw.length > 0) return raw

    const recoveredMap = new Map<string, ShiftProductItem>()
    const addProduct = (p: ShiftProductItem) => {
      if (!p?.id) return
      if (!recoveredMap.has(p.id)) recoveredMap.set(p.id, p)
    }

    // 1. Khôi phục từ Công việc mẫu nếu khớp template_id hoặc tên công việc
    const tplId = selectedShift?.summary_data?.template_id
    const jobNameNorm = (selectedShift?.summary_data?.job_name || selectedShift?.notes || '').trim().toLowerCase()
    const matchedTpl = jobTemplates.find(
      t => (tplId && t.id === tplId) || (jobNameNorm && t.name.trim().toLowerCase() === jobNameNorm)
    )
    if (matchedTpl?.default_products?.length) {
      matchedTpl.default_products.forEach(addProduct)
    }

    // 2. Khôi phục từ các mặt hàng đã phát sinh trong nhật ký hoặc summary_data của ca
    const prodByName = new Map<string, ShiftProductItem>()
    allProducts.forEach(p => prodByName.set((p.name || '').trim().toLowerCase(), p))

    ;(allJournals || []).forEach(j => {
      const nameKey = (j.item_name || '').trim().toLowerCase()
      if (!nameKey) return
      const matched = prodByName.get(nameKey)
      if (matched) addProduct(matched)
    })

    Object.values(selectedShift?.summary_data?.products_summary || {}).forEach((ps: any) => {
      const nameKey = (ps?.product_name || '').trim().toLowerCase()
      if (!nameKey) return
      const matched = prodByName.get(nameKey)
      if (matched) addProduct(matched)
    })

    return Array.from(recoveredMap.values())
  }, [selectedShift, jobTemplates, allProducts, allJournals])

  const pinnedIdsSet = useMemo(() => new Set(pinnedProducts.map(p => p.id)), [pinnedProducts])

  // Hàm khớp sản phẩm không dấu, đa từ khóa qua aliases, internal_code, internal_name, sku, name
  const matchProductMultiKeyword = useCallback((p: ShiftProductItem, query: string): number => {
    const qNorm = normalizeViText(query)
    if (!qNorm) return 1
    const tokens = qNorm.split(' ').filter(Boolean)
    if (tokens.length === 0) return 1

    const aliasesNorm = normalizeViText(p.aliases || '')
    const skuNorm = normalizeViText(p.sku || '')
    const intCodeNorm = normalizeViText(p.internal_code || '')
    const intNameNorm = normalizeViText(p.internal_name || '')
    const nameNorm = normalizeViText(p.name || '')

    const combined = `${aliasesNorm} ${skuNorm} ${intCodeNorm} ${intNameNorm} ${nameNorm}`
    if (!tokens.every(t => combined.includes(t))) return 0

    let score = 10
    if (aliasesNorm && aliasesNorm === qNorm) score += 100
    else if (aliasesNorm && aliasesNorm.startsWith(qNorm)) score += 70
    else if (aliasesNorm && tokens.every(t => aliasesNorm.includes(t))) score += 50
    if (skuNorm && skuNorm.startsWith(qNorm)) score += 40
    if (intCodeNorm && intCodeNorm.includes(qNorm)) score += 30
    if (nameNorm.startsWith(qNorm)) score += 20
    return score
  }, [])

  // Gợi ý Autocomplete cho ô tìm kiếm sản phẩm trong Tab Đang làm
  const activeSearchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return []
    const sourceList =
      searchMode === 'filter' && pinnedProducts.length > 0 ? allProducts : allProducts
    const scored: { item: ShiftProductItem; score: number }[] = []
    for (const p of sourceList) {
      const sc = matchProductMultiKeyword(p, searchQuery)
      if (sc > 0) scored.push({ item: p, score: sc })
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(s => s.item)
  }, [searchQuery, searchMode, pinnedProducts.length, allProducts, matchProductMultiKeyword])

  // Danh sách sản phẩm hiển thị chính
  const displayedProducts = useMemo(() => {
    const baseList =
      searchMode === 'pin'
        ? allProducts
        : pinnedProducts

    if (!searchQuery.trim()) return baseList

    // Khi người dùng gõ tìm kiếm ở chế độ filter nhưng sản phẩm chưa ghim, tự động tìm trên toàn bộ kho nếu danh sách ghim không khớp
    const matchedInBase = baseList
      .map(p => ({ item: p, score: matchProductMultiKeyword(p, searchQuery) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item)

    if (matchedInBase.length > 0 || searchMode === 'pin') return matchedInBase

    return allProducts
      .map(p => ({ item: p, score: matchProductMultiKeyword(p, searchQuery) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item)
  }, [searchMode, allProducts, pinnedProducts, searchQuery, matchProductMultiKeyword])

  // ── HANDLERS THAO TÁC SẢN PHẨM & CÔNG VIỆC ──
  const handleTogglePinProduct = async (prod: ShiftProductItem) => {
    if (!selectedShift) return
    const exists = pinnedProducts.some(p => p.id === prod.id)
    const nextPinned = exists
      ? pinnedProducts.filter(p => p.id !== prod.id)
      : [...pinnedProducts, prod]

    setOpenShifts(prev =>
      prev.map(s =>
        s.id === selectedShift.id
          ? { ...s, summary_data: { ...(s.summary_data || {}), pinned_products: nextPinned } }
          : s
      )
    )
    await updateShiftPinnedProducts(selectedShift.id, nextPinned, selectedShift.summary_data)
    await refreshPendingQueueCount()
  }

  const handlePinAllProducts = async () => {
    if (!selectedShift) return
    const targetList = searchQuery.trim() ? displayedProducts : allProducts
    if (targetList.length === 0) return

    const existingIds = new Set(pinnedProducts.map(p => p.id))
    const toAdd = targetList.filter(p => !existingIds.has(p.id))
    if (toAdd.length === 0) return

    const nextPinned = [...pinnedProducts, ...toAdd]
    setOpenShifts(prev =>
      prev.map(s =>
        s.id === selectedShift.id
          ? { ...s, summary_data: { ...(s.summary_data || {}), pinned_products: nextPinned } }
          : s
      )
    )
    await updateShiftPinnedProducts(selectedShift.id, nextPinned, selectedShift.summary_data)
    await refreshPendingQueueCount()
    showToast(`Đã ghim thêm ${toAdd.length} sản phẩm`)
  }

  const handleUnpinAllProducts = async () => {
    if (!selectedShift || pinnedProducts.length === 0) return
    const hasFilter = Boolean(searchQuery.trim())
    const targetIds = new Set((hasFilter ? displayedProducts : pinnedProducts).map(p => p.id))
    const countToRemove = pinnedProducts.filter(p => targetIds.has(p.id)).length
    if (countToRemove === 0) return

    if (!hasFilter && !window.confirm(`Bỏ ghim toàn bộ ${countToRemove} sản phẩm khỏi công việc này?`)) {
      return
    }

    const nextPinned = hasFilter ? pinnedProducts.filter(p => !targetIds.has(p.id)) : []
    setOpenShifts(prev =>
      prev.map(s =>
        s.id === selectedShift.id
          ? { ...s, summary_data: { ...(s.summary_data || {}), pinned_products: nextPinned } }
          : s
      )
    )
    await updateShiftPinnedProducts(selectedShift.id, nextPinned, selectedShift.summary_data)
    await refreshPendingQueueCount()
    showToast(hasFilter ? `Đã bỏ ghim ${countToRemove} sản phẩm đang lọc` : 'Đã bỏ ghim toàn bộ sản phẩm')
  }

  const handleOpenNewJob = async (data: {
    jobName: string
    notes: string
    templateId: string | null
    defaultProducts: ShiftProductItem[]
    orderTypeId?: string | null
    orderTypeName?: string | null
    orderTypeCode?: string | null
  }) => {
    const matchedTemplate =
      jobTemplates.find(t => t.id === data.templateId) ||
      jobTemplates.find(t => t.name.trim().toLowerCase() === data.jobName.trim().toLowerCase())

    let initialProducts = data.defaultProducts
    if (
      initialProducts.length === 0 &&
      matchedTemplate?.pinned_product_ids &&
      matchedTemplate.pinned_product_ids.length > 0
    ) {
      initialProducts = matchedTemplate.pinned_product_ids
        .map(pid => allProducts.find(p => p.id === pid))
        .filter(Boolean) as ShiftProductItem[]
    }

    const created = await openDeliveryShift({
      user: userObj,
      jobName: data.jobName,
      notes: data.notes,
      templateId: matchedTemplate?.id || data.templateId,
      initialProducts,
      orderTypeId: data.orderTypeId,
      orderTypeName: data.orderTypeName,
      orderTypeCode: data.orderTypeCode,
      systemCode: activeSysCode,
    })
    setOpenShifts(prev => [created, ...prev])
    setSelectedShiftId(created.id)
    await refreshPendingQueueCount()
    showToast(`Đã tạo công việc "${data.jobName}"`)
  }

  const handleDeleteOpenShift = async (shift: DeliveryShift) => {
    const jobTitle = shift.summary_data?.job_name || shift.notes || 'Công việc'
    if (
      !window.confirm(
        `⚠️ Xác nhận XÓA công việc "${jobTitle}"?\n\nToàn bộ số liệu nhập/xuất và các đợt chốt tạm thuộc công việc này sẽ bị xóa vĩnh viễn!`
      )
    ) {
      return
    }
    try {
      await deleteDeliveryShift(shift.id, {
        shiftName: jobTitle,
        systemCode: shift.system_code,
        companyId: shift.company_id || userObj?.company_id || null,
        user: userObj,
      })
      const nextOpen = openShifts.filter(s => s.id !== shift.id)
      setOpenShifts(nextOpen)
      if (selectedShiftId === shift.id) {
        setSelectedShiftId(nextOpen[0]?.id || null)
      }
      setShowJobDropdown(false)
      await refreshPendingQueueCount()
      showToast(
        shift.id.startsWith('local_')
          ? `Đã xóa công việc "${jobTitle}"`
          : `Đã tạm ẩn "${jobTitle}" & gửi yêu cầu xóa chờ Web Số liệu duyệt`
      )
    } catch (e: any) {
      alert('Lỗi khi xóa công việc: ' + (e?.message || e))
    }
  }

  const handleConfirmNumberPad = async (data: {
    direction: 'in' | 'out'
    quantity: number
    unit: string
    notes: string
    photos?: any[]
  }) => {
    if (!selectedShift || !numPadTarget) return
    const prod = numPadTarget.product

    // Tự động ghim sản phẩm vào ca nếu chưa ghim
    if (!pinnedProducts.some(p => p.id === prod.id)) {
      const nextPinned = [...pinnedProducts, prod]
      setOpenShifts(prev =>
        prev.map(s =>
          s.id === selectedShift.id
            ? { ...s, summary_data: { ...(s.summary_data || {}), pinned_products: nextPinned } }
            : s
        )
      )
      void updateShiftPinnedProducts(selectedShift.id, nextPinned, selectedShift.summary_data)
    }

    const createdJournal = await createShiftJournalEntry({
      shift: selectedShift,
      user: userObj,
      productId: prod.id,
      productSku: prod.sku,
      itemName: prod.name,
      quantity: data.quantity,
      unit: data.unit,
      direction: data.direction,
      notes: data.notes,
      systemCode: activeSysCode,
    })

    setAllJournals(prev => [createdJournal, ...prev])

    if (data.photos && data.photos.length > 0) {
      const uploaded = await uploadOperationImages({
        images: data.photos,
        systemCode: selectedShift.system_code,
        companyId: selectedShift.company_id || userObj.company_id,
        shiftId: selectedShift.id,
        journalId: createdJournal.id,
        scope: 'journal',
        direction: data.direction,
        jobName: selectedShift.summary_data?.job_name || selectedShift.notes || 'Công việc',
        itemName: prod.name,
        itemSku: prod.sku,
        quantity: data.quantity,
        unit: data.unit,
        notes: data.notes,
        user: userObj,
      })
      setShiftImages(prev => [...uploaded, ...prev])
      setShiftImageCount(c => c + uploaded.length)
    }

    await refreshPendingQueueCount()
    showToast(
      `Đã ghi ${data.direction === 'in' ? 'NHẬP +' : 'XUẤT -'}${data.quantity} ${data.unit} (${prod.name})`
    )
  }

  const handleInterimClose = async (notes: string) => {
    if (!selectedShift || currentBatchJournals.length === 0) return
    const lastSub = subShifts[subShifts.length - 1]
    const fromTime = lastSub?.to_time || selectedShift.opened_at || new Date().toISOString()

    const createdSub = await createSubShift({
      shift: selectedShift,
      user: userObj,
      notes,
      currentJournals: currentBatchJournals,
      existingSubShiftsCount: subShifts.length,
      fromTime,
    })

    // Clear reconcile sessions for new batch
    await clearShiftReconciliations(selectedShift.id, selectedShift.summary_data)
    setReconcileSessions([])
    setSubShifts(prev => [...prev, createdSub])
    setViewScope('current_batch')
    await refreshPendingQueueCount()
    showToast(`Đã chốt ca tạm đợt #${createdSub.sub_shift_number}!`)
  }

  const handleCloseJob = async (data: {
    notes: string
    orderTypeId?: string | null
    orderTypeName?: string | null
    orderTypeCode?: string | null
  }) => {
    if (!selectedShift) return
    await closeDeliveryShift({
      shift: selectedShift,
      user: userObj,
      notes: data.notes,
      journals: allJournals,
      orderTypeId: data.orderTypeId,
      orderTypeName: data.orderTypeName,
      orderTypeCode: data.orderTypeCode,
    })
    await loadInitialData()
    showToast('Đã hoàn thành và đóng công việc!')
  }

  const handleSaveEditJournal = async (data: {
    journalId: string
    quantity: number
    unit: string
    direction: 'in' | 'out'
    userNote: string
  }) => {
    const target = allJournals.find(j => j.id === data.journalId)
    await updateShiftJournalEntry({
      ...data,
      existingNotes: target?.notes,
      shiftId: selectedShift?.id || null,
      shiftName: selectedShift?.summary_data?.job_name || selectedShift?.notes || null,
      systemCode: selectedShift?.system_code || activeSysCode,
      companyId: selectedShift?.company_id || userObj?.company_id || null,
      beforeData: target || null,
      user: userObj,
    })
    if (selectedShift) {
      await loadSelectedShiftDetails(selectedShift)
    }
    await refreshPendingQueueCount()
    showToast(
      data.journalId.startsWith('local_')
        ? 'Đã cập nhật dòng lịch sử!'
        : 'Đã gửi yêu cầu sửa số liệu, chờ Web Số liệu duyệt!'
    )
  }

  const handleDeleteJournal = async (j: JournalRecord) => {
    if (!window.confirm(`Tạm ẩn & gửi yêu cầu xóa đợt ${j.direction === 'in' ? 'Nhập' : 'Xuất'} ${j.quantity_sent} ${j.unit} - ${j.item_name}?`))
      return
    await deleteShiftJournalEntry(j.id, {
      shiftId: selectedShift?.id || null,
      shiftName: selectedShift?.summary_data?.job_name || selectedShift?.notes || null,
      systemCode: selectedShift?.system_code || activeSysCode,
      companyId: selectedShift?.company_id || userObj?.company_id || null,
      beforeData: j,
      user: userObj,
    })
    setAllJournals(prev => prev.filter(x => x.id !== j.id))
    await refreshPendingQueueCount()
    showToast(
      j.id.startsWith('local_')
        ? 'Đã xóa đợt nhập/xuất.'
        : 'Đã tạm ẩn & gửi yêu cầu xóa chờ Web Số liệu duyệt!'
    )
  }

  // ── DỮ LIỆU TAB ĐÃ HOÀN THÀNH (4 SUB-MODES) ──
  const availablePastDateKeys = useMemo(() => {
    const set = new Set<string>()
    pastShifts.forEach(s => {
      const k = toDateKey(s.closed_at || s.opened_at)
      if (k) set.add(k)
    })
    return Array.from(set)
  }, [pastShifts])

  // 1. Single Mode Filtered
  const filteredPastShiftsSingle = useMemo(() => {
    if (!doneSearchQuery.trim()) return pastShifts
    const q = normalizeViText(doneSearchQuery)
    const tokens = q.split(' ').filter(Boolean)
    return pastShifts.filter(s => {
      const hay = normalizeViText(
        [
          s.summary_data?.job_name,
          s.notes,
          s.closed_by_name,
          s.opened_by_name,
          s.summary_data?.order_type_name,
          Object.values(s.summary_data?.products_summary || {})
            .map(p => p.product_name)
            .join(' '),
        ]
          .filter(Boolean)
          .join(' ')
      )
      return tokens.every(t => hay.includes(t))
    })
  }, [pastShifts, doneSearchQuery])

  // 2. Daily Mode Shifts & Aggregation
  const dailyFilteredShifts = useMemo(() => {
    return pastShifts.filter(s => {
      const dKey = toDateKey(s.closed_at || s.opened_at)
      if (!dKey) return false
      if (dailySelectType === 'multi') {
        return selectedDailyDates.includes(dKey)
      }
      return dKey >= dailyRangeStart && dKey <= dailyRangeEnd
    })
  }, [pastShifts, dailySelectType, selectedDailyDates, dailyRangeStart, dailyRangeEnd])

  const dailyProdRows = useMemo(
    () => aggregateShiftsProducts(dailyFilteredShifts, multiShiftsJournalsCache, allProducts),
    [dailyFilteredShifts, multiShiftsJournalsCache, allProducts]
  )
  const dailyUnitRows = useMemo(() => aggregateShiftsUnits(dailyProdRows), [dailyProdRows])

  // 3. Product Mode Shifts & Aggregation + Autocomplete
  const prodTimeFilteredShifts = useMemo(() => {
    if (prodTimePreset === 'all') return pastShifts
    const now = new Date()
    const todayStr = toDateKey(now.toISOString())
    const yesterday = new Date(now.getTime() - 86400000)
    const yesterdayStr = toDateKey(yesterday.toISOString())
    const d7 = toDateKey(new Date(now.getTime() - 6 * 86400000).toISOString())
    const d30 = toDateKey(new Date(now.getTime() - 29 * 86400000).toISOString())

    return pastShifts.filter(s => {
      const k = toDateKey(s.closed_at || s.opened_at)
      if (!k) return false
      if (prodTimePreset === 'today') return k === todayStr
      if (prodTimePreset === 'yesterday') return k === yesterdayStr
      if (prodTimePreset === '7d') return k >= d7 && k <= todayStr
      if (prodTimePreset === '30d') return k >= d30 && k <= todayStr
      return k >= prodRangeStart && k <= prodRangeEnd
    })
  }, [pastShifts, prodTimePreset, prodRangeStart, prodRangeEnd])

  const allProdReportRows = useMemo(
    () => aggregateShiftsProducts(prodTimeFilteredShifts, multiShiftsJournalsCache, allProducts),
    [prodTimeFilteredShifts, multiShiftsJournalsCache, allProducts]
  )

  const prodReportSuggestions = useMemo(() => {
    if (!prodReportSearch.trim()) return []
    const qNorm = normalizeViText(prodReportSearch)
    const tokens = qNorm.split(' ').filter(Boolean)
    return allProducts
      .map(p => ({ item: p, score: matchProductMultiKeyword(p, prodReportSearch) }))
      .filter(x => x.score > 0 && tokens.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(x => x.item)
  }, [prodReportSearch, allProducts, matchProductMultiKeyword])

  const filteredProdReportRows = useMemo(() => {
    if (!prodReportSearch.trim()) return allProdReportRows
    const qNorm = normalizeViText(prodReportSearch)
    const tokens = qNorm.split(' ').filter(Boolean)
    return allProdReportRows.filter(r => {
      const hay = normalizeViText(
        [r.product_name, r.sku, r.aliases, r.internal_code, r.internal_name, r.unit]
          .filter(Boolean)
          .join(' ')
      )
      return tokens.every(t => hay.includes(t))
    })
  }, [allProdReportRows, prodReportSearch])

  const filteredProdUnitRows = useMemo(
    () => aggregateShiftsUnits(filteredProdReportRows),
    [filteredProdReportRows]
  )

  return (
    <div className="flex flex-col h-full bg-[#0b1120] text-slate-100 select-none overflow-hidden">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold shadow-xl border border-emerald-400 max-w-[90vw] text-center">
          {toastMsg}
        </div>
      )}

      {/* Offline Queue Banner */}
      {pendingSyncCount > 0 && (
        <div className="px-3 py-2 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-amber-300">
            ⏳ Có {pendingSyncCount} thao tác lưu ngoại tuyến chờ đẩy lên Web
          </span>
          <button
            type="button"
            disabled={syncingOffline}
            onClick={handleSyncOfflineQueueNow}
            className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-extrabold flex items-center gap-1 shrink-0"
          >
            {syncingOffline ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CloudUpload className="w-3 h-3" />
            )}
            <span>Đồng bộ ngay</span>
          </button>
        </div>
      )}

      {/* ── TOP TAB BAR ── */}
      <div className="px-3 pt-2.5 pb-2 bg-[#0f172a] border-b border-slate-800 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMainTab('active')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition ${
            mainTab === 'active'
              ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-950/50'
              : 'bg-[#1e293b] border-slate-700 text-slate-400'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Đang làm ({openShifts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('done')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition ${
            mainTab === 'done'
              ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-950/50'
              : 'bg-[#1e293b] border-slate-700 text-slate-400'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Đã hoàn thành ({pastShifts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setWarehouseAlbumVisible(true)}
          title="Thư viện ảnh theo ngày và công việc"
          className="w-9 h-9 rounded-xl bg-[#1e293b] border border-slate-700 flex items-center justify-center text-amber-400 shrink-0"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={syncingOffline}
          onClick={handleDownloadOfflineAll}
          title="Tải dữ liệu số liệu ngoại tuyến"
          className="w-9 h-9 rounded-xl bg-[#1e293b] border border-slate-700 flex items-center justify-center text-sky-400 shrink-0"
        >
          {syncingOffline ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CloudDownload className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* ── BODY ── */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
          <span className="text-xs font-semibold">Đang tải dữ liệu tác nghiệp...</span>
        </div>
      ) : mainTab === 'active' ? (
        /* =========================================================
         * TAB 1: ĐANG LÀM (ACTIVE SHIFTS)
         * ========================================================= */
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3 pb-24">
          {/* Thanh chọn Công Việc đang mở + Nút thao tác */}
          <div className="bg-[#1e293b] border border-slate-700 rounded-2xl p-2.5 space-y-2">
            {openShifts.length === 0 ? (
              <button
                type="button"
                onClick={() => setOpenJobModalVisible(true)}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tạo Công Việc Mới Để Bắt Đầu Nhập / Xuất</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowJobDropdown(v => !v)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-700 flex items-center justify-between gap-2 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold text-white truncate">
                        {selectedShift?.summary_data?.job_name ||
                          selectedShift?.notes ||
                          'Công việc'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        Mở lúc {formatDateTime(selectedShift?.opened_at)} •{' '}
                        {allJournals.length} đợt
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>

                  {showJobDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl bg-[#1e293b] border border-indigo-500/50 shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                      {openShifts.map(s => {
                        const active = s.id === selectedShiftId
                        return (
                          <div
                            key={s.id}
                            className={`w-full px-3 py-2 border-b border-slate-700/60 last:border-0 flex items-center justify-between gap-2 ${
                              active ? 'bg-indigo-600/25 text-white' : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedShiftId(s.id)
                                setShowJobDropdown(false)
                              }}
                              className="min-w-0 flex-1 text-left py-0.5"
                            >
                              <div className="text-xs font-bold truncate">
                                {s.summary_data?.job_name || s.notes || 'Công việc'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Mở: {formatDateTime(s.opened_at)}
                              </div>
                            </button>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {active && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-[9px] font-extrabold text-white">
                                  Đang chọn
                                </span>
                              )}
                              <button
                                type="button"
                                title="Xóa công việc này"
                                onClick={e => {
                                  e.stopPropagation()
                                  void handleDeleteOpenShift(s)
                                }}
                                className="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 flex items-center justify-center transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Các nút hành động nhanh trên ca đang chọn */}
                {selectedShift && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setImagesJournalTarget(null)
                        setImagesModalShift(selectedShift)
                      }}
                      title="Chụp ảnh / Album công việc"
                      className="relative w-9 h-10 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 flex items-center justify-center shrink-0"
                    >
                      <Camera className="w-4 h-4" />
                      {shiftImageCount > 0 && (
                        <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-sky-500 text-[9px] font-black text-white flex items-center justify-center">
                          {shiftImageCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setInterimModalVisible(true)}
                      title="Chốt ca tạm"
                      className="px-2.5 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-extrabold flex items-center gap-1 shrink-0"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Chốt tạm</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCloseJobModalVisible(true)}
                      title="Hoàn thành công việc"
                      className="px-2.5 h-10 rounded-xl bg-rose-600 text-white text-[11px] font-extrabold flex items-center gap-1 shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đóng ca</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setOpenJobModalVisible(true)}
                  title="Thêm công việc mới"
                  className="w-9 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {selectedShift && (
            <>
              {/* ── THANH TÌM KIẾM SẢN PHẨM (2 CHẾ ĐỘ: NHẬP / GHIM) + AUTOCOMPLETE ── */}
              <div className="space-y-1.5 relative">
                <div className="flex items-center gap-1.5">
                  <div className="flex bg-[#1e293b] p-0.5 rounded-xl border border-slate-700 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSearchMode('filter')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition ${
                        searchMode === 'filter'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400'
                      }`}
                    >
                      Nhập ({pinnedProducts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchMode('pin')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition ${
                        searchMode === 'pin'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-400'
                      }`}
                    >
                      <Pin className="w-3 h-3" />
                      <span>Ghim SP ({allProducts.length})</span>
                    </button>
                  </div>

                  <div className="flex-1 flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[#1e293b] border border-slate-700">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value)
                        setShowSearchSuggestions(true)
                      }}
                      onFocus={() => setShowSearchSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 180)}
                      placeholder="Gõ tên tắt (alias), SKU, tên SP..."
                      className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none min-w-0"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('')
                          setShowSearchSuggestions(false)
                        }}
                        className="text-slate-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {searchMode === 'pin' && (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#1e293b]/90 border border-slate-700/80">
                    <span className="text-[11px] text-slate-300 font-semibold">
                      Đã ghim: <b className="text-amber-300">{pinnedProducts.length}</b>/{allProducts.length} SP
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handlePinAllProducts()}
                        disabled={
                          (searchQuery.trim() ? displayedProducts : allProducts).every(p =>
                            pinnedIdsSet.has(p.id)
                          )
                        }
                        className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-amber-500 text-slate-950 disabled:opacity-40 transition"
                      >
                        {searchQuery.trim()
                          ? `Ghim lọc (${displayedProducts.length})`
                          : 'Ghim tất cả'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUnpinAllProducts()}
                        disabled={pinnedProducts.length === 0}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 disabled:opacity-40 transition"
                      >
                        {searchQuery.trim() ? 'Bỏ ghim lọc' : 'Bỏ ghim tất cả'}
                      </button>
                    </div>
                  </div>
                )}

                {/* AUTOCOMPLETE DROPDOWN GỢI Ý SẢN PHẨM */}
                {showSearchSuggestions &&
                  searchQuery.trim().length > 0 &&
                  activeSearchSuggestions.length > 0 && (
                    <div className="rounded-xl bg-[#1e293b] border border-indigo-500/70 shadow-2xl overflow-hidden z-30 max-h-60 overflow-y-auto">
                      <div className="px-3 py-1.5 bg-[#0f172a] text-[10px] font-extrabold text-slate-400 border-b border-slate-700 flex items-center justify-between">
                        <span>GỢI Ý SẢN PHẨM ({activeSearchSuggestions.length})</span>
                        <span className="text-indigo-400">
                          {searchMode === 'pin' ? 'Chạm để Ghim/Bỏ ghim' : 'Chạm để Nhập số lượng'}
                        </span>
                      </div>
                      {activeSearchSuggestions.map(sug => {
                        const isPinned = pinnedIdsSet.has(sug.id)
                        const defU = sug.defaultUnit || sug.unit || 'Thùng (20kg)'
                        return (
                          <button
                            key={sug.id}
                            type="button"
                            onMouseDown={() => {
                              if (searchMode === 'pin') {
                                void handleTogglePinProduct(sug)
                              } else {
                                setNumPadTarget({ product: sug, unit: defU })
                                setShowSearchSuggestions(false)
                              }
                            }}
                            onClick={() => {
                              if (searchMode === 'pin') {
                                void handleTogglePinProduct(sug)
                              } else {
                                setNumPadTarget({ product: sug, unit: defU })
                                setShowSearchSuggestions(false)
                              }
                            }}
                            className="w-full px-3 py-2 text-left border-b border-slate-700/60 last:border-0 hover:bg-slate-800 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {sug.aliases && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-extrabold">
                                    {sug.aliases}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-white truncate">
                                  {sug.name}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                SKU: <b className="text-indigo-300">{sug.sku || '---'}</b>
                                {sug.internal_code ? ` • Nội bộ: ${sug.internal_code}` : ''}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold shrink-0 ${
                                searchMode === 'pin'
                                  ? isPinned
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-slate-800 text-slate-300'
                                  : 'bg-indigo-600 text-white'
                              }`}
                            >
                              {searchMode === 'pin' ? (isPinned ? '★ Đã ghim' : '+ Ghim') : '+ Nhập/Xuất'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
              </div>

              {/* ── DANH SÁCH THẺ SẢN PHẨM ── */}
              <div className="space-y-2">
                {displayedProducts.slice(0, productDisplayLimit).map((item, index) => {
                  const isEven = index % 2 === 0
                  const isPinned = pinnedIdsSet.has(item.id)
                  const defUnit =
                    item.defaultUnit ||
                    pickDefaultProductUnit(item.units || [], item.unit) ||
                    'Thùng (20kg)'

                  // Hiển thị các ĐVT đã có phát sinh hoặc ĐVT mặc định
                  const activeUnitsForProd = productStatsList
                    .filter(ps => ps.name.toLowerCase() === item.name.toLowerCase())
                    .map(ps => ps.unit)
                  const displayUnits = Array.from(new Set([defUnit, ...activeUnitsForProd]))

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl p-2.5 border transition ${
                        isEven
                          ? 'bg-[#1e293b]/90 border-indigo-500/25'
                          : 'bg-[#1e293b]/60 border-amber-500/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <span
                            className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 ${
                              isEven
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-extrabold text-white leading-snug">
                              {item.name}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {item.sku && (
                                <span className="text-[10px] font-bold text-slate-400">
                                  SKU: {item.sku}
                                </span>
                              )}
                              {item.aliases && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-extrabold">
                                  {item.aliases}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setHistoryProductTarget(item)}
                            title="Xem lịch sử sản phẩm này"
                            className="w-7 h-7 rounded-lg bg-[#0f172a] border border-slate-700 flex items-center justify-center text-slate-300"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {searchMode === 'pin' && (
                            <button
                              type="button"
                              onClick={() => handleTogglePinProduct(item)}
                              className={`px-2 h-7 rounded-lg text-[10px] font-extrabold flex items-center gap-1 border ${
                                isPinned
                                  ? 'bg-amber-500 border-amber-400 text-slate-950'
                                  : 'bg-[#0f172a] border-slate-700 text-slate-400'
                              }`}
                            >
                              <Pin className="w-3 h-3" />
                              <span>{isPinned ? 'Đã ghim' : 'Ghim'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Các nút Đơn Vị Tính (chạm để mở bàn phím số) */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {displayUnits.map(u => {
                          const st = productQtyMap.get(`${item.name.trim()}___${u}`)
                          const inQ = st?.inQty || 0
                          const outQ = st?.outQty || 0
                          return (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setNumPadTarget({ product: item, unit: u })}
                              className="flex-1 min-w-[130px] px-2.5 py-1.5 rounded-xl bg-[#0f172a] border border-slate-700 hover:border-indigo-500/60 flex items-center justify-between gap-2 text-left active:scale-[0.99] transition"
                            >
                              <span className="text-[11px] font-extrabold text-indigo-300 truncate">
                                {u}
                              </span>
                              <div className="flex items-center gap-2 text-xs font-black shrink-0">
                                <span className={inQ > 0 ? 'text-emerald-400' : 'text-slate-600'}>
                                  +{inQ}
                                </span>
                                <span className="text-slate-600">|</span>
                                <span className={outQ > 0 ? 'text-rose-400' : 'text-slate-600'}>
                                  -{outQ}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {displayedProducts.length > productDisplayLimit && (
                  <button
                    type="button"
                    onClick={() => setProductDisplayLimit(prev => prev + 40)}
                    className="w-full py-2.5 rounded-xl bg-[#1e293b] border border-slate-700 text-xs font-extrabold text-sky-400"
                  >
                    Xem thêm sản phẩm ({displayedProducts.length - productDisplayLimit} còn lại)...
                  </button>
                )}
              </div>

              {/* ── FOOTER REPORT CARD (LỊCH SỬ ĐỢT | BÁO CÁO | THAM CHIẾU) ── */}
              <div className="bg-[#1e293b] border border-slate-700 rounded-2xl overflow-hidden mt-4">
                {/* Thanh chuyển chế độ xem Đợt hiện tại vs Toàn ca khi đã có chốt ca tạm */}
                {subShifts.length > 0 && (
                  <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-amber-300">
                      Đã chốt tạm {subShifts.length} lần • Đang xem:
                    </span>
                    <div className="flex bg-[#0f172a] p-0.5 rounded-lg border border-slate-700">
                      <button
                        type="button"
                        onClick={() => setViewScope('current_batch')}
                        className={`px-2 py-1 rounded text-[10px] font-extrabold ${
                          viewScope === 'current_batch'
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400'
                        }`}
                      >
                        Đợt hiện tại ({currentBatchJournals.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewScope('full_shift')}
                        className={`px-2 py-1 rounded text-[10px] font-extrabold ${
                          viewScope === 'full_shift'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400'
                        }`}
                      >
                        Toàn ca ({allJournals.length})
                      </button>
                    </div>
                  </div>
                )}

                {/* 3 Tabs Header */}
                <div className="grid grid-cols-3 border-b border-slate-700 bg-[#0f172a]/60">
                  {[
                    { k: 'history', label: `Lịch sử (${allJournals.length})` },
                    { k: 'report', label: 'Báo cáo' },
                    { k: 'reconcile', label: 'Tham chiếu' },
                  ].map(t => {
                    const active = footerTab === t.k
                    return (
                      <button
                        key={t.k}
                        type="button"
                        onClick={() => setFooterTab(t.k as any)}
                        className={`py-2.5 text-xs font-extrabold border-b-2 transition ${
                          active
                            ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                            : 'border-transparent text-slate-400'
                        }`}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>

                {/* Tab 1: Lịch sử đợt */}
                {footerTab === 'history' && (
                  <div className="p-3 space-y-2.5">
                    <div className="grid grid-cols-3 gap-1.5 bg-[#0f172a] p-1 rounded-xl">
                      {[
                        { k: 'all', label: 'Tất cả' },
                        { k: 'in', label: '↓ Nhập (+)' },
                        { k: 'out', label: '↑ Xuất (-)' },
                      ].map(f => (
                        <button
                          key={f.k}
                          type="button"
                          onClick={() => setHistoryFilter(f.k as any)}
                          className={`py-1.5 rounded-lg text-[11px] font-extrabold ${
                            historyFilter === f.k
                              ? f.k === 'in'
                                ? 'bg-emerald-600 text-white'
                                : f.k === 'out'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-700 text-white'
                              : 'text-slate-400'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {/* Các lần chốt ca tạm trước đó */}
                    {subShifts.map(sub => {
                      const isExp = !!expandedSubShiftIds[sub.id]
                      const subIds = new Set(sub.summary_data?.journal_ids || [])
                      const subJournals = allJournals.filter(
                        j =>
                          subIds.has(j.id) &&
                          (historyFilter === 'all' || j.direction === historyFilter)
                      )
                      return (
                        <div
                          key={sub.id}
                          className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSubShiftIds(p => ({ ...p, [sub.id]: !isExp }))
                            }
                            className="w-full px-3 py-2 flex items-center justify-between text-left"
                          >
                            <div>
                              <div className="text-xs font-extrabold text-amber-300">
                                🔒 Lần chốt ca tạm #{sub.sub_shift_number} ({subJournals.length}{' '}
                                đợt)
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {formatDateTime(sub.from_time)} → {formatDateTime(sub.to_time)}
                              </div>
                            </div>
                            {isExp ? (
                              <ChevronUp className="w-4 h-4 text-amber-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-amber-400" />
                            )}
                          </button>
                          {isExp && (
                            <div className="p-2 border-t border-amber-500/20 space-y-1.5">
                              {subJournals.map(j => (
                                <div
                                  key={j.id}
                                  className="p-2 rounded-lg bg-[#0f172a] flex items-center justify-between text-xs"
                                >
                                  <span className="font-bold text-slate-200 truncate pr-2">
                                    {j.item_name}
                                  </span>
                                  <span
                                    className={`font-extrabold shrink-0 ${
                                      j.direction === 'in' ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {j.direction === 'in' ? '+' : '-'}
                                    {j.quantity_sent} {j.unit}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Các dòng lịch sử của đợt hiện tại */}
                    {currentBatchJournals
                      .filter(j => historyFilter === 'all' || j.direction === historyFilter)
                      .map(j => {
                        const isIn = j.direction === 'in'
                        const cleanNote = extractCleanUserNote(j.notes)
                        const jImages = shiftImages.filter(img => img.journal_id === j.id)
                        const openJournalImages = () => {
                          setImagesJournalTarget({
                            id: j.id,
                            itemName: j.item_name,
                            itemSku: (j as any).item_sku || null,
                            quantity: j.quantity_sent,
                            unit: j.unit,
                            direction: j.direction,
                          })
                          setImagesModalShift(selectedShift)
                        }
                        return (
                          <div
                            key={j.id}
                            className="p-2.5 rounded-xl bg-[#0f172a] border border-slate-700 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-white truncate">
                                {j.item_name}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-black ${
                                    isIn
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-rose-500/20 text-rose-400'
                                  }`}
                                >
                                  {isIn ? '+' : '-'}
                                  {j.quantity_sent} {j.unit}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {formatDateTime(j.sent_at)} • {j.sent_by_name || 'NV'}
                                </span>
                              </div>
                              {cleanNote && (
                                <div className="text-[11px] text-amber-300 mt-1 italic">
                                  📝 {cleanNote}
                                </div>
                              )}
                              {jImages.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto no-scrollbar">
                                  {jImages.map(img => (
                                    <button
                                      key={img.id}
                                      type="button"
                                      onClick={openJournalImages}
                                      className="relative w-11 h-11 rounded-lg overflow-hidden border border-slate-600 shrink-0 bg-slate-800"
                                      title="Xem ảnh chứng minh"
                                    >
                                      <img
                                        src={getOperationImageDisplayUrl(img)}
                                        alt="proof"
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={openJournalImages}
                                className="relative p-1.5 rounded-lg bg-sky-500/15 text-sky-300"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                {jImages.length > 0 && (
                                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-sky-500 text-white text-[9px] font-extrabold flex items-center justify-center">
                                    {jImages.length}
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditJournalTarget(j)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteJournal(j)}
                                className="p-1.5 rounded-lg bg-rose-950/60 text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}

                    {currentBatchJournals.length === 0 && (
                      <div className="py-6 text-center text-xs text-slate-500 italic">
                        Chưa có đợt nhập/xuất nào trong đợt hiện tại.
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Báo cáo */}
                {footerTab === 'report' && (
                  <div className="p-3 space-y-2.5">
                    {/* 1. Chi tiết theo Mặt Hàng */}
                    <div className="rounded-xl bg-[#0f172a] border border-slate-700 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandRepProducts(v => !v)}
                        className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-extrabold text-sky-400"
                      >
                        <span>1. Chi tiết theo Mặt Hàng ({productStatsList.length} SP)</span>
                        {expandRepProducts ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      {expandRepProducts && (
                        <div className="p-2 border-t border-slate-800 divide-y divide-slate-800">
                          {productStatsList.map((p, i) => (
                            <div
                              key={`${p.name}_${p.unit}_${i}`}
                              className="py-1.5 flex items-center justify-between text-xs"
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="font-bold text-white truncate">{p.name}</div>
                                <div className="text-[10px] text-indigo-300">{p.unit}</div>
                              </div>
                              <span className="w-16 text-right font-extrabold text-emerald-400">
                                +{p.inQty}
                              </span>
                              <span className="w-16 text-right font-extrabold text-rose-400">
                                -{p.outQty}
                              </span>
                              <span className="w-10 text-right text-slate-400 text-[11px]">
                                {p.count} đợt
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 2. Tổng hợp theo ĐVT */}
                    <div className="rounded-xl bg-[#0f172a] border border-slate-700 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandRepUnits(v => !v)}
                        className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-extrabold text-indigo-400"
                      >
                        <span>2. Tổng hợp theo Đơn Vị Tính ({unitStatsList.length} ĐVT)</span>
                        {expandRepUnits ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      {expandRepUnits && (
                        <div className="p-2 border-t border-slate-800 divide-y divide-slate-800">
                          {unitStatsList.map(u => (
                            <div
                              key={u.unit}
                              className="py-1.5 flex items-center justify-between text-xs"
                            >
                              <span className="flex-1 font-bold text-white">{u.unit}</span>
                              <span className="w-16 text-right font-extrabold text-emerald-400">
                                +{u.inQty}
                              </span>
                              <span className="w-16 text-right font-extrabold text-rose-400">
                                -{u.outQty}
                              </span>
                              <span className="w-10 text-right text-slate-400 text-[11px]">
                                {u.count} đợt
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 3. Các lần chốt ca tạm */}
                    {subShifts.length > 0 && (
                      <div className="rounded-xl bg-[#0f172a] border border-slate-700 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandRepSubShifts(v => !v)}
                          className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-extrabold text-amber-400"
                        >
                          <span>3. Các Lần Chốt Ca Tạm ({subShifts.length})</span>
                          {expandRepSubShifts ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        {expandRepSubShifts && (
                          <div className="p-2 border-t border-slate-800 space-y-1.5">
                            {subShifts.map(s => (
                              <div key={s.id} className="p-2 rounded bg-[#1e293b] text-xs">
                                <div className="font-bold text-amber-300">
                                  Đợt #{s.sub_shift_number} ({formatDateTime(s.from_time)} →{' '}
                                  {formatDateTime(s.to_time)})
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Chốt bởi: {s.closed_by_name || 'NV'} •{' '}
                                  {s.summary_data?.total_records || 0} đợt
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Tham chiếu */}
                {footerTab === 'reconcile' && (
                  <ReconcileTabView
                    productStats={productStatsList}
                    unitStats={unitStatsList}
                    sessions={reconcileSessions}
                    onSaveSessions={next => {
                      setReconcileSessions(next)
                      if (selectedShift) {
                        void saveShiftReconciliations(
                          selectedShift.id,
                          next,
                          selectedShift.summary_data
                        )
                      }
                    }}
                    shift={selectedShift}
                    user={userObj}
                    onImagesChanged={() => {
                      if (selectedShift) {
                        getShiftOperationImages(selectedShift.id)
                          .then(l => {
                            setShiftImages(l)
                            setShiftImageCount(l.length)
                          })
                          .catch(() => {})
                      }
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        /* =========================================================
         * TAB 2: ĐÃ HOÀN THÀNH (4 SUB-MODES: TỪNG CV | THEO NGÀY | THEO SP | TÙY CHỌN)
         * ========================================================= */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 4 Sub-mode Switcher */}
          <div className="px-3 py-2 bg-[#0f172a] border-b border-slate-800 grid grid-cols-4 gap-1">
            {[
              { id: 'single', label: 'Từng CV' },
              { id: 'daily', label: 'Theo Ngày' },
              { id: 'product', label: 'Theo SP' },
              { id: 'custom', label: 'Tùy Chọn' },
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setDoneMode(m.id as any)}
                className={`py-1.5 rounded-lg text-[11px] font-extrabold border transition ${
                  doneMode === m.id
                    ? 'bg-indigo-600 border-indigo-400 text-white'
                    : 'bg-[#1e293b] border-slate-700 text-slate-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3 pb-24">
            {/* SUB-MODE 1: TỪNG CÔNG VIỆC */}
            {doneMode === 'single' && (
              <>
                <div className="flex items-center gap-2 px-3 h-10 rounded-xl bg-[#1e293b] border border-slate-700">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={doneSearchQuery}
                    onChange={e => setDoneSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên công việc, mặt hàng, người chốt..."
                    className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  {doneSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDoneSearchQuery('')}
                      className="text-slate-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {filteredPastShiftsSingle.map((s, idx) => {
                    const name = s.summary_data?.job_name || s.notes || `Công việc #${idx + 1}`
                    const prodCount = Object.keys(s.summary_data?.products_summary || {}).length
                    const recCount = s.summary_data?.total_records || 0
                    const overnight = isOvernightShift(s)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setPastDetailTarget(s)}
                        className="w-full p-3 rounded-2xl bg-[#1e293b] border border-slate-700 hover:border-indigo-500/50 text-left space-y-1.5 transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-white truncate">{name}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold shrink-0">
                            Đã chốt
                          </span>
                        </div>

                        {overnight && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-bold">
                            <Moon className="w-3 h-3" />
                            <span>Đóng ca ngày hôm sau ({formatDateTime(s.closed_at)})</span>
                          </div>
                        )}

                        <div className="text-[11px] text-slate-400 flex items-center justify-between">
                          <span>
                            Chốt: {formatDateTime(s.closed_at)} • {s.closed_by_name || 'NV'}
                          </span>
                          <span className="font-bold text-indigo-300">
                            {prodCount} SP • {recCount} đợt ›
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {/* SUB-MODE 2: BÁO CÁO THEO NGÀY */}
            {doneMode === 'daily' && (
              <div className="space-y-3">
                <div className="bg-[#1e293b] border border-slate-700 rounded-2xl p-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-1.5 bg-[#0f172a] p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDailySelectType('multi')}
                      className={`py-1.5 rounded-lg text-xs font-extrabold ${
                        dailySelectType === 'multi'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400'
                      }`}
                    >
                      Chọn nhiều ngày
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailySelectType('range')}
                      className={`py-1.5 rounded-lg text-xs font-extrabold ${
                        dailySelectType === 'range'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400'
                      }`}
                    >
                      Khoảng ngày (Từ - Đến)
                    </button>
                  </div>

                  {dailySelectType === 'multi' ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-slate-300 truncate">
                        Đang chọn:{' '}
                        <b className="text-indigo-400">
                          {selectedDailyDates.map(formatDateKeyVN).join(', ') || 'Chưa chọn'}
                        </b>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCalendarModalTarget('daily_multi')}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-extrabold flex items-center gap-1 shrink-0"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Mở Lịch</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCalendarModalTarget('daily_start')}
                        className="p-2 rounded-xl bg-[#0f172a] border border-slate-700 text-left"
                      >
                        <div className="text-[10px] text-slate-400">Từ ngày</div>
                        <div className="text-xs font-extrabold text-white">
                          {formatDateKeyVN(dailyRangeStart)}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarModalTarget('daily_end')}
                        className="p-2 rounded-xl bg-[#0f172a] border border-slate-700 text-left"
                      >
                        <div className="text-[10px] text-slate-400">Đến ngày</div>
                        <div className="text-xs font-extrabold text-white">
                          {formatDateKeyVN(dailyRangeEnd)}
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Kết quả tổng hợp theo ngày */}
                <div className="bg-[#1e293b] border border-slate-700 rounded-2xl p-3 space-y-2">
                  <div className="text-xs font-extrabold text-sky-400">
                    1. Chi tiết Mặt Hàng ({dailyProdRows.length} SP • {dailyFilteredShifts.length}{' '}
                    CV)
                  </div>
                  {loadingMultiJournals ? (
                    <div className="py-6 flex justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                    </div>
                  ) : dailyProdRows.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500 italic">
                      Không có dữ liệu phát sinh trong ngày đã chọn.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700/60">
                      {dailyProdRows.map((r, i) => (
                        <div
                          key={`${r.product_name}_${r.unit}_${i}`}
                          className="py-2 flex items-center justify-between text-xs"
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="font-bold text-white">{r.product_name}</div>
                            <span className="text-[10px] text-indigo-300">{r.unit}</span>
                          </div>
                          <span className="w-16 text-right font-extrabold text-emerald-400">
                            +{r.in_qty}
                          </span>
                          <span className="w-16 text-right font-extrabold text-rose-400">
                            -{r.out_qty}
                          </span>
                          <span className="w-10 text-right text-slate-400 text-[11px]">
                            {r.count} đợt
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[#1e293b] border border-slate-700 rounded-2xl p-3 space-y-2">
                  <div className="text-xs font-extrabold text-indigo-400">
                    2. Tổng hợp theo Đơn Vị Tính ({dailyUnitRows.length} ĐVT)
                  </div>
                  {dailyUnitRows.map(u => (
                    <div
                      key={u.unit}
                      className="py-1.5 flex items-center justify-between text-xs border-b border-slate-700/50 last:border-0"
                    >
                      <span className="font-bold text-white">{u.unit}</span>
                      <div className="flex gap-4">
                        <span className="font-extrabold text-emerald-400">+{u.in_qty}</span>
                        <span className="font-extrabold text-rose-400">-{u.out_qty}</span>
                        <span className="text-slate-400">{u.count} đợt</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-MODE 3: BÁO CÁO THEO SẢN PHẨM (CÓ AUTOCOMPLETE TÊN VIẾT TẮT) */}
            {doneMode === 'product' && (
              <div className="space-y-3">
                {/* Bộ lọc thời gian */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'today', label: 'Hôm nay' },
                    { id: 'yesterday', label: 'Hôm qua' },
                    { id: '7d', label: '7 ngày qua' },
                    { id: '30d', label: '30 ngày' },
                    { id: 'range', label: 'Khoảng ngày' },
                    { id: 'all', label: 'Tất cả' },
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProdTimePreset(p.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border ${
                        prodTimePreset === p.id
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-[#1e293b] border-slate-700 text-slate-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {prodTimePreset === 'range' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCalendarModalTarget('prod_start')}
                      className="p-2 rounded-xl bg-[#1e293b] border border-slate-700 text-left"
                    >
                      <div className="text-[10px] text-slate-400">Từ ngày</div>
                      <div className="text-xs font-extrabold text-white">
                        {formatDateKeyVN(prodRangeStart)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarModalTarget('prod_end')}
                      className="p-2 rounded-xl bg-[#1e293b] border border-slate-700 text-left"
                    >
                      <div className="text-[10px] text-slate-400">Đến ngày</div>
                      <div className="text-xs font-extrabold text-white">
                        {formatDateKeyVN(prodRangeEnd)}
                      </div>
                    </button>
                  </div>
                )}

                {/* Ô tìm kiếm sản phẩm theo tên viết tắt + Autocomplete */}
                <div className="relative">
                  <div className="flex items-center gap-2 px-3 h-10 rounded-xl bg-[#1e293b] border border-slate-700">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={prodReportSearch}
                      onChange={e => {
                        setProdReportSearch(e.target.value)
                        setShowProdReportSuggestions(true)
                      }}
                      onFocus={() => setShowProdReportSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowProdReportSuggestions(false), 180)}
                      placeholder="Tìm sản phẩm theo tên gõ tắt (alias), SKU, tên..."
                      className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    {prodReportSearch && (
                      <button
                        type="button"
                        onClick={() => setProdReportSearch('')}
                        className="text-slate-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {showProdReportSuggestions &&
                    prodReportSearch.trim() &&
                    prodReportSuggestions.length > 0 && (
                      <div className="mt-1 rounded-xl bg-[#1e293b] border border-indigo-500/70 shadow-2xl overflow-hidden z-30 max-h-52 overflow-y-auto">
                        {prodReportSuggestions.map(sug => (
                          <button
                            key={sug.id}
                            type="button"
                            onMouseDown={() => {
                              setProdReportSearch(sug.name)
                              setShowProdReportSuggestions(false)
                            }}
                            onClick={() => {
                              setProdReportSearch(sug.name)
                              setShowProdReportSuggestions(false)
                            }}
                            className="w-full px-3 py-2 text-left border-b border-slate-700/60 last:border-0 hover:bg-slate-800 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {sug.aliases && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-extrabold">
                                    {sug.aliases}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-white truncate">
                                  {sug.name}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400">SKU: {sug.sku}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                </div>

                {/* Bảng kết quả */}
                <div className="bg-[#1e293b] border border-slate-700 rounded-2xl p-3 space-y-2">
                  <div className="text-xs font-extrabold text-sky-400">
                    1. Chi tiết từng Mặt Hàng ({filteredProdReportRows.length} SP)
                  </div>
                  <div className="divide-y divide-slate-700/60">
                    {filteredProdReportRows.map((r, i) => (
                      <div
                        key={`${r.product_name}_${r.unit}_${i}`}
                        className="py-2 flex items-start justify-between text-xs gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white">{r.product_name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-indigo-300 font-bold">{r.unit}</span>
                            {r.aliases && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                {r.aliases}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="w-16 text-right font-extrabold text-emerald-400">
                          +{r.in_qty}
                        </span>
                        <span className="w-16 text-right font-extrabold text-rose-400">
                          -{r.out_qty}
                        </span>
                        <span className="w-10 text-right text-slate-400 text-[11px]">
                          {r.count} đợt
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#1e293b] border border-slate-700 rounded-2xl p-3 space-y-2">
                  <div className="text-xs font-extrabold text-indigo-400">
                    2. Tổng hợp theo Đơn Vị Tính ({filteredProdUnitRows.length} ĐVT)
                  </div>
                  {filteredProdUnitRows.map(u => (
                    <div
                      key={u.unit}
                      className="py-1.5 flex items-center justify-between text-xs border-b border-slate-700/50 last:border-0"
                    >
                      <span className="font-bold text-white">{u.unit}</span>
                      <div className="flex gap-4">
                        <span className="font-extrabold text-emerald-400">+{u.in_qty}</span>
                        <span className="font-extrabold text-rose-400">-{u.out_qty}</span>
                        <span className="text-slate-400">{u.count} đợt</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-MODE 4: TÙY CHỌN GỘP NHIỀU CÔNG VIỆC */}
            {doneMode === 'custom' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-400">
                    Đã chọn: <b className="text-indigo-400">{selectedCustomShiftIds.length}</b> /{' '}
                    {pastShifts.length} công việc
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCustomShiftIds(pastShifts.map(s => s.id))}
                      className="text-xs font-extrabold text-sky-400"
                    >
                      Chọn tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomShiftIds([])}
                      className="text-xs font-extrabold text-slate-400"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {pastShifts.map((s, idx) => {
                  const checked = selectedCustomShiftIds.includes(s.id)
                  const name = s.summary_data?.job_name || s.notes || `Công việc #${idx + 1}`
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setSelectedCustomShiftIds(prev =>
                          prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                        )
                      }
                      className={`w-full p-3 rounded-2xl border flex items-center gap-3 text-left transition ${
                        checked
                          ? 'bg-indigo-950/40 border-indigo-500'
                          : 'bg-[#1e293b] border-slate-700'
                      }`}
                    >
                      {checked ? (
                        <CheckSquare className="w-5 h-5 text-indigo-400 shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-500 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-extrabold text-white truncate">{name}</div>
                        <div className="text-[11px] text-slate-400">
                          Chốt: {formatDateTime(s.closed_at)} • {s.closed_by_name || 'NV'}
                        </div>
                      </div>
                    </button>
                  )
                })}

                {selectedCustomShiftIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAggregatedModalVisible(true)}
                    className="fixed bottom-20 left-4 right-4 z-30 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-extrabold shadow-2xl flex items-center justify-center gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Xem Báo Cáo Gộp ({selectedCustomShiftIds.length} Công Việc)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      <OperationNumberPadModal
        visible={!!numPadTarget}
        product={numPadTarget?.product || null}
        unit={numPadTarget?.unit || ''}
        availableUnits={numPadTarget?.product?.units}
        systemCode={selectedShift?.system_code || systemCode}
        jobName={selectedShift?.summary_data?.job_name || selectedShift?.notes || null}
        userName={userProfile?.fullName || userObj?.full_name || userObj?.email || null}
        onClose={() => setNumPadTarget(null)}
        onConfirm={handleConfirmNumberPad}
      />

      <OpenJobModal
        visible={openJobModalVisible}
        templates={jobTemplates}
        orderTypes={orderTypes}
        onClose={() => setOpenJobModalVisible(false)}
        onConfirm={handleOpenNewJob}
      />

      <CloseJobModal
        visible={closeJobModalVisible}
        shift={selectedShift}
        journals={allJournals}
        orderTypes={orderTypes}
        onClose={() => setCloseJobModalVisible(false)}
        onConfirm={handleCloseJob}
      />

      <InterimCloseModal
        visible={interimModalVisible}
        shift={selectedShift}
        currentJournals={currentBatchJournals}
        subShiftNumber={subShifts.length + 1}
        onClose={() => setInterimModalVisible(false)}
        onConfirm={handleInterimClose}
      />

      <EditJournalModal
        visible={!!editJournalTarget}
        journal={editJournalTarget}
        onClose={() => setEditJournalTarget(null)}
        onSave={handleSaveEditJournal}
      />

      <ProductHistoryModal
        visible={!!historyProductTarget}
        product={historyProductTarget}
        journals={allJournals}
        onClose={() => setHistoryProductTarget(null)}
        onEditJournal={j => {
          setHistoryProductTarget(null)
          setEditJournalTarget(j)
        }}
        onDeleteJournal={handleDeleteJournal}
      />

      <PastShiftDetailModal
        visible={!!pastDetailTarget}
        shift={pastDetailTarget}
        onClose={() => setPastDetailTarget(null)}
        onReopened={() => void loadInitialData()}
        onDeleted={() => void loadInitialData()}
        onOpenAlbum={s => {
          setPastDetailTarget(null)
          setImagesJournalTarget(null)
          setImagesModalShift(s)
        }}
      />

      <AggregatedReportModal
        visible={aggregatedModalVisible}
        title={`Báo cáo gộp (${selectedCustomShiftIds.length} CV)`}
        shifts={pastShifts.filter(s => selectedCustomShiftIds.includes(s.id))}
        journals={multiShiftsJournalsCache}
        allProducts={allProducts}
        loading={loadingMultiJournals}
        onClose={() => setAggregatedModalVisible(false)}
        onOpenShiftDetail={s => {
          setAggregatedModalVisible(false)
          setPastDetailTarget(s)
        }}
      />

      <CalendarPickerModal
        visible={!!calendarModalTarget}
        onClose={() => setCalendarModalTarget(null)}
        selectedDates={
          calendarModalTarget === 'daily_multi'
            ? selectedDailyDates
            : calendarModalTarget === 'daily_start'
              ? [dailyRangeStart]
              : calendarModalTarget === 'daily_end'
                ? [dailyRangeEnd]
                : calendarModalTarget === 'prod_start'
                  ? [prodRangeStart]
                  : [prodRangeEnd]
        }
        isMultiSelect={calendarModalTarget === 'daily_multi'}
        availableDateKeys={availablePastDateKeys}
        onConfirm={dates => {
          if (calendarModalTarget === 'daily_multi') setSelectedDailyDates(dates)
          else if (calendarModalTarget === 'daily_start' && dates[0]) setDailyRangeStart(dates[0])
          else if (calendarModalTarget === 'daily_end' && dates[0]) setDailyRangeEnd(dates[0])
          else if (calendarModalTarget === 'prod_start' && dates[0]) setProdRangeStart(dates[0])
          else if (calendarModalTarget === 'prod_end' && dates[0]) setProdRangeEnd(dates[0])
        }}
      />

      <OperationImagesModal
        visible={!!imagesModalShift}
        shift={imagesModalShift}
        user={userObj}
        journalTarget={imagesJournalTarget}
        onClose={() => {
          setImagesModalShift(null)
          setImagesJournalTarget(null)
        }}
        onChanged={count => {
          if (selectedShift && imagesModalShift?.id === selectedShift.id) {
            setShiftImageCount(count)
            getShiftOperationImages(selectedShift.id)
              .then(l => setShiftImages(l))
              .catch(() => {})
          }
        }}
      />

      <WarehouseAlbumModal
        visible={warehouseAlbumVisible}
        systemCode={activeSysCode}
        companyId={userObj.company_id}
        onClose={() => setWarehouseAlbumVisible(false)}
      />
    </div>
  )
}

export default OperationsDataTab
