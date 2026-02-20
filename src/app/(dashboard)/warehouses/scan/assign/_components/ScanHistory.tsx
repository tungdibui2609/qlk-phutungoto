import { CheckCircle2, XCircle, Info, Clock, Trash2 } from 'lucide-react'

export type ScanHistoryType = 'success' | 'error' | 'info';

export interface ScanHistoryItem {
    id: string;
    timestamp: Date;
    type: ScanHistoryType;
    title: string;
    subtitle?: string;
}

interface ScanHistoryProps {
    items: ScanHistoryItem[];
    onClear: () => void;
}

export function ScanHistory({ items, onClear }: ScanHistoryProps) {
    if (items.length === 0) return null;

    return (
        <div className="w-full max-w-2xl mt-8 pb-8">
            <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Clock size={18} />
                    Lịch sử ({items.length})
                </h3>
                <button
                    onClick={onClear}
                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition-colors"
                >
                    <Trash2 size={14} /> Xóa lịch sử
                </button>
            </div>
            
            <div className="space-y-2">
                {items.map(item => (
                    <div 
                        key={item.id} 
                        className={`p-3 rounded-xl border flex gap-3 items-start animate-in fade-in slide-in-from-top-2
                            ${item.type === 'success' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800' : ''}
                            ${item.type === 'error' ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-800' : ''}
                            ${item.type === 'info' ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800' : ''}
                            dark:bg-slate-900 bg-white
                        `}
                    >
                        <div className="mt-0.5 shrink-0">
                            {item.type === 'success' && <CheckCircle2 className="text-emerald-500" size={18} />}
                            {item.type === 'error' && <XCircle className="text-red-500" size={18} />}
                            {item.type === 'info' && <Info className="text-blue-500" size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate 
                                ${item.type === 'success' ? 'text-emerald-700 dark:text-emerald-400' : ''}
                                ${item.type === 'error' ? 'text-red-700 dark:text-red-400' : ''}
                                ${item.type === 'info' ? 'text-blue-700 dark:text-blue-400' : ''}
                            `}>
                                {item.title}
                            </p>
                            {item.subtitle && (
                                <p className="text-xs mt-0.5 text-slate-500 dark:text-slate-400">
                                    {item.subtitle}
                                </p>
                            )}
                        </div>
                        <div className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {item.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
