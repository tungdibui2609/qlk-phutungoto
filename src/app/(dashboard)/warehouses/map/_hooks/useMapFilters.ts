import { useState, useMemo } from 'react'
import { matchDateRange } from '@/lib/dateUtils'
import { DateFilterField } from '@/components/warehouse/DateRangeFilter'
import { PositionWithZone } from './useWarehouseData'
import { matchSearch } from '@/lib/searchUtils'

interface UseMapFiltersProps {
    positions: PositionWithZone[]
    zones: any[] // Should be Zone type
    lotInfo: Record<string, any>
    isFifoEnabled?: boolean
}

export type SearchMode = 'all' | 'name' | 'code' | 'tag' | 'position' | 'category'

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
                // Helper: match position code, lot code, product, supplier, qc, tags (everything)
                const matchesAll = (p: PositionWithZone, term: string): boolean => {
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    const searchPayload = {
                        positionCode: p.code,
                        ...(lot || {})
                    }
                    return matchSearch(searchPayload, term)
                }

                // Helper: match only product-related fields (name, SKU, internal code, lot code, position code)
                const matchesProduct = (p: PositionWithZone, term: string): boolean => {
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    const searchPayload = {
                        positionCode: p.code,
                        lotCode: lot?.code,
                        ...(lot?.products || {}),
                        items: lot?.items?.map((it: any) => ({
                            product_name: it.product_name,
                            sku: it.sku,
                            internal_code: it.internal_code
                        }))
                    }
                    return matchSearch(searchPayload, term)
                }

                // Helper: match only tags (mã phụ)
                const matchesTag = (p: PositionWithZone, term: string): boolean => {
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    if (!lot) return false
                    // Search in lot_tags
                    if (lot.lot_tags && Array.isArray(lot.lot_tags)) {
                        if (lot.lot_tags.some((t: any) => t.tag?.toLowerCase().includes(term))) return true
                    }
                    // Search in items tags if any
                    if (lot.lot_items && Array.isArray(lot.lot_items)) {
                        for (const item of lot.lot_items) {
                            if (item.tags && Array.isArray(item.tags)) {
                                if (item.tags.some((t: string) => t.toLowerCase().includes(term))) return true
                            }
                        }
                    }
                    return false
                }

                // Helper: match only positions
                const matchesPosition = (p: PositionWithZone, term: string): boolean => {
                    return p.code.toLowerCase().includes(term)
                }

                // Helper: match only codes (Lot Code, SKU, etc.)
                const matchesCode = (p: PositionWithZone, term: string): boolean => {
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    if (!lot) return false
                    const lotMatch = lot.code?.toLowerCase().includes(term)
                    const itemMatch = lot.lot_items?.some((it: any) =>
                        it.products?.sku?.toLowerCase().includes(term) ||
                        it.products?.internal_code?.toLowerCase().includes(term)
                    )
                    return !!(lotMatch || itemMatch)
                }

                // Helper: match name
                const matchesName = (p: PositionWithZone, term: string): boolean => {
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    if (!lot) return false
                    return lot.lot_items?.some((it: any) =>
                        it.products?.name?.toLowerCase().includes(term) ||
                        it.products?.internal_name?.toLowerCase().includes(term)
                    )
                }

                // Helper: match category
                const matchesCategory = (p: PositionWithZone, term: string): boolean => {
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    if (!lot) return false
                    
                    // Search in categoryNames using the robust matchSearch utility
                    return lot.items?.some((it: any) => 
                        it.categoryNames?.some((cat: string) => matchSearch(cat, term))
                    )
                }

                // Advanced parser for ALL modes
                const orQueries = trimmed.split(';').map(q => q.trim()).filter(Boolean)

                result = result.filter(p => {
                    // Overall OR condition: any of the semicolon-separated queries must match
                    return orQueries.some(orQuery => {
                        // AND condition: split by "&"
                        const andParts = orQuery.split('&').map(q => q.trim()).filter(Boolean)
                        if (andParts.length === 0) return false

                        // All parts in the "&" group must match
                        return andParts.every(part => {
                            const term = part.toLowerCase()
                            switch (searchMode) {
                                case 'name': return matchesName(p, term)
                                case 'code': return matchesCode(p, term)
                                case 'tag': return matchesTag(p, term)
                                case 'position': return matchesPosition(p, term)
                                case 'category': return matchesCategory(p, part) // matchSearch handles case
                                case 'all':
                                default:
                                    // Special space-separated logic for 'all' mode
                                    if (!part.includes(' ')) return matchesAll(p, term)
                                    const spaceTerms = term.split(/\s+/).filter(Boolean)
                                    return spaceTerms.some(t => matchesAll(p, t))
                            }
                        })
                    })
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
