'use client'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description?: string
}

export default function EmptyState({
    icon: Icon,
    title,
    description
}: EmptyStateProps) {
    return (
        <div className="bg-white rounded-[32px] border border-stone-200 p-12 text-center text-stone-500 shadow-sm">
            <div className="w-20 h-20 mx-auto mb-6 bg-stone-50 rounded-full flex items-center justify-center border border-stone-100 shadow-inner">
                <Icon className="text-stone-300 stroke-[1]" size={40} />
            </div>
            <h3 className="text-xl font-bold text-stone-800 mb-2">{title}</h3>
            {description && <p className="text-stone-500 max-w-xs mx-auto text-sm leading-relaxed font-medium">{description}</p>}
        </div>
    )
}
