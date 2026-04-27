'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { useSystem } from '@/contexts/SystemContext'
import { Building2, ChevronRight, Zap, Flag, ArrowLeft } from 'lucide-react'
import { Database } from '@/lib/database.types'

type Zone = Database['public']['Tables']['zones']['Row']

interface SelectWarehouseModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (params: { warehouseId: string; hallId: string | null }) => void
    zones: Zone[]
}

export function SelectWarehouseModal({ isOpen, onClose, onConfirm, zones }: SelectWarehouseModalProps) {
    const { systemType } = useSystem()
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
    const [selectedHallId, setSelectedHallId] = useState<string | null>(null)
    const [showHalls, setShowHalls] = useState(false)

    // Root zones (Warehouses) have no parent_id
    const warehouses = zones.filter(z => !z.parent_id || z.parent_id === '')

    // Get all descendant zone ids for a given zone
    const getDescendantIds = (zoneId: string): Set<string> => {
        const result = new Set<string>([zoneId])
        let added = true
        while (added) {
            added = false
            for (const z of zones) {
                if (z.parent_id && result.has(z.parent_id) && !result.has(z.id)) {
                    result.add(z.id)
                    added = true
                }
            }
        }
        return result
    }

    // Halls belonging to selected warehouse
    const warehouseHalls = useMemo(() => {
        if (!selectedWarehouseId) return []
        const descendants = getDescendantIds(selectedWarehouseId)
        return zones
            .filter(z => descendants.has(z.id) && (z as any).is_hall)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }))
    }, [selectedWarehouseId, zones])

    useEffect(() => {
        if (isOpen) {
            setShowHalls(false)
            setSelectedHallId(null)
            if (warehouses.length > 0 && !selectedWarehouseId) {
                setSelectedWarehouseId(warehouses[0].id)
            }
        }
    }, [isOpen])

    const handleSelectWarehouse = () => {
        if (warehouseHalls.length > 0) {
            setShowHalls(true)
            setSelectedHallId(null) // Default: auto (any hall)
        } else {
            // No halls, confirm directly
            onConfirm({ warehouseId: selectedWarehouseId, hallId: null })
        }
    }

    const handleConfirm = () => {
        if (selectedWarehouseId) {
            onConfirm({ warehouseId: selectedWarehouseId, hallId: selectedHallId })
        }
    }

    const handleBack = () => {
        setShowHalls(false)
        setSelectedHallId(null)
    }

    const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId)

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                {!showHalls ? (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Zap className="w-5 h-5 text-yellow-500" />
                                Gán sảnh tự động
                            </DialogTitle>
                            <DialogDescription>
                                Chọn Kho đích. Hệ thống sẽ tự động tìm vị trí trống trong các Sảnh của Kho đó.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                            {warehouses.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 text-sm">
                                    Chưa có dữ liệu Kho (Khu vực gốc).
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Chọn Kho đích:
                                    </label>
                                    <div className="grid gap-2 max-h-96 overflow-y-auto pr-2">
                                        {warehouses.map((wh) => (
                                            <label
                                                key={wh.id}
                                                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedWarehouseId === wh.id
                                                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                                                    : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                    }`}
                                            >
                                                <div className={`p-2 rounded-lg ${selectedWarehouseId === wh.id ? 'bg-yellow-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                                    <Building2 size={20} />
                                                </div>
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                                                        {wh.name}
                                                    </span>
                                                    <span className="text-xs text-gray-500 font-mono mt-0.5">
                                                        Mã: {wh.code}
                                                    </span>
                                                </div>
                                                <div className="flex items-center h-5">
                                                    <input
                                                        type="radio"
                                                        name="warehouse_selection"
                                                        className="w-4 h-4 text-yellow-600 border-gray-300 focus:ring-yellow-500"
                                                        checked={selectedWarehouseId === wh.id}
                                                        onChange={() => setSelectedWarehouseId(wh.id)}
                                                    />
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <button
                                onClick={onClose}
                                className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSelectWarehouse}
                                disabled={!selectedWarehouseId || warehouses.length === 0}
                                className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold text-white bg-yellow-500 rounded-xl hover:bg-yellow-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20"
                            >
                                {warehouseHalls.length > 0 ? 'Chọn Sảnh' : 'Bắt đầu gán tự động'}
                            </button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <button
                                onClick={handleBack}
                                className="mb-2 flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors -ml-1"
                            >
                                <ArrowLeft size={14} />
                                Quay lại chọn Kho
                            </button>
                            <DialogTitle className="flex items-center gap-2">
                                <Flag className="w-5 h-5 text-indigo-500" />
                                Chọn Sảnh - {selectedWarehouse?.name}
                            </DialogTitle>
                            <DialogDescription>
                                Chọn sảnh cụ thể hoặc để mặc định để hệ thống tự phân bổ.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                            {warehouseHalls.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 text-sm">
                                    Kho này chưa có Sảnh nào.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Chọn Sảnh đích (tùy chọn):
                                    </label>
                                    <div className="grid gap-2 max-h-96 overflow-y-auto pr-2">
                                        {/* Option: Auto (any hall) */}
                                        <label
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedHallId === null
                                                ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                                                : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                }`}
                                        >
                                            <div className={`p-2 rounded-lg ${selectedHallId === null ? 'bg-yellow-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                                <Zap size={20} />
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                                    Tự động (bất kỳ sảnh nào)
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    Hệ thống tự chọn sảnh có vị trí trống
                                                </span>
                                            </div>
                                            <div className="flex items-center h-5">
                                                <input
                                                    type="radio"
                                                    name="hall_selection"
                                                    className="w-4 h-4 text-yellow-600 border-gray-300 focus:ring-yellow-500"
                                                    checked={selectedHallId === null}
                                                    onChange={() => setSelectedHallId(null)}
                                                />
                                            </div>
                                        </label>

                                        {/* Specific halls */}
                                        {warehouseHalls.map((hall) => (
                                            <label
                                                key={hall.id}
                                                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedHallId === hall.id
                                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                                    : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                    }`}
                                            >
                                                <div className={`p-2 rounded-lg ${selectedHallId === hall.id ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                                    <Flag size={20} />
                                                </div>
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                                                        {hall.name}
                                                    </span>
                                                    <span className="text-xs text-gray-500 font-mono mt-0.5">
                                                        Mã: {hall.code}
                                                    </span>
                                                </div>
                                                <div className="flex items-center h-5">
                                                    <input
                                                        type="radio"
                                                        name="hall_selection"
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                        checked={selectedHallId === hall.id}
                                                        onChange={() => setSelectedHallId(hall.id)}
                                                    />
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <button
                                onClick={onClose}
                                className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={!selectedWarehouseId || warehouseHalls.length === 0}
                                className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold text-white rounded-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${selectedHallId === null ? 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}
                            >
                                {selectedHallId === null ? 'Gán tự động' : `Gán vào ${warehouseHalls.find(h => h.id === selectedHallId)?.name || 'Sảnh'}`}
                            </button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
