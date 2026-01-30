'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, Package } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { PRODUCT_MODULES } from '@/lib/product-modules'
import { useSystem } from '@/contexts/SystemContext'

interface System {
    code: string
    name: string
    modules: string[] | null
}

export default function ProductConfigSection() {
    const [systems, setSystems] = useState<System[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const { showToast } = useToast()
    const { unlockedModules } = useSystem()

    // Local state to track changes before saving
    // key: system_code, value: list of module_ids
    const [config, setConfig] = useState<Record<string, string[]>>({})

    useEffect(() => {
        fetchSystems()
    }, [])

    async function fetchSystems() {
        setLoading(true)
        const { data, error } = await (supabase.from('systems') as any).select('code, name, modules').order('created_at')
        if (error) {
            showToast('Lỗi tải danh sách kho: ' + error.message, 'error')
        } else {
            setSystems(data || [])
            // Initialize config state
            const initialConfig: Record<string, string[]> = {}
            data?.forEach((s: any) => {
                let mods: string[] = []
                if (Array.isArray(s.modules)) {
                    mods = s.modules
                } else if (typeof s.modules === 'string') {
                    try { mods = JSON.parse(s.modules) } catch (e) { mods = [] }
                }
                initialConfig[s.code] = mods
            })
            setConfig(initialConfig)
        }
        setLoading(false)
    }

    const toggleModule = (sysCode: string, modId: string) => {
        const currentMods = config[sysCode] || []
        const exists = currentMods.includes(modId)

        let newMods
        if (exists) {
            newMods = currentMods.filter(m => m !== modId)
        } else {
            newMods = [...currentMods, modId]
        }

        setConfig(prev => ({
            ...prev,
            [sysCode]: newMods
        }))
    }

    const handleSave = async (sysCode: string) => {
        setSaving(sysCode)
        const modulesToSave = config[sysCode] || []

        const { error } = await (supabase.from('systems') as any)
            .update({ modules: modulesToSave })
            .eq('code', sysCode)

        if (error) {
            showToast('Lỗi lưu cấu hình: ' + error.message, 'error')
        } else {
            showToast('Đã lưu cấu hình cho kho ' + sysCode, 'success')
        }
        setSaving(null)
    }

    if (loading) return <div className="text-center py-10 text-gray-500">Đang tải cấu hình...</div>

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Cấu hình Module Sản phẩm cho từng Kho</h2>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {systems.map(sys => (
                    <div key={sys.code} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Package size={20} className="text-orange-500" />
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
                            {PRODUCT_MODULES
                                .filter(mod => unlockedModules.includes(mod.id))
                                .filter(mod => unlockedModules.includes(mod.id))
                                .filter(mod => !mod.is_basic) // Default/Basic modules are hidden from User Settings
                                .map(mod => {
                                    const isSelected = config[sys.code]?.includes(mod.id)
                                    const ModIcon = mod.icon

                                    return (
                                        <div
                                            key={mod.id}
                                            onClick={() => toggleModule(sys.code, mod.id)}
                                            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isSelected
                                                ? 'border-orange-500 bg-orange-50/50'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-white text-orange-600 shadow-sm' : 'bg-gray-100 text-gray-500'}`}>
                                                <ModIcon size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <h4 className={`font-semibold ${isSelected ? 'text-orange-900' : 'text-gray-700'}`}>
                                                        {mod.name}
                                                    </h4>
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300 bg-white'
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
