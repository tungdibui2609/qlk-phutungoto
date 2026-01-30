'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, Cog, Settings, ShieldCheck, Zap, Layers, Beaker } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { UTILITY_MODULES } from '@/lib/utility-modules'
import { useSystem } from '@/contexts/SystemContext'

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
    const { unlockedModules } = useSystem()

    const [config, setConfig] = useState<Record<string, string[]>>({})

    useEffect(() => {
        fetchSystems()
    }, [])

    async function fetchSystems() {
        setLoading(true)
        const { data, error } = await (supabase.from('systems') as any).select('code, name, modules').order('created_at')
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
            setConfig(configMap)
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
        const utilityMods = config[sysCode] || []

        const currentSystem = systems.find(s => s.code === sysCode)
        const currentModules = (currentSystem?.modules && typeof currentSystem.modules === 'object')
            ? { ...currentSystem.modules }
            : {}

        const { error } = await (supabase.from('systems') as any)
            .update({
                modules: {
                    ...currentModules,
                    utility_modules: utilityMods
                }
            })
            .eq('code', sysCode)

        if (error) {
            showToast('Lỗi lưu cấu hình: ' + error.message, 'error')
        } else {
            showToast('Đã lưu cấu hình cho kho ' + sysCode, 'success')
            fetchSystems()
        }
        setSaving(null)
    }

    const applyPreset = (sysCode: string, type: 'basic' | 'standard' | 'full') => {
        let presetIds: string[] = []
        if (type === 'basic') {
            presetIds = [] // Basic modules are forced ON anyway
        } else if (type === 'standard') {
            presetIds = ['lot_accounting_sync', 'auto_unbundle_lot']
        } else if (type === 'full') {
            presetIds = UTILITY_MODULES.map(m => m.id)
        }

        setConfig(prev => ({
            ...prev,
            [sysCode]: presetIds
        }))
    }

    if (loading) return <div className="text-center py-20 text-gray-400 font-serif italic">Đang tải cấu hình tiện ích...</div>

    return (
        <div className="space-y-12 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Tiện ích Bổ sung</h2>
                    <p className="text-gray-500 font-medium text-sm">Cấu hình các module tự động hóa và đồng bộ cho từng kho hàng.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-12">
                {systems.map(sys => (
                    <div key={sys.code} className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-2xl shadow-gray-100 overflow-hidden relative group">
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-10 relative z-10">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-stone-900 text-white rounded-xl">
                                        <Cog size={20} />
                                    </div>
                                    <h3 className="text-xl font-black text-gray-800 tracking-tight">{sys.name}</h3>
                                </div>
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-11">Mã kho: {sys.code}</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="bg-gray-50 p-1 rounded-xl border border-gray-100 flex items-center gap-1 mr-4">
                                    <button onClick={() => applyPreset(sys.code, 'basic')} className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg hover:bg-white hover:shadow-sm transition-all text-gray-400 hover:text-gray-600">Gói Cơ bản</button>
                                    <button onClick={() => applyPreset(sys.code, 'standard')} className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg hover:bg-white hover:shadow-sm transition-all text-gray-400 hover:text-gray-600">Gói Tiêu chuẩn</button>
                                    <button onClick={() => applyPreset(sys.code, 'full')} className="px-3 py-1.5 text-[10px] font-black uppercase bg-stone-900 text-white rounded-lg shadow-lg">Gói Đầy đủ</button>
                                </div>

                                <button
                                    onClick={() => handleSave(sys.code)}
                                    disabled={saving === sys.code}
                                    className="flex items-center gap-2 px-8 py-3 bg-stone-900 text-white rounded-2xl hover:bg-black transition-all disabled:opacity-50 font-black text-sm shadow-xl shadow-stone-200"
                                >
                                    {saving === sys.code ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                    Lưu Cấu Hình
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                            {UTILITY_MODULES
                                .filter(mod => unlockedModules.includes(mod.id))
                                .filter(mod => !mod.is_basic)
                                .map(mod => {
                                    const isSelected = config[sys.code]?.includes(mod.id)
                                    const ModIcon = mod.icon

                                    return (
                                        <div
                                            key={mod.id}
                                            onClick={() => toggleModule(sys.code, mod.id)}
                                            className={`
                                            group flex flex-col p-6 rounded-3xl border-2 transition-all cursor-pointer h-full relative overflow-hidden
                                            ${isSelected
                                                    ? 'bg-stone-50 border-stone-900 shadow-xl shadow-stone-100'
                                                    : 'bg-white border-transparent hover:border-gray-200 text-gray-400 shadow-sm'
                                                }
                                        `}
                                        >
                                            <div className="flex justify-between items-start mb-6">
                                                <div className={`p-3 rounded-2xl ${isSelected ? 'bg-stone-900 text-white' : 'bg-gray-100 text-gray-400 group-hover:text-gray-600 group-hover:bg-gray-200 transition-colors'}`}>
                                                    <ModIcon size={24} />
                                                </div>
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-stone-900 border-stone-900 scale-110' : 'border-gray-200 bg-white'}`}>
                                                    {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                            </div>

                                            <div className="flex-1">
                                                <h4 className={`font-black text-sm mb-2 uppercase tracking-tight transition-colors ${isSelected ? 'text-stone-900' : 'text-gray-700'}`}>
                                                    {mod.name}
                                                </h4>
                                                <p className={`text-xs leading-relaxed font-medium transition-colors ${isSelected ? 'text-stone-600' : 'text-gray-400'}`}>
                                                    {mod.description}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>

                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-stone-50 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                ))}
            </div>
        </div>
    )
}
