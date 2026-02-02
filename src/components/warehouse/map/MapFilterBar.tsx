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
    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-sm space-y-2">
            {/* Row 1: Search & Date Filters */}
            <div className="flex flex-wrap items-center gap-2 w-full">
                {/* Search */}
                <div className="relative flex-[3.5] min-w-[280px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm mã LOT, lô hàng, sản phẩm..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-medium text-xs lg:text-sm"
                    />
                </div>

                {/* Extra Filters Wrapper */}
                <div className={`${showMobileFilters ? 'flex' : 'hidden lg:flex'} flex-wrap items-center gap-2 flex-[4]`}>
                    <DateRangeFilter
                        dateFilterField={dateFilterField}
                        onDateFieldChange={onDateFieldChange}
                        startDate={startDate}
                        onStartDateChange={onStartDateChange}
                        endDate={endDate}
                        onEndDateChange={onEndDateChange}
                        className="flex-[1.5] min-w-[310px]"
                    />
                </div>

                {/* Mobile Filter Toggle */}
                <button
                    className="lg:hidden ml-auto p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm"
                    onClick={toggleMobileFilters}
                >
                    <Filter size={18} />
                </button>
            </div>

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
