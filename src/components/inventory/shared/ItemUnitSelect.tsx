import { Combobox } from '@/components/ui/Combobox'
import { Product, Unit } from '@/components/inventory/types'
import { normalizeUnit, formatUnitWeight } from '@/lib/unitConversion'

interface ItemUnitSelectProps {
    product: Product | undefined
    units: Unit[]
    value: string
    onChange: (val: string) => void
}

export function ItemUnitSelect({ product, units, value, onChange }: ItemUnitSelectProps) {
    if (!product) return <span className="text-stone-500">-</span>

    // Prepare options: Base Unit + Alternatives
    const options: { value: string; label: string }[] = []
    
    // Add base unit
    let baseWeight = (product as any).weight_kg || 0
    const normBase = normalizeUnit(product.unit || '')
    if (baseWeight <= 0 && (normBase === 'kg' || normBase === 'kilogram')) {
        baseWeight = 1
    }

    if (product.unit) {
        options.push({ value: product.unit, label: product.unit })
    }

    // Add product units (alternative units)
    if (product.product_units && product.product_units.length > 0) {
        product.product_units.forEach((pu: { unit_id: string; conversion_rate: number }) => {
            const uName = units.find(u => u.id === pu.unit_id)?.name
            if (uName) {
                const normU = normalizeUnit(uName)
                const normBase = normalizeUnit(product.unit || '')
                if (normU === normBase) return // Skip if it's the same as the base unit

                const weight = (pu.conversion_rate || 1) * baseWeight
                const labelStr = formatUnitWeight(uName, weight)
                options.push({ value: labelStr, label: labelStr })
            }
        })
    }

    // Deduplicate options by value
    const uniqueOptions = Array.from(
        new Map(options.map(item => [item.value, item])).values()
    )

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
