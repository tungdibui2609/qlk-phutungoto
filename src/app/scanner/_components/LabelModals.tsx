'use client'

import React from 'react'
import { CheckCircle2, X } from 'lucide-react'
import type { ManualLabelFormState } from './types'

interface LabelModalsProps {
  activePalletStt: string
  pendingLabel: any | null
  setPendingLabel: React.Dispatch<React.SetStateAction<any | null>>
  labelWeight: string
  setLabelWeight: React.Dispatch<React.SetStateAction<string>>
  labelCount: string
  setLabelCount: React.Dispatch<React.SetStateAction<string>>
  handleSaveLabelBox: (labelData: any, w: number, count: number) => Promise<void>
  isManualLabelModal: boolean
  setIsManualLabelModal: React.Dispatch<React.SetStateAction<boolean>>
  manualLabelForm: ManualLabelFormState
  setManualLabelForm: React.Dispatch<React.SetStateAction<ManualLabelFormState>>
}

export function LabelModals({
  activePalletStt,
  pendingLabel,
  setPendingLabel,
  labelWeight,
  setLabelWeight,
  labelCount,
  setLabelCount,
  handleSaveLabelBox,
  isManualLabelModal,
  setIsManualLabelModal,
  manualLabelForm,
  setManualLabelForm,
}: LabelModalsProps) {
  return (
    <>
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
                <label className="text-[10px] text-slate-400 block mb-1">Số thùng:</label>
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

      {/* ── MODAL: NHẬP TAY TEM THÙNG ─────────────────────────────── */}
      {isManualLabelModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Nhập Tem Thùng Thủ Công
              </h3>
              <button onClick={() => setIsManualLabelModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Mã LOT *:</label>
                <input
                  type="text"
                  value={manualLabelForm.lot_code}
                  onChange={e => setManualLabelForm({ ...manualLabelForm, lot_code: e.target.value })}
                  placeholder="VD: D009TN08096"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Mã SKU *:</label>
                <input
                  type="text"
                  value={manualLabelForm.sku}
                  onChange={e => setManualLabelForm({ ...manualLabelForm, sku: e.target.value })}
                  placeholder="VD: TP101020104.002"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Tên sản phẩm:</label>
                <input
                  type="text"
                  value={manualLabelForm.product_name}
                  onChange={e => setManualLabelForm({ ...manualLabelForm, product_name: e.target.value })}
                  placeholder="VD: Sầu riêng Dona đông lạnh"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Khối lượng (Kg):</label>
                  <input
                    type="number"
                    value={manualLabelForm.weight}
                    onChange={e => setManualLabelForm({ ...manualLabelForm, weight: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Số thùng tạo:</label>
                  <input
                    type="number"
                    value={labelCount}
                    onChange={e => setLabelCount(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (!manualLabelForm.lot_code) {
                  alert('Vui lòng nhập Mã LOT')
                  return
                }
                handleSaveLabelBox(
                  manualLabelForm,
                  parseFloat(manualLabelForm.weight) || 20,
                  parseInt(labelCount, 10) || 1
                )
                setIsManualLabelModal(false)
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30"
            >
              Lưu Vào Pallet {activePalletStt}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
