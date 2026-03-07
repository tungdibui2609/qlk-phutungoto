'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check, Search, X } from 'lucide-react'
import { normalizeSearchString } from '@/lib/searchUtils'

export interface ComboboxOption {
    value: string
    label: string
    [key: string]: any
}

interface ComboboxProps {
    options: ComboboxOption[]
    value?: string | null
    onChange: (value: string | null) => void
    onSearchChange?: (value: string) => void
    placeholder?: string
    className?: string
    disabled?: boolean
    isLoading?: boolean
    emptyText?: string
    allowCustom?: boolean
    renderValue?: (option: ComboboxOption) => React.ReactNode
    hideSearchIcon?: boolean
}

export function Combobox({
    options,
    value,
    onChange,
    onSearchChange,
    placeholder = 'Select option...',
    className = '',
    disabled = false,
    isLoading = false,
    emptyText = 'No results found.',
    allowCustom = false,
    renderValue,
    hideSearchIcon = false
}: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Find selected option object
    const selectedOption = useMemo(() =>
        options.find(option => option.value === value),
        [options, value]
    )

    // Filter options based on search term
    // Filter and Sort options based on search term
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options

        const lowerTerm = normalizeSearchString(searchTerm);
        const unaccentedTerm = normalizeSearchString(searchTerm, true);

        return options
            .filter(option => {
                const label = normalizeSearchString(option.label || '');
                const unaccentedLabel = normalizeSearchString(option.label || '', true);

                const sku = normalizeSearchString(option.sku || option.code || '');
                const unaccentedSku = normalizeSearchString(option.sku || option.code || '', true);

                const originalSku = normalizeSearchString(option.originalSku || '');
                const unaccentedOriginalSku = normalizeSearchString(option.originalSku || '', true);

                const originalName = normalizeSearchString(option.originalName || '');
                const unaccentedOriginalName = normalizeSearchString(option.originalName || '', true);

                const labelMatch = label.includes(lowerTerm) || unaccentedLabel.includes(unaccentedTerm)
                const skuMatch = sku.includes(lowerTerm) || unaccentedSku.includes(unaccentedTerm)
                const originalSkuMatch = originalSku.includes(lowerTerm) || unaccentedOriginalSku.includes(unaccentedTerm)
                const originalNameMatch = originalName.includes(lowerTerm) || unaccentedOriginalName.includes(unaccentedTerm)

                return labelMatch || skuMatch || originalSkuMatch || originalNameMatch
            })
            .sort((a, b) => {
                const aLabel = normalizeSearchString(a.label || '', true)
                const bLabel = normalizeSearchString(b.label || '', true)
                const aSku = normalizeSearchString(a.sku || a.code || '', true)
                const bSku = normalizeSearchString(b.sku || b.code || '', true)

                // 1. Exact SKU Match (Highest Priority)
                if (aSku === unaccentedTerm && bSku !== unaccentedTerm) return -1
                if (bSku === unaccentedTerm && aSku !== unaccentedTerm) return 1

                // 2. SKU Starts With
                if (aSku.startsWith(unaccentedTerm) && !bSku.startsWith(unaccentedTerm)) return -1
                if (!aSku.startsWith(unaccentedTerm) && bSku.startsWith(unaccentedTerm)) return 1

                // 3. Label Starts With
                if (aLabel.startsWith(unaccentedTerm) && !bLabel.startsWith(unaccentedTerm)) return -1
                if (!aLabel.startsWith(unaccentedTerm) && bLabel.startsWith(unaccentedTerm)) return 1

                return 0
            })
    }, [options, searchTerm])

    const handleSelect = (option: ComboboxOption) => {
        onChange(option.value)
        setIsOpen(false)
        setSearchTerm('')
    }

    const clearSelection = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange(null)
        setSearchTerm('')
    }

    // Sync input with value or custom text
    useEffect(() => {
        if (!isOpen) {
            if (selectedOption) {
                setSearchTerm(selectedOption.label)
            } else if (allowCustom && !value) {
                // Keep the search term if custom is allowed and no value selected
                // Maybe the parent cleared the value?
            } else if (!value) {
                setSearchTerm('')
            }
        }
    }, [isOpen, selectedOption, value, allowCustom])


    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                className={`
                    relative flex items-center w-full rounded-lg border bg-white dark:bg-zinc-800 
                    ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-zinc-700'} 
                    ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-text'}
                    transition-all duration-200
                `}
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(true)
                        inputRef.current?.focus()
                    }
                }}
            >
                {!hideSearchIcon && (
                    <div className="flex items-center pl-3 text-gray-400">
                        <Search size={16} />
                    </div>
                )}

                {!isOpen && value && selectedOption && renderValue ? (
                    <div className="flex-1 py-1.5 px-2 text-sm cursor-text min-h-[40px] flex items-center">
                        {renderValue(selectedOption)}
                    </div>
                ) : (
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full bg-transparent border-none outline-none py-2 px-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                        placeholder={placeholder}
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value)
                            setIsOpen(true)
                            if (onSearchChange) onSearchChange(e.target.value)
                        }}
                        onFocus={() => setIsOpen(true)}
                        disabled={disabled}
                    />
                )}

                <div className="flex items-center pr-2 gap-1">
                    {value && !disabled && (
                        <button
                            onClick={clearSelection}
                            className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}
                    <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Dropdown Options */}
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    {isLoading ? (
                        <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
                    ) : filteredOptions.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">{emptyText}</div>
                    ) : (
                        <div className="p-1">
                            {filteredOptions.map((option) => (
                                <button
                                    key={option.value}
                                    className={`
                                        w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg text-left transition-colors
                                        ${option.value === value
                                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'}
                                    `}
                                    onClick={() => handleSelect(option)}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {option.value === value && <Check size={16} />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
