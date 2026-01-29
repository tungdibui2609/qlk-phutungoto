import { ChevronDown, ChevronRight, Layers, Check, X, Edit2, Plus, Save, Copy, Package, Trash2 } from 'lucide-react'
import Protected from '@/components/auth/Protected'
import { LocalZone, LocalPosition } from './types'
import { QuickAddForm } from './QuickAddForm'

interface ZoneNodeProps {
    zone: LocalZone
    depth?: number
    positions: LocalPosition[]
    childrenZones: LocalZone[]
    expandedNodes: Set<string>
    toggleExpand: (id: string) => void
    ui: any
    handlers: any
    renderZoneNode: (zone: LocalZone, depth: number) => React.ReactNode
}

export function ZoneNode({ zone, depth = 0, positions, childrenZones, expandedNodes, toggleExpand, ui, handlers, renderZoneNode }: ZoneNodeProps) {
    const hasChildren = childrenZones.length > 0 || positions.length > 0
    const isExpanded = expandedNodes.has(zone.id)
    const isEditing = ui.editingZone === zone.id
    const isSavingTemplate = ui.savingTemplate === zone.id
    // Count recursively logic needed? passing simple count is better but here we have childrenZones.
    // Let's use count from props if needed, or simple length here.
    const childCount = childrenZones.length // Note: this is direct children only, not recursive count.
    const posCount = positions.length

    // Visual diffs
    const isNew = zone._status === 'new'
    const isModified = zone._status === 'modified'

    return (
        <div className="select-none">
            <div
                className={`flex items-center gap-2 py-2 px-3 rounded-lg group border-l-2 transition-colors
                    ${isNew ? 'bg-green-50 border-green-500 hover:bg-green-100' :
                        isModified ? 'bg-yellow-50 border-yellow-500 hover:bg-yellow-100' :
                            'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                style={{ paddingLeft: `${depth * 20 + 12}px` }}
            >
                <button
                    onClick={() => toggleExpand(zone.id)}
                    className={`w-5 h-5 flex items-center justify-center text-gray-400 ${!hasChildren && 'invisible'}`}
                >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                <Layers size={16} className={isNew ? "text-green-500" : isModified ? "text-yellow-600" : "text-orange-500"} />

                {isSavingTemplate ? (
                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-gray-500">Tên mẫu:</span>
                        <input
                            type="text"
                            value={ui.templateName}
                            onChange={(e: any) => ui.setTemplateName(e.target.value)}
                            className="flex-1 px-2 py-0.5 border rounded text-xs"
                            placeholder="VD: Khu 7 dãy x 5 tầng"
                            autoFocus
                        />
                        <button onClick={() => { handlers.handleSaveAsTemplate(zone.id, ui.templateName); ui.setSavingTemplate(null); ui.setTemplateName('') }} className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <Check size={14} />
                        </button>
                        <button onClick={() => { ui.setSavingTemplate(null); ui.setTemplateName('') }} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                            <X size={14} />
                        </button>
                    </div>
                ) : isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                        <input
                            type="text"
                            value={ui.editCode}
                            onChange={(e: any) => ui.setEditCode(e.target.value)}
                            className="w-24 px-2 py-0.5 border rounded text-xs font-mono uppercase"
                            placeholder="Mã"
                        />
                        <input
                            type="text"
                            value={ui.editName}
                            onChange={(e: any) => ui.setEditName(e.target.value)}
                            className="flex-1 px-2 py-0.5 border rounded text-xs"
                            placeholder="Tên"
                        />
                        <button onClick={() => { handlers.handleRename(zone.id, ui.editCode, ui.editName); ui.setEditingZone(null) }} className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <Check size={14} />
                        </button>
                        <button onClick={() => ui.setEditingZone(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{zone.code}</span>
                            <span className="text-sm text-gray-900 dark:text-white font-medium">{zone.name}</span>
                            <span className="text-xs text-gray-400">(L{zone.level})</span>
                            {/* Recursive count would need props or helper, skipping exact count for simplicity or using simple length */}
                            {childCount > 0 && <span className="text-xs text-blue-500">• {childCount} zone con</span>}
                            {posCount > 0 && <span className="text-xs text-green-600 font-medium">• {posCount} vị trí</span>}
                            {isNew && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">Mới</span>}
                            {isModified && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded">Sửa</span>}
                        </div>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Protected permission="warehouse.manage">
                                <button
                                    onClick={() => { ui.setEditingZone(zone.id); ui.setEditCode(zone.code); ui.setEditName(zone.name) }}
                                    className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                                    title="Đổi tên"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => { ui.setAddingUnder(zone.id); ui.setQuickAddCode(''); ui.setQuickAddName(''); ui.setQuickAddCount(1); ui.setSelectedTemplateId('') }}
                                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                                    title="Thêm zone con"
                                >
                                    <Plus size={14} />
                                </button>
                                {hasChildren && (
                                    <button
                                        onClick={() => { ui.setSavingTemplate(zone.id); ui.setTemplateName('') }}
                                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                                        title="Lưu làm mẫu"
                                    >
                                        <Save size={14} />
                                    </button>
                                )}
                                <button
                                    onClick={() => handlers.handleDuplicate(zone)}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Nhân bản"
                                >
                                    <Copy size={14} />
                                </button>
                                <button
                                    onClick={() => { ui.setAddingPositionsTo(zone.id) }} // Missing default prefix logic here, handled in Modal or effect?
                                    className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                                    title="Tạo vị trí hàng loạt"
                                >
                                    <Package size={14} />
                                </button>
                                <button
                                    onClick={() => handlers.handleDelete(zone.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Xóa"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </Protected>
                        </div>
                    </>
                )}
            </div>

            <QuickAddForm parentId={zone.id} depth={depth + 1} ui={ui} templates={handlers.templates} onAdd={handlers.handleQuickAdd} />

            {hasChildren && isExpanded && (
                <div>
                    {childrenZones.map(child => renderZoneNode(child, depth + 1))}
                    {/* Render Positions */}
                    {positions.filter(p => p._status !== 'deleted').map(pos => {
                        const isEditingPos = ui.editingPosition?.id === pos.id

                        return (
                            <div
                                key={pos.id}
                                className="flex items-center gap-2 py-1 px-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 group/pos border-l-2 border-transparent"
                                style={{ paddingLeft: `${(depth + 1) * 20 + 12}px` }}
                            >
                                <div className="w-5" /> {/* Placeholder for expand arrow */}
                                <Package size={14} className="text-blue-400" />

                                {isEditingPos ? (
                                    <div className="flex items-center gap-1 flex-1">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={ui.editingPosition.code}
                                            onChange={(e) => ui.setEditingPosition({ ...ui.editingPosition, code: e.target.value.toUpperCase() })}
                                            className="w-full px-1 py-0.5 text-xs font-mono border rounded uppercase"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') { handlers.handleRenamePosition(zone.id, pos.id, ui.editingPosition.code); ui.setEditingPosition(null) }
                                                if (e.key === 'Escape') ui.setEditingPosition(null)
                                            }}
                                        />
                                        <button onClick={() => { handlers.handleRenamePosition(zone.id, pos.id, ui.editingPosition.code); ui.setEditingPosition(null) }} className="p-0.5 text-green-600"><Check size={14} /></button>
                                        <button onClick={() => ui.setEditingPosition(null)} className="p-0.5 text-red-500"><X size={14} /></button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="font-mono text-xs text-gray-700 dark:text-gray-300 select-all">{pos.code}</span>

                                        <div className="flex-1" />

                                        <div className="flex items-center gap-1 opacity-0 group-hover/pos:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => ui.setEditingPosition({ id: pos.id, code: pos.code })}
                                                className="p-1 text-gray-300 hover:text-blue-500"
                                                title="Sửa tên"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={() => handlers.handleDeletePosition(pos.id, zone.id)}
                                                className="p-1 text-gray-300 hover:text-red-500"
                                                title="Xóa vị trí"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
