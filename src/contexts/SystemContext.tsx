'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabaseClient'
import { BASIC_MODULE_IDS } from '@/lib/basic-modules'
import { useUser } from './UserContext' // [NEW] Import

export type SystemType = string // Was rigid Enum, now string

interface System {
  code: string
  name: string
  description?: string
  icon?: string
  bg_color_class?: string
  text_color_class?: string
  modules?: string | string[] // Supports JSON string or array
  inbound_modules?: string | string[]
  outbound_modules?: string | string[]
  dashboard_modules?: string[] | null
  lot_modules?: string[] | null
  is_active?: boolean
  sort_order?: number
}

interface SystemContextType {
  systemType: SystemType
  setSystemType: (type: SystemType) => void
  systems: System[]
  currentSystem: System | undefined
  unlockedModules: string[]
  hasModule: (moduleId: string) => boolean
}

const SystemContext = createContext<SystemContextType | undefined>(undefined)

// Config fallback (optional, or just empty)
export const SYSTEM_CONFIG: Record<string, { name: string; color: string }> = {
}

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [systemType, setSystemTypeState] = useState<SystemType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('systemType') as SystemType
      return saved || 'FROZEN'
    }
    return 'FROZEN'
  })

  const [systems, setSystems] = useState<System[]>([])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [unlockedModules, setUnlockedModules] = useState<string[]>([])
  const [session, setSession] = useState<Session | null>(null)

  // [NEW] Use UserContext
  const { activeModules } = useUser()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const pathname = usePathname()

  // Track session (Keep existing session logic for systems subscription, though useUser also has user)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // [NEW] Sync unlocked modules from UserContext (Initial Load)
  useEffect(() => {
    if (activeModules) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnlockedModules(activeModules)
    }
  }, [activeModules])

  // Fetch systems (Keep existing logic, but remove fetchCompanyConfig call)
  const accessToken = session?.access_token

  useEffect(() => {
    if (!accessToken) return // Wait for valid session

    async function fetchSystems() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: systemsData } = await (supabase.from('systems') as any).select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })

      if (systemsData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let mergedSystems = systemsData.map((sys: any) => {
          let sysModules = sys.modules;
          if (typeof sysModules === 'string') {
            try { sysModules = JSON.parse(sysModules) } catch (e) { sysModules = {} }
          }

          let inbound = sys.inbound_modules
          if (typeof inbound === 'string') {
            try { inbound = JSON.parse(inbound) } catch (e) { inbound = [] }
          }

          let outbound = sys.outbound_modules
          if (typeof outbound === 'string') {
            try { outbound = JSON.parse(outbound) } catch (e) { outbound = [] }
          }

          return {
            ...sys,
            modules: sysModules || null,
            inbound_modules: Array.isArray(inbound) ? inbound : [],
            outbound_modules: Array.isArray(outbound) ? outbound : [],
            dashboard_modules: sys.dashboard_modules,
            lot_modules: sys.lot_modules
          }
        })

        // Fallback if no systems found (New Company)
        if (mergedSystems.length === 0) {
          mergedSystems = [
            {
              code: 'FROZEN',
              name: 'Kho Lạnh',
              description: 'Quản lý kho lạnh, theo dõi nhiệt độ',
              bg_color_class: 'bg-blue-600',
              modules: {},
              sort_order: 1
            },
            {
              code: 'OFFICE',
              name: 'Văn Phòng',
              description: 'Quản lý văn phòng phẩm, thiết bị',
              bg_color_class: 'bg-amber-600',
              modules: {},
              sort_order: 2
            },
            {
              code: 'DRY',
              name: 'Kho Khô',
              description: 'Quản lý kho thường, vật tư',
              bg_color_class: 'bg-stone-600',
              modules: {},
              sort_order: 3
            },
            {
              code: 'PACKAGING',
              name: 'Bao Bì',
              description: 'Quản lý vật tư bao bì đóng gói',
              bg_color_class: 'bg-green-600',
              modules: {},
              sort_order: 4
            }
          ]
        }

        setSystems(mergedSystems)
      }
    }

    fetchSystems()

    // Realtime subscription
    const channel = supabase
      .channel('systems_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'systems'
        },
        () => {
          fetchSystems()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          // eslint-disable-next-line react-hooks/exhaustive-deps
          filter: `id=eq.${session?.user?.user_metadata?.company_id || ''}` // Filter isn't perfect here due to profile fetch delay, but safe enough or use broad filter
        },
        (payload) => {
          // Handle company update
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newCompany = payload.new as any;
          if (newCompany && newCompany.unlocked_modules) {
            setUnlockedModules(newCompany.unlocked_modules)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  const setSystemType = (type: SystemType) => {
    localStorage.setItem('systemType', type)
    setSystemTypeState(type)
  }

  const currentSystem = systems.find(s => s.code === systemType)

  const hasModule = (moduleId: string) => {
    // 1. Core System Modules: Always Enabled, Hidden from Admin
    const CORE_MODULES = ['inbound_basic', 'outbound_basic', 'images']
    if (CORE_MODULES.includes(moduleId)) {
      return true
    }

    // 2. Basic Modules (Default):
    // These are visible in Admin and can be toggled.
    // They generally should be enabled, but we respect the DB / System Config.
    const isBasic = BASIC_MODULE_IDS.includes(moduleId)
    if (isBasic) {
      if (unlockedModules.length > 0 && !unlockedModules.includes(moduleId)) return false;

      // If allowed globally, check if this SPECIFIC system has it enabled.
      // If the system has module configuration (not null/empty), we respect it.
      // If the system is new (no config), we default to TRUE for basic modules.
      if (currentSystem && currentSystem.modules) {
        // Re-use logic below for checking system modules
      } else {
        return true // Default to true if no system config exists yet
      }
    }

    // 2. Advanced modules check: Must be configured for current system
    // We trust that if it's in the system config, it's allowed.
    if (!currentSystem) return false

    // Look in all possible module buckets
    // Handle both Array and NULL cases
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getArr = (val: any) => Array.isArray(val) ? val : []

    const rawModules = currentSystem.modules
    let productModules: string[] = []
    if (Array.isArray(rawModules)) {
      productModules = rawModules
    } else if (typeof rawModules === 'object' && rawModules !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productModules = Array.isArray((rawModules as any).product_modules) ? (rawModules as any).product_modules : []
    }
    const inboundModules = getArr(currentSystem.inbound_modules)
    const outboundModules = getArr(currentSystem.outbound_modules)
    const dashboardModules = getArr(currentSystem.dashboard_modules)
    const lotModules = getArr(currentSystem.lot_modules)

    // Utility modules check (legacy and new structure)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacyModules = currentSystem.modules && !Array.isArray(currentSystem.modules) ? currentSystem.modules as any : {}
    const utilityModules = Array.isArray(legacyModules?.utility_modules) ? legacyModules.utility_modules : []

    // 3. Strict check for new column types
    if (moduleId.startsWith('inbound_')) {
      // Enforce Company License Check (unless it's a Core Module, which is handled above)
      if (!unlockedModules.includes(moduleId)) return false
      return inboundModules.includes(moduleId)
    }
    if (moduleId.startsWith('outbound_')) {
      if (!unlockedModules.includes(moduleId)) return false
      return outboundModules.includes(moduleId)
    }

    return productModules.includes(moduleId) ||
      dashboardModules.includes(moduleId) ||
      lotModules.includes(moduleId) ||
      utilityModules.includes(moduleId) ||
      !!legacyModules?.[moduleId]
  }

  const value = {
    systemType,
    setSystemType,
    systems,
    currentSystem,
    unlockedModules,
    hasModule
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
