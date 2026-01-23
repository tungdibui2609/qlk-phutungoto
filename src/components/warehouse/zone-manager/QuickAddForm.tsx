import { X } from 'lucide-react'
import { ZoneTemplate } from './types'

interface QuickAddFormProps {
    parentId: string | null
    depth?: number
    ui: {
        addingUnder: string | null
        quickAddCode: string
        setQuickAddCode: (v: string) => void
        quickAddName: string
        setQuickAddName: (v: string) => void
        quickAddCount: number
        setQuickAddCount: (v: number) => void
        selectedTemplateId: string
        setSelectedTemplateId: (v: string) => void
        setAddingUnder: (v: string | null) => void
    }
    templates: ZoneTemplate[]
    onAdd: (parentId: string | null, code: string, name: string, count: number, templateId?: string) => void
}

export function QuickAddForm({ parentId, depth = 0, ui, templates, onAdd }: QuickAddFormProps) {
    if (ui.addingUnder !== (parentId || 'root')) return null

    return (
        <div
            className="flex flex-wrap items-center gap-2 py-2 px-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 my-1"
            style={{ marginLeft: `${depth * 20 + 12}px` }}
        >
            <input
                type="text"
                value={ui.quickAddCode}
                onChange={(e) => ui.setQuickAddCode(e.target.value)}
                placeholder="Mã"
                className="w-24 px-2 py-1 border rounded text-xs font-mono uppercase"
                autoFocus
            />
            <input
                type="text"
                value={ui.quickAddName}
                onChange={(e) => ui.setQuickAddName(e.target.value)}
                placeholder="Tên"
                className="w-32 px-2 py-1 border rounded text-xs"
            />

            {/* Template selector */}
            {templates.length > 0 && (
                <select
                    value={ui.selectedTemplateId}
                    onChange={(e) => ui.setSelectedTemplateId(e.target.value)}
                    className="px-2 py-1 border rounded text-xs bg-white text-stone-700"
                >
                    <option value="">-- Không dùng mẫu --</option>
                    {templates.map(t => (
                        <option key={t.id} value={t.id}>📋 {t.name}</option>
                    ))}
                </select>
            )}

            {/* Count (only if no template) */}
            {!ui.selectedTemplateId && (
                <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">×</span>
                    <input
                        type="number"
                        value={ui.quickAddCount}
                        onChange={(e) => ui.setQuickAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                        min={1}
                        max={50}
                        className="w-12 px-1 py-1 border rounded text-xs text-center"
                    />
                </div>
            )}

            <button
                onClick={() => {
                    onAdd(parentId, ui.quickAddCode, ui.quickAddName, ui.quickAddCount, ui.selectedTemplateId || undefined)
                    ui.setAddingUnder(null)
                    ui.setQuickAddCode('')
                    ui.setQuickAddName('')
                    ui.setQuickAddCount(1)
                    ui.setSelectedTemplateId('')
                }}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
            >
                {ui.selectedTemplateId ? 'Áp dụng mẫu' : 'Tạo'}
            </button>
            <button onClick={() => { ui.setAddingUnder(null); ui.setSelectedTemplateId('') }} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={14} />
            </button>
        </div>
    )
}
