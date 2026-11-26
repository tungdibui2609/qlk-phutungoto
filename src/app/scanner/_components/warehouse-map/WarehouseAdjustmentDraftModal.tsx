'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  X,
  Trash2,
  Calculator,
  Tag,
  ArrowRightLeft,
  Check,
  Search,
  Package,
  MessageSquare,
  Plus,
  Minus,
  Loader2,
  PlusCircle,
  ChevronUp,
  Info,
  CheckCircle2,
  Volume2,
  PauseCircle,
  Cpu,
} from 'lucide-react'
import { VoiceMicButton, OfflineVoicePayload } from '../VoiceMicButton'
import { appendWarehouseVoiceText, normalizeWarehouseVoiceText } from '../voiceTextNormalizer'
import type {
  PositionItem,
  ProposalActionType,
  ProposalItem,
  ProposalSubItem,
  LookedUpLot,
  ProductSuggestion,
} from './types'
import { DRAFT_VOICE_SESSION_ID, DRAFT_VOICE_ROOT_FOLDER } from './types'
import { extractSubItemsFromPosition } from './mapHelpers'
import { lookupLotBySttOrCode, fetchProductsForSuggestions } from './warehouseAdjustmentService'
import { matchSearch, calculateSearchScore } from '@/lib/searchUtils'
import {
  saveOfflineInventoryVoice,
  getOfflineInventoryVoicesBySession,
  deleteOfflineInventoryVoiceByKey,
  appendVoiceNoteUrl,
  parseVoiceNoteUrls,
  type OfflineInventoryVoiceItem,
} from '@/lib/scanner-db'

interface Props {
  visible: boolean
  position: PositionItem | null
  zonePath: string
  existingDraftItem?: ProposalItem | null
  availablePositions?: PositionItem[]
  onClose: () => void
  onSaveItem: (item: ProposalItem) => void
  onRemoveItem?: (positionId: string) => void
}

const QUICK_QTY_DELTAS = [-10, -5, -1, +1, +5, +10, +20]

function getProductAvailableUnits(prod?: ProductSuggestion | null, fallbackUnit = 'Thùng'): string[] {
  if (!prod) return [fallbackUnit]
  if (Array.isArray(prod.available_units) && prod.available_units.length > 0) {
    return prod.available_units
  }
  if (prod.unit && prod.unit.trim()) {
    return [prod.unit.trim()]
  }
  return [fallbackUnit]
}

export default function WarehouseAdjustmentDraftModal({
  visible,
  position,
  zonePath,
  existingDraftItem,
  availablePositions = [],
  onClose,
  onSaveItem,
  onRemoveItem,
}: Props) {
  const isCurrentlyOccupied = Boolean(position?.lot_id)
  const currentQty = position?.quantity ?? 0
  const currentUnit = position?.unit || 'Thùng'

  const noteInputRef = useRef<HTMLTextAreaElement | null>(null)
  const bodyScrollRef = useRef<HTMLDivElement | null>(null)
  const addProductPanelRef = useRef<HTMLDivElement | null>(null)
  const productSearchInputRef = useRef<HTMLInputElement | null>(null)

  const [viewportStyle, setViewportStyle] = useState<{
    height?: number
    top?: number
    isKeyboardOpen: boolean
  }>({ isKeyboardOpen: false })
  const [isProductSearchFocused, setIsProductSearchFocused] = useState(false)

  // Theo dõi chiều cao visualViewport thực tế trên mobile khi bàn phím ảo mở/đóng
  useEffect(() => {
    if (!visible || typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return

    const updateViewport = () => {
      const keyboardOpen = window.innerHeight - vv.height > 120
      setViewportStyle({
        height: vv.height,
        top: vv.offsetTop,
        isKeyboardOpen: keyboardOpen,
      })
    }

    updateViewport()
    vv.addEventListener('resize', updateViewport)
    vv.addEventListener('scroll', updateViewport)
    return () => {
      vv.removeEventListener('resize', updateViewport)
      vv.removeEventListener('scroll', updateViewport)
    }
  }, [visible])

  const scrollProductSearchToTop = useCallback(() => {
    const scrollEl = bodyScrollRef.current
    const panelEl = addProductPanelRef.current
    if (!scrollEl || !panelEl) return
    const scrollRect = scrollEl.getBoundingClientRect()
    const panelRect = panelEl.getBoundingClientRect()
    const targetTop = panelRect.top - scrollRect.top + scrollEl.scrollTop - 8
    scrollEl.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
  }, [])

  // Mỗi khi bàn phím ảo mở xong hoặc đang focus ô tìm sản phẩm -> tự căn chỉnh đưa ô tìm kiếm lên sát đỉnh
  useEffect(() => {
    if (!visible || !isProductSearchFocused) return
    const t1 = setTimeout(scrollProductSearchToTop, 80)
    const t2 = setTimeout(scrollProductSearchToTop, 280)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [visible, isProductSearchFocused, viewportStyle.height, scrollProductSearchToTop])

  const [actionType, setActionType] = useState<ProposalActionType>('NOTE')
  const [newQtyStr, setNewQtyStr] = useState<string>('0')
  const [targetPosCode, setTargetPosCode] = useState<string>('')
  const [targetPosId, setTargetPosId] = useState<string | null>(null)
  const [onlyEmptySuggestions, setOnlyEmptySuggestions] = useState<boolean>(false)
  const [note, setNote] = useState<string>('')
  const [subItems, setSubItems] = useState<ProposalSubItem[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // State thêm sản phẩm mới vào Lot (dùng cho cả Tạo Lot mới & Thêm SP vào Lot hiện có)
  const [showAddProductPanel, setShowAddProductPanel] = useState<boolean>(false)
  const [productCatalog, setProductCatalog] = useState<ProductSuggestion[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(false)
  const [productQuery, setProductQuery] = useState<string>('')
  const [selectedNewProduct, setSelectedNewProduct] = useState<ProductSuggestion | null>(null)
  const [newProductQtyStr, setNewProductQtyStr] = useState<string>('1')
  const [newProductUnit, setNewProductUnit] = useState<string>('Thùng')

  // State gắn STT Lot vào vị trí
  const [assignSttQuery, setAssignSttQuery] = useState<string>('')
  const [searchingLot, setSearchingLot] = useState<boolean>(false)
  const [foundAssignLot, setFoundAssignLot] = useState<LookedUpLot | null>(null)
  const [assignLotError, setAssignLotError] = useState<string | null>(null)

  // State ghi âm & dịch AI cho ô ghi chú (lưu bền vững IndexedDB + thư mục Drive riêng giống Kiểm kê)
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | null>(null)
  const [pendingVoices, setPendingVoices] = useState<OfflineInventoryVoiceItem[]>([])
  const [playingVoiceKey, setPlayingVoiceKey] = useState<string | null>(null)
  const [transcribingVoiceKey, setTranscribingVoiceKey] = useState<string | null>(null)
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const savedVoiceUrls = useMemo(() => parseVoiceNoteUrls(voiceNoteUrl), [voiceNoteUrl])

  const reloadPendingVoices = useCallback(async (posId?: string | null) => {
    if (!posId) {
      setPendingVoices([])
      return
    }
    try {
      const all = await getOfflineInventoryVoicesBySession(DRAFT_VOICE_SESSION_ID)
      setPendingVoices(all.filter(v => v.positionId === posId))
    } catch {
      setPendingVoices([])
    }
  }, [])

  const stopPlayingAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.src = ''
      } catch {}
      audioRef.current = null
    }
    setPlayingVoiceKey(null)
  }, [])

  useEffect(() => {
    if (!visible) {
      stopPlayingAudio()
      setPendingVoices([])
      setTranscribingVoiceKey(null)
      setVoiceNotice(null)
    } else if (position?.id) {
      void reloadPendingVoices(position.id)
    }
    return () => {
      stopPlayingAudio()
    }
  }, [visible, position?.id, stopPlayingAudio, reloadPendingVoices])

  const voiceVocabulary = useMemo(() => {
    const words = new Set<string>()
    if (position?.product_name) words.add(String(position.product_name).trim())
    subItems.forEach(s => {
      if (s.product_name) words.add(String(s.product_name).trim())
    })
    productCatalog.slice(0, 30).forEach(p => {
      if (p.aliases) {
        String(p.aliases)
          .split(/[,;/|\n]+/)
          .forEach(a => {
            const t = a.trim()
            if (t.length >= 2 && t.length <= 32) words.add(t)
          })
      }
    })
    return Array.from(words).slice(0, 50)
  }, [position?.product_name, subItems, productCatalog])

  const handleVoiceResult = useCallback((spoken: string, voiceUrl?: string | null) => {
    setVoiceNotice(null)
    if (spoken && spoken.trim()) {
      setNote(prev => appendWarehouseVoiceText(prev, spoken))
    }
    if (voiceUrl) {
      setVoiceNoteUrl(prev => appendVoiceNoteUrl(prev, voiceUrl))
    }
  }, [])

  const handleVoiceOfflineSaved = useCallback(
    async (payload: OfflineVoicePayload) => {
      if (!position?.id) return
      setVoiceNotice(null)
      try {
        const saved = await saveOfflineInventoryVoice({
          sessionId: DRAFT_VOICE_SESSION_ID,
          positionId: position.id,
          audioBase64: payload.audioBase64,
          mimeType: payload.mimeType,
          durationSec: payload.durationSec,
          createdAt: new Date().toISOString(),
        })
        setPendingVoices(prev => [...prev, saved])
      } catch {
        setVoiceNotice('Không thể lưu ghi âm vào bộ nhớ trình duyệt.')
      }
    },
    [position?.id]
  )

  const handleTogglePlayAudioSource = useCallback(
    (key: string, src: string) => {
      if (playingVoiceKey === key) {
        stopPlayingAudio()
        return
      }
      stopPlayingAudio()
      try {
        const audio = new Audio(src)
        audioRef.current = audio
        setPlayingVoiceKey(key)
        audio.onended = () => {
          setPlayingVoiceKey(null)
          audioRef.current = null
        }
        audio.onerror = () => {
          setPlayingVoiceKey(null)
          audioRef.current = null
        }
        void audio.play().catch(() => {
          setPlayingVoiceKey(null)
          audioRef.current = null
        })
      } catch {
        setPlayingVoiceKey(null)
      }
    },
    [playingVoiceKey, stopPlayingAudio]
  )

  const handleDeletePendingVoice = useCallback(
    async (voiceKey: string) => {
      if (playingVoiceKey === voiceKey) stopPlayingAudio()
      await deleteOfflineInventoryVoiceByKey(voiceKey)
      setPendingVoices(prev => prev.filter(v => v.key !== voiceKey))
    },
    [playingVoiceKey, stopPlayingAudio]
  )

  const handleTranscribeRecordedVoice = useCallback(
    async (rv: OfflineInventoryVoiceItem) => {
      if (!position || transcribingVoiceKey) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setVoiceNotice('Đang mất mạng — file ghi âm vẫn giữ an toàn để dịch hàng loạt khi có mạng!')
        return
      }
      setVoiceNotice(null)
      setTranscribingVoiceKey(rv.key)
      try {
        const res = await fetch('/api/voice-transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: rv.audioBase64,
            mimeType: rv.mimeType || 'audio/webm',
            saveToServer: true,
            rootFolderOverride: DRAFT_VOICE_ROOT_FOLDER,
            systemCode: 'KHO_DONG_LANH',
            sessionId: DRAFT_VOICE_SESSION_ID,
            sessionName: 'Ghi_Nhap_So_Do_Kho',
            positionId: position.id,
            positionCode: position.code || null,
            vocabulary: voiceVocabulary,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setVoiceNotice(data?.error || 'Không thể dịch giọng nói — file vẫn được giữ trên máy.')
          return
        }
        const rawText = String(data?.text || '').trim()
        const normalized = rawText ? normalizeWarehouseVoiceText(rawText) : ''
        const voiceUrl = data?.voiceUrl ? String(data.voiceUrl) : null
        if (normalized || voiceUrl) {
          if (normalized) {
            setNote(prev => appendWarehouseVoiceText(prev, normalized))
          }
          if (voiceUrl) {
            setVoiceNoteUrl(prev => appendVoiceNoteUrl(prev, voiceUrl))
          }
          if (playingVoiceKey === rv.key) stopPlayingAudio()
          await deleteOfflineInventoryVoiceByKey(rv.key)
          setPendingVoices(prev => prev.filter(v => v.key !== rv.key))
        } else {
          setVoiceNotice(data?.warning || 'AI không nghe rõ — file vẫn được giữ lại trên máy.')
        }
      } catch {
        setVoiceNotice('Lỗi kết nối khi gọi AI — file vẫn được giữ an toàn trên máy.')
      } finally {
        setTranscribingVoiceKey(null)
      }
    },
    [position, transcribingVoiceKey, voiceVocabulary, playingVoiceKey, stopPlayingAudio]
  )

  const loadProductCatalogIfNeeded = useCallback(async () => {
    if (productCatalog.length > 0 || loadingCatalog) return
    setLoadingCatalog(true)
    try {
      const list = await fetchProductsForSuggestions()
      setProductCatalog(list || [])
    } finally {
      setLoadingCatalog(false)
    }
  }, [productCatalog.length, loadingCatalog])

  // Khởi tạo state khi mở modal hoặc đổi vị trí / existingDraftItem
  useEffect(() => {
    if (!visible || !position) return
    setErrorMsg(null)

    if (existingDraftItem) {
      setActionType(existingDraftItem.action_type)
      setNewQtyStr(
        existingDraftItem.new_quantity != null
          ? String(existingDraftItem.new_quantity)
          : String(currentQty)
      )
      setTargetPosCode(existingDraftItem.target_position_code || '')
      setTargetPosId(existingDraftItem.target_position_id || null)
      setNote(existingDraftItem.note || '')
      setVoiceNoteUrl(existingDraftItem.voice_note_url || null)

      if (existingDraftItem.sub_items && existingDraftItem.sub_items.length > 0) {
        setSubItems(existingDraftItem.sub_items.map(s => ({ ...s })))
      } else {
        setSubItems(extractSubItemsFromPosition(position))
      }

      if (existingDraftItem.action_type === 'ASSIGN_LOT') {
        setAssignSttQuery(existingDraftItem.lot_stt || existingDraftItem.lot_code || '')
        if (existingDraftItem.lot_id) {
          setFoundAssignLot({
            id: existingDraftItem.lot_id,
            code: existingDraftItem.lot_code || '',
            stt: existingDraftItem.lot_stt || null,
            quantity: existingDraftItem.new_quantity ?? 0,
            unit: existingDraftItem.unit || 'Thùng',
            product_name: existingDraftItem.product_name || '',
            sku: existingDraftItem.sku || null,
            current_position_id: existingDraftItem.target_position_id || null,
            current_position_code: existingDraftItem.target_position_code || null,
          })
        } else {
          setFoundAssignLot(null)
        }
        setAssignLotError(null)
      } else {
        setAssignSttQuery('')
        setFoundAssignLot(null)
        setAssignLotError(null)
      }
    } else {
      setActionType('NOTE')
      setNewQtyStr(String(currentQty))
      setTargetPosCode('')
      setTargetPosId(null)
      setNote('')
      setVoiceNoteUrl(null)
      setAssignSttQuery('')
      setFoundAssignLot(null)
      setAssignLotError(null)
      setSubItems(extractSubItemsFromPosition(position))
    }

    const shouldAutoOpenAdd =
      !isCurrentlyOccupied &&
      (!existingDraftItem || existingDraftItem.action_type === 'SET_QTY') &&
      !(existingDraftItem?.sub_items && existingDraftItem.sub_items.length > 0)

    setShowAddProductPanel(shouldAutoOpenAdd)
    if (shouldAutoOpenAdd) {
      void loadProductCatalogIfNeeded()
    }
    setProductQuery('')
    setSelectedNewProduct(null)
    setNewProductQtyStr('1')
    setNewProductUnit(position.unit || 'Thùng')
  }, [visible, position, existingDraftItem, isCurrentlyOccupied, currentQty, loadProductCatalogIfNeeded])

  const hasMultipleProducts = subItems.length > 1 || subItems.some(s => s.is_new)

  const handleSelectAction = useCallback(
    (type: ProposalActionType) => {
      setErrorMsg(null)
      setActionType(type)

      if (type === 'CLEAR') {
        setSubItems(prev => prev.map(s => ({ ...s, new_quantity: 0 })))
        setNewQtyStr('0')
      } else if (type === 'SET_QTY' && !isCurrentlyOccupied && subItems.length === 0) {
        setShowAddProductPanel(true)
        void loadProductCatalogIfNeeded()
      } else if (type === 'NOTE') {
        setTimeout(() => noteInputRef.current?.focus(), 60)
      }
    },
    [isCurrentlyOccupied, subItems.length, loadProductCatalogIfNeeded]
  )

  const handleToggleAddProductPanel = useCallback(() => {
    const nextOpen = !showAddProductPanel
    setShowAddProductPanel(nextOpen)
    if (nextOpen) {
      void loadProductCatalogIfNeeded()
    }
  }, [showAddProductPanel, loadProductCatalogIfNeeded])

  // Tìm kiếm sản phẩm hỗ trợ tên viết tắt (aliases), mã nội bộ, SKU, không dấu & sắp xếp theo điểm khớp
  const filteredProductSuggestions = useMemo(() => {
    if (!showAddProductPanel || productCatalog.length === 0) return []
    const q = productQuery.trim()
    if (!q) return productCatalog.slice(0, 15)
    return productCatalog
      .filter(p => matchSearch(p, q))
      .sort((a, b) => calculateSearchScore(b, q) - calculateSearchScore(a, q))
      .slice(0, 20)
  }, [showAddProductPanel, productCatalog, productQuery])

  const handleConfirmAddProductToLot = useCallback(() => {
    if (!selectedNewProduct) return
    const qty = parseFloat(newProductQtyStr.replace(',', '.'))
    const validQty = isNaN(qty) || qty <= 0 ? 1 : qty
    const unitVal = newProductUnit.trim() || currentUnit || 'Thùng'

    setErrorMsg(null)
    setSubItems(prev => {
      let base = prev
      if (base.length === 0 && position?.product_name) {
        const baseQty = parseFloat(newQtyStr.replace(',', '.'))
        base = [
          {
            product_id: null,
            product_name: position.product_name,
            sku: position.sku || null,
            current_quantity: position.quantity != null ? Number(position.quantity) : 0,
            new_quantity: isNaN(baseQty) ? (position.quantity ?? 0) : baseQty,
            unit: position.unit || 'Thùng',
          },
        ]
      } else if (base.length === 1) {
        const baseQty = parseFloat(newQtyStr.replace(',', '.'))
        if (!isNaN(baseQty)) {
          base = [{ ...base[0], new_quantity: baseQty }]
        }
      }

      const next: ProposalSubItem[] = [
        ...base,
        {
          product_id: selectedNewProduct.id,
          product_name: selectedNewProduct.name,
          sku: selectedNewProduct.sku || null,
          current_quantity: 0,
          new_quantity: validQty,
          unit: unitVal,
          is_new: true,
        },
      ]
      const total = next.reduce((sum, item) => sum + (item.new_quantity || 0), 0)
      setNewQtyStr(String(Number(total.toFixed(2))))
      return next
    })

    setShowAddProductPanel(false)
    setSelectedNewProduct(null)
    setProductQuery('')
    setNewProductQtyStr('1')
  }, [selectedNewProduct, newProductQtyStr, newProductUnit, currentUnit, position, newQtyStr])

  const handleRemoveNewSubItem = useCallback((index: number) => {
    setSubItems(prev => {
      const next = prev.filter((_, idx) => idx !== index)
      const total = next.reduce((sum, item) => sum + (item.new_quantity || 0), 0)
      setNewQtyStr(String(Number(total.toFixed(2))))
      return next
    })
  }, [])

  // Tăng giảm số lượng nhanh cho pallet đơn
  const handleQuickAddQty = useCallback(
    (delta: number) => {
      const curr = parseFloat(newQtyStr.replace(',', '.')) || 0
      const next = Math.max(0, Number((curr + delta).toFixed(2)))
      setNewQtyStr(String(next))

      setSubItems(prev => {
        if (prev.length === 1) {
          return [{ ...prev[0], new_quantity: next }]
        }
        return prev
      })
    },
    [newQtyStr]
  )

  const handleUpdateSubItemQty = useCallback((index: number, newQty: number) => {
    const validQty = Math.max(0, Number(newQty.toFixed(2)))
    setSubItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], new_quantity: validQty }
      const total = next.reduce((sum, item) => sum + (item.new_quantity || 0), 0)
      setNewQtyStr(String(Number(total.toFixed(2))))
      return next
    })
  }, [])

  const handleSubItemTextChange = useCallback((index: number, text: string) => {
    const parsed = parseFloat(text.replace(',', '.'))
    const validQty = isNaN(parsed) ? 0 : Math.max(0, parsed)
    setSubItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], new_quantity: validQty }
      const total = next.reduce((sum, item) => sum + (item.new_quantity || 0), 0)
      setNewQtyStr(String(Number(total.toFixed(2))))
      return next
    })
  }, [])

  // Gợi ý vị trí chuyển ô thông minh (ưu tiên tầng T1->T5, cùng dãy) giống Android
  const positionSuggestions = useMemo(() => {
    if (actionType !== 'MOVE' || !availablePositions || availablePositions.length === 0) {
      return []
    }

    const extractFloor = (code: string): number => {
      const m = (code || '').match(/T(\d+)/i)
      if (!m) return 999
      const digits = m[1]
      if (digits.length >= 3) {
        return parseInt(digits[0], 10)
      }
      return parseInt(digits, 10)
    }

    const sortPositions = (list: PositionItem[]) => {
      return [...list].sort((a, b) => {
        const codeA = (a.code || '').toUpperCase()
        const codeB = (b.code || '').toUpperCase()
        const floorA = extractFloor(codeA)
        const floorB = extractFloor(codeB)

        const isPriorityA = floorA >= 1 && floorA <= 5
        const isPriorityB = floorB >= 1 && floorB <= 5
        if (isPriorityA && !isPriorityB) return -1
        if (!isPriorityA && isPriorityB) return 1

        if (floorA !== floorB) return floorA - floorB
        return codeA.localeCompare(codeB, undefined, { numeric: true })
      })
    }

    const currentPosId = position?.id
    let pool = availablePositions.filter(p => p.id !== currentPosId)

    if (onlyEmptySuggestions) {
      pool = pool.filter(p => !p.lot_id)
    }

    const query = targetPosCode.trim().toUpperCase()

    if (!query) {
      const currentPrefix = (position?.code || '').slice(0, 4).toUpperCase()
      if (currentPrefix) {
        const samePrefix = pool.filter(p => (p.code || '').toUpperCase().startsWith(currentPrefix))
        if (samePrefix.length > 0) {
          return sortPositions(samePrefix).slice(0, 20)
        }
      }
      return sortPositions(pool).slice(0, 20)
    }

    const matched = pool.filter(p => (p.code || '').toUpperCase().includes(query))
    return sortPositions(matched).slice(0, 20)
  }, [actionType, availablePositions, targetPosCode, onlyEmptySuggestions, position])

  const handleSelectTargetPosition = useCallback((targetPos: PositionItem) => {
    setTargetPosCode(targetPos.code || '')
    setTargetPosId(targetPos.id || null)
  }, [])

  // Tra cứu Lot theo STT (VD: G57, G88) hoặc mã Lot
  const handleSearchAssignLot = useCallback(
    async (overrideQuery?: string) => {
      const q = (overrideQuery ?? assignSttQuery).replace(/^#/, '').trim().toUpperCase()
      if (!q) {
        setFoundAssignLot(null)
        setAssignLotError('Vui lòng nhập STT (VD: G949) hoặc mã Lot.')
        return
      }
      setAssignLotError(null)

      // 1. Tìm nhanh trên bản đồ hiện có (chạy cả khi offline)
      if (Array.isArray(availablePositions) && availablePositions.length > 0) {
        const localMatch = availablePositions.find(
          p =>
            p.lot_id &&
            ((p.stt || '').toUpperCase() === q || (p.lot_code || '').toUpperCase() === q)
        )
        if (localMatch) {
          setFoundAssignLot({
            id: localMatch.lot_id!,
            code: localMatch.lot_code || '',
            stt: localMatch.stt || q,
            quantity: Number(localMatch.quantity) || 0,
            unit: localMatch.unit || 'Thùng',
            product_name: localMatch.product_name || `Lot ${localMatch.lot_code || ''}`,
            sku: localMatch.sku || null,
            current_position_id: localMatch.id,
            current_position_code: localMatch.code,
          })
          return
        }
      }

      // 2. Tra cứu trực tiếp Supabase (tìm cả Lot chưa gán vị trí)
      setSearchingLot(true)
      try {
        const remoteLot = await lookupLotBySttOrCode(q)
        if (remoteLot) {
          setFoundAssignLot(remoteLot)
        } else {
          setFoundAssignLot(null)
          setAssignLotError(`Không tìm thấy Lot nào khớp STT/mã "${q}" trong kho hiện tại.`)
        }
      } finally {
        setSearchingLot(false)
      }
    },
    [assignSttQuery, availablePositions]
  )

  const handleSave = () => {
    if (!position) return
    setErrorMsg(null)

    const cleanStt = assignSttQuery.replace(/^#/, '').trim().toUpperCase()
    if (actionType === 'ASSIGN_LOT' && !cleanStt) {
      setErrorMsg('Vui lòng nhập STT của Lot (VD: G57, G88...) cần gắn vào vị trí này.')
      return
    }

    if (
      actionType === 'NOTE' &&
      !note.trim() &&
      !voiceNoteUrl &&
      pendingVoices.length === 0
    ) {
      setErrorMsg('Vui lòng nhập nội dung ghi chú hoặc ghi âm giọng nói muốn gửi lên Web.')
      return
    }

    if (!isCurrentlyOccupied && actionType === 'SET_QTY' && subItems.length === 0) {
      setErrorMsg('Vui lòng tìm và chọn ít nhất 1 sản phẩm để tạo Lot mới cho vị trí trống.')
      return
    }

    if (actionType === 'MOVE' && !targetPosCode.trim()) {
      setErrorMsg('Vui lòng chọn hoặc nhập mã vị trí đích cần chuyển sang.')
      return
    }

    let parsedNewQty: number | null = null
    let finalSubItems: ProposalSubItem[] | undefined = undefined

    if (actionType === 'SET_QTY') {
      if (hasMultipleProducts) {
        parsedNewQty = Number(
          subItems.reduce((sum, item) => sum + (item.new_quantity || 0), 0).toFixed(2)
        )
        finalSubItems = subItems
      } else {
        const parsed = parseFloat(newQtyStr.replace(',', '.'))
        if (isNaN(parsed) || parsed < 0) {
          setErrorMsg('Vui lòng nhập số lượng thực tế hợp lệ!')
          return
        }
        parsedNewQty = parsed
        finalSubItems =
          subItems.length > 0
            ? subItems.map(s => ({ ...s, new_quantity: parsed }))
            : undefined
      }
    } else if (actionType === 'CLEAR') {
      parsedNewQty = 0
      finalSubItems =
        subItems.length > 0
          ? subItems.map(s => ({ ...s, new_quantity: 0 }))
          : undefined
    }

    let resolvedTargetId = targetPosId
    if (actionType === 'MOVE' && !resolvedTargetId && targetPosCode.trim()) {
      const found = availablePositions.find(
        p => (p.code || '').trim().toUpperCase() === targetPosCode.trim().toUpperCase()
      )
      if (found) resolvedTargetId = found.id
    }

    const item: ProposalItem =
      actionType === 'ASSIGN_LOT'
        ? {
            id: existingDraftItem?.id || `${position.id}-${Date.now()}`,
            position_id: position.id,
            position_code: position.code,
            warehouse_name: zonePath || undefined,
            action_type: 'ASSIGN_LOT',
            lot_id: foundAssignLot?.id || null,
            lot_code: foundAssignLot?.code || null,
            lot_stt: foundAssignLot?.stt || cleanStt,
            product_name: foundAssignLot?.product_name || `Gắn STT ${cleanStt}`,
            sku: foundAssignLot?.sku || null,
            current_quantity: position.quantity ?? 0,
            unit: foundAssignLot?.unit || 'Thùng',
            new_quantity: foundAssignLot?.quantity ?? null,
            target_position_id: foundAssignLot?.current_position_id || null,
            target_position_code: foundAssignLot?.current_position_code || null,
            note: note.trim() || null,
            voice_note_url: voiceNoteUrl || null,
            updated_at: new Date().toISOString(),
          }
        : {
            id: existingDraftItem?.id || `${position.id}-${Date.now()}`,
            position_id: position.id,
            position_code: position.code,
            warehouse_name: zonePath || undefined,
            action_type: actionType,
            lot_id: position.lot_id || null,
            lot_code: position.lot_code || null,
            lot_stt: position.stt || null,
            product_name:
              position.product_name ||
              (finalSubItems && finalSubItems.length > 0
                ? finalSubItems.map(s => s.product_name).join(', ')
                : null),
            sku:
              position.sku ||
              (finalSubItems && finalSubItems.length > 0
                ? finalSubItems.map(s => s.sku).filter(Boolean).join(', ') || null
                : null),
            current_quantity: position.quantity ?? null,
            unit:
              position.unit ||
              (finalSubItems && finalSubItems.length > 0 ? finalSubItems[0].unit : 'Thùng'),
            ...(finalSubItems && finalSubItems.length > 0 ? { sub_items: finalSubItems } : {}),
            new_quantity: parsedNewQty,
            target_position_id: actionType === 'MOVE' ? resolvedTargetId : null,
            target_position_code:
              actionType === 'MOVE' ? targetPosCode.trim().toUpperCase() : null,
            note: note.trim() || null,
            voice_note_url: voiceNoteUrl || null,
            updated_at: new Date().toISOString(),
          }

    onSaveItem(item)
    onClose()
  }

  if (!visible || !position) return null

  return (
    <div
      className="fixed inset-x-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-150"
      style={
        viewportStyle.height
          ? { top: viewportStyle.top || 0, height: viewportStyle.height }
          : { top: 0, bottom: 0 }
      }
      onClick={onClose}
    >
      <div
        className="bg-[#0f172a] text-slate-100 w-full max-w-lg rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl border border-slate-700/80 overflow-hidden"
        style={{
          maxHeight: viewportStyle.isKeyboardOpen ? '98%' : '92%',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-[#111827]">
          <div className="min-w-0 pr-2">
            <div className="text-[10px] font-black text-amber-400 tracking-wider uppercase">
              GHI NHÁP ĐIỀU CHỈNH
            </div>
            <h3 className="text-[16px] font-black text-white tracking-tight font-mono">
              VỊ TRÍ: {position.code}
            </h3>
            {zonePath && (
              <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">
                📍 {zonePath}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          ref={bodyScrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar p-4 space-y-4"
        >
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs font-bold text-rose-200">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Thẻ hiển thị trạng thái hiện tại của vị trí */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Package
                  size={16}
                  className={isCurrentlyOccupied ? 'text-amber-400' : 'text-emerald-400'}
                />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                  {isCurrentlyOccupied
                    ? hasMultipleProducts
                      ? `HIỆN CÓ HÀNG (PALLET HỖN HỢP: ${subItems.length} SP)`
                      : 'HIỆN CÓ HÀNG'
                    : 'Ô HIỆN ĐANG TRỐNG'}
                </span>
              </div>
              {position.stt && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-black">
                  STT: {position.stt}
                </span>
              )}
            </div>

            {isCurrentlyOccupied ? (
              <div className="space-y-2">
                {hasMultipleProducts ? (
                  <div className="space-y-1.5 pt-1 border-t border-slate-800">
                    {subItems.map((sub, sIdx) => (
                      <div key={sIdx} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 text-[10px] font-bold shrink-0">
                            {sub.is_new ? 'MỚI' : `SP ${sIdx + 1}`}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-100 truncate">
                              {sub.product_name}
                            </div>
                            {sub.sku && (
                              <div className="text-[10px] font-mono text-slate-400">
                                SKU: {sub.sku}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="font-mono font-black text-sky-400 shrink-0">
                          {sub.current_quantity} {sub.unit || currentUnit}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs font-bold text-white leading-snug">
                    {position.product_name || 'Hàng đông lạnh'}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 flex-wrap pt-1.5 border-t border-slate-800/80 text-[11px]">
                  {position.lot_code && (
                    <span className="font-mono text-slate-400">Lot: {position.lot_code}</span>
                  )}
                  <span className="text-slate-300">
                    Tổng số lượng:{' '}
                    <strong className="text-sky-400 font-mono">
                      {currentQty} {currentUnit}
                    </strong>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Vị trí đang trống, có thể gắn STT Lot, tạo Lot mới hoặc ghi chú cho ô này.
              </p>
            )}
          </div>

          {/* Chọn Thao Tác Điều Chỉnh */}
          <div>
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
              CHỌN THAO TÁC ĐIỀU CHỈNH:
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectAction('NOTE')}
                className={`col-span-2 p-2.5 rounded-xl border text-left transition-all ${
                  actionType === 'NOTE'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <MessageSquare size={15} />
                  <span>Chỉ ghi chú</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Gửi lời nhắn cho Web đọc (không đổi hàng)
                </div>
              </button>

              {isCurrentlyOccupied && (
                <button
                  type="button"
                  onClick={() => handleSelectAction('CLEAR')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    actionType === 'CLEAR'
                      ? 'bg-rose-950/60 border-rose-500 text-rose-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-black">
                    <Trash2 size={15} />
                    <span>Xuất rỗng ô</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Trừ vị trí (X)</div>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSelectAction('ASSIGN_LOT')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  actionType === 'ASSIGN_LOT'
                    ? 'bg-purple-950/60 border-purple-500 text-purple-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <Tag size={15} />
                  <span>Gắn STT Lot</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Nhập G57, G88...</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectAction('SET_QTY')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  actionType === 'SET_QTY'
                    ? 'bg-amber-950/60 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <Calculator size={15} />
                  <span>{isCurrentlyOccupied ? 'Sửa số lượng' : 'Tạo Lot mới'}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {!isCurrentlyOccupied
                    ? 'Thêm SP mới'
                    : hasMultipleProducts
                    ? 'Từng dòng SP'
                    : 'Lẻ thùng (25t...)'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectAction('MOVE')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  actionType === 'MOVE'
                    ? 'bg-sky-950/60 border-sky-500 text-sky-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <ArrowRightLeft size={15} />
                  <span>Chuyển ô</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Sang vị trí mới</div>
              </button>
            </div>
          </div>

          {/* ── FORM CHI TIẾT: GẮN STT LOT ── */}
          {actionType === 'ASSIGN_LOT' && (
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-purple-500/30 space-y-2.5">
              <div className="text-[11px] font-black text-purple-300 uppercase">
                NHẬP STT CỦA LOT CẦN GẮN VÀO Ô {position.code}:
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={assignSttQuery}
                  onChange={e => {
                    const txt = e.target.value
                    setAssignSttQuery(txt)
                    setAssignLotError(null)
                    const clean = txt.replace(/^#/, '').trim().toUpperCase()
                    if (clean && Array.isArray(availablePositions)) {
                      const localMatch = availablePositions.find(
                        p =>
                          p.lot_id &&
                          ((p.stt || '').toUpperCase() === clean ||
                            (p.lot_code || '').toUpperCase() === clean)
                      )
                      if (localMatch) {
                        setFoundAssignLot({
                          id: localMatch.lot_id!,
                          code: localMatch.lot_code || '',
                          stt: localMatch.stt || clean,
                          quantity: Number(localMatch.quantity) || 0,
                          unit: localMatch.unit || 'Thùng',
                          product_name:
                            localMatch.product_name || `Lot ${localMatch.lot_code || ''}`,
                          sku: localMatch.sku || null,
                          current_position_id: localMatch.id,
                          current_position_code: localMatch.code,
                        })
                      } else {
                        setFoundAssignLot(null)
                      }
                    } else {
                      setFoundAssignLot(null)
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleSearchAssignLot()
                    }
                  }}
                  placeholder="VD: G57, G88..."
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-sm font-mono font-black text-white uppercase outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => void handleSearchAssignLot()}
                  disabled={searchingLot}
                  className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-xs font-black flex items-center gap-1.5 shrink-0"
                >
                  {searchingLot ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                  <span>{searchingLot ? 'Đang tìm...' : 'Kiểm tra'}</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                Chỉ cần nhập STT rồi bấm Lưu nháp — Web sẽ tự đối chiếu &amp; gán Lot khi duyệt.
              </p>

              {assignLotError && (
                <div className="p-2.5 rounded-xl bg-amber-950/50 border border-amber-500/40 flex items-start gap-2 text-[11px] text-amber-200 font-semibold">
                  <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>{assignLotError} (Vẫn có thể lưu nháp để Web kiểm tra)</span>
                </div>
              )}

              {foundAssignLot && (
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/40 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {foundAssignLot.stt && (
                      <span className="px-2 py-0.5 rounded bg-purple-600 text-white text-[11px] font-mono font-black">
                        STT: {foundAssignLot.stt}
                      </span>
                    )}
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {foundAssignLot.code}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white leading-snug">
                    {foundAssignLot.product_name}
                  </div>
                  <div className="text-xs text-slate-300">
                    Số lượng:{' '}
                    <strong className="text-emerald-400 font-mono">
                      {foundAssignLot.quantity} {foundAssignLot.unit}
                    </strong>
                  </div>
                  {foundAssignLot.current_position_code &&
                    foundAssignLot.current_position_code !== position.code && (
                      <div className="flex items-start gap-1.5 pt-1 text-[11px] text-amber-300 font-semibold">
                        <ArrowRightLeft size={13} className="shrink-0 mt-0.5" />
                        <span>
                          Lot đang ở ô {foundAssignLot.current_position_code} — khi duyệt sẽ tự
                          chuyển sang {position.code}.
                        </span>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          {/* ── FORM CHI TIẾT: SỬA SỐ LƯỢNG / TẠO LOT MỚI ── */}
          {actionType === 'SET_QTY' && (
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-3">
              {hasMultipleProducts ? (
                /* Chỉnh sửa từng dòng sản phẩm (pallet hỗn hợp hoặc Lot mới đã chọn SP) */
                <div className="space-y-2.5">
                  <div className="text-[11px] font-black text-amber-300 uppercase">
                    ĐIỀU CHỈNH SỐ LƯỢNG TỪNG DÒNG ({subItems.length} SẢN PHẨM):
                  </div>

                  {subItems.map((sub, sIdx) => (
                    <div
                      key={sIdx}
                      className={`p-2.5 rounded-xl border space-y-2 ${
                        sub.is_new
                          ? 'bg-emerald-950/30 border-emerald-500/40'
                          : 'bg-slate-950/70 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {sub.is_new && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black">
                                MỚI THÊM
                              </span>
                            )}
                            {sub.sku && (
                              <span className="text-[10px] font-mono font-bold text-sky-400">
                                {sub.sku}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-white leading-snug mt-0.5">
                            {sub.product_name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Hiện có:{' '}
                            <strong className="text-sky-400 font-mono">
                              {sub.current_quantity}
                            </strong>{' '}
                            {sub.unit}
                          </div>
                        </div>

                        {sub.is_new ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveNewSubItem(sIdx)}
                            className="p-1.5 rounded-lg bg-rose-950/60 text-rose-400 hover:bg-rose-900/60 shrink-0"
                            title="Xóa dòng sản phẩm này"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateSubItemQty(sIdx, 0)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-black border shrink-0 ${
                              sub.new_quantity === 0
                                ? 'bg-rose-950/70 border-rose-500 text-rose-400'
                                : 'bg-slate-800 border-slate-700 text-slate-300'
                            }`}
                          >
                            =0
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateSubItemQty(sIdx, (sub.new_quantity || 0) - 1)
                          }
                          className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 active:scale-95 shrink-0"
                        >
                          <Minus size={15} />
                        </button>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={String(sub.new_quantity ?? 0)}
                          onChange={e => handleSubItemTextChange(sIdx, e.target.value)}
                          className="flex-1 min-w-0 h-9 px-3 rounded-xl border border-slate-700 bg-slate-950 text-center text-sm font-mono font-black text-white outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateSubItemQty(sIdx, (sub.new_quantity || 0) + 1)
                          }
                          className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 active:scale-95 shrink-0"
                        >
                          <Plus size={15} />
                        </button>
                        <span className="text-[11px] font-bold text-slate-400 shrink-0">
                          {sub.unit}
                        </span>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40">
                    <span className="text-[11px] font-black text-amber-200 uppercase">
                      TỔNG SỐ LƯỢNG MỚI:
                    </span>
                    <span className="text-sm font-mono font-black text-emerald-400">
                      {newQtyStr} {subItems[0]?.unit || currentUnit}
                    </span>
                  </div>
                </div>
              ) : isCurrentlyOccupied ? (
                /* Chỉnh số lượng pallet đơn */
                <div className="space-y-2.5">
                  <label className="block text-[11px] font-black text-amber-300 uppercase">
                    SỐ LƯỢNG THỰC TẾ CÒN LẠI ({currentUnit.toUpperCase()}):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={newQtyStr}
                      onChange={e => {
                        const txt = e.target.value
                        setNewQtyStr(txt)
                        const parsed = parseFloat(txt.replace(',', '.')) || 0
                        setSubItems(prev => {
                          if (prev.length === 1) {
                            return [{ ...prev[0], new_quantity: parsed }]
                          }
                          return prev
                        })
                      }}
                      placeholder="0"
                      className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-base font-mono font-black text-white outline-none focus:border-amber-500"
                    />
                    <span className="px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 shrink-0">
                      {currentUnit}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_QTY_DELTAS.map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleQuickAddQty(val)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-black border active:scale-95 ${
                          val < 0
                            ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                            : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                        }`}
                      >
                        {val > 0 ? `+${val}` : val}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] font-black text-amber-300 uppercase">
                  CHỌN SẢN PHẨM ĐỂ TẠO LOT MỚI CHO Ô {position.code}:
                </div>
              )}

              {/* Nút & Khung tìm kiếm thêm sản phẩm (hoạt động cho CẢ ô trống tạo Lot mới lẫn ô đang có hàng) */}
              <div
                className={
                  !isCurrentlyOccupied && subItems.length === 0
                    ? ''
                    : 'pt-2.5 border-t border-slate-800'
                }
              >
                <button
                  type="button"
                  onClick={handleToggleAddProductPanel}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition ${
                    showAddProductPanel
                      ? 'border-sky-500 bg-sky-950/50 text-sky-300'
                      : 'border-dashed border-sky-500/60 bg-sky-950/25 text-sky-300 hover:bg-sky-950/40'
                  }`}
                >
                  {showAddProductPanel ? <ChevronUp size={15} /> : <PlusCircle size={15} />}
                  <span>
                    {showAddProductPanel
                      ? 'Đóng khung thêm sản phẩm'
                      : isCurrentlyOccupied
                      ? '+ Thêm sản phẩm vào Lot này'
                      : '+ Tìm & chọn sản phẩm cho Lot mới'}
                  </span>
                </button>

                {showAddProductPanel && (
                  <div
                    ref={addProductPanelRef}
                    className="mt-2.5 p-3 rounded-xl bg-slate-950/90 border border-sky-500/40 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-black text-sky-300 uppercase">
                        CHỌN SẢN PHẨM THÊM VÀO LOT:
                      </div>
                      {(viewportStyle.isKeyboardOpen || isProductSearchFocused) && (
                        <button
                          type="button"
                          onClick={() => {
                            productSearchInputRef.current?.blur()
                            setIsProductSearchFocused(false)
                          }}
                          className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-sky-300 text-[10px] font-bold shrink-0"
                        >
                          Ẩn phím
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 sticky top-0 z-10">
                      <Search size={14} className="text-slate-400 shrink-0" />
                      <input
                        ref={productSearchInputRef}
                        type="text"
                        value={productQuery}
                        onFocus={() => {
                          setIsProductSearchFocused(true)
                          setTimeout(scrollProductSearchToTop, 100)
                        }}
                        onBlur={() => setIsProductSearchFocused(false)}
                        onChange={e => {
                          setProductQuery(e.target.value)
                          if (selectedNewProduct) setSelectedNewProduct(null)
                        }}
                        placeholder="Tìm tên viết tắt (đô c, ri6...), tên SP hoặc SKU..."
                        className="flex-1 min-w-0 bg-transparent text-xs font-bold text-white outline-none placeholder:text-slate-500"
                      />
                      {productQuery.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setProductQuery('')
                            setSelectedNewProduct(null)
                          }}
                          className="text-slate-400 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {!selectedNewProduct ? (
                      <div className="space-y-1.5">
                        {loadingCatalog ? (
                          <div className="py-5 flex items-center justify-center gap-2 text-xs text-slate-400">
                            <Loader2 size={15} className="animate-spin text-sky-400" />
                            <span>Đang tải danh mục sản phẩm...</span>
                          </div>
                        ) : filteredProductSuggestions.length === 0 ? (
                          <div className="py-4 text-center text-xs text-slate-400">
                            Không tìm thấy sản phẩm phù hợp với &quot;{productQuery}&quot;
                          </div>
                        ) : (
                          filteredProductSuggestions.map(prod => (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => {
                                setSelectedNewProduct(prod)
                                const units = getProductAvailableUnits(
                                  prod,
                                  position?.unit || 'Thùng'
                                )
                                setNewProductUnit(units[0])
                              }}
                              className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 text-left transition space-y-0.5"
                            >
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {prod.aliases && prod.aliases.length > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-black">
                                    ⚡ {prod.aliases.join(', ')}
                                  </span>
                                )}
                                {prod.sku && (
                                  <span className="text-[10px] font-mono font-bold text-sky-400">
                                    {prod.sku}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-bold text-white leading-snug">
                                {prod.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                ĐVT:{' '}
                                {prod.available_units && prod.available_units.length > 0
                                  ? prod.available_units.join(', ')
                                  : prod.unit}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {selectedNewProduct.aliases.length > 0 && (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black mb-1">
                                ⚡ {selectedNewProduct.aliases.join(', ')}
                              </span>
                            )}
                            <div className="text-xs font-black text-white leading-snug">
                              {selectedNewProduct.name}
                            </div>
                            <div className="text-[10px] font-mono text-sky-400 mt-0.5">
                              SKU: {selectedNewProduct.sku || '---'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedNewProduct(null)}
                            className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-bold shrink-0"
                          >
                            Đổi SP
                          </button>
                        </div>

                        <div className="grid grid-cols-5 gap-2">
                          <div className="col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 mb-1">
                              SỐ LƯỢNG:
                            </label>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={newProductQtyStr}
                              onChange={e => setNewProductQtyStr(e.target.value)}
                              placeholder="1"
                              className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-sm font-mono font-black text-white outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="col-span-3">
                            <label className="block text-[10px] font-black text-slate-400 mb-1">
                              ĐƠN VỊ:
                            </label>
                            <input
                              type="text"
                              value={newProductUnit}
                              onChange={e => setNewProductUnit(e.target.value)}
                              placeholder="Thùng (20kg)..."
                              className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs font-bold text-white outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {getProductAvailableUnits(
                            selectedNewProduct,
                            position?.unit || 'Thùng'
                          ).map(u => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setNewProductUnit(u)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                                newProductUnit === u
                                  ? 'bg-sky-950/70 border-sky-400 text-sky-300'
                                  : 'bg-slate-800 border-slate-700 text-slate-300'
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={handleConfirmAddProductToLot}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 active:scale-[0.99]"
                        >
                          <PlusCircle size={16} />
                          <span>THÊM VÀO LOT NÀY</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── FORM CHI TIẾT: CHUYỂN Ô ── */}
          {actionType === 'MOVE' && (
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-sky-500/30 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-black text-sky-300 uppercase">
                  VỊ TRÍ ĐÍCH CHUYỂN ĐẾN (MÃ Ô):
                </span>
                <button
                  type="button"
                  onClick={() => setOnlyEmptySuggestions(prev => !prev)}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 ${
                    onlyEmptySuggestions
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <CheckCircle2 size={12} />
                  <span>Chỉ ô trống</span>
                </button>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-950">
                <input
                  type="text"
                  value={targetPosCode}
                  onChange={e => {
                    setTargetPosCode(e.target.value)
                    setTargetPosId(null)
                  }}
                  placeholder="Nhập hoặc chọn gợi ý bên dưới..."
                  className="flex-1 min-w-0 bg-transparent text-sm font-mono font-black text-white uppercase outline-none placeholder:text-slate-500"
                />
                {targetPosCode.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPosCode('')
                      setTargetPosId(null)
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase">
                    {targetPosCode.trim()
                      ? `GỢI Ý KHỚP TỪ KHÓA (${positionSuggestions.length}):`
                      : `GỢI Ý Ô GẦN KỀ CÙNG DÃY (${positionSuggestions.length}):`}
                  </span>
                  {targetPosId && (
                    <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      <span>Đã khớp ô</span>
                    </span>
                  )}
                </div>

                {positionSuggestions.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">
                    Không tìm thấy vị trí nào phù hợp. Bạn vẫn có thể nhập trực tiếp mã ô.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto overscroll-y-contain no-scrollbar">
                    {positionSuggestions.map(sp => {
                      const isSelected =
                        (sp.code || '').toUpperCase() === targetPosCode.trim().toUpperCase()
                      const isEmpty = !sp.lot_id
                      return (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => handleSelectTargetPosition(sp)}
                          className={`p-2 rounded-xl border text-left transition ${
                            isSelected
                              ? 'bg-sky-950/70 border-sky-400 ring-1 ring-sky-400/50'
                              : isEmpty
                              ? 'bg-slate-950/70 border-emerald-500/30 hover:border-emerald-400'
                              : 'bg-slate-950/70 border-amber-500/30 hover:border-amber-400'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-xs font-mono font-black truncate ${
                                isSelected ? 'text-sky-300' : 'text-white'
                              }`}
                            >
                              {sp.code}
                            </span>
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isEmpty ? 'bg-emerald-400' : 'bg-amber-400'
                              }`}
                            />
                          </div>
                          <div
                            className={`text-[10px] truncate mt-0.5 ${
                              isEmpty ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {isEmpty ? '🟢 Trống' : `🔴 ${sp.product_name || 'Có hàng'}`}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── FORM CHI TIẾT: XUẤT RỖNG ── */}
          {actionType === 'CLEAR' && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-2 text-xs font-bold text-rose-200">
              <Info size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <span>
                {hasMultipleProducts
                  ? `Xác nhận bốc xuất sạch cả ${subItems.length} sản phẩm (ô trở thành rỗng).`
                  : 'Xác nhận ô này đã bốc xuất sạch hàng (Web sẽ bấm Trừ vị trí X).'}
              </span>
            </div>
          )}

          {/* Ghi chú */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                GHI CHÚ {actionType === 'NOTE' ? '(BẮT BUỘC)' : '(TÙY CHỌN)'}:
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-sky-400/90">Nói AI</span>
                <VoiceMicButton
                  size="sm"
                  saveToServer
                  rootFolderOverride={DRAFT_VOICE_ROOT_FOLDER}
                  systemCode="KHO_DONG_LANH"
                  sessionId={DRAFT_VOICE_SESSION_ID}
                  sessionName="Ghi_Nhap_So_Do_Kho"
                  positionId={position.id}
                  positionCode={position.code || null}
                  vocabulary={voiceVocabulary}
                  onResult={handleVoiceResult}
                  onOfflineAudio={payload => void handleVoiceOfflineSaved(payload)}
                  onError={msg => setVoiceNotice(msg)}
                />
              </div>
            </div>
            <textarea
              ref={noteInputRef}
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={
                actionType === 'NOTE'
                  ? 'Nhập lời nhắn hoặc bấm Micro nói để AI dịch ghi chú...'
                  : 'Nhập ghi chú hoặc bấm Micro nói để AI dịch (nếu có)...'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-xs font-semibold text-white outline-none focus:border-amber-500 resize-none placeholder:text-slate-500"
            />

            {voiceNotice && (
              <p className="mt-1.5 text-[11px] font-semibold text-amber-300">
                ⚠️ {voiceNotice}
              </p>
            )}

            {(savedVoiceUrls.length > 0 || pendingVoices.length > 0) && (
              <div className="mt-2 space-y-1.5">
                {savedVoiceUrls.map((url, idx) => {
                  const key = `saved_${idx}_${url}`
                  const isPlaying = playingVoiceKey === key
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-sky-500/12 border border-sky-500/35"
                    >
                      <button
                        type="button"
                        onClick={() => handleTogglePlayAudioSource(key, url)}
                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                      >
                        {isPlaying ? (
                          <PauseCircle size={15} className="text-sky-400 shrink-0" />
                        ) : (
                          <Volume2 size={15} className="text-sky-400 shrink-0" />
                        )}
                        <span className="text-[11px] font-extrabold text-sky-200 truncate">
                          {isPlaying
                            ? 'Đang phát... (bấm dừng)'
                            : savedVoiceUrls.length > 1
                              ? `Nghe lại ghi âm #${idx + 1} (Drive)`
                              : 'Nghe lại ghi âm đã lưu (Drive)'}
                        </span>
                      </button>
                    </div>
                  )
                })}

                {pendingVoices.map(rv => {
                  const isPlaying = playingVoiceKey === rv.key
                  const isTranscribing = transcribingVoiceKey === rv.key
                  return (
                    <div
                      key={rv.key}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-amber-500/12 border border-amber-500/35"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleTogglePlayAudioSource(
                            rv.key,
                            `data:${rv.mimeType || 'audio/webm'};base64,${rv.audioBase64}`
                          )
                        }
                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                      >
                        {isPlaying ? (
                          <PauseCircle size={15} className="text-amber-400 shrink-0" />
                        ) : (
                          <Volume2 size={15} className="text-amber-400 shrink-0" />
                        )}
                        <span className="text-[11px] font-extrabold text-amber-200 truncate">
                          {isPlaying ? 'Đang phát... (bấm dừng)' : `Nghe lại (${rv.durationSec}s)`}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(transcribingVoiceKey)}
                        onClick={() => void handleTranscribeRecordedVoice(rv)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/25 hover:bg-violet-500/35 border border-violet-400/50 text-violet-100 text-[11px] font-extrabold shrink-0 disabled:opacity-60 active:scale-95 transition"
                      >
                        {isTranscribing ? (
                          <Loader2 size={12} className="animate-spin text-violet-200" />
                        ) : (
                          <Cpu size={12} className="text-violet-200" />
                        )}
                        <span>{isTranscribing ? 'Đang dịch...' : 'Dịch'}</span>
                      </button>

                      {!isTranscribing && (
                        <button
                          type="button"
                          onClick={() => void handleDeletePendingVoice(rv.key)}
                          className="p-1 text-rose-400 hover:text-rose-300 shrink-0"
                          title="Xóa đoạn ghi âm"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-slate-800 bg-[#111827]">
          {existingDraftItem && onRemoveItem && (
            <button
              type="button"
              onClick={() => {
                onRemoveItem(position.id)
                onClose()
              }}
              className="px-3 py-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-black flex items-center gap-1 shrink-0 active:scale-95"
            >
              <Trash2 size={14} />
              <span>Xóa nháp</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99]"
          >
            <Check size={16} />
            <span>{existingDraftItem ? 'CẬP NHẬT GHI NHÁP' : 'LƯU VÀO PHIẾU NHÁP'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
