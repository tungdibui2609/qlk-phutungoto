'use client'

import { useZoneManager } from './useZoneManager'
import { ZoneToolbar } from './ZoneToolbar'
import { ZoneTemplateList } from './ZoneTemplateList'
import { ZoneTree } from './ZoneTree'
import { PositionCreatorModal } from './PositionCreatorModal'
import { BulkCloneModal } from './BulkCloneModal'
import { PastePositionsModal } from './PastePositionsModal'
import { ClipboardCopy, X } from 'lucide-react'

interface ZoneManagerProps {
    onZonesChanged?: () => void
}

export default function ZoneManager({ onZonesChanged }: ZoneManagerProps) {
    const manager = useZoneManager()
    const {
        ui,
        hasChanges, isSaving,
        handleSaveChanges, handleDiscardChanges,
        templates, deleteTemplate
    } = manager

    return (
        <div className="space-y-4">
            <ZoneToolbar
                hasChanges={hasChanges}
                isSaving={isSaving}
                handleSaveChanges={async () => {
                    await handleSaveChanges()
                    onZonesChanged?.()
                }}
                handleDiscardChanges={handleDiscardChanges}
                zones={manager.zones}
                positionsMap={manager.positionsMap}
            />

            <ZoneTemplateList
                templates={templates}
                deleteTemplate={deleteTemplate}
            />

            <ZoneTree
                zones={manager.zones}
                loading={manager.loading}
                ui={ui}
                handlers={manager}
            />

            {ui.addingPositionsTo && (
                <PositionCreatorModal
                    zoneId={ui.addingPositionsTo}
                    zones={manager.zones}
                    onClose={() => ui.setAddingPositionsTo(null)}
                    findLeafZones={manager.findLeafZones}
                    setPositionsMap={manager.setPositionsMap}
                    positionsMap={manager.positionsMap}
                    generateId={manager.generateId}
                    buildDefaultPrefix={manager.buildDefaultPrefix}
                />
            )}

            {ui.bulkCloningZone && (
                <BulkCloneModal
                    zone={ui.bulkCloningZone}
                    onClose={() => ui.setBulkCloningZone(null)}
                    onConfirm={manager.handleBulkClone}
                />
            )}

            {ui.pastingTargetZone && ui.copiedSourceZone && (
                <PastePositionsModal
                    sourceZone={ui.copiedSourceZone}
                    targetZone={ui.pastingTargetZone}
                    zones={manager.zones}
                    positionsMap={manager.positionsMap}
                    onClose={manager.handleClosePasteModal}
                    onConfirm={manager.handleConfirmPastePositions}
                />
            )}

            {ui.copiedSourceZone && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-gray-700 flex items-center gap-4 animate-in slide-in-from-bottom-5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <ClipboardCopy size={18} />
                        </div>
                        <div>
                            <div className="text-xs font-semibold flex items-center gap-1.5">
                                Đã sao chép: <span className="text-emerald-400 font-bold">{ui.copiedSourceZone.name}</span>
                                <span className="text-gray-400 font-mono text-[11px]">({ui.copiedSourceZone.code})</span>
                                <span className="text-emerald-300 text-[11px] font-medium">
                                    • {manager.countPositionsInTree(ui.copiedSourceZone.id)} vị trí
                                </span>
                            </div>
                            <div className="text-[11px] text-gray-400">
                                Bấm biểu tượng "Dán vị trí" trên zone đích trên cây sơ đồ (ví dụ: Kho 5, Dãy 1...)
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={manager.handleClearCopiedPositions}
                        className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors ml-2"
                        title="Hủy sao chép"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}
        </div>
    )
}
