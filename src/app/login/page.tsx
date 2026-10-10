'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
    Mail, 
    Lock, 
    Loader2, 
    Eye, 
    EyeOff, 
    ArrowRight,
    Phone,
    Coffee
} from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null)
    const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false)
    
    // Boy awake state: false = sleeping, true = awake with blinking eyes & greeting banner
    const [isAwake, setIsAwake] = useState(false)
    const [accountGreetingName, setAccountGreetingName] = useState('')

    const extractAccountName = (val: string) => {
        const clean = val.trim()
        if (!clean) return 'Đồng Chí'
        if (clean.includes('@')) {
            return clean.split('@')[0]
        }
        return clean
    }

    // Real-time desk clock state
    const [currentTime, setCurrentTime] = useState<Date | null>(null)

    useEffect(() => {
        setCurrentTime(new Date())
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    const sec = currentTime ? currentTime.getSeconds() : 0
    const min = currentTime ? currentTime.getMinutes() : 0
    const hr = currentTime ? currentTime.getHours() : 0

    const secDeg = sec * 6
    const minDeg = (min + sec / 60) * 6
    const hourDeg = ((hr % 12) + min / 60) * 30

    useEffect(() => {
        const errorType = searchParams.get('error')
        if (errorType === 'unauthorized_domain') {
            setIsUnauthorizedDomain(true)
            setMessage({
                text: 'Tài khoản không thuộc công ty/tên miền này. Vui lòng đăng xuất hoặc truy cập đúng địa chỉ.',
                type: 'error'
            })
        }
    }, [searchParams])

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        // Extract greeting name immediately from input
        const initialGreeting = extractAccountName(email)
        setAccountGreetingName(initialGreeting)

        // Wake the boy up immediately on submit / Enter!
        setIsAwake(true)
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
                    signInEmail = `${signInEmail}@system.local`
                } else {
                    // Fallback RPC username lookup
                    const { data: userEmail, error: userError } = await (supabase.rpc as any)(
                        'get_user_email_by_username',
                        { p_username: signInEmail }
                    )

                    if (userError || !userEmail) {
                        throw new Error('Tài khoản không tồn tại hoặc sai thông tin.')
                    }
                    signInEmail = userEmail as string
                }
            }

            // 2. Sign in with password
            const { data: authData, error } = await supabase.auth.signInWithPassword({
                email: signInEmail,
                password,
            })
            if (error) throw error

            // Try to resolve full name from user metadata or user_profiles
            if (authData?.user) {
                let resolvedName = authData.user.user_metadata?.full_name || authData.user.user_metadata?.name
                if (!resolvedName) {
                    try {
                        const { data: profile } = await supabase
                            .from('user_profiles')
                            .select('full_name')
                            .eq('id', authData.user.id)
                            .maybeSingle()
                        if (profile?.full_name) {
                            resolvedName = profile.full_name
                        }
                    } catch (err) {
                        console.error('Error fetching profile name:', err)
                    }
                }
                if (resolvedName) {
                    setAccountGreetingName(resolvedName)
                }
            }

            // Cho load 3.5s để người dùng chiêm ngưỡng trọn vẹn chuyển động cậu bé tỉnh dậy & dơ băng rôn chào đón!
            await new Promise((resolve) => setTimeout(resolve, 3500))

            window.location.href = '/select-system'

        } catch (error: any) {
            setMessage({ text: error.message || 'Đăng nhập thất bại, vui lòng kiểm tra lại.', type: 'error' })
            // Keep awake briefly to show reaction, then gently sleep if error
            setTimeout(() => {
                if (!loading) setIsAwake(false)
            }, 3500)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
    }


    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-[#f7f4ed] text-[#2d251e] font-sans selection:bg-[#857463] selection:text-white relative overflow-x-hidden">
            
            {/* Custom Embedded CSS for Single-Line Doodle Animations */}
            <style jsx global>{`
                @keyframes floatZzz {
                    0% { transform: translate(0, 0) scale(0.8); opacity: 0; }
                    25% { opacity: 0.9; }
                    75% { opacity: 0.6; }
                    100% { transform: translate(12px, -24px) scale(1.2); opacity: 0; }
                }
                .zzz-1 { animation: floatZzz 3s infinite ease-out 0s; }
                .zzz-2 { animation: floatZzz 3s infinite ease-out 1s; }
                .zzz-3 { animation: floatZzz 3s infinite ease-out 2s; }

                @keyframes gentleBreathe {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-2px); }
                }
                .breathe-motion {
                    animation: gentleBreathe 3.5s infinite ease-in-out;
                }

                /* Rapid cute eye blinking animation */
                @keyframes eyeBlink {
                    0%, 70%, 82%, 100% {
                        transform: scaleY(1);
                    }
                    76%, 88% {
                        transform: scaleY(0.08);
                    }
                }
                .blinking-eyes {
                    transform-origin: center center;
                    animation: eyeBlink 3s infinite ease-in-out;
                }

                @keyframes steamWiggle {
                    0%, 100% { transform: translateY(0) scaleX(1); opacity: 0.3; }
                    50% { transform: translateY(-4px) scaleX(1.15) translateX(1px); opacity: 0.7; }
                }
                .steam-line {
                    animation: steamWiggle 2.5s infinite ease-in-out;
                }

                @keyframes sparklePop {
                    0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.7; }
                    50% { transform: scale(1.25) rotate(15deg); opacity: 1; }
                }
                .sparkle-pop {
                    animation: sparklePop 2s infinite ease-in-out;
                }

                @keyframes alarmRing {
                    0%, 100% { transform: rotate(0deg); }
                    20% { transform: rotate(-6deg); }
                    40% { transform: rotate(6deg); }
                    60% { transform: rotate(-4deg); }
                    80% { transform: rotate(4deg); }
                }
                .alarm-ringing {
                    transform-origin: 355px 148px;
                    animation: alarmRing 0.35s infinite ease-in-out;
                }

                /* Banner popup and waving animation */
                @keyframes bannerPop {
                    0% { transform: translateY(22px) scale(0.65); opacity: 0; }
                    65% { transform: translateY(-4px) scale(1.03); opacity: 1; }
                    85% { transform: translateY(2px) scale(0.99); opacity: 1; }
                    100% { transform: translateY(0) scale(1); opacity: 1; }
                }

                @keyframes bannerWave {
                    0%, 100% { transform: rotate(-1.5deg) translateY(0); }
                    50% { transform: rotate(1.5deg) translateY(-2px); }
                }

                .banner-animated {
                    transform-origin: 235px 20px;
                    animation: bannerPop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, bannerWave 3s ease-in-out 0.65s infinite;
                }

                @keyframes confettiFloat {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-4px) rotate(8deg); }
                }

                .confetti-item {
                    animation: confettiFloat 2.5s ease-in-out infinite;
                }
            `}</style>

            {/* Subtle Minimalist Notebook Sketch Grid Background */}
            <div 
                className="fixed inset-0 pointer-events-none opacity-[0.4]"
                style={{
                    backgroundImage: `radial-gradient(#cfc5b6 1px, transparent 1px)`,
                    backgroundSize: '24px 24px'
                }}
            />

            {/* THE ENTIRE WORKSTATION & DESK CONTAINER */}
            <div className="w-full max-w-[440px] relative z-10 flex flex-col items-center">
                
                {/* 1. TOP INTERACTIVE DOODLE: The Boy Resting / Sleeping / Waking on top of the Desk */}
                <div 
                    className="w-full h-[185px] relative select-none pointer-events-none"
                >
                    <svg 
                        viewBox="0 -35 420 185" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-full h-full overflow-visible"
                    >
                        {/* DEFINITIONS FOR CURVED TEXT PATHS ON THE BANNER */}
                        <defs>
                            {/* Upper arc for "★ XIN CHÀO ★" */}
                            <path 
                                id="banner-slogan-path" 
                                d="M 125 13 C 175 1, 295 1, 345 13" 
                                fill="none" 
                            />
                            {/* Lower arc for Account Name Greeting */}
                            <path 
                                id="banner-name-path" 
                                d="M 125 28 C 175 16, 295 16, 345 28" 
                                fill="none" 
                            />
                        </defs>

                        {/* DECOR: Minimalist Single-Line Desk Lamp on Left */}
                        <g opacity="0.85">
                            {/* Lamp base */}
                            <ellipse cx="65" cy="148" rx="16" ry="3.5" stroke="#3c3127" strokeWidth="2.5" strokeLinecap="round" />
                            {/* Lamp stem */}
                            <path d="M 65 146 L 52 110 L 72 82" stroke="#3c3127" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            {/* Lamp head shade */}
                            <path d="M 62 88 L 84 76 L 94 94 L 72 104 Z" stroke="#3c3127" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="#fffdfa" />
                            {/* Lamp bulb glow when awake */}
                            {isAwake && (
                                <g className="sparkle-pop">
                                    <path d="M 88 100 L 98 114" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
                                    <path d="M 80 106 L 86 122" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
                                    <circle cx="82" cy="94" r="5" fill="#fef08a" opacity="0.8" />
                                </g>
                            )}
                        </g>

                        {/* DECOR: Cute Coffee Mug on Left */}
                        <g opacity="0.85">
                            <rect x="110" y="124" width="20" height="24" rx="4" stroke="#3c3127" strokeWidth="2.5" fill="#fffdfa" />
                            {/* Handle */}
                            <path d="M 130 130 C 137 130, 137 142, 130 142" stroke="#3c3127" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                            {/* Steam lines */}
                            <path d="M 116 118 Q 119 113, 116 108" stroke="#a89a8c" strokeWidth="2" strokeLinecap="round" className="steam-line" />
                            <path d="M 124 116 Q 127 111, 124 106" stroke="#a89a8c" strokeWidth="2" strokeLinecap="round" className="steam-line" />
                        </g>

                        {/* THE BOY: Single-Line Drawing Character */}
                        <g 
                            className={`transition-transform duration-700 ease-out ${!isAwake ? 'breathe-motion' : ''}`}
                            style={{
                                transform: isAwake ? 'translateY(-10px)' : 'translateY(0)'
                            }}
                        >
                            {/* Boy's Torso & Back hunched softly over the desk */}
                            <path 
                                d={isAwake 
                                    ? "M 150 148 C 160 115, 195 110, 235 112 C 275 110, 310 120, 320 148"
                                    : "M 140 148 C 150 125, 185 120, 225 125 C 265 122, 305 130, 320 148"
                                }
                                stroke="#2e251d" 
                                strokeWidth="2.8" 
                                strokeLinecap="round" 
                                fill="#fffdfa"
                                className="transition-all duration-700 ease-out"
                            />

                            {/* Folded Arms on desk ONLY when sleeping */}
                            {!isAwake && (
                                <g>
                                    <path 
                                        d="M 165 148 C 175 134, 225 132, 255 148" 
                                        stroke="#2e251d" 
                                        strokeWidth="2.8" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        fill="#faf6f0"
                                    />
                                    <path 
                                        d="M 220 148 C 245 134, 285 135, 305 148" 
                                        stroke="#2e251d" 
                                        strokeWidth="2.8" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        fill="#faf6f0"
                                    />
                                    {/* Sleeve wrinkles */}
                                    <path d="M 185 142 L 192 147" stroke="#2e251d" strokeWidth="2.2" strokeLinecap="round" />
                                    <path d="M 275 142 L 270 147" stroke="#2e251d" strokeWidth="2.2" strokeLinecap="round" />
                                </g>
                            )}

                            {/* Raised Arms raising the Banner when Awake */}
                            {isAwake && (
                                <g className="transition-all duration-700 ease-out">
                                    {/* Left Arm reaching up to left pole */}
                                    <path 
                                        d="M 168 122 C 145 106, 126 75, 134 38" 
                                        stroke="#2e251d" 
                                        strokeWidth="2.8" 
                                        strokeLinecap="round" 
                                        fill="none" 
                                    />
                                    <path 
                                        d="M 182 126 C 160 110, 142 82, 146 44" 
                                        stroke="#2e251d" 
                                        strokeWidth="2.8" 
                                        strokeLinecap="round" 
                                        fill="none" 
                                    />
                                    {/* Left Hand gripping left pole */}
                                    <ellipse cx="138" cy="36" rx="5.5" ry="6.5" fill="#fffdfa" stroke="#2e251d" strokeWidth="2.4" />
                                    <path d="M 134 33 C 141 33, 142 40, 136 41" stroke="#2e251d" strokeWidth="2.2" strokeLinecap="round" />

                                    {/* Right Arm reaching up to right pole */}
                                    <path 
                                        d="M 302 122 C 325 106, 344 75, 336 38" 
                                        stroke="#2e251d" 
                                        strokeWidth="2.8" 
                                        strokeLinecap="round" 
                                        fill="none" 
                                    />
                                    <path 
                                        d="M 288 126 C 310 110, 328 82, 324 44" 
                                        stroke="#2e251d" 
                                        strokeWidth="2.8" 
                                        strokeLinecap="round" 
                                        fill="none" 
                                    />
                                    {/* Right Hand gripping right pole */}
                                    <ellipse cx="332" cy="36" rx="5.5" ry="6.5" fill="#fffdfa" stroke="#2e251d" strokeWidth="2.4" />
                                    <path d="M 336 33 C 329 33, 328 40, 334 41" stroke="#2e251d" strokeWidth="2.2" strokeLinecap="round" />
                                </g>
                            )}

                            {/* HEAD CONTAINER: Rests right on arms when sleeping, lifts up high when awake */}
                            <g 
                                className="transition-all duration-700 ease-out"
                                style={{
                                    transform: isAwake 
                                        ? 'translate(235px, 80px) rotate(0deg)' 
                                        : 'translate(235px, 126px) rotate(14deg)'
                                }}
                            >
                                {/* Head Outline */}
                                <ellipse cx="0" cy="0" rx="27" ry="22" stroke="#2e251d" strokeWidth="2.8" fill="#fffdfa" />
                                
                                {/* Ear */}
                                <path d="M -27 -1 C -33 -3, -33 7, -27 7" stroke="#2e251d" strokeWidth="2.8" strokeLinecap="round" fill="#fffdfa" />

                                {/* Cute Tousled Hair (1-line doodle style) */}
                                <path 
                                    d="M -25 -8 C -27 -20, -17 -30, 0 -30 C 17 -30, 27 -20, 27 -6 C 23 -12, 17 -16, 11 -14 C 7 -22, -3 -22, -9 -16 C -15 -20, -21 -16, -25 -8 Z" 
                                    stroke="#2e251d" 
                                    strokeWidth="2.8" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    fill="#2e251d"
                                />
                                {/* Hair tuft on top */}
                                <path d="M 2 -30 Q 6 -37, 12 -33" stroke="#2e251d" strokeWidth="2.8" strokeLinecap="round" />
                                <path d="M -8 -28 Q -14 -35, -10 -38" stroke="#2e251d" strokeWidth="2.8" strokeLinecap="round" />

                                {/* ================= STATE 1: SLEEPING FACE (NẰM NGỦ TRÊN BÀN) ================= */}
                                {!isAwake && (
                                    <g opacity="0.95">
                                        {/* Sleepy curved closed eyes */}
                                        <path d="M -12 1 Q -6 6, 0 1" stroke="#2e251d" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                        <path d="M 8 1 Q 14 6, 20 1" stroke="#2e251d" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                        
                                        {/* Sweet sleeping mouth */}
                                        <path d="M 2 10 Q 6 13, 10 10" stroke="#2e251d" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                                        {/* Rosy sleeping cheeks */}
                                        <path d="M -15 6 L -11 9" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                                        <path d="M 16 6 L 20 9" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                                    </g>
                                )}

                                {/* ================= STATE 2: AWAKE & BLINKING FACE (TỈNH DẬY MẮT CHỚP CHỚP) ================= */}
                                {isAwake && (
                                    <g>
                                        {/* Raised surprised eyebrows */}
                                        <path d="M -15 -8 Q -8 -13, -1 -9" stroke="#2e251d" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                        <path d="M 7 -9 Q 14 -13, 21 -8" stroke="#2e251d" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                                        {/* BLINKING EYES (Mắt chớp chớp liên tục) */}
                                        <g className="blinking-eyes">
                                            {/* Left Eye */}
                                            <ellipse cx="-7" cy="0" rx="5" ry="6.5" fill="#2e251d" />
                                            <circle cx="-9" cy="-2.5" r="2" fill="#ffffff" />
                                            <circle cx="-5.5" cy="2" r="1" fill="#ffffff" />

                                            {/* Right Eye */}
                                            <ellipse cx="13" cy="0" rx="5" ry="6.5" fill="#2e251d" />
                                            <circle cx="11" cy="-2.5" r="2" fill="#ffffff" />
                                            <circle cx="14.5" cy="2" r="1" fill="#ffffff" />
                                        </g>

                                        {/* Cheerful smiling mouth */}
                                        <path d="M -1 11 Q 4 19, 9 11 Z" stroke="#2e251d" strokeWidth="2.5" strokeLinecap="round" fill="#f43f5e" />

                                        {/* Blushing cheeks */}
                                        <ellipse cx="-16" cy="8" rx="4.5" ry="2.5" fill="#fca5a5" opacity="0.8" />
                                        <ellipse cx="21" cy="8" rx="4.5" ry="2.5" fill="#fca5a5" opacity="0.8" />
                                    </g>
                                )}
                            </g>
                        </g>

                        {/* ================= GREETING BANNER HELD BY THE BOY WHEN AWAKE ================= */}
                        {isAwake && (
                            <g className="banner-animated select-none">
                                {/* Left Pole */}
                                <line x1="138" y1="-20" x2="138" y2="48" stroke="#3c3127" strokeWidth="3" strokeLinecap="round" />
                                <circle cx="138" cy="-21" r="3.5" fill="#eab308" stroke="#3c3127" strokeWidth="2" />

                                {/* Right Pole */}
                                <line x1="332" y1="-20" x2="332" y2="48" stroke="#3c3127" strokeWidth="3" strokeLinecap="round" />
                                <circle cx="332" cy="-21" r="3.5" fill="#eab308" stroke="#3c3127" strokeWidth="2" />

                                {/* Left Ribbon Tail (back fold & swallowtail) */}
                                <path d="M 125 36 L 125 16 L 110 26 Z" fill="#dfd5c6" stroke="#2e251d" strokeWidth="2" strokeLinejoin="round" />
                                <path d="M 110 26 L 78 20 L 90 35 L 78 50 L 125 36 Z" fill="#fef3c7" stroke="#2e251d" strokeWidth="2.5" strokeLinejoin="round" />
                                <path d="M 86 28 L 102 33" stroke="#d5c3ab" strokeWidth="1.5" strokeLinecap="round" />

                                {/* Right Ribbon Tail (back fold & swallowtail) */}
                                <path d="M 345 36 L 345 16 L 360 26 Z" fill="#dfd5c6" stroke="#2e251d" strokeWidth="2" strokeLinejoin="round" />
                                <path d="M 360 26 L 392 20 L 380 35 L 392 50 L 345 36 Z" fill="#fef3c7" stroke="#2e251d" strokeWidth="2.5" strokeLinejoin="round" />
                                <path d="M 384 28 L 368 33" stroke="#d5c3ab" strokeWidth="1.5" strokeLinecap="round" />

                                {/* Main Ribbon Body (Front banner) */}
                                <path 
                                    d="M 122 3 C 175 -9, 295 -9, 348 3 L 348 38 C 295 26, 175 26, 122 38 Z" 
                                    fill="#fffdf5" 
                                    stroke="#2e251d" 
                                    strokeWidth="2.8" 
                                    strokeLinejoin="round" 
                                />

                                {/* Decorative Stitch Lines */}
                                <path 
                                    d="M 126 8 C 176 -4, 294 -4, 344 8" 
                                    stroke="#f59e0b" 
                                    strokeWidth="1.2" 
                                    strokeDasharray="3 3" 
                                    strokeLinecap="round" 
                                    fill="none" 
                                />
                                <path 
                                    d="M 126 33 C 176 21, 294 21, 344 33" 
                                    stroke="#f59e0b" 
                                    strokeWidth="1.2" 
                                    strokeDasharray="3 3" 
                                    strokeLinecap="round" 
                                    fill="none" 
                                />

                                {/* Ribbon Slogan: ★ XIN CHÀO ★ (Uốn cong mềm mại theo dải băng rôn) */}
                                <text 
                                    fontSize="8.5" 
                                    fontWeight="bold" 
                                    fill="#c2410c" 
                                    letterSpacing="2"
                                    fontFamily="monospace, sans-serif"
                                >
                                    <textPath 
                                        href="#banner-slogan-path" 
                                        startOffset="50%" 
                                        textAnchor="middle"
                                    >
                                        ★ XIN CHÀO ★
                                    </textPath>
                                </text>

                                {/* Ribbon Account Name Greeting (Uốn cong khớp hoàn toàn theo băng rôn) */}
                                <text 
                                    fontSize={(accountGreetingName || extractAccountName(email)).length > 16 
                                        ? ((accountGreetingName || extractAccountName(email)).length > 22 ? "9.5" : "11") 
                                        : "13"
                                    } 
                                    fontWeight="900" 
                                    fill="#261d15" 
                                    letterSpacing="0.5"
                                    fontFamily="system-ui, sans-serif"
                                >
                                    <textPath 
                                        href="#banner-name-path" 
                                        startOffset="50%" 
                                        textAnchor="middle"
                                    >
                                        {(accountGreetingName || extractAccountName(email))}!
                                    </textPath>
                                </text>

                                {/* Sparkles & Confetti surrounding the Banner */}
                                <g className="confetti-item">
                                    {/* Golden Stars */}
                                    <path d="M 112 -12 L 114 -7 L 119 -5 L 114 -3 L 112 2 L 110 -3 L 105 -5 L 110 -7 Z" fill="#eab308" />
                                    <path d="M 358 -10 L 360 -5 L 365 -3 L 360 -1 L 358 4 L 356 -1 L 351 -3 L 356 -5 Z" fill="#eab308" />
                                    <path d="M 235 -24 L 237 -19 L 242 -17 L 237 -15 L 235 -10 L 233 -15 L 228 -17 L 233 -19 Z" fill="#f59e0b" />

                                    {/* Colorful confetti dots */}
                                    <circle cx="102" cy="8" r="2.5" fill="#ef4444" />
                                    <circle cx="368" cy="10" r="2.5" fill="#3b82f6" />
                                    <circle cx="120" cy="-22" r="2" fill="#10b981" />
                                    <circle cx="350" cy="-20" r="2" fill="#ec4899" />
                                    <circle cx="180" cy="-18" r="2.2" fill="#f97316" />
                                    <circle cx="290" cy="-18" r="2.2" fill="#8b5cf6" />
                                    
                                    {/* Cute floating heart */}
                                    <path d="M 235 -30 C 232 -33, 227 -31, 227 -27 C 227 -23, 235 -18, 235 -18 C 235 -18, 243 -23, 243 -27 C 243 -31, 238 -33, 235 -30 Z" fill="#f43f5e" opacity="0.85" />
                                </g>
                            </g>
                        )}

                        {/* FLOATING "Zzz" ONLY WHEN SLEEPING */}
                        {!isAwake && (
                            <g fill="#786c5e" fontWeight="bold" fontFamily="monospace">
                                <text x="270" y="75" fontSize="13" className="zzz-1">Z</text>
                                <text x="282" y="60" fontSize="17" className="zzz-2">z</text>
                                <text x="296" y="42" fontSize="21" className="zzz-3">z</text>
                            </g>
                        )}

                        {/* WAKE UP SPARKLES ONLY WHEN AWAKE */}
                        {isAwake && (
                            <g className="sparkle-pop" stroke="#eab308" fill="#eab308">
                                <path d="M 288 38 L 292 48 L 302 52 L 292 56 L 288 66 L 284 56 L 274 52 L 284 48 Z" />
                                <circle cx="316" cy="62" r="3" />
                                <circle cx="266" cy="42" r="2.5" />
                            </g>
                        )}

                        {/* DECOR: Cute Minimalist Classic Desk Alarm Clock (Real-Time Running) */}
                        <g 
                            opacity="0.95" 
                            className={`select-none ${isAwake ? 'alarm-ringing' : ''}`}
                        >
                            <title>{currentTime ? `Thời gian hiện tại: ${currentTime.toLocaleTimeString('vi-VN')}` : 'Đồng hồ để bàn'}</title>

                            {/* Stand legs touching desk */}
                            <path d="M 347 143 L 343 148" stroke="#3c3127" strokeWidth="2.5" strokeLinecap="round" />
                            <path d="M 363 143 L 367 148" stroke="#3c3127" strokeWidth="2.5" strokeLinecap="round" />

                            {/* Twin top bells & hammer */}
                            <path d="M 343 124 C 340 118, 347 115, 350 120 Z" stroke="#3c3127" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="#fffdfa" />
                            <path d="M 360 120 C 363 115, 370 118, 367 124 Z" stroke="#3c3127" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="#fffdfa" />
                            <path d="M 353 119 L 357 119" stroke="#3c3127" strokeWidth="2" strokeLinecap="round" />
                            <path d="M 355 119 L 355 116" stroke="#3c3127" strokeWidth="2" strokeLinecap="round" />

                            {/* Clock main circle body */}
                            <circle cx="355" cy="132" r="13" stroke="#3c3127" strokeWidth="2.5" fill="#fffdfa" />

                            {/* Clock hour marks (12, 3, 6, 9) */}
                            <line x1="355" y1="121" x2="355" y2="123" stroke="#8c7f70" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="366" y1="132" x2="364" y2="132" stroke="#8c7f70" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="355" y1="143" x2="355" y2="141" stroke="#8c7f70" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="344" y1="132" x2="346" y2="132" stroke="#8c7f70" strokeWidth="1.5" strokeLinecap="round" />

                            {/* Hour Hand (Kim giờ chạy thực tế) */}
                            <line 
                                x1="355" y1="132" x2="355" y2="126" 
                                stroke="#2e251d" strokeWidth="2.4" strokeLinecap="round" 
                                transform={`rotate(${hourDeg} 355 132)`} 
                            />

                            {/* Minute Hand (Kim phút chạy thực tế) */}
                            <line 
                                x1="355" y1="132" x2="355" y2="123" 
                                stroke="#2e251d" strokeWidth="1.8" strokeLinecap="round" 
                                transform={`rotate(${minDeg} 355 132)`} 
                            />

                            {/* Red Second Hand (Kim giây đỏ nhảy tích tắc theo từng giây!) */}
                            <line 
                                x1="355" y1="134" x2="355" y2="122" 
                                stroke="#e11d48" strokeWidth="1.2" strokeLinecap="round" 
                                transform={`rotate(${secDeg} 355 132)`} 
                            />

                            {/* Center pivot */}
                            <circle cx="355" cy="132" r="1.6" fill="#2e251d" />
                            <circle cx="355" cy="132" r="0.7" fill="#e11d48" />

                            {/* Ringing sound waves when awake */}
                            {isAwake && (
                                <g stroke="#eab308" fill="none">
                                    <path d="M 338 118 Q 335 121, 338 124" strokeWidth="1.8" strokeLinecap="round" />
                                    <path d="M 372 118 Q 375 121, 372 124" strokeWidth="1.8" strokeLinecap="round" />
                                    <path d="M 334 115 Q 329 121, 334 127" strokeWidth="1.5" strokeLinecap="round" />
                                    <path d="M 376 115 Q 381 121, 376 127" strokeWidth="1.5" strokeLinecap="round" />
                                </g>
                            )}
                        </g>

                        {/* DESK TOP SURFACE LINE: Coordinates right at the boundary */}
                        <path 
                            d="M 10 148 L 410 148" 
                            stroke="#3c3127" 
                            strokeWidth="3.2" 
                            strokeLinecap="round" 
                        />
                    </svg>
                </div>

                {/* 2. THE DESK ITSELF (Khung đăng nhập được thiết kế thành một chiếc bàn) */}
                <div className="w-full relative bg-[#faf7f0] rounded-b-3xl border-2 border-[#3c3127] shadow-[0_20px_45px_rgba(45,35,25,0.1)] overflow-hidden transition-all duration-300 -mt-2">
                    
                    {/* Top Desk Wooden Trim / Gờ Mép Bàn */}
                    <div className="w-full h-4 bg-[#e6dcce] border-b-2 border-[#3c3127] flex items-center justify-between px-6">
                        <div className="w-20 h-0.5 bg-[#cfc2b1] rounded-full" />
                        <div className="w-32 h-0.5 bg-[#cfc2b1] rounded-full" />
                        <div className="w-16 h-0.5 bg-[#cfc2b1] rounded-full" />
                    </div>

                    {/* Desk Drawer Seam & Handle (Rãnh ngăn kéo bàn học sinh) */}
                    <div className="pt-3 pb-1 px-8 flex items-center justify-center relative">
                        <div className="w-full h-0.5 bg-[#ded5c6] rounded" />
                        {/* Minimalist Wooden Drawer Pull / Núm kéo ngăn bàn */}
                        <div className="absolute w-12 h-3 rounded-full border border-[#3c3127] bg-[#ede5d8] flex items-center justify-center shadow-inner">
                            <span className="w-4 h-0.5 bg-[#8c7f70] rounded-full" />
                        </div>
                    </div>

                    {/* Desk Inner Body: The Login Form Content */}
                    <div className="p-6 sm:p-8 pt-5">
                        
                        {/* Desk Branding Header */}
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ede5d8] border border-[#d5c7b3] text-[11px] font-bold tracking-wider uppercase text-[#615243] mb-1.5">
                                <Coffee size={12} className="text-[#726150]" />
                                <span>AnyWarehouse</span>
                            </div>
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#2c231b]">
                                Góc Làm Việc Phân Đội Kho
                            </h1>
                            <p className="text-xs text-[#7d6f60] mt-1 font-medium">
                                {isAwake 
                                    ? `Chú lính chì đã thức giấc chào đón ${accountGreetingName || extractAccountName(email)}!` 
                                    : "Đăng nhập để đánh thức chú lính chì"}
                            </p>
                        </div>

                        {/* Alert Message */}
                        {message && (
                            <div
                                className={`p-3.5 mb-5 rounded-2xl text-xs flex items-start gap-2.5 transition-all animate-in fade-in ${
                                    message.type === 'error'
                                        ? 'bg-[#faecea] border-2 border-[#e8a59f] text-[#9c2b23]'
                                        : 'bg-[#eef6ed] border-2 border-[#abdcb3] text-[#246b21]'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0 bg-current" />
                                <div className="flex-1 font-medium leading-relaxed">
                                    {message.text}
                                </div>
                            </div>
                        )}

                        {/* Login Form */}
                        <form onSubmit={handleAuth} className="space-y-4">
                            {/* Email or Username */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-[#45382c]">
                                    Email hoặc tài khoản kho
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8c7f70] group-focus-within:text-[#2c231b] transition-colors">
                                        <Mail size={17} />
                                    </div>
                                    <input
                                        type="text"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value)
                                            if (!isAwake) {
                                                setAccountGreetingName(extractAccountName(e.target.value))
                                            }
                                        }}
                                        required
                                        className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-[#ffffff] text-[#2c231b] border-2 border-[#3c3127] placeholder:text-[#b0a394] text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-[#3c3127]/10"
                                        placeholder="user@example.com hoặc tenkho.user"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-[#45382c]">
                                    Mật khẩu
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8c7f70] group-focus-within:text-[#2c231b] transition-colors">
                                        <Lock size={17} />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full pl-10 pr-11 py-3.5 rounded-2xl bg-[#ffffff] text-[#2c231b] border-2 border-[#3c3127] placeholder:text-[#b0a394] text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-[#3c3127]/10"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[#8c7f70] hover:text-[#2c231b] transition-colors rounded-lg focus:outline-none"
                                        tabIndex={-1}
                                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button (Enter) */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 px-5 font-bold text-sm tracking-wide rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 text-[#faf7f0] bg-[#3c3127] hover:bg-[#282019] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_6px_20px_rgba(60,49,39,0.25)] cursor-pointer"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            <span>Chú lính chì đang mở hệ thống vào ca...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Đăng Nhập</span>
                                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#54463a] text-[#ded5c8] font-mono font-medium">Enter ↵</span>
                                            <ArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* Unauthorized domain error action */}
                        {isUnauthorizedDomain && (
                            <div className="mt-4 pt-4 border-t border-[#ded5c6]">
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 bg-[#faecea] text-[#9c2b23] hover:bg-[#f6dedb] font-medium text-xs border border-[#f0c2bd]"
                                >
                                    Đăng xuất tài khoản hiện tại & Thử lại
                                </button>
                            </div>
                        )}

                        {/* Footer Branding & Contact */}
                        <div className="mt-6 pt-4 border-t-2 border-dashed border-[#e3d8c8] flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs text-[#7d6f60]">
                                <div className="flex items-center gap-1.5 font-medium">
                                    <span className="text-[11px] text-[#8c7f70]">A Product of</span>
                                    <strong className="text-[#2c231b] font-bold tracking-tight">AnyWarehouse</strong>
                                </div>
                                <a 
                                    href="tel:0374944792" 
                                    className="inline-flex items-center gap-1.5 font-bold text-[#3c3127] hover:underline font-mono tracking-wider transition-colors"
                                    title="Hotline liên hệ"
                                >
                                    <Phone size={12} className="text-[#3c3127]" />
                                    <span>0374944792</span>
                                </a>
                            </div>
                            <div className="text-[11px] text-center text-[#8f8171] font-medium tracking-wider italic">
                                "Anytime, Anywhere"
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. DESK LEGS (Chân bàn tối giản vươn xuống đất) */}
                <div className="w-full px-6 flex items-center justify-between pointer-events-none">
                    {/* Left desk leg */}
                    <div className="w-3.5 h-8 bg-[#cbbdac] border-2 border-[#3c3127] border-t-0 rounded-b-md shadow-sm" />
                    {/* Subtle desk floor shadow */}
                    <div className="w-48 h-1.5 bg-[#45382c]/10 rounded-full blur-[1px]" />
                    {/* Right desk leg */}
                    <div className="w-3.5 h-8 bg-[#cbbdac] border-2 border-[#3c3127] border-t-0 rounded-b-md shadow-sm" />
                </div>
            </div>
        </div>
    )
}
