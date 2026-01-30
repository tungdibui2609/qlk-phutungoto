'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Check, Sparkles, ArrowRight } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { SOLUTION_PRESETS, SolutionPreset } from '@/lib/utility-modules'

export default function OperationModelSection() {
    const [loading, setLoading] = useState(true)
    const [applying, setApplying] = useState<string | null>(null)
    const { showToast } = useToast()

    // We need to know current active modules to show "Active" status on presets
    const [currentModules, setCurrentModules] = useState<string[]>([])

    useEffect(() => {
        fetchCurrentConfig()
    }, [])

    async function fetchCurrentConfig() {
        setLoading(true)
        // Fetch all systems and their utility modules
        const { data, error } = await supabase
            .from('systems')
            .select('modules')

        if (!error && data) {
            // Aggregate all active utility modules across all systems
            const allMods = new Set<string>()
            data.forEach((sys: any) => {
                if (sys.modules?.utility_modules) {
                    sys.modules.utility_modules.forEach((m: string) => allMods.add(m))
                }
            })
            setCurrentModules(Array.from(allMods))
        }
        setLoading(false)
    }

    const applyPreset = async (preset: SolutionPreset) => {
        setApplying(preset.id)
        try {
            // 1. Get all systems to know where to apply the modules
            // For simplicity in this "Utility" phase, we assume utility modules 
            // are globally unique or we apply them to ALL systems or specific ones?
            // "utility_modules" are technically inside "systems". 
            // Ideally, a module like 'lot_accounting_sync' belongs to all Warehouse Systems.
            // Let's algorithmically apply:
            // For each recommended module, find which system it typically belongs to (or all systems).
            // currently `systems` has a `modules` jsonb.

            // Simpler approach for now: Get all systems, and enable the recommended modules 
            // on ALL systems that support modules (just appending to the list).

            const { data: systems } = await supabase.from('systems').select('*')
            if (!systems) throw new Error("No systems found")

            // Updates for each system
            const updates = systems.map(async (sys) => {
                const currentSysMods = (sys.modules as any)?.utility_modules || []
                // Union of current + recommended
                const newSysMods = Array.from(new Set([...currentSysMods, ...preset.recommended_modules]))

                const newModules = {
                    ...(sys.modules as object || {}),
                    utility_modules: newSysMods
                }

                return supabase
                    .from('systems')
                    .update({ modules: newModules })
                    .eq('code', sys.code)
            })

            await Promise.all(updates)

            showToast(`Đã áp dụng mô hình: ${preset.name}`, 'success')
            await fetchCurrentConfig()

        } catch (error: any) {
            showToast('Lỗi áp dụng mô hình: ' + error.message, 'error')
        } finally {
            setApplying(null)
        }
    }

    if (loading) return <div className="text-center py-10 text-gray-500">Đang tải cấu hình hiện tại...</div>

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Sparkles className="text-orange-600" />
                    Mô hình Vận hành
                </h2>
                <p className="text-base text-gray-500 mt-2 max-w-3xl">
                    Chọn mô hình phù hợp nhất với doanh nghiệp của bạn. Hệ thống sẽ tự động kích hoạt các cấu hình, tiện ích và các quy tắc nghiệp vụ cần thiết để bạn sẵn sàng làm việc ngay lập tức.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {SOLUTION_PRESETS.map(preset => {
                    const PresetIcon = preset.icon
                    // Check if fully active: Are all recommended modules present in currentModules?
                    const isFullyActive = preset.recommended_modules.every(m => currentModules.includes(m))
                    const isApplying = applying === preset.id

                    return (
                        <div
                            key={preset.id}
                            className={`relative group rounded-2xl border-2 transition-all duration-300 overflow-hidden ${isFullyActive
                                ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10'
                                : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-orange-200 hover:shadow-lg'
                                }`}
                        >
                            {isFullyActive && (
                                <div className="absolute top-0 right-0 bg-orange-500 text-white px-3 py-1 rounded-bl-xl text-xs font-bold shadow-sm z-10">
                                    ĐANG SỬ DỤNG
                                </div>
                            )}

                            <div className="p-6 h-full flex flex-col">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className={`p-4 rounded-xl shrink-0 ${isFullyActive ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors'
                                        }`}>
                                        <PresetIcon size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{preset.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                            {preset.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-auto pt-6 flex items-center justify-between border-t border-gray-100 dark:border-slate-800">
                                    <div className="text-xs text-gray-400 font-medium">
                                        Kích hoạt {preset.recommended_modules.length} cấu hình
                                    </div>
                                    <button
                                        onClick={() => applyPreset(preset)}
                                        disabled={isApplying || isFullyActive}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isFullyActive
                                            ? 'bg-gray-100 text-gray-400 cursor-default'
                                            : 'bg-stone-900 text-white hover:bg-orange-600 hover:shadow-lg active:scale-95 disabled:opacity-70'
                                            }`}
                                    >
                                        {isApplying && <Loader2 className="animate-spin" size={16} />}
                                        {isFullyActive ? (
                                            <>
                                                <Check size={16} /> Đã kích hoạt
                                            </>
                                        ) : (
                                            <>
                                                Áp dụng <ArrowRight size={16} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
