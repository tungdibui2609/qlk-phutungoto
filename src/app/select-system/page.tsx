'use client'

import { useSystem } from "@/contexts/SystemContext"
import { useRouter } from "next/navigation"
import { Truck, Package, Factory, BarChart3, Warehouse, Sparkles, ShieldCheck, ArrowRight, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function SelectSystemPage() {
    const { setSystemType, systems } = useSystem()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [allowedSystems, setAllowedSystems] = useState<string[]>([])
    const [companyName, setCompanyName] = useState<string>('Chánh Thu')

    useEffect(() => {
        checkUserPermissions()
        fetchCompanyInfo()
    }, [])

    async function checkUserPermissions() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push('/login')
            return
        }
        const { data: profile } = await (supabase
            .from('user_profiles') as any)
            .select('allowed_systems, permissions, department')
            .eq('id', user.id)
            .maybeSingle()

        if (!profile) {
            setLoading(false)
            return
        }

        let sysList = profile.allowed_systems || []
        const isSuperUser = user.email === 'tungdibui2609@gmail.com'
        const hasFullAccess = profile.permissions && profile.permissions.includes('system.full_access')
        const isSystemDept = profile.department === 'Hệ thống'

        if (isSuperUser || hasFullAccess || isSystemDept) {
            sysList = ['ALL']
        }

        setAllowedSystems(sysList.length > 0 ? sysList : ['DEFAULT', 'KHO_DONG_LANH', 'OFFICE', 'DRY'])
        setLoading(false)
    }

    async function fetchCompanyInfo() {
        const { data } = await (supabase
            .from('company_settings') as any)
            .select('short_name, name')
            .single()

        if (data) {
            setCompanyName(data.short_name || data.name || 'Chánh Thu')
        }
    }

    const handleSelect = (code: string) => {
        setSystemType(code)
        router.push('/')
    }

    const ICON_MAP: any = {
        'FROZEN': Truck,
        'KHO_DONG_LANH': Truck,
        'PACKAGING': Package,
        'MATERIAL': Factory,
        'GENERAL': BarChart3,
        'DEFAULT': Warehouse
    }

    const availableSystems = systems.filter(sys =>
        allowedSystems.includes('ALL') || allowedSystems.includes(sys.code)
    )

    if (loading) {
        return (
            <div className="min-h-screen bg-emerald-950 flex flex-col items-center justify-center gap-3 text-emerald-200">
                <Loader2 className="animate-spin text-emerald-400" size={36} />
                <p className="text-sm font-medium">Đang tải danh sách phân hệ kho...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-emerald-950 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
            {/* Ambient Background Glows */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-emerald-600/20 blur-3xl" />
                <div className="absolute -bottom-[20%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-amber-500/15 blur-3xl" />
            </div>

            <div className="max-w-5xl w-full relative z-10">
                {/* Header */}
                <div className="text-center mb-10 space-y-3">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold tracking-wide uppercase shadow-inner">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        {companyName} • WMS Smart Hub
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                        Chọn Phân Hệ Kho Làm Việc
                    </h1>
                    <p className="text-emerald-100/70 text-sm max-w-md mx-auto">
                        Vui lòng lựa chọn phân hệ kho trực thuộc để tiến hành quản lý nhập xuất tồn và vận hành
                    </p>
                </div>

                {availableSystems.length === 0 ? (
                    <div className="text-center text-rose-300 bg-rose-950/40 border border-rose-500/30 p-8 rounded-3xl backdrop-blur-xl shadow-xl max-w-md mx-auto">
                        <ShieldCheck className="w-12 h-12 text-rose-400 mx-auto mb-3" />
                        <h3 className="font-bold text-lg text-white mb-1">Chưa được cấp quyền</h3>
                        <p className="text-xs text-rose-200/80">
                            Tài khoản của bạn chưa được gán quyền truy cập vào phân hệ kho nào. Vui lòng liên hệ Admin để được cấp quyền.
                        </p>
                    </div>
                ) : (
                    <div className={`grid grid-cols-1 ${availableSystems.length === 1 ? 'md:grid-cols-1 max-w-md mx-auto' : availableSystems.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' : 'md:grid-cols-3'} gap-6`}>
                        {availableSystems.map((sys) => {
                            const Icon = ICON_MAP[sys.code] || Warehouse
                            return (
                                <div
                                    key={sys.code}
                                    className="group relative bg-white/95 hover:bg-white rounded-3xl p-8 cursor-pointer transition-all duration-300 border-2 border-emerald-500/20 hover:border-emerald-500 shadow-xl hover:shadow-2xl hover:shadow-emerald-900/40 hover:-translate-y-1 flex flex-col justify-between"
                                    onClick={() => handleSelect(sys.code)}
                                >
                                    <div>
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-700 border border-emerald-500/30 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-md">
                                            <Icon size={32} strokeWidth={2.2} />
                                        </div>
                                        <h3 className="text-xl font-extrabold text-slate-900 mb-2 group-hover:text-emerald-700 transition-colors">
                                            {sys.name}
                                        </h3>
                                        <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">
                                            {sys.description || 'Hệ thống quản trị kho sầu riêng và bảo quản chuỗi cung ứng'}
                                        </p>
                                    </div>

                                    <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                                        <span>Truy cập phân hệ</span>
                                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
