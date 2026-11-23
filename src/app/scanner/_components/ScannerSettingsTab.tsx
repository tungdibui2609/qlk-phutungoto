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
  Sun,
  Moon,
  Palette,
  ChevronRight,
} from 'lucide-react'
import { useScannerTheme, SCANNER_THEME_TAB_META } from './ScannerThemeContext'
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
  { key: 'customer_quality', altKey: 'quality', label: 'Chất lượng (Số 13-14 Dòng 1)', badge: 'D1: 13-14' },
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
  const { isDark, tabThemes, setTabTheme, setAllTabsTheme } = useScannerTheme()
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)
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

  const lightTabsCount = SCANNER_THEME_TAB_META.filter(t => tabThemes[t.key] === 'light').length
  const darkTabsCount = SCANNER_THEME_TAB_META.filter(t => tabThemes[t.key] === 'dark').length

  const cardCls = isDark
    ? 'bg-[#111827] border-slate-800'
    : 'bg-white border-stone-200 shadow-xs'
  const dividerCls = isDark ? 'border-slate-800' : 'border-stone-200/80'
  const textPrimary = isDark ? 'text-slate-100' : 'text-stone-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-stone-500'
  const subSurface = isDark
    ? 'bg-[#0f172a] border-slate-700/80'
    : 'bg-stone-50 border-stone-200'

  return (
    <div
      className={`flex-1 overflow-y-auto overscroll-contain p-3.5 pb-10 space-y-4 ${
        isDark ? 'bg-[#0b0f19]' : 'bg-stone-100/90'
      }`}
    >
      {/* ── 1. THẺ TÀI KHOẢN GỌN ── */}
      <div className={`p-3.5 rounded-2xl border ${cardCls}`}>
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-base shrink-0 border ${
              isDark
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700'
            }`}
          >
            {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className={`text-sm font-extrabold truncate ${textPrimary}`}>
                {userProfile?.fullName || 'Nhân viên Kho'}
              </h3>
              {userProfile?.roleName && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-50 text-sky-700'
                  }`}
                >
                  {userProfile.roleName}
                </span>
              )}
            </div>
            <p className={`text-[11px] font-mono truncate ${textMuted}`}>
              {userProfile?.email || 'Chưa cập nhật email'}
            </p>
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
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 shrink-0 transition active:scale-[0.98] ${
              isDark
                ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}
          >
            <LogOut size={13} />
            <span>Đăng xuất</span>
          </button>
        </div>

        <div className={`mt-2.5 pt-2.5 border-t flex items-center justify-between gap-2 text-xs ${dividerCls}`}>
          <span className={textMuted}>Công ty:</span>
          <strong className={`truncate font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
            {userProfile?.companyName || 'Chánh Thu Group'}
          </strong>
        </div>
      </div>

      {/* ── 2. GIAO DIỆN & TIỆN ÍCH ── */}
      <div>
        <div className={`text-[11px] font-extrabold uppercase tracking-wider mb-1.5 px-1 ${textMuted}`}>
          Giao diện & Tiện ích
        </div>
        <div className={`rounded-2xl border overflow-hidden divide-y ${cardCls} ${isDark ? 'divide-slate-800' : 'divide-stone-200/80'}`}>
          <button
            type="button"
            onClick={() => setIsThemeModalOpen(true)}
            className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left transition active:opacity-80"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
                }`}
              >
                <Palette size={18} />
              </div>
              <div className="min-w-0">
                <div className={`text-[13px] font-bold ${textPrimary}`}>
                  Giao diện Sáng / Tối từng Menu
                </div>
                <div className={`text-[11px] mt-0.5 ${textMuted}`}>
                  {lightTabsCount} Sáng · {darkTabsCount} Tối
                </div>
              </div>
            </div>
            <ChevronRight size={17} className={textMuted} />
          </button>

          <div className="px-3.5 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </div>
              <div className="min-w-0">
                <div className={`text-[13px] font-bold ${textPrimary}`}>Âm thanh khi quét</div>
                <div className={`text-[11px] mt-0.5 ${textMuted}`}>Phát tiếng bíp khi quét thành công</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                soundEnabled ? 'bg-emerald-500' : isDark ? 'bg-slate-700' : 'bg-stone-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  soundEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDictModal(true)}
            className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left transition active:opacity-80"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-600'
                }`}
              >
                <BookOpen size={18} />
              </div>
              <div className="min-w-0">
                <div className={`text-[13px] font-bold ${textPrimary}`}>Từ điển giải mã dấu đóng</div>
                <div className={`text-[11px] mt-0.5 ${textMuted}`}>Tra cứu mã 21 số Dòng 1 & Dòng 2</div>
              </div>
            </div>
            <ChevronRight size={17} className={textMuted} />
          </button>
        </div>
      </div>

      {/* ── 3. QUÉT PALLET & PHÂN HỆ KHO ── */}
      <div>
        <div className={`text-[11px] font-extrabold uppercase tracking-wider mb-1.5 px-1 ${textMuted}`}>
          Quét Pallet & Kho
        </div>
        <div className={`p-3.5 rounded-2xl border space-y-3 ${cardCls}`}>
          <div>
            <label className={`text-[11px] font-bold block mb-1 ${textMuted}`}>Phân hệ kho làm việc</label>
            <select
              value={systemCode}
              onChange={e => setSystemCode(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold ${subSurface} ${textPrimary}`}
            >
              <option value="KHO_DONG_LANH">Kho Đông Lạnh (KHO_DONG_LANH)</option>
              <option value="KHO_NGUYEN_LIEU">Kho Nguyên Liệu (KHO_NGUYEN_LIEU)</option>
              <option value="KHO_THANH_PHAM">Kho Thành Phẩm (KHO_THANH_PHAM)</option>
              <option value="KHO_BAO_BI">Kho Bao Bì (KHO_BAO_BI)</option>
            </select>
          </div>

          <div className={`pt-2.5 border-t ${dividerCls}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className={`text-[13px] font-bold ${textPrimary}`}>Số thùng mặc định / Pallet</div>
                <div className={`text-[11px] ${textMuted}`}>Dùng khi tạo Pallet mới</div>
              </div>
              <input
                type="number"
                value={targetQty}
                onChange={e => {
                  const val = parseInt(e.target.value, 10) || 30
                  setTargetQty(val)
                  try { localStorage.setItem('config_default_target_box_qty', String(val)) } catch {}
                }}
                className={`w-20 px-2 py-1.5 rounded-xl border text-center text-sm font-black font-mono ${subSurface} ${textPrimary}`}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[20, 24, 30, 36, 40, 50].map(q => (
                <button
                  type="button"
                  key={q}
                  onClick={() => {
                    setTargetQty(q)
                    try { localStorage.setItem('config_default_target_box_qty', String(q)) } catch {}
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                    targetQty === q
                      ? isDark
                        ? 'bg-indigo-500/25 border-indigo-400 text-indigo-300'
                        : 'bg-indigo-50 border-indigo-500 text-indigo-700'
                      : `${subSurface} ${textMuted}`
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className={`pt-2.5 border-t flex items-center justify-between gap-2 ${dividerCls}`}>
            <div>
              <div className={`text-[13px] font-bold ${textPrimary}`}>
                Tự động chốt khi đủ {targetQty} thùng
              </div>
              <div className={`text-[11px] ${textMuted}`}>Tự hoàn thành Pallet khi đủ chỉ tiêu</div>
            </div>
            <button
              type="button"
              onClick={() => setAutoCompleteOnFull?.(!autoCompleteOnFull)}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                autoCompleteOnFull ? 'bg-emerald-500' : isDark ? 'bg-slate-700' : 'bg-stone-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  autoCompleteOnFull ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. DỮ LIỆU NGOẠI TUYẾN (GOM 1 KHỐI GỌN) ── */}
      <div>
        <div className={`text-[11px] font-extrabold uppercase tracking-wider mb-1.5 px-1 ${textMuted}`}>
          Dữ liệu ngoại tuyến (Kho lạnh)
        </div>
        <div className={`rounded-2xl border overflow-hidden divide-y ${cardCls} ${isDark ? 'divide-slate-800' : 'divide-stone-200/80'}`}>
          <div className="p-3.5 space-y-2">
            <button
              type="button"
              onClick={handleSyncAllOffline}
              disabled={syncingAll || syncingStamp || isSyncingLots || syncingMap}
              className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-extrabold transition flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {syncingAll ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Đang tải toàn bộ dữ liệu...</span>
                </>
              ) : (
                <>
                  <CloudDownload size={16} />
                  <span>Tải toàn bộ dữ liệu làm việc</span>
                </>
              )}
            </button>
            {syncAllStatus && (
              <div
                className={`p-2 rounded-xl border text-[11px] leading-relaxed ${
                  isDark
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {syncAllStatus}
              </div>
            )}
          </div>

          {/* Sơ đồ kho */}
          <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <MapIcon size={17} className="text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <div className={`text-[12.5px] font-bold truncate ${textPrimary}`}>
                  Sơ đồ kho · {mapOfflineInfo.count.toLocaleString('vi-VN')} vị trí
                  {mapOfflineInfo.warehousesCount > 0 ? ` (${mapOfflineInfo.warehousesCount} kho)` : ''}
                </div>
                <div className={`text-[10.5px] ${textMuted}`}>{formatTimeVi(mapOfflineInfo.lastSyncedAt)}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSyncMapOffline}
              disabled={syncingMap || syncingAll}
              title="Tải lại sơ đồ kho"
              className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${subSurface} ${textPrimary}`}
            >
              {syncingMap ? <Loader2 size={14} className="animate-spin" /> : <CloudDownload size={14} />}
            </button>
          </div>

          {/* Danh sách LOT */}
          <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Database size={17} className="text-sky-600 shrink-0" />
              <div className="min-w-0">
                <div className={`text-[12.5px] font-bold truncate ${textPrimary}`}>
                  Danh sách LOT · {offlineLotsCount.toLocaleString('vi-VN')} LOT
                </div>
                <div className={`text-[10.5px] ${textMuted}`}>{formatTimeVi(lastLotsSync)}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSyncLotsOffline}
              disabled={isSyncingLots || syncingAll}
              title="Tải lại danh sách LOT"
              className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${subSurface} ${textPrimary}`}
            >
              {isSyncingLots ? <Loader2 size={14} className="animate-spin" /> : <CloudDownload size={14} />}
            </button>
          </div>

          {/* Quy tắc dấu đóng */}
          <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Barcode size={17} className="text-purple-600 shrink-0" />
              <div className="min-w-0">
                <div className={`text-[12.5px] font-bold truncate ${textPrimary}`}>
                  Quy tắc dấu đóng · {stampRulesCount} quy tắc
                </div>
                <div className={`text-[10.5px] ${textMuted}`}>{formatTimeVi(lastStampSync)}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSyncStampRules}
              disabled={syncingStamp || syncingAll}
              title="Tải lại quy tắc dấu đóng"
              className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${subSurface} ${textPrimary}`}
            >
              {syncingStamp ? <Loader2 size={14} className="animate-spin" /> : <CloudDownload size={14} />}
            </button>
          </div>

          {/* Tự động tải ngầm */}
          <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
            <div>
              <div className={`text-[12.5px] font-bold ${textPrimary}`}>Tự động tải ngầm khi có Wi-Fi</div>
              <div className={`text-[10.5px] ${textMuted}`}>Cập nhật dữ liệu khi mở ứng dụng</div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleAutoSync(!autoSyncEnabled)}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                autoSyncEnabled ? 'bg-indigo-600' : isDark ? 'bg-slate-700' : 'bg-stone-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  autoSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── 5. HƯỚNG DẪN CÀI ĐẶT IPHONE (THU GỌN MẶC ĐỊNH) ── */}
      <div className={`rounded-2xl border overflow-hidden ${cardCls}`}>
        <button
          type="button"
          onClick={() => setShowIosGuide(s => !s)}
          className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-2.5">
            <Smartphone size={17} className="text-indigo-500" />
            <span className={`text-[13px] font-bold ${textPrimary}`}>
              Hướng dẫn cài App trên iPhone (iOS)
            </span>
          </div>
          <ChevronRight
            size={17}
            className={`${textMuted} transition-transform ${showIosGuide ? 'rotate-90' : ''}`}
          />
        </button>
        {showIosGuide && (
          <div className={`px-3.5 pb-3.5 pt-2 border-t text-xs space-y-1.5 ${dividerCls} ${textMuted}`}>
            <p>1. Mở trang này trên trình duyệt <strong className={textPrimary}>Safari</strong>.</p>
            <p>
              2. Bấm biểu tượng <strong className={textPrimary}>Chia sẻ</strong> (<Share2 size={12} className="inline text-sky-500" />).
            </p>
            <p>
              3. Chọn <strong className={textPrimary}>&quot;Thêm vào MH chính&quot;</strong> → bấm <strong className={textPrimary}>Thêm</strong>.
            </p>
          </div>
        )}
      </div>

      {/* ── 6. CẤU HÌNH KỸ THUẬT VIÊN (CHẠM 5 LẦN VÀO PHIÊN BẢN) ── */}
      {showTechnicianConfig && (
        <div className={`p-3.5 rounded-2xl border border-amber-500/60 space-y-2.5 ${cardCls}`}>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <ShieldCheck size={17} />
            <h3 className="text-xs font-black uppercase tracking-wider">
              Cấu hình máy chủ (Kỹ thuật)
            </h3>
          </div>

          <div>
            <label className={`text-[11px] font-bold block mb-1 ${textMuted}`}>Supabase URL</label>
            <input
              type="text"
              value={technicianUrl}
              onChange={e => setTechnicianUrl(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono ${subSurface} ${textPrimary}`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={`text-[11px] font-bold ${textMuted}`}>Supabase Anon Key</label>
              <button
                type="button"
                onClick={() => setShowAnonKey(!showAnonKey)}
                className="text-[11px] text-indigo-500 font-bold flex items-center gap-1"
              >
                {showAnonKey ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showAnonKey ? 'Ẩn mã' : 'Hiện mã'}</span>
              </button>
            </div>
            <input
              type={showAnonKey ? 'text' : 'password'}
              value={anonKeyInput}
              onChange={e => setAnonKeyInput(e.target.value)}
              placeholder="eyJhbGciOi..."
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono ${subSurface} ${textPrimary}`}
            />
          </div>

          {testResult && (
            <div className={`p-2 rounded-xl border text-xs font-mono ${subSurface} ${textPrimary}`}>
              {testResult}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className={`flex-1 py-2 rounded-xl border text-xs font-bold ${subSurface} ${textPrimary}`}
            >
              {testingConnection ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
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
              className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1"
            >
              <Check size={14} />
              <span>Lưu cấu hình</span>
            </button>
          </div>
        </div>
      )}

      {/* Phiên bản */}
      <div
        onClick={handleVersionTap}
        className={`text-center text-[11px] pt-1 pb-4 cursor-pointer select-none ${textMuted}`}
      >
        Web Scanner v2.0 · Chánh Thu WMS
      </div>

      {/* Modal Tùy Chỉnh Theme Sáng / Tối Cho Từng Menu */}
      {isThemeModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/55 backdrop-blur-xs">
          <div className="absolute inset-0" onClick={() => setIsThemeModalOpen(false)} />
          <div
            className={`relative z-10 w-full max-w-md mx-auto rounded-t-3xl border-t p-4 max-h-[85dvh] flex flex-col shadow-2xl ${
              isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-stone-200'
            }`}
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${dividerCls}`}>
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-indigo-500" />
                <span className={`text-sm font-extrabold ${textPrimary}`}>
                  Giao diện Sáng / Tối từng Menu
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsThemeModalOpen(false)}
                className={`p-1 ${textMuted}`}
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 my-3">
              <button
                type="button"
                onClick={() => setAllTabsTheme('light')}
                className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 ${
                  isDark
                    ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}
              >
                <Sun size={14} />
                <span>Đặt tất cả Sáng</span>
              </button>
              <button
                type="button"
                onClick={() => setAllTabsTheme('dark')}
                className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 ${
                  isDark
                    ? 'bg-indigo-500/15 border-indigo-500/35 text-indigo-300'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                }`}
              >
                <Moon size={14} />
                <span>Đặt tất cả Tối</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {SCANNER_THEME_TAB_META.map(item => {
                const curMode = tabThemes[item.key] || 'light'
                const itemIsDark = curMode === 'dark'
                return (
                  <div
                    key={item.key}
                    className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 ${subSurface}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-extrabold truncate ${textPrimary}`}>
                        {item.label}
                      </div>
                      <div className={`text-[10px] truncate mt-0.5 ${textMuted}`}>
                        {item.desc}
                      </div>
                    </div>

                    <div
                      className={`flex p-1 rounded-xl border gap-1 shrink-0 ${
                        isDark ? 'bg-[#111827] border-slate-700' : 'bg-white border-stone-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setTabTheme(item.key, 'light')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition ${
                          !itemIsDark ? 'bg-amber-500 text-white shadow-xs' : textMuted
                        }`}
                      >
                        <Sun size={12} />
                        <span>Sáng</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTabTheme(item.key, 'dark')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition ${
                          itemIsDark ? 'bg-indigo-600 text-white shadow-xs' : textMuted
                        }`}
                      >
                        <Moon size={12} />
                        <span>Tối</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TỪ ĐIỂN GIẢI MÃ DẤU ĐÓNG */}
      {showDictModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <div
            className={`w-full max-w-lg border rounded-2xl p-4 space-y-3 shadow-2xl max-h-[88vh] flex flex-col ${
              isDark ? 'bg-[#111827] border-slate-700' : 'bg-white border-stone-200'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-2.5 shrink-0 ${dividerCls}`}>
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <BookOpen size={18} />
                <div>
                  <h3 className={`text-xs font-black uppercase tracking-wider ${textPrimary}`}>
                    Từ Điển Giải Mã Dấu Đóng ({filteredDictEntries.length} mã)
                  </h3>
                  <p className={`text-[10px] ${textMuted}`}>
                    Tra cứu mã trên Dòng 1 (14 số) & Dòng 2 (7 số)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDictModal(false)}
                className={textMuted}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 shrink-0">
              <div className="relative">
                <Search
                  size={14}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`}
                />
                <input
                  type="text"
                  value={dictSearch}
                  onChange={e => setDictSearch(e.target.value)}
                  placeholder="Nhập mã số (VD: 01, 06) hoặc tên (VD: Ri6, Dona)..."
                  className={`w-full pl-8 pr-8 py-2 rounded-xl border text-xs focus:outline-hidden focus:border-purple-500 ${subSurface} ${textPrimary}`}
                />
                {dictSearch && (
                  <button
                    type="button"
                    onClick={() => setDictSearch('')}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${textMuted}`}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedDictCategory('all')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 border transition ${
                    selectedDictCategory === 'all'
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : `${subSurface} ${textMuted}`
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
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : `${subSurface} ${textMuted}`
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain space-y-1.5 pr-1">
              {filteredDictEntries.length === 0 ? (
                <div className={`p-8 text-center text-xs ${textMuted}`}>
                  Không tìm thấy mã quy tắc nào khớp với &quot;{dictSearch}&quot;
                </div>
              ) : (
                filteredDictEntries.map(item => (
                  <div
                    key={`${item.categoryKey}-${item.code}`}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${subSurface}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-black text-xs ${
                            isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.code}
                        </span>
                        <span className={`font-bold truncate ${textPrimary}`}>{item.name}</span>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${textMuted}`}>{item.categoryLabel}</p>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] shrink-0 ${
                        isDark ? 'bg-purple-500/15 text-purple-300' : 'bg-purple-50 text-purple-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className={`pt-2 border-t flex gap-2 shrink-0 ${dividerCls}`}>
              <button
                type="button"
                onClick={() => setShowDictModal(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border ${subSurface} ${textPrimary}`}
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
