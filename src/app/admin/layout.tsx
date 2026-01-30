'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { Loader2, ShieldAlert, LogOut, Lock, ChevronDown, User, Camera } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import ChangePasswordModal from '@/components/admin/ChangePasswordModal'
import ChangeAvatarModal from '@/components/admin/ChangeAvatarModal'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { profile, isLoading } = useUser()
    const router = useRouter()
    const pathname = usePathname()
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (isLoading) return

        const isLoginPage = pathname === '/admin/login'

        if (!profile) {
            if (!isLoginPage) {
                router.push('/admin/login')
            } else {
                setIsAuthorized(true)
            }
            return
        }

        // Strict Super Admin Check
        if (profile.email !== 'tungdibui2609@gmail.com') {
            // If logged in but not admin, kick out to main app or show error
            router.push('/') // Redirect standard users to main app
            return
        }

        // Is Admin
        if (isLoginPage) {
            router.push('/admin/dashboard')
        } else {
            setIsAuthorized(true)
        }

    }, [profile, isLoading, pathname, router])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/admin/login')
    }

    if (isLoading || !isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <Loader2 className="animate-spin text-orange-600" size={32} />
            </div>
        )
    }

    // For Login page, render clean
    if (pathname === '/admin/login') {
        return <>{children}</>
    }

    // For Dashboard pages, render with Admin Header
    return (
        <div className="min-h-screen bg-white">
            {/* Admin Header */}
            <header className="bg-white border-b border-emerald-100 h-16 px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-orange-600 text-white p-2 rounded-lg">
                        <ShieldAlert size={20} />
                    </div>
                    <span className="font-bold text-lg text-emerald-800">Super Admin Portal</span>
                </div>

                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-3 p-1.5 pl-3 pr-2 rounded-lg hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
                    >
                        <div className="text-right hidden md:block">
                            <div className="text-sm font-semibold text-emerald-700">Super Admin</div>
                            <div className="text-xs text-orange-500">{profile?.email}</div>
                        </div>
                        <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 border border-orange-200 overflow-hidden relative">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <User size={18} />
                            )}
                        </div>
                        <ChevronDown size={14} className={`text-emerald-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-emerald-100 py-2 animate-scale-in origin-top-right z-50">
                            <div className="px-4 py-2 border-b border-emerald-50 md:hidden">
                                <div className="text-sm font-semibold text-emerald-700">Super Admin</div>
                                <div className="text-xs text-emerald-500">{profile?.email}</div>
                            </div>

                            <button
                                onClick={() => { setIsAvatarModalOpen(true); setIsDropdownOpen(false); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 hover:text-emerald-900"
                            >
                                <Camera size={16} />
                                Cập nhật Avatar
                            </button>

                            <button
                                onClick={() => { setIsPasswordModalOpen(true); setIsDropdownOpen(false); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 hover:text-emerald-900"
                            >
                                <Lock size={16} />
                                Đổi mật khẩu
                            </button>

                            <div className="h-px bg-emerald-50 my-1"></div>

                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
                            >
                                <LogOut size={16} />
                                Đăng xuất
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main>
                {children}
            </main>

            {isPasswordModalOpen && (
                <ChangePasswordModal onClose={() => setIsPasswordModalOpen(false)} />
            )}

            {isAvatarModalOpen && (
                <ChangeAvatarModal onClose={() => setIsAvatarModalOpen(false)} />
            )}
        </div>
    )
}
