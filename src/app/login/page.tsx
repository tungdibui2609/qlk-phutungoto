'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
    LogIn, 
    Mail, 
    Lock, 
    Loader2, 
    Info, 
    Eye, 
    EyeOff, 
    ShieldCheck, 
    ThermometerSnowflake, 
    QrCode, 
    Warehouse, 
    CheckCircle2, 
    Sparkles,
    Boxes,
    ArrowRight,
    Phone
} from 'lucide-react'
import Image from 'next/image'
import { COMPANY_INFO } from '@/lib/constants'

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
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
                text: 'Tài khoản của bạn không thuộc công ty/tên miền này. Vui lòng đăng xuất hoặc truy cập đúng địa chỉ.',
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

            router.refresh()
            setTimeout(() => {
                router.push('/select-system')
            }, 400)

        } catch (error: any) {
            setMessage({ text: error.message || 'Đăng nhập thất bại, vui lòng kiểm tra lại.', type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-3 sm:p-6 lg:p-10 relative overflow-hidden bg-emerald-950 font-sans selection:bg-emerald-500 selection:text-white">
            {/* Ambient Background Lights & Mesh Gradients */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[25%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-emerald-600/25 via-teal-500/15 to-transparent blur-3xl animate-pulse duration-[8000ms]" />
                <div className="absolute -bottom-[20%] -right-[10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-tl from-amber-500/20 via-emerald-600/15 to-transparent blur-3xl" />
                <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full bg-emerald-400/10 blur-[120px] pointer-events-none" />
                
                {/* Subtle Geometric Overlay */}
                <div 
                    className="absolute inset-0 opacity-[0.07]" 
                    style={{
                        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.4) 1px, transparent 0)`,
                        backgroundSize: '36px 36px'
                    }}
                />
            </div>

            {/* Main Container */}
            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 rounded-[2.5rem] bg-emerald-900/40 backdrop-blur-2xl border border-emerald-500/20 shadow-[0_30px_100px_rgba(0,0,0,0.5),0_0_50px_rgba(16,185,129,0.15)] overflow-hidden relative z-10 transition-all duration-300">
                
                {/* Left Column: Visual Showcase (Durian Warehouse Theme) */}
                <div className="lg:col-span-7 relative p-8 sm:p-12 lg:p-14 flex flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-900/90 via-emerald-950/80 to-teal-950/95 border-b lg:border-b-0 lg:border-r border-emerald-500/20">
                    {/* Background Hero Image with Blend Mode */}
                    <div className="absolute inset-0 z-0">
                        <Image
                            src="/durian-bg.png"
                            alt="Kho Sầu Riêng Thông Minh"
                            fill
                            priority
                            className="object-cover object-center opacity-30 mix-blend-luminosity scale-105 hover:scale-100 transition-transform duration-1000 ease-out"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/75 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/90 via-transparent to-emerald-950/80" />
                    </div>

                    {/* Top Branding Tag */}
                    <div className="relative z-10 space-y-6">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 backdrop-blur-md text-emerald-300 text-xs font-semibold tracking-wide uppercase shadow-inner">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            Hệ Thống Quản Lý Kho Sầu Riêng
                        </div>

                        <div className="space-y-3">
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15]">
                                Quản Trị Kho Lạnh <br />
                                <span className="bg-gradient-to-r from-emerald-300 via-yellow-300 to-amber-400 bg-clip-text text-transparent drop-shadow-sm">
                                    Sầu Riêng Xuất Khẩu
                                </span>
                            </h1>
                            <p className="text-emerald-100/80 text-sm sm:text-base font-normal max-w-lg leading-relaxed">
                                Giải pháp WMS tối ưu cho kho bãi & vựa sầu riêng: Quản lý nhập - xuất - tồn theo mã Lô (Lot), theo dõi vị trí Pallet kho lạnh, quản lý cân nặng và in tem nhãn thùng QR.
                            </p>
                        </div>
                    </div>

                    {/* Middle: Feature Highlights Badges */}
                    <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-8">
                        <div className="p-4 rounded-2xl bg-emerald-800/30 border border-emerald-400/20 backdrop-blur-md hover:bg-emerald-800/45 transition-colors group">
                            <div className="flex items-start gap-3.5">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-amber-500/20 text-yellow-300 border border-emerald-400/30 group-hover:scale-110 transition-transform">
                                    <Boxes className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm tracking-wide">Quản Lý Mã Lô (Lot)</h4>
                                    <p className="text-emerald-200/70 text-xs mt-0.5 leading-snug">Theo dõi lô thu hoạch, vườn cắt & ngày nhập</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-emerald-800/30 border border-emerald-400/20 backdrop-blur-md hover:bg-emerald-800/45 transition-colors group">
                            <div className="flex items-start gap-3.5">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-400/30 group-hover:scale-110 transition-transform">
                                    <ThermometerSnowflake className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm tracking-wide">Kiểm Soát Kho Lạnh</h4>
                                    <p className="text-emerald-200/70 text-xs mt-0.5 leading-snug">Sơ đồ vị trí Pallet & khu vực bảo quản</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-emerald-800/30 border border-emerald-400/20 backdrop-blur-md hover:bg-emerald-800/45 transition-colors group">
                            <div className="flex items-start gap-3.5">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 text-amber-300 border border-yellow-400/30 group-hover:scale-110 transition-transform">
                                    <QrCode className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm tracking-wide">In Tem Nhãn QR</h4>
                                    <p className="text-emerald-200/70 text-xs mt-0.5 leading-snug">Tem mã vạch pallet & thùng hàng xuất khẩu</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-emerald-800/30 border border-emerald-400/20 backdrop-blur-md hover:bg-emerald-800/45 transition-colors group">
                            <div className="flex items-start gap-3.5">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 text-teal-300 border border-teal-400/30 group-hover:scale-110 transition-transform">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm tracking-wide">Nhập - Xuất - Tồn Kho</h4>
                                    <p className="text-emerald-200/70 text-xs mt-0.5 leading-snug">Báo cáo cân nặng thực tế, tồn kho & phân hạng</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Status / Certifications */}
                    <div className="relative z-10 pt-4 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-4 text-xs text-emerald-200/70">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Vận hành đa phân hệ kho & chuỗi cung ứng</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-medium text-amber-300/90">
                            <span>Sầu riêng Ri6 • Monthong • Dona</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Modern Authentication Form */}
                <div className="lg:col-span-5 p-8 sm:p-12 lg:p-12 bg-white/95 backdrop-blur-3xl flex flex-col justify-between relative shadow-xl">
                    <div>
                        {/* Header with Logo */}
                        <div className="flex items-center gap-3.5 mb-8">
                            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 p-2.5 shadow-lg shadow-emerald-700/20 flex items-center justify-center flex-shrink-0 text-white">
                                {logoUrl ? (
                                    <div className="relative w-full h-full">
                                        <Image
                                            src={logoUrl}
                                            alt={companyName}
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                ) : (
                                    <Warehouse className="w-7 h-7 text-amber-300" />
                                )}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    Đăng Nhập Kho
                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        WMS v2.5
                                    </span>
                                </h2>
                                <p className="text-xs text-slate-500 font-medium truncate max-w-[220px]">
                                    {companyName || 'Hệ Thống Kho Sầu Riêng Chánh Thu'}
                                </p>
                            </div>
                        </div>

                        {/* Welcome Heading */}
                        <div className="mb-6">
                            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                Chào mừng trở lại! 👋
                            </h3>
                            <p className="text-slate-500 text-sm mt-1">
                                Nhập tài khoản quản trị hoặc nhân viên kho để tiếp tục
                            </p>
                        </div>

                        {/* Error / Alert Message */}
                        {message && (
                            <div
                                className={`p-4 mb-6 rounded-2xl text-sm flex items-start gap-3 transition-all animate-fadeIn ${
                                    message.type === 'error'
                                        ? 'bg-rose-50 border border-rose-200 text-rose-800 shadow-sm'
                                        : 'bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-sm'
                                }`}
                            >
                                <div
                                    className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                                        message.type === 'error' ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'
                                    }`}
                                />
                                <div className="flex-1 font-medium leading-relaxed">
                                    {message.text}
                                </div>
                            </div>
                        )}

                        {/* Login Form */}
                        <form onSubmit={handleAuth} className="space-y-4">
                            {/* Email / Username Input */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                                    Email / Tài khoản kho
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                                        <Mail size={19} />
                                    </div>
                                    <input
                                        type="text"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoFocus
                                        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 placeholder:text-slate-400 text-sm font-medium transition-all duration-200 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15"
                                        placeholder="user@example.com hoặc tenkho.user"
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                                        Mật khẩu truy cập
                                    </label>
                                </div>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                                        <Lock size={19} />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 placeholder:text-slate-400 text-sm font-medium transition-all duration-200 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                        tabIndex={-1}
                                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 px-6 font-bold text-sm tracking-wide rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 text-white bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-500 hover:to-teal-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-700/25 hover:shadow-xl hover:shadow-emerald-700/30 cursor-pointer"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={19} />
                                            <span>Đang xác thực bảo mật...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Đăng Nhập Vào Hệ Thống</span>
                                            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* Unauthorized domain special action */}
                        {isUnauthorizedDomain && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-xs border border-rose-200"
                                >
                                    Đăng xuất tài khoản hiện tại & Thử lại
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Bottom Helper Info */}
                    <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center justify-center gap-2">
                        <div className="text-[11px] text-slate-400 font-medium">
                            Bảo mật dữ liệu tiêu chuẩn theo từng Phân Hệ Kho
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600 text-xs font-medium">
                            <Phone size={13} className="text-emerald-600 flex-shrink-0" />
                            <span>Hỗ trợ kỹ thuật:</span>
                            <span className="font-bold text-slate-800">Nguyễn Đình Tùng</span>
                            <span className="text-slate-400">-</span>
                            <a 
                                href="tel:0374944792" 
                                className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline tracking-wide transition-colors"
                            >
                                0374944792
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
