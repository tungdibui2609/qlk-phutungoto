'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

import { supabase } from '@/lib/supabaseClient'
import { BASIC_MODULE_IDS } from '@/lib/basic-modules'
import { INBOUND_MODULES, OUTBOUND_MODULES } from '@/lib/order-modules'
import { PRODUCT_MODULES } from '@/lib/product-modules'
import { LOT_MODULES } from '@/lib/lot-modules'
import { DASHBOARD_MODULES } from '@/lib/dashboard-modules'
import { UTILITY_MODULES } from '@/lib/utility-modules'
import { PRINT_MODULES } from '@/lib/print-modules'
import { QR_MODULES } from '@/lib/qr-modules'
import { REPORT_MODULES } from '@/lib/report-modules'
import { useUser } from './UserContext' // [NEW] Import

export type SystemType = string // Was rigid Enum, now string

interface System {
  id: string
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
  utility_modules?: string[] | null
  print_modules?: string[] | null
  qr_modules?: string[] | null
  report_modules?: string[] | null
  is_active?: boolean
  sort_order?: number
  hidden_menus?: string[] | null
  company_id?: string
}

interface SystemContextType {
  systemType: SystemType
  setSystemType: (type: SystemType) => void
  systems: System[]
  currentSystem: System | undefined
  unlockedModules: string[]
  hasModule: (moduleId: string) => boolean
  refreshSystems: () => Promise<void>
}

const SystemContext = createContext<SystemContextType | undefined>(undefined)

// Config fallback (optional, or just empty)
export const SYSTEM_CONFIG: Record<string, { name: string; color: string }> = {
}

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [systemType, setSystemTypeState] = useState<SystemType>('KHO_DONG_LANH')
  const [systems, setSystems] = useState<System[]>([])
  const [unlockedModules, setUnlockedModules] = useState<string[]>([])
  const [session, setSession] = useState<any>(null)

  // [NEW] Use UserContext
  const { activeModules, profile } = useUser()

  // [NEW] Dynamic Basic Modules (Initialized with static fallback, updated from DB)
  const [basicModuleIds, setBasicModuleIds] = useState<string[]>(BASIC_MODULE_IDS)

  useEffect(() => {
    const fetchBasicModules = async () => {
      // Fetch dynamic definition of "Basic" modules from DB
      const { data } = await supabase.from('app_modules').select('id').eq('is_basic', true)
      if (data) {
        setBasicModuleIds(Array.from(new Set([...BASIC_MODULE_IDS, ...(data as any[]).map(m => m.id)])))
      }
    }
    fetchBasicModules()
  }, [])

  const router = useRouter()
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
      setUnlockedModules(activeModules)
    }
  }, [activeModules])

  // Fetch systems (Keep existing logic, but remove fetchCompanyConfig call)
  const accessToken = session?.access_token

  const fetchSystems = async () => {
    // If no session yet, we might want to skip or try public if RLS allows. 
    // Assuming protected:
    if (!accessToken) return

    // [FIX] Lọc systems theo company_id để tránh dữ liệu lẫn giữa các công ty
    // Superadmin (company_id = null) vẫn thấy tất cả systems
    let query = (supabase.from('systems') as any).select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    if (profile?.company_id) {
      query = query.eq('company_id', profile.company_id)
    }
    const { data: systemsData } = await query

    if (systemsData) {
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
          lot_modules: sys.lot_modules,
          print_modules: sys.print_modules,
          qr_modules: sys.qr_modules,
          report_modules: sys.report_modules,
          hidden_menus: Array.isArray(sys.hidden_menus) ? sys.hidden_menus : []
        }
      })

      // Fallback if no systems found (New Company)
      if (mergedSystems.length === 0) {
        mergedSystems = [
          {
            code: 'KHO_DONG_LANH',
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
      } else {
        // [NEW] Sync Logic: Respect DB Config. Default ONLY if null.

        const getDefaults = (data: any, allModules: any[]) => {
          if (data === null || data === undefined) {
            return allModules.filter((m: any) => m.is_basic).map((m: any) => m.id)
          }
          // Nếu đã có cấu hình trong DB (kể cả mảng rỗng []), tôn trọng tuyệt đối lựa chọn đã lưu của Admin/User
          return Array.isArray(data) ? data : []
        }

        mergedSystems = mergedSystems.map((sys: any) => ({
          ...sys,
          inbound_modules: getDefaults(sys.inbound_modules, INBOUND_MODULES),
          outbound_modules: getDefaults(sys.outbound_modules, OUTBOUND_MODULES),
          lot_modules: getDefaults(sys.lot_modules, LOT_MODULES),
          dashboard_modules: getDefaults(sys.dashboard_modules, DASHBOARD_MODULES),
          utility_modules: getDefaults(sys.utility_modules || sys.modules?.utility_modules, UTILITY_MODULES),
          print_modules: getDefaults(sys.print_modules || sys.modules?.print_modules, PRINT_MODULES),
          qr_modules: getDefaults(sys.qr_modules || sys.modules?.qr_modules, QR_MODULES),
          report_modules: getDefaults(sys.report_modules || sys.modules?.report_modules, REPORT_MODULES)
        }))
      }

      // [FIX] Dedup theo code để tránh lỗi React duplicate key
      const seenCodes = new Set<string>()
      const dedupedSystems = mergedSystems.filter((sys: any) => {
        if (seenCodes.has(sys.code)) {
          console.warn(`[SystemContext] Phát hiện system trùng code "${sys.code}", bỏ qua bản ghi trùng.`)
          return false
        }
        seenCodes.add(sys.code)
        return true
      })
      setSystems(dedupedSystems)
    }
  }

  useEffect(() => {
    fetchSystems()

    // Realtime subscription for SYSTEMS
    const systemChannel = supabase
      .channel('public:systems')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'systems'
        },
        (payload) => {
          console.log('System updated, refreshing...', payload)
          fetchSystems()
        }
      )
      .subscribe()

    // Realtime subscription for COMPANIES (Licenses)
    const companyChannel = supabase
      .channel('public:companies')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          filter: `id=eq.${session?.user?.user_metadata?.company_id || ''}`
        },
        (payload) => {
          const newCompany = payload.new as any;
          if (newCompany && newCompany.unlocked_modules) {
            setUnlockedModules(newCompany.unlocked_modules)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(systemChannel)
      supabase.removeChannel(companyChannel)
    }
  }, [accessToken, profile?.company_id])

  useEffect(() => {
    // Load from local storage on mount
    const saved = localStorage.getItem('systemType') as SystemType
    if (saved) {
      setSystemTypeState(saved)
    }
  }, [])

  // [NEW] Auto-switch system if current selection is invalid (e.g. deleted)
  useEffect(() => {
    if (systems.length > 0) {
      const exists = systems.find(s => s.code === systemType)
      if (!exists) {
        console.warn(`System ${systemType} not found, switching to ${systems[0].code}`)
        setSystemType(systems[0].code)
      }
    }
  }, [systems, systemType])

  const setSystemType = (type: SystemType) => {
    localStorage.setItem('systemType', type)
    setSystemTypeState(type)
  }

  const currentSystem = systems.find(s => s.code === systemType)

  // Tối ưu hóa phân tích module bằng useMemo và Set
  const systemModuleSets = React.useMemo(() => {
    const inboundSet = new Set<string>()
    const outboundSet = new Set<string>()
    const otherSet = new Set<string>()

    if (!currentSystem) return { inboundSet, outboundSet, otherSet }

    const getArr = (val: any) => Array.isArray(val) ? val : []

    getArr(currentSystem.inbound_modules).forEach((m: any) => inboundSet.add(m))
    getArr(currentSystem.outbound_modules).forEach((m: any) => outboundSet.add(m))
    getArr(currentSystem.lot_modules).forEach((m: any) => otherSet.add(m))
    getArr(currentSystem.dashboard_modules).forEach((m: any) => otherSet.add(m))
    getArr(currentSystem.utility_modules).forEach((m: any) => otherSet.add(m))
    getArr(currentSystem.print_modules).forEach((m: any) => otherSet.add(m))
    getArr(currentSystem.qr_modules).forEach((m: any) => otherSet.add(m))
    getArr(currentSystem.report_modules).forEach((m: any) => otherSet.add(m))

    const rawModules = currentSystem.modules
    let productModules: string[] = []
    if (Array.isArray(rawModules)) {
      productModules = rawModules
    } else if (typeof rawModules === 'object' && rawModules !== null) {
      productModules = Array.isArray((rawModules as any).product_modules) ? (rawModules as any).product_modules : []
      
      const legacyModules = rawModules as any
      const utilityModules = Array.isArray(legacyModules?.utility_modules) ? legacyModules.utility_modules : []
      utilityModules.forEach((m: any) => otherSet.add(m))

      const printModules = Array.isArray(legacyModules?.print_modules) ? legacyModules.print_modules : []
      printModules.forEach((m: any) => otherSet.add(m))

      const qrModules = Array.isArray(legacyModules?.qr_modules) ? legacyModules.qr_modules : []
      qrModules.forEach((m: any) => otherSet.add(m))

      const reportModules = Array.isArray(legacyModules?.report_modules) ? legacyModules.report_modules : []
      reportModules.forEach((m: any) => otherSet.add(m))
      
      // Legacy boolean properties
      Object.keys(legacyModules).forEach(key => {
        if (legacyModules[key] === true) {
          otherSet.add(key)
        }
      })
    }
    
    productModules.forEach((m: any) => otherSet.add(m))

    return { inboundSet, outboundSet, otherSet }
  }, [currentSystem])

  const hasModule = React.useCallback((moduleId: string) => {
    // 1. Core System Modules: Always Enabled, Hidden from Admin
    const CORE_MODULES = ['inbound_basic', 'inbound_supplier', 'outbound_basic', 'outbound_customer', 'images', 'warehouse_name', 'production_code']
    if (CORE_MODULES.includes(moduleId)) {
      return true
    }

    // 2. Basic Modules (Default):
    const isBasic = basicModuleIds.includes(moduleId)
    if (isBasic) {
      // Các module cơ bản của LOT hoặc thông tin chung luôn luôn khả dụng ở mọi kho
      const isLotBasic = LOT_MODULES.some(m => m.id === moduleId && m.is_basic)
      if (isLotBasic) {
        return true
      }

      // Các module in ấn có thể bật/tắt theo kho, ưu tiên kiểm tra cấu hình kho bên dưới
      const isPrint = PRINT_MODULES.some(m => m.id === moduleId)
      if (isPrint && currentSystem) {
        // Fallthrough to check currentSystem.print_modules below
      } else if (QR_MODULES.some(m => m.id === moduleId) && currentSystem) {
        // Fallthrough to check currentSystem.qr_modules below
      } else if (REPORT_MODULES.some(m => m.id === moduleId) && currentSystem) {
        // Fallthrough to check currentSystem.report_modules below
      } else if (currentSystem && currentSystem.modules) {
        // Re-use logic below for checking system modules
      } else {
        return true // Default to true if no system config exists yet
      }
    }

    // 2. Advanced modules check: Must be configured for current system
    if (!currentSystem) return false

    const { inboundSet, outboundSet, otherSet } = systemModuleSets

    // 3. Strict check for new column types
    if (moduleId.startsWith('inbound_') && moduleId !== 'inbound_date') {
      if (!isBasic && !unlockedModules.includes(moduleId)) return false
      return inboundSet.has(moduleId)
    }
    if (moduleId.startsWith('outbound_')) {
      if (!isBasic && !unlockedModules.includes(moduleId)) return false
      return outboundSet.has(moduleId)
    }

    // 4. Utility Modules: Kiểm tra cấu hình tiện ích bật/tắt của kho hiện tại
    const isUtility = UTILITY_MODULES.some(m => m.id === moduleId)
    if (isUtility) {
      return otherSet.has(moduleId)
    }

    // 5. Print Modules: Kiểm tra cấu hình in ấn bật/tắt của kho hiện tại
    const isPrint = PRINT_MODULES.some(m => m.id === moduleId)
    if (isPrint) {
      if (!isBasic && !unlockedModules.includes(moduleId)) return false
      return otherSet.has(moduleId)
    }

    // 6. QR Modules: Kiểm tra cấu hình quét mã QR bật/tắt của kho hiện tại
    const isQr = QR_MODULES.some(m => m.id === moduleId)
    if (isQr) {
      if (!isBasic && !unlockedModules.includes(moduleId)) return false
      return otherSet.has(moduleId)
    }

    // 7. Report Modules: Kiểm tra cấu hình báo cáo bật/tắt của kho hiện tại
    const isReport = REPORT_MODULES.some(m => m.id === moduleId)
    if (isReport) {
      if (!isBasic && !unlockedModules.includes(moduleId)) return false
      return otherSet.has(moduleId)
    }

    if (!isBasic && !unlockedModules.includes(moduleId)) return false

    return otherSet.has(moduleId)
  }, [currentSystem, unlockedModules, basicModuleIds, systemModuleSets])

  const value = React.useMemo(() => ({
    systemType,
    setSystemType,
    systems,
    currentSystem,
    unlockedModules,
    hasModule,
    refreshSystems: fetchSystems
  }), [systemType, systems, currentSystem, unlockedModules, hasModule])

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
