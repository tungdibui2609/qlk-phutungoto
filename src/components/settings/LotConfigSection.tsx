'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, Settings } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { LOT_MODULES } from '@/lib/lot-modules'
import { Database } from '@/lib/database.types'

interface System {
    code: string
    name: string
    lot_modules: string[] | null
}

export default function LotConfigSection() {
    const [systems, setSystems] = useState<System[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const { showToast } = useToast()

    // Local state to track changes before saving
    // key: system_code, value: list of module_ids
    const [lotConfig, setLotConfig] = useState<Record<string, string[]>>({})

    useEffect(() => {
        fetchSystems()
    }, [])

    async function fetchSystems() {
        setLoading(true)
        const { data: systemsData, error: sysError } = await (supabase.from('systems') as any).select('code, name').order('created_at')
        const { data: configsData, error: configError } = await (supabase.from('system_configs') as any).select('*')

        if (sysError) {
            showToast('Lỗi tải danh sách kho: ' + sysError.message, 'error')
        } else {
            const systemsList = systemsData || []

            // Map configs
            const configMap: Record<string, string[]> = {}

            systemsList.forEach((sys: any) => {
                const config = configsData?.find((c: any) => c.system_code === sys.code)
                let mods: string[] = []

                if (config) {
                    if (Array.isArray(config.lot_modules)) mods = config.lot_modules
                    else if (typeof config.lot_modules === 'string') {
                        try { mods = JSON.parse(config.lot_modules) } catch (e) { mods = [] }
                    }
                }

                configMap[sys.code] = mods
            })

            setSystems(systemsList as any)
            setLotConfig(configMap)
        }
        setLoading(false)
    }

    const toggleModule = (sysCode: string, modId: string) => {
        const currentMods = lotConfig[sysCode] || []
        const exists = currentMods.includes(modId)

        let newMods
        if (exists) {
            newMods = currentMods.filter(m => m !== modId)
        } else {
            newMods = [...currentMods, modId]
        }

        setLotConfig(prev => ({
            ...prev,
            [sysCode]: newMods
        }))
    }

    const handleSave = async (sysCode: string) => {
        setSaving(sysCode)
        const mods = lotConfig[sysCode] || []

        // Upsert system_configs
        const { error } = await (supabase
            .from('system_configs') as any)
            .upsert({
                system_code: sysCode,
                lot_modules: mods
            }, { onConflict: 'system_code' })

        if (error) {
            showToast('Lỗi lưu cấu hình: ' + error.message, 'error')
        } else {
            showToast('Đã lưu cấu hình cho kho ' + sysCode, 'success')
        }
        setSaving(null)
    }

    if (loading) return <div className="text-center py-10 text-gray-500">Đang tải cấu hình...</div>

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-lg font-medium text-gray-900">Cấu hình LOT</h2>
                    <p className="text-sm text-gray-500">Tùy chỉnh thông tin hiển thị trên LOT cho từng kho.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {systems.map(sys => (
                    <div key={sys.code} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Settings size={20} className="text-emerald-500" />
                                    {sys.name}
                                </h3>
                                <p className="text-sm text-gray-500">Mã kho: {sys.code}</p>
                            </div>
                            <button
                                onClick={() => handleSave(sys.code)}
                                disabled={saving === sys.code}
                                className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50"
                            >
                                {saving === sys.code ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                Lưu cấu hình
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {LOT_MODULES.map(mod => {
                                const isSelected = lotConfig[sys.code]?.includes(mod.id)
                                const ModIcon = mod.icon
                                const activeColor = 'emerald'

                                return (
                                    <div
                                        key={mod.id}
                                        onClick={() => toggleModule(sys.code, mod.id)}
                                        className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isSelected
                                            ? `border-${activeColor}-500 bg-${activeColor}-50/50`
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg ${isSelected ? `bg-white text-${activeColor}-600 shadow-sm` : 'bg-gray-100 text-gray-500'}`}>
                                            <ModIcon size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <h4 className={`font-semibold ${isSelected ? `text-${activeColor}-900` : 'text-gray-700'}`}>
                                                    {mod.name}
                                                </h4>
                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? `bg-${activeColor}-500 border-${activeColor}-500` : 'border-gray-300 bg-white'
                                                    }`}>
                                                    {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-500 leading-relaxed">{mod.description}</p>
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
