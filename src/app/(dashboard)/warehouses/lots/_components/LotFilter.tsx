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
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
            {/* Row 1: Search Bar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm mã LOT, SP, ghi chú, vị trí, tag..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-medium"
                    />
                </div>

                {/* Filter Toggle (Mobile) */}
                <button
                    className="lg:hidden p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    onClick={toggleMobileFilters}
                >
                    <Filter size={20} />
                </button>
            </div>

            {/* Row 2: Advanced Position Filter (From Map) */}
            <div className={`${showMobileFilters ? 'block' : 'hidden lg:block'}`}>
                <HorizontalZoneFilter
                    selectedZoneId={selectedZoneId}
                    onZoneSelect={onZoneSelect}
                    showSearch={false}
                />
            </div>

            {/* Row 3: Extra Filters */}
            <div className={`flex flex-wrap items-center gap-4 ${showMobileFilters ? 'flex' : 'hidden lg:flex'}`}>
                {/* Position Assignment Status */}
                <div className="flex items-center gap-2 bg-blue-50/50 dark:bg-blue-900/20 p-2 rounded-2xl border border-blue-100 dark:border-blue-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all group overflow-hidden">
                    <div className="flex items-center gap-2 px-2 shrink-0">
                        <Warehouse size={14} className="text-blue-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Vị trí</span>
                    </div>
                    <div className="h-4 w-px bg-blue-200 dark:bg-blue-800"></div>
                    <select
                        value={positionFilter}
                        onChange={(e) => onPositionFilterChange(e.target.value as any)}
                        className="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 cursor-pointer min-w-[140px] appearance-none pr-8"
                    >
                        <option value="all">Mọi trạng thái gán</option>
                        <option value="assigned">Đã gán vị trí</option>
                        <option value="unassigned">Chưa gán vị trí</option>
                    </select>
                </div>

                {/* Lot Status */}
                <div className="flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-900/20 p-2 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all group overflow-hidden">
                    <div className="flex items-center gap-2 px-2 shrink-0">
                        <Filter size={14} className="text-emerald-500 group-hover:rotate-12 transition-transform" />
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Trạng thái</span>
                    </div>
                    <div className="h-4 w-px bg-emerald-200 dark:bg-emerald-800"></div>
                    <select className="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 cursor-pointer min-w-[100px] appearance-none pr-8">
                        <option value="all">Tất cả</option>
                        <option value="active">Hoạt động</option>
                        <option value="closed">Đã đóng</option>
                    </select>
                </div>

                {/* Date Range Picker */}
                <div className="flex flex-1 min-w-[340px] items-center gap-2 bg-orange-50/50 dark:bg-orange-900/20 p-2 rounded-2xl border border-orange-100 dark:border-orange-800/50 hover:border-orange-300 dark:hover:border-orange-700 transition-all group overflow-hidden">
                    <div className="flex items-center gap-2 px-2 shrink-0">
                        <Calendar size={14} className="text-orange-500 group-hover:scale-110 transition-transform" />
                        <select
                            value={dateFilterField}
                            onChange={(e) => onDateFieldChange(e.target.value as any)}
                            className="bg-transparent border-none text-[10px] font-bold uppercase text-orange-600 dark:text-orange-400 focus:ring-0 cursor-pointer p-0 shrink-0 tracking-wider appearance-none"
                        >
                            <option value="created_at">Ngày tạo</option>
                            <option value="inbound_date">Ngày nhập kho</option>
                            <option value="peeling_date">Ngày bóc múi</option>
                            <option value="packaging_date">Ngày đóng gói</option>
                        </select>
                    </div>
                    <div className="h-4 w-px bg-orange-200 dark:bg-orange-800 shrink-0"></div>
                    <div className="flex items-center gap-2 px-2 flex-1 relative">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => onStartDateChange(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 p-0 cursor-pointer appearance-none flex-1 min-w-[100px]"
                        />
                        <span className="text-orange-300 dark:text-orange-700 text-[10px] font-black shrink-0">→</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => onEndDateChange(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 p-0 cursor-pointer appearance-none flex-1 min-w-[100px]"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
