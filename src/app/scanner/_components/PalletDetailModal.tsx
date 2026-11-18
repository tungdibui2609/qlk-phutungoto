'use client'

import React, { useState, useEffect } from 'react'
import {
  AlertTriangle,
  X,
  MapPin,
  Loader2,
  ShieldCheck,
  Copy,
  Trash2,
  Edit3,
  ArrowRightLeft,
  Tag,
  Check,
  Save,
} from 'lucide-react'
import type { BoxItem, PalletItem } from './types'
import { supabase } from '@/lib/supabaseClient'
import { playScanSound, triggerHaptic } from './scannerUtils'

interface PalletDetailModalProps {
  selectedPallet: PalletItem | null
  setSelectedPallet: React.Dispatch<React.SetStateAction<PalletItem | null>>
  selectedPalletBoxes: BoxItem[]
  loadingDetail: boolean
  onRefreshPallets?: () => Promise<any>
}

export function PalletDetailModal({
  selectedPallet,
  setSelectedPallet,
  selectedPalletBoxes,
  loadingDetail,
  onRefreshPallets,
}: PalletDetailModalProps) {
  const [localBoxes, setLocalBoxes] = useState<BoxItem[]>(selectedPalletBoxes)
  const [actionBusy, setActionBusy] = useState(false)
  const [statusNote, setStatusNote] = useState<string | null>(null)

  // Clone state inside modal
  const [cloningBox, setCloningBox] = useState<BoxItem | null>(null)
  const [cloneCount, setCloneCount] = useState<string>('1')

  // Edit box state inside modal
  const [editingBox, setEditingBox] = useState<BoxItem | null>(null)
  const [editForm, setEditForm] = useState<{
    box_index: string
    sku: string
    product_name: string
    lot_code: string
    quantity: string
    spec: string
    shift_group: string
    region: string
    production_date: string
    packaging_date: string
  }>({
    box_index: '',
    sku: '',
    product_name: '',
    lot_code: '',
    quantity: '20',
    spec: '',
    shift_group: '',
    region: '',
    production_date: '',
    packaging_date: '',
  })

  // Move / Merge Pallet state
  const [showMergePanel, setShowMergePanel] = useState(false)
  const [targetMergeStt, setTargetMergeStt] = useState('')
  const [movingSingleBox, setMovingSingleBox] = useState<BoxItem | null>(null)
  const [targetSingleBoxStt, setTargetSingleBoxStt] = useState('')

  // Edit Pallet Tag & Notes state
  const [showMetaPanel, setShowMetaPanel] = useState(false)
  const [palletTagInput, setPalletTagInput] = useState('')
  const [palletNotesInput, setPalletNotesInput] = useState('')

  useEffect(() => {
    setLocalBoxes(selectedPalletBoxes)
  }, [selectedPalletBoxes, selectedPallet?.id])

  useEffect(() => {
    if (selectedPallet) {
      setPalletTagInput(selectedPallet.tag || '')
      setPalletNotesInput(selectedPallet.notes || '')
      setShowMergePanel(false)
      setShowMetaPanel(false)
      setCloningBox(null)
      setEditingBox(null)
      setMovingSingleBox(null)
      setStatusNote(null)
    }
  }, [selectedPallet])

  if (!selectedPallet) return null

  const isReadOnly = !!selectedPallet.is_linked || selectedPallet.status === 'exported'
  const totalWeight = localBoxes.reduce((s, b) => s + (Number(b.quantity) || 0), 0)

  const notifyDone = (msg: string) => {
    setStatusNote(msg)
    playScanSound()
    triggerHaptic()
    setTimeout(() => setStatusNote(null), 3000)
  }

  // ── 1. Xóa 1 thùng khỏi Pallet ──────────────────────────────
  const handleDeleteSingleBox = async (box: BoxItem) => {
    if (isReadOnly) {
      alert('Dữ liệu đã đồng bộ LOT trên Server không được phép xóa từ thiết bị quét.')
      return
    }
    if (
      !confirm(
        `Bạn có chắc muốn xóa Thùng #${box.box_index} (${box.sku}) khỏi Pallet ${selectedPallet.stt}?`
      )
    ) {
      return
    }

    setActionBusy(true)
    try {
      const { error } = await supabase.from('box_labels').delete().eq('id', box.id)
      if (error) throw error

      const next = localBoxes.filter(b => b.id !== box.id)
      setLocalBoxes(next)
      setSelectedPallet(prev =>
        prev
          ? {
            ...prev,
            boxes_count: next.length,
            total_weight: next.reduce((s, b) => s + (Number(b.quantity) || 0), 0),
          }
          : null
      )
      notifyDone(`Đã xóa thùng #${box.box_index}`)
      if (onRefreshPallets) onRefreshPallets().catch(() => { })
    } catch (e: any) {
      alert(`Lỗi xóa thùng: ${e.message}`)
    } finally {
      setActionBusy(false)
    }
  }

  // ── 2. Nhân bản thùng (Clone box) ───────────────────────────
  const handleExecuteCloneBox = async () => {
    if (!cloningBox || isReadOnly) return
    const count = parseInt(cloneCount, 10) || 1
    if (count <= 0) return

    setActionBusy(true)
    try {
      let startIdx = 1
      if (localBoxes.length > 0) {
        const maxIdx = Math.max(...localBoxes.map(b => parseInt(b.box_index, 10) || 0))
        startIdx = maxIdx + 1
      }

      const cleanStt = selectedPallet.stt.trim().toUpperCase()
      const isStamp = cloningBox.scan_type === 'stamp' || !!cloningBox.stamp_line1
      const rowsToInsert: any[] = []
      const appendedBoxes: BoxItem[] = []

      for (let i = 0; i < count; i++) {
        const idx = startIdx + i
        const l1 = cloningBox.stamp_line1 || cloningBox.sku || 'SKU'
        const l2 = cloningBox.stamp_line2 || cloningBox.lot_code || 'LOT'
        const boxCode = isStamp
          ? `STAMP-${l1}-${l2}-${cleanStt}-${String(idx).padStart(3, '0')}-${Date.now().toString().slice(-3)}`
          : `${cleanStt}-${cloningBox.lot_code || 'LOT'}-${String(idx).padStart(3, '0')}-${Date.now().toString().slice(-3)}`

        const metadata = {
          pallet_stt: cleanStt,
          pallet_tag: selectedPallet.tag || undefined,
          pallet_notes: selectedPallet.notes || undefined,
          scan_type: cloningBox.scan_type,
          stamp_line1: cloningBox.stamp_line1,
          stamp_line2: cloningBox.stamp_line2,
          box_index: idx,
          sku: cloningBox.sku,
          product_name: cloningBox.product_name,
          spec: cloningBox.spec,
          shift_group: cloningBox.shift_group,
          region: cloningBox.region,
          production_date: cloningBox.production_date,
          raw_material_date: cloningBox.raw_material_date,
          packaging_date: cloningBox.packaging_date,
          supplier: cloningBox.supplier,
          is_special_12: cloningBox.is_special_12,
          special_12_code: cloningBox.special_12_code,
          special_12_name: cloningBox.special_12_name,
        }

        rowsToInsert.push({
          code: boxCode,
          quantity: cloningBox.quantity || 20,
          unit: cloningBox.unit || 'Kg',
          semi_finished_lot_code: cloningBox.lot_code,
          finished_lot_code: cloningBox.lot_code,
          system_code: 'KHO_DONG_LANH',
          status: 'printed',
          metadata,
        })

        appendedBoxes.push({
          ...cloningBox,
          id: `temp_${Date.now()}_${i}`,
          code: boxCode,
          box_index: String(idx),
          created_at: new Date().toISOString(),
        })
      }

      const { data, error } = await supabase
        .from('box_labels')
        .insert(rowsToInsert as any)
        .select('id, code')
      if (error) throw error

      if (data && data.length === appendedBoxes.length) {
        data.forEach((row: any, i: number) => {
          appendedBoxes[i].id = row.id
        })
      }

      const next = [...localBoxes, ...appendedBoxes]
      setLocalBoxes(next)
      setSelectedPallet(prev =>
        prev
          ? {
            ...prev,
            boxes_count: next.length,
            total_weight: next.reduce((s, b) => s + (Number(b.quantity) || 0), 0),
          }
          : null
      )
      setCloningBox(null)
      notifyDone(`✅ Đã nhân bản thêm ${count} thùng vào Pallet ${cleanStt}!`)
      if (onRefreshPallets) onRefreshPallets().catch(() => { })
    } catch (e: any) {
      alert(`Lỗi nhân bản thùng: ${e.message}`)
    } finally {
      setActionBusy(false)
    }
  }

  // ── 3. Sửa thông tin thùng (Edit box) ───────────────────────
  const handleOpenEditBox = (b: BoxItem) => {
    setEditingBox(b)
    setEditForm({
      box_index: b.box_index || '',
      sku: b.sku || '',
      product_name: b.product_name || '',
      lot_code: b.lot_code || '',
      quantity: String(b.quantity || 20),
      spec: b.spec || '',
      shift_group: b.shift_group || '',
      region: b.region || '',
      production_date: b.production_date || '',
      packaging_date: b.packaging_date || '',
    })
  }

  const handleSaveEditBox = async () => {
    if (!editingBox || isReadOnly) return
    setActionBusy(true)
    try {
      const { data: existingRow } = await (supabase.from('box_labels') as any)
        .select('metadata')
        .eq('id', editingBox.id)
        .single()

      const oldMeta = existingRow?.metadata || {}
      const newQty = parseFloat(editForm.quantity) || 20
      const updatedMeta = {
        ...oldMeta,
        pallet_stt: selectedPallet.stt,
        box_index: parseInt(editForm.box_index, 10) || editForm.box_index,
        sku: editForm.sku.trim(),
        product_name: editForm.product_name.trim(),
        lot_code: editForm.lot_code.trim(),
        spec: editForm.spec.trim(),
        shift_group: editForm.shift_group.trim(),
        region: editForm.region.trim(),
        production_date: editForm.production_date.trim(),
        packaging_date: editForm.packaging_date.trim(),
      }

      const { error } = await (supabase.from('box_labels') as any)
        .update({
          quantity: newQty,
          finished_lot_code: editForm.lot_code.trim() || editingBox.lot_code,
          semi_finished_lot_code: editForm.lot_code.trim() || editingBox.lot_code,
          metadata: updatedMeta,
        })
        .eq('id', editingBox.id)

      if (error) throw error

      const next = localBoxes.map(b =>
        b.id === editingBox.id
          ? {
            ...b,
            box_index: String(editForm.box_index),
            sku: editForm.sku.trim(),
            product_name: editForm.product_name.trim(),
            lot_code: editForm.lot_code.trim(),
            quantity: newQty,
            spec: editForm.spec.trim(),
            shift_group: editForm.shift_group.trim(),
            region: editForm.region.trim(),
            production_date: editForm.production_date.trim(),
            packaging_date: editForm.packaging_date.trim(),
          }
          : b
      )
      setLocalBoxes(next)
      setSelectedPallet(prev =>
        prev
          ? {
            ...prev,
            total_weight: next.reduce((s, b) => s + (Number(b.quantity) || 0), 0),
          }
          : null
      )
      setEditingBox(null)
      notifyDone(`✅ Đã cập nhật thùng #${editForm.box_index}`)
      if (onRefreshPallets) onRefreshPallets().catch(() => { })
    } catch (e: any) {
      alert(`Lỗi cập nhật thùng: ${e.message}`)
    } finally {
      setActionBusy(false)
    }
  }

  // ── 4. Chuyển 1 thùng lẻ sang Pallet khác ──────────────────
  const handleMoveSingleBox = async () => {
    if (!movingSingleBox || !targetSingleBoxStt.trim() || isReadOnly) return
    const destStt = targetSingleBoxStt.trim().toUpperCase()
    if (destStt === selectedPallet.stt) {
      alert('Mã Pallet đích trùng với Pallet hiện tại!')
      return
    }

    setActionBusy(true)
    try {
      const { data: existingRow } = await (supabase.from('box_labels') as any)
        .select('metadata')
        .eq('id', movingSingleBox.id)
        .single()

      const updatedMeta = {
        ...(existingRow?.metadata || {}),
        pallet_stt: destStt,
      }

      const { error } = await (supabase.from('box_labels') as any)
        .update({ metadata: updatedMeta })
        .eq('id', movingSingleBox.id)

      if (error) throw error

      const next = localBoxes.filter(b => b.id !== movingSingleBox.id)
      setLocalBoxes(next)
      setSelectedPallet(prev =>
        prev
          ? {
            ...prev,
            boxes_count: next.length,
            total_weight: next.reduce((s, b) => s + (Number(b.quantity) || 0), 0),
          }
          : null
      )
      setMovingSingleBox(null)
      setTargetSingleBoxStt('')
      notifyDone(`🔀 Đã chuyển thùng #${movingSingleBox.box_index} sang Pallet ${destStt}`)
      if (onRefreshPallets) onRefreshPallets().catch(() => { })
    } catch (e: any) {
      alert(`Lỗi chuyển thùng: ${e.message}`)
    } finally {
      setActionBusy(false)
    }
  }

  // ── 5. Gộp / Chuyển toàn bộ Pallet sang STT khác ───────────
  const handleMergeOrMovePallet = async () => {
    const destStt = targetMergeStt.trim().toUpperCase()
    if (!destStt) {
      alert('Vui lòng nhập mã STT Pallet đích!')
      return
    }
    if (destStt === selectedPallet.stt) {
      alert('Mã STT đích trùng với Pallet hiện tại!')
      return
    }
    if (
      !confirm(
        `Gộp / Chuyển toàn bộ ${localBoxes.length} thùng từ Pallet ${selectedPallet.stt} sang Pallet ${destStt}?`
      )
    ) {
      return
    }

    setActionBusy(true)
    try {
      const { data: rows, error: fetchErr } = await (supabase.from('box_labels') as any)
        .select('id, metadata')
        .filter('metadata->>pallet_stt', 'eq', selectedPallet.stt)

      if (fetchErr) throw fetchErr

      for (const r of rows || []) {
        const updatedMeta = {
          ...(r.metadata || {}),
          pallet_stt: destStt,
          merged_from_stt: selectedPallet.stt,
        }
        await (supabase.from('box_labels') as any)
          .update({ metadata: updatedMeta })
          .eq('id', r.id)
      }

      setSelectedPallet(prev => (prev ? { ...prev, stt: destStt } : null))
      setShowMergePanel(false)
      setTargetMergeStt('')
      notifyDone(`✅ Đã gộp/chuyển toàn bộ thùng sang Pallet ${destStt}!`)
      if (onRefreshPallets) onRefreshPallets().catch(() => { })
    } catch (e: any) {
      alert(`Lỗi gộp/chuyển Pallet: ${e.message}`)
    } finally {
      setActionBusy(false)
    }
  }

  // ── 6. Cập nhật Tag & Ghi chú của Pallet ───────────────────
  const handleSavePalletMeta = async () => {
    setActionBusy(true)
    try {
      const { data: rows, error: fetchErr } = await (supabase.from('box_labels') as any)
        .select('id, metadata')
        .filter('metadata->>pallet_stt', 'eq', selectedPallet.stt)

      if (fetchErr) throw fetchErr

      for (const r of rows || []) {
        const updatedMeta = {
          ...(r.metadata || {}),
          pallet_tag: palletTagInput.trim() || null,
          pallet_notes: palletNotesInput.trim() || null,
        }
        await (supabase.from('box_labels') as any)
          .update({ metadata: updatedMeta })
          .eq('id', r.id)
      }

      setSelectedPallet(prev =>
        prev
          ? {
            ...prev,
            tag: palletTagInput.trim() || null,
            notes: palletNotesInput.trim() || null,
          }
          : null
      )
      setShowMetaPanel(false)
      notifyDone('✅ Đã lưu Mã phụ (Tag) & Ghi chú Pallet!')
      if (onRefreshPallets) onRefreshPallets().catch(() => { })
    } catch (e: any) {
      alert(`Lỗi lưu thông tin Pallet: ${e.message}`)
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#111827] border border-slate-700 rounded-2xl p-4 flex flex-col max-h-[92vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-white">
                Chi tiết Pallet: <span className="text-amber-400 font-mono">{selectedPallet.stt}</span>
              </h3>
              {selectedPallet.tag && (
                <span className="px-2 py-0.5 rounded-md bg-orange-600/20 text-orange-400 border border-orange-500/40 text-[10px] font-bold font-mono">
                  🏷️ {selectedPallet.tag}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tổng cộng <strong className="text-emerald-400">{localBoxes.length}</strong> thùng ·{' '}
              <strong className="text-sky-400">{totalWeight.toFixed(1)}</strong> Kg
            </p>
          </div>
          <button
            onClick={() => setSelectedPallet(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status & Quick Management Toolbar */}
        <div className="space-y-2 my-2.5 shrink-0">
          {statusNote && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
              <Check size={14} className="text-emerald-400 shrink-0" />
              <span>{statusNote}</span>
            </div>
          )}

          {isReadOnly ? (
            <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-2">
              <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
              <span>Dữ liệu đã lên Server an toàn (Không thể xóa/sửa từ app)</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                  <span>Pallet đang quét (Chờ duyệt LOT)</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMergePanel(v => !v)
                      setShowMetaPanel(false)
                    }}
                    className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-[10px] font-bold flex items-center gap-1 transition"
                  >
                    <ArrowRightLeft size={11} />
                    <span>Gộp/Chuyển</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMetaPanel(v => !v)
                      setShowMergePanel(false)
                    }}
                    className="px-2 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-[10px] font-bold flex items-center gap-1 transition"
                  >
                    <Tag size={11} />
                    <span>Tag/Ghi chú</span>
                  </button>
                </div>
              </div>

              {/* Panel Gộp / Chuyển Pallet */}
              {showMergePanel && (
                <div className="p-3 rounded-xl bg-slate-900 border border-sky-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-sky-300">
                      🔀 GỘP HOẶC CHUYỂN SANG PALLET KHÁC:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMergePanel(false)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Toàn bộ {localBoxes.length} thùng của Pallet <strong>{selectedPallet.stt}</strong> sẽ được chuyển/gộp sang mã STT Pallet đích.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={targetMergeStt}
                      onChange={e => setTargetMergeStt(e.target.value.toUpperCase())}
                      placeholder="Nhập STT đích (VD: G25, F102)..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs font-bold text-amber-400 uppercase"
                    />
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={handleMergeOrMovePallet}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shrink-0"
                    >
                      Xác nhận
                    </button>
                  </div>
                </div>
              )}

              {/* Panel Sửa Tag & Ghi chú */}
              {showMetaPanel && (
                <div className="p-3 rounded-xl bg-slate-900 border border-orange-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-orange-300">
                      🏷️ CẬP NHẬT MÃ PHỤ (TAG) & GHI CHÚ:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMetaPanel(false)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    type="text"
                    value={palletTagInput}
                    onChange={e => setPalletTagInput(e.target.value.toUpperCase())}
                    placeholder="Mã phụ Tag (VD: OEM-A, XK-HQ)..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs text-orange-300 uppercase"
                  />
                  <input
                    type="text"
                    value={palletNotesInput}
                    onChange={e => setPalletNotesInput(e.target.value)}
                    placeholder="Ghi chú Pallet..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleSavePalletMeta}
                    className="w-full py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <Save size={13} />
                    <span>Lưu Tag & Ghi chú</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Warehouse Location Banner */}
          {selectedPallet.location_code && (
            <div className="px-3 py-2 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center gap-2">
              <MapPin size={15} className="text-amber-400 shrink-0" />
              <span>
                Vị trí kho:{' '}
                <strong className="text-amber-300 font-mono font-black">
                  {selectedPallet.location_code}
                </strong>
              </span>
            </div>
          )}

          {/* Inline Clone Box Panel */}
          {cloningBox && (
            <div className="p-3 rounded-xl bg-slate-900 border border-sky-500/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-sky-400 flex items-center gap-1.5">
                  <Copy size={14} /> Nhân bản từ thùng #{cloningBox.box_index} ({cloningBox.sku})
                </span>
                <button
                  type="button"
                  onClick={() => setCloningBox(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={cloneCount}
                  onChange={e => setCloneCount(e.target.value)}
                  className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-sm font-black text-sky-400 text-center"
                />
                <div className="flex flex-wrap gap-1 flex-1">
                  {['1', '5', '10', String(Math.max(1, 30 - localBoxes.length))].map((c, idx) => (
                    <button
                      key={c + '_' + idx}
                      type="button"
                      onClick={() => setCloneCount(c)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold border ${cloneCount === c
                          ? 'bg-sky-600 text-white border-sky-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                    >
                      {idx === 3 ? `Đủ 30 (+${c})` : `+${c}`}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={handleExecuteCloneBox}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shrink-0"
                >
                  Nhân bản
                </button>
              </div>
            </div>
          )}

          {/* Inline Move Single Box Panel */}
          {movingSingleBox && (
            <div className="p-3 rounded-xl bg-slate-900 border border-purple-500/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                  <ArrowRightLeft size={14} /> Chuyển thùng #{movingSingleBox.box_index} sang Pallet khác
                </span>
                <button
                  type="button"
                  onClick={() => setMovingSingleBox(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetSingleBoxStt}
                  onChange={e => setTargetSingleBoxStt(e.target.value.toUpperCase())}
                  placeholder="Nhập STT Pallet nhận (VD: G26)..."
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs font-bold text-amber-400 uppercase"
                />
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={handleMoveSingleBox}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shrink-0"
                >
                  Chuyển ngay
                </button>
              </div>
            </div>
          )}

          {/* Inline Edit Box Panel */}
          {editingBox && (
            <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                  <Edit3 size={14} /> Sửa Thùng #{editingBox.box_index}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingBox(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">STT Thùng:</span>
                  <input
                    type="text"
                    value={editForm.box_index}
                    onChange={e => setEditForm({ ...editForm, box_index: e.target.value })}
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-xs text-emerald-400 font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Khối lượng (Kg):</span>
                  <input
                    type="number"
                    value={editForm.quantity}
                    onChange={e => setEditForm({ ...editForm, quantity: e.target.value })}
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-xs text-sky-300 font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Mã LOT:</span>
                  <input
                    type="text"
                    value={editForm.lot_code}
                    onChange={e =>
                      setEditForm({ ...editForm, lot_code: e.target.value.toUpperCase() })
                    }
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-xs text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">SKU:</span>
                  <input
                    type="text"
                    value={editForm.sku}
                    onChange={e => setEditForm({ ...editForm, sku: e.target.value })}
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Quy cách:</span>
                  <input
                    type="text"
                    value={editForm.spec}
                    onChange={e => setEditForm({ ...editForm, spec: e.target.value })}
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Tên sản phẩm:</span>
                <input
                  type="text"
                  value={editForm.product_name}
                  onChange={e => setEditForm({ ...editForm, product_name: e.target.value })}
                  className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingBox(null)}
                  className="flex-1 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={handleSaveEditBox}
                  className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Boxes List */}
        <div className="flex-1 overflow-y-auto overscroll-contain space-y-2 pr-1">
          {loadingDetail ? (
            <div className="py-12 flex justify-center">
              <Loader2 size={30} className="animate-spin text-emerald-500" />
            </div>
          ) : localBoxes.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Chưa có thùng nào trong Pallet này
            </div>
          ) : (
            localBoxes.map(b => {
              const isStamp = b.scan_type === 'stamp' || !!b.stamp_line1 || !!b.stamp_line2
              return (
                <div
                  key={b.id}
                  className="p-3 rounded-xl bg-[#1e293b]/70 border border-slate-800 space-y-2 text-xs"
                >
                  {/* Header row: #Index, SKU, Weight & Action buttons */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black font-mono shrink-0">
                        #{b.box_index}
                      </span>
                      <span className="font-bold text-slate-300 font-mono text-xs truncate">
                        SKU: {b.sku}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-black font-mono">
                        {b.quantity} {b.unit}
                      </span>
                      {!isReadOnly && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setCloningBox(b)
                              setCloneCount('1')
                              setEditingBox(null)
                              setMovingSingleBox(null)
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400"
                            title="Nhân bản thùng này"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenEditBox(b)
                              setCloningBox(null)
                              setMovingSingleBox(null)
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400"
                            title="Sửa thùng này"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMovingSingleBox(b)
                              setTargetSingleBoxStt('')
                              setCloningBox(null)
                              setEditingBox(null)
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-400"
                            title="Chuyển thùng sang Pallet khác"
                          >
                            <ArrowRightLeft size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingleBox(b)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400"
                            title="Xóa thùng này"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
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
                        <span className="text-slate-500">Mã LOT (Dòng 2):</span>{' '}
                        <strong className="font-mono text-slate-200">{b.lot_code}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Quy cách:</span>{' '}
                        <span className="text-slate-200">
                          {b.spec || (b.is_special_12 ? 'Hàng có hạt (Hầm đông)' : 'Thùng tiêu chuẩn')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Nhà máy:</span>{' '}
                        <span className="text-slate-200">{b.shift_group || 'Nhà máy Đắk Lắk'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Vùng NL (Tỉnh):</span>{' '}
                        <span className="text-slate-200">{b.region || 'Đắk Lắk'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Ngày nhập NL:</span>{' '}
                        <strong className="font-mono text-amber-400">
                          {b.raw_material_date || b.production_date || '---'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Ngày ĐG:</span>{' '}
                        <strong className="font-mono text-slate-200">
                          {b.packaging_date || '---'}
                        </strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500">Nhà cung cấp:</span>{' '}
                        <span className="text-slate-200">
                          {b.supplier_name || (b.supplier ? `Mã NCC ${b.supplier}` : 'Mã NCC 000')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                      <div>
                        <span className="text-slate-500">Mã LOT:</span>{' '}
                        <strong className="font-mono text-slate-200">{b.lot_code}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Quy cách:</span>{' '}
                        <span className="text-slate-200">{b.spec || 'Thùng/túi: 20kg'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Tổ/Nhóm:</span>{' '}
                        <span className="text-slate-200">{b.shift_group || 'Nguyên'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Vùng NL:</span>{' '}
                        <span className="text-slate-200">{b.region || 'Tây Nguyên'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Ngày SX:</span>{' '}
                        <strong className="font-mono text-amber-400">{b.production_date}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Ngày ĐG:</span>{' '}
                        <strong className="font-mono text-slate-200">
                          {b.packaging_date || b.production_date}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="pt-3 border-t border-slate-800 shrink-0">
          <button
            onClick={() => setSelectedPallet(null)}
            className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
