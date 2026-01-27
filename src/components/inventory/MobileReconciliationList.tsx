import { AlertTriangle, CheckCircle } from 'lucide-react'

interface ItemReconciliation {
    productId: string
    productCode: string
    productName: string
    unit: string
    accountingBalance: number
    lotBalance: number
    diff: number
}

interface MobileReconciliationListProps {
    items: ItemReconciliation[]
}

export default function MobileReconciliationList({ items }: MobileReconciliationListProps) {
    if (items.length === 0) {
        return (
            <div className="p-8 text-center text-stone-500 bg-white rounded-xl border border-stone-200">
                Không có dữ liệu.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {items.map((item, index) => {
                const isDiff = item.diff !== 0

                return (
                    <div
                        key={`${item.productId}_${item.unit}_${index}`}
                        className={`bg-white p-4 rounded-xl border shadow-sm space-y-3 ${isDiff ? 'border-orange-200 ring-1 ring-orange-200' : 'border-stone-200'}`}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start gap-2">
                            <div>
                                <div className="font-mono text-xs font-medium text-stone-500 mb-0.5">
                                    {item.productCode}
                                </div>
                                <h3 className="font-bold text-stone-900 leading-tight">{item.productName}</h3>
                            </div>
                            <div>
                                {isDiff ? (
                                    <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-100">
                                        <AlertTriangle size={12} />
                                        Lệch {item.diff > 0 ? '+' : ''}{item.diff.toLocaleString()}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs font-bold border border-emerald-100">
                                        <CheckCircle size={12} />
                                        Khớp
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Comparison Grid */}
                        <div className="grid grid-cols-2 gap-2 text-sm bg-stone-50 p-3 rounded-lg border border-stone-100">
                            <div>
                                <div className="text-xs text-stone-500 mb-0.5">Tồn Kế toán</div>
                                <div className="font-medium text-stone-900">{item.accountingBalance.toLocaleString()} {item.unit}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-stone-500 mb-0.5">Tổng LOT</div>
                                <div className="font-medium text-stone-900">{item.lotBalance.toLocaleString()} {item.unit}</div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
