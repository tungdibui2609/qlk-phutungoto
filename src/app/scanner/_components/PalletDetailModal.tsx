'use client'

import React from 'react'
import { AlertTriangle, X, MapPin, Loader2, ShieldCheck } from 'lucide-react'
import type { BoxItem, PalletItem } from './types'

interface PalletDetailModalProps {
  selectedPallet: PalletItem | null
  setSelectedPallet: React.Dispatch<React.SetStateAction<PalletItem | null>>
  selectedPalletBoxes: BoxItem[]
  loadingDetail: boolean
}

export function PalletDetailModal({
  selectedPallet,
  setSelectedPallet,
  selectedPalletBoxes,
  loadingDetail,
}: PalletDetailModalProps) {
  if (!selectedPallet) return null
  return (
    <>
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
    </>
  )
}
