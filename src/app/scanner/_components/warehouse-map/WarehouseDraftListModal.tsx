'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X,
  Trash2,
  Send,
  Edit2,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search,
  Loader2,
  ClipboardList,
  BarChart3,
  Package,
  TrendingDown,
  TrendingUp,
  Calendar,
} from 'lucide-react'
import type { DraftProposal, ProposalItem, SubmittedProposal, ProductSuggestion } from './types'
import {
  fetchSubmittedProposals,
  getCachedSubmittedProposals,
  fetchProductsForSuggestions,
} from './warehouseAdjustmentService'
import { matchSearch, calculateSearchScore, normalizeSearchString } from '@/lib/searchUtils'

interface Props {
  visible: boolean
  draft: DraftProposal
  initialTab?: 'DRAFT' | 'SUBMITTED'
  onClose: () => void
  onEditItem: (item: ProposalItem) => void
  onRemoveItem: (positionId: string) => void
  onClearAll: () => void
  onSubmitProposal: (note: string) => Promise<void>
}

type MovementKind =
  | 'CLEAR'
  | 'CREATE_LOT'
  | 'ADD_TO_LOT'
  | 'INCREASE'
  | 'DECREASE'
  | 'UNCHANGED'
  | 'MOVE'
  | 'ASSIGN_LOT'
  | 'NOTE'

interface ActionTag {
  label: string
  tone: 'emerald' | 'rose' | 'amber' | 'sky' | 'purple' | 'slate'
}

interface MovementEntry {
  key: string
  proposal: SubmittedProposal
  item: ProposalItem
  timestamp: string
  productName: string
  sku: string | null
  aliases: string[]
  unit: string
  beforeQty: number | null
  afterQty: number | null
  delta: number
  changeKind: MovementKind
}

function getTodayDateStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getLocalDateStr(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function normalizeUnitLabel(unit?: string | null): string {
  const raw = (unit || 'Thùng').trim()
  if (!raw) return 'Thùng'
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function formatNumberVN(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString('vi-VN')
    : Number(n.toFixed(2)).toLocaleString('vi-VN')
}

function formatUnitTotalsMap(map: Map<string, number>, prefix = ''): string {
  const entries = Array.from(map.entries()).filter(([, val]) => Math.abs(val) > 0.0001)
  if (entries.length === 0) return '0'
  return entries
    .map(([unit, val]) => {
      const sign = prefix === 'signed' ? (val > 0 ? '+' : '') : prefix
      return `${sign}${formatNumberVN(val)} ${unit}`
    })
    .join(' · ')
}

export default function WarehouseDraftListModal({
  visible,
  draft,
  initialTab = 'DRAFT',
  onClose,
  onEditItem,
  onRemoveItem,
  onClearAll,
  onSubmitProposal,
}: Props) {
  const [activeTab, setActiveTab] = useState<'DRAFT' | 'SUBMITTED'>(initialTab)
  const [notes, setNotes] = useState(draft.notes || '')
  const [submitting, setSubmitting] = useState(false)
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  // Submitted proposals state
  const [submittedList, setSubmittedList] = useState<SubmittedProposal[]>([])
  const [loadingSubmitted, setLoadingSubmitted] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
  const [submittedPosSearch, setSubmittedPosSearch] = useState<string>('')
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null)

  // Chế độ xem Biến động SP trong tab Lịch sử
  const [historyViewMode, setHistoryViewMode] = useState<'LIST' | 'MOVEMENTS'>('LIST')
  const [movementDateFilter, setMovementDateFilter] = useState<string>(() => getTodayDateStr())
  const [productQuery, setProductQuery] = useState<string>('')
  const [selectedProductFilter, setSelectedProductFilter] = useState<{
    name: string
    sku: string | null
  } | null>(null)
  const [showProductSuggestions, setShowProductSuggestions] = useState(false)
  const [productCatalog, setProductCatalog] = useState<ProductSuggestion[]>([])

  const loadSubmitted = useCallback(async () => {
    setLoadingSubmitted(true)
    try {
      const list = await fetchSubmittedProposals()
      setSubmittedList(list)
    } finally {
      setLoadingSubmitted(false)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    setActiveTab(initialTab)
    setNotes(draft.notes || '')
    setConfirmClearAll(false)
    getCachedSubmittedProposals().then(cached => {
      if (cached.length > 0) setSubmittedList(cached)
    })
    void loadSubmitted()
  }, [visible, initialTab, draft.notes, loadSubmitted])

  // Tải danh mục sản phẩm khi mở chế độ Biến động SP (để hỗ trợ tìm theo tên viết tắt aliases)
  useEffect(() => {
    if (!visible || historyViewMode !== 'MOVEMENTS' || productCatalog.length > 0) return
    fetchProductsForSuggestions().then(list => {
      if (list && list.length > 0) setProductCatalog(list)
    })
  }, [visible, historyViewMode, productCatalog.length])

  const catalogLookup = useMemo(() => {
    const bySku = new Map<string, ProductSuggestion>()
    const byName = new Map<string, ProductSuggestion>()
    for (const p of productCatalog) {
      if (p.sku) bySku.set(p.sku.trim().toUpperCase(), p)
      if (p.name) byName.set(normalizeSearchString(p.name, true), p)
    }
    return { bySku, byName }
  }, [productCatalog])

  const findCatalogMeta = useCallback(
    (name?: string | null, sku?: string | null): ProductSuggestion | null => {
      if (sku) {
        const hit = catalogLookup.bySku.get(sku.trim().toUpperCase())
        if (hit) return hit
      }
      if (name) {
        const hit = catalogLookup.byName.get(normalizeSearchString(name, true))
        if (hit) return hit
      }
      return null
    },
    [catalogLookup]
  )

  // Trích xuất toàn bộ biến động sản phẩm trên các phiếu ĐÃ DUYỆT theo ngày lọc
  const approvedMovementEntries = useMemo<MovementEntry[]>(() => {
    const entries: MovementEntry[] = []
    for (const prop of submittedList) {
      const st = (prop.status || 'PENDING').toUpperCase()
      const isApproved = st === 'APPROVED' || st === 'DONE' || st === 'COMPLETED'
      if (!isApproved) continue

      const ts = prop.approved_at || prop.created_at || ''
      if (movementDateFilter && getLocalDateStr(ts) !== movementDateFilter) continue

      prop.items.forEach((it, itemIdx) => {
        if (it.sub_items && it.sub_items.length > 0) {
          it.sub_items.forEach((sub, sIdx) => {
            const prodName = (sub.product_name || it.product_name || 'Chưa rõ sản phẩm').trim()
            const sku = sub.sku || it.sku || null
            const meta = findCatalogMeta(prodName, sku)
            const unit = normalizeUnitLabel(sub.unit || it.unit || meta?.unit || 'Thùng')

            let beforeQty: number | null = Number(sub.current_quantity) || 0
            let afterQty: number | null = Number(sub.new_quantity) || 0
            let delta = 0
            let changeKind: MovementKind = 'UNCHANGED'

            if (it.action_type === 'CLEAR') {
              afterQty = 0
              delta = -beforeQty
              changeKind = 'CLEAR'
            } else if (it.action_type === 'SET_QTY') {
              if (!it.lot_id || sub.is_new) {
                beforeQty = 0
                delta = afterQty
                changeKind = !it.lot_id ? 'CREATE_LOT' : 'ADD_TO_LOT'
              } else {
                delta = Number((afterQty - beforeQty).toFixed(2))
                changeKind = delta > 0 ? 'INCREASE' : delta < 0 ? 'DECREASE' : 'UNCHANGED'
              }
            } else {
              delta = 0
              changeKind = it.action_type
            }

            entries.push({
              key: `${prop.id}-${it.id || itemIdx}-sub-${sIdx}`,
              proposal: prop,
              item: it,
              timestamp: ts,
              productName: prodName,
              sku,
              aliases: meta?.aliases || [],
              unit,
              beforeQty,
              afterQty,
              delta,
              changeKind,
            })
          })
        } else {
          const prodName = (
            it.product_name ||
            (it.action_type === 'NOTE' ? 'Ghi chú (không gắn SP)' : 'Chưa rõ sản phẩm')
          ).trim()
          const sku = it.sku || null
          const meta = findCatalogMeta(prodName, sku)
          const unit = normalizeUnitLabel(it.unit || meta?.unit || 'Thùng')

          let beforeQty: number | null =
            it.current_quantity != null ? Number(it.current_quantity) : null
          let afterQty: number | null = it.new_quantity != null ? Number(it.new_quantity) : null
          let delta = 0
          let changeKind: MovementKind = 'UNCHANGED'

          if (it.action_type === 'CLEAR') {
            const prev = beforeQty ?? 0
            beforeQty = prev
            afterQty = 0
            delta = -prev
            changeKind = 'CLEAR'
          } else if (it.action_type === 'SET_QTY') {
            if (!it.lot_id) {
              beforeQty = 0
              const next = afterQty ?? 0
              afterQty = next
              delta = next
              changeKind = 'CREATE_LOT'
            } else {
              const prev = beforeQty ?? 0
              const next = afterQty ?? prev
              beforeQty = prev
              afterQty = next
              delta = Number((next - prev).toFixed(2))
              changeKind = delta > 0 ? 'INCREASE' : delta < 0 ? 'DECREASE' : 'UNCHANGED'
            }
          } else {
            delta = 0
            changeKind = it.action_type
          }

          entries.push({
            key: `${prop.id}-${it.id || itemIdx}`,
            proposal: prop,
            item: it,
            timestamp: ts,
            productName: prodName,
            sku,
            aliases: meta?.aliases || [],
            unit,
            beforeQty,
            afterQty,
            delta,
            changeKind,
          })
        }
      })
    }

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return entries
  }, [submittedList, movementDateFilter, findCatalogMeta])

  // Gợi ý sản phẩm hỗ trợ tên viết tắt (aliases) + SKU
  const movementProductSuggestions = useMemo(() => {
    const map = new Map<
      string,
      { name: string; sku: string | null; aliases: string[]; count: number }
    >()
    for (const e of approvedMovementEntries) {
      if (!e.productName || e.productName === 'Ghi chú (không gắn SP)') continue
      const k = e.sku
        ? `sku:${e.sku.trim().toUpperCase()}`
        : `name:${normalizeSearchString(e.productName, true)}`
      const ex = map.get(k)
      if (ex) ex.count++
      else map.set(k, { name: e.productName, sku: e.sku, aliases: e.aliases, count: 1 })
    }
    const all = Array.from(map.values())
    const q = productQuery.trim()
    if (!q) return all.sort((a, b) => b.count - a.count).slice(0, 12)
    return all
      .filter(p => matchSearch(p, q))
      .sort((a, b) => calculateSearchScore(b, q) - calculateSearchScore(a, q))
      .slice(0, 15)
  }, [approvedMovementEntries, productQuery])

  const filteredMovementEntries = useMemo(() => {
    if (selectedProductFilter) {
      return approvedMovementEntries.filter(e => {
        if (selectedProductFilter.sku && e.sku) {
          return e.sku.trim().toUpperCase() === selectedProductFilter.sku.trim().toUpperCase()
        }
        return (
          normalizeSearchString(e.productName, true) ===
          normalizeSearchString(selectedProductFilter.name, true)
        )
      })
    }
    const q = productQuery.trim()
    if (!q) return approvedMovementEntries
    return approvedMovementEntries.filter(e =>
      matchSearch({ name: e.productName, sku: e.sku, aliases: e.aliases }, q)
    )
  }, [approvedMovementEntries, selectedProductFilter, productQuery])

  const movementStats = useMemo(() => {
    const decreasedByUnit = new Map<string, number>()
    const increasedByUnit = new Map<string, number>()
    const netByUnit = new Map<string, number>()
    let decreaseCount = 0
    let increaseCount = 0
    let moveCount = 0
    let assignCount = 0

    const byProduct = new Map<
      string,
      {
        name: string
        sku: string | null
        decreased: Map<string, number>
        increased: Map<string, number>
        net: Map<string, number>
        count: number
        byKind: Map<MovementKind, { count: number; qtyByUnit: Map<string, number> }>
      }
    >()

    for (const e of filteredMovementEntries) {
      if (e.delta < 0) {
        const abs = Math.abs(e.delta)
        decreasedByUnit.set(e.unit, (decreasedByUnit.get(e.unit) || 0) + abs)
        netByUnit.set(e.unit, (netByUnit.get(e.unit) || 0) - abs)
        decreaseCount++
      } else if (e.delta > 0) {
        increasedByUnit.set(e.unit, (increasedByUnit.get(e.unit) || 0) + e.delta)
        netByUnit.set(e.unit, (netByUnit.get(e.unit) || 0) + e.delta)
        increaseCount++
      }
      if (e.changeKind === 'MOVE') moveCount++
      if (e.changeKind === 'ASSIGN_LOT') assignCount++

      const pKey = e.sku
        ? `sku:${e.sku.trim().toUpperCase()}`
        : `name:${normalizeSearchString(e.productName, true)}`
      let g = byProduct.get(pKey)
      if (!g) {
        g = {
          name: e.productName,
          sku: e.sku,
          decreased: new Map(),
          increased: new Map(),
          net: new Map(),
          count: 0,
          byKind: new Map(),
        }
        byProduct.set(pKey, g)
      }
      g.count++
      if (e.delta < 0) {
        const abs = Math.abs(e.delta)
        g.decreased.set(e.unit, (g.decreased.get(e.unit) || 0) + abs)
        g.net.set(e.unit, (g.net.get(e.unit) || 0) - abs)
      } else if (e.delta > 0) {
        g.increased.set(e.unit, (g.increased.get(e.unit) || 0) + e.delta)
        g.net.set(e.unit, (g.net.get(e.unit) || 0) + e.delta)
      }

      let kb = g.byKind.get(e.changeKind)
      if (!kb) {
        kb = { count: 0, qtyByUnit: new Map() }
        g.byKind.set(e.changeKind, kb)
      }
      kb.count++
      if (e.delta !== 0) {
        kb.qtyByUnit.set(e.unit, (kb.qtyByUnit.get(e.unit) || 0) + Math.abs(e.delta))
      }
    }

    const order: Array<{
      kind: MovementKind
      label: string
      sign: '+' | '-' | ''
      tone: ActionTag['tone']
    }> = [
      { kind: 'CLEAR', label: 'Xuất rỗng', sign: '-', tone: 'rose' },
      { kind: 'DECREASE', label: 'Điều chỉnh giảm', sign: '-', tone: 'amber' },
      { kind: 'CREATE_LOT', label: 'Tạo Lot mới', sign: '+', tone: 'emerald' },
      { kind: 'ADD_TO_LOT', label: 'Thêm vào Lot', sign: '+', tone: 'emerald' },
      { kind: 'INCREASE', label: 'Điều chỉnh tăng', sign: '+', tone: 'sky' },
      { kind: 'MOVE', label: 'Chuyển ô', sign: '', tone: 'sky' },
      { kind: 'ASSIGN_LOT', label: 'Gắn STT', sign: '', tone: 'purple' },
      { kind: 'NOTE', label: 'Ghi chú', sign: '', tone: 'slate' },
      { kind: 'UNCHANGED', label: 'Điều chỉnh (0)', sign: '', tone: 'slate' },
    ]

    const productSummary = Array.from(byProduct.values())
      .map(g => {
        const actionTags: ActionTag[] = []
        for (const cfg of order) {
          const b = g.byKind.get(cfg.kind)
          if (!b || b.count === 0) continue
          if (cfg.sign) {
            const q = formatUnitTotalsMap(b.qtyByUnit, cfg.sign)
            actionTags.push({
              label: q !== '0' ? `${cfg.label} (${q})` : `${cfg.label} (${b.count})`,
              tone: cfg.tone,
            })
          } else {
            actionTags.push({ label: `${cfg.label} (${b.count})`, tone: cfg.tone })
          }
        }
        return { ...g, actionTags }
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

    return {
      decreasedByUnit,
      increasedByUnit,
      netByUnit,
      decreaseCount,
      increaseCount,
      moveCount,
      assignCount,
      productSummary,
    }
  }, [filteredMovementEntries])

  const filteredSubmittedList = useMemo(() => {
    const posQuery = submittedPosSearch.trim().toUpperCase()
    return submittedList.filter(p => {
      const s = (p.status || 'PENDING').toUpperCase()
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING' && s !== 'PENDING' && s !== 'PARTIAL') return false
        if (statusFilter === 'APPROVED' && s !== 'APPROVED' && s !== 'DONE' && s !== 'COMPLETED')
          return false
        if (statusFilter === 'REJECTED' && s !== 'REJECTED' && s !== 'CANCELLED') return false
      }
      if (posQuery) {
        const hasMatchingPos = (p.items || []).some(
          item =>
            (item.position_code || '').toUpperCase().includes(posQuery) ||
            (item.target_position_code || '').toUpperCase().includes(posQuery)
        )
        if (!hasMatchingPos) return false
      }
      return true
    })
  }, [submittedList, statusFilter, submittedPosSearch])

  const statusCounts = useMemo(() => {
    let pending = 0
    let approved = 0
    let rejected = 0
    for (const p of submittedList) {
      const s = (p.status || 'PENDING').toUpperCase()
      if (s === 'APPROVED' || s === 'DONE' || s === 'COMPLETED') approved++
      else if (s === 'REJECTED' || s === 'CANCELLED') rejected++
      else pending++
    }
    return { all: submittedList.length, pending, approved, rejected }
  }, [submittedList])

  if (!visible) return null

  const todayStr = getTodayDateStr()
  const hasProductFilter = Boolean(selectedProductFilter || productQuery.trim())

  const getTagToneClass = (tone: ActionTag['tone']) => {
    switch (tone) {
      case 'rose':
        return 'bg-rose-950/60 text-rose-300 border-rose-500/40'
      case 'emerald':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
      case 'amber':
        return 'bg-amber-950/60 text-amber-300 border-amber-500/40'
      case 'sky':
        return 'bg-sky-950/60 text-sky-300 border-sky-500/40'
      case 'purple':
        return 'bg-purple-950/60 text-purple-300 border-purple-500/40'
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700'
    }
  }

  const getMovementKindLabel = (kind: MovementKind, delta: number, unit: string): ActionTag => {
    switch (kind) {
      case 'CLEAR':
        return { label: `Xuất rỗng (-${formatNumberVN(Math.abs(delta))} ${unit})`, tone: 'rose' }
      case 'DECREASE':
        return { label: `Điều chỉnh giảm (${formatNumberVN(delta)} ${unit})`, tone: 'amber' }
      case 'CREATE_LOT':
        return { label: `Tạo Lot mới (+${formatNumberVN(delta)} ${unit})`, tone: 'emerald' }
      case 'ADD_TO_LOT':
        return { label: `Thêm vào Lot (+${formatNumberVN(delta)} ${unit})`, tone: 'emerald' }
      case 'INCREASE':
        return { label: `Điều chỉnh tăng (+${formatNumberVN(delta)} ${unit})`, tone: 'sky' }
      case 'MOVE':
        return { label: 'Chuyển ô', tone: 'sky' }
      case 'ASSIGN_LOT':
        return { label: 'Gắn STT', tone: 'purple' }
      case 'NOTE':
        return { label: 'Ghi chú', tone: 'slate' }
      default:
        return { label: 'Điều chỉnh (0)', tone: 'slate' }
    }
  }

  const getActionBadge = (item: ProposalItem) => {
    switch (item.action_type) {
      case 'NOTE':
        return {
          label: '📝 GHI CHÚ',
          className: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40',
          desc: item.note || 'Có ghi chú gửi Web',
        }
      case 'CLEAR':
        return {
          label: 'XUẤT RỖNG (X)',
          className: 'bg-rose-950/60 text-rose-300 border-rose-500/40',
          desc: 'Trừ vị trí khỏi Lot (Ô thực tế trống)',
        }
      case 'SET_QTY': {
        const subs = item.sub_items || []
        const addedCount = subs.filter(s => s.is_new).length
        const isCreateNewLot = !item.lot_id
        if (isCreateNewLot) {
          return {
            label: `TẠO LOT MỚI (${item.new_quantity ?? 0} ${item.unit || 'th'})`,
            className: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
            desc:
              subs.length > 0
                ? `Tạo Lot mới: ${subs.length} SP • Tổng ${item.new_quantity ?? 0} ${item.unit || 'Thùng'}`
                : `Tạo Lot mới: ${item.new_quantity ?? 0} ${item.unit || 'Thùng'}`,
          }
        }
        if (subs.length > 1 || addedCount > 0) {
          return {
            label:
              addedCount > 0
                ? `SỬA SL (+${addedCount} SP MỚI)`
                : `SỬA SL: ${item.new_quantity ?? 0} ${item.unit || 'th'}`,
            className: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
            desc: `Tổng SL: ${item.current_quantity ?? '---'} ➔ ${item.new_quantity ?? 0} ${item.unit || 'Thùng'} (${subs.length} SP)`,
          }
        }
        return {
          label: `SỬA SL: ${item.new_quantity ?? 0} ${item.unit || 'th'}`,
          className: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
          desc: `Số lượng: ${item.current_quantity ?? '---'} ➔ ${item.new_quantity ?? 0} ${item.unit || 'Thùng'}`,
        }
      }
      case 'ASSIGN_LOT': {
        return {
          label: `🏷️ STT: ${item.lot_stt || item.lot_code || '---'}`,
          className: 'bg-purple-950/60 text-purple-300 border-purple-500/40',
          desc:
            item.lot_found === false
              ? `⚠️ Không tìm thấy Lot khớp STT ${item.lot_stt || '---'} trong kho`
              : `Gắn STT ${item.lot_stt || '?'}${item.lot_code ? ` (${item.lot_code})` : ''}${
                  item.product_name ? ` • ${item.product_name}` : ''
                }${item.new_quantity != null ? ` (${item.new_quantity} ${item.unit || 'Thùng'})` : ''}`,
        }
      }
      case 'MOVE':
        return {
          label: `➔ ${item.target_position_code || '---'}`,
          className: 'bg-sky-950/60 text-sky-300 border-sky-500/40',
          desc: `Chuyển sang ô: ${item.target_position_code || '?'}`,
        }
      default:
        return {
          label: 'ĐIỀU CHỈNH',
          className: 'bg-slate-800 text-slate-300 border-slate-700',
          desc: item.note || 'Điều chỉnh vị trí',
        }
    }
  }

  const getStatusBadge = (status: string) => {
    const s = (status || 'PENDING').toUpperCase()
    if (s === 'APPROVED' || s === 'DONE' || s === 'COMPLETED') {
      return {
        label: 'ĐÃ DUYỆT',
        className: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40',
        Icon: CheckCircle2,
      }
    }
    if (s === 'REJECTED' || s === 'CANCELLED') {
      return {
        label: 'TỪ CHỐI',
        className: 'bg-rose-950/60 text-rose-300 border-rose-500/40',
        Icon: XCircle,
      }
    }
    return {
      label: 'CHỜ DUYỆT',
      className: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
      Icon: Clock,
    }
  }

  const handleSubmit = async () => {
    if (draft.items.length === 0) return
    setSubmitting(true)
    try {
      await onSubmitProposal(notes)
      await loadSubmitted()
      setActiveTab('SUBMITTED')
    } finally {
      setSubmitting(false)
    }
  }

  const renderSubItemsBox = (item: ProposalItem) => {
    const subs = item.sub_items
    if (!subs || subs.length === 0) return null
    const showDetailed =
      subs.length > 1 || subs.some(s => s.is_new) || (!item.lot_id && item.action_type === 'SET_QTY')
    if (!showDetailed) return null

    return (
      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
        <div className="text-[10px] font-black text-amber-300 uppercase">
          {!item.lot_id
            ? `Lot mới (${subs.length} sản phẩm)`
            : `Chi tiết sản phẩm (${subs.length} dòng)`}
        </div>
        {subs.map((sub, sIdx) => (
          <div key={sIdx} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-slate-200 truncate pr-2">
              {sub.is_new ? '➕ [Mới] ' : '• '}
              {sub.product_name}
            </span>
            <span className="font-mono font-black shrink-0 text-emerald-400">
              {sub.is_new
                ? `+${sub.new_quantity} ${sub.unit}`
                : `${sub.current_quantity} ➔ ${
                    item.action_type === 'CLEAR' ? 0 : sub.new_quantity
                  } ${sub.unit}`}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#0f172a] text-slate-100 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92dvh] flex flex-col shadow-2xl border border-slate-700/80 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-[#111827]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <ClipboardList size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-black text-white tracking-tight truncate">
                PHIẾU GHI NHÁP ĐIỀU CHỈNH
              </h3>
              <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">
                {draft.items.length} vị trí đang ghi nháp · Lịch sử &amp; Biến động SP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 grid grid-cols-2 gap-1.5 p-2 bg-slate-900 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('DRAFT')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
              activeTab === 'DRAFT'
                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            ✏️ Đang nháp ({draft.items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SUBMITTED')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
              activeTab === 'SUBMITTED'
                ? 'bg-sky-500/20 border border-sky-500/50 text-sky-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            📤 Đã gửi duyệt ({submittedList.length})
          </button>
        </div>

        {activeTab === 'DRAFT' ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar p-4 space-y-3">
              {draft.items.length === 0 ? (
                <div className="py-10 text-center space-y-1.5">
                  <div className="text-sm font-black text-slate-200">
                    Chưa có vị trí nào trong phiếu nháp
                  </div>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Bật chế độ &quot;Ghi nháp&quot; trên Sơ đồ kho và chạm vào ô bất kỳ để thêm
                    điều chỉnh (Xuất rỗng, Sửa số lượng, Tạo Lot mới, Gắn STT, Chuyển ô).
                  </p>
                </div>
              ) : (
                draft.items.map(item => {
                  const badge = getActionBadge(item)
                  return (
                    <div
                      key={item.id || item.position_id}
                      className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin size={14} className="text-amber-400 shrink-0" />
                          <span className="text-sm font-black font-mono text-white">
                            {item.position_code}
                          </span>
                          {item.warehouse_name && (
                            <span className="text-[11px] font-medium text-slate-400 truncate">
                              • {item.warehouse_name}
                            </span>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-black shrink-0 ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-200 leading-snug">
                        {item.product_name ||
                          (item.lot_id ? 'Hàng đông lạnh' : 'Ô đang trống trên hệ thống')}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                        {item.lot_code && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-emerald-300">
                            {item.lot_code}
                          </span>
                        )}
                        <span className="font-bold text-slate-200">➔ {badge.desc}</span>
                      </div>

                      {renderSubItemsBox(item)}

                      {item.note && item.action_type !== 'NOTE' && (
                        <div className="text-[11px] font-semibold text-amber-300">
                          💬 {item.note}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => onEditItem(item)}
                          className="px-2.5 py-1 rounded-lg bg-sky-950/60 border border-sky-500/30 text-sky-300 text-[11px] font-bold flex items-center gap-1"
                        >
                          <Edit2 size={12} />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.position_id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-300 text-[11px] font-bold flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}

              {draft.items.length > 0 && (
                <div className="pt-2">
                  <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">
                    Ghi chú chung của ca kiểm kho (tùy chọn):
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Nhập ghi chú gửi lên Web cho người duyệt..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-xs font-semibold text-white outline-none focus:border-amber-500 resize-none placeholder:text-slate-500"
                  />
                </div>
              )}
            </div>

            {draft.items.length > 0 && (
              <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-slate-800 bg-[#111827]">
                {!confirmClearAll ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="px-3 py-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Trash2 size={14} />
                    <span>Xóa hết</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll()
                      setConfirmClearAll(false)
                    }}
                    className="px-3 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black flex items-center gap-1 shrink-0"
                  >
                    <Trash2 size={14} />
                    <span>Xác nhận xóa?</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={15} />
                      <span>GỬI ĐỀ XUẤT DUYỆT ({draft.items.length})</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Chuyển chế độ: Danh sách phiếu vs Biến động SP */}
            <div className="shrink-0 px-3 pt-2.5 pb-2 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setHistoryViewMode('LIST')}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-black border transition ${
                    historyViewMode === 'LIST'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                      : 'bg-slate-800/70 border-slate-700 text-slate-400'
                  }`}
                >
                  📋 Danh sách phiếu
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryViewMode('MOVEMENTS')}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-black border flex items-center justify-center gap-1 transition ${
                    historyViewMode === 'MOVEMENTS'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-800/70 border-slate-700 text-slate-400'
                  }`}
                >
                  <BarChart3 size={13} />
                  <span>Biến động SP</span>
                </button>
              </div>

              <button
                type="button"
                onClick={loadSubmitted}
                disabled={loadingSubmitted}
                className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-sky-400 shrink-0"
                title="Tải mới từ máy chủ"
              >
                <RefreshCw size={14} className={loadingSubmitted ? 'animate-spin' : ''} />
              </button>
            </div>

            {historyViewMode === 'MOVEMENTS' ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Bộ lọc ngày + tìm SP */}
                <div className="shrink-0 p-3 border-b border-slate-800 bg-slate-900/60 space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        setMovementDateFilter(movementDateFilter === todayStr ? '' : todayStr)
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${
                        movementDateFilter === todayStr
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovementDateFilter('')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${
                        movementDateFilter === ''
                          ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      Tất cả ngày
                    </button>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 ml-auto">
                      <Calendar size={12} className="text-slate-400 shrink-0" />
                      <input
                        type="date"
                        value={movementDateFilter}
                        onChange={e => setMovementDateFilter(e.target.value)}
                        className="bg-transparent text-[11px] font-bold text-white outline-none"
                      />
                    </div>
                  </div>

                  {/* Ô tìm sản phẩm + gợi ý */}
                  <div className="relative">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-slate-950">
                      <Package size={14} className="text-emerald-400 shrink-0" />
                      <input
                        type="text"
                        value={selectedProductFilter ? selectedProductFilter.name : productQuery}
                        onFocus={() => setShowProductSuggestions(true)}
                        onChange={e => {
                          setSelectedProductFilter(null)
                          setProductQuery(e.target.value)
                          setShowProductSuggestions(true)
                        }}
                        placeholder="Lọc sản phẩm (tên viết tắt, SKU, tên SP)..."
                        className="flex-1 min-w-0 bg-transparent text-xs font-bold text-white outline-none placeholder:text-slate-500"
                      />
                      {(selectedProductFilter || productQuery) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductFilter(null)
                            setProductQuery('')
                            setShowProductSuggestions(false)
                          }}
                          className="text-slate-400 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {showProductSuggestions && movementProductSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto no-scrollbar rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-20 p-1 space-y-1">
                        {movementProductSuggestions.map((p, idx) => (
                          <button
                            key={`${p.sku || p.name}-${idx}`}
                            type="button"
                            onClick={() => {
                              setSelectedProductFilter({ name: p.name, sku: p.sku })
                              setProductQuery('')
                              setShowProductSuggestions(false)
                            }}
                            className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              {p.aliases.length > 0 && (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black mr-1">
                                  ⚡ {p.aliases.join(', ')}
                                </span>
                              )}
                              <div className="text-[11px] font-bold text-white truncate">
                                {p.name}
                              </div>
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black shrink-0">
                              {p.count} lượt
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Nội dung Biến động SP */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar p-3.5 space-y-3">
                  {/* 4 Thẻ KPI (2x2) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30">
                      <div className="flex items-center gap-1 text-[10px] font-black text-rose-300 uppercase">
                        <TrendingDown size={12} />
                        <span>Xuất / Xóa / Giảm</span>
                      </div>
                      <div className="text-xs font-mono font-black text-rose-400 mt-1 break-words">
                        {movementStats.decreaseCount > 0
                          ? formatUnitTotalsMap(movementStats.decreasedByUnit, '-')
                          : '0'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {movementStats.decreaseCount} lượt giảm
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                      <div className="flex items-center gap-1 text-[10px] font-black text-emerald-300 uppercase">
                        <TrendingUp size={12} />
                        <span>Tạo mới / Tăng</span>
                      </div>
                      <div className="text-xs font-mono font-black text-emerald-400 mt-1 break-words">
                        {movementStats.increaseCount > 0
                          ? formatUnitTotalsMap(movementStats.increasedByUnit, '+')
                          : '0'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {movementStats.increaseCount} lượt tăng
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] font-black text-slate-400 uppercase">
                        Biến động ròng
                      </div>
                      <div className="text-xs font-mono font-black text-sky-300 mt-1 break-words">
                        {formatUnitTotalsMap(movementStats.netByUnit, 'signed')}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] font-black text-slate-400 uppercase">
                        Tổng lượt (Đã duyệt)
                      </div>
                      <div className="text-xs font-mono font-black text-amber-300 mt-1">
                        {filteredMovementEntries.length} lượt
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Chuyển: {movementStats.moveCount} · STT: {movementStats.assignCount}
                      </div>
                    </div>
                  </div>

                  {filteredMovementEntries.length === 0 ? (
                    <div className="py-8 text-center space-y-1">
                      <div className="text-xs font-black text-slate-300">
                        Không có biến động đã duyệt nào
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Thử bấm &quot;Tất cả ngày&quot; hoặc chọn ngày khác để kiểm tra.
                      </p>
                    </div>
                  ) : !hasProductFilter ? (
                    /* Danh sách tổng hợp theo từng sản phẩm */
                    <div className="space-y-2">
                      <div className="text-[11px] font-black text-slate-400 uppercase">
                        Tổng hợp theo từng sản phẩm ({movementStats.productSummary.length} SP)
                      </div>
                      {movementStats.productSummary.map((row, rIdx) => (
                        <button
                          key={`${row.sku || row.name}-${rIdx}`}
                          type="button"
                          onClick={() =>
                            setSelectedProductFilter({ name: row.name, sku: row.sku })
                          }
                          className="w-full text-left p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800 space-y-2 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-xs font-black text-white leading-snug flex-1">
                              {row.name}
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono font-bold shrink-0">
                              {row.count} lượt
                            </span>
                          </div>

                          {row.actionTags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {row.actionTags.map((tag, tIdx) => (
                                <span
                                  key={tIdx}
                                  className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${getTagToneClass(
                                    tag.tone
                                  )}`}
                                >
                                  {tag.label}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-800/80 text-[11px] font-mono">
                            <div>
                              <span className="block text-[9px] text-slate-500 font-sans">Giảm</span>
                              <span className="font-black text-rose-400">
                                {formatUnitTotalsMap(row.decreased, '-')}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-slate-500 font-sans">Tăng</span>
                              <span className="font-black text-emerald-400">
                                {formatUnitTotalsMap(row.increased, '+')}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block text-[9px] text-slate-500 font-sans">Ròng</span>
                              <span className="font-black text-sky-300">
                                {formatUnitTotalsMap(row.net, 'signed')}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* Chi tiết từng lần biến động của sản phẩm đang chọn */
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-slate-400 uppercase">
                          Chi tiết biến đổi ({filteredMovementEntries.length} lượt)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductFilter(null)
                            setProductQuery('')
                          }}
                          className="text-[11px] font-bold text-sky-400"
                        >
                          ← Xem tất cả SP
                        </button>
                      </div>

                      {filteredMovementEntries.map(entry => {
                        const tag = getMovementKindLabel(entry.changeKind, entry.delta, entry.unit)
                        const timeStr = entry.timestamp
                          ? new Date(entry.timestamp).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })
                          : '---'
                        return (
                          <div
                            key={entry.key}
                            className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-mono font-black text-white">
                                📍 {entry.item.position_code}
                                {entry.item.action_type === 'MOVE' &&
                                entry.item.target_position_code
                                  ? ` ➔ ${entry.item.target_position_code}`
                                  : ''}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded border text-[10px] font-black ${getTagToneClass(
                                  tag.tone
                                )}`}
                              >
                                {tag.label}
                              </span>
                            </div>

                            {entry.beforeQty !== null &&
                              entry.afterQty !== null &&
                              (entry.item.action_type === 'SET_QTY' ||
                                entry.item.action_type === 'CLEAR') && (
                                <div className="text-[11px] font-mono font-bold text-slate-200">
                                  SL: {formatNumberVN(entry.beforeQty)} ➔{' '}
                                  <span
                                    className={
                                      entry.delta < 0 ? 'text-rose-400' : 'text-emerald-400'
                                    }
                                  >
                                    {formatNumberVN(entry.afterQty)} {entry.unit}
                                  </span>
                                </div>
                              )}

                            <div className="text-[10px] text-slate-400 flex items-center justify-between gap-2 flex-wrap">
                              <span>🕒 {timeStr}</span>
                              <span>
                                {entry.proposal.code ? `${entry.proposal.code} · ` : ''}
                                {entry.proposal.created_by_name || 'NV'}
                              </span>
                            </div>

                            {entry.item.note && (
                              <div className="text-[11px] text-amber-300">💬 {entry.item.note}</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Filter bar chế độ Danh sách phiếu */}
                <div className="shrink-0 p-3 border-b border-slate-800 space-y-2 bg-slate-900/70">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {[
                      { key: 'ALL', label: `Tất cả (${statusCounts.all})` },
                      { key: 'PENDING', label: `🟡 Chờ duyệt (${statusCounts.pending})` },
                      { key: 'APPROVED', label: `🟢 Đã duyệt (${statusCounts.approved})` },
                      { key: 'REJECTED', label: `🔴 Từ chối (${statusCounts.rejected})` },
                    ].map(f => {
                      const active = statusFilter === f.key
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setStatusFilter(f.key as any)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-all ${
                            active
                              ? 'bg-sky-500 text-slate-950 border-sky-400 font-black'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {f.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950">
                    <Search size={14} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={submittedPosSearch}
                      onChange={e => setSubmittedPosSearch(e.target.value)}
                      placeholder="Tìm theo mã vị trí (VD: K1D1A01...)"
                      className="flex-1 min-w-0 bg-transparent text-xs font-bold text-white outline-none uppercase placeholder:text-slate-500"
                    />
                    {submittedPosSearch.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSubmittedPosSearch('')}
                        className="text-slate-400 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar p-4 space-y-2.5">
                  {loadingSubmitted && submittedList.length === 0 ? (
                    <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                      <Loader2 size={22} className="animate-spin text-sky-400" />
                      <span className="text-xs font-semibold">Đang tải danh sách phiếu đã gửi...</span>
                    </div>
                  ) : filteredSubmittedList.length === 0 ? (
                    <div className="py-10 text-center space-y-1">
                      <div className="text-sm font-black text-slate-200">
                        Không có phiếu đề xuất nào
                      </div>
                      <p className="text-xs text-slate-400">
                        Các phiếu bạn gửi duyệt sẽ hiển thị tại đây kèm trạng thái.
                      </p>
                    </div>
                  ) : (
                    filteredSubmittedList.map(prop => {
                      const st = getStatusBadge(prop.status)
                      const StIcon = st.Icon
                      const isExpanded = expandedProposalId === prop.id
                      const dateStr = new Date(prop.created_at).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })

                      return (
                        <div
                          key={prop.id}
                          className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedProposalId(isExpanded ? null : prop.id)}
                            className="w-full p-3.5 text-left flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {prop.code && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-[10px] font-black">
                                    {prop.code}
                                  </span>
                                )}
                                <span className="text-xs font-black text-white truncate">
                                  {prop.title}
                                </span>
                              </div>
                              <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                                🕒 {dateStr} • {prop.items.length} vị trí
                                {prop.created_by_name ? ` • ${prop.created_by_name}` : ''}
                              </div>
                              {prop.notes && (
                                <div className="text-[11px] font-semibold text-amber-300 truncate mt-0.5">
                                  💬 {prop.notes}
                                </div>
                              )}
                              {prop.review_notes && (
                                <div className="text-[11px] font-semibold text-emerald-300 truncate mt-0.5">
                                  ✅ Duyệt ({prop.approved_by_name || 'Web'}): {prop.review_notes}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black ${st.className}`}
                              >
                                <StIcon size={11} />
                                <span>{st.label}</span>
                              </span>
                              {isExpanded ? (
                                <ChevronUp size={16} className="text-slate-400" />
                              ) : (
                                <ChevronDown size={16} className="text-slate-400" />
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-3.5 pb-3.5 pt-2.5 border-t border-slate-800 space-y-2 bg-slate-950/60">
                              {prop.items.map((item, idx) => {
                                const badge = getActionBadge(item)
                                return (
                                  <div
                                    key={`${prop.id}-${item.id || item.position_id}-${idx}`}
                                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <span className="text-xs font-black font-mono text-white">
                                        📍 {item.position_code}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded border text-[9px] font-black ${badge.className}`}
                                      >
                                        {badge.label}
                                      </span>
                                    </div>
                                    {item.product_name && (
                                      <div className="text-[11px] font-bold text-slate-200">
                                        {item.product_name}
                                      </div>
                                    )}
                                    <div className="text-[11px] font-bold text-sky-300">
                                      ➔ {badge.desc}
                                    </div>
                                    {renderSubItemsBox(item)}
                                    {item.note && item.action_type !== 'NOTE' && (
                                      <div className="text-[10px] text-amber-300">💬 {item.note}</div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
