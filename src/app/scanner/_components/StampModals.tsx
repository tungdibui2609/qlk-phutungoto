'use client'

import React from 'react'
import { CheckCircle2, X, Copy, Save, RotateCcw, Sparkles, Fingerprint } from 'lucide-react'
import type { PendingStampData } from './types'
import { decodeStampBox } from '@/lib/stampDecoder'
import { scannerAlert } from './ScannerDialog'

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
  targetQty?: number
  currentBoxesCount?: number
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
  targetQty = 30,
  currentBoxesCount = 0,
}: StampModalsProps) {
  const remainingBoxes = Math.max(1, targetQty - currentBoxesCount)
  const countNum = parseInt(stampCount, 10) || 1

  return (
    <>
      {/* ── MODAL 1: XÁC NHẬN KẾT QUẢ ĐỌC CON DẤU ─────────────────── */}
      {pendingStamp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[92vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  ĐÃ ĐỌC ĐƯỢC CON DẤU
                </h3>
              </div>
              <button
                onClick={() => setPendingStamp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Inputs Dòng 1 & Dòng 2 */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wide">
                    DÒNG 1 (MÃ SẢN PHẨM):
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {pendingStamp.stamp_line1.length} ký tự
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pendingStamp.stamp_line1}
                    onChange={e => {
                      const val = e.target.value
                      const dec = decodeStampBox(
                        {
                          metadata: {
                            scan_type: 'stamp',
                            stamp_line1: val,
                            stamp_line2: pendingStamp.stamp_line2,
                          },
                        },
                        stampDictMap
                      )
                      setPendingStamp({ ...pendingStamp, stamp_line1: val, decoded: dec })
                    }}
                    placeholder="Chưa phát hiện dòng 1"
                    className="w-full px-3 py-2 pr-8 rounded-lg bg-[#1e293b] border border-slate-600 font-mono text-sm font-black text-amber-400 focus:outline-hidden focus:border-amber-400"
                  />
                  {pendingStamp.stamp_line1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const dec = decodeStampBox(
                          {
                            metadata: {
                              scan_type: 'stamp',
                              stamp_line1: '',
                              stamp_line2: pendingStamp.stamp_line2,
                            },
                          },
                          stampDictMap
                        )
                        setPendingStamp({ ...pendingStamp, stamp_line1: '', decoded: dec })
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wide">
                    DÒNG 2 (DÃY SỐ PHỤ / NGUỒN GỐC):
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {pendingStamp.stamp_line2.length} ký tự
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pendingStamp.stamp_line2}
                    onChange={e => {
                      const val = e.target.value
                      const dec = decodeStampBox(
                        {
                          metadata: {
                            scan_type: 'stamp',
                            stamp_line1: pendingStamp.stamp_line1,
                            stamp_line2: val,
                          },
                        },
                        stampDictMap
                      )
                      setPendingStamp({ ...pendingStamp, stamp_line2: val, decoded: dec })
                    }}
                    placeholder="Chưa phát hiện dòng 2"
                    className="w-full px-3 py-2 pr-8 rounded-lg bg-[#1e293b] border border-slate-600 font-mono text-sm font-black text-emerald-400 focus:outline-hidden focus:border-emerald-400"
                  />
                  {pendingStamp.stamp_line2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const dec = decodeStampBox(
                          {
                            metadata: {
                              scan_type: 'stamp',
                              stamp_line1: pendingStamp.stamp_line1,
                              stamp_line2: '',
                            },
                          },
                          stampDictMap
                        )
                        setPendingStamp({ ...pendingStamp, stamp_line2: '', decoded: dec })
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Realtime Stamp Decoding Details (Match Android #1e1b4b card) */}
            {(() => {
              const dec =
                pendingStamp.decoded ||
                decodeStampBox(
                  {
                    metadata: {
                      scan_type: 'stamp',
                      stamp_line1: pendingStamp.stamp_line1,
                      stamp_line2: pendingStamp.stamp_line2,
                    },
                  },
                  stampDictMap
                )

              return (
                <div className="p-3 rounded-xl bg-[#1e1b4b]/90 border border-indigo-500/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider">
                      🔍 GIẢI MÃ TỨC THÌ (OFFLINE):
                    </span>
                    {dec.isSpecial12 && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-900/90 text-emerald-300 border border-emerald-400/60">
                        ⭐ NGOẠI LỆ 12 SỐ
                      </span>
                    )}
                  </div>

                  {dec.productTitle ? (
                    <p className="text-xs font-black text-white leading-snug">
                      {dec.productTitle}
                      {dec.spec && !dec.isSpecial12 ? ` • ${dec.spec}` : ''}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      Dòng 1 chưa đủ 12 ký tự để nhận diện sản phẩm
                    </p>
                  )}

                  {(() => {
                    const digitsL2 = pendingStamp.stamp_line2.replace(/[^0-9]/g, '')
                    if (digitsL2.length > 0 && digitsL2.length < 16) {
                      return (
                        <p className="text-[11px] text-amber-300/90 italic pt-1 border-t border-indigo-500/30">
                          Dòng 2 mới nhận diện {digitsL2.length}/16 số — vui lòng kiểm tra hoặc nhập bổ sung để giải mã nguồn gốc
                        </p>
                      )
                    }
                    const traceParts = [
                      dec.factoryName,
                      dec.packagingDateStr ? `ĐG: ${dec.packagingDateStr}` : '',
                      dec.rawMaterialDateStr ? `Nhập NL: ${dec.rawMaterialDateStr}` : '',
                      dec.supplierName ? `NCC: ${dec.supplierName}` : '',
                      dec.provinceName ? `Vùng: ${dec.provinceName}` : '',
                    ].filter(Boolean)

                    if (traceParts.length === 0) {
                      return (
                        <p className="text-[11px] text-slate-400 italic pt-1 border-t border-indigo-500/30">
                          Chưa đủ 16 số dòng 2 để giải mã nguồn gốc
                        </p>
                      )
                    }

                    return (
                      <p className="text-[11px] text-slate-200 leading-relaxed pt-1 border-t border-indigo-500/30">
                        {traceParts.join(' • ')}
                      </p>
                    )
                  })()}
                </div>
              )
            })()}

            {/* Khối lượng thùng */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200">Khối lượng thùng (Kg):</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={stampWeight}
                  onChange={e => setStampWeight(e.target.value)}
                  className="w-24 px-3 py-1.5 rounded-lg bg-[#1e293b] border border-slate-600 text-sm font-black text-white font-mono text-center"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {['10', '15', '18', '20', '25'].map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setStampWeight(w)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${stampWeight === w
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                  >
                    {w} Kg
                  </button>
                ))}
              </div>
            </div>

            {/* Số lượng thùng tạo (Nhân bản nhanh) */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200">Số lượng thùng tạo:</label>
                {countNum > 1 && (
                  <span className="text-[11px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                    Nhân bản {countNum} thùng
                  </span>
                )}
              </div>

              <input
                type="number"
                inputMode="numeric"
                value={stampCount}
                onChange={e => setStampCount(e.target.value)}
                placeholder="1"
                className={`w-full px-3 py-2 rounded-lg bg-[#1e293b] border font-mono text-base font-black ${countNum > 1
                    ? 'border-amber-400 text-amber-400'
                    : 'border-slate-700 text-white'
                  }`}
              />

              {/* Quick Chips Row matching StampScannerScreen.tsx */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setStampCount('1')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${stampCount === '1'
                      ? 'bg-amber-900/70 border-amber-400 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                >
                  1 thùng
                </button>
                {remainingBoxes > 1 && (
                  <button
                    type="button"
                    onClick={() => setStampCount(String(remainingBoxes))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${stampCount === String(remainingBoxes)
                        ? 'bg-amber-900/70 border-amber-400 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                      }`}
                  >
                    Điền đủ ({remainingBoxes})
                  </button>
                )}
                {['5', '10', '20'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setStampCount(c)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${stampCount === c
                        ? 'bg-amber-900/70 border-amber-400 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                  >
                    +{c}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingStamp(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={14} className="text-slate-400" />
                <span>Quét Lại</span>
              </button>
              <button
                type="button"
                onClick={handleSaveStampBox}
                className="flex-[1.5] py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                {countNum > 1 ? <Copy size={15} /> : <Save size={15} />}
                <span>
                  {countNum > 1
                    ? `Nhân Bản (${countNum} Thùng)`
                    : `Lưu Vào Pallet ${activePalletStt}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: NHẬP SỐ TAY CON DẤU (CÓ LIVE PREVIEW GIẢI MÃ) ─── */}
      {isManualStampModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[92vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Fingerprint size={18} className="text-amber-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  Nhập Dãy Số Con Dấu Thủ Công
                </h3>
              </div>
              <button
                onClick={() => setIsManualStampModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-amber-300">
                    DÒNG 1 (Ví dụ: 10102010204001):
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setManualStampLine1('10102010204001')}
                      className="text-[10px] text-sky-400 hover:underline"
                    >
                      Mẫu chuẩn
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {manualStampLine1.length} ký tự
                    </span>
                  </div>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualStampLine1}
                  onChange={e => setManualStampLine1(e.target.value)}
                  placeholder="Nhập dòng 1 (12 - 14 số)"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-sm font-bold text-amber-300 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-emerald-300">
                    DÒNG 2 (Ví dụ: 1110926001471609):
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setManualStampLine2('1110926001471609')}
                      className="text-[10px] text-sky-400 hover:underline"
                    >
                      Mẫu dòng 2
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {manualStampLine2.length} ký tự
                    </span>
                  </div>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualStampLine2}
                  onChange={e => setManualStampLine2(e.target.value)}
                  placeholder="Nhập dòng 2 (16 số)"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-sm font-bold text-emerald-300 focus:outline-hidden focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Live Preview Giải Mã trong Modal Thủ Công (Giống StampScannerScreen.tsx) */}
            {(manualStampLine1.trim() || manualStampLine2.trim()) &&
              (() => {
                const dec = decodeStampBox(
                  {
                    metadata: {
                      scan_type: 'stamp',
                      stamp_line1: manualStampLine1.trim(),
                      stamp_line2: manualStampLine2.trim(),
                    },
                  },
                  stampDictMap
                )

                return (
                  <div className="p-3 rounded-xl bg-[#1e1b4b]/90 border border-indigo-500/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-indigo-300 flex items-center gap-1">
                        <Sparkles size={11} />
                        XEM TRƯỚC GIẢI MÃ:
                      </span>
                      {dec.isSpecial12 && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300 border border-emerald-400/50">
                          ⭐ NGOẠI LỆ 12 SỐ
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-white leading-snug">
                      {dec.productTitle || 'Đang chờ đủ ký tự Dòng 1...'}
                    </p>
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300 pt-1 border-t border-indigo-500/30">
                      <div>
                        Nhà máy: <strong className="text-white">{dec.factoryName || '---'}</strong>
                      </div>
                      <div>
                        Vùng NL: <strong className="text-white">{dec.provinceName || '---'}</strong>
                      </div>
                      <div>
                        Nhập NL:{' '}
                        <strong className="text-amber-300 font-mono">
                          {dec.rawMaterialDateStr || '---'}
                        </strong>
                      </div>
                      <div>
                        Đóng gói:{' '}
                        <strong className="text-white font-mono">
                          {dec.packagingDateStr || '---'}
                        </strong>
                      </div>
                    </div>
                  </div>
                )
              })()}

            {/* Khối lượng & Số thùng nhân bản ngay trong modal nhập tay */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  Khối lượng (Kg):
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={stampWeight}
                  onChange={e => setStampWeight(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  Số thùng tạo (Nhân bản):
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={stampCount}
                  onChange={e => setStampCount(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg bg-slate-900 border text-xs font-mono font-bold ${countNum > 1
                      ? 'border-amber-400 text-amber-400'
                      : 'border-slate-700 text-white'
                    }`}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setStampCount('1')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold border ${stampCount === '1'
                    ? 'bg-amber-900/70 border-amber-400 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
              >
                1 thùng
              </button>
              {remainingBoxes > 1 && (
                <button
                  type="button"
                  onClick={() => setStampCount(String(remainingBoxes))}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold border ${stampCount === String(remainingBoxes)
                      ? 'bg-amber-900/70 border-amber-400 text-amber-300'
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
                  onClick={() => setStampCount(c)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold border ${stampCount === c
                      ? 'bg-amber-900/70 border-amber-400 text-amber-300'
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
                onClick={() => setIsManualStampModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!manualStampLine1.trim() && !manualStampLine2.trim()) {
                    await scannerAlert({
                      title: 'Thiếu dữ liệu con dấu',
                      message: 'Vui lòng nhập ít nhất 1 dòng số đóng dấu.',
                      variant: 'warning',
                    })
                    return
                  }
                  const dec = decodeStampBox(
                    {
                      metadata: {
                        scan_type: 'stamp',
                        stamp_line1: manualStampLine1.trim(),
                        stamp_line2: manualStampLine2.trim(),
                      },
                    },
                    stampDictMap
                  )
                  setPendingStamp({
                    stamp_line1: manualStampLine1.trim(),
                    stamp_line2: manualStampLine2.trim(),
                    decoded: dec,
                  })
                  setIsManualStampModal(false)
                }}
                className="flex-[1.5] py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400 transition shadow-lg shadow-amber-500/25"
              >
                Giải Mã & Xác Nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
