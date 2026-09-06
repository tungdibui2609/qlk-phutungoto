import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, Filter, HelpCircle, Tag, Package, Hash, MapPin, Layers, LayoutGrid, X, ClipboardList, Sparkles, CornerDownLeft } from 'lucide-react'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { DateRangeFilter, DateFilterField } from '@/components/warehouse/DateRangeFilter'
import { SearchHelpModal } from '@/components/shared/SearchHelpModal'
import { SearchMode } from '@/app/(dashboard)/warehouses/map/_hooks/useMapFilters'
import { calculateSearchScore, matchSearch } from '@/lib/searchUtils'

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
    categories?: any[]
    selectedCategoryId?: string | null
    onCategorySelect?: (catId: string | null) => void
    products?: any[]
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
    onHidePendingExportChange,
    categories,
    selectedCategoryId,
    onCategorySelect,
    products
}: MapFilterBarProps) {
    // Local state for debounce
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm)
    const [isHelpOpen, setIsHelpOpen] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const searchContainerRef = useRef<HTMLDivElement>(null)

    // Sync local state when parent state changes (e.g. clear filter)
    useEffect(() => {
        setLocalSearchTerm(searchTerm)
    }, [searchTerm])

    // Đóng gợi ý khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Tính toán gợi ý thông minh từ danh sách sản phẩm (bao gồm cả tên gõ tắt aliases)
    const suggestions = useMemo(() => {
        const term = localSearchTerm.trim()
        if (!term || !products || products.length === 0) return []

        const list: Array<{
            product: any
            score: number
            matchedAlias?: string
            matchedCode?: string
        }> = []

        for (const p of products) {
            const score = calculateSearchScore(p, term)

            if (score > 0) {
                let matchedAlias: string | undefined
                if (p.aliases) {
                    const aliasItems = p.aliases.split(',').map((a: string) => a.trim()).filter(Boolean)
                    const found = aliasItems.find((a: string) => matchSearch(a, term))
                    if (found) matchedAlias = found
                }

                let matchedCode: string | undefined
                if (p.internal_code && matchSearch(p.internal_code, term)) {
                    matchedCode = p.internal_code
                } else if (p.sku && matchSearch(p.sku, term)) {
                    matchedCode = p.sku
                }

                list.push({ product: p, score, matchedAlias, matchedCode })
            }
        }

        return list
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
    }, [localSearchTerm, products])

    // Manual trigger function
    const handleSearch = (termToSearch?: string) => {
        const target = termToSearch !== undefined ? termToSearch : localSearchTerm
        onSearchChange(target)
        setShowSuggestions(false)
    }

    const handleSelectSuggestion = (item: typeof suggestions[0]) => {
        const targetName = item.product.name
        setLocalSearchTerm(targetName)
        handleSearch(targetName)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0))
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1))
                return
            }
            if (e.key === 'Enter') {
                e.preventDefault()
                if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                    handleSelectSuggestion(suggestions[highlightedIndex])
                    return
                }
            }
            if (e.key === 'Escape') {
                e.preventDefault()
                setShowSuggestions(false)
                return
            }
        }

        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-sm space-y-2">
            {/* Row 1: Search & Date Filters */}
            <div className="flex items-center gap-2 w-full">
                {/* Search */}
                <div 
                    ref={searchContainerRef}
                    className="relative flex-1 min-w-0 flex items-center bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all"
                >
                    <div className="flex items-center border-r border-slate-200 dark:border-slate-700 px-2 lg:px-3">
                        {searchMode === 'all' && <Layers size={14} className="text-slate-400 mr-1.5" />}
                        {searchMode === 'name' && <Package size={14} className="text-emerald-600 mr-1.5" />}
                        {searchMode === 'code' && <Hash size={14} className="text-purple-500 mr-1.5" />}
                        {searchMode === 'tag' && <Tag size={14} className="text-amber-500 mr-1.5" />}
                        {searchMode === 'position' && <MapPin size={14} className="text-emerald-600 mr-1.5" />}
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
                                searchMode === 'name' ? "Nhập tên sản phẩm hoặc tên gõ tắt..." :
                                searchMode === 'code' ? "Nhập mã Lot, SKU..." :
                                searchMode === 'tag' ? "Nhập mã phụ (tag)..." :
                                searchMode === 'position' ? "Nhập mã vị trí (A01...)..." :
                                searchMode === 'category' ? "Nhập tên danh mục..." :
                                searchMode === 'production' ? "Nhập mã LSX hoặc mã lot sản xuất..." :
                                "Tìm kiếm nhanh (hỗ trợ tên gõ tắt, SKU, vị trí)..."
                            }
                            value={localSearchTerm}
                            onChange={(e) => {
                                setLocalSearchTerm(e.target.value)
                                setShowSuggestions(true)
                                setHighlightedIndex(-1)
                            }}
                            onFocus={() => {
                                if (localSearchTerm.trim().length > 0) {
                                    setShowSuggestions(true)
                                }
                            }}
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
                                        setShowSuggestions(false)
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
                                className="text-slate-400 hover:text-emerald-600 transition-colors rounded-full p-1"
                                title="Hướng dẫn tìm kiếm"
                            >
                                <HelpCircle size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSearch()}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] lg:text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all shadow-sm active:scale-95 flex items-center gap-1"
                            >
                                <Search size={12} />
                                Tìm
                            </button>
                        </div>
                    </div>

                    {/* Autocomplete Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                    <Sparkles size={12} />
                                    Gợi ý sản phẩm ({suggestions.length})
                                </span>
                                <span className="text-[10px] font-normal text-slate-400">
                                    Dùng ↑↓ để chọn, Enter để tìm
                                </span>
                            </div>

                            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                                {suggestions.map((item, idx) => {
                                    const isHighlighted = idx === highlightedIndex
                                    const p = item.product

                                    return (
                                        <div
                                            key={p.id || idx}
                                            onClick={() => handleSelectSuggestion(item)}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                                                isHighlighted 
                                                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100' 
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-semibold text-xs truncate max-w-full">
                                                        {p.name}
                                                    </span>
                                                    {item.matchedAlias ? (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black tracking-wide shrink-0">
                                                            ⚡ {item.matchedAlias}
                                                        </span>
                                                    ) : p.aliases ? (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-medium shrink-0">
                                                            Tắt: {p.aliases.split(',')[0]}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                                    {p.sku && <span>SKU: {p.sku}</span>}
                                                    {p.internal_code && (
                                                        <span className="text-purple-600 dark:text-purple-400 font-bold">
                                                            NB: {p.internal_code}
                                                        </span>
                                                    )}
                                                    {p.unit && <span>ĐVT: {p.unit}</span>}
                                                </div>
                                            </div>

                                            <CornerDownLeft size={13} className={`shrink-0 transition-opacity ${isHighlighted ? 'opacity-100 text-emerald-600' : 'opacity-0'}`} />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
                <SearchHelpModal isOpen={isHelpOpen} onOpenChange={setIsHelpOpen} />

                {/* Mobile Filter Toggle */}
                <button
                    className="lg:hidden p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm border border-emerald-200 dark:border-emerald-800 shrink-0"
                    onClick={toggleMobileFilters}
                >
                    <Filter size={18} />
                </button>

                {/* Desktop Extra Filters Wrapper */}
                <div className="hidden lg:flex items-center gap-2">
                    {categories && categories.length > 0 && onCategorySelect && (
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 shrink-0">
                            <LayoutGrid size={14} className="text-indigo-500 shrink-0" />
                            <select
                                value={selectedCategoryId || 'all'}
                                onChange={(e) => onCategorySelect(e.target.value === 'all' ? null : e.target.value)}
                                className="bg-transparent border-none text-xs font-medium text-slate-700 dark:text-slate-300 focus:ring-0 cursor-pointer pr-4 appearance-none outline-none max-w-[150px] truncate"
                            >
                                <option value="all">Tất cả danh mục</option>
                                {categories.map((cat: any) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

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
                    {categories && categories.length > 0 && onCategorySelect && (
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 w-full">
                            <LayoutGrid size={14} className="text-indigo-500 shrink-0" />
                            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Danh mục:</span>
                            <select
                                value={selectedCategoryId || 'all'}
                                onChange={(e) => onCategorySelect(e.target.value === 'all' ? null : e.target.value)}
                                className="bg-transparent border-none text-xs font-medium text-slate-700 dark:text-slate-300 focus:ring-0 cursor-pointer pr-4 appearance-none outline-none w-full"
                            >
                                <option value="all">Tất cả danh mục</option>
                                {categories.map((cat: any) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
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
