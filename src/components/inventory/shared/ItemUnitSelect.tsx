import { Combobox } from '@/components/ui/Combobox'
import { Product, Unit } from '@/components/inventory/types'
import { normalizeUnit, formatUnitWeight, extractWeightFromName } from '@/lib/unitConversion'

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

    // Khớp mềm value với options để tránh hiển thị rỗng -- ĐVT -- khi có sự sai lệch nhỏ về ký tự hoặc floating-point
    let effectiveValue = value
    if (value) {
        const exact = uniqueOptions.find(opt => opt.value === value)
        if (!exact) {
            const normVal = value.toLowerCase().replace(/\s+/g, '')
            const fuzzy = uniqueOptions.find(opt => opt.value.toLowerCase().replace(/\s+/g, '') === normVal)
            if (fuzzy) {
                effectiveValue = fuzzy.value
            } else {
                // Thử khớp theo khối lượng trích xuất (ví dụ 9.600000000000001kg vs 9.6kg)
                const wVal = extractWeightFromName(value)
                if (wVal !== null) {
                    const byWeight = uniqueOptions.find(opt => {
                        const wOpt = extractWeightFromName(opt.value)
                        return wOpt !== null && Math.abs(wOpt - wVal) < 0.001
                    })
                    if (byWeight) {
                        effectiveValue = byWeight.value
                    }
                }
            }
            // Nếu vẫn không khớp trong options nhưng có value, bổ sung vào options để Combobox không bị rỗng
            if (!uniqueOptions.some(opt => opt.value === effectiveValue)) {
                uniqueOptions.push({ value: effectiveValue, label: effectiveValue })
            }
        }
    }

    if (uniqueOptions.length <= 1) {
        return <div className='text-center text-sm font-medium text-stone-700 dark:text-stone-300'>{effectiveValue || product.unit || '-'}</div>
    }

    return (
        <Combobox
            options={uniqueOptions}
            value={effectiveValue}
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
