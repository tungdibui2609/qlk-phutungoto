'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Printer, Loader2, Download } from 'lucide-react'
import { useCaptureReceipt } from '@/hooks/useCaptureReceipt'
import { formatQuantityFull } from '@/lib/numberUtils'
import { usePrintCompanyInfo, CompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { EditableText } from '@/components/print/PrintHelpers'

interface ExportOrderItem {
    id: string
    quantity: number
    unit: string | null
    status: string | null
    lots: {
        code: string
        inbound_date: string | null
        notes: string | null
    } | null
    positions: {
        code: string
    } | null
    products: {
        name: string
        sku: string
    } | null
}

interface ExportTask {
    id: string
    code: string
    status: string
    created_at: string
    notes: string | null
    created_by_profile: {
        full_name: string
    } | null
    system_code: string | null
    company_id?: string
}

export default function ExportOrderPrintPage() {
    return (
        <React.Suspense fallback={<div className="p-8 text-center text-stone-500 font-medium">Đang tải dữ liệu phiếu...</div>}>
            <ExportOrderPrintContent />
        </React.Suspense>
    )
}

function ExportOrderPrintContent() {
    const searchParams = useSearchParams()
    const taskId = searchParams.get('id')

    // Check for company info in params
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
        tax_code: null
    } as CompanyInfo : null

    const [loading, setLoading] = useState(true)
    const [task, setTask] = useState<ExportTask | null>(null)
    const [items, setItems] = useState<ExportOrderItem[]>([])

    // Use shared hook for company info
    const { companyInfo, logoSrc } = usePrintCompanyInfo({
        token: searchParams.get('token'),
        orderCompanyId: task?.company_id,
        initialCompanyInfo
    })

    // Capture and snapshot state
    const { isCapturing, handleCapture } = useCaptureReceipt({
        fileNamePrefix: `Phieu_Xuat_Kho_${task?.code || 'scan'}`
    })
    const isSnapshotMode = isCapturing
    const isDownloadingState = isCapturing

    // Editable fields
    const [editDay, setEditDay] = useState('')
    const [editMonth, setEditMonth] = useState('')
    const [editYear, setEditYear] = useState('')

    // Editable signature fields
    const [signTitle1, setSignTitle1] = useState('Người lập phiếu')
    const [signTitle2, setSignTitle2] = useState('Người nhận hàng')
    const [signTitle3, setSignTitle3] = useState('Thủ kho')
    const [signTitle4, setSignTitle4] = useState('Kế toán trưởng')
    const [signPerson1, setSignPerson1] = useState('')
    const [signPerson2, setSignPerson2] = useState('')
    const [signPerson3, setSignPerson3] = useState('')
    const [signPerson4, setSignPerson4] = useState('')

    useEffect(() => {
        async function fetchData() {
            if (!taskId) {
                setLoading(false)
                return
            }

            try {
                // Fetch Task
                const { data: taskData, error: taskError } = await supabase
                    .from('export_tasks')
                    .select(`
                        *,
                        created_by_profile:created_by (full_name)
                    `)
                    .eq('id', taskId)
                    .single()

                if (taskError) {
                    const { data: taskDataFallback, error: fallbackError } = await supabase
                        .from('export_tasks')
                        .select('*')
                        .eq('id', taskId)
                        .single()

                    if (fallbackError) throw fallbackError
                    setTask({ ...taskDataFallback, created_by_profile: { full_name: 'Admin' } })
                } else {
                    // @ts-expect-error: Joined type mismatch
                    setTask(taskData)
                }

                // Fetch Items
                const { data: itemsData, error: itemsError } = await supabase
                    .from('export_task_items')
                    .select(`
                        id,
                        quantity,
                        unit,
                        status,
                        lots (code, inbound_date, notes),
                        positions (code),
                        products (name, sku)
                    `)
                    .eq('task_id', taskId)

                if (itemsError) throw itemsError
                // Explicitly cast or handle potential nulls if needed, though interface update should handle it
                setItems(itemsData as unknown as ExportOrderItem[] || [])

                // Initialize editable fields
                if (taskData) {
                    const d = new Date(taskData.created_at)
                    setEditDay(d.getDate().toString())

                    setEditMonth((d.getMonth() + 1).toString())
                    setEditYear(d.getFullYear().toString())

                    // @ts-expect-error: Access joined relation
                    if (taskData.created_by_profile?.full_name) {
                        // @ts-expect-error: Access joined relation
                        setSignPerson1(taskData.created_by_profile.full_name)
                    }
                }

            } catch (error) {
                console.error('Error fetching export task:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [taskId])

    const handlePrint = () => {
        window.print()
    }

    const handleDownload = () => handleCapture(false)

    // Layout Processing for Diagram
    const diagramData = useMemo(() => {
        type GridItem = {
            data: ExportOrderItem
            tier: number
            slot: number
        }

        type GridGroup = {
            name: string
            items: GridItem[]
            tiers: number[]
            slots: number[]
            key: string
            grid: {
                tiers: number[]
                slots: number[]
            }
        }

        const groups: Record<string, Omit<GridGroup, 'key' | 'grid'>> = {}

        items.forEach(item => {
            if (!item.positions?.code) return

            const code = item.positions.code
            const parts = code.split(/[-.]/)

            let zone = '?'
            let rack = '?'
            let tier = 1
            let slot = 1

            if (parts.length >= 2) {
                zone = parts[0]
                const rackTierPart = parts[1] // K1D1T1

                // Extract Tier
                const tierMatch = rackTierPart.match(/T(\d+)$/)
                if (tierMatch) {
                    tier = parseInt(tierMatch[1])
                    rack = rackTierPart.replace(/T\d+$/, '') // K1D1
                } else {
                    rack = rackTierPart
                }

                // Extract Slot
                const slotPart = parts[2] || ''
                const slotMatch = slotPart.match(/(\d+)/)
                if (slotMatch) {
                    slot = parseInt(slotMatch[1])
                }
            } else {
                rack = code
            }

            const groupKey = `${zone}-${rack}`

            if (!groups[groupKey]) {
                groups[groupKey] = {
                    name: `${zone} - ${rack}`,
                    items: [],
                    tiers: [],
                    slots: []
                }
            }

            groups[groupKey].items.push({ data: item, tier, slot })
            if (!groups[groupKey].tiers.includes(tier)) groups[groupKey].tiers.push(tier)
            if (!groups[groupKey].slots.includes(slot)) groups[groupKey].slots.push(slot)
        })

        return Object.entries(groups).map(([key, group]) => {
            const sortedTiers = group.tiers.sort((a, b) => a - b)
            const sortedSlots = group.slots.sort((a, b) => a - b)

            // Determine actual range with buffer
            const minTierRaw = sortedTiers.length ? Math.min(...sortedTiers) : 1
            const maxTierRaw = sortedTiers.length ? Math.max(...sortedTiers) : 1
            const minSlotRaw = sortedSlots.length ? Math.min(...sortedSlots) : 1
            const maxSlotRaw = sortedSlots.length ? Math.max(...sortedSlots) : 1

            const displayMinTier = Math.max(1, minTierRaw)
            const displayMaxTier = maxTierRaw

            const displayMinSlot = Math.max(1, minSlotRaw)
            const displayMaxSlot = maxSlotRaw

            // Generate arrays for the grid
            // Tiers from Max to Min (Top to Bottom)
            const tiers = []
            for (let i = displayMaxTier; i >= displayMinTier; i--) {
                tiers.push(i)
            }

            const slots = []
            for (let i = displayMinSlot; i <= displayMaxSlot; i++) {
                slots.push(i)
            }

            return {
                ...group,
                key,
                grid: {
                    tiers,
                    slots
                }
            }
        })

    }, [items])


    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin text-stone-400" size={30} />
            </div>
        )
    }

    if (!task) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-stone-500">
                <p>Không tìm thấy lệnh xuất kho.</p>
                <button onClick={() => window.close()} className="text-blue-600 hover:underline">Đóng</button>
            </div>
        )
    }

    return (
        <div id="print-ready" className={`pt-8 px-8 pb-8 print:p-0 max-w-[210mm] mx-auto bg-white text-black text-[13px] leading-relaxed font-serif ${isCapturing ? 'w-[210mm]' : ''}`}>
            <style jsx global>{`
                @media print {
                    @page {
                        margin: 10mm;
                        size: A4;
                    }
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                        font-family: 'Times New Roman', Times, serif !important;
                    }
                    .page-break {
                        page-break-before: always;
                    }
                }
                #print-ready {
                    font-family: 'Times New Roman', Times, serif;
                }
            `}</style>

            {/* Toolbar */}
            <div className={`fixed top-4 right-4 print:hidden z-50 flex items-center gap-2 ${isSnapshotMode ? 'hidden' : ''}`}>
                <button
                    onClick={handleDownload}
                    disabled={isDownloadingState}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-lg transition-colors font-sans text-sm"
                >
                    {isDownloadingState ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Tải ảnh
                </button>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors font-sans text-sm"
                >
                    <Printer size={16} />
                    In phiếu
                </button>
            </div>

            {/* PAGE 1: EXPORT ORDER DETAIL */}
            <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-4 items-start">
                        {logoSrc && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={logoSrc}
                                alt="Logo"
                                className="h-16 w-auto object-contain grayscale opacity-80"
                            />
                        )}
                        <div>
                            <h2 className="font-bold text-sm uppercase text-green-800">{companyInfo?.name || 'CÔNG TY CP ...'}</h2>
                            <p className="text-xs">{companyInfo?.address || 'Địa chỉ: ...'}</p>
                            <p className="text-xs">Email: {companyInfo?.email} | Điện thoại: {companyInfo?.phone}</p>
                        </div>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold uppercase mb-1">LỆNH XUẤT KHO</h1>
                    <div className="text-sm font-bold mb-1">
                        Ngày {editDay} Tháng {editMonth} Năm {editYear}
                    </div>
                    <div className="text-sm font-bold">Số: {task.code}</div>
                </div>

                {/* Info Fields */}
                <div className="mb-4 text-sm space-y-2">
                    <div>- Kho: Tất cả</div>
                    <div>- Trạng thái: {task.status === 'Pending' ? 'Mới' : task.status}</div>
                    <div>- Người tạo: {task.created_by_profile?.full_name || '...'}</div>
                    <div>- Ngày tạo: {new Date(task.created_at).toLocaleString('vi-VN')}</div>
                </div>

                <h3 className="font-bold text-sm mb-2">Chi tiết hàng hóa xuất kho</h3>

                {/* Table */}
                <table className="w-full border-collapse border border-black mb-4 text-xs break-inside-avoid">
                    <thead>
                        <tr>
                            <th className="border border-black p-2 w-10 text-center">STT</th>
                            <th className="border border-black p-2 w-24 text-center">Mã LOT</th>
                            <th className="border border-black p-2 w-24 text-center">Vị trí</th>
                            <th className="border border-black p-2 text-center">Sản phẩm</th>
                            <th className="border border-black p-2 w-16 text-center">Số lượng</th>
                            <th className="border border-black p-2 w-16 text-center">ĐVT</th>
                            <th className="border border-black p-2 w-14 text-center">Đã hạ</th>
                            <th className="border border-black p-2 w-14 text-center">Chưa hạ</th>
                            <th className="border border-black p-2 w-24 text-center">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={item.id}>
                                <td className="border border-black p-2 text-center">{idx + 1}</td>
                                <td className="border border-black p-2 text-center">{item.lots?.code}</td>
                                <td className="border border-black p-2 text-center">{item.positions?.code}</td>
                                <td className="border border-black p-2">
                                    <div className="font-bold">{item.products?.name}</div>
                                    {item.lots?.notes && <div className="text-[10px] font-bold mt-1 uppercase">{item.lots.notes}</div>}
                                </td>
                                <td className="border border-black p-2 text-center font-bold">{formatQuantityFull(item.quantity)}</td>
                                <td className="border border-black p-2 text-center">{item.unit}</td>
                                <td className="border border-black p-2 text-center text-lg">◻</td>
                                <td className="border border-black p-2 text-center text-lg">◻</td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td className="border border-black p-4 text-center" colSpan={9}>Không có dữ liệu</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Signatures */}
                <div className="grid grid-cols-4 gap-4 text-center break-inside-avoid text-sm pt-4">
                    <div>
                        <div className="mb-16 font-bold">
                            <EditableText
                                value={signTitle1}
                                onChange={setSignTitle1}
                                className="font-bold text-center w-full block"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                        <div className="font-bold uppercase text-[11px]">
                            <EditableText
                                value={signPerson1}
                                onChange={setSignPerson1}
                                className="font-bold text-center w-full block uppercase"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="mb-16 font-bold">
                            <EditableText
                                value={signTitle2}
                                onChange={setSignTitle2}
                                className="font-bold text-center w-full block"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                        <div className="font-bold uppercase text-[11px]">
                            <EditableText
                                value={signPerson2}
                                onChange={setSignPerson2}
                                className="font-bold text-center w-full block uppercase"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="mb-16 font-bold">
                            <EditableText
                                value={signTitle3}
                                onChange={setSignTitle3}
                                className="font-bold text-center w-full block"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                        <div className="font-bold uppercase text-[11px]">
                            <EditableText
                                value={signPerson3}
                                onChange={setSignPerson3}
                                className="font-bold text-center w-full block uppercase"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="mb-16 font-bold">
                            <EditableText
                                value={signTitle4}
                                onChange={setSignTitle4}
                                className="font-bold text-center w-full block"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                        <div className="font-bold uppercase text-[11px]">
                            <EditableText
                                value={signPerson4}
                                onChange={setSignPerson4}
                                className="font-bold text-center w-full block uppercase"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="page-break my-8 border-t border-dashed border-stone-300 print:border-none"></div>

            {/* PAGE 2: DIAGRAM */}
            <div>
                <h2 className="font-bold text-lg mb-4 text-center uppercase border-b border-black pb-2">Sơ đồ vị trí xuất kho</h2>

                {diagramData.map(group => (
                    <div key={group.key} className="mb-8 break-inside-avoid">
                        <div className="font-bold mb-2 text-sm">Kho {group.key.split('-')[0]} • {group.items.length} vị trí</div>
                        <div className="font-bold text-lg mb-4">Khu {group.key.split('-')[0]} - Dãy {group.key.split('-').slice(1).join('')}</div>

                        {/* Grid Render */}
                        <div className="space-y-2">
                            {group.grid.tiers.map(tier => (
                                <div key={tier} className="flex gap-2">
                                    <div className="w-16 flex items-center font-bold shrink-0 text-sm">
                                        Tầng {tier}
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto print:overflow-visible">
                                        {group.grid.slots.map(slot => {
                                            // Find all items at this Tier/Slot
                                            const slotItems = group.items.filter(i => i.tier === tier && i.slot === slot).map(i => i.data)

                                            const hasItem = slotItems.length > 0
                                            const firstItem = slotItems[0]

                                            return (
                                                <div key={slot} className={`
                                                    border border-black rounded w-28 h-20 p-1 flex flex-col justify-between relative shrink-0
                                                    ${hasItem ? 'bg-white' : 'bg-stone-50 print:bg-white'}
                                                `}>
                                                    {/* Slot Label (PL1) */}
                                                    <div className="text-[10px] text-center font-bold text-stone-500 mb-0.5">PL{slot}</div>

                                                    {hasItem ? (
                                                        <div className="flex flex-col h-full justify-between items-center pb-1">
                                                            <div className="text-[9px] text-center font-bold break-all leading-tight px-0.5">
                                                                {firstItem.positions?.code}
                                                            </div>
                                                            <div className="text-[9px] text-center w-full">
                                                                <div className="font-bold truncate px-0.5" title={firstItem.products?.name}>
                                                                    {firstItem.products?.sku}
                                                                </div>
                                                                <div className="font-bold text-black scale-90 origin-bottom">
                                                                    {slotItems.length > 1 ? `${slotItems.length} items` : `${formatQuantityFull(firstItem.quantity)} ${firstItem.unit}`}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="h-full"></div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
