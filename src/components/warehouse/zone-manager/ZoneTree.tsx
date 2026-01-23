import { FolderTree, Trash2, Plus } from 'lucide-react'
import { LocalZone } from './types'
import { QuickAddForm } from './QuickAddForm'
import { ZoneNode } from './ZoneNode'

interface ZoneTreeProps {
    zones: LocalZone[]
    loading: boolean
    ui: any
    handlers: any
}

export function ZoneTree({ zones, loading, ui, handlers }: ZoneTreeProps) {
    const rootZones = handlers.buildTree(null)

    const renderZoneNode = (zone: LocalZone, depth: number = 0) => {
        const children = handlers.buildTree(zone.id)
        const positions = handlers.positionsMap[zone.id] || []

        return (
            <ZoneNode
                key={zone.id}
                zone={zone}
                depth={depth}
                positions={positions}
                childrenZones={children}
                expandedNodes={handlers.expandedNodes}
                toggleExpand={handlers.toggleExpand}
                ui={ui}
                handlers={handlers}
                renderZoneNode={renderZoneNode}
            />
        )
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FolderTree className="text-orange-500" size={20} />
                Thiết kế Cấu trúc Khu (Zone)
            </h3>

            <p className="text-xs text-gray-500 mb-4">
                💡 Chế độ thiết kế: Mọi thay đổi sẽ được lưu tạm. Bấm "Lưu Thay Đổi" ở trên cùng để áp dụng.
            </p>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="p-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Cấu trúc Zone ({zones.filter(z => z._status !== 'deleted').length} zone)</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlers.handleDeleteAllZones}
                            className="flex items-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium border border-red-200"
                            title="Xóa toàn bộ dữ liệu (Reset)"
                        >
                            <Trash2 size={12} />
                            Xóa tất cả
                        </button>
                        <button
                            onClick={() => { ui.setAddingUnder('root'); ui.setQuickAddCode(''); ui.setQuickAddName(''); ui.setQuickAddCount(1); ui.setSelectedTemplateId('') }}
                            className="flex items-center gap-1 px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium"
                        >
                            <Plus size={12} />
                            Thêm Zone gốc
                        </button>
                    </div>
                </div>

                <div className="max-h-[600px] overflow-y-auto p-2">
                    <QuickAddForm parentId={null} ui={ui} templates={handlers.templates} onAdd={handlers.handleQuickAdd} />

                    {loading ? (
                        <p className="text-sm text-gray-500 text-center py-4">Đang tải...</p>
                    ) : rootZones.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4 italic">Chưa có zone nào</p>
                    ) : (
                        rootZones.map((zone: LocalZone) => renderZoneNode(zone, 0))
                    )}
                </div>
            </div>
        </div>
    )
}
