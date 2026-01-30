'use client'
import { useState, useEffect } from 'react'
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
                throw new Error('Email không có quyền truy cập trang quản trị.')
            }

            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            })
            if (error) throw error

            // Force redirect to companies page
            router.push('/admin/companies')
        } catch (error: any) {
            setMessage({ text: error.message, type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-stone-900 text-stone-100">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: `linear-gradient(#ea580c 1px, transparent 1px), linear-gradient(90deg, #ea580c 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            />

            {/* Login Card */}
            <div className="w-full max-w-md relative bg-stone-800 rounded-3xl border border-stone-700 p-10 shadow-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-stone-900 border border-stone-700 shadow-inner">
                        <ShieldAlert size={40} className="text-orange-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        Super Admin Portal
                    </h1>
                    <p className="text-stone-400 text-sm mt-2">Quản trị hệ thống Multi-Tenant</p>
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
                        <label className="block text-sm font-medium text-stone-400 mb-2">Email Quản trị</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
                            <input
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-stone-200 transition-all duration-200 outline-none bg-stone-900 border border-stone-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder:text-stone-600"
                                placeholder="admin@system.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-stone-400 mb-2">Mật khẩu</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-stone-200 transition-all duration-200 outline-none bg-stone-900 border border-stone-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder:text-stone-600"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 px-4 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/20"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Đang xác thực...
                            </>
                        ) : (
                            <>
                                <LogIn size={20} />
                                Đăng Nhập Quản Trị
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
