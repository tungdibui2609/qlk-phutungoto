'use client'
import Sidebar from './Sidebar'
import Header from './Header'
import { SidebarProvider, useSidebar } from './SidebarContext'
import { useUser } from '@/contexts/UserContext'
import { usePathname } from 'next/navigation'
import { Ban, ChevronDown } from 'lucide-react'
import { useState } from 'react'

function DashboardContent({ children }: { children: React.ReactNode }) {
    const { isCollapsed, isReady } = useSidebar()
    const [isHeaderVisible, setIsHeaderVisible] = useState(true)

    // Use fixed width initially to avoid hydration mismatch (w-16 = 64px, w-56 = 224px)
    const marginLeft = isReady ? (isCollapsed ? 'md:ml-16' : 'md:ml-56') : 'md:ml-16'

    return (
        <div className="min-h-screen font-sans bg-stone-50 text-stone-800 relative">
            <Sidebar />

            {isHeaderVisible ? (
                <Header onCollapse={() => setIsHeaderVisible(false)} />
            ) : (
                <div className={`fixed top-0 right-0 left-0 h-6 z-40 flex justify-center pointer-events-none transition-all duration-300 ${marginLeft}`}>
                    <button
                        onClick={() => setIsHeaderVisible(true)}
                        className="pointer-events-auto bg-white border border-t-0 border-orange-200 rounded-b-lg px-6 py-1 shadow-md text-stone-500 hover:text-orange-600 hover:bg-orange-50 transition-all flex items-center gap-2 text-xs font-medium"
                        title="Hiện thanh công cụ"
                    >
                        <ChevronDown size={14} />
                        Hiện Header
                    </button>
                </div>
            )}

            <main className={`p-8 transition-all duration-300 ${marginLeft}`}>
                <div className="max-w-7xl mx-auto animate-slide-up">
                    <RouteProtector>{children}</RouteProtector>
                </div>
            </main>
        </div>
    )
}

function RouteProtector({ children }: { children: React.ReactNode }) {
    const { isRouteBlocked, isLoading } = useUser()
    const pathname = usePathname()

    if (isLoading) return null // Or skeleton

    if (isRouteBlocked(pathname)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="bg-red-50 p-6 rounded-full mb-6">
                    <Ban className="w-16 h-16 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-stone-800 mb-2">Truy cập bị chặn</h1>
                <p className="text-stone-500 max-w-md">
                    Bạn không có quyền truy cập vào trang này ({pathname}). <br />
                    Vui lòng liên hệ quản trị viên nếu bạn nghĩ đây là một sự nhầm lẫn.
                </p>
            </div>
        )
    }

    return <>{children}</>
}


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <DashboardContent>{children}</DashboardContent>
        </SidebarProvider>
    )
}
