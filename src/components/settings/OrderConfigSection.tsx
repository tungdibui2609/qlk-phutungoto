'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, ShoppingCart, Truck, FileText, Settings, Info } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { INBOUND_MODULES, OUTBOUND_MODULES, OrderModule } from '@/lib/order-modules'

interface System {
    code: string
    name: string
    modules: string[] | null // Product modules
    inbound_modules: string[] | null
    outbound_modules: string[] | null
}

export default function OrderConfigSection() {
    const [systems, setSystems] = useState<System[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const { showToast } = useToast()
    const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>('inbound')

    // Local state to track changes before saving
    // key: system_code, value: list of module_ids
    const [inboundConfig, setInboundConfig] = useState<Record<string, string[]>>({})
    const [outboundConfig, setOutboundConfig] = useState<Record<string, string[]>>({})

    useEffect(() => {
        fetchSystems()
    }, [])

    async function fetchSystems() {
        setLoading(true)
        // Note: Currently we are using 'systems' table, but the proposal mentioned 'system_configs'
        // Let's first check if we need to query 'systems' or 'system_configs'
        // Assuming 'systems' is the main table used in ProductConfigSection, let's stick to it for consistency
        // or check if we need to JOIN 'system_configs'.
        // Based on previous context, user approved adding columns to `system_configs`.
        // BUT, `ProductConfigSection` uses `systems` table directly.
        // Let's check where `systems` data comes from. ProductConfigSection uses `supabase.from('systems')...`
        // If the migration used `system_configs`, we might have a mismatch.
        // Let's assume the user wants it on the `systems` table for simplicity OR `system_configs` is linked.
        // Wait, the migration added columns to `system_configs`.
        // Let's try to fetch from `system_configs` grouped by system_code if possible, OR fetch `systems` and join/lookup `system_configs`.

        // Actually, let's fetch both to be safe, or check if they are the same concept in this specific codebase.
        // Ideally, we should use the same table structure. If `systems` has product modules, maybe `system_configs` is better for extension?
        // Let's try to fetch `system_configs` first.

        const { data: systemsData, error: sysError } = await (supabase.from('systems') as any).select('code, name').order('created_at')
        const { data: configsData, error: configError } = await (supabase.from('system_configs') as any).select('*')

        if (sysError) {
            showToast('Lỗi tải danh sách kho: ' + sysError.message, 'error')
        } else {
            const systemsList = systemsData || []

            // Map configs
            const inboundMap: Record<string, string[]> = {}
            const outboundMap: Record<string, string[]> = {}

            systemsList.forEach((sys: any) => {
                const config = configsData?.find((c: any) => c.system_code === sys.code)

                let inMods: string[] = []
                let outMods: string[] = []

                if (config) {
                    if (Array.isArray(config.inbound_modules)) inMods = config.inbound_modules
                    else if (typeof config.inbound_modules === 'string') {
                        try { inMods = JSON.parse(config.inbound_modules) } catch (e) { inMods = [] }
                    }

                    if (Array.isArray(config.outbound_modules)) outMods = config.outbound_modules
                    else if (typeof config.outbound_modules === 'string') {
                        try { outMods = JSON.parse(config.outbound_modules) } catch (e) { outMods = [] }
                    }
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
        const configMap = type === 'inbound' ? inboundConfig : outboundConfig
        const setConfig = type === 'inbound' ? setInboundConfig : setOutboundConfig

        const currentMods = configMap[sysCode] || []
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
        // Get current modules and always include basic modules (they are mandatory)
        let inMods = inboundConfig[sysCode] || []
        let outMods = outboundConfig[sysCode] || []

        // Ensure basic modules are always included
        if (!inMods.includes('inbound_basic')) {
            inMods = ['inbound_basic', ...inMods]
        }
        if (!outMods.includes('outbound_basic')) {
            outMods = ['outbound_basic', ...outMods]
        }

        // Upsert system_configs
        const { error } = await (supabase
            .from('system_configs') as any)
            .upsert({
                system_code: sysCode,
                inbound_modules: inMods,
                outbound_modules: outMods
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
                    <h2 className="text-lg font-medium text-gray-900">Cấu hình Phiếu Nhập/Xuất</h2>
                    <p className="text-sm text-gray-500">Tùy chỉnh thông tin hiển thị trên phiếu cho từng kho</p>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('inbound')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'inbound' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Phiếu Nhập Kho
                    </button>
                    <button
                        onClick={() => setActiveTab('outbound')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'outbound' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Phiếu Xuất Kho
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {systems.map(sys => (
                    <div key={sys.code} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Settings size={20} className={activeTab === 'inbound' ? "text-blue-500" : "text-orange-500"} />
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
                            {(activeTab === 'inbound' ? INBOUND_MODULES : OUTBOUND_MODULES)
                                // Filter out basic modules - they are always enabled by default
                                .filter(mod => mod.id !== 'inbound_basic' && mod.id !== 'outbound_basic')
                                .map(mod => {
                                    const currentConfig = activeTab === 'inbound' ? inboundConfig : outboundConfig
                                    const isSelected = currentConfig[sys.code]?.includes(mod.id)
                                    const ModIcon = mod.icon
                                    const activeColor = activeTab === 'inbound' ? 'blue' : 'orange'

                                    return (
                                        <div
                                            key={mod.id}
                                            onClick={() => toggleModule(sys.code, mod.id, activeTab)}
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
