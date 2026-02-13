'use client'
import { Database } from '@/lib/database.types'
import { Package, MapPin } from 'lucide-react'

type Position = Database['public']['Tables']['positions']['Row']

interface WarehouseGridProps {
    positions: Position[]
    columns: number
    onPositionClick?: (position: Position) => void
    selectedPositionId?: string | null
    occupiedPositionIds?: Set<string>
}

export default function WarehouseGrid({
    positions,
    columns,
    onPositionClick,
    selectedPositionId,
    occupiedPositionIds = new Set()
}: WarehouseGridProps) {
    if (positions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <MapPin size={48} className="mb-4" />
                <p className="text-sm">Không có ô nào để hiển thị</p>
            </div>
        )
    }

    return (
        <div
            className="grid gap-2 p-4"
            style={{
                gridTemplateColumns: `repeat(${columns}, minmax(auto, 1fr))`
            }}
        >
            {positions.map(pos => {
                const isOccupied = occupiedPositionIds.has(pos.id)
                const isSelected = selectedPositionId === pos.id

                return (
                    <div
                        key={pos.id}
                        onClick={() => onPositionClick?.(pos)}
                        className={`
                            relative cursor-pointer p-3 rounded-lg border-2 transition-all
                            min-h-[60px] flex flex-col items-center justify-center
                            ${isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-300'
                                : isOccupied
                                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20 hover:border-green-500'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                            }
                        `}
                    >
                        {/* Occupied indicator */}
                        {isOccupied && (
                            <div className="absolute top-1 right-1">
                                <Package size={12} className="text-green-600" />
                            </div>
                        )}

                        {/* Position code */}
                        <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200 text-center whitespace-nowrap px-1">
                            {pos.code}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
