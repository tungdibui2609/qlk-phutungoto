'use client'
import { useMemo, useState, useRef, useEffect } from 'react'
import { FileOutput, ArrowDownToLine, ArrowRightLeft, PackageMinus, X, Tag, Trash2, ChevronDown, Printer, Zap, MapPinOff, MapPin, Layers } from 'lucide-react'
import { Database } from '@/lib/database.types'

type Position = Database['public']['Tables']['positions']['Row']

interface MultiSelectActionBarProps {
    selectedPositionIds: Set<string>
    positions: Position[]
    lotInfo: Record<string, {
        code: string,
        items: Array<{ product_name: string, sku: string, unit: string, quantity: number, tags?: string[] }>,
        inbound_date?: string,
        created_at?: string,
        packaging_date?: string,
        peeling_date?: string,
        tags?: string[]
    }>
    onClear: () => void
    onTag: (lotIds: string[]) => void
    onDeleteTags: (lotIds: string[]) => void
    onDeleteLot: (lotIds: string[]) => void
    onUnassignPosition?: (positionIds: string[]) => void
    onBulkExport: () => void
    onBulkPrint: (lotIds: string[]) => void
    onExportOrder: (positionIds: string[], lotIds: string[]) => void
    onOpenSelectHall?: () => void
    onOpenMove?: () => void
    onOpenAutoAssignWarehouse?: () => void
}

export default function MultiSelectActionBar({
    selectedPositionIds,
    positions,
    lotInfo,
    onClear,
    onTag,
    onDeleteTags,
    onDeleteLot,
    onUnassignPosition,
    onBulkExport,
    onBulkPrint,
    onExportOrder,
    onOpenSelectHall,
    onOpenMove,
    onOpenAutoAssignWarehouse
}: MultiSelectActionBarProps) {
    const [isTagMenuOpen, setIsTagMenuOpen] = useState(false)
    const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false)

    const [tagMenuPos, setTagMenuPos] = useState({ top: 0, left: 0 })
    const [locationMenuPos, setLocationMenuPos] = useState({ top: 0, left: 0 })

    const tagMenuRef = useRef<HTMLDivElement>(null)
    const tagButtonRef = useRef<HTMLButtonElement>(null)

    const locationMenuRef = useRef<HTMLDivElement>(null)
    const locationButtonRef = useRef<HTMLButtonElement>(null)

    // Close menus when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
                setIsTagMenuOpen(false)
            }
            if (locationMenuRef.current && !locationMenuRef.current.contains(event.target as Node)) {
                setIsLocationMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleToggleTagMenu = () => {
        if (!isTagMenuOpen && tagButtonRef.current) {
            const rect = tagButtonRef.current.getBoundingClientRect()
            setTagMenuPos({ top: rect.top - 8, left: rect.left })
        }
        setIsTagMenuOpen(!isTagMenuOpen)
        setIsLocationMenuOpen(false)
    }

    const handleToggleLocationMenu = () => {
        if (!isLocationMenuOpen && locationButtonRef.current) {
            const rect = locationButtonRef.current.getBoundingClientRect()
            setLocationMenuPos({ top: rect.top - 8, left: rect.left })
        }
        setIsLocationMenuOpen(!isLocationMenuOpen)
        setIsTagMenuOpen(false)
    }

    // Get selected positions data
    const selectedPositions = useMemo(() => {
        return positions.filter(p => selectedPositionIds.has(p.id))
    }, [positions, selectedPositionIds])

    // Get unique LOT IDs from selected positions
    const selectedLotIds = useMemo(() => {
        const lotIds = new Set<string>()
        selectedPositions.forEach(p => {
            if (p.lot_id) lotIds.add(p.lot_id)
        })
        return lotIds
    }, [selectedPositions])

    // Aggregate selected items for display
    const aggregatedItems = useMemo(() => {
        const groups: Record<string, {
            sku: string,
            productName: string,
            unit: string,
            totalQuantity: number,
            positionCount: number,
            lotCodes: Set<string>,
            lotId: string
        }> = {}

        selectedPositions.forEach((pos: Position) => {
            const lot = pos.lot_id ? lotInfo[pos.lot_id] : null
            if (!lot || !lot.items) return

            lot.items.forEach(item => {
                const sku = item.sku || ''
                const productName = item.product_name || lot.code
                const unit = item.unit || ''
                const qty = item.quantity || 0

                const key = `${sku}|${productName}|${unit}`

                if (!groups[key]) {
                    groups[key] = {
                        sku,
                        productName,
                        unit,
                        totalQuantity: 0,
                        positionCount: 0,
                        lotCodes: new Set(),
                        lotId: pos.lot_id!
                    }
                }

                groups[key].totalQuantity = Number((groups[key].totalQuantity + qty).toFixed(3))
                groups[key].lotCodes.add(lot.code)
            })

            const uniqueKeysInLot = new Set(lot.items.map(i => `${i.sku || ''}|${i.product_name || lot.code}|${i.unit || ''}`))
            uniqueKeysInLot.forEach(key => {
                if (groups[key]) groups[key].positionCount += 1
            })
        })

        return Object.values(groups)
    }, [selectedPositions, lotInfo])

    // Calculate higher level summary (Total by Unit)
    const totalByUnit = useMemo(() => {
        const units: Record<string, number> = {}
        aggregatedItems.forEach(item => {
            units[item.unit] = Number(((units[item.unit] || 0) + item.totalQuantity).toFixed(3))
        })
        return units
    }, [aggregatedItems])

    if (selectedPositionIds.size === 0) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-5">
            <div className="mx-auto w-fit min-w-[320px] max-w-[98vw] px-2 sm:px-4 pb-3">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    
                    {/* Action buttons and Selection Info */}
                    <div className="flex items-center gap-2 p-2 border-b border-gray-100 dark:border-gray-700/80">
                        
                        {/* Selection count badge */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl shadow-sm shrink-0">
                            <Layers size={15} />
                            <span className="text-xs font-bold whitespace-nowrap">
                                Đã chọn {selectedPositionIds.size}
                            </span>
                        </div>

                        {/* Action buttons scrollable container */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                            
                            {/* Nút 1: Lệnh xuất kho */}
                            <button
                                onClick={() => onExportOrder(Array.from(selectedPositionIds), Array.from(selectedLotIds))}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl transition-all active:scale-95 whitespace-nowrap shrink-0 shadow-sm"
                                title="Tạo lệnh xuất kho"
                            >
                                <FileOutput size={15} className="text-blue-600 dark:text-blue-400" />
                                <span>Lệnh xuất kho</span>
                            </button>

                            {/* SUB MENU: VỊ TRÍ & SẢNH (Gồm: Di chuyển, Hạ sảnh, Gán sảnh tự động, Gỡ vị trí) */}
                            <div className="relative shrink-0">
                                <button
                                    ref={locationButtonRef}
                                    onClick={handleToggleLocationMenu}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all active:scale-95 whitespace-nowrap shadow-sm ${isLocationMenuOpen
                                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 dark:ring-indigo-800'
                                        : 'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                                        }`}
                                >
                                    <MapPin size={15} className={isLocationMenuOpen ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'} />
                                    <span>Vị trí & Sảnh</span>
                                    <ChevronDown size={13} className={`transition-transform duration-200 ${isLocationMenuOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isLocationMenuOpen && (
                                    <div
                                        ref={locationMenuRef}
                                        className="fixed min-w-[210px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-1.5 animate-in fade-in zoom-in-95 duration-150 z-[100]"
                                        style={{
                                            top: locationMenuPos.top,
                                            left: locationMenuPos.left,
                                            transform: 'translateY(-100%)'
                                        }}
                                    >
                                        <div className="px-2.5 py-1.5 text-[10px] font-extrabold text-indigo-500 uppercase tracking-wider select-none border-b border-gray-100 dark:border-gray-700/60 mb-1">
                                            Thao tác vị trí & sảnh
                                        </div>
                                        
                                        <button
                                            onClick={() => {
                                                if (onOpenMove) onOpenMove()
                                                setIsLocationMenuOpen(false)
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-xl transition-colors text-left group"
                                        >
                                            <ArrowRightLeft size={16} className="text-indigo-500 group-hover:scale-110 transition-transform shrink-0" />
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold">Di chuyển</span>
                                                <span className="text-[10px] text-gray-400 font-normal">Đổi vị trí lưu kho</span>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => {
                                                if (onOpenSelectHall) onOpenSelectHall()
                                                setIsLocationMenuOpen(false)
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900/40 rounded-xl transition-colors text-left group"
                                        >
                                            <ArrowDownToLine size={16} className="text-orange-500 group-hover:scale-110 transition-transform shrink-0" />
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-orange-600 dark:text-orange-400">Hạ sảnh</span>
                                                <span className="text-[10px] text-gray-400 font-normal">Chuyển LOT ra sảnh chờ xuất</span>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => {
                                                if (onOpenAutoAssignWarehouse) onOpenAutoAssignWarehouse()
                                                setIsLocationMenuOpen(false)
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/40 rounded-xl transition-colors text-left group"
                                        >
                                            <Zap size={16} className="text-amber-500 group-hover:scale-110 transition-transform shrink-0" />
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-amber-600 dark:text-amber-400">Gán sảnh tự động</span>
                                                <span className="text-[10px] text-gray-400 font-normal">Tự động sắp xếp vị trí sảnh</span>
                                            </div>
                                        </button>

                                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />

                                        <button
                                            onClick={() => {
                                                if (onUnassignPosition) onUnassignPosition(Array.from(selectedPositionIds))
                                                setIsLocationMenuOpen(false)
                                            }}
                                            disabled={selectedLotIds.size === 0}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-xl transition-colors text-left disabled:opacity-50 group"
                                        >
                                            <MapPinOff size={16} className="text-gray-400 group-hover:scale-110 transition-transform shrink-0" />
                                            <div className="flex flex-col min-w-0">
                                                <span>Gỡ vị trí</span>
                                                <span className="text-[10px] text-gray-400 font-normal">Đưa LOT về chưa gán</span>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Nút 3: In mã QR */}
                            <button
                                onClick={() => onBulkPrint(Array.from(selectedLotIds))}
                                disabled={selectedLotIds.size === 0}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0 shadow-sm"
                                title="In mã QR hàng loạt"
                            >
                                <Printer size={15} className="text-emerald-600 dark:text-emerald-400" />
                                <span>In mã QR</span>
                            </button>

                            {/* SUB MENU: MÃ PHỤ */}
                            <div className="relative shrink-0">
                                <button
                                    ref={tagButtonRef}
                                    onClick={handleToggleTagMenu}
                                    disabled={selectedLotIds.size === 0}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap shadow-sm ${isTagMenuOpen
                                        ? 'bg-teal-600 text-white ring-2 ring-teal-300 dark:ring-teal-800'
                                        : 'bg-teal-50/80 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/80 hover:bg-teal-100 dark:hover:bg-teal-900/60'
                                        }`}
                                >
                                    <Tag size={15} className={isTagMenuOpen ? 'text-white' : 'text-teal-600 dark:text-teal-400'} />
                                    <span>Mã phụ</span>
                                    <ChevronDown size={13} className={`transition-transform duration-200 ${isTagMenuOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isTagMenuOpen && (
                                    <div
                                        ref={tagMenuRef}
                                        className="fixed min-w-[180px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-1.5 animate-in fade-in zoom-in-95 duration-150 z-[100]"
                                        style={{
                                            top: tagMenuPos.top,
                                            left: tagMenuPos.left,
                                            transform: 'translateY(-100%)'
                                        }}
                                    >
                                        <div className="px-2.5 py-1.5 text-[10px] font-extrabold text-teal-500 uppercase tracking-wider select-none border-b border-gray-100 dark:border-gray-700/60 mb-1">
                                            Quản lý mã phụ
                                        </div>
                                        <button
                                            onClick={() => {
                                                onTag(Array.from(selectedLotIds))
                                                setIsTagMenuOpen(false)
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-teal-900/40 rounded-xl transition-colors text-left group"
                                        >
                                            <Tag size={15} className="text-teal-500 group-hover:scale-110 transition-transform" />
                                            <span>Gán mã phụ</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                onDeleteTags(Array.from(selectedLotIds))
                                                setIsTagMenuOpen(false)
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors text-left group"
                                        >
                                            <Trash2 size={15} className="text-rose-500 group-hover:scale-110 transition-transform" />
                                            <span>Xóa mã phụ</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Nút 5: Xuất khỏi kho */}
                            <button
                                onClick={onBulkExport}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/80 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all active:scale-95 whitespace-nowrap shrink-0 shadow-sm"
                                title="Xuất trực tiếp toàn bộ khỏi kho"
                            >
                                <PackageMinus size={15} className="text-rose-500" />
                                <span>Xuất khỏi kho</span>
                            </button>

                            {/* Nút 6: Xóa LOT */}
                            <button
                                onClick={() => {
                                    if (selectedLotIds.size > 0) onDeleteLot(Array.from(selectedLotIds))
                                }}
                                disabled={selectedLotIds.size === 0}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/40 rounded-xl transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0"
                                title="Xóa LOT đã chọn"
                            >
                                <Trash2 size={15} className="text-rose-500" />
                                <span>Xóa LOT</span>
                            </button>

                        </div>

                        {/* Close button */}
                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />
                        <button
                            onClick={onClear}
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors shrink-0"
                            title="Bỏ chọn tất cả"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Selected items summary list */}
                    <div className="px-4 py-2 bg-gray-50/80 dark:bg-gray-900/50 max-h-40 overflow-y-auto">
                        {/* Summary Header */}
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200/60 dark:border-gray-800">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tổng hợp số lượng:</span>
                            <div className="flex flex-wrap gap-3">
                                {Object.entries(totalByUnit).map(([unit, qty], i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <span className="text-sm font-black text-blue-600 dark:text-blue-400 tabular-nums">
                                            {qty}
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">
                                            {unit}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-[minmax(180px,auto)_110px_90px_minmax(120px,1fr)] gap-y-1">
                            {aggregatedItems.map((item, idx) => {
                                const codesArray = Array.from(item.lotCodes)

                                return (
                                    <div key={`${item.lotId}-${idx}`} className="contents group">
                                        {/* Column 1: SKU & Product Name */}
                                        <div className="flex items-center gap-1.5 min-w-0 py-1.5 pl-3 bg-white dark:bg-gray-800 rounded-l-lg border-y border-l border-gray-200 dark:border-gray-700 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                                            {item.sku && (
                                                <span className="shrink-0 px-1 py-0.5 bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-500 dark:text-gray-400 rounded font-mono font-bold">
                                                    {item.sku.slice(0, 2)}
                                                </span>
                                            )}
                                            <span className="font-bold text-gray-900 dark:text-white truncate text-xs" title={item.productName}>
                                                {item.productName}
                                            </span>
                                        </div>

                                        {/* Column 2: Quantity */}
                                        <div className="flex items-center justify-end py-1.5 bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                                            <span className="text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap text-xs">
                                                {item.totalQuantity} {item.unit}
                                            </span>
                                        </div>

                                        {/* Column 3: Position Count */}
                                        <div className="flex items-center justify-end py-1.5 bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                                            <span className="text-gray-400 whitespace-nowrap text-xs">
                                                ({item.positionCount} vị trí)
                                            </span>
                                        </div>

                                        {/* Column 4: Lot Code */}
                                        <div className="flex items-center justify-end py-1.5 pr-3 bg-white dark:bg-gray-800 rounded-r-lg border-y border-r border-gray-200 dark:border-gray-700 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                                            <div className="flex items-center gap-1 min-w-0">
                                                {codesArray.length === 1 ? (
                                                    <span className="text-gray-400 font-mono truncate text-[11px]">
                                                        {codesArray[0]}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 italic truncate text-[11px]">
                                                        {codesArray.length} lô
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

