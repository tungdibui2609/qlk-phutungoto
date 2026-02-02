'use client'
import Link from 'next/link'
import { Plus, LucideIcon } from 'lucide-react'
import Protected from '@/components/auth/Protected'

interface PageHeaderProps {
    title: string
    subtitle?: string
    description?: string
    icon?: LucideIcon
    badge?: string
    actionLink?: string
    actionText?: string
    permission?: string
}

export default function PageHeader({
    title,
    subtitle,
    description,
    icon: Icon,
    badge,
    actionLink,
    actionText,
    permission
}: PageHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                {subtitle && (
                    <div className="flex items-center gap-2 mb-1">
                        {Icon && <Icon className="text-orange-500" size={18} />}
                        <span className="text-orange-600 text-sm font-medium">{subtitle}</span>
                    </div>
                )}
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-stone-800 tracking-tight">{title}</h1>
                    {badge && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold uppercase tracking-wider border border-orange-200">
                            {badge}
                        </span>
                    )}
                </div>
                {(description || description === undefined) && (
                    <p className="text-stone-500 text-sm mt-1">{description}</p>
                )}
            </div>

            {actionLink && actionText && (
                permission ? (
                    <Protected permission={permission}>
                        <Link
                            href={actionLink}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white transition-all duration-300 hover:-translate-y-1 active:scale-95 shadow-[0_4px_15px_rgba(249,115,22,0.3)] hover:shadow-[0_8px_25px_rgba(249,115,22,0.4)] active:shadow-none"
                            style={{
                                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            }}
                        >
                            <Plus size={20} className="stroke-[3]" />
                            {actionText}
                        </Link>
                    </Protected>
                ) : (
                    <Link
                        href={actionLink}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white transition-all duration-300 hover:-translate-y-1 active:scale-95 shadow-[0_4px_15px_rgba(249,115,22,0.3)] hover:shadow-[0_8px_25px_rgba(249,115,22,0.4)] active:shadow-none"
                        style={{
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                        }}
                    >
                        <Plus size={20} className="stroke-[3]" />
                        {actionText}
                    </Link>
                )
            )}
        </div>
    )
}
