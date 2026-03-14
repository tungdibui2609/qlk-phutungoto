'use client'
import React, { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { Plus, Save, Trash2, GripVertical, Info } from 'lucide-react'

type CodeRule = {
    id: string
    level: number
    prefix: string
    description: string
    system_code: string
    sort_order: number | null
}

export default function CodeRulesSettings() {
    const { systemType } = useSystem()
    const { showToast } = useToast()
    const [rules, setRules] = useState<CodeRule[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Load rules
    React.useEffect(() => {
        fetchRules()
    }, [systemType])

    const fetchRules = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('internal_product_code_rules')
                .select('*')
                .eq('system_code', systemType)
                .order('sort_order', { ascending: true })

            if (error) throw error
            console.log('Fetched rules for system:', systemType, data)
            setRules(data || [])
        } catch (error: any) {
            console.error('Fetch error for system:', systemType, error)
            showToast('Lỗi khi tải quy tắc: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleAddRule = (level: number) => {
        const newRule: CodeRule = {
            id: crypto.randomUUID(),
            level,
            prefix: '',
            description: '',
            system_code: systemType,
            sort_order: rules.length > 0 ? Math.max(...rules.map(r => r.sort_order || 0)) + 1 : 1
        }
        setRules([...rules, newRule])
    }

    const handleUpdateRule = (id: string, field: keyof CodeRule, value: any) => {
        let finalValue = value
        if (field === 'prefix' && typeof value === 'string') {
            finalValue = value.toUpperCase()
        }
        setRules(rules.map(r => r.id === id ? { ...r, [field]: finalValue } : r))
    }

    const handleDeleteRule = (id: string) => {
        setRules(rules.filter(r => r.id !== id))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            // Validation
            const invalidRules = rules.filter(r => !r.prefix.trim() || !r.description.trim())
            if (invalidRules.length > 0) {
                showToast('Vui lòng điền đầy đủ Mã và Mô tả cho tất cả quy tắc', 'error')
                setSaving(false)
                return
            }

            // Sync with DB
            // 1. Delete old rules for this system_code
            const { error: deleteError } = await supabase
                .from('internal_product_code_rules')
                .delete()
                .eq('system_code', systemType)

            if (deleteError) throw deleteError

            // 2. Insert new ones
            if (rules.length > 0) {
                const rulesToInsert = rules.map(({ id, ...rest }) => ({
                    ...rest,
                    prefix: rest.prefix.trim().toUpperCase(),
                    system_code: systemType
                }))
                const { error: insertError } = await supabase
                    .from('internal_product_code_rules')
                    .insert(rulesToInsert)

                if (insertError) throw insertError
            }

            showToast('Lưu cấu hình quy tắc 3 cấp độ thành công', 'success')
            fetchRules()
        } catch (error: any) {
            console.error('Save error:', error)
            showToast('Lỗi khi lưu: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="p-20 text-center">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Đang tải...</p>
            </div>
        )
    }

    const renderLevelTable = (level: number, title: string, subtitle: string, colorClass: string) => {
        const levelRules = rules.filter(r => r.level === level)
        return (
            <div className="bg-white rounded-[32px] border border-stone-200 shadow-sm overflow-hidden">
                <div className={`p-6 border-b border-stone-100 flex justify-between items-center ${colorClass}`}>
                    <div>
                        <h3 className="text-lg font-black text-stone-800 uppercase tracking-tight">{title}</h3>
                        <p className="text-xs text-stone-500 font-medium">{subtitle}</p>
                    </div>
                    <button
                        onClick={() => handleAddRule(level)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 font-bold hover:bg-stone-50 transition-all text-xs shadow-sm"
                    >
                        <Plus size={16} />
                        Thêm dòng
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-stone-50/30 border-b border-stone-100">
                                <th className="p-4 w-12"></th>
                                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-stone-400">Mã (Prefix)</th>
                                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-stone-400">Mô tả đầy đủ</th>
                                <th className="p-4 w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                            {levelRules.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-stone-400 font-medium italic text-sm">
                                        Chưa có quy tắc cho {title.toLowerCase()}.
                                    </td>
                                </tr>
                            ) : (
                                levelRules.map((rule) => (
                                    <tr key={rule.id} className="group hover:bg-stone-50/30 transition-colors">
                                        <td className="p-4 text-stone-300">
                                            <GripVertical size={18} />
                                        </td>
                                        <td className="p-3 w-1/3">
                                            <input
                                                type="text"
                                                value={rule.prefix}
                                                onChange={(e) => handleUpdateRule(rule.id, 'prefix', e.target.value)}
                                                placeholder="VD: DO, RI..."
                                                className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-transparent focus:border-stone-200 focus:bg-white transition-all font-mono font-black text-indigo-600 uppercase"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <input
                                                type="text"
                                                value={rule.description}
                                                onChange={(e) => handleUpdateRule(rule.id, 'description', e.target.value)}
                                                placeholder="VD: Dona, Má, Loại A..."
                                                className="w-full px-4 py-2.5 rounded-xl bg-stone-50 border border-transparent focus:border-stone-200 focus:bg-white transition-all font-medium text-stone-600"
                                            />
                                        </td>
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={() => handleDeleteRule(rule.id)}
                                                className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center bg-white p-6 rounded-[24px] border border-stone-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                        <Info size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-stone-800 tracking-tight">Cấu trúc mã 3 cấp độ</h2>
                        <p className="text-sm text-stone-500 font-medium">
                            Thiết lập các thành phần để tự động sinh mã nội bộ: Cấp 1 + Cấp 2 + Cấp 3
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest hover:bg-indigo-700 transition-all text-xs shadow-lg shadow-indigo-200 disabled:opacity-50"
                >
                    {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                    Lưu toàn bộ cấu hình
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {renderLevelTable(1, "Cấp 1: Sản phẩm", "VD: Loại trái cây (Dona, Ri-6...)", "bg-blue-50/50")}
                {renderLevelTable(2, "Cấp 2: Hình thức", "VD: Cách chế biến (Múi, Dice...)", "bg-amber-50/50")}
                {renderLevelTable(3, "Cấp 3: Phân loại", "VD: Chất lượng (Loại A, B...)", "bg-emerald-50/50")}
                {renderLevelTable(4, "Cấp 4: Dự phòng", "Thiết lập dự phòng mở rộng", "bg-purple-50/50")}
            </div>
        </div>
    )
}
