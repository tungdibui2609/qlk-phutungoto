'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, Search, Check, X, AlertTriangle, ShieldCheck, Box } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import Link from 'next/link'

interface AppModule {
    id: string
    name: string
    description: string | null
    category: string
    is_basic: boolean | null // Can be null in DB types, though default false
}

const CATEGORY_MAP: Record<string, string> = {
    'info': 'Thông tin',
    'utility': 'Tiện ích hệ thống'
}

export default function ModulesPage() {
    const { showToast } = useToast()
    const [modules, setModules] = useState<AppModule[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [toggling, setToggling] = useState<string | null>(null)

    const [filterType, setFilterType] = useState<'all' | 'basic' | 'advanced'>('all')
    const [filterCategory, setFilterCategory] = useState<string>('all')

    // Get all unique categories for filter
    const allCategories = Array.from(new Set(modules.map(m => m.category))).sort()

    useEffect(() => {
        fetchModules()
    }, [])

    const fetchModules = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('app_modules')
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

    const handleToggleBasic = async (mod: AppModule) => {
        setToggling(mod.id)
        try {
            const newValue = !mod.is_basic // Toggle value
            const { error } = await supabase
                .from('app_modules')
                .update({ is_basic: newValue })
                .eq('id', mod.id)

            if (error) throw error

            // Update local state
            setModules(prev => prev.map(m => m.id === mod.id ? { ...m, is_basic: newValue } : m))
            const typeText = newValue ? 'Mặc định (Basic)' : 'Nâng cao (Advanced)'
            showToast(`Đã chuyển module "${mod.name}" sang nhóm ${typeText}`, 'success')
        } catch (error: any) {
            console.error('Error updating module:', error)
            showToast('Lỗi cập nhật module: ' + error.message, 'error')
        } finally {
            setToggling(null)
        }
    }

    const filteredModules = modules.filter(m => {
        // [NEW] Hide core modules from Admin List as they are not togglable
        if (['inbound_basic', 'inbound_supplier', 'outbound_basic', 'outbound_customer', 'warehouse_name', 'images'].includes(m.id)) return false

        const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.category.toLowerCase().includes(searchTerm.toLowerCase())

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

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-stone-900 tracking-tight">Quản lý Modules Hệ thống</h1>
                    <p className="text-stone-500 mt-2 font-medium">Cấu hình phân loại module (Basic vs Advanced)</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 mb-4 flex flex-col md:flex-row gap-4 items-center">
                {/* Search */}
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm tên, mô tả..."
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
                        Tất cả
                    </button>
                    <button
                        onClick={() => setFilterType('basic')}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${filterType === 'basic' ? 'bg-white text-orange-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                        <ShieldCheck size={16} /> Basic
                    </button>
                    <button
                        onClick={() => setFilterType('advanced')}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${filterType === 'advanced' ? 'bg-white text-blue-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                        <AlertTriangle size={16} /> Advanced
                    </button>
                </div>
            </div>

            {/* Category Filter - Separate Row */}
            <div className="flex flex-wrap gap-2 mb-8">
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
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-orange-500" size={40} />
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
                            <h3 className="flex items-center gap-2 text-sm font-bold text-stone-500 uppercase tracking-wider ml-1">
                                <Box size={16} /> {CATEGORY_MAP[cat] || cat}
                                <span className="bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full text-xs">{groupedModules[cat].length}</span>
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                                {groupedModules[cat].map(mod => (
                                    <div
                                        key={mod.id}
                                        className={`
                                            group relative flex flex-col p-5 rounded-2xl border transition-all duration-200 h-full bg-white hover:shadow-lg
                                            ${mod.is_basic
                                                ? 'border-orange-200 ring-1 ring-orange-100 hover:border-orange-300'
                                                : 'border-blue-200 ring-1 ring-blue-100 hover:border-blue-300'}
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            {/* Icon */}
                                            <div className={`p-2.5 rounded-xl transition-colors ${mod.is_basic ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                                <Box size={20} />
                                            </div>

                                            {/* Toggle Switch */}
                                            <button
                                                onClick={() => handleToggleBasic(mod)}
                                                disabled={toggling === mod.id}
                                                className={`
                                                    relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1
                                                    ${mod.is_basic ? 'bg-orange-500 focus:ring-orange-500' : 'bg-blue-500 focus:ring-blue-500'}
                                                    ${toggling === mod.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                                `}
                                                title={mod.is_basic ? 'Đang ở chế độ Mặc định' : 'Đang ở chế độ Nâng cao'}
                                            >
                                                <span
                                                    className={`${mod.is_basic ? 'translate-x-6' : 'translate-x-1'} inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200`}
                                                />
                                                {toggling === mod.id && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <Loader2 className="animate-spin text-orange-600" size={12} />
                                                    </div>
                                                )}
                                            </button>
                                        </div>

                                        {/* Text Content */}
                                        <div className="flex-1">
                                            <h4 className="font-bold text-stone-900 text-[15px] mb-1 line-clamp-1" title={mod.name}>{mod.name}</h4>
                                            <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed min-h-[2.5em]">{mod.description || 'Chưa có mô tả cho module này'}</p>
                                        </div>

                                        {/* Footer Status */}
                                        <div className="mt-4 pt-3 border-t border-stone-50 flex items-center justify-between">
                                            {mod.is_basic ? (
                                                <div className="flex items-center gap-1.5 text-orange-600 animate-in fade-in duration-300">
                                                    <ShieldCheck size={14} />
                                                    <span className="text-xs font-bold">Mặc định</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-blue-600 animate-in fade-in duration-300">
                                                    <AlertTriangle size={14} />
                                                    <span className="text-xs font-bold">Nâng cao</span>
                                                </div>
                                            )}

                                            <code className="text-[10px] text-stone-300 font-mono">{mod.id}</code>
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
