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
import SystemModuleConfig from '@/components/admin/SystemModuleConfig'

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
    ...UTILITY_MODULES.map(m => ({ ...m, category: m.category === 'info' ? 'Thông tin' : 'Tiện ích hệ thống' }))
]

export default function CompanyModulesPage() {
    const { id } = useParams()
    const router = useRouter()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [systems, setSystems] = useState<any[]>([])
    const [viewMode, setViewMode] = useState<'license' | 'system'>('license')
    const [selectedSystem, setSelectedSystem] = useState<any>(null)

    const [company, setCompany] = useState<Company | null>(null)
    const [unlockedModules, setUnlockedModules] = useState<string[]>([])
    const [filter, setFilter] = useState<'all' | 'basic' | 'advanced'>('all')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [basicModuleIds, setBasicModuleIds] = useState<string[]>([])

    useEffect(() => {
        const fetchBasic = async () => {
            const { data } = await supabase.from('app_modules').select('id').eq('is_basic', true)
            if (data) setBasicModuleIds(data.map(x => x.id))
        }
        fetchBasic()
    }, [])

    // Confirmation State
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [pendingModule, setPendingModule] = useState<string | null>(null)

    useEffect(() => {
        if (id) {
            fetchData()
            fetchSystems()
        }
    }, [id])

    async function fetchSystems() {
        const { data } = await supabase.from('systems').select('*').eq('company_id', id as string).order('sort_order')
        setSystems(data || [])
    }

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
        // Check dynamic Basic status
        const isBasic = basicModuleIds.includes(moduleId)

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
            // router.push('/admin/dashboard')
        } catch (error: any) {
            console.error('Error saving modules:', error)
            showToast('Lỗi khi lưu: ' + (error.message || error), 'error')
        } finally {
            setSaving(false)
        }
    }

    // Color scheme: Gold/Amber (Thổ sinh Kim) + Slate (Kim bản mệnh) - Phong thủy mệnh Kim
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
                <div className="w-12 h-12 border-4 border-amber-100 border-t-amber-500 rounded-full animate-spin"></div>
                <p className="text-slate-600 font-medium text-lg">Đang tải cấu hình...</p>
            </div>
        )
    }

    if (!company) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
                <p className="text-slate-700 font-bold text-xl">Không tìm thấy thông tin công ty</p>
                <Link href="/admin/dashboard" className="text-amber-600 hover:underline font-medium">Quay lại Dashboard</Link>
            </div>
        )
    }

    // Render Config View if System Selected
    if (selectedSystem && viewMode === 'system') {
        return (
            <div className="min-h-screen bg-slate-50 pb-20">
                <SystemModuleConfig
                    systemId={selectedSystem.id}
                    companyId={company.id}
                    systemName={selectedSystem.name}
                    onBack={() => {
                        setSelectedSystem(null)
                        // Optionally re-fetch licenses if they changed
                        fetchData()
                    }}
                />
            </div>
        )
    }

    const categories = Array.from(new Set(ALL_MODULES.map(m => m.category)))

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 md:px-6 pt-3 md:pt-4 pb-0 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/admin/dashboard"
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors group"
                            >
                                <ArrowLeft size={24} className="text-slate-500 group-hover:text-slate-700" />
                            </Link>
                            <div>
                                <h1 className="text-xl md:text-2xl font-black text-slate-800 leading-none">Cấu hình Module Dịch vụ</h1>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] md:text-xs font-bold rounded uppercase tracking-wider">Doanh nghiệp</span>
                                    <p className="text-xs md:text-sm font-bold text-slate-600 truncate max-w-[200px] md:max-w-none">{company.name}</p>
                                </div>
                            </div>
                        </div>

                        {viewMode === 'license' && (
                            <div className="flex gap-3 w-full md:w-auto">
                                <div className="relative flex-1 md:w-72">
                                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                                        <Search size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm module..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                    />
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-yellow-600 active:scale-95 transition-all text-sm shadow-xl shadow-amber-200/50 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                    {saving ? 'Đang lưu' : 'Lưu Thay Đổi'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-8 mt-2">
                        <button
                            onClick={() => setViewMode('license')}
                            className={`pb-3 text-sm font-bold border-b-2 transition-all ${viewMode === 'license' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            License Tổng (Subscription)
                        </button>
                        <button
                            onClick={() => setViewMode('system')}
                            className={`pb-3 text-sm font-bold border-b-2 transition-all ${viewMode === 'system' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Cấu hình Kho hàng (Config)
                        </button>
                    </div>

                    {viewMode === 'license' && (
                        <div className="flex flex-wrap gap-2 pb-4 mt-2">
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold border transition-all ${selectedCategory === 'all' ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                            >
                                Tất cả
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold border transition-all ${selectedCategory === cat ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6 md:mt-10">
                {viewMode === 'license' ? (
                    <div className="space-y-12">
                        {categories
                            .filter(cat => selectedCategory === 'all' || selectedCategory === cat)
                            .map(cat => (
                                <section key={cat} className="space-y-4">
                                    <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                            {(cat === 'Nhập kho' || cat === 'Xuất kho' || cat === 'Sản phẩm') && <Package size={18} />}
                                            {cat === 'Quản lý LOT' && <Archive size={18} />}
                                            {cat === 'Dashboard' && <LayoutDashboard size={18} />}
                                            {cat === 'Tiện ích hệ thống' && <Cog size={18} />}
                                            {cat === 'Thông tin' && <Shield size={18} />}
                                        </div>
                                        <h2 className="text-base md:text-lg font-bold text-slate-700 uppercase tracking-wide">{cat}</h2>
                                        <span className="text-[10px] md:text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                                            {ALL_MODULES.filter(m => m.category === cat).length} module
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                        {ALL_MODULES.filter(m => m.category === cat).filter(m => {
                                            const CORE_HIDDEN: string[] = ['inbound_basic', 'inbound_supplier', 'outbound_basic', 'outbound_customer', 'warehouse_name', 'images']
                                            if (CORE_HIDDEN.includes(m.id)) return false
                                            return !searchTerm || m.name.toLowerCase().includes(searchTerm.toLowerCase())
                                        })
                                            .sort((a, b) => {
                                                // Sort by Basic first
                                                const aBasic = basicModuleIds.includes(a.id) ? 1 : 0
                                                const bBasic = basicModuleIds.includes(b.id) ? 1 : 0
                                                return bBasic - aBasic
                                            })
                                            .map(mod => {
                                                const isBasic = basicModuleIds.includes(mod.id)
                                                const isUnlocked = unlockedModules.includes(mod.id)


                                                return (
                                                    <div
                                                        key={mod.id}
                                                        onClick={() => handleToggle(mod.id)}
                                                        className={`
                                                relative flex flex-col p-3 rounded-xl border transition-all cursor-pointer select-none
                                                ${isUnlocked
                                                                ? 'bg-amber-50/50 border-amber-400 shadow-sm shadow-amber-100'
                                                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all'
                                                            }
                                            `}
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className={`p-1.5 rounded-md ${isUnlocked ? 'bg-gradient-to-br from-amber-500 to-yellow-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                                <mod.icon size={14} />
                                                            </div>
                                                            <div className={`
                                                        w-8 h-4 rounded-full relative transition-colors
                                                        ${isUnlocked ? 'bg-gradient-to-r from-amber-500 to-yellow-500' : 'bg-slate-200'}
                                                    `}>
                                                                <div className={`
                                                            absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform
                                                            ${isUnlocked ? 'translate-x-[18px]' : 'translate-x-[2px]'}
                                                        `}></div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="flex items-center gap-1 mb-1">
                                                                <h3 className={`font-bold text-sm leading-tight ${isUnlocked ? 'text-slate-800' : 'text-slate-600'}`}>
                                                                    {mod.name}
                                                                </h3>
                                                                {isBasic && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1 rounded">DEFAULT</span>}
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                                                                {mod.description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                    </div>
                                </section>
                            ))}
                    </div>
                ) : (
                    // SYSTEMS LIST VIEW
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {systems.map(sys => (
                                <div
                                    key={sys.id}
                                    onClick={() => setSelectedSystem(sys)}
                                    className="bg-white p-5 rounded-xl border border-slate-200 hover:border-amber-400 cursor-pointer shadow-sm hover:shadow-lg transition-all group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-transparent to-amber-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>

                                    <div className="flex justify-between items-start relative z-10">
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-800 group-hover:text-amber-700 transition-colors">{sys.name}</h3>
                                            <p className="text-xs text-slate-500 font-mono mt-1 bg-slate-100 inline-block px-1.5 py-0.5 rounded">{sys.code}</p>
                                        </div>
                                        <span className="p-2 bg-slate-100 rounded-lg group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                                            <Cog size={20} />
                                        </span>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                                        <span className="text-xs text-slate-500 font-medium">Bấm để cấu hình</span>
                                        <ArrowLeft size={14} className="text-amber-500 rotate-180 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {systems.length === 0 && (
                            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-slate-300">
                                <Package className="text-slate-300 mb-3" size={48} />
                                <p className="text-slate-500 font-medium">Chưa có kho hàng nào được tạo cho công ty này.</p>
                            </div>
                        )}
                    </div>
                )}
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

