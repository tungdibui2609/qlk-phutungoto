import { useState, useEffect } from 'react'
import { Search, Filter, HelpCircle, Tag, Package, Hash, MapPin, Layers, LayoutGrid, X, ClipboardList } from 'lucide-react'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { DateRangeFilter, DateFilterField } from '@/components/warehouse/DateRangeFilter'
import { SearchHelpModal } from '@/components/shared/SearchHelpModal'
import { SearchMode } from '@/app/(dashboard)/warehouses/map/_hooks/useMapFilters'

interface MapFilterBarProps {
    searchTerm: string
    onSearchChange: (value: string) => void
    searchMode: SearchMode
    onSearchModeChange: (mode: SearchMode) => void
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
    zones?: any[]
    grouped?: boolean
    hidePendingExport?: boolean
    onHidePendingExportChange?: (val: boolean) => void
}

export function MapFilterBar({
    searchTerm,
    onSearchChange,
    searchMode,
    onSearchModeChange,
    selectedZoneId,
    onZoneSelect,
    dateFilterField,
    onDateFieldChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    showMobileFilters,
    toggleMobileFilters,
    zones,
    grouped,
    hidePendingExport,
    onHidePendingExportChange
}: MapFilterBarProps) {
    // Local state for debounce
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm)
    const [isHelpOpen, setIsHelpOpen] = useState(false)

    // Sync local state when parent state changes (e.g. clear filter)
    useEffect(() => {
        setLocalSearchTerm(searchTerm)
    }, [searchTerm])

    // Manual trigger function
    const handleSearch = () => {
        onSearchChange(localSearchTerm)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-sm space-y-2">
            {/* Row 1: Search & Date Filters */}
            <div className="flex items-center gap-2 w-full">
                {/* Search */}
                <div className="relative flex-1 min-w-0 flex items-center bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
                    <div className="flex items-center border-r border-slate-200 dark:border-slate-700 px-2 lg:px-3">
                        {searchMode === 'all' && <Layers size={14} className="text-slate-400 mr-1.5" />}
                        {searchMode === 'name' && <Package size={14} className="text-blue-500 mr-1.5" />}
                        {searchMode === 'code' && <Hash size={14} className="text-purple-500 mr-1.5" />}
                        {searchMode === 'tag' && <Tag size={14} className="text-emerald-500 mr-1.5" />}
                        {searchMode === 'position' && <MapPin size={14} className="text-orange-500 mr-1.5" />}
                        {searchMode === 'category' && <LayoutGrid size={14} className="text-indigo-500 mr-1.5" />}
                        {searchMode === 'production' && <ClipboardList size={14} className="text-rose-500 mr-1.5" />}
                        
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
                            <option value="production">Lệnh sản xuất</option>
                        </select>
                    </div>

                    <div className="relative flex-1 flex items-center">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder={
                                searchMode === 'name' ? "Nhập tên sản phẩm..." :
                                searchMode === 'code' ? "Nhập mã Lot, SKU..." :
                                searchMode === 'tag' ? "Nhập mã phụ (tag)..." :
                                searchMode === 'position' ? "Nhập mã vị trí (A01...)..." :
                                searchMode === 'category' ? "Nhập tên danh mục..." :
                                searchMode === 'production' ? "Nhập mã lệnh sản xuất..." :
                                "Tìm kiếm nhanh..."
                            }
                            value={localSearchTerm}
                            onChange={(e) => setLocalSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full pl-9 pr-28 py-1.5 bg-transparent border-none outline-none font-medium text-xs lg:text-sm"
                        />
                        <div className="absolute right-1 flex items-center gap-1">
                            {localSearchTerm && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLocalSearchTerm('')
                                        onSearchChange('')
                                    }}
                                    className="text-slate-400 hover:text-red-500 transition-colors rounded-full p-1"
                                    title="Xóa tìm kiếm"
                                >
                                    <X size={14} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsHelpOpen(true)}
                                className="text-slate-400 hover:text-orange-500 transition-colors rounded-full p-1"
                                title="Hướng dẫn tìm kiếm"
                            >
                                <HelpCircle size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={handleSearch}
                                className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] lg:text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all shadow-sm active:scale-95 flex items-center gap-1"
                            >
                                <Search size={12} />
                                Tìm
                            </button>
                        </div>
                    </div>
                </div>
                <SearchHelpModal isOpen={isHelpOpen} onOpenChange={setIsHelpOpen} />

                {/* Mobile Filter Toggle */}
                <button
                    className="lg:hidden p-2 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 shadow-sm border border-orange-200 dark:border-orange-800 shrink-0"
                    onClick={toggleMobileFilters}
                >
                    <Filter size={18} />
                </button>

                {/* Desktop Extra Filters Wrapper */}
                <div className="hidden lg:flex items-center gap-2">
                    {onHidePendingExportChange && (
                        <button
                            type="button"
                            onClick={() => onHidePendingExportChange(!hidePendingExport)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap ${
                                hidePendingExport 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-400' 
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/80'
                            }`}
                            title="Ẩn các vị trí đang có lệnh xuất kho chờ xử lý"
                        >
                            <ClipboardList size={14} className={hidePendingExport ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"} />
                            Ẩn vị trí đang chờ xuất
                        </button>
                    )}

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
                    {onHidePendingExportChange && (
                        <button
                            type="button"
                            onClick={() => onHidePendingExportChange(!hidePendingExport)}
                            className={`flex items-center justify-center gap-2 px-3 py-2 w-full rounded-xl border text-xs font-medium transition-colors ${
                                hidePendingExport 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-400' 
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-300'
                            }`}
                        >
                            <ClipboardList size={14} />
                            Ẩn vị trí đang chờ xuất
                        </button>
                    )}
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
                    zones={zones}
                    grouped={grouped}
                />
            </div>
        </div>
    )
}
