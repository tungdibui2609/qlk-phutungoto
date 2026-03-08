import { useState, useMemo } from 'react'
import { matchDateRange } from '@/lib/dateUtils'
import { DateFilterField } from '@/components/warehouse/DateRangeFilter'
import { PositionWithZone } from './useWarehouseData'

interface UseMapFiltersProps {
    positions: PositionWithZone[]
    zones: any[] // Should be Zone type
    lotInfo: Record<string, any>
    isFifoEnabled?: boolean
}

export function useMapFilters({ positions, zones, lotInfo, isFifoEnabled }: UseMapFiltersProps) {
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

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
                    if (p.code.toLowerCase().includes(term)) return true
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    if (!lot) return false
                    if (lot.code && lot.code.toLowerCase().includes(term)) return true
                    if (lot.supplier_name && lot.supplier_name.toLowerCase().includes(term)) return true
                    if (lot.qc_name && lot.qc_name.toLowerCase().includes(term)) return true
                    if (lot.items && Array.isArray(lot.items)) {
                        for (const item of lot.items) {
                            if (item.product_name && item.product_name.toLowerCase().includes(term)) return true
                            if (item.internal_name && item.internal_name.toLowerCase().includes(term)) return true
                            if (item.sku && item.sku.toLowerCase().includes(term)) return true
                            if (item.internal_code && item.internal_code.toLowerCase().includes(term)) return true
                            if (item.tags && Array.isArray(item.tags)) {
                                if (item.tags.some((t: string) => t.toLowerCase().includes(term))) return true
                            }
                        }
                    }
                    if (lot.products) {
                        if (lot.products.name && lot.products.name.toLowerCase().includes(term)) return true
                        if (lot.products.internal_name && lot.products.internal_name.toLowerCase().includes(term)) return true
                        if (lot.products.sku && lot.products.sku.toLowerCase().includes(term)) return true
                        if (lot.products.internal_code && lot.products.internal_code.toLowerCase().includes(term)) return true
                    }
                    return false
                }

                // Helper: match only product-related fields (name, SKU, internal code, lot code, position code)
                const matchesProduct = (p: PositionWithZone, term: string): boolean => {
                    if (p.code.toLowerCase().includes(term)) return true
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    if (!lot) return false
                    if (lot.code && lot.code.toLowerCase().includes(term)) return true
                    if (lot.supplier_name && lot.supplier_name.toLowerCase().includes(term)) return true
                    if (lot.qc_name && lot.qc_name.toLowerCase().includes(term)) return true
                    if (lot.items && Array.isArray(lot.items)) {
                        for (const item of lot.items) {
                            if (item.product_name && item.product_name.toLowerCase().includes(term)) return true
                            if (item.internal_name && item.internal_name.toLowerCase().includes(term)) return true
                            if (item.sku && item.sku.toLowerCase().includes(term)) return true
                            if (item.internal_code && item.internal_code.toLowerCase().includes(term)) return true
                        }
                    }
                    if (lot.products) {
                        if (lot.products.name && lot.products.name.toLowerCase().includes(term)) return true
                        if (lot.products.internal_name && lot.products.internal_name.toLowerCase().includes(term)) return true
                        if (lot.products.sku && lot.products.sku.toLowerCase().includes(term)) return true
                        if (lot.products.internal_code && lot.products.internal_code.toLowerCase().includes(term)) return true
                    }
                    return false
                }

                // Helper: match only tags (mã phụ)
                const matchesTag = (p: PositionWithZone, term: string): boolean => {
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    if (!lot) return false
                    if (lot.tags && Array.isArray(lot.tags)) {
                        if (lot.tags.some((t: string) => t.toLowerCase().includes(term))) return true
                    }
                    if (lot.items && Array.isArray(lot.items)) {
                        for (const item of lot.items) {
                            if (item.tags && Array.isArray(item.tags)) {
                                if (item.tags.some((t: string) => t.toLowerCase().includes(term))) return true
                            }
                        }
                    }
                    return false
                }

                // Determine search mode based on separators present
                const hasSemicolon = trimmed.includes(';')
                const hasAmpersand = trimmed.includes('&')

                if (hasSemicolon || hasAmpersand) {
                    // Advanced mode: split by ";" for OR groups
                    const queries = trimmed.split(';').map(q => q.trim()).filter(Boolean)

                    result = result.filter(p => {
                        return queries.some(query => {
                            // Check for "&" (AND: product & tag)
                            if (query.includes('&')) {
                                const parts = query.split('&').map(s => s.trim().toLowerCase())
                                const productTerm = parts[0]
                                const tagTerm = parts.slice(1).join('&')
                                if (!productTerm && !tagTerm) return false
                                const productMatch = productTerm ? matchesProduct(p, productTerm) : true
                                const tagMatch = tagTerm ? matchesTag(p, tagTerm) : true
                                return productMatch && tagMatch
                            }
                            // Plain term (no &), match everything
                            const term = query.toLowerCase()
                            return matchesAll(p, term)
                        })
                    })
                } else {
                    // Simple mode: space-separated terms (OR for position codes)
                    const rawTerms = trimmed.toLowerCase().split(/\s+/).filter(Boolean)
                    result = result.filter(p => rawTerms.some(term => matchesAll(p, term)))
                }
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
    }, [positions, selectedZoneId, searchTerm, zones, lotInfo, startDate, endDate, dateFilterField, isFifoActive])

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
        filteredZones,
        // FIFO
        isFifoAvailable: !!isFifoEnabled,
        isFifoActive,
        toggleFifo: () => setFifoActive(prev => !prev)
    }
}
