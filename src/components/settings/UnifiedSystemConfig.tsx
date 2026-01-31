'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, Package, Archive, Layers, LayoutDashboard, Cog, Check, Search, ShieldAlert, ShoppingBag, ShoppingCart, ChevronDown } from 'lucide-react'
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
    const { systems, unlockedModules, refreshSystems } = useSystem()
    const { checkSubscription } = useUser()
    const { showToast } = useToast()

    // Selecting System
    const [selectedSystemCode, setSelectedSystemCode] = useState<string>('')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

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
        let type: keyof typeof config | null = null

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
            const modulesJson = {
                product_modules: config.product,
                utility_modules: config.utility
            }

            const { error } = await supabase.from('systems').update({
                inbound_modules: config.inbound,
                outbound_modules: config.outbound,
                lot_modules: config.lot,
                dashboard_modules: config.dashboard,
                modules: modulesJson
            }).eq('code', selectedSystemCode)

            if (error) throw error

            // Trigger realtime update immediately
            await refreshSystems()

            showToast(`Đã lưu cấu hình cho kho ${selectedSystemCode}`, 'success')

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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="w-full md:w-auto">
                        <h2 className="text-xl md:text-2xl font-bold text-stone-900 dark:text-white">Cấu hình Phân hệ</h2>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto relative z-30">
                        {/* Custom System Selector */}
                        <div className="relative flex-1 md:w-72">
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                className={`
                                    w-full flex items-center justify-between pl-4 pr-3 py-3 
                                    bg-white border rounded-xl font-bold text-sm md:text-base text-stone-800 
                                    transition-all cursor-pointer shadow-sm outline-none
                                    ${isDropdownOpen
                                        ? 'border-orange-500 ring-4 ring-orange-100'
                                        : 'border-stone-200 hover:border-orange-500'
                                    }
                                `}
                            >
                                <span className="truncate mr-2">
                                    {system ? system.name : 'Chọn kho...'}
                                </span>
                                <ChevronDown
                                    size={18}
                                    className={`text-stone-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl shadow-xl shadow-stone-200/50 dark:shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto">
                                    {systems.map(s => (
                                        <button
                                            key={s.code}
                                            onClick={() => {
                                                setSelectedSystemCode(s.code)
                                                setIsDropdownOpen(false)
                                            }}
                                            className={`
                                                w-full text-left px-4 py-3 text-sm font-medium transition-colors flex items-center justify-between
                                                ${selectedSystemCode === s.code
                                                    ? 'bg-orange-50 text-orange-700'
                                                    : 'text-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                                                }
                                            `}
                                        >
                                            <span className="truncate">{s.name}</span>
                                            {selectedSystemCode === s.code && <Check size={16} className="text-orange-600" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            disabled={saving || !selectedSystemCode}
                            className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-6 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold hover:shadow-lg hover:shadow-orange-200 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                        >
                            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            <span>Lưu Cấu Hình</span>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="mt-4 md:mt-6">
                    {/* Search Input */}
                    <div className="relative w-full mb-4">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-orange-500/50" size={16} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm module..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-200 transition-all placeholder:text-stone-400"
                        />
                    </div>

                    {/* Filter Pills - Wrapped Layout */}
                    <div className="relative group">
                        <div className="flex flex-wrap gap-2 w-full pb-2">
                            <button
                                onClick={() => setActiveCategory('all')}
                                className={`
                                    px-3 py-2 rounded-xl text-xs font-bold transition-all border
                                    ${activeCategory === 'all'
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 border-transparent text-white shadow-md shadow-orange-200'
                                        : 'bg-white border-stone-200 text-stone-600 hover:border-orange-300 hover:bg-orange-50'
                                    }
                                `}
                            >
                                Tất cả
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`
                                        px-3 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap
                                        ${activeCategory === cat
                                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 border-transparent text-white shadow-md shadow-orange-200'
                                            : 'bg-white border-stone-200 text-stone-600 hover:border-orange-300 hover:bg-orange-50'
                                        }
                                    `}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {
                loading ? (
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
                )
            }
        </div >
    )
}
