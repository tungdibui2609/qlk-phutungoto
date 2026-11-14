import { format } from 'date-fns'
import { MapPin, Package } from 'lucide-react'
import { decodeSTT } from '@/lib/numberUtils'

interface HistoryCardProps {
    log: any
}

export default function HistoryCard({ log }: HistoryCardProps) {
    const actionColor = {
        'CREATE': 'text-green-600 bg-green-50 border-green-200',
        'UPDATE': 'text-blue-600 bg-blue-50 border-blue-200',
        'DELETE': 'text-red-600 bg-red-50 border-red-200',
    }[log.action as string] || 'text-stone-600 bg-stone-50 border-stone-200'

    const actionText = {
        'CREATE': 'Đã tạo',
        'UPDATE': 'Cập nhật',
        'DELETE': 'Đã xóa',
    }[log.action as string] || log.action

    const enriched = log._enriched || {}

    const getTargetName = () => {
        if (log.table_name === 'positions' && enriched.positionCode) {
            return enriched.positionCode
        }
        if (enriched.lotCode) return enriched.lotCode
        const data = log.new_data || log.old_data
        if (!data) return log.record_id.slice(0, 8) + '...'

        if (data.code) return data.code
        if (data._lot_code) return data._lot_code
        if (data._position_code) return data._position_code
        if (data.name) return data.name
        if (data.title) return data.title

        return log.record_id.slice(0, 8) + '...'
    }

    const getDescription = () => {
        const name = getTargetName()
        switch (log.table_name) {
            case 'lots': {
                const stt = enriched.dailySeq ? ` (STT: ${decodeSTT(enriched.dailySeq)})` : ''
                return `LOT: ${name}${stt}`
            }
            case 'lot_items': {
                const prodLabel = enriched.productName
                    ? `${enriched.productSku && enriched.productSku !== '-' ? `[${enriched.productSku}] ` : ''}${enriched.productName}`
                    : `LOT ${name}`
                return prodLabel
            }
            case 'inbound_orders':
                return `Nhập kho: ${name}`
            case 'outbound_orders':
                return `Xuất kho: ${name}`
            case 'delivery_journal': {
                const d = log.new_data || log.old_data || {}
                const itemName = d.item_name || name
                const qty = d.quantity_sent !== undefined ? ` (${d.quantity_sent} ${d.unit || ''})` : ''
                return `Số liệu: ${itemName}${qty}`
            }
            case 'delivery_shifts': {
                const d = log.new_data || log.old_data || {}
                const st = d.status === 'closed' ? 'Đóng ca' : 'Ca số liệu'
                return `${st}${d.opened_by_name ? ` - ${d.opened_by_name}` : ''}`
            }
            case 'shift_tasks': {
                const d = log.new_data || log.old_data || {}
                const statusMap: Record<string, string> = {
                    pending: 'Chờ nhận',
                    acknowledged: 'Đã nhận',
                    in_progress: 'Đang làm',
                    completed: 'Hoàn thành'
                }
                const st = d.status ? ` (${statusMap[d.status] || d.status})` : ''
                return `Giao việc: ${d.title || name}${st}`
            }
            case 'positions':
                if (log.action === 'UPDATE' && log.new_data?.lot_id && !log.old_data?.lot_id) {
                    return `Xếp vào vị trí: ${name}`
                }
                if (log.action === 'UPDATE' && !log.new_data?.lot_id && log.old_data?.lot_id) {
                    return `Gỡ khỏi vị trí: ${name}`
                }
                if (log.action === 'UPDATE' && log.new_data?.lot_id && log.old_data?.lot_id) {
                    return `Đổi hàng tại vị trí: ${name}`
                }
                return `Vị trí: ${name}`
            default: {
                const mapping: Record<string, string> = {
                    'products': 'Sản phẩm',
                    'customers': 'Khách hàng',
                    'suppliers': 'Nhà cung cấp',
                    'users': 'Người dùng',
                    'export_tasks': 'Lệnh xuất'
                }
                return `${mapping[log.table_name] || log.table_name}: ${name}`
            }
        }
    }

    const renderQuantityChange = () => {
        if (log.table_name !== 'lot_items') return null
        const oldQty = log.old_data?.quantity
        const newQty = log.new_data?.quantity
        const unit = enriched.productUnit || log.new_data?.unit || log.old_data?.unit || ''

        if (log.action === 'UPDATE' && oldQty !== undefined && newQty !== undefined && oldQty !== newQty) {
            const diff = Number((newQty - oldQty).toFixed(3))
            return (
                <div className="mt-1.5 flex items-center justify-between text-xs bg-stone-50 px-2 py-1 rounded border border-stone-100">
                    <span className="text-stone-500 font-mono">
                        LOT {enriched.lotCode || '-'}: {oldQty} → {newQty} {unit}
                    </span>
                    <span className={`font-bold font-mono px-1.5 py-0.5 rounded text-[11px] ${diff > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {diff > 0 ? `+${diff}` : diff}
                    </span>
                </div>
            )
        }
        if (log.action === 'CREATE' && newQty !== undefined) {
            return (
                <div className="mt-1.5 flex items-center justify-between text-xs bg-emerald-50/60 px-2 py-1 rounded border border-emerald-100">
                    <span className="text-stone-600 font-mono">LOT {enriched.lotCode || '-'}</span>
                    <span className="font-bold font-mono text-emerald-700">+{newQty} {unit}</span>
                </div>
            )
        }
        if (log.action === 'DELETE' && oldQty !== undefined) {
            return (
                <div className="mt-1.5 flex items-center justify-between text-xs bg-rose-50/60 px-2 py-1 rounded border border-rose-100">
                    <span className="text-stone-600 font-mono">LOT {enriched.lotCode || '-'}</span>
                    <span className="font-bold font-mono text-rose-700">-{oldQty} {unit}</span>
                </div>
            )
        }
        return null
    }

    const renderPositionDetails = () => {
        if (log.table_name !== 'positions') return null
        const lotLabel = enriched.newLotCode || enriched.oldLotCode || enriched.lotCode
        const isReplace = Boolean(enriched.oldLotCode && enriched.newLotCode && enriched.oldLotCode !== enriched.newLotCode)
        if (!lotLabel && !isReplace) return null

        return (
            <div className="mt-1.5 space-y-1 text-xs bg-stone-50 px-2 py-1.5 rounded border border-stone-100">
                <div className="flex items-center gap-1.5 font-mono font-semibold text-stone-700">
                    <MapPin size={11} className="text-emerald-600 shrink-0" />
                    {isReplace ? (
                        <span>{enriched.oldLotCode} → {enriched.newLotCode}</span>
                    ) : (
                        <span>LOT: {lotLabel}</span>
                    )}
                </div>
                {Array.isArray(enriched.itemsSummary) && enriched.itemsSummary.length > 0 && (
                    <div className="space-y-0.5 pl-4 text-[11px] text-stone-600">
                        {enriched.itemsSummary.slice(0, 3).map((it: any, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-2">
                                <span className="truncate">{it.name}</span>
                                <span className="font-bold font-mono shrink-0">{it.quantity} {it.unit}</span>
                            </div>
                        ))}
                        {enriched.itemsSummary.length > 3 && (
                            <div className="text-[10px] text-stone-400 italic">+{enriched.itemsSummary.length - 3} mặt hàng khác</div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    const renderLotItemsSummary = () => {
        if (log.table_name !== 'lots') return null
        const items = enriched.itemsSummary
        const positions = enriched.lotPositions
        if ((!items || items.length === 0) && (!positions || positions.length === 0)) return null

        return (
            <div className="mt-1.5 space-y-1 text-xs bg-stone-50 px-2 py-1.5 rounded border border-stone-100">
                {Array.isArray(positions) && positions.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                        <MapPin size={11} className="text-emerald-600 shrink-0" />
                        <span className="text-[11px] font-bold text-emerald-700">{positions.join(', ')}</span>
                    </div>
                )}
                {Array.isArray(items) && items.length > 0 && (
                    <div className="space-y-0.5 text-[11px] text-stone-600">
                        {items.slice(0, 3).map((it: any, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-2">
                                <span className="truncate flex items-center gap-1">
                                    <Package size={10} className="text-stone-400 shrink-0" />
                                    {it.name}
                                </span>
                                <span className="font-bold font-mono shrink-0">{it.quantity} {it.unit}</span>
                            </div>
                        ))}
                        {items.length > 3 && (
                            <div className="text-[10px] text-stone-400 italic">+{items.length - 3} mặt hàng khác</div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-stone-500 flex items-center gap-1">
                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                </span>
                {log.changed_by_user ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-stone-100 rounded-full text-stone-600 truncate max-w-[120px]">
                        {log.changed_by_user.full_name}
                    </span>
                ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 bg-stone-100 rounded-full text-stone-400">
                        System/Guest
                    </span>
                )}
            </div>

            <div className="mb-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${actionColor}`}>
                        {actionText}
                    </span>
                </div>
                <h4 className="text-sm font-semibold text-stone-800 break-words leading-tight">
                    {getDescription()}
                </h4>
            </div>

            {renderQuantityChange()}
            {renderPositionDetails()}
            {renderLotItemsSummary()}

            {((log.new_data?.notes || log.new_data?.description || log.new_data?.note)) && (
                <p className="mt-1.5 text-xs text-stone-500 italic truncate border-t border-stone-50 pt-1">
                    &quot;{log.new_data?.notes || log.new_data?.description || log.new_data?.note}&quot;
                </p>
            )}
        </div>
    )
}
