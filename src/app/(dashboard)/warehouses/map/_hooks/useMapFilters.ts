import { useState, useMemo } from 'react'
import { matchDateRange } from '@/lib/dateUtils'
import { DateFilterField } from '@/components/warehouse/DateRangeFilter'
import { PositionWithZone } from './useWarehouseData'
import { matchSearch, advancedMatchSearch, normalizeSearchString } from '@/lib/searchUtils'
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
    const [selectedUnit, setSelectedUnit] = useState<string | null>(null)
    const [selectedTag, setSelectedTag] = useState<string | null>(null)
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

    // Lọc loại trừ mã phụ (tag) - Chỉ hiển thị hàng chuẩn không có mã phụ
    const [excludeTags, setExcludeTags] = useState(false)

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

        // Filter by Unit (Đơn vị tính)
        if (selectedUnit && selectedUnit !== 'all') {
            const normTargetUnit = normalizeSearchString(selectedUnit, true)
            result = result.filter(p => {
                if (!p.lot_id) return false
                const lot = lotInfo[p.lot_id]
                if (!lot) return false
                const items = lot.items || []
                if (items.length > 0) {
                    return items.some((it: any) => {
                        const u = (it.unit || lot.products?.unit || '').trim()
                        if (!u) return false
                        return normalizeSearchString(u, true) === normTargetUnit
                    })
                }
                if (lot.products?.unit) {
                    return normalizeSearchString(lot.products.unit, true) === normTargetUnit
                }
                return false
            })
        }

        // Filter by Secondary Tag (Mã phụ liên quan)
        if (selectedTag && selectedTag !== 'all') {
            const normTargetTag = normalizeSearchString(selectedTag, true)
            result = result.filter(p => {
                if (!p.lot_id) return false
                const lot = lotInfo[p.lot_id]
                if (!lot) return false
                const allLotTags: string[] = [
                    ...(lot.tags || []),
                    ...((lot.items || []).flatMap((it: any) => it.tags || [])),
                    ...((lot.lot_tags || []).map((t: any) => typeof t === 'string' ? t : t.tag))
                ].filter((t: string) => t && !t.startsWith('MERGED_') && !t.startsWith('SPLIT_'))
                return allLotTags.some(t => normalizeSearchString(t, true) === normTargetTag)
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
        // Nhận diện cú pháp gõ !tag / -tag / notag / kotag trực tiếp trong ô tìm kiếm
        const hasNoTagSyntax = /\b(!tag|-tag|notag|kotag|khongtag)\b/i.test(searchTerm)
        const isExcludeTagsActive = excludeTags || hasNoTagSyntax

        // Lọc loại trừ mã phụ nếu bật nút hoặc gõ cú pháp
        if (isExcludeTagsActive) {
            result = result.filter(p => {
                if (!p.lot_id) return true
                const lot = lotInfo[p.lot_id]
                if (!lot) return true
                const lotTags = (lot.tags || []).filter((t: string) => 
                    t && !t.startsWith('MERGED_') && !t.startsWith('SPLIT_') && !t.startsWith('MERGED_TO:') && !t.startsWith('SPLIT_TO:')
                )
                const lotItemTags = (lot.items || []).flatMap((it: any) => it.tags || []).filter((t: string) => 
                    t && !t.startsWith('MERGED_') && !t.startsWith('SPLIT_')
                )
                const rawLotTags = (lot.lot_tags || []).map((t: any) => typeof t === 'string' ? t : t.tag).filter((t: string) =>
                    t && !t.startsWith('MERGED_') && !t.startsWith('SPLIT_')
                )
                return lotTags.length === 0 && lotItemTags.length === 0 && rawLotTags.length === 0
            })
        }

        if (searchTerm) {
            const trimmed = searchTerm.replace(/\b(!tag|-tag|notag|kotag|khongtag)\b/gi, '').trim()
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

                        // Nếu đang lọc theo một đơn vị tính hoặc một tag cụ thể, chỉ khớp từ khóa trên item đúng ĐVT/tag đó (tránh khớp nhầm item khác trong pallet hỗn hợp)
                        const normSelectedUnit = selectedUnit && selectedUnit !== 'all' ? normalizeSearchString(selectedUnit, true) : null

                        lot.items?.forEach((it: any) => {
                            if (normSelectedUnit) {
                                const itUnit = normalizeSearchString(it.unit || lot.products?.unit || '', true)
                                if (itUnit !== normSelectedUnit) return
                            }

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
                            if (mode === 'all') {
                                if (it.unit) res.push(it.unit)
                            }
                        })

                        if ((mode === 'all' || mode === 'tag') && !isExcludeTagsActive) {
                            const hasAnyTag = (lot.tags && lot.tags.length > 0) || (lot.lot_tags && lot.lot_tags.length > 0)
                            lot.tags?.forEach((t: string) => res.push(t))
                            if (!lot.tags?.length && lot.lot_tags) {
                                lot.lot_tags.forEach((t: any) => res.push(t.tag))
                            }
                            // Khi chọn chế độ "Mã phụ (tag)" mà người dùng gõ tên sản phẩm / tên gõ tắt / SKU -> cho phép khớp những lô CÓ mã phụ của sản phẩm đó
                            if (mode === 'tag' && hasAnyTag) {
                                lot.items?.forEach((it: any) => {
                                    if (it.product_name) res.push(it.product_name)
                                    if (it.internal_name) res.push(it.internal_name)
                                    if (it.aliases) res.push(it.aliases)
                                    if (it.sku) res.push(it.sku)
                                    if (it.internal_code) res.push(it.internal_code)
                                })
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
                                // CHỈ QUÉT NỘI DUNG DẬP MỰC CON DẤU VÀ GIẢI MÃ TEM OCR KHI BẬT CHẾ ĐỘ 'TÌM CHUYÊN SÂU OCR' HOẶC CHỌN MODE 'stamp'
                                if (isDeepScanMode || mode === 'stamp') {
                                    if (mode === 'all' || mode === 'stamp') {
                                        const meta = label.metadata || {}
                                        if (meta.stamp_line1) res.push(meta.stamp_line1)
                                        if (meta.stamp_line2) res.push(meta.stamp_line2)
                                        if (meta.pallet_stt) res.push(meta.pallet_stt)
                                        if (meta.product_name) res.push(meta.product_name)
                                        const decoded = decodeStampBox(label)
                                        res.push(...decoded.searchableTokens)
                                    } else if (mode === 'name') {
                                        const decoded = decodeStampBox(label)
                                        if (decoded.productTitle) res.push(decoded.productTitle)
                                        if (decoded.varietyName) res.push(decoded.varietyName)
                                        if (decoded.productGradeName) res.push(decoded.productGradeName)
                                    }
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
                            if (lot.staging_area_code) res.push(lot.staging_area_code)
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

        // Helper lọc ngày đối soát cấp Lot: hỗ trợ cả lot[field] và nhiều ngày trong metadata.peeling_dates
        const matchLotDateRange = (lot: any, field: string, start: string, end: string): boolean => {
            if (!lot) return false
            if (!start && !end) return true

            if (field === 'peeling_date') {
                const datesSet = new Set<string>()
                if (lot.peeling_date) {
                    datesSet.add(String(lot.peeling_date))
                }
                const fromMeta = Array.isArray(lot.metadata?.peeling_dates)
                    ? lot.metadata.peeling_dates
                    : (Array.isArray(lot.metadata?.production_dates) ? lot.metadata.production_dates : [])
                fromMeta.forEach((d: any) => {
                    if (d && typeof d === 'string') datesSet.add(d)
                })

                if (datesSet.size === 0) return false
                return Array.from(datesSet).some(d => matchDateRange(d, start, end))
            }

            return matchDateRange(lot[field], start, end)
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

                    // Nếu lọc theo ngày sản xuất: đối soát hỗ trợ nhiều ngày sản xuất của Lot
                    if (criteria.dateField === 'peeling_date' && (criteria.startDate || criteria.endDate)) {
                        return matchLotDateRange(lot, 'peeling_date', criteria.startDate || '', criteria.endDate || '')
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
            // Lọc ngày ở chế độ cơ bản (hỗ trợ nhiều ngày sản xuất)
            if (startDate || endDate) {
                result = result.filter(p => {
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    if (!lot) return false
                    return matchLotDateRange(lot, dateFilterField, startDate, endDate)
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
        positions, selectedZoneId, selectedCategoryId, selectedUnit, selectedTag, searchTerm, searchMode, zones, lotInfo, 
        startDate, endDate, dateFilterField, isFifoActive, hidePendingExport, pendingExportPosIds, 
        onlyShowMarked, markedPositionIds, markedNotes, excludeTags,
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

    // Danh sách Đơn vị tính (ĐVT) và Mã phụ (Tags) khả dụng theo kết quả tìm kiếm hiện tại
    // Tính toán trên tập các vị trí thỏa mãn điều kiện tìm kiếm (trước khi ép cứng selectedUnit hoặc selectedTag) để người dùng thấy tất cả ĐVT / Tag liên quan của sản phẩm đang tìm
    const { availableUnits, availableTags } = useMemo(() => {
        const unitMap = new Map<string, { unit: string; count: number; totalQty: number; positionIds: Set<string> }>()
        const tagMap = new Map<string, { tag: string; count: number; totalQty: number; products: Set<string>; skus: Set<string>; units: Set<string> }>()

        const trimmedSearch = searchTerm.replace(/\b(!tag|-tag|notag|kotag|khongtag)\b/gi, '').trim()

        // Helper kiểm tra 1 item có khớp từ khóa sản phẩm không
        const itemMatchesSearch = (it: any, lot: any) => {
            if (!trimmedSearch) return true
            if (searchMode === 'position' || searchMode === 'stt' || searchMode === 'box_count' || searchMode === 'stamp') {
                return true
            }
            // Nếu đang ở chế độ tag và từ khóa là đúng mã tag -> coi như khớp
            const itemVals = [
                it.product_name,
                it.internal_name,
                it.aliases,
                it.sku,
                it.internal_code,
                ...(it.categoryNames || []),
                ...(it.tags || []),
                ...(lot?.tags || [])
            ].filter(Boolean)
            return advancedMatchSearch(itemVals, trimmedSearch) || matchSearch({
                name: it.product_name,
                internal_name: it.internal_name,
                aliases: it.aliases,
                sku: it.sku,
                internal_code: it.internal_code
            }, trimmedSearch)
        }

        // Duyệt trên toàn bộ positions thỏa mãn các điều kiện cơ bản (ngoài selectedUnit / selectedTag)
        // Để chính xác và nhanh: lấy danh sách vị trí khớp các điều kiện khác
        positions.forEach(p => {
            if (!p.lot_id) return
            const lot = lotInfo[p.lot_id]
            if (!lot) return

            // Kiểm tra category
            if (selectedCategoryId && selectedCategoryId !== 'all') {
                const matchCat = (lot.items || []).some((it: any) =>
                    it.primary_category_id === selectedCategoryId ||
                    (it.category_ids && it.category_ids.includes(selectedCategoryId))
                )
                if (!matchCat) return
            }

            // Kiểm tra marked
            if (onlyShowMarked) {
                if (!markedPositionIds || markedPositionIds.size === 0) return
                const isM = markedPositionIds.has(p.id) || ((p as any).realIds && Array.isArray((p as any).realIds) && (p as any).realIds.some((id: string) => markedPositionIds.has(id)))
                if (!isM) return
            }

            // Kiểm tra pending export
            if (hidePendingExport && pendingExportPosIds && pendingExportPosIds.has(p.id)) {
                return
            }

            // Kiểm tra từ khóa tìm kiếm nếu có
            if (trimmedSearch) {
                const lotSearchVals: string[] = [
                    p.code,
                    lot.code,
                    lot.production_code,
                    lot.productions?.code,
                    lot.productions?.name,
                    ...(lot.production_lot_codes || []),
                    ...(lot.tags || []),
                    ...((lot.lot_tags || []).map((t: any) => typeof t === 'string' ? t : t.tag)),
                    ...((lot.items || []).flatMap((it: any) => [
                        it.product_name,
                        it.internal_name,
                        it.aliases,
                        it.sku,
                        it.internal_code,
                        it.unit,
                        ...(it.categoryNames || []),
                        ...(it.tags || [])
                    ]))
                ].filter(Boolean)

                const isLotMatch = advancedMatchSearch(lotSearchVals, trimmedSearch) ||
                    (lot.items || []).some((it: any) => matchSearch({
                        name: it.product_name,
                        internal_name: it.internal_name,
                        aliases: it.aliases,
                        sku: it.sku,
                        internal_code: it.internal_code
                    }, trimmedSearch))

                if (!isLotMatch) return
            }

            const items = lot.items && lot.items.length > 0 ? lot.items : (lot.products ? [{
                product_name: lot.products.name,
                sku: lot.products.sku,
                internal_code: lot.products.internal_code,
                internal_name: lot.products.internal_name,
                aliases: lot.products.aliases,
                unit: lot.products.unit,
                quantity: lot.quantity || 0,
                tags: lot.tags || []
            }] : [])

            // 1. Gom Đơn vị tính (chỉ gom từ các items khớp với từ khóa tìm kiếm và khớp với selectedTag nếu đang chọn Tag)
            const normTargetTag = selectedTag && selectedTag !== 'all' ? normalizeSearchString(selectedTag, true) : null
            const lotAllTags: string[] = Array.from(new Set([
                ...(lot.tags || []),
                ...((lot.lot_tags || []).map((t: any) => typeof t === 'string' ? t : t.tag))
            ])).filter((t: string) => t && !t.startsWith('MERGED_') && !t.startsWith('SPLIT_'))

            const lotMatchesSelectedTag = !normTargetTag || lotAllTags.some(t => normalizeSearchString(t, true) === normTargetTag)

            if (lotMatchesSelectedTag) {
                items.forEach((it: any) => {
                    if (!itemMatchesSearch(it, lot)) return
                    const rawU = (it.unit || lot.products?.unit || '').trim()
                    if (!rawU) return
                    const uKey = normalizeSearchString(rawU, true)
                    const existing = unitMap.get(uKey)
                    const qty = Number(it.quantity) || 0
                    if (existing) {
                        if (!existing.positionIds.has(p.id)) {
                            existing.positionIds.add(p.id)
                            existing.count++
                        }
                        existing.totalQty += qty
                    } else {
                        unitMap.set(uKey, {
                            unit: rawU,
                            count: 1,
                            totalQty: qty,
                            positionIds: new Set([p.id])
                        })
                    }
                })
            }

            // 2. Gom Mã phụ (Tags) (chỉ gom từ các vị trí khớp với selectedUnit nếu đang chọn ĐVT)
            const normTargetUnit = selectedUnit && selectedUnit !== 'all' ? normalizeSearchString(selectedUnit, true) : null
            const matchingItemsForUnit = items.filter((it: any) => {
                if (!itemMatchesSearch(it, lot)) return false
                if (!normTargetUnit) return true
                const rawU = (it.unit || lot.products?.unit || '').trim()
                return normalizeSearchString(rawU, true) === normTargetUnit
            })

            if (matchingItemsForUnit.length > 0 && lotAllTags.length > 0) {
                const posQty = matchingItemsForUnit.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)
                lotAllTags.forEach(rawTag => {
                    const cleanT = rawTag.trim()
                    if (!cleanT) return
                    const tKey = normalizeSearchString(cleanT, true)
                    const existing = tagMap.get(tKey)
                    if (existing) {
                        existing.count++
                        existing.totalQty += posQty
                        matchingItemsForUnit.forEach((it: any) => {
                            if (it.product_name) existing.products.add(it.product_name)
                            if (it.sku) existing.skus.add(it.sku)
                            if (it.unit) existing.units.add(it.unit)
                        })
                    } else {
                        const prods = new Set<string>()
                        const skus = new Set<string>()
                        const units = new Set<string>()
                        matchingItemsForUnit.forEach((it: any) => {
                            if (it.product_name) prods.add(it.product_name)
                            if (it.sku) skus.add(it.sku)
                            if (it.unit) units.add(it.unit)
                        })
                        tagMap.set(tKey, {
                            tag: cleanT,
                            count: 1,
                            totalQty: posQty,
                            products: prods,
                            skus,
                            units
                        })
                    }
                })
            }
        })

        return {
            availableUnits: Array.from(unitMap.values())
                .map(({ unit, count, totalQty }) => ({ unit, count, totalQty }))
                .sort((a, b) => b.count - a.count),
            availableTags: Array.from(tagMap.values())
                .map(t => ({
                    tag: t.tag,
                    count: t.count,
                    totalQty: t.totalQty,
                    productNames: Array.from(t.products),
                    skus: Array.from(t.skus),
                    units: Array.from(t.units)
                }))
                .sort((a, b) => b.count - a.count)
        }
    }, [positions, lotInfo, searchTerm, searchMode, selectedCategoryId, selectedUnit, selectedTag, onlyShowMarked, markedPositionIds, hidePendingExport, pendingExportPosIds])

    return {
        selectedZoneId, setSelectedZoneId,
        selectedCategoryId, setSelectedCategoryId,
        selectedUnit, setSelectedUnit,
        selectedTag, setSelectedTag,
        availableUnits,
        availableTags,
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
        // Tag Exclusion Filter (Không kèm mã phụ)
        excludeTags,
        setExcludeTags,
        toggleExcludeTags: () => setExcludeTags(prev => !prev),
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
