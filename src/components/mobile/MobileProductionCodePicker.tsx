'use client'

import { useState, useEffect } from 'react'
import { Hash, Search, Check, Loader2, X, ChevronRight, LayoutGrid } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { getNextProductionSTT, getProductionCodeSTT, generateFullProductionCode } from '@/lib/productionCodeUtils'

interface ProductionCodeLevel {
    id: string
    level: number
    prefix: string
    description: string
}

interface MobileProductionCodePickerProps {
    onSelect: (data: { code: string; names: string[] }) => void
    onClose?: () => void
}

export function MobileProductionCodePicker({ onSelect, onClose }: MobileProductionCodePickerProps) {
    const { currentSystem } = useSystem()
    const { profile } = useUser()
    const [levels, setLevels] = useState<ProductionCodeLevel[]>([])
    const [loading, setLoading] = useState(true)
    const [currentStep, setCurrentStep] = useState(1)
    const [selections, setSelections] = useState<Record<number, ProductionCodeLevel | null>>({})

    useEffect(() => {
        const fetchLevels = async () => {
            if (!profile?.company_id) return

            try {
                const { data, error } = await supabase
                    .from('production_code_levels')
                    .select('id, level, prefix, description')
                    .eq('company_id', profile.company_id)
                    .eq('system_code', 'SANXUAT')
                    .order('level', { ascending: true })
                    .order('prefix', { ascending: true })

                if (error) throw error
                setLevels(data || [])
            } catch (err) {
                console.error('Error fetching production code levels:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchLevels()
    }, [profile])

    const maxLevel = levels.length > 0 ? Math.max(...levels.map(l => l.level)) : 0
    const currentStepLevels = levels.filter(l => l.level === currentStep)


    const handleSelectLevel = async (level: ProductionCodeLevel) => {
        const newSelections = { ...selections, [currentStep]: level }
        setSelections(newSelections)

        if (currentStep < maxLevel) {
            setCurrentStep(currentStep + 1)
        } else {
            setLoading(true)
            const allLevelsPrefix = Object.keys(newSelections)
                .sort((a, b) => Number(a) - Number(b))
                .map(k => (newSelections[Number(k)] as ProductionCodeLevel).prefix)
                .join('')

            const allLevelsNames = Object.keys(newSelections)
                .sort((a, b) => Number(a) - Number(b))
                .map(k => (newSelections[Number(k)] as ProductionCodeLevel).description)

            const stt = await getProductionCodeSTT(profile!.company_id!, currentSystem!.code!, allLevelsPrefix)
            
            const finalCode = generateFullProductionCode(stt, allLevelsPrefix)
            
            onSelect({ code: finalCode, names: allLevelsNames })
            setLoading(false)
        }
    }

    const reset = () => {
        setCurrentStep(1)
        setSelections({})
        setLoading(false)
    }

    return (
        <div className="fixed inset-0 z-[200] bg-white dark:bg-zinc-950 flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600">
                        <LayoutGrid size={18} />
                    </div>
                    <div>
                        <h2 className="font-bold text-zinc-900 dark:text-white text-sm">Cấp độ {currentStep}/{maxLevel}</h2>
                        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Chọn mã sản xuất</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {currentStep > 1 && (
                        <button onClick={() => setCurrentStep(currentStep - 1)} className="p-2 text-zinc-400 text-xs font-bold uppercase">
                            Quay lại
                        </button>
                    )}
                    {onClose && (
                        <button onClick={onClose} className="p-2 text-zinc-400">
                            <X size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            {maxLevel > 0 && (
                <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800">
                    <div 
                        className="h-full bg-indigo-500 transition-all duration-300" 
                        style={{ width: `${(currentStep / maxLevel) * 100}%` }}
                    />
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-zinc-400 italic text-sm">
                        <Loader2 size={24} className="animate-spin mb-2" />
                        Đang lấy danh sách mã...
                    </div>
                ) : currentStepLevels.length === 0 ? (
                    <div className="py-12 text-center text-zinc-500 text-sm">
                        Không tìm thấy mã cho cấp độ này
                        <button onClick={reset} className="block mx-auto mt-4 text-indigo-500 font-bold">Làm lại</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {currentStepLevels.map(level => (
                            <button
                                key={level.id}
                                onClick={() => handleSelectLevel(level)}
                                className="p-4 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-all text-left group active:scale-[0.98]"
                            >
                                <div className="text-xl font-black text-zinc-900 dark:text-white mb-1 group-hover:text-indigo-500 transition-colors">
                                    {level.prefix}
                                </div>
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-tight line-clamp-2">
                                    {level.description}
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <div className="w-6 h-6 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-300 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                        <ChevronRight size={14} />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Selection Summary (Footer) */}
            {currentStep > 1 && (
                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        {Object.keys(selections).sort().map(k => (
                            <span key={k} className="flex items-center gap-1">
                                <span className="text-zinc-900 dark:text-zinc-100">{selections[Number(k)]?.prefix}</span>
                                {Number(k) < maxLevel && <ChevronRight size={10} />}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
