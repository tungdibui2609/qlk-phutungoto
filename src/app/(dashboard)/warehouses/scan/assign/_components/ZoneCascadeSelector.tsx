import { useState, useEffect, useMemo } from 'react'
import { Database } from '@/lib/database.types'
import { ChevronRight, Layers } from 'lucide-react'

type Zone = Database['public']['Tables']['zones']['Row']

interface ZoneCascadeSelectorProps {
    zones: Zone[]
    selectedZoneId: string | null
    onSelect: (zoneId: string | null) => void
}

export function ZoneCascadeSelector({ zones, selectedZoneId, onSelect }: ZoneCascadeSelectorProps) {
    // Determine the path to the selected zone
    const selectionPath = useMemo(() => {
        if (!selectedZoneId) return []
        const path: string[] = []
        let current = zones.find(z => z.id === selectedZoneId)
        while (current) {
            path.unshift(current.id)
            current = zones.find(z => z.id === current?.parent_id)
        }
        return path
    }, [selectedZoneId, zones])

    // Group zones by parent_id
    const zonesByParent = useMemo(() => {
        const map: Record<string, Zone[]> = {}
        // Initialize for root (null parent)
        map['root'] = []

        zones.forEach(z => {
            const pId = z.parent_id || 'root'
            if (!map[pId]) map[pId] = []
            map[pId].push(z)
        })

        // Sort by name or code
        Object.keys(map).forEach(key => {
            map[key].sort((a, b) => a.name.localeCompare(b.name))
        })

        return map
    }, [zones])

    // Render dropdowns level by level
    // Level 0: Roots
    // Level 1: Children of selected Level 0
    // ...

    const renderLevels = () => {
        const levels = []
        // Always show Level 0 (Roots)
        levels.push({ parentId: 'root', selectedId: selectionPath[0] || null })

        // Show subsequent levels based on selection
        for (let i = 0; i < selectionPath.length; i++) {
            const currentSelectedId = selectionPath[i]
            // If the selected zone has children, show next level
            if (zonesByParent[currentSelectedId] && zonesByParent[currentSelectedId].length > 0) {
                levels.push({
                    parentId: currentSelectedId,
                    selectedId: selectionPath[i + 1] || null
                })
            }
        }

        return levels.map((level, idx) => {
            const options = zonesByParent[level.parentId] || []
            if (options.length === 0) return null

            return (
                <div key={level.parentId} className="col-span-1 animate-in slide-in-from-left-2 fade-in duration-300 flex items-center gap-2 md:w-auto">
                    {idx > 0 && <ChevronRight size={16} className="text-slate-400 hidden md:block" />}
                    <select
                        value={level.selectedId || ''}
                        onChange={(e) => {
                            const val = e.target.value
                            onSelect(val || (level.parentId === 'root' ? null : level.parentId))
                        }}
                        className={`
                            w-full px-2 py-2 md:px-3 md:py-2 rounded-lg border text-xs md:text-sm font-medium transition-all outline-none appearance-none md:appearance-auto truncate
                            ${level.selectedId
                                ? 'bg-white dark:bg-slate-800 border-orange-200 dark:border-orange-800 text-slate-900 dark:text-white shadow-sm'
                                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                            }
                            focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                        `}
                    >
                        <option value="">{idx === 0 ? 'Khu vực' : 'Chi tiết'}</option>
                        {options.map(z => (
                            <option key={z.id} value={z.id}>
                                {z.name}
                            </option>
                        ))}
                    </select>
                </div>
            )
        })
    }

    return (
        <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap md:items-center">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hidden md:block">
                <Layers size={18} />
            </div>
            {renderLevels()}
        </div>
    )
}
