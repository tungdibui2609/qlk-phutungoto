'use client'

import { ChevronsUp, ChevronsDown } from 'lucide-react'

interface ZoneCollapseControlsProps {
    onExpandAll: () => void
    onCollapseAll: () => void
}

export function ZoneCollapseControls({ onExpandAll, onCollapseAll }: ZoneCollapseControlsProps) {
    return (
        <div className="flex items-center gap-2">
            <button
                onClick={onCollapseAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
                <ChevronsUp size={16} className="text-gray-500" />
                <span className="hidden sm:inline">Thu gọn tất cả</span>
                <span className="sm:hidden">Thu gọn</span>
            </button>
            <button
                onClick={onExpandAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
                <ChevronsDown size={16} className="text-gray-500" />
                <span className="hidden sm:inline">Mở tất cả</span>
                <span className="sm:hidden">Mở rộng</span>
            </button>
        </div>
    )
}
