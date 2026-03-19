'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Database } from '@/lib/database.types'
import { ArrowRightLeft, ChevronDown, ChevronRight, Layers, Search, Building2, Flag } from 'lucide-react'

type Zone = Database['public']['Tables']['zones']['Row']

interface SelectMoveDestinationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (zoneId: string) => void
    zones: Zone[]
}

export function SelectMoveDestinationModal({ isOpen, onClose, onConfirm, zones }: SelectMoveDestinationModalProps) {
    const [selectedZoneId, setSelectedZoneId] = useState<string>('')
    const [mode, setMode] = useState<'manual' | 'auto_hall'>('manual')
    const [expandedWarehouseId, setExpandedWarehouseId] = useState<string | null>(null)
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

    // Helper to find all Sảnh of a Warehouse
    const findAllHallsForWarehouse = (warehouseId: string): Zone[] => {
        const results: Zone[] = []
        const queue: string[] = [warehouseId]
        const visited = new Set<string>([warehouseId])

        while (queue.length > 0) {
            const currentId = queue.shift()!
            const children = zones.filter(z => z.parent_id === currentId)
            
            for (const child of children) {
                if (child.is_hall) {
                    results.push(child)
                }
                if (!visited.has(child.id)) {
                    visited.add(child.id)
                    queue.push(child.id)
                }
            }
        }
        return results.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
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
                        Chọn Khu vực (Zone) đích hoặc Gán sảnh tự động theo Kho.
                    </DialogDescription>
                </DialogHeader>

                {/* Mode Tabs */}
                <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-xl mb-4">
                    <button
                        onClick={() => setMode('manual')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'manual'
                            ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <Layers size={14} />
                        Chọn vị trí cụ thể
                    </button>
                    <button
                        onClick={() => setMode('auto_hall')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'auto_hall'
                            ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <Flag size={14} />
                        Gán sảnh tự động
                    </button>
                </div>

                <div className="py-2">
                    {zones.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 text-sm">
                            Chưa có dữ liệu khu vực nào trong hệ thống.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {mode === 'manual' ? (
                                <>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
                                        Chọn Khu vực đích:
                                    </label>
                                    <div className="max-h-[350px] overflow-y-auto pr-2 bg-white dark:bg-gray-800 border rounded-lg p-2 space-y-1">
                                        {rootZones.map(zone => renderZoneNode(zone))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
                                        Chọn Kho để tìm sảnh:
                                    </label>
                                    <div className="max-h-[350px] overflow-y-auto pr-2 space-y-2">
                                        {rootZones.map(warehouse => {
                                            const halls = findAllHallsForWarehouse(warehouse.id)
                                            const isExpanded = expandedWarehouseId === warehouse.id
                                            const sảnhSelectedInThisWarehouse = halls.find(h => h.id === selectedZoneId)

                                            return (
                                                <div key={warehouse.id} className="space-y-1">
                                                    <button
                                                        type="button"
                                                        disabled={halls.length === 0}
                                                        onClick={() => {
                                                            setExpandedWarehouseId(isExpanded ? null : warehouse.id)
                                                            if (halls.length === 1) {
                                                                setSelectedZoneId(halls[0].id)
                                                            }
                                                        }}
                                                        className={`
                                                            w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left
                                                            ${isExpanded || sảnhSelectedInThisWarehouse
                                                                ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 shadow-sm'
                                                                : halls.length > 0
                                                                    ? 'border-gray-100 dark:border-gray-800 hover:border-indigo-200 bg-white dark:bg-gray-800'
                                                                    : 'border-gray-50 dark:border-gray-900 opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900 grayscale'
                                                            }
                                                        `}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`p-2 rounded-lg ${isExpanded || sảnhSelectedInThisWarehouse ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                                                                <Building2 size={20} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-bold text-gray-900 dark:text-white truncate">{warehouse.name}</div>
                                                                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                                    {halls.length > 0 ? (
                                                                        <>
                                                                            <Flag size={10} className="text-indigo-400" />
                                                                            {halls.length} Sảnh có sẵn
                                                                        </>
                                                                    ) : (
                                                                        'Không có sảnh'
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {sảnhSelectedInThisWarehouse && !isExpanded && (
                                                                <div className="px-2 py-0.5 bg-indigo-500 text-white text-[10px] font-bold rounded-full">
                                                                    Đã chọn
                                                                </div>
                                                            )}
                                                            {halls.length > 0 && (
                                                                <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                            )}
                                                        </div>
                                                    </button>

                                                    {isExpanded && halls.length > 0 && (
                                                        <div className="ml-4 pl-4 border-l-2 border-indigo-100 dark:border-indigo-900/50 py-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                                            {halls.map(hall => {
                                                                const isSelected = selectedZoneId === hall.id
                                                                return (
                                                                    <button
                                                                        key={hall.id}
                                                                        type="button"
                                                                        onClick={() => setSelectedZoneId(hall.id)}
                                                                        className={`
                                                                            w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left
                                                                            ${isSelected
                                                                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 shadow-sm'
                                                                                : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                                                                            }
                                                                        `}
                                                                    >
                                                                        <div className="flex items-center gap-3 min-w-0">
                                                                            <Flag size={14} className={isSelected ? 'text-indigo-500' : 'text-gray-400'} />
                                                                            <span className="text-sm font-bold truncate">{hall.name}</span>
                                                                        </div>
                                                                        {isSelected && <ArrowRightLeft size={14} className="text-indigo-500" />}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {selectedZoneId && mode === 'auto_hall' && (
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg animate-in fade-in slide-in-from-top-1">
                                            <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2 font-medium">
                                                <Search size={16} className="text-blue-500" />
                                                Gán vào: <span className="underline decoration-blue-300 underline-offset-4">{zones.find(z => z.id === selectedZoneId)?.name}</span>
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
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
