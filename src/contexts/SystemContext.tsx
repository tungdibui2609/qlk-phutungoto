'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export type SystemType = 'FROZEN' | 'PACKAGING' | 'MATERIAL' | 'GENERAL'

interface SystemContextType {
  systemType: SystemType
  setSystemType: (type: SystemType) => void
  systemName: string
  systemColor: string
}

const SystemContext = createContext<SystemContextType | undefined>(undefined)

export const SYSTEM_CONFIG: Record<SystemType, { name: string; color: string }> = {
  FROZEN: { name: 'Kho Đông Lạnh', color: 'blue' },
  PACKAGING: { name: 'Kho Bao Bì', color: 'amber' },
  MATERIAL: { name: 'Kho Nguyên Liệu', color: 'emerald' },
  GENERAL: { name: 'Tổng Hợp', color: 'purple' },
}

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [systemType, setSystemTypeState] = useState<SystemType>('FROZEN')
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Load from local storage on mount
    const saved = localStorage.getItem('systemType') as SystemType
    if (saved && SYSTEM_CONFIG[saved]) {
      setSystemTypeState(saved)
    } else {
      // If no system selected, redirect to selection page
      // preventing redirect loop if already on selection page
      if (pathname !== '/select-system') {
        router.push('/select-system')
      }
    }
  }, [pathname, router])

  const setSystemType = (type: SystemType) => {
    localStorage.setItem('systemType', type)
    setSystemTypeState(type)
  }

  const value = {
    systemType,
    setSystemType,
    systemName: SYSTEM_CONFIG[systemType].name,
    systemColor: SYSTEM_CONFIG[systemType].color,
  }

  return (
    <SystemContext.Provider value={value}>
      {children}
    </SystemContext.Provider>
  )
}

export function useSystem() {
  const context = useContext(SystemContext)
  if (context === undefined) {
    throw new Error('useSystem must be used within a SystemProvider')
  }
  return context
}
