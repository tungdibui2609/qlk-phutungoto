'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, Package, Archive, Layers, LayoutDashboard, Cog, Check, Search, ShieldAlert, ShoppingBag, ShoppingCart } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'

// Import all module definitions
import { INBOUND_MODULES, OUTBOUND_MODULES } from '@/lib/order-modules'
import { PRODUCT_MODULES } from '@/lib/product-modules'
import { LOT_MODULES } from '@/lib/lot-modules'
import { DASHBOARD_MODULES } from '@/lib/dashboard-modules'
import { UTILITY_MODULES } from '@/lib/utility-modules'

// Combine all modules for display
const ALL_MODULES = [
    ...INBOUND_MODULES.map(m => ({ ...m, category: 'Nhập kho' })),
    ...OUTBOUND_MODULES.map(m => ({ ...m, category: 'Xuất kho' })),
    ...PRODUCT_MODULES.map(m => ({ ...m, category: 'Sản phẩm' })),
    ...LOT_MODULES.map(m => ({ ...m, category: 'Quản lý LOT' })),
    ...DASHBOARD_MODULES.map(m => ({ ...m, category: 'Dashboard' })),
    ...UTILITY_MODULES.map(m => ({ ...m, category: 'Tiện ích hệ thống' }))
]

export default function UnifiedSystemConfig() {
    const { systems, unlockedModules } = useSystem() // Wait, useSystem uses 'unlockedModules'
    const { checkSubscription } = useUser()
    const { showToast } = useToast()

    // Selecting System
    const [selectedSystemCode, setSelectedSystemCode] = useState<string>('')

    // Configuration State
    const [config, setConfig] = useState<{
        inbound: string[],
        outbound: string[],
        product: string[],
        lot: string[],
        dashboard: string[],
        utility: string[]
    }>({
        inbound: [], outbound: [], product: [], lot: [], dashboard: [], utility: []
    })

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [activeCategory, setActiveCategory] = useState<string>('all')

    // Initialize selection
    useEffect(() => {
        if (systems.length > 0 && !selectedSystemCode) {
            setSelectedSystemCode(systems[0].code)
        }
    }, [systems])

    // Fetch configuration when system selection changes
    useEffect(() => {
        if (selectedSystemCode) {
            fetchSystemConfig(selectedSystemCode)
        }
    }, [selectedSystemCode])

    const fetchSystemConfig = async (sysCode: string) => {
        setLoading(true)
        try {
            const { data, error } = await supabase.from('systems').select('*').eq('code', sysCode).single()
            if (error) throw error

            const sys = data as any

            // Parse modules
            const inbound = Array.isArray(sys.inbound_modules) ? sys.inbound_modules :
                (typeof sys.inbound_modules === 'string' ? JSON.parse(sys.inbound_modules) : [])

            const outbound = Array.isArray(sys.outbound_modules) ? sys.outbound_modules :
                (typeof sys.outbound_modules === 'string' ? JSON.parse(sys.outbound_modules) : [])

            const lot = Array.isArray(sys.lot_modules) ? sys.lot_modules :
                (typeof sys.lot_modules === 'string' ? JSON.parse(sys.lot_modules) : [])

            const dashboard = Array.isArray(sys.dashboard_modules) ? sys.dashboard_modules :
                (typeof sys.dashboard_modules === 'string' ? JSON.parse(sys.dashboard_modules) : [])

            // Parse 'modules' JSON column which contains multiple types
            let product: string[] = []
            let utility: string[] = []

            if (sys.modules) {
                if (Array.isArray(sys.modules)) {
                    // Legacy: array means product modules
                    product = sys.modules
                } else if (typeof sys.modules === 'object') {
                    // New structure: object
                    if (Array.isArray(sys.modules.product_modules)) product = sys.modules.product_modules
                    if (Array.isArray(sys.modules.utility_modules)) utility = sys.modules.utility_modules
                }
            }

            setConfig({
                inbound: inbound || [],
                outbound: outbound || [],
                product: product || [],
                lot: lot || [],
                dashboard: dashboard || [],
                utility: utility || []
            })
        } catch (error: any) {
            console.error('Error fetching system config:', error)
            showToast('Lỗi tải cấu hình: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleToggle = (moduleId: string, category: string) => {
        // Determine which bucket this module belongs to based on ID prefix or category
        // Assuming strict prefixes or reliable category mapping
        // Better: use the 'type' from ALL_MODULES if available, but let's infer for now

        let type: keyof typeof config | null = null

        // Map category to state key
        if (category === 'Nhập kho') type = 'inbound'
        else if (category === 'Xuất kho') type = 'outbound'
        else if (category === 'Sản phẩm') type = 'product'
        else if (category === 'Quản lý LOT') type = 'lot'
        else if (category === 'Dashboard') type = 'dashboard'
        else if (category === 'Tiện ích hệ thống') type = 'utility'

        if (!type) return

        setConfig(prev => {
            const currentList = prev[type as keyof typeof config]
            const exists = currentList.includes(moduleId)
            const newList = exists ? currentList.filter(id => id !== moduleId) : [...currentList, moduleId]
            return { ...prev, [type as keyof typeof config]: newList }
        })
    }

    const handleSave = async () => {
        if (!selectedSystemCode) return
        setSaving(true)
        try {
            // Retrieve current 'modules' object to preserve other keys if any (though we re-fetched it)
            // Ideally we just update what we know.
            // But we need to merge 'product' and 'utility' into 'modules' JSON

            const modulesJson = {
                product_modules: config.product,
                utility_modules: config.utility
            }

            const { error } = await supabase.from('systems').update({
                inbound_modules: config.inbound,
                outbound_modules: config.outbound,
                lot_modules: config.lot,
                dashboard_modules: config.dashboard,
                modules: modulesJson // This overwrites 'modules' column with new structure
            }).eq('code', selectedSystemCode)

            if (error) throw error

            showToast(`Đã lưu cấu hình cho kho ${selectedSystemCode}`, 'success')

            // Force refresh system context might be needed if it doesn't auto-update
            // SystemContext listens to realtime, so it should be fine.

        } catch (error: any) {
            console.error('Error saving config:', error)
            showToast('Lỗi lưu cấu hình: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const categories = ['Nhập kho', 'Xuất kho', 'Sản phẩm', 'Quản lý LOT', 'Dashboard', 'Tiện ích hệ thống']
    const system = systems.find(s => s.code === selectedSystemCode)

    return (
        <div className="space-y-6 pb-20">
            {/* Header Control */}
            <div className="bg-white dark:bg-stone-900 p-3 md:p-4 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 sticky top-0 z-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="w-full md:w-auto">
                        <h2 className="text-base md:text-lg font-bold text-stone-900 dark:text-white">Cấu hình Phân hệ</h2>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <select
                                value={selectedSystemCode}
                                onChange={(e) => setSelectedSystemCode(e.target.value)}
                                className="w-full appearance-none pl-3 md:pl-4 pr-8 py-1.5 md:py-1.5 bg-white border border-orange-300 rounded-full font-medium text-xs md:text-sm text-stone-700 outline-none transition-all hover:border-orange-500 focus:ring-2 focus:ring-orange-100 cursor-pointer shadow-sm"
                            >
                                {systems.map(s => (
                                    <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-orange-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving || !selectedSystemCode}
                            className="bg-orange-600 text-white px-4 md:px-5 py-1.5 rounded-full text-xs md:text-sm font-bold hover:bg-orange-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 shadow-md shadow-orange-100 whitespace-nowrap"
                        >
                            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                            <span className="hidden xs:inline">Lưu Cấu Hình</span>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="mt-4 md:mt-6">
                    <div className="flex gap-2 w-full mb-3 md:mb-4 overflow-x-auto scrollbar-hide pb-1">
                        <button
                            onClick={() => setActiveCategory('all')}
                            className={`px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold transition-all border whitespace-nowrap ${activeCategory === 'all' ? 'bg-orange-600 border-orange-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-600'}`}
                        >
                            Tất cả
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold transition-all border whitespace-nowrap ${activeCategory === cat ? 'bg-orange-600 border-orange-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-600'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm module..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 bg-stone-50 border-none rounded-lg text-xs md:text-sm font-medium focus:outline-none focus:ring-0 placeholder:text-stone-400"
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-stone-400" size={32} /></div>
            ) : (
                <div className="space-y-8">
                    {categories.filter(cat => activeCategory === 'all' || activeCategory === cat).map(cat => {
                        const modules = ALL_MODULES.filter(m => m.category === cat)
                        if (modules.length === 0) return null

                        // Check visibility
                        const visibleModules = modules.filter(m => {
                            const matchesSearch = !searchTerm || m.name.toLowerCase().includes(searchTerm.toLowerCase())
                            const CORE_HIDDEN = ['outbound_basic', 'images']
                            const hasLicense = checkSubscription(m.id)
                            return matchesSearch && !CORE_HIDDEN.includes(m.id) && hasLicense && !m.is_basic
                        })

                        if (visibleModules.length === 0) return null

                        return (
                            <div key={cat} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <h3 className="text-base font-bold text-stone-800 mb-3 flex items-center gap-2">
                                    {(cat === 'Nhập kho' || cat === 'Xuất kho') && <ShoppingCart size={18} className="text-stone-400" />}
                                    {cat === 'Sản phẩm' && <Package size={18} className="text-stone-400" />}
                                    {cat === 'Quản lý LOT' && <Archive size={18} className="text-stone-400" />}
                                    {cat === 'Dashboard' && <LayoutDashboard size={18} className="text-stone-400" />}
                                    {cat === 'Tiện ích hệ thống' && <Cog size={18} className="text-stone-400" />}
                                    {cat}
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {visibleModules.map(mod => {
                                        // Determine if checked
                                        let isChecked = false
                                        if (cat === 'Nhập kho') isChecked = config.inbound.includes(mod.id)
                                        else if (cat === 'Xuất kho') isChecked = config.outbound.includes(mod.id)
                                        else if (cat === 'Sản phẩm') isChecked = config.product.includes(mod.id)
                                        else if (cat === 'Quản lý LOT') isChecked = config.lot.includes(mod.id)
                                        else if (cat === 'Dashboard') isChecked = config.dashboard.includes(mod.id)
                                        else if (cat === 'Tiện ích hệ thống') isChecked = config.utility.includes(mod.id)

                                        return (
                                            <div
                                                key={mod.id}
                                                onClick={() => handleToggle(mod.id, cat)}
                                                className={`
                                                    relative p-3 rounded-xl border-2 cursor-pointer transition-all select-none
                                                    ${isChecked
                                                        ? 'bg-orange-50/30 border-orange-500 shadow-sm'
                                                        : 'bg-stone-50 border-transparent hover:bg-white hover:border-stone-200'
                                                    }
                                                `}
                                            >
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <div className={`p-1.5 rounded-lg ${isChecked ? 'bg-orange-600 text-white' : 'bg-stone-200 text-stone-500'}`}>
                                                        <mod.icon size={16} />
                                                    </div>

                                                    <div className={`
                                                        w-8 h-4.5 rounded-full relative transition-colors
                                                        ${isChecked ? 'bg-orange-600' : 'bg-stone-300'}
                                                    `}>
                                                        <div className={`
                                                            absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform
                                                            ${isChecked ? 'translate-x-[14px]' : 'translate-x-[2px]'}
                                                        `}></div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className={`font-bold text-[13px] mb-0.5 ${isChecked ? 'text-orange-900' : 'text-stone-600'}`}>{mod.name}</h4>
                                                    <p className="text-[11px] text-stone-500 line-clamp-2 leading-tight">{mod.description}</p>
                                                </div>

                                                {mod.is_basic && (
                                                    <div className="absolute top-2 right-10 px-1 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-bold rounded uppercase">
                                                        Mặc định
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
