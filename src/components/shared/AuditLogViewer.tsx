import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { getAuditLogs } from '@/lib/audit'
import { History, X } from 'lucide-react'
import { format } from 'date-fns'

interface AuditLogViewerProps {
    tableName: string
    recordId: string
    isOpen: boolean
    onClose: () => void
    title?: string
}

export default function AuditLogViewer({ tableName, recordId, isOpen, onClose, title }: AuditLogViewerProps) {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (isOpen && recordId) {
            fetchLogs()
        }
    }, [isOpen, recordId])

    async function fetchLogs() {
        setLoading(true)
        const data = await getAuditLogs(supabase, tableName, recordId)
        setLogs(data || [])
        setLoading(false)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50 rounded-t-xl">
                    <h3 className="font-bold text-stone-800 dark:text-white flex items-center gap-2">
                        <History size={20} className="text-blue-500" />
                        {title || 'Lịch sử thay đổi'}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-stone-200 dark:hover:bg-zinc-800 rounded">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="text-center py-8 text-stone-500">Đang tải lịch sử...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-8 text-stone-500">Chưa có lịch sử thay đổi nào.</div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="border border-stone-200 dark:border-zinc-700 rounded-lg p-3 bg-stone-50/50 dark:bg-zinc-800/50">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                                            log.action === 'CREATE' ? 'bg-green-100 text-green-700 border-green-200' :
                                            log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                            'bg-red-100 text-red-700 border-red-200'
                                        }`}>
                                            {log.action}
                                        </span>
                                        <span className="text-xs text-stone-500">
                                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                                        </span>
                                    </div>
                                    <span className="text-xs text-stone-500 italic">
                                        {/* Ideally we show user name here if join worked, else show ID */}
                                        User: {log.changed_by?.substring(0, 8)}...
                                    </span>
                                </div>

                                {log.action === 'UPDATE' && log.old_data && log.new_data && (
                                    <div className="text-xs space-y-1 mt-2">
                                        {Object.keys(log.new_data).map((key) => {
                                            const oldVal = log.old_data[key]
                                            const newVal = log.new_data[key]
                                            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                                                return (
                                                    <div key={key} className="grid grid-cols-[100px_1fr] gap-2 p-1 border-b border-stone-100 dark:border-zinc-700 last:border-0">
                                                        <span className="font-semibold text-stone-600 dark:text-stone-400">{key}:</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="line-through text-red-400">{String(oldVal)}</span>
                                                            <span className="text-stone-400">→</span>
                                                            <span className="text-green-600 font-medium">{String(newVal)}</span>
                                                        </div>
                                                    </div>
                                                )
                                            }
                                            return null
                                        })}
                                    </div>
                                )}

                                {log.action === 'CREATE' && (
                                    <div className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                                        Đã tạo mới bản ghi.
                                    </div>
                                )}

                                {log.action === 'DELETE' && (
                                    <div className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                                        Đã xóa bản ghi.
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
