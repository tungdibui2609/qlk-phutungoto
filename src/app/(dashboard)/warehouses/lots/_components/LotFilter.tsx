import { Search, Filter, Warehouse, HelpCircle, Tag, Package, Hash, MapPin, Layers, LayoutGrid } from 'lucide-react'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { DateRangeFilter, DateFilterField } from '@/components/warehouse/DateRangeFilter'
import { SearchHelpModal } from '@/components/shared/SearchHelpModal'
import { useState } from 'react'
import { SearchMode } from '@/app/(dashboard)/warehouses/map/_hooks/useMapFilters'

interface LotFilterProps {
    searchTerm: string
    onSearchChange: (value: string) => void
    searchMode: SearchMode
    onSearchModeChange: (mode: SearchMode) => void
    positionFilter: 'all' | 'assigned' | 'unassigned'
    onPositionFilterChange: (value: 'all' | 'assigned' | 'unassigned') => void
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

export function LotFilter({
    searchTerm,
    onSearchChange,
    searchMode,
    onSearchModeChange,
    positionFilter,
    onPositionFilterChange,
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
}: LotFilterProps) {
    const [isHelpOpen, setIsHelpOpen] = useState(false)

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-sm space-y-2">
            {/* Row 1: Search, Status & Date Filters (Consolidated for space) */}
            <div className="flex flex-wrap items-center gap-2 w-full">
                {/* Search - Flexible & Primary */}
                <div className="relative flex-[3.5] min-w-[280px] flex items-center bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
                    <div className="flex items-center border-r border-slate-200 dark:border-slate-700 px-2 lg:px-3">
                        {searchMode === 'all' && <Layers size={14} className="text-slate-400 mr-1.5" />}
                        {searchMode === 'name' && <Package size={14} className="text-blue-500 mr-1.5" />}
                        {searchMode === 'code' && <Hash size={14} className="text-purple-500 mr-1.5" />}
                        {searchMode === 'tag' && <Tag size={14} className="text-emerald-500 mr-1.5" />}
                        {searchMode === 'position' && <MapPin size={14} className="text-orange-500 mr-1.5" />}
                        {searchMode === 'category' && <LayoutGrid size={14} className="text-indigo-500 mr-1.5" />}
                        
                        <select
                            value={searchMode}
                            onChange={(e) => onSearchModeChange(e.target.value as SearchMode)}
                            className="bg-transparent border-none text-[10px] lg:text-[11px] font-bold text-slate-600 dark:text-slate-300 focus:ring-0 cursor-pointer p-0 pr-4 appearance-none"
                        >
                            <option value="all">Tổng hợp</option>
                            <option value="name">Theo Tên</option>
                            <option value="code">Theo Mã</option>
                            <option value="tag">Mã phụ</option>
                            <option value="position">Vị trí</option>
                            <option value="category">Danh mục</option>
                        </select>
                    </div>

                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder={
                                searchMode === 'name' ? "Tên sản phẩm..." :
                                searchMode === 'code' ? "Mã Lot, SKU..." :
                                searchMode === 'tag' ? "Mã phụ (tag)..." :
                                searchMode === 'position' ? "Mã vị trí..." :
                                searchMode === 'category' ? "Tên danh mục..." :
                                "Tìm kiếm..."
                            }
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full pl-9 pr-8 py-1.5 bg-transparent border-none outline-none font-medium text-xs lg:text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => setIsHelpOpen(true)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors rounded-full p-0.5"
                            title="Hướng dẫn tìm kiếm"
                        >
                            <HelpCircle size={14} />
                        </button>
                    </div>
                    <SearchHelpModal isOpen={isHelpOpen} onOpenChange={setIsHelpOpen} />
                </div>

                {/* Extra Filters Wrapper - Groups them to wrap together and fills space */}
                <div className={`${showMobileFilters ? 'flex' : 'hidden lg:flex'} flex-wrap items-center gap-2 flex-[4]`}>
                    {/* Position Assignment Status - Smaller */}
                    <div className="flex items-center gap-1.5 bg-blue-50/50 dark:bg-blue-900/20 px-2 py-1.5 rounded-xl border border-blue-100 dark:border-blue-800/50 min-w-[120px]">
                        <Warehouse size={12} className="text-blue-500 shrink-0" />
                        <select
                            value={positionFilter}
                            onChange={(e) => onPositionFilterChange(e.target.value as any)}
                            className="bg-transparent border-none text-[11px] font-bold text-slate-700 dark:text-slate-200 focus:ring-0 cursor-pointer p-0 appearance-none pr-3 w-full"
                        >
                            <option value="all">Vị trí: Tất cả</option>
                            <option value="assigned">Đã gán</option>
                            <option value="unassigned">Chưa gán</option>
                        </select>
                    </div>

                    {/* Lot Status - Smaller */}
                    <div className="flex items-center gap-1.5 bg-emerald-50/50 dark:bg-emerald-900/20 px-2 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50 min-w-[105px]">
                        <Filter size={12} className="text-emerald-500 shrink-0" />
                        <select className="bg-transparent border-none text-[11px] font-bold text-slate-700 dark:text-slate-200 focus:ring-0 cursor-pointer p-0 appearance-none pr-3 w-full">
                            <option value="all">Tất cả TT</option>
                            <option value="active">Hoạt động</option>
                            <option value="closed">Đã đóng</option>
                        </select>
                    </div>

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

            {/* Row 2: Advanced Position Filter (From Map) - Always full width but compact */}
            <div className={`${showMobileFilters ? 'block' : 'hidden lg:block'}`}>
                <HorizontalZoneFilter
                    selectedZoneId={selectedZoneId}
                    onZoneSelect={onZoneSelect}
                    showSearch={false}
                    compact={true}
                />
            </div>
        </div>
    )
}
