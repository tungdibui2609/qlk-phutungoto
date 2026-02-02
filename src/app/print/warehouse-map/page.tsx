'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Printer } from 'lucide-react'
import { usePrintCompanyInfo, CompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { PrintHeader } from '@/components/print/PrintHeader'
import { EditableText } from '@/components/print/PrintHelpers'
import FlexibleZoneGrid from '@/components/warehouse/FlexibleZoneGrid'
import { Database } from '@/lib/database.types'

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

    // Editable Titles
    const [editReportTitle, setEditReportTitle] = useState('SƠ ĐỒ BỐ TRÍ KHO')
    const [signTitle1, setSignTitle1] = useState('Người Lập Biểu')
    const [signTitle2, setSignTitle2] = useState('Thủ Kho')
    const [signTitle3, setSignTitle3] = useState('Giám Đốc')
    const [signPerson1, setSignPerson1] = useState('')
    const [signPerson2, setSignPerson2] = useState('')
    const [signPerson3, setSignPerson3] = useState('')

    const [isDownloading, setIsDownloading] = useState(false)
    const [downloadTimer, setDownloadTimer] = useState(0)

    // Use shared hook for company info
    const { companyInfo, logoSrc } = usePrintCompanyInfo({
        token,
        initialCompanyInfo,
        fallbackToProfile: !initialCompanyInfo
    })

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
                return allRecs
            }

            // Fetch data similarly to Map Page
            const [posData, zoneData, zpData, layoutData, lotsData] = await Promise.all([
                fetchAll('positions', q => q.eq('system_type', systemType).order('code')),
                fetchAll('zones', q => q.eq('system_type', systemType).order('level').order('code')),
                fetchAll('zone_positions', q => q.select('zone_id, position_id, positions!inner(system_type)').eq('positions.system_type', systemType)),
                fetchAll('zone_layouts'),
                fetchAll('lots', undefined, '*, suppliers(name), qc_info(name), products(name, unit, sku), lot_items(id, product_id, quantity, unit, products(name, unit, sku)), lot_tags(tag, lot_item_id)')
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
                            product_name: item.products?.name,
                            sku: item.products?.sku,
                            unit: item.unit || item.products?.unit,
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
                        product_name: l.products.name,
                        sku: l.products.sku,
                        unit: l.products.unit,
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

    // Filter positions based on selected zone and search term (same as main page)
    const filteredPositions = useMemo(() => {
        let result = positions
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            result = result.filter(p => {
                const posCode = p.code.toLowerCase()
                if (posCode.includes(term)) return true
                const lot = p.lot_id ? lotInfo[p.lot_id] : null
                if (!lot) return false
                // Check lot code
                if (lot.code.toLowerCase().includes(term)) return true
                // Check product name/sku
                return lot.items.some((item: any) =>
                    item.product_name?.toLowerCase().includes(term) ||
                    item.sku?.toLowerCase().includes(term)
                )
            })
        }
        if (selectedZoneId) {
            const getDescendantIds = (parentId: string): string[] => {
                const children = zones.filter(z => z.parent_id === parentId)
                const descendantIds = children.map(c => c.id)
                children.forEach(child => descendantIds.push(...getDescendantIds(child.id)))
                return descendantIds
            }
            const validZoneIds = new Set([selectedZoneId, ...getDescendantIds(selectedZoneId)])
            result = result.filter(p => p.zone_id && validZoneIds.has(p.zone_id))
        }
        return result
    }, [positions, selectedZoneId, searchTerm, zones, lotInfo])

    const filteredZones = useMemo(() => {
        if (!selectedZoneId) return zones
        const getDescendantIds = (parentId: string): Set<string> => {
            const ids = new Set<string>()
            const collect = (pId: string) => {
                zones.filter(z => z.parent_id === pId).forEach(c => {
                    ids.add(c.id); collect(c.id)
                })
            }
            collect(selectedZoneId)
            return ids
        }
        const allowedIds = getDescendantIds(selectedZoneId)
        allowedIds.add(selectedZoneId)
        return zones.filter(z => allowedIds.has(z.id))
    }, [zones, selectedZoneId])

    const handlePrint = () => window.print()

    const handleDownload = async () => {
        if (isDownloading) return
        setIsDownloading(true)
        setDownloadTimer(0)
        const timerInterval = setInterval(() => setDownloadTimer(prev => prev + 1), 1000)

        try {
            const params = new URLSearchParams(searchParams.toString())
            params.set('editReportTitle', editReportTitle)
            params.set('signTitle1', signTitle1)
            params.set('signTitle2', signTitle2)
            params.set('signTitle3', signTitle3)
            params.set('signPerson1', signPerson1)
            params.set('signPerson2', signPerson2)
            params.set('signPerson3', signPerson3)

            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) params.set('token', session.access_token)

            // We need a specific endpoint for this or reuse inventory if it supports generic snapshot
            // For now, let's assume we use a generic one or create a new one later if needed
            const res = await fetch(`/api/warehouse/print-image?${params.toString()}`)
            if (!res.ok) throw new Error('Failed to generate image')

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `so-do-kho-${new Date().toISOString().split('T')[0]}.jpg`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error: any) {
            console.error(error)
            alert(`Lỗi tải ảnh: ${error.message}`)
        } finally {
            clearInterval(timerInterval)
            setIsDownloading(false)
            setDownloadTimer(0)
        }
    }

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin mr-2" /> Đang tải dữ liệu...</div>
    if (error) return <div className="flex h-screen items-center justify-center text-red-600 font-bold">Lỗi: {error}</div>

    return (
        <div id="print-ready" data-ready="true" className="bg-white min-h-screen w-[210mm] mx-auto text-black p-8 print:p-4 text-[13px]">
            {/* Toolbar */}
            <div className={`fixed top-4 right-4 print:hidden flex gap-2 ${isSnapshot ? 'hidden' : ''}`}>
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow-lg"
                >
                    {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <Printer size={20} />}
                    Tải ảnh phiếu
                </button>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg"
                >
                    <Printer size={20} /> In sơ đồ
                </button>
            </div>

            <div className="mb-6">
                <PrintHeader companyInfo={companyInfo} logoSrc={logoSrc} size="compact" />
            </div>

            <div className="text-center mb-6">
                <EditableText
                    value={editReportTitle}
                    onChange={setEditReportTitle}
                    className="text-2xl font-bold uppercase text-center w-full"
                    style={{ fontFamily: "'Times New Roman', Times, serif" }}
                    isSnapshot={isSnapshot}
                />
                <p className="italic mt-1">Ngày in: {new Date().toLocaleDateString('vi-VN')}</p>
                {selectedZoneId && (
                    <p className="font-medium mt-1">Vùng kho: {zones.find(z => z.id === selectedZoneId)?.name}</p>
                )}
                {searchTerm && (
                    <p className="text-sm mt-1">Lọc theo: "{searchTerm}"</p>
                )}
            </div>

            {/* The Map Grid */}
            <div className="mb-8 print:mb-4">
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
                />
            </div>

            {/* Footer Signatures */}
            <div className="flex justify-between mt-12 break-inside-avoid">
                {[
                    { title: signTitle1, setTitle: setSignTitle1, person: signPerson1, setPerson: setSignPerson1 },
                    { title: signTitle2, setTitle: setSignTitle2, person: signPerson2, setPerson: setSignPerson2 },
                    { title: signTitle3, setTitle: setSignTitle3, person: signPerson3, setPerson: setSignPerson3, extra: '(Ký, họ tên, đóng dấu)' }
                ].map((s, i) => (
                    <div key={i} className="text-center w-1/3">
                        <EditableText value={s.title} onChange={s.setTitle} className="font-bold text-center w-full mb-1" isSnapshot={isSnapshot} />
                        <p className="italic text-xs">{s.extra || '(Ký, họ tên)'}</p>
                        <div className="h-24"></div>
                        <EditableText value={s.person} onChange={s.setPerson} className="font-bold text-center w-full" placeholder="Nhập tên..." isSnapshot={isSnapshot} />
                    </div>
                ))}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: A4 portrait; margin: 10mm; }
                    body { background: white !important; }
                    .print-hidden { display: none !important; }
                }
                /* Ensure grid is readable on A4 */
                #print-ready .grid {
                    page-break-inside: avoid;
                }
            `}} />
        </div>
    )
}
