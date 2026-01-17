'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User } from '@supabase/supabase-js'
import { Bell, Search, Sparkles } from 'lucide-react'

export default function Header() {
    const [user, setUser] = useState<User | null>(null)

    useEffect(() => {
        async function getUser() {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }
        getUser()
    }, [])

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
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-stone-800 truncate max-w-[150px]">
                            {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Nhân viên'}
                        </p>
                        <div className="flex items-center gap-1.5 justify-end">
                            <Sparkles size={10} className="text-orange-500" />
                            <p className="text-xs text-stone-500">
                                {user ? 'Đang hoạt động' : 'Đang tải...'}
                            </p>
                        </div>
                    </div>

                    {/* Avatar */}
                    <div
                        className="relative h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                        style={{
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)',
                        }}
                    >
                        {user?.email?.[0].toUpperCase() || 'U'}

                        {/* Online indicator */}
                        <span
                            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-green-500"
                            style={{
                                boxShadow: '0 0 6px rgba(34, 197, 94, 0.5)',
                            }}
                        />
                    </div>
                </div>
            </div>
        </header>
    )
}
