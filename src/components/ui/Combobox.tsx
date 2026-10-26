'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search, X, Sparkles } from 'lucide-react'
import { normalizeSearchString, calculateSearchScore } from '@/lib/searchUtils'

export interface ComboboxOption {
    value: string
    label: string
    [key: string]: any
}

interface ComboboxProps {
    options: ComboboxOption[]
    optionsMap?: Map<string, ComboboxOption>
    value?: string | null
    onChange: (value: string | null) => void
    onSearchChange?: (value: string) => void
    onPaste?: (e: React.ClipboardEvent<any>) => void
    placeholder?: string
    className?: string
    disabled?: boolean
    isLoading?: boolean
    emptyText?: string
    allowCustom?: boolean
    renderValue?: (option: ComboboxOption) => React.ReactNode
    renderOption?: (option: ComboboxOption, searchTerm: string) => React.ReactNode
    hideSearchIcon?: boolean
    /** Tiêu đề dải gợi ý, ví dụ "Gợi ý sản phẩm". Bỏ trống = không hiển thị dải tiêu đề. */
    suggestionLabel?: string
}

export function Combobox({
    options,
    optionsMap,
    value,
    onChange,
    onSearchChange,
    onPaste,
    placeholder = 'Select option...',
    className = '',
    disabled = false,
    isLoading = false,
    emptyText = 'No results found.',
    allowCustom = false,
    renderValue,
    renderOption,
    hideSearchIcon = false,
    suggestionLabel
}: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [highlightedIndex, setHighlightedIndex] = useState(0)
    const [navTouched, setNavTouched] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })

    // Update coordinates when opening and on scroll/resize
    useEffect(() => {
        const updateCoords = () => {
            if (isOpen && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect()
                setCoords({
                    top: rect.bottom,
                    left: rect.left,
                    width: rect.width
                })
            }
        }

        if (isOpen) {
            updateCoords()
            // Listen to scroll events on any parent element
            window.addEventListener('scroll', updateCoords, true)
            window.addEventListener('resize', updateCoords)
        }

        return () => {
            window.removeEventListener('scroll', updateCoords, true)
            window.removeEventListener('resize', updateCoords)
        }
    }, [isOpen])

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const isClickInsideContainer = containerRef.current && containerRef.current.contains(event.target as Node)
            const isClickInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target as Node)

            if (!isClickInsideContainer && !isClickInsideDropdown) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Find selected option object
    const selectedOption = useMemo(() => {
        if (optionsMap && value) return optionsMap.get(value) || null
        return options.find(option => option.value === value)
    }, [options, optionsMap, value])

    // Filter options based on search term
    // Filter and Sort options based on search term
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options

        return options
            .map(option => ({
                option,
                score: calculateSearchScore(option, searchTerm)
            }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.option)
    }, [options, searchTerm])

    useEffect(() => {
        setHighlightedIndex(0)
        setNavTouched(false)
    }, [searchTerm, filteredOptions.length])

    useEffect(() => {
        if (!isOpen) return
        dropdownRef.current
            ?.querySelector(`[data-opt-index="${highlightedIndex}"]`)
            ?.scrollIntoView({ block: 'nearest' })
    }, [isOpen, highlightedIndex])

    const handleSelect = (option: ComboboxOption) => {        onChange(option.value)
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
                tabIndex={disabled ? -1 : 0}
                onPaste={onPaste}
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
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setIsOpen(false)
                                return
                            }
                            if (!isOpen || filteredOptions.length === 0) return

                            if (e.key === 'ArrowDown') {
                                e.preventDefault()
                                setNavTouched(true)
                                setHighlightedIndex(i => (i + 1) % filteredOptions.length)
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault()
                                setNavTouched(true)
                                setHighlightedIndex(i => (i - 1 + filteredOptions.length) % filteredOptions.length)
                            } else if (e.key === 'Enter' && searchTerm.trim()) {
                                e.preventDefault()
                                handleSelect(filteredOptions[highlightedIndex])
                            }
                        }}
                        onPaste={onPaste}
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

            {/* Dropdown Options using Portal */}
            {isOpen && !disabled && typeof document !== 'undefined' && createPortal(
                <div 
                    ref={dropdownRef}
                    className="fixed z-[9999] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-2xl max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 [scrollbar-width:thin] [scrollbar-color:theme(colors.zinc.300)_transparent] dark:[scrollbar-color:theme(colors.zinc.700)_transparent]"
                    style={{
                        top: coords.top + 4, // 4px gap
                        left: coords.left,
                        width: coords.width,
                    }}
                >
                    {isLoading ? (
                        <div className="p-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                            Loading...
                        </div>
                    ) : filteredOptions.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">{emptyText}</div>
                    ) : (
                        <>
                            {suggestionLabel && searchTerm.trim() && (
                                <div className="sticky top-0 z-10 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <span className="flex items-center gap-1 shrink-0">
                                        <Sparkles size={12} />
                                        {suggestionLabel} ({filteredOptions.length})
                                    </span>
                                    <span className="text-[10px] font-normal text-slate-400 truncate">
                                        Dùng ↑↓ để chọn, Enter để xác nhận
                                    </span>
                                </div>
                            )}
                            <div className="p-1">
                            {filteredOptions.map((option, idx) => (
                                <button
                                    key={option.value}
                                    data-opt-index={idx}
                                    onMouseEnter={() => { setNavTouched(true); setHighlightedIndex(idx) }}
                                    className={`
                                        w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg text-left transition-colors
                                        ${(idx === highlightedIndex && (searchTerm.trim() || navTouched))
                                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100'
                                            : option.value === value
                                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'}
                                    `}
                                    onClick={() => handleSelect(option)}
                                >
                                    {renderOption ? (
                                        renderOption(option, searchTerm)
                                    ) : (
                                        <div className="flex flex-col text-left py-0.5 min-w-0 flex-1 pr-2">
                                            <span className="truncate font-medium">{option.label}</span>
                                            {option.aliases && (
                                                <span className="text-[10px] text-stone-400 dark:text-zinc-400 truncate mt-0.5">
                                                    Viết tắt: {option.aliases}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {option.value === value && <Check size={16} />}
                                </button>
                            ))}
                        </div>
                        </>
                    )}
                </div>,
                document.body
            )}
        </div>
    )
}
