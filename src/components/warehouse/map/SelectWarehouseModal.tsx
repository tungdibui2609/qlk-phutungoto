'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { useSystem } from '@/contexts/SystemContext'
import { Building2, ChevronRight, Zap } from 'lucide-react'
import { Database } from '@/lib/database.types'

type Zone = Database['public']['Tables']['zones']['Row']

interface SelectWarehouseModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (warehouseId: string) => void
    zones: Zone[]
}

export function SelectWarehouseModal({ isOpen, onClose, onConfirm, zones }: SelectWarehouseModalProps) {
    const { systemType } = useSystem()
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')

    // Root zones (Warehouses) have no parent_id
    const warehouses = zones.filter(z => !z.parent_id || z.parent_id === '')

    useEffect(() => {
        if (isOpen && warehouses.length > 0 && !selectedWarehouseId) {
            setSelectedWarehouseId(warehouses[0].id)
        }
    }, [isOpen, warehouses, selectedWarehouseId])

    const handleConfirm = () => {
        if (selectedWarehouseId) {
            onConfirm(selectedWarehouseId)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        Gán sảnh tự động (Kho)
                    </DialogTitle>
                    <DialogDescription>
                        Hệ thống sẽ tự động tìm các vị trí trống trong các Sảnh của Kho được chọn và gán hàng vào đó.
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
                            <div className="grid gap-2 max-h-[350px] overflow-y-auto pr-2">
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
                        onClick={handleConfirm}
                        disabled={!selectedWarehouseId || warehouses.length === 0}
                        className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold text-white bg-yellow-500 rounded-xl hover:bg-yellow-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20"
                    >
                        Bắt đầu gán tự động
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
