'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, Sparkles, Check, Info } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { UTILITY_MODULES, SOLUTION_PRESETS, SolutionPreset, ModuleCategory } from '@/lib/utility-modules'

interface System {
    code: string
    name: string
    modules: any | null
}

const CATEGORY_NAMES: Record<ModuleCategory, string> = {
    'core': 'Nghiệp vụ Cốt lõi',
    'automation': 'Tự động hóa & Xử lý',
    'specialized': 'Nghiệp vụ Đặc thù'
}

export default function UtilityConfigSection() {
    const [systems, setSystems] = useState<System[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const { showToast } = useToast()

    const [utilityConfig, setUtilityConfig] = useState<Record<string, string[]>>({})

    useEffect(() => {
        fetchSystems()
    }, [])

    async function fetchSystems() {
        setLoading(true)
        const { data, error } = await supabase
            .from('systems')
            .select('code, name, modules')
            .order('sort_order')

        if (error) {
            showToast('Lỗi tải danh sách phân hệ: ' + error.message, 'error')
        } else {
            const systemsList = data || []
            const configMap: Record<string, string[]> = {}

            systemsList.forEach((sys: any) => {
                let mods: string[] = []
                if (sys.modules && typeof sys.modules === 'object') {
                    mods = sys.modules.utility_modules || []
                }
                configMap[sys.code] = mods
            })

            setSystems(systemsList as any)
            setUtilityConfig(configMap)
        }
        setLoading(false)
    }

    const toggleModule = (sysCode: string, modId: string) => {
        const currentMods = utilityConfig[sysCode] || []
        const exists = currentMods.includes(modId)

        let newMods
        if (exists) {
            newMods = currentMods.filter(m => m !== modId)
        } else {
            newMods = [...currentMods, modId]
        }

        setUtilityConfig(prev => ({
            ...prev,
            [sysCode]: newMods
        }))
    }

    const applyPreset = (sysCode: string, preset: SolutionPreset) => {
        // Merge preset modules with existing ones, or replace?
        // Usually presets are "starters". Let's enable all recommended ones.
        const currentMods = utilityConfig[sysCode] || []
        const newMods = Array.from(new Set([...currentMods, ...preset.recommended_modules]))

        setUtilityConfig(prev => ({
            ...prev,
            [sysCode]: newMods
        }))
        showToast(`Đã áp dụng gói ${preset.name}`, 'success')
    }

    const handleSave = async (sysCode: string) => {
        setSaving(sysCode)
        const mods = utilityConfig[sysCode] || []

        // Fetch current modules to preserve other keys
        const { data: currentSystem } = await supabase
            .from('systems')
            .select('modules')
            .eq('code', sysCode)
            .single()

        const newModules = {
            ...(currentSystem?.modules as any || {}),
            utility_modules: mods
        }

        const { error } = await supabase
            .from('systems')
            .update({ modules: newModules })
            .eq('code', sysCode)

        if (error) {
            showToast('Lỗi lưu cấu hình: ' + error.message, 'error')
        } else {
            showToast('Đã lưu cấu hình tiện ích cho ' + sysCode, 'success')
        }
        setSaving(null)
    }

    if (loading) return <div className="text-center py-10 text-gray-500">Đang tải cấu hình tiện ích...</div>

    // Group modules by category
    const groupedModules = UTILITY_MODULES.reduce((acc, mod) => {
        if (!acc[mod.category]) acc[mod.category] = []
        acc[mod.category].push(mod)
        return acc
    }, {} as Record<ModuleCategory, typeof UTILITY_MODULES>)

    const categories: ModuleCategory[] = ['core', 'automation', 'specialized']

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Quản lý Tiện ích & Tính năng</h2>
                    <p className="text-sm text-gray-500">Kích hoạt các tính năng phù hợp với mô hình vận hành của kho.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-10">
                {systems.map(sys => (
                    <div key={sys.code} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    <Sparkles size={20} className="text-orange-500" />
                                    {sys.name}
                                </h3>
                                <p className="text-xs text-gray-500 font-mono mt-1">Mã hệ thống: {sys.code}</p>
                            </div>
                            <button
                                onClick={() => handleSave(sys.code)}
                                disabled={saving === sys.code}
                                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-all disabled:opacity-50 text-sm font-bold shadow-md shadow-orange-200 dark:shadow-none active:scale-95"
                            >
                                {saving === sys.code ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                Lưu thay đổi
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {UTILITY_MODULES.map(mod => {
                                    const isSelected = utilityConfig[sys.code]?.includes(mod.id)
                                    const ModIcon = mod.icon
                                    const activeColor = 'orange'

                                    return (
                                        <div
                                            key={mod.id}
                                            onClick={() => toggleModule(sys.code, mod.id)}
                                            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isSelected
                                                ? `border-${activeColor}-500 bg-${activeColor}-50/50 dark:bg-${activeColor}-900/10`
                                                : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50'
                                                }`}
                                        >
                                            <div className={`p-2 rounded-lg shrink-0 ${isSelected ? `bg-white dark:bg-slate-800 text-${activeColor}-600 shadow-sm` : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}>
                                                <ModIcon size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <h4 className={`font-bold text-sm truncate ${isSelected ? `text-${activeColor}-900 dark:text-${activeColor}-400` : 'text-gray-700 dark:text-gray-300'}`}>
                                                        {mod.name}
                                                    </h4>
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${isSelected ? `bg-${activeColor}-500 border-${activeColor}-500` : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                                                        }`}>
                                                        {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                                    </div>
                                                </div>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed font-medium">{mod.description}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
