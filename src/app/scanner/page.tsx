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
  Barcode
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
  packaging_date: string | null
  production_date: string | null
  scan_type: 'label' | 'stamp'
  is_special_12?: boolean
  notes?: string | null
  created_at: string
}

export default function WebScannerPage() {
  const [activeTab, setActiveTab] = useState<'label' | 'stamp' | 'pallets' | 'settings'>('label')
  const [activePalletStt, setActivePalletStt] = useState<string>('G23')
  const [targetQty, setTargetQty] = useState<number>(30)
  const [currentBoxes, setCurrentBoxes] = useState<BoxItem[]>([])
  const [loadingBoxes, setLoadingBoxes] = useState<boolean>(false)
  const [isSwitchPalletModal, setIsSwitchPalletModal] = useState<boolean>(false)
  const [newSttInput, setNewSttInput] = useState<string>('')

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraActive, setCameraActive] = useState<boolean>(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [torchActive, setTorchActive] = useState<boolean>(false)
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false)

  // Label Modal
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

  // Stamp Modal
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

  // Pallet list tab
  const [palletsList, setPalletsList] = useState<PalletItem[]>([])
  const [palletFilter, setPalletFilter] = useState<'all' | 'linked' | 'unlinked'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedPallet, setSelectedPallet] = useState<PalletItem | null>(null)
  const [selectedPalletBoxes, setSelectedPalletBoxes] = useState<BoxItem[]>([])
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)

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

  // ── Offline Stamp Rules State (Match Mobile App) ──────────────
  const [stampRulesCount, setStampRulesCount] = useState<number>(0)
  const [lastStampSync, setLastStampSync] = useState<string | null>(null)
  const [syncingStamp, setSyncingStamp] = useState<boolean>(false)
  const [stampDictMap, setStampDictMap] = useState<Record<string, Record<string, string>>>(DEFAULT_STAMP_DICT)

  // ── Listen to Network Status & Initialize Offline DB ───────────
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

  // ── Load Current Pallet Boxes ──────────────────────────────────
  const loadCurrentPalletBoxes = useCallback(async (stt: string) => {
    if (!stt) return
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
        const mapped = data.map((b: any, idx: number) => {
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

          // Check Special 12 & dictionary lookups (uses live or cached offline dictionary)
          const activeDict = stampDictMap || DEFAULT_STAMP_DICT
          let isSpecial12 = false
          let special12Code = ''
          let special12Name = ''
          const rawL1 = stampLine1 || meta.sku || b.products?.sku || ''
          const c12 = rawL1.replace(/[^0-9]/g, '').slice(0, 12)
          if (c12.length >= 12 && (activeDict.special_12?.[c12] || DEFAULT_STAMP_DICT.special_12?.[c12])) {
            isSpecial12 = true
            special12Code = c12
            special12Name = activeDict.special_12?.[c12] || DEFAULT_STAMP_DICT.special_12[c12]
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
              factory = activeDict.factory?.[fCode] || DEFAULT_STAMP_DICT.factory?.[fCode] || `Nhà máy ${fCode}`
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
              province = activeDict.province?.[pCode] || DEFAULT_STAMP_DICT.province?.[pCode] || `Tỉnh mã ${pCode}`
            }
          }

          if (supplierCode) {
            supplierName = `Mã NCC ${supplierCode}`
          }

          let specVal = meta.spec || ''
          if (isSpecial12 && special12Name) {
            const parts = special12Name.split(' - ').map((s: string) => s.trim())
            specVal = parts.length >= 2 ? `${parts[1]}${parts[2] ? ` (${parts[2]})` : ''}` : 'Ngoại lệ trọn gói'
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
        })

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
        }
      }
    } catch (err) {
      console.warn('Lỗi tải thùng, thử đọc từ hàng đợi offline:', err)
      try {
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
        }
      } catch {}
    } finally {
      setLoadingBoxes(false)
    }
  }, [])

  useEffect(() => {
    loadCurrentPalletBoxes(activePalletStt)
  }, [activePalletStt, loadCurrentPalletBoxes])

  // ── Camera Initialization ─────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraActive(true)
      }
    } catch (err: any) {
      console.error('Lỗi khởi động camera:', err)
      setCameraError('Không thể mở Camera. Vui lòng cho phép quyền Camera trên Safari/Chrome hoặc dùng chức năng Nhập Số.')
      setCameraActive(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
      setCameraActive(false)
      setTorchActive(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'label' || activeTab === 'stamp') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [activeTab, startCamera, stopCamera])

  // Toggle Torch if supported
  const handleToggleTorch = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return
    try {
      const stream = videoRef.current.srcObject as MediaStream
      const track = stream.getVideoTracks()[0]
      const caps = (track as any).getCapabilities ? (track as any).getCapabilities() : {}
      if (caps && caps.torch) {
        await (track as any).applyConstraints({
          advanced: [{ torch: !torchActive }]
        })
        setTorchActive(!torchActive)
      } else {
        triggerToast('Thiết bị này không hỗ trợ bật đèn Flash từ trình duyệt')
      }
    } catch {
      triggerToast('Không thể bật đèn Flash')
    }
  }

  // ── Capture Photo & Process OCR ───────────────────────────────
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

  const handleCaptureAndRecognize = async () => {
    const base64 = captureFrame()
    if (!base64) {
      triggerToast('Không thể lấy khung hình Camera')
      return
    }

    setIsRecognizing(true)
    try {
      const mode = activeTab === 'stamp' ? 'stamp' : 'label'
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mode })
      })

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
      triggerToast(`Lỗi OCR: ${err.message || 'Không đọc được văn bản'}`)
    } finally {
      setIsRecognizing(false)
    }
  }

  // ── Save Stamp Box to Supabase ────────────────────────────────
  const handleSaveStampBox = async () => {
    if (!pendingStamp) return
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
          metadata: {
            pallet_stt: cleanStt,
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

      // If device is offline, save directly to IndexedDB pending queue
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
        return
      }

      const { error } = await supabase.from('box_labels').insert(rowsToInsert as any)
      if (error) {
        // Fallback to offline storage if network fails
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
    } catch (err: any) {
      console.warn('Exception khi lưu thùng, chuyển sang lưu offline:', err)
      try {
        const l1 = pendingStamp.stamp_line1.trim()
        const l2 = pendingStamp.stamp_line2.trim()
        const dec = decodeStampBox({ metadata: { scan_type: 'stamp', stamp_line1: l1, stamp_line2: l2 } }, stampDictMap)
        await saveBoxesOffline(
          [],
          cleanStt,
          l2,
          dec.productTitle || 'Sản phẩm đóng dấu',
          dec.code || 'SKU',
          count,
          'stamp'
        )
      } catch {}
    }
  }

  // ── Save Label Box to Supabase ────────────────────────────────
  const handleSaveLabelBox = async (labelData: any, w: number, count: number) => {
    const cleanStt = activePalletStt.trim().toUpperCase()
    try {
      let startIdx = parseInt(labelData.box_index, 10) || 1
      if (currentBoxes.length > 0) {
        const maxIdx = Math.max(...currentBoxes.map(b => parseInt(b.box_index, 10) || 0))
        if (startIdx <= maxIdx) startIdx = maxIdx + 1
      }

      const rowsToInsert = []
      for (let i = 0; i < count; i++) {
        const idx = startIdx + i
        const boxCode = `BOX-${labelData.sku || 'SKU'}-${cleanStt}-${String(idx).padStart(3, '0')}`
        rowsToInsert.push({
          code: boxCode,
          quantity: w,
          unit: 'Kg',
          semi_finished_lot_code: labelData.lot_code,
          finished_lot_code: labelData.lot_code,
          metadata: {
            pallet_stt: cleanStt,
            scan_type: 'label',
            box_index: idx,
            sku: labelData.sku,
            lot_code: labelData.lot_code,
            product_name: labelData.product_name,
            spec: labelData.spec,
            shift_group: labelData.shift_group,
            region: labelData.region,
            production_date: labelData.production_date,
            packaging_date: labelData.packaging_date
          }
        })
      }

      // If device is offline, save directly to IndexedDB pending queue
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await saveBoxesOffline(
          rowsToInsert,
          cleanStt,
          labelData.lot_code,
          labelData.product_name || 'Hàng tem thùng',
          labelData.sku || 'SKU',
          count,
          'label'
        )
        setPendingLabel(null)
        setIsManualLabelModal(false)
        return
      }

      const { error } = await supabase.from('box_labels').insert(rowsToInsert as any)
      if (error) {
        console.warn('Lỗi mạng khi lưu tem, tự động chuyển sang lưu offline:', error.message)
        await saveBoxesOffline(
          rowsToInsert,
          cleanStt,
          labelData.lot_code,
          labelData.product_name || 'Hàng tem thùng',
          labelData.sku || 'SKU',
          count,
          'label'
        )
      } else {
        triggerToast(`✅ Đã lưu ${count} thùng tem vào Pallet ${cleanStt}!`)
        loadCurrentPalletBoxes(cleanStt)
      }

      setPendingLabel(null)
      setIsManualLabelModal(false)
    } catch (err: any) {
      console.warn('Lỗi lưu tem, chuyển sang lưu offline:', err)
      await saveBoxesOffline(
        [],
        cleanStt,
        labelData.lot_code,
        labelData.product_name || 'Hàng tem thùng',
        labelData.sku || 'SKU',
        count,
        'label'
      )
      setPendingLabel(null)
      setIsManualLabelModal(false)
    }
  }

  // ── Delete Box ────────────────────────────────────────────────
  const handleDeleteBox = async (boxId: string) => {
    if (!confirm('Bạn có chắc muốn xóa thùng này khỏi Pallet không?')) return
    try {
      const { error } = await supabase.from('box_labels').delete().eq('id', boxId)
      if (error) throw error
      triggerToast('Đã xóa thùng thành công')
      loadCurrentPalletBoxes(activePalletStt)
    } catch (err: any) {
      alert(`Lỗi xóa thùng: ${err.message}`)
    }
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
          metadata,
          products ( name, sku ),
          box_labels!inner ( id, code, quantity, metadata )
        `)
        .eq('system_code', systemCode)
        .order('created_at', { ascending: false })

      // 2. Unlinked Boxes
      const { data: unlinkedData } = await supabase
        .from('box_labels')
        .select(`
          id,
          code,
          quantity,
          metadata,
          created_at,
          products ( name, sku )
        `)
        .is('lot_id', null)
        .order('created_at', { ascending: false })

      const list: PalletItem[] = []
      const seen = new Set<string>()

      ;(lotsData || []).forEach((l: any) => {
        const decoded = decodeSTT(l.daily_seq)
        const stt = decoded || l.metadata?.created_from_pallet_stt || l.code
        if (!stt) return

        const boxes = l.box_labels || []
        const totalWeight = boxes.length > 0
          ? boxes.reduce((sum: number, b: any) => sum + (Number(b.quantity) || 0), 0)
          : (Number(l.quantity) * 20)

        const isStamp = boxes.some((b: any) =>
          b.metadata?.scan_type === 'stamp' || !!b.metadata?.stamp_line1 || (b.code && b.code.startsWith('STAMP-'))
        )

        const firstMeta = boxes[0]?.metadata || {}
        const isSpecial12 = !!(firstMeta.is_special_12 || (firstMeta.sku && (stampDictMap.special_12?.[firstMeta.sku.slice(0, 12)] || DEFAULT_STAMP_DICT.special_12?.[firstMeta.sku.slice(0, 12)])))

        list.push({
          id: l.id,
          stt: stt.trim().toUpperCase(),
          lot_id: l.id,
          lot_code: l.code,
          boxes_count: boxes.length > 0 ? boxes.length : (Number(l.quantity) || 0),
          total_weight: totalWeight,
          is_linked: true,
          product_name: l.products?.name || firstMeta.product_name || 'Hàng đông lạnh',
          sku: l.products?.sku || firstMeta.sku || 'SKU',
          packaging_date: l.packaging_date || firstMeta.packaging_date || null,
          production_date: l.peeling_date || firstMeta.production_date || null,
          scan_type: isStamp ? 'stamp' : 'label',
          is_special_12: isSpecial12,
          notes: l.metadata?.notes || null,
          created_at: l.created_at
        })
        seen.add(stt.trim().toUpperCase())
      })

      const unlinkedMap = new Map<string, any[]>()
      ;(unlinkedData || []).forEach((b: any) => {
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
          packaging_date: firstMeta.packaging_date || null,
          production_date: firstMeta.production_date || null,
          scan_type: isStamp ? 'stamp' : 'label',
          is_special_12: isSpecial12,
          created_at: boxes[0]?.created_at || new Date().toISOString()
        })
      })

      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setPalletsList(list)
      // Save snapshot to IndexedDB for offline viewing
      savePalletsToOfflineDb(list as any).catch(e => console.warn('Lỗi lưu cache pallet:', e))
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
  }, [systemCode])

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
        const mapped = data.map((b: any, idx: number) => {
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

          const activeDict = stampDictMap || DEFAULT_STAMP_DICT
          let isSpecial12 = false
          let special12Code = ''
          let special12Name = ''
          const rawL1 = stampLine1 || meta.sku || b.products?.sku || ''
          const c12 = rawL1.replace(/[^0-9]/g, '').slice(0, 12)
          if (c12.length >= 12 && (activeDict.special_12?.[c12] || DEFAULT_STAMP_DICT.special_12?.[c12])) {
            isSpecial12 = true
            special12Code = c12
            special12Name = activeDict.special_12?.[c12] || DEFAULT_STAMP_DICT.special_12[c12]
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
              factory = activeDict.factory?.[fCode] || DEFAULT_STAMP_DICT.factory?.[fCode] || `Nhà máy ${fCode}`
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
              province = activeDict.province?.[pCode] || DEFAULT_STAMP_DICT.province?.[pCode] || `Tỉnh mã ${pCode}`
            }
          }

          if (supplierCode) supplierName = `Mã NCC ${supplierCode}`

          let specVal = meta.spec || ''
          if (isSpecial12 && special12Name) {
            const parts = special12Name.split(' - ').map((s: string) => s.trim())
            specVal = parts.length >= 2 ? `${parts[1]}${parts[2] ? ` (${parts[2]})` : ''}` : 'Ngoại lệ trọn gói'
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
        })

        mapped.sort((a: BoxItem, b: BoxItem) => (parseInt(a.box_index, 10) || 0) - (parseInt(b.box_index, 10) || 0))
        setSelectedPalletBoxes(mapped)
      }
    } catch (err) {
      console.warn('Lỗi tải chi tiết pallet:', err)
    } finally {
      setLoadingDetail(false)
    }
  }

  // ── Sync Stamp Rules Offline Handler (Match Mobile App) ───────
  const handleSyncStampRules = async () => {
    if (!navigator.onLine) {
      alert('Thiết bị đang không có kết nối Internet. Vui lòng kết nối Wifi hoặc 4G để tải quy tắc!')
      return
    }

    setSyncingStamp(true)
    try {
      const { data, error } = await supabase
        .from('stamp_dictionaries')
        .select('category, code, name, description, sort_order')
        .eq('is_active', true)

      if (error) throw error

      if (!data || data.length === 0) {
        alert('Máy chủ chưa có quy tắc dấu đóng nào được kích hoạt.')
        return
      }

      // Merge with default dictionary
      const mergedMap: Record<string, Record<string, string>> = JSON.parse(JSON.stringify(DEFAULT_STAMP_DICT))
      data.forEach((item: any) => {
        if (!item.category || !item.code || !item.name) return
        const cat = item.category.trim()
        const code = item.code.trim().toUpperCase()
        if (!mergedMap[cat]) mergedMap[cat] = {}
        mergedMap[cat][code] = item.name.trim()
      })

      // Đồng bộ cấu hình mẫu định dạng dấu đóng động
      try {
        const { data: formatsData } = await supabase
          .from('stamp_formats')
          .select('*')
          .eq('is_active', true)
        if (formatsData && formatsData.length > 0) {
          localStorage.setItem('cached_stamp_formats', JSON.stringify(formatsData))
        }
      } catch (fmtErr) {
        console.warn('Lỗi tải stamp_formats:', fmtErr)
      }

      const now = new Date().toISOString()
      localStorage.setItem('cached_stamp_dictionaries', JSON.stringify(mergedMap))
      localStorage.setItem('cached_stamp_rules_count', String(data.length))
      localStorage.setItem('last_stamp_sync_time', now)

      setStampDictMap(mergedMap)
      setStampRulesCount(data.length)
      setLastStampSync(now)

      triggerToast(`✅ Đã đồng bộ thành công ${data.length} quy tắc và mẫu định dạng từ Web mẹ!`)
    } catch (err: any) {
      console.error('Lỗi syncStampRules:', err)
      alert('Lỗi tải quy tắc từ máy chủ: ' + (err.message || 'Không thể kết nối'))
    } finally {
      setSyncingStamp(false)
    }
  }

  // ── Sync LOTs Offline Handler ──────────────────────────────────
  const handleSyncLotsOffline = async () => {
    if (!navigator.onLine) {
      alert('Thiết bị đang không có kết nối Internet. Vui lòng kết nối Wifi hoặc 4G để tải LOT!')
      return
    }

    setIsSyncingLots(true)
    try {
      // 1. Tải toàn bộ Pallet/LOT trên Cloud về máy (khớp 100% logic fetchCloudPallets của app Android)
      const list = await loadAllPallets()
      const palletCount = list?.length || 0

      // 2. Tải danh mục LOT để tra cứu tìm kiếm nhanh
      try {
        const { data: lotsData } = await supabase
          .from('lots')
          .select(`
            id,
            code,
            quantity,
            status,
            created_at,
            metadata,
            products ( name, sku )
          `)
          .order('created_at', { ascending: false })
          .limit(3000)

        if (lotsData && lotsData.length > 0) {
          const mappedLots: OfflineLot[] = lotsData.map((l: any) => ({
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
      } catch (lotErr) {
        console.warn('Lỗi lưu LOT store, tiếp tục:', lotErr)
      }

      // 3. Tải danh mục sản phẩm & aliases gợi ý gõ tắt (fetchProductsForSuggestions)
      try {
        const { data: prods } = await supabase
          .from('products')
          .select('id, name, sku, aliases')
          .order('name')
          .limit(1000)

        if (prods && prods.length > 0) {
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

    for (const item of pendingPallets) {
      try {
        await updatePendingPalletStatus(item.client_id, 'syncing')

        const rows = item.boxes.map((b, idx) => ({
          code: b.code,
          quantity: b.weight,
          unit: 'Kg',
          semi_finished_lot_code: item.lot_code,
          finished_lot_code: item.lot_code,
          metadata: {
            pallet_stt: item.stt,
            box_index: idx + 1,
            sku: item.sku,
            product_name: item.product_name,
            lot_code: item.lot_code,
            offline_synced_at: new Date().toISOString()
          }
        }))

        const { error } = await supabase.from('box_labels').insert(rows as any)
        if (error) throw error

        await removePendingPallet(item.client_id)
        successCount++
      } catch (err: any) {
        console.warn('Lỗi sync pallet:', item.stt, err)
        await updatePendingPalletStatus(item.client_id, 'failed', err.message)
        failCount++
      }
    }

    const updatedPending = await getPendingPallets()
    setPendingPallets(updatedPending)
    setIsSyncingPending(false)

    if (successCount > 0) {
      triggerToast(`✅ Đã đồng bộ thành công ${successCount} Pallet lên máy chủ!`)
      loadAllPallets()
      loadCurrentPalletBoxes(activePalletStt)
    }
    if (failCount > 0) {
      alert(`Có ${failCount} pallet chưa đồng bộ được, sẽ thử lại khi mạng ổn định hơn.`)
    }
  }

  // Filtered pallets & Lazy Pagination (prevents lag even with 10,000 pallets)
  const [palletDisplayLimit, setPalletDisplayLimit] = useState<number>(30)

  useEffect(() => {
    setPalletDisplayLimit(30)
  }, [palletFilter, searchQuery])

  const filteredPallets = useMemo(() => {
    return palletsList.filter(p => {
      if (palletFilter === 'linked' && !p.is_linked) return false
      if (palletFilter === 'unlinked' && p.is_linked) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchStt = p.stt.toLowerCase().includes(q)
        const matchProduct = (p.product_name || '').toLowerCase().includes(q)
        const matchLot = (p.lot_code || '').toLowerCase().includes(q)
        if (!matchStt && !matchProduct && !matchLot) return false
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
      {/* ── TOP HEADER (Match Mobile App topBar) ────────────────── */}
      <header className="shrink-0 bg-[#0f172a] border-b border-slate-800/90 px-3 py-2 z-20 shadow-md">
        <div className="flex items-center justify-between gap-2">
          {/* Pallet STT Selector Button */}
          <button
            onClick={() => {
              setNewSttInput(activePalletStt)
              setIsSwitchPalletModal(true)
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-left transition active:scale-[0.98] min-w-0"
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
              STT: <strong className="text-amber-400">{activePalletStt || '---'}</strong>
            </span>
            <ChevronRight size={13} className="text-slate-400 shrink-0" />
          </button>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Sync Pending Badge if any */}
            {pendingPallets.length > 0 && (
              <button
                onClick={handleSyncPendingQueue}
                disabled={isSyncingPending || !isOnline}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-bold"
                title="Đồng bộ Pallet ngoại tuyến"
              >
                <RefreshCw size={11} className={isSyncingPending ? 'animate-spin' : ''} />
                <span>{pendingPallets.length}</span>
              </button>
            )}

            {/* Flash button */}
            <button
              onClick={handleToggleTorch}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition active:scale-95 ${
                torchActive 
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
              }`}
              title="Bật/tắt đèn Flash"
            >
              {torchActive ? <Zap size={16} /> : <ZapOff size={16} />}
            </button>

            {/* Manual input shortcut */}
            <button
              onClick={() => {
                if (activeTab === 'stamp') {
                  setManualStampLine1('')
                  setManualStampLine2('')
                  setIsManualStampModal(true)
                } else {
                  setIsManualLabelModal(true)
                }
              }}
              className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition"
              title="Nhập số tay"
            >
              <Tag size={16} />
            </button>

            {/* Switch Pallet */}
            <button
              onClick={() => {
                setNewSttInput(activePalletStt)
                setIsSwitchPalletModal(true)
              }}
              className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 text-emerald-400 hover:text-emerald-300 flex items-center justify-center active:scale-95 transition"
              title="Đổi STT Pallet"
            >
              <RotateCw size={16} />
            </button>
          </div>
        </div>

        {/* Progress Bar (Matching Android app) */}
        <div className="mt-1.5 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              Tiến độ: <strong className={activeTab === 'stamp' ? 'text-amber-400' : 'text-emerald-400'}>{currentBoxes.length}</strong> / {targetQty} thùng
            </span>
            <span className="text-slate-400">
              Tổng: <strong className="text-white font-mono">{currentTotalWeight}</strong> Kg
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
      </header>

      {/* ── TOAST ALERT ─────────────────────────────────────────── */}
      {toastMessage && (
        <div className="absolute top-20 left-3 right-3 z-50 p-3 rounded-xl bg-slate-900/95 border border-emerald-500/50 text-white shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ── TAB CONTENT ─────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
        {/* TAB 1: QUÉT TEM (BARCODE / LABEL OCR) */}
        {activeTab === 'label' && (
          <div className="flex-1 min-h-0 flex flex-col relative bg-black">
            {/* Live Camera Viewfinder */}
            <div className="flex-1 min-h-0 relative overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />

              {/* Reticle Guideline */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                {/* Reticle Header Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/85 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold mb-3 shadow-lg">
                  <Scan size={14} className="text-emerald-400" />
                  <span>Đặt khung tem thùng vào đây</span>
                </div>

                <div className="w-[88%] max-w-[320px] aspect-[4/3] border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_25px_rgba(16,185,129,0.25)] flex items-center justify-center bg-emerald-500/5">
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>
                </div>

                <p className="text-[11px] text-slate-300 mt-3 px-3 py-1 rounded-xl bg-slate-900/80 backdrop-blur-xs text-center">
                  Chụp rõ nét · Giữ thẳng góc và đủ ánh sáng
                </p>
              </div>

              {cameraError && (
                <div className="absolute inset-x-4 top-4 p-3 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs shadow-xl">
                  {cameraError}
                </div>
              )}

              {isRecognizing && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
                  <Loader2 size={36} className="text-emerald-400 animate-spin" />
                  <p className="text-sm font-bold text-white tracking-wide">Đang đọc chữ trên tem thùng...</p>
                </div>
              )}
            </div>

            {/* Quick Clone Banner if boxes > 0 */}
            {currentBoxes.length > 0 && currentBoxes.length < targetQty && (
              <button
                onClick={() => {
                  const lastBox = currentBoxes[currentBoxes.length - 1]
                  setLabelWeight(String(lastBox.quantity || 20))
                  setLabelCount(String(targetQty - currentBoxes.length))
                  setPendingLabel({
                    sku: lastBox.sku,
                    lot_code: lastBox.lot_code,
                    product_name: lastBox.product_name,
                    spec: lastBox.spec,
                    shift_group: lastBox.shift_group,
                    region: lastBox.region,
                    production_date: lastBox.production_date,
                    packaging_date: lastBox.packaging_date,
                    weight: lastBox.quantity
                  })
                }}
                className="shrink-0 bg-emerald-950/80 border-t border-emerald-500/30 px-3 py-2 flex items-center justify-between text-[11px] text-emerald-300 hover:text-emerald-200 transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Copy size={13} className="text-emerald-400 shrink-0" />
                  <span className="truncate">⚡ Nhân bản thùng #{currentBoxes[currentBoxes.length - 1].box_index} cho {targetQty - currentBoxes.length} thùng còn lại</span>
                </div>
                <ChevronRight size={14} className="text-emerald-400 shrink-0 ml-1" />
              </button>
            )}

            {/* Bottom Controls Bar (Trigger row matching Android app) */}
            <div className="shrink-0 bg-[#0f172a] border-t border-slate-800/90 px-6 py-2.5 flex items-center justify-around z-10">
              <button
                onClick={() => setIsManualLabelModal(true)}
                className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition active:scale-95 w-16"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <Tag size={18} />
                </div>
                <span className="text-[11px] font-bold">Nhập Tay</span>
              </button>

              <button
                onClick={handleCaptureAndRecognize}
                disabled={isRecognizing}
                className="w-16 h-16 rounded-full bg-emerald-500 border-4 border-slate-900 shadow-[0_0_25px_rgba(16,185,129,0.5)] flex items-center justify-center text-slate-950 active:scale-95 transition hover:bg-emerald-400"
              >
                {isRecognizing ? (
                  <Loader2 size={28} className="animate-spin text-slate-950" />
                ) : (
                  <Camera size={30} className="stroke-[2.5]" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('pallets')}
                className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition active:scale-95 w-16"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <Boxes size={18} />
                </div>
                <span className="text-[11px] font-bold">Pallet ({currentBoxes.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: DẤU ĐÓNG (INK STAMP OCR & MANUAL) */}
        {activeTab === 'stamp' && (
          <div className="flex-1 min-h-0 flex flex-col relative bg-black">
            {/* Live Camera Viewfinder */}
            <div className="flex-1 min-h-0 relative overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />

              {/* Dual-line Reticle Guideline for Stamp (Matching Android Reticle) */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                {/* Reticle Header Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/85 border border-amber-500/40 text-amber-300 text-[11px] font-bold mb-3 shadow-lg">
                  <Scan size={14} className="text-amber-400" />
                  <span>Đặt 2 dòng dấu mực vào khung dưới</span>
                </div>

                <div className="w-[90%] max-w-[340px] aspect-[16/9] border-2 border-amber-400/80 rounded-2xl relative shadow-[0_0_25px_rgba(245,158,11,0.25)] flex flex-col justify-between p-3 bg-amber-400/5">
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-400 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-400 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br-lg"></div>

                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                    <span className="text-[10px] font-black uppercase text-amber-300 bg-slate-900/80 px-2 py-0.5 rounded">DÒNG 1</span>
                    <span className="text-[10px] font-mono text-slate-200">102010402001-0 (14 số)</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-amber-500/30 pt-2">
                    <span className="text-[10px] font-black uppercase text-emerald-300 bg-slate-900/80 px-2 py-0.5 rounded">DÒNG 2</span>
                    <span className="text-[10px] font-mono text-slate-200">2151014102600066 (16 số)</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 mt-3 px-3 py-1 rounded-xl bg-slate-900/80 backdrop-blur-xs text-center">
                  Chụp rõ nét · Giữ thẳng góc và đủ ánh sáng
                </p>
              </div>

              {isRecognizing && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
                  <Loader2 size={36} className="text-amber-400 animate-spin" />
                  <p className="text-sm font-bold text-white tracking-wide">Đang đọc dãy số con dấu...</p>
                </div>
              )}
            </div>

            {/* Quick Clone Banner if boxes > 0 */}
            {currentBoxes.length > 0 && currentBoxes.length < targetQty && (
              <button
                onClick={() => {
                  const lastBox = currentBoxes[currentBoxes.length - 1]
                  setStampWeight(String(lastBox.quantity || 20))
                  setStampCount(String(targetQty - currentBoxes.length))
                  setPendingStamp({
                    stamp_line1: lastBox.stamp_line1 || lastBox.sku || '',
                    stamp_line2: lastBox.stamp_line2 || lastBox.lot_code || '',
                    decoded: decodeStampBox({
                      metadata: {
                        scan_type: 'stamp',
                        stamp_line1: lastBox.stamp_line1 || lastBox.sku,
                        stamp_line2: lastBox.stamp_line2 || lastBox.lot_code
                      }
                    }, stampDictMap)
                  })
                }}
                className="shrink-0 bg-amber-950/80 border-t border-amber-500/30 px-3 py-2 flex items-center justify-between text-[11px] text-amber-300 hover:text-amber-200 transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Copy size={13} className="text-amber-400 shrink-0" />
                  <span className="truncate">⚡ Nhân bản thùng #{currentBoxes[currentBoxes.length - 1].box_index} cho {targetQty - currentBoxes.length} thùng còn lại</span>
                </div>
                <ChevronRight size={14} className="text-amber-400 shrink-0 ml-1" />
              </button>
            )}

            {/* Bottom Controls Bar (Trigger row matching Android app) */}
            <div className="shrink-0 bg-[#0f172a] border-t border-slate-800/90 px-6 py-2.5 flex items-center justify-around z-10">
              <button
                onClick={() => {
                  setManualStampLine1('')
                  setManualStampLine2('')
                  setIsManualStampModal(true)
                }}
                className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition active:scale-95 w-16"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <Fingerprint size={18} />
                </div>
                <span className="text-[11px] font-bold">Nhập Số</span>
              </button>

              <button
                onClick={handleCaptureAndRecognize}
                disabled={isRecognizing}
                className="w-16 h-16 rounded-full bg-amber-500 border-4 border-slate-900 shadow-[0_0_25px_rgba(245,158,11,0.5)] flex items-center justify-center text-slate-950 active:scale-95 transition hover:bg-amber-400"
              >
                {isRecognizing ? (
                  <Loader2 size={28} className="animate-spin text-slate-950" />
                ) : (
                  <Camera size={30} className="stroke-[2.5]" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('pallets')}
                className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition active:scale-95 w-16"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <Boxes size={18} />
                </div>
                <span className="text-[11px] font-bold">Pallet ({currentBoxes.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: PALLET KHO (LIST & DETAILS) */}
        {activeTab === 'pallets' && (
          <div className="flex-1 flex flex-col bg-[#0b0f19] overflow-hidden">
            {/* Toolbar */}
            <div className="p-3 border-b border-slate-800 bg-[#0f172a] space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm STT, LOT, sản phẩm..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <button
                  onClick={loadAllPallets}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* Sub-tabs Filter */}
              <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                <button
                  onClick={() => setPalletFilter('all')}
                  className={`flex-1 py-1 text-[11px] font-bold rounded-md transition ${palletFilter === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
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
                  className={`flex-1 py-1 text-[11px] font-bold rounded-md transition ${palletFilter === 'linked' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                >
                  Đã duyệt LOT
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredPallets.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <Boxes size={36} className="mx-auto text-slate-600" />
                  <p className="text-xs">Không tìm thấy Pallet nào khớp với bộ lọc</p>
                </div>
              ) : (
                <>
                  {displayedPallets.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleOpenPalletDetail(p)}
                      className="p-3 rounded-xl bg-[#111827] border border-slate-800 hover:border-slate-700 transition cursor-pointer active:scale-[0.99] space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black font-mono">
                            STT: {p.stt}
                          </span>
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
                        <span className="text-[10px] text-slate-400 font-mono">
                          {p.boxes_count} thùng
                        </span>
                      </div>

                      {p.is_special_12 && (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black">
                          ⭐ 12 SỐ ĐẦU TRỌN GÓI
                        </span>
                      )}

                      <p className="text-xs font-bold text-white leading-snug line-clamp-2">
                        {p.product_name}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                        <span>
                          {p.scan_type === 'stamp' ? '📅 Nhập NL: ' : '📅 NSX: '}
                          <strong className="text-amber-400 font-mono">{p.production_date || '---'}</strong>
                        </span>
                        {p.packaging_date && (
                          <span>
                            📦 Đóng gói: <strong className="text-slate-200 font-mono">{p.packaging_date}</strong>
                          </span>
                        )}
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
            </div>
          </div>
        )}

        {/* TAB 4: CÀI ĐẶT (SETTINGS & IOS GUIDE) */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto bg-[#0b0f19] p-4 space-y-4">
            <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                ⚙️ Cấu Hình Máy Quét Di Động
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

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-300">Âm thanh khi quét thành công:</span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-lg border transition ${soundEnabled ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                >
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              </div>
            </div>

            {/* ── SECTION: OFFLINE STAMP RULES SYNC (Match Mobile App) ── */}
            <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Barcode size={18} className="text-purple-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-purple-400">
                    Quy Tắc Giải Mã Dấu Đóng (Offline)
                  </h3>
                </div>
                <span className="text-xs font-black text-sky-400 font-mono">
                  {stampRulesCount} quy tắc
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Dữ liệu này được lưu trong bộ nhớ máy để tự động giải mã 2 dòng dấu đóng ngay cả khi không có mạng wifi trong kho lạnh.
              </p>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Số quy tắc trong máy:</span>
                  <span className="text-sky-400 font-mono font-bold">{stampRulesCount} quy tắc</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Cập nhật lần cuối:</span>
                  <span className="text-slate-300 font-mono text-[10px] italic">
                    {lastStampSync ? new Date(lastStampSync).toLocaleString('vi-VN') : 'Dữ liệu mặc định'}
                  </span>
                </div>
              </div>

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

            {/* ── SECTION: OFFLINE LOT DATA SYNC (Match Mobile App) ── */}
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

              <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
                <span>Lần đồng bộ cuối:</span>
                <strong className="text-slate-300 font-mono">
                  {lastLotsSync ? new Date(lastLotsSync).toLocaleString('vi-VN') : 'Chưa tải về'}
                </strong>
              </div>

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

            {/* ── SECTION: OFFLINE PENDING PALLETS QUEUE ──────────── */}
            <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive size={18} className="text-amber-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    Hàng Đợi Pallet Ngoại Tuyến
                  </h3>
                </div>
                <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-full ${pendingPallets.length > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
                  {pendingPallets.length} chờ
                </span>
              </div>

              {pendingPallets.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center text-[11px] text-slate-500">
                  ✓ Tất cả dữ liệu Pallet đã được đồng bộ an toàn lên Server!
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {pendingPallets.map(item => (
                      <div
                        key={item.client_id}
                        className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-amber-400 text-xs">
                              Pallet {item.stt}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              · {item.boxes_count} thùng
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            LOT: {item.lot_code || '---'} • {new Date(item.created_at).toLocaleTimeString('vi-VN')}
                          </p>
                        </div>
                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          Chờ đồng bộ
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleSyncPendingQueue}
                    disabled={isSyncingPending || !isOnline}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 active:scale-[0.98]"
                  >
                    {isSyncingPending ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Đang đồng bộ lên máy chủ...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={15} />
                        <span>Đồng bộ tất cả lên Server ({pendingPallets.length})</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* iOS PWA Installation Guide (Crucial for iOS users) */}
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
                  Bấm vào biểu tượng <strong>Chia sẻ (Share)</strong> ở thanh dưới cùng của Safari (hình ô vuông có mũi tên trỏ lên <Share2 size={12} className="inline text-blue-400" />).
                </li>
                <li>
                  Cuộn xuống chọn <strong>&quot;Thêm vào MH chính&quot; (Add to Home Screen)</strong> ➔ Bấm <strong>Thêm (Add)</strong>.
                </li>
              </ol>

              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-[11px] text-indigo-200">
                ✨ Biểu tượng <strong>CT Scanner</strong> sẽ xuất hiện trên màn hình chính iPhone. Mở lên sẽ chạy toàn màn hình, mượt mà như app tải từ App Store!
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-500 pt-2">
              Phiên bản Web Mobile v1.0.23 • Chánh Thu Warehouse System
            </div>
          </div>
        )}
      </main>

      {/* ── BOTTOM NAVIGATION BAR ───────────────────────────────── */}
      <nav className="shrink-0 bg-[#0f172a] border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around z-20">
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
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition ${activeTab === 'pallets' ? 'text-blue-400 bg-blue-500/10 font-bold' : 'text-slate-400'}`}
        >
          <Boxes size={18} />
          <span className="text-[10px]">Pallet Kho</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition ${activeTab === 'settings' ? 'text-purple-400 bg-purple-500/10 font-bold' : 'text-slate-400'}`}
        >
          <Settings size={18} />
          <span className="text-[10px]">Cài Đặt</span>
        </button>
      </nav>

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
                    const dec = decodeStampBox({ metadata: { scan_type: 'stamp', stamp_line1: val, stamp_line2: pendingStamp.stamp_line2 } })
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
                    const dec = decodeStampBox({ metadata: { scan_type: 'stamp', stamp_line1: pendingStamp.stamp_line1, stamp_line2: val } })
                    setPendingStamp({ ...pendingStamp, stamp_line2: val, decoded: dec })
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
                <span className="text-[9px] text-slate-500 font-mono">{pendingStamp.stamp_line2.length} ký tự</span>
              </div>
            </div>

            {/* Giải mã tiếng Việt theo thời gian thực */}
            {(() => {
              const dec = pendingStamp.decoded || decodeStampBox({
                metadata: { scan_type: 'stamp', stamp_line1: pendingStamp.stamp_line1, stamp_line2: pendingStamp.stamp_line2 }
              })

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

                  {dec.isSpecial12 && (
                    <p className="text-[10px] text-emerald-400/90 leading-tight">
                      ✓ Khớp quy cách ngoại lệ trọn gói. Đã ẩn phân đoạn 14 số chuẩn để không làm sai lệch thông số đóng gói.
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Nhà máy:</span>
                      <strong className="text-slate-200">{dec.factoryName || '---'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Vùng NL (Tỉnh):</span>
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
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-[10px]">Nhà cung cấp:</span>
                      <strong className="text-slate-200">{dec.supplierName || (dec.supplierCode ? `Mã NCC ${dec.supplierCode}` : 'Mã NCC 000')}</strong>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Weight & Multiply Count */}
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
                <label className="text-[10px] text-slate-400 block mb-1">Số thùng nhân bản:</label>
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
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30"
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
              <div>
                <span className="text-slate-400 block text-[10px]">Tổ / Nhóm:</span>
                <input
                  type="text"
                  value={pendingLabel.shift_group}
                  onChange={e => setPendingLabel({ ...pendingLabel, shift_group: e.target.value })}
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Vùng NL:</span>
                <input
                  type="text"
                  value={pendingLabel.region}
                  onChange={e => setPendingLabel({ ...pendingLabel, region: e.target.value })}
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white"
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
                <label className="text-[10px] text-slate-400 block mb-1">Số thùng nhân bản:</label>
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

      {/* ── MODAL: CHI TIẾT PALLET (MATCH IMAGE 2) ──────────────── */}
      {selectedPallet && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-slate-700 rounded-2xl p-4 flex flex-col max-h-[90vh] shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">
                  Chi tiết Pallet: {selectedPallet.stt}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tổng cộng {selectedPalletBoxes.length} thùng · {selectedPalletBoxes.reduce((s, b) => s + b.quantity, 0)} Kg
                </p>
              </div>
              <button
                onClick={() => setSelectedPallet(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Status Badge */}
            <div className="my-3">
              {selectedPallet.is_linked ? (
                <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  <span>Dữ liệu đã lên Web mẹ an toàn (Không thể xóa/sửa từ app)</span>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                  <span>Pallet đang quét trực tiếp (Chờ duyệt LOT)</span>
                </div>
              )}
            </div>

            {/* Boxes List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {loadingDetail ? (
                <div className="py-12 flex justify-center">
                  <Loader2 size={30} className="animate-spin text-emerald-500" />
                </div>
              ) : selectedPalletBoxes.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Chưa có thùng nào trong Pallet này
                </div>
              ) : (
                selectedPalletBoxes.map((b, idx) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-[#1e293b]/70 border border-slate-800 space-y-2 shadow-xs"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black font-mono">
                          #{b.box_index}
                        </span>
                        <span className="text-[11px] font-bold text-slate-300 font-mono">
                          SKU: {b.sku}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-black font-mono">
                        {b.quantity} {b.unit}
                      </span>
                    </div>

                    {/* Stamp Badges */}
                    {b.scan_type === 'stamp' && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black">
                            📦 DẤU ĐÓNG MỰC
                          </span>
                          {b.is_special_12 && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black">
                              ⭐ 12 SỐ ĐẦU TRỌN GÓI
                            </span>
                          )}
                        </div>
                        {b.is_special_12 && (
                          <p className="text-[10px] text-emerald-400/90 leading-tight">
                            ✓ Khớp quy cách ngoại lệ trọn gói. Đã ẩn phân đoạn 14 số chuẩn để không làm sai lệch thông số đóng gói.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Title */}
                    <p className="text-xs font-black text-white leading-snug">
                      {b.product_name}
                    </p>

                    {/* Grid of details */}
                    {b.scan_type === 'stamp' ? (
                      <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300 pt-1.5 border-t border-slate-800">
                        <div>
                          <span className="text-slate-500">Mã LOT (Dòng 2):</span> {b.lot_code}
                        </div>
                        <div>
                          <span className="text-slate-500">Quy cách:</span> {b.spec || 'Ngoại lệ trọn gói'}
                        </div>
                        <div>
                          <span className="text-slate-500">Nhà máy:</span> {b.shift_group || 'Nhà máy Đắk Lắk'}
                        </div>
                        <div>
                          <span className="text-slate-500">Vùng NL (Tỉnh):</span> {b.region || 'Đắk Lắk'}
                        </div>
                        <div>
                          <span className="text-slate-500">Ngày nhập NL:</span> <strong className="text-amber-400 font-mono">{b.raw_material_date || b.production_date}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Ngày ĐG:</span> <strong className="text-slate-200 font-mono">{b.packaging_date}</strong>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500">Nhà cung cấp:</span> {b.supplier_name || 'Mã NCC 000'}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300 pt-1.5 border-t border-slate-800">
                        <div><span className="text-slate-500">Mã LOT:</span> {b.lot_code}</div>
                        <div><span className="text-slate-500">Quy cách:</span> {b.spec}</div>
                        <div><span className="text-slate-500">Tổ/Nhóm:</span> {b.shift_group}</div>
                        <div><span className="text-slate-500">Vùng NL:</span> {b.region}</div>
                        <div><span className="text-slate-500">Ngày SX:</span> <strong className="text-amber-400 font-mono">{b.production_date}</strong></div>
                        <div><span className="text-slate-500">Ngày ĐG:</span> <strong className="text-slate-200 font-mono">{b.packaging_date}</strong></div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
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

      {/* ── MODAL: ĐỔI HOẶC TẠO PALLET (MATCH ANDROID APP) ──────── */}
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
              {/* Form Input New STT */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
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
                  <label className="text-[10px] text-slate-400 block mb-1">Số thùng mục tiêu (Chuẩn 30):</label>
                  <input
                    type="number"
                    value={targetQty}
                    onChange={e => setTargetQty(parseInt(e.target.value, 10) || 30)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                  />
                </div>
                <button
                  onClick={() => {
                    if (!newSttInput.trim()) {
                      alert('Vui lòng nhập mã STT Pallet')
                      return
                    }
                    const clean = newSttInput.trim().toUpperCase()
                    setActivePalletStt(clean)
                    loadCurrentPalletBoxes(clean)
                    setIsSwitchPalletModal(false)
                    setNewSttInput('')
                    triggerToast(`Đã chuyển sang Pallet ${clean}`)
                  }}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30"
                >
                  Xác Nhận Đổi Sang {newSttInput.trim() ? newSttInput.trim().toUpperCase() : 'Pallet Này'}
                </button>
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
                          setActivePalletStt(p.stt)
                          loadCurrentPalletBoxes(p.stt)
                          setIsSwitchPalletModal(false)
                          triggerToast(`Đã chuyển sang Pallet ${p.stt}`)
                        }}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition ${
                          p.stt === activePalletStt
                            ? 'bg-emerald-500/10 border-emerald-500 text-white'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400 text-xs">
                            {p.stt}
                          </span>
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
