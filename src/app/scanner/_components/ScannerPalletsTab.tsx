'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Scan,
  Boxes,
  Trash2,
  X,
  Search,
  ChevronRight,
  RefreshCw,
  MapPin,
  Database,
  HardDrive,
  SlidersHorizontal,
  Calendar,
  Copy,
  ChevronLeft,
  Edit3,
  Plus,
  Check,
  Loader2,
  Box,
  Clock,
  CheckCircle2,
  CloudUpload,
} from 'lucide-react'
import type {
  PalletItem,
  ProductSuggestion,
  ScannerTab,
} from './types'
import type { OfflinePendingPallet, OfflineStampQueueItem } from '@/lib/scanner-db'
import {
  removePendingPallet,
  getPendingPallets,
  getOfflineMeta,
  setOfflineMeta,
  getOfflineStampQueue,
  syncSingleOfflineStampQueueItem,
  syncAllOfflineStampQueue,
  removeOfflineStampQueueItem,
} from '@/lib/scanner-db'
import { scannerAlert, scannerConfirm } from './ScannerDialog'
import {
  normalizeText,
  matchDate,
  matchProductSearch,
  getProductSuggestions,
  buildCombinedSearchSuggestions,
  ensureProductsCatalogLoaded,
  updatePendingPalletOffline,
  playScanSound,
  triggerHaptic,
} from './scannerUtils'
import { supabase } from '@/lib/supabaseClient'

const PAGE_SIZE = 50

function formatStampThumbnail(
  imgSrc?: string | null,
  cropSrc?: string | null,
  fileId?: string | null
): string {
  const normCrop = cropSrc ? cropSrc.replace(/^https?:\/\/(?:127\.0\.0\.1|localhost):64321/, 'https://api.chanhthu.click') : null
  if (normCrop && !normCrop.includes('drive.google.com/file/d/')) {
    return normCrop
  }
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`
  }
  const normImg = imgSrc ? imgSrc.replace(/^https?:\/\/(?:127\.0\.0\.1|localhost):64321/, 'https://api.chanhthu.click') : null
  if (normImg) {
    const m = normImg.match(/\/d\/([a-zA-Z0-9_-]+)/) || normImg.match(/id=([a-zA-Z0-9_-]+)/)
    if (m && m[1]) {
      return `https://lh3.googleusercontent.com/d/${m[1]}`
    }
    return normImg
  }
  return ''
}

interface ScannerPalletsTabProps {
  activeTab: ScannerTab | string
  setActiveTab: (tab: any) => void
  palletListSubTab: 'pending' | 'stamp_pending' | 'stamp_decoded' | 'cloud'
  setPalletListSubTab: React.Dispatch<React.SetStateAction<'pending' | 'stamp_pending' | 'stamp_decoded' | 'cloud'>>
  isOnline: boolean
  pendingPallets: OfflinePendingPallet[]
  setPendingPallets: React.Dispatch<React.SetStateAction<OfflinePendingPallet[]>>
  isSyncingPending: boolean
  handleSyncPendingQueue: () => Promise<void>
  handleSyncSinglePending: (item: OfflinePendingPallet) => Promise<void>
  palletsList: PalletItem[]
  filteredPallets: PalletItem[]
  displayedPallets: PalletItem[]
  palletFilter: 'all' | 'linked' | 'unlinked'
  setPalletFilter: React.Dispatch<React.SetStateAction<'all' | 'linked' | 'unlinked'>>
  palletDisplayLimit: number
  setPalletDisplayLimit: React.Dispatch<React.SetStateAction<number>>
  searchQuery: string
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>
  showSearchSuggestions: boolean
  setShowSearchSuggestions: React.Dispatch<React.SetStateAction<boolean>>
  productSuggestions: ProductSuggestion[]
  loadAllPallets: () => Promise<any>
  handleOpenPalletDetail: (pallet: PalletItem) => Promise<void>
  setActivePalletStt: React.Dispatch<React.SetStateAction<string>>
  loadCurrentPalletBoxes: (stt: string) => Promise<void>
  triggerToast: (msg: string) => void
}

export function ScannerPalletsTab({
  activeTab,
  setActiveTab,
  palletListSubTab,
  setPalletListSubTab,
  isOnline,
  pendingPallets,
  setPendingPallets,
  isSyncingPending,
  handleSyncPendingQueue,
  handleSyncSinglePending,
  palletsList,
  palletFilter,
  setPalletFilter,
  searchQuery,
  setSearchQuery,
  showSearchSuggestions,
  setShowSearchSuggestions,
  productSuggestions,
  loadAllPallets,
  handleOpenPalletDetail,
  setActivePalletStt,
  loadCurrentPalletBoxes,
  triggerToast,
}: ScannerPalletsTabProps) {
  // Danh mục sản phẩm phục vụ tìm gõ tắt (aliases)
  const [catalogProducts, setCatalogProducts] = useState<ProductSuggestion[]>([])

  // Trạng thái kiểm tra kết nối máy chủ
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'error'>('connected')
  const [serverPingMs, setServerPingMs] = useState<number | null>(null)
  const [refreshingCloud, setRefreshingCloud] = useState(false)

  // Trạng thái lưu Offline LOT
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncingOfflineCloud, setSyncingOfflineCloud] = useState(false)

  // Bộ lọc nâng cao (khớp PalletListScreen.tsx Android)
  const [filterModalVisible, setFilterModalVisible] = useState(false)
  const [filterProduct, setFilterProduct] = useState('')
  const [filterProductionPlace, setFilterProductionPlace] = useState('')
  const [filterMaterialZone, setFilterMaterialZone] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterPackagingDate, setFilterPackagingDate] = useState('')
  const [filterProductionDate, setFilterProductionDate] = useState('')

  // Lịch chọn ngày (Calendar DatePicker)
  const [calendarModalVisible, setCalendarModalVisible] = useState(false)
  const [calendarTargetField, setCalendarTargetField] = useState<'packaging' | 'production'>('packaging')
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear())

  // Phân trang mượt (50 LOT/trang)
  const [currentPage, setCurrentPage] = useState(1)

  // Modal xem & sửa thùng của Pallet ngoại tuyến (Pending Pallet Detail)
  const [selectedPendingPallet, setSelectedPendingPallet] = useState<OfflinePendingPallet | null>(null)
  const [pendingCloneBoxIdx, setPendingCloneBoxIdx] = useState<number | null>(null)
  const [pendingCloneCount, setPendingCloneCount] = useState<string>('1')

  // Hàng đợi con dấu AI (Chờ giải mã & Đã giải mã)
  const [stampQueueItems, setStampQueueItems] = useState<any[]>([])
  const [loadingStampQueue, setLoadingStampQueue] = useState(false)
  const [decodingQueueId, setDecodingQueueId] = useState<string | null>(null)
  const [isDecodingAllQueue, setIsDecodingAllQueue] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  const loadStampQueue = useCallback(async () => {
    try {
      // 1. Nạp tức thì danh sách offline từ IndexedDB (0ms)
      const offlineItems = await getOfflineStampQueue()
      const mappedOffline = offlineItems.map(i => ({
        id: i.id,
        is_offline: true,
        pallet_stt: i.pallet_stt,
        pallet_tag: i.pallet_tag,
        pallet_notes: i.pallet_notes,
        box_count: i.box_count,
        box_weight: i.box_weight,
        image_url: i.photo_base64,
        cropped_image_url: i.crop_base64,
        created_at: i.created_at,
        status: i.status === 'error' ? 'error' : 'pending',
        error_message: i.error_message,
      }))

      if (mappedOffline.length > 0) {
        setStampQueueItems(prev => {
          const onlineExisting = prev.filter(p => !p.is_offline)
          return [...mappedOffline, ...onlineExisting]
        })
      }

      // 2. Fetch danh sách online kèm timeout 2.5s (tránh bị treo khi offline)
      let onlineItems: any[] = []
      try {
        const fetchOnlinePromise = (supabase as any)
          .from('stamp_scan_queue')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(60)
        const timeoutPromise = new Promise<{ data: any[]; error: any }>(resolve =>
          setTimeout(() => resolve({ data: [], error: null }), 2500)
        )
        const { data, error } = await Promise.race([fetchOnlinePromise, timeoutPromise])
        if (!error && data && data.length > 0) {
          onlineItems = data
        }
      } catch (err) {
        console.warn('Lỗi query supabase stamp_scan_queue:', err)
      }

      // Gộp offline lên đầu danh sách để người dùng thấy ngay
      setStampQueueItems([...mappedOffline, ...onlineItems])
    } catch (err) {
      console.warn('Lỗi loadStampQueue:', err)
    }
  }, [])

  const handleSyncOfflineItem = async (id: string) => {
    try {
      triggerToast('Đang tải ảnh con dấu lên Server...')
      const ok = await syncSingleOfflineStampQueueItem(id)
      if (ok) {
        triggerToast('✅ Đã tải ảnh con dấu lên Server thành công!')
        await loadStampQueue()
      } else {
        alert('Tải ảnh thất bại. Vui lòng kiểm tra lại kết nối mạng!')
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleSyncAllOfflineStamps = async () => {
    try {
      triggerToast('Đang đẩy toàn bộ ảnh ngoại tuyến lên Server...')
      const { synced, failed } = await syncAllOfflineStampQueue()
      if (synced > 0) {
        triggerToast(`🎉 Đã tải lên thành công ${synced} đợt con dấu!`)
      }
      if (failed > 0) {
        triggerToast(`⚠️ Có ${failed} đợt lỗi mạng`)
      }
      await loadStampQueue()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleDeleteOfflineStampItem = async (id: string) => {
    const ok = await scannerConfirm({
      title: 'Xóa ảnh ngoại tuyến',
      message: 'Bạn có chắc chắn muốn xóa đợt ảnh con dấu ngoại tuyến này không?',
      confirmText: 'Xóa ngay',
      cancelText: 'Hủy',
      variant: 'danger',
    })
    if (ok) {
      await removeOfflineStampQueueItem(id)
      await loadStampQueue()
      triggerToast('Đã xóa đợt ảnh ngoại tuyến')
    }
  }

  useEffect(() => {
    if (activeTab === 'pallets') {
      loadStampQueue()
    }
  }, [activeTab, loadStampQueue])

  // Lắng nghe Realtime bảng stamp_scan_queue
  useEffect(() => {
    const channel = supabase
      .channel('web_scanner_stamp_queue_tab')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stamp_scan_queue' },
        () => {
          loadStampQueue()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadStampQueue])

  const handleDecodeItem = async (id: string) => {
    setDecodingQueueId(id)
    try {
      const res = await fetch('/api/stamp-queue/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
      const json = await res.json()
      if (json.success) {
        triggerToast('✅ Đã giải mã xong con dấu!')
        await loadStampQueue()
      } else {
        alert(json.error || 'Lỗi khi giải mã con dấu')
      }
    } catch (e: any) {
      alert(e.message)
    } finally {
      setDecodingQueueId(null)
    }
  }

  const handleDecodeAllPending = async () => {
    const pendingIds = stampQueueItems
      .filter(i => i.status === 'pending' || i.status === 'error')
      .map(i => i.id)
    if (pendingIds.length === 0) return

    setIsDecodingAllQueue(true)
    try {
      const res = await fetch('/api/stamp-queue/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: pendingIds }),
      })
      const json = await res.json()
      if (json.success) {
        triggerToast(`✅ Đã giải mã xong ${json.decodedCount || pendingIds.length} pallet!`)
        await loadStampQueue()
      } else {
        alert(json.error || 'Lỗi khi giải mã')
      }
    } catch (e: any) {
      alert(e.message)
    } finally {
      setIsDecodingAllQueue(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'pallets') {
      ensureProductsCatalogLoaded().then(prods => {
        if (prods && prods.length > 0) setCatalogProducts(prods)
      })
      getOfflineMeta('lots_last_synced_at').then(val => {
        if (val) setLastSyncedAt(val)
      })
    }
  }, [activeTab])

  useEffect(() => {
    setCurrentPage(1)
  }, [
    searchQuery,
    palletFilter,
    filterProduct,
    filterProductionPlace,
    filterMaterialZone,
    filterLocation,
    filterPackagingDate,
    filterProductionDate,
  ])

  const checkServerAndRefresh = async () => {
    setRefreshingCloud(true)
    setServerStatus('checking')
    const t0 = Date.now()
    try {
      const { error } = await supabase.from('lots').select('id').limit(1)
      if (error) throw error
      setServerPingMs(Date.now() - t0)
      setServerStatus('connected')
      await loadAllPallets()
    } catch {
      setServerStatus('error')
      setServerPingMs(null)
      await loadAllPallets()
    } finally {
      setRefreshingCloud(false)
    }
  }

  const handleSyncOfflineCloud = async () => {
    if (!isOnline) {
      await scannerAlert({
        title: 'Thiết bị đang mất mạng',
        message: 'Vui lòng kết nối Wifi/4G để tải dữ liệu về máy!',
        variant: 'warning',
      })
      return
    }
    setSyncingOfflineCloud(true)
    try {
      const list = await loadAllPallets()
      const prods = await ensureProductsCatalogLoaded(true)
      if (prods && prods.length > 0) setCatalogProducts(prods)
      const now = new Date().toISOString()
      setLastSyncedAt(now)
      await setOfflineMeta('lots_last_synced_at', now)
      if (Array.isArray(list)) {
        await setOfflineMeta('lots_count', list.length)
      }
      playScanSound()
      triggerHaptic()
      triggerToast(`✅ Đã tải ${Array.isArray(list) ? list.length : palletsList.length} LOT & Từ điển gõ tắt về máy!`)
    } catch (err: any) {
      await scannerAlert({ title: 'Lỗi tải dữ liệu về máy', message: err.message, variant: 'danger' })
    } finally {
      setSyncingOfflineCloud(false)
    }
  }

  // Gợi ý kết hợp (#STT + Sản phẩm theo tên gõ tắt aliases / SKU / tên)
  const combinedSuggestions = useMemo(() => {
    const mergedProducts: ProductSuggestion[] =
      catalogProducts.length > 0 ? catalogProducts : productSuggestions || []
    return buildCombinedSearchSuggestions(searchQuery, palletsList, mergedProducts, 10)
  }, [searchQuery, palletsList, catalogProducts, productSuggestions])

  // Gợi ý sản phẩm trong Modal Bộ lọc nâng cao
  const modalProductSuggestions = useMemo(() => {
    if (!filterProduct || filterProduct.trim().length < 1) return []
    const mergedProducts: ProductSuggestion[] =
      catalogProducts.length > 0 ? catalogProducts : productSuggestions || []
    return getProductSuggestions(filterProduct, mergedProducts, 6)
  }, [filterProduct, catalogProducts, productSuggestions])

  // Danh sách giá trị duy nhất cho các chip chọn nhanh trong Modal Bộ lọc
  const uniqueFilterOptions = useMemo(() => {
    const places = new Set<string>()
    const zones = new Set<string>()
    const locations = new Set<string>()

    palletsList.forEach(p => {
      if (p.production_place) places.add(p.production_place.trim())
      if (p.material_zone) zones.add(p.material_zone.trim())
      if (p.location_code) locations.add(p.location_code.trim())
    })

    return {
      places: Array.from(places).slice(0, 15),
      zones: Array.from(zones).slice(0, 15),
      locations: Array.from(locations).sort().slice(0, 20),
    }
  }, [palletsList])

  // Đếm số bộ lọc nâng cao đang bật
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filterProduct.trim()) count++
    if (filterProductionPlace.trim()) count++
    if (filterMaterialZone.trim()) count++
    if (filterLocation.trim()) count++
    if (filterPackagingDate.trim()) count++
    if (filterProductionDate.trim()) count++
    if (palletFilter !== 'all') count++
    return count
  }, [
    filterProduct,
    filterProductionPlace,
    filterMaterialZone,
    filterLocation,
    filterPackagingDate,
    filterProductionDate,
    palletFilter,
  ])

  const resetAllFilters = () => {
    setFilterProduct('')
    setFilterProductionPlace('')
    setFilterMaterialZone('')
    setFilterLocation('')
    setFilterPackagingDate('')
    setFilterProductionDate('')
    setPalletFilter('all')
    setSearchQuery('')
  }

  // Lọc danh sách Pallet Cloud theo cả ô tìm kiếm đa năng + Bộ lọc nâng cao
  const finalFilteredPallets = useMemo(() => {
    return palletsList.filter(p => {
      // 1. Trạng thái liên kết LOT
      if (palletFilter === 'linked' && !p.is_linked) return false
      if (palletFilter === 'unlinked' && p.is_linked) return false

      // 2. Bộ lọc nâng cao
      if (
        filterProduct.trim() &&
        !matchProductSearch(p, filterProduct, catalogProducts)
      ) {
        return false
      }
      if (filterProductionPlace.trim()) {
        const q = normalizeText(filterProductionPlace)
        const target = normalizeText(p.production_place || '')
        if (!target.includes(q)) return false
      }
      if (filterMaterialZone.trim()) {
        const q = normalizeText(filterMaterialZone)
        const target = normalizeText(p.material_zone || '')
        if (!target.includes(q)) return false
      }
      if (filterLocation.trim()) {
        const q = normalizeText(filterLocation)
        const target = normalizeText(p.location_code || '')
        if (!target.includes(q)) return false
      }
      if (filterPackagingDate.trim() && !matchDate(p.packaging_date, filterPackagingDate)) {
        return false
      }
      if (filterProductionDate.trim() && !matchDate(p.production_date, filterProductionDate)) {
        return false
      }

      // 3. Ô tìm kiếm chính (Search Query)
      if (!searchQuery.trim()) return true
      const rawTrim = searchQuery.trim()
      if (rawTrim.startsWith('#')) {
        const targetStt = rawTrim.slice(1).trim().toUpperCase()
        return (p.stt || '').toUpperCase().includes(targetStt)
      }

      if (matchProductSearch(p, rawTrim, catalogProducts)) return true

      const qNorm = normalizeText(rawTrim)
      const haystack = normalizeText(
        `${p.stt} ${p.lot_code || ''} ${p.location_code || ''} ${p.tag || ''} ${p.notes || ''} ${p.production_place || ''} ${p.material_zone || ''} ${p.packaging_date || ''} ${p.production_date || ''}`
      )
      return qNorm.split(' ').every(w => haystack.includes(w))
    })
  }, [
    palletsList,
    palletFilter,
    filterProduct,
    filterProductionPlace,
    filterMaterialZone,
    filterLocation,
    filterPackagingDate,
    filterProductionDate,
    searchQuery,
    catalogProducts,
  ])

  const totalPages = Math.max(1, Math.ceil(finalFilteredPallets.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedPallets = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return finalFilteredPallets.slice(start, start + PAGE_SIZE)
  }, [finalFilteredPallets, safePage])

  const stampPendingList = useMemo(() => {
    return stampQueueItems.filter(i => i.status === 'pending' || i.status === 'error')
  }, [stampQueueItems])

  const stampDecodedList = useMemo(() => {
    return stampQueueItems.filter(i => i.status === 'decoded')
  }, [stampQueueItems])

  const offlineStampCount = useMemo(() => {
    return stampPendingList.filter(i => Boolean((i as any).is_offline)).length
  }, [stampPendingList])

  const onlinePendingCount = useMemo(() => {
    return stampPendingList.filter(i => !Boolean((i as any).is_offline)).length
  }, [stampPendingList])

  // Gom nhóm các con dấu chờ giải mã theo cùng STT Pallet
  const groupedStampPendingList = useMemo(() => {
    const map = new Map<string, {
      key: string
      pallet_stt: string
      pallet_tag?: string | null
      pallet_notes?: string | null
      total_boxes: number
      total_weight: number
      created_by_name?: string | null
      created_at: string
      items: any[]
    }>()

    for (const item of stampPendingList) {
      const key = (item.pallet_stt || '').trim().toUpperCase() || item.id
      if (!map.has(key)) {
        map.set(key, {
          key,
          pallet_stt: item.pallet_stt,
          pallet_tag: item.pallet_tag,
          pallet_notes: item.pallet_notes,
          total_boxes: 0,
          total_weight: 0,
          created_by_name: item.created_by_name,
          created_at: item.created_at,
          items: []
        })
      }
      const g = map.get(key)!
      g.total_boxes += Number(item.box_count) || 0
      g.total_weight += (Number(item.box_count) || 0) * (Number(item.box_weight) || 20)
      g.items.push(item)
      if (!g.pallet_tag && item.pallet_tag) g.pallet_tag = item.pallet_tag
      if (!g.pallet_notes && item.pallet_notes) g.pallet_notes = item.pallet_notes
    }
    return Array.from(map.values())
  }, [stampPendingList])

  // Gom nhóm các con dấu đã giải mã theo cùng STT Pallet
  const groupedStampDecodedList = useMemo(() => {
    const map = new Map<string, {
      key: string
      pallet_stt: string
      pallet_tag?: string | null
      pallet_notes?: string | null
      total_boxes: number
      total_weight: number
      created_by_name?: string | null
      created_at: string
      items: any[]
    }>()

    for (const item of stampDecodedList) {
      const key = (item.pallet_stt || '').trim().toUpperCase() || item.id
      if (!map.has(key)) {
        map.set(key, {
          key,
          pallet_stt: item.pallet_stt,
          pallet_tag: item.pallet_tag,
          pallet_notes: item.pallet_notes,
          total_boxes: 0,
          total_weight: 0,
          created_by_name: item.created_by_name,
          created_at: item.created_at,
          items: []
        })
      }
      const g = map.get(key)!
      g.total_boxes += Number(item.box_count) || 0
      g.total_weight += (Number(item.box_count) || 0) * (Number(item.box_weight) || 20)
      g.items.push(item)
      if (!g.pallet_tag && item.pallet_tag) g.pallet_tag = item.pallet_tag
      if (!g.pallet_notes && item.pallet_notes) g.pallet_notes = item.pallet_notes
    }
    return Array.from(map.values())
  }, [stampDecodedList])

  // Hỗ trợ Lịch chọn ngày
  const openDatePicker = (field: 'packaging' | 'production') => {
    setCalendarTargetField(field)
    const now = new Date()
    setCalendarMonth(now.getMonth())
    setCalendarYear(now.getFullYear())
    setCalendarModalVisible(true)
  }

  const formatDdMmYyyy = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  const calendarCells = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay()
    // Đổi CN (0) -> 6, T2 (1) -> 0
    const startOffset = firstDay === 0 ? 6 : firstDay - 1
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [calendarMonth, calendarYear])

  // Thao tác xóa / nhân bản thùng trong Pallet ngoại tuyến (pendingPallets)
  const handleDeletePendingBox = async (boxIndexInArr: number) => {
    if (!selectedPendingPallet) return
    const ok = await scannerConfirm({
      title: 'Xóa thùng khỏi hàng chờ?',
      message: `Xóa thùng thứ ${boxIndexInArr + 1} khỏi Pallet ${selectedPendingPallet.stt}?`,
      confirmText: 'Xóa thùng',
      cancelText: 'Huỷ',
      variant: 'danger',
    })
    if (!ok) {
      return
    }
    const nextBoxes = selectedPendingPallet.boxes.filter((_, idx) => idx !== boxIndexInArr)
    if (nextBoxes.length === 0) {
      await removePendingPallet(selectedPendingPallet.client_id)
      const updated = await getPendingPallets()
      setPendingPallets(updated)
      setSelectedPendingPallet(null)
      triggerToast(`Đã xóa Pallet ngoại tuyến ${selectedPendingPallet.stt}`)
      return
    }
    const updatedPallet: OfflinePendingPallet = {
      ...selectedPendingPallet,
      boxes: nextBoxes,
      boxes_count: nextBoxes.length,
    }
    await updatePendingPalletOffline(updatedPallet)
    const updated = await getPendingPallets()
    setPendingPallets(updated)
    setSelectedPendingPallet(updatedPallet)
    triggerToast('Đã xóa 1 thùng khỏi Pallet ngoại tuyến')
  }

  const handleClonePendingBox = async (sampleIdx: number) => {
    if (!selectedPendingPallet) return
    const count = Math.min(100, Math.max(1, parseInt(pendingCloneCount, 10) || 1))
    const sample = selectedPendingPallet.boxes[sampleIdx]
    if (!sample) return

    const cloned = Array.from({ length: count }, (_, i) => {
      const nextNum = selectedPendingPallet.boxes.length + i + 1
      const padIdx = String(nextNum).padStart(3, '0')
      const cleanLot = (selectedPendingPallet.lot_code || 'LOT').replace(/[^A-Z0-9]/gi, '')
      return {
        ...sample,
        code: `BOX-${cleanLot}-${selectedPendingPallet.stt}-${padIdx}-${Math.floor(100 + Math.random() * 900)}`,
        time: new Date().toISOString(),
        metadata: {
          ...(sample.metadata || {}),
          box_index: padIdx,
          is_cloned: true,
        },
      }
    })

    const nextBoxes = [...selectedPendingPallet.boxes, ...cloned]
    const updatedPallet: OfflinePendingPallet = {
      ...selectedPendingPallet,
      boxes: nextBoxes,
      boxes_count: nextBoxes.length,
    }
    await updatePendingPalletOffline(updatedPallet)
    const updated = await getPendingPallets()
    setPendingPallets(updated)
    setSelectedPendingPallet(updatedPallet)
    setPendingCloneBoxIdx(null)
    playScanSound()
    triggerHaptic()
    triggerToast(`✅ Đã nhân bản thêm ${count} thùng cho Pallet ${selectedPendingPallet.stt}`)
  }

  if (activeTab !== 'pallets') return null

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] overflow-hidden min-h-0">
      {/* Thanh trạng thái kết nối máy chủ (Giống PalletListScreen.tsx Android) */}
      <div className="px-3 py-1.5 bg-[#0f172a] border-b border-slate-800/80 flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-[10px]">
            {!isOnline || serverStatus === 'error'
              ? '🔴'
              : serverStatus === 'checking'
                ? '🟡'
                : '🟢'}
          </span>
          <span
            className={`font-mono font-bold truncate ${
              !isOnline || serverStatus === 'error'
                ? 'text-rose-400'
                : serverStatus === 'checking'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
            }`}
          >
            {!isOnline
              ? 'Chế độ Ngoại tuyến (Bộ nhớ máy)'
              : serverStatus === 'error'
                ? 'Máy chủ phản hồi chậm • Đang dùng bản lưu máy'
                : `Máy chủ Server (Đã kết nối${serverPingMs ? ` • ${serverPingMs}ms` : ''})`}
          </span>
        </div>
        <button
          type="button"
          onClick={checkServerAndRefresh}
          disabled={refreshingCloud}
          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-[10px] flex items-center gap-1 shrink-0 transition"
        >
          <RefreshCw size={10} className={refreshingCloud ? 'animate-spin' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Top Sub-tabs Bar: Chờ đẩy, Chờ giải mã, Đã giải mã, Đã duyệt */}
      <div className="p-2 border-b border-slate-800 bg-[#0f172a] space-y-2 shrink-0">
        <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 gap-1 overflow-x-auto no-scrollbar">
          {/* 1. Chờ đẩy */}
          <button
            type="button"
            onClick={() => setPalletListSubTab('pending')}
            className={`flex-1 min-w-[76px] py-1.5 text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1 ${
              palletListSubTab === 'pending'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HardDrive size={12} />
            <span>Chờ đẩy</span>
            <span
              className={`px-1 py-0.2 rounded-full text-[9px] ${
                palletListSubTab === 'pending'
                  ? 'bg-black/30 text-white font-mono'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {pendingPallets.length}
            </span>
          </button>

          {/* 2. Chờ giải mã */}
          <button
            type="button"
            onClick={() => {
              setPalletListSubTab('stamp_pending')
              loadStampQueue()
            }}
            className={`flex-1 min-w-[85px] py-1.5 text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1 ${
              palletListSubTab === 'stamp_pending'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock size={12} />
            <span>Chờ giải mã</span>
            <span
              className={`px-1 py-0.2 rounded-full text-[9px] ${
                palletListSubTab === 'stamp_pending'
                  ? 'bg-black/30 text-white font-mono'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {groupedStampPendingList.length}
            </span>
          </button>

          {/* 3. Đã giải mã */}
          <button
            type="button"
            onClick={() => {
              setPalletListSubTab('stamp_decoded')
              loadStampQueue()
            }}
            className={`flex-1 min-w-[80px] py-1.5 text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1 ${
              palletListSubTab === 'stamp_decoded'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 size={12} />
            <span>Đã giải mã</span>
            <span
              className={`px-1 py-0.2 rounded-full text-[9px] ${
                palletListSubTab === 'stamp_decoded'
                  ? 'bg-black/30 text-white font-mono'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {groupedStampDecodedList.length}
            </span>
          </button>

          {/* 4. Đã duyệt */}
          <button
            type="button"
            onClick={() => setPalletListSubTab('cloud')}
            className={`flex-1 min-w-[76px] py-1.5 text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1 ${
              palletListSubTab === 'cloud'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 size={12} />
            <span>Đã duyệt</span>
            <span
              className={`px-1 py-0.2 rounded-full text-[9px] ${
                palletListSubTab === 'cloud'
                  ? 'bg-black/30 text-white font-mono'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {palletsList.length}
            </span>
          </button>
        </div>

        {/* Sub-tab 1 Controls: Pending Pallets toolbar */}
        {palletListSubTab === 'pending' && (
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-400 text-[11px]">
              Pallet lưu tạm trên thiết bị:{' '}
              <strong className="text-amber-400">{pendingPallets.length}</strong>
            </span>
            {pendingPallets.length > 0 && (
              <button
                type="button"
                onClick={handleSyncPendingQueue}
                disabled={isSyncingPending || !isOnline}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-[11px] font-bold flex items-center gap-1 shadow-xs"
              >
                <RefreshCw size={12} className={isSyncingPending ? 'animate-spin' : ''} />
                <span>{isSyncingPending ? 'Đang gửi...' : 'Đồng bộ tất cả'}</span>
              </button>
            )}
          </div>
        )}

        {/* Sub-tab 2 Controls: Chờ giải mã toolbar */}
        {palletListSubTab === 'stamp_pending' && (
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-400 text-[11px]">
              {offlineStampCount > 0 && (
                <strong className="text-amber-400 mr-1.5">
                  📡 {offlineStampCount} offline •
                </strong>
              )}
              Chờ giải mã:{' '}
              <strong className="text-orange-400">
                {onlinePendingCount} ảnh ({groupedStampPendingList.length} Pallet)
              </strong>
            </span>
            <div className="flex items-center gap-1.5">
              {offlineStampCount > 0 && (
                <button
                  type="button"
                  onClick={handleSyncAllOfflineStamps}
                  disabled={!isOnline}
                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs"
                  title="Tải toàn bộ ảnh con dấu ngoại tuyến lên Server"
                >
                  <CloudUpload size={12} />
                  <span>Đẩy Server ({offlineStampCount})</span>
                </button>
              )}
              {onlinePendingCount > 0 && (
                <button
                  type="button"
                  onClick={handleDecodeAllPending}
                  disabled={isDecodingAllQueue || !isOnline}
                  className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs"
                >
                  <Scan size={12} className={isDecodingAllQueue ? 'animate-spin' : ''} />
                  <span>{isDecodingAllQueue ? 'Đang giải mã...' : 'Giải mã tất cả'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sub-tab 3 Controls: Đã giải mã toolbar */}
        {palletListSubTab === 'stamp_decoded' && (
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-purple-300 text-[11px] font-bold flex items-center gap-1">
              <CheckCircle2 size={12} />
              <span>Đã nhận diện xong: {groupedStampDecodedList.length} Pallet ({stampDecodedList.length} đợt con dấu)</span>
            </span>
            <span className="text-slate-500 text-[10px]">Chờ server duyệt tạo Lot</span>
          </div>
        )}

        {/* Sub-tab 2 Controls: Cloud Pallets Offline bar, Search & Filters */}
        {palletListSubTab === 'cloud' && (
          <div className="space-y-2">
            {/* Thanh trạng thái Offline & Nút Tải về máy */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px]">
              <span className="text-slate-400 truncate mr-2">
                {lastSyncedAt
                  ? `💾 Đã lưu máy: ${palletsList.length} LOT • ${new Date(
                      lastSyncedAt
                    ).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })} ${new Date(lastSyncedAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                    })}`
                  : `💾 Bộ nhớ máy: ${palletsList.length} LOT`}
              </span>
              <button
                type="button"
                onClick={handleSyncOfflineCloud}
                disabled={syncingOfflineCloud || !isOnline}
                className="px-2 py-0.5 rounded bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 font-bold text-[10px] flex items-center gap-1 shrink-0 disabled:opacity-50 transition"
              >
                {syncingOfflineCloud ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <span>🔄</span>
                )}
                <span>{syncingOfflineCloud ? 'Đang tải...' : 'Tải về máy'}</span>
              </button>
            </div>

            {/* Thanh tìm kiếm đa năng + Nút Bộ lọc nâng cao */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value)
                    setShowSearchSuggestions(true)
                  }}
                  onFocus={() => setShowSearchSuggestions(true)}
                  placeholder="Tìm STT, LOT, VT, gõ tắt SP (VD: Đô c, srmc)..."
                  className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setShowSearchSuggestions(false)
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    title="Xóa tìm kiếm"
                  >
                    <X size={14} />
                  </button>
                )}

                {/* Combined Autocomplete Dropdown (#STT + Sản phẩm theo tên gõ tắt aliases) */}
                {showSearchSuggestions && combinedSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800 max-h-72 overflow-y-auto overscroll-contain">
                    <div className="p-1.5 px-2.5 bg-slate-950 text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between sticky top-0 z-10">
                      <span>Gợi ý tìm nhanh ({combinedSuggestions.length}):</span>
                      <button
                        type="button"
                        onClick={() => setShowSearchSuggestions(false)}
                        className="text-slate-400 hover:text-white text-[10px]"
                      >
                        Đóng ✕
                      </button>
                    </div>
                    {combinedSuggestions.map(item => (
                      <button
                        type="button"
                        key={`${item.product.id}_${item.fillValue}`}
                        onClick={() => {
                          setSearchQuery(item.fillValue)
                          setShowSearchSuggestions(false)
                        }}
                        className="w-full p-2.5 hover:bg-slate-800 text-left flex items-center justify-between gap-2 text-xs transition"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white truncate">{item.displayTitle}</p>
                          {item.displaySubtitle && (
                            <p className="text-[10px] text-slate-400 truncate font-mono">
                              {item.displaySubtitle}
                            </p>
                          )}
                        </div>
                        {(item.badgeText || item.product.sku) && (
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                              item.badgeType === 'stt'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : item.badgeType === 'alias'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            }`}
                          >
                            {item.badgeText || item.product.sku}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Nút mở Modal Bộ lọc nâng cao */}
              <button
                type="button"
                onClick={() => setFilterModalVisible(true)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition shrink-0 ${
                  activeFilterCount > 0
                    ? 'bg-sky-600 border-sky-400 text-white shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
                title="Bộ lọc nâng cao"
              >
                <SlidersHorizontal size={13} />
                <span>Lọc</span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.1 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Hàng Chip hiển thị các bộ lọc nâng cao đang áp dụng */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold shrink-0"
                >
                  ✕ Xóa lọc
                </button>
                {filterProduct ? (
                  <button
                    type="button"
                    onClick={() => setFilterProduct('')}
                    className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-bold shrink-0"
                  >
                    SP: {filterProduct} ✕
                  </button>
                ) : null}
                {filterProductionPlace ? (
                  <button
                    type="button"
                    onClick={() => setFilterProductionPlace('')}
                    className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-bold shrink-0"
                  >
                    Nơi SX: {filterProductionPlace} ✕
                  </button>
                ) : null}
                {filterMaterialZone ? (
                  <button
                    type="button"
                    onClick={() => setFilterMaterialZone('')}
                    className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-bold shrink-0"
                  >
                    Vùng NL: {filterMaterialZone} ✕
                  </button>
                ) : null}
                {filterLocation ? (
                  <button
                    type="button"
                    onClick={() => setFilterLocation('')}
                    className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold shrink-0"
                  >
                    VT: {filterLocation} ✕
                  </button>
                ) : null}
                {filterPackagingDate ? (
                  <button
                    type="button"
                    onClick={() => setFilterPackagingDate('')}
                    className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-bold shrink-0"
                  >
                    Đóng gói: {filterPackagingDate} ✕
                  </button>
                ) : null}
                {filterProductionDate ? (
                  <button
                    type="button"
                    onClick={() => setFilterProductionDate('')}
                    className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold shrink-0"
                  >
                    NSX: {filterProductionDate} ✕
                  </button>
                ) : null}
              </div>
            )}

            {/* Filter Sub-chips */}
            <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
              <button
                type="button"
                onClick={() => setPalletFilter('all')}
                className={`flex-1 py-1 text-[11px] font-bold rounded-md transition ${
                  palletFilter === 'all' ? 'bg-sky-600 text-white' : 'text-slate-400'
                }`}
              >
                Tất cả ({finalFilteredPallets.length})
              </button>
              <button
                type="button"
                onClick={() => setPalletFilter('unlinked')}
                className={`flex-1 py-1 text-[11px] font-bold rounded-md transition ${
                  palletFilter === 'unlinked' ? 'bg-amber-600 text-white' : 'text-slate-400'
                }`}
              >
                Chờ duyệt LOT
              </button>
              <button
                type="button"
                onClick={() => setPalletFilter('linked')}
                className={`flex-1 py-1 text-[11px] font-bold rounded-md transition ${
                  palletFilter === 'linked' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                }`}
              >
                Đã duyệt LOT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List Body (overscroll-contain tối ưu cuộn mượt trên iOS Safari) */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2.5">
        {/* SUB-VIEW 1: PENDING PALLETS LIST */}
        {palletListSubTab === 'pending' && (
          <>
            {pendingPallets.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <HardDrive size={36} className="mx-auto text-slate-600 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-300">
                  Không có Pallet nào đang chờ đẩy lên
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Tất cả các pallet bạn quét đều đã được đồng bộ an toàn lên Server.
                </p>
              </div>
            ) : (
              pendingPallets.map(item => {
                const totalWeight = (item.boxes || []).reduce(
                  (s, b) => s + (Number(b.weight) || 0),
                  0
                )
                    const firstBox = (item.boxes || [])[0]
                    const queueMatch = stampPendingList.find(q => q.pallet_stt === item.stt) || stampDecodedList.find(q => q.pallet_stt === item.stt)
                    const line1 = firstBox?.metadata?.stamp_line1 || queueMatch?.stamp_line1
                    const line2 = firstBox?.metadata?.stamp_line2 || queueMatch?.stamp_line2
                    const imgSrc = formatStampThumbnail(
                      firstBox?.metadata?.drive_file_id || queueMatch?.drive_file_id || firstBox?.metadata?.drive_view_url || queueMatch?.image_url,
                      queueMatch?.cropped_image_url
                    )
                    const specText = firstBox?.metadata?.spec || queueMatch?.decoded_json?.spec
                    const packDateText = firstBox?.metadata?.packaging_date || queueMatch?.decoded_json?.packagingDateStr
                    const prodDateText = firstBox?.metadata?.production_date || queueMatch?.decoded_json?.rawMaterialDateStr
                    const regionText = firstBox?.metadata?.region || queueMatch?.decoded_json?.provinceName

                    return (
                      <div
                        key={item.client_id}
                        className="p-3 rounded-xl bg-[#111827] border border-amber-500/40 space-y-2.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black font-mono text-xs">
                              STT: {item.stt}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                item.status === 'failed'
                                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                                  : item.status === 'syncing'
                                    ? 'text-sky-400 bg-sky-500/10 border-sky-500/30'
                                    : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                              }`}
                            >
                              {item.status === 'failed'
                                ? '⚠️ Gửi lỗi'
                                : item.status === 'syncing'
                                  ? '⏳ Đang gửi...'
                                  : `Chờ gửi (${item.boxes_count} thùng · ${totalWeight.toFixed(1)} Kg)`}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(item.created_at).toLocaleTimeString('vi-VN')}
                          </span>
                        </div>

                        {/* Thân thẻ: Ảnh + Tên sản phẩm + 2 Dòng số */}
                        <div className="flex gap-2.5">
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt="Con dấu"
                              referrerPolicy="no-referrer"
                              onClick={() => setPreviewImageUrl(imgSrc)}
                              className="w-16 h-16 rounded-lg object-cover border border-slate-700 bg-black/40 shrink-0 cursor-pointer hover:opacity-90 active:scale-95 transition"
                              title="Bấm để phóng to xem rõ nét"
                            />
                          ) : null}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="text-xs text-white font-bold line-clamp-2">
                              {item.product_name || queueMatch?.decoded_json?.productTitle || 'Hàng lưu ngoại tuyến'}
                            </div>
                            <div className="text-[11px] text-sky-400 font-bold">
                              {item.boxes_count} thùng · {totalWeight.toFixed(1)} Kg
                            </div>
                          </div>
                        </div>

                        {/* 2 Dòng số nếu là con dấu */}
                        {(line1 || line2) && (
                          <div className="p-2 rounded-lg bg-black/40 border border-slate-800 text-[11px] font-mono space-y-0.5">
                            <div>
                              <span className="text-slate-500">Dòng 1: </span>
                              <strong className="text-sky-300">{line1 || '---'}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Dòng 2: </span>
                              <strong className="text-purple-300">{line2 || '---'}</strong>
                            </div>
                          </div>
                        )}

                        {/* Thông tin quét & thông tin khác */}
                        <div className="space-y-1 text-[11px] text-slate-400">
                          {(regionText || packDateText || prodDateText) && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {regionText && <span>Vùng: <strong className="text-slate-100">{regionText}</strong></span>}
                              {packDateText && <span>Đóng gói: <strong className="text-slate-100">{packDateText}</strong></span>}
                              {prodDateText && <span>Nhập NL: <strong className="text-slate-100">{prodDateText}</strong></span>}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <span>Người gửi: <strong className="text-slate-300">{(item as any).created_by_name || queueMatch?.created_by_name || 'Kho'}</strong></span>
                          </div>
                        </div>

                        {item.error_message && (
                          <div className="text-[10px] text-rose-400 bg-rose-950/50 border border-rose-800/60 px-2 py-1 rounded">
                            Lỗi: {item.error_message}
                          </div>
                        )}

                    <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5 justify-between flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPendingPallet(item)
                          setPendingCloneBoxIdx(null)
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold transition flex items-center gap-1"
                      >
                        <Edit3 size={12} />
                        <span>Chi tiết / Nhân bản</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const isStampPallet =
                              item.stt?.startsWith('G') ||
                              item.boxes?.some(
                                (b: any) =>
                                  b?.metadata?.scan_type === 'stamp' ||
                                  b?.code?.startsWith('STAMP-')
                              )
                            setActivePalletStt(item.stt)
                            setActiveTab(isStampPallet ? 'stamp' : 'label')
                            loadCurrentPalletBoxes(item.stt)
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1"
                        >
                          <Scan size={12} className="text-emerald-400" />
                          <span>Quét tiếp</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSyncSinglePending(item)}
                          disabled={!isOnline}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1"
                        >
                          <RefreshCw size={12} />
                          <span>Đẩy lên</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await scannerConfirm({
                              title: `Xóa Pallet ${item.stt}?`,
                              message: `Bạn có chắc muốn xóa Pallet ${item.stt} khỏi hàng chờ không?`,
                              confirmText: 'Xóa Pallet',
                              cancelText: 'Huỷ',
                              variant: 'danger',
                            })
                            if (ok) {
                              await removePendingPallet(item.client_id)
                              const updated = await getPendingPallets()
                              setPendingPallets(updated)
                              triggerToast('Đã xóa khỏi hàng đợi')
                            }
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:text-white"
                          title="Xóa pallet này"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {/* SUB-VIEW 2: STAMP PENDING LIST (Chờ giải mã) */}
        {palletListSubTab === 'stamp_pending' && (
          <>
            {groupedStampPendingList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <CheckCircle2 size={36} className="mx-auto text-emerald-500 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-300">
                  Không có Pallet nào chờ giải mã
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Tất cả ảnh con dấu gửi lên đã được giải mã xong hoặc chưa có lượt gửi mới.
                </p>
                {groupedStampDecodedList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPalletListSubTab('stamp_decoded')}
                    className="px-3 py-1.5 rounded-lg bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold transition hover:bg-purple-600/40 inline-flex items-center gap-1.5 mt-2"
                  >
                    <CheckCircle2 size={13} />
                    <span>Xem danh sách Đã giải mã ({groupedStampDecodedList.length})</span>
                  </button>
                )}
              </div>
            ) : (
              groupedStampPendingList.map(group => {
                if (group.items.length === 1) {
                  const item = group.items[0]
                  const isDecoding = decodingQueueId === item.id
                  const isErr = item.status === 'error'
                  const imgSrc = formatStampThumbnail(item.image_url, item.cropped_image_url, item.drive_file_id)

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl bg-slate-900 border ${
                        isErr ? 'border-rose-500/60' : 'border-slate-800'
                      } space-y-2 shadow-xs`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="font-mono font-black text-xs text-orange-400">
                            STT: {item.pallet_stt}
                          </span>
                          {item.pallet_tag && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                              🏷️ {item.pallet_tag}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.is_offline
                              ? 'bg-amber-950 text-amber-300 border border-amber-600'
                              : isErr
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-orange-950 text-orange-300 border border-orange-800'
                          }`}
                        >
                          {item.is_offline
                            ? '📡 Chưa gửi (Offline)'
                            : isErr
                            ? '❌ Lỗi giải mã'
                            : '⏳ Đã gửi (Chờ Server xử lý)'}
                        </span>
                      </div>

                      <div className="flex gap-3">
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt="Con dấu"
                            referrerPolicy="no-referrer"
                            onClick={() => setPreviewImageUrl(imgSrc)}
                            title="Bấm để phóng to xem rõ nét"
                            onError={(e) => {
                              const target = e.currentTarget
                              if (item.drive_file_id && !target.dataset.tried) {
                                target.dataset.tried = '1'
                                target.src = `https://drive.google.com/thumbnail?id=${item.drive_file_id}&sz=w400`
                              }
                            }}
                            className="w-16 h-16 rounded-lg object-cover bg-slate-950 border border-slate-800 shrink-0 cursor-pointer hover:opacity-90 active:scale-95 transition"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                            <Clock size={20} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-between text-xs">
                          <div>
                            <div className="text-slate-300 font-semibold">
                              Số lượng:{' '}
                              <span className="text-emerald-400 font-bold">
                                {item.box_count}
                              </span>{' '}
                              thùng • {item.box_weight} Kg
                            </div>
                            {item.is_offline ? (
                              <p className="text-amber-400 text-[11px] mt-0.5">
                                📡 Đang lưu an toàn trên máy (Ngoại tuyến)
                              </p>
                            ) : isErr && item.error_message ? (
                              <p className="text-rose-400 text-[11px] mt-0.5 line-clamp-2">
                                ⚠️ {item.error_message}
                              </p>
                            ) : (
                              <p className="text-slate-500 text-[11px] mt-0.5">
                                Đã lưu ảnh an toàn trên Server
                              </p>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Gửi lúc: {item.created_at?.slice(0, 16).replace('T', ' ')}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          Người gửi: {item.created_by_name || 'Kho'}
                        </span>
                        {item.is_offline ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDeleteOfflineStampItem(item.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-400 transition"
                              title="Xóa đợt ảnh ngoại tuyến này"
                            >
                              <Trash2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSyncOfflineItem(item.id)}
                              disabled={!isOnline}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                            >
                              <CloudUpload size={12} />
                              <span>Tải lên Server</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDecodeItem(item.id)}
                            disabled={isDecoding || !isOnline}
                            className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                          >
                            {isDecoding ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Scan size={12} />
                            )}
                            <span>{isDecoding ? 'Đang giải mã...' : 'Giải mã'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                }

                // Pallet ghép nhiều ảnh con dấu chờ giải mã
                const hasErr = group.items.some(i => i.status === 'error')
                const isGroupDecoding = group.items.some(i => decodingQueueId === i.id)

                return (
                  <div
                    key={group.key}
                    className={`p-3 rounded-xl bg-slate-900 border ${
                      hasErr ? 'border-rose-500/60' : 'border-amber-700/60'
                    } space-y-2.5 shadow-xs`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="font-mono font-black text-xs text-orange-400">
                          STT: {group.pallet_stt}
                        </span>
                        {group.pallet_tag && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                            🏷️ {group.pallet_tag}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-800 font-semibold">
                          📦 Ghép {group.items.length} đợt con dấu
                        </span>
                      </div>
                      <span className="text-emerald-400 font-bold text-xs">
                        Tổng: {group.total_boxes} thùng
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.items.map((sub, sIdx) => {
                        const imgSrc = formatStampThumbnail(sub.image_url, sub.cropped_image_url, sub.drive_file_id)
                        const isSubErr = sub.status === 'error'

                        return (
                          <div
                            key={sub.id || sIdx}
                            className={`p-2 rounded-lg bg-slate-950 border ${
                              isSubErr ? 'border-rose-900' : 'border-slate-800'
                            } flex gap-2.5 items-center`}
                          >
                            {imgSrc ? (
                              <img
                                src={imgSrc}
                                alt="Con dấu"
                                referrerPolicy="no-referrer"
                                onClick={() => setPreviewImageUrl(imgSrc)}
                                title="Bấm để phóng to xem rõ nét"
                                className="w-12 h-12 rounded-lg object-cover bg-slate-900 border border-slate-700 shrink-0 cursor-pointer hover:opacity-90 active:scale-95 transition"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-600 shrink-0">
                                <Clock size={16} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-orange-300 text-[11px]">Đợt {sIdx + 1}</span>
                                <span className="font-bold text-emerald-400 text-[11px]">{sub.box_count} thùng • {sub.box_weight} Kg</span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Gửi lúc: {sub.created_at?.slice(0, 16).replace('T', ' ')}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500">
                        Người gửi: {group.created_by_name || 'Kho'}
                      </span>
                      {group.items.some(it => it.is_offline) ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              for (const it of group.items) {
                                if (it.is_offline) await removeOfflineStampQueueItem(it.id)
                              }
                              await loadStampQueue()
                              triggerToast('Đã xóa các đợt ảnh ngoại tuyến')
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-400 transition"
                            title="Xóa các đợt ngoại tuyến của Pallet này"
                          >
                            <Trash2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              for (const it of group.items) {
                                if (it.is_offline) await handleSyncOfflineItem(it.id)
                              }
                            }}
                            disabled={!isOnline}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                          >
                            <CloudUpload size={12} />
                            <span>Tải lên Server</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            for (const it of group.items) {
                              await handleDecodeItem(it.id)
                            }
                          }}
                          disabled={isGroupDecoding || !isOnline}
                          className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                        >
                          {isGroupDecoding ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Scan size={12} />
                          )}
                          <span>{isGroupDecoding ? 'Đang giải mã...' : `Giải mã (${group.items.length})`}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {/* SUB-VIEW 3: STAMP DECODED LIST (Đã giải mã) */}
        {palletListSubTab === 'stamp_decoded' && (
          <>
            {groupedStampDecodedList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <CheckCircle2 size={36} className="mx-auto text-purple-400 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-300">
                  Chưa có Pallet nào được giải mã
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Khi giải mã xong ảnh con dấu, kết quả nhận diện sẽ xuất hiện ngay tại đây.
                </p>
              </div>
            ) : (
              groupedStampDecodedList.map(group => {
                if (group.items.length === 1) {
                  const item = group.items[0]
                  const dec = item.decoded_json || {}
                  const prodTitle = dec.productTitle || dec.special12Name || 'Sản phẩm con dấu'
                  const imgSrc = formatStampThumbnail(item.image_url, item.cropped_image_url, item.drive_file_id)

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-900 border border-purple-500/40 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <Box size={14} className="text-purple-400 shrink-0" />
                          <span className="font-mono font-black text-xs text-purple-200">
                            STT: {item.pallet_stt}
                          </span>
                          {item.pallet_tag && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                              🏷️ {item.pallet_tag}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2.5">
                        {imgSrc && (
                          <img
                            src={imgSrc}
                            alt="Con dấu"
                            referrerPolicy="no-referrer"
                            onClick={() => setPreviewImageUrl(imgSrc)}
                            title="Bấm để phóng to xem rõ nét"
                            onError={(e) => {
                              const target = e.currentTarget
                              if (item.drive_file_id && !target.dataset.tried) {
                                target.dataset.tried = '1'
                                target.src = `https://drive.google.com/thumbnail?id=${item.drive_file_id}&sz=w400`
                              }
                            }}
                            className="w-16 h-16 rounded-lg object-cover bg-slate-950 border border-slate-800 shrink-0 cursor-pointer hover:opacity-90 active:scale-95 transition"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-xs font-bold leading-snug line-clamp-2">
                            {prodTitle}
                          </div>
                          <div className="text-sky-400 text-[11px] font-bold mt-1">
                            {item.box_count} thùng • {item.box_weight} Kg
                          </div>
                        </div>
                      </div>

                      {/* 2 Dòng số đọc được */}
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono space-y-1">
                        <div>
                          <span className="text-slate-500">Dòng 1: </span>
                          <span className="text-sky-300 font-bold">
                            {item.stamp_line1 || '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Dòng 2: </span>
                          <span className="text-purple-300 font-bold">
                            {item.stamp_line2 || '---'}
                          </span>
                        </div>
                      </div>

                      {/* Thông tin giải mã chi tiết: Quét nằm trên, Người gửi nằm dưới */}
                      <div className="space-y-1 text-[11px] text-slate-400">
                        {/* Hàng trên: Thông tin quét từ con dấu */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {dec.provinceName && (
                            <span>
                              Vùng: <strong className="text-slate-100">{dec.provinceName}</strong>
                            </span>
                          )}
                          {dec.packagingDateStr && (
                            <span>
                              Đóng gói: <strong className="text-slate-100">{dec.packagingDateStr}</strong>
                            </span>
                          )}
                          {dec.rawMaterialDateStr && (
                            <span>
                              Nhập NL: <strong className="text-slate-100">{dec.rawMaterialDateStr}</strong>
                            </span>
                          )}
                        </div>

                        {/* Hàng dưới: Thay Quy cách bằng Người gửi */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span>
                            Người gửi: <strong className="text-slate-300">{item.created_by_name || 'Kho'}</strong>
                          </span>
                          {item.pallet_notes && (
                            <span className="truncate max-w-[200px]">
                              Ghi chú: <strong className="text-slate-300">{item.pallet_notes}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-purple-900/40 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1 text-purple-400 font-bold">
                          <Clock size={12} />
                          <span>Chờ server duyệt tạo Lot</span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {item.created_at?.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                    </div>
                  )
                }

                // Pallet ghép nhiều đợt con dấu đã giải mã
                return (
                  <div
                    key={group.key}
                    className="p-3 rounded-xl bg-slate-900 border-2 border-purple-500/60 space-y-2.5 shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <Box size={14} className="text-purple-400 shrink-0" />
                        <span className="font-mono font-black text-xs text-purple-200">
                          STT: {group.pallet_stt}
                        </span>
                        {group.pallet_tag && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                            🏷️ {group.pallet_tag}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-semibold">
                          📦 Ghép {group.items.length} đợt con dấu
                        </span>
                      </div>
                      <span className="text-emerald-400 font-bold text-xs">
                        Tổng: {group.total_boxes} thùng
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.items.map((sub, sIdx) => {
                        const dec = sub.decoded_json || {}
                        const prodTitle = dec.productTitle || dec.special12Name || 'Sản phẩm con dấu'
                        const imgSrc = formatStampThumbnail(sub.image_url, sub.cropped_image_url, sub.drive_file_id)

                        return (
                          <div
                            key={sub.id || sIdx}
                            className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-purple-300 text-[11px]">Đợt {sIdx + 1}</span>
                              <span className="font-bold text-sky-400 text-[11px]">{sub.box_count} thùng • {sub.box_weight} Kg</span>
                            </div>

                            <div className="flex gap-2.5">
                              {imgSrc && (
                                <img
                                  src={imgSrc}
                                  alt="Con dấu"
                                  referrerPolicy="no-referrer"
                                  onClick={() => setPreviewImageUrl(imgSrc)}
                                  title="Bấm để phóng to xem rõ nét"
                                  className="w-12 h-12 rounded-lg object-cover bg-slate-900 border border-slate-700 shrink-0 cursor-pointer hover:opacity-90 active:scale-95 transition"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-xs font-bold leading-snug line-clamp-2">
                                  {prodTitle}
                                </div>
                                {(sub.stamp_line1 || sub.stamp_line2) && (
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    L1: <strong className="text-sky-300">{sub.stamp_line1 || '---'}</strong> • L2: <strong className="text-purple-300">{sub.stamp_line2 || '---'}</strong>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Thông tin quét đợt này */}
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                              {dec.provinceName && <span>Vùng: <strong className="text-slate-100">{dec.provinceName}</strong></span>}
                              {dec.packagingDateStr && <span>Đóng gói: <strong className="text-slate-100">{dec.packagingDateStr}</strong></span>}
                              {dec.rawMaterialDateStr && <span>Nhập NL: <strong className="text-slate-100">{dec.rawMaterialDateStr}</strong></span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Hàng dưới cùng: Người gửi */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      <span>
                        Người gửi: <strong className="text-slate-300">{group.created_by_name || 'Kho'}</strong>
                      </span>
                      {group.pallet_notes && (
                        <span className="truncate max-w-[200px]">
                          Ghi chú: <strong className="text-slate-300">{group.pallet_notes}</strong>
                        </span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-purple-900/40 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1 text-purple-400 font-bold">
                        <Clock size={12} />
                        <span>Chờ server duyệt tạo Lot</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {group.created_at?.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {/* SUB-VIEW 4: CLOUD PALLETS LIST (Đã duyệt) */}
        {palletListSubTab === 'cloud' && (
          <>
            {finalFilteredPallets.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <Boxes size={36} className="mx-auto text-slate-600 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-300">
                  Không tìm thấy Pallet / LOT nào khớp bộ lọc
                </p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold"
                  >
                    Xóa toàn bộ bộ lọc
                  </button>
                )}
              </div>
            ) : (
              <>
                {paginatedPallets.map(p => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-[#111827] border border-slate-800 hover:border-slate-700 transition space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black font-mono">
                          STT: {p.stt}
                        </span>
                        {p.location_code && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold font-mono">
                            <MapPin size={10} className="text-amber-400" />
                            VT: {p.location_code}
                          </span>
                        )}
                        {p.tag && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-600/20 text-orange-400 border border-orange-500/40 text-[10px] font-bold font-mono">
                            🏷️ {p.tag}
                          </span>
                        )}
                        {p.is_linked ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                            ✓ Đã kết nối LOT
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                            ⏳ Chờ duyệt LOT
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-300 font-mono font-bold shrink-0">
                        {p.boxes_count} thùng · {p.total_weight} Kg
                      </span>
                    </div>

                    {p.is_special_12 && (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black">
                        ⭐ 12 SỐ ĐẦU TRỌN GÓI
                      </span>
                    )}

                    {p.lot_code && (
                      <div className="text-[11px] text-slate-400">
                        Mã LOT Web:{' '}
                        <span className="text-sky-400 font-mono font-bold">{p.lot_code}</span>
                      </div>
                    )}

                    <p className="text-xs font-bold text-white leading-snug line-clamp-2">
                      {p.product_name}
                    </p>

                    {(p.product_aliases || p.aliases) && (
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <span>⚡ Gõ tắt:</span>
                        <span className="text-emerald-400 font-bold">
                          {p.product_aliases || p.aliases}
                        </span>
                      </div>
                    )}

                    {(p.production_place || p.material_zone) && (
                      <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                        {p.production_place && (
                          <span>
                            🏭 Nơi SX:{' '}
                            <strong className="text-slate-200">{p.production_place}</strong>
                          </span>
                        )}
                        {p.material_zone && (
                          <span>
                            🌱 Vùng NL:{' '}
                            <strong className="text-slate-200">{p.material_zone}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    {p.notes && (
                      <div className="text-[11px] text-slate-300 bg-slate-900/90 border border-slate-800/80 px-2.5 py-1 rounded-lg">
                        <span className="text-slate-500 text-[10px] block font-bold">
                          📝 GHI CHÚ:
                        </span>
                        <span className="text-slate-300 italic">{p.notes}</span>
                      </div>
                    )}

                    {/* Quick Actions Row: Quét tiếp / Sửa & Xem chi tiết */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-slate-500 font-mono space-x-2 truncate">
                        {p.packaging_date && <span>ĐG: {p.packaging_date}</span>}
                        {p.production_date && <span>NSX: {p.production_date}</span>}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!p.is_linked && (
                          <button
                            type="button"
                            onClick={() => {
                              setActivePalletStt(p.stt)
                              loadCurrentPalletBoxes(p.stt)
                              setActiveTab(p.scan_type === 'stamp' ? 'stamp' : 'label')
                              triggerToast(`Đang mở Pallet ${p.stt} để quét tiếp / chỉnh sửa`)
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition flex items-center gap-1 active:scale-95"
                          >
                            <Scan size={12} />
                            <span>Quét tiếp</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenPalletDetail(p)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 active:scale-95"
                        >
                          <span>Xem chi tiết</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Thanh phân trang mượt (50 LOT/trang giống Android) */}
                {totalPages > 1 && (
                  <div className="pt-2 pb-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1"
                    >
                      <ChevronLeft size={14} />
                      <span>Trước</span>
                    </button>

                    <div className="text-center">
                      <p className="text-xs font-bold text-sky-400">
                        Trang {safePage} / {totalPages}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Tổng {finalFilteredPallets.length} LOT ({PAGE_SIZE} LOT/trang)
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1"
                    >
                      <span>Sau</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MODAL 1: BỘ LỌC TÌM KIẾM LOT NÂNG CAO (Khớp PalletListScreen.tsx)
         ═══════════════════════════════════════════════════════════ */}
      {filterModalVisible && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0">
              <div className="flex items-center gap-2 text-sky-400">
                <SlidersHorizontal size={17} />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  🔍 Bộ Lọc Tìm Kiếm LOT Nâng Cao
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFilterModalVisible(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto overscroll-contain pr-1 flex-1 text-xs">
              {/* 1. Sản phẩm (tên / gõ tắt / SKU) */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  1. Sản phẩm (tên / gõ tắt / SKU)
                </label>
                <input
                  type="text"
                  value={filterProduct}
                  onChange={e => setFilterProduct(e.target.value)}
                  placeholder="Gõ tắt (VD: Đô c, srmc) hoặc tên SP..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500"
                />
                {modalProductSuggestions.length > 0 && (
                  <div className="mt-1 rounded-lg bg-slate-950 border border-slate-800 divide-y divide-slate-800/80 max-h-36 overflow-y-auto">
                    {modalProductSuggestions.map(prod => (
                      <button
                        type="button"
                        key={prod.product.id}
                        onClick={() => setFilterProduct(prod.fillValue)}
                        className="w-full p-2 text-left hover:bg-slate-800 flex items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="truncate">
                          <p className="font-bold text-white truncate">{prod.displayTitle}</p>
                          {prod.product.aliases && (
                            <p className="text-[10px] text-emerald-400 font-mono">
                              ⚡ Gõ tắt: {prod.product.aliases}
                            </p>
                          )}
                        </div>
                        {prod.product.sku && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px] shrink-0">
                            {prod.product.sku}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Nơi sản xuất */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  2. Nơi sản xuất / Nhà máy
                </label>
                <input
                  type="text"
                  value={filterProductionPlace}
                  onChange={e => setFilterProductionPlace(e.target.value)}
                  placeholder="Nhập nơi sản xuất..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
                {uniqueFilterOptions.places.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {uniqueFilterOptions.places.map(pl => (
                      <button
                        type="button"
                        key={pl}
                        onClick={() =>
                          setFilterProductionPlace(filterProductionPlace === pl ? '' : pl)
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                          filterProductionPlace === pl
                            ? 'bg-sky-600 border-sky-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {pl}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Vùng nguyên liệu */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  3. Vùng nguyên liệu / Tỉnh
                </label>
                <input
                  type="text"
                  value={filterMaterialZone}
                  onChange={e => setFilterMaterialZone(e.target.value)}
                  placeholder="Nhập vùng nguyên liệu..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
                {uniqueFilterOptions.zones.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {uniqueFilterOptions.zones.map(zn => (
                      <button
                        type="button"
                        key={zn}
                        onClick={() =>
                          setFilterMaterialZone(filterMaterialZone === zn ? '' : zn)
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                          filterMaterialZone === zn
                            ? 'bg-sky-600 border-sky-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {zn}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Vị trí trong kho */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  4. Vị trí trong kho (Rack / Ô)
                </label>
                <input
                  type="text"
                  value={filterLocation}
                  onChange={e => setFilterLocation(e.target.value.toUpperCase())}
                  placeholder="VD: A1-01, KHO1..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-amber-300 uppercase"
                />
                {uniqueFilterOptions.locations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {uniqueFilterOptions.locations.map(loc => (
                      <button
                        type="button"
                        key={loc}
                        onClick={() => setFilterLocation(filterLocation === loc ? '' : loc)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition ${
                          filterLocation === loc
                            ? 'bg-amber-600 border-amber-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Ngày đóng gói */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  5. Ngày đóng gói (dd/mm/yyyy)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={filterPackagingDate}
                    onChange={e => setFilterPackagingDate(e.target.value)}
                    placeholder="VD: 15/11/2026..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={() => openDatePicker('packaging')}
                    className="px-2.5 py-1.5 rounded-lg bg-sky-600/20 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Calendar size={13} />
                    <span>Chọn lịch</span>
                  </button>
                </div>
              </div>

              {/* 6. Ngày sản xuất */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  6. Ngày sản xuất / NSX (dd/mm/yyyy)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={filterProductionDate}
                    onChange={e => setFilterProductionDate(e.target.value)}
                    placeholder="VD: 15/11/2026..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={() => openDatePicker('production')}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Calendar size={13} />
                    <span>Chọn lịch</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={resetAllFilters}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Thiết lập lại
              </button>
              <button
                type="button"
                onClick={() => setFilterModalVisible(false)}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/30"
              >
                Áp dụng ({finalFilteredPallets.length} kết quả)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL 2: LỊCH CHỌN NGÀY (CALENDAR DATE PICKER)
         ═══════════════════════════════════════════════════════════ */}
      {calendarModalVisible && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#111827] border border-slate-700 rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-black uppercase text-white">
                📅 {calendarTargetField === 'packaging' ? 'Chọn Ngày Đóng Gói' : 'Chọn Ngày Sản Xuất'}
              </h4>
              <button
                type="button"
                onClick={() => setCalendarModalVisible(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Điều hướng Tháng / Năm */}
            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11)
                    setCalendarYear(y => y - 1)
                  } else {
                    setCalendarMonth(m => m - 1)
                  }
                }}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-black text-sky-400">
                Tháng {calendarMonth + 1} / {calendarYear}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0)
                    setCalendarYear(y => y + 1)
                  } else {
                    setCalendarMonth(m => m + 1)
                  }
                }}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Tiêu đề thứ */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Lưới ngày */}
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="h-8" />
                const formatted = `${String(day).padStart(2, '0')}/${String(
                  calendarMonth + 1
                ).padStart(2, '0')}/${calendarYear}`
                const currentVal =
                  calendarTargetField === 'packaging'
                    ? filterPackagingDate
                    : filterProductionDate
                const isSelected = currentVal === formatted
                return (
                  <button
                    type="button"
                    key={formatted}
                    onClick={() => {
                      if (calendarTargetField === 'packaging') {
                        setFilterPackagingDate(formatted)
                      } else {
                        setFilterProductionDate(formatted)
                      }
                      setCalendarModalVisible(false)
                    }}
                    className={`h-8 rounded-lg text-xs font-mono font-bold transition ${
                      isSelected
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-200'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Nút chọn nhanh Hôm nay / Hôm qua / Xóa */}
            <div className="flex gap-1.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const str = formatDdMmYyyy(new Date())
                  if (calendarTargetField === 'packaging') setFilterPackagingDate(str)
                  else setFilterProductionDate(str)
                  setCalendarModalVisible(false)
                }}
                className="flex-1 py-1.5 rounded-lg bg-sky-600/20 border border-sky-500/40 text-sky-300 text-[11px] font-bold"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => {
                  const yest = new Date()
                  yest.setDate(yest.getDate() - 1)
                  const str = formatDdMmYyyy(yest)
                  if (calendarTargetField === 'packaging') setFilterPackagingDate(str)
                  else setFilterProductionDate(str)
                  setCalendarModalVisible(false)
                }}
                className="flex-1 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-bold"
              >
                Hôm qua
              </button>
              <button
                type="button"
                onClick={() => {
                  if (calendarTargetField === 'packaging') setFilterPackagingDate('')
                  else setFilterProductionDate('')
                  setCalendarModalVisible(false)
                }}
                className="flex-1 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-[11px] font-bold"
              >
                Xóa ngày
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL 3: CHI TIẾT & NHÂN BẢN THÙNG PALLET NGOẠI TUYẾN (PENDING)
         ═══════════════════════════════════════════════════════════ */}
      {selectedPendingPallet && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0">
              <div>
                <h3 className="text-xs font-black uppercase text-amber-400">
                  📦 Pallet Ngoại Tuyến: {selectedPendingPallet.stt}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {selectedPendingPallet.product_name} ({selectedPendingPallet.boxes.length} thùng)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPendingPallet(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {pendingCloneBoxIdx !== null && (
              <div className="p-2.5 rounded-xl bg-sky-950/60 border border-sky-500/50 space-y-2 shrink-0">
                <div className="flex items-center justify-between text-xs font-bold text-sky-300">
                  <span>Nhân bản từ Thùng #{pendingCloneBoxIdx + 1}:</span>
                  <button
                    type="button"
                    onClick={() => setPendingCloneBoxIdx(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={pendingCloneCount}
                    onChange={e => setPendingCloneCount(e.target.value)}
                    className="w-24 px-2.5 py-1 rounded-lg bg-slate-950 border border-sky-500/50 font-mono text-sm font-bold text-sky-300"
                  />
                  {[5, 10, 20].map(n => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => setPendingCloneCount(String(n))}
                      className="px-2 py-1 rounded bg-slate-800 text-[10px] font-bold text-slate-300"
                    >
                      +{n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleClonePendingBox(pendingCloneBoxIdx)}
                    className="ml-auto px-3 py-1 rounded-lg bg-sky-600 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Check size={12} />
                    <span>Nhân bản</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overscroll-contain space-y-1.5 pr-1">
              {selectedPendingPallet.boxes.map((b, idx) => (
                <div
                  key={`${b.code}-${idx}`}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-amber-400">
                        #{b.metadata?.box_index || idx + 1}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 truncate">
                        {b.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 truncate">
                      {b.metadata?.product_name || selectedPendingPallet.product_name}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono text-[10px] font-bold">
                      {b.weight} Kg
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingCloneBoxIdx(idx)
                        setPendingCloneCount('1')
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 text-sky-400 hover:bg-slate-700"
                      title="Nhân bản thùng này"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePendingBox(idx)}
                      className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-slate-700"
                      title="Xóa thùng này"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedPendingPallet(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal phóng to ảnh con dấu full màn hình */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/92 backdrop-blur-xs flex flex-col items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewImageUrl(null)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
            title="Đóng xem ảnh"
          >
            <X size={24} />
          </button>
          <img
            src={previewImageUrl}
            alt="Con dấu phóng to"
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <p className="text-slate-400 text-xs font-medium mt-3">
            Chạm vào nền tối để đóng
          </p>
        </div>
      )}
    </div>
  )
}
