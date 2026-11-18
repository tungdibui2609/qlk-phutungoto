'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Share2,
  Smartphone,
  Loader2,
  Volume2,
  VolumeX,
  Database,
  CloudDownload,
  Barcode,
  LogOut,
  ShieldCheck,
  Map as MapIcon,
  Zap,
  BookOpen,
  Search,
  X,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react'
import type { ScannerTab, ScannerUserProfile } from './types'
import { supabase } from '@/lib/supabaseClient'
import {
  DEFAULT_STAMP_DICT,
  normalizeText,
  getWarehouseMapOfflineInfo,
  getWarehouseMapOfflineInfoAsync,
  syncWarehouseMapOfflineWeb,
  ensureProductsCatalogLoaded,
  playScanSound,
  triggerHaptic,
} from './scannerUtils'
import { getOfflineMeta } from '@/lib/scanner-db'
import { scannerAlert, scannerConfirm } from './ScannerDialog'

interface ScannerSettingsTabProps {
  activeTab: ScannerTab | string
  userProfile: ScannerUserProfile | null
  soundEnabled: boolean
  setSoundEnabled: React.Dispatch<React.SetStateAction<boolean>>
  systemCode: string
  setSystemCode: React.Dispatch<React.SetStateAction<string>>
  targetQty: number
  setTargetQty: React.Dispatch<React.SetStateAction<number>>
  autoCompleteOnFull?: boolean
  setAutoCompleteOnFull?: (val: boolean) => void
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

const DICT_CATEGORIES: { key: string; altKey?: string; label: string; badge: string }[] = [
  { key: 'special_12', label: '⭐ Ngoại lệ 12 số đầu trọn gói', badge: '12 số' },
  { key: 'fruit_type', altKey: 'fruit', label: '🍈 Loại trái (Số 1-2 Dòng 1)', badge: 'D1: 1-2' },
  { key: 'freeze_style', altKey: 'freeze', label: '❄️ Kiểu cấp đông (Số 3-4 Dòng 1)', badge: 'D1: 3-4' },
  { key: 'variety', label: '🌱 Giống (Số 5-6 Dòng 1)', badge: 'D1: 5-6' },
  { key: 'product_grade', altKey: 'grade', label: '🏅 Phân loại (Số 7-8 Dòng 1)', badge: 'D1: 7-8' },
  { key: 'package_spec', altKey: 'spec', label: '📦 Quy cách (Số 9-10 Dòng 1)', badge: 'D1: 9-10' },
  { key: 'freeze_method', altKey: 'method', label: '⚙️ Phương pháp (Số 11-12 Dòng 1)', badge: 'D1: 11-12' },
  { key: 'customer_quality', altKey: 'quality', label: '✨ Chất lượng (Số 13-14 Dòng 1)', badge: 'D1: 13-14' },
  { key: 'factory', label: '🏭 Nhà máy / Nơi SX (Số 1-2 Dòng 2)', badge: 'D2: 1-2' },
  { key: 'province', label: '📍 Tỉnh / Vùng NL (Số 3-4 Dòng 2)', badge: 'D2: 3-4' },
]

export function ScannerSettingsTab({
  activeTab,
  userProfile,
  soundEnabled,
  setSoundEnabled,
  systemCode,
  setSystemCode,
  targetQty,
  setTargetQty,
  autoCompleteOnFull = true,
  setAutoCompleteOnFull,
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
  // Đồng bộ All-in-One trước ca làm việc
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncAllStatus, setSyncAllStatus] = useState<string | null>(null)

  // Sơ đồ kho Offline
  const [syncingMap, setSyncingMap] = useState(false)
  const [mapOfflineInfo, setMapOfflineInfo] = useState<{
    count: number
    warehousesCount: number
    lastSyncedAt: string | null
  }>({ count: 0, warehousesCount: 0, lastSyncedAt: null })

  // Thời gian cập nhật lần cuối
  const [lastStampSync, setLastStampSync] = useState<string | null>(null)
  const [lastLotsSync, setLastLotsSync] = useState<string | null>(null)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true)

  // Trình tra cứu Từ điển giải mã dấu đóng
  const [showDictModal, setShowDictModal] = useState(false)
  const [dictSearch, setDictSearch] = useState('')
  const [selectedDictCategory, setSelectedDictCategory] = useState<string>('all')
  const [cachedDict, setCachedDict] =
    useState<Record<string, Record<string, string>>>(DEFAULT_STAMP_DICT)

  // Kỹ thuật viên: ẩn/hiện Anon Key
  const [anonKeyInput, setAnonKeyInput] = useState('')
  const [showAnonKey, setShowAnonKey] = useState(false)

  const refreshMetadata = async () => {
    try {
      setMapOfflineInfo(await getWarehouseMapOfflineInfoAsync())
      const sSync = localStorage.getItem('last_stamp_sync_time')
      if (sSync) setLastStampSync(sSync)

      const lSync = await getOfflineMeta('lots_last_synced_at')
      if (lSync) setLastLotsSync(lSync)

      const autoCfg = localStorage.getItem('config_auto_sync_offline_v2')
      setAutoSyncEnabled(autoCfg === null ? true : autoCfg === 'true')

      const savedDict = localStorage.getItem('cached_stamp_dictionaries')
      if (savedDict) {
        const parsed = JSON.parse(savedDict)
        setCachedDict({ ...DEFAULT_STAMP_DICT, ...parsed })
      } else {
        setCachedDict(DEFAULT_STAMP_DICT)
      }

      const savedKey = localStorage.getItem('config_supabase_anon_key')
      if (savedKey) setAnonKeyInput(savedKey)
    } catch {}
  }

  useEffect(() => {
    if (activeTab === 'settings') {
      refreshMetadata()
    }
  }, [activeTab, stampRulesCount, offlineLotsCount])

  const handleToggleAutoSync = (val: boolean) => {
    setAutoSyncEnabled(val)
    try {
      localStorage.setItem('config_auto_sync_offline_v2', val ? 'true' : 'false')
    } catch {}
  }

  const handleSyncMapOffline = async () => {
    setSyncingMap(true)
    try {
      const res = await syncWarehouseMapOfflineWeb(systemCode || 'KHO_DONG_LANH')
      if (!res.success) {
        await scannerAlert({ title: 'Lỗi tải sơ đồ kho ngoại tuyến', message: res.message, variant: 'danger' })
        return
      }
      setMapOfflineInfo(await getWarehouseMapOfflineInfoAsync())
      playScanSound()
      triggerHaptic()
      setSyncAllStatus(
        `✅ Đã tải Sơ đồ kho (${res.totalWarehouses} kho · ${res.totalPositions} vị trí) về máy!`
      )
      setTimeout(() => setSyncAllStatus(null), 4000)
    } catch (err: any) {
      await scannerAlert({ title: 'Lỗi tải sơ đồ kho ngoại tuyến', message: err.message, variant: 'danger' })
    } finally {
      setSyncingMap(false)
    }
  }

  const handleSyncAllOffline = async () => {
    if (!navigator.onLine) {
      await scannerAlert({
        title: 'Thiết bị đang ngoại tuyến',
        message: 'Vui lòng kết nối Wifi/4G trước ca làm việc để tải dữ liệu!',
        variant: 'warning',
      })
      return
    }
    setSyncingAll(true)
    setSyncAllStatus('⏳ Đang tải đồng thời Quy tắc dấu + Danh sách LOT + Sơ đồ kho...')
    try {
      const [, , mapRes] = await Promise.all([
        handleSyncStampRules(),
        handleSyncLotsOffline(),
        syncWarehouseMapOfflineWeb(systemCode || 'KHO_DONG_LANH'),
        ensureProductsCatalogLoaded(true),
      ])
      await refreshMetadata()
      if (!mapRes.success) {
        setSyncAllStatus(`⚠️ Đã tải Quy tắc dấu & LOT, nhưng Sơ đồ kho lỗi: ${mapRes.message}`)
        return
      }
      playScanSound()
      triggerHaptic()
      setSyncAllStatus(
        `🎉 Hoàn tất tải Offline trước ca làm việc! Sơ đồ kho: ${mapRes.totalWarehouses} kho (${mapRes.totalPositions} vị trí). Bạn có thể vào kho lạnh làm việc 100% không cần mạng!`
      )
    } catch (err: any) {
      setSyncAllStatus(`⚠️ Có lỗi khi tải toàn bộ dữ liệu: ${err.message}`)
    } finally {
      setSyncingAll(false)
    }
  }

  // Danh sách các mục từ điển đã lọc để tra cứu
  const filteredDictEntries = useMemo(() => {
    const q = normalizeText(dictSearch)
    const results: {
      categoryKey: string
      categoryLabel: string
      badge: string
      code: string
      name: string
    }[] = []

    DICT_CATEGORIES.forEach(cat => {
      if (selectedDictCategory !== 'all' && selectedDictCategory !== cat.key) return
      const mergedMap: Record<string, string> = {
        ...(DEFAULT_STAMP_DICT[cat.key] || {}),
        ...(cat.altKey ? DEFAULT_STAMP_DICT[cat.altKey] || {} : {}),
        ...(cachedDict[cat.key] || {}),
        ...(cat.altKey ? cachedDict[cat.altKey] || {} : {}),
      }
      Object.entries(mergedMap).forEach(([code, rawName]) => {
        const name = String(rawName)
        if (!q) {
          results.push({
            categoryKey: cat.key,
            categoryLabel: cat.label,
            badge: cat.badge,
            code,
            name,
          })
        } else {
          const hay = normalizeText(`${code} ${name} ${cat.label}`)
          if (q.split(' ').every(w => hay.includes(w))) {
            results.push({
              categoryKey: cat.key,
              categoryLabel: cat.label,
              badge: cat.badge,
              code,
              name,
            })
          }
        }
      })
    })

    return results
  }, [cachedDict, dictSearch, selectedDictCategory])

  const formatTimeVi = (iso: string | null) => {
    if (!iso) return 'Chưa đồng bộ'
    try {
      const d = new Date(iso)
      return `${d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })} - ${d.toLocaleDateString('vi-VN')}`
    } catch {
      return 'Chưa đồng bộ'
    }
  }

  if (activeTab !== 'settings') return null

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain bg-[#0b0f19] p-4 space-y-4">
      {/* 1. User Profile Card (Matching SettingsScreen.tsx) */}
      <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-sky-400">
            👤 Tài Khoản Đăng Nhập
          </span>
          {userProfile?.roleName && (
            <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-bold">
              {userProfile.roleName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-600 to-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-md shrink-0">
            {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">
              {userProfile?.fullName || 'Nhân viên Kho'}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {userProfile?.email || 'Chưa cập nhật email'}
            </p>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">🏢 Công ty trực thuộc:</span>
          <strong className="text-amber-400 font-bold truncate ml-2">
            {userProfile?.companyName || 'Chánh Thu Group'}
          </strong>
        </div>

        <button
          type="button"
          onClick={async () => {
            const ok = await scannerConfirm({
              title: 'Đăng xuất tài khoản?',
              message: 'Bạn có chắc chắn muốn đăng xuất khỏi thiết bị này không?',
              confirmText: 'Đăng xuất',
              cancelText: 'Huỷ',
              variant: 'danger',
            })
            if (ok) {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }
          }}
          className="w-full py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.99]"
        >
          <LogOut size={14} />
          <span>🚪 Đăng xuất khỏi thiết bị</span>
        </button>
      </div>

      {/* 2. ALL-IN-ONE OFFLINE SYNC CARD (TRƯỚC CA LÀM VIỆC - Khớp SettingsScreen.tsx) */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 via-[#0f291e] to-[#111827] border-2 border-emerald-500/60 space-y-3 shadow-lg shadow-emerald-950/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <Zap size={18} className="fill-emerald-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300">
              Đồng Bộ Nhanh Trước Ca Làm Việc
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black">
            ALL-IN-ONE
          </span>
        </div>

        <p className="text-[11px] text-emerald-100/90 leading-relaxed">
          Chỉ cần bấm <strong>1 nút duy nhất</strong> khi đang có Wifi để tải trọn bộ:{' '}
          <strong>Quy tắc con dấu + Danh sách LOT & Tên gõ tắt + Sơ đồ 6 kho</strong> về máy trước
          khi bước vào kho lạnh.
        </p>

        {syncAllStatus && (
          <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/40 text-[11px] text-emerald-200 leading-relaxed">
            {syncAllStatus}
          </div>
        )}

        <button
          type="button"
          onClick={handleSyncAllOffline}
          disabled={syncingAll || syncingStamp || isSyncingLots || syncingMap}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black uppercase tracking-wide transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
        >
          {syncingAll ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Đang tải toàn bộ dữ liệu kho...</span>
            </>
          ) : (
            <>
              <CloudDownload size={16} />
              <span>⚡ TẢI TOÀN BỘ DỮ LIỆU KHO (ALL-IN-ONE)</span>
            </>
          )}
        </button>
      </div>

      {/* 3. Offline Stamp Rules & Decode Dictionary Card */}
      <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Barcode size={18} className="text-purple-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-400">
              Quy Tắc Giải Mã Dấu Đóng (Offline)
            </h3>
          </div>
          <span className="text-xs font-black text-sky-400 font-mono">
            {stampRulesCount} quy tắc
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Lưu trong bộ nhớ máy để tự động giải mã 2 dòng dấu đóng (21 số) ngay cả khi không có mạng
          wifi trong kho lạnh.
        </p>

        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-400">Số quy tắc trong máy:</span>
            <strong className="text-emerald-400 font-mono">
              {stampRulesCount > 0 ? `${stampRulesCount} mã quy tắc` : 'Đang dùng bộ mã mặc định'}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Cập nhật lần cuối:</span>
            <span className="text-slate-300 font-mono">{formatTimeVi(lastStampSync)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleSyncStampRules}
            disabled={syncingStamp || syncingAll}
            className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/20 active:scale-[0.98]"
          >
            {syncingStamp ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Đang tải...</span>
              </>
            ) : (
              <>
                <CloudDownload size={14} />
                <span>Tải / Cập nhật quy tắc</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowDictModal(true)}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-purple-500/40 text-purple-300 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            <BookOpen size={14} />
            <span>📖 Tra Cứu Từ Điển Giải Mã</span>
          </button>
        </div>
      </div>

      {/* 4. Offline LOT Data Sync Card */}
      <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-sky-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Dữ Liệu LOT Xem Ngoại Tuyến (Offline)
            </h3>
          </div>
          <span className="text-xs font-black text-emerald-400 font-mono">
            {offlineLotsCount} LOT
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Tải toàn bộ danh sách LOT, vị trí kệ/ô và từ điển tên gõ tắt (aliases) từ máy chủ về máy
          để tìm kiếm, lọc và xem chi tiết khi vào kho lạnh mất sóng.
        </p>

        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-400">Số LOT lưu trong máy:</span>
            <strong className="text-sky-400 font-mono">
              {offlineLotsCount > 0 ? `${offlineLotsCount} LOT` : 'Chưa tải về máy'}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Đồng bộ lần cuối:</span>
            <span className="text-slate-300 font-mono">{formatTimeVi(lastLotsSync)}</span>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-200">Tự động tải ngầm khi có mạng</p>
              <p className="text-[10px] text-slate-400">
                Tự làm mới dữ liệu khi mở ứng dụng ở nơi có Wifi/4G
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleAutoSync(!autoSyncEnabled)}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 ${
                autoSyncEnabled ? 'bg-sky-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  autoSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSyncLotsOffline}
          disabled={isSyncingLots || syncingAll}
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
              <span>🔄 Tải / Cập nhật danh sách LOT về máy</span>
            </>
          )}
        </button>
      </div>

      {/* 5. Offline Warehouse Map Sync Card (Khớp SettingsScreen.tsx) */}
      <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapIcon size={18} className="text-cyan-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">
              🗺️ Sơ Đồ Kho Xem Ngoại Tuyến (Offline)
            </h3>
          </div>
          <span className="text-xs font-black text-cyan-300 font-mono">
            {mapOfflineInfo.warehousesCount} kho
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Tải trước sơ đồ tất cả các kho (Kho 1, 2, 3, 4, 5, Kho chờ đông) về bộ nhớ máy để xem sơ
          đồ vị trí và tra cứu kệ hàng ngay lập tức trong kho lạnh.
        </p>

        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-400">Dữ liệu sơ đồ trong máy:</span>
            <strong className="text-cyan-400 font-mono">
              {mapOfflineInfo.count > 0
                ? `${mapOfflineInfo.count} vị trí (${mapOfflineInfo.warehousesCount} kho)`
                : 'Chưa tải sơ đồ kho'}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Đồng bộ lần cuối:</span>
            <span className="text-slate-300 font-mono">
              {formatTimeVi(mapOfflineInfo.lastSyncedAt)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSyncMapOffline}
          disabled={syncingMap || syncingAll}
          className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 active:scale-[0.98]"
        >
          {syncingMap ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Đang tải sơ đồ kho về máy...</span>
            </>
          ) : (
            <>
              <CloudDownload size={15} />
              <span>🔄 Tải / Cập nhật Sơ Đồ Kho về máy</span>
            </>
          )}
        </button>
      </div>

      {/* 6. General Scanner Preferences */}
      <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
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
            <option value="KHO_NGUYEN_LIEU">Kho Nguyên Liệu (KHO_NGUYEN_LIEU)</option>
            <option value="KHO_THANH_PHAM">Kho Thành Phẩm (KHO_THANH_PHAM)</option>
            <option value="KHO_BAO_BI">Kho Bao Bì (KHO_BAO_BI)</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 block mb-1">
            Số lượng thùng chuẩn / Pallet:
          </label>
          <input
            type="number"
            value={targetQty}
            onChange={e => {
              const val = parseInt(e.target.value, 10) || 30
              setTargetQty(val)
              try { localStorage.setItem('config_default_target_box_qty', String(val)) } catch {}
            }}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
          />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {[20, 25, 30, 35, 40, 50].map(q => (
              <button
                type="button"
                key={q}
                onClick={() => {
                  setTargetQty(q)
                  try { localStorage.setItem('config_default_target_box_qty', String(q)) } catch {}
                }}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition ${
                  targetQty === q
                    ? 'bg-sky-600/30 border-sky-500 text-sky-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {q} thùng
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div>
            <span className="text-xs text-slate-300 block font-bold">Tự động chốt khi đủ số thùng:</span>
            <span className="text-[10px] text-slate-400 block">Đạt chỉ tiêu ({targetQty} thùng) sẽ tự động chốt Pallet</span>
          </div>
          <button
            type="button"
            onClick={() => setAutoCompleteOnFull?.(!autoCompleteOnFull)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
              autoCompleteOnFull
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
          >
            {autoCompleteOnFull ? 'BẬT' : 'TẮT'}
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-xs text-slate-300">Âm thanh khi quét thành công:</span>
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border transition ${
              soundEnabled
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>

      {/* 7. Technician Mode Card (Easter Egg: unlocked by tapping version 5 times) */}
      {showTechnicianConfig && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/40 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-amber-400">
            <ShieldCheck size={18} />
            <h3 className="text-xs font-black uppercase tracking-wider">
              🔓 Cấu Hình Máy Chủ (Dành Cho Kỹ Thuật Viên)
            </h3>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">
              Supabase URL (VD: https://api.chanhthu.click):
            </label>
            <input
              type="text"
              value={technicianUrl}
              onChange={e => setTechnicianUrl(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-slate-400">Supabase Anon Key (Tùy chọn):</label>
              <button
                type="button"
                onClick={() => setShowAnonKey(!showAnonKey)}
                className="text-[10px] text-sky-400 font-bold flex items-center gap-1"
              >
                {showAnonKey ? <EyeOff size={11} /> : <Eye size={11} />}
                <span>{showAnonKey ? 'Ẩn mã' : 'Hiện mã'}</span>
              </button>
            </div>
            <input
              type={showAnonKey ? 'text' : 'password'}
              value={anonKeyInput}
              onChange={e => setAnonKeyInput(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
            />
          </div>

          {testResult && (
            <div className="p-2 rounded-lg bg-slate-900 text-xs font-mono border border-slate-800">
              {testResult}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="flex-1 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition"
            >
              {testingConnection ? 'Đang kiểm tra...' : '🔌 Kiểm tra kết nối'}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  localStorage.setItem('config_supabase_url', technicianUrl.trim())
                  if (anonKeyInput.trim()) {
                    localStorage.setItem('config_supabase_anon_key', anonKeyInput.trim())
                  }
                  await scannerAlert({
                    title: 'Lưu thành công',
                    message: 'Đã lưu cấu hình máy chủ thành công!',
                    variant: 'success',
                  })
                } catch {}
              }}
              className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition flex items-center justify-center gap-1"
            >
              <Check size={14} />
              <span>💾 Lưu cài đặt</span>
            </button>
          </div>
        </div>
      )}

      {/* 8. iOS PWA Installation Guide */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 space-y-3">
        <div className="flex items-center gap-2 text-indigo-400">
          <Smartphone size={20} />
          <h3 className="text-xs font-black uppercase tracking-wider text-white">
            📲 Hướng Dẫn Cài Đặt Trên iPhone (iOS)
          </h3>
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          Nhân viên dùng iPhone không cần qua App Store. Chỉ cần làm theo 3 bước để biến trang này
          thành App toàn màn hình:
        </p>

        <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside pl-1 font-medium">
          <li>
            Mở trang này trên trình duyệt <strong>Safari</strong> của iPhone.
          </li>
          <li>
            Bấm vào biểu tượng <strong>Chia sẻ (Share)</strong> ở thanh dưới cùng của Safari (
            <Share2 size={12} className="inline text-blue-400" />
            ).
          </li>
          <li>
            Cuộn xuống chọn <strong>&quot;Thêm vào MH chính&quot; (Add to Home Screen)</strong> ➔
            Bấm <strong>Thêm (Add)</strong>.
          </li>
        </ol>
      </div>

      {/* Version Text (Tap 5 times to unlock Technician Mode) */}
      <div
        onClick={handleVersionTap}
        className="text-center text-[11px] text-slate-500 pt-2 pb-6 cursor-pointer select-none hover:text-slate-400 transition"
        title="Chạm 5 lần để mở khóa chế độ kỹ thuật viên"
      >
        Phiên bản Web Scanner v2.0 • Chánh Thu Warehouse System
        {!showTechnicianConfig && (
          <span className="block text-[10px] text-slate-600 mt-0.5">
            (Chạm 5 lần vào đây để mở cài đặt máy chủ cho kỹ thuật viên)
          </span>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MODAL: TỪ ĐIỂN GIẢI MÃ DẤU ĐÓNG (STAMP DECODE DICTIONARY)
         ═══════════════════════════════════════════════════════════ */}
      {showDictModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#111827] border border-purple-500/40 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0">
              <div className="flex items-center gap-2 text-purple-400">
                <BookOpen size={18} />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    📖 Từ Điển Giải Mã Dấu Đóng ({filteredDictEntries.length} mã)
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Tra cứu nhanh ý nghĩa các cặp số trên Dòng 1 (14 số) & Dòng 2 (7 số)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDictModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Ô tìm kiếm mã hoặc tên giải mã */}
            <div className="space-y-2 shrink-0">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={dictSearch}
                  onChange={e => setDictSearch(e.target.value)}
                  placeholder="Nhập mã số (VD: 01, 06, 010301010402) hoặc tên (VD: Ri6, Dona)..."
                  className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                />
                {dictSearch && (
                  <button
                    type="button"
                    onClick={() => setDictSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Chip lọc nhóm danh mục */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedDictCategory('all')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 border transition ${
                    selectedDictCategory === 'all'
                      ? 'bg-purple-600 border-purple-400 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Tất cả
                </button>
                {DICT_CATEGORIES.map(cat => (
                  <button
                    type="button"
                    key={cat.key}
                    onClick={() => setSelectedDictCategory(cat.key)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 border transition ${
                      selectedDictCategory === cat.key
                        ? 'bg-purple-600 border-purple-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Danh sách mã quy tắc */}
            <div className="flex-1 overflow-y-auto overscroll-contain space-y-1.5 pr-1">
              {filteredDictEntries.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Không tìm thấy mã quy tắc nào khớp với &quot;{dictSearch}&quot;
                </div>
              ) : (
                filteredDictEntries.map(item => (
                  <div
                    key={`${item.categoryKey}-${item.code}`}
                    className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-black text-xs">
                          {item.code}
                        </span>
                        <span className="font-bold text-white truncate">{item.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.categoryLabel}</p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[10px] shrink-0">
                      {item.badge}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDictModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
              >
                Đóng từ điển
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
