'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { RotateCw, X, Search, ArrowRightLeft, MapPin, Check, Loader2, ArrowRight } from 'lucide-react'
import type { PalletItem } from './types'
import { normalizeText } from './scannerUtils'
import { supabase } from '@/lib/supabaseClient'

interface PalletSwitchModalProps {
  isSwitchPalletModal: boolean
  setIsSwitchPalletModal: React.Dispatch<React.SetStateAction<boolean>>
  activePalletStt: string
  newSttInput: string
  setNewSttInput: React.Dispatch<React.SetStateAction<string>>
  newTagInput: string
  setNewTagInput: React.Dispatch<React.SetStateAction<string>>
  newNotesInput: string
  setNewNotesInput: React.Dispatch<React.SetStateAction<string>>
  newTargetQtyInput: number
  setNewTargetQtyInput: React.Dispatch<React.SetStateAction<number>>
  defaultTargetQty?: number
  autoCompleteOnFull?: boolean
  setAutoCompleteOnFull?: (val: boolean) => void
  palletsList: PalletItem[]
  handleSwitchToStt: (
    cleanStt: string,
    tagVal: string,
    notesVal: string,
    targetVal: number
  ) => Promise<void>
}

export function PalletSwitchModal({
  isSwitchPalletModal,
  setIsSwitchPalletModal,
  activePalletStt,
  newSttInput,
  setNewSttInput,
  newTagInput,
  setNewTagInput,
  newNotesInput,
  setNewNotesInput,
  newTargetQtyInput,
  setNewTargetQtyInput,
  defaultTargetQty = 30,
  autoCompleteOnFull = true,
  setAutoCompleteOnFull,
  palletsList,
  handleSwitchToStt,
}: PalletSwitchModalProps) {
  const [quickFilterQuery, setQuickFilterQuery] = useState('')
  const [onlyUnlinked, setOnlyUnlinked] = useState(true)
  const [showMergeMode, setShowMergeMode] = useState(false)
  const [mergeTargetStt, setMergeTargetStt] = useState('')
  const [merging, setMerging] = useState(false)

  // Xử lý chống che bàn phím ảo trên mobile theo Visual Viewport
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  const [viewportOffsetTop, setViewportOffsetTop] = useState<number>(0)
  const [showExtraFields, setShowExtraFields] = useState<boolean>(() => !!(newTagInput.trim() || newNotesInput.trim()))

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateViewport = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height)
        setViewportOffsetTop(window.visualViewport.offsetTop)
      } else {
        setViewportHeight(window.innerHeight)
      }
    }

    window.visualViewport?.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('scroll', updateViewport)
    window.addEventListener('resize', updateViewport)
    updateViewport()

    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewport)
      window.visualViewport?.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
    }
  }, [isSwitchPalletModal])

  const filteredExistingPallets = useMemo(() => {
    return palletsList.filter(p => {
      if (onlyUnlinked && p.is_linked) return false
      if (!quickFilterQuery.trim()) return true
      const q = normalizeText(quickFilterQuery)
      const haystack = normalizeText(
        `${p.stt} ${p.tag || ''} ${p.lot_code || ''} ${p.product_name || ''} ${p.sku || ''} ${p.product_aliases || ''} ${p.aliases || ''} ${p.notes || ''}`
      )
      return q.split(' ').every(word => haystack.includes(word))
    })
  }, [palletsList, onlyUnlinked, quickFilterQuery])

  if (!isSwitchPalletModal) return null

  const handleMergeActivePallet = async () => {
    if (!activePalletStt) {
      alert('Hiện chưa có Pallet đang chọn để gộp/đổi mã.')
      return
    }
    const cleanTarget = mergeTargetStt.trim().toUpperCase()
    if (!cleanTarget) {
      alert('Vui lòng nhập mã STT Pallet đích!')
      return
    }
    if (cleanTarget === activePalletStt) {
      alert('Mã STT đích trùng với STT hiện tại!')
      return
    }
    if (
      !confirm(
        `Bạn có chắc muốn chuyển/gộp toàn bộ thùng của Pallet [${activePalletStt}] sang Pallet [${cleanTarget}] không?`
      )
    ) {
      return
    }

    setMerging(true)
    try {
      const { data: boxes, error: fetchErr } = await supabase
        .from('box_labels')
        .select('id, metadata, lot_id')
        .filter('metadata->>pallet_stt', 'eq', activePalletStt)

      if (fetchErr) throw fetchErr
      const unlinked = (boxes || []).filter((b: any) => !b.lot_id)
      if (unlinked.length === 0) {
        alert(`Không tìm thấy thùng chưa duyệt LOT nào thuộc Pallet ${activePalletStt} để chuyển.`)
        setMerging(false)
        return
      }

      for (const b of unlinked as any[]) {
        const nextMeta = {
          ...(b.metadata || {}),
          pallet_stt: cleanTarget,
          moved_from_pallet: activePalletStt,
          moved_at: new Date().toISOString(),
        }
        const { error: updErr } = await (supabase.from('box_labels') as any)
          .update({ metadata: nextMeta })
          .eq('id', b.id)
        if (updErr) throw updErr
      }

      setMergeTargetStt('')
      setShowMergeMode(false)
      await handleSwitchToStt(cleanTarget, newTagInput.trim(), newNotesInput.trim(), newTargetQtyInput || 30)
    } catch (err: any) {
      alert(`Lỗi gộp/chuyển Pallet: ${err.message}`)
    } finally {
      setMerging(false)
    }
  }

  const handleSubmitPallet = () => {
    if (!newSttInput.trim()) {
      alert('Vui lòng nhập mã STT Pallet')
      return
    }
    const clean = newSttInput.trim().toUpperCase()
    handleSwitchToStt(
      clean,
      newTagInput.trim(),
      newNotesInput.trim(),
      newTargetQtyInput || 30
    )
  }

  return (
    <div
      className="fixed inset-x-0 z-50 bg-black/85 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150 overflow-hidden"
      style={{
        top: `${viewportOffsetTop}px`,
        height: viewportHeight ? `${viewportHeight}px` : '100dvh',
      }}
    >
      <div
        className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-100"
        style={{
          maxHeight: viewportHeight ? `${Math.min(viewportHeight - 12, 650)}px` : '85dvh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-3.5 pb-2.5 shrink-0 bg-[#111827]">
          <div className="flex items-center gap-2">
            <RotateCw size={18} className="text-emerald-400" />
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Chọn hoặc Nhập STT Pallet
              </h3>
              {activePalletStt && (
                <p className="text-[10px] text-slate-400 font-mono">
                  Đang mở: <strong className="text-amber-400">{activePalletStt}</strong>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSwitchPalletModal(false)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto overscroll-contain p-3.5 pr-2 flex-1 scrollbar-none">
          {/* Form nhập Pallet mới / cập nhật */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            {/* Hàng 1: STT PALLET & CHỈ TIÊU SỐ THÙNG & NÚT VÀO QUÉT NHANH */}
            <div className="flex gap-2 items-end">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-slate-400 font-bold block mb-1">
                  MÃ STT PALLET *:
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={newSttInput}
                    onChange={e => setNewSttInput(e.target.value.toUpperCase())}
                    onFocus={e => {
                      setTimeout(() => {
                        e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }, 250)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSubmitPallet()
                      }
                    }}
                    placeholder="VD: G23, F100..."
                    autoFocus
                    className="w-full px-3 py-2 pr-7 rounded-lg bg-slate-950 border border-slate-700 font-mono text-base font-black text-amber-400 uppercase focus:outline-hidden focus:border-amber-500"
                  />
                  {newSttInput && (
                    <button
                      type="button"
                      onClick={() => setNewSttInput('')}
                      className="absolute right-2 p-1 text-slate-500 hover:text-slate-300"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="w-18 shrink-0">
                <label className="text-[10px] text-slate-400 font-bold block mb-1 text-center">
                  CHỈ TIÊU:
                </label>
                <input
                  type="number"
                  value={newTargetQtyInput}
                  onChange={e => setNewTargetQtyInput(parseInt(e.target.value, 10) || defaultTargetQty || 30)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSubmitPallet()
                    }
                  }}
                  placeholder={String(defaultTargetQty || 30)}
                  className="w-full px-1.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-center text-white font-mono font-bold"
                />
              </div>

              {/* Nút bấm nhanh Vào Quét ngay trên hàng STT */}
              <button
                type="button"
                onClick={handleSubmitPallet}
                disabled={!newSttInput.trim()}
                className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs flex items-center gap-1 shadow-md shadow-emerald-950/60 transition active:scale-95 shrink-0"
                title="Vào quét ngay"
              >
                <span>Vào Quét</span>
                <Check size={14} />
              </button>
            </div>

            {/* Hàng 2: Dấu tích ghi nhớ tự động chốt */}
            <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-950/20 border border-emerald-800/40 cursor-pointer hover:bg-emerald-950/40 transition select-none">
              <input
                type="checkbox"
                checked={autoCompleteOnFull}
                onChange={e => setAutoCompleteOnFull?.(e.target.checked)}
                className="rounded accent-emerald-500 w-3.5 h-3.5 cursor-pointer shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-bold text-emerald-300 block truncate">
                  Tự động chốt khi đủ {newTargetQtyInput || defaultTargetQty || 30} thùng
                </span>
              </div>
            </label>

            {/* Thu gọn / mở rộng Mã Phụ (Tag) & Ghi chú để form thoáng đãng */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setShowExtraFields(!showExtraFields)}
                className="text-[11px] font-bold text-slate-400 hover:text-amber-400 flex items-center gap-1 transition"
              >
                <span>{showExtraFields ? '▲ Thu gọn thông tin phụ' : '+ Thêm Mã Phụ (Tag) / Ghi Chú'}</span>
                {(newTagInput || newNotesInput) && !showExtraFields && (
                  <span className="text-[10px] text-amber-300 font-mono bg-amber-500/20 px-1 rounded">
                    (Có dữ liệu)
                  </span>
                )}
              </button>

              {showExtraFields && (
                <div className="space-y-2 pt-2 border-t border-slate-800/80 mt-1.5">
                  {/* Mã phụ (Tag) */}
                  <div>
                    <label className="text-[10px] text-orange-400 font-bold block mb-1">
                      MÃ PHỤ (TAG):
                    </label>
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={e => setNewTagInput(e.target.value.toUpperCase())}
                      placeholder="Ví dụ: OEM-A, XK-HQ, HÀNG LOẠI 1..."
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs text-orange-300 uppercase placeholder-slate-600"
                    />
                  </div>

                  {/* Ghi chú Pallet / LOT hàng */}
                  <div>
                    <label className="text-[10px] text-blue-400 font-bold block mb-1">
                      GHI CHÚ PALLET / LOT HÀNG:
                    </label>
                    <textarea
                      rows={2}
                      value={newNotesInput}
                      onChange={e => setNewNotesInput(e.target.value)}
                      placeholder="Nhập ghi chú cho LOT hàng (nếu có)..."
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tiện ích Gộp / Chuyển mã STT cho Pallet đang mở */}
          {activePalletStt && (
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <button
                type="button"
                onClick={() => setShowMergeMode(!showMergeMode)}
                className="w-full flex items-center justify-between text-left text-[11px] font-bold text-amber-400 hover:text-amber-300"
              >
                <span className="flex items-center gap-1.5">
                  <ArrowRightLeft size={13} />
                  <span>Gộp / Đổi STT của Pallet đang mở ({activePalletStt})</span>
                </span>
                <span>{showMergeMode ? '▲' : '▼'}</span>
              </button>

              {showMergeMode && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Chuyển toàn bộ các thùng chưa duyệt LOT của Pallet{' '}
                    <strong className="text-amber-300">{activePalletStt}</strong> sang mã STT mới:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={mergeTargetStt}
                      onChange={e => setMergeTargetStt(e.target.value.toUpperCase())}
                      placeholder="Nhập STT đích (VD: G25)..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-amber-500/40 font-mono text-xs font-bold text-amber-300 uppercase"
                    />
                    <button
                      type="button"
                      disabled={merging}
                      onClick={handleMergeActivePallet}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 shrink-0"
                    >
                      {merging ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      <span>Chuyển</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Pick from Existing Pallets */}
          {palletsList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-400 font-bold uppercase">
                  CHỌN TỪ PALLET ĐANG CÓ ({filteredExistingPallets.length}):
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOnlyUnlinked(true)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${onlyUnlinked
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-900 text-slate-500'
                      }`}
                  >
                    Chờ duyệt LOT
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlyUnlinked(false)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${!onlyUnlinked
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'bg-slate-900 text-slate-500'
                      }`}
                  >
                    Tất cả
                  </button>
                </div>
              </div>

              {/* Search existing pallets */}
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="text"
                  value={quickFilterQuery}
                  onChange={e => setQuickFilterQuery(e.target.value)}
                  placeholder="Lọc nhanh STT, Tag, gõ tắt sản phẩm..."
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                />
                {quickFilterQuery && (
                  <button
                    type="button"
                    onClick={() => setQuickFilterQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto overscroll-contain">
                {filteredExistingPallets.slice(0, 40).map(p => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      handleSwitchToStt(
                        p.stt,
                        p.tag || '',
                        p.notes || '',
                        newTargetQtyInput || 30
                      )
                    }}
                    className={`w-full p-2.5 rounded-xl border flex flex-col gap-1 text-left transition ${p.stt === activePalletStt
                        ? 'bg-emerald-500/10 border-emerald-500 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                  >
                    <div className="w-full flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-amber-400 text-xs">
                          STT: {p.stt}
                        </span>
                        {p.location_code && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded text-[9px] font-bold font-mono flex items-center gap-0.5">
                            <MapPin size={9} /> {p.location_code}
                          </span>
                        )}
                        {p.tag && (
                          <span className="bg-orange-600/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.2 rounded text-[9px] font-bold font-mono">
                            🏷️ {p.tag}
                          </span>
                        )}
                        {p.notes && (
                          <span
                            className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-1 py-0.2 rounded text-[9px] font-bold"
                            title={p.notes}
                          >
                            📝
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({p.boxes_count} thùng · {p.total_weight} Kg)
                        </span>
                      </div>
                      {p.stt === activePalletStt ? (
                        <span className="text-[10px] font-bold text-emerald-400 shrink-0">
                          Đang chọn ✓
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 shrink-0">Chọn →</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-slate-300 truncate">{p.product_name}</span>
                      {(p.product_aliases || p.aliases) && (
                        <span className="text-emerald-400 font-mono shrink-0">
                          ⚡ {p.product_aliases || p.aliases}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer cố định luôn nhìn thấy ở đáy modal, không bị bàn phím che */}
        <div className="p-3 border-t border-slate-800 bg-[#0d131f] flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsSwitchPalletModal(false)}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition active:scale-98 cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSubmitPallet}
            disabled={!newSttInput.trim()}
            className="flex-1.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
          >
            <Check size={15} />
            <span>Xác Nhận Pallet</span>
          </button>
        </div>
      </div>
    </div>
  )
}
