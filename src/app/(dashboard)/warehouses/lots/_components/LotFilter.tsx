import { Search, Filter, Calendar, Warehouse } from 'lucide-react'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'

interface LotFilterProps {
    searchTerm: string
    onSearchChange: (value: string) => void
    positionFilter: 'all' | 'assigned' | 'unassigned'
    onPositionFilterChange: (value: 'all' | 'assigned' | 'unassigned') => void
    selectedZoneId: string | null
    onZoneSelect: (zoneId: string | null) => void
    dateFilterField: 'created_at' | 'inbound_date' | 'peeling_date' | 'packaging_date'
    onDateFieldChange: (value: 'created_at' | 'inbound_date' | 'peeling_date' | 'packaging_date') => void
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
    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-sm space-y-2">
            {/* Row 1: Search, Status & Date Filters (Consolidated for space) */}
            <div className="flex flex-wrap items-center gap-2 w-full">
                {/* Search - Flexible & Primary */}
                <div className="relative flex-[3.5] min-w-[280px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm mã LOT, lô hàng..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-medium text-xs lg:text-sm"
                    />
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

                    {/* Date Range Picker - Adjusted to prevent icon clipping */}
                    <div className="flex flex-[1.5] items-center gap-1.5 bg-orange-50/50 dark:bg-orange-900/20 pl-3 pr-2 py-1.5 rounded-xl border border-orange-100 dark:border-orange-800/50 group min-w-[310px]">
                        <Calendar size={12} className="text-orange-500 shrink-0" />
                        <select
                            value={dateFilterField}
                            onChange={(e) => onDateFieldChange(e.target.value as any)}
                            className="bg-transparent border-none text-[11px] font-bold uppercase text-orange-600 dark:text-orange-400 focus:ring-0 cursor-pointer p-0 shrink-0 tracking-wider appearance-none mr-2"
                        >
                            <option value="created_at">Ngày tạo</option>
                            <option value="inbound_date">Ngày nhập</option>
                            <option value="peeling_date">Ngày bóc</option>
                            <option value="packaging_date">Ngày đóng</option>
                        </select>
                        <div className="h-4 w-px bg-orange-200 dark:bg-orange-800 shrink-0"></div>
                        <div className="flex items-center gap-1 px-1 flex-1 min-w-0">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => onStartDateChange(e.target.value)}
                                className="bg-transparent border-none text-[11px] font-bold text-slate-700 dark:text-slate-200 focus:ring-0 p-0 cursor-pointer appearance-none flex-1 min-w-0"
                            />
                            <span className="text-orange-300 dark:text-orange-700 text-[10px] font-black shrink-0 mx-0.5">→</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => onEndDateChange(e.target.value)}
                                className="bg-transparent border-none text-[11px] font-bold text-slate-700 dark:text-slate-200 focus:ring-0 p-0 cursor-pointer appearance-none flex-1 min-w-0"
                            />
                        </div>
                    </div>
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
