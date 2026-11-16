'use client'

import React, { useState, useEffect } from 'react'
import { MapPin, Package, X, CheckCircle2, ClipboardEdit } from 'lucide-react'
import type { PositionItem } from './types'
import { formatDateVN, formatPositionQtyUnit } from './mapHelpers'
import { formatMaterialZoneList } from '@/lib/provinces'
import { supabase } from '@/lib/supabaseClient'

interface PositionDetailModalProps {
  selectedPosDetail: PositionItem | null
  setSelectedPosDetail: React.Dispatch<React.SetStateAction<PositionItem | null>>
  hasDraftItem?: boolean
  onOpenDraftForPosition?: (pos: PositionItem) => void
}

export function PositionDetailModal({
  selectedPosDetail,
  setSelectedPosDetail,
  hasDraftItem = false,
  onOpenDraftForPosition,
}: PositionDetailModalProps) {
  const [modalLotItemsMap, setModalLotItemsMap] = useState<
    Record<
      string,
      Array<{
        product_id?: string | null
        sku?: string | null
        product_name?: string | null
        quantity?: number | null
        unit?: string | null
      }>
    >
  >({})

  useEffect(() => {
    const lotId = selectedPosDetail?.lot_id
    if (!lotId) return
    if (selectedPosDetail.items && selectedPosDetail.items.length > 1) return
    if (modalLotItemsMap[lotId]) return

    let isMounted = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('lot_items')
          .select('product_id, quantity, unit, products ( name, sku, unit )')
          .eq('lot_id', lotId)
        if (!error && data && isMounted) {
          const parsed = (data as any[]).map((i: any) => ({
            product_id: i.product_id || null,
            sku: i.products?.sku || null,
            product_name: i.products?.name || null,
            quantity: typeof i.quantity === 'number' ? i.quantity : null,
            unit: i.unit || i.products?.unit || null,
          }))
          setModalLotItemsMap(prev => ({ ...prev, [lotId]: parsed }))
        }
      } catch {
        // ignore offline errors
      }
    })()

    return () => {
      isMounted = false
    }
  }, [selectedPosDetail?.lot_id, selectedPosDetail?.items, modalLotItemsMap])

  if (!selectedPosDetail) return null

  const posItems =
    (selectedPosDetail.lot_id && modalLotItemsMap[selectedPosDetail.lot_id]) ||
    selectedPosDetail.items ||
    []
  const hasMultipleItems = posItems.length > 1

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200"
      onClick={() => setSelectedPosDetail(null)}
    >
      <div
        className="w-full max-w-md bg-[#111827] border border-cyan-500/40 rounded-2xl shadow-2xl max-h-[84dvh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-cyan-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
              VỊ TRÍ: {selectedPosDetail.code}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPosDetail(null)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar px-4 py-3 space-y-3">

        {/* Status Pill */}
        {selectedPosDetail.lot_id ? (
          <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={18} className="text-amber-400" />
              <div>
                <span className="text-[10px] text-slate-400 block">TRẠNG THÁI:</span>
                <strong className="text-xs text-amber-300">ĐÃ CÓ PALLET HÀNG</strong>
              </div>
            </div>
            {selectedPosDetail.stt && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-mono font-black text-sm shadow-md">
                STT: {selectedPosDetail.stt}
              </span>
            )}
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center gap-2 text-emerald-300 text-xs font-bold">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span>Vị trí hiện đang TRỐNG · Sẵn sàng để xếp Pallet mới</span>
          </div>
        )}

        {/* Position Details if Occupied */}
        {selectedPosDetail.lot_id && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
            {hasMultipleItems ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">
                    DANH SÁCH SẢN PHẨM ({posItems.length} DÒNG):
                  </span>
                  <span className="text-xs font-black text-emerald-400 font-mono">
                    Tổng:{' '}
                    {formatPositionQtyUnit(selectedPosDetail.quantity, selectedPosDetail.unit) ||
                      '---'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {posItems.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        {it.sku && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/50 text-cyan-300 font-mono text-[10px] font-bold mb-0.5">
                            {it.sku}
                          </span>
                        )}
                        <div className="font-bold text-white text-xs leading-snug">
                          {it.product_name || 'Sản phẩm'}
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 font-mono font-black text-xs shrink-0">
                        {formatPositionQtyUnit(
                          it.quantity,
                          it.unit || selectedPosDetail.unit
                        ) || '0 th'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">
                  SẢN PHẨM / PHÂN LOẠI:
                </span>
                <p className="font-bold text-white text-sm leading-snug">
                  {selectedPosDetail.product_name || 'Hàng đông lạnh'}
                </p>
              </div>
            )}

            {selectedPosDetail.aliases && (
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">
                  TÊN VIẾT TẮT (GÕ TẮT):
                </span>
                <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                  ⚡ {selectedPosDetail.aliases}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px]">MÃ LOT:</span>
                <strong className="text-cyan-300 font-mono font-bold text-xs">
                  {selectedPosDetail.lot_code || '---'}
                </strong>
              </div>
              {!hasMultipleItems && (
                <>
                  <div>
                    <span className="text-slate-500 block text-[10px]">SKU:</span>
                    <strong className="text-slate-200 font-mono">
                      {selectedPosDetail.sku || '---'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">SỐ LƯỢNG:</span>
                    <strong className="text-emerald-400 font-mono font-bold text-xs">
                      {formatPositionQtyUnit(
                        selectedPosDetail.quantity,
                        selectedPosDetail.unit
                      ) || '---'}
                    </strong>
                  </div>
                </>
              )}
              <div>
                <span className="text-slate-500 block text-[10px]">NGÀY ĐÓNG GÓI:</span>
                <strong className="text-amber-400 font-mono">
                  {formatDateVN(selectedPosDetail.packaging_date)}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">NGÀY SX (BÓC MÚI):</span>
                <strong className="text-amber-300 font-mono">
                  {formatDateVN(selectedPosDetail.peeling_date)}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">NGÀY NGUYÊN LIỆU:</span>
                <strong className="text-slate-300 font-mono">
                  {formatDateVN(selectedPosDetail.raw_material_date)}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">NGÀY NHẬP KHO:</span>
                <strong className="text-slate-300 font-mono">
                  {formatDateVN(selectedPosDetail.inbound_date)}
                </strong>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-800 grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] font-semibold mb-0.5">
                    # MÃ SẢN XUẤT
                  </span>
                  <strong className="text-slate-200 text-xs font-mono">
                    {selectedPosDetail.production_code || '---'}
                  </strong>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] font-semibold mb-0.5">
                    📍 VÙNG NGUYÊN LIỆU
                  </span>
                  <strong className="text-emerald-400 text-xs font-medium">
                    {formatMaterialZoneList(selectedPosDetail.material_zone)}
                  </strong>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] font-semibold mb-0.5">
                    🏭 NƠI SẢN XUẤT
                  </span>
                  <strong className="text-blue-400 text-xs font-medium">
                    {selectedPosDetail.production_place || '---'}
                  </strong>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] font-semibold mb-0.5">
                    ℹ️ THÔNG TIN THÊM
                  </span>
                  <strong className="text-slate-300 text-xs">
                    {selectedPosDetail.extra_info || '---'}
                  </strong>
                </div>
              </div>

              {selectedPosDetail.tags && selectedPosDetail.tags.length > 0 && (
                <div className="col-span-2 pt-1 border-t border-slate-800">
                  <span className="text-slate-500 block text-[10px] mb-1">
                    THẺ PHÂN LOẠI (TAGS):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedPosDetail.tags.map((tg, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold"
                      >
                        🏷️ {tg}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        </div>

        <div className="shrink-0 border-t border-slate-800 px-4 py-3 space-y-2 bg-[#0f172a]/90">
          {onOpenDraftForPosition && (
            <button
              type="button"
              onClick={() => {
                const posToDraft = selectedPosDetail
                setSelectedPosDetail(null)
                if (posToDraft) {
                  onOpenDraftForPosition(posToDraft)
                }
              }}
              className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-black flex items-center justify-center gap-2 transition active:scale-[0.99]"
            >
              <ClipboardEdit size={15} className="text-amber-400" />
              <span>
                {hasDraftItem ? 'Sửa Ghi Nháp Vị Trí Này' : 'Ghi Nháp Điều Chỉnh Ô Này'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSelectedPosDetail(null)}
            className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
