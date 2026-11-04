import { AlertTriangle, CheckCircle, PlusCircle, MinusCircle } from 'lucide-react'
import { formatQuantityFull } from '@/lib/numberUtils'

interface ItemReconciliation {
    productId: string
    productCode: string
    productName: string
    unit: string
    accountingBalance: number
    lotBalance: number
    diff: number
    lotCount?: number
    lotDetails?: { code: string, qty: number, positions: string[] }[]
}

interface MobileReconciliationListProps {
    items: ItemReconciliation[]
    positionFilter?: 'all' | 'has_position' | 'no_position'
    onSelectLotDetail?: (item: ItemReconciliation) => void
    onCreateOrder?: (item: ItemReconciliation, type: 'INBOUND' | 'OUTBOUND') => void
    selectedKeys?: Set<string>
    onToggleSelect?: (item: ItemReconciliation) => void
    getItemKey?: (item: ItemReconciliation) => string
}

export default function MobileReconciliationList({
    items,
    positionFilter = 'has_position',
    onSelectLotDetail,
    onCreateOrder,
    selectedKeys,
    onToggleSelect,
    getItemKey
}: MobileReconciliationListProps) {
    if (items.length === 0) {
        return (
            <div className="p-8 text-center text-stone-500 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800">
                Không có dữ liệu.
            </div>
        )
    }

    const lotLabel = positionFilter === 'has_position'
        ? 'LOT có vị trí'
        : positionFilter === 'no_position'
        ? 'LOT chưa vị trí'
        : 'Tổng LOT'

    return (
        <div className="space-y-4">
            {items.map((item, index) => {
                const isDiff = Math.abs(item.diff) >= 0.001
                const itemKey = getItemKey ? getItemKey(item) : `${item.productId}_${item.unit}`
                const isChecked = selectedKeys?.has(itemKey)

                return (
                    <div
                        key={`${itemKey}_${index}`}
                        className={`bg-white dark:bg-stone-900 p-4 rounded-xl border shadow-sm space-y-3 transition-colors ${isChecked ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/20' : (isDiff ? 'border-orange-200 dark:border-orange-900/50 ring-1 ring-orange-200 dark:ring-orange-900/30' : 'border-stone-200 dark:border-stone-800')}`}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex items-start gap-2.5">
                                {isDiff && onToggleSelect && (
                                    <div className="pt-0.5">
                                        <input
                                            type="checkbox"
                                            checked={isChecked || false}
                                            onChange={() => onToggleSelect(item)}
                                            className="w-4 h-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                        />
                                    </div>
                                )}
                                <div>
                                    <div className="font-mono text-xs font-medium text-stone-500 mb-0.5">
                                        {item.productCode}
                                    </div>
                                    <h3 className="font-bold text-stone-900 dark:text-stone-100 leading-tight">{item.productName}</h3>
                                </div>
                            </div>
                            <div>
                                {isDiff ? (
                                    <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded text-xs font-bold border border-red-100 dark:border-red-900/30">
                                        <AlertTriangle size={12} />
                                        Lệch {item.diff > 0 ? '+' : ''}{formatQuantityFull(item.diff)}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded text-xs font-bold border border-emerald-100 dark:border-emerald-900/30">
                                        <CheckCircle size={12} />
                                        Khớp
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Comparison Grid */}
                        <div className="grid grid-cols-2 gap-2 text-sm bg-stone-50 dark:bg-stone-800/50 p-3 rounded-lg border border-stone-100 dark:border-stone-800">
                            <div>
                                <div className="text-xs text-stone-500 mb-0.5">Tồn Kế toán</div>
                                <div className="font-medium text-stone-900 dark:text-stone-100">{formatQuantityFull(item.accountingBalance)} {item.unit}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-stone-500 mb-0.5">{lotLabel}</div>
                                <div className="font-medium text-stone-900 dark:text-stone-100 flex items-center justify-end gap-1">
                                    <span>{formatQuantityFull(item.lotBalance)} {item.unit}</span>
                                    {item.lotDetails && item.lotDetails.length > 0 && onSelectLotDetail && (
                                        <button
                                            type="button"
                                            onClick={() => onSelectLotDetail(item)}
                                            className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 font-semibold"
                                        >
                                            {item.lotDetails.length} LOT
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Balance Action Buttons */}
                        {isDiff && onCreateOrder && (
                            <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                                {item.diff < 0 ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => onCreateOrder(item, 'INBOUND')}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 active:scale-95 transition-all shadow-sm cursor-pointer"
                                            title="Tạo phiếu Nhập điều chỉnh để cân bằng sổ sách"
                                        >
                                            <PlusCircle size={14} />
                                            <span>Nhập cân bằng (+{formatQuantityFull(Math.abs(item.diff))})</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onCreateOrder(item, 'OUTBOUND')}
                                            className="p-1.5 rounded-lg text-stone-400 hover:text-orange-600 border border-stone-200 dark:border-stone-800 transition-colors cursor-pointer"
                                            title="Hoặc tạo phiếu Xuất điều chỉnh"
                                        >
                                            <MinusCircle size={14} />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => onCreateOrder(item, 'OUTBOUND')}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800 active:scale-95 transition-all shadow-sm cursor-pointer"
                                            title="Tạo phiếu Xuất điều chỉnh để cân bằng sổ sách"
                                        >
                                            <MinusCircle size={14} />
                                            <span>Xuất cân bằng (-{formatQuantityFull(item.diff)})</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onCreateOrder(item, 'INBOUND')}
                                            className="p-1.5 rounded-lg text-stone-400 hover:text-emerald-600 border border-stone-200 dark:border-stone-800 transition-colors cursor-pointer"
                                            title="Hoặc tạo phiếu Nhập điều chỉnh"
                                        >
                                            <PlusCircle size={14} />
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
