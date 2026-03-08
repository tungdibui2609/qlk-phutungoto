'use client'
import SanxuatSidebar from './SanxuatSidebar'
import SanxuatHeader from './SanxuatHeader'
import { SidebarProvider, useSidebar } from './SidebarContext'
import { useUser } from '@/contexts/UserContext'
import { SystemProvider } from '@/contexts/SystemContext'
import { usePathname, useRouter } from 'next/navigation'
import { Ban, ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'

function SanxuatContent({ children }: { children: React.ReactNode }) {
    const { isCollapsed, isReady } = useSidebar()
    const [isHeaderVisible, setIsHeaderVisible] = useState(true)

    const marginLeft = isReady ? (isCollapsed ? 'md:ml-16' : 'md:ml-56') : 'md:ml-16'

    return (
        <div className="min-h-screen font-sans bg-stone-50 text-stone-800 relative flex flex-col">
            <SanxuatSidebar />

            {isHeaderVisible ? (
                <SanxuatHeader onCollapse={() => setIsHeaderVisible(false)} />
            ) : (
                <div className={`fixed top-0 right-0 left-0 h-6 z-40 flex justify-center pointer-events-none transition-all duration-300 ${marginLeft}`}>
                    <button
                        onClick={() => setIsHeaderVisible(true)}
                        className="pointer-events-auto bg-white border border-t-0 border-emerald-200 rounded-b-lg px-6 py-1 shadow-md text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center gap-2 text-xs font-medium"
                        title="Hiện thanh công cụ"
                    >
                        <ChevronDown size={14} />
                        Hiện Header
                    </button>
                </div>
            )}

            <main className={`flex-1 p-4 md:p-8 transition-all duration-300 ${marginLeft}`}>
                <div className="max-w-7xl mx-auto animate-slide-up">
                    <SanxuatRouteProtector>{children}</SanxuatRouteProtector>
                </div>
            </main>
        </div>
    )
}

function SanxuatRouteProtector({ children }: { children: React.ReactNode }) {
    const { profile, isLoading } = useUser()
    const router = useRouter()
    const pathname = usePathname()

    // Auth gate specific to Sanxuat
    useEffect(() => {
        if (!isLoading && profile) {
            const isSuperUser = profile.email === 'tungdibui2609@gmail.com'
            const isCompanyAdmin = profile.account_level && profile.account_level <= 2
            const hasSanxuatAccess = profile.allowed_systems?.includes('SANXUAT')

            if (!isSuperUser && !isCompanyAdmin && !hasSanxuatAccess) {
                router.replace('/sanxuat/login?error=unauthorized_domain')
            }
        }
    }, [isLoading, profile, router])

    if (isLoading) return null

    // We block if they are basic warehouse staff without SANXUAT access
    const isSuperUser = profile?.email === 'tungdibui2609@gmail.com'
    const isCompanyAdmin = profile?.account_level && profile?.account_level <= 2
    const hasSanxuatAccess = profile?.allowed_systems?.includes('SANXUAT')

    if (!isSuperUser && !isCompanyAdmin && !hasSanxuatAccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="bg-red-50 p-6 rounded-full mb-6">
                    <Ban className="w-16 h-16 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-stone-800 mb-2">Truy cập hệ thống sản xuất bị chặn</h1>
                <p className="text-stone-500 max-w-md">
                    Bạn không có quyền truy cập vào phân hệ sản xuất.<br />
                    Vui lòng liên hệ quản trị viên công ty để được cấp quyền allowed_systems = "SANXUAT".
                </p>
            </div>
        )
    }

    return <>{children}</>
}

export default function SanxuatDashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <SystemProvider>
            <SidebarProvider>
                <SanxuatContent>{children}</SanxuatContent>
            </SidebarProvider>
        </SystemProvider>
    )
}
