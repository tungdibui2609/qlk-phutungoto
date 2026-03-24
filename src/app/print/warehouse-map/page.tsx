'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Printer, Download, Search, Check, ChevronDown, ChevronRight, MapPin, X, Settings as SettingsIcon, Layout, Monitor, Layers, Maximize2 } from 'lucide-react'
import { toJpeg } from 'html-to-image'
import { useCaptureReceipt } from '@/hooks/useCaptureReceipt'
import { usePrintCompanyInfo, CompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { PrintHeader } from '@/components/print/PrintHeader'
import { EditableText } from '@/components/print/PrintHelpers'
import FlexibleZoneGrid from '@/components/warehouse/FlexibleZoneGrid'
import { Database } from '@/lib/database.types'
import { groupWarehouseData, parsePositionCodeFallback, sortPositionsByBinPriority } from '@/lib/warehouseUtils'
import { exportWarehouseToExcel, exportWarehouseGridToExcel, exportWarehouseLobbyDetailToExcel, ExportWarehouseLobbyData } from '@/lib/warehouseExcelExport'
import { FileSpreadsheet } from 'lucide-react'
import { useUnitConversion } from '@/hooks/useUnitConversion'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

export default function WarehouseMapPrintPage() {
    const searchParams = useSearchParams()

    // Filters from URL
    const systemType = searchParams.get('systemType') || ''
    const selectedZoneId = searchParams.get('zoneId') || ''
    const searchTerm = searchParams.get('search') || ''
    const token = searchParams.get('token')
    const isSnapshot = searchParams.get('snapshot') === '1'
    const displayInternalCode = searchParams.get('internalCode') === 'true'

    // Company info params (for image generation service)
    const cmpName = searchParams.get('cmp_name')
    const cmpAddress = searchParams.get('cmp_address')
    const cmpPhone = searchParams.get('cmp_phone')
    const cmpEmail = searchParams.get('cmp_email')
    const cmpLogo = searchParams.get('cmp_logo')
    const cmpShort = searchParams.get('cmp_short')

    const initialCompanyInfo = cmpName ? {
        name: cmpName,
        address: cmpAddress,
        phone: cmpPhone,
        email: cmpEmail,
        logo_url: cmpLogo,
        short_name: cmpShort,
    } as CompanyInfo : null

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Data states
    const [positions, setPositions] = useState<PositionWithZone[]>([])
    const [zones, setZones] = useState<Zone[]>([])
    const [layouts, setLayouts] = useState<Record<string, ZoneLayout>>({})
    const [lotInfo, setLotInfo] = useState<Record<string, any>>({})
    const [occupiedIds, setOccupiedIds] = useState<Set<string>>(new Set())

    const { toBaseAmount, getBaseToKgRate, unitNameMap, conversionMap } = useUnitConversion()

    // Editable Titles
    const [editReportTitle, setEditReportTitle] = useState('SƠ ĐỒ BỐ TRÍ KHO')
    const [signTitle1, setSignTitle1] = useState('Người Lập Biểu')
    const [signTitle2, setSignTitle2] = useState('Thủ Kho')
    const [signTitle3, setSignTitle3] = useState('Giám Đốc')
    const [signPerson1, setSignPerson1] = useState('')
    const [signPerson2, setSignPerson2] = useState('')
    const [signPerson3, setSignPerson3] = useState('')
    const [showTable, setShowTable] = useState(false)
    const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'occupied' | 'empty'>('all')
    const [isZonePickerOpen, setIsZonePickerOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [zoneSearchTerm, setZoneSearchTerm] = useState('')
    const [expandedZoneIds, setExpandedZoneIds] = useState<Set<string>>(new Set())
    const [isGrouped, setIsGrouped] = useState(true)
    const [mergedZones, setMergedZones] = useState<Set<string>>(new Set())
    const [isEmptyMap, setIsEmptyMap] = useState(false)

    const toggleMergeZone = (zoneId: string) => {
        setMergedZones(prev => {
            const next = new Set(prev)
            if (next.has(zoneId)) next.delete(zoneId)
            else next.add(zoneId)
            return next
        })
    }

    const [pageBreakZoneIds, setPageBreakZoneIds] = useState<Set<string>>(new Set())

    const [isDownloading, setIsDownloading] = useState(false)
    const { isCapturing, downloadTimer, handleCapture } = useCaptureReceipt({
        fileNamePrefix: `so-do-kho-${new Date().toISOString().split('T')[0]}`
    })
    const isSnapshotMode = isSnapshot || isCapturing
    const isDownloadingState = isDownloading || isCapturing
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>((searchParams.get('orientation') as any) || 'landscape')

    const router = useRouter()
    const pathname = usePathname()

    const handleOrientationChange = (o: 'portrait' | 'landscape') => {
        setOrientation(o)
        const params = new URLSearchParams(searchParams.toString())
        params.set('orientation', o)
        router.replace(`${pathname}?${params.toString()}`)
    }

    const handleTogglePageBreak = (zoneId: string) => {
        setPageBreakZoneIds(prev => {
            const next = new Set(prev)
            if (next.has(zoneId)) next.delete(zoneId)
            else next.add(zoneId)
            return next
        })
    }

    const handleZoneChange = (zoneId: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (zoneId) params.set('zoneId', zoneId)
        else params.delete('zoneId')
        router.push(`${pathname}?${params.toString()}`)
    }

    // Use shared hook for company info
    const { companyInfo, logoSrc } = usePrintCompanyInfo({
        token,
        initialCompanyInfo,
        fallbackToProfile: !initialCompanyInfo
    })

    useEffect(() => {
        const pageBreaks = searchParams.get('pageBreaks')
        if (pageBreaks) {
            setPageBreakZoneIds(new Set(pageBreaks.split(',')))
        }
    }, [searchParams])

    useEffect(() => {
        fetchData()
    }, [systemType])

    async function fetchData() {
        if (!systemType) {
            setError("Thiếu tham số hệ thống (systemType)")
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            if (token) {
                await supabase.auth.setSession({ access_token: token, refresh_token: '' })
            }

            // Fetch generic limit-aware helper
            const fetchAll = async (table: string, filter?: (query: any) => any, select = '*', limit = 1000) => {
                let allRecs: any[] = []
                let from = 0
                while (true) {
                    let query = supabase.from(table as any).select(select).range(from, from + limit - 1)
                    if (filter) query = filter(query)
                    const { data, error } = await query
                    if (error) throw error
                    if (!data || data.length === 0) break
                    allRecs = [...allRecs, ...data]
                    if (data.length < limit) break
                    from += limit
                }

                // Deduplicate based on table
                if (['positions', 'zones', 'zone_layouts', 'lots'].includes(table)) {
                    const uniqueMap = new Map()
                    for (const item of allRecs) {
                        if (item.id) uniqueMap.set(item.id, item)
                    }
                    return Array.from(uniqueMap.values())
                } else if (table === 'zone_positions') {
                    const uniqueMap = new Map()
                    for (const item of allRecs) {
                        uniqueMap.set(`${item.zone_id}-${item.position_id}`, item)
                    }
                    return Array.from(uniqueMap.values())
                }

                return allRecs
            }

            // Fetch data similarly to Map Page
            const [posData, zoneData, zpData, layoutData, lotsData] = await Promise.all([
                fetchAll('positions', q => q.eq('system_type', systemType).order('code', { numeric: true }).order('id')),
                fetchAll('zones', q => q.eq('system_type', systemType).order('level').order('display_order').order('code').order('id')),
                fetchAll('zone_positions', q => q.select('zone_id, position_id, positions!inner(system_type)').eq('positions.system_type', systemType).order('zone_id', { ascending: true }).order('position_id', { ascending: true })),
                fetchAll('zone_layouts', q => q.order('id')),
                fetchAll('lots', q => q.order('id'), '*, suppliers(name), qc_info(name), products(name, unit, sku, internal_code, internal_name, weight_kg), lot_items(id, product_id, quantity, unit, products(name, unit, sku, internal_code, internal_name, weight_kg, product_units(unit_id, conversion_rate))), lot_tags(tag, lot_item_id)')
            ])

            // Process structure
            const zpLookup: Record<string, string> = {}
            zpData.forEach((zp: any) => {
                if (zp.position_id && zp.zone_id) zpLookup[zp.position_id] = zp.zone_id
            })

            const posWithZone: PositionWithZone[] = (posData as any[]).map(pos => ({
                ...pos, zone_id: zpLookup[pos.id] || null
            }))

            const layoutsMap: Record<string, ZoneLayout> = {}
            layoutData.forEach((l: any) => { if (l.zone_id) layoutsMap[l.zone_id] = l })

            const lotInfoMap: Record<string, any> = {}
            const occupied = new Set<string>();

            (lotsData as any[]).forEach((l: any) => {
                const lotItems = l.lot_items || []
                const allTags = l.lot_tags || []
                let items: any[] = []
                let accumulatedTags: string[] = []

                if (lotItems.length > 0) {
                    items = lotItems.map((item: any) => {
                        const itemTags = allTags
                            .filter((t: any) => t.lot_item_id === item.id)
                            .map((t: any) => t.tag.replace(/@/g, item.products?.sku || ''))
                            .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
                        accumulatedTags.push(...itemTags)
                        return {
                            id: item.id,
                            product_id: item.product_id,
                            product_name: item.products?.name,
                            sku: item.products?.sku,
                            internal_code: item.products?.internal_code,
                            internal_name: item.products?.internal_name,
                            unit: item.unit || item.products?.unit,
                            base_unit: item.products?.unit,
                            quantity: item.quantity,
                            tags: itemTags
                        }
                    })
                } else if (l.products) {
                    const itemTags = allTags
                        .map((t: any) => t.tag.replace(/@/g, l.products?.sku || ''))
                        .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
                    accumulatedTags.push(...itemTags)
                    items = [{
                        product_id: l.product_id,
                        product_name: l.products.name,
                        sku: l.products.sku,
                        internal_code: l.products.internal_code,
                        internal_name: l.products.internal_name,
                        unit: l.products.unit,
                        base_unit: l.products.unit,
                        quantity: l.quantity,
                        tags: itemTags
                    }]
                }

                lotInfoMap[l.id] = {
                    ...l,
                    items,
                    tags: accumulatedTags,
                    qc_name: l.qc_info?.name,
                    supplier_name: l.suppliers?.name
                }
            })

            posWithZone.forEach(pos => {
                if (pos.lot_id && lotInfoMap[pos.lot_id]) {
                    const totalQty = lotInfoMap[pos.lot_id].items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0)
                    if (totalQty > 0) occupied.add(pos.id)
                }
            })

            setPositions(posWithZone)
            setZones(zoneData)
            setLayouts(layoutsMap)
            setLotInfo(lotInfoMap)
            setOccupiedIds(occupied)

        } catch (e: any) {
            console.error(e)
            setError(e.message || String(e))
        } finally {
            setLoading(false)
        }
    }

    // Recursive Grouping Logic
    const groupedData = useMemo(() => {
        if (!isGrouped) return { zones, positions }
        return groupWarehouseData(zones, positions)
    }, [isGrouped, zones, positions])

    const displayZones = groupedData.zones
    const displayPositions = groupedData.positions

    // Auto-merge eligible zones on load
    useEffect(() => {
        if (loading || displayZones.length === 0) return
        
        // Only run this once when data is first loaded or when system/zone changes
        const autoMerged = new Set<string>()
        displayZones.forEach((z: any) => {
            const level = z.level || 0
            const isLevelUnderBin = level >= 10
            const isBigBin = z.type === 'big-bin'
            if ((isLevelUnderBin || isBigBin) && (z.positions?.length > 1 || (z.totalPositions || 0) > 1)) {
                autoMerged.add(z.id)
            }
        })
        setMergedZones(autoMerged)
    }, [loading, systemType, selectedZoneId, displayZones.length]) // Use displayZones.length as a proxy for data readiness

    // Helper for O(1) zone filtering
    const descendantIdSet = useMemo(() => {
        if (!selectedZoneId) return null
        const parentToChildren = new Map<string, string[]>()
        displayZones.forEach(z => {
            if (z.parent_id) {
                const children = parentToChildren.get(z.parent_id) || []
                children.push(z.id)
                parentToChildren.set(z.parent_id, children)
            }
        })

        const ids = new Set<string>()
        const collect = (id: string) => {
            ids.add(id)
            const children = parentToChildren.get(id) || []
            children.forEach(collect)
        }
        collect(selectedZoneId)
        return ids
    }, [displayZones, selectedZoneId])

    const filteredPositions = useMemo(() => {
        let result = displayPositions

        if (descendantIdSet) {
            result = result.filter(p => p.zone_id && descendantIdSet.has(p.zone_id))
        }

        if (occupancyFilter === 'occupied') {
            result = result.filter(p => occupiedIds.has(p.id))
        } else if (occupancyFilter === 'empty') {
            result = result.filter(p => !occupiedIds.has(p.id))
        }

        if (searchTerm) {
            const lowTerm = searchTerm.toLowerCase().trim()
            result = result.filter(p => {
                const pLot = lotInfo[p.id] || (p.lot_id ? lotInfo[p.lot_id] : {})
                return p.code.toLowerCase().includes(lowTerm) ||
                    (pLot.items || []).some((item: any) =>
                        item.product_name?.toLowerCase().includes(lowTerm) ||
                        item.sku?.toLowerCase().includes(lowTerm)
                    ) ||
                    pLot.code?.toLowerCase().includes(lowTerm)
            })
        }

        // --- Hierarchical Sorting for Table View ---
        // 1. Build a DFS order map for zones to ensure parental hierarchy (Dãy -> Ô -> Tầng)
        const zoneOrderMap = new Map<string, number>()
        const parentToChildren = new Map<string, any[]>()
        displayZones.forEach(z => {
            if (z.parent_id) {
                const list = parentToChildren.get(z.parent_id) || []
                list.push(z)
                parentToChildren.set(z.parent_id, list)
            }
        })

        let orderIdx = 0
        const visited = new Set<string>()
        const walk = (z: any) => {
            if (visited.has(z.id)) return
            visited.add(z.id)
            zoneOrderMap.set(z.id, orderIdx++)
            const children = (parentToChildren.get(z.id) || [])
                .sort((a, b) => {
                    const nameA = (a.code || a.name || '').toUpperCase()
                    const nameB = (b.code || b.name || '').toUpperCase()
                    const numA = parseInt(nameA.match(/\d+/)?.[0] || '0', 10)
                    const numB = parseInt(nameB.match(/\d+/)?.[0] || '0', 10)
                    if (numA !== numB) return numA - numB
                    const isSanhA = nameA.includes('SẢNH') || nameA.includes('SÀNH')
                    const isSanhB = nameB.includes('SẢNH') || nameB.includes('SÀNH')
                    if (isSanhA !== isSanhB) return isSanhA ? 1 : -1
                    return nameA.localeCompare(nameB, undefined, { numeric: true })
                })
            children.forEach(walk)
        }

        const roots = displayZones.filter(z => !z.parent_id || !displayZones.find(pz => pz.id === z.parent_id))
            .sort((a, b) => {
                const nameA = (a.code || a.name || '').toUpperCase()
                const nameB = (b.code || b.name || '').toUpperCase()
                const numA = parseInt(nameA.match(/\d+/)?.[0] || '0', 10)
                const numB = parseInt(nameB.match(/\d+/)?.[0] || '0', 10)
                if (numA !== numB) return numA - numB
                const isSanhA = nameA.includes('SẢNH') || nameA.includes('SÀNH')
                const isSanhB = nameB.includes('SẢNH') || nameB.includes('SÀNH')
                if (isSanhA !== isSanhB) return isSanhA ? 1 : -1
                return nameA.localeCompare(nameB, undefined, { numeric: true })
            })
        roots.forEach(walk)

        // 2. Sort positions based on the DFS zone index
        return [...result].sort((a, b) => {
            const zoneIdxA = a.zone_id ? (zoneOrderMap.get(a.zone_id) ?? 99999) : 99999
            const zoneIdxB = b.zone_id ? (zoneOrderMap.get(b.zone_id) ?? 99999) : 99999

            if (zoneIdxA !== zoneIdxB) return zoneIdxA - zoneIdxB
            
            // Use centralized Bin-priority sorting
            const sorted = sortPositionsByBinPriority([a, b])
            return sorted[0] === a ? -1 : 1
        })
    }, [displayPositions, descendantIdSet, occupancyFilter, searchTerm, occupiedIds, lotInfo, displayZones])

    const filteredZones = useMemo(() => {
        if (!descendantIdSet) return displayZones
        return displayZones.filter(z => descendantIdSet.has(z.id))
    }, [displayZones, descendantIdSet])

    const handlePrint = () => window.print()

    const handleDownload = () => handleCapture(orientation === 'landscape', `so-do-kho-${new Date().toISOString().split('T')[0]}.jpg`)

    const getZonePath = (zoneId: string, zoneMap: Record<string, Zone>) => {
        const path: Zone[] = []
        let currentId = zoneId
        while (currentId) {
            const z = zoneMap[currentId]
            if (!z) break
            path.unshift(z) // Add to beginning to get Root -> Child
            currentId = z.parent_id || ''
        }
        return path
    }

    const handleExportExcelTable = async () => {
        const zoneMap = Object.fromEntries(zones.map(z => [z.id, z]))

        const excelPositions = filteredPositions.flatMap(p => {
            const lot = p.lot_id ? lotInfo[p.lot_id] : null
            const path = p.zone_id ? getZonePath(p.zone_id, zoneMap) : []
            const parsed = parsePositionCodeFallback(p.code)
            
            const warehouse = path[0]?.name || parsed?.warehouse || '-'
            const row = path[1]?.name || parsed?.row || '-'
            const bin = path[2]?.name || parsed?.bin || '-'
            const level = path[3]?.name || (path.length > 4 ? path[path.length - 1].name : (parsed?.level || '-'))

            if (!lot) {
                return [{
                    code: p.code,
                    warehouse,
                    row,
                    bin,
                    level,
                    subPosition: parsed?.subPosition,
                    notes: ''
                }]
            }
            return lot.items.map((item: any) => {
                const baseQty = toBaseAmount(item.product_id, item.unit, item.quantity, item.base_unit)
                const kgRate = getBaseToKgRate(item.product_id, item.base_unit)
                const kgQuantity = kgRate !== null ? baseQty * kgRate : null

                return {
                    code: p.code,
                    warehouse,
                    row,
                    bin,
                    level,
                    subPosition: parsed?.subPosition,
                    lotCode: lot.code,
                    productName: displayInternalCode && item.internal_name ? item.internal_name : item.product_name,
                    sku: displayInternalCode && item.internal_code ? item.internal_code : item.sku,
                    unit: item.unit,
                    quantity: item.quantity,
                    kgQuantity,
                    tags: [item.tags?.join(', '), lot.batch_code ? `Lô: ${lot.batch_code}` : null]
                        .filter(Boolean)
                        .join(' | ') || '-',
                    notes: lot.notes || ''
                }
            })
        })

        await exportWarehouseToExcel({
            systemName: systemType || 'KHO',
            zoneName: displayZones.find(z => z.id === selectedZoneId)?.name,
            searchTerm: searchTerm,
            positions: excelPositions
        })
    }

    const handleExportExcelGrid = async () => {
        const grids: any[] = []

        // Find root containers in the current filtered view (e.g., Row/Dãy)
        // Improved: Identify specific containers like Dãy/Sảnh as roots to avoid top-level "KHO" zones
        const containerRegex = /D[ÃãYy]|S[ẢảÀà]nh|K[Ệệ]|KHU|S[Àà]NH|CH[Ũũ]|PH[Òò]NG/i;
        const potentialRoots = filteredZones.filter(z => containerRegex.test(z.name) || z.name.toUpperCase().includes('DÃY'));
        
        const roots = potentialRoots.length > 0
            ? potentialRoots.filter(z => !potentialRoots.find(pz => pz.id === z.parent_id))
            : filteredZones.filter(z => !z.parent_id || !filteredZones.find(pz => pz.id === z.parent_id));

        const getTopParentName = (zone: any): string => {
            let current = zone;
            let depth = 0;
            while (current.parent_id && depth < 10) {
                const parent = filteredZones.find(pz => pz.id === current.parent_id);
                if (!parent) break;
                current = parent;
                depth++;
            }
            return current.name;
        }

        roots.forEach(root => {
            const parentName = getTopParentName(root);
            // Find all bins under this root
            const bins = filteredZones.filter(z => z.parent_id === root.id)
            
            if (bins.length === 0) {
                // Case: Zone without Bins (e.g. Sảnh, Khu vực đệm...)
                const items: any[] = []
                const collect = (zoneId: string) => {
                    const pos = filteredPositions.filter(p => p.zone_id === zoneId)
                    pos.forEach(p => {
                        const lot = p.lot_id ? lotInfo[p.lot_id] : null
                        if (lot?.items) {
                            lot.items.forEach((it: any) => {
                                items.push({
                                    productName: displayInternalCode && it.internal_name ? it.internal_name : it.product_name,
                                    sku: displayInternalCode && it.internal_code ? it.internal_code : it.sku,
                                    unit: it.unit,
                                    quantity: it.quantity,
                                    lotCode: lot.code,
                                    batchCode: lot.batch_code,
                                    lotTags: it.tags
                                })
                            })
                        }
                    })
                    filteredZones.filter(z => z.parent_id === zoneId).forEach(child => collect(child.id))
                }
                collect(root.id)

                if (items.length > 0 || /S[ẢảÀà]nh/i.test(root.name)) {
                    grids.push({
                        name: root.name,
                        parentName,
                        bins: [],
                        levels: [],
                        cells: [{ binIndex: 0, levelIndex: 0, items }]
                    })
                }
                return
            }

            // Sort Bins numerically/alphabetically
            bins.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
            const binNames = bins.map(b => b.name)

            // Identify all unique Level names in these bins
            const levelNamesSet = new Set<string>()
            bins.forEach(bin => {
                const subZones = filteredZones.filter(z => z.parent_id === bin.id)
                if (subZones.length > 0) {
                    subZones.forEach(lvl => levelNamesSet.add(lvl.name))
                } else {
                    // Fallback: If no child zones, check for direct positions in this bin
                    if (filteredPositions.some(p => p.zone_id === bin.id)) {
                        levelNamesSet.add('DỮ LIỆU')
                    }
                }
            })
            
            // Sort Levels ascending (Tầng 1 first)
            const sortedLevels = Array.from(levelNamesSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

            const cells: any[] = []
            bins.forEach((bin, binIdx) => {
                const isBinMerged = mergedZones.has(bin.id)
                
                if (isBinMerged && sortedLevels.length > 0) {
                    // Optimized: One big cell for all levels in this bin
                    const aggregated = new Map<string, { productName: string, sku: string, unit: string, quantity: number }>()
                    
                    const collect = (zoneId: string) => {
                        const pos = filteredPositions.filter(p => p.zone_id === zoneId)
                        pos.forEach(p => {
                            const lot = p.lot_id ? lotInfo[p.lot_id] : null
                            if (lot?.items) {
                                lot.items.forEach((it: any) => {
                                    const key = `${it.sku || it.product_id}_${it.unit}`
                                    const existing = aggregated.get(key)
                                    if (existing) {
                                        existing.quantity += (Number(it.quantity) || 0)
                                    } else {
                                        aggregated.set(key, {
                                            productName: displayInternalCode && it.internal_name ? it.internal_name : it.product_name,
                                            sku: displayInternalCode && it.internal_code ? it.internal_code : it.sku,
                                            unit: it.unit,
                                            quantity: Number(it.quantity) || 0
                                        })
                                    }
                                })
                            }
                        })
                        filteredZones.filter(z => z.parent_id === zoneId).forEach(child => collect(child.id))
                    }
                    collect(bin.id)

                    cells.push({
                        binIndex: binIdx,
                        levelIndex: 0,
                        items: Array.from(aggregated.values()),
                        isMerged: true,
                        rowSpan: sortedLevels.length
                    })
                } else {
                    // Individual cells for each level
                    sortedLevels.forEach((lvlName, lvlIdx) => {
                        const levelZone = filteredZones.find(z => z.parent_id === bin.id && z.name === lvlName)
                        const aggregated = new Map<string, { productName: string, sku: string, unit: string, quantity: number }>()
                        
                        const targetZoneId = levelZone ? levelZone.id : (lvlName === 'DỮ LIỆU' ? bin.id : null)
                        if (targetZoneId) {
                            const pos = filteredPositions.filter(p => p.zone_id === targetZoneId)
                            pos.forEach(p => {
                                const lot = p.lot_id ? lotInfo[p.lot_id] : null
                                if (lot?.items) {
                                    lot.items.forEach((it: any) => {
                                        const key = `${it.sku || it.product_id}_${it.unit}`
                                        const existing = aggregated.get(key)
                                        if (existing) {
                                            existing.quantity += (Number(it.quantity) || 0)
                                        } else {
                                            aggregated.set(key, {
                                                productName: displayInternalCode && it.internal_name ? it.internal_name : it.product_name,
                                                sku: displayInternalCode && it.internal_code ? it.internal_code : it.sku,
                                                unit: it.unit,
                                                quantity: Number(it.quantity) || 0
                                            })
                                        }
                                    })
                                }
                            })
                        }
                        
                        cells.push({
                            binIndex: binIdx,
                            levelIndex: lvlIdx,
                            items: Array.from(aggregated.values())
                        })
                    })
                }
            })

            grids.push({
                name: root.name,
                parentName,
                bins: binNames,
                levels: sortedLevels,
                cells
            })
        })

        if (grids.length > 0) {
            await exportWarehouseGridToExcel({
                systemName: systemType || 'KHO',
                grids
            })
        }
    }

    const handleExportExcelLobbyDetail = async () => {
        const sanhRegex = /S[ẢảÀà]nh|S[Àà]NH|Lobby/i;
        const lobbies = filteredZones.filter(z => sanhRegex.test(z.name));
        
        if (lobbies.length === 0) {
            alert("Không tìm thấy sảnh nào trong khu vực hiện tại.");
            return;
        }

        const lobbyData: ExportWarehouseLobbyData['lobbies'] = lobbies.map(lobby => {
            const layout = layouts[lobby.id];
            const columns = layout?.position_columns || 8;
            
            // Tìm tên khu vực (zone cha)
            const parentZone = filteredZones.find(z => z.id === lobby.parent_id);
            const parentName = parentZone ? parentZone.name : undefined;

            // Get all positions in this lobby
            const lobbyPositions = filteredPositions.filter(p => p.zone_id === lobby.id);
            // Sort them if needed, here we use sortPositionsByBinPriority for consistency
            const sortedPos = sortPositionsByBinPriority(lobbyPositions);
            
            const excelPositions = sortedPos.map((p, idx) => {
                const lot = p.lot_id ? lotInfo[p.lot_id] : null;
                const items = lot?.items?.map((it: any) => ({
                    productName: displayInternalCode && it.internal_name ? it.internal_name : it.product_name,
                    sku: displayInternalCode && it.internal_code ? it.internal_code : it.sku,
                    unit: it.unit,
                    quantity: it.quantity,
                    lotCode: lot.code,
                    batchCode: lot.batch_code,
                    lotTags: it.tags
                })) || [];

                return {
                    x: idx % columns,
                    y: Math.floor(idx / columns),
                    code: p.code,
                    items
                };
            });

            return {
                name: lobby.name,
                parentName,
                columns,
                positions: excelPositions
            };
        });

        await exportWarehouseLobbyDetailToExcel({
            systemName: systemType || 'KHO',
            lobbies: lobbyData
        });
    }

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin mr-2" /> Đang tải dữ liệu...</div>
    if (error) return <div className="flex h-screen items-center justify-center text-red-600 font-bold">Lỗi: {error}</div>

    return (
        <>
            {/* Toolbar */}
            <div className={`fixed top-4 right-4 z-50 print:hidden flex gap-3 items-center ${isSnapshotMode ? 'hidden' : ''}`}>
                {/* Unified Settings Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={`flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-xl border transition-all cursor-pointer hover:bg-gray-50 group ${isSettingsOpen ? 'border-indigo-500 ring-2 ring-indigo-50' : 'border-gray-200'}`}
                    >
                        <SettingsIcon size={18} className={`text-gray-600 group-hover:text-indigo-600 transition-transform ${isSettingsOpen ? 'rotate-90' : ''}`} />
                        <span className="text-sm font-semibold text-gray-700">Cấu hình in</span>
                        <ChevronDown size={14} className="text-gray-400" />
                    </button>

                    {isSettingsOpen && (
                        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col p-4 gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* 1. Zone Selection */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold uppercase text-gray-400 flex items-center gap-2">
                                    <MapPin size={12} /> Khu vực in
                                </label>
                                <div className="relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsZonePickerOpen(!isZonePickerOpen);
                                        }}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-sm text-gray-700 cursor-pointer"
                                    >
                                        <span className="truncate flex-1 text-left">
                                            {displayZones.find(z => z.id === selectedZoneId)?.name || 'Tất cả Zone'}
                                        </span>
                                    </button>
                                    <div id="receipt-content" className={`bg-white text-gray-900 mx-auto transition-all duration-300 mt-4 p-4`}></div>

                                    {isZonePickerOpen && (
                                        <div className="absolute right-full mr-2 top-0 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[400px] z-[60]">
                                            <div className="p-2 border-b bg-gray-50/50">
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                                                    <input
                                                        type="text"
                                                        placeholder="Tìm zone..."
                                                        value={zoneSearchTerm}
                                                        onChange={(e) => setZoneSearchTerm(e.target.value)}
                                                        className="w-full pl-8 pr-2 py-1.5 bg-white border border-gray-200 rounded text-xs outline-none"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                            <div className="overflow-y-auto p-1 custom-scrollbar">
                                                {(() => {
                                                    const baseZones = selectedZoneId && !zoneSearchTerm
                                                        ? displayZones.filter(z => z.id === selectedZoneId)
                                                        : displayZones.filter(z => !z.parent_id);

                                                    const toggleExpand = (e: React.MouseEvent, id: string) => {
                                                        e.stopPropagation()
                                                        const newSet = new Set(expandedZoneIds)
                                                        if (newSet.has(id)) newSet.delete(id)
                                                        else newSet.add(id)
                                                        setExpandedZoneIds(newSet)
                                                    }

                                                    // Use pre-computed map for O(1) child lookups
                                                    const childrenMap = new Map<string, Zone[]>()
                                                    displayZones.forEach(z => {
                                                        if (z.parent_id) {
                                                            const list = childrenMap.get(z.parent_id) || []
                                                            list.push(z)
                                                            childrenMap.set(z.parent_id, list)
                                                        }
                                                    })

                                                    const renderTree = (z: Zone, depth: number): React.ReactNode[] => {
                                                        const subZones = childrenMap.get(z.id) || []
                                                        const hasChildren = subZones.length > 0
                                                        const isExpanded = expandedZoneIds.has(z.id) || zoneSearchTerm

                                                        const matchesSearch = !zoneSearchTerm || z.name.toLowerCase().includes(zoneSearchTerm.toLowerCase())

                                                        // Optimization: O(1) check if any descendant matches the search
                                                        let descendantMatch = false
                                                        if (zoneSearchTerm && !matchesSearch && hasChildren) {
                                                            const checkDescendants = (nodeId: string): boolean => {
                                                                const children = childrenMap.get(nodeId) || []
                                                                for (const child of children) {
                                                                    if (child.name.toLowerCase().includes(zoneSearchTerm.toLowerCase())) return true
                                                                    if (checkDescendants(child.id)) return true
                                                                }
                                                                return false
                                                            }
                                                            descendantMatch = checkDescendants(z.id)
                                                        }

                                                        if (!matchesSearch && !descendantMatch) return []

                                                        return [
                                                            <div key={z.id}>
                                                                <button
                                                                    onClick={() => {
                                                                        handleZoneChange(z.id)
                                                                        setIsZonePickerOpen(false)
                                                                        setZoneSearchTerm('')
                                                                    }}
                                                                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs hover:bg-blue-50 group ${selectedZoneId === z.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700'}`}
                                                                >
                                                                    <div className="shrink-0" style={{ width: depth * 12 }} />
                                                                    {hasChildren ? (
                                                                        <div onClick={(e) => toggleExpand(e, z.id)} className="p-0.5 hover:bg-gray-200 rounded text-gray-400">
                                                                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                                        </div>
                                                                    ) : <div className="w-[18px]" />}
                                                                    <span className="truncate flex-1 text-left">{z.name}</span>
                                                                    {selectedZoneId === z.id && <Check size={12} />}
                                                                </button>
                                                                {isExpanded && subZones.flatMap(c => renderTree(c, depth + 1))}
                                                            </div>
                                                        ]
                                                    }
                                                    return baseZones.flatMap(root => renderTree(root, 0))
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 2. Occupancy Filter */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold uppercase text-gray-400 flex items-center gap-2">
                                    <Layers size={12} /> Lọc trạng thái
                                </label>
                                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg">
                                    {(['all', 'occupied', 'empty'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setOccupancyFilter(f)}
                                            className={`py-1.5 text-[11px] font-medium rounded-md transition-all cursor-pointer ${occupancyFilter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            {f === 'all' ? 'Tất cả' : f === 'occupied' ? 'Có hàng' : 'Trống'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 3. Orientation & View Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold uppercase text-gray-400 flex items-center gap-2">
                                        <Monitor size={12} /> Khổ giấy
                                    </label>
                                    <div className="flex bg-gray-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => handleOrientationChange('portrait')}
                                            className={`flex-1 py-1.5 text-[11px] font-medium rounded-md cursor-pointer ${orientation === 'portrait' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Dọc
                                        </button>
                                        <button
                                            onClick={() => handleOrientationChange('landscape')}
                                            className={`flex-1 py-1.5 text-[11px] font-medium rounded-md cursor-pointer ${orientation === 'landscape' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Ngang
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold uppercase text-gray-400 flex items-center gap-2">
                                        <Layout size={12} /> Hiển thị
                                    </label>
                                    <div className="flex bg-gray-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => setShowTable(false)}
                                            className={`flex-1 py-1.5 text-[11px] font-medium rounded-md cursor-pointer ${!showTable ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Sơ đồ
                                        </button>
                                        <button
                                            onClick={() => setShowTable(true)}
                                            className={`flex-1 py-1.5 text-[11px] font-medium rounded-md cursor-pointer ${showTable ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Bảng
                                        </button>
                                    </div>
                                    {!showTable && (
                                        <label className="flex items-center gap-3 cursor-pointer group mt-1">
                                            <div className="relative inline-flex items-center">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={isEmptyMap}
                                                    onChange={(e) => setIsEmptyMap(e.target.checked)}
                                                />
                                                <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                                            </div>
                                            <span className="text-[11px] font-medium text-gray-700 group-hover:text-blue-600 transition-colors">In sơ đồ trống (ô nhỏ)</span>
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* 4. Grouping Toggle */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold uppercase text-gray-400 flex items-center gap-2">
                                    <Layers size={12} /> Chế độ gom ô
                                </label>
                                <button
                                    onClick={() => setIsGrouped(!isGrouped)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer ${isGrouped ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                                >
                                    <span className="text-xs font-semibold">{isGrouped ? 'Đang bật Gom ô' : 'Đang tắt Gom ô'}</span>
                                    <div className={`w-8 h-4 rounded-full relative transition-colors ${isGrouped ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isGrouped ? 'left-4.5' : 'left-0.5'}`} />
                                    </div>
                                </button>
                                <p className="text-[10px] text-gray-400 italic">Gộp các ô có chung hậu tố số (A01, B01 {"->"} Ô 01) để thu gọn sơ đồ.</p>
                            </div>

                            {/* 5. Merging Toggle */}
                            {isGrouped && (
                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold uppercase text-gray-400 flex items-center gap-2">
                                        <Maximize2 size={12} /> Chế độ gộp ô
                                    </label>
                                    <button
                                        onClick={() => {
                                            const { zones: displayZones } = groupWarehouseData(filteredZones, filteredPositions)
                                            const mergeableZoneIds = displayZones
                                                .filter(z => {
                                                    const nameUpper = z.name.toUpperCase()
                                                    const isSanh = nameUpper.startsWith('SẢNH') || nameUpper.startsWith('SÀNH') || nameUpper.startsWith('SANH')
                                                    return z.id.startsWith('v-lvl-') || z.id.startsWith('v-bin-') || z.name.startsWith('Ô ') || z.name.toUpperCase().startsWith('TẦNG ') || isSanh
                                                })
                                                .map(z => z.id)
                                            
                                            const allMerged = mergeableZoneIds.length > 0 && mergeableZoneIds.every(id => mergedZones.has(id))
                                            
                                            if (allMerged) {
                                                setMergedZones(new Set())
                                            } else {
                                                setMergedZones(prev => {
                                                    const next = new Set(prev)
                                                    mergeableZoneIds.forEach(id => next.add(id))
                                                    return next
                                                })
                                            }
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer ${mergedZones.size > 0 ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                                    >
                                        <span className="text-xs font-semibold">{mergedZones.size > 0 ? 'Đang bật Gộp ô' : 'Đang tắt Gộp ô'}</span>
                                        <div className={`w-8 h-4 rounded-full relative transition-colors ${mergedZones.size > 0 ? 'bg-purple-600' : 'bg-gray-300'}`}>
                                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${mergedZones.size > 0 ? 'left-4.5' : 'left-0.5'}`} />
                                        </div>
                                    </button>
                                    <p className="text-[10px] text-gray-400 italic">Gộp tất cả các tầng trong một ô thành một khối duy nhất (hàng cồng kềnh).</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex bg-white rounded-lg shadow-xl border border-gray-200 p-1 gap-1 flex-wrap">
                    <button
                        onClick={handleDownload}
                        className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-bold flex items-center gap-2 hover:bg-green-700 transition-colors cursor-pointer shadow-sm"
                        disabled={isCapturing}
                    >
                        {isCapturing ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                        Tải ảnh phiếu
                    </button>
                    
                    <button
                        onClick={handleExportExcelTable}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm"
                        disabled={isCapturing}
                    >
                        <FileSpreadsheet size={16} />
                        Excel (Bảng)
                    </button>

                    <button
                        onClick={handleExportExcelGrid}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm"
                        disabled={isCapturing}
                    >
                        <Layout size={16} />
                        Excel (Lưới)
                    </button>

                    <button
                        onClick={handleExportExcelLobbyDetail}
                        className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-bold flex items-center gap-2 hover:bg-amber-700 transition-colors cursor-pointer shadow-sm"
                        disabled={isCapturing}
                    >
                        <Monitor size={16} />
                        Excel (Chi Tiết Sảnh)
                    </button>

                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
                        disabled={isCapturing}
                    >
                        <Printer size={16} />
                        In sơ đồ
                    </button>
                </div>
            </div>

            {/* Backdrop for Settings */}
            {isSettingsOpen && (
                <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => {
                        setIsSettingsOpen(false);
                        setIsZonePickerOpen(false);
                    }}
                />
            )}

            {/* Main Wrapper for better screen presentation */}
            <div className={`min-h-screen print:min-h-0 bg-gray-100/50 print:bg-white py-8 print:py-0 ${isCapturing ? '!p-0 !bg-white' : ''}`}>
                <div
                    id="print-ready"
                    data-ready="true"
                    className={`
                        bg-white mx-auto text-black p-4 print:p-2 text-[13px] transition-all duration-500
                        ${isCapturing ? 'shadow-none !p-4' : 'shadow-2xl rounded-xl ring-1 ring-black/5'}
                        ${orientation === 'landscape'
                            ? (isCapturing ? '!min-w-max' : 'w-[98%] max-w-[1700px]')
                            : (isCapturing ? '!min-w-max' : 'w-[95%] max-w-[1300px]')
                        }
                    `}
                    style={undefined}
                >
                     {/* Print & Capture Styles moved/consolidated */}
                    {isCapturing && (
                        <style dangerouslySetInnerHTML={{
                            __html: `
                    #print-ready {
                        min-width: max-content !important;
                        width: max-content !important;
                        margin: 0 !important;
                        padding: 60px 80px !important; /* Increased symmetrical padding */
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: stretch !important;
                        box-sizing: border-box !important;
                        background: white !important;
                    }
                    /* Ensure parents don't clip at all */
                    .min-h-screen, body, html { 
                        overflow: visible !important;
                        width: auto !important;
                    }
                `}} />
                    )}

                    <div className="mb-1 print:mb-0">
                        <PrintHeader companyInfo={companyInfo} logoSrc={logoSrc} size="compact" />
                    </div>

                    <div className="text-center mb-1 print:mb-0">
                        <EditableText
                            value={editReportTitle}
                            onChange={setEditReportTitle}
                            className="text-2xl font-bold uppercase text-center w-full"
                            style={{ fontFamily: "'Times New Roman', Times, serif" }}
                            isSnapshot={isSnapshotMode}
                        />
                        <p className="italic mt-1">Ngày in: {new Date().toLocaleDateString('vi-VN')}</p>
                        {selectedZoneId && (
                            <p className="font-medium mt-1">Vùng kho: {displayZones.find(z => z.id === selectedZoneId)?.name}</p>
                        )}
                        {searchTerm && (
                            <p className="text-sm mt-1">Lọc theo: "{searchTerm}"</p>
                        )}
                    </div>

                    {/* The Map Grid OR Data Table View */}
                    <div className="mb-8 print:mb-0">
                        {!showTable ? (
                            <div className="mt-4 print:mt-0">
                                <FlexibleZoneGrid
                                    zones={filteredZones}
                                    positions={filteredPositions}
                                    layouts={layouts}
                                    occupiedIds={occupiedIds}
                                    lotInfo={lotInfo}
                                    collapsedZones={new Set()} // Expand all for printing
                                    selectedPositionIds={new Set()}
                                    onToggleCollapse={() => { }}
                                    onPositionSelect={() => { }}
                                    pageBreakIds={pageBreakZoneIds}
                                    onTogglePageBreak={handleTogglePageBreak}
                                    displayInternalCode={displayInternalCode}
                                    isDesignMode={false}
                                    onPrintZone={() => { }}
                                    isGrouped={isGrouped}
                                    mergedZones={mergedZones}
                                    onToggleMergeZone={toggleMergeZone}
                                    isCapturing={isCapturing}
                                    isPrintPage={true}
                                    isEmptyMode={isEmptyMap}
                                />
                            </div>
                        ) : (
                            <div className="overflow-hidden border border-gray-300 rounded-lg">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider border-b border-gray-300">
                                            <th className="px-3 py-2 border-r border-gray-300 w-[12%]">Vị trí</th>
                                            <th className="px-3 py-2 border-r border-gray-300 w-[15%]">Số lô (Lot)</th>
                                            <th className="px-3 py-2 border-r border-gray-300">Sản phẩm</th>
                                            <th className="px-3 py-2 border-r border-gray-300 w-[15%]">Mã sản phẩm</th>
                                            <th className="px-3 py-2 border-r border-gray-300 w-[8%] text-center">ĐVT</th>
                                            <th className="px-3 py-2 border-r border-gray-300 w-[8%] text-right">S.Lượng</th>
                                            <th className="px-3 py-2">Mã phụ / Tags</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {filteredPositions
                                            .map((p, pIdx) => {
                                                const lot = p.lot_id ? lotInfo[p.lot_id] : null

                                                // Case 1: Occupied position
                                                if (lot) {
                                                    return lot.items.map((item: any, iIdx: number) => (
                                                        <tr key={`${p.id}-${iIdx}`} className="text-[12px] hover:bg-gray-50/50 transition-colors break-inside-avoid">
                                                            {iIdx === 0 ? (
                                                                <>
                                                                    <td className="px-3 py-2 border-r border-gray-300 font-bold bg-gray-50/30" rowSpan={lot.items.length}>
                                                                        {p.code}
                                                                    </td>
                                                                    <td className="px-3 py-2 border-r border-gray-300 font-bold text-indigo-700 bg-indigo-50/10" rowSpan={lot.items.length}>
                                                                        {lot.code}
                                                                    </td>
                                                                </>
                                                            ) : null}
                                                            <td className="px-3 py-2 border-r border-gray-300 font-medium">
                                                                {displayInternalCode && item.internal_name ? item.internal_name : item.product_name}
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-gray-300 font-mono text-[11px]">
                                                                {displayInternalCode && item.internal_code ? item.internal_code : item.sku}
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-gray-300 text-center">
                                                                {item.unit}
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-gray-300 text-right font-bold text-blue-700">
                                                                {item.quantity?.toLocaleString('vi-VN')}
                                                            </td>
                                                            <td className="px-3 py-2 italic text-gray-600 text-[11px]">
                                                                {[item.tags?.join(', '), lot.batch_code ? `Lô: ${lot.batch_code}` : null]
                                                                    .filter(Boolean)
                                                                    .join(' | ') || '-'}
                                                            </td>
                                                        </tr>
                                                    ))
                                                }

                                                // Case 2: Empty position
                                                return (
                                                    <tr key={p.id} className="text-[12px] hover:bg-gray-50/50 transition-colors italic text-gray-400 bg-gray-50/5">
                                                        <td className="px-3 py-2 border-r border-gray-300 font-bold not-italic text-gray-600">
                                                            {p.code}
                                                        </td>
                                                        <td className="px-3 py-2 border-r border-gray-300" colSpan={6}>
                                                            (Vị trí trống)
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Footer Signatures */}
                    <div id="print-signatures" className="flex justify-between mt-12 print:mt-6 print:break-inside-avoid print:block">
                        {[
                            { title: signTitle1, setTitle: setSignTitle1, person: signPerson1, setPerson: setSignPerson1 },
                            { title: signTitle2, setTitle: setSignTitle2, person: signPerson2, setPerson: setSignPerson2 },
                            { title: signTitle3, setTitle: setSignTitle3, person: signPerson3, setPerson: setSignPerson3, extra: '(Ký, họ tên, đóng dấu)' }
                        ].map((s, i) => (
                            <div key={i} className="text-center w-1/3 print:w-[33%] print:inline-block print:align-top">
                                <EditableText value={s.title} onChange={s.setTitle} className="font-bold text-center w-full mb-1" isSnapshot={isSnapshotMode} />
                                <p className="italic text-xs">{s.extra || '(Ký, họ tên)'}</p>
                                <div className="h-24 print:h-16"></div>
                                <EditableText value={s.person} onChange={s.setPerson} className="font-bold text-center w-full" placeholder="Nhập tên..." isSnapshot={isSnapshotMode} />
                            </div>
                        ))}
                    </div>

                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @media print {
                            @page { 
                                size: A4 ${orientation}; 
                                margin: 10mm !important; 
                            }
                            
                            html, body {
                                margin: 0 !important;
                                padding: 0 !important;
                                background: white !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }

                            #print-ready {
                                width: 100% !important;
                                min-width: 100% !important;
                                max-width: none !important;
                                margin: 0 !important;
                                padding: 0 !important;
                                display: block !important;
                                box-shadow: none !important;
                                border: none !important;
                                border-radius: 0 !important;
                                outline: none !important;
                                overflow: visible !important;
                                position: relative !important;
                            }

                            /* Fix nested elements that might cause paging issues */
                            .min-h-screen { min-height: 0 !important; height: auto !important; overflow: visible !important; }
                            
                            /* Maintain stretching behavior */
                            #print-ready div, #print-ready section { 
                                max-height: none !important;
                            }

                            .print-hidden, .hide-on-real-print { display: none !important; }
                            
                            /* Force visibility of complex elements */
                            * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
                        }

                        .print-break-before-page {
                            break-before: page;
                            page-break-before: always;
                        }
                    `}} />
                </div>
            </div>
        </>
    )
}
