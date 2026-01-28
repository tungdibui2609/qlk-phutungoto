'use client'

import { useSystem, SystemType } from "@/contexts/SystemContext"
import { useRouter } from "next/navigation"
import { Truck, Package, Factory, BarChart3 } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function SelectSystemPage() {
    const { setSystemType, systems } = useSystem()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [allowedSystems, setAllowedSystems] = useState<string[]>([])
    const [companyName, setCompanyName] = useState<string>('Toàn Thắng')

    useEffect(() => {
        checkUserPermissions()
        fetchCompanyInfo()
    }, [])

    // ... (keep helper functions)

    async function checkUserPermissions() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push('/login')
            return
        }
        const { data: profile } = await (supabase
            .from('user_profiles') as any)
            .select('allowed_systems, permissions') // Added permissions
            .eq('id', user.id)
            .maybeSingle() // Use maybeSingle to avoid 406 error on older supabase adapters

        if (!profile) {
            setLoading(false)
            return
        }

        // Check for full access permission
        let systems = profile.allowed_systems || []

        // Super Admin bypass or Permission check
        if ((profile.permissions && profile.permissions.includes('system.full_access')) ||
            user.email === 'tungdibui2609@gmail.com') {
            systems = ['ALL']
        }

        setAllowedSystems(systems.length > 0 ? systems : ['FROZEN', 'OFFICE', 'DRY']) // Fallback to defaults if empty but valid user
        setLoading(false)
    }

    async function fetchCompanyInfo() {
        const { data } = await (supabase
            .from('company_settings') as any)
            .select('short_name')
            .single()

        if (data && data.short_name) {
            setCompanyName(data.short_name)
        }
    }

    const handleSelect = (code: string) => {
        setSystemType(code)
        router.push('/')
    }

    // Helper for icons
    const ICON_MAP: any = {
        'FROZEN': Truck,
        'PACKAGING': Package,
        'MATERIAL': Factory,
        'GENERAL': BarChart3
    }

    // Helper to get color theme based on bg_color_class from DB
    // Expected DB: bg-blue-600 -> blue
    function getThemeColor(bgClass: string = 'bg-gray-600') {
        if (bgClass.includes('blue')) return 'blue'
        if (bgClass.includes('amber') || bgClass.includes('yellow')) return 'amber'
        if (bgClass.includes('green') || bgClass.includes('emerald')) return 'emerald'
        if (bgClass.includes('purple')) return 'purple'
        return 'stone'
    }

    const availableSystems = systems.filter(sys =>
        allowedSystems.includes('ALL') || allowedSystems.includes(sys.code)
    ).map(sys => {
        const theme = getThemeColor(sys.bg_color_class)
        const Icon = ICON_MAP[sys.code] || Package // Default icon
        return {
            ...sys,
            iconComponent: <Icon className={`h-12 w-12 text-${theme}-500 mb-4`} />,
            colorClass: `hover:border-${theme}-500 hover:bg-${theme}-50 border-transparent`
        }
    })



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
                                key={sys.code}
                                className={`bg-white rounded-xl p-8 cursor-pointer transition-all duration-200 border-2 shadow-sm hover:shadow-md flex flex-col items-center text-center ${sys.colorClass}`}
                                onClick={() => handleSelect(sys.code)}
                            >
                                <div className="mb-4">{sys.iconComponent}</div>
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
