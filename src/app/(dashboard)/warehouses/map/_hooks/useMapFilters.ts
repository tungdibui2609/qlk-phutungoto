import { useState, useMemo } from 'react'
import { matchDateRange } from '@/lib/dateUtils'
import { DateFilterField } from '@/components/warehouse/DateRangeFilter'
import { PositionWithZone } from './useWarehouseData'
import { matchSearch, advancedMatchSearch } from '@/lib/searchUtils'
import { groupWarehouseData } from '@/lib/warehouseUtils'
import { decodeSTT } from '@/lib/numberUtils'
import { decodeStampBox, matchBoxDeepCriteria, parseDateToComparable } from '@/lib/stampDecoder'

interface UseMapFiltersProps {
    positions: PositionWithZone[]
    zones: any[] // Should be Zone type
    lotInfo: Record<string, any>
    isFifoEnabled?: boolean
    pendingExportPosIds?: Set<string>
    onlyShowMarked?: boolean
    markedPositionIds?: Set<string>
    markedNotes?: Record<string, string>
}

export type SearchMode = 'all' | 'name' | 'code' | 'stamp' | 'tag' | 'position' | 'category' | 'production' | 'stt' | 'box_count'
export type DeepDateField = 'packaging_date' | 'peeling_date' | 'raw_material_date' | 'inbound_date'

export function useMapFilters({ positions, zones, lotInfo, isFifoEnabled, pendingExportPosIds, onlyShowMarked, markedPositionIds, markedNotes }: UseMapFiltersProps) {
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [searchMode, setSearchMode] = useState<SearchMode>('all')

    // Date Filters (Chế độ Cơ bản)
    const [dateFilterField, setDateFilterField] = useState<DateFilterField>('created_at')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // Deep Scan States (Chế độ Tìm kiếm Chuyên sâu OCR / Tem)
    const [isDeepScanMode, setIsDeepScanMode] = useState(false)
    const [deepScanTerm, setDeepScanTerm] = useState('')
    const [deepDateField, setDeepDateField] = useState<DeepDateField>('packaging_date')
    const [deepStartDate, setDeepStartDate] = useState('')
    const [deepEndDate, setDeepEndDate] = useState('')
    const [deepRegion, setDeepRegion] = useState('all')
    const [deepFactory, setDeepFactory] = useState('all')
    const [deepGrade, setDeepGrade] = useState('all')
    const [deepVariety, setDeepVariety] = useState('all')
    const [deepPackageSpec, setDeepPackageSpec] = useState('all')

    const resetDeepScanFilters = () => {
        setSearchTerm('')
        setDeepScanTerm('')
        setDeepDateField('packaging_date')
        setDeepStartDate('')
        setDeepEndDate('')
        setDeepRegion('all')
        setDeepFactory('all')
        setDeepGrade('all')
        setDeepVariety('all')
        setDeepPackageSpec('all')
    }

    // Hide Export Pending
    const [hidePendingExport, setHidePendingExport] = useState(false)

    // FIFO Toggle (local, defaults to ON when module is enabled)
    const [fifoActive, setFifoActive] = useState(true)
    const isFifoActive = !!isFifoEnabled && fifoActive

    // Filter positions by all filters
    const filteredPositions = useMemo(() => {
        let result = positions

        // Filter by category
        if (selectedCategoryId && selectedCategoryId !== 'all') {
            result = result.filter(p => {
                if (!p.lot_id) return false
                const lot = lotInfo[p.lot_id]
                if (!lot || !lot.items) return false
                return lot.items.some((it: any) =>
                    it.primary_category_id === selectedCategoryId ||
                    (it.category_ids && it.category_ids.includes(selectedCategoryId))
                )
            })
        }

        // Filter by marked positions
        if (onlyShowMarked) {
            result = result.filter(p => {
                if (!markedPositionIds || markedPositionIds.size === 0) return false
                if (markedPositionIds.has(p.id)) return true
                const realIds = (p as any).realIds
                return realIds && Array.isArray(realIds) && realIds.some((id: string) => markedPositionIds.has(id))
            })
        }

        // ==========================================
        // 1. TÌM KIẾM THEO TỪ KHÓA (SEARCH TERM)
        // Áp dụng chung cho cả chế độ Thường và Chuyên sâu
        // ==========================================
        if (searchTerm) {
            const trimmed = searchTerm.trim()
            if (trimmed) {
                let finalSearchTerm = trimmed
                if (!trimmed.includes(';') && !trimmed.includes(',') && !trimmed.includes('&')) {
                    if (searchMode === 'position') {
                        finalSearchTerm = trimmed.split(/\s+/).join(';')
                    } else if (searchMode === 'all') {
                        const words = trimmed.split(/\s+/)
                        const isAllCodes = words.every(w => /^[A-Z0-9\-_]{4,}$/i.test(w))
                        if (isAllCodes && words.length > 1) {
                            finalSearchTerm = words.join(';')
                        }
                    }
                }

                const getSearchableVals = (p: PositionWithZone, mode: SearchMode) => {
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    const res: string[] = []

                    if (mode === 'all' || mode === 'position') res.push(p.code)

                    if (lot) {
                        if (mode === 'all' || mode === 'code') {
                            if (lot.code) res.push(lot.code)
                        }

                        lot.items?.forEach((it: any) => {
                            if (mode === 'all' || mode === 'name') {
                                if (it.product_name) res.push(it.product_name)
                                if (it.internal_name) res.push(it.internal_name)
                                if (it.aliases) res.push(it.aliases)
                            }
                            if (mode === 'all' || mode === 'code') {
                                if (it.sku) res.push(it.sku)
                                if (it.internal_code) res.push(it.internal_code)
                                if (it.aliases) res.push(it.aliases)
                            }
                            if (mode === 'all' || mode === 'category') {
                                it.categoryNames?.forEach((cn: string) => res.push(cn))
                            }
                        })

                        if (mode === 'all' || mode === 'tag') {
                            lot.tags?.forEach((t: string) => res.push(t))
                            if (!lot.tags?.length && lot.lot_tags) {
                                lot.lot_tags.forEach((t: any) => res.push(t.tag))
                            }
                        }

                        if (mode === 'all' || mode === 'production') {
                            if (lot.production_code) res.push(lot.production_code)
                            if (lot.productions?.code) res.push(lot.productions.code)
                            if (lot.productions?.name) res.push(lot.productions.name)
                            lot.production_lot_codes?.forEach((code: string) => res.push(code))
                            
                            if (mode === 'production') {
                                lot.items?.forEach((it: any) => {
                                    if (it.product_name) res.push(it.product_name)
                                    if (it.sku) res.push(it.sku)
                                    if (it.internal_code) res.push(it.internal_code)
                                    if (it.aliases) res.push(it.aliases)
                                })
                            }
                        }

                        if (mode === 'all' || mode === 'stt') {
                            if (lot.daily_seq) {
                                res.push(String(lot.daily_seq))
                                const decodedStt = decodeSTT(lot.daily_seq)
                                if (decodedStt) {
                                    res.push(decodedStt)
                                    res.push(`STT: ${decodedStt}`)
                                    res.push(`STT ${decodedStt}`)
                                    res.push(`#${decodedStt}`)
                                }
                            }
                        }

                        if (lot.box_labels && lot.box_labels.length > 0) {
                            if (mode === 'all' || mode === 'box_count') {
                                res.push(String(lot.box_labels.length))
                            }
                            lot.box_labels.forEach((label: any) => {
                                if (mode === 'all' || mode === 'code' || mode === 'production') {
                                    if (label.semi_finished_lot_code) res.push(label.semi_finished_lot_code)
                                    if (label.finished_lot_code) res.push(label.finished_lot_code)
                                    if (label.code) res.push(label.code)
                                }
                                if (mode === 'all' || mode === 'stt') {
                                    if (label.code) res.push(label.code)
                                }
                                if (mode === 'all' || mode === 'stamp') {
                                    if (label.code) res.push(label.code)
                                    if (label.semi_finished_lot_code) res.push(label.semi_finished_lot_code)
                                    if (label.finished_lot_code) res.push(label.finished_lot_code)
                                    const meta = label.metadata || {}
                                    if (meta.stamp_line1) res.push(meta.stamp_line1)
                                    if (meta.stamp_line2) res.push(meta.stamp_line2)
                                    if (meta.pallet_stt) res.push(meta.pallet_stt)
                                    if (meta.product_name) res.push(meta.product_name)
                                }
                                // Bổ sung toàn bộ từ khóa giải mã tem OCR để tìm kiếm siêu nhạy
                                if (mode === 'all' || mode === 'stamp') {
                                    const decoded = decodeStampBox(label)
                                    res.push(...decoded.searchableTokens)
                                } else if (mode === 'name') {
                                    const decoded = decodeStampBox(label)
                                    if (decoded.productTitle) res.push(decoded.productTitle)
                                    if (decoded.varietyName) res.push(decoded.varietyName)
                                    if (decoded.productGradeName) res.push(decoded.productGradeName)
                                }
                            })
                        } else if (mode === 'all' || mode === 'box_count') {
                            res.push('0')
                        }

                        if (mode === 'all') {
                            if (lot.supplier_name) res.push(lot.supplier_name)
                            if (lot.qc_name) res.push(lot.qc_name)
                            if (lot.notes) res.push(lot.notes)
                            if (lot.warehouse_name) res.push(lot.warehouse_name)
                        }
                    }

                    if (mode === 'all' && markedNotes) {
                        const markNote = markedNotes[p.id] || ((p as any).realIds && (p as any).realIds.map((id: string) => markedNotes[id]).filter(Boolean).join(' '))
                        if (markNote) res.push(markNote)
                    }

                    return res
                }

                result = result.filter(p => {
                    const searchableVals = getSearchableVals(p, searchMode)
                    return advancedMatchSearch(searchableVals, finalSearchTerm)
                })
            }
        }

        // ==========================================
        // 2. BỘ LỌC CHUYÊN SÂU (DEEP SCAN FILTERS)
        // Kết hợp cùng từ khóa tìm kiếm khi bật Chuyên Sâu OCR
        // ==========================================
        if (isDeepScanMode) {
            const hasDeepFilters = !!(
                deepStartDate || deepEndDate ||
                (deepRegion && deepRegion !== 'all') ||
                (deepFactory && deepFactory !== 'all') ||
                (deepGrade && deepGrade !== 'all') ||
                (deepVariety && deepVariety !== 'all') ||
                (deepPackageSpec && deepPackageSpec !== 'all')
            )

            if (hasDeepFilters) {
                const criteria = {
                    dateField: deepDateField,
                    startDate: deepStartDate,
                    endDate: deepEndDate,
                    region: deepRegion,
                    factory: deepFactory,
                    grade: deepGrade,
                    variety: deepVariety,
                    packageSpec: deepPackageSpec
                }

                result = result.filter(p => {
                    if (!p.lot_id) return false
                    const lot = lotInfo[p.lot_id]
                    if (!lot) return false
                    const boxes = lot.box_labels || []

                    // Nếu Lô có thùng quét OCR: đối soát chính xác theo từng thùng
                    if (boxes.length > 0) {
                        return boxes.some((b: any) => matchBoxDeepCriteria(decodeStampBox(b), criteria))
                    }

                    // Nếu đang lọc theo thuộc tính dập mực con dấu (phẩm cấp, giống, quy cách): chỉ chấp nhận thùng đã quét OCR
                    if (deepGrade !== 'all' || deepVariety !== 'all' || deepPackageSpec !== 'all') {
                        return false
                    }

                    // Nếu chỉ lọc theo ngày hoặc vùng miền/nhà máy: đối soát cấp Lot
                    const dummyBox = {
                        code: lot.code,
                        metadata: {
                            packaging_date: lot.packaging_date,
                            peeling_date: lot.peeling_date,
                            raw_material_date: lot.raw_material_date,
                            inbound_date: lot.inbound_date,
                            shift_group: lot.warehouse_name,
                            region: lot.supplier_name
                        }
                    }
                    return matchBoxDeepCriteria(decodeStampBox(dummyBox), criteria)
                })
            }
        } else {
            // Lọc ngày ở chế độ cơ bản
            if (startDate || endDate) {
                result = result.filter(p => {
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    if (!lot) return false
                    return matchDateRange(lot[dateFilterField], startDate, endDate)
                })
            }
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

        // Filter out pending export positions if toggle is on
        if (hidePendingExport && pendingExportPosIds) {
            result = result.filter(p => !pendingExportPosIds.has(p.id))
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
    }, [
        positions, selectedZoneId, selectedCategoryId, searchTerm, searchMode, zones, lotInfo, 
        startDate, endDate, dateFilterField, isFifoActive, hidePendingExport, pendingExportPosIds, 
        onlyShowMarked, markedPositionIds, markedNotes,
        isDeepScanMode, deepScanTerm, deepDateField, deepStartDate, deepEndDate, 
        deepRegion, deepFactory, deepGrade, deepVariety, deepPackageSpec
    ])

    // Số lượng bộ lọc chuyên sâu đang kích hoạt
    const deepScanActiveCount = useMemo(() => {
        let count = 0
        const activeTerm = searchTerm || deepScanTerm
        if (activeTerm.trim()) count++
        if (deepStartDate || deepEndDate) count++
        if (deepRegion !== 'all') count++
        if (deepFactory !== 'all') count++
        if (deepGrade !== 'all') count++
        if (deepVariety !== 'all') count++
        if (deepPackageSpec !== 'all') count++
        return count
    }, [searchTerm, deepScanTerm, deepStartDate, deepEndDate, deepRegion, deepFactory, deepGrade, deepVariety, deepPackageSpec])

    // Tổng số lượng thùng khớp trong các vị trí tìm được khi ở chế độ chuyên sâu
    const deepScanMatchingBoxesCount = useMemo(() => {
        if (!isDeepScanMode) return 0
        let count = 0
        const criteria = {
            term: (searchMode === 'stamp' ? (searchTerm || deepScanTerm) : deepScanTerm),
            dateField: deepDateField,
            startDate: deepStartDate,
            endDate: deepEndDate,
            region: deepRegion,
            factory: deepFactory,
            grade: deepGrade,
            variety: deepVariety,
            packageSpec: deepPackageSpec
        }

        filteredPositions.forEach(p => {
            if (!p.lot_id) return
            const lot = lotInfo[p.lot_id]
            if (!lot) return
            const boxes = lot.box_labels || []
            if (boxes.length > 0) {
                const matchingBoxes = boxes.filter((b: any) => matchBoxDeepCriteria(decodeStampBox(b), criteria))
                count += matchingBoxes.length
            }
        })
        return count
    }, [filteredPositions, isDeepScanMode, lotInfo, searchTerm, searchMode, deepScanTerm, deepDateField, deepStartDate, deepEndDate, deepRegion, deepFactory, deepGrade, deepVariety, deepPackageSpec])

    const filteredZones = useMemo(() => {
        // If onlyShowMarked is active, filter zones containing marked positions
        if (onlyShowMarked) {
            if (!markedPositionIds || markedPositionIds.size === 0) return []
            const markedZoneIds = new Set<string>()
            positions.forEach(p => {
                const isMarked = markedPositionIds.has(p.id) || ((p as any).realIds && (p as any).realIds.some((id: string) => markedPositionIds.has(id)))
                if (isMarked && p.zone_id) {
                    markedZoneIds.add(p.zone_id)
                }
            })

            const idsWithAncestors = new Set<string>(markedZoneIds)
            const findAncestors = (childId: string) => {
                const zone = zones.find(z => z.id === childId)
                if (zone && zone.parent_id) {
                    if (!idsWithAncestors.has(zone.parent_id)) {
                        idsWithAncestors.add(zone.parent_id)
                        findAncestors(zone.parent_id)
                    }
                }
            }
            markedZoneIds.forEach(id => findAncestors(id))
            return zones.filter(z => idsWithAncestors.has(z.id))
        }

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

        // IMPORTANT: In Map view, we MUST include original ancestors 
        // for the hierarchy-based grouping logic (groupWarehouseData) to work.
        // It needs to see containers like "Dãy", "Sảnh" to trigger merging.
        const idsWithAncestors = new Set<string>(allowedIds)
        
        const findAncestors = (childId: string) => {
            const zone = zones.find(z => z.id === childId)
            if (zone && zone.parent_id) {
                if (!idsWithAncestors.has(zone.parent_id)) {
                    idsWithAncestors.add(zone.parent_id)
                    findAncestors(zone.parent_id)
                }
            }
        }

        allowedIds.forEach(id => findAncestors(id))

        return zones.filter(z => idsWithAncestors.has(z.id))
    }, [zones, positions, selectedZoneId, onlyShowMarked, markedPositionIds])

    return {
        selectedZoneId, setSelectedZoneId,
        selectedCategoryId, setSelectedCategoryId,
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
        toggleFifo: () => setFifoActive(prev => !prev),
        // Export Filter
        hidePendingExport,
        setHidePendingExport,
        // Deep Scan (Tìm kiếm chuyên sâu OCR / Tem con dấu)
        isDeepScanMode,
        setIsDeepScanMode,
        toggleDeepScanMode: () => setIsDeepScanMode(prev => !prev),
        deepScanTerm,
        setDeepScanTerm,
        deepDateField,
        setDeepDateField,
        deepStartDate,
        setDeepStartDate,
        deepEndDate,
        setDeepEndDate,
        deepRegion,
        setDeepRegion,
        deepFactory,
        setDeepFactory,
        deepGrade,
        setDeepGrade,
        deepVariety,
        setDeepVariety,
        deepPackageSpec,
        setDeepPackageSpec,
        resetDeepScanFilters,
        deepScanActiveCount,
        deepScanMatchingBoxesCount
    }
}
