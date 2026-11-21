'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  Camera,
  CloudDownload,
  CloudUpload,
  CheckCircle2,
  Check,
  StopCircle,
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
  ChevronLeft,
  ChevronRight,
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
  ConfirmInterimCloseResult,
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
  registerShiftParticipant,
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
  PickedOperationPhoto,
  uploadOperationImages,
  getShiftOperationImages,
  syncOfflineOperationImages,
  getOperationImageDisplayUrl,
  getDriveSettings,
  listOperationFolders,
  syncImagesToGoogleDrive,
} from './operations/operationImagesService'
import {
  QuickSnapItem,
  getAllQuickSnaps,
  addQuickSnap,
  updateQuickSnapShift,
  removeQuickSnap,
} from './operations/quickSnapStore'
import QuickSnapCameraModal from './operations/QuickSnapCameraModal'
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
  QuickSnapQueueModal,
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
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [editJournalTarget, setEditJournalTarget] = useState<JournalRecord | null>(null)
  const [historyProductTarget, setHistoryProductTarget] = useState<ShiftProductItem | null>(null)
  const [pastDetailTarget, setPastDetailTarget] = useState<DeliveryShift | null>(null)
  const [imagesModalShift, setImagesModalShift] = useState<DeliveryShift | null>(null)
  const [imagesJournalTarget, setImagesJournalTarget] = useState<JournalImageTarget | null>(null)
  const [warehouseAlbumVisible, setWarehouseAlbumVisible] = useState(false)
  const [bgUploadingCount, setBgUploadingCount] = useState(0)
  const [quickSnaps, setQuickSnaps] = useState<QuickSnapItem[]>([])
  const [quickSnapModalVisible, setQuickSnapModalVisible] = useState(false)
  const [quickCameraVisible, setQuickCameraVisible] = useState(false)
  const [quickSnapBarCollapsed, setQuickSnapBarCollapsed] = useState(false)

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
    if (selectedShift && !selectedShift.id.startsWith('local_') && userObj) {
      void registerShiftParticipant(selectedShift.id, userObj)
    }
  }, [selectedShift, loadSelectedShiftDetails, userObj])

  // ── REALTIME ĐỒNG BỘ KHI ĐỒNG NGHIỆP CHỐT CA TẠM HOẶC ĐẨY SỐ LIỆU ──
  useEffect(() => {
    const shiftId = selectedShift?.id
    if (!shiftId || shiftId.startsWith('local_')) return

    const channel = supabase
      .channel(`scanner_solieu_shift_${shiftId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_shifts', filter: `id=eq.${shiftId}` },
        () => {
          void getOpenShifts(activeSysCode).then(shifts => {
            setOpenShifts(shifts)
          })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_sub_shifts', filter: `shift_id=eq.${shiftId}` },
        () => {
          void loadSelectedShiftDetails(selectedShift)
          void getOpenShifts(activeSysCode).then(shifts => setOpenShifts(shifts))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_journal' },
        (payload: any) => {
          const notesStr = String(payload?.new?.notes || payload?.old?.notes || '')
          if (notesStr.includes(`[CV_ID: ${shiftId}]`)) {
            void loadSelectedShiftDetails(selectedShift)
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [selectedShift, activeSysCode, loadSelectedShiftDetails])

  // ── TỰ ĐỘNG ĐỒNG BỘ NGẦM ẢNH OFFLINE & GOOGLE DRIVE KHI CÓ MẠNG ──
  const bgImageSyncLockRef = useRef(false)
  const runBackgroundImageSync = useCallback(async () => {
    if (bgImageSyncLockRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    bgImageSyncLockRef.current = true
    try {
      await syncOperationsOfflineQueue().catch(() => {})
      const syncedOffline = await syncOfflineOperationImages().catch(() => 0)
      if (syncedOffline > 0) {
        await refreshPendingQueueCount()
      }

      if (selectedShift) {
        const imgs = await getShiftOperationImages(selectedShift.id).catch(() => [])
        setShiftImages(imgs)
        setShiftImageCount(imgs.length)

        const cfg = await getDriveSettings(selectedShift.system_code).catch(() => null)
        if (cfg?.auto_sync_enabled && cfg.webhook_url?.trim()) {
          const pendingDrive = imgs.filter(img => !img.is_offline && !img.drive_file_id)
          if (pendingDrive.length > 0) {
            const folders = await listOperationFolders(
              selectedShift.system_code,
              selectedShift.company_id || userObj.company_id || null
            ).catch(() => [])
            const res = await syncImagesToGoogleDrive({
              images: pendingDrive,
              systemCode: selectedShift.system_code,
              folders,
            }).catch(() => null)
            if (res && res.syncedCount > 0) {
              const updated = await getShiftOperationImages(selectedShift.id).catch(() => imgs)
              setShiftImages(updated)
              setShiftImageCount(updated.length)
            }
          }
        }
      }
    } finally {
      bgImageSyncLockRef.current = false
    }
  }, [selectedShift, refreshPendingQueueCount, userObj.company_id])

  useEffect(() => {
    void runBackgroundImageSync()
    const handleOnline = () => {
      void runBackgroundImageSync()
    }
    window.addEventListener('online', handleOnline)
    const timer = setInterval(() => {
      void runBackgroundImageSync()
    }, 45000)
    return () => {
      window.removeEventListener('online', handleOnline)
      clearInterval(timer)
    }
  }, [runBackgroundImageSync])

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

  // ── LOGIC LỌC ĐỢT HIỆN TẠI VS TOÀN CA (ĐỒNG BỘ CHUẨN CẢ THEO MỐC THỜI GIAN & JOURNAL_IDS) ──
  const closedJournalIdsSet = useMemo(() => {
    const set = new Set<string>()
    subShifts.forEach(ss => {
      ;(ss.summary_data?.journal_ids || []).forEach(id => set.add(id))
    })
    return set
  }, [subShifts])

  const latestSubShiftToTime = useMemo(() => {
    if (subShifts.length === 0) return 0
    return subShifts.reduce((max, s) => {
      const t = s.to_time ? new Date(s.to_time).getTime() : 0
      return t > max ? t : max
    }, 0)
  }, [subShifts])

  const currentBatchJournals = useMemo(() => {
    if (subShifts.length === 0) return allJournals
    return allJournals.filter(j => {
      if (closedJournalIdsSet.has(j.id)) return false
      if (latestSubShiftToTime > 0 && j.sent_at) {
        const jTime = new Date(j.sent_at).getTime()
        if (!Number.isNaN(jTime) && jTime <= latestSubShiftToTime) return false
      }
      return true
    })
  }, [allJournals, subShifts.length, closedJournalIdsSet, latestSubShiftToTime])

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
    const byId = new Map<string, ShiftProductItem>()
    const byName = new Map<string, ShiftProductItem>()
    allProducts.forEach(p => {
      if (p.id) byId.set(p.id, p)
      if (p.name) byName.set(p.name.trim().toLowerCase(), p)
    })

    const enrichFromCatalog = (p: ShiftProductItem): ShiftProductItem => {
      const fresh =
        (p.id && byId.get(p.id)) ||
        (p.name ? byName.get(p.name.trim().toLowerCase()) : undefined)
      if (!fresh) return p
      return {
        ...p,
        units: fresh.units,
        defaultUnit: fresh.defaultUnit,
        unit: fresh.unit || p.unit,
        aliases: fresh.aliases ?? p.aliases,
        internal_code: fresh.internal_code ?? p.internal_code,
        internal_name: fresh.internal_name ?? p.internal_name,
      }
    }

    const raw = selectedShift?.summary_data?.pinned_products
    if (Array.isArray(raw) && raw.length > 0) return raw.map(enrichFromCatalog)

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

  // Danh sách SP vừa thao tác gần nhất trong ca (đẩy lên đầu danh sách & dùng cho Quick Snap)
  const recentProductOrder = useMemo(() => {
    const order = new Map<string, number>()
    allJournals.forEach((j, idx) => {
      const key = (j.item_name || '').trim().toLowerCase()
      if (key && !order.has(key)) {
        order.set(key, idx)
      }
    })
    return order
  }, [allJournals])

  const recentProducts = useMemo(() => {
    if (recentProductOrder.size === 0) return []
    return [...allProducts]
      .filter(p => recentProductOrder.has(p.name.trim().toLowerCase()))
      .sort(
        (a, b) =>
          (recentProductOrder.get(a.name.trim().toLowerCase()) ?? 9999) -
          (recentProductOrder.get(b.name.trim().toLowerCase()) ?? 9999)
      )
      .slice(0, 8)
  }, [allProducts, recentProductOrder])

  // Danh sách sản phẩm hiển thị chính
  const displayedProducts = useMemo(() => {
    const baseList =
      searchMode === 'pin'
        ? allProducts
        : pinnedProducts

    if (!searchQuery.trim()) {
      if (searchMode === 'filter' && recentProductOrder.size > 0) {
        return [...baseList].sort((a, b) => {
          const ia = recentProductOrder.get(a.name.trim().toLowerCase())
          const ib = recentProductOrder.get(b.name.trim().toLowerCase())
          if (ia !== undefined && ib !== undefined) return ia - ib
          if (ia !== undefined) return -1
          if (ib !== undefined) return 1
          return 0
        })
      }
      return baseList
    }

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
  }, [searchMode, allProducts, pinnedProducts, searchQuery, matchProductMultiKeyword, recentProductOrder])

  useEffect(() => {
    void getAllQuickSnaps().then(setQuickSnaps)
  }, [])

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

  const submitEntryZeroLag = (
    prod: ShiftProductItem,
    data: {
      direction: 'in' | 'out'
      quantity: number
      unit: string
      notes: string
      photos?: PickedOperationPhoto[]
    },
    overrideShift?: DeliveryShift
  ) => {
    const targetShift = overrideShift || selectedShift
    if (!targetShift) return
    const isCurrentShift = targetShift.id === selectedShift?.id

    // 1. Tự động ghim sản phẩm vào ca nếu chưa ghim (Optimistic)
    const targetPinned = Array.isArray(targetShift.summary_data?.pinned_products)
      ? targetShift.summary_data.pinned_products
      : []
    if (!targetPinned.some(p => p.id === prod.id)) {
      const nextPinned = [...targetPinned, prod]
      setOpenShifts(prev =>
        prev.map(s =>
          s.id === targetShift.id
            ? { ...s, summary_data: { ...(s.summary_data || {}), pinned_products: nextPinned } }
            : s
        )
      )
      void updateShiftPinnedProducts(targetShift.id, nextPinned, targetShift.summary_data)
    }

    // 2. Cập nhật giao diện tức thì 0ms (Optimistic UI)
    const tempId = `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    if (isCurrentShift) {
      const tempJournal: JournalRecord = {
        id: tempId,
        delivery_code: `SO-LIEU-${Date.now().toString().slice(-6)}`,
        item_name: prod.name,
        quantity_sent: data.quantity,
        unit: data.unit,
        direction: data.direction,
        from_department: data.direction === 'in' ? 'Sản xuất' : 'Kho',
        to_department: data.direction === 'in' ? 'Kho' : 'Sản xuất',
        status: data.direction === 'in' ? 'received_by_warehouse' : 'received_by_production',
        notes: `[CV_ID: ${targetShift.id}] [PID: ${prod.id}] [SKU: ${prod.sku || ''}] ${
          data.direction === 'in' ? 'Nhập kho' : 'Xuất kho'
        }${data.notes ? ` - ${data.notes}` : ''}`,
        sent_by_name: userObj?.full_name || 'Nhân viên kho',
        sent_at: new Date().toISOString(),
        system_code: activeSysCode,
      }
      setAllJournals(prev => [tempJournal, ...prev])
    }

    showToast(
      `Đã ghi ${data.direction === 'in' ? 'NHẬP +' : 'XUẤT -'}${data.quantity} ${data.unit} (${prod.name})`
    )

    // 3. Đẩy dữ liệu & upload ảnh hoàn toàn ở nền (không chặn thao tác kế tiếp)
    const photoCount = data.photos?.length || 0
    if (photoCount > 0) setBgUploadingCount(c => c + photoCount)

    void (async () => {
      try {
        const createdJournal = await createShiftJournalEntry({
          shift: targetShift,
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

        if (isCurrentShift) {
          setAllJournals(prev => prev.map(j => (j.id === tempId ? createdJournal : j)))
        }

        if (data.photos && data.photos.length > 0) {
          const uploaded = await uploadOperationImages({
            images: data.photos,
            systemCode: targetShift.system_code,
            companyId: targetShift.company_id || userObj.company_id,
            shiftId: targetShift.id,
            journalId: createdJournal.id,
            scope: 'journal',
            direction: data.direction,
            jobName: targetShift.summary_data?.job_name || targetShift.notes || 'Công việc',
            itemName: prod.name,
            itemSku: prod.sku,
            quantity: data.quantity,
            unit: data.unit,
            notes: data.notes,
            user: userObj,
          })
          if (isCurrentShift) {
            setShiftImages(prev => [...uploaded, ...prev])
            setShiftImageCount(c => c + uploaded.length)
          }
        }
        await refreshPendingQueueCount()
      } catch (err) {
        console.warn('Lỗi đồng bộ ngầm lượt ghi nhận:', err)
      } finally {
        if (photoCount > 0) {
          setBgUploadingCount(c => Math.max(0, c - photoCount))
        }
      }
    })()
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
    submitEntryZeroLag(prod, data)
  }

  const handleQuickSnapCaptured = ({
    shift,
    photo,
  }: {
    shift: DeliveryShift
    photo: PickedOperationPhoto
  }) => {
    const snap: QuickSnapItem = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      shiftId: shift.id,
      jobName: shift.summary_data?.job_name || shift.notes || 'Công việc',
      systemCode: shift.system_code || activeSysCode,
      capturedAt: new Date().toISOString(),
      photo,
    }
    setQuickSnaps(prev => [...prev, snap])
    void addQuickSnap(snap)
  }

  const handleDeleteQuickSnap = async (id: string) => {
    await removeQuickSnap(id)
    setQuickSnaps(prev => prev.filter(s => s.id !== id))
  }

  const handleChangeQuickSnapShift = async (snapId: string, shift: DeliveryShift) => {
    const jobName = shift.summary_data?.job_name || shift.notes || 'Công việc'
    setQuickSnaps(prev =>
      prev.map(s => (s.id === snapId ? { ...s, shiftId: shift.id, jobName } : s))
    )
    await updateQuickSnapShift(snapId, shift.id, jobName)
  }

  const handleSaveQuickSnapToAlbum = (snap: QuickSnapItem) => {
    const targetShift = openShifts.find(s => s.id === snap.shiftId) || selectedShift
    if (!targetShift) return

    setBgUploadingCount(c => c + 1)
    void uploadOperationImages({
      images: [snap.photo],
      systemCode: targetShift.system_code,
      companyId: targetShift.company_id || userObj.company_id,
      shiftId: targetShift.id,
      scope: 'shift',
      jobName: targetShift.summary_data?.job_name || targetShift.notes || snap.jobName || 'Công việc',
      user: userObj,
    })
      .then(uploaded => {
        if (targetShift.id === selectedShift?.id) {
          setShiftImages(prev => [...uploaded, ...prev])
          setShiftImageCount(c => c + uploaded.length)
        }
      })
      .catch(e => console.warn('Save quick snap to album error:', e))
      .finally(() => {
        setBgUploadingCount(c => Math.max(0, c - 1))
      })

    void removeQuickSnap(snap.id)
    setQuickSnaps(prev => prev.filter(s => s.id !== snap.id))
    showToast(`📸 Đã lưu thẳng ảnh vào Album (${snap.jobName})`)
  }

  const handleAssignQuickSnap = (
    snap: QuickSnapItem,
    payload: {
      product: ShiftProductItem
      direction: 'in' | 'out'
      quantity: number
      unit: string
      notes: string
    }
  ) => {
    const targetShift = openShifts.find(s => s.id === snap.shiftId) || selectedShift || undefined
    submitEntryZeroLag(
      payload.product,
      {
        direction: payload.direction,
        quantity: payload.quantity,
        unit: payload.unit,
        notes: payload.notes,
        photos: [snap.photo],
      },
      targetShift
    )
    void removeQuickSnap(snap.id)
    setQuickSnaps(prev => prev.filter(s => s.id !== snap.id))
  }

  const handleInterimCloseCompleted = async (result: ConfirmInterimCloseResult) => {
    if (!selectedShift) return
    if (result.status === 'finalized') {
      await clearShiftReconciliations(selectedShift.id, selectedShift.summary_data)
      setReconcileSessions([])
      setViewScope('current_batch')
      showToast(`Đã hoàn tất chốt ca tạm đợt #${result.sub_shift_number}!`)
    } else {
      const missingNames = result.missing_users.map(m => m.user_name).join(', ')
      showToast(
        missingNames
          ? `Bạn đã chốt Đợt #${result.sub_shift_number} (${result.confirmed_count}/${result.total_participants}) • Chờ: ${missingNames}`
          : `Bạn đã chốt Đợt #${result.sub_shift_number} • Đang chờ đồng nghiệp khác`
      )
    }
    const freshShifts = await getOpenShifts(activeSysCode)
    setOpenShifts(freshShifts)
    const freshTarget = freshShifts.find(s => s.id === selectedShift.id) || selectedShift
    await loadSelectedShiftDetails(freshTarget)
    await refreshPendingQueueCount()
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
    <div className="flex flex-col h-full bg-stone-50 text-stone-900 select-none overflow-hidden">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold shadow-xl border border-emerald-400 max-w-[90vw] text-center">
          {toastMsg}
        </div>
      )}

      {/* Offline Queue Banner */}
      {pendingSyncCount > 0 && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-amber-800">
            ⏳ Có {pendingSyncCount} thao tác lưu ngoại tuyến chờ đẩy lên Web
          </span>
          <button
            type="button"
            disabled={syncingOffline}
            onClick={handleSyncOfflineQueueNow}
            className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-extrabold flex items-center gap-1 shrink-0"
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

      {/* Background Image Upload Indicator */}
      {bgUploadingCount > 0 && (
        <div className="px-3 py-1 bg-sky-50 border-b border-sky-200 flex items-center justify-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin text-sky-600" />
          <span className="text-[11px] font-bold text-sky-700">
            Đang đẩy ngầm {bgUploadingCount} ảnh lên hệ thống (bạn vẫn thao tác bình thường)...
          </span>
        </div>
      )}

      {/* ── TOP HEADER GỌN SÁNG CHUẨN /SO-LIEU MOBILE ── */}
      <div className="px-3 pt-2.5 pb-2 bg-white border-b border-stone-200 space-y-2 shrink-0">
        {/* Hàng 1: Segmented Pill Đang làm / Đã hoàn thành */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-full">
          <button
            type="button"
            onClick={() => setMainTab('active')}
            className={`h-8 rounded-full text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
              mainTab === 'active'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                openShifts.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'
              }`}
            />
            <span>Đang làm ({openShifts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('done')}
            className={`h-8 rounded-full text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
              mainTab === 'done'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Đã hoàn thành ({pastShifts.length})</span>
          </button>
        </div>

        {/* Hàng 2 & 3 (chỉ hiển thị khi đang ở tab Đang làm) */}
        {mainTab === 'active' && (
          <>
            <div className="flex items-center gap-2">
              {openShifts.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setOpenJobModalVisible(true)}
                  className="flex-1 h-11 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo Công Việc Mới</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowJobDropdown(v => !v)}
                  className="flex-1 min-w-0 h-11 px-3.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2.5 text-left shadow-sm active:scale-[0.99] transition"
                >
                  <Briefcase className="w-4 h-4 shrink-0 opacity-90" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-medium leading-none opacity-80">
                      Công việc {openShifts.length > 1 ? `(${openShifts.length} đang mở)` : ''}
                    </div>
                    <div className="text-[13px] font-extrabold truncate leading-tight mt-0.5">
                      {selectedShift?.summary_data?.job_name ||
                        selectedShift?.notes ||
                        'Công việc'}
                    </div>
                  </div>
                  <span className="text-[11px] opacity-85 shrink-0">
                    {showJobDropdown ? '▲' : '▼'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActionMenuOpen(true)}
                title="Thao tác công việc"
                className="relative w-11 h-11 shrink-0 rounded-full bg-white border border-stone-200 hover:bg-stone-50 text-stone-600 flex items-center justify-center text-lg font-black leading-none shadow-2xs active:scale-95 transition"
              >
                <span>⋯</span>
                {(selectedShift?.summary_data?.pending_interim_close || pendingSyncCount > 0) && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white" />
                )}
              </button>
            </div>

            {/* Sổ danh sách công việc đang mở (Light theme) */}
            {showJobDropdown && openShifts.length > 0 && (
              <div className="rounded-2xl bg-stone-50 border border-stone-200 p-2 max-h-60 overflow-y-auto space-y-1">
                <div className="text-[11px] font-bold text-stone-500 px-1.5 pb-1 flex items-center justify-between">
                  <span>Chọn công việc để ghi nhận:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowJobDropdown(false)
                      setOpenJobModalVisible(true)
                    }}
                    className="text-indigo-600 font-extrabold flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Thêm mới
                  </button>
                </div>
                {openShifts.map(s => {
                  const isCur = s.id === selectedShiftId
                  const name = s.summary_data?.job_name || s.notes || 'Công việc'
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition ${
                        isCur
                          ? 'bg-indigo-50 border-indigo-300'
                          : 'bg-white border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedShiftId(s.id)
                          setShowJobDropdown(false)
                        }}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left"
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isCur ? 'bg-indigo-600' : 'bg-emerald-500'
                          }`}
                        />
                        <span
                          className={`flex-1 text-xs truncate ${
                            isCur ? 'text-indigo-700 font-extrabold' : 'text-stone-800 font-semibold'
                          }`}
                        >
                          {name}
                        </span>
                        {isCur && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                      </button>
                      <button
                        type="button"
                        title="Xóa công việc này"
                        onClick={e => {
                          e.stopPropagation()
                          void handleDeleteOpenShift(s)
                        }}
                        className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Hàng 3: Ô tìm kiếm bo tròn pill (Nhập / Ghim) + Autocomplete */}
            {selectedShift && (
              <div className="relative">
                <div
                  className={`flex items-center gap-1.5 h-10 px-1.5 rounded-full bg-white border transition ${
                    searchMode === 'filter'
                      ? 'border-indigo-300 focus-within:border-indigo-500'
                      : 'border-amber-400 focus-within:border-amber-500'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSearchMode(prev => (prev === 'filter' ? 'pin' : 'filter'))
                      setSearchQuery('')
                    }}
                    title="Bấm chuyển đổi chế độ tìm kiếm Nhập / Ghim"
                    className={`h-7 px-2.5 rounded-full flex items-center gap-1 text-[11px] font-black shrink-0 border transition ${
                      searchMode === 'filter'
                        ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5 shrink-0" />
                    <span>{searchMode === 'filter' ? 'Nhập' : 'Ghim'}</span>
                  </button>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value)
                      setShowSearchSuggestions(true)
                    }}
                    onFocus={() => setShowSearchSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 180)}
                    placeholder={
                      searchMode === 'filter'
                        ? 'Tìm SP đã ghim (Bấm 🔍 đổi chế độ)'
                        : 'Tìm SP từ kho để ghim (Bấm 🔍 đổi chế độ)'
                    }
                    className="flex-1 bg-transparent text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none min-w-0 pr-1"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('')
                        setShowSearchSuggestions(false)
                      }}
                      className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-600 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* AUTOCOMPLETE DROPDOWN GỢI Ý SẢN PHẨM (Light theme) */}
                {showSearchSuggestions &&
                  searchQuery.trim().length > 0 &&
                  activeSearchSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 rounded-2xl bg-white border border-indigo-200 shadow-xl overflow-hidden z-40 max-h-64 overflow-y-auto divide-y divide-stone-100">
                      <div className="px-3 py-1.5 bg-stone-50 text-[10px] font-extrabold text-stone-500 flex items-center justify-between">
                        <span>GỢI Ý SẢN PHẨM ({activeSearchSuggestions.length})</span>
                        <span className="text-indigo-600">
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
                            className="w-full px-3 py-2 text-left hover:bg-indigo-50/60 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {sug.aliases && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                                    {sug.aliases}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-stone-900 truncate">
                                  {sug.name}
                                </span>
                              </div>
                              <div className="text-[10px] text-stone-500 mt-0.5">
                                SKU: <b className="text-indigo-600">{sug.sku || '---'}</b>
                                {sug.internal_code ? ` • Nội bộ: ${sug.internal_code}` : ''}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold shrink-0 ${
                                searchMode === 'pin'
                                  ? isPinned
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-stone-100 text-stone-600'
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
            )}
          </>
        )}
      </div>

      {/* ── BODY ── */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-stone-500">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
          <span className="text-xs font-semibold">Đang tải dữ liệu tác nghiệp...</span>
        </div>
      ) : mainTab === 'active' ? (
        /* =========================================================
         * TAB 1: ĐANG LÀM (ACTIVE SHIFTS - LIGHT THEME CHUẨN /SO-LIEU)
         * ========================================================= */
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pt-2.5 space-y-2.5 pb-24">
          {selectedShift && (
            <>
              {/* Thanh chú thích: Chạm vào sản phẩm để nhập số | N = Nhập  X = Xuất */}
              <div className="flex items-center justify-between px-1 text-[11px] text-stone-500">
                <span>Chạm vào sản phẩm để nhập số</span>
                <span className="flex items-center gap-3">
                  <span className="text-emerald-600 font-bold">N = Nhập</span>
                  <span className="text-rose-600 font-bold">X = Xuất</span>
                </span>
              </div>

              {searchMode === 'pin' && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[11px] text-stone-700 font-semibold">
                    Đã ghim: <b className="text-amber-700">{pinnedProducts.length}</b>/{allProducts.length} SP
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
                      className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-amber-500 text-white disabled:opacity-40 transition"
                    >
                      {searchQuery.trim()
                        ? `Ghim lọc (${displayedProducts.length})`
                        : 'Ghim tất cả'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUnpinAllProducts()}
                      disabled={pinnedProducts.length === 0}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-rose-600 border border-rose-200 disabled:opacity-40 transition"
                    >
                      {searchQuery.trim() ? 'Bỏ ghim lọc' : 'Bỏ ghim tất cả'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── DANH SÁCH THẺ SẢN PHẨM SÁNG CHUẨN HÌNH 1 ── */}
              <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-200 overflow-hidden shadow-xs">
                {displayedProducts.slice(0, productDisplayLimit).map((item, index) => {
                  const isAltRow = index % 2 === 1
                  const isPinned = pinnedIdsSet.has(item.id)
                  const defUnit =
                    item.defaultUnit ||
                    pickDefaultProductUnit(item.units || [], item.unit) ||
                    item.defaultUnit ||
                    item.unit ||
                    ''

                  const activeUnitsForProd = productStatsList
                    .filter(ps => ps.name.toLowerCase() === item.name.toLowerCase())
                    .map(ps => ps.unit)
                  const displayUnits = Array.from(new Set([defUnit, ...activeUnitsForProd].filter(Boolean)))

                  return (
                    <div
                      key={item.id}
                      onClick={() => setNumPadTarget({ product: item, unit: defUnit })}
                      className={`p-3 cursor-pointer transition-colors border-l-4 active:bg-indigo-50/70 ${
                        isAltRow
                          ? 'bg-amber-50/35 border-l-amber-500'
                          : 'bg-white border-l-indigo-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span
                            className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 border ${
                              isAltRow
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-bold text-stone-900 leading-snug break-words">
                              {item.name}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {item.sku && (
                                <span className="text-[10px] font-mono text-stone-400">
                                  {item.sku}
                                </span>
                              )}
                              {item.aliases && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                                  {item.aliases}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              setHistoryProductTarget(item)
                            }}
                            title="Xem lịch sử sản phẩm này"
                            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-indigo-50 text-stone-500 hover:text-indigo-600 flex items-center justify-center transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {searchMode === 'pin' && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                handleTogglePinProduct(item)
                              }}
                              className={`px-2.5 h-8 rounded-full text-[10px] font-extrabold flex items-center gap-1 border ${
                                isPinned
                                  ? 'bg-amber-500 border-amber-500 text-white'
                                  : 'bg-stone-100 border-stone-200 text-stone-600'
                              }`}
                            >
                              <Pin className="w-3 h-3" />
                              <span>{isPinned ? 'Đã ghim' : 'Ghim'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Viên thuốc Đơn Vị Tính (chuẩn Hình 1) */}
                      <div className="mt-2.5 space-y-1.5">
                        {displayUnits.map(u => {
                          const st = productQtyMap.get(`${item.name.trim()}___${u}`)
                          const inQ = st?.inQty || 0
                          const outQ = st?.outQty || 0
                          const isDef = u === defUnit
                          return (
                            <button
                              key={u}
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                setNumPadTarget({ product: item, unit: u })
                              }}
                              className={`w-full px-3 py-1.5 rounded-full border flex items-center justify-between gap-2 text-left active:scale-[0.99] transition ${
                                isDef
                                  ? 'bg-indigo-50/90 border-indigo-300'
                                  : 'bg-stone-50 border-stone-200'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`text-xs font-extrabold truncate ${
                                    isDef ? 'text-indigo-700' : 'text-stone-700'
                                  }`}
                                >
                                  {u}
                                </span>
                                {isDef && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2.5 text-xs font-black tabular-nums shrink-0">
                                <span className={inQ > 0 ? 'text-emerald-600' : 'text-stone-400'}>
                                  Nhập: +{inQ}
                                </span>
                                <span className="text-stone-300">|</span>
                                <span className={outQ > 0 ? 'text-rose-600' : 'text-stone-400'}>
                                  Xuất: -{outQ}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {displayedProducts.length === 0 && (
                  <div className="p-6 text-center text-xs text-stone-500">
                    {searchMode === 'pin'
                      ? 'Không tìm thấy sản phẩm nào trong kho.'
                      : 'Chưa có sản phẩm nào được ghim. Bấm nút 🔍 Nhập đổi sang Ghim để thêm sản phẩm.'}
                  </div>
                )}
              </div>

              {displayedProducts.length > productDisplayLimit && (
                <button
                  type="button"
                  onClick={() => setProductDisplayLimit(prev => prev + 40)}
                  className="w-full py-2.5 rounded-xl bg-white border border-stone-200 text-xs font-extrabold text-indigo-600 shadow-2xs"
                >
                  Xem thêm sản phẩm ({displayedProducts.length - productDisplayLimit} còn lại)...
                </button>
              )}

              {/* ── BANNER TRẠNG THÁI ĐANG CHỜ CHỐT CA TẠM ĐA NGƯỜI DÙNG ── */}
              {selectedShift?.summary_data?.pending_interim_close && (() => {
                const pend = selectedShift.summary_data!.pending_interim_close!
                const confs = pend.confirmations || []
                const myId = userObj?.id ? String(userObj.id) : ''
                const myName = (userObj?.full_name || userObj?.email || '').trim().toLowerCase()
                const iDone = confs.some(
                  c =>
                    (myId && c.user_id && String(c.user_id) === myId) ||
                    (myName && (c.user_name || '').trim().toLowerCase() === myName)
                )
                return (
                  <button
                    type="button"
                    onClick={() => setInterimModalVisible(true)}
                    className={`w-full mt-3 px-3 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 ${
                      iDone
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                        : 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {iDone
                            ? `Bạn đã chốt tạm Đợt #${pend.sub_shift_number} (${confs.length} người đã chốt) — Đang chờ người khác`
                            : `Đang chốt tạm Đợt #${pend.sub_shift_number} (${confs.map(c => c.user_name).join(', ')} đã chốt) — Chờ bạn chốt!`}
                        </span>
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        Bấm vào đây để xem danh sách ai đã chốt / ai chưa chốt
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-extrabold shrink-0">
                      Xem
                    </span>
                  </button>
                )
              })()}

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
                    {subShifts.map((sub, sIdx) => {
                      const isExp = !!expandedSubShiftIds[sub.id]
                      const subIds = new Set(sub.summary_data?.journal_ids || [])
                      const hasExplicitIds = subIds.size > 0
                      const ssFrom = sub.from_time ? new Date(sub.from_time).getTime() : 0
                      const ssTo = sub.to_time ? new Date(sub.to_time).getTime() : 0
                      const prevTo =
                        sIdx > 0 && subShifts[sIdx - 1]?.to_time
                          ? new Date(subShifts[sIdx - 1].to_time).getTime()
                          : ssFrom
                      const subJournals = allJournals.filter(j => {
                        if (historyFilter !== 'all' && j.direction !== historyFilter) return false
                        if (hasExplicitIds) return subIds.has(j.id)
                        const jTime = j.sent_at ? new Date(j.sent_at).getTime() : 0
                        return sIdx === 0
                          ? jTime >= ssFrom && jTime <= ssTo
                          : jTime > prevTo && jTime <= ssTo
                      })
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

          <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-3 space-y-3 pb-24">
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

      {/* ── FLOATING QUICK SNAP BAR (CHỤP NHANH 1 CHẠM KHI DỒN DẬP) ── */}
      {mainTab === 'active' && selectedShift && (
        quickSnapBarCollapsed ? (
          <button
            type="button"
            onClick={() => setQuickSnapBarCollapsed(false)}
            title="Mở rộng Chụp nhanh / Chờ gán"
            className={`fixed bottom-20 right-0 z-30 h-10 pl-2.5 pr-2 rounded-l-full bg-slate-900/95 hover:bg-slate-800 border border-r-0 ${
              quickSnaps.length > 0 ? 'border-amber-500' : 'border-sky-400'
            } shadow-xl flex items-center gap-1.5 active:scale-95 transition`}
          >
            <ChevronLeft className="w-4 h-4 text-slate-400" />
            <Camera className="w-4 h-4 text-sky-400" />
            {quickSnaps.length > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                {quickSnaps.length}
              </span>
            )}
          </button>
        ) : (
          <div className="fixed bottom-20 right-2.5 z-30 flex items-center gap-1.5">
            {quickSnaps.length > 0 && (
              <button
                type="button"
                onClick={() => setQuickSnapModalVisible(true)}
                className="h-11 px-3.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-xl shadow-amber-950/50 border border-amber-300 flex items-center gap-1.5 active:scale-95 transition"
              >
                <span>Chờ gán</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[11px] font-black">
                  {quickSnaps.length}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setQuickCameraVisible(true)}
              title="Chụp nhanh 1 chạm (chụp bụp ăn luôn)"
              className="h-11 px-3.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs shadow-xl shadow-sky-950/60 border border-sky-400 flex items-center gap-1.5 active:scale-95 transition"
            >
              <Camera className="w-4 h-4" />
              <span>Chụp nhanh</span>
            </button>
            <button
              type="button"
              onClick={() => setQuickSnapBarCollapsed(true)}
              title="Thu gọn thanh chụp nhanh"
              className="w-8 h-11 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-600 shadow-xl flex items-center justify-center active:scale-95 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )
      )}

      {/* ── MODALS ── */}
      <QuickSnapCameraModal
        visible={quickCameraVisible}
        openShifts={openShifts}
        initialShiftId={selectedShift?.id || null}
        totalQueueCount={quickSnaps.length}
        lastThumbUrl={quickSnaps[quickSnaps.length - 1]?.photo?.dataUrl || null}
        systemCode={selectedShift?.system_code || activeSysCode}
        userName={userProfile?.fullName || userObj?.full_name || userObj?.email || null}
        onClose={() => setQuickCameraVisible(false)}
        onOpenQueue={() => setQuickSnapModalVisible(true)}
        onCaptured={handleQuickSnapCaptured}
      />

      <QuickSnapQueueModal
        visible={quickSnapModalVisible}
        snaps={quickSnaps}
        openShifts={openShifts}
        allProducts={allProducts}
        recentProducts={recentProducts}
        onClose={() => setQuickSnapModalVisible(false)}
        onCaptureMore={() => {
          setQuickSnapModalVisible(false)
          setQuickCameraVisible(true)
        }}
        onDeleteSnap={handleDeleteQuickSnap}
        onChangeSnapShift={handleChangeQuickSnapShift}
        onSaveToShiftAlbum={handleSaveQuickSnapToAlbum}
        onAssignSnap={handleAssignQuickSnap}
      />

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

      {/* ── BOTTOM SHEET MENU THAO TÁC (NÚT ⋯) ── */}
      {actionMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setActionMenuOpen(false)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl px-4 pt-3 pb-6 max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-3" />
            {selectedShift && (
              <div className="px-1 mb-2">
                <div className="text-xs font-extrabold text-stone-900 truncate">
                  {selectedShift.summary_data?.job_name || selectedShift.notes || 'Công việc'}
                </div>
                <div className="text-[11px] text-stone-500">
                  {subShifts.length > 0 ? `${subShifts.length} lần chốt tạm • ` : ''}
                  {pinnedProducts.length} SP đã ghim
                </div>
              </div>
            )}
            <div className="divide-y divide-stone-100">
              {selectedShift && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setActionMenuOpen(false)
                      setInterimModalVisible(true)
                    }}
                    className="w-full py-3 flex items-center gap-3 text-left text-xs font-bold text-stone-800 hover:bg-stone-50 px-1 rounded-lg"
                  >
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Chốt ca tạm (Đợt #{subShifts.length + 1})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionMenuOpen(false)
                      setCloseJobModalVisible(true)
                    }}
                    className="w-full py-3 flex items-center gap-3 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 px-1 rounded-lg"
                  >
                    <StopCircle className="w-4 h-4 shrink-0" />
                    <span>Hoàn thành công việc</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionMenuOpen(false)
                      setImagesJournalTarget(null)
                      setImagesModalShift(selectedShift)
                    }}
                    className="w-full py-3 flex items-center gap-3 text-left text-xs font-bold text-stone-800 hover:bg-stone-50 px-1 rounded-lg"
                  >
                    <Camera className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Album ảnh công việc này ({shiftImageCount})</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setActionMenuOpen(false)
                  setOpenJobModalVisible(true)
                }}
                className="w-full py-3 flex items-center gap-3 text-left text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-1 rounded-lg"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Mở công việc mới</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionMenuOpen(false)
                  setWarehouseAlbumVisible(true)
                }}
                className="w-full py-3 flex items-center gap-3 text-left text-xs font-bold text-stone-800 hover:bg-stone-50 px-1 rounded-lg"
              >
                <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Thư viện ảnh theo ngày & công việc</span>
              </button>
              <button
                type="button"
                disabled={syncingOffline}
                onClick={() => {
                  setActionMenuOpen(false)
                  void handleDownloadOfflineAll()
                }}
                className="w-full py-3 flex items-center gap-3 text-left text-xs font-bold text-stone-800 hover:bg-stone-50 px-1 rounded-lg"
              >
                <CloudDownload className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Tải & Đồng bộ dữ liệu ngoại tuyến</span>
              </button>
              {selectedShift && pinnedProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuOpen(false)
                    void handleUnpinAllProducts()
                  }}
                  className="w-full py-3 flex items-center gap-3 text-left text-xs font-bold text-stone-500 hover:bg-stone-50 px-1 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Bỏ ghim tất cả ({pinnedProducts.length} SP)</span>
                </button>
              )}
              {selectedShift && (
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuOpen(false)
                    void handleDeleteOpenShift(selectedShift)
                  }}
                  className="w-full py-3 flex items-center gap-3 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 px-1 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Xóa công việc này</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <InterimCloseModal
        visible={interimModalVisible}
        shift={selectedShift}
        user={userObj}
        currentJournals={currentBatchJournals}
        subShiftNumber={subShifts.length + 1}
        onClose={() => setInterimModalVisible(false)}
        onCompleted={handleInterimCloseCompleted}
        onSyncedReload={async () => {
          if (!selectedShift) return
          const freshShifts = await getOpenShifts(activeSysCode)
          setOpenShifts(freshShifts)
          const freshTarget = freshShifts.find(s => s.id === selectedShift.id) || selectedShift
          await loadSelectedShiftDetails(freshTarget)
          await refreshPendingQueueCount()
        }}
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
