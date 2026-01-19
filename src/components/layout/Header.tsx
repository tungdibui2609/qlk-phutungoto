'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User } from '@supabase/supabase-js'
import { Bell, Search, Sparkles, LogOut, Key, Camera, ChevronDown } from 'lucide-react'
import ChangePasswordModal from '@/components/auth/ChangePasswordModal'
import ChangeAvatarModal from '@/components/auth/ChangeAvatarModal'
import { useRouter } from 'next/navigation'

export default function Header() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<any>(null)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [showAvatarModal, setShowAvatarModal] = useState(false)

    useEffect(() => {
        async function getUser() {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            if (user) {
                const { data } = await supabase
                    .from('user_profiles')
                    .select('full_name, avatar_url, roles(name)')
                    .eq('id', user.id)
                    .single()
                setProfile(data)
            }
        }
        getUser()
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <header
            className="h-20 flex items-center justify-between px-8 sticky top-0 z-40 ml-64 bg-white border-b border-stone-200 transition-all duration-300"
            style={{
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
        >
            {/* LEFT: SEARCH */}
            <div className="flex items-center flex-1">
                <div className="relative w-full max-w-md hidden md:block">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm phụ tùng, mã đơn hàng..."
                        className="w-full pl-12 pr-4 py-3 rounded-xl text-sm transition-all duration-200 outline-none bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
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
