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
  Info
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { decodeStampBox, DEFAULT_STAMP_DICT } from '@/lib/stampDecoder'
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
  updatePendingPalletStatus,
  getOfflineMeta,
  setOfflineMeta,
  OfflinePendingPallet,
  OfflineLot
} from '@/lib/scanner-db'
import { matchPalletSearch, calculateSearchScore, normalizeSearchString } from '@/lib/searchUtils'
import WarehouseMapTab from './_components/WarehouseMapTab'

// Helper function to synthesize an audio beep on scan success
function playScanSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12) // A6
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.13)
  } catch {}
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([40, 60, 40])
    } catch {}
  }
}

interface BoxItem {
  id: string
  code: string
  box_index: string
  quantity: number
  unit: string
  sku: string
  product_name: string
  lot_code?: string | null
  spec: string
  shift_group: string
  region: string
  production_date: string
  packaging_date: string
  raw_material_date?: string
  supplier?: string
  supplier_name?: string
  scan_type: 'label' | 'stamp'
  stamp_line1?: string
  stamp_line2?: string
  is_special_12?: boolean
  special_12_code?: string
  special_12_name?: string
  created_at: string
}

interface PalletItem {
  id: string
  stt: string
  lot_id: string | null
  lot_code: string | null
  boxes_count: number
  total_weight: number
  is_linked: boolean
  product_name: string | null
  sku: string | null
  product_aliases?: string | null
  aliases?: string | null
  location_code?: string | null
  production_place?: string | null
  material_zone?: string | null
  tag?: string | null
  packaging_date: string | null
  production_date: string | null
  scan_type: 'label' | 'stamp'
  is_special_12?: boolean
  notes?: string | null
  created_at: string
}

interface ProductSuggestion {
  id: string
  name: string
  sku?: string
  aliases?: string | null
}

export default function WebScannerPage() {
  // ── Navigation & Active Tab ────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'label' | 'stamp' | 'warehouse_map' | 'pallets' | 'settings'>('label')
  const [visitedWarehouseMapTab, setVisitedWarehouseMapTab] = useState<boolean>(false)
  const [palletListSubTab, setPalletListSubTab] = useState<'pending' | 'cloud'>('pending')

  useEffect(() => {
    if (activeTab === 'warehouse_map' && !visitedWarehouseMapTab) {
      setVisitedWarehouseMapTab(true)
    }
  }, [activeTab, visitedWarehouseMapTab])

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
  } | null>(null)
  const [stampWeight, setStampWeight] = useState<string>('20')
  const [stampCount, setStampCount] = useState<string>('1')
  const [isManualStampModal, setIsManualStampModal] = useState<boolean>(false)
  const [manualStampLine1, setManualStampLine1] = useState<string>('')
  const [manualStampLine2, setManualStampLine2] = useState<string>('')

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
  const [userProfile, setUserProfile] = useState<{
    fullName: string
    email: string
    companyCode: string
    companyName: string
    roleName: string
  } | null>(null)

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

  // ── Fetch User & Company Info on Mount ─────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await (supabase
            .from('user_profiles') as any)
            .select('full_name, email, company_name, roles(name, code)')
            .eq('id', user.id)
            .single()

          setUserProfile({
            fullName: profile?.full_name || user.email?.split('@')[0] || 'Nhân viên kho',
            email: user.email || '',
            companyCode: 'CTG',
            companyName: profile?.company_name || 'Công ty TNHH XNK Chánh Thu',
            roleName: profile?.roles?.name || 'Vận hành kho'
          })
        } else {
          setUserProfile({
            fullName: 'Nguyễn Đình Tùng',
            email: 'tungnguyen@chanhthu.click',
            companyCode: 'CTG',
            companyName: 'Công ty Cổ Phần Tập Đoàn XNK Trái Cây Chánh Thu',
            roleName: 'KHO_DONG_LANH'
          })
        }
      } catch {
        setUserProfile({
          fullName: 'Nguyễn Đình Tùng',
          email: 'tungnguyen@chanhthu.click',
          companyCode: 'CTG',
          companyName: 'Công ty Cổ Phần Tập Đoàn XNK Trái Cây Chánh Thu',
          roleName: 'KHO_DONG_LANH'
        })
      }
    }
    fetchUser()
  }, [])

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
        setStampDictMap(JSON.parse(cachedDict))
      }

      const cachedProds = localStorage.getItem('cached_products')
      if (cachedProds) {
        setAvailableProducts(JSON.parse(cachedProds))
      }
    } catch (e) {
      console.warn('Lỗi đọc cache quy tắc dấu đóng:', e)
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

      triggerToast(`⚡ Đã lưu ${count} thùng ngoại tuyến (Pallet ${palletStt})!`)
    } catch (e: any) {
      alert(`Lỗi lưu ngoại tuyến: ${e.message}`)
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
      // If offline, read directly from pending offline queue
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const pending = await getPendingPallets()
        const matching = pending.filter(p => p.stt === cleanStt)
        if (matching.length > 0) {
          const offlineBoxes: BoxItem[] = []
          matching.forEach(p => {
            p.boxes.forEach((b, idx) => {
              offlineBoxes.push({
                id: b.code,
                code: b.code,
                box_index: String(idx + 1),
                quantity: b.weight,
                unit: 'Kg',
                sku: p.sku || 'SKU',
                product_name: p.product_name || 'Hàng lưu ngoại tuyến',
                lot_code: p.lot_code || 'LOT',
                spec: '',
                shift_group: '',
                region: '',
                production_date: '',
                packaging_date: '',
                scan_type: 'label',
                created_at: b.time
              })
            })
          })
          setCurrentBoxes(offlineBoxes)
          return
        }
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
        const mapped = data.map((b: any, idx: number) => parseBoxLabelItem(b, idx, stampDictMap))

        mapped.sort((a: BoxItem, b: BoxItem) => (parseInt(a.box_index, 10) || 0) - (parseInt(b.box_index, 10) || 0))
        setCurrentBoxes(mapped)
      } else {
        // Fallback to pending pallets
        const pending = await getPendingPallets()
        const matching = pending.filter(p => p.stt === cleanStt)
        if (matching.length > 0) {
          const offlineBoxes: BoxItem[] = []
          matching.forEach(p => {
            p.boxes.forEach((b, idx) => {
              offlineBoxes.push({
                id: b.code,
                code: b.code,
                box_index: String(idx + 1),
                quantity: b.weight,
                unit: 'Kg',
                sku: p.sku || 'SKU',
                product_name: p.product_name || 'Hàng lưu ngoại tuyến',
                lot_code: p.lot_code || 'LOT',
                spec: '',
                shift_group: '',
                region: '',
                production_date: '',
                packaging_date: '',
                scan_type: 'label',
                created_at: b.time
              })
            })
          })
          setCurrentBoxes(offlineBoxes)
        } else {
          setCurrentBoxes([])
        }
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
          width: { ideal: 1280 },
          height: { ideal: 720 }
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
    if (activeTab === 'label' || activeTab === 'stamp') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [activeTab])

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
  const captureFrame = (): string | null => {
    if (!videoRef.current) return null
    const v = videoRef.current
    if (v.videoWidth === 0 || v.videoHeight === 0) return null

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
      alert('Chưa có Pallet!\n\nVui lòng bấm [Chọn / Nhập STT Pallet] trước khi quét tem thùng.')
      setIsSwitchPalletModal(true)
      return
    }

    const base64 = captureFrame()
    if (!base64) {
      triggerToast('Không thể lấy khung hình Camera')
      return
    }

    setIsRecognizing(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 22000)

    try {
      const mode = activeTab === 'stamp' ? 'stamp' : 'label'
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mode }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Nhận diện thất bại')

      if (mode === 'stamp') {
        const stampData = json.data
        const l1 = stampData.stamp_line1 || ''
        const l2 = stampData.stamp_line2 || ''
        const localDecoded = decodeStampBox({
          metadata: { scan_type: 'stamp', stamp_line1: l1, stamp_line2: l2 }
        }, stampDictMap)
        setPendingStamp({
          stamp_line1: l1,
          stamp_line2: l2,
          decoded: localDecoded || stampData.decoded
        })
        setStampWeight('20')
        setStampCount('1')
      } else {
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
            special_12_name: dec.special12Name
          }
        })
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await saveBoxesOffline(
          rowsToInsert,
          cleanStt,
          l2,
          dec.productTitle || (dec.isSpecial12 ? dec.special12Name : 'Sản phẩm đóng dấu'),
          dec.isSpecial12 ? dec.special12Code : (dec.code || 'SKU'),
          count,
          'stamp'
        )
        setPendingStamp(null)
        checkTargetReached(currentBoxes.length + count)
        return
      }

      const { error } = await supabase.from('box_labels').insert(rowsToInsert as any)
      if (error) {
        console.warn('Lỗi mạng khi lưu thùng, tự động chuyển sang lưu offline:', error.message)
        await saveBoxesOffline(
          rowsToInsert,
          cleanStt,
          l2,
          dec.productTitle || (dec.isSpecial12 ? dec.special12Name : 'Sản phẩm đóng dấu'),
          dec.isSpecial12 ? dec.special12Code : (dec.code || 'SKU'),
          count,
          'stamp'
        )
      } else {
        triggerToast(`✅ Đã lưu ${count} thùng con dấu vào Pallet ${cleanStt}!`)
        loadCurrentPalletBoxes(cleanStt)
      }

      setPendingStamp(null)
      checkTargetReached(currentBoxes.length + count)
    } catch (err: any) {
      console.warn('Exception khi lưu thùng con dấu:', err)
    }
  }

  // ── Save Label Box to Supabase ────────────────────────────────
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

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
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
        return
      }

      const { error } = await supabase.from('box_labels').insert(rowsToInsert as any)
      if (error) {
        console.warn('Lỗi mạng khi lưu tem, tự động chuyển sang lưu offline:', error.message)
        await saveBoxesOffline(
          rowsToInsert,
          cleanStt,
          labelData.lot_code,
          labelData.product_name,
          labelData.sku,
          count,
          'label'
        )
      } else {
        triggerToast(`✅ Đã lưu ${count} thùng tem vào Pallet ${cleanStt}!`)
        loadCurrentPalletBoxes(cleanStt)
      }

      setPendingLabel(null)
      checkTargetReached(currentBoxes.length + count)
    } catch (err: any) {
      alert(`Lỗi lưu tem: ${err.message}`)
    }
  }

  // ── Target Reached Check ──────────────────────────────────────
  const checkTargetReached = (totalCount: number) => {
    if (totalCount >= targetQty) {
      setTimeout(() => {
        if (confirm(`🎉 ĐÃ ĐỦ PALLET!\n\nPallet ${activePalletStt} đã đạt chỉ tiêu ${totalCount}/${targetQty} thùng.\n\nBạn có muốn CHỐT PALLET này ngay không?`)) {
          handleCompletePallet()
        }
      }, 400)
    }
  }

  // ── Complete Pallet (Chốt Pallet) ──────────────────────────────
  const handleCompletePallet = async () => {
    triggerToast(`🎉 ĐÃ CHỐT HOÀN THÀNH PALLET ${activePalletStt}!`)
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
      setNewTargetQtyInput(30)
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
      alert(`Lỗi nhân bản thùng: ${e.message}`)
    } finally {
      setIsCloning(false)
    }
  }

  // ── Delete Box ────────────────────────────────────────────────
  const handleDeleteBox = async (boxId: string) => {
    if (!confirm('Bạn có chắc muốn xóa thùng này khỏi Pallet không?')) return
    try {
      if (boxId.startsWith('offline_')) {
        setCurrentBoxes(prev => prev.filter(b => b.id !== boxId))
        triggerToast('Đã xóa thùng ngoại tuyến')
        return
      }

      const { error } = await supabase.from('box_labels').delete().eq('id', boxId)
      if (error) throw error
      triggerToast('Đã xóa thùng thành công')
      loadCurrentPalletBoxes(activePalletStt)
    } catch (err: any) {
      alert(`Lỗi xóa thùng: ${err.message}`)
    }
  }

  // ── Làm mới / Xoá toàn bộ thùng của Pallet đang chọn (Khớp Mobile App) ─────
  const handleResetActivePallet = async (targetStt?: string) => {
    const stt = (targetStt || activePalletStt || '').trim().toUpperCase()
    if (!stt) return
    const boxCount = currentBoxes.length
    const totalW = currentBoxes.reduce((s, b) => s + (b.quantity || 20), 0)

    if (!targetStt && !confirm(`Xoá thùng Pallet ${stt}?\n\nBạn có chắc chắn muốn xoá toàn bộ ${boxCount} thùng (${totalW.toFixed(1)} Kg) của Pallet ${stt} để quét lại từ đầu không?`)) {
      return
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
      alert(`Lỗi làm mới Pallet: ${err.message}`)
    }
  }

  // ── Xử lý chuyển Pallet thông minh (Khớp cảnh báo tồn tại như Mobile App) ─
  const handleSwitchToStt = async (cleanStt: string, tagVal: string, notesVal: string, targetVal: number) => {
    const existing = palletsList.find(p => p.stt === cleanStt)
    if (existing && existing.boxes_count > 0) {
      const wantReset = confirm(
        `⚠️ STT ${cleanStt} ĐÃ CÓ TRONG HỆ THỐNG!\n\n` +
        `STT ${cleanStt} hiện đang có ${existing.boxes_count} thùng (${existing.total_weight.toFixed(1)} Kg).\n\n` +
        `Pallet này có bị xáo trộn hàng và bạn cần quét lại từ đầu không?\n\n` +
        `• Bấm [OK] để: 🔄 Quét lại từ đầu (Xoá thùng cũ về 0)\n` +
        `• Bấm [Cancel / Hủy] để: Tiếp tục quét thêm vào Pallet này`
      )

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
  const handleSyncStampRules = async () => {
    setSyncingStamp(true)
    try {
      const { data, error } = await (supabase
        .from('stamp_dictionaries') as any)
        .select('category, code, name')

      if (error) throw error

      if (data && data.length > 0) {
        const newDict: Record<string, Record<string, string>> = {}
        ;(data as any[]).forEach((item: any) => {
          if (!newDict[item.category]) newDict[item.category] = {}
          newDict[item.category][item.code] = item.name
        })

        setStampDictMap(newDict)
        setStampRulesCount(data.length)
        const now = new Date().toISOString()
        setLastStampSync(now)

        localStorage.setItem('cached_stamp_dictionaries', JSON.stringify(newDict))
        localStorage.setItem('cached_stamp_rules_count', data.length.toString())
        localStorage.setItem('last_stamp_sync_time', now)

        triggerToast(`✅ Đã tải về ${data.length} quy tắc con dấu từ Web mẹ!`)
      } else {
        triggerToast('Không có dữ liệu quy tắc con dấu trên máy chủ.')
      }
    } catch (err: any) {
      alert(`Lỗi đồng bộ quy tắc dấu đóng: ${err.message}`)
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
      alert(`Lỗi tải dữ liệu LOT: ${err.message}`)
    } finally {
      setIsSyncingLots(false)
    }
  }

  // ── Sync Pending Pallets Queue Handler ────────────────────────
  const handleSyncPendingQueue = async () => {
    if (pendingPallets.length === 0) return
    if (!navigator.onLine) {
      alert('Thiết bị đang không có mạng. Vui lòng kết nối Wifi hoặc 4G để đồng bộ!')
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
      alert('Thiết bị đang không có mạng!')
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
      alert(`Lỗi đồng bộ: ${e.message}`)
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

  return (
    <div className="fixed inset-0 flex flex-col max-w-md mx-auto w-full bg-[#0b0f19] text-slate-100 select-none overflow-hidden z-10">
      
      {/* ── TOP USER & COMPANY HEADER (Match Mobile App) ───────── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-[#080d1a] border-b border-slate-800/90 text-xs gap-2">
        <div className="flex items-center gap-1.5 truncate text-emerald-400 font-bold">
          <Building2 size={13} className="shrink-0 text-emerald-400" />
          <span className="truncate">{userProfile?.companyCode || 'CTG'} · {userProfile?.companyName || 'Chánh Thu'}</span>
        </div>
        <button
          onClick={() => setActiveTab('settings')}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700/80 text-sky-300 font-medium hover:bg-slate-700 transition shrink-0 active:scale-95"
          title="Mở Cài Đặt & Tài Khoản"
        >
          <User size={13} className="text-sky-400" />
          <span className="truncate max-w-[120px]">{userProfile?.fullName || 'Nhân viên kho'}</span>
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

                <div className="w-[88%] max-w-[300px] h-[115px] border-2 border-amber-400/80 rounded-xl relative shadow-[0_0_20px_rgba(245,158,11,0.25)] flex flex-col justify-between p-2.5 bg-amber-400/5">
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
                onClick={() => {
                  if (!activePalletStt) {
                    setIsSwitchPalletModal(true)
                    return
                  }
                  setManualStampLine1('')
                  setManualStampLine2('')
                  setIsManualStampModal(true)
                }}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 active:scale-[0.98] transition shrink-0"
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
        {visitedWarehouseMapTab && (
          <div className={activeTab === 'warehouse_map' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
            <WarehouseMapTab />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 3: PALLET KHO (SPLIT INTO LOCAL/PENDING & CLOUD TABS)
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'pallets' && (
          <div className="flex-1 flex flex-col bg-[#0b0f19] overflow-hidden">
            
            {/* Top Sub-tabs Bar: Chờ đẩy lên (Local) vs Web mẹ (Cloud) */}
            <div className="p-2 border-b border-slate-800 bg-[#0f172a] space-y-2">
              <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 gap-1">
                <button
                  onClick={() => setPalletListSubTab('pending')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    palletListSubTab === 'pending'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <HardDrive size={13} />
                  <span>Chờ đẩy lên</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${palletListSubTab === 'pending' ? 'bg-black/30 text-white font-mono' : 'bg-slate-800 text-slate-400'}`}>
                    {pendingPallets.length}
                  </span>
                </button>

                <button
                  onClick={() => setPalletListSubTab('cloud')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    palletListSubTab === 'cloud'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Database size={13} />
                  <span>Web mẹ (Cloud)</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${palletListSubTab === 'cloud' ? 'bg-black/30 text-white font-mono' : 'bg-slate-800 text-slate-400'}`}>
                    {palletsList.length}
                  </span>
                </button>
              </div>

              {/* Sub-tab 1 Controls: Pending Pallets toolbar */}
              {palletListSubTab === 'pending' && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-slate-400 text-[11px]">
                    Pallet lưu tạm trên thiết bị: <strong className="text-amber-400">{pendingPallets.length}</strong>
                  </span>
                  {pendingPallets.length > 0 && (
                    <button
                      onClick={handleSyncPendingQueue}
                      disabled={isSyncingPending || !isOnline}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-[11px] font-bold flex items-center gap-1 shadow-xs"
                    >
                      <RefreshCw size={12} className={isSyncingPending ? 'animate-spin' : ''} />
                      <span>Đồng bộ tất cả</span>
                    </button>
                  )}
                </div>
              )}

              {/* Sub-tab 2 Controls: Cloud Pallets search & filters */}
              {palletListSubTab === 'cloud' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => {
                          setSearchQuery(e.target.value)
                          setShowSearchSuggestions(true)
                        }}
                        onFocus={() => setShowSearchSuggestions(true)}
                        placeholder="Tìm STT, LOT, gõ tắt (VD: Đô c, srmc)..."
                        className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                      />
                      {searchQuery && (
                        <button
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

                      {/* Autocomplete Product Suggestions Dropdown */}
                      {showSearchSuggestions && productSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800">
                          <div className="p-1.5 bg-slate-950 text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                            <span>Gợi ý sản phẩm ({productSuggestions.length}):</span>
                            <button
                              onClick={() => setShowSearchSuggestions(false)}
                              className="text-slate-500 hover:text-white text-[10px]"
                            >
                              Đóng ✕
                            </button>
                          </div>
                          {productSuggestions.map(p => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setSearchQuery(p.name)
                                setShowSearchSuggestions(false)
                              }}
                              className="p-2 hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs"
                            >
                              <div className="truncate mr-2">
                                <p className="font-bold text-white truncate">{p.name}</p>
                                {p.aliases && (
                                  <p className="text-[10px] text-emerald-400 font-mono">Gõ tắt: {p.aliases}</p>
                                )}
                              </div>
                              {p.sku && (
                                <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px] shrink-0">
                                  {p.sku}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={loadAllPallets}
                      className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
                      title="Tải lại danh sách"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>

                  {/* Filter Sub-chips */}
                  <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                    <button
                      onClick={() => setPalletFilter('all')}
                      className={`flex-1 py-1 text-[11px] font-bold rounded-md transition ${palletFilter === 'all' ? 'bg-sky-600 text-white' : 'text-slate-400'}`}
                    >
                      Tất cả ({palletsList.length})
                    </button>
                    <button
                      onClick={() => setPalletFilter('unlinked')}
                      className={`flex-1 py-1 text-[11px] font-bold rounded-md transition ${palletFilter === 'unlinked' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}
                    >
                      Chờ duyệt LOT
                    </button>
                    <button
                      onClick={() => setPalletFilter('linked')}
                      className={`flex-1 py-1 text-[11px] font-bold rounded-md transition ${palletFilter === 'linked' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                    >
                      Đã duyệt LOT
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              
              {/* SUB-VIEW 1: PENDING PALLETS LIST */}
              {palletListSubTab === 'pending' && (
                <>
                  {pendingPallets.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 space-y-2">
                      <HardDrive size={36} className="mx-auto text-slate-600 stroke-[1.5]" />
                      <p className="text-xs font-bold text-slate-300">Không có Pallet nào đang chờ đẩy lên</p>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                        Tất cả các pallet bạn quét đều đã được đồng bộ an toàn lên máy chủ Web mẹ.
                      </p>
                    </div>
                  ) : (
                    pendingPallets.map(item => (
                      <div
                        key={item.client_id}
                        className="p-3 rounded-xl bg-[#111827] border border-amber-500/40 space-y-2 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black font-mono text-xs">
                              STT: {item.stt}
                            </span>
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                              Chờ đồng bộ ({item.boxes_count} thùng)
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(item.created_at).toLocaleTimeString('vi-VN')}
                          </span>
                        </div>

                        <div className="text-xs text-white font-bold">
                          {item.product_name || 'Hàng lưu ngoại tuyến'}
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono">
                          Mã LOT: <strong className="text-sky-300">{item.lot_code || 'LOT'}</strong> · SKU: {item.sku || 'SKU'}
                        </div>

                        <div className="pt-2 border-t border-slate-800 flex items-center gap-2 justify-end">
                          <button
                            onClick={() => {
                              setActivePalletStt(item.stt)
                              setActiveTab('label')
                              loadCurrentPalletBoxes(item.stt)
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1"
                          >
                            <Scan size={12} className="text-emerald-400" />
                            <span>Mở quét tiếp</span>
                          </button>

                          <button
                            onClick={() => handleSyncSinglePending(item)}
                            disabled={!isOnline}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1"
                          >
                            <RefreshCw size={12} />
                            <span>Đẩy lên Web</span>
                          </button>

                          <button
                            onClick={async () => {
                              if (confirm(`Bạn có chắc muốn xóa Pallet ${item.stt} khỏi hàng đợi không?`)) {
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
                    ))
                  )}
                </>
              )}

              {/* SUB-VIEW 2: CLOUD PALLETS LIST */}
              {palletListSubTab === 'cloud' && (
                <>
                  {filteredPallets.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 space-y-2">
                      <Boxes size={36} className="mx-auto text-slate-600 stroke-[1.5]" />
                      <p className="text-xs">Không tìm thấy Pallet nào khớp với bộ lọc</p>
                    </div>
                  ) : (
                    <>
                      {displayedPallets.map(p => (
                        <div
                          key={p.id}
                          className="p-3 rounded-xl bg-[#111827] border border-slate-800 hover:border-slate-700 transition space-y-2 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
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
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              {p.boxes_count} thùng
                            </span>
                          </div>

                          {p.is_special_12 && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black">
                              ⭐ 12 SỐ ĐẦU TRỌN GÓI
                            </span>
                          )}

                          {p.lot_code && (
                            <div className="text-[11px] text-slate-400">
                              Mã LOT Web: <span className="text-sky-400 font-mono font-bold">{p.lot_code}</span>
                            </div>
                          )}

                          <p className="text-xs font-bold text-white leading-snug line-clamp-2">
                            {p.product_name}
                          </p>

                          {p.product_aliases && (
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <span>🏷️ Gõ tắt:</span>
                              <span className="text-emerald-400 font-bold">{p.product_aliases}</span>
                            </div>
                          )}

                          {p.notes && (
                            <div className="text-[11px] text-slate-300 bg-slate-900/90 border border-slate-800/80 px-2.5 py-1 rounded-lg">
                              <span className="text-slate-500 text-[10px] block font-bold">📝 GHI CHÚ:</span>
                              <span className="text-slate-300 italic">{p.notes}</span>
                            </div>
                          )}

                          {/* Quick Actions Row: Kéo về sửa & Xem chi tiết */}
                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-mono">
                              {p.production_date ? `NSX: ${p.production_date}` : ''}
                            </span>

                            <button
                              onClick={() => handleOpenPalletDetail(p)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
                            >
                              <span>Xem chi tiết</span>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {filteredPallets.length > palletDisplayLimit && (
                        <div className="pt-2 pb-4 text-center">
                          <button
                            onClick={() => setPalletDisplayLimit(prev => prev + 30)}
                            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 active:scale-[0.98] transition"
                          >
                            Tải thêm ({filteredPallets.length - palletDisplayLimit} Pallet còn lại)
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 4: CÀI ĐẶT (SETTINGS & TECHNICIAN MODE)
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto bg-[#0b0f19] p-4 space-y-4">
            
            {/* User Profile Card (Matching Mobile App) */}
            <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-600 to-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-md">
                  {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{userProfile?.fullName}</h3>
                  <p className="text-xs text-sky-400 font-medium truncate">{userProfile?.roleName}</p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">{userProfile?.email}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Đơn vị: <strong>{userProfile?.companyName}</strong></span>
                <button
                  onClick={async () => {
                    if (confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
                      await supabase.auth.signOut()
                      window.location.href = '/login'
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1 transition"
                >
                  <LogOut size={12} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>

            {/* General Preferences */}
            <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                ⚙️ Cấu Hình Máy Quét
              </h3>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Mã hệ thống kho:</label>
                <select
                  value={systemCode}
                  onChange={e => setSystemCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                >
                  <option value="KHO_DONG_LANH">Kho Đông Lạnh (KHO_DONG_LANH)</option>
                  <option value="KHO_NGUYEN_LIEU">Kho Nguyên Liệu</option>
                  <option value="KHO_THANH_PHAM">Kho Thành Phẩm</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Số lượng thùng chuẩn / Pallet:</label>
                <input
                  type="number"
                  value={targetQty}
                  onChange={e => setTargetQty(parseInt(e.target.value, 10) || 30)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-300">Âm thanh khi quét thành công:</span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-lg border transition ${soundEnabled ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                >
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              </div>
            </div>

            {/* Offline Stamp Rules Sync */}
            <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Barcode size={18} className="text-purple-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-purple-400">
                    Quy Tắc Dấu Đóng Mực (Offline)
                  </h3>
                </div>
                <span className="text-xs font-black text-sky-400 font-mono">
                  {stampRulesCount} quy tắc
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Lưu trong bộ nhớ máy để tự động giải mã 2 dòng dấu đóng ngay cả khi không có mạng wifi trong kho lạnh.
              </p>

              <button
                onClick={handleSyncStampRules}
                disabled={syncingStamp}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 active:scale-[0.98]"
              >
                {syncingStamp ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang tải từ máy chủ web...</span>
                  </>
                ) : (
                  <>
                    <CloudDownload size={15} />
                    <span>Tải / Cập nhật quy tắc từ Web mẹ</span>
                  </>
                )}
              </button>
            </div>

            {/* Offline LOT Data Sync */}
            <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={18} className="text-sky-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    Dữ Liệu LOT Ngoại Tuyến (Offline)
                  </h3>
                </div>
                <span className="text-xs font-black text-emerald-400 font-mono">
                  {offlineLotsCount} LOT
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Tải toàn bộ LOT từ máy chủ về bộ nhớ trình duyệt (IndexedDB) để tra cứu, gõ tắt và gợi ý ngay cả khi ở trong kho lạnh mất mạng 100%.
              </p>

              <button
                onClick={handleSyncLotsOffline}
                disabled={isSyncingLots}
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 active:scale-[0.98]"
              >
                {isSyncingLots ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang tải danh sách LOT về máy...</span>
                  </>
                ) : (
                  <>
                    <CloudDownload size={15} />
                    <span>Tải / Cập nhật dữ liệu LOT về máy</span>
                  </>
                )}
              </button>
            </div>

            {/* Technician Mode Card (Easter Egg: unlocked by tapping version 5 times) */}
            {showTechnicianConfig && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/40 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-amber-400">
                  <ShieldCheck size={18} />
                  <h3 className="text-xs font-black uppercase tracking-wider">
                    🔓 Chế Độ Kỹ Thuật Viên Máy Chủ
                  </h3>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Máy chủ API Supabase:</label>
                  <input
                    type="text"
                    value={technicianUrl}
                    onChange={e => setTechnicianUrl(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                </div>

                {testResult && (
                  <div className="p-2 rounded-lg bg-slate-900 text-xs font-mono border border-slate-800">
                    {testResult}
                  </div>
                )}

                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="w-full py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition"
                >
                  {testingConnection ? 'Đang kiểm tra...' : 'Kiểm tra kết nối máy chủ'}
                </button>
              </div>
            )}

            {/* iOS PWA Installation Guide */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 space-y-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <Smartphone size={20} />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  📲 Hướng Dẫn Cài Đặt Trên iPhone (iOS)
                </h3>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Nhân viên dùng iPhone không cần qua App Store. Chỉ cần làm theo 3 bước để biến trang này thành App toàn màn hình:
              </p>

              <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside pl-1 font-medium">
                <li>
                  Mở trang này trên trình duyệt <strong>Safari</strong> của iPhone.
                </li>
                <li>
                  Bấm vào biểu tượng <strong>Chia sẻ (Share)</strong> ở thanh dưới cùng của Safari (<Share2 size={12} className="inline text-blue-400" />).
                </li>
                <li>
                  Cuộn xuống chọn <strong>&quot;Thêm vào MH chính&quot; (Add to Home Screen)</strong> ➔ Bấm <strong>Thêm (Add)</strong>.
                </li>
              </ol>
            </div>

            {/* Version Text (Tap 5 times to unlock Technician Mode) */}
            <div
              onClick={handleVersionTap}
              className="text-center text-[11px] text-slate-500 pt-2 cursor-pointer select-none hover:text-slate-400 transition"
              title="Chạm 5 lần để mở khóa chế độ kỹ thuật viên"
            >
              Phiên bản Web Scanner v1.1.0 • Chánh Thu Warehouse System
            </div>
          </div>
        )}
      </main>

      {/* ── BOTTOM NAVIGATION BAR (Matching Mobile App) ─────────── */}
      <nav className="shrink-0 bg-[#0f172a] border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around z-20 shadow-lg">
        <button
          onClick={() => setActiveTab('label')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition ${activeTab === 'label' ? 'text-emerald-400 bg-emerald-500/10 font-bold' : 'text-slate-400'}`}
        >
          <Scan size={18} />
          <span className="text-[10px]">Quét Tem</span>
        </button>

        <button
          onClick={() => setActiveTab('stamp')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition ${activeTab === 'stamp' ? 'text-amber-400 bg-amber-500/10 font-bold' : 'text-slate-400'}`}
        >
          <Fingerprint size={18} />
          <span className="text-[10px]">Dấu Đóng</span>
        </button>

        <button
          onClick={() => setActiveTab('pallets')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition ${activeTab === 'pallets' ? 'text-sky-400 bg-sky-500/10 font-bold' : 'text-slate-400'}`}
        >
          <Boxes size={18} />
          <span className="text-[10px]">Pallet Kho</span>
        </button>

        <button
          onClick={() => setActiveTab('warehouse_map')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition ${activeTab === 'warehouse_map' ? 'text-cyan-400 bg-cyan-500/10 font-bold' : 'text-slate-400'}`}
        >
          <MapPin size={18} />
          <span className="text-[10px]">Sơ Đồ Kho</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition ${activeTab === 'settings' ? 'text-purple-400 bg-purple-500/10 font-bold' : 'text-slate-400'}`}
        >
          <Settings size={18} />
          <span className="text-[10px]">Cài Đặt</span>
        </button>
      </nav>

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

      {/* ── MODAL: XÁC NHẬN CON DẤU MỰC (STAMP) ─────────────────── */}
      {pendingStamp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-amber-400" />
                <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  ĐÃ ĐỌC ĐƯỢC CON DẤU MỰC
                </h3>
              </div>
              <button onClick={() => setPendingStamp(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Inputs Dòng 1 & Dòng 2 */}
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-amber-300 block mb-0.5">DÒNG 1 (MÃ SẢN PHẨM):</label>
                <input
                  type="text"
                  value={pendingStamp.stamp_line1}
                  onChange={e => {
                    const val = e.target.value
                    const dec = decodeStampBox({ metadata: { scan_type: 'stamp', stamp_line1: val, stamp_line2: pendingStamp.stamp_line2 } }, stampDictMap)
                    setPendingStamp({ ...pendingStamp, stamp_line1: val, decoded: dec })
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
                <span className="text-[9px] text-slate-500 font-mono">{pendingStamp.stamp_line1.length} ký tự</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-emerald-300 block mb-0.5">DÒNG 2 (NGUỒN GỐC & TRUY XUẤT):</label>
                <input
                  type="text"
                  value={pendingStamp.stamp_line2}
                  onChange={e => {
                    const val = e.target.value
                    const dec = decodeStampBox({ metadata: { scan_type: 'stamp', stamp_line1: pendingStamp.stamp_line1, stamp_line2: val } }, stampDictMap)
                    setPendingStamp({ ...pendingStamp, stamp_line2: val, decoded: dec })
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
                <span className="text-[9px] text-slate-500 font-mono">{pendingStamp.stamp_line2.length} ký tự</span>
              </div>
            </div>

            {/* Realtime Stamp Decoding Details */}
            {(() => {
              const dec = pendingStamp.decoded || decodeStampBox({
                metadata: { scan_type: 'stamp', stamp_line1: pendingStamp.stamp_line1, stamp_line2: pendingStamp.stamp_line2 }
              }, stampDictMap)

              return (
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">🔍 KẾT QUẢ GIẢI MÃ:</span>
                    {dec.isSpecial12 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        ⭐ NGOẠI LỆ 12 SỐ
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-black text-white leading-snug">
                    {dec.productTitle}
                  </p>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Nhà máy:</span>
                      <strong className="text-slate-200">{dec.factoryName || '---'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Vùng NL:</span>
                      <strong className="text-slate-200">{dec.provinceName || '---'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Ngày nhập NL:</span>
                      <strong className="text-amber-400 font-mono">{dec.rawMaterialDateStr || '---'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Ngày đóng gói:</span>
                      <strong className="text-slate-200 font-mono">{dec.packagingDateStr || '---'}</strong>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Weight & Multiply Count with Quick Chips */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Khối lượng (Kg):</label>
                <input
                  type="number"
                  value={stampWeight}
                  onChange={e => setStampWeight(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Số lượng thùng:</label>
                <input
                  type="number"
                  value={stampCount}
                  onChange={e => setStampCount(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPendingStamp(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveStampBox}
                className="flex-1 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400 transition shadow-lg shadow-amber-500/30"
              >
                Lưu vào Pallet {activePalletStt}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NHẬP SỐ TAY CON DẤU ─────────────────────────── */}
      {isManualStampModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Nhập Dãy Số Con Dấu
              </h3>
              <button onClick={() => setIsManualStampModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-amber-300 block mb-0.5">DÒNG 1 (MÃ SẢN PHẨM):</label>
                <input
                  type="text"
                  value={manualStampLine1}
                  onChange={e => setManualStampLine1(e.target.value)}
                  placeholder="VD: 102010402001-0"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-emerald-300 block mb-0.5">DÒNG 2 (NGUỒN GỐC):</label>
                <input
                  type="text"
                  value={manualStampLine2}
                  onChange={e => setManualStampLine2(e.target.value)}
                  placeholder="VD: 2151014102600066"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
              </div>
            </div>

            <button
              onClick={() => {
                if (!manualStampLine1 && !manualStampLine2) {
                  alert('Vui lòng nhập ít nhất 1 dòng số')
                  return
                }
                const dec = decodeStampBox({
                  metadata: { scan_type: 'stamp', stamp_line1: manualStampLine1, stamp_line2: manualStampLine2 }
                }, stampDictMap)
                setPendingStamp({
                  stamp_line1: manualStampLine1,
                  stamp_line2: manualStampLine2,
                  decoded: dec
                })
                setIsManualStampModal(false)
              }}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400 transition"
            >
              Giải Mã & Xác Nhận
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: XÁC NHẬN TEM THÙNG (LABEL) ────────────────────── */}
      {pendingLabel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-emerald-500/40 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  KẾT QUẢ ĐỌC TEM THÙNG
                </h3>
              </div>
              <button onClick={() => setPendingLabel(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs font-black text-white leading-snug">
              {pendingLabel.product_name}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">SKU:</span>
                <input
                  type="text"
                  value={pendingLabel.sku}
                  onChange={e => setPendingLabel({ ...pendingLabel, sku: e.target.value })}
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Mã LOT:</span>
                <input
                  type="text"
                  value={pendingLabel.lot_code}
                  onChange={e => setPendingLabel({ ...pendingLabel, lot_code: e.target.value })}
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Ngày SX:</span>
                <input
                  type="text"
                  value={pendingLabel.production_date}
                  onChange={e => setPendingLabel({ ...pendingLabel, production_date: e.target.value })}
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-amber-400"
                />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Ngày ĐG:</span>
                <input
                  type="text"
                  value={pendingLabel.packaging_date}
                  onChange={e => setPendingLabel({ ...pendingLabel, packaging_date: e.target.value })}
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Khối lượng (Kg):</label>
                <input
                  type="number"
                  value={labelWeight}
                  onChange={e => setLabelWeight(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Số thùng:</label>
                <input
                  type="number"
                  value={labelCount}
                  onChange={e => setLabelCount(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPendingLabel(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
              >
                Hủy
              </button>
              <button
                onClick={() => handleSaveLabelBox(pendingLabel, parseFloat(labelWeight) || 20, parseInt(labelCount, 10) || 1)}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30"
              >
                Lưu vào Pallet {activePalletStt}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NHẬP TAY TEM THÙNG ─────────────────────────────── */}
      {isManualLabelModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Nhập Tem Thùng Thủ Công
              </h3>
              <button onClick={() => setIsManualLabelModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Mã LOT *:</label>
                <input
                  type="text"
                  value={manualLabelForm.lot_code}
                  onChange={e => setManualLabelForm({ ...manualLabelForm, lot_code: e.target.value })}
                  placeholder="VD: D009TN08096"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Mã SKU *:</label>
                <input
                  type="text"
                  value={manualLabelForm.sku}
                  onChange={e => setManualLabelForm({ ...manualLabelForm, sku: e.target.value })}
                  placeholder="VD: TP101020104.002"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Tên sản phẩm:</label>
                <input
                  type="text"
                  value={manualLabelForm.product_name}
                  onChange={e => setManualLabelForm({ ...manualLabelForm, product_name: e.target.value })}
                  placeholder="VD: Sầu riêng Dona đông lạnh"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Khối lượng (Kg):</label>
                  <input
                    type="number"
                    value={manualLabelForm.weight}
                    onChange={e => setManualLabelForm({ ...manualLabelForm, weight: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Số thùng tạo:</label>
                  <input
                    type="number"
                    value={labelCount}
                    onChange={e => setLabelCount(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (!manualLabelForm.lot_code) {
                  alert('Vui lòng nhập Mã LOT')
                  return
                }
                handleSaveLabelBox(
                  manualLabelForm,
                  parseFloat(manualLabelForm.weight) || 20,
                  parseInt(labelCount, 10) || 1
                )
                setIsManualLabelModal(false)
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30"
            >
              Lưu Vào Pallet {activePalletStt}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: CHI TIẾT PALLET ───────────────────────────────── */}
      {selectedPallet && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-slate-700 rounded-2xl p-4 flex flex-col max-h-[90vh] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">
                  Chi tiết Pallet: {selectedPallet.stt}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tổng cộng {selectedPalletBoxes.length} thùng · {selectedPalletBoxes.reduce((s, b) => s + b.quantity, 0).toFixed(1)} Kg
                </p>
              </div>
              <button
                onClick={() => setSelectedPallet(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 my-2.5">
              {/* Security status banner */}
              {selectedPallet.is_linked ? (
                <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-2">
                  <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
                  <span>Dữ liệu đã lên Web mẹ an toàn (Không thể xóa/sửa từ app)</span>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                  <span>Pallet đang quét trực tiếp (Chờ duyệt LOT)</span>
                </div>
              )}

              {/* Subtitle with total boxes and weight */}
              <p className="text-xs text-slate-400">
                Tổng cộng {selectedPalletBoxes.length} thùng · {selectedPalletBoxes.reduce((s, b) => s + b.quantity, 0).toFixed(1)} Kg
              </p>

              {/* Warehouse Location Banner (Matching Mobile App) */}
              {selectedPallet.location_code && (
                <div className="px-3 py-2 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center gap-2">
                  <MapPin size={15} className="text-amber-400 shrink-0" />
                  <span>
                    Vị trí kho: <strong className="text-amber-300 font-mono font-black">{selectedPallet.location_code}</strong>
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingDetail ? (
                <div className="py-12 flex justify-center">
                  <Loader2 size={30} className="animate-spin text-emerald-500" />
                </div>
              ) : selectedPalletBoxes.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Chưa có thùng nào trong Pallet này
                </div>
              ) : (
                selectedPalletBoxes.map(b => {
                  const isStamp = b.scan_type === 'stamp' || !!b.stamp_line1 || !!b.stamp_line2
                  return (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-[#1e293b]/70 border border-slate-800 space-y-2 text-xs"
                    >
                      {/* Header row: #Index, SKU, Weight */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black font-mono">
                            #{b.box_index}
                          </span>
                          <span className="font-bold text-slate-300 font-mono text-xs">
                            SKU: {b.sku}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-black font-mono">
                          {b.quantity} {b.unit}
                        </span>
                      </div>

                      {/* Badges for Stamp & Special 12 */}
                      {isStamp && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="bg-[#451a03] border border-amber-600/60 text-amber-400 px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1">
                              📦 DẤU ĐÓNG MỰC
                            </span>
                            {b.is_special_12 && (
                              <span className="bg-[#064e3b] border border-emerald-500/60 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1">
                                ⭐ 12 SỐ ĐẦU TRỌN GÓI
                              </span>
                            )}
                          </div>
                          {b.is_special_12 && (
                            <p className="text-[10px] text-emerald-300 leading-tight">
                              ✓ Khớp quy cách ngoại lệ trọn gói. Đã ẩn phân đoạn 14 số chuẩn để không làm sai lệch thông số đóng gói.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Full Product Name */}
                      <p className="font-bold text-white leading-snug">{b.product_name}</p>

                      {/* Complete 2-Column Details Grid */}
                      {isStamp ? (
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                          <div>
                            <span className="text-slate-500">Mã LOT (Dòng 2):</span> <strong className="font-mono text-slate-200">{b.lot_code}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Quy cách:</span> <span className="text-slate-200">{b.spec || (b.is_special_12 ? 'Hàng có hạt (Hầm đông)' : 'Thùng tiêu chuẩn')}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Nhà máy:</span> <span className="text-slate-200">{b.shift_group || 'Nhà máy Đắk Lắk'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Vùng NL (Tỉnh):</span> <span className="text-slate-200">{b.region || 'Đắk Lắk'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Ngày nhập NL:</span> <strong className="font-mono text-amber-400">{b.raw_material_date || b.production_date || '---'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Ngày ĐG:</span> <strong className="font-mono text-slate-200">{b.packaging_date || '---'}</strong>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-500">Nhà cung cấp:</span> <span className="text-slate-200">{b.supplier_name || (b.supplier ? `Mã NCC ${b.supplier}` : 'Mã NCC 000')}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                          <div>
                            <span className="text-slate-500">Mã LOT:</span> <strong className="font-mono text-slate-200">{b.lot_code}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Quy cách:</span> <span className="text-slate-200">{b.spec || 'Thùng/túi: 20kg'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Tổ/Nhóm:</span> <span className="text-slate-200">{b.shift_group || 'Nguyên'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Vùng NL:</span> <span className="text-slate-200">{b.region || 'Tây Nguyên'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Ngày SX:</span> <strong className="font-mono text-amber-400">{b.production_date}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Ngày ĐG:</span> <strong className="font-mono text-slate-200">{b.packaging_date || b.production_date}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedPallet(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ĐỔI HOẶC TẠO PALLET ───────────────────────────── */}
      {isSwitchPalletModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <RotateCw size={18} className="text-emerald-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  Chọn hoặc Nhập STT Pallet
                </h3>
              </div>
              <button onClick={() => setIsSwitchPalletModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">MÃ STT PALLET MỚI:</label>
                  <input
                    type="text"
                    value={newSttInput}
                    onChange={e => setNewSttInput(e.target.value.toUpperCase())}
                    placeholder="VD: G23, G24, F100..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-sm font-bold text-amber-400 uppercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Chỉ tiêu số thùng (Mặc định: 30):</label>
                  <input
                    type="number"
                    value={newTargetQtyInput}
                    onChange={e => setNewTargetQtyInput(parseInt(e.target.value, 10) || 30)}
                    placeholder="30"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-orange-400 font-bold block mb-1">MÃ PHỤ (TAG):</label>
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value.toUpperCase())}
                    placeholder="Ví dụ: OEM-A, XK-HQ, HÀNG LOẠI 1..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs text-orange-300 uppercase placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-blue-400 font-bold block mb-1">GHI CHÚ PALLET / LOT HÀNG:</label>
                  <textarea
                    rows={2}
                    value={newNotesInput}
                    onChange={e => setNewNotesInput(e.target.value)}
                    placeholder="Nhập ghi chú cho LOT hàng (nếu có)..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 resize-none"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setIsSwitchPalletModal(false)}
                    className="flex-1 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
                  >
                    Đóng
                  </button>
                  <button
                    onClick={() => {
                      if (!newSttInput.trim()) {
                        alert('Vui lòng nhập mã STT Pallet')
                        return
                      }
                      const clean = newSttInput.trim().toUpperCase()
                      handleSwitchToStt(clean, newTagInput.trim(), newNotesInput.trim(), newTargetQtyInput || 30)
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30"
                  >
                    Bắt Đầu Quét
                  </button>
                </div>
              </div>

              {/* Quick Pick from Existing Pallets */}
              {palletsList.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">
                    HOẶC CHỌN TỪ PALLET ĐANG CÓ ({palletsList.length}):
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {palletsList.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          handleSwitchToStt(p.stt, p.tag || '', p.notes || '', 30)
                        }}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition ${
                          p.stt === activePalletStt
                            ? 'bg-emerald-500/10 border-emerald-500 text-white'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-amber-400 text-xs">
                            {p.stt}
                          </span>
                          {p.tag && (
                            <span className="bg-orange-600/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.2 rounded text-[9px] font-bold font-mono">
                              🏷️ {p.tag}
                            </span>
                          )}
                          {p.notes && (
                            <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-1 py-0.2 rounded text-[9px] font-bold" title={p.notes}>
                              📝
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            ({p.boxes_count} thùng · {p.total_weight} Kg)
                          </span>
                        </div>
                        {p.stt === activePalletStt ? (
                          <span className="text-[10px] font-bold text-emerald-400">Đang chọn ✓</span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Chọn →</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
