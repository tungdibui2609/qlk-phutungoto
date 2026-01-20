'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User } from '@supabase/supabase-js'
import { Bell, Search, Sparkles, LogOut, Key, Camera, ChevronDown, RefreshCw, LayoutGrid, Menu, PanelLeftClose, PanelLeftOpen, ChevronUp } from 'lucide-react'
import { useSystem, SystemType } from '@/contexts/SystemContext'
import { useSidebar } from './SidebarContext'
import { useUser } from '@/contexts/UserContext'
import ChangePasswordModal from '@/components/auth/ChangePasswordModal'
import ChangeAvatarModal from '@/components/auth/ChangeAvatarModal'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/ToastProvider'

export default function Header({ onCollapse }: { onCollapse?: () => void }) {
    const router = useRouter()
    const { isCollapsed, toggleSidebar, isReady } = useSidebar()
    const { user, profile, hasPermission } = useUser()
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [showAvatarModal, setShowAvatarModal] = useState(false)
    const { showToast } = useToast()
    const { systemType, setSystemType, systems } = useSystem()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    // Dynamic margin match Sidebar
    const marginLeft = isReady ? (isCollapsed ? 'ml-16' : 'ml-56') : 'ml-16'

    return (
        <header
            className={`h-20 flex items-center justify-between px-6 sticky top-0 z-40 bg-white border-b border-stone-200 transition-all duration-300 ${marginLeft}`}
            style={{
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
        >
            {/* LEFT: SYSTEM SWITCHER */}
            <div className="flex items-center gap-4 flex-1">


                {/* HEADER COLLAPSE BUTTON (Replaces Sidebar Toggle Logic or sits nearby? User asked for close button) */}
                {/* Actually user asked to close the HEADER so we add a ChevronUp here */}
                {onCollapse && (
                    <button
                        onClick={onCollapse}
                        className="p-2 rounded-lg text-stone-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                        title="Thu gọn Header"
                    >
                        <ChevronUp size={20} />
                    </button>
                )}
                <div className="relative">
                    {/* LEFT: SYSTEM SWITCHER - TABS STYLE */}
                    <div className="flex items-center flex-1 overflow-x-auto no-scrollbar gap-2 mr-4">
                        {systems.map((sys) => {
                            const isActive = systemType === sys.code
                            // 3. User Permission Logic
                            const allowed = profile?.allowed_systems || []
                            const isAllowed =
                                hasPermission('system.full_access') ||
                                allowed.includes('ALL') ||
                                allowed.includes(sys.code)

                            // Parse color from class or fallback (Rough heuristic or update DB to be simpler)
                            // DB has 'bg-blue-600'. Let's just use gray/black for generic if dynamic.
                            // Or standard styles.

                            return (
                                <button
                                    key={sys.code}
                                    onClick={() => {
                                        if (isAllowed) {
                                            setSystemType(sys.code)
                                            router.push('/')
                                        } else {
                                            showToast(`Bạn không có quyền truy cập vào ${sys.name}`, 'error')
                                        }
                                    }}
                                    className={`
                                        flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 whitespace-nowrap
                                        ${isActive
                                            ? `bg-orange-50 border-orange-200 text-orange-700 shadow-sm ring-1 ring-orange-100`
                                            : isAllowed
                                                ? 'bg-transparent border-transparent text-stone-500 hover:bg-stone-50 hover:text-stone-700'
                                                : 'bg-stone-50 border-transparent text-stone-300 cursor-not-allowed opacity-60'
                                        }
                                    `}
                                >
                                    <span className={`w-2 h-2 rounded-full ${isActive ? `bg-orange-500` : isAllowed ? 'bg-stone-300' : 'bg-stone-200'}`} />
                                    {sys.name}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* RIGHT: USER INFO & NOTIFICATIONS */}
            <div className="flex items-center gap-4">
                {/* Notification Button */}
                <button
                    className="relative p-3 rounded-xl bg-stone-50 border border-stone-200 text-stone-500 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200"
                >
                    <Bell size={20} />
                    <span
                        className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500"
                        style={{
                            boxShadow: '0 0 6px rgba(239, 68, 68, 0.5)',
                        }}
                    />
                </button>

                {/* Divider */}
                <div className="h-10 w-px bg-stone-200" />

                {/* User Profile */}
                <div className="relative">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex items-center gap-3 focus:outline-none"
                    >
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold text-stone-800 truncate max-w-[150px]">
                                {profile?.full_name || user?.user_metadata?.full_name || 'Nhân viên'}
                            </p>
                            <div className="flex items-center gap-1.5 justify-end">
                                <p className="text-xs text-stone-500 font-medium bg-stone-100 px-1.5 py-0.5 rounded">
                                    {(profile as any)?.roles?.name || 'Chưa cập nhật'}
                                </p>
                            </div>
                        </div>

                        {/* Avatar */}
                        <div
                            className="relative h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold text-lg overflow-hidden"
                            style={{
                                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)',
                            }}
                        >
                            {user?.user_metadata?.avatar_url ? (
                                <img
                                    src={user.user_metadata.avatar_url}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span>{user?.email?.[0].toUpperCase() || 'U'}</span>
                            )}

                            {/* Online indicator */}
                            <span
                                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-green-500"
                                style={{
                                    boxShadow: '0 0 6px rgba(34, 197, 94, 0.5)',
                                }}
                            />
                        </div>
                        <ChevronDown size={16} className={`text-stone-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsMenuOpen(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-100 z-50 py-1 overflow-hidden animate-slide-up">
                                <button
                                    onClick={() => {
                                        setShowAvatarModal(true)
                                        setIsMenuOpen(false)
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-stone-600 hover:bg-orange-50 hover:text-orange-600 flex items-center gap-2 transition-colors"
                                >
                                    <Camera size={16} />
                                    Đổi ảnh đại diện
                                </button>
                                <button
                                    onClick={() => {
                                        setShowPasswordModal(true)
                                        setIsMenuOpen(false)
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-stone-600 hover:bg-orange-50 hover:text-orange-600 flex items-center gap-2 transition-colors"
                                >
                                    <Key size={16} />
                                    Đổi mật khẩu
                                </button>
                                <div className="h-px bg-stone-100 my-1" />
                                <button
                                    onClick={handleLogout}
                                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                >
                                    <LogOut size={16} />
                                    Đăng xuất
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <ChangePasswordModal
                    isOpen={showPasswordModal}
                    onClose={() => setShowPasswordModal(false)}
                />

                <ChangeAvatarModal
                    isOpen={showAvatarModal}
                    onClose={() => setShowAvatarModal(false)}
                    currentUser={user}
                />
            </div>
        </header>
    )
}
