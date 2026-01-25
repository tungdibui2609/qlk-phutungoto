interface InventoryItem {
    productCode: string
    productName: string
    warehouse: string
    unit: string
    opening: number
    qtyIn: number
    qtyOut: number
    balance: number
    isUnconvertible?: boolean
}

interface MobileInventoryListProps {
    items: InventoryItem[]
}

export default function MobileInventoryList({ items }: MobileInventoryListProps) {
    if (items.length === 0) {
        return (
            <div className="p-8 text-center text-stone-500 bg-white rounded-xl border border-stone-200">
                Không có dữ liệu tồn kho trong giai đoạn này.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {items.map((item, idx) => (
                <div
                    key={idx}
                    className={`bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-3 ${item.isUnconvertible ? 'bg-orange-50' : ''}`}
                >
                    {/* Header */}
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <div className="font-mono text-xs font-medium text-stone-500 mb-0.5">
                                {item.warehouse} • {item.productCode || 'N/A'}
                            </div>
                            <h3 className="font-bold text-stone-900 leading-tight">{item.productName}</h3>
                            {item.isUnconvertible && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600 border border-orange-200">
                                    Chưa thể quy đổi
                                </span>
                            )}
                        </div>
                        <div className="text-xs font-medium bg-stone-100 px-2 py-1 rounded text-stone-600 shrink-0">
                            {item.unit}
                        </div>
                    </div>

                    {/* Grid Stats */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-100">
                        <div>
                            <div className="text-xs text-stone-500">Tồn đầu</div>
                            <div className="font-medium text-stone-700">{item.opening.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-xs text-stone-500">Tồn cuối</div>
                            <div className="font-bold text-stone-900">{item.balance.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-xs text-stone-500">Nhập</div>
                            <div className="font-medium text-emerald-600">+{item.qtyIn.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-xs text-stone-500">Xuất</div>
                            <div className="font-medium text-rose-600">-{item.qtyOut.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
