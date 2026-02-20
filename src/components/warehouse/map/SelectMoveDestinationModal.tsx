'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Database } from '@/lib/database.types'
import { ArrowRightLeft, ChevronDown, ChevronRight, Layers } from 'lucide-react'

type Zone = Database['public']['Tables']['zones']['Row']

interface SelectMoveDestinationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (zoneId: string) => void
    zones: Zone[]
}

export function SelectMoveDestinationModal({ isOpen, onClose, onConfirm, zones }: SelectMoveDestinationModalProps) {
    const [selectedZoneId, setSelectedZoneId] = useState<string>('')
    const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set())

    // Expand all nodes initially when modal opens
    useEffect(() => {
        if (isOpen && zones.length > 0) {
            setExpandedNodeIds(new Set(zones.map(z => z.id)))
            setSelectedZoneId('') // reset selection
        }
    }, [isOpen, zones])

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setExpandedNodeIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const buildTree = (parentId: string | null): Zone[] => {
        return zones.filter(z => z.parent_id === parentId).sort((a, b) => (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name))
    }

    const renderZoneNode = (zone: Zone, depth: number = 0) => {
        const children = buildTree(zone.id)
        const hasChildren = children.length > 0
        const isExpanded = expandedNodeIds.has(zone.id)
        const isSelected = selectedZoneId === zone.id

        return (
            <div key={zone.id}>
                <label
                    className={`
                        flex items-center gap-2 py-2 px-3 cursor-pointer rounded-lg transition-all border
                        ${isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-700 dark:text-indigo-400'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-transparent text-gray-700 dark:text-gray-300'
                        }
                    `}
                    style={{ marginLeft: `${depth * 20}px` }}
                >
                    <div className="flex items-center h-5 mr-1">
                        <input
                            type="radio"
                            name="move_zone_selection"
                            className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                            checked={isSelected}
                            onChange={() => setSelectedZoneId(zone.id)}
                        />
                    </div>

                    {/* Expand button */}
                    <button
                        type="button"
                        onClick={(e) => toggleExpand(zone.id, e)}
                        className={`w-5 h-5 flex items-center justify-center shrink-0 ${!hasChildren && 'invisible'}`}
                    >
                        {isExpanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                    </button>

                    <Layers size={16} className={isSelected ? 'text-indigo-500 shrink-0' : 'text-gray-400 shrink-0'} />

                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{zone.name}</span>
                        {zone.code && <span className="text-xs text-gray-400">Mã: {zone.code}</span>}
                    </div>
                </label>

                {hasChildren && isExpanded && (
                    <div className="mt-1 space-y-1">
                        {children.map(child => renderZoneNode(child, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    const rootZones = buildTree(null)

    const handleConfirm = () => {
        if (selectedZoneId) {
            onConfirm(selectedZoneId)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
                        Di chuyển Hàng hóa
                    </DialogTitle>
                    <DialogDescription>
                        Chọn Khu vực (Zone) đích để di chuyển các lô hàng đã chọn tới. Hệ thống sẽ tự động xếp hàng vào các vị trí còn trống trong khu vực này.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {zones.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 text-sm">
                            Chưa có dữ liệu khu vực nào trong hệ thống.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Chọn Khu vực đích:
                            </label>

                            <div className="max-h-[350px] overflow-y-auto pr-2 bg-white dark:bg-gray-800 border rounded-lg p-2 space-y-1">
                                {rootZones.map(zone => renderZoneNode(zone))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedZoneId}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <ArrowRightLeft size={16} />
                        Xác nhận Di chuyển
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
