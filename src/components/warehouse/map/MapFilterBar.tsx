import { useState, useEffect } from 'react'
import { Search, Filter } from 'lucide-react'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { DateRangeFilter, DateFilterField } from '@/components/warehouse/DateRangeFilter'

interface MapFilterBarProps {
    searchTerm: string
    onSearchChange: (value: string) => void
    selectedZoneId: string | null
    onZoneSelect: (zoneId: string | null) => void
    dateFilterField: DateFilterField
    onDateFieldChange: (value: DateFilterField) => void
    startDate: string
    onStartDateChange: (value: string) => void
    endDate: string
    onEndDateChange: (value: string) => void
    showMobileFilters: boolean
    toggleMobileFilters: () => void
}

export function MapFilterBar({
    searchTerm,
    onSearchChange,
    selectedZoneId,
    onZoneSelect,
    dateFilterField,
    onDateFieldChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    showMobileFilters,
    toggleMobileFilters
}: MapFilterBarProps) {
    // Local state for debounce
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm)

    // Sync local state when parent state changes (e.g. clear filter)
    useEffect(() => {
        setLocalSearchTerm(searchTerm)
    }, [searchTerm])

    // Debounce effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearchTerm !== searchTerm) {
                onSearchChange(localSearchTerm)
            }
        }, 500) // 500ms delay

        return () => clearTimeout(timer)
    }, [localSearchTerm, onSearchChange, searchTerm])

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-sm space-y-2">
            {/* Row 1: Search & Date Filters */}
            <div className="flex items-center gap-2 w-full">
                {/* Search */}
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm mã LOT, lô hàng, sản phẩm..."
                        value={localSearchTerm}
                        onChange={(e) => setLocalSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-medium text-xs lg:text-sm"
                    />
                </div>

                {/* Mobile Filter Toggle */}
                <button
                    className="lg:hidden p-2 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 shadow-sm border border-orange-200 dark:border-orange-800 shrink-0"
                    onClick={toggleMobileFilters}
                >
                    <Filter size={18} />
                </button>

                {/* Desktop Extra Filters Wrapper */}
                <div className="hidden lg:flex items-center gap-2">
                    <DateRangeFilter
                        dateFilterField={dateFilterField}
                        onDateFieldChange={onDateFieldChange}
                        startDate={startDate}
                        onStartDateChange={onStartDateChange}
                        endDate={endDate}
                        onEndDateChange={onEndDateChange}
                        className="min-w-[310px]"
                    />
                </div>
            </div>

            {/* Mobile Expanded Filters */}
            {showMobileFilters && (
                <div className="lg:hidden flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2">
                    <DateRangeFilter
                        dateFilterField={dateFilterField}
                        onDateFieldChange={onDateFieldChange}
                        startDate={startDate}
                        onStartDateChange={onStartDateChange}
                        endDate={endDate}
                        onEndDateChange={onEndDateChange}
                        className="w-full"
                    />
                </div>
            )}

            {/* Row 2: Cascading Zone Filter */}
            <div className={`${showMobileFilters ? 'block' : 'hidden lg:block'}`}>
                <HorizontalZoneFilter
                    selectedZoneId={selectedZoneId}
                    onZoneSelect={onZoneSelect}
                    showSearch={false}
                    compact={true}
                    variant="subtle"
                />
            </div>
        </div>
    )
}
