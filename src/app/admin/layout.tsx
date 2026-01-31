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
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-amber-500" size={32} />
            </div>
        )
    }

    // For Login page, render clean
    if (pathname === '/admin/login') {
        return <>{children}</>
    }

    // For Dashboard pages, render with Admin Header
    // Color scheme: Gold/Amber (Thổ sinh Kim) + Slate (Kim bản mệnh) - Phong thủy mệnh Kim
    return (
        <div className="min-h-screen bg-slate-50">
            {/* Admin Header */}
            <header className="bg-white border-b border-slate-200 h-16 px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-amber-400 to-yellow-500 text-white p-2 rounded-lg shadow-lg shadow-amber-200/50">
                        <ShieldAlert size={20} />
                    </div>
                    <span className="font-bold text-lg text-slate-800">Super Admin Portal</span>
                </div>

                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-3 p-1.5 pl-3 pr-2 rounded-lg hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
                    >
                        <div className="text-right hidden md:block">
                            <div className="text-sm font-semibold text-slate-700">Super Admin</div>
                            <div className="text-xs text-amber-600">{profile?.email}</div>
                        </div>
                        <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 border border-amber-200 overflow-hidden relative">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <User size={18} />
                            )}
                        </div>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 animate-scale-in origin-top-right z-50">
                            <div className="px-4 py-2 border-b border-slate-100 md:hidden">
                                <div className="text-sm font-semibold text-slate-700">Super Admin</div>
                                <div className="text-xs text-slate-500">{profile?.email}</div>
                            </div>

                            <button
                                onClick={() => { setIsAvatarModalOpen(true); setIsDropdownOpen(false); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 hover:text-slate-900"
                            >
                                <Camera size={16} />
                                Cập nhật Avatar
                            </button>

                            <button
                                onClick={() => { setIsPasswordModalOpen(true); setIsDropdownOpen(false); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 hover:text-slate-900"
                            >
                                <Lock size={16} />
                                Đổi mật khẩu
                            </button>

                            <div className="h-px bg-slate-100 my-1"></div>

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
