'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User } from '@supabase/supabase-js'
import { LogOut, Key, Camera, ChevronDown, Menu, ChevronUp } from 'lucide-react'
import { useSidebar } from './SidebarContext'
import { useUser } from '@/contexts/UserContext'
import ChangePasswordModal from '@/components/auth/ChangePasswordModal'
import ChangeAvatarModal from '@/components/auth/ChangeAvatarModal'
import { useRouter } from 'next/navigation'

export default function SanxuatHeader({ onCollapse }: { onCollapse?: () => void }) {
    const router = useRouter()
    const { isCollapsed, isReady, setMobileMenuOpen } = useSidebar()
    const { user, profile } = useUser()
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [showAvatarModal, setShowAvatarModal] = useState(false)

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/sanxuat/login')
    }

    const marginLeft = isReady ? (isCollapsed ? 'md:ml-16' : 'md:ml-56') : 'md:ml-16'

    return (
        <header
            className={`h-16 md:h-20 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40 bg-white border-b border-stone-200 transition-all duration-300 ${marginLeft}`}
            style={{
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
        >
            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="p-2 -ml-2 rounded-lg text-stone-500 hover:bg-stone-100 md:hidden shrink-0"
                >
                    <Menu size={24} />
                </button>

                {onCollapse && (
                    <button
                        onClick={onCollapse}
                        className="p-2 rounded-lg text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Thu gọn Header"
                    >
                        <ChevronUp size={20} />
                    </button>
                )}
                <div className="hidden md:flex flex-col">
                    <h2 className="text-lg font-bold text-stone-800 leading-tight">Phân Hệ Sản Xuất</h2>
                    <p className="text-xs text-stone-400 hidden lg:block">Quản lý định mức và lệnh sản xuất nội bộ</p>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 shrink-0">
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
                                <p className="text-xs text-stone-500 font-medium bg-stone-100 px-1.5 py-0.5 rounded text-emerald-600">
                                    Thành viên Sản Xuất
                                </p>
                            </div>
                        </div>

                        <div
                            className="relative h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold text-lg overflow-hidden"
                            style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
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
                            <span
                                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-green-500"
                                style={{
                                    boxShadow: '0 0 6px rgba(34, 197, 94, 0.5)',
                                }}
                            />
                        </div>
                        <ChevronDown size={16} className={`text-stone-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

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
                                    className="w-full px-4 py-2.5 text-left text-sm text-stone-600 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2 transition-colors"
                                >
                                    <Camera size={16} />
                                    Đổi ảnh đại diện
                                </button>
                                <button
                                    onClick={() => {
                                        setShowPasswordModal(true)
                                        setIsMenuOpen(false)
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-stone-600 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2 transition-colors"
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
                    currentUser={user as User | null}
                />
            </div>
        </header>
    )
}
