'use client'
import { CheckCircle, XCircle } from 'lucide-react'

interface StatusBadgeProps {
    isActive: boolean | null | undefined
    activeText?: string
    inactiveText?: string
}

export default function StatusBadge({
    isActive,
    activeText = 'Hoạt động',
    inactiveText = 'Ngừng'
}: StatusBadgeProps) {
    if (isActive) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm shadow-emerald-500/5">
                <CheckCircle size={12} className="stroke-[3]" />
                {activeText}
            </span>
        )
    }

    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-stone-100 text-stone-500 border border-stone-200">
            <XCircle size={12} className="stroke-[3]" />
            {inactiveText}
        </span>
    )
}
