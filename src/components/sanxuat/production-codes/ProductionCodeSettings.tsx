'use client'
import React, { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { Plus, Save, Trash2, GripVertical, Info } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'

type ProductionCodeLevel = {
    id: string
    level: number
    prefix: string
    description: string
    system_code: string
    sort_order: number | null
    company_id: string | null
}

export default function ProductionCodeSettings() {
    const { systemType } = useSystem()
    const { profile } = useUser()
    const { showToast } = useToast()
    const [rules, setRules] = useState<ProductionCodeLevel[]>([])
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
                .from('production_code_levels')
                .select('*')
                .eq('system_code', 'SANXUAT') // Luôn là SANXUAT cho module này
                .order('sort_order', { ascending: true })

            if (error) {
                // Nếu bảng chưa tồn tại, chúng ta sẽ bắt lỗi này sau khi tạo migration
                // Tạm thời để trống nếu lỗi hoặc không có dữ liệu
                console.warn('Fetch production levels error:', error)
                setRules([])
            } else {
                setRules(data || [])
            }
        } catch (error: any) {
            console.error('Fetch error:', error)
            showToast('Lỗi khi tải quy tắc mã sản xuất: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleAddRule = (level: number) => {
        const newRule: ProductionCodeLevel = {
            id: crypto.randomUUID(),
            level,
            prefix: '',
            description: '',
            system_code: 'SANXUAT',
            sort_order: rules.length > 0 ? Math.max(...rules.map(r => r.sort_order || 0)) + 1 : 1,
            company_id: profile?.company_id || null
        }
        setRules([...rules, newRule])
    }

    const handleUpdateRule = (id: string, field: keyof ProductionCodeLevel, value: any) => {
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
            // 1. Delete old rules
            const { error: deleteError } = await supabase
                .from('production_code_levels')
                .delete()
                .eq('system_code', 'SANXUAT')

            if (deleteError) throw deleteError

            // 2. Insert new ones
            if (rules.length > 0) {
                const rulesToInsert = rules.map(({ id, ...rest }) => ({
                    ...rest,
                    prefix: rest.prefix.trim().toUpperCase(),
                    system_code: 'SANXUAT',
                    company_id: profile?.company_id || rest.company_id
                }))
                const { error: insertError } = await supabase
                    .from('production_code_levels')
                    .insert(rulesToInsert as any)

                if (insertError) throw insertError
            }

            showToast('Lưu cấu hình quy tắc mã sản xuất thành công', 'success')
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
            <div className="p-10 text-center bg-white rounded-[32px] border border-stone-200">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Đang tải cấu hình...</p>
            </div>
        )
    }

    const renderLevelTable = (level: number, title: string, subtitle: string, colorClass: string) => {
        const levelRules = rules.filter(r => r.level === level)
        return (
            <div className="bg-white rounded-[32px] border border-stone-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className={`p-6 border-b border-stone-100 flex justify-between items-center ${colorClass}`}>
                    <div>
                        <h3 className="text-base font-black text-stone-800 uppercase tracking-tight">{title}</h3>
                        <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">{subtitle}</p>
                    </div>
                    <button
                        onClick={() => handleAddRule(level)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-700 font-black hover:bg-stone-50 transition-all text-[10px] uppercase tracking-widest shadow-sm"
                    >
                        <Plus size={14} />
                        Thêm
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-stone-50/30 border-b border-stone-100 sticky top-0 bg-white z-10">
                                <th className="p-4 w-10"></th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Mã</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Mô tả</th>
                                <th className="p-4 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                            {levelRules.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-stone-400 font-bold italic text-xs uppercase tracking-widest">
                                        Chưa có dữ liệu
                                    </td>
                                </tr>
                            ) : (
                                levelRules.map((rule) => (
                                    <tr key={rule.id} className="group hover:bg-stone-50/30 transition-colors">
                                        <td className="p-4 text-stone-300">
                                            <GripVertical size={16} />
                                        </td>
                                        <td className="p-2 w-1/4">
                                            <input
                                                type="text"
                                                value={rule.prefix}
                                                onChange={(e) => handleUpdateRule(rule.id, 'prefix', e.target.value)}
                                                placeholder="Mã..."
                                                className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-transparent focus:border-emerald-200 focus:bg-white transition-all font-mono font-black text-emerald-600 uppercase text-sm"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                value={rule.description}
                                                onChange={(e) => handleUpdateRule(rule.id, 'description', e.target.value)}
                                                placeholder="Mô tả..."
                                                className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-transparent focus:border-emerald-200 focus:bg-white transition-all font-bold text-stone-600 text-sm"
                                            />
                                        </td>
                                        <td className="p-2 text-right">
                                            <button
                                                onClick={() => handleDeleteRule(rule.id)}
                                                className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
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
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[32px] border border-stone-200 shadow-sm gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl shadow-sm shadow-emerald-200">
                        <Info size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-stone-800 tracking-tight uppercase">Cấu trúc mã sản xuất</h2>
                        <p className="text-sm text-stone-500 font-bold uppercase tracking-wider">
                            Thiết lập các cấp độ mã (1-4) để quản lý sản xuất tập trung
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest hover:bg-emerald-700 transition-all text-xs shadow-lg shadow-emerald-200 disabled:opacity-50 w-full md:w-auto justify-center"
                >
                    {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                    Lưu cấu hình
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {renderLevelTable(1, "Cấp 1", "Phân loại chính", "bg-emerald-50/50")}
                {renderLevelTable(2, "Cấp 2", "Phân loại phụ", "bg-blue-50/50")}
                {renderLevelTable(3, "Cấp 3", "Chi tiết", "bg-amber-50/50")}
                {renderLevelTable(4, "Cấp 4", "Mở rộng", "bg-purple-50/50")}
            </div>
        </div>
    )
}
