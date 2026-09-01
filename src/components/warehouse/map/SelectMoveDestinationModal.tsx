'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Database } from '@/lib/database.types'
import { ArrowRightLeft, MapPin, CheckCircle2, AlertTriangle, X, Package, Building2 } from 'lucide-react'

type Zone = Database['public']['Tables']['zones']['Row']
type Position = Database['public']['Tables']['positions']['Row'] & {
    zone_id?: string | null
}

interface SelectMoveDestinationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (targetPositionId: string) => void
    zones: Zone[]
    positions?: Position[]
    selectedPositions?: Position[]
}

export function SelectMoveDestinationModal({
    isOpen,
    onClose,
    onConfirm,
    zones,
    positions = [],
    selectedPositions = []
}: SelectMoveDestinationModalProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPos, setSelectedPos] = useState<Position | null>(null)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSearchQuery('')
            setSelectedPos(null)
            setIsDropdownOpen(false)
            setTimeout(() => {
                inputRef.current?.focus()
            }, 100)
        }
    }, [isOpen])

    // Get zone path string for a zoneId
    const getZonePath = (zoneId: string | null | undefined): string => {
        if (!zoneId) return 'Chưa phân khu'
        const path: string[] = []
        let currentId: string | null = zoneId
        const visited = new Set<string>()

        while (currentId && !visited.has(currentId)) {
            visited.add(currentId)
            const zone = zones.find(z => z.id === currentId)
            if (!zone) break
            path.unshift(zone.name)
            currentId = zone.parent_id
        }
        return path.join(' > ')
    }

    // Filter matching positions based on search query
    const searchResults = searchQuery.trim()
        ? positions.filter(p => {
            const q = searchQuery.trim().toLowerCase()
            const code = (p.code || '').toLowerCase()
            return code.includes(q)
        }).slice(0, 15)
        : []

    // Auto select exact match if user types full position code
    useEffect(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) {
            setSelectedPos(null)
            return
        }
        const exact = positions.find(p => (p.code || '').toLowerCase() === query)
        if (exact) {
            setSelectedPos(exact)
        }
    }, [searchQuery, positions])

    const handleSelectPosition = (pos: Position) => {
        setSelectedPos(pos)
        setSearchQuery(pos.code || '')
        setIsDropdownOpen(false)
    }

    const handleConfirm = () => {
        if (selectedPos) {
            onConfirm(selectedPos.id)
        }
    }

    const lotsToMoveCount = selectedPositions.filter(p => p.lot_id).length

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[540px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                        <ArrowRightLeft className="w-5 h-5" />
                        Di chuyển Hàng hóa
                    </DialogTitle>
                    <DialogDescription>
                        Nhập hoặc chọn Mã vị trí mới để di chuyển hàng hóa đến.
                    </DialogDescription>
                </DialogHeader>

                {/* Selected Lots Summary Card */}
                {selectedPositions.length > 0 && (
                    <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-200">
                            <span className="flex items-center gap-1.5">
                                <Package size={14} className="text-indigo-500" />
                                Hàng hóa cần di chuyển:
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[11px]">
                                {lotsToMoveCount > 0 ? `${lotsToMoveCount} LOT` : `${selectedPositions.length} vị trí`}
                            </span>
                        </div>
                        <div className="text-[11px] text-indigo-700 dark:text-indigo-300 flex flex-wrap gap-1 mt-1 max-h-16 overflow-y-auto">
                            {selectedPositions.map(p => (
                                <span key={p.id} className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 rounded font-mono text-[10px]">
                                    {p.code}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input & Search Section */}
                <div className="space-y-3 py-2">
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                            Mã vị trí đích mới <span className="text-rose-500">*</span>
                        </label>

                        <div className="relative flex items-center">
                            <MapPin className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value)
                                    setIsDropdownOpen(true)
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && selectedPos) {
                                        e.preventDefault()
                                        handleConfirm()
                                    }
                                }}
                                placeholder="Nhập mã vị trí (VD: K1D2A01T302)..."
                                className="w-full pl-9 pr-9 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono transition-all"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('')
                                        setSelectedPos(null)
                                        setIsDropdownOpen(false)
                                        inputRef.current?.focus()
                                    }}
                                    className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Dropdown suggestions */}
                        {isDropdownOpen && searchResults.length > 0 && (
                            <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl space-y-0.5 p-1 animate-in fade-in duration-150">
                                {searchResults.map((pos) => {
                                    const isSelected = selectedPos?.id === pos.id
                                    const isOccupied = !!pos.lot_id
                                    const zonePath = getZonePath(pos.zone_id)

                                    return (
                                        <button
                                            key={pos.id}
                                            type="button"
                                            onClick={() => handleSelectPosition(pos)}
                                            className={`
                                                w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors text-xs
                                                ${isSelected
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-200'
                                                }
                                            `}
                                        >
                                            <div className="min-w-0 pr-2">
                                                <div className="font-mono font-bold text-sm flex items-center gap-1.5">
                                                    <span>{pos.code}</span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 truncate flex items-center gap-1 mt-0.5">
                                                    <Building2 size={10} className="shrink-0" />
                                                    <span>{zonePath}</span>
                                                </div>
                                            </div>

                                            <div className="shrink-0">
                                                {isOccupied ? (
                                                    <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800">
                                                        Có hàng
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
                                                        Trống
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Status Feedback Card */}
                    {selectedPos ? (
                        <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                            selectedPos.lot_id
                                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300'
                                : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                        }`}>
                            <div className="flex items-center gap-2 font-bold">
                                {selectedPos.lot_id ? (
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                )}
                                <span>Mã vị trí: <span className="font-mono text-sm underline">{selectedPos.code}</span></span>
                            </div>
                            <div className="text-[11px] opacity-90 pl-6">
                                Khu vực: {getZonePath(selectedPos.zone_id)}
                            </div>
                            <div className="text-[11px] font-medium pl-6 pt-0.5">
                                {selectedPos.lot_id
                                    ? '⚠️ Vị trí này hiện đang có lưu LOT hàng hóa. Di chuyển đến đây sẽ cập nhật lại vị trí.'
                                    : '✓ Vị trí hợp lệ và sẵn sàng nhận hàng.'
                                }
                            </div>
                        </div>
                    ) : searchQuery.trim() && !searchResults.length ? (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                            <X className="w-4 h-4 text-rose-500 shrink-0" />
                            <span>Không tìm thấy vị trí với mã <strong>"{searchQuery}"</strong> trong hệ thống.</span>
                        </div>
                    ) : null}
                </div>

                <DialogFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!selectedPos}
                        className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                        <ArrowRightLeft size={14} />
                        Xác nhận Di chuyển
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
