'use client'

import React from 'react'
import { Scan, Boxes, Trash2, X, Search, ChevronRight, RefreshCw, MapPin, Database, HardDrive } from 'lucide-react'
import type { PalletItem, ProductSuggestion, ScannerTab } from './types'
import type { OfflinePendingPallet } from '@/lib/scanner-db'
import { removePendingPallet, getPendingPallets } from '@/lib/scanner-db'

interface ScannerPalletsTabProps {
  activeTab: ScannerTab
  setActiveTab: React.Dispatch<React.SetStateAction<ScannerTab>>
  palletListSubTab: 'pending' | 'cloud'
  setPalletListSubTab: React.Dispatch<React.SetStateAction<'pending' | 'cloud'>>
  isOnline: boolean
  pendingPallets: OfflinePendingPallet[]
  setPendingPallets: React.Dispatch<React.SetStateAction<OfflinePendingPallet[]>>
  isSyncingPending: boolean
  handleSyncPendingQueue: () => Promise<void>
  handleSyncSinglePending: (item: OfflinePendingPallet) => Promise<void>
  palletsList: PalletItem[]
  filteredPallets: PalletItem[]
  displayedPallets: PalletItem[]
  palletFilter: 'all' | 'linked' | 'unlinked'
  setPalletFilter: React.Dispatch<React.SetStateAction<'all' | 'linked' | 'unlinked'>>
  palletDisplayLimit: number
  setPalletDisplayLimit: React.Dispatch<React.SetStateAction<number>>
  searchQuery: string
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>
  showSearchSuggestions: boolean
  setShowSearchSuggestions: React.Dispatch<React.SetStateAction<boolean>>
  productSuggestions: ProductSuggestion[]
  loadAllPallets: () => Promise<void>
  handleOpenPalletDetail: (pallet: PalletItem) => Promise<void>
  setActivePalletStt: React.Dispatch<React.SetStateAction<string>>
  loadCurrentPalletBoxes: (stt: string) => Promise<void>
  triggerToast: (msg: string) => void
}

export function ScannerPalletsTab({
  activeTab,
  setActiveTab,
  palletListSubTab,
  setPalletListSubTab,
  isOnline,
  pendingPallets,
  setPendingPallets,
  isSyncingPending,
  handleSyncPendingQueue,
  handleSyncSinglePending,
  palletsList,
  filteredPallets,
  displayedPallets,
  palletFilter,
  setPalletFilter,
  palletDisplayLimit,
  setPalletDisplayLimit,
  searchQuery,
  setSearchQuery,
  showSearchSuggestions,
  setShowSearchSuggestions,
  productSuggestions,
  loadAllPallets,
  handleOpenPalletDetail,
  setActivePalletStt,
  loadCurrentPalletBoxes,
  triggerToast,
}: ScannerPalletsTabProps) {
  if (activeTab !== 'pallets') return null
  return (
    <>
        <div className="flex-1 flex flex-col bg-[#0b0f19] overflow-hidden">

          {/* Top Sub-tabs Bar: Chờ đẩy lên (Local) vs Web mẹ (Cloud) */}
          <div className="p-2 border-b border-slate-800 bg-[#0f172a] space-y-2">
            <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 gap-1">
              <button
                onClick={() => setPalletListSubTab('pending')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  palletListSubTab === 'pending'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <HardDrive size={13} />
                <span>Chờ đẩy lên</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${palletListSubTab === 'pending' ? 'bg-black/30 text-white font-mono' : 'bg-slate-800 text-slate-400'}`}>
                  {pendingPallets.length}
                </span>
              </button>

              <button
                onClick={() => setPalletListSubTab('cloud')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  palletListSubTab === 'cloud'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Database size={13} />
                <span>Web mẹ (Cloud)</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${palletListSubTab === 'cloud' ? 'bg-black/30 text-white font-mono' : 'bg-slate-800 text-slate-400'}`}>
                  {palletsList.length}
                </span>
              </button>
            </div>

            {/* Sub-tab 1 Controls: Pending Pallets toolbar */}
            {palletListSubTab === 'pending' && (
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-400 text-[11px]">
                  Pallet lưu tạm trên thiết bị: <strong className="text-amber-400">{pendingPallets.length}</strong>
                </span>
                {pendingPallets.length > 0 && (
                  <button
                    onClick={handleSyncPendingQueue}
                    disabled={isSyncingPending || !isOnline}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-[11px] font-bold flex items-center gap-1 shadow-xs"
                  >
                    <RefreshCw size={12} className={isSyncingPending ? 'animate-spin' : ''} />
                    <span>Đồng bộ tất cả</span>
                  </button>
                )}
              </div>
            )}

            {/* Sub-tab 2 Controls: Cloud Pallets search & filters */}
            {palletListSubTab === 'cloud' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value)
                        setShowSearchSuggestions(true)
                      }}
                      onFocus={() => setShowSearchSuggestions(true)}
                      placeholder="Tìm STT, LOT, gõ tắt (VD: Đô c, srmc)..."
                      className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => {
                          setSearchQuery('')
                          setShowSearchSuggestions(false)
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        title="Xóa tìm kiếm"
                      >
                        <X size={14} />
                      </button>
                    )}

                    {/* Autocomplete Product Suggestions Dropdown */}
                    {showSearchSuggestions && productSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800">
                        <div className="p-1.5 bg-slate-950 text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                          <span>Gợi ý sản phẩm ({productSuggestions.length}):</span>
                          <button
                            onClick={() => setShowSearchSuggestions(false)}
                            className="text-slate-500 hover:text-white text-[10px]"
                          >
                            Đóng ✕
                          </button>
                        </div>
                        {productSuggestions.map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSearchQuery(p.name)
                              setShowSearchSuggestions(false)
                            }}
                            className="p-2 hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs"
                          >
                            <div className="truncate mr-2">
                              <p className="font-bold text-white truncate">{p.name}</p>
                              {p.aliases && (
                                <p className="text-[10px] text-emerald-400 font-mono">Gõ tắt: {p.aliases}</p>
                              )}
                            </div>
                            {p.sku && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px] shrink-0">
                                {p.sku}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={loadAllPallets}
                    className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
                    title="Tải lại danh sách"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                {/* Filter Sub-chips */}
                <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                  <button
                    onClick={() => setPalletFilter('all')}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-md transition ${palletFilter === 'all' ? 'bg-sky-600 text-white' : 'text-slate-400'}`}
                  >
                    Tất cả ({palletsList.length})
                  </button>
                  <button
                    onClick={() => setPalletFilter('unlinked')}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-md transition ${palletFilter === 'unlinked' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}
                  >
                    Chờ duyệt LOT
                  </button>
                  <button
                    onClick={() => setPalletFilter('linked')}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-md transition ${palletFilter === 'linked' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                  >
                    Đã duyệt LOT
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* List Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">

            {/* SUB-VIEW 1: PENDING PALLETS LIST */}
            {palletListSubTab === 'pending' && (
              <>
                {pendingPallets.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 space-y-2">
                    <HardDrive size={36} className="mx-auto text-slate-600 stroke-[1.5]" />
                    <p className="text-xs font-bold text-slate-300">Không có Pallet nào đang chờ đẩy lên</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Tất cả các pallet bạn quét đều đã được đồng bộ an toàn lên máy chủ Web mẹ.
                    </p>
                  </div>
                ) : (
                  pendingPallets.map(item => (
                    <div
                      key={item.client_id}
                      className="p-3 rounded-xl bg-[#111827] border border-amber-500/40 space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black font-mono text-xs">
                            STT: {item.stt}
                          </span>
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                            Chờ đồng bộ ({item.boxes_count} thùng)
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.created_at).toLocaleTimeString('vi-VN')}
                        </span>
                      </div>

                      <div className="text-xs text-white font-bold">
                        {item.product_name || 'Hàng lưu ngoại tuyến'}
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono">
                        Mã LOT: <strong className="text-sky-300">{item.lot_code || 'LOT'}</strong> · SKU: {item.sku || 'SKU'}
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center gap-2 justify-end">
                        <button
                          onClick={() => {
                            setActivePalletStt(item.stt)
                            setActiveTab('label')
                            loadCurrentPalletBoxes(item.stt)
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1"
                        >
                          <Scan size={12} className="text-emerald-400" />
                          <span>Mở quét tiếp</span>
                        </button>

                        <button
                          onClick={() => handleSyncSinglePending(item)}
                          disabled={!isOnline}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1"
                        >
                          <RefreshCw size={12} />
                          <span>Đẩy lên Web</span>
                        </button>

                        <button
                          onClick={async () => {
                            if (confirm(`Bạn có chắc muốn xóa Pallet ${item.stt} khỏi hàng đợi không?`)) {
                              await removePendingPallet(item.client_id)
                              const updated = await getPendingPallets()
                              setPendingPallets(updated)
                              triggerToast('Đã xóa khỏi hàng đợi')
                            }
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:text-white"
                          title="Xóa pallet này"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* SUB-VIEW 2: CLOUD PALLETS LIST */}
            {palletListSubTab === 'cloud' && (
              <>
                {filteredPallets.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 space-y-2">
                    <Boxes size={36} className="mx-auto text-slate-600 stroke-[1.5]" />
                    <p className="text-xs">Không tìm thấy Pallet nào khớp với bộ lọc</p>
                  </div>
                ) : (
                  <>
                    {displayedPallets.map(p => (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl bg-[#111827] border border-slate-800 hover:border-slate-700 transition space-y-2 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black font-mono">
                              STT: {p.stt}
                            </span>
                            {p.location_code && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold font-mono">
                                <MapPin size={10} className="text-amber-400" />
                                VT: {p.location_code}
                              </span>
                            )}
                            {p.tag && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-600/20 text-orange-400 border border-orange-500/40 text-[10px] font-bold font-mono">
                                🏷️ {p.tag}
                              </span>
                            )}
                            {p.is_linked ? (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                                ✓ Đã kết nối LOT
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                                ⏳ Chờ duyệt LOT
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {p.boxes_count} thùng
                          </span>
                        </div>

                        {p.is_special_12 && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black">
                            ⭐ 12 SỐ ĐẦU TRỌN GÓI
                          </span>
                        )}

                        {p.lot_code && (
                          <div className="text-[11px] text-slate-400">
                            Mã LOT Web: <span className="text-sky-400 font-mono font-bold">{p.lot_code}</span>
                          </div>
                        )}

                        <p className="text-xs font-bold text-white leading-snug line-clamp-2">
                          {p.product_name}
                        </p>

                        {p.product_aliases && (
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <span>🏷️ Gõ tắt:</span>
                            <span className="text-emerald-400 font-bold">{p.product_aliases}</span>
                          </div>
                        )}

                        {p.notes && (
                          <div className="text-[11px] text-slate-300 bg-slate-900/90 border border-slate-800/80 px-2.5 py-1 rounded-lg">
                            <span className="text-slate-500 text-[10px] block font-bold">📝 GHI CHÚ:</span>
                            <span className="text-slate-300 italic">{p.notes}</span>
                          </div>
                        )}

                        {/* Quick Actions Row: Kéo về sửa & Xem chi tiết */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {p.production_date ? `NSX: ${p.production_date}` : ''}
                          </span>

                          <button
                            onClick={() => handleOpenPalletDetail(p)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
                          >
                            <span>Xem chi tiết</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {filteredPallets.length > palletDisplayLimit && (
                      <div className="pt-2 pb-4 text-center">
                        <button
                          onClick={() => setPalletDisplayLimit(prev => prev + 30)}
                          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 active:scale-[0.98] transition"
                        >
                          Tải thêm ({filteredPallets.length - palletDisplayLimit} Pallet còn lại)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
    </>
  )
}
