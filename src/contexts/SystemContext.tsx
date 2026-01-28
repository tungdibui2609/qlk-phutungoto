'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

import { supabase } from '@/lib/supabaseClient'

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
  dashboard_modules?: string | string[]
  is_active?: boolean
  sort_order?: number
}

interface SystemContextType {
  systemType: SystemType
  setSystemType: (type: SystemType) => void
  systems: System[]
  currentSystem: System | undefined
}

const SystemContext = createContext<SystemContextType | undefined>(undefined)

// Config fallback (optional, or just empty)
export const SYSTEM_CONFIG: Record<string, { name: string; color: string }> = {
}

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [systemType, setSystemTypeState] = useState<SystemType>('FROZEN')
  const [systems, setSystems] = useState<System[]>([])
  const [session, setSession] = useState<any>(null)
  const router = useRouter()
  const pathname = usePathname()

  // Track session
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

  // Fetch systems and subscribe to changes
  const accessToken = session?.access_token

  useEffect(() => {
    if (!accessToken) return // Wait for valid session

    async function fetchSystems() {
      const { data: systemsData } = await (supabase.from('systems') as any).select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
      const { data: configsData } = await (supabase.from('system_configs') as any).select('*')

      if (systemsData) {
        // Merge configs into systems
        let mergedSystems = systemsData.map((sys: any) => {
          const config = configsData?.find((c: any) => c.system_code === sys.code)

          // Smart merge modules to avoid overwriting with empty
          const sysModules = sys.modules ? (typeof sys.modules === 'string' ? JSON.parse(sys.modules) : sys.modules) : null;
          const configModules = config?.modules ? (typeof config.modules === 'string' ? JSON.parse(config.modules) : config.modules) : null;

          const finalModules = (configModules && Object.keys(configModules).length > 0)
            ? configModules
            : (sysModules || {});

          return {
            ...sys,
            ...config,
            modules: finalModules,
            inbound_modules: config?.inbound_modules || sys.inbound_modules || [],
            outbound_modules: config?.outbound_modules || sys.outbound_modules || [],
            dashboard_modules: config?.dashboard_modules || sys.dashboard_modules || []
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
          event: '*',
          schema: 'public',
          table: 'system_configs'
        },
        () => {
          fetchSystems()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [accessToken])

  useEffect(() => {
    // Load from local storage on mount
    const saved = localStorage.getItem('systemType') as SystemType
    if (saved) {
      setSystemTypeState(saved)
    }
  }, [])

  const setSystemType = (type: SystemType) => {
    localStorage.setItem('systemType', type)
    setSystemTypeState(type)
  }

  const currentSystem = systems.find(s => s.code === systemType)

  const value = {
    systemType,
    setSystemType,
    systems,
    currentSystem
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
