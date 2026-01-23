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
  // Keep this for backward compatibility if needed, or remove it.
  // For now, removing it to force dynamic usage.
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
      const { data: systemsData, error: sysError } = await (supabase.from('systems') as any).select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
      const { data: configsData, error: configError } = await (supabase.from('system_configs') as any).select('*')

      if (systemsData) {
        // Merge configs into systems
        const mergedSystems = systemsData.map((sys: any) => {
          const config = configsData?.find((c: any) => c.system_code === sys.code)
          return {
            ...sys,
            inbound_modules: config?.inbound_modules || [],
            outbound_modules: config?.outbound_modules || []
          }
        })
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
    } else {
      // If no saved, default to FROZEN or first loaded system?
      // Let's rely on 'FROZEN' default for now or wait for systems to load
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
