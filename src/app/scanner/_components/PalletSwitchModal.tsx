'use client'

import React from 'react'
import { RotateCw, X } from 'lucide-react'
import type { PalletItem } from './types'

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
  palletsList: PalletItem[]
  handleSwitchToStt: (cleanStt: string, tagVal: string, notesVal: string, targetVal: number) => Promise<void>
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
  palletsList,
  handleSwitchToStt,
}: PalletSwitchModalProps) {
  if (!isSwitchPalletModal) return null
  return (
    <>
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
    </>
  )
}
