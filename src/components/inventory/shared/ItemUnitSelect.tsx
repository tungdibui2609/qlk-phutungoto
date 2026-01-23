import { Combobox } from '@/components/ui/Combobox'
import { Product, Unit } from '@/components/inventory/types'

interface ItemUnitSelectProps {
    product: Product | undefined
    units: Unit[]
    value: string
    onChange: (val: string) => void
}

export function ItemUnitSelect({ product, units, value, onChange }: ItemUnitSelectProps) {
    if (!product) return <span className="text-stone-500">-</span>

    // Prepare options: Base Unit + Alternatives
    const options = []
    if (product.unit) {
        options.push({ value: product.unit, label: product.unit })
    }
    if (product.product_units && product.product_units.length > 0) {
        product.product_units.forEach(pu => {
            const uName = units.find(u => u.id === pu.unit_id)?.name
            if (uName) {
                options.push({ value: uName, label: uName })
            }
        })
    }

    // Deduplicate
    const uniqueOptions = Array.from(new Map(options.map(item => [item['value'], item])).values())

    if (uniqueOptions.length <= 1) {
        return <div className='text-center text-sm font-medium text-stone-700'>{value || product.unit || '-'}</div>
    }

    return (
        <Combobox
            options={uniqueOptions}
            value={value}
            onChange={(val) => onChange(val || '')}
            hideSearchIcon={true}
            placeholder="-- ĐVT --"
            className="w-full"
            renderValue={(option) => (
                <div className="text-center w-full font-medium text-stone-700 dark:text-gray-200">
                    {option.label}
                </div>
            )}
        />
    )
}
