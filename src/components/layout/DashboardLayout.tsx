'use client'
import Sidebar from './Sidebar'
import Header from './Header'
import { SidebarProvider, useSidebar } from './SidebarContext'

function DashboardContent({ children }: { children: React.ReactNode }) {
    const { isCollapsed, isReady } = useSidebar()

    // Use fixed width initially to avoid hydration mismatch (w-16 = 64px, w-56 = 224px)
    const marginLeft = isReady ? (isCollapsed ? 'ml-16' : 'ml-56') : 'ml-16'

    return (
        <div className="min-h-screen font-sans bg-stone-50 text-stone-800">
            <Sidebar />
            <Header />

            <main className={`p-8 transition-all duration-300 ${marginLeft}`}>
                <div className="max-w-7xl mx-auto animate-slide-up">
                    {children}
                </div>
            </main>
        </div>
    )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <DashboardContent>{children}</DashboardContent>
        </SidebarProvider>
    )
}
