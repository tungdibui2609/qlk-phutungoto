'use client'

import { useSystem, SystemType } from "@/contexts/SystemContext"
import { useRouter } from "next/navigation"
import { Truck, Package, Factory, BarChart3 } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function SelectSystemPage() {
    const { setSystemType } = useSystem()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [allowedSystems, setAllowedSystems] = useState<string[]>([])
    const [companyName, setCompanyName] = useState<string>('Toàn Thắng')

    useEffect(() => {
        checkUserPermissions()
        fetchCompanyInfo()
    }, [])

    async function fetchCompanyInfo() {
        const { data } = await (supabase
            .from('company_settings') as any)
            .select('short_name')
            .single()

        if (data && data.short_name) {
            setCompanyName(data.short_name)
        }
    }

    async function checkUserPermissions() {
        // ... (existing code)
        // 1. Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push('/login')
            return
        }

        // 2. Get user profile with allowed_systems
        const { data: profile } = await (supabase
            .from('user_profiles') as any)
            .select('allowed_systems')
            .eq('id', user.id)
            .single()

        if (profile?.allowed_systems) {
            setAllowedSystems(profile.allowed_systems)
        } else {
            // Default fallback if no specific setting (e.g. for old users)
            // You might want to default to ALL or NONE. Let's default to FROZEN for safety or check role.
            setAllowedSystems(['FROZEN', 'PACKAGING', 'MATERIAL', 'GENERAL'])
        }
        setLoading(false)
    }

    const handleSelect = (type: SystemType) => {
        setSystemType(type)
        router.push('/')
    }

    const allSystems = [
        {
            id: 'FROZEN' as SystemType,
            name: 'Kho Đông Lạnh',
            description: 'Quản lý trái cây, hàng đông lạnh. Theo dõi Date, Lô.',
            icon: <Truck className="h-12 w-12 text-blue-500 mb-4" />,
            color: 'hover:border-blue-500 hover:bg-blue-50 border-transparent',
        },
        {
            id: 'PACKAGING' as SystemType,
            name: 'Kho Bao Bì',
            description: 'Quản lý thùng, hộp, tem nhãn. Theo dõi số lượng, quy cách.',
            icon: <Package className="h-12 w-12 text-amber-500 mb-4" />,
            color: 'hover:border-amber-500 hover:bg-amber-50 border-transparent',
        },
        {
            id: 'MATERIAL' as SystemType,
            name: 'Kho Nguyên Liệu',
            description: 'Quản lý nguyên liệu sản xuất. Theo dõi nguồn gốc, Date.',
            icon: <Factory className="h-12 w-12 text-emerald-500 mb-4" />,
            color: 'hover:border-emerald-500 hover:bg-emerald-50 border-transparent',
        },
        {
            id: 'GENERAL' as SystemType,
            name: 'Tổng Hợp',
            description: 'Báo cáo tổng quan tất cả các kho. Dành cho ban giám đốc.',
            icon: <BarChart3 className="h-12 w-12 text-purple-500 mb-4" />,
            color: 'hover:border-purple-500 hover:bg-purple-50 border-transparent',
        },
    ]

    // Filter systems
    const availableSystems = allSystems.filter(sys =>
        allowedSystems.includes('ALL') || allowedSystems.includes(sys.id)
    )

    if (loading) {
        return (
            <div className="min-h-screen bg-stone-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
            <div className="max-w-5xl w-full">
                <h1 className="text-3xl font-bold text-center mb-2 text-stone-800">Hệ Thống Quản Lý Kho {companyName}</h1>
                <p className="text-center text-stone-500 mb-10">Vui lòng chọn phân hệ làm việc</p>

                {availableSystems.length === 0 ? (
                    <div className="text-center text-red-500 bg-white p-8 rounded-xl shadow">
                        Bạn chưa được cấp quyền truy cập vào bất kỳ kho nào. Link hệ Admin.
                    </div>
                ) : (
                    <div className={`grid grid-cols-1 ${availableSystems.length === 1 ? 'md:grid-cols-1 max-w-md mx-auto' : 'md:grid-cols-2'} gap-6`}>
                        {availableSystems.map((sys) => (
                            <div
                                key={sys.id}
                                className={`bg-white rounded-xl p-8 cursor-pointer transition-all duration-200 border-2 shadow-sm hover:shadow-md flex flex-col items-center text-center ${sys.color}`}
                                onClick={() => handleSelect(sys.id)}
                            >
                                <div className="mb-4">{sys.icon}</div>
                                <h3 className="text-xl font-bold text-stone-800 mb-2">{sys.name}</h3>
                                <p className="text-stone-500">{sys.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
