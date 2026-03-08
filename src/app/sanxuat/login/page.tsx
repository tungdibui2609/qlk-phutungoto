'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'
import { LogIn, Mail, Lock, Loader2, Info } from 'lucide-react'
import Image from 'next/image'
import { COMPANY_INFO } from '@/lib/constants'

export default function SanxuatLoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null)
    const [companyName, setCompanyName] = useState(COMPANY_INFO.name)
    const [logoUrl, setLogoUrl] = useState<string | null>(null)

    const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false)

    useEffect(() => {
        // Check for error param
        const errorType = searchParams.get('error')
        if (errorType === 'unauthorized_domain') {
            setIsUnauthorizedDomain(true)
            setMessage({
                text: 'Tài khoản của bạn không được phép truy cập vào Hệ Thống Sản Xuất. Vui lòng đăng xuất hoặc kiểm tra lại.',
                type: 'error'
            })
        }
    }, [searchParams])

    useEffect(() => {
        async function fetchCompanySettings() {
            const { data } = await supabase
                .from('company_settings')
                .select('name, logo_url')
                .maybeSingle()

            if (data) {
                const settings = data as any
                if (settings.name) setCompanyName(settings.name)
                if (settings.logo_url) setLogoUrl(settings.logo_url)
            }
        }
        fetchCompanySettings()
    }, [])

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            let signInEmail = email.trim()
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signInEmail)

            if (!isEmail) {
                const prefixMatch = signInEmail.match(/^([a-z0-9]+)\.([a-z0-9_.-]+)$/i)
                if (prefixMatch) {
                    signInEmail = `${signInEmail}@system.local`
                } else {
                    const { data: userEmail, error: userError } = await supabase
                        .rpc('get_user_email_by_username', { p_username: signInEmail })

                    if (userError || !userEmail) {
                        throw new Error('Tài khoản không tồn tại hoặc sai thông tin.')
                    }
                    signInEmail = userEmail
                }
            }

            const { error } = await supabase.auth.signInWithPassword({
                email: signInEmail,
                password,
            })
            if (error) throw error

            router.refresh()
            setTimeout(() => {
                router.push('/sanxuat/dashboard')
            }, 500)

        } catch (error: any) {
            setMessage({ text: error.message, type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.href = '/sanxuat/login'
    }

    return (
        <div
            className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 40%, #f0fdf4 100%)', // Hơi xanh lá/mint để phân biệt với kho
            }}
        >
            {/* Background Pattern */}
            <div
                className="absolute inset-0 opacity-50"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(16, 185, 129, 0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(16, 185, 129, 0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: '60px 60px',
                }}
            />

            {/* Glowing Orbs */}
            <div
                className="absolute top-1/4 -left-20 w-96 h-96 rounded-full opacity-30"
                style={{
                    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
                    filter: 'blur(80px)',
                }}
            />
            <div
                className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full opacity-30"
                style={{
                    background: 'radial-gradient(circle, rgba(5, 150, 105, 0.1) 0%, transparent 70%)',
                    filter: 'blur(80px)',
                }}
            />

            {/* Login Card */}
            <div
                className="w-full max-w-md relative animate-slide-up bg-white rounded-3xl border border-stone-200 p-10"
                style={{
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(16, 185, 129, 0.05)',
                }}
            >
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div
                        className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center relative overflow-hidden"
                        style={{
                            background: '#10b981', // Emerald 500
                            boxShadow: '0 8px 25px rgba(16, 185, 129, 0.2)',
                        }}
                    >
                        <Image
                            src="/logoanywarehouse.png" // Hoặc logo sản xuất riêng nếu có
                            alt={companyName}
                            fill
                            className="object-contain p-2"
                        />
                    </div>

                    <h1 className="text-2xl font-bold text-stone-900 mb-2 tracking-tight">
                        Hệ Thống Sản Xuất
                    </h1>
                </div>

                {/* Error/Success Message */}
                {message && (
                    <div
                        className={`p-4 mb-6 rounded-xl text-sm flex items-center gap-3 ${message.type === 'error'
                            ? 'bg-red-50 border border-red-200 text-red-700'
                            : 'bg-green-50 border border-green-200 text-green-700'
                            }`}
                    >
                        <div
                            className={`w-2 h-2 rounded-full ${message.type === 'error' ? 'bg-red-500' : 'bg-green-500'
                                }`}
                        />
                        {message.text}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleAuth} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">
                            Email / Tên đăng nhập
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                            <input
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-stone-800 transition-all duration-200 outline-none bg-stone-50 border border-stone-200 placeholder:text-stone-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                placeholder="Nhập email hoặc username..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">
                            Mật khẩu
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-stone-800 transition-all duration-200 outline-none bg-stone-50 border border-stone-200 placeholder:text-stone-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 px-4 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                        style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            boxShadow: '0 8px 25px rgba(16, 185, 129, 0.35)',
                        }}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <LogIn size={20} />
                                Đăng Nhập Sản Xuất
                            </>
                        )}
                    </button>
                </form>

                {isUnauthorizedDomain && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                        >
                            Đăng xuất tài khoản hiện tại
                        </button>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-stone-400 text-sm">
                        <Info size={14} className="text-emerald-500" />
                        <span>Liên hệ quản trị viên website để cấp tài khoản sản xuất</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
