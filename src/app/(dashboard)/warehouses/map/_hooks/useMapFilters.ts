import { useState, useMemo } from 'react'
import { matchSearch } from '@/lib/searchUtils'
import { matchDateRange } from '@/lib/dateUtils'
import { DateFilterField } from '@/components/warehouse/DateRangeFilter'
import { PositionWithZone } from './useWarehouseData'

interface UseMapFiltersProps {
    positions: PositionWithZone[]
    zones: any[] // Should be Zone type
    lotInfo: Record<string, any>
}

export function useMapFilters({ positions, zones, lotInfo }: UseMapFiltersProps) {
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Date Filters
    const [dateFilterField, setDateFilterField] = useState<DateFilterField>('created_at')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // Filter positions by all filters
    const filteredPositions = useMemo(() => {
        let result = positions

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            result = result.filter(p => {
                const posCode = p.code.toLowerCase()
                const lot = p.lot_id ? lotInfo[p.lot_id] : null

                // 1. Position Code Match
                if (posCode.includes(term)) return true

                // If no lot, we only match by position code
                if (!lot) return false

                // 2. Dynamic deep search using shared utility
                if (matchSearch(lot, searchTerm)) return true

                return false
            })
        }

        // Filter by date range
        if (startDate || endDate) {
            result = result.filter(p => {
                const lot = p.lot_id ? lotInfo[p.lot_id] : null
                if (!lot) return false
                return matchDateRange(lot[dateFilterField], startDate, endDate)
            })
        }

        // Filter by zone
        if (selectedZoneId) {
            // Get all descendant zone IDs
            const getDescendantIds = (parentId: string): string[] => {
                const children = zones.filter(z => z.parent_id === parentId)
                const descendantIds = children.map(c => c.id)
                children.forEach(child => {
                    descendantIds.push(...getDescendantIds(child.id))
                })
                return descendantIds
            }
            const validZoneIds = new Set([selectedZoneId, ...getDescendantIds(selectedZoneId)])
            result = result.filter(p => p.zone_id && validZoneIds.has(p.zone_id))
        }

        return result
    }, [positions, selectedZoneId, searchTerm, zones, lotInfo, startDate, endDate, dateFilterField])

    // Filter zones to pass to grid based on selection
    const filteredZones = useMemo(() => {
        if (!selectedZoneId) return zones

        // Helper to find all descendants
        const getDescendantIds = (parentId: string): Set<string> => {
            const ids = new Set<string>()
            const collect = (pId: string) => {
                const children = zones.filter(z => z.parent_id === pId)
                children.forEach(c => {
                    ids.add(c.id)
                    collect(c.id)
                })
            }
            collect(parentId)
            return ids
        }

        const allowedIds = getDescendantIds(selectedZoneId)
        allowedIds.add(selectedZoneId)

        return zones.filter(z => allowedIds.has(z.id))
    }, [zones, selectedZoneId])

    return {
        selectedZoneId, setSelectedZoneId,
        searchTerm, setSearchTerm,
        dateFilterField, setDateFilterField,
        startDate, setStartDate,
        endDate, setEndDate,
        filteredPositions,
        filteredZones
    }
}
