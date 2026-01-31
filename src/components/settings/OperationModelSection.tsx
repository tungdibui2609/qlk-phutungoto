'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Check, Sparkles, ArrowRight } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { SOLUTION_PRESETS, SolutionPreset } from '@/lib/utility-modules'

export default function OperationModelSection() {
    /* 
    ==========================================================================================
    ⚠️ AGENCY NOTE - TEMPORARILY DISABLED FOR COMMERCIAL ROADMAP ⚠️
    
    TÍNH NĂNG NÀY ĐANG Ở CHẾ ĐỘ MOCKUP (READ-ONLY).
    
    Lý do: 
    - Chức năng "Mô hình Vận hành" (Operation Model) liên quan đến lộ trình thương mại hóa.
    - Hiện tại chỉ hiển thị giao diện để demo/giới thiệu (Mockup), CHƯA cho phép user kích hoạt thật.
    
    Hướng dẫn Dev sau này:
    - Khi website/sản phẩm hoàn thiện và sẵn sàng thương mại hóa, hãy bỏ comment này và kích hoạt lại logic `applyPreset`.
    - Logic cũ đã bị comment lại bên dưới hoặc thay thế bằng thông báo "Coming Soon".
    - Kiểm tra lại các `preset` trong `src/lib/utility-modules.ts` trước khi enable.
    ==========================================================================================
    */

    const [loading, setLoading] = useState(true)
    const [applying, setApplying] = useState<string | null>(null)
    const { showToast } = useToast()

    // We need to know current active modules to show "Active" status on presets
    const [currentModules, setCurrentModules] = useState<string[]>([])

    useEffect(() => {
        fetchCurrentConfig()
    }, [])

    async function fetchCurrentConfig() {
        // Mockup mode: vẫn fetch để hiển thị trạng thái nếu có, hoặc để giả lập loading
        setLoading(true)
        // Simulate loading config
        setTimeout(() => setLoading(false), 800)

        // Logic cũ (tạm khóa để tối ưu perf cho mockup)
        /*
        const { data, error } = await supabase.from('systems').select('modules')
        if (!error && data) {
           // ... logic aggregate modules ...
        }
        */
    }

    const applyPreset = async (preset: SolutionPreset) => {
        // MOCKUP ACTION: Chỉ thông báo
        showToast(`Tính năng "${preset.name}" đang được phát triển và sẽ sớm ra mắt!`, 'info')

        /* LOGIC CŨ (BỊ KHÓA)
        setApplying(preset.id)
        try {
            const { data: systems } = await supabase.from('systems').select('*')
            // ... logic update database ...
            await Promise.all(updates)
            showToast(`Đã áp dụng mô hình: ${preset.name}`, 'success')
            await fetchCurrentConfig()
        } catch (error: any) {
            showToast('Lỗi áp dụng mô hình: ' + error.message, 'error')
        } finally {
            setApplying(null)
        }
        */
    }

    if (loading) return <div className="text-center py-10 text-gray-500">Đang tải các mô hình mẫu...</div>

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Sparkles className="text-orange-600" />
                    Mô hình Vận hành
                    <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full uppercase tracking-wider">
                        Coming Soon
                    </span>
                </h2>
                <p className="text-base text-gray-500 mt-2 max-w-3xl">
                    Chọn mô hình phù hợp nhất với doanh nghiệp của bạn. Hệ thống sẽ tối ưu hóa cấu hình chuyên sâu (Tính năng đang trong quá trình hoàn thiện).
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-75 hover:opacity-100 transition-opacity">
                {SOLUTION_PRESETS.map(preset => {
                    const PresetIcon = preset.icon
                    const isFullyActive = false // Mockup: Luôn coi như chưa active để hiện nút Apply (hoặc biến thể khác)
                    const isApplying = applying === preset.id

                    return (
                        <div
                            key={preset.id}
                            className={`relative group rounded-2xl border-2 transition-all duration-300 overflow-hidden bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 hover:border-orange-200 hover:shadow-lg`}
                        >
                            <div className="p-6 h-full flex flex-col">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="p-4 rounded-xl shrink-0 bg-gray-100 text-gray-500 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
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
                                        Gói cấu hình chuyên nghiệp
                                    </div>
                                    <button
                                        onClick={() => applyPreset(preset)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-700 transition-all"
                                    >
                                        Chi tiết <ArrowRight size={16} />
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
