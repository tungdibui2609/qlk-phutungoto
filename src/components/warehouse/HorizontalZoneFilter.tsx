'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Search, Filter, ChevronDown, Check, X } from 'lucide-react'

type Zone = Database['public']['Tables']['zones']['Row']

interface HorizontalZoneFilterProps {
    selectedZoneId: string | null
    onZoneSelect: (zoneId: string | null) => void
    searchTerm: string
    onSearchChange: (term: string) => void

}

export default function HorizontalZoneFilter({
    selectedZoneId,
    onZoneSelect,
    searchTerm,
    onSearchChange
}: HorizontalZoneFilterProps) {
    const [zones, setZones] = useState<Zone[]>([])
    const [loading, setLoading] = useState(true)
    const [session, setSession] = useState<any>(null)

    // Track Auth Session
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })
        return () => subscription.unsubscribe()
    }, [])

    const accessToken = session?.access_token

    useEffect(() => {
        if (accessToken) {
            fetchZones()
        }
    }, [accessToken])

    async function fetchZones() {
        if (!accessToken) return
        setLoading(true)
        const { data, error } = await supabase
            .from('zones')
            .select('*')
            .order('level')
            .order('name')

        if (!error && data) {
            setZones(data)
            // If nothing selected, maybe select the first warehouse?
            // For now, let's keep it null => All
        }
        setLoading(false)
    }

    // Helper: Build tree or map for easy lookup
    const zoneMap = useMemo(() => {
        const map = new Map<string, Zone>()
        zones.forEach(z => map.set(z.id, z))
        return map
    }, [zones])

    // Find path from selectedZoneId up to root
    const selectedPath = useMemo(() => {
        const path: Zone[] = []
        let currentId = selectedZoneId
        while (currentId && zoneMap.has(currentId)) {
            const z = zoneMap.get(currentId)!
            path.unshift(z)
            currentId = z.parent_id
        }
        return path
    }, [selectedZoneId, zoneMap])

    // Derived active states
    // Level 0 active: the zone in 'path' with level 0
    const activeLevel0 = selectedPath.find(z => z.level === 0)
    // Level 1 active: the zone in 'path' with level 1
    const activeLevel1 = selectedPath.find(z => z.level === 1)

    // Helper to get children of a parent
    function getChildren(parentId: string | null) {
        return zones.filter(z => z.parent_id === parentId).sort((a, b) => a.code.localeCompare(b.code))
    }

    const level0Zones = getChildren(null)
    const level1Zones = activeLevel0 ? getChildren(activeLevel0.id) : []

    // For deeper levels, we might have selected items at Level 2, 3...
    // We want to show dropdowns for levels >= 2
    // If we have an active Level 1, we show Level 2 dropdown.
    // If we have an active Level 2, we show Level 3 dropdown, etc.

    // Let's generate a list of dropdowns to render based on the current selection path
    // We need to know what is the next level to show.
    // If activeLevel1 is set, show Level 2 dropdown.
    // If activeLevel2 is set, show Level 3 dropdown.

    // Calculate which dropdowns to show. 
    // We always start checking from Active Level 1.
    // If Selected Path goes deeper, we set the value of the dropdown.
    // If it doesn't, we show a "All" dropdown for the next level.

    function handleLevel0Select(zone: Zone) {
        onZoneSelect(zone.id)
    }

    function handleLevel1Select(zone: Zone | null) {
        // If null, it means "All" for the current Level 0 parent
        if (zone) onZoneSelect(zone.id)
        else if (activeLevel0) onZoneSelect(activeLevel0.id)
    }

    function handleDropdownSelect(zoneId: string, parentId: string) {
        // If empty string (All), select parentId
        if (!zoneId) onZoneSelect(parentId)
        else onZoneSelect(zoneId)
    }

    // Determine deep levels to show
    // We want to show a dropdown for Level 2 if Level 1 is selected.
    // We want to show a dropdown for Level 3 if Level 2 is selected.
    // And maybe always show one empty dropdown for the next available level?

    // Let's hardcode a few levels for safety or make it recursive?
    // Recursive is better.
    // Start from activeLevel1.

    const deeperLevels = []
    let currentParentForDeep = activeLevel1
    let depth = 2

    // We iterate until we find no children or exceed a reasonable depth
    while (currentParentForDeep && depth < 6) {
        const children = getChildren(currentParentForDeep.id)
        if (children.length === 0) break

        // Check if one of these children is in our selected path
        const activeChild = selectedPath.find(z => z.level === depth)

        deeperLevels.push({
            level: depth,
            parentId: currentParentForDeep.id,
            children,
            activeId: activeChild?.id || ''
        })

        // Prepare for next iteration
        currentParentForDeep = activeChild || (activeChild === undefined ? undefined : undefined) // If no child selected at this level, stop expanding further dropdowns? 
        // Actually, if I select "All" at Level 2, I don't show Level 3 dropdown usually, or I show it disabled?
        // Use case: I want to see everything in Level 2. So Level 3 is irrelevant (it's mixed).
        // So we stop if no active child.
        if (!activeChild) break

        depth++
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            {/* Level 0: Warehouses (Tabs) */}
            <div className="flex flex-wrap gap-2">
                {level0Zones.map(zone => {
                    const isActive = activeLevel0?.id === zone.id
                    return (
                        <button
                            key={zone.id}
                            onClick={() => handleLevel0Select(zone)}
                            className={`
                                px-4 py-2 rounded-lg text-sm font-bold uppercase transition-all
                                ${isActive
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }
                            `}
                        >
                            {zone.name}
                        </button>
                    )
                })}
            </div>

            {/* Level 1 & Controls Bar */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                {/* Zone Navigation: Level 1 Tabs & Deeper Dropdowns */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    {/* Level 1 Tabs (e.g. Chambers/Ngăn) */}
                    {activeLevel0 && (
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-r border-gray-300 dark:border-gray-600 pr-4 mr-2">
                            {/* 'All' Option */}
                            <button
                                onClick={() => handleLevel1Select(null)}
                                className={`
                                    whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                                    ${!activeLevel1
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                        : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800'
                                    }
                                `}
                            >
                                Tất cả
                            </button>

                            {level1Zones.map(zone => {
                                const isActive = activeLevel1?.id === zone.id
                                return (
                                    <button
                                        key={zone.id}
                                        onClick={() => handleLevel1Select(zone)}
                                        className={`
                                            whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                                            ${isActive
                                                ? 'bg-white shadow-sm text-blue-700 font-bold ring-1 ring-blue-200 dark:bg-gray-800 dark:text-blue-300 dark:ring-blue-900'
                                                : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800'
                                            }
                                        `}
                                    >
                                        {zone.name}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Deeper Levels Dropdowns */}
                    <div className="flex flex-wrap items-center gap-3">
                        {deeperLevels.map((lvl, idx) => (
                            <div key={lvl.parentId} className="relative group">
                                <select
                                    value={lvl.activeId}
                                    onChange={(e) => handleDropdownSelect(e.target.value, lvl.parentId)}
                                    className="appearance-none pl-3 pr-8 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm min-w-[120px] focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors"
                                >
                                    <option value="">Tất cả {lvl.level === 2 ? 'Khu' : lvl.level === 3 ? 'Dãy' : lvl.level === 4 ? 'Tầng' : 'Zone'}</option>
                                    {lvl.children.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Search & Columns Row */}
                <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Tìm LOT, SP..."
                            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => onSearchChange('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    <button className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors">
                        Tìm
                    </button>


                </div>
            </div>
        </div>
    )
}
