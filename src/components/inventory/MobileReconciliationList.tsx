import { AlertTriangle, CheckCircle } from 'lucide-react'
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
}

export default function MobileReconciliationList({ items, positionFilter = 'all', onSelectLotDetail }: MobileReconciliationListProps) {
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
                const isDiff = item.diff !== 0

                return (
                    <div
                        key={`${item.productId}_${item.unit}_${index}`}
                        className={`bg-white dark:bg-stone-900 p-4 rounded-xl border shadow-sm space-y-3 ${isDiff ? 'border-orange-200 dark:border-orange-900/50 ring-1 ring-orange-200 dark:ring-orange-900/30' : 'border-stone-200 dark:border-stone-800'}`}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start gap-2">
                            <div>
                                <div className="font-mono text-xs font-medium text-stone-500 mb-0.5">
                                    {item.productCode}
                                </div>
                                <h3 className="font-bold text-stone-900 dark:text-stone-100 leading-tight">{item.productName}</h3>
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
                    </div>
                )
            })}
        </div>
    )
}
