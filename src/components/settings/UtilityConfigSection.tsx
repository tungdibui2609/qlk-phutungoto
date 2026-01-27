'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, Sparkles } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { UTILITY_MODULES } from '@/lib/utility-modules'

interface System {
    code: string
    name: string
    modules: any | null
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Quản lý Tiện ích</h2>
                    <p className="text-sm text-gray-500">Bật/tắt các tính năng nâng cao cho từng phân hệ kho.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {systems.map(sys => (
                    <div key={sys.code} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    <Sparkles size={20} className="text-orange-500" />
                                    {sys.name}
                                </h3>
                                <p className="text-sm text-gray-500">Mã: {sys.code}</p>
                            </div>
                            <button
                                onClick={() => handleSave(sys.code)}
                                disabled={saving === sys.code}
                                className="flex items-center gap-2 px-4 py-2 bg-stone-900 dark:bg-orange-600 text-white rounded-lg hover:bg-stone-800 dark:hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm font-bold"
                            >
                                {saving === sys.code ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                Lưu cài đặt
                            </button>
                        </div>

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
                                        <div className={`p-2 rounded-lg ${isSelected ? `bg-white dark:bg-slate-800 text-${activeColor}-600 shadow-sm` : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}>
                                            <ModIcon size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <h4 className={`font-bold text-sm ${isSelected ? `text-${activeColor}-900 dark:text-${activeColor}-400` : 'text-gray-700 dark:text-gray-300'}`}>
                                                    {mod.name}
                                                </h4>
                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? `bg-${activeColor}-500 border-${activeColor}-500` : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                                                    }`}>
                                                    {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed font-medium">{mod.description}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
