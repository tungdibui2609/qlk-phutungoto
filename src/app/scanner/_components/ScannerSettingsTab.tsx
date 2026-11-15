'use client'

import React from 'react'
import { Share2, Smartphone, Loader2, Volume2, VolumeX, Database, CloudDownload, Barcode, User, LogOut, ShieldCheck } from 'lucide-react'
import type { ScannerTab, ScannerUserProfile } from './types'
import { supabase } from '@/lib/supabaseClient'

interface ScannerSettingsTabProps {
  activeTab: ScannerTab
  userProfile: ScannerUserProfile | null
  soundEnabled: boolean
  setSoundEnabled: React.Dispatch<React.SetStateAction<boolean>>
  systemCode: string
  setSystemCode: React.Dispatch<React.SetStateAction<string>>
  targetQty: number
  setTargetQty: React.Dispatch<React.SetStateAction<number>>
  stampRulesCount: number
  syncingStamp: boolean
  handleSyncStampRules: () => Promise<void>
  offlineLotsCount: number
  isSyncingLots: boolean
  handleSyncLotsOffline: () => Promise<void>
  showTechnicianConfig: boolean
  technicianUrl: string
  setTechnicianUrl: React.Dispatch<React.SetStateAction<string>>
  testingConnection: boolean
  testResult: string | null
  handleTestConnection: () => Promise<void>
  handleVersionTap: () => void
}

export function ScannerSettingsTab({
  activeTab,
  userProfile,
  soundEnabled,
  setSoundEnabled,
  systemCode,
  setSystemCode,
  targetQty,
  setTargetQty,
  stampRulesCount,
  syncingStamp,
  handleSyncStampRules,
  offlineLotsCount,
  isSyncingLots,
  handleSyncLotsOffline,
  showTechnicianConfig,
  technicianUrl,
  setTechnicianUrl,
  testingConnection,
  testResult,
  handleTestConnection,
  handleVersionTap,
}: ScannerSettingsTabProps) {
  if (activeTab !== 'settings') return null
  return (
    <>
      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto bg-[#0b0f19] p-4 space-y-4">

          {/* User Profile Card (Matching Mobile App) */}
          <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-600 to-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-md">
                {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{userProfile?.fullName}</h3>
                <p className="text-xs text-sky-400 font-medium truncate">{userProfile?.roleName}</p>
                <p className="text-[11px] text-slate-400 font-mono truncate">{userProfile?.email}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Đơn vị: <strong>{userProfile?.companyName}</strong></span>
              <button
                onClick={async () => {
                  if (confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
                    await supabase.auth.signOut()
                    window.location.href = '/login'
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1 transition"
              >
                <LogOut size={12} />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>

          {/* General Preferences */}
          <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              ⚙️ Cấu Hình Máy Quét
            </h3>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Mã hệ thống kho:</label>
              <select
                value={systemCode}
                onChange={e => setSystemCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="KHO_DONG_LANH">Kho Đông Lạnh (KHO_DONG_LANH)</option>
                <option value="KHO_NGUYEN_LIEU">Kho Nguyên Liệu</option>
                <option value="KHO_THANH_PHAM">Kho Thành Phẩm</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Số lượng thùng chuẩn / Pallet:</label>
              <input
                type="number"
                value={targetQty}
                onChange={e => setTargetQty(parseInt(e.target.value, 10) || 30)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-300">Âm thanh khi quét thành công:</span>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-lg border transition ${soundEnabled ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
            </div>
          </div>

          {/* Offline Stamp Rules Sync */}
          <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Barcode size={18} className="text-purple-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-400">
                  Quy Tắc Dấu Đóng Mực (Offline)
                </h3>
              </div>
              <span className="text-xs font-black text-sky-400 font-mono">
                {stampRulesCount} quy tắc
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Lưu trong bộ nhớ máy để tự động giải mã 2 dòng dấu đóng ngay cả khi không có mạng wifi trong kho lạnh.
            </p>

            <button
              onClick={handleSyncStampRules}
              disabled={syncingStamp}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 active:scale-[0.98]"
            >
              {syncingStamp ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Đang tải từ máy chủ web...</span>
                </>
              ) : (
                <>
                  <CloudDownload size={15} />
                  <span>Tải / Cập nhật quy tắc từ Web mẹ</span>
                </>
              )}
            </button>
          </div>

          {/* Offline LOT Data Sync */}
          <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-sky-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Dữ Liệu LOT Ngoại Tuyến (Offline)
                </h3>
              </div>
              <span className="text-xs font-black text-emerald-400 font-mono">
                {offlineLotsCount} LOT
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tải toàn bộ LOT từ máy chủ về bộ nhớ trình duyệt (IndexedDB) để tra cứu, gõ tắt và gợi ý ngay cả khi ở trong kho lạnh mất mạng 100%.
            </p>

            <button
              onClick={handleSyncLotsOffline}
              disabled={isSyncingLots}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 active:scale-[0.98]"
            >
              {isSyncingLots ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Đang tải danh sách LOT về máy...</span>
                </>
              ) : (
                <>
                  <CloudDownload size={15} />
                  <span>Tải / Cập nhật dữ liệu LOT về máy</span>
                </>
              )}
            </button>
          </div>

          {/* Technician Mode Card (Easter Egg: unlocked by tapping version 5 times) */}
          {showTechnicianConfig && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/40 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-amber-400">
                <ShieldCheck size={18} />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  🔓 Chế Độ Kỹ Thuật Viên Máy Chủ
                </h3>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Máy chủ API Supabase:</label>
                <input
                  type="text"
                  value={technicianUrl}
                  onChange={e => setTechnicianUrl(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                />
              </div>

              {testResult && (
                <div className="p-2 rounded-lg bg-slate-900 text-xs font-mono border border-slate-800">
                  {testResult}
                </div>
              )}

              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="w-full py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition"
              >
                {testingConnection ? 'Đang kiểm tra...' : 'Kiểm tra kết nối máy chủ'}
              </button>
            </div>
          )}

          {/* iOS PWA Installation Guide */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <Smartphone size={20} />
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                📲 Hướng Dẫn Cài Đặt Trên iPhone (iOS)
              </h3>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Nhân viên dùng iPhone không cần qua App Store. Chỉ cần làm theo 3 bước để biến trang này thành App toàn màn hình:
            </p>

            <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside pl-1 font-medium">
              <li>
                Mở trang này trên trình duyệt <strong>Safari</strong> của iPhone.
              </li>
              <li>
                Bấm vào biểu tượng <strong>Chia sẻ (Share)</strong> ở thanh dưới cùng của Safari (<Share2 size={12} className="inline text-blue-400" />).
              </li>
              <li>
                Cuộn xuống chọn <strong>&quot;Thêm vào MH chính&quot; (Add to Home Screen)</strong> ➔ Bấm <strong>Thêm (Add)</strong>.
              </li>
            </ol>
          </div>

          {/* Version Text (Tap 5 times to unlock Technician Mode) */}
          <div
            onClick={handleVersionTap}
            className="text-center text-[11px] text-slate-500 pt-2 cursor-pointer select-none hover:text-slate-400 transition"
            title="Chạm 5 lần để mở khóa chế độ kỹ thuật viên"
          >
            Phiên bản Web Scanner v1.1.0 • Chánh Thu Warehouse System
          </div>
        </div>
      )}
    </>
  )
}
