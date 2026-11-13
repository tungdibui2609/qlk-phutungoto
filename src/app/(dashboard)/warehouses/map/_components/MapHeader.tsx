'use client'

import { Map, Printer, Settings, Hash, Clock, Layers } from 'lucide-react'
import Protected from '@/components/auth/Protected'

interface MapHeaderProps {
    totalPositions: number
    totalZones: number
    officialPositionsCount?: number
    hallPositionsCount?: number
    systemType: string | null
    selectedZoneId: string | null
    selectedCategoryId?: string | null
    searchTerm: string
    isDesignMode: boolean
    setIsDesignMode: (val: boolean) => void
    isMobile: boolean
    displayInternalCode: boolean
    setDisplayInternalCode: (val: boolean) => void
    onOpenHistory: () => void
    onOpenProposals?: () => void
    pendingProposalCount?: number
}

export function MapHeader({
    totalPositions,
    totalZones,
    officialPositionsCount,
    hallPositionsCount,
    systemType,
    selectedZoneId,
    selectedCategoryId,
    searchTerm,
    isDesignMode,
    setIsDesignMode,
    isMobile,
    displayInternalCode,
    setDisplayInternalCode,
    onOpenHistory,
    onOpenProposals,
    pendingProposalCount
}: MapHeaderProps) {
    const handlePrint = () => {
        const params = new URLSearchParams()
        if (systemType) params.set('systemType', systemType)
        if (selectedZoneId) params.set('zoneId', selectedZoneId)
        if (selectedCategoryId) params.set('categoryId', selectedCategoryId)
        if (searchTerm) params.set('search', searchTerm)
        if (displayInternalCode) params.set('internalCode', 'true')
        window.open(`/print/warehouse-map?${params.toString()}`, '_blank')
    }

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Map className="text-emerald-600" size={isMobile ? 24 : 28} />
                    Sơ đồ Kho
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-xs sm:text-sm flex flex-wrap items-center gap-x-2">
                    <span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{totalPositions}</span> vị trí
                        {hallPositionsCount != null && hallPositionsCount > 0 && (
                            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                (Lô kệ: <span className="font-medium text-emerald-600 dark:text-emerald-400">{officialPositionsCount}</span> • Sảnh: <span className="font-medium text-amber-600 dark:text-amber-400">{hallPositionsCount}</span>)
                            </span>
                        )}
                    </span>
                    <span>|</span>
                    <span>{totalZones} zone</span>
                </p>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                {onOpenProposals && (
                    <button
                        onClick={onOpenProposals}
                        className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 hover:border-amber-500/60 text-amber-700 dark:text-amber-300 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-sm text-sm"
                        title="Xem các phiếu đề xuất điều chỉnh vị trí kho từ App"
                    >
                        <Layers size={18} className="text-amber-500" />
                        <span className="whitespace-nowrap">Đề xuất điều chỉnh</span>
                        {pendingProposalCount != null && pendingProposalCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white animate-pulse">
                                {pendingProposalCount}
                            </span>
                        )}
                    </button>
                )}

                <button
                    onClick={onOpenHistory}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm text-sm"
                    title="Xem lịch sử sơ đồ kho"
                >
                    <Clock size={18} />
                    <span className="whitespace-nowrap">Lịch sử</span>
                </button>

                <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm text-sm"
                >
                    <Printer size={18} />
                    <span className="whitespace-nowrap">In Sơ Đồ</span>
                </button>

                <button
                    onClick={() => setDisplayInternalCode(!displayInternalCode)}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm text-sm ${displayInternalCode
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    title="Hiển thị mã sản phẩm nội bộ"
                >
                    <Hash size={18} />
                    <span className="whitespace-nowrap">Mã Nội Bộ</span>
                </button>

                <Protected permission="warehousemap.manage">
                    <button
                        onClick={() => setIsDesignMode(!isDesignMode)}
                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm ${isDesignMode
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                    >
                        <Settings size={18} />
                        <span className="whitespace-nowrap">{isDesignMode ? 'Thoát' : 'Thiết kế'}</span>
                    </button>
                </Protected>
            </div>
        </div>
    )
}
