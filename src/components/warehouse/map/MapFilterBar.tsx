import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, Filter, HelpCircle, Tag, Package, Hash, MapPin, Layers, LayoutGrid, X, ClipboardList, Sparkles, CornerDownLeft, Bookmark, RotateCcw } from 'lucide-react'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { DateRangeFilter, DateFilterField } from '@/components/warehouse/DateRangeFilter'
import { SearchHelpModal } from '@/components/shared/SearchHelpModal'
import { SearchMode } from '@/app/(dashboard)/warehouses/map/_hooks/useMapFilters'
import { calculateSearchScore, matchSearch } from '@/lib/searchUtils'

import { DeepDateField } from '@/app/(dashboard)/warehouses/map/_hooks/useMapFilters'
import { Calendar, Building2, CheckCircle2, SlidersHorizontal, Check, ArrowRight } from 'lucide-react'

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
    onlyShowMarked?: boolean
    onToggleOnlyShowMarked?: () => void
    markedCount?: number
    // Deep Scan Props
    isDeepScanMode?: boolean
    onToggleDeepScanMode?: () => void
    deepScanTerm?: string
    onDeepScanTermChange?: (val: string) => void
    deepDateField?: DeepDateField
    onDeepDateFieldChange?: (val: DeepDateField) => void
    deepStartDate?: string
    onDeepStartDateChange?: (val: string) => void
    deepEndDate?: string
    onDeepEndDateChange?: (val: string) => void
    deepRegion?: string
    onDeepRegionChange?: (val: string) => void
    deepFactory?: string
    onDeepFactoryChange?: (val: string) => void
    deepGrade?: string
    onDeepGradeChange?: (val: string) => void
    deepVariety?: string
    onDeepVarietyChange?: (val: string) => void
    deepPackageSpec?: string
    onDeepPackageSpecChange?: (val: string) => void
    onResetDeepScan?: () => void
    deepScanStats?: { totalPositions: number; matchingBoxes: number }
    onBulkMarkFilteredPositions?: () => void
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
    products,
    onlyShowMarked,
    onToggleOnlyShowMarked,
    markedCount,
    // Deep scan
    isDeepScanMode = false,
    onToggleDeepScanMode,
    deepScanTerm = '',
    onDeepScanTermChange,
    deepDateField = 'packaging_date',
    onDeepDateFieldChange,
    deepStartDate = '',
    onDeepStartDateChange,
    deepEndDate = '',
    onDeepEndDateChange,
    deepRegion = 'all',
    onDeepRegionChange,
    deepFactory = 'all',
    onDeepFactoryChange,
    deepGrade = 'all',
    onDeepGradeChange,
    deepVariety = 'all',
    onDeepVarietyChange,
    deepPackageSpec = 'all',
    onDeepPackageSpecChange,
    onResetDeepScan,
    deepScanStats,
    onBulkMarkFilteredPositions
}: MapFilterBarProps) {
    // Local state for debounce
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm)
    const [isHelpOpen, setIsHelpOpen] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const searchContainerRef = useRef<HTMLDivElement>(null)

    const setDatePreset = (days: number | 'today' | 'this_month') => {
        const now = new Date()
        const endStr = now.toISOString().split('T')[0]
        let startStr = ''

        if (days === 'today') {
            startStr = endStr
        } else if (days === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
            startStr = firstDay.toISOString().split('T')[0]
        } else if (typeof days === 'number') {
            const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
            startStr = past.toISOString().split('T')[0]
        }

        if (onDeepStartDateChange) onDeepStartDateChange(startStr)
        if (onDeepEndDateChange) onDeepEndDateChange(endStr)
    }

    const clearDates = () => {
        if (onDeepStartDateChange) onDeepStartDateChange('')
        if (onDeepEndDateChange) onDeepEndDateChange('')
    }

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

    // Tính toán gợi ý thông minh từ danh sách sản phẩm theo từng chế độ tìm kiếm riêng biệt
    const suggestions = useMemo(() => {
        const term = localSearchTerm.trim()
        if (!term || !products || products.length === 0) return []

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

    // Manual trigger function
    const handleSearch = (termToSearch?: string) => {
        const target = termToSearch !== undefined ? termToSearch : localSearchTerm
        onSearchChange(target)
        if (onDeepScanTermChange) onDeepScanTermChange(target)
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

    const hasActiveFilters = Boolean(
        localSearchTerm ||
        (selectedCategoryId && selectedCategoryId !== 'all') ||
        startDate ||
        endDate ||
        onlyShowMarked ||
        hidePendingExport
    )

    const handleClearAllFilters = () => {
        setLocalSearchTerm('')
        onSearchChange('')
        if (onDeepScanTermChange) onDeepScanTermChange('')
        if (onCategorySelect) onCategorySelect(null)
        onStartDateChange('')
        onEndDateChange('')
        if (onlyShowMarked && onToggleOnlyShowMarked) onToggleOnlyShowMarked()
        if (hidePendingExport && onHidePendingExportChange) onHidePendingExportChange(false)
        setShowSuggestions(false)
    }

    // Nút gạt chuyển đổi chế độ Tìm kiếm cơ bản <-> Chuyên sâu
    const renderModeToggle = () => {
        if (!onToggleDeepScanMode) return null
        return (
            <button
                type="button"
                onClick={onToggleDeepScanMode}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap shadow-xs active:scale-95 shrink-0 cursor-pointer ${
                    isDeepScanMode
                        ? 'bg-purple-600 text-white border-purple-700 ring-2 ring-purple-300 dark:ring-purple-900 shadow-purple-500/20'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-purple-50/60 dark:hover:bg-purple-950/30 hover:border-purple-300 dark:hover:border-purple-800'
                }`}
                title={isDeepScanMode ? "Đang bật tìm kiếm chuyên sâu (Bấm để quay lại tìm kiếm cơ bản)" : "Chuyển sang chế độ tìm kiếm chuyên sâu (OCR, ngày đóng gói, vùng trồng, tem dập)"}
            >
                <Sparkles size={14} className={isDeepScanMode ? "text-amber-300 animate-pulse" : "text-purple-600 dark:text-purple-400"} />
                <span>Tìm chuyên sâu OCR</span>
                <div className={`w-7 h-4 rounded-full p-0.5 transition-colors flex items-center ${isDeepScanMode ? 'bg-purple-900/60 justify-end' : 'bg-slate-200 dark:bg-slate-700 justify-start'}`}>
                    <div className={`w-3 h-3 rounded-full shadow-xs transition-transform ${isDeepScanMode ? 'bg-white' : 'bg-white dark:bg-slate-400'}`} />
                </div>
            </button>
        )
    }

    return (
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border ${isDeepScanMode ? 'border-purple-200/90 dark:border-purple-900/60 shadow-purple-500/5' : 'border-slate-200/90 dark:border-slate-800/90'} p-3 shadow-xs space-y-2.5 transition-colors`}>
            {/* ========================================================================= */}
            {/* DÒNG 1: TÌM KIẾM CHÍNH & TIÊU ĐIỂM NHANH (GIỮ TRỌN TÍNH NĂNG Ở CẢ 2 CHẾ ĐỘ) */}
            {/* ========================================================================= */}
            <div className="flex items-center gap-2.5 w-full">
                {/* Search Bar Container */}
                <div 
                    ref={searchContainerRef}
                    className={`relative flex-1 min-w-0 flex items-center ${
                        isDeepScanMode 
                            ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200/90 dark:border-purple-800/80 focus-within:ring-purple-500/20 focus-within:border-purple-500' 
                            : 'bg-slate-50/90 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 focus-within:ring-emerald-500/20 focus-within:border-emerald-500'
                    } border rounded-xl focus-within:ring-2 focus-within:bg-white dark:focus-within:bg-slate-850 transition-all p-1`}
                >
                    <div className="flex items-center bg-white dark:bg-slate-700/60 border border-slate-200/60 dark:border-slate-600/50 rounded-lg px-2.5 py-1.5 shadow-2xs mr-1 shrink-0">
                        {searchMode === 'all' && <Layers size={14} className="text-slate-500 mr-1.5" />}
                        {searchMode === 'name' && <Package size={14} className="text-emerald-600 mr-1.5" />}
                        {searchMode === 'code' && <Hash size={14} className="text-purple-500 mr-1.5" />}
                        {searchMode === 'stamp' && <Sparkles size={14} className="text-purple-600 mr-1.5" />}
                        {searchMode === 'tag' && <Tag size={14} className="text-amber-500 mr-1.5" />}
                        {searchMode === 'position' && <MapPin size={14} className="text-emerald-600 mr-1.5" />}
                        {searchMode === 'category' && <LayoutGrid size={14} className="text-indigo-500 mr-1.5" />}
                        {searchMode === 'production' && <ClipboardList size={14} className="text-rose-500 mr-1.5" />}
                        
                        <select
                            value={searchMode}
                            onChange={(e) => onSearchModeChange(e.target.value as SearchMode)}
                            className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 cursor-pointer p-0 pr-4 appearance-none outline-none"
                        >
                            <option value="all">Tổng hợp</option>
                            <option value="name">Theo Tên</option>
                            <option value="code">Theo Mã</option>
                            <option value="stamp">Mã tem / Dãy số</option>
                            <option value="tag">Mã phụ</option>
                            <option value="position">Vị trí</option>
                            <option value="category">Danh mục</option>
                            <option value="production">Lệnh sản xuất</option>
                        </select>
                    </div>

                    <div className="relative flex-1 flex items-center min-w-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 shrink-0" size={15} />
                        <input
                            type="text"
                            placeholder={
                                searchMode === 'name' ? "Nhập tên sản phẩm (dona A, ri6...) hoặc tên gõ tắt..." :
                                searchMode === 'code' ? "Nhập mã Lot, SKU..." :
                                searchMode === 'stamp' ? "Nhập mã thùng STAMP-..., dãy số gốc Dòng 1 / Dòng 2, mã lô..." :
                                searchMode === 'tag' ? "Nhập mã phụ (tag)..." :
                                searchMode === 'position' ? "Nhập mã vị trí (A01...)..." :
                                searchMode === 'category' ? "Nhập tên danh mục..." :
                                searchMode === 'production' ? "Nhập mã LSX hoặc mã lot sản xuất..." :
                                isDeepScanMode 
                                    ? "Tìm kiếm kết hợp (dona A, mã tem, vị trí...) + bộ lọc bên dưới..." 
                                    : "Tìm kiếm nhanh (hỗ trợ tên gõ tắt, SKU, vị trí, tem dập)..."
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
                            className="w-full pl-8 pr-24 py-1.5 bg-transparent border-none outline-none font-medium text-xs lg:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                        />
                        <div className="absolute right-1 flex items-center gap-1">
                            {localSearchTerm && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLocalSearchTerm('')
                                        onSearchChange('')
                                        if (onDeepScanTermChange) onDeepScanTermChange('')
                                        setShowSuggestions(false)
                                    }}
                                    className="text-slate-400 hover:text-red-500 transition-colors rounded-full p-1 cursor-pointer"
                                    title="Xóa tìm kiếm"
                                >
                                    <X size={14} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsHelpOpen(true)}
                                className={`text-slate-400 ${isDeepScanMode ? 'hover:text-purple-600' : 'hover:text-emerald-600'} transition-colors rounded-full p-1 cursor-pointer`}
                                title="Hướng dẫn tìm kiếm"
                            >
                                <HelpCircle size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSearch()}
                                className={`${isDeepScanMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-xs active:scale-95 flex items-center gap-1 cursor-pointer shrink-0`}
                            >
                                <Search size={13} />
                                <span>Tìm</span>
                            </button>
                        </div>
                    </div>

                    {/* Autocomplete Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                <span className={`flex items-center gap-1 ${isDeepScanMode ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    <Sparkles size={12} />
                                    {searchMode === 'code' ? 'Gợi ý mã sản phẩm' : searchMode === 'name' ? 'Gợi ý tên sản phẩm' : searchMode === 'stamp' ? 'Gợi ý mã tem' : 'Gợi ý tìm kiếm'} ({suggestions.length})
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
                                                    ? (isDeepScanMode ? 'bg-purple-50/80 dark:bg-purple-950/40 text-purple-900 dark:text-purple-100' : 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100')
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

                                            <CornerDownLeft size={13} className={`shrink-0 transition-opacity ${isHighlighted ? (isDeepScanMode ? 'opacity-100 text-purple-600' : 'opacity-100 text-emerald-600') : 'opacity-0'}`} />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Mobile Filter Toggle */}
                <div className="lg:hidden flex items-center gap-1.5 shrink-0">
                    {renderModeToggle()}
                    <button
                        className={`p-2 rounded-xl shadow-xs border cursor-pointer ${
                            isDeepScanMode 
                                ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' 
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        }`}
                        onClick={toggleMobileFilters}
                    >
                        <Filter size={18} />
                    </button>
                </div>

                {/* Dòng 1 Actions (Desktop): Nút Gạt Chuyên Sâu, Vị trí đánh dấu & Ẩn chờ xuất */}
                <div className="hidden lg:flex items-center gap-2 shrink-0">
                    {/* Nút gạt chuyển chế độ */}
                    {renderModeToggle()}

                    {onToggleOnlyShowMarked && (
                        <button
                            type="button"
                            onClick={onToggleOnlyShowMarked}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap shadow-xs active:scale-95 shrink-0 cursor-pointer ${
                                onlyShowMarked
                                    ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300 dark:ring-amber-700 shadow-amber-500/20'
                                    : (markedCount && markedCount > 0)
                                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                            }`}
                            title={onlyShowMarked ? "Đang lọc: chỉ hiện vị trí đánh dấu (Bấm để hiện tất cả)" : "Lọc hiển thị các vị trí được đánh dấu"}
                        >
                            <Bookmark
                                size={14}
                                className={onlyShowMarked ? "fill-white text-white" : (markedCount && markedCount > 0 ? "fill-amber-500 text-amber-600" : "text-slate-400")}
                            />
                            <span>Vị trí đánh dấu</span>
                            {markedCount !== undefined && markedCount > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                                    onlyShowMarked 
                                        ? 'bg-white text-amber-700' 
                                        : 'bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200'
                                }`}>
                                    {markedCount}
                                </span>
                            )}
                        </button>
                    )}

                    {onHidePendingExportChange && (
                        <button
                            type="button"
                            onClick={() => onHidePendingExportChange(!hidePendingExport)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap shadow-xs active:scale-95 shrink-0 cursor-pointer ${
                                hidePendingExport 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-400 ring-2 ring-indigo-200/50' 
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/80'
                            }`}
                            title="Ẩn các vị trí đang có lệnh xuất kho chờ xử lý"
                        >
                            <ClipboardList size={14} className={hidePendingExport ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"} />
                            <span>Ẩn chờ xuất</span>
                        </button>
                    )}
                </div>
            </div>

            {/* DÒNG TIẾP THEO: TÙY THEO CHẾ ĐỘ */}
            {isDeepScanMode ? (
                /* ========================================================================= */
                /* GIAO DIỆN TÌM KIẾM CHUYÊN SÂU: DÒNG 2 & DÒNG 3                            */
                /* ========================================================================= */
                <div className="space-y-2.5 animate-in fade-in duration-200">
                    {/* Dòng 2: Bảng Điều Khiển Lọc Thông Tin Quét Chuyên Sâu */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-xl p-3 border border-purple-100 dark:border-purple-950/60 flex flex-col gap-2.5">
                        {/* Hàng 2A: Khoảng ngày & Mốc ngày */}
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1 shrink-0">
                                <Calendar size={13} />
                                Mốc ngày:
                            </span>
                            <select
                                value={deepDateField}
                                onChange={(e) => onDeepDateFieldChange && onDeepDateFieldChange(e.target.value as any)}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer outline-none shadow-2xs"
                            >
                                <option value="packaging_date">📦 Ngày đóng gói (DD/MM)</option>
                                <option value="peeling_date">🔪 Ngày sản xuất (bóc múi)</option>
                                <option value="raw_material_date">🚛 Ngày nhập nguyên liệu</option>
                                <option value="inbound_date">📥 Ngày nhập kho lạnh</option>
                            </select>

                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-2xs">
                                <input
                                    type="date"
                                    value={deepStartDate}
                                    onChange={(e) => onDeepStartDateChange && onDeepStartDateChange(e.target.value)}
                                    className="bg-transparent text-xs font-semibold outline-none cursor-pointer text-slate-700 dark:text-slate-200"
                                />
                                <span className="text-slate-400 font-bold">→</span>
                                <input
                                    type="date"
                                    value={deepEndDate}
                                    onChange={(e) => onDeepEndDateChange && onDeepEndDateChange(e.target.value)}
                                    className="bg-transparent text-xs font-semibold outline-none cursor-pointer text-slate-700 dark:text-slate-200"
                                />
                            </div>

                            {/* Phím tắt ngày nhanh */}
                            <div className="flex items-center gap-1 flex-wrap">
                                <button type="button" onClick={() => setDatePreset('today')} className="px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium hover:bg-purple-50 text-slate-600 dark:text-slate-300 shadow-2xs cursor-pointer">Hôm nay</button>
                                <button type="button" onClick={() => setDatePreset(3)} className="px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium hover:bg-purple-50 text-slate-600 dark:text-slate-300 shadow-2xs cursor-pointer">3 ngày</button>
                                <button type="button" onClick={() => setDatePreset(7)} className="px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium hover:bg-purple-50 text-slate-600 dark:text-slate-300 shadow-2xs cursor-pointer">7 ngày</button>
                                <button type="button" onClick={() => setDatePreset('this_month')} className="px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium hover:bg-purple-50 text-slate-600 dark:text-slate-300 shadow-2xs cursor-pointer">Tháng này</button>
                                {(deepStartDate || deepEndDate) && (
                                    <button type="button" onClick={clearDates} className="px-2 py-1 rounded-md bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 text-[11px] font-bold hover:bg-red-100 cursor-pointer">Xóa ngày</button>
                                )}
                            </div>
                        </div>

                        {/* Hàng 2B: Thuộc tính con dấu & xuất xứ */}
                        <div className="flex items-center gap-2 flex-wrap text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                            {/* Vùng trồng / Tỉnh */}
                            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-2xs">
                                <span className="text-[11px] text-slate-400 font-medium">Vùng:</span>
                                <select
                                    value={deepRegion}
                                    onChange={(e) => onDeepRegionChange && onDeepRegionChange(e.target.value)}
                                    className="bg-transparent font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                                >
                                    <option value="all">Tất cả vùng trồng</option>
                                    <option value="66">Đắk Lắk (Mã 66)</option>
                                    <option value="71">Bến Tre (Mã 71)</option>
                                    <option value="09">Tỉnh mã 09 (Mã 09)</option>
                                    <option value="67">Đắk Nông (Mã 67)</option>
                                    <option value="68">Lâm Đồng (Mã 68)</option>
                                    <option value="64">Gia Lai (Mã 64)</option>
                                    <option value="63">Tiền Giang (Mã 63)</option>
                                </select>
                            </div>

                            {/* Nhà máy */}
                            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-2xs">
                                <span className="text-[11px] text-slate-400 font-medium">Nhà máy:</span>
                                <select
                                    value={deepFactory}
                                    onChange={(e) => onDeepFactoryChange && onDeepFactoryChange(e.target.value)}
                                    className="bg-transparent font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                                >
                                    <option value="all">Tất cả nhà máy</option>
                                    <option value="1">Nhà máy 1 (Bến Tre)</option>
                                    <option value="2">Nhà máy 2 (Đắk Lắk)</option>
                                    <option value="3">Cơ sở 3 (Phước An)</option>
                                </select>
                            </div>

                            {/* Phẩm cấp */}
                            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-2xs">
                                <span className="text-[11px] text-slate-400 font-medium">Hạng:</span>
                                <select
                                    value={deepGrade}
                                    onChange={(e) => onDeepGradeChange && onDeepGradeChange(e.target.value)}
                                    className="bg-transparent font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                                >
                                    <option value="all">Tất cả phẩm cấp</option>
                                    <option value="VIP">Loại VIP</option>
                                    <option value="Loại A">Loại A</option>
                                    <option value="Loại B">Loại B</option>
                                    <option value="Loại C">Loại C</option>
                                </select>
                            </div>

                            {/* Giống */}
                            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-2xs">
                                <span className="text-[11px] text-slate-400 font-medium">Giống:</span>
                                <select
                                    value={deepVariety}
                                    onChange={(e) => onDeepVarietyChange && onDeepVarietyChange(e.target.value)}
                                    className="bg-transparent font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                                >
                                    <option value="all">Tất cả giống</option>
                                    <option value="Monthong">Monthong (Dona)</option>
                                    <option value="Ri-6">Ri-6</option>
                                    <option value="Musang">Musang King</option>
                                    <option value="Black Thorn">Black Thorn</option>
                                </select>
                            </div>

                            {/* Quy cách */}
                            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-2xs">
                                <span className="text-[11px] text-slate-400 font-medium">Quy cách:</span>
                                <select
                                    value={deepPackageSpec}
                                    onChange={(e) => onDeepPackageSpecChange && onDeepPackageSpecChange(e.target.value)}
                                    className="bg-transparent font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                                >
                                    <option value="all">Tất cả quy cách</option>
                                    <option value="1 Túi">1 Túi / thùng</option>
                                    <option value="2 Túi">2 Túi / thùng</option>
                                    <option value="4 Túi">4 Túi / thùng</option>
                                    <option value="8 Túi">8 Túi / thùng</option>
                                </select>
                            </div>

                            {/* Nút đặt lại bộ lọc chuyên sâu */}
                            {onResetDeepScan && (
                                <button
                                    type="button"
                                    onClick={onResetDeepScan}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 text-xs font-bold hover:bg-red-100 cursor-pointer ml-auto shadow-2xs active:scale-95 transition-all"
                                    title="Đặt lại tất cả điều kiện tìm kiếm chuyên sâu"
                                >
                                    <RotateCcw size={12} />
                                    <span>Đặt lại</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Dòng 3: Thanh kết quả tìm kiếm chuyên sâu & Nút Đánh dấu hàng loạt */}
                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-purple-100 dark:border-purple-950/40 flex-wrap">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 text-xs font-bold shadow-2xs">
                                <Sparkles size={13} className="text-purple-600 dark:text-purple-400" />
                                <span>Tìm thấy: <strong className="text-purple-950 dark:text-purple-100">{deepScanStats?.totalPositions || 0}</strong> vị trí</span>
                                {deepScanStats?.matchingBoxes !== undefined && (
                                    <span className="text-purple-600 dark:text-purple-400 font-semibold">({deepScanStats.matchingBoxes} thùng)</span>
                                )}
                            </span>
                        </div>

                        {onBulkMarkFilteredPositions && (deepScanStats?.totalPositions || 0) > 0 && (
                            <button
                                type="button"
                                onClick={onBulkMarkFilteredPositions}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                                title="Đánh dấu tất cả vị trí này vào danh sách kiểm kê hoặc lập lệnh xuất kho"
                            >
                                <Bookmark size={13} className="fill-white" />
                                <span>Đánh dấu tất cả {deepScanStats?.totalPositions} vị trí này</span>
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                /* Dòng 2 (Desktop): Chi tiết Danh mục, Khoảng ngày & Đặt lại bộ lọc */
                <div className="hidden lg:flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 shrink-0">
                                <Filter size={12} />
                                <span>Bộ lọc:</span>
                            </div>

                            {categories && categories.length > 0 && onCategorySelect && (
                                <div className="flex items-center gap-1.5 bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 py-1.5 shrink-0 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                                    <LayoutGrid size={13} className="text-indigo-500 shrink-0" />
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">Danh mục:</span>
                                    <select
                                        value={selectedCategoryId || 'all'}
                                        onChange={(e) => onCategorySelect(e.target.value === 'all' ? null : e.target.value)}
                                        className="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 focus:ring-0 cursor-pointer pr-4 appearance-none outline-none max-w-[200px] truncate"
                                    >
                                        <option value="all">Tất cả danh mục</option>
                                        {categories.map((cat: any) => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <DateRangeFilter
                                dateFilterField={dateFilterField}
                                onDateFieldChange={onDateFieldChange}
                                startDate={startDate}
                                onStartDateChange={onStartDateChange}
                                endDate={endDate}
                                onEndDateChange={onEndDateChange}
                                className="shadow-2xs"
                            />
                        </div>

                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleClearAllFilters}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors shrink-0 shadow-2xs cursor-pointer active:scale-95"
                                title="Xóa tất cả các bộ lọc đang áp dụng"
                            >
                                <RotateCcw size={12} />
                                <span>Đặt lại bộ lọc</span>
                            </button>
                        )}
                    </div>
            )}

            {/* Mobile Expanded Filters */}
            {showMobileFilters && (
                <div className="lg:hidden flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2">
                    {onToggleOnlyShowMarked && (
                        <button
                            type="button"
                            onClick={onToggleOnlyShowMarked}
                            className={`flex items-center justify-center gap-2 px-3 py-2 w-full rounded-xl border text-xs font-bold transition-all shadow-xs active:scale-95 ${
                                onlyShowMarked
                                    ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300 dark:ring-amber-700'
                                    : (markedCount && markedCount > 0)
                                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                        >
                            <Bookmark
                                size={14}
                                className={onlyShowMarked ? "fill-white text-white" : (markedCount && markedCount > 0 ? "fill-amber-500 text-amber-600" : "text-slate-400")}
                            />
                            <span>Vị trí đánh dấu kiểm tra</span>
                            {markedCount !== undefined && markedCount > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    onlyShowMarked 
                                        ? 'bg-white text-amber-700' 
                                        : 'bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200'
                                }`}>
                                    {markedCount}
                                </span>
                            )}
                        </button>
                    )}

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
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={handleClearAllFilters}
                            className="flex items-center justify-center gap-2 px-3 py-2 w-full rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 text-red-600 dark:text-red-400 text-xs font-bold transition-colors cursor-pointer"
                        >
                            <RotateCcw size={14} />
                            <span>Đặt lại tất cả bộ lọc</span>
                        </button>
                    )}
                </div>
            )}

            {/* Dòng 3: Cascading Zone Filter */}
            <div className={`pt-2 border-t border-slate-100 dark:border-slate-800/80 ${showMobileFilters ? 'block' : 'hidden lg:block'}`}>
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

            <SearchHelpModal isOpen={isHelpOpen} onOpenChange={setIsHelpOpen} />
        </div>
    )
}
