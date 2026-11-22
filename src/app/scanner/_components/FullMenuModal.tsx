'use client'

import React from 'react'
import {
  Fingerprint,
  Calculator,
  Boxes,
  Map,
  Scan,
  ClipboardCheck,
  Settings,
  User,
  X,
  CheckCircle2,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react'
import { useScannerTheme } from './ScannerThemeContext'

export type FullMenuAppTab =
  | 'scanner'
  | 'label'
  | 'stamp_scanner'
  | 'stamp'
  | 'operations'
  | 'inventory'
  | 'warehouse_map'
  | 'pallets'
  | 'settings'

export interface FullMenuModalProps {
  visible: boolean
  onClose: () => void
  currentTab: string
  onSelectTab: (tab: any) => void
  userProfile?: {
    fullName?: string
    companyName?: string
    companyCode?: string
    email?: string
  } | null
  onLogout?: () => void
}

interface MenuItemConfig {
  id: 'stamp' | 'operations' | 'pallets' | 'warehouse_map' | 'label' | 'inventory' | 'settings'
  aliases: string[]
  label: string
  desc: string
  Icon: React.ComponentType<{ size?: number; color?: string; className?: string }>
  color: string
  bgColor: string
  isPrimary?: boolean
}

const MENU_SECTIONS: {
  title: string
  items: MenuItemConfig[]
}[] = [
  {
    title: 'CHỨC NĂNG CHÍNH VẬN HÀNH',
    items: [
      {
        id: 'stamp',
        aliases: ['stamp', 'stamp_scanner'],
        label: 'Dấu Đóng Thùng',
        desc: 'Quét mã dấu đóng & liên kết tem',
        Icon: Fingerprint,
        color: '#fbbf24',
        bgColor: 'rgba(251, 191, 36, 0.15)',
        isPrimary: true,
      },
      {
        id: 'operations',
        aliases: ['operations'],
        label: 'Số Liệu & Ca Làm',
        desc: 'Ghi nhận số liệu nhập xuất, báo cáo ngày & mặt hàng',
        Icon: Calculator,
        color: '#818cf8',
        bgColor: 'rgba(129, 140, 248, 0.15)',
        isPrimary: true,
      },
      {
        id: 'pallets',
        aliases: ['pallets'],
        label: 'Pallet Kho',
        desc: 'Danh sách kiện/pallet và tình trạng lưu kho',
        Icon: Boxes,
        color: '#38bdf8',
        bgColor: 'rgba(56, 189, 248, 0.15)',
        isPrimary: true,
      },
      {
        id: 'warehouse_map',
        aliases: ['warehouse_map'],
        label: 'Sơ Đồ Kho',
        desc: 'Vị trí sơ đồ kệ và các ô chứa pallet',
        Icon: Map,
        color: '#06b6d4',
        bgColor: 'rgba(6, 182, 212, 0.15)',
        isPrimary: true,
      },
    ],
  },
  {
    title: 'QUÉT TEM & KIỂM KÊ',
    items: [
      {
        id: 'label',
        aliases: ['label', 'scanner'],
        label: 'Quét Tem Thùng',
        desc: 'Quét camera barcode tem thùng và đóng pallet',
        Icon: Scan,
        color: '#22c55e',
        bgColor: 'rgba(34, 197, 94, 0.15)',
      },
      {
        id: 'inventory',
        aliases: ['inventory'],
        label: 'Kiểm Kê Kho',
        desc: 'Kiểm tra tồn thực tế và đối soát hàng tồn',
        Icon: ClipboardCheck,
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
      },
    ],
  },
  {
    title: 'HỆ THỐNG & TÀI KHOẢN',
    items: [
      {
        id: 'settings',
        aliases: ['settings'],
        label: 'Cài Đặt & Phân Hệ',
        desc: 'Chọn phân hệ kho làm việc, máy in & cấu hình',
        Icon: Settings,
        color: '#a78bfa',
        bgColor: 'rgba(167, 139, 250, 0.15)',
      },
    ],
  },
]

export const FullMenuModal: React.FC<FullMenuModalProps> = ({
  visible,
  onClose,
  currentTab,
  onSelectTab,
  userProfile,
  onLogout,
}) => {
  const { isDark, tabThemes, toggleTabTheme, setAllTabsTheme } = useScannerTheme()
  if (!visible) return null

  const handleSelect = (item: MenuItemConfig) => {
    onSelectTab(item.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Container */}
      <div
        className={`relative z-10 w-full max-w-md mx-auto rounded-t-[24px] border-t max-h-[88dvh] flex flex-col shadow-[0_-4px_24px_rgba(0,0,0,0.35)] overflow-hidden ${
          isDark
            ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc]'
            : 'bg-stone-50 border-stone-200 text-stone-900'
        }`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)' }}
      >
        {/* Header Thông Tin Tài Khoản */}
        <div
          className={`flex items-center justify-between px-4 py-3.5 border-b shrink-0 ${
            isDark ? 'border-[#1e293b]' : 'bg-white border-stone-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)' }}
            >
              <User size={20} color="#0284c7" />
            </div>
            <div className="min-w-0">
              <div className={`text-[14px] font-extrabold truncate ${isDark ? 'text-[#f8fafc]' : 'text-stone-900'}`}>
                {userProfile?.fullName || 'Nhân viên kho'}
              </div>
              <div className={`text-[11px] font-semibold truncate max-w-[240px] mt-0.5 ${isDark ? 'text-[#94a3b8]' : 'text-stone-500'}`}>
                {userProfile?.companyName || 'Công Ty CP Tập Đoàn XNK Trái Cây Chánh Thu'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg active:scale-95 transition ${
              isDark ? 'text-[#94a3b8] hover:text-white' : 'text-stone-500 hover:text-stone-900'
            }`}
            aria-label="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Danh Sách Tất Cả Chức Năng */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 pb-6 space-y-4">
          {/* Bộ chuyển đổi Giao Diện Sáng / Tối */}
          <div>
            <div className={`text-[10px] font-extrabold tracking-[0.8px] mb-2 ml-1 uppercase ${isDark ? 'text-[#64748b]' : 'text-stone-500'}`}>
              GIAO DIỆN (CHẠM ☀️/🌙 Ở TỪNG MENU ĐỂ CHỈNH RIÊNG)
            </div>
            <div
              className={`grid grid-cols-2 gap-1.5 p-1 rounded-2xl border ${
                isDark ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-stone-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setAllTabsTheme('light')}
                className="py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 bg-amber-500/15 text-amber-600 transition"
              >
                <Sun size={15} />
                <span>Tất cả Sáng</span>
              </button>
              <button
                type="button"
                onClick={() => setAllTabsTheme('dark')}
                className="py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 bg-indigo-500/15 text-indigo-600 transition"
              >
                <Moon size={15} />
                <span>Tất cả Tối</span>
              </button>
            </div>
          </div>

          {MENU_SECTIONS.map((sec) => (
            <div key={sec.title}>
              <div className={`text-[10px] font-extrabold tracking-[0.8px] mb-2 ml-1 uppercase ${isDark ? 'text-[#64748b]' : 'text-stone-500'}`}>
                {sec.title}
              </div>
              <div
                className={`rounded-2xl border overflow-hidden ${
                  isDark ? 'bg-[#1e293b] border-[#334155]' : 'bg-white border-stone-200'
                }`}
              >
                {sec.items.map((item, idx) => {
                  const isSelected = item.aliases.includes(currentTab)
                  const isLast = idx === sec.items.length - 1
                  const IconComp = item.Icon

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={`w-full flex items-center px-3.5 py-3 gap-3 text-left transition active:opacity-90 ${
                        !isLast ? (isDark ? 'border-b border-[#334155]' : 'border-b border-stone-100') : ''
                      }`}
                      style={
                        isSelected
                          ? { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(79, 70, 229, 0.08)' }
                          : undefined
                      }
                    >
                      <div
                        className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                        style={{ backgroundColor: item.bgColor }}
                      >
                        <IconComp size={20} color={item.color} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[13px] font-bold truncate ${isDark ? 'text-[#f8fafc]' : 'text-stone-900'}`}
                            style={
                              isSelected
                                ? { color: item.color, fontWeight: 800 }
                                : undefined
                            }
                          >
                            {item.label}
                          </span>
                          {item.isPrimary && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0"
                              style={{
                                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
                                color: isDark ? '#818cf8' : '#4f46e5',
                              }}
                            >
                              Chính
                            </span>
                          )}
                        </div>
                        <div className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-[#94a3b8]' : 'text-stone-500'}`}>
                          {item.desc}
                        </div>
                      </div>

                      {isSelected ? (
                        <CheckCircle2 size={18} color={item.color} className="shrink-0" />
                      ) : (
                        <ChevronRight size={16} color="#475569" className="shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Nút Đăng Xuất */}
          {onLogout && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onLogout()
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-[12px] font-bold text-[#ef4444] active:scale-[0.99] transition mt-1.5"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.25)',
              }}
            >
              <LogOut size={18} color="#ef4444" />
              <span>Đăng xuất khỏi ứng dụng</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default FullMenuModal
