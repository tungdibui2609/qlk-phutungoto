'use client'

import { Map, Printer, Settings } from 'lucide-react'
import Protected from '@/components/auth/Protected'

interface MapHeaderProps {
    totalPositions: number
    totalZones: number
    systemType: string | null
    selectedZoneId: string | null
    searchTerm: string
    isDesignMode: boolean
    setIsDesignMode: (val: boolean) => void
    isMobile: boolean
}

export function MapHeader({
    totalPositions,
    totalZones,
    systemType,
    selectedZoneId,
    searchTerm,
    isDesignMode,
    setIsDesignMode,
    isMobile
}: MapHeaderProps) {
    const handlePrint = () => {
        const params = new URLSearchParams()
        if (systemType) params.set('systemType', systemType)
        if (selectedZoneId) params.set('zoneId', selectedZoneId)
        if (searchTerm) params.set('search', searchTerm)
        window.open(`/print/warehouse-map?${params.toString()}`, '_blank')
    }

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Map className="text-blue-600" size={isMobile ? 24 : 28} />
                    Sơ đồ Kho
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-xs sm:text-sm">
                    {totalPositions} vị trí | {totalZones} zone
                </p>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                {/* Print Button */}
                <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm text-sm"
                >
                    <Printer size={18} />
                    <span className="whitespace-nowrap">In Sơ Đồ</span>
                </button>

                <Protected permission="warehousemap.manage">
                    <button
                        onClick={() => setIsDesignMode(!isDesignMode)}
                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm ${isDesignMode
                            ? 'bg-blue-500 text-white'
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
