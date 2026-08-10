import { Calendar } from 'lucide-react'

export type DateFilterField = 'created_at' | 'inbound_date' | 'peeling_date' | 'packaging_date' | 'raw_material_date';

interface DateRangeFilterProps {
    dateFilterField: DateFilterField
    onDateFieldChange: (value: DateFilterField) => void
    startDate: string
    onStartDateChange: (value: string) => void
    endDate: string
    onEndDateChange: (value: string) => void
    className?: string
}

export function DateRangeFilter({
    dateFilterField,
    onDateFieldChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    className = ""
}: DateRangeFilterProps) {
    return (
        <div className={`flex items-center gap-1.5 bg-emerald-50/50 dark:bg-emerald-950/20 pl-3 pr-2 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 group ${className}`}>
            <Calendar size={12} className="text-emerald-600 shrink-0" />
            <select
                value={dateFilterField}
                onChange={(e) => onDateFieldChange(e.target.value as any)}
                className="bg-transparent border-none text-[11px] font-bold uppercase text-emerald-800 dark:text-emerald-300 focus:ring-0 cursor-pointer p-0 shrink-0 tracking-wider appearance-none mr-2 outline-none"
            >
                <option value="created_at" className="bg-white dark:bg-slate-900">Ngày tạo</option>
                <option value="inbound_date" className="bg-white dark:bg-slate-900">Ngày nhập</option>
                <option value="peeling_date" className="bg-white dark:bg-slate-900">Ngày bóc</option>
                <option value="packaging_date" className="bg-white dark:bg-slate-900">Ngày đóng</option>
                <option value="raw_material_date" className="bg-white dark:bg-slate-900">Ngày nguyên liệu</option>
            </select>
            <div className="h-4 w-px bg-emerald-200 dark:bg-emerald-800 shrink-0"></div>
            <div className="flex items-center gap-1 px-1 flex-1 min-w-0">
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    className="bg-transparent border-none text-[11px] font-bold text-slate-700 dark:text-slate-200 focus:ring-0 p-0 cursor-pointer appearance-none flex-1 min-w-0 outline-none"
                />
                <span className="text-emerald-400 dark:text-emerald-600 text-[10px] font-black shrink-0 mx-0.5">→</span>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    className="bg-transparent border-none text-[11px] font-bold text-slate-700 dark:text-slate-200 focus:ring-0 p-0 cursor-pointer appearance-none flex-1 min-w-0 outline-none"
                />
            </div>
        </div>
    )
}
