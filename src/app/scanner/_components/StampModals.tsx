'use client'

import React from 'react'
import { CheckCircle2, X } from 'lucide-react'
import type { PendingStampData } from './types'
import { decodeStampBox } from '@/lib/stampDecoder'

interface StampModalsProps {
  activePalletStt: string
  pendingStamp: PendingStampData | null
  setPendingStamp: React.Dispatch<React.SetStateAction<PendingStampData | null>>
  stampWeight: string
  setStampWeight: React.Dispatch<React.SetStateAction<string>>
  stampCount: string
  setStampCount: React.Dispatch<React.SetStateAction<string>>
  stampDictMap: Record<string, Record<string, string>>
  handleSaveStampBox: () => Promise<void>
  isManualStampModal: boolean
  setIsManualStampModal: React.Dispatch<React.SetStateAction<boolean>>
  manualStampLine1: string
  setManualStampLine1: React.Dispatch<React.SetStateAction<string>>
  manualStampLine2: string
  setManualStampLine2: React.Dispatch<React.SetStateAction<string>>
}

export function StampModals({
  activePalletStt,
  pendingStamp,
  setPendingStamp,
  stampWeight,
  setStampWeight,
  stampCount,
  setStampCount,
  stampDictMap,
  handleSaveStampBox,
  isManualStampModal,
  setIsManualStampModal,
  manualStampLine1,
  setManualStampLine1,
  manualStampLine2,
  setManualStampLine2,
}: StampModalsProps) {
  return (
    <>
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
    </>
  )
}
