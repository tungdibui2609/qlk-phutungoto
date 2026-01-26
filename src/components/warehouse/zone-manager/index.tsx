'use client'

import { useZoneManager } from './useZoneManager'
import { ZoneToolbar } from './ZoneToolbar'
import { ZoneTemplateList } from './ZoneTemplateList'
import { ZoneTree } from './ZoneTree'
import { PositionCreatorModal } from './PositionCreatorModal'

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
        </div>
    )
}
