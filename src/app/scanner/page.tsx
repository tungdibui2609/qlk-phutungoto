'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Scan,
  Fingerprint,
  Boxes,
  Settings,
  Camera,
  RotateCw,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Check,
  ChevronRight,
  Share2,
  Smartphone,
  ExternalLink,
  Layers,
  Sparkles,
  RefreshCw,
  Calendar,
  Building2,
  MapPin,
  Tag,
  Hash,
  Loader2,
  Volume2,
  VolumeX,
  Zap,
  ZapOff,
  Wifi,
  WifiOff,
  Database,
  CloudDownload,
  HardDrive,
  Barcode,
  User,
  LogOut,
  Key,
  Sliders,
  CheckCheck,
  ArrowDownToLine,
  HelpCircle,
  Clock,
  ShieldCheck,
  ArrowRight,
  Info,
  Menu,
  Calculator,
  Map as MapIcon,
  ArrowLeft,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { decodeStampBox, DEFAULT_STAMP_DICT } from '@/lib/stampDecoder'
import { parseStampLines } from '@/lib/ocrParser'
import { decodeSTT } from '@/lib/numberUtils'
import {
  savePalletsToOfflineDb,
  getPalletsFromOfflineDb,
  saveLotsToOfflineDb,
  getLotsCountFromOfflineDb,
  searchLotsFromOfflineDb,
  addPendingPallet,
  getPendingPallets,
  removePendingPallet,
  removeBoxFromPendingPallet,
  updatePendingPalletStatus,
  getOfflineMeta,
  setOfflineMeta,
  OfflinePendingPallet,
  OfflineLot
} from '@/lib/scanner-db'
import { matchPalletSearch, calculateSearchScore, normalizeSearchString } from '@/lib/searchUtils'
import WarehouseMapTab from './_components/WarehouseMapTab'
import OperationsDataTab from './_components/OperationsDataTab'
import InventoryTab from './_components/InventoryTab'
import FullMenuModal from './_components/FullMenuModal'
import OperationWatermarkOverlay from './_components/OperationWatermarkOverlay'
import ScannerLoginView, {
  getStoredScannerUser,
  fetchScannerUserProfile,
  clearStoredScannerUser,
  StoredScannerAccount,
} from './_components/ScannerLoginView'

import type {
  BoxItem,
  PalletItem,
  ProductSuggestion,
  PendingStampData,
  ManualLabelFormState,
  ScannerUserProfile,
} from './_components/types'
import { playScanSound, triggerHaptic } from './_components/scannerUtils'
import { ScannerPalletsTab } from './_components/ScannerPalletsTab'
import { ScannerSettingsTab } from './_components/ScannerSettingsTab'
import { StampModals } from './_components/StampModals'
import { ScannerDialogHost, scannerAlert, scannerConfirm } from './_components/ScannerDialog'
import { LabelModals } from './_components/LabelModals'
import { PalletDetailModal } from './_components/PalletDetailModal'
import { PalletSwitchModal } from './_components/PalletSwitchModal'

type AppTab =
  | 'label'
  | 'stamp'
  | 'operations'
  | 'inventory'
  | 'warehouse_map'
  | 'pallets'
  | 'settings'

const normalizeAppTab = (tab: string): AppTab => {
  if (tab === 'stamp_scanner') return 'stamp'
  if (tab === 'scanner') return 'label'
  return tab as AppTab
}

export default function WebScannerPage() {
  // ── Navigation & Active Tab ────────────────────────────────────
  const [activeTab, setActiveTabState] = useState<AppTab>('stamp')
  const [isFullMenuOpen, setIsFullMenuOpen] = useState<boolean>(false)
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>({
    label: false,
    stamp: true,
    operations: false,
    inventory: false,
    warehouse_map: false,
    pallets: false,
  })
  const [palletListSubTab, setPalletListSubTab] = useState<'pending' | 'stamp_pending' | 'stamp_decoded' | 'cloud'>('pending')

  const setActiveTab = useCallback((next: React.SetStateAction<any>) => {
    setActiveTabState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      return normalizeAppTab(String(resolved))
    })
  }, [])

  useEffect(() => {
    setVisitedTabs((prev) => (prev[activeTab] ? prev : { ...prev, [activeTab]: true }))
  }, [activeTab])

  // ── Current Pallet Session State (Empty by default like Mobile App) ──
  const [activePalletStt, setActivePalletStt] = useState<string>('')
  const [activePalletTag, setActivePalletTag] = useState<string>('')
  const [activePalletNotes, setActivePalletNotes] = useState<string>('')
  const [targetQty, setTargetQty] = useState<number>(30)
  const [currentBoxes, setCurrentBoxes] = useState<BoxItem[]>([])
  const [loadingBoxes, setLoadingBoxes] = useState<boolean>(false)

  // ── Modals ─────────────────────────────────────────────────────
  const [isSwitchPalletModal, setIsSwitchPalletModal] = useState<boolean>(false)
  const [newSttInput, setNewSttInput] = useState<string>('')
  const [newTagInput, setNewTagInput] = useState<string>('')
  const [newNotesInput, setNewNotesInput] = useState<string>('')
  const [newTargetQtyInput, setNewTargetQtyInput] = useState<number>(30)
  const [defaultTargetQty, setDefaultTargetQty] = useState<number>(30)
  const [autoCompleteOnFull, setAutoCompleteOnFull] = useState<boolean>(true)

  const handleToggleAutoComplete = (val: boolean) => {
    setAutoCompleteOnFull(val)
    try {
      localStorage.setItem('config_auto_complete_pallet_on_full', val ? 'true' : 'false')
    } catch {}
  }

  // In-progress Pallet Startup Prompt Modal (Match Mobile App)
  const [inProgressPrompt, setInProgressPrompt] = useState<{
    stt: string
    boxesCount: number
    targetQty: number
    totalWeight: number
  } | null>(null)

  // Dedicated Box Clone Modal (Match Mobile App)
  const [cloneModalVisible, setCloneModalVisible] = useState<boolean>(false)
  const [cloneSampleBox, setCloneSampleBox] = useState<BoxItem | null>(null)
  const [cloneCount, setCloneCount] = useState<string>('1')
  const [isCloning, setIsCloning] = useState<boolean>(false)

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null)
  const stampReticleRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState<boolean>(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [torchActive, setTorchActive] = useState<boolean>(false)
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false)

  // Label Confirmation Modal
  const [pendingLabel, setPendingLabel] = useState<any | null>(null)
  const [labelWeight, setLabelWeight] = useState<string>('20')
  const [labelCount, setLabelCount] = useState<string>('1')
  const [isManualLabelModal, setIsManualLabelModal] = useState<boolean>(false)
  const [manualLabelForm, setManualLabelForm] = useState({
    sku: '',
    lot_code: '',
    product_name: '',
    box_index: '',
    weight: '20',
    spec: '2 Túi/ thùng',
    shift_group: 'Nguyên',
    region: 'Tây Nguyên',
    production_date: '',
    packaging_date: ''
  })

  // Stamp Confirmation Modal
  const [pendingStamp, setPendingStamp] = useState<{
    stamp_line1: string
    stamp_line2: string
    decoded?: any
    imageBase64?: string
  } | null>(null)
  const [stampWeight, setStampWeight] = useState<string>('20')
  const [stampCount, setStampCount] = useState<string>('1')
  const [isManualStampModal, setIsManualStampModal] = useState<boolean>(false)
  const [manualStampLine1, setManualStampLine1] = useState<string>('')
  const [manualStampLine2, setManualStampLine2] = useState<string>('')
  // Chụp gửi ảnh con dấu lên Web Mẹ (Server Gemini AI)
  const [pendingStampPhoto, setPendingStampPhoto] = useState<string | null>(null)
  const [pendingStampCrop, setPendingStampCrop] = useState<string | null>(null)
  const [queueBoxCount, setQueueBoxCount] = useState<string>('30')
  const [queueBoxWeight, setQueueBoxWeight] = useState<string>('20')
  const [uploadingStampPhoto, setUploadingStampPhoto] = useState<boolean>(false)

  // Pallet list tab (Tab 3)
  const [palletsList, setPalletsList] = useState<PalletItem[]>([])
  const [palletFilter, setPalletFilter] = useState<'all' | 'linked' | 'unlinked'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [availableProducts, setAvailableProducts] = useState<ProductSuggestion[]>([])
  const [showSearchSuggestions, setShowSearchSuggestions] = useState<boolean>(false)
  const [selectedPallet, setSelectedPallet] = useState<PalletItem | null>(null)
  const [selectedPalletBoxes, setSelectedPalletBoxes] = useState<BoxItem[]>([])
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)
  const [palletDisplayLimit, setPalletDisplayLimit] = useState<number>(30)

  // User Profile & System State (Top Header & Settings)
  const [authLoading, setAuthLoading] = useState<boolean>(true)
  const [userProfile, setUserProfile] = useState<{
    id?: string
    companyId?: string | null
    fullName: string
    email: string
    companyCode: string
    companyName: string
    roleName: string
  } | null>(null)

  const applyStoredAccount = useCallback((acc: StoredScannerAccount) => {
    setUserProfile({
      id: acc.id,
      companyId: acc.company_id || acc.company?.id || null,
      fullName: acc.full_name || 'Nhân viên kho',
      email: acc.email || acc.username || '',
      companyCode: acc.company?.code || 'CTG',
      companyName:
        acc.company?.name || 'Công Ty Cổ Phần Tập Đoàn XNK Trái Cây Chánh Thu',
      roleName: acc.role_name || acc.department || 'Vận hành kho',
    })
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch {}
    clearStoredScannerUser()
    setUserProfile(null)
    setActiveTab('stamp')
  }, [setActiveTab])

  // Settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true)
  const [systemCode, setSystemCode] = useState<string>('KHO_DONG_LANH')

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    if (soundEnabled) playScanSound()
    triggerHaptic()
    setTimeout(() => setToastMessage(null), 3000)
  }

  // ── Offline & Sync States ──────────────────────────────────────
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pendingPallets, setPendingPallets] = useState<OfflinePendingPallet[]>([])
  const [offlineLotsCount, setOfflineLotsCount] = useState<number>(0)
  const [lastLotsSync, setLastLotsSync] = useState<string | null>(null)
  const [isSyncingLots, setIsSyncingLots] = useState<boolean>(false)
  const [isSyncingPending, setIsSyncingPending] = useState<boolean>(false)

  // Offline Stamp Rules State
  const [stampRulesCount, setStampRulesCount] = useState<number>(0)
  const [lastStampSync, setLastStampSync] = useState<string | null>(null)
  const [syncingStamp, setSyncingStamp] = useState<boolean>(false)
  const [stampDictMap, setStampDictMap] = useState<Record<string, Record<string, string>>>(DEFAULT_STAMP_DICT)

  // Technician Mode (Easter egg: tap version 5 times)
  const [showTechnicianConfig, setShowTechnicianConfig] = useState<boolean>(false)
  const [technicianUrl, setTechnicianUrl] = useState<string>('https://api.chanhthu.click')
  const [testingConnection, setTestingConnection] = useState<boolean>(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const versionTapCountRef = useRef<number>(0)
  const lastTapTimeRef = useRef<number>(0)

  // ── Fetch User & Company Info on Mount (Match Android AuthContext) ──
  useEffect(() => {
    const fetchUser = async () => {
      setAuthLoading(true)
      try {
        // 1. Nạp ngay tài khoản đã lưu trong máy để vào thẳng app không cần mạng
        const stored = getStoredScannerUser()
        if (stored) {
          applyStoredAccount(stored)
        }

        // 2. Kiểm tra cập nhật ngầm nếu có kết nối mạng
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const fresh = await fetchScannerUserProfile(session.user.id, session.user.email)
          if (fresh) {
            applyStoredAccount(fresh)
          } else if (!stored) {
            setUserProfile({
              id: session.user.id,
              companyId: 'b503014d-19b6-464e-91f3-f34eba4b4b05',
              fullName:
                session.user.user_metadata?.full_name ||
                session.user.email?.split('@')[0] ||
                'Nhân viên kho',
              email: session.user.email || '',
              companyCode: 'CTG',
              companyName: 'Công Ty Cổ Phần Tập Đoàn XNK Trái Cây Chánh Thu',
              roleName: 'Vận hành kho',
            })
          }
        }
      } catch {
        const stored = getStoredScannerUser()
        if (stored) applyStoredAccount(stored)
      } finally {
        setAuthLoading(false)
      }
    }
    fetchUser()
  }, [applyStoredAccount])

  // ── Network Status & Offline DB Initialization ─────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      triggerToast('🟢 Đã khôi phục kết nối mạng!')
      getPendingPallets().then(pending => {
        setPendingPallets(pending)
        if (pending.length > 0) {
          triggerToast(`⚡ Có ${pending.length} pallet ngoại tuyến sẵn sàng đồng bộ`)
        }
      }).catch(() => {})
    }

    const handleOffline = () => {
      setIsOnline(false)
      triggerToast('🟠 Đang ở chế độ Ngoại Tuyến (Offline)')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Load initial offline meta and pending queue
    getPendingPallets().then(setPendingPallets).catch(() => {})
    getLotsCountFromOfflineDb().then(setOfflineLotsCount).catch(() => {})
    getOfflineMeta('lots_last_synced_at').then(setLastLotsSync).catch(() => {})

    // Load cached stamp rules & meta
    try {
      const savedDefTarget = localStorage.getItem('config_default_target_box_qty')
      if (savedDefTarget) {
        const parsed = parseInt(savedDefTarget, 10)
        if (!isNaN(parsed) && parsed > 0) {
          setDefaultTargetQty(parsed)
          setTargetQty(parsed)
          setNewTargetQtyInput(parsed)
        }
      }
      const savedAutoChot = localStorage.getItem('config_auto_complete_pallet_on_full')
      if (savedAutoChot !== null) {
        setAutoCompleteOnFull(savedAutoChot === 'true')
      }

      const savedStampTime = localStorage.getItem('last_stamp_sync_time')
      if (savedStampTime) setLastStampSync(savedStampTime)

      const savedCount = localStorage.getItem('cached_stamp_rules_count')
      if (savedCount) {
        setStampRulesCount(parseInt(savedCount, 10) || 0)
      } else {
        let defCount = 0
        Object.values(DEFAULT_STAMP_DICT).forEach(c => { defCount += Object.keys(c).length })
        setStampRulesCount(defCount)
      }

      const cachedDict = localStorage.getItem('cached_stamp_dictionaries')
      if (cachedDict) {
        const parsed = JSON.parse(cachedDict)
        // Luôn merge với DEFAULT_STAMP_DICT để không bị mất quy tắc ngoại lệ mặc định
        const merged: Record<string, Record<string, string>> = {}
        Object.keys(DEFAULT_STAMP_DICT).forEach(cat => {
          merged[cat] = { ...DEFAULT_STAMP_DICT[cat] }
        })
        Object.keys(parsed || {}).forEach(cat => {
          merged[cat] = { ...(merged[cat] || {}), ...parsed[cat] }
        })
        setStampDictMap(merged)
      }

      const cachedProds = localStorage.getItem('cached_products')
      if (cachedProds) {
        setAvailableProducts(JSON.parse(cachedProds))
      }
    } catch (e) {
      console.warn('Lỗi đọc cache quy tắc dấu đóng:', e)
    }

    // Tự động đồng bộ ngầm quy tắc dấu đóng (bao gồm ngoại lệ 12 số) từ Supabase khi online
    if (typeof navigator === 'undefined' || navigator.onLine) {
      syncStampRulesSilent()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ── Save Boxes Offline Helper ─────────────────────────────────
  const saveBoxesOffline = async (
    rowsToInsert: any[],
    palletStt: string,
    lotCode?: string | null,
    productName?: string | null,
    sku?: string | null,
    count: number = 1,
    scanType: 'label' | 'stamp' = 'label'
  ) => {
    try {
      await addPendingPallet({
        stt: palletStt,
        lot_code: lotCode || 'LOT',
        boxes_count: count,
        boxes: rowsToInsert.map(r => ({
          code: r.code,
          weight: r.quantity,
          system_code: r.system_code || 'KHO_DONG_LANH',
          metadata: r.metadata,
          time: new Date().toISOString()
        })),
        product_name: productName || undefined,
        sku: sku || undefined
      })

      const newBoxes: BoxItem[] = rowsToInsert.map((r, idx) => ({
        id: 'offline_' + Date.now() + '_' + idx,
        code: r.code,
        box_index: String(r.metadata?.box_index || (currentBoxes.length + idx + 1)),
        quantity: r.quantity,
        unit: r.unit || 'Kg',
        sku: r.metadata?.sku || sku || 'SKU',
        product_name: r.metadata?.product_name || productName || 'Hàng lưu ngoại tuyến',
        lot_code: lotCode || 'LOT',
        spec: r.metadata?.spec || '',
        shift_group: r.metadata?.shift_group || '',
        region: r.metadata?.region || '',
        production_date: r.metadata?.production_date || '',
        packaging_date: r.metadata?.packaging_date || '',
        raw_material_date: r.metadata?.raw_material_date || '',
        supplier: r.metadata?.supplier || '',
        supplier_name: r.metadata?.supplier ? `Mã NCC ${r.metadata?.supplier}` : '',
        scan_type: scanType,
        stamp_line1: r.metadata?.stamp_line1,
        stamp_line2: r.metadata?.stamp_line2,
        is_special_12: r.metadata?.is_special_12,
        special_12_code: r.metadata?.special_12_code,
        special_12_name: r.metadata?.special_12_name,
        created_at: new Date().toISOString()
      }))

      setCurrentBoxes(prev => [...prev, ...newBoxes])
      const pending = await getPendingPallets()
      setPendingPallets(pending)

      triggerToast(`✅ Đã lưu ${count} thùng vào Pallet ${palletStt} (Hàng chờ)!`)
    } catch (e: any) {
      await scannerAlert({ title: 'Lỗi lưu hàng chờ', message: e.message, variant: 'danger' })
    }
  }

  // ── Helper to decode Box Item matching Mobile App ────────────
  const parseBoxLabelItem = (b: any, idx: number, activeDict?: Record<string, Record<string, string>>): BoxItem => {
    const meta = b.metadata || {}
    let boxIndex = String(meta.box_index || '')
    if (!boxIndex && b.code) {
      const parts = b.code.split('-')
      const last = parts[parts.length - 1]
      if (!isNaN(parseInt(last))) boxIndex = parseInt(last, 10).toString()
    }
    if (!boxIndex) boxIndex = String(idx + 1)

    const stampLine1 = meta.stamp_line1 || (b.code?.startsWith('STAMP-') ? b.code.split('-')[1] : '')
    const stampLine2 = meta.stamp_line2 || b.finished_lot_code || b.semi_finished_lot_code || (b.code?.startsWith('STAMP-') ? b.code.split('-')[2] : '')
    const isStamp = meta.scan_type === 'stamp' || !!stampLine1 || !!stampLine2 || b.code?.startsWith('STAMP-')

    const dict = activeDict || DEFAULT_STAMP_DICT
    let isSpecial12 = false
    let special12Code = ''
    let special12Name = ''
    const rawL1 = stampLine1 || meta.sku || b.products?.sku || ''
    const c12 = rawL1.replace(/[^0-9]/g, '').slice(0, 12)
    if (c12.length >= 12 && (dict.special_12?.[c12] || DEFAULT_STAMP_DICT.special_12?.[c12])) {
      isSpecial12 = true
      special12Code = c12
      special12Name = dict.special_12?.[c12] || DEFAULT_STAMP_DICT.special_12[c12]
    }

    let factory = meta.shift_group || ''
    let packagingDate = meta.packaging_date || ''
    let rawMaterialDate = meta.raw_material_date || meta.production_date || ''
    let supplierCode = meta.supplier || meta.supplier_code || ''
    let supplierName = ''
    let province = meta.region || ''

    if (isStamp && stampLine2) {
      const cleanL2 = stampLine2.replace(/[^0-9]/g, '')
      if (cleanL2.length >= 1 && !factory) {
        const fCode = cleanL2.substring(0, 1)
        factory = dict.factory?.[fCode] || DEFAULT_STAMP_DICT.factory?.[fCode] || `Nhà máy ${fCode}`
      }
      if (cleanL2.length >= 5 && !packagingDate) {
        packagingDate = `${cleanL2.substring(1, 3)}/${cleanL2.substring(3, 5)}`
      }
      if (cleanL2.length >= 11 && !rawMaterialDate) {
        const DD = cleanL2.substring(5, 7)
        const MM = cleanL2.substring(7, 9)
        const YY = cleanL2.substring(9, 11)
        rawMaterialDate = `${DD}/${MM}/20${YY}`
      }
      if (cleanL2.length >= 14 && !supplierCode) {
        supplierCode = cleanL2.substring(11, 14)
      }
      if (cleanL2.length >= 16 && !province) {
        const pCode = cleanL2.substring(14, 16)
        province = dict.province?.[pCode] || DEFAULT_STAMP_DICT.province?.[pCode] || `Tỉnh mã ${pCode}`
      }
    }

    if (supplierCode) {
      supplierName = `Mã NCC ${supplierCode}`
    }

    let specVal = meta.spec || ''
    if (isSpecial12 && special12Name) {
      const parts = special12Name.split(' - ').map((s: string) => s.trim())
      specVal = parts.length >= 2 ? `${parts[1]}${parts[2] ? ` (${parts[2]})` : ''}` : 'Hàng có hạt (Hầm đông)'
    }

    return {
      id: b.id,
      code: b.code,
      box_index: boxIndex,
      quantity: Number(b.quantity) || 20,
      unit: b.unit || 'Kg',
      sku: isSpecial12 ? special12Code : (meta.sku || b.products?.sku || 'SKU'),
      product_name: isSpecial12 ? special12Name : (meta.product_name || b.products?.name || b.products?.internal_name || 'Hàng đông lạnh'),
      lot_code: b.finished_lot_code || b.semi_finished_lot_code || meta.lot_code || stampLine2 || 'LOT',
      spec: specVal,
      shift_group: factory,
      region: province,
      production_date: meta.production_date || rawMaterialDate,
      packaging_date: packagingDate,
      raw_material_date: rawMaterialDate,
      supplier: supplierCode,
      supplier_name: supplierName,
      scan_type: isStamp ? 'stamp' : (meta.scan_type || 'label'),
      stamp_line1: stampLine1 || undefined,
      stamp_line2: stampLine2 || undefined,
      is_special_12: isSpecial12,
      special_12_code: special12Code,
      special_12_name: special12Name,
      created_at: b.created_at
    } as BoxItem
  }

  // ── Load Pallet Boxes for an Active Pallet ──────────────────────
  const loadCurrentPalletBoxes = useCallback(async (stt: string) => {
    if (!stt || !stt.trim()) {
      setCurrentBoxes([])
      return
    }
    setLoadingBoxes(true)
    const cleanStt = stt.trim().toUpperCase()

    try {
      // 1. Luôn đọc các thùng đang nằm trong Hàng chờ local (IndexedDB) của Pallet này
      const pending = await getPendingPallets()
      const matchingPending = pending.filter(p => (p.stt || '').trim().toUpperCase() === cleanStt)
      const localBoxes: BoxItem[] = []
      const seenCodes = new Set<string>()
      let overallIdx = 1

      matchingPending.forEach(p => {
        ;(p.boxes || []).forEach((b, bIdx) => {
          const meta = b.metadata || {}
          if (b.code) seenCodes.add(b.code)
          if (meta.pallet_tag) setActivePalletTag(meta.pallet_tag)
          if (meta.pallet_notes) setActivePalletNotes(meta.pallet_notes)
          if (meta.target_qty) setTargetQty(parseInt(meta.target_qty, 10) || 30)
          localBoxes.push({
            id: `offline_${p.client_id}_${bIdx}_${b.code}`,
            code: b.code,
            box_index: String(meta.box_index || overallIdx++),
            quantity: b.weight,
            unit: 'Kg',
            sku: meta.sku || p.sku || 'SKU',
            product_name: meta.product_name || p.product_name || 'Hàng lưu ngoại tuyến',
            lot_code: meta.lot_code || meta.stamp_line2 || p.lot_code || 'LOT',
            spec: meta.spec || '',
            shift_group: meta.shift_group || '',
            region: meta.region || '',
            production_date: meta.production_date || '',
            packaging_date: meta.packaging_date || '',
            raw_material_date: meta.raw_material_date || '',
            supplier: meta.supplier || '',
            supplier_name: meta.supplier ? `Mã NCC ${meta.supplier}` : '',
            scan_type: (meta.scan_type as any) || 'label',
            stamp_line1: meta.stamp_line1,
            stamp_line2: meta.stamp_line2,
            is_special_12: meta.is_special_12,
            special_12_code: meta.special_12_code,
            special_12_name: meta.special_12_name,
            created_at: b.time
          })
        })
      })

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        localBoxes.sort((a, b) => (parseInt(a.box_index, 10) || 0) - (parseInt(b.box_index, 10) || 0))
        setCurrentBoxes(localBoxes)
        return
      }

      const { data, error } = await supabase
        .from('box_labels')
        .select(`
          id,
          code,
          quantity,
          unit,
          semi_finished_lot_code,
          finished_lot_code,
          metadata,
          created_at,
          products ( name, sku, internal_name )
        `)
        .filter('metadata->>pallet_stt', 'eq', cleanStt)
        .order('code', { ascending: true })

      if (!error && data) {
        let palletTarget = 30
        if (data.length > 0) {
          const firstMeta = (data as any[])[0]?.metadata || {}
          if (firstMeta.pallet_tag) setActivePalletTag(firstMeta.pallet_tag)
          if (firstMeta.pallet_notes) setActivePalletNotes(firstMeta.pallet_notes)
          if (firstMeta.target_qty) {
            palletTarget = parseInt(firstMeta.target_qty, 10) || 30
            setTargetQty(palletTarget)
          }
        }
        const cloudMapped = data
          .filter((b: any) => !seenCodes.has(b.code))
          .map((b: any, idx: number) => parseBoxLabelItem(b, idx, stampDictMap))

        const merged = [...cloudMapped, ...localBoxes]
        merged.sort((a: BoxItem, b: BoxItem) => (parseInt(a.box_index, 10) || 0) - (parseInt(b.box_index, 10) || 0))
        setCurrentBoxes(merged)
      } else {
        localBoxes.sort((a, b) => (parseInt(a.box_index, 10) || 0) - (parseInt(b.box_index, 10) || 0))
        setCurrentBoxes(localBoxes)
      }
    } catch (e: any) {
      console.warn('Lỗi tải danh sách thùng của Pallet:', e)
    } finally {
      setLoadingBoxes(false)
    }
  }, [stampDictMap])

  // ── Initial startup prompt check (Does NOT pre-fill boxes until user clicks continue!) ──
  useEffect(() => {
    const checkStartupPallet = async () => {
      try {
        const savedStt = localStorage.getItem('last_worked_pallet_stt')
        if (!savedStt || !savedStt.trim()) return

        const { data, error } = await supabase
          .from('box_labels')
          .select('id, quantity, metadata')
          .filter('metadata->>pallet_stt', 'eq', savedStt)

        if (!error && data && (data as any[]).length > 0) {
          const list = data as any[]
          const totalW = list.reduce((s: number, b: any) => s + (Number(b.quantity) || 20), 0)
          const target = parseInt(list[0]?.metadata?.target_qty, 10) || 30
          setInProgressPrompt({
            stt: savedStt,
            boxesCount: list.length,
            targetQty: target,
            totalWeight: totalW
          })
        }
      } catch (e) {
        console.warn('Lỗi kiểm tra pallet dở dang khi khởi động:', e)
      }
    }
    checkStartupPallet()
  }, [])

  // ── Camera Management ──────────────────────────────────────────
  const startCamera = async () => {
    try {
      setCameraError(null)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraActive(true)
      }
    } catch (err: any) {
      console.warn('Lỗi mở Camera:', err)
      setCameraError('Không thể mở Camera. Vui lòng cấp quyền Camera trên trình duyệt!')
      setCameraActive(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    setTorchActive(false)
  }

  useEffect(() => {
    if (userProfile && (activeTab === 'label' || activeTab === 'stamp')) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [activeTab, userProfile])

  // ── Flashlight Toggle ──────────────────────────────────────────
  const handleToggleTorch = async () => {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    if (!track) return

    try {
      const caps = (track.getCapabilities && track.getCapabilities()) as any
      if (caps && caps.torch) {
        const next = !torchActive
        await (track as any).applyConstraints({ advanced: [{ torch: next }] })
        setTorchActive(next)
      } else {
        triggerToast('Thiết bị không hỗ trợ đèn Flash trên trình duyệt này')
      }
    } catch {
      triggerToast('Không thể bật/tắt đèn Flash')
    }
  }

  // ── Capture Frame & OCR Recognition ────────────────────────────
  const captureFrame = (mode: 'stamp' | 'label' = 'label'): string | null => {
    if (!videoRef.current) return null
    const v = videoRef.current
    if (v.videoWidth === 0 || v.videoHeight === 0) return null

    // Với chế độ Dấu Mực: crop đúng vùng khung ngắm (có padding 10%), upscale & tăng tương phản
    if (mode === 'stamp') {
      let sx = 0
      let sy = 0
      let sw = v.videoWidth
      let sh = v.videoHeight

      const reticleEl = stampReticleRef.current
      if (reticleEl) {
        const vRect = v.getBoundingClientRect()
        const rRect = reticleEl.getBoundingClientRect()
        if (vRect.width > 0 && vRect.height > 0 && rRect.width > 0 && rRect.height > 0) {
          // Video dùng object-cover nên cần map tọa độ từ khung hiển thị về pixel gốc của video
          const scale = Math.max(vRect.width / v.videoWidth, vRect.height / v.videoHeight)
          const renderedW = v.videoWidth * scale
          const renderedH = v.videoHeight * scale
          const offsetX = (renderedW - vRect.width) / 2
          const offsetY = (renderedH - vRect.height) / 2

          const rawSx = ((rRect.left - vRect.left) + offsetX) / scale
          const rawSy = ((rRect.top - vRect.top) + offsetY) / scale
          const rawSw = rRect.width / scale
          const rawSh = rRect.height / scale

          const padX = rawSw * 0.22
          const padY = rawSh * 0.2
          sx = Math.max(0, Math.floor(rawSx - padX))
          sy = Math.max(0, Math.floor(rawSy - padY))
          sw = Math.min(v.videoWidth - sx, Math.ceil(rawSw + padX * 2))
          sh = Math.min(v.videoHeight - sy, Math.ceil(rawSh + padY * 2))
        }
      }

      if (sw <= 0 || sh <= 0) {
        sx = 0
        sy = 0
        sw = v.videoWidth
        sh = v.videoHeight
      }

      // Upscale vùng crop lên độ phân giải chuẩn cho Tesseract (tối thiểu 1400px ngang)
      const targetW = Math.min(1800, Math.max(1400, Math.round(sw * 2)))
      const targetH = Math.max(1, Math.round((sh / sw) * targetW))

      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, targetW, targetH)

      // Tiền xử lý ảnh: chuyển grayscale + kéo giãn tương phản theo percentile (2%-96%) giúp mực đen nổi bật trên bìa carton
      try {
        const imgData = ctx.getImageData(0, 0, targetW, targetH)
        const data = imgData.data
        const pixelCount = targetW * targetH
        const lumArr = new Uint8Array(pixelCount)
        const hist = new Uint32Array(256)
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
          lumArr[p] = lum
          hist[lum]++
        }
        const lowTarget = Math.floor(pixelCount * 0.02)
        const highTarget = Math.floor(pixelCount * 0.96)
        let acc = 0
        let minLum = 0
        let maxLum = 255
        for (let v = 0; v < 256; v++) {
          acc += hist[v]
          if (acc >= lowTarget) { minLum = v; break }
        }
        acc = 0
        for (let v = 255; v >= 0; v--) {
          acc += pixelCount > 0 ? hist[v] : 0
          if (acc >= pixelCount - highTarget) { maxLum = v; break }
        }
        const range = Math.max(24, maxLum - minLum)
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          let norm = (lumArr[p] - minLum) / range
          norm = Math.max(0, Math.min(1, norm))
          norm = norm < 0.42 ? norm * 0.78 : Math.min(1, 0.42 * 0.78 + (norm - 0.42) * 1.15)
          const vByte = Math.max(0, Math.min(255, Math.round(norm * 255)))
          data[i] = vByte
          data[i + 1] = vByte
          data[i + 2] = vByte
        }
        ctx.putImageData(imgData, 0, 0)
      } catch {
        // Fallback nếu trình duyệt chặn getImageData
      }

      // Thêm viền trắng (quiet zone) xung quanh ảnh để Tesseract không cắt mất ký tự đầu/cuối dòng
      const quietPad = 36
      const paddedCanvas = document.createElement('canvas')
      paddedCanvas.width = targetW + quietPad * 2
      paddedCanvas.height = targetH + quietPad * 2
      const pCtx = paddedCanvas.getContext('2d')
      if (pCtx) {
        pCtx.fillStyle = '#ffffff'
        pCtx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height)
        pCtx.drawImage(canvas, quietPad, quietPad)
        return paddedCanvas.toDataURL('image/jpeg', 0.94)
      }

      return canvas.toDataURL('image/jpeg', 0.94)
    }

    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  }

  const handleCaptureAndRecognize = useCallback(async () => {
    if (!activePalletStt) {
      await scannerAlert({
        title: 'Chưa có Pallet',
        message: 'Vui lòng bấm [Chọn / Nhập STT Pallet] trước khi quét tem thùng.',
        variant: 'warning',
      })
      setIsSwitchPalletModal(true)
      return
    }

    const mode = activeTab === 'stamp' ? 'stamp' : 'label'
    const base64 = captureFrame(mode)
    if (!base64) {
      triggerToast('Không thể lấy khung hình Camera')
      return
    }

    setIsRecognizing(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 22000)

    try {
      let json: any = null

      const isOfflineMode = typeof navigator !== 'undefined' && !navigator.onLine

      if (!isOfflineMode) {
        try {
          const res = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64, mode }),
            signal: controller.signal
          })
          if (res.ok) {
            json = await res.json()
          }
        } catch (netErr: any) {
          console.warn('[OCR] Server fetch /api/ocr thất bại, tự động chuyển Client OCR offline:', netErr)
        }
      }

      // Fallback sang Client-Side OCR chạy trực tiếp trên trình duyệt bằng Tesseract Web Worker offline
      if (!json || !json.success) {
        try {
          const { recognizeClientSide } = await import('@/lib/clientOcr')
          json = await recognizeClientSide(base64, mode, stampDictMap)
        } catch (clientErr: any) {
          console.error('[OCR] Nhận diện offline client-side thất bại:', clientErr)
          throw new Error(json?.error || clientErr.message || 'Không thể nhận diện văn bản (cả server lẫn client offline)')
        }
      }

      clearTimeout(timeoutId)

      if (!json || !json.success) throw new Error(json?.error || 'Nhận diện thất bại')

      if (mode === 'stamp') {
        // Re-parse bằng stampDictMap mới nhất ở client để nhận diện chuẩn special_12 & đảo dòng nếu cần
        const stampData = json.rawText
          ? parseStampLines(json.rawText, stampDictMap)
          : json.data
        const l1 = stampData?.stamp_line1 || ''
        const l2 = stampData?.stamp_line2 || ''
        if (!l1 && !l2) {
          triggerToast('Không đọc được dãy số con dấu. Vui lòng căn sát 2 dòng vào khung ngắm!')
          return
        }
        playScanSound()
        triggerHaptic()
        const localDecoded = decodeStampBox({
          metadata: { scan_type: 'stamp', stamp_line1: l1, stamp_line2: l2 }
        }, stampDictMap)
        setPendingStamp({
          stamp_line1: l1,
          stamp_line2: l2,
          decoded: localDecoded || stampData.decoded,
          imageBase64: base64,
        })
        setStampWeight('20')
        setStampCount('1')
      } else {
        playScanSound()
        triggerHaptic()
        const labelData = json.data
        setPendingLabel(labelData)
        setLabelWeight(String(labelData.weight || 20))
        setLabelCount('1')
      }
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        triggerToast('Quá thời gian nhận diện OCR (timeout). Vui lòng thử lại!')
      } else {
        triggerToast(`Lỗi OCR: ${err.message || 'Không đọc được văn bản'}`)
      }
    } finally {
      setIsRecognizing(false)
    }
  }, [activePalletStt, activeTab, stampDictMap])

  // ── Hardware / Keyboard Trigger (Space or Enter like Volume Down on Mobile)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter') {
        if (activeTab === 'label' || activeTab === 'stamp') {
          e.preventDefault()
          handleCaptureAndRecognize()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, handleCaptureAndRecognize])

  // ── Lắng nghe Realtime Web Mẹ duyệt Pallet con dấu ───────────
  useEffect(() => {
    if (!systemCode) return
    const channel = supabase
      .channel('stamp_queue_realtime_scanner')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stamp_scan_queue',
          filter: `system_code=eq.${systemCode}`,
        },
        (payload: any) => {
          const updated = payload?.new
          if (updated && updated.status === 'approved') {
            try {
              playScanSound()
              triggerHaptic()
            } catch {}
            triggerToast(`🎉 Web Mẹ đã duyệt Pallet STT ${updated.pallet_stt} (${updated.box_count} thùng)!`)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [systemCode])

  // ── Save Stamp Box to Supabase ────────────────────────────────
  const handleSaveStampBox = async () => {
    if (!pendingStamp || !activePalletStt) return
    const cleanStt = activePalletStt.trim().toUpperCase()
    const count = parseInt(stampCount, 10) || 1
    const weightVal = parseFloat(stampWeight) || 20

    try {
      const l1 = pendingStamp.stamp_line1.trim()
      const l2 = pendingStamp.stamp_line2.trim()
      const dec = decodeStampBox({
        metadata: { scan_type: 'stamp', stamp_line1: l1, stamp_line2: l2 }
      }, stampDictMap)

      // Get highest current box_index
      let startIdx = 1
      if (currentBoxes.length > 0) {
        const maxIdx = Math.max(...currentBoxes.map(b => parseInt(b.box_index, 10) || 0))
        startIdx = maxIdx + 1
      }

      const rowsToInsert = []
      for (let i = 0; i < count; i++) {
        const idx = startIdx + i
        const boxCode = `STAMP-${l1}-${l2}-${cleanStt}-${String(idx).padStart(3, '0')}`
        rowsToInsert.push({
          code: boxCode,
          quantity: weightVal,
          unit: 'Kg',
          semi_finished_lot_code: l2,
          finished_lot_code: l2,
          system_code: 'KHO_DONG_LANH',
          status: 'printed',
          metadata: {
            pallet_stt: cleanStt,
            pallet_tag: activePalletTag || undefined,
            pallet_notes: activePalletNotes || undefined,
            target_qty: targetQty || undefined,
            scan_type: 'stamp',
            stamp_line1: l1,
            stamp_line2: l2,
            box_index: idx,
            sku: dec.isSpecial12 ? dec.special12Code : (dec.code || 'SKU'),
            product_name: dec.productTitle || (dec.isSpecial12 ? dec.special12Name : 'Sản phẩm đóng dấu'),
            spec: dec.spec || 'Ngoại lệ trọn gói',
            shift_group: dec.factoryName,
            region: dec.provinceName,
            production_date: dec.rawMaterialDateStr,
            raw_material_date: dec.rawMaterialDateStr,
            packaging_date: dec.packagingDateStr,
            supplier: dec.supplierCode,
            is_special_12: dec.isSpecial12,
            special_12_code: dec.special12Code,
            special_12_name: dec.special12Name,
          }
        })
      }

      // 1. Local-First: lưu vào Hàng chờ (IndexedDB) ngay tức thì (0ms lag)
      await saveBoxesOffline(
        rowsToInsert,
        cleanStt,
        l2,
        dec.productTitle || (dec.isSpecial12 ? dec.special12Name : 'Sản phẩm đóng dấu'),
        dec.isSpecial12 ? dec.special12Code : (dec.code || 'SKU'),
        count,
        'stamp'
      )

      const capturedPhoto = pendingStamp.imageBase64
      setPendingStamp(null)
      checkTargetReached(currentBoxes.length + count)

      // 2. Tải ảnh con dấu lên Google Drive CON_DAU chạy ngầm trong nền (không làm chậm tiến độ)
      if (capturedPhoto) {
        fetch('/api/stamp-queue/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload_only',
            imageBase64: capturedPhoto,
            palletStt: cleanStt,
            systemCode: 'KHO_DONG_LANH',
          }),
        })
          .catch(e => console.warn('[ScannerStamp] Tải ảnh lên Google Drive CON_DAU ngầm:', e))
      }
    } catch (err: any) {
      console.warn('Exception khi lưu thùng con dấu:', err)
    }
  }

  // ── Chụp ảnh con dấu gửi lên Web Mẹ (Server Gemini AI xử lý) ──
  const handleCaptureStampPhotoForServer = async () => {
    if (!activePalletStt) {
      await scannerAlert({
        title: 'Chưa có Pallet',
        message: 'Vui lòng chọn hoặc nhập STT Pallet trước khi chụp ảnh con dấu!',
        variant: 'warning',
      })
      setIsSwitchPalletModal(true)
      return
    }
    const fullBase64 = captureFrame('label')
    if (!fullBase64) {
      triggerToast('Không thể lấy khung hình Camera')
      return
    }
    const cropBase64 = captureFrame('stamp')
    playScanSound()
    triggerHaptic()
    setQueueBoxCount(String(targetQty || 30))
    setQueueBoxWeight('20')
    setPendingStampPhoto(fullBase64)
    setPendingStampCrop(cropBase64)
  }

  const handleSubmitStampPhotoToQueue = async () => {
    if (!pendingStampPhoto || !activePalletStt) return

    // 1. Phản hồi TỨC THỜI (0ms): Đóng modal ngay lập tức, phát âm thanh & rung thành công
    const targetPhoto = pendingStampPhoto
    const targetCrop = pendingStampCrop
    const targetStt = activePalletStt.trim().toUpperCase()
    const targetTag = activePalletTag || null
    const targetNotes = activePalletNotes || null
    const targetCount = Math.max(1, parseInt(queueBoxCount, 10) || 30)
    const targetWeight = parseFloat(queueBoxWeight) || 20

    setPendingStampPhoto(null)
    setPendingStampCrop(null)
    playScanSound()
    triggerHaptic()
    triggerToast(`🚀 Đã nhận Pallet ${targetStt}! Ảnh đang được đồng bộ ngầm lên Web Mẹ.`)

    // 2. Tải ảnh lên Google Drive & Supabase chạy HOÀN TOÀN TRONG NỀN (không làm chậm tiến độ quét)
    fetch('/api/stamp-queue/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: targetPhoto,
        croppedBase64: targetCrop,
        palletStt: targetStt,
        palletTag: targetTag,
        palletNotes: targetNotes,
        boxCount: targetCount,
        boxWeight: targetWeight,
        systemCode: systemCode || 'KHO_DONG_LANH',
        createdBy: userProfile?.id || null,
        createdByName: userProfile?.fullName || 'Nhân viên kho',
      }),
    })
      .then(async res => {
        const data = await res.json()
        if (data.success) {
          triggerToast(
            data.isGoogleDrive
              ? `🎉 Đã lưu Google Drive (CON_DAU) & gửi Pallet ${targetStt} lên Web Mẹ!`
              : `🎉 Đã gửi ảnh Pallet ${targetStt} lên Web Mẹ thành công!`
          )
        } else {
          console.warn('[ScannerStamp] Đồng bộ ảnh con dấu ngầm thất bại nhẹ:', data.error)
        }
      })
      .catch(err => {
        console.warn('[ScannerStamp] Lỗi mạng khi đồng bộ ảnh con dấu ngầm:', err?.message)
      })
  }

  // ── Save Label Box (Local-First matching Android) ──────────────
  const handleSaveLabelBox = async (labelData: any, w: number, count: number) => {
    if (!activePalletStt) return
    const cleanStt = activePalletStt.trim().toUpperCase()
    try {
      let startIdx = 1
      if (currentBoxes.length > 0) {
        const maxIdx = Math.max(...currentBoxes.map(b => parseInt(b.box_index, 10) || 0))
        startIdx = maxIdx + 1
      }

      const rowsToInsert = []
      for (let i = 0; i < count; i++) {
        const idx = startIdx + i
        const boxCode = `${cleanStt}-${labelData.lot_code || 'LOT'}-${String(idx).padStart(3, '0')}`
        rowsToInsert.push({
          code: boxCode,
          quantity: w,
          unit: 'Kg',
          semi_finished_lot_code: labelData.lot_code,
          finished_lot_code: labelData.lot_code,
          system_code: 'KHO_DONG_LANH',
          status: 'printed',
          metadata: {
            pallet_stt: cleanStt,
            pallet_tag: activePalletTag || undefined,
            pallet_notes: activePalletNotes || undefined,
            target_qty: targetQty || undefined,
            scan_type: 'label',
            box_index: idx,
            sku: labelData.sku || 'SKU',
            product_name: labelData.product_name || 'Hàng đông lạnh',
            spec: labelData.spec || '2 Túi/ thùng',
            shift_group: labelData.shift_group || 'Nguyên',
            region: labelData.region || 'Tây Nguyên',
            production_date: labelData.production_date || '',
            packaging_date: labelData.packaging_date || ''
          }
        })
      }

      await saveBoxesOffline(
        rowsToInsert,
        cleanStt,
        labelData.lot_code,
        labelData.product_name,
        labelData.sku,
        count,
        'label'
      )

      setPendingLabel(null)
      checkTargetReached(currentBoxes.length + count)
    } catch (err: any) {
      await scannerAlert({ title: 'Lỗi lưu tem', message: err.message, variant: 'danger' })
    }
  }

  // ── Target Reached Check ──────────────────────────────────────
  const checkTargetReached = (totalCount: number) => {
    if (totalCount >= targetQty) {
      if (autoCompleteOnFull) {
        setTimeout(() => {
          triggerToast(`🎉 Pallet ${activePalletStt} đã đủ ${totalCount}/${targetQty} thùng và được TỰ ĐỘNG CHỐT!`)
          handleCompletePallet()
        }, 300)
      } else {
        setTimeout(async () => {
          const ok = await scannerConfirm({
            title: '🎉 ĐÃ ĐỦ PALLET!',
            message: `Pallet ${activePalletStt} đã đạt chỉ tiêu ${totalCount}/${targetQty} thùng.\n\nBạn có muốn CHỐT PALLET này ngay không?`,
            confirmText: 'Chốt Pallet Ngay',
            cancelText: 'Để sau',
            variant: 'celebrate',
          })
          if (ok) {
            handleCompletePallet()
          }
        }, 400)
      }
    }
  }

  // ── Complete Pallet (Chốt Pallet -> Đưa vào Hàng chờ Pallet Kho) ──
  const handleCompletePallet = async () => {
    const completedStt = activePalletStt
    try {
      const updatedPending = await getPendingPallets()
      setPendingPallets(updatedPending)
    } catch {}

    triggerToast(`🎉 ĐÃ CHỐT PALLET ${completedStt}! Đã chuyển vào Hàng chờ (Pallet Kho).`)
    // Reset session
    setActivePalletStt('')
    setActivePalletTag('')
    setActivePalletNotes('')
    setCurrentBoxes([])
    localStorage.removeItem('last_worked_pallet_stt')

    setTimeout(() => {
      setNewSttInput('')
      setNewTagInput('')
      setNewNotesInput('')
      setNewTargetQtyInput(defaultTargetQty || 30)
      setIsSwitchPalletModal(true)
    }, 600)
  }

  // ── Clone Box Modal Handlers ───────────────────────────────────
  const handleOpenCloneModal = (box: BoxItem) => {
    setCloneSampleBox(box)
    const remaining = Math.max(1, targetQty - currentBoxes.length)
    setCloneCount(String(remaining > 0 ? remaining : 1))
    setCloneModalVisible(true)
  }

  const handleConfirmClone = async () => {
    if (!cloneSampleBox || !activePalletStt) return
    const count = parseInt(cloneCount, 10) || 1
    if (count <= 0) return

    setIsCloning(true)
    try {
      if (cloneSampleBox.scan_type === 'stamp') {
        setPendingStamp({
          stamp_line1: cloneSampleBox.stamp_line1 || cloneSampleBox.sku || '',
          stamp_line2: cloneSampleBox.stamp_line2 || cloneSampleBox.lot_code || '',
          decoded: decodeStampBox({
            metadata: {
              scan_type: 'stamp',
              stamp_line1: cloneSampleBox.stamp_line1,
              stamp_line2: cloneSampleBox.stamp_line2
            }
          }, stampDictMap)
        })
        setStampWeight(String(cloneSampleBox.quantity || 20))
        setStampCount(String(count))
        setCloneModalVisible(false)
        await handleSaveStampBox()
      } else {
        await handleSaveLabelBox(
          {
            sku: cloneSampleBox.sku,
            lot_code: cloneSampleBox.lot_code,
            product_name: cloneSampleBox.product_name,
            spec: cloneSampleBox.spec,
            shift_group: cloneSampleBox.shift_group,
            region: cloneSampleBox.region,
            production_date: cloneSampleBox.production_date,
            packaging_date: cloneSampleBox.packaging_date
          },
          cloneSampleBox.quantity || 20,
          count
        )
        setCloneModalVisible(false)
      }
    } catch (e: any) {
      await scannerAlert({ title: 'Lỗi nhân bản thùng', message: e.message, variant: 'danger' })
    } finally {
      setIsCloning(false)
    }
  }

  // ── Delete Box ────────────────────────────────────────────────
  const handleDeleteBox = async (boxId: string) => {
    const ok = await scannerConfirm({
      title: 'Xóa thùng hàng?',
      message: 'Bạn có chắc muốn xóa thùng này khỏi Pallet không?',
      confirmText: 'Xóa thùng',
      cancelText: 'Huỷ',
      variant: 'danger',
    })
    if (!ok) return
    try {
      if (boxId.startsWith('offline_')) {
        const targetBox = currentBoxes.find(b => b.id === boxId)
        if (targetBox && activePalletStt) {
          await removeBoxFromPendingPallet(activePalletStt, targetBox.code)
          const updatedPending = await getPendingPallets()
          setPendingPallets(updatedPending)
        }
        setCurrentBoxes(prev => prev.filter(b => b.id !== boxId))
        triggerToast('Đã xóa thùng khỏi hàng chờ')
        return
      }

      const { error } = await supabase.from('box_labels').delete().eq('id', boxId)
      if (error) throw error
      triggerToast('Đã xóa thùng thành công')
      loadCurrentPalletBoxes(activePalletStt)
    } catch (err: any) {
      await scannerAlert({ title: 'Lỗi xóa thùng', message: err.message, variant: 'danger' })
    }
  }

  // ── Làm mới / Xoá toàn bộ thùng của Pallet đang chọn (Khớp Mobile App) ─────
  const handleResetActivePallet = async (targetStt?: string) => {
    const stt = (targetStt || activePalletStt || '').trim().toUpperCase()
    if (!stt) return
    const boxCount = currentBoxes.length
    const totalW = currentBoxes.reduce((s, b) => s + (b.quantity || 20), 0)

    if (!targetStt) {
      const ok = await scannerConfirm({
        title: `Xoá thùng Pallet ${stt}?`,
        message: `Bạn có chắc chắn muốn xoá toàn bộ ${boxCount} thùng (${totalW.toFixed(1)} Kg) của Pallet ${stt} để quét lại từ đầu không?`,
        confirmText: 'Xoá toàn bộ',
        cancelText: 'Giữ lại',
        variant: 'danger',
      })
      if (!ok) return
    }

    try {
      // 1. Xóa trên Cloud
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const { error } = await supabase
          .from('box_labels')
          .delete()
          .filter('metadata->>pallet_stt', 'eq', stt)
        if (error) console.warn('Lỗi xoá thùng trên Supabase:', error)
      }

      // 2. Xoá trong Pending offline nếu có
      const pending = await getPendingPallets()
      const match = pending.find(p => p.stt === stt)
      if (match) {
        await removePendingPallet(match.client_id)
        const updated = await getPendingPallets()
        setPendingPallets(updated)
      }

      setCurrentBoxes([])
      triggerToast(`Đã làm mới Pallet ${stt} về 0 thùng!`)
      loadAllPallets().catch(() => {})
    } catch (err: any) {
      await scannerAlert({ title: 'Lỗi làm mới Pallet', message: err.message, variant: 'danger' })
    }
  }

  // ── Xử lý chuyển Pallet thông minh (Khớp cảnh báo tồn tại như Mobile App) ─
  const handleSwitchToStt = async (cleanStt: string, tagVal: string, notesVal: string, targetVal: number) => {
    const existing = palletsList.find(p => p.stt === cleanStt)
    if (existing && existing.boxes_count > 0) {
      const wantReset = await scannerConfirm({
        title: `STT ${cleanStt} đã có trong hệ thống`,
        message:
          `STT ${cleanStt} hiện đang có ${existing.boxes_count} thùng (${existing.total_weight.toFixed(1)} Kg).\n\n` +
          `Bạn muốn quét lại từ đầu (xoá thùng cũ về 0) hay tiếp tục quét thêm vào Pallet này?`,
        confirmText: 'Quét lại từ đầu',
        cancelText: 'Quét thêm tiếp',
        variant: 'warning',
      })

      if (wantReset) {
        await handleResetActivePallet(cleanStt)
        setActivePalletStt(cleanStt)
        setActivePalletTag(tagVal || existing.tag || '')
        setActivePalletNotes(notesVal || existing.notes || '')
        setTargetQty(targetVal || 30)
        setCurrentBoxes([])
        localStorage.setItem('last_worked_pallet_stt', cleanStt)
        setIsSwitchPalletModal(false)
        triggerToast(`Đã làm mới STT ${cleanStt} về 0 thùng để quét lại!`)
        return
      }
    }

    setActivePalletStt(cleanStt)
    setActivePalletTag(tagVal || existing?.tag || '')
    setActivePalletNotes(notesVal || existing?.notes || '')
    setTargetQty(targetVal || 30)
    loadCurrentPalletBoxes(cleanStt)
    localStorage.setItem('last_worked_pallet_stt', cleanStt)
    setIsSwitchPalletModal(false)
    triggerToast(`Đã chuyển sang Pallet ${cleanStt}`)
  }


  // ── Load All Pallets for Tab 3 ────────────────────────────────
  const loadAllPallets = useCallback(async () => {
    try {
      // 1. Lots
      const { data: lotsData } = await supabase
        .from('lots')
        .select(`
          id,
          code,
          daily_seq,
          status,
          quantity,
          packaging_date,
          peeling_date,
          created_at,
          notes,
          metadata,
          products ( name, sku, aliases ),
          positions!positions_lot_id_fkey ( code ),
          box_labels!inner ( id, code, quantity, metadata )
        `)
        .order('created_at', { ascending: false })
        .limit(300)

      const list: PalletItem[] = []
      const seen = new Set<string>()

      if (lotsData) {
        lotsData.forEach((l: any) => {
          const boxes = l.box_labels || []
          const firstMeta = boxes[0]?.metadata || {}
          const rawStt = firstMeta.pallet_stt || (boxes[0]?.code ? boxes[0].code.split('-')[0] : '') || l.code
          const stt = String(rawStt).trim().toUpperCase()

          seen.add(stt)
          const totalWeight = boxes.reduce((sum: number, b: any) => sum + (Number(b.quantity) || 0), 0)
          const isStamp = boxes.some((b: any) =>
            b.metadata?.scan_type === 'stamp' || !!b.metadata?.stamp_line1 || (b.code && b.code.startsWith('STAMP-'))
          )
          const isSpecial12 = !!(firstMeta.is_special_12 || (firstMeta.sku && (stampDictMap.special_12?.[firstMeta.sku.slice(0, 12)] || DEFAULT_STAMP_DICT.special_12?.[firstMeta.sku.slice(0, 12)])))

          const locationCode = l.positions?.[0]?.code || firstMeta.location_code || firstMeta.location || firstMeta.position || null
          const productionPlace = firstMeta.production_place || firstMeta.factory || firstMeta.shift_group || null
          const materialZone = firstMeta.region || firstMeta.province || null
          const tag = firstMeta.pallet_tag || firstMeta.tag || null
          const notes = l.notes || firstMeta.pallet_notes || firstMeta.notes || null

          list.push({
            id: l.id,
            stt,
            lot_id: l.id,
            lot_code: l.code,
            boxes_count: boxes.length,
            total_weight: totalWeight,
            is_linked: true,
            product_name: l.products?.name || firstMeta.product_name || 'Hàng đông lạnh',
            sku: l.products?.sku || firstMeta.sku || 'SKU',
            product_aliases: l.products?.aliases || firstMeta.product_aliases || firstMeta.aliases || null,
            aliases: l.products?.aliases || firstMeta.product_aliases || firstMeta.aliases || null,
            location_code: locationCode,
            production_place: productionPlace,
            material_zone: materialZone,
            tag,
            notes,
            packaging_date: l.packaging_date || firstMeta.packaging_date || null,
            production_date: l.peeling_date || firstMeta.production_date || null,
            scan_type: isStamp ? 'stamp' : 'label',
            is_special_12: isSpecial12,
            created_at: l.created_at
          })
        })
      }

      // 2. Unlinked Pallets
      const { data: unlinkedBoxes } = await supabase
        .from('box_labels')
        .select(`
          id,
          code,
          quantity,
          created_at,
          metadata,
          products ( name, sku, aliases )
        `)
        .is('lot_id', null)
        .order('created_at', { ascending: false })
        .limit(800)

      const unlinkedMap = new Map<string, any[]>()
      ;(unlinkedBoxes || []).forEach((b: any) => {
        const raw = b.metadata?.pallet_stt
        if (!raw) return
        const stt = String(raw).trim().toUpperCase()
        if (!unlinkedMap.has(stt)) unlinkedMap.set(stt, [])
        unlinkedMap.get(stt)!.push(b)
      })

      unlinkedMap.forEach((boxes, stt) => {
        if (seen.has(stt)) return
        const totalWeight = boxes.reduce((sum: number, b: any) => sum + (Number(b.quantity) || 0), 0)
        const firstMeta = boxes[0]?.metadata || {}
        const isStamp = boxes.some((b: any) =>
          b.metadata?.scan_type === 'stamp' || !!b.metadata?.stamp_line1 || (b.code && b.code.startsWith('STAMP-'))
        )
        const isSpecial12 = !!(firstMeta.is_special_12 || (firstMeta.sku && (stampDictMap.special_12?.[firstMeta.sku.slice(0, 12)] || DEFAULT_STAMP_DICT.special_12?.[firstMeta.sku.slice(0, 12)])))

        const locationCode = firstMeta.location_code || firstMeta.location || firstMeta.position || null
        const productionPlace = firstMeta.production_place || firstMeta.factory || firstMeta.shift_group || null
        const materialZone = firstMeta.region || firstMeta.province || null
        const tag = firstMeta.pallet_tag || firstMeta.tag || null
        const notes = firstMeta.pallet_notes || firstMeta.notes || null

        list.push({
          id: 'unlinked_' + stt,
          stt,
          lot_id: null,
          lot_code: null,
          boxes_count: boxes.length,
          total_weight: totalWeight,
          is_linked: false,
          product_name: firstMeta.product_name || boxes[0]?.products?.name || 'Hàng đông lạnh',
          sku: firstMeta.sku || boxes[0]?.products?.sku || 'SKU',
          product_aliases: boxes[0]?.products?.aliases || firstMeta.product_aliases || firstMeta.aliases || null,
          aliases: boxes[0]?.products?.aliases || firstMeta.product_aliases || firstMeta.aliases || null,
          location_code: locationCode,
          production_place: productionPlace,
          material_zone: materialZone,
          tag,
          notes,
          packaging_date: firstMeta.packaging_date || null,
          production_date: firstMeta.production_date || null,
          scan_type: isStamp ? 'stamp' : 'label',
          is_special_12: isSpecial12,
          created_at: boxes[0]?.created_at || new Date().toISOString()
        })
      })

      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setPalletsList(list)
      savePalletsToOfflineDb(list as any).catch(() => {})
      return list
    } catch (err) {
      console.warn('Lỗi loadAllPallets, tự động chuyển sang đọc từ bộ nhớ máy offline:', err)
      try {
        const cached = await getPalletsFromOfflineDb()
        if (cached && cached.length > 0) {
          setPalletsList(cached as any)
          triggerToast('⚡ Đang xem danh sách Pallet ngoại tuyến (Bộ nhớ máy)')
          return cached as any
        }
      } catch {}
      return []
    }
  }, [stampDictMap])

  useEffect(() => {
    if (activeTab === 'pallets') {
      loadAllPallets()
    }
  }, [activeTab, loadAllPallets])

  // Open Pallet Detail Modal
  const handleOpenPalletDetail = async (pallet: PalletItem) => {
    setSelectedPallet(pallet)
    setLoadingDetail(true)
    try {
      const { data, error } = await supabase
        .from('box_labels')
        .select(`
          id,
          code,
          quantity,
          unit,
          semi_finished_lot_code,
          finished_lot_code,
          metadata,
          created_at,
          products ( name, sku, internal_name )
        `)
        .filter('metadata->>pallet_stt', 'eq', pallet.stt)
        .order('code', { ascending: true })

      if (!error && data) {
        const mapped = data.map((b: any, idx: number) => parseBoxLabelItem(b, idx, stampDictMap))
        mapped.sort((a: BoxItem, b: BoxItem) => (parseInt(a.box_index, 10) || 0) - (parseInt(b.box_index, 10) || 0))
        setSelectedPalletBoxes(mapped)
      } else {
        setSelectedPalletBoxes([])
      }
    } catch {
      setSelectedPalletBoxes([])
    } finally {
      setLoadingDetail(false)
    }
  }

  // ── Sync Stamp Dictionaries from Supabase ──────────────────────
  const fetchAndMergeStampDictionaries = async () => {
    const { data, error } = await (supabase
      .from('stamp_dictionaries') as any)
      .select('category, code, name')
      .eq('is_active', true)

    if (error) throw error
    if (!data || data.length === 0) return 0

    // Bắt đầu từ DEFAULT_STAMP_DICT rồi merge đè các quy tắc mới nhất từ Supabase
    const mergedDict: Record<string, Record<string, string>> = {}
    Object.keys(DEFAULT_STAMP_DICT).forEach(cat => {
      mergedDict[cat] = { ...DEFAULT_STAMP_DICT[cat] }
    })

    ;(data as any[]).forEach((item: any) => {
      const cat = String(item.category || '').trim()
      const rawCode = String(item.code || '').trim()
      const name = String(item.name || '').trim()
      if (!cat || !rawCode) return
      if (!mergedDict[cat]) mergedDict[cat] = {}
      mergedDict[cat][rawCode] = name
      // Với ngoại lệ 12 số, chuẩn hóa thêm key 12 chữ số thuần (phòng trường hợp DB lưu kèm dấu - hoặc khoảng trắng)
      if (cat === 'special_12') {
        const clean12 = rawCode.replace(/[^0-9]/g, '').slice(0, 12)
        if (clean12.length === 12) {
          mergedDict[cat][clean12] = name
        }
      }
    })

    setStampDictMap(mergedDict)
    setStampRulesCount(data.length)
    const now = new Date().toISOString()
    setLastStampSync(now)

    localStorage.setItem('cached_stamp_dictionaries', JSON.stringify(mergedDict))
    localStorage.setItem('cached_stamp_rules_count', data.length.toString())
    localStorage.setItem('last_stamp_sync_time', now)

    return data.length
  }

  const syncStampRulesSilent = async () => {
    try {
      await fetchAndMergeStampDictionaries()
    } catch (err) {
      console.warn('[Scanner] Auto-sync stamp_dictionaries silent warning:', err)
    }
  }

  const handleSyncStampRules = async () => {
    setSyncingStamp(true)
    try {
      const count = await fetchAndMergeStampDictionaries()
      if (count > 0) {
        triggerToast(`✅ Đã tải về ${count} quy tắc con dấu từ Web mẹ!`)
      } else {
        triggerToast('Không có dữ liệu quy tắc con dấu trên máy chủ.')
      }
    } catch (err: any) {
      await scannerAlert({ title: 'Lỗi đồng bộ quy tắc dấu đóng', message: err.message, variant: 'danger' })
    } finally {
      setSyncingStamp(false)
    }
  }

  // ── Sync LOTs for Offline Search ───────────────────────────────
  const handleSyncLotsOffline = async () => {
    setIsSyncingLots(true)
    try {
      const { data: lots, error } = await supabase
        .from('lots')
        .select(`
          id,
          code,
          daily_seq,
          status,
          quantity,
          packaging_date,
          peeling_date,
          created_at,
          notes,
          metadata,
          products ( name, sku, aliases ),
          positions!positions_lot_id_fkey ( code ),
          box_labels ( id, code, quantity, metadata )
        `)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (error) throw error

      const palletCount = (lots || []).length

      try {
        const { data: rawLots } = await supabase
          .from('lots')
          .select('id, code, quantity, status, created_at, products(name, sku), metadata')
          .order('created_at', { ascending: false })
          .limit(2000)

        if (rawLots && rawLots.length > 0) {
          const mappedLots: OfflineLot[] = rawLots.map((l: any) => ({
            id: l.id,
            lot_code: l.code,
            product_name: l.products?.name || l.metadata?.product_name || 'Hàng đông lạnh',
            sku: l.products?.sku || l.metadata?.sku || 'SKU',
            quantity: l.quantity,
            status: l.status,
            created_at: l.created_at
          }))
          await saveLotsToOfflineDb(mappedLots)
        }
      } catch {}

      try {
        const { data: prods } = await supabase
          .from('products')
          .select('id, name, sku, aliases')
          .order('name')
          .limit(1000)

        if (prods && prods.length > 0) {
          setAvailableProducts(prods)
          localStorage.setItem('cached_products', JSON.stringify(prods))
        }
      } catch {}

      const now = new Date().toISOString()
      setOfflineLotsCount(palletCount)
      setLastLotsSync(now)
      await setOfflineMeta('lots_last_synced_at', now)
      await setOfflineMeta('lots_count', palletCount)

      triggerToast(`✅ Đã lưu thành công ${palletCount} LOT/Pallet vào máy để xem ngoại tuyến!`)
    } catch (err: any) {
      await scannerAlert({ title: 'Lỗi tải dữ liệu LOT', message: err.message, variant: 'danger' })
    } finally {
      setIsSyncingLots(false)
    }
  }

  // ── Sync Pending Pallets Queue Handler ────────────────────────
  const handleSyncPendingQueue = async () => {
    if (pendingPallets.length === 0) return
    if (!navigator.onLine) {
      await scannerAlert({
        title: 'Thiết bị đang ngoại tuyến',
        message: 'Vui lòng kết nối Wifi hoặc 4G để đồng bộ Pallet lên Web mẹ!',
        variant: 'warning',
      })
      return
    }

    setIsSyncingPending(true)
    let successCount = 0
    let failCount = 0

    for (const p of pendingPallets) {
      try {
        await updatePendingPalletStatus(p.client_id, 'syncing')

        const rowsToInsert = p.boxes.map((b: any, idx: number) => {
          const bMeta = b.metadata || {}
          return {
            code: b.code,
            quantity: b.weight,
            unit: 'Kg',
            semi_finished_lot_code: p.lot_code,
            finished_lot_code: p.lot_code,
            system_code: b.system_code || 'KHO_DONG_LANH',
            status: 'printed',
            metadata: {
              pallet_stt: p.stt,
              scan_type: bMeta.scan_type || (p.stt.startsWith('G') || b.code.startsWith('STAMP') ? 'stamp' : 'label'),
              box_index: bMeta.box_index || (idx + 1),
              sku: bMeta.sku || p.sku || 'SKU',
              product_name: bMeta.product_name || p.product_name || 'Hàng đông lạnh',
              ...bMeta
            }
          }
        })

        const { error } = await supabase.from('box_labels').insert(rowsToInsert as any)
        if (error) throw error

        await removePendingPallet(p.client_id)
        successCount++
      } catch (err: any) {
        console.warn('Lỗi đồng bộ pallet:', p.stt, err)
        await updatePendingPalletStatus(p.client_id, 'failed', err.message)
        failCount++
      }
    }

    const updated = await getPendingPallets()
    setPendingPallets(updated)
    setIsSyncingPending(false)

    if (failCount === 0) {
      triggerToast(`🎉 Đã đồng bộ thành công tất cả ${successCount} Pallet lên Web mẹ!`)
    } else {
      triggerToast(`⚠️ Đồng bộ xong: ${successCount} thành công, ${failCount} thất bại.`)
    }
  }

  const handleSyncSinglePending = async (item: OfflinePendingPallet) => {
    if (!navigator.onLine) {
      await scannerAlert({
        title: 'Thiết bị đang ngoại tuyến',
        message: 'Không có kết nối mạng để đẩy Pallet lên Web mẹ!',
        variant: 'warning',
      })
      return
    }
    try {
      await updatePendingPalletStatus(item.client_id, 'syncing')
      const rowsToInsert = item.boxes.map((b: any, idx: number) => {
        const bMeta = b.metadata || {}
        return {
          code: b.code,
          quantity: b.weight,
          unit: 'Kg',
          semi_finished_lot_code: item.lot_code,
          finished_lot_code: item.lot_code,
          system_code: b.system_code || 'KHO_DONG_LANH',
          status: 'printed',
          metadata: {
            pallet_stt: item.stt,
            scan_type: bMeta.scan_type || (item.stt.startsWith('G') || b.code.startsWith('STAMP') ? 'stamp' : 'label'),
            box_index: bMeta.box_index || (idx + 1),
            sku: bMeta.sku || item.sku || 'SKU',
            product_name: bMeta.product_name || item.product_name || 'Hàng đông lạnh',
            ...bMeta
          }
        }
      })

      const { error } = await supabase.from('box_labels').insert(rowsToInsert as any)
      if (error) throw error

      await removePendingPallet(item.client_id)
      const updated = await getPendingPallets()
      setPendingPallets(updated)
      triggerToast(`✅ Đã đồng bộ Pallet ${item.stt} lên Web mẹ thành công!`)
    } catch (e: any) {
      await scannerAlert({ title: 'Lỗi đồng bộ', message: e.message, variant: 'danger' })
    }
  }

  // ── Version Tap (Easter Egg for Technician Mode) ───────────────
  const handleVersionTap = () => {
    const now = Date.now()
    if (now - lastTapTimeRef.current < 600) {
      versionTapCountRef.current += 1
    } else {
      versionTapCountRef.current = 1
    }
    lastTapTimeRef.current = now

    if (versionTapCountRef.current >= 5) {
      versionTapCountRef.current = 0
      const next = !showTechnicianConfig
      setShowTechnicianConfig(next)
      if (next) {
        triggerToast('🔓 Đã mở khóa Chế độ Kỹ thuật viên!')
      } else {
        triggerToast('🔒 Đã khóa cấu hình kỹ thuật viên.')
      }
    }
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    setTestResult(null)
    try {
      const { data, error } = await supabase.from('positions').select('id').limit(1)
      if (error) throw error
      setTestResult('🟢 Kết nối máy chủ thành công!')
    } catch (e: any) {
      setTestResult(`🔴 Lỗi kết nối: ${e.message}`)
    } finally {
      setTestingConnection(false)
    }
  }

  // ── Autocomplete Product Suggestions for Search ────────────────
  const productSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []
    const q = searchQuery.trim().toLowerCase()
    return availableProducts
      .filter(p => {
        const name = (p.name || '').toLowerCase()
        const sku = (p.sku || '').toLowerCase()
        const aliases = (p.aliases || '').toLowerCase()
        return name.includes(q) || sku.includes(q) || aliases.includes(q)
      })
      .slice(0, 5)
  }, [searchQuery, availableProducts])

  // ── Filtered Pallets for Cloud List ────────────────────────────
  const filteredPallets = useMemo(() => {
    return palletsList.filter(p => {
      if (palletFilter === 'linked' && !p.is_linked) return false
      if (palletFilter === 'unlinked' && p.is_linked) return false
      if (searchQuery.trim()) {
        if (!matchPalletSearch(p, searchQuery)) return false
      }
      return true
    })
  }, [palletsList, palletFilter, searchQuery])

  const displayedPallets = useMemo(() => {
    return filteredPallets.slice(0, palletDisplayLimit)
  }, [filteredPallets, palletDisplayLimit])

  const currentTotalWeight = currentBoxes.reduce((acc, b) => acc + (b.quantity || 20), 0)

  // ── 1. Màn hình đang tải phiên làm việc (Khớp App.tsx Android) ──
  if (authLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center max-w-md mx-auto w-full bg-[#0f172a] text-slate-100 p-6 select-none z-10">
        <div className="w-[90px] h-[90px] rounded-full bg-[#1e293b] border-2 border-[#38bdf8] flex items-center justify-center mb-4">
          <Boxes size={48} color="#38bdf8" />
        </div>
        <div className="text-[20px] font-black text-white tracking-[1px] text-center">
          CHÁNH THU WAREHOUSE
        </div>
        <div className="text-[13px] text-[#94a3b8] mt-1 text-center">
          Hệ thống Quản lý Tem &amp; Pallet Kho
        </div>
        <Loader2 size={32} className="animate-spin text-[#38bdf8] mt-6" />
        <div className="text-[12px] text-[#64748b] mt-3.5">
          Đang kết nối phiên làm việc...
        </div>
      </div>
    )
  }

  // ── 2. Nếu chưa đăng nhập: Hiển thị màn hình Login (hoặc Cài đặt máy chủ) ──
  if (!userProfile) {
    return (
      <div className="scanner-app-shell fixed inset-0 flex flex-col max-w-md mx-auto w-full bg-[#0f172a] text-slate-100 select-none overflow-hidden z-10">
        {activeTab === 'settings' ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-3 py-2.5 bg-[#0c1322] border-b border-[#1e293b]">
              <button
                type="button"
                onClick={() => setActiveTab('stamp')}
                className="flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300"
              >
                <ArrowLeft size={16} />
                <span>Quay lại Đăng nhập</span>
              </button>
              <span className="text-xs font-extrabold text-slate-300">Cài Đặt &amp; Máy Chủ</span>
            </div>
            <ScannerSettingsTab
              activeTab={'settings' as any}
              userProfile={null}
              soundEnabled={soundEnabled}
              setSoundEnabled={setSoundEnabled}
              systemCode={systemCode}
              setSystemCode={setSystemCode}
              targetQty={targetQty}
              setTargetQty={setTargetQty}
              autoCompleteOnFull={autoCompleteOnFull}
              setAutoCompleteOnFull={handleToggleAutoComplete}
              stampRulesCount={stampRulesCount}
              syncingStamp={syncingStamp}
              handleSyncStampRules={handleSyncStampRules}
              offlineLotsCount={offlineLotsCount}
              isSyncingLots={isSyncingLots}
              handleSyncLotsOffline={handleSyncLotsOffline}
              showTechnicianConfig={showTechnicianConfig}
              technicianUrl={technicianUrl}
              setTechnicianUrl={setTechnicianUrl}
              testingConnection={testingConnection}
              testResult={testResult}
              handleTestConnection={handleTestConnection}
              handleVersionTap={handleVersionTap}
            />
          </div>
        ) : (
          <ScannerLoginView
            onLoginSuccess={(acc, isOff) => {
              applyStoredAccount(acc)
              if (isOff) {
                triggerToast('⚡ Đã mở phiên làm việc ngoại tuyến!')
              } else {
                triggerToast(`👋 Xin chào ${acc.full_name}!`)
              }
            }}
            onOpenSettings={() => setActiveTab('settings')}
          />
        )}
        <OperationWatermarkOverlay />
      </div>
    )
  }

  return (
    <div className="scanner-app-shell fixed inset-0 flex flex-col max-w-md mx-auto w-full bg-[#0b1120] text-slate-100 select-none overflow-hidden z-10">
      
      {/* ── TOP USER & COMPANY HEADER (Match Mobile App App.tsx) ───────── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-[#0c1322] border-b border-[#1e293b] text-xs gap-2">
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] truncate text-[#10b981] text-[11px] font-extrabold min-w-0"
          style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)' }}
        >
          <Building2 size={13} className="shrink-0 text-[#10b981]" />
          <span className="truncate">
            {userProfile?.companyCode || 'CTG'} · {userProfile?.companyName || 'Chánh Thu'}
          </span>
        </div>
        <button
          onClick={() => setActiveTab('settings')}
          className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#1e293b] text-[#e2e8f0] text-[11px] font-bold hover:bg-slate-700 transition shrink-0 max-w-[160px] active:scale-95"
          title="Mở Cài Đặt & Tài Khoản"
        >
          <User size={14} className="text-[#38bdf8] shrink-0" />
          <span className="truncate">{userProfile?.fullName || 'Nhân viên kho'}</span>
        </button>
      </div>

      {/* ── PALLET SESSION TOOLBAR (Only shown for Quét Tem & Dấu Đóng) ── */}
      {(activeTab === 'label' || activeTab === 'stamp') && (
        <header className="shrink-0 bg-[#0f172a] border-b border-slate-800/90 px-3 py-2 z-20 shadow-md">
          <div className="flex items-center justify-between gap-2">
            {/* Pallet STT Selector Button */}
            {activePalletStt ? (
              <button
                onClick={() => {
                  setNewSttInput(activePalletStt)
                  setNewTagInput(activePalletTag)
                  setNewNotesInput(activePalletNotes)
                  setNewTargetQtyInput(targetQty)
                  setIsSwitchPalletModal(true)
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-left transition active:scale-[0.98] min-w-0"
              >
                {activeTab === 'stamp' ? (
                  <Fingerprint size={16} className="text-amber-400 shrink-0" />
                ) : (
                  <Scan size={16} className="text-emerald-400 shrink-0" />
                )}
                <span className={`text-[10px] font-black uppercase tracking-wider shrink-0 ${activeTab === 'stamp' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {activeTab === 'stamp' ? 'DẤU MỰC' : 'TEM THÙNG'}
                </span>
                <span className="text-xs font-bold text-white font-mono truncate">
                  STT: <strong className="text-amber-400">{activePalletStt}</strong>
                </span>
                {activePalletTag && (
                  <span className="bg-orange-600/30 text-orange-400 border border-orange-500/40 px-1 py-0.2 rounded text-[9px] font-bold font-mono shrink-0">
                    🏷️ {activePalletTag}
                  </span>
                )}
                {activePalletNotes && (
                  <span className="bg-blue-600/30 text-blue-400 border border-blue-500/40 px-1 py-0.2 rounded text-[9px] font-bold shrink-0" title={activePalletNotes}>
                    📝
                  </span>
                )}
                <ChevronRight size={13} className="text-slate-400 shrink-0" />
              </button>
            ) : (
              <div>
                <span className="text-[10px] text-slate-400 font-bold tracking-wider block mb-0.5">STT PALLET HIỆN TẠI</span>
                <button
                  onClick={() => {
                    setNewSttInput('')
                    setNewTagInput('')
                    setNewNotesInput('')
                    setNewTargetQtyInput(30)
                    setIsSwitchPalletModal(true)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-400 text-xs font-bold transition active:scale-95 shadow-xs"
                >
                  <Plus size={15} className="text-emerald-400 stroke-[2.5]" />
                  <span>Chọn / Nhập STT Pallet</span>
                </button>
              </div>
            )}

            {/* Right: Total Kg & Quick actions */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl text-right">
                <span className="text-[9px] text-slate-500 block font-bold">TỔNG KG</span>
                <span className="text-xs font-black font-mono text-sky-400">
                  {activePalletStt ? currentTotalWeight.toFixed(1) : 0} Kg
                </span>
              </div>

              {/* Flash button */}
              <button
                onClick={handleToggleTorch}
                className={`w-8 h-8 rounded-xl border flex items-center justify-center transition active:scale-95 ${
                  torchActive 
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                    : 'bg-slate-800/80 border-slate-700 text-slate-300'
                }`}
                title="Bật/tắt đèn Flash"
              >
                {torchActive ? <Zap size={15} /> : <ZapOff size={15} />}
              </button>
            </div>
          </div>

          {/* Progress Bar (Matching Android app) or Tip Bar when no pallet */}
          {activePalletStt ? (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">
                    Tiến độ: <strong className={activeTab === 'stamp' ? 'text-amber-400' : 'text-emerald-400'}>{currentBoxes.length}</strong> / {targetQty} thùng
                    {currentBoxes.length >= targetQty && (
                      <span className="ml-1 text-[10px] text-emerald-400 font-bold">✓ Đủ chỉ tiêu</span>
                    )}
                  </span>
                  {currentBoxes.length > 0 && (
                    <button
                      onClick={() => handleResetActivePallet()}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/50 text-rose-400 text-[10px] font-bold hover:bg-rose-500/25 transition active:scale-95 shadow-xs"
                      title="Xóa toàn bộ thùng của Pallet này để quét lại từ đầu"
                    >
                      <RotateCw size={10} className="text-rose-400" />
                      <span>Làm mới</span>
                    </button>
                  )}
                </div>
                <span className="text-slate-400">
                  Tổng: <strong className="text-white font-mono">{currentTotalWeight.toFixed(1)}</strong> Kg
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    currentBoxes.length >= targetQty
                      ? 'bg-emerald-500'
                      : activeTab === 'stamp'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, (currentBoxes.length / targetQty) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-1.5 flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/25 px-2.5 py-1 rounded-lg text-sky-300 text-[11px]">
              <Info size={13} className="shrink-0 text-sky-400" />
              <span>Bạn chưa chọn Pallet. Hãy bấm chọn Pallet để bắt đầu.</span>
            </div>
          )}
        </header>
      )}

      {/* ── TOAST ALERT ─────────────────────────────────────────── */}
      {toastMessage && (
        <div className="absolute top-20 left-3 right-3 z-50 p-3 rounded-xl bg-slate-900/95 border border-emerald-500/50 text-white shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ── TAB CONTENT ─────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
        
        {/* ═══════════════════════════════════════════════════════════
            TAB 1: QUÉT TEM (MATCH MOBILE SCANNER SCREEN LAYOUT)
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'label' && (
          <div className="flex-1 min-h-0 flex flex-col bg-[#090d16]">
            
            {/* 1. Compact Viewfinder Box (~210px matching Mobile App) */}
            <div className="shrink-0 relative w-full h-[210px] bg-black overflow-hidden border-b border-slate-800">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Target Reticle Frame */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-3">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/85 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold mb-2 shadow-lg">
                  <Scan size={12} className="text-emerald-400" />
                  <span>Căn khung tem thùng vào giữa</span>
                </div>

                <div className="w-[82%] max-w-[280px] h-[110px] border-2 border-emerald-400/80 rounded-xl relative shadow-[0_0_20px_rgba(16,185,129,0.25)] flex items-center justify-center bg-emerald-500/5">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-md"></div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-md"></div>
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-md"></div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-md"></div>
                </div>

                <p className="text-[10px] text-slate-300 mt-2 px-2.5 py-0.5 rounded-lg bg-slate-900/80 text-center font-medium">
                  ⌨️ Bấm phím <strong>Space</strong> hoặc <strong>Enter</strong> để chụp quét nhanh
                </p>
              </div>

              {/* OVERLAY WHEN NO PALLET SELECTED (Exact match to Mobile App Image 1) */}
              {!activePalletStt && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-20 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-lg">
                    <Boxes size={26} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Chưa chọn Pallet</h3>
                    <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                      Để tránh quét nhầm hàng, vui lòng chọn hoặc nhập số Pallet trước.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setNewSttInput('')
                      setNewTagInput('')
                      setNewNotesInput('')
                      setNewTargetQtyInput(30)
                      setIsSwitchPalletModal(true)
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 active:scale-95 transition"
                  >
                    <Plus size={15} />
                    <span>Chọn / Nhập Pallet Ngay</span>
                  </button>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-x-3 top-3 p-2.5 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs shadow-xl">
                  {cameraError}
                </div>
              )}

              {isRecognizing && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-30">
                  <Loader2 size={32} className="text-emerald-400 animate-spin" />
                  <p className="text-xs font-bold text-white tracking-wide">Đang đọc chữ trên tem thùng...</p>
                </div>
              )}
            </div>

            {/* 2. Action Controls Bar (Matching Mobile App) */}
            <div className="shrink-0 bg-[#0f172a] border-b border-slate-800 px-3 py-2 flex items-center gap-2 justify-between z-10 shadow-sm">
              <button
                onClick={handleCaptureAndRecognize}
                disabled={isRecognizing}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                  !activePalletStt
                    ? 'bg-emerald-600/50 text-white/70'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 active:scale-[0.98]'
                }`}
              >
                {isRecognizing ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <Camera size={16} />
                )}
                <span>Chụp Quét Tem</span>
              </button>

              <button
                onClick={() => {
                  if (!activePalletStt) {
                    setIsSwitchPalletModal(true)
                    return
                  }
                  setIsManualLabelModal(true)
                }}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 active:scale-[0.98] transition shrink-0"
              >
                <Tag size={14} className="text-sky-400" />
                <span>Nhập tay</span>
              </button>

              {activePalletStt && currentBoxes.length > 0 && (
                <button
                  onClick={handleCompletePallet}
                  className="py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-600/30 active:scale-[0.98] transition shrink-0"
                  title="Chốt hoàn thành Pallet"
                >
                  <CheckCheck size={14} />
                  <span>Chốt Pallet</span>
                </button>
              )}
            </div>

            {/* 3. Direct Scanned Boxes List (Matching Mobile App Image 1) */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#090d16]">
              {/* Header Row */}
              <div className="shrink-0 px-3 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs bg-[#0c1220]">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-300 uppercase tracking-wide text-[11px]">THÙNG HÀNG</span>
                  {activePalletStt && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold">
                      {currentBoxes.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setActiveTab('pallets')}
                  className="text-sky-400 hover:text-sky-300 font-medium text-[11px] flex items-center gap-0.5"
                >
                  <span>Xem tất cả Pallet</span>
                  <ChevronRight size={12} />
                </button>
              </div>

              {/* Quick Clone Banner if boxes > 0 */}
              {activePalletStt && currentBoxes.length > 0 && currentBoxes.length < targetQty && (
                <button
                  onClick={() => handleOpenCloneModal(currentBoxes[currentBoxes.length - 1])}
                  className="shrink-0 bg-emerald-950/70 border-b border-emerald-500/30 px-3 py-2 flex items-center justify-between text-[11px] text-emerald-300 hover:text-emerald-200 transition active:scale-[0.99]"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Copy size={13} className="text-emerald-400 shrink-0" />
                    <span className="truncate">
                      ⚡ Nhân bản thùng #{currentBoxes[currentBoxes.length - 1].box_index} cho {targetQty - currentBoxes.length} thùng còn lại
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-emerald-400 shrink-0 ml-1" />
                </button>
              )}

              {/* Scrollable Box Cards List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {!activePalletStt ? (
                  <div className="py-14 text-center text-slate-500 space-y-2.5">
                    <Boxes size={36} className="mx-auto text-slate-600 stroke-[1.5]" />
                    <p className="text-xs font-bold text-slate-400">Chưa có Pallet nào đang chọn</p>
                    <button
                      onClick={() => {
                        setNewSttInput('')
                        setNewTagInput('')
                        setNewNotesInput('')
                        setNewTargetQtyInput(30)
                        setIsSwitchPalletModal(true)
                      }}
                      className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition"
                    >
                      + Bấm để chọn hoặc nhập Pallet mới
                    </button>
                  </div>
                ) : currentBoxes.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-2">
                    <Barcode size={36} className="mx-auto text-slate-600 stroke-[1.5]" />
                    <p className="text-xs font-medium text-slate-400">Chưa có thùng nào trong Pallet {activePalletStt}</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Bấm nút <strong>[Chụp Quét Tem]</strong> hoặc phím <strong>Space / Enter</strong> để bắt đầu quét
                    </p>
                  </div>
                ) : (
                  currentBoxes.map(b => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-[#111827] border border-slate-800 space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black font-mono">
                            #{b.box_index}
                          </span>
                          <span className="text-[11px] font-bold text-slate-300 font-mono">
                            SKU: {b.sku}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 text-[10px] font-black font-mono">
                            {b.quantity} {b.unit}
                          </span>
                          <button
                            onClick={() => handleOpenCloneModal(b)}
                            className="p-1 rounded-md bg-slate-800 text-sky-400 hover:text-white"
                            title="Nhân bản thùng này"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteBox(b.id)}
                            className="p-1 rounded-md bg-slate-800 text-rose-400 hover:text-white"
                            title="Xóa thùng"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs font-bold text-white leading-snug">
                        {b.product_name}
                      </p>

                      <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                        <div>Mã LOT: <strong className="text-slate-200 font-mono">{b.lot_code}</strong></div>
                        <div>Quy cách: <strong className="text-slate-200">{b.spec || '20kg'}</strong></div>
                        <div>Tổ: <strong className="text-slate-200">{b.shift_group || 'Nguyên'}</strong></div>
                        <div>Vùng: <strong className="text-slate-200">{b.region || 'Tây Nguyên'}</strong></div>
                        <div>NSX: <strong className="text-amber-400 font-mono">{b.production_date || '---'}</strong></div>
                        <div>NĐG: <strong className="text-slate-200 font-mono">{b.packaging_date || b.production_date || '---'}</strong></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 2: DẤU ĐÓNG (MATCH MOBILE STAMP SCANNER SCREEN LAYOUT)
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'stamp' && (
          <div className="flex-1 min-h-0 flex flex-col bg-[#090d16]">
            
            {/* 1. Compact Viewfinder Box (~210px matching Mobile App) */}
            <div className="shrink-0 relative w-full h-[210px] bg-black overflow-hidden border-b border-slate-800">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />

              {/* Dual-line Reticle Guideline for Stamp */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-3">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/85 border border-amber-500/40 text-amber-300 text-[10px] font-bold mb-1.5 shadow-lg">
                  <Fingerprint size={12} className="text-amber-400" />
                  <span>Căn 2 dòng dấu mực vào khung dưới</span>
                </div>

                <div
                  ref={stampReticleRef}
                  className="w-[88%] max-w-[300px] h-[115px] border-2 border-amber-400/80 rounded-xl relative shadow-[0_0_20px_rgba(245,158,11,0.25)] flex flex-col justify-between p-2.5 bg-amber-400/5"
                >
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-amber-400 rounded-tl-md"></div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-amber-400 rounded-tr-md"></div>
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-amber-400 rounded-bl-md"></div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-amber-400 rounded-br-md"></div>

                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-1 text-[9px]">
                    <span className="font-black uppercase text-amber-300 bg-slate-900/80 px-1.5 py-0.2 rounded">DÒNG 1</span>
                    <span className="font-mono text-slate-200">102010402001-0 (14 số)</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-amber-500/30 pt-1 text-[9px]">
                    <span className="font-black uppercase text-emerald-300 bg-slate-900/80 px-1.5 py-0.2 rounded">DÒNG 2</span>
                    <span className="font-mono text-slate-200">2151014102600066 (16 số)</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-300 mt-1.5 px-2.5 py-0.5 rounded-lg bg-slate-900/80 text-center font-medium">
                  ⌨️ Bấm phím <strong>Space</strong> hoặc <strong>Enter</strong> để chụp quét nhanh
                </p>
              </div>

              {/* OVERLAY WHEN NO PALLET SELECTED */}
              {!activePalletStt && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-20 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg">
                    <Fingerprint size={26} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Chưa chọn Pallet</h3>
                    <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                      Để tránh quét nhầm hàng, vui lòng chọn hoặc nhập số Pallet trước.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setNewSttInput('')
                      setNewTagInput('')
                      setNewNotesInput('')
                      setNewTargetQtyInput(30)
                      setIsSwitchPalletModal(true)
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/30 active:scale-95 transition"
                  >
                    <Plus size={15} />
                    <span>Chọn / Nhập Pallet Ngay</span>
                  </button>
                </div>
              )}

              {isRecognizing && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-30">
                  <Loader2 size={32} className="text-amber-400 animate-spin" />
                  <p className="text-xs font-bold text-white tracking-wide">Đang đọc dãy số con dấu...</p>
                </div>
              )}
            </div>

            {/* 2. Action Controls Bar (Matching Mobile App) */}
            <div className="shrink-0 bg-[#0f172a] border-b border-slate-800 px-3 py-2 flex items-center gap-2 justify-between z-10 shadow-sm">
              <button
                onClick={handleCaptureAndRecognize}
                disabled={isRecognizing}
                className={`flex-1 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition ${
                  !activePalletStt
                    ? 'bg-amber-500/50 text-slate-900/60'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/30 active:scale-[0.98]'
                }`}
              >
                {isRecognizing ? (
                  <Loader2 size={16} className="animate-spin text-slate-950" />
                ) : (
                  <Camera size={16} />
                )}
                <span>Chụp Quét Dấu</span>
              </button>

              <button
                onClick={handleCaptureStampPhotoForServer}
                disabled={isRecognizing || uploadingStampPhoto}
                className="py-2 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-indigo-600/30 active:scale-[0.98] transition shrink-0"
                title="Chụp ảnh gửi Web Mẹ để Gemini AI giải mã & tạo thùng"
              >
                <Sparkles size={14} />
                <span>Gửi Web Mẹ</span>
              </button>

              <button
                onClick={() => {
                  if (!activePalletStt) {
                    setIsSwitchPalletModal(true)
                    return
                  }
                  setManualStampLine1('')
                  setManualStampLine2('')
                  setIsManualStampModal(true)
                }}
                className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 active:scale-[0.98] transition shrink-0"
              >
                <Fingerprint size={14} className="text-amber-400" />
                <span>Nhập số</span>
              </button>

              {activePalletStt && currentBoxes.length > 0 && (
                <button
                  onClick={handleCompletePallet}
                  className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 active:scale-[0.98] transition shrink-0"
                  title="Chốt hoàn thành Pallet"
                >
                  <CheckCheck size={14} />
                  <span>Chốt Pallet</span>
                </button>
              )}
            </div>

            {/* 3. Direct Scanned Boxes List (Matching Mobile App) */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#090d16]">
              {/* Header Row */}
              <div className="shrink-0 px-3 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs bg-[#0c1220]">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-300 uppercase tracking-wide text-[11px]">THÙNG HÀNG</span>
                  {activePalletStt && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-bold">
                      {currentBoxes.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setActiveTab('pallets')}
                  className="text-sky-400 hover:text-sky-300 font-medium text-[11px] flex items-center gap-0.5"
                >
                  <span>Xem tất cả Pallet</span>
                  <ChevronRight size={12} />
                </button>
              </div>

              {/* Quick Clone Banner if boxes > 0 */}
              {activePalletStt && currentBoxes.length > 0 && currentBoxes.length < targetQty && (
                <button
                  onClick={() => handleOpenCloneModal(currentBoxes[currentBoxes.length - 1])}
                  className="shrink-0 bg-amber-950/70 border-b border-amber-500/30 px-3 py-2 flex items-center justify-between text-[11px] text-amber-300 hover:text-amber-200 transition active:scale-[0.99]"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Copy size={13} className="text-amber-400 shrink-0" />
                    <span className="truncate">
                      ⚡ Nhân bản thùng #{currentBoxes[currentBoxes.length - 1].box_index} cho {targetQty - currentBoxes.length} thùng còn lại
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-amber-400 shrink-0 ml-1" />
                </button>
              )}

              {/* Scrollable Box Cards List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {!activePalletStt ? (
                  <div className="py-14 text-center text-slate-500 space-y-2.5">
                    <Boxes size={36} className="mx-auto text-slate-600 stroke-[1.5]" />
                    <p className="text-xs font-bold text-slate-400">Chưa có Pallet nào đang chọn</p>
                    <button
                      onClick={() => {
                        setNewSttInput('')
                        setNewTagInput('')
                        setNewNotesInput('')
                        setNewTargetQtyInput(30)
                        setIsSwitchPalletModal(true)
                      }}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300 transition"
                    >
                      + Bấm để chọn hoặc nhập Pallet mới
                    </button>
                  </div>
                ) : currentBoxes.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-2">
                    <Fingerprint size={36} className="mx-auto text-slate-600 stroke-[1.5]" />
                    <p className="text-xs font-medium text-slate-400">Chưa có thùng con dấu nào trong Pallet {activePalletStt}</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Bấm nút <strong>[Chụp Quét Dấu]</strong> hoặc phím <strong>Space / Enter</strong> để bắt đầu quét
                    </p>
                  </div>
                ) : (
                  currentBoxes.map(b => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-[#111827] border border-slate-800 space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black font-mono">
                            #{b.box_index}
                          </span>
                          <span className="text-[11px] font-bold text-slate-300 font-mono">
                            SKU: {b.sku}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-black font-mono">
                            {b.quantity} {b.unit}
                          </span>
                          <button
                            onClick={() => handleOpenCloneModal(b)}
                            className="p-1 rounded-md bg-slate-800 text-sky-400 hover:text-white"
                            title="Nhân bản thùng này"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteBox(b.id)}
                            className="p-1 rounded-md bg-slate-800 text-rose-400 hover:text-white"
                            title="Xóa thùng"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs font-bold text-white leading-snug">
                        {b.product_name}
                      </p>

                      {b.is_special_12 && (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black">
                          ⭐ 12 SỐ ĐẦU TRỌN GÓI
                        </span>
                      )}

                      <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                        <div>Mã LOT (D2): <strong className="text-slate-200 font-mono">{b.lot_code}</strong></div>
                        <div>Quy cách: <strong className="text-slate-200">{b.spec || '20kg'}</strong></div>
                        <div>Nhà máy: <strong className="text-slate-200">{b.shift_group || 'Đắk Lắk'}</strong></div>
                        <div>Vùng NL: <strong className="text-slate-200">{b.region || 'Đắk Lắk'}</strong></div>
                        <div>Ngày nhập NL: <strong className="text-amber-400 font-mono">{b.raw_material_date || b.production_date || '---'}</strong></div>
                        <div>Ngày ĐG: <strong className="text-slate-200 font-mono">{b.packaging_date || '---'}</strong></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB: SƠ ĐỒ VỊ TRÍ KHO (Keep-Alive: 0ms load sau lần mở đầu)
           ═══════════════════════════════════════════════════════════ */}
        {visitedTabs.warehouse_map && (
          <div className={activeTab === 'warehouse_map' ? 'flex-1 flex flex-col min-h-0 overflow-hidden' : 'hidden'}>
            <WarehouseMapTab />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB: SỐ LIỆU & CA LÀM (Keep-Alive: 0ms load sau lần mở đầu)
           ═══════════════════════════════════════════════════════════ */}
        {visitedTabs.operations && (
          <div className={activeTab === 'operations' ? 'flex-1 flex flex-col min-h-0 overflow-hidden' : 'hidden'}>
            <OperationsDataTab
              isActive={activeTab === 'operations'}
              systemCode={systemCode}
              userProfile={userProfile}
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB: KIỂM KÊ KHO (Keep-Alive: 0ms load sau lần mở đầu)
           ═══════════════════════════════════════════════════════════ */}
        {visitedTabs.inventory && (
          <div className={activeTab === 'inventory' ? 'flex-1 flex flex-col min-h-0 overflow-hidden' : 'hidden'}>
            <InventoryTab
              isActive={activeTab === 'inventory'}
              systemCode={systemCode}
              userProfile={userProfile}
            />
          </div>
        )}

        <ScannerPalletsTab
          activeTab={activeTab as any}
          setActiveTab={setActiveTab as any}
          palletListSubTab={palletListSubTab}
          setPalletListSubTab={setPalletListSubTab}
          isOnline={isOnline}
          pendingPallets={pendingPallets}
          setPendingPallets={setPendingPallets}
          isSyncingPending={isSyncingPending}
          handleSyncPendingQueue={handleSyncPendingQueue}
          handleSyncSinglePending={handleSyncSinglePending}
          palletsList={palletsList}
          filteredPallets={filteredPallets}
          displayedPallets={displayedPallets}
          palletFilter={palletFilter}
          setPalletFilter={setPalletFilter}
          palletDisplayLimit={palletDisplayLimit}
          setPalletDisplayLimit={setPalletDisplayLimit}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showSearchSuggestions={showSearchSuggestions}
          setShowSearchSuggestions={setShowSearchSuggestions}
          productSuggestions={productSuggestions}
          loadAllPallets={loadAllPallets}
          handleOpenPalletDetail={handleOpenPalletDetail}
          setActivePalletStt={setActivePalletStt}
          loadCurrentPalletBoxes={loadCurrentPalletBoxes}
          triggerToast={triggerToast}
        />

        <ScannerSettingsTab
          activeTab={activeTab as any}
          userProfile={userProfile}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          systemCode={systemCode}
          setSystemCode={setSystemCode}
          targetQty={targetQty}
          setTargetQty={setTargetQty}
          autoCompleteOnFull={autoCompleteOnFull}
          setAutoCompleteOnFull={handleToggleAutoComplete}
          stampRulesCount={stampRulesCount}
          syncingStamp={syncingStamp}
          handleSyncStampRules={handleSyncStampRules}
          offlineLotsCount={offlineLotsCount}
          isSyncingLots={isSyncingLots}
          handleSyncLotsOffline={handleSyncLotsOffline}
          showTechnicianConfig={showTechnicianConfig}
          technicianUrl={technicianUrl}
          setTechnicianUrl={setTechnicianUrl}
          testingConnection={testingConnection}
          testResult={testResult}
          handleTestConnection={handleTestConnection}
          handleVersionTap={handleVersionTap}
        />

      </main>

      {/* ── BOTTOM NAVIGATION BAR (TINH GỌN 5 NÚT: MENU + 4 CHỨC NĂNG CHÍNH NHƯ APP.TSX ANDROID) ─────────── */}
      <nav
        className="shrink-0 bg-[#1e293b] border-t border-[#334155] pt-2 flex items-center justify-around z-20 shadow-lg"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 10px), 10px)' }}
      >
        {/* Nút 1: Menu Hamburger (Mở toàn bộ danh mục 7 chức năng) */}
        {(() => {
          const isDrawerActive = !['stamp', 'operations', 'pallets', 'warehouse_map'].includes(activeTab)
          return (
            <button
              type="button"
              onClick={() => setIsFullMenuOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition"
            >
              <div className="relative flex items-center justify-center">
                <Menu
                  size={22}
                  color={isDrawerActive ? '#38bdf8' : '#cbd5e1'}
                />
                {isDrawerActive && (
                  <span className="absolute -top-0.5 -right-1 w-[7px] h-[7px] rounded-full bg-[#38bdf8] border-[1.5px] border-[#1e293b]" />
                )}
              </div>
              <span
                className="text-[10px] font-bold"
                style={{
                  color: isDrawerActive ? '#38bdf8' : '#94a3b8',
                  fontWeight: isDrawerActive ? 800 : 700,
                }}
              >
                Menu
              </span>
            </button>
          )
        })()}

        {/* Nút 2: Dấu Đóng Thùng */}
        <button
          type="button"
          onClick={() => setActiveTab('stamp')}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition"
        >
          <Fingerprint
            size={21}
            color={activeTab === 'stamp' ? '#fbbf24' : '#94a3b8'}
          />
          <span
            className="text-[10px] font-bold"
            style={{
              color: activeTab === 'stamp' ? '#fbbf24' : '#94a3b8',
              fontWeight: activeTab === 'stamp' ? 800 : 700,
            }}
          >
            Dấu Đóng
          </span>
        </button>

        {/* Nút 3: Số Liệu Báo Cáo & Ca Làm */}
        <button
          type="button"
          onClick={() => setActiveTab('operations')}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition"
        >
          <Calculator
            size={21}
            color={activeTab === 'operations' ? '#818cf8' : '#94a3b8'}
          />
          <span
            className="text-[10px] font-bold"
            style={{
              color: activeTab === 'operations' ? '#818cf8' : '#94a3b8',
              fontWeight: activeTab === 'operations' ? 800 : 700,
            }}
          >
            Số Liệu
          </span>
        </button>

        {/* Nút 4: Pallet Kho */}
        <button
          type="button"
          onClick={() => setActiveTab('pallets')}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition"
        >
          <Boxes
            size={21}
            color={activeTab === 'pallets' ? '#38bdf8' : '#94a3b8'}
          />
          <span
            className="text-[10px] font-bold"
            style={{
              color: activeTab === 'pallets' ? '#38bdf8' : '#94a3b8',
              fontWeight: activeTab === 'pallets' ? 800 : 700,
            }}
          >
            Pallet Kho
          </span>
        </button>

        {/* Nút 5: Sơ Đồ Kho */}
        <button
          type="button"
          onClick={() => setActiveTab('warehouse_map')}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition"
        >
          <MapIcon
            size={21}
            color={activeTab === 'warehouse_map' ? '#06b6d4' : '#94a3b8'}
          />
          <span
            className="text-[10px] font-bold"
            style={{
              color: activeTab === 'warehouse_map' ? '#06b6d4' : '#94a3b8',
              fontWeight: activeTab === 'warehouse_map' ? 800 : 700,
            }}
          >
            Sơ Đồ Kho
          </span>
        </button>
      </nav>

      {/* ── MODAL FULL MENU (HIỂN THỊ TOÀN BỘ 7 CHỨC NĂNG) ─────────── */}
      <FullMenuModal
        visible={isFullMenuOpen}
        onClose={() => setIsFullMenuOpen(false)}
        currentTab={activeTab}
        onSelectTab={(t) => setActiveTab(t)}
        userProfile={userProfile}
        onLogout={handleLogout}
      />

      {/* ── WATERMARK OVERLAY (ĐÓNG DẤU ẢNH TÁC NGHIỆP) ─────────── */}
      <OperationWatermarkOverlay />

      {/* ═══════════════════════════════════════════════════════════
          MODAL: IN-PROGRESS PALLET STARTUP PROMPT (Match Mobile App)
         ═══════════════════════════════════════════════════════════ */}
      {inProgressPrompt && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#111827] border-2 border-emerald-500/50 rounded-2xl p-4 space-y-3.5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <Boxes size={24} />
              <h3 className="text-sm font-black uppercase tracking-wide">
                ĐANG QUÉT DỞ PALLET: {inProgressPrompt.stt}
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Hệ thống ghi nhận bạn đang quét dở Pallet STT: <strong className="text-amber-400 font-mono">{inProgressPrompt.stt}</strong>.
            </p>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Tiến độ hiện tại:</span>
                <span className="text-emerald-400 font-bold">{inProgressPrompt.boxesCount} / {inProgressPrompt.targetQty} thùng</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tổng khối lượng:</span>
                <span className="text-white font-bold">{inProgressPrompt.totalWeight.toFixed(1)} Kg</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-medium">
              Bạn có muốn TIẾP TỤC quét Pallet này không?
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  // Hủy: Reset hoàn toàn về rỗng giống Image 1
                  setActivePalletStt('')
                  setActivePalletTag('')
                  setActivePalletNotes('')
                  setCurrentBoxes([])
                  setInProgressPrompt(null)
                  localStorage.removeItem('last_worked_pallet_stt')
                  triggerToast('Đã hủy phiên quét. Bạn có thể chọn hoặc nhập Pallet mới.')
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-rose-400 hover:bg-slate-700 text-xs font-bold transition border border-slate-700"
              >
                ❌ HỦY (Đổi Pallet)
              </button>
              <button
                onClick={() => {
                  // Tiếp tục: Load pallet và danh sách thùng
                  const stt = inProgressPrompt.stt
                  setActivePalletStt(stt)
                  loadCurrentPalletBoxes(stt)
                  setInProgressPrompt(null)
                  localStorage.setItem('last_worked_pallet_stt', stt)
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30"
              >
                ✅ TIẾP TỤC QUÉT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL: DEDICATED BOX CLONE WITH QUICK CHIPS (Match Mobile)
         ═══════════════════════════════════════════════════════════ */}
      {cloneModalVisible && cloneSampleBox && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-sky-500/50 rounded-2xl p-4 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-sky-400">
                <Copy size={18} />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  NHÂN BẢN THÙNG HÀNG
                </h3>
              </div>
              <button onClick={() => setCloneModalVisible(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Sao chép thùng mẫu sang các thùng còn lại. Số thứ tự thùng (INDEX) sẽ tự động sinh liên tiếp.
            </p>

            {/* Sample Box Info Card */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sky-300">
                  📦 Thùng mẫu: #{cloneSampleBox.box_index} · {cloneSampleBox.sku}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800">
                  {cloneSampleBox.quantity} {cloneSampleBox.unit}
                </span>
              </div>
              <p className="font-bold text-white leading-snug">{cloneSampleBox.product_name}</p>
              <p className="text-[10px] text-slate-400 font-mono">
                Lot: {cloneSampleBox.lot_code} | NSX: {cloneSampleBox.production_date}
              </p>
            </div>

            {/* Count Input & Quick Chips */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                SỐ LƯỢNG THÙNG CẦN NHÂN BẢN THÊM:
              </label>
              <input
                type="number"
                value={cloneCount}
                onChange={e => setCloneCount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xl font-bold text-sky-400 focus:outline-hidden focus:border-sky-500"
                placeholder="1"
              />

              {/* Quick Chips Row (Matching Mobile App) */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {targetQty - currentBoxes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCloneCount(String(Math.max(1, targetQty - currentBoxes.length)))}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-bold hover:bg-sky-500/30 transition"
                  >
                    Điền đủ ({targetQty - currentBoxes.length} thùng)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCloneCount('5')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold hover:text-white transition"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => setCloneCount('10')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold hover:text-white transition"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => setCloneCount('20')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold hover:text-white transition"
                >
                  +20
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCloneModalVisible(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmClone}
                disabled={isCloning}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg shadow-sky-600/30 flex items-center justify-center gap-1.5"
              >
                {isCloning ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
                <span>Xác Nhận Nhân Bản</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <StampModals
        activePalletStt={activePalletStt}
        pendingStamp={pendingStamp}
        setPendingStamp={setPendingStamp}
        stampWeight={stampWeight}
        setStampWeight={setStampWeight}
        stampCount={stampCount}
        setStampCount={setStampCount}
        stampDictMap={stampDictMap}
        handleSaveStampBox={handleSaveStampBox}
        isManualStampModal={isManualStampModal}
        setIsManualStampModal={setIsManualStampModal}
        manualStampLine1={manualStampLine1}
        setManualStampLine1={setManualStampLine1}
        manualStampLine2={manualStampLine2}
        setManualStampLine2={setManualStampLine2}
        targetQty={targetQty}
        currentBoxesCount={currentBoxes.length}
      />

      <LabelModals
        activePalletStt={activePalletStt}
        pendingLabel={pendingLabel}
        setPendingLabel={setPendingLabel}
        labelWeight={labelWeight}
        setLabelWeight={setLabelWeight}
        labelCount={labelCount}
        setLabelCount={setLabelCount}
        handleSaveLabelBox={handleSaveLabelBox}
        isManualLabelModal={isManualLabelModal}
        setIsManualLabelModal={setIsManualLabelModal}
        manualLabelForm={manualLabelForm}
        setManualLabelForm={setManualLabelForm}
        targetQty={targetQty}
        currentBoxesCount={currentBoxes.length}
      />

      <PalletDetailModal
        selectedPallet={selectedPallet}
        setSelectedPallet={setSelectedPallet}
        selectedPalletBoxes={selectedPalletBoxes}
        loadingDetail={loadingDetail}
        onRefreshPallets={loadAllPallets}
      />

      <PalletSwitchModal
        isSwitchPalletModal={isSwitchPalletModal}
        setIsSwitchPalletModal={setIsSwitchPalletModal}
        activePalletStt={activePalletStt}
        newSttInput={newSttInput}
        setNewSttInput={setNewSttInput}
        newTagInput={newTagInput}
        setNewTagInput={setNewTagInput}
        newNotesInput={newNotesInput}
        setNewNotesInput={setNewNotesInput}
        newTargetQtyInput={newTargetQtyInput}
        setNewTargetQtyInput={setNewTargetQtyInput}
        defaultTargetQty={defaultTargetQty}
        autoCompleteOnFull={autoCompleteOnFull}
        setAutoCompleteOnFull={handleToggleAutoComplete}
        palletsList={palletsList}
        handleSwitchToStt={handleSwitchToStt}
      />

      {/* Modal gửi ảnh con dấu lên Web Mẹ (Server Gemini AI) */}
      {pendingStampPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="w-full max-w-md bg-[#111827] border border-indigo-500/50 rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  Gửi Ảnh Dấu Lên Web Mẹ (STT: {activePalletStt})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingStampPhoto(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-700 bg-black max-h-52 flex items-center justify-center">
              <img
                src={pendingStampPhoto}
                alt="Ảnh dấu mực vừa chụp"
                className="w-full max-h-52 object-contain"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Số lượng thùng
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={queueBoxCount}
                  onChange={e => setQueueBoxCount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1e293b] border border-slate-600 font-mono text-sm font-black text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Khối lượng / thùng (Kg)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={queueBoxWeight}
                  onChange={e => setQueueBoxWeight(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1e293b] border border-slate-600 font-mono text-sm font-black text-white"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Ảnh sẽ được gửi lên hàng đợi Server để Web Mẹ dùng Gemini AI giải mã chính xác và tạo thùng vào Pallet <strong className="text-amber-300">{activePalletStt}</strong>.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingStampPhoto(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition"
              >
                Chụp lại
              </button>
              <button
                type="button"
                onClick={handleSubmitStampPhotoToQueue}
                disabled={uploadingStampPhoto}
                className="flex-[1.5] py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 disabled:opacity-60"
              >
                {uploadingStampPhoto ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                <span>{uploadingStampPhoto ? 'Đang gửi...' : 'Gửi Lên Web Mẹ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ScannerDialogHost />
    </div>
  )
}
