'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { X, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'

interface Company {
    id: string
    name: string
    code: string
}

interface PlatformModule {
    code: string
    name: string
    description: string
    category: string
    price_monthly: number
}

interface Props {
    isOpen: boolean
    onClose: () => void
    company: Company
}

export default function ModuleConfigModal({ isOpen, onClose, company }: Props) {
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [modules, setModules] = useState<PlatformModule[]>([])
    const [activeModules, setActiveModules] = useState<string[]>([])

    useEffect(() => {
        if (isOpen) {
            fetchData()
        }
    }, [isOpen, company.id])

    async function fetchData() {
        setLoading(true)
        try {
            // 1. Fetch available modules
            const { data: modulesData, error: modulesError } = await (supabase
                .from('platform_modules' as any) as any)
                .select('*')
                .eq('status', 'active')
                .order('category', { ascending: true })

            if (modulesError) throw modulesError
            setModules(modulesData || [])

            // 2. Fetch current active subscriptions for this company
            const { data: subsData, error: subsError } = await (supabase
                .from('company_subscriptions' as any) as any)
                .select('module_code')
                .eq('company_id', company.id)
                .eq('status', 'active')

            if (subsError) throw subsError

            if (subsData) {
                setActiveModules(subsData.map((s: any) => s.module_code))
            } else {
                setActiveModules([])
            }
        } catch (error: any) {
            showToast('Lỗi tải dữ liệu: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const toggleModule = async (moduleCode: string, isActive: boolean) => {
        // Optimistic update
        if (isActive) {
            setActiveModules(prev => [...prev, moduleCode])
        } else {
            setActiveModules(prev => prev.filter(c => c !== moduleCode))
        }

        try {
            if (isActive) {
                // Activate: Insert subscription
                const { error } = await (supabase
                    .from('company_subscriptions' as any) as any)
                    .insert({
                        company_id: company.id,
                        module_code: moduleCode,
                        status: 'active'
                    })
                if (error) {
                    // Start reverting if failed
                    setActiveModules(prev => prev.filter(c => c !== moduleCode))
                    throw error
                }
            } else {
                // Deactivate: Delete subscription (or set to cancelled)
                // For simplicity, let's delete or update status. 
                // Given the unique constraint, deleting is cleaner for toggling.
                const { error } = await (supabase
                    .from('company_subscriptions' as any) as any)
                    .delete()
                    .eq('company_id', company.id)
                    .eq('module_code', moduleCode)

                if (error) {
                    setActiveModules(prev => [...prev, moduleCode])
                    throw error
                }
            }
        } catch (error: any) {
            showToast('Lỗi cập nhật: ' + error.message, 'error')
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b">
                    <div>
                        <h3 className="font-bold text-lg">Cấu hình Module dịch vụ</h3>
                        <p className="text-sm text-gray-500">Công ty: <span className="font-semibold text-blue-600">{company.name}</span> ({company.code})</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">Đang tải danh sách module...</div>
                    ) : (
                        <div className="space-y-6">
                            {/* Group modules by category if needed, for now just list */}
                            <div className="grid grid-cols-1 gap-4">
                                {modules.map(mod => {
                                    const isEnabled = activeModules.includes(mod.code)
                                    return (
                                        <div
                                            key={mod.code}
                                            className={`flex items-start justify-between p-4 rounded-lg border transition-all ${isEnabled
                                                ? 'border-green-200 bg-green-50'
                                                : 'border-gray-200 bg-white hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="flex-1 pr-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-bold text-gray-900">{mod.name}</h4>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-mono">
                                                        {mod.code}
                                                    </span>
                                                    {mod.category === 'CORE' && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Core</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600">{mod.description}</p>
                                                <div className="mt-2 text-xs font-medium text-gray-500">
                                                    Giá niêm yết: {mod.price_monthly.toLocaleString()} đ/tháng
                                                </div>
                                            </div>

                                            <div className="flex items-center">
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={isEnabled}
                                                        onChange={(e) => toggleModule(mod.code, e.target.checked)}
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                                </label>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {modules.length === 0 && (
                                <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-lg">
                                    Chưa có module nào trong hệ thống
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}
