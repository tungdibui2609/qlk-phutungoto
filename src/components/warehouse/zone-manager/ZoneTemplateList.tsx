import { FileDown, X } from 'lucide-react'
import { ZoneTemplate } from './types'

interface ZoneTemplateListProps {
    templates: ZoneTemplate[]
    deleteTemplate: (id: string) => void
}

export function ZoneTemplateList({ templates, deleteTemplate }: ZoneTemplateListProps) {
    if (templates.length === 0) return null

    return (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                    <FileDown size={16} />
                    Mẫu đã lưu ({templates.length})
                </h4>
            </div>
            <div className="flex flex-wrap gap-2">
                {templates.map(t => (
                    <div key={t.id} className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded border text-xs">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{t.name}</span>
                        <button onClick={() => deleteTemplate(t.id)} className="p-0.5 text-gray-400 hover:text-red-500">
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
