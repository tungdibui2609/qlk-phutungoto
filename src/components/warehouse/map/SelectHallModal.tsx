'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { useSystem } from '@/contexts/SystemContext'
import { Flag, ChevronDown, ChevronRight } from 'lucide-react'
import { Database } from '@/lib/database.types'

type Zone = Database['public']['Tables']['zones']['Row']

interface SelectHallModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (hallId: string) => void
    zones: Zone[]
}

export function SelectHallModal({ isOpen, onClose, onConfirm, zones }: SelectHallModalProps) {
    const { systemType } = useSystem()
    const [selectedHallId, setSelectedHallId] = useState<string>('')
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    const halls = zones.filter(z => z.is_hall)

    useEffect(() => {
        if (isOpen && halls.length > 0 && !selectedHallId) {
            const initialId = halls[0].id
            setSelectedHallId(initialId)
            const root = getRootZone(initialId)
            if (root) {
                setExpandedGroups(new Set([root.id]))
            }
        }
    }, [isOpen, halls, selectedHallId, zones])

    const getRootZone = (zoneId: string): Zone | null => {
        let current: Zone | undefined = zones.find(z => z.id === zoneId)
        while (current?.parent_id) {
            current = zones.find(z => z.id === current?.parent_id)
        }
        return current || null
    }

    const getZonePathFromRoot = (zoneId: string, rootId: string): string => {
        const path: string[] = []
        let currentId: string | null = zoneId
        let depth = 0
        while (currentId && currentId !== rootId && depth < 10) {
            const z = zones.find(zn => zn.id === currentId)
            if (z) {
                path.unshift(z.name)
                currentId = z.parent_id
            } else {
                break
            }
            depth++
        }
        return path.length > 0 ? path.join(' ❯ ') : 'Sảnh'
    }

    const groupedHalls = halls.reduce((acc, hall) => {
        const root = getRootZone(hall.id)
        const rootId = root ? root.id : 'root'
        if (!acc[rootId]) {
            acc[rootId] = { rootZone: root, groupHalls: [] }
        }
        acc[rootId].groupHalls.push(hall)
        return acc
    }, {} as Record<string, { rootZone: Zone | null, groupHalls: Zone[] }>)

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(groupId)) next.delete(groupId)
            else next.add(groupId)
            return next
        })
    }

    const handleConfirm = () => {
        if (selectedHallId) {
            onConfirm(selectedHallId)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Flag className="w-5 h-5 text-indigo-500" />
                        Chọn Sảnh (Hall)
                    </DialogTitle>
                    <DialogDescription>
                        Chọn sảnh để hạ hàng xuống. Hệ thống sẽ tự động tìm các vị trí trống trong sảnh đó.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {halls.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 text-sm">
                            Chưa có khu vực nào được đánh dấu là Sảnh.
                            <br />
                            Vui lòng cấu hình ở phần Hạ Tầng.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Danh sách Sảnh:
                            </label>
                            <div className="grid gap-4 max-h-[350px] overflow-y-auto pr-2">
                                {Object.entries(groupedHalls).map(([rootId, { rootZone, groupHalls }]) => {
                                    const groupName = rootZone ? rootZone.name : 'Khu vực gốc'
                                    const isExpanded = expandedGroups.has(rootId)

                                    return (
                                        <div key={rootId} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col">
                                            <button
                                                type="button"
                                                onClick={() => toggleGroup(rootId)}
                                                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                                            >
                                                <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                                                    {groupName} <span className="text-gray-500 font-normal text-xs ml-1">({groupHalls.length})</span>
                                                </span>
                                                {isExpanded ? (
                                                    <ChevronDown size={16} className="text-gray-500" />
                                                ) : (
                                                    <ChevronRight size={16} className="text-gray-500" />
                                                )}
                                            </button>

                                            {isExpanded && (
                                                <div className="p-2 space-y-2 bg-white dark:bg-gray-900 flex-1">
                                                    {groupHalls.map((hall) => (
                                                        <label
                                                            key={hall.id}
                                                            className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedHallId === hall.id
                                                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                                }`}
                                                        >
                                                            <div className="flex items-center h-5">
                                                                <input
                                                                    type="radio"
                                                                    name="hall_selection"
                                                                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                                    checked={selectedHallId === hall.id}
                                                                    onChange={() => setSelectedHallId(hall.id)}
                                                                />
                                                            </div>
                                                            <div className="flex flex-col flex-1 min-w-0">
                                                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                                                    {getZonePathFromRoot(hall.id, rootId)}
                                                                </span>
                                                                <span className="text-xs text-gray-500 font-mono mt-0.5">
                                                                    Mã: {hall.code}
                                                                </span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
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
                        disabled={!selectedHallId || halls.length === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Xác nhận Hạ sảnh
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
