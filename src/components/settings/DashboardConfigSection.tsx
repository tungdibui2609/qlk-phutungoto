'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, LayoutDashboard } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { DASHBOARD_MODULES } from '@/lib/dashboard-modules'
import { useSystem } from '@/contexts/SystemContext'

interface System {
    code: string
    name: string
    dashboard_modules: string[] | null
}

export default function DashboardConfigSection() {
    const [systems, setSystems] = useState<System[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const { showToast } = useToast()
    const { unlockedModules } = useSystem()

    const [dashboardConfig, setDashboardConfig] = useState<Record<string, string[]>>({})

    useEffect(() => {
        fetchSystems()
    }, [])

    async function fetchSystems() {
        setLoading(true)
        const { data: systemsData, error: sysError } = await (supabase.from('systems') as any).select('code, name, dashboard_modules').order('created_at')

        if (sysError) {
            showToast('Lỗi tải danh sách kho: ' + sysError.message, 'error')
        } else {
            const systemsList = systemsData || []
            const configMap: Record<string, string[]> = {}

            systemsList.forEach((sys: any) => {
                let mods: string[] = []

                if (Array.isArray(sys.dashboard_modules)) {
                    mods = sys.dashboard_modules
                } else if (typeof sys.dashboard_modules === 'string') {
                    try { mods = JSON.parse(sys.dashboard_modules) } catch (e) { mods = [] }
                }

                configMap[sys.code] = mods
            })

            setSystems(systemsList as any)
            setDashboardConfig(configMap)
        }
        setLoading(false)
    }

    const toggleModule = (sysCode: string, modId: string) => {
        const currentMods = dashboardConfig[sysCode] || []
        const exists = currentMods.includes(modId)

        let newMods
        if (exists) {
            newMods = currentMods.filter(m => m !== modId)
        } else {
            newMods = [...currentMods, modId]
        }

        setDashboardConfig(prev => ({
            ...prev,
            [sysCode]: newMods
        }))
    }

    const handleSave = async (sysCode: string) => {
        setSaving(sysCode)
        const mods = dashboardConfig[sysCode] || []

        const { error } = await (supabase.from('systems') as any)
            .update({ dashboard_modules: mods })
            .eq('code', sysCode)

        if (error) {
            showToast('Lỗi lưu cấu hình: ' + error.message, 'error')
        } else {
            showToast('Đã lưu cấu hình cho kho ' + sysCode, 'success')
        }
        setSaving(null)
    }

    if (loading) return <div className="text-center py-10 text-gray-500">Đang tải cấu hình dashboard...</div>

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-lg font-medium text-gray-900">Module Dashboard</h2>
                    <p className="text-sm text-gray-500">Tùy chỉnh các khối thông tin hiển thị trên trang Dashboard cho từng kho.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {systems.map(sys => (
                    <div key={sys.code} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <LayoutDashboard size={20} className="text-orange-500" />
                                    {sys.name}
                                </h3>
                                <p className="text-sm text-gray-500">Mã kho: {sys.code}</p>
                            </div>
                            <button
                                onClick={() => handleSave(sys.code)}
                                disabled={saving === sys.code}
                                className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50 text-sm font-bold shadow-lg shadow-stone-100"
                            >
                                {saving === sys.code ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                Lưu cấu hình
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {DASHBOARD_MODULES
                                .filter(mod => unlockedModules.includes(mod.id))
                                .filter(mod => !mod.is_basic)
                                .map(mod => {
                                    const isSelected = dashboardConfig[sys.code]?.includes(mod.id)
                                    const ModIcon = mod.icon

                                    return (
                                        <div
                                            key={mod.id}
                                            onClick={() => toggleModule(sys.code, mod.id)}
                                            className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all ${isSelected
                                                ? 'border-orange-500 bg-orange-50/50 shadow-md shadow-orange-100/50'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                                                }`}
                                        >
                                            <div className={`p-3 rounded-xl ${isSelected ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-gray-100 text-gray-400'}`}>
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
