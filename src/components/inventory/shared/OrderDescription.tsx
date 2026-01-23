import { OrderSection } from './OrderSection'

interface OrderDescriptionProps {
    description: string
    setDescription: (v: string) => void
    placeholder?: string
}

export function OrderDescription({ description, setDescription, placeholder = "Diễn giải..." }: OrderDescriptionProps) {
    return (
        <OrderSection title="Diễn giải" color="bg-stone-400">
            <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg h-20 resize-none text-sm outline-none focus:ring-2 focus:ring-stone-400"
                placeholder={placeholder}
            />
        </OrderSection>
    )
}
