'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { LogIn, Mail, Lock, Loader2, ShieldAlert } from 'lucide-react'

export default function AdminLoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null)

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            // Strict Email Check for Admin Login
            if (email.toLowerCase().trim() !== 'tungdibui2609@gmail.com') {
                throw new Error('Email này không có quyền truy cập trang quản trị.')
            }

            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            })
            if (error) throw error

            // Force redirect to companies page
            router.push('/admin/dashboard')
        } catch (error: any) {
            setMessage({ text: error.message, type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    // Color scheme: Gold/Amber (Thổ sinh Kim) + Slate (Kim bản mệnh) - Phong thủy mệnh Kim
    return (
        <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
            {/* Background Pattern - Gold/Amber grid for wealth and prosperity */}
            <div className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: `linear-gradient(#fbbf24 1px, transparent 1px), linear-gradient(90deg, #fbbf24 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            />

            {/* Decorative gold glow */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl"></div>

            {/* Login Card */}
            <div className="w-full max-w-md relative bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-10 shadow-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/30">
                        <ShieldAlert size={40} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        Super Admin Portal
                    </h1>
                    <p className="text-slate-400 text-sm mt-2">Dành riêng cho Quản trị viên hệ thống</p>
                </div>

                {/* Error/Success Message */}
                {message && (
                    <div className={`p-4 mb-6 rounded-xl text-sm flex items-center gap-3 ${message.type === 'error'
                        ? 'bg-red-900/20 border border-red-800 text-red-400'
                        : 'bg-green-900/20 border border-green-800 text-green-400'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${message.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
                        {message.text}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleAuth} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Email Quản trị</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-slate-200 transition-all duration-200 outline-none bg-slate-900/50 border border-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder:text-slate-600"
                                placeholder="tungdibui2609@gmail.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Mật khẩu</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-slate-200 transition-all duration-200 outline-none bg-slate-900/50 border border-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder:text-slate-600"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 px-4 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 text-white bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-900/30"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Đang xác thực...
                            </>
                        ) : (
                            <>
                                <LogIn size={20} />
                                Đăng Nhập
                            </>
                        )}
                    </button>

                    <div className="text-center pt-4">
                        <a href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                            ← Quay lại trang chủ
                        </a>
                    </div>
                </form>
            </div>
        </div>
    )
}
