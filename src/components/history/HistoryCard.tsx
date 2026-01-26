import { format } from 'date-fns'
import { User, Activity, Clock, FileText } from 'lucide-react'

interface HistoryCardProps {
    log: any
}

export default function HistoryCard({ log }: HistoryCardProps) {
    const actionColor = {
        'CREATE': 'text-green-600 bg-green-50',
        'UPDATE': 'text-blue-600 bg-blue-50',
        'DELETE': 'text-red-600 bg-red-50',
    }[log.action as string] || 'text-stone-600 bg-stone-50'

    const actionText = {
        'CREATE': 'Đã tạo',
        'UPDATE': 'Cập nhật',
        'DELETE': 'Đã xóa',
    }[log.action as string] || log.action

    // Helper to extract a readable title or ID
    const getTargetName = () => {
        // Try to find a meaningful name/code in the data
        const data = log.new_data || log.old_data
        if (!data) return log.record_id.slice(0, 8) + '...'

        if (data.code) return data.code
        if (data.name) return data.name
        if (data.title) return data.title // For tasks?

        return log.record_id.slice(0, 8) + '...'
    }

    // Helper to generate a description based on table
    const getDescription = () => {
        const name = getTargetName()
        switch (log.table_name) {
            case 'lots':
                return `LOT: ${name}`
            case 'inbound_orders':
                return `Nhập kho: ${name}`
            case 'outbound_orders':
                return `Xuất kho: ${name}`
            case 'positions':
                // Special handling for positions if we can infer details
                if (log.action === 'UPDATE' && log.new_data?.lot_id && !log.old_data?.lot_id) {
                    return `Gán vị trí: ${name}`
                }
                if (log.action === 'UPDATE' && !log.new_data?.lot_id && log.old_data?.lot_id) {
                    return `Gỡ vị trí: ${name}`
                }
                return `Vị trí: ${name}`
            default:
                // Try to map common tables to readable names
                const mapping: Record<string, string> = {
                    'products': 'Sản phẩm',
                    'customers': 'Khách hàng',
                    'suppliers': 'Nhà cung cấp',
                    'users': 'Người dùng'
                }
                return `${mapping[log.table_name] || log.table_name}: ${name}`
        }
    }

    return (
        <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-stone-500 flex items-center gap-1">
                   {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                </span>
                {log.changed_by_user ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-stone-100 rounded-full text-stone-600 truncate max-w-[100px]">
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
                     <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${actionColor}`}>
                        {actionText}
                    </span>
                </div>
                <h4 className="text-sm font-medium text-stone-800 break-words leading-tight">
                    {getDescription()}
                </h4>
            </div>

             {/* If there is a note or description in the data */}
             {((log.new_data?.notes || log.new_data?.description || log.new_data?.note)) && (
                <p className="mt-1.5 text-xs text-stone-500 italic truncate border-t border-stone-50 pt-1">
                    "{log.new_data?.notes || log.new_data?.description || log.new_data?.note}"
                </p>
             )}

             {/* Display specific changes for updates could go here */}
        </div>
    )
}
