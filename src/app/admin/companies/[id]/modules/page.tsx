'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { X, Save, CheckCircle2, AlertCircle, Shield, Package, LayoutDashboard, Cog, Archive, ArrowLeft, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { INBOUND_MODULES, OUTBOUND_MODULES } from '@/lib/order-modules'
import { LOT_MODULES } from '@/lib/lot-modules'
import { DASHBOARD_MODULES } from '@/lib/dashboard-modules'
import { UTILITY_MODULES } from '@/lib/utility-modules'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Company {
    id: string
    name: string
    code: string
    unlocked_modules?: string[]
}

const ALL_MODULES = [
    ...INBOUND_MODULES.map(m => ({ ...m, category: 'Nhập kho' })),
    ...OUTBOUND_MODULES.map(m => ({ ...m, category: 'Xuất kho' })),
    ...LOT_MODULES.map(m => ({ ...m, category: 'Quản lý LOT' })),
    ...DASHBOARD_MODULES.map(m => ({ ...m, category: 'Dashboard' })),
    ...UTILITY_MODULES.map(m => ({ ...m, category: 'Tiện ích hệ thống' }))
]

export default function CompanyModulesPage() {
    const { id } = useParams()
    const router = useRouter()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [company, setCompany] = useState<Company | null>(null)
    const [unlockedModules, setUnlockedModules] = useState<string[]>([])

    useEffect(() => {
        if (id) {
            fetchData()
        }
    }, [id])

    async function fetchData() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('id, name, code, unlocked_modules')
                .eq('id', id as string)
                .single()

            if (error) throw error
            setCompany(data as any)
            setUnlockedModules(data?.unlocked_modules || [])
        } catch (error: any) {
            console.error('Error fetching data:', error)
            showToast('Lỗi tải dữ liệu: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleToggle = (moduleId: string) => {
        setUnlockedModules(prev =>
            prev.includes(moduleId)
                ? prev.filter(id => id !== moduleId)
                : [...prev, moduleId]
        )
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const { error } = await supabase
                .from('companies')
                .update({ unlocked_modules: unlockedModules })
                .eq('id', id as string)

            if (error) throw error
            showToast('Đã cập nhật danh sách module thành công', 'success')
            router.push('/admin/dashboard')
        } catch (error: any) {
            showToast('Lỗi khi lưu: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-stone-50">
                <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div>
                <p className="text-stone-500 font-medium font-serif italic text-lg">Đang tải cấu hình...</p>
            </div>
        )
    }

    if (!company) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-stone-50">
                <AlertCircle size={48} className="text-red-500" />
                <p className="text-stone-800 font-bold text-xl">Không tìm thấy thông tin công ty</p>
                <Link href="/admin/dashboard" className="text-blue-600 hover:underline">Quay lại Dashboard</Link>
            </div>
        )
    }

    // Grouping for UI
    const categories = Array.from(new Set(ALL_MODULES.map(m => m.category)))

    return (
        <div className="min-h-screen bg-stone-50 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/dashboard"
                            className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-500"
                        >
                            <ArrowLeft size={24} />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-stone-900 leading-none">Cấu hình Module Dịch vụ</h1>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded uppercase tracking-wider">Doanh nghiệp</span>
                                <p className="text-sm font-bold text-stone-600">{company.name} <span className="text-stone-400">({company.code})</span></p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <Link
                            href="/admin/dashboard"
                            className="flex-1 md:flex-none px-6 py-2.5 bg-white border border-stone-300 text-stone-700 font-bold rounded-xl hover:bg-stone-50 transition-all text-sm text-center shadow-sm"
                        >
                            Thoát
                        </Link>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-10 py-2.5 bg-stone-900 text-white font-bold rounded-xl hover:bg-black transition-all text-sm shadow-xl shadow-stone-200 disabled:opacity-50"
                        >
                            {saving ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <Save size={18} />
                            )}
                            {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 mt-10">
                <div className="grid grid-cols-1 gap-12">
                    {categories.map(cat => (
                        <section key={cat} className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-stone-900 text-white rounded-2xl shadow-lg shadow-stone-200">
                                    {cat === 'Nhập kho' && <Package size={24} />}
                                    {cat === 'Xuất kho' && <Package size={24} />}
                                    {cat === 'Quản lý LOT' && <Archive size={24} />}
                                    {cat === 'Dashboard' && <LayoutDashboard size={24} />}
                                    {cat === 'Tiện ích hệ thống' && <Cog size={24} />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-stone-800 uppercase tracking-widest">{cat}</h2>
                                    <p className="text-sm text-stone-500">Các tính năng thuộc phân hệ {cat.toLowerCase()}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {ALL_MODULES.filter(m => m.category === cat).map(mod => {
                                    const isBasic = 'is_basic' in mod && mod.is_basic
                                    const isUnlocked = isBasic || unlockedModules.includes(mod.id)

                                    return (
                                        <div
                                            key={mod.id}
                                            onClick={() => !isBasic && handleToggle(mod.id)}
                                            className={`
                                                relative group flex flex-col p-6 rounded-2xl border-2 transition-all cursor-pointer h-full
                                                ${isBasic
                                                    ? 'bg-stone-100 border-stone-200 opacity-80 cursor-default'
                                                    : isUnlocked
                                                        ? 'bg-white border-stone-900 shadow-xl shadow-stone-100 scale-[1.02] z-10'
                                                        : 'bg-white border-white hover:border-stone-300 text-stone-600 shadow-sm'
                                                }
                                            `}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={`p-2 rounded-lg ${isUnlocked && !isBasic ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}>
                                                    <mod.icon size={20} />
                                                </div>

                                                <div className="flex shrink-0">
                                                    {isBasic ? (
                                                        <div className="px-2 py-0.5 rounded bg-stone-200 text-stone-600 text-[10px] font-black uppercase tracking-tighter">Mặc định</div>
                                                    ) : (
                                                        <div className={`
                                                            w-10 h-5 rounded-full relative transition-colors
                                                            ${isUnlocked ? 'bg-orange-500' : 'bg-stone-200'}
                                                        `}>
                                                            <div className={`
                                                                absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform
                                                                ${isUnlocked ? 'translate-x-5.5' : 'translate-x-0.5'}
                                                            `}></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex-1">
                                                <h3 className={`font-bold text-base leading-tight mb-2 ${isUnlocked && !isBasic ? 'text-stone-900' : 'text-stone-700'}`}>
                                                    {mod.name}
                                                </h3>
                                                <p className={`text-xs leading-relaxed ${isUnlocked && !isBasic ? 'text-stone-600' : 'text-stone-500'}`}>
                                                    {mod.description}
                                                </p>
                                            </div>

                                            {isUnlocked && !isBasic && (
                                                <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-2 text-[10px] font-bold text-orange-600 uppercase tracking-widest">
                                                    <Shield size={12} />
                                                    Đã cấp phép
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    ))}
                </div>

                <div className="mt-16 p-8 bg-stone-900 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
                    <div className="relative z-10 max-w-2xl">
                        <h3 className="text-2xl font-bold mb-2">Hoàn tất cấu hình?</h3>
                        <p className="text-stone-400 text-sm">Hãy kiểm tra kỹ danh sách các module đã chọn trước khi lưu. Các module cơ bản sẽ luôn khả dụng cho mọi doanh nghiệp.</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="relative z-10 flex items-center gap-3 px-12 py-4 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-500 transition-all text-base shadow-2xl shadow-orange-900/50 active:scale-95 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                        {saving ? 'ĐANG LƯU...' : 'LƯU CẤU HÌNH NGAY'}
                    </button>

                    {/* Decorative element */}
                    <div className="absolute right-0 top-0 w-64 h-64 bg-stone-800 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50"></div>
                </div>
            </div>
        </div>
    )
}
