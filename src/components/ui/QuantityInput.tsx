'use client'

import React, { useState, useEffect } from 'react'
import { parseQuantity } from '@/lib/numberUtils'
import { cn } from '@/lib/utils'

interface QuantityInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number | string
    onChange: (val: number) => void
    onBlurCustom?: (val: number) => void
    precision?: number
}

/**
 * A specialized input for quantities that supports both dot and comma
 * and maintains a clean user experience while typing decimals.
 */
export const QuantityInput: React.FC<QuantityInputProps> = ({
    value,
    onChange,
    onBlurCustom,
    precision = 6,
    className,
    ...props
}) => {
    // Local display value to allow intermediate states like "12," or "12."
    const [displayValue, setDisplayValue] = useState<string>('')

    useEffect(() => {
        // Update local state when prop value changes from outside
        // But only if it's materially different to avoid cursor jumps
        const parsedDisplay = parseQuantity(displayValue)
        const numericValue = typeof value === 'string' ? parseQuantity(value) : value

        if (parsedDisplay !== numericValue) {
            // Format for display: use comma normally as per VI culture if preferred,
            // but let's stick to what's coming in or just raw string.
            // If the value is 0 and display is empty, keep it empty
            if (numericValue === 0 && displayValue === '') return
            setDisplayValue(numericValue.toString().replace('.', ','))
        }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value

        // Allow common decimal separators and digits
        // regex: numbers, one dot or one comma
        if (/^[0-9]*[,.]?[0-9]*$/.test(val) || val === '') {
            setDisplayValue(val)
            const parsed = parseQuantity(val)
            onChange(parsed)
        }
    }

    const handleBlur = () => {
        const parsed = parseQuantity(displayValue)
        // Normalize display on blur (e.g. "12," -> "12")
        setDisplayValue(parsed === 0 && displayValue === '' ? '' : parsed.toString().replace('.', ','))
        if (onBlurCustom) onBlurCustom(parsed)
    }

    return (
        <input
            {...props}
            type="text"
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            className={cn(
                "w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-sm transition-all font-mono",
                className
            )}
        />
    )
}
