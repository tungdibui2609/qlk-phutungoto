import { Search, Filter, Warehouse, HelpCircle, Tag, Package, Hash, MapPin, Layers, LayoutGrid, ClipboardList, X, Sparkles, CornerDownLeft } from 'lucide-react'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { DateRangeFilter, DateFilterField } from '@/components/warehouse/DateRangeFilter'
import { SearchHelpModal } from '@/components/shared/SearchHelpModal'
import { useState, useEffect, useRef, useMemo } from 'react'
import { SearchMode } from '@/app/(dashboard)/warehouses/map/_hooks/useMapFilters'
import { calculateSearchScore, matchSearch } from '@/lib/searchUtils'

interface LotFilterProps {
    searchTerm: string
    onSearchChange: (value: string) => void
    searchMode: SearchMode
    onSearchModeChange: (mode: SearchMode) => void
    positionFilter: 'all' | 'assigned' | 'unassigned'
    onPositionFilterChange: (value: 'all' | 'assigned' | 'unassigned') => void
    lockFilter: 'all' | 'unlocked' | 'locked'
    onLockFilterChange: (value: 'all' | 'unlocked' | 'locked') => void
    sttFilter: 'all' | 'has_stt' | 'no_stt'
    onSttFilterChange: (value: 'all' | 'has_stt' | 'no_stt') => void
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
    products?: any[]
}

export function LotFilter({
    searchTerm,
    onSearchChange,
    searchMode,
    onSearchModeChange,
    positionFilter,
    onPositionFilterChange,
    lockFilter,
    onLockFilterChange,
    sttFilter,
    onSttFilterChange,
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
    products
}: LotFilterProps) {
    // Local state for search to avoid immediate filtering (Manual trigger like Map)
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm)
    const [isHelpOpen, setIsHelpOpen] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const searchContainerRef = useRef<HTMLDivElement>(null)

    // Sync local state when parent state changes (e.g. clear filter from elsewhere)
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

    // Gợi ý thông minh phù hợp với từng chế độ tìm kiếm riêng biệt
    const suggestions = useMemo(() => {
        const term = localSearchTerm.trim()
        if (!term || !products || products.length === 0) return []

        // Chỉ hiển thị gợi ý cho các chế độ liên quan đến Tên, Mã, hoặc Tổng hợp
        // Các chế độ khác (Vị trí, Mã phụ, Danh mục, LSX, STT, Số thùng) để người dùng tự nhập chuẩn xác
        if (searchMode !== 'all' && searchMode !== 'name' && searchMode !== 'code') {
            return []
        }

        const list: Array<{
            product: any
            score: number
            fillValue: string
            displayTitle: string
            displaySubtitle?: string
            badgeType?: 'alias' | 'sku' | 'internal_code'
            badgeText?: string
        }> = []

        if (searchMode === 'code') {
            // Chế độ "Theo Mã": CHỈ gợi ý Mã SKU hoặc Mã nội bộ, khi chọn sẽ điền MÃ (không điền tên)
            for (const p of products) {
                const skuMatch = p.sku && matchSearch(p.sku, term)
                const codeMatch = p.internal_code && matchSearch(p.internal_code, term)

                if (skuMatch || codeMatch) {
                    let fillValue = ''
                    let badgeType: 'sku' | 'internal_code' = 'sku'
                    let badgeText = ''

                    if (codeMatch && (!skuMatch || matchSearch(p.internal_code, term))) {
                        fillValue = p.internal_code
                        badgeType = 'internal_code'
                        badgeText = `Mã NB`
                    } else if (skuMatch) {
                        fillValue = p.sku
                        badgeType = 'sku'
                        badgeText = `SKU`
                    }

                    let score = 1000
                    if (p.sku && p.sku.toLowerCase() === term.toLowerCase()) score += 2000
                    if (p.internal_code && p.internal_code.toLowerCase() === term.toLowerCase()) score += 2000

                    list.push({
                        product: p,
                        score,
                        fillValue,
                        displayTitle: fillValue,
                        displaySubtitle: p.name,
                        badgeType,
                        badgeText
                    })
                }
            }
        } else if (searchMode === 'name') {
            // Chế độ "Theo Tên": Chỉ gợi ý Tên sản phẩm, Tên nội bộ hoặc Tên gõ tắt (aliases)
            for (const p of products) {
                const nameObj = {
                    name: p.name,
                    internal_name: p.internal_name,
                    aliases: p.aliases
                }
                const score = calculateSearchScore(nameObj, term)

                if (score > 0) {
                    let badgeText: string | undefined
                    if (p.aliases) {
                        const aliasItems = p.aliases.split(',').map((a: string) => a.trim()).filter(Boolean)
                        const found = aliasItems.find((a: string) => matchSearch(a, term))
                        if (found) badgeText = `⚡ ${found}`
                    }

                    list.push({
                        product: p,
                        score,
                        fillValue: p.name,
                        displayTitle: p.name,
                        displaySubtitle: p.sku ? `SKU: ${p.sku}${p.internal_code ? ` | NB: ${p.internal_code}` : ''}` : undefined,
                        badgeType: badgeText ? 'alias' : undefined,
                        badgeText
                    })
                }
            }
        } else if (searchMode === 'all') {
            // Chế độ "Tổng hợp": Cho phép cả Tên, Tên gõ tắt, SKU, Mã nội bộ
            for (const p of products) {
                const score = calculateSearchScore(p, term)

                if (score > 0) {
                    let badgeText: string | undefined
                    let badgeType: 'alias' | 'sku' | 'internal_code' | undefined
                    let fillValue = p.name

                    if (p.aliases) {
                        const aliasItems = p.aliases.split(',').map((a: string) => a.trim()).filter(Boolean)
                        const found = aliasItems.find((a: string) => matchSearch(a, term))
                        if (found) {
                            badgeType = 'alias'
                            badgeText = `⚡ ${found}`
                            fillValue = p.name
                        }
                    }

                    if (!badgeType) {
                        if (p.internal_code && matchSearch(p.internal_code, term)) {
                            badgeType = 'internal_code'
                            badgeText = `NB: ${p.internal_code}`
                            fillValue = p.internal_code
                        } else if (p.sku && matchSearch(p.sku, term)) {
                            badgeType = 'sku'
                            badgeText = `SKU: ${p.sku}`
                            fillValue = p.sku
                        }
                    }

                    list.push({
                        product: p,
                        score,
                        fillValue,
                        displayTitle: p.name,
                        displaySubtitle: p.sku ? `SKU: ${p.sku}${p.internal_code ? ` | NB: ${p.internal_code}` : ''}` : undefined,
                        badgeType,
                        badgeText
                    })
                }
            }
        }

        return list
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
    }, [localSearchTerm, products, searchMode])

    const handleSearch = (termToSearch?: string) => {
        const target = termToSearch !== undefined ? termToSearch : localSearchTerm
        onSearchChange(target)
        setShowSuggestions(false)
    }

    const handleSelectSuggestion = (item: typeof suggestions[0]) => {
        const targetValue = item.fillValue
        setLocalSearchTerm(targetValue)
        handleSearch(targetValue)
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
            {/* Row 1: Search, Status & Date Filters (Consolidated for space) */}
            <div className="flex flex-wrap items-center gap-2 w-full">
                {/* Search - Flexible & Primary */}
                <div 
                    ref={searchContainerRef}
                    className="relative flex-[3.5] min-w-[280px] flex items-center bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all"
                >
                    <div className="flex items-center border-r border-slate-200 dark:border-slate-700 px-2 lg:px-3">
                        {searchMode === 'all' && <Layers size={14} className="text-slate-400 mr-1.5" />}
                        {searchMode === 'name' && <Package size={14} className="text-emerald-600 mr-1.5" />}
                        {searchMode === 'code' && <Hash size={14} className="text-purple-500 mr-1.5" />}
                        {searchMode === 'tag' && <Tag size={14} className="text-amber-500 mr-1.5" />}
                        {searchMode === 'position' && <MapPin size={14} className="text-emerald-600 mr-1.5" />}
                        {searchMode === 'category' && <LayoutGrid size={14} className="text-indigo-500 mr-1.5" />}
                        {searchMode === 'production' && <ClipboardList size={14} className="text-rose-500 mr-1.5" />}
                        {searchMode === 'stt' && <Hash size={14} className="text-emerald-600 mr-1.5" />}
                        {searchMode === 'box_count' && <Layers size={14} className="text-teal-500 mr-1.5" />}
                        
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
                            <option value="stt">Số thứ tự (STT)</option>
                            <option value="box_count">Số lượng thùng</option>
                        </select>
                    </div>

                    <div className="relative flex-1 flex items-center">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder={
                                searchMode === 'name' ? "Tên sản phẩm hoặc tên gõ tắt..." :
                                searchMode === 'code' ? "Mã Lot, SKU..." :
                                searchMode === 'tag' ? "Mã phụ (tag)..." :
                                searchMode === 'position' ? "Mã vị trí..." :
                                searchMode === 'category' ? "Tên danh mục..." :
                                searchMode === 'production' ? "Mã LSX hoặc mã lot sản xuất..." :
                                searchMode === 'stt' ? "Số thứ tự pallet (STT)..." :
                                searchMode === 'box_count' ? "Số lượng thùng (ví dụ: 12)..." :
                                "Tìm kiếm nhanh (hỗ trợ tên gõ tắt, SKU)..."
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
                                    {searchMode === 'code' ? 'Gợi ý mã sản phẩm' : searchMode === 'name' ? 'Gợi ý tên sản phẩm' : 'Gợi ý tìm kiếm'} ({suggestions.length})
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
                                                        {item.displayTitle}
                                                    </span>
                                                    {item.badgeText ? (
                                                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wide shrink-0 ${
                                                            item.badgeType === 'alias' 
                                                                ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                                                                : 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                                                        }`}>
                                                            {item.badgeText}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {item.displaySubtitle && (
                                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                        <span>{item.displaySubtitle}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <CornerDownLeft size={13} className={`shrink-0 transition-opacity ${isHighlighted ? 'opacity-100 text-emerald-600' : 'opacity-0'}`} />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    <SearchHelpModal isOpen={isHelpOpen} onOpenChange={setIsHelpOpen} />
                </div>

                {/* Date Filter */}
                <div className={`${showMobileFilters ? 'flex' : 'hidden lg:flex'} items-center shrink-0 min-w-[280px]`}>
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

                {/* Mobile Filter Toggle */}
                <button
                    className="lg:hidden ml-auto p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm"
                    onClick={toggleMobileFilters}
                >
                    <Filter size={18} />
                </button>
            </div>

            {/* Row 2: Advanced Position Filter (From Map) - Always full width but compact */}
            {/* Cascading Zone Filter */}
            <div className="space-y-1.5 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Khu vực / Dãy hàng</span>
                        </div>

                        {/* Quick filter pills right next to Khu vực / Dãy hàng */}
                        <div className={`${showMobileFilters ? 'flex' : 'hidden sm:flex'} flex-wrap items-center gap-2`}>
                            {/* Position Assignment Status */}
                            <div className="flex items-center gap-1.5 bg-emerald-50/50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800/50 min-w-[115px]">
                                <Warehouse size={12} className="text-emerald-600 shrink-0" />
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

                            {/* Lock Status Filter */}
                            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 min-w-[105px]">
                                <Filter size={12} className="text-slate-500 shrink-0" />
                                <select
                                    value={lockFilter}
                                    onChange={(e) => onLockFilterChange(e.target.value as any)}
                                    className="bg-transparent border-none text-[11px] font-bold text-slate-700 dark:text-slate-200 focus:ring-0 cursor-pointer p-0 appearance-none pr-3 w-full"
                                >
                                    <option value="all">Khóa: Tất cả</option>
                                    <option value="unlocked">Chưa khóa</option>
                                    <option value="locked">Đã khóa</option>
                                </select>
                            </div>

                            {/* STT Status Filter */}
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border min-w-[110px] transition-colors ${
                                sttFilter !== 'all'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            }`}>
                                <Hash size={12} className={sttFilter !== 'all' ? 'text-emerald-600' : 'text-slate-500'} />
                                <select
                                    value={sttFilter}
                                    onChange={(e) => onSttFilterChange(e.target.value as any)}
                                    className="bg-transparent border-none text-[11px] font-bold focus:ring-0 cursor-pointer p-0 appearance-none pr-3 w-full text-inherit"
                                >
                                    <option value="all">STT: Tất cả</option>
                                    <option value="has_stt">Đã có STT</option>
                                    <option value="no_stt">Chưa có STT</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <HorizontalZoneFilter
                    selectedZoneId={selectedZoneId}
                    onZoneSelect={onZoneSelect}
                    showSearch={false}
                    compact={true}
                    variant="subtle"
                    grouped={true}
                    zones={zones}
                />
            </div>
        </div>
    )
}
