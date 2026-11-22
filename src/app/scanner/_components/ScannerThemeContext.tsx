'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

export type ScannerThemeMode = 'light' | 'dark'

export type ScannerThemeTabKey =
  | 'stamp'
  | 'operations'
  | 'pallets'
  | 'warehouse_map'
  | 'label'
  | 'inventory'
  | 'settings'

export type ScannerTabThemesMap = Record<ScannerThemeTabKey, ScannerThemeMode>

export const SCANNER_THEME_TAB_META: {
  key: ScannerThemeTabKey
  label: string
  desc: string
  color: string
}[] = [
  {
    key: 'stamp',
    label: 'Dấu Đóng Thùng',
    desc: 'Quét mã dấu đóng & liên kết tem',
    color: '#d97706',
  },
  {
    key: 'operations',
    label: 'Số Liệu & Ca Làm',
    desc: 'Nhập xuất số liệu, chốt ca tạm & báo cáo',
    color: '#4f46e5',
  },
  {
    key: 'pallets',
    label: 'Pallet Kho',
    desc: 'Danh sách kiện/pallet và tình trạng lưu kho',
    color: '#0284c7',
  },
  {
    key: 'warehouse_map',
    label: 'Sơ Đồ Kho',
    desc: 'Vị trí sơ đồ kệ và các ô chứa pallet',
    color: '#059669',
  },
  {
    key: 'label',
    label: 'Quét Tem Thùng',
    desc: 'Quét barcode tem thùng và đóng pallet',
    color: '#16a34a',
  },
  {
    key: 'inventory',
    label: 'Kiểm Kê Kho',
    desc: 'Kiểm tra tồn thực tế và đối soát hàng tồn',
    color: '#059669',
  },
  {
    key: 'settings',
    label: 'Cài Đặt & Hệ Thống',
    desc: 'Cấu hình phân hệ kho, đồng bộ & tài khoản',
    color: '#7c3aed',
  },
]

export const DEFAULT_SCANNER_TAB_THEMES: ScannerTabThemesMap = {
  stamp: 'light',
  operations: 'light',
  pallets: 'light',
  warehouse_map: 'light',
  label: 'light',
  inventory: 'light',
  settings: 'light',
}

const SCANNER_TAB_THEMES_KEY = 'scanner_tab_themes_v1'

export function normalizeScannerThemeTab(raw: string): ScannerThemeTabKey {
  if (raw === 'stamp_scanner' || raw === 'stamp') return 'stamp'
  if (raw === 'scanner' || raw === 'label') return 'label'
  if (
    raw === 'operations' ||
    raw === 'pallets' ||
    raw === 'warehouse_map' ||
    raw === 'inventory' ||
    raw === 'settings'
  ) {
    return raw
  }
  return 'stamp'
}

interface ScannerThemeContextValue {
  mode: ScannerThemeMode
  isDark: boolean
  activeTab: ScannerThemeTabKey
  tabThemes: ScannerTabThemesMap
  setActiveThemeTab: (tab: string) => void
  setTabTheme: (tab: ScannerThemeTabKey, mode: ScannerThemeMode) => void
  toggleTabTheme: (tab?: ScannerThemeTabKey) => void
  setAllTabsTheme: (mode: ScannerThemeMode) => void
  setMode: (mode: ScannerThemeMode) => void
  toggleTheme: () => void
}

const ScannerThemeContext = createContext<ScannerThemeContextValue>({
  mode: 'light',
  isDark: false,
  activeTab: 'stamp',
  tabThemes: DEFAULT_SCANNER_TAB_THEMES,
  setActiveThemeTab: () => {},
  setTabTheme: () => {},
  toggleTabTheme: () => {},
  setAllTabsTheme: () => {},
  setMode: () => {},
  toggleTheme: () => {},
})

export function ScannerThemeProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTabState] = useState<ScannerThemeTabKey>('stamp')
  const [tabThemes, setTabThemes] = useState<ScannerTabThemesMap>(DEFAULT_SCANNER_TAB_THEMES)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCANNER_TAB_THEMES_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        setTabThemes(prev => ({ ...prev, ...parsed }))
      }
    } catch {}
  }, [])

  const persistMap = useCallback((nextMap: ScannerTabThemesMap) => {
    try {
      localStorage.setItem(SCANNER_TAB_THEMES_KEY, JSON.stringify(nextMap))
    } catch {}
  }, [])

  const setActiveThemeTab = useCallback((tab: string) => {
    setActiveTabState(normalizeScannerThemeTab(tab))
  }, [])

  const setTabTheme = useCallback(
    (tab: ScannerThemeTabKey, nextMode: ScannerThemeMode) => {
      setTabThemes(prev => {
        const next = { ...prev, [tab]: nextMode }
        persistMap(next)
        return next
      })
    },
    [persistMap]
  )

  const toggleTabTheme = useCallback(
    (tab?: ScannerThemeTabKey) => {
      const target = tab || activeTab
      setTabThemes(prev => {
        const cur = prev[target] || 'light'
        const nextMode: ScannerThemeMode = cur === 'light' ? 'dark' : 'light'
        const next = { ...prev, [target]: nextMode }
        persistMap(next)
        return next
      })
    },
    [activeTab, persistMap]
  )

  const setAllTabsTheme = useCallback(
    (nextMode: ScannerThemeMode) => {
      const next: ScannerTabThemesMap = {
        stamp: nextMode,
        operations: nextMode,
        pallets: nextMode,
        warehouse_map: nextMode,
        label: nextMode,
        inventory: nextMode,
        settings: nextMode,
      }
      setTabThemes(next)
      persistMap(next)
    },
    [persistMap]
  )

  const setMode = useCallback(
    (nextMode: ScannerThemeMode) => {
      setTabTheme(activeTab, nextMode)
    },
    [activeTab, setTabTheme]
  )

  const toggleTheme = useCallback(() => {
    toggleTabTheme(activeTab)
  }, [activeTab, toggleTabTheme])

  const currentMode: ScannerThemeMode = tabThemes[activeTab] || 'light'

  const value = useMemo<ScannerThemeContextValue>(
    () => ({
      mode: currentMode,
      isDark: currentMode === 'dark',
      activeTab,
      tabThemes,
      setActiveThemeTab,
      setTabTheme,
      toggleTabTheme,
      setAllTabsTheme,
      setMode,
      toggleTheme,
    }),
    [
      currentMode,
      activeTab,
      tabThemes,
      setActiveThemeTab,
      setTabTheme,
      toggleTabTheme,
      setAllTabsTheme,
      setMode,
      toggleTheme,
    ]
  )

  return <ScannerThemeContext.Provider value={value}>{children}</ScannerThemeContext.Provider>
}

export function useScannerTheme() {
  return useContext(ScannerThemeContext)
}
