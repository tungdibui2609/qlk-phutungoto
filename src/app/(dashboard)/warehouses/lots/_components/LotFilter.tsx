import { Search, Filter } from 'lucide-react'

interface LotFilterProps {
    searchTerm: string
    onSearchChange: (value: string) => void
    showMobileFilters: boolean
    toggleMobileFilters: () => void
}

export function LotFilter({
    searchTerm,
    onSearchChange,
    showMobileFilters,
    toggleMobileFilters
}: LotFilterProps) {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm sticky top-4 z-10 backdrop-blur-xl bg-opacity-90 dark:bg-opacity-90 transition-all">
            <div className="flex flex-col lg:flex-row items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm mã LOT, ghi chú..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                </div>

                {/* Filter Toggle (Mobile) */}
                <button
                    className="lg:hidden p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                    onClick={toggleMobileFilters}
                >
                    <Filter size={20} />
                </button>

                {/* Extra Filters */}
                <div className={`flex flex-col lg:flex-row items-center gap-3 w-full lg:w-auto ${showMobileFilters ? 'flex' : 'hidden lg:flex'}`}>
                    <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                        <span className="text-xs font-bold text-zinc-500 uppercase px-2">Trạng thái</span>
                        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-600"></div>
                        <select className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer">
                            <option value="all">Tất cả</option>
                            <option value="active">Hoạt động</option>
                            <option value="closed">Đã đóng</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    )
}
