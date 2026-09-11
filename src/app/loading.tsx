import React from 'react'
import Image from 'next/image'
import { Sparkles, Loader2 } from 'lucide-react'

export default function Loading() {
    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#04140e] p-4 text-center select-none overflow-hidden">
            {/* 1. Ambient Luminous Background Orbs */}
            <div className="absolute w-[85vw] sm:w-[520px] h-[85vw] sm:h-[520px] rounded-full bg-emerald-600/20 blur-[130px] -top-24 -left-24 pointer-events-none animate-pulse" />
            <div className="absolute w-[75vw] sm:w-[460px] h-[75vw] sm:h-[460px] rounded-full bg-amber-500/15 blur-[110px] -bottom-24 -right-24 pointer-events-none animate-pulse" />
            <div className="absolute w-[50vw] sm:w-[350px] h-[50vw] sm:h-[350px] rounded-full bg-teal-400/10 blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            {/* 2. Geometric Dot Matrix Overlay */}
            <div 
                className="absolute inset-0 opacity-[0.08] pointer-events-none" 
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.7) 1px, transparent 0)`,
                    backgroundSize: '28px 28px'
                }}
            />

            {/* 3. Subtle Background Image Watermark */}
            <div className="absolute inset-0 pointer-events-none opacity-10 mix-blend-luminosity overflow-hidden">
                <Image
                    src="/durian-bg.png"
                    alt="Background"
                    fill
                    priority
                    className="object-cover object-center scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#04140e] via-[#04140e]/80 to-transparent" />
            </div>

            {/* 4. Center Glassmorphic Showcase Card */}
            <div className="relative z-10 w-full max-w-[340px] sm:max-w-sm px-6 py-8 rounded-[2.5rem] bg-emerald-950/40 backdrop-blur-2xl border border-emerald-500/25 shadow-[0_30px_90px_rgba(0,0,0,0.7),0_0_50px_rgba(16,185,129,0.18)] flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
                
                {/* Logo Section with Glowing Aura */}
                <div className="relative">
                    {/* Pulsing Aura */}
                    <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-emerald-500/35 via-amber-400/25 to-teal-500/35 blur-xl animate-pulse" />
                    
                    {/* Metallic Outer Ring */}
                    <div className="relative p-1 rounded-3xl bg-gradient-to-tr from-emerald-400/50 via-amber-300/40 to-emerald-600/50 shadow-2xl">
                        {/* Logo Container - User's Original Logo */}
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[22px] bg-stone-950/90 border border-emerald-500/30 flex items-center justify-center p-2.5 relative overflow-hidden backdrop-blur-md">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/logoanywarehouse.png"
                                alt="Chánh Thu Logo Gốc"
                                className="w-full h-full object-contain drop-shadow-md"
                            />
                        </div>
                    </div>
                </div>

                {/* Brand Tag & Typography */}
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 backdrop-blur-md text-emerald-300 text-[10.5px] font-bold uppercase tracking-wider shadow-inner">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>Chánh Thu Fruit Group</span>
                    </div>

                    <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                        Hệ Thống Điều Hành <br />
                        <span className="bg-gradient-to-r from-emerald-300 via-amber-200 to-yellow-300 bg-clip-text text-transparent drop-shadow-sm font-black">
                            Kho Lạnh &amp; Ca Kíp
                        </span>
                    </h1>

                    <p className="text-[11.5px] text-emerald-100/70 font-normal leading-relaxed px-2">
                        Quản lý giao việc, điều phối công việc và kiểm soát tồn kho thời gian thực
                    </p>
                </div>

                {/* Modern Glowing Progress Bar */}
                <div className="w-full max-w-[220px] space-y-2.5">
                    <div className="h-1.5 w-full bg-stone-950/80 rounded-full border border-emerald-500/30 overflow-hidden relative shadow-inner">
                        <div className="h-full w-24 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-400 animate-[loadingSlide_1.6s_ease-in-out_infinite]" />
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-300/90">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        <span className="tracking-wide text-[11.5px]">Đang khởi tạo hệ thống...</span>
                    </div>
                </div>

                {/* Footer Signature */}
                <div className="text-[9.5px] font-bold text-emerald-400/40 uppercase tracking-widest pt-1 border-t border-emerald-500/10 w-full">
                    AnyWarehouse Smart WMS
                </div>
            </div>
        </div>
    )
}
