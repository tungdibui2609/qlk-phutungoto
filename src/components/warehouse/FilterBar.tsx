'use client'
import { useState, useRef, useMemo } from 'react'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'
import { Database } from '@/lib/database.types'

type Zone = Database['public']['Tables']['zones']['Row']

export interface FilterState {
    status: 'all' | 'empty' | 'occupied'
    zoneId: string | null
    searchTerm: string
    searchTags: string[]
}

interface FilterBarProps {
    filters: FilterState
    onChange: (filters: FilterState) => void
    zones: Zone[]
    occupiedCount: number
    emptyCount: number
}

export default function FilterBar({
    filters,
    onChange,
    zones,
    occupiedCount,
    emptyCount
}: FilterBarProps) {
    const [isFilterVisible, setIsFilterVisible] = useState(true)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)

    // Get root zones (level 0 or 1, no parent)
    const rootZones = useMemo(() => {
        return zones.filter(z => !z.parent_id || (z.level ?? 0) <= 1).sort((a, b) => a.code.localeCompare(b.code))
    }, [zones])

    const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
        onChange({ ...filters, [key]: value })
    }

    const handleSearchChange = (val: string) => {
        updateFilter('searchTerm', val)
    }

    const handleAddTag = (tag: string) => {
        if (!tag.trim()) return
        const newTags = [...filters.searchTags, tag.trim()]
        onChange({ ...filters, searchTags: newTags, searchTerm: '' })
        setShowSuggestions(false)
    }

    const handleRemoveTag = (idx: number) => {
        const newTags = filters.searchTags.filter((_, i) => i !== idx)
        updateFilter('searchTags', newTags)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && filters.searchTerm.trim()) {
            e.preventDefault()
            handleAddTag(filters.searchTerm)
        } else if (e.key === 'Backspace' && !filters.searchTerm && filters.searchTags.length > 0) {
            const newTags = [...filters.searchTags]
            newTags.pop()
            updateFilter('searchTags', newTags)
        }
    }

    const clearAllFilters = () => {
        onChange({
            status: 'all',
            zoneId: null,
            searchTerm: '',
            searchTags: []
        })
    }

    const hasActiveFilters = filters.status !== 'all' ||
        filters.zoneId !== null ||
        filters.searchTags.length > 0

    return (
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 shadow-sm flex flex-col gap-3">

            {/* Collapsible Content */}
            <div className={`${isFilterVisible ? "block" : "hidden"} lg:block`}>
                {/* Content Container */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                    {/* Left: Filters Area */}
                    <div className="flex flex-col gap-3 w-full sm:w-auto">

                        {/* Zone Tabs */}
                        <div className="flex w-full sm:w-auto items-center p-1 bg-white dark:bg-zinc-800 rounded-xl overflow-x-auto no-scrollbar gap-2 shadow-sm border border-zinc-200 dark:border-zinc-700">
                            <button
                                onClick={() => updateFilter('zoneId', null)}
                                className={`flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap text-center ${!filters.zoneId
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                    }`}
                            >
                                Tất cả
                            </button>
                            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1 flex-none" />
                            {rootZones.slice(0, 5).map(zone => (
                                <button
                                    key={zone.id}
                                    onClick={() => updateFilter('zoneId', zone.id)}
                                    className={`relative flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap text-center ${filters.zoneId === zone.id
                                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-700/50"
                                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                        }`}
                                >
                                    {zone.name}
                                    {filters.zoneId === zone.id && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-zinc-900" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Dropdowns Row */}
                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full">
                            {/* Zone Dropdown (for all zones) */}
                            <select
                                value={filters.zoneId || ''}
                                onChange={(e) => updateFilter('zoneId', e.target.value || null)}
                                className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
                            >
                                <option value="">Tất cả zone</option>
                                {zones.map(z => (
                                    <option key={z.id} value={z.id}>
                                        {'  '.repeat(z.level || 0)}{z.code} - {z.name}
                                    </option>
                                ))}
                            </select>

                            {/* Status Filter */}
                            <select
                                value={filters.status}
                                onChange={(e) => updateFilter('status', e.target.value as FilterState['status'])}
                                className={`px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors w-full sm:w-auto ${filters.status !== 'all'
                                    ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                                    }`}
                            >
                                <option value="all">Tất cả trạng thái</option>
                                <option value="empty">Vị trí trống ({emptyCount})</option>
                                <option value="occupied">Có hàng ({occupiedCount})</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Bottom Row: Search & Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3">

                    {/* Search Input with Tags */}
                    <div className="flex-1 w-full max-w-4xl flex gap-2">
                        <div
                            className="relative group flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg flex items-center p-1 cursor-text focus-within:ring-2 focus-within:ring-blue-500 transition-all shadow-sm"
                            onClick={() => searchInputRef.current?.focus()}
                        >
                            {/* Search Icon */}
                            <div className="pl-2 pr-2 text-zinc-400">
                                <Search size={16} />
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1">
                                {filters.searchTags.map((tag, idx) => (
                                    <span key={idx} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded text-sm font-medium">
                                        {tag}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleRemoveTag(idx)
                                            }}
                                            className="hover:text-blue-900 dark:hover:text-blue-200"
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}

                                {/* Input */}
                                <input
                                    ref={searchInputRef}
                                    value={filters.searchTerm}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={filters.searchTags.length > 0 ? "Thêm..." : "Tìm vị trí, sản phẩm..."}
                                    className="bg-transparent border-none outline-none text-sm min-w-[120px] flex-1 py-1"
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <button
                            onClick={() => filters.searchTerm && handleAddTag(filters.searchTerm)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                        >
                            Tìm
                        </button>
                        {hasActiveFilters && (
                            <button
                                onClick={clearAllFilters}
                                className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 px-4 py-2 rounded-lg font-medium text-sm transition-colors border border-zinc-200 dark:border-zinc-600"
                            >
                                Xóa lọc
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Toggle Button */}
            <button
                onClick={() => setIsFilterVisible(!isFilterVisible)}
                className="lg:hidden flex items-center justify-center w-full py-1"
            >
                {isFilterVisible ? (
                    <ChevronUp size={20} className="text-zinc-400" />
                ) : (
                    <ChevronDown size={20} className="text-zinc-400" />
                )}
            </button>
        </div>
    )
}
