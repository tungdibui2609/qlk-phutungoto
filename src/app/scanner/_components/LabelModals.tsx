'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { CheckCircle2, X, Search, Copy, Save, RotateCcw, Tag } from 'lucide-react'
import type { ManualLabelFormState, ProductSuggestion } from './types'
import { ensureProductsCatalogLoaded, getProductSuggestions } from './scannerUtils'
import { searchLotsFromOfflineDb, type OfflineLot } from '@/lib/scanner-db'

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
  targetQty?: number
  currentBoxesCount?: number
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
  targetQty = 30,
  currentBoxesCount = 0,
}: LabelModalsProps) {
  const [products, setProducts] = useState<ProductSuggestion[]>([])
  const [showPendingProdSugg, setShowPendingProdSugg] = useState(false)
  const [showManualProdSugg, setShowManualProdSugg] = useState(false)
  const [lotSuggestions, setLotSuggestions] = useState<OfflineLot[]>([])
  const [showLotSugg, setShowLotSugg] = useState(false)

  useEffect(() => {
    if (pendingLabel || isManualLabelModal) {
      ensureProductsCatalogLoaded().then(setProducts).catch(() => {})
    }
  }, [pendingLabel, isManualLabelModal])

  // Offline LOT autocomplete when typing lot_code in manual modal
  useEffect(() => {
    const q = manualLabelForm.lot_code?.trim()
    if (!isManualLabelModal || !q || q.length < 2) {
      setLotSuggestions([])
      return
    }
    let cancelled = false
    searchLotsFromOfflineDb(q, 6)
      .then(res => {
        if (!cancelled) setLotSuggestions(res)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [manualLabelForm.lot_code, isManualLabelModal])

  const pendingProdSuggestions = useMemo(() => {
    if (!pendingLabel?.product_name) return []
    return getProductSuggestions(pendingLabel.product_name, products, 6)
  }, [pendingLabel?.product_name, products])

  const manualProdSuggestions = useMemo(() => {
    const q = manualLabelForm.product_name || manualLabelForm.sku || ''
    if (!q.trim()) return []
    return getProductSuggestions(q, products, 6)
  }, [manualLabelForm.product_name, manualLabelForm.sku, products])

  const remainingBoxes = Math.max(1, targetQty - currentBoxesCount)
  const countNum = parseInt(labelCount, 10) || 1

  const fillTodayStr = () => {
    const d = new Date()
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  return (
    <>
      {/* ── MODAL 1: KẾT QUẢ ĐỌC TEM THÙNG (OCR CONFIRM & EDIT) ───── */}
      {pendingLabel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-emerald-500/40 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[92vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  KẾT QUẢ ĐỌC TEM THÙNG
                </h3>
              </div>
              <button
                onClick={() => setPendingLabel(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Product Name with Autocomplete (Aliases + SKU + Name) */}
            <div className="relative">
              <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                Tên sản phẩm (hỗ trợ gõ tắt):
              </label>
              <input
                type="text"
                value={pendingLabel.product_name || ''}
                onChange={e => {
                  setPendingLabel({ ...pendingLabel, product_name: e.target.value })
                  setShowPendingProdSugg(true)
                }}
                onFocus={() => setShowPendingProdSugg(true)}
                placeholder="Nhập tên SP hoặc gõ tắt (VD: srmc, dncv, ri6)..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-hidden focus:border-emerald-500"
              />
              {showPendingProdSugg && pendingProdSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800 max-h-48 overflow-y-auto">
                  <div className="px-2.5 py-1.5 bg-slate-950 flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                    <span className="flex items-center gap-1">
                      <Search size={11} /> Gợi ý sản phẩm ({pendingProdSuggestions.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPendingProdSugg(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      Đóng ✕
                    </button>
                  </div>
                  {pendingProdSuggestions.map((item, idx) => (
                    <button
                      key={item.product.id + '_' + idx}
                      type="button"
                      onClick={() => {
                        setPendingLabel({
                          ...pendingLabel,
                          product_name: item.product.name,
                          sku: item.product.sku || pendingLabel.sku,
                        })
                        setShowPendingProdSugg(false)
                      }}
                      className="w-full p-2 text-left hover:bg-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white truncate">{item.displayTitle}</p>
                        {item.displaySubtitle && (
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            {item.displaySubtitle}
                          </p>
                        )}
                      </div>
                      {item.badgeText && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold shrink-0">
                          {item.badgeText}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">STT Thùng (INDEX):</span>
                <input
                  type="text"
                  value={pendingLabel.box_index || ''}
                  onChange={e => setPendingLabel({ ...pendingLabel, box_index: e.target.value })}
                  placeholder="Tự động"
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs font-black text-emerald-400"
                />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">SKU:</span>
                <input
                  type="text"
                  value={pendingLabel.sku || ''}
                  onChange={e => setPendingLabel({ ...pendingLabel, sku: e.target.value })}
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Mã LOT:</span>
                <input
                  type="text"
                  value={pendingLabel.lot_code || ''}
                  onChange={e =>
                    setPendingLabel({ ...pendingLabel, lot_code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-sky-300 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Quy cách:</span>
                <input
                  type="text"
                  value={pendingLabel.spec || ''}
                  onChange={e => setPendingLabel({ ...pendingLabel, spec: e.target.value })}
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Tổ / Nhóm:</span>
                <input
                  type="text"
                  value={pendingLabel.shift_group || ''}
                  onChange={e => setPendingLabel({ ...pendingLabel, shift_group: e.target.value })}
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Vùng NL:</span>
                <input
                  type="text"
                  value={pendingLabel.region || ''}
                  onChange={e => setPendingLabel({ ...pendingLabel, region: e.target.value })}
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Ngày SX:</span>
                <input
                  type="text"
                  value={pendingLabel.production_date || ''}
                  onChange={e =>
                    setPendingLabel({ ...pendingLabel, production_date: e.target.value })
                  }
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-amber-400"
                />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Ngày ĐG:</span>
                <input
                  type="text"
                  value={pendingLabel.packaging_date || ''}
                  onChange={e =>
                    setPendingLabel({ ...pendingLabel, packaging_date: e.target.value })
                  }
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Khối lượng (Kg):</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={labelWeight}
                  onChange={e => setLabelWeight(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Số thùng tạo:</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={labelCount}
                  onChange={e => setLabelCount(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg bg-slate-900 border text-xs font-mono font-bold ${
                    countNum > 1
                      ? 'border-emerald-400 text-emerald-400'
                      : 'border-slate-700 text-white'
                  }`}
                />
              </div>
            </div>

            {/* Quick Count Chips */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setLabelCount('1')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold border ${
                  labelCount === '1'
                    ? 'bg-emerald-900/70 border-emerald-400 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                1 thùng
              </button>
              {remainingBoxes > 1 && (
                <button
                  type="button"
                  onClick={() => setLabelCount(String(remainingBoxes))}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold border ${
                    labelCount === String(remainingBoxes)
                      ? 'bg-emerald-900/70 border-emerald-400 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  Điền đủ ({remainingBoxes})
                </button>
              )}
              {['5', '10', '20', '30'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setLabelCount(c)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold border ${
                    labelCount === c
                      ? 'bg-emerald-900/70 border-emerald-400 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  +{c}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingLabel(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition flex items-center justify-center gap-1"
              >
                <RotateCcw size={13} />
                <span>Quét Lại</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSaveLabelBox(
                    pendingLabel,
                    parseFloat(labelWeight) || 20,
                    parseInt(labelCount, 10) || 1
                  )
                }
                className="flex-[1.5] py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5"
              >
                {countNum > 1 ? <Copy size={14} /> : <Save size={14} />}
                <span>
                  {countNum > 1
                    ? `Nhân Bản (${countNum} Thùng)`
                    : `Lưu vào Pallet ${activePalletStt}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: NHẬP / SỬA TEM THÙNG THỦ CÔNG (MATCH ANDROID) ─── */}
      {isManualLabelModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[92vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Tag size={17} className="text-emerald-400" />
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    ✏️ NHẬP / SỬA THÙNG TAY
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Dành cho tem mờ hoặc điều chỉnh số thùng nhanh
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManualLabelModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5">
              {/* Số thứ tự thùng (INDEX) nổi bật giống ScannerScreen.tsx */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-emerald-400 block mb-0.5">
                    Số thứ tự thùng (INDEX):
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={manualLabelForm.box_index}
                    onChange={e =>
                      setManualLabelForm({ ...manualLabelForm, box_index: e.target.value })
                    }
                    placeholder="Tự động tăng"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-emerald-500/40 font-mono text-sm font-black text-emerald-400 focus:outline-hidden focus:border-emerald-400"
                  />
                </div>

                {/* Mã LOT với gợi ý từ Offline LOT DB */}
                <div className="relative">
                  <label className="text-[10px] font-bold text-sky-400 block mb-0.5">
                    Mã LOT *:
                  </label>
                  <input
                    type="text"
                    value={manualLabelForm.lot_code}
                    onChange={e => {
                      setManualLabelForm({
                        ...manualLabelForm,
                        lot_code: e.target.value.toUpperCase(),
                      })
                      setShowLotSugg(true)
                    }}
                    onFocus={() => setShowLotSugg(true)}
                    placeholder="VD: D009TN08096"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-sm font-bold text-white uppercase focus:outline-hidden focus:border-sky-500"
                  />
                  {showLotSugg && lotSuggestions.length > 0 && (
                    <div className="absolute right-0 left-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800 max-h-40 overflow-y-auto">
                      {lotSuggestions.map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setManualLabelForm({
                              ...manualLabelForm,
                              lot_code: l.lot_code,
                              product_name: l.product_name || manualLabelForm.product_name,
                              sku: l.sku || manualLabelForm.sku,
                            })
                            setShowLotSugg(false)
                          }}
                          className="w-full p-2 text-left hover:bg-slate-800 text-xs"
                        >
                          <div className="font-mono font-bold text-sky-400">{l.lot_code}</div>
                          <div className="text-[10px] text-slate-300 truncate">{l.product_name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tên sản phẩm / Gõ tắt có Autocomplete */}
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-300 block mb-0.5">
                  Tên sản phẩm / Gõ tắt (aliases):
                </label>
                <input
                  type="text"
                  value={manualLabelForm.product_name}
                  onChange={e => {
                    setManualLabelForm({ ...manualLabelForm, product_name: e.target.value })
                    setShowManualProdSugg(true)
                  }}
                  onFocus={() => setShowManualProdSugg(true)}
                  placeholder="Gõ tắt (VD: srmc, dncv, ri6) hoặc tên SP..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                />

                {showManualProdSugg && manualProdSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800 max-h-48 overflow-y-auto">
                    <div className="px-2.5 py-1.5 bg-slate-950 flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                      <span className="flex items-center gap-1">
                        <Search size={11} /> Gợi ý sản phẩm ({manualProdSuggestions.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowManualProdSugg(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        Đóng ✕
                      </button>
                    </div>
                    {manualProdSuggestions.map((item, idx) => (
                      <button
                        key={item.product.id + '_' + idx}
                        type="button"
                        onClick={() => {
                          setManualLabelForm({
                            ...manualLabelForm,
                            product_name: item.product.name,
                            sku: item.product.sku || manualLabelForm.sku,
                          })
                          setShowManualProdSugg(false)
                        }}
                        className="w-full p-2 text-left hover:bg-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white truncate">{item.displayTitle}</p>
                          {item.displaySubtitle && (
                            <p className="text-[10px] text-slate-400 font-mono truncate">
                              {item.displaySubtitle}
                            </p>
                          )}
                        </div>
                        {item.badgeText && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold shrink-0">
                            {item.badgeText}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* SKU & Quy cách */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    Mã SKU *:
                  </label>
                  <input
                    type="text"
                    value={manualLabelForm.sku}
                    onChange={e =>
                      setManualLabelForm({ ...manualLabelForm, sku: e.target.value.toUpperCase() })
                    }
                    placeholder="VD: TP101020104.002"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    Quy cách:
                  </label>
                  <input
                    type="text"
                    value={manualLabelForm.spec}
                    onChange={e =>
                      setManualLabelForm({ ...manualLabelForm, spec: e.target.value })
                    }
                    placeholder="VD: 2 Túi/ thùng"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              {/* Tổ/Nhóm & Vùng NL */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    Tổ / Nhóm:
                  </label>
                  <input
                    type="text"
                    value={manualLabelForm.shift_group}
                    onChange={e =>
                      setManualLabelForm({ ...manualLabelForm, shift_group: e.target.value })
                    }
                    placeholder="Nguyên"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    Vùng nguyên liệu:
                  </label>
                  <input
                    type="text"
                    value={manualLabelForm.region}
                    onChange={e =>
                      setManualLabelForm({ ...manualLabelForm, region: e.target.value })
                    }
                    placeholder="Tây Nguyên"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              {/* Ngày SX & Ngày ĐG */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10px] font-bold text-slate-400">Ngày SX:</label>
                    <button
                      type="button"
                      onClick={() => {
                        const t = fillTodayStr()
                        setManualLabelForm({
                          ...manualLabelForm,
                          production_date: t,
                          packaging_date: manualLabelForm.packaging_date || t,
                        })
                      }}
                      className="text-[9px] text-sky-400 hover:underline"
                    >
                      Hôm nay
                    </button>
                  </div>
                  <input
                    type="text"
                    value={manualLabelForm.production_date}
                    onChange={e =>
                      setManualLabelForm({ ...manualLabelForm, production_date: e.target.value })
                    }
                    placeholder="DD/MM/YYYY"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    Ngày ĐG:
                  </label>
                  <input
                    type="text"
                    value={manualLabelForm.packaging_date}
                    onChange={e =>
                      setManualLabelForm({ ...manualLabelForm, packaging_date: e.target.value })
                    }
                    placeholder="DD/MM/YYYY"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                  />
                </div>
              </div>

              {/* Khối lượng & Số thùng tạo */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    Khối lượng (Kg):
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={manualLabelForm.weight}
                    onChange={e =>
                      setManualLabelForm({ ...manualLabelForm, weight: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    Số thùng tạo:
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={labelCount}
                    onChange={e => setLabelCount(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-lg bg-slate-900 border text-xs font-mono font-bold ${
                      countNum > 1
                        ? 'border-emerald-400 text-emerald-400'
                        : 'border-slate-700 text-white'
                    }`}
                  />
                </div>
              </div>

              {/* Quick Count Chips */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setLabelCount('1')}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold border ${
                    labelCount === '1'
                      ? 'bg-emerald-900/70 border-emerald-400 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  1 thùng
                </button>
                {remainingBoxes > 1 && (
                  <button
                    type="button"
                    onClick={() => setLabelCount(String(remainingBoxes))}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold border ${
                      labelCount === String(remainingBoxes)
                        ? 'bg-emerald-900/70 border-emerald-400 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    Điền đủ ({remainingBoxes})
                  </button>
                )}
                {['5', '10', '20', '30'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setLabelCount(c)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold border ${
                      labelCount === c
                        ? 'bg-emerald-900/70 border-emerald-400 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    +{c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsManualLabelModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!manualLabelForm.lot_code.trim()) {
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
                className="flex-[1.5] py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30"
              >
                {countNum > 1
                  ? `Thêm ${countNum} Thùng Vào Pallet ${activePalletStt}`
                  : `Thêm Vào Pallet ${activePalletStt}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
