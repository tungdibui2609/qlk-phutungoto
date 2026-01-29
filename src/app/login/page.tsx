'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { LogIn, Mail, Lock, Loader2, Info } from 'lucide-react'
import Image from 'next/image'
import { COMPANY_INFO } from '@/lib/constants'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null)
    const [companyName, setCompanyName] = useState(COMPANY_INFO.name)
    const [logoUrl, setLogoUrl] = useState<string | null>(null)

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

            // 1. Check if input looks like an email
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signInEmail)

            if (!isEmail) {
                // Check if input follows format "prefix.username" (e.g. any.kho01)
                const prefixMatch = signInEmail.match(/^([a-z0-9]+)\.([a-z0-9_.-]+)$/i)

                if (prefixMatch) {
                    // Looks like a prefixed username! Try standard system email.
                    signInEmail = `${signInEmail}@system.local`
                } else {
                    // Legacy logic: Username only -> Use RPC or assume default
                    // 2. Look it up via Secure RPC (Backward compatibility or legacy users)
                    const { data: userEmail, error: userError } = await supabase
                        .rpc('get_user_email_by_username', { p_username: signInEmail })

                    if (userError || !userEmail) {
                        throw new Error('Tài khoản không tồn tại hoặc sai thông tin.')
                    }
                    signInEmail = userEmail
                }
            }

            // 3. Sign in with the resolved email
            const { error } = await supabase.auth.signInWithPassword({
                email: signInEmail,
                password,
            })
            if (error) throw error

            router.push('/select-system')
        } catch (error: any) {
            setMessage({ text: error.message, type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, #fafaf9 0%, #f5f5f4 40%, #fafaf9 100%)',
            }}
        >
            {/* Background Pattern */}
            <div
                className="absolute inset-0 opacity-50"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(249, 115, 22, 0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(249, 115, 22, 0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: '60px 60px',
                }}
            />

            {/* Glowing Orbs */}
            <div
                className="absolute top-1/4 -left-20 w-96 h-96 rounded-full opacity-30"
                style={{
                    background: 'radial-gradient(circle, rgba(249, 115, 22, 0.15) 0%, transparent 70%)',
                    filter: 'blur(80px)',
                }}
            />
            <div
                className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full opacity-30"
                style={{
                    background: 'radial-gradient(circle, rgba(234, 88, 12, 0.1) 0%, transparent 70%)',
                    filter: 'blur(80px)',
                }}
            />

            {/* Login Card */}
            <div
                className="w-full max-w-md relative animate-slide-up bg-white rounded-3xl border border-stone-200 p-10"
                style={{
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(249, 115, 22, 0.05)',
                }}
            >
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div
                        className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center relative overflow-hidden"
                        style={{
                            background: 'white',
                            boxShadow: '0 8px 25px rgba(0,0,0, 0.1)',
                        }}
                    >
                        <Image
                            src="/logoanywarehouse.png"
                            alt={companyName}
                            fill
                            className="object-contain p-2"
                        />
                    </div>

                    <h1 className="text-2xl font-bold text-stone-900 mb-2 tracking-tight">
                        Ứng Dụng Quản Lý Kho
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
                                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-stone-800 transition-all duration-200 outline-none bg-stone-50 border border-stone-200 placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
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
                                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-stone-800 transition-all duration-200 outline-none bg-stone-50 border border-stone-200 placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 px-4 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                        style={{
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            boxShadow: '0 8px 25px rgba(249, 115, 22, 0.35)',
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
                                Đăng Nhập
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-stone-400 text-sm">
                        <Info size={14} className="text-orange-500" />
                        <span>Liên hệ quản trị viên website để cấp tài khoản</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
