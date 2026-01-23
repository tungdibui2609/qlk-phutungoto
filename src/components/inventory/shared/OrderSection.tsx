interface OrderSectionProps {
    title: string
    color?: string
    children: React.ReactNode
    rightElement?: React.ReactNode
}

export function OrderSection({ title, color = 'bg-stone-400', children, rightElement }: OrderSectionProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-zinc-800">
                <div className={`w-1 h-4 rounded-full ${color}`} />
                <h3 className="font-semibold text-stone-800 dark:text-white text-sm">{title}</h3>
                {rightElement && (
                    <div className="ml-auto">
                        {rightElement}
                    </div>
                )}
            </div>
            {children}
        </div>
    )
}
