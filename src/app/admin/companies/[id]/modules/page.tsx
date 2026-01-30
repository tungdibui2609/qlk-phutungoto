'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { X, Save, Shield, Package, LayoutDashboard, Cog, Archive, ArrowLeft, Loader2, Search } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { INBOUND_MODULES, OUTBOUND_MODULES } from '@/lib/order-modules'
import { LOT_MODULES } from '@/lib/lot-modules'
import { DASHBOARD_MODULES } from '@/lib/dashboard-modules'
import { UTILITY_MODULES } from '@/lib/utility-modules'
import { PRODUCT_MODULES } from '@/lib/product-modules'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface Company {
    id: string
    name: string
    code: string
    unlocked_modules?: string[]
}

const ALL_MODULES = [
    ...INBOUND_MODULES.map(m => ({ ...m, category: 'Nhập kho' })),
    ...OUTBOUND_MODULES.map(m => ({ ...m, category: 'Xuất kho' })),
    ...PRODUCT_MODULES.map(m => ({ ...m, category: 'Sản phẩm' })),
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
    const [filter, setFilter] = useState<'all' | 'basic' | 'advanced'>('all')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')

    // Confirmation State
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [pendingModule, setPendingModule] = useState<string | null>(null)

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
        const isCurrentlyUnlocked = unlockedModules.includes(moduleId)
        const moduleInfo = ALL_MODULES.find(m => m.id === moduleId)
        const isBasic = moduleInfo && 'is_basic' in moduleInfo && moduleInfo.is_basic

        // If trying to DISABLE a BASIC module, ask for confirmation
        if (isCurrentlyUnlocked && isBasic) {
            setPendingModule(moduleId)
            setConfirmOpen(true)
            return
        }

        performToggle(moduleId)
    }

    const performToggle = (moduleId: string) => {
        setUnlockedModules(prev =>
            prev.includes(moduleId)
                ? prev.filter(id => id !== moduleId)
                : [...prev, moduleId]
        )
        setConfirmOpen(false)
        setPendingModule(null)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const { data, error } = await supabase
                .from('companies')
                .update({ unlocked_modules: unlockedModules })
                .eq('id', id as string)
                .select() // Return updated rows

            if (error) throw error

            // Check if any row was actually updated
            if (!data || data.length === 0) {
                throw new Error('Không có quyền cập nhật hoặc công ty không tồn tại (RLS)')
            }

            showToast('Đã cập nhật danh sách module thành công', 'success')
            router.push('/admin/dashboard')
        } catch (error: any) {
            console.error('Error saving modules:', error)
            showToast('Lỗi khi lưu: ' + (error.message || error), 'error')
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
                <p className="text-stone-800 font-bold text-xl">Không tìm thấy thông tin công ty</p>
                <Link href="/admin/dashboard" className="text-blue-600 hover:underline">Quay lại Dashboard</Link>
            </div>
        )
    }

    const categories = Array.from(new Set(ALL_MODULES.map(m => m.category)))

    return (
        <div className="min-h-screen bg-stone-50 pb-20">
            {/* Header omitted for brevity in thought, but full content will be written */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/dashboard"
                            className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-50"
                        >
                            <ArrowLeft size={24} className="text-stone-500" />
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
                        <div className="relative flex-1 md:w-64">
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-stone-400">
                                <Search size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder="Tìm kiếm module..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-stone-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500 transition-all font-medium text-stone-900"
                            />
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-10 py-2.5 bg-stone-900 text-white font-bold rounded-xl hover:bg-black transition-all text-sm shadow-xl shadow-stone-200 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 mt-10">
                <div className="grid grid-cols-1 gap-12">
                    {categories
                        .filter(cat => selectedCategory === 'all' || selectedCategory === cat)
                        .map(cat => (
                            <section key={cat} className="space-y-6">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-stone-900 text-white rounded-2xl shadow-lg">
                                            {(cat === 'Nhập kho' || cat === 'Xuất kho' || cat === 'Sản phẩm') && <Package size={24} />}
                                            {cat === 'Quản lý LOT' && <Archive size={24} />}
                                            {cat === 'Dashboard' && <LayoutDashboard size={24} />}
                                            {cat === 'Tiện ích hệ thống' && <Cog size={24} />}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-stone-800 uppercase tracking-widest">{cat}</h2>
                                            <p className="text-sm text-stone-500">Các tính năng thuộc phân hệ {cat.toLowerCase()}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {ALL_MODULES.filter(m => m.category === cat).filter(m => {
                                        // Hide Core System Features from Admin UI
                                        const CORE_HIDDEN = ['inbound_basic', 'outbound_basic', 'images']
                                        if (CORE_HIDDEN.includes(m.id)) return false

                                        const matchesSearch = !searchTerm ||
                                            m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            m.description.toLowerCase().includes(searchTerm.toLowerCase())
                                        return matchesSearch
                                    }).sort((a, b) => {
                                        const aBasic = 'is_basic' in a && a.is_basic ? 1 : 0
                                        const bBasic = 'is_basic' in b && b.is_basic ? 1 : 0
                                        return bBasic - aBasic
                                    }).map(mod => {
                                        const isBasic = 'is_basic' in mod && mod.is_basic
                                        const isUnlocked = unlockedModules.includes(mod.id)

                                        return (
                                            <div
                                                key={mod.id}
                                                onClick={() => handleToggle(mod.id)}
                                                className={`
                                                relative group flex flex-col p-6 rounded-2xl border-2 transition-all cursor-pointer h-full
                                                ${isUnlocked
                                                        ? 'bg-white border-stone-900 shadow-xl shadow-stone-100 scale-[1.02] z-10'
                                                        : 'bg-white border-white hover:border-stone-300 text-stone-600 shadow-sm'
                                                    }
                                            `}
                                            >
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className={`p-2 rounded-lg ${isUnlocked ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}>
                                                        <mod.icon size={20} />
                                                    </div>

                                                    <div className="flex shrink-0 items-center">
                                                        {isBasic && (
                                                            <div className="px-2 py-0.5 rounded bg-orange-100 text-orange-600 text-[10px] font-black uppercase tracking-tighter mr-2">Mặc định</div>
                                                        )}
                                                        <div className={`
                                                            w-10 h-5 rounded-full relative transition-colors
                                                            ${isUnlocked ? 'bg-stone-900' : 'bg-stone-200'}
                                                        `}>
                                                            <div className={`
                                                                absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform
                                                                ${isUnlocked ? 'translate-x-[22px]' : 'translate-x-[2px]'}
                                                            `}></div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-1">
                                                    <h3 className={`font-bold text-base leading-tight mb-2 ${isUnlocked ? 'text-stone-900' : 'text-stone-700'}`}>
                                                        {mod.name}
                                                    </h3>
                                                    <p className={`text-xs leading-relaxed ${isUnlocked ? 'text-stone-600' : 'text-stone-500'}`}>
                                                        {mod.description}
                                                    </p>
                                                </div>

                                                {isUnlocked && (
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
                        <p className="text-stone-400 text-sm">Các module đã chọn sẽ khả dụng cho tất cả các kho của doanh nghiệp này.</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="relative z-10 flex items-center gap-3 px-12 py-4 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-500 transition-all text-base shadow-2xl shadow-orange-900/50 active:scale-95 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                        {saving ? 'ĐANG LƯU...' : 'LƯU CẤU HÌNH NGAY'}
                    </button>
                    <div className="absolute right-0 top-0 w-64 h-64 bg-stone-800 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50"></div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={confirmOpen}
                title="Cảnh báo tắt module mặc định"
                message="Đây là module MẶC ĐỊNH quan trọng của hệ thống. Việc tắt module này có thể ảnh hưởng đến quy trình hoạt động cơ bản của kho.\n\nBạn có chắc chắn muốn tiếp tục tắt?"
                confirmText="Vẫn tắt"
                cancelText="Hủy bỏ"
                onConfirm={() => pendingModule && performToggle(pendingModule)}
                onCancel={() => {
                    setConfirmOpen(false)
                    setPendingModule(null)
                }}
                variant="warning"
            />
        </div>
    )
}
