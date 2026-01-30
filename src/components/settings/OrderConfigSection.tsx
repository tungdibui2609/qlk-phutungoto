'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, ShoppingCart, ShoppingBag } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { INBOUND_MODULES, OUTBOUND_MODULES } from '@/lib/order-modules'
import { useSystem } from '@/contexts/SystemContext'

interface System {
    code: string
    name: string
    inbound_modules: string[] | null
    outbound_modules: string[] | null
}

export default function OrderConfigSection() {
    const [systems, setSystems] = useState<System[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const { showToast } = useToast()
    const { unlockedModules } = useSystem()

    const [inboundConfig, setInboundConfig] = useState<Record<string, string[]>>({})
    const [outboundConfig, setOutboundConfig] = useState<Record<string, string[]>>({})

    useEffect(() => {
        fetchSystems()
    }, [])

    async function fetchSystems() {
        setLoading(true)
        const { data, error } = await (supabase.from('systems') as any).select('code, name, inbound_modules, outbound_modules').order('created_at')
        if (error) {
            showToast('Lỗi tải danh sách kho: ' + error.message, 'error')
        } else {
            const systemsList = data || []
            const inboundMap: Record<string, string[]> = {}
            const outboundMap: Record<string, string[]> = {}

            systemsList.forEach((sys: any) => {
                let inMods: string[] = []
                let outMods: string[] = []

                if (Array.isArray(sys.inbound_modules)) {
                    inMods = sys.inbound_modules
                } else if (typeof sys.inbound_modules === 'string') {
                    try { inMods = JSON.parse(sys.inbound_modules) } catch (e) { inMods = [] }
                }

                if (Array.isArray(sys.outbound_modules)) {
                    outMods = sys.outbound_modules
                } else if (typeof sys.outbound_modules === 'string') {
                    try { outMods = JSON.parse(sys.outbound_modules) } catch (e) { outMods = [] }
                }

                inboundMap[sys.code] = inMods
                outboundMap[sys.code] = outMods
            })

            setSystems(systemsList as any)
            setInboundConfig(inboundMap)
            setOutboundConfig(outboundMap)
        }
        setLoading(false)
    }

    const toggleModule = (sysCode: string, modId: string, type: 'inbound' | 'outbound') => {
        const config = type === 'inbound' ? inboundConfig : outboundConfig
        const setConfig = type === 'inbound' ? setInboundConfig : setOutboundConfig

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
        const inboundMods = inboundConfig[sysCode] || []
        const outboundMods = outboundConfig[sysCode] || []

        const { error } = await (supabase.from('systems') as any)
            .update({
                inbound_modules: inboundMods,
                outbound_modules: outboundMods
            })
            .eq('code', sysCode)

        if (error) {
            showToast('Lỗi lưu cấu hình: ' + error.message, 'error')
        } else {
            showToast('Đã lưu cấu hình cho kho ' + sysCode, 'success')
        }
        setSaving(null)
    }

    if (loading) return <div className="text-center py-10 text-gray-500">Đang tải cấu hình...</div>

    const renderConfigs = (sys: System, type: 'inbound' | 'outbound') => {
        const modules = type === 'inbound' ? INBOUND_MODULES : OUTBOUND_MODULES
        const config = type === 'inbound' ? inboundConfig : outboundConfig
        const Icon = type === 'inbound' ? ShoppingCart : ShoppingBag
        const title = type === 'inbound' ? 'Module Nhập kho' : 'Module Xuất kho'

        return (
            <div className="space-y-4">
                <h4 className="flex items-center gap-2 font-bold text-gray-700">
                    <Icon size={18} />
                    {title}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {modules
                        .filter(mod => unlockedModules.includes(mod.id))
                        .filter(mod => !mod.is_basic) // Default/Basic modules are hidden from User Settings
                        .map(mod => {
                            const isSelected = config[sys.code]?.includes(mod.id)
                            const ModIcon = mod.icon

                            return (
                                <div
                                    key={mod.id}
                                    onClick={() => toggleModule(sys.code, mod.id, type)}
                                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isSelected
                                        ? 'border-stone-900 bg-stone-50'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-stone-900 text-white shadow-sm' : 'bg-gray-100 text-gray-500'}`}>
                                        <ModIcon size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className={`font-semibold text-sm ${isSelected ? 'text-stone-900' : 'text-gray-700'}`}>
                                                {mod.name}
                                            </h4>
                                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-stone-900 border-stone-900' : 'border-gray-300 bg-white'
                                                }`}>
                                                {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 leading-relaxed">{mod.description}</p>
                                    </div>
                                </div>
                            )
                        })}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Cấu hình Module Đơn hàng cho từng Kho</h2>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {systems.map(sys => (
                    <div key={sys.code} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">{sys.name}</h3>
                                <p className="text-sm text-gray-500">Mã kho: {sys.code}</p>
                            </div>
                            <button
                                onClick={() => handleSave(sys.code)}
                                disabled={saving === sys.code}
                                className="flex items-center gap-2 px-6 py-2 bg-stone-900 text-white rounded-xl hover:bg-black transition-all disabled:opacity-50 text-sm font-bold shadow-lg shadow-stone-200"
                            >
                                {saving === sys.code ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                Lưu cấu hình
                            </button>
                        </div>

                        <div className="space-y-8">
                            {renderConfigs(sys, 'inbound')}
                            <div className="border-t border-gray-100 italic" />
                            {renderConfigs(sys, 'outbound')}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
