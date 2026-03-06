'use client'

import React from 'react'
import { CompanyInfo } from '@/hooks/usePrintCompanyInfo'

interface PrintHeaderProps {
    companyInfo: CompanyInfo | null
    logoSrc: string | null
    /** Size variant - 'compact' for official forms, 'large' for internal forms */
    size?: 'compact' | 'large'
    /** Optional children to render on the right side (e.g., legal template info) */
    rightContent?: React.ReactNode
    /** Additional class name for the container */
    className?: string
    /** Aggressive vertical compression for A5 continuous paper */
    isA5?: boolean
}

/**
 * Shared print header component displaying company logo and info.
 * Used across all print pages (inbound, outbound, inventory).
 */
export function PrintHeader({
    companyInfo,
    logoSrc,
    size = 'compact',
    rightContent,
    className = '',
    isA5 = false
}: PrintHeaderProps) {
    const isLarge = size === 'large'

    return (
        <div className={`relative ${isA5 ? 'mt-3 mb-1' : 'mb-4'} ${className}`} style={{ fontFamily: "'Times New Roman', Times, serif" }}>
            {/* Right content (e.g., legal template info) */}
            {rightContent && (
                <div className="absolute top-0 right-0">
                    {rightContent}
                </div>
            )}

            <div className={`flex items-center ${isA5 ? 'gap-2.5' : 'gap-3'}`}>
                {/* Logo */}
                <div className="shrink-0">
                    {logoSrc || companyInfo?.logo_url ? (
                        <img
                            src={logoSrc || companyInfo?.logo_url || ''}
                            alt="Logo"
                            className={isA5 ? (isLarge ? "h-14 w-auto object-contain" : "h-10 w-auto object-contain") : (isLarge ? "h-20 w-auto object-contain" : "h-10 w-auto object-contain")}
                        />
                    ) : (
                        <div className={`${isA5 ? (isLarge ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm') : (isLarge ? 'h-20 w-20 text-2xl' : 'h-14 w-14 text-xl')} bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold`}>
                            {companyInfo?.short_name?.[0] || 'C'}
                        </div>
                    )}
                </div>

                {/* Company Info */}
                <div className={`flex flex-col justify-center ${isA5 ? 'gap-0' : 'gap-0.5'} ${isA5 ? 'min-w-0 flex-1' : ''}`}>
                    <div className={`text-black font-bold uppercase leading-tight ${isA5 ? (isLarge ? 'text-[13px]' : 'text-[8px]') : (isLarge ? 'text-sm' : 'text-[10px]')} mb-0 ${isA5 ? '' : 'whitespace-nowrap'}`}>
                        {companyInfo?.name || 'CÔNG TY'}
                    </div>
                    {companyInfo?.address && (
                        <div className={`font-bold text-black leading-tight ${isA5 ? (isLarge ? 'text-[11px]' : 'text-[7px]') : (isLarge ? 'text-sm' : 'text-[8px]')}`}>
                            Địa chỉ: {companyInfo.address}
                        </div>
                    )}
                    <div className={`font-bold text-black leading-tight ${isA5 ? (isLarge ? 'text-[11px]' : 'text-[7px]') : (isLarge ? 'text-sm' : 'text-[8px]')}`}>
                        {companyInfo?.email && `Email: ${companyInfo.email}`}
                        {companyInfo?.email && companyInfo?.phone && <span className="mx-1">|</span>}
                        {companyInfo?.phone && `ĐT: ${companyInfo.phone}`}
                    </div>
                </div>
            </div>
        </div>
    )
}

/**
 * Legal header for official Vietnamese accounting forms (Mẫu số 01-VT, 02-VT)
 */
export function PrintLegalHeader({ formNumber }: { formNumber: '01' | '02' }) {
    return (
        <div className="text-center text-[9px] leading-tight font-bold text-black">
            <div className="text-black font-bold">Mẫu số {formNumber} - VT</div>
            <div>(Ban hành theo Thông tư số 200/2014/TT-BTC</div>
            <div>Ngày 22/12/2014 của Bộ Tài chính)</div>
        </div>
    )
}
