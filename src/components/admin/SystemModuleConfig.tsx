'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, Package, Archive, Layers, LayoutDashboard, Cog, Check, Search, ShoppingCart, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { INBOUND_MODULES, OUTBOUND_MODULES } from '@/lib/order-modules'
import { PRODUCT_MODULES } from '@/lib/product-modules'
import { LOT_MODULES } from '@/lib/lot-modules'
import { DASHBOARD_MODULES } from '@/lib/dashboard-modules'
import { UTILITY_MODULES } from '@/lib/utility-modules'
import { MENU_STRUCTURE } from '@/lib/menu-structure' // [NEW]

// Combine all modules for display
const ALL_MODULES = [
    ...INBOUND_MODULES.map(m => ({ ...m, category: 'Nhập kho' })),
    ...OUTBOUND_MODULES.map(m => ({ ...m, category: 'Xuất kho' })),
    ...PRODUCT_MODULES.map(m => ({ ...m, category: 'Sản phẩm' })),
    ...LOT_MODULES.map(m => ({ ...m, category: 'Quản lý LOT' })),
    ...DASHBOARD_MODULES.map(m => ({ ...m, category: 'Dashboard' })),
    ...UTILITY_MODULES.map(m => ({ ...m, category: m.category === 'info' ? 'Thông tin' : 'Tiện ích hệ thống' }))
]

interface SystemModuleConfigProps {
    systemId: string
    companyId: string
    systemName: string
    onBack: () => void
}

export default function SystemModuleConfig({ systemId, companyId, systemName, onBack }: SystemModuleConfigProps) {
    const { showToast } = useToast()

    // Configuration State
    const [config, setConfig] = useState<{
        inbound: string[],
        outbound: string[],
        product: string[],
        lot: string[],
        dashboard: string[],
        utility: string[],
        hidden_menus: string[] // [NEW]
    }>({
        inbound: [], outbound: [], product: [], lot: [], dashboard: [], utility: [], hidden_menus: []
    })

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [activeCategory, setActiveCategory] = useState<string>('all')
    const [basicModuleIds, setBasicModuleIds] = useState<string[]>([])

    const fetchBasic = async () => {
        const { data } = await supabase.from('app_modules').select('id').eq('is_basic', true)
        if (data) setBasicModuleIds(data.map(x => x.id))
    }

    useEffect(() => {
        fetchBasic()
    }, [])

    useEffect(() => {
        if (systemId) {
            fetchSystemConfig()
            fetchBasic() // Ensure we have latest data
            // Subscribe to realtime changes
            const channel = supabase
                .channel(`admin_system_config_${systemId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'systems'
                        // Removed filter string to ensure we catch the event
                    },
                    (payload: any) => {
                        // Filter in JS
                        if (payload.new && payload.new.id === systemId) {
                            console.log('Realtime update received for this system:', payload)
                            fetchSystemConfig()
                        }
                    }
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [systemId])

    const fetchSystemConfig = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase.from('systems').select('*').eq('id', systemId).single()
            if (error) throw error

            const sys = data as any

            // Helper to get defaults ONLY if data is null/undefined
            const getDefaults = (modules: any[], allModules: any[]) => {
                if (modules === null || modules === undefined) {
                    return allModules.filter(m => m.is_basic).map(m => m.id)
                }
                // If array (even empty), respect it.
                return Array.isArray(modules) ? modules : []
            }

            // Parse raw data from DB
            let inboundList = (sys.inbound_modules && Array.isArray(sys.inbound_modules))
                ? sys.inbound_modules
                : (sys.inbound_modules && typeof sys.inbound_modules === 'string' ? JSON.parse(sys.inbound_modules) : null)

            let outboundList = (sys.outbound_modules && Array.isArray(sys.outbound_modules))
                ? sys.outbound_modules
                : (sys.outbound_modules && typeof sys.outbound_modules === 'string' ? JSON.parse(sys.outbound_modules) : null)

            let lotList = (sys.lot_modules && Array.isArray(sys.lot_modules))
                ? sys.lot_modules
                : (sys.lot_modules && typeof sys.lot_modules === 'string' ? JSON.parse(sys.lot_modules) : null)

            let dashboardList = (sys.dashboard_modules && Array.isArray(sys.dashboard_modules))
                ? sys.dashboard_modules
                : (sys.dashboard_modules && typeof sys.dashboard_modules === 'string' ? JSON.parse(sys.dashboard_modules) : null)

            let productList: string[] | null = null
            let utilityList: string[] | null = null

            if (sys.modules) {
                if (Array.isArray(sys.modules)) {
                    // Legacy format: array is product
                    productList = sys.modules
                } else if (typeof sys.modules === 'object') {
                    if (Array.isArray(sys.modules.product_modules)) productList = sys.modules.product_modules
                    if (Array.isArray(sys.modules.utility_modules)) utilityList = sys.modules.utility_modules
                }
            }

            // MERGE Logic: Only apply defaults if NULL (New Warehouse)
            // If user saved [] (Empty), we respect it.
            setConfig({
                inbound: getDefaults(inboundList, INBOUND_MODULES),
                outbound: getDefaults(outboundList, OUTBOUND_MODULES),
                product: getDefaults(productList || [], PRODUCT_MODULES),
                lot: getDefaults(lotList, LOT_MODULES),
                dashboard: getDefaults(dashboardList, DASHBOARD_MODULES),
                utility: getDefaults(utilityList || [], UTILITY_MODULES),
                hidden_menus: Array.isArray(sys.hidden_menus) ? sys.hidden_menus : [] // [NEW]
            })
        } catch (error: any) {
            console.error('Error fetching system config:', error)
            showToast('Lỗi tải cấu hình kho: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    // License State
    const [companyLicenses, setCompanyLicenses] = useState<string[]>([])

    useEffect(() => {
        if (companyId) {
            fetchCompanyLicenses()
        }
    }, [companyId])

    const fetchCompanyLicenses = async () => {
        const { data } = await supabase.from('companies').select('unlocked_modules').eq('id', companyId).single()
        if (data && data.unlocked_modules) {
            setCompanyLicenses(data.unlocked_modules)
        }
    }

    const handleToggle = (moduleId: string, category: string) => {
        let type: keyof typeof config | null = null

        if (category === 'Nhập kho') type = 'inbound'
        else if (category === 'Xuất kho') type = 'outbound'
        else if (category === 'Sản phẩm') type = 'product'
        else if (category === 'Quản lý LOT') type = 'lot'
        else if (category === 'Dashboard') type = 'dashboard'
        else if (category === 'Tiện ích hệ thống' || category === 'Thông tin') type = 'utility'

        if (!type) return

        setConfig(prev => {
            const currentList = prev[type as keyof typeof config]
            const exists = currentList.includes(moduleId)
            const newList = exists ? currentList.filter(id => id !== moduleId) : [...currentList, moduleId]
            return { ...prev, [type as keyof typeof config]: newList }
        })
    }

    const toggleMenu = (menuId: string, children?: any[]) => {
        setHasChanges && setHasChanges(true)
        setConfig(prev => {
            const current = prev.hidden_menus || []
            const exists = current.includes(menuId)
            let newList = exists ? current.filter(id => id !== menuId) : [...current, menuId]

            // If hiding parent, hide children too
            if (!exists && children) {
                children.forEach(c => {
                    if (!newList.includes(c.id)) newList.push(c.id)
                })
            }
            // If showing parent, keep children as is or show them? 
            // Usually showing parent doesn't force show children.

            return { ...prev, hidden_menus: newList }
        })
    }

    const [hasChanges, setHasChanges] = useState(false) // Added change tracking

    const handleSave = async () => {
        setSaving(true)
        try {
            // 1. Update System Config
            const modulesJson = {
                product_modules: config.product,
                utility_modules: config.utility
            }

            const { error: sysError } = await supabase.from('systems').update({
                inbound_modules: config.inbound,
                outbound_modules: config.outbound,
                lot_modules: config.lot,
                dashboard_modules: config.dashboard,
                hidden_menus: config.hidden_menus, // [NEW]
                modules: modulesJson
            }).eq('id', systemId)

            if (sysError) throw sysError

            setHasChanges(false) // Reset

            showToast(`Đã lưu cấu hình cho kho ${systemName}`, 'success')

        } catch (error: any) {
            console.error('Error saving config:', error)
            showToast('Lỗi lưu cấu hình: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const categories = ['Nhập kho', 'Xuất kho', 'Sản phẩm', 'Quản lý LOT', 'Dashboard', 'Tiện ích hệ thống', 'Thông tin', 'Menu Sidebar']

    if (loading) {
        return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            {/* Control Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-stone-200">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <button onClick={onBack} className="text-sm text-stone-500 hover:text-orange-600 hover:underline">
                            ← Quay lại danh sách
                        </button>
                        <button onClick={() => { fetchSystemConfig(); fetchCompanyLicenses(); fetchBasic(); }} className="p-1 hover:bg-stone-100 rounded-full text-stone-400 hover:text-orange-600 transition-colors" title="Tải lại dữ liệu">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-stone-800">Cấu hình: <span className="text-orange-600">{systemName}</span></h3>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className="bg-orange-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-orange-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    <span>Lưu Thay Đổi</span>
                </button>
            </div>

            {/* Config Grid (Simplified Re-use) */}
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-stone-200">
                {/* Filters */}
                <div className="mb-6 space-y-3">
                    <div className="relative w-full md:w-1/2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm module..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:orange-500"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setActiveCategory('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${activeCategory === 'all' ? 'bg-orange-100 border-orange-200 text-orange-700' : 'bg-white border-stone-200 text-stone-600'}`}>Tất cả</button>
                        {categories.map(cat => (
                            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${activeCategory === cat ? 'bg-orange-100 border-orange-200 text-orange-700' : 'bg-white border-stone-200 text-stone-600'}`}>{cat}</button>
                        ))}
                    </div>

                    <div className="text-xs text-stone-500 italic mt-2">
                        * Chỉ hiển thị module đã có License (Subscription). (Các module mặc định Basic luôn hiển thị & được bật cho kho mới).
                    </div>
                </div>

                <div className="space-y-8">
                    {categories.filter(cat => activeCategory === 'all' || activeCategory === cat).map(cat => {
                        if (cat === 'Menu Sidebar') {
                            const visibleMenus = MENU_STRUCTURE.filter(m => !searchTerm || m.name.toLowerCase().includes(searchTerm.toLowerCase()));
                            if (visibleMenus.length === 0) return null;

                            return (
                                <div key={cat} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-3 border-b border-stone-100 pb-1 flex items-center gap-2">
                                        {cat}
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">NEW</span>
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {visibleMenus.map(menu => {
                                            const isHidden = config.hidden_menus?.includes(menu.id);
                                            const MenuIcon = menu.icon;

                                            return (
                                                <div key={menu.id} className="p-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 transition-all">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-stone-100 text-stone-600 rounded-lg">
                                                                <MenuIcon size={20} />
                                                            </div>
                                                            <span className="font-bold text-sm text-stone-800">{menu.name}</span>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={!isHidden}
                                                                onChange={() => toggleMenu(menu.id, menu.children)}
                                                            />
                                                            <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                                                        </label>
                                                    </div>

                                                    {menu.children && menu.children.length > 0 && (
                                                        <div className="grid grid-cols-1 gap-2 mt-4 pt-4 border-t border-stone-100">
                                                            {menu.children.map(child => {
                                                                const isChildHidden = config.hidden_menus?.includes(child.id);
                                                                const ChildIcon = child.icon;
                                                                return (
                                                                    <div key={child.id} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-stone-100 transition-colors">
                                                                        <div className="flex items-center gap-2">
                                                                            <ChildIcon size={14} className="text-stone-400" />
                                                                            <span className={`text-xs font-medium ${isChildHidden ? 'text-stone-400 line-through' : 'text-stone-600'}`}>{child.name}</span>
                                                                        </div>
                                                                        <label className="relative inline-flex items-center cursor-pointer scale-75 origin-right">
                                                                            <input
                                                                                type="checkbox"
                                                                                className="sr-only peer"
                                                                                checked={!isChildHidden}
                                                                                onChange={() => toggleMenu(child.id)}
                                                                            />
                                                                            <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                                                                        </label>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        }

                        const modules = ALL_MODULES.filter(m => m.category === cat)
                        const visibleModules = modules.filter(m => {
                            // [NEW] Hide core modules
                            if (['inbound_basic', 'inbound_supplier', 'outbound_basic', 'outbound_customer', 'warehouse_name', 'images'].includes(m.id)) return false
                            const matchesSearch = !searchTerm || m.name.toLowerCase().includes(searchTerm.toLowerCase())
                            // [UPDATED] Check dynamic basic status
                            const isBasic = basicModuleIds.includes(m.id)
                            const hasLicense = companyLicenses.includes(m.id) || isBasic
                            return matchesSearch && hasLicense
                        })
                        if (visibleModules.length === 0) return null

                        return (
                            <div key={cat}>
                                <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-3 border-b border-stone-100 pb-1">{cat}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {visibleModules.map(mod => {
                                        let isChecked = false
                                        if (cat === 'Nhập kho') isChecked = config.inbound.includes(mod.id)
                                        else if (cat === 'Xuất kho') isChecked = config.outbound.includes(mod.id)
                                        else if (cat === 'Sản phẩm') isChecked = config.product.includes(mod.id)
                                        else if (cat === 'Quản lý LOT') isChecked = config.lot.includes(mod.id)
                                        else if (cat === 'Dashboard') isChecked = config.dashboard.includes(mod.id)
                                        else if (cat === 'Tiện ích hệ thống' || cat === 'Thông tin') isChecked = config.utility.includes(mod.id)

                                        const isUnlocked = companyLicenses.includes(mod.id)

                                        return (
                                            <div key={mod.id} onClick={() => { handleToggle(mod.id, cat); setHasChanges(true); }}
                                                className={`
                                                            p-3 rounded-lg border cursor-pointer flex items-start gap-3 transition-all select-none relative
                                                            ${isChecked
                                                        ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-200'
                                                        : (isUnlocked ? 'bg-white border-blue-200 shadow-sm shadow-blue-50' : 'bg-white border-stone-200 hover:border-stone-300')
                                                    }
                                                        `}
                                            >
                                                {/* License Badge */}
                                                {isUnlocked && (
                                                    <div className="absolute top-2 right-2 flex items-center gap-1" title="Đã có License">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                    </div>
                                                )}

                                                <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isChecked ? 'bg-orange-500 border-orange-600' : 'bg-white border-stone-300'}`}>
                                                    {isChecked && <Check size={12} className="text-white" />}
                                                </div>
                                                <div>
                                                    <div className={`font-bold text-sm ${isUnlocked ? 'text-blue-900' : 'text-stone-800'} flex flex-wrap items-center gap-1.5`}>
                                                        {mod.name}
                                                        {basicModuleIds.includes(mod.id) && (
                                                            <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-wider font-bold">Default</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-stone-500 line-clamp-2 mt-0.5">{mod.description}</div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
