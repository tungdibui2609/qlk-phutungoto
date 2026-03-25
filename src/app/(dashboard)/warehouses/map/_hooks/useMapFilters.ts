import { useState, useMemo } from 'react'
import { matchDateRange } from '@/lib/dateUtils'
import { DateFilterField } from '@/components/warehouse/DateRangeFilter'
import { PositionWithZone } from './useWarehouseData'
import { matchSearch, advancedMatchSearch } from '@/lib/searchUtils'
import { groupWarehouseData } from '@/lib/warehouseUtils'

interface UseMapFiltersProps {
    positions: PositionWithZone[]
    zones: any[] // Should be Zone type
    lotInfo: Record<string, any>
    isFifoEnabled?: boolean
}

export type SearchMode = 'all' | 'name' | 'code' | 'tag' | 'position' | 'category' | 'production'

export function useMapFilters({ positions, zones, lotInfo, isFifoEnabled }: UseMapFiltersProps) {
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [searchMode, setSearchMode] = useState<SearchMode>('all')

    // Date Filters
    const [dateFilterField, setDateFilterField] = useState<DateFilterField>('created_at')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // FIFO Toggle (local, defaults to ON when module is enabled)
    const [fifoActive, setFifoActive] = useState(true)
    const isFifoActive = !!isFifoEnabled && fifoActive

    // Filter positions by all filters
    const filteredPositions = useMemo(() => {
        let result = positions

        // Filter by search term
        // Supports:
        //   - Space: multiple position codes (OR) e.g. "K1D1A01T301 K1D1B02T401"
        //   - Semicolon (;): multiple product/SKU queries (OR) e.g. "xoài;chanh"
        //   - Ampersand (&): product + tag condition (AND) e.g. "xoài&keo vàng"
        if (searchTerm) {
            const trimmed = searchTerm.trim()
            if (trimmed) {
                const getSearchableVals = (p: PositionWithZone, mode: SearchMode) => {
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    const res: string[] = []

                    // Luôn cho phép tìm mã vị trí
                    if (mode === 'all' || mode === 'position') res.push(p.code)

                    if (lot) {
                        // Lot code
                        if (mode === 'all' || mode === 'code') {
                            if (lot.code) res.push(lot.code)
                        }

                        // Items data (Already contains product name, sku, internal codes, categories)
                        lot.items?.forEach((it: any) => {
                            if (mode === 'all' || mode === 'name') {
                                if (it.product_name) res.push(it.product_name)
                                if (it.internal_name) res.push(it.internal_name)
                            }
                            if (mode === 'all' || mode === 'code') {
                                if (it.sku) res.push(it.sku)
                                if (it.internal_code) res.push(it.internal_code)
                            }
                            if (mode === 'all' || mode === 'category') {
                                it.categoryNames?.forEach((cn: string) => res.push(cn))
                            }
                        })

                        // Tags
                        if (mode === 'all' || mode === 'tag') {
                            lot.tags?.forEach((t: string) => res.push(t))
                            // Fallback to lot_tags if tags array is empty but raw lot_tags exist
                            if (!lot.tags?.length && lot.lot_tags) {
                                lot.lot_tags.forEach((t: any) => res.push(t.tag))
                            }
                        }

                        // Production Order
                        if (mode === 'all' || mode === 'production') {
                            if (lot.productions?.code) res.push(lot.productions.code)
                            if (lot.productions?.name) res.push(lot.productions.name)
                        }

                        // Other fields
                        if (mode === 'all') {
                            if (lot.supplier_name) res.push(lot.supplier_name)
                            if (lot.qc_name) res.push(lot.qc_name)
                            if (lot.notes) res.push(lot.notes)
                            if (lot.warehouse_name) res.push(lot.warehouse_name)
                        }
                    }
                    return res
                }

                result = result.filter(p => {
                    const searchableVals = getSearchableVals(p, searchMode)
                    return advancedMatchSearch(searchableVals, searchTerm)
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
            const { virtualToRealMap } = groupWarehouseData(zones, positions)
            
            // Helper to resolve any ID (virtual or real) to a set of REAL zone IDs
            const resolveRealIds = (id: string): string[] => {
                const mapped = virtualToRealMap?.get(id)
                return mapped ? mapped : [id]
            }

            const baseRealIds = resolveRealIds(selectedZoneId)
            
            // Get all descendant zone IDs for each resolved real ID
            const getDescendantIds = (parentId: string): string[] => {
                const children = zones.filter(z => z.parent_id === parentId)
                const descendantIds = children.map(c => c.id)
                children.forEach(child => {
                    descendantIds.push(...getDescendantIds(child.id))
                })
                return descendantIds
            }

            const allRealIds = new Set<string>()
            baseRealIds.forEach(id => {
                allRealIds.add(id)
                getDescendantIds(id).forEach(dId => allRealIds.add(dId))
            })

            result = result.filter(p => p.zone_id && allRealIds.has(p.zone_id))
        }

        // FIFO Sorting: When active and searching, sort by inbound_date ascending (oldest first)
        if (isFifoActive && searchTerm) {
            result = [...result].sort((a, b) => {
                const lotA = a.lot_id ? lotInfo[a.lot_id] : null
                const lotB = b.lot_id ? lotInfo[b.lot_id] : null

                // Positions without lots go to the end
                if (!lotA && !lotB) return 0
                if (!lotA) return 1
                if (!lotB) return -1

                const dateA = lotA.inbound_date || lotA.created_at || ''
                const dateB = lotB.inbound_date || lotB.created_at || ''

                return dateA.localeCompare(dateB) // ascending = oldest first
            })
        }

        return result
    }, [positions, selectedZoneId, searchTerm, searchMode, zones, lotInfo, startDate, endDate, dateFilterField, isFifoActive])

    const filteredZones = useMemo(() => {
        if (!selectedZoneId) return zones

        const { virtualToRealMap } = groupWarehouseData(zones, positions)
        const baseRealIds = virtualToRealMap?.get(selectedZoneId) || [selectedZoneId]

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

        const allowedIds = new Set<string>()
        baseRealIds.forEach(rid => {
            allowedIds.add(rid)
            const descendants = getDescendantIds(rid)
            descendants.forEach(d => allowedIds.add(d))
        })

        // IMPORTANT: In Map view, if we filtered by a virtual zone, 
        // we might still need to include the "Path" to that zone so it's not orphaned.
        // However, for pure filtering of content, this is enough.
        return zones.filter(z => allowedIds.has(z.id))
    }, [zones, positions, selectedZoneId])

    return {
        selectedZoneId, setSelectedZoneId,
        searchTerm, setSearchTerm,
        searchMode, setSearchMode,
        dateFilterField, setDateFilterField,
        startDate, setStartDate,
        endDate, setEndDate,
        filteredPositions,
        filteredZones,
        // FIFO
        isFifoAvailable: !!isFifoEnabled,
        isFifoActive,
        toggleFifo: () => setFifoActive(prev => !prev)
    }
}
