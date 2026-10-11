'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, RefreshCw, Search, Check, X, AlertTriangle, ShieldCheck, Box, Layers, ArrowRightLeft } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import Link from 'next/link'
import { syncAppModulesWithCode } from '@/lib/module-sync'

interface AppModule {
    id: string
    name: string
    description: string | null
    category: string
    is_basic: boolean | null
}

const CATEGORY_MAP: Record<string, string> = {
    'inbound': 'Nhập kho',
    'outbound': 'Xuất kho',
    'lot': 'Quản lý LOT',
    'product': 'Sản phẩm',
    'dashboard': 'Dashboard',
    'utility': 'Tiện ích hệ thống',
    'info': 'Thông tin',
    'print': 'In ấn',
    'qr': 'Quét mã QR',
    'report': 'Báo cáo'
}

export default function ModulesPage() {
    const { showToast } = useToast()
    const [modules, setModules] = useState<AppModule[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [toggling, setToggling] = useState<string | null>(null)

    const [filterType, setFilterType] = useState<'all' | 'basic' | 'advanced'>('all')
    const [filterCategory, setFilterCategory] = useState<string>('all')

    // Get all unique categories for filter
    const allCategories = Array.from(new Set(modules.map(m => m.category))).sort()

    useEffect(() => {
        fetchModules(true) // Auto-sync on first load
    }, [])

    const fetchModules = async (autoSync = false) => {
        setLoading(true)
        try {
            if (autoSync) {
                // Tự động đồng bộ các module mới thêm trong code (mặc định là Cơ bản)
                try {
                    const syncResult = await syncAppModulesWithCode()
                    if (syncResult.inserted > 0) {
                        showToast(`Đã tự động bổ sung ${syncResult.inserted} module mới từ code với phân loại Cơ bản (Basic)`, 'info')
                    }
                } catch (syncErr) {
                    console.warn('Auto-sync skipped or failed:', syncErr)
                }
            }

            const { data, error } = await (supabase.from('app_modules' as any) as any)
                .select('*')
                .order('category', { ascending: true })
                .order('name', { ascending: true })

            if (error) throw error

            setModules(data || [])
        } catch (error: any) {
            console.error('Error fetching modules:', error)
            showToast('Lỗi tải danh sách modules: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleManualSync = async () => {
        setSyncing(true)
        try {
            const result = await syncAppModulesWithCode()
            await fetchModules(false)
            if (result.inserted > 0 || result.updated > 0) {
                showToast(`Đồng bộ thành công: Thêm mới ${result.inserted} module (Cơ bản), cập nhật ${result.updated} module.`, 'success')
            } else {
                showToast('Hệ thống modules đã đồng bộ đầy đủ với mã nguồn!', 'success')
            }
        } catch (error: any) {
            console.error('Manual sync failed:', error)
            showToast('Lỗi đồng bộ modules: ' + error.message, 'error')
        } finally {
            setSyncing(false)
        }
    }

    const handleToggleBasic = async (mod: AppModule) => {
        setToggling(mod.id)
        try {
            const newValue = !mod.is_basic // Toggle value
            const { error } = await (supabase.from('app_modules' as any) as any)
                .update({ is_basic: newValue })
                .eq('id', mod.id)

            if (error) throw error

            // Update local state
            setModules(prev => prev.map(m => m.id === mod.id ? { ...m, is_basic: newValue } : m))
            const typeText = newValue ? 'Cơ bản (Basic - Mặc định)' : 'Nâng cao (Advanced)'
            showToast(`Đã chuyển module "${mod.name}" sang ${typeText}`, 'success')
        } catch (error: any) {
            console.error('Error updating module:', error)
            showToast('Lỗi cập nhật module: ' + error.message, 'error')
        } finally {
            setToggling(null)
        }
    }

    const filteredModules = modules.filter(m => {
        // Hide core non-configurable modules
        if (['inbound_basic', 'inbound_supplier', 'outbound_basic', 'outbound_customer', 'warehouse_name', 'images'].includes(m.id)) return false

        const categoryText = CATEGORY_MAP[m.category] || m.category
        const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            categoryText.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.id.toLowerCase().includes(searchTerm.toLowerCase())

        if (!matchesSearch) return false

        if (filterType === 'basic') return m.is_basic
        if (filterType === 'advanced') return !m.is_basic

        if (filterCategory !== 'all' && m.category !== filterCategory) return false

        return true
    })

    // Group by category
    const groupedModules: Record<string, AppModule[]> = {}
    filteredModules.forEach(m => {
        if (!groupedModules[m.category]) groupedModules[m.category] = []
        groupedModules[m.category].push(m)
    })

    const categories = Object.keys(groupedModules).sort()

    const basicCount = modules.filter(m => m.is_basic).length
    const advancedCount = modules.filter(m => !m.is_basic).length

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                        <Layers className="text-orange-600" size={26} />
                        Quản lý Modules Hệ Thống
                    </h1>
                    <p className="text-stone-500 mt-1 text-sm font-medium">
                        Phân loại module <strong>Cơ bản (Basic)</strong> vs <strong>Nâng cao (Advanced)</strong>. Các module mới tạo mặc định là Cơ bản.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleManualSync}
                        disabled={syncing || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 hover:border-orange-500 text-stone-700 hover:text-orange-600 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        title="Đồng bộ tất cả modules từ mã nguồn hệ thống"
                    >
                        <RefreshCw size={16} className={syncing ? 'animate-spin text-orange-600' : ''} />
                        <span>{syncing ? 'Đang đồng bộ...' : 'Đồng bộ từ Code'}</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 mb-4 flex flex-col md:flex-row gap-4 items-center">
                {/* Search */}
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm module, mã ID, mô tả..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    />
                </div>

                {/* Type Filter */}
                <div className="flex p-1 bg-stone-100 rounded-xl w-full md:w-auto">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'all' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                        Tất cả ({modules.length})
                    </button>
                    <button
                        onClick={() => setFilterType('basic')}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${filterType === 'basic' ? 'bg-white text-orange-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                        <ShieldCheck size={16} className="text-orange-600" />
                        <span>Cơ bản ({basicCount})</span>
                    </button>
                    <button
                        onClick={() => setFilterType('advanced')}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${filterType === 'advanced' ? 'bg-white text-blue-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                        <AlertTriangle size={16} className="text-blue-600" />
                        <span>Nâng cao ({advancedCount})</span>
                    </button>
                </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-6">
                <button
                    onClick={() => setFilterCategory('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filterCategory === 'all' ? 'bg-orange-100 border-orange-200 text-orange-700' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}
                >
                    Tất cả danh mục
                </button>
                {allCategories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filterCategory === cat ? 'bg-orange-100 border-orange-200 text-orange-700' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}
                    >
                        {CATEGORY_MAP[cat] || cat}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <Loader2 className="animate-spin text-orange-500" size={36} />
                    <p className="text-stone-500 text-sm font-medium">Đang tải danh sách modules...</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {categories.length === 0 && (
                        <div className="flex flex-col items-center py-16 text-stone-500 bg-white dashed-border rounded-2xl border-2 border-stone-200 border-dashed">
                            <Box className="w-12 h-12 text-stone-300 mb-2" />
                            <p className="font-semibold">Không tìm thấy module nào phù hợp.</p>
                        </div>
                    )}

                    {categories.map(cat => (
                        <div key={cat} className="space-y-3">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-stone-600 uppercase tracking-wider ml-1">
                                <Box size={16} className="text-stone-400" />
                                <span>{CATEGORY_MAP[cat] || cat}</span>
                                <span className="bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full text-xs font-semibold">{groupedModules[cat].length}</span>
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {groupedModules[cat].map(mod => (
                                    <div
                                        key={mod.id}
                                        className={`
                                            group relative flex flex-col p-4 rounded-2xl border transition-all duration-200 h-full bg-white hover:shadow-md
                                            ${mod.is_basic
                                                ? 'border-orange-200 ring-1 ring-orange-100/60 hover:border-orange-300'
                                                : 'border-blue-200 ring-1 ring-blue-100/60 hover:border-blue-300'}
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            {/* Icon / Status */}
                                            <div className={`p-2 rounded-xl transition-colors ${mod.is_basic ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                                <Box size={18} />
                                            </div>

                                            {/* Toggle Switch */}
                                            <button
                                                onClick={() => handleToggleBasic(mod)}
                                                disabled={toggling === mod.id}
                                                className={`
                                                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1
                                                    ${mod.is_basic ? 'bg-orange-500 focus:ring-orange-500' : 'bg-blue-500 focus:ring-blue-500'}
                                                    ${toggling === mod.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                                `}
                                                title={mod.is_basic ? 'Đang là Cơ bản (Click để đổi sang Nâng cao)' : 'Đang là Nâng cao (Click để đổi sang Cơ bản)'}
                                            >
                                                <span
                                                    className={`${mod.is_basic ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200`}
                                                />
                                                {toggling === mod.id && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <Loader2 className="animate-spin text-white" size={10} />
                                                    </div>
                                                )}
                                            </button>
                                        </div>

                                        {/* Text Content */}
                                        <div className="flex-1">
                                            <h4 className="font-bold text-stone-900 text-[14px] mb-1 line-clamp-1" title={mod.name}>{mod.name}</h4>
                                            <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed min-h-[2.5em]">{mod.description || 'Chưa có mô tả cho module này'}</p>
                                        </div>

                                        {/* Footer Status */}
                                        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                                            {mod.is_basic ? (
                                                <div className="flex items-center gap-1 text-orange-600 font-bold text-xs">
                                                    <ShieldCheck size={14} />
                                                    <span>Cơ bản (Basic)</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-blue-600 font-bold text-xs">
                                                    <AlertTriangle size={14} />
                                                    <span>Nâng cao (Advanced)</span>
                                                </div>
                                            )}

                                            <code className="text-[10px] text-stone-400 font-mono bg-stone-50 px-1.5 py-0.5 rounded border border-stone-100">{mod.id}</code>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
