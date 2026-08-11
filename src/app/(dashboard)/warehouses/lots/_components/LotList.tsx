import { Boxes, Check, Minus, X } from 'lucide-react'
import { Lot } from '../_hooks/useLotManagement'
import { LotCard } from './LotCard'

interface LotListProps {
    loading: boolean
    lots: Lot[]
    isModuleEnabled: (moduleId: string) => boolean
    isUtilityEnabled: (utilityId: string) => boolean
    selectedLotIds?: Set<string>
    onToggleSelect?: (id: string) => void
    onSelectAll?: () => void
    onClearSelection?: () => void
    onEdit: (lot: Lot) => void
    onDelete: (id: string) => void
    onView: (lot: Lot) => void
    onQr: (lot: Lot) => void
    onToggleStar: (lot: Lot) => void
    onAssignTag: (lot: Lot) => void
    onMerge?: (lot: Lot) => void
    onSplit?: (lot: Lot) => void
    onExport?: (lot: Lot) => void
    onBulkClone?: (lot: Lot) => void
    onAssignLocation?: (lot: Lot) => void
    onToggleLock?: (id: string, currentLocked: boolean) => Promise<boolean>
    managePermission?: string
    searchTerm?: string
}

export function LotList({
    loading,
    lots,
    isModuleEnabled,
    isUtilityEnabled,
    selectedLotIds = new Set(),
    onToggleSelect,
    onSelectAll,
    onClearSelection,
    onEdit,
    onDelete,
    onView,
    onQr,
    onToggleStar,
    onToggleLock,
    onAssignTag,
    onMerge,
    onSplit,
    onExport,
    onBulkClone,
    onAssignLocation,
    managePermission,
    searchTerm
}: LotListProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 animate-pulse h-64"></div>
                ))}
            </div>
        )
    }

    if (lots.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                    <Boxes className="text-slate-300" size={48} />
                    <p className="text-slate-500">Chưa có LOT nào được tạo</p>
                </div>
            </div>
        )
    }

    const isAllPageSelected = lots.length > 0 && lots.every(l => selectedLotIds.has(l.id))
    const isSomePageSelected = lots.some(l => selectedLotIds.has(l.id)) && !isAllPageSelected

    return (
        <div className="space-y-4">
            {/* Multi-select Header Control Bar */}
            {onToggleSelect && onSelectAll && onClearSelection && (
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                if (isAllPageSelected) {
                                    onClearSelection()
                                } else {
                                    onSelectAll()
                                }
                            }}
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                                isAllPageSelected
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : isSomePageSelected
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-2 border-emerald-500'
                                        : 'border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-emerald-500'
                            }`}
                            title={isAllPageSelected ? 'Bỏ chọn trang này' : 'Chọn tất cả LOT trên trang'}
                        >
                            {isAllPageSelected && <Check size={13} className="stroke-[3]" />}
                            {isSomePageSelected && <Minus size={13} className="stroke-[3]" />}
                        </button>
                        <span className="font-medium text-slate-700 dark:text-slate-200 select-none">
                            {isAllPageSelected
                                ? `Đã chọn tất cả ${lots.length} LOT trên trang này`
                                : `Chọn tất cả trên trang này (${lots.length} LOT)`}
                        </span>
                    </div>

                    {selectedLotIds.size > 0 && (
                        <div className="flex items-center gap-3">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                Đã chọn: {selectedLotIds.size} LOT
                            </span>
                            <button
                                type="button"
                                onClick={onClearSelection}
                                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                            >
                                <X size={14} />
                                <span>Bỏ chọn</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Lot Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lots.map(lot => (
                    <LotCard
                        key={lot.id}
                        lot={lot}
                        isSelected={selectedLotIds.has(lot.id)}
                        onToggleSelect={onToggleSelect}
                        managePermission={managePermission}
                        isModuleEnabled={isModuleEnabled}
                        isUtilityEnabled={isUtilityEnabled}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onView={onView}
                        onQr={onQr}
                        onToggleStar={onToggleStar}
                        onAssignTag={onAssignTag}
                        onMerge={onMerge}
                        onSplit={onSplit}
                        onExport={onExport}
                        onBulkClone={onBulkClone}
                        onAssignLocation={onAssignLocation}
                        onToggleLock={onToggleLock}
                        searchTerm={searchTerm}
                    />
                ))}
            </div>
        </div>
    )
}
