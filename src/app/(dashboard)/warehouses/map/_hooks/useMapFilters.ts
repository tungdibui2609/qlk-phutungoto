import { useState, useMemo } from 'react'
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
            const term = searchTerm.toLowerCase().trim()
            if (term) {
                result = result.filter(p => {
                    // 1. Position Code Match
                    if (p.code.toLowerCase().includes(term)) return true

                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    if (!lot) return false

                    // 2. Targeted Lot Fields Search
                    // Lot Code
                    if (lot.code && lot.code.toLowerCase().includes(term)) return true

                    // Supplier & QC
                    if (lot.supplier_name && lot.supplier_name.toLowerCase().includes(term)) return true
                    if (lot.qc_name && lot.qc_name.toLowerCase().includes(term)) return true

                    // Items (Products, SKUs, Tags)
                    if (lot.items && Array.isArray(lot.items)) {
                        for (const item of lot.items) {
                            if (item.product_name && item.product_name.toLowerCase().includes(term)) return true
                            if (item.sku && item.sku.toLowerCase().includes(term)) return true
                            if (item.tags && Array.isArray(item.tags)) {
                                if (item.tags.some((t: string) => t.toLowerCase().includes(term))) return true
                            }
                        }
                    }

                    // Fallback for single product structure if items array missing/empty
                    if (lot.products) {
                        if (lot.products.name && lot.products.name.toLowerCase().includes(term)) return true
                        if (lot.products.sku && lot.products.sku.toLowerCase().includes(term)) return true
                    }

                    return false
                })
            }
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
