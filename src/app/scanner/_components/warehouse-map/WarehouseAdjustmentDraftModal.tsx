'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Trash2,
  Edit3,
  PlusCircle,
  ArrowRightLeft,
  Check,
  Search,
  MapPin,
  Package,
  MessageSquare,
  Plus,
  Minus,
  Loader2,
} from 'lucide-react'
import type {
  PositionItem,
  ProposalActionType,
  ProposalItem,
  ProposalSubItem,
  LookedUpLot,
  ProductSuggestion,
} from './types'
import { extractSubItemsFromPosition } from './mapHelpers'
import { lookupLotBySttOrCode, fetchProductsForSuggestions } from './warehouseAdjustmentService'
import { normalizeSearchString } from '@/lib/searchUtils'

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
const QUICK_UNITS = ['Thùng', 'Kg', 'Sọt', 'Bao', 'Cây', 'Bịch']

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
  const hasExistingLot = !!(position?.lot_id || position?.product_name || position?.stt)

  const initialSubItems = useMemo(
    () => (position ? extractSubItemsFromPosition(position) : []),
    [position]
  )

  const [action, setAction] = useState<ProposalActionType>('NOTE')
  const [newQtyText, setNewQtyText] = useState<string>('')
  const [subItemsDraft, setSubItemsDraft] = useState<ProposalSubItem[]>([])

  // Add new product into lot state
  const [showAddProductForm, setShowAddProductForm] = useState(false)
  const [allProducts, setAllProducts] = useState<ProductSuggestion[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [newProdSearch, setNewProdSearch] = useState('')
  const [selectedNewProd, setSelectedNewProd] = useState<ProductSuggestion | null>(null)
  const [newProdQtyText, setNewProdQtyText] = useState('1')
  const [newProdUnit, setNewProdUnit] = useState('Thùng')

  // Assign Lot state
  const [newSttText, setNewSttText] = useState<string>('')
  const [newProductNameText, setNewProductNameText] = useState<string>('')
  const [newUnitText, setNewUnitText] = useState<string>('Thùng')
  const [lookingUpLot, setLookingUpLot] = useState(false)
  const [lookedUpLot, setLookedUpLot] = useState<LookedUpLot | null>(null)

  // Move position state
  const [targetPosCode, setTargetPosCode] = useState<string>('')
  const [onlyEmptyTarget, setOnlyEmptyTarget] = useState<boolean>(true)
  const [reasonText, setReasonText] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!position || !visible) return
    setErrorMsg(null)

    if (existingDraftItem) {
      setAction(existingDraftItem.action)
      setNewQtyText(
        existingDraftItem.new_qty !== null && existingDraftItem.new_qty !== undefined
          ? String(existingDraftItem.new_qty)
          : position.quantity !== null && position.quantity !== undefined
          ? String(position.quantity)
          : ''
      )
      setSubItemsDraft(
        existingDraftItem.sub_items && existingDraftItem.sub_items.length > 0
          ? existingDraftItem.sub_items.map(s => ({ ...s }))
          : extractSubItemsFromPosition(position)
      )
      setNewSttText(existingDraftItem.new_stt || '')
      setNewProductNameText(existingDraftItem.new_product_name || '')
      setNewUnitText(existingDraftItem.new_unit || position.unit || 'Thùng')
      setTargetPosCode(existingDraftItem.target_position_code || '')
      setReasonText(existingDraftItem.reason || '')
      setLookedUpLot(null)
      setShowAddProductForm(false)
    } else {
      setAction('NOTE')
      setNewQtyText(
        position.quantity !== null && position.quantity !== undefined
          ? String(position.quantity)
          : ''
      )
      setSubItemsDraft(extractSubItemsFromPosition(position))
      setNewSttText('')
      setNewProductNameText('')
      setNewUnitText(position.unit || 'Thùng')
      setTargetPosCode('')
      setReasonText('')
      setLookedUpLot(null)
      setShowAddProductForm(false)
    }
  }, [position, existingDraftItem, visible])

  // Auto lookup Lot when typing STT in ASSIGN_LOT mode
  useEffect(() => {
    if (action !== 'ASSIGN_LOT') return
    const clean = newSttText.replace(/^#/, '').trim()
    if (!clean) {
      setLookedUpLot(null)
      return
    }

    const localMatch = availablePositions.find(
      p =>
        (p.stt && p.stt.toUpperCase() === clean.toUpperCase()) ||
        (p.lot_code && p.lot_code.toUpperCase() === clean.toUpperCase())
    )

    if (localMatch && localMatch.product_name) {
      const found: LookedUpLot = {
        id: localMatch.lot_id || localMatch.id,
        code: localMatch.lot_code || '',
        stt: localMatch.stt || clean,
        product_name: localMatch.product_name,
        sku: localMatch.sku || null,
        quantity: localMatch.quantity ?? 0,
        unit: localMatch.unit || 'Thùng',
        current_position_code: localMatch.code,
      }
      setLookedUpLot(found)
      setNewProductNameText(found.product_name)
      setNewQtyText(String(found.quantity))
      setNewUnitText(found.unit)
      return
    }

    const timer = setTimeout(async () => {
      setLookingUpLot(true)
      try {
        const res = await lookupLotBySttOrCode(clean)
        setLookedUpLot(res)
        if (res) {
          setNewProductNameText(res.product_name)
          setNewQtyText(String(res.quantity))
          setNewUnitText(res.unit)
        }
      } finally {
        setLookingUpLot(false)
      }
    }, 320)

    return () => clearTimeout(timer)
  }, [newSttText, action, availablePositions])

  useEffect(() => {
    if (!showAddProductForm || allProducts.length > 0) return
    let mounted = true
    setLoadingProducts(true)
    fetchProductsForSuggestions()
      .then(list => {
        if (mounted) setAllProducts(list)
      })
      .finally(() => {
        if (mounted) setLoadingProducts(false)
      })
    return () => {
      mounted = false
    }
  }, [showAddProductForm, allProducts.length])

  const productSuggestions = useMemo(() => {
    const q = normalizeSearchString(newProdSearch.trim(), true)
    if (!q) return allProducts.slice(0, 8)
    const tokens = q.split(/\s+/).filter(Boolean)

    return allProducts
      .filter(p => {
        const hay = normalizeSearchString(`${p.sku} ${p.name} ${p.aliases.join(' ')}`, true)
        return tokens.every((t: string) => hay.includes(t))
      })
      .slice(0, 8)
  }, [newProdSearch, allProducts])

  const movePositionSuggestions = useMemo(() => {
    if (action !== 'MOVE' || !position) return []
    const q = targetPosCode.trim().toUpperCase()
    const currentPrefix = position.code.slice(0, 6).toUpperCase()

    const getTierRank = (code: string): number => {
      const m = code.toUpperCase().match(/T(\d+)/)
      return m ? parseInt(m[1], 10) : 99
    }

    const candidates = availablePositions.filter(p => {
      if (p.id === position.id) return false
      const isEmpty = !p.lot_id && !p.product_name && !p.stt
      if (onlyEmptyTarget && !isEmpty) return false
      if (!q) return p.code.toUpperCase().startsWith(currentPrefix)
      return p.code.toUpperCase().includes(q)
    })

    candidates.sort((a, b) => {
      const codeA = a.code.toUpperCase()
      const codeB = b.code.toUpperCase()

      if (q) {
        const startsA = codeA.startsWith(q) ? 0 : 1
        const startsB = codeB.startsWith(q) ? 0 : 1
        if (startsA !== startsB) return startsA - startsB
      }

      const sameAisleA = codeA.startsWith(currentPrefix) ? 0 : 1
      const sameAisleB = codeB.startsWith(currentPrefix) ? 0 : 1
      if (sameAisleA !== sameAisleB) return sameAisleA - sameAisleB

      const tierA = getTierRank(codeA)
      const tierB = getTierRank(codeB)
      if (tierA !== tierB) return tierA - tierB

      return codeA.localeCompare(codeB, undefined, { numeric: true })
    })

    return candidates.slice(0, 12)
  }, [action, targetPosCode, onlyEmptyTarget, availablePositions, position])

  if (!visible || !position) return null

  const isMultiSubItems = subItemsDraft.length > 1

  const handleQuickAdjustQty = (delta: number) => {
    const cur = parseFloat(newQtyText.replace(',', '.'))
    const base = isNaN(cur) ? position.quantity || 0 : cur
    const next = Math.max(0, Number((base + delta).toFixed(2)))
    setNewQtyText(String(next))
  }

  const handleUpdateSubItemQty = (idx: number, valStr: string) => {
    const parsed = parseFloat(valStr.replace(',', '.'))
    setSubItemsDraft(prev => {
      const copy = [...prev]
      copy[idx] = {
        ...copy[idx],
        new_qty: isNaN(parsed) ? 0 : Math.max(0, parsed),
      }
      return copy
    })
  }

  const handleStepSubItemQty = (idx: number, delta: number) => {
    setSubItemsDraft(prev => {
      const copy = [...prev]
      const cur = typeof copy[idx]?.new_qty === 'number' ? copy[idx].new_qty! : copy[idx]?.old_qty || 0
      const next = Math.max(0, Number((cur + delta).toFixed(2)))
      copy[idx] = { ...copy[idx], new_qty: next }
      return copy
    })
  }

  const handleConfirmAddSubItem = () => {
    const prodName = selectedNewProd ? selectedNewProd.name : newProdSearch.trim()
    if (!prodName) {
      setErrorMsg('Vui lòng chọn hoặc nhập tên sản phẩm cần thêm vào Lot!')
      return
    }
    const parsedQty = parseFloat(newProdQtyText.replace(',', '.'))
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setErrorMsg('Vui lòng nhập số lượng hợp lệ (> 0) cho sản phẩm thêm mới!')
      return
    }

    const unitToUse = (selectedNewProd?.unit || newProdUnit || 'Thùng').trim()
    setErrorMsg(null)

    setSubItemsDraft(prev => {
      let baseList = [...prev]
      if (baseList.length === 0 && position?.product_name) {
        baseList = [
          {
            product_id: null,
            sku: position.sku || null,
            product_name: position.product_name,
            old_qty: position.quantity ?? 0,
            new_qty: parseFloat(newQtyText.replace(',', '.')) || (position.quantity ?? 0),
            unit: position.unit || 'Thùng',
          },
        ]
      }

      return [
        ...baseList,
        {
          product_id: selectedNewProd?.id || null,
          sku: selectedNewProd?.sku || null,
          product_name: prodName,
          old_qty: 0,
          new_qty: parsedQty,
          unit: unitToUse,
          is_new: true,
        },
      ]
    })

    setShowAddProductForm(false)
    setNewProdSearch('')
    setSelectedNewProd(null)
    setNewProdQtyText('1')
  }

  const handleRemoveNewSubItem = (idx: number) => {
    setSubItemsDraft(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    setErrorMsg(null)
    const parsedQty = newQtyText.trim() !== '' ? parseFloat(newQtyText.replace(',', '.')) : null

    if (action === 'NOTE' && !reasonText.trim()) {
      setErrorMsg('Vui lòng nhập nội dung ghi chú cho vị trí này!')
      return
    }

    if (action === 'SET_QTY') {
      if (!isMultiSubItems && (parsedQty === null || isNaN(parsedQty) || parsedQty < 0)) {
        setErrorMsg('Vui lòng nhập số lượng thực tế hợp lệ!')
        return
      }
    }

    if (action === 'ASSIGN_LOT' && !newSttText.trim() && !newProductNameText.trim()) {
      setErrorMsg('Vui lòng nhập STT Lot (ví dụ: G57) hoặc tên sản phẩm thực tế tại ô này!')
      return
    }

    if (action === 'MOVE' && !targetPosCode.trim()) {
      setErrorMsg('Vui lòng chọn hoặc nhập mã vị trí mới cần chuyển sang!')
      return
    }

    const totalSubQty =
      action === 'SET_QTY' && isMultiSubItems
        ? subItemsDraft.reduce((s, it) => s + (Number(it.new_qty) || 0), 0)
        : parsedQty

    const item: ProposalItem = {
      position_id: position.id,
      position_code: position.code,
      zone_path: zonePath || 'Chưa rõ khu vực',
      old_lot_id: position.lot_id || null,
      old_lot_code: position.lot_code || null,
      old_stt: position.stt || null,
      old_product_name: position.product_name || null,
      old_sku: position.sku || null,
      old_qty: position.quantity ?? null,
      old_unit: position.unit || null,
      action,
      new_qty:
        action === 'SET_QTY' || action === 'ASSIGN_LOT'
          ? totalSubQty !== null && !isNaN(totalSubQty as number)
            ? totalSubQty
            : null
          : action === 'CLEAR'
          ? 0
          : null,
      new_stt:
        action === 'ASSIGN_LOT'
          ? lookedUpLot?.stt || newSttText.trim() || null
          : null,
      new_lot_code: action === 'ASSIGN_LOT' ? lookedUpLot?.code || null : null,
      new_product_name:
        action === 'ASSIGN_LOT'
          ? lookedUpLot?.product_name || newProductNameText.trim() || null
          : action === 'SET_QTY' && !hasExistingLot
          ? newProductNameText.trim() || null
          : null,
      new_sku: action === 'ASSIGN_LOT' ? lookedUpLot?.sku || null : null,
      new_unit:
        action === 'ASSIGN_LOT' || action === 'SET_QTY'
          ? lookedUpLot?.unit || newUnitText.trim() || position.unit || 'Thùng'
          : null,
      target_position_code:
        action === 'MOVE' ? targetPosCode.trim().toUpperCase() : null,
      sub_items:
        action === 'SET_QTY' && subItemsDraft.length > 0 ? subItemsDraft : null,
      reason: reasonText.trim() || null,
      updated_at: new Date().toISOString(),
    }

    onSaveItem(item)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[115] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900">
          <div className="min-w-0 pr-2">
            <h3 className="text-[16px] font-black text-slate-900 dark:text-white tracking-tight">
              ✏️ Ghi nháp vị trí: {position.code}
            </h3>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
              📍 {zonePath || 'Sơ đồ kho'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Current status card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              HIỆN TRẠNG TRÊN HỆ THỐNG
            </div>
            {hasExistingLot ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {position.stt && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-black">
                        #{position.stt}
                      </span>
                    )}
                    {position.sku && (
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold font-mono">
                        {position.sku}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                    Tổng: {position.quantity ?? 0} {position.unit || 'Thùng'}
                  </span>
                </div>

                {initialSubItems.length > 1 ? (
                  <div className="pt-1 space-y-1 border-t border-slate-200/70 dark:border-slate-700/60">
                    {initialSubItems.map((sub, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-700 dark:text-slate-300 font-semibold truncate">
                          • {sub.product_name}
                        </span>
                        <span className="font-black text-slate-900 dark:text-white shrink-0">
                          {sub.old_qty} {sub.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {position.product_name || 'Chưa rõ sản phẩm'}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs font-semibold text-slate-400 italic">
                Ô đang trống trên hệ thống
              </div>
            )}
          </div>

          {/* 1. Chọn thao tác đề xuất */}
          <div>
            <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-2">
              1. Chọn thao tác đề xuất:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAction('NOTE')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  action === 'NOTE'
                    ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <MessageSquare size={15} />
                  <span>Chỉ ghi chú</span>
                </div>
                <div
                  className={`text-[10px] mt-0.5 ${
                    action === 'NOTE' ? 'text-violet-100' : 'text-slate-400'
                  }`}
                >
                  Gửi lời nhắn cho Web đọc
                </div>
              </button>

              {hasExistingLot && (
                <button
                  type="button"
                  onClick={() => setAction('CLEAR')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    action === 'CLEAR'
                      ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-black">
                    <Trash2 size={15} />
                    <span>Xuất rỗng ô</span>
                  </div>
                  <div
                    className={`text-[10px] mt-0.5 ${
                      action === 'CLEAR' ? 'text-rose-100' : 'text-slate-400'
                    }`}
                  >
                    Thực tế đã trống (Trừ vị trí)
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => setAction('ASSIGN_LOT')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  action === 'ASSIGN_LOT'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <PlusCircle size={15} />
                  <span>Gắn STT Lot</span>
                </div>
                <div
                  className={`text-[10px] mt-0.5 ${
                    action === 'ASSIGN_LOT' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  Nhập G57, G88... vào ô này
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAction('SET_QTY')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  action === 'SET_QTY'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <Edit3 size={15} />
                  <span>{hasExistingLot ? 'Sửa số lượng' : 'Tạo Lot mới'}</span>
                </div>
                <div
                  className={`text-[10px] mt-0.5 ${
                    action === 'SET_QTY' ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {hasExistingLot ? 'Chỉnh số lượng / thêm SP' : 'Đề xuất tạo Lot mới tại ô'}
                </div>
              </button>

              {hasExistingLot && (
                <button
                  type="button"
                  onClick={() => setAction('MOVE')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    action === 'MOVE'
                      ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-black">
                    <ArrowRightLeft size={15} />
                    <span>Chuyển ô</span>
                  </div>
                  <div
                    className={`text-[10px] mt-0.5 ${
                      action === 'MOVE' ? 'text-amber-100' : 'text-slate-400'
                    }`}
                  >
                    Sang vị trí mới
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* 2. Form chi tiết theo Action */}
          {action === 'NOTE' && (
            <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/60 text-xs font-semibold text-violet-800 dark:text-violet-300">
              💬 Chế độ <b>Chỉ ghi chú</b>: Dùng khi bạn muốn nhắn bất kỳ thông tin gì về ô{' '}
              <b>{position.code}</b> cho người duyệt trên Web xem.
            </div>
          )}

          {action === 'CLEAR' && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold text-rose-800 dark:text-rose-300">
              ⚠️ Đề xuất: Vị trí <b>{position.code}</b> thực tế đang trống (Web sẽ bấm{' '}
              <b>Trừ vị trí X</b> trên quản lý Lot).
            </div>
          )}

          {action === 'SET_QTY' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
              {!hasExistingLot && (
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Tên sản phẩm / Quy cách cần tạo Lot mới:
                  </label>
                  <input
                    type="text"
                    value={newProductNameText}
                    onChange={e => setNewProductNameText(e.target.value)}
                    placeholder="Nhập tên sản phẩm thực tế tại ô này..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {isMultiSubItems ? (
                <div className="space-y-2.5">
                  <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    Chỉnh số lượng từng mặt hàng trong Pallet:
                  </div>
                  {subItemsDraft.map((sub, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border space-y-2 ${
                        sub.is_new
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {sub.is_new && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black">
                                + MỚI THÊM
                              </span>
                            )}
                            {sub.sku && (
                              <span className="text-[10px] font-bold font-mono text-blue-600 dark:text-blue-400">
                                {sub.sku}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                            {sub.product_name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {sub.is_new
                              ? `Đơn vị: ${sub.unit}`
                              : `Cũ: ${sub.old_qty} ${sub.unit}`}
                          </div>
                        </div>

                        {sub.is_new && (
                          <button
                            type="button"
                            onClick={() => handleRemoveNewSubItem(idx)}
                            className="p-1 text-rose-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStepSubItemQty(idx, -1)}
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95"
                        >
                          <Minus size={15} />
                        </button>
                        <input
                          type="number"
                          value={String(sub.new_qty ?? 0)}
                          onChange={e => handleUpdateSubItemQty(idx, e.target.value)}
                          className="flex-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center text-sm font-black text-slate-900 dark:text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleStepSubItemQty(idx, +1)}
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    Số lượng thực tế (mới):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={newQtyText}
                      onChange={e => setNewQtyText(e.target.value)}
                      placeholder="Nhập SL..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={newUnitText}
                      onChange={e => setNewUnitText(e.target.value)}
                      placeholder="Đơn vị"
                      className="w-24 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                    />
                  </div>

                  {/* Quick Delta Buttons */}
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 mb-1">
                      Cộng / trừ nhanh từ số đang nhập:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_QTY_DELTAS.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleQuickAdjustQty(d)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                            d < 0
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {d > 0 ? `+${d}` : d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Thêm sản phẩm mới vào Lot hiện tại */}
              {hasExistingLot && (
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60">
                  {!showAddProductForm ? (
                    <button
                      type="button"
                      onClick={() => setShowAddProductForm(true)}
                      className="w-full py-2 px-3 rounded-xl border border-dashed border-blue-400 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 text-xs font-extrabold flex items-center justify-center gap-1.5"
                    >
                      <PlusCircle size={15} />
                      <span>+ Thêm sản phẩm vào Lot này</span>
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-blue-700 dark:text-blue-300">
                          ➕ Thêm mặt hàng mới vào Lot
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddProductForm(false)
                            setSelectedNewProd(null)
                            setNewProdSearch('')
                          }}
                          className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
                        >
                          Đóng
                        </button>
                      </div>

                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <Search size={14} className="text-slate-400 shrink-0" />
                        <input
                          type="text"
                          value={newProdSearch}
                          onChange={e => {
                            setNewProdSearch(e.target.value)
                            setSelectedNewProd(null)
                          }}
                          placeholder="Gõ tên viết tắt, mã SKU hoặc tên SP..."
                          className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none"
                        />
                        {loadingProducts && <Loader2 size={14} className="animate-spin text-blue-600" />}
                      </div>

                      {!selectedNewProd && productSuggestions.length > 0 && (
                        <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                          {productSuggestions.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedNewProd(p)
                                setNewProdSearch(p.name)
                                setNewProdUnit(p.unit || 'Thùng')
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-black font-mono text-blue-600 dark:text-blue-400">
                                    {p.sku}
                                  </span>
                                  {p.aliases.length > 0 && (
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                      ⚡ {p.aliases.slice(0, 2).join(', ')}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                  {p.name}
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                {p.unit}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedNewProd && (
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          <Package size={14} />
                          <span className="truncate">
                            Đã chọn: [{selectedNewProd.sku}] {selectedNewProd.name}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            Số lượng thêm:
                          </label>
                          <input
                            type="number"
                            value={newProdQtyText}
                            onChange={e => setNewProdQtyText(e.target.value)}
                            placeholder="VD: 5"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-black text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            Đơn vị:
                          </label>
                          <input
                            type="text"
                            value={newProdUnit}
                            onChange={e => setNewProdUnit(e.target.value)}
                            placeholder="Thùng / Kg..."
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {QUICK_UNITS.map(u => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setNewProdUnit(u)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              newProdUnit === u
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleConfirmAddSubItem}
                        className="w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center gap-1"
                      >
                        <Check size={14} />
                        <span>Xác nhận thêm sản phẩm này</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {action === 'ASSIGN_LOT' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1">
                  Nhập STT Lot hoặc Mã Lot đang nằm tại ô {position.code}:
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <Search size={15} className="text-emerald-600 shrink-0" />
                  <input
                    type="text"
                    value={newSttText}
                    onChange={e => setNewSttText(e.target.value)}
                    placeholder="Ví dụ: G57, 57, hoặc LOT-2603..."
                    className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none"
                  />
                  {lookingUpLot && <Loader2 size={14} className="animate-spin text-emerald-600" />}
                </div>
              </div>

              {lookedUpLot ? (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1">
                  <div className="flex items-center justify-between text-xs font-black text-emerald-800 dark:text-emerald-300">
                    <span>✅ Tìm thấy Lot #{lookedUpLot.stt}</span>
                    {lookedUpLot.code && (
                      <span className="font-mono text-[11px]">{lookedUpLot.code}</span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {lookedUpLot.product_name}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    <span>
                      SL: {lookedUpLot.quantity} {lookedUpLot.unit}
                    </span>
                    {lookedUpLot.current_position_code && (
                      <span>Đang ở: {lookedUpLot.current_position_code}</span>
                    )}
                  </div>
                </div>
              ) : newSttText.trim().length > 0 && !lookingUpLot ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    Chưa tìm thấy tự động mã &quot;{newSttText}&quot; — bạn có thể nhập tay thông tin bên dưới:
                  </div>
                  <input
                    type="text"
                    value={newProductNameText}
                    onChange={e => setNewProductNameText(e.target.value)}
                    placeholder="Tên sản phẩm (tùy chọn)..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={newQtyText}
                      onChange={e => setNewQtyText(e.target.value)}
                      placeholder="Số lượng"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white outline-none"
                    />
                    <input
                      type="text"
                      value={newUnitText}
                      onChange={e => setNewUnitText(e.target.value)}
                      placeholder="Đơn vị"
                      className="w-24 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {action === 'MOVE' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  Chọn vị trí mới cần chuyển sang:
                </span>
                <button
                  type="button"
                  onClick={() => setOnlyEmptyTarget(!onlyEmptyTarget)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                    onlyEmptyTarget
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {onlyEmptyTarget ? '✓ Chỉ ô trống' : 'Tất cả ô'}
                </button>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <MapPin size={15} className="text-amber-600 shrink-0" />
                <input
                  type="text"
                  value={targetPosCode}
                  onChange={e => setTargetPosCode(e.target.value.toUpperCase())}
                  placeholder="Nhập hoặc chạm chọn mã vị trí bên dưới..."
                  className="flex-1 bg-transparent text-xs font-black font-mono text-slate-900 dark:text-white outline-none uppercase"
                />
                {targetPosCode.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTargetPosCode('')}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {movePositionSuggestions.length > 0 && (
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 mb-1.5">
                    Gợi ý nhanh ({onlyEmptyTarget ? 'ô đang trống' : 'vị trí trong kho'}):
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {movePositionSuggestions.map(p => {
                      const selected = targetPosCode.toUpperCase() === p.code.toUpperCase()
                      const isEmpty = !p.lot_id && !p.product_name && !p.stt
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setTargetPosCode(p.code)}
                          className={`p-2 rounded-xl border text-left transition-all ${
                            selected
                              ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="text-[11px] font-black font-mono truncate">{p.code}</div>
                          <div
                            className={`text-[9px] font-bold truncate ${
                              selected
                                ? 'text-amber-100'
                                : isEmpty
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {isEmpty ? 'Trống' : `#${p.stt || 'Có hàng'}`}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ghi chú / Lý do */}
          <div>
            <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">
              {action === 'NOTE'
                ? 'Nội dung ghi chú gửi lên Web (bắt buộc):'
                : 'Ghi chú gửi kèm cho Web (tùy chọn):'}
            </label>
            <textarea
              rows={action === 'NOTE' ? 3 : 2}
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              placeholder={
                action === 'NOTE'
                  ? 'Nhập lời nhắn của bạn về vị trí này (VD: Hàng rách thùng, cần dồn kệ, sai ngày đóng gói...)'
                  : 'VD: Đã xuất ca sáng, kiểm đếm thực tế thiếu 2 thùng...'
              }
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {existingDraftItem && onRemoveItem && (
            <button
              type="button"
              onClick={() => {
                onRemoveItem(position.id)
                onClose()
              }}
              className="px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1"
            >
              <Trash2 size={14} />
              <span>Bỏ nháp</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99]"
          >
            <Check size={15} />
            <span>Lưu vào phiếu nháp</span>
          </button>
        </div>
      </div>
    </div>
  )
}
