'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Printer, Loader2, Download, Hash } from 'lucide-react'
import { toJpeg } from 'html-to-image'
import { useCaptureReceipt } from '@/hooks/useCaptureReceipt'
import { formatQuantityFull } from '@/lib/numberUtils'
import { usePrintCompanyInfo, CompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { PrintHeader, PrintLegalHeader } from '@/components/print/PrintHeader'
import { EditableText, AutoResizeInput, numberToVietnameseText } from '@/components/print/PrintHelpers'

interface OrderItem {
    id: string
    product_name: string | null
    unit: string | null
    quantity: number
    document_quantity: number
    price: number
    note: string | null
    products: { sku: string, internal_code?: string | null, internal_name?: string | null } | null
}

interface InboundOrder {
    id: string
    code: string
    status: string
    created_at: string
    warehouse_name: string | null
    description: string | null
    supplier_address: string | null
    supplier_phone: string | null
    supplier: { name: string } | null
    metadata?: any
    system_code?: string
    company_id?: string
}

export default function InboundPrintPage() {
    return (
        <React.Suspense fallback={<div className="p-8 text-center">Đang tải...</div>}>
            <InboundPrintContent />
        </React.Suspense>
    )
}

function InboundPrintContent() {
    const searchParams = useSearchParams()
    const orderId = searchParams.get('id')
    const printType = searchParams.get('type') || 'official' // 'internal' or 'official'
    const isSnapshot = searchParams.get('snapshot') === '1'
    const isInternal = printType === 'internal'

    // Check for company info in params (from screenshot service)
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
    const [order, setOrder] = useState<InboundOrder | null>(null)
    const [items, setItems] = useState<OrderItem[]>([])
    const [docQuantities, setDocQuantities] = useState<Record<string, string>>({})
    const [systemConfig, setSystemConfig] = useState<any>(null)
    const [unitsMap, setUnitsMap] = useState<Record<string, string>>({})
    const [displayInternalCode, setDisplayInternalCode] = useState(false)

    // Use shared hook for company info
    const { companyInfo, logoSrc } = usePrintCompanyInfo({
        token: searchParams.get('token'),
        initialCompanyInfo
    })

    // Module helpers
    const hasModule = (moduleId: string) => {
        // Check URL params first (passed from API for screenshot service)
        const paramModules = searchParams.get('modules')
        if (paramModules) {
            const modules = decodeURIComponent(paramModules).split(',')
            return modules.includes(moduleId)
        }

        if (!systemConfig) return false
        const modules = typeof systemConfig.inbound_modules === 'string'
            ? JSON.parse(systemConfig.inbound_modules)
            : systemConfig.inbound_modules
        return Array.isArray(modules) && modules.includes(moduleId)
    }

    // Set displayInternalCode default when config loads
    useEffect(() => {
        if (systemConfig) {
            setDisplayInternalCode(hasModule('internal_products'))
        }
    }, [systemConfig])

    const { targetUnit } = order?.metadata || {}

    // Editable fields
    const [editDay, setEditDay] = useState('')
    const [editMonth, setEditMonth] = useState('')
    const [editYear, setEditYear] = useState('')
    const [editSupplierName, setEditSupplierName] = useState('')
    const [editSupplierAddress, setEditSupplierAddress] = useState('')
    const [editTheoDoc, setEditTheoDoc] = useState('')
    const [editTheoSo, setEditTheoSo] = useState('')
    const [editTheoDay, setEditTheoDay] = useState('')
    const [editTheoMonth, setEditTheoMonth] = useState('')
    const [editTheoYear, setEditTheoYear] = useState('')
    const [editTheoCua, setEditTheoCua] = useState('')
    const [editWarehouse, setEditWarehouse] = useState('')
    const [editLocation, setEditLocation] = useState(cmpAddress || '')
    const [editDescription, setEditDescription] = useState('')
    const [amountInWords, setAmountInWords] = useState('')
    const [attachedDocs, setAttachedDocs] = useState('')

    // Editable signature fields
    const [signTitle1, setSignTitle1] = useState('Người lập phiếu')
    const [signTitle2, setSignTitle2] = useState('Thủ kho')
    const [signTitle3, setSignTitle3] = useState('Kế toán trưởng')
    const [signPerson1, setSignPerson1] = useState('')
    const [signPerson2, setSignPerson2] = useState('')
    const [signPerson3, setSignPerson3] = useState('')
    const [signDay, setSignDay] = useState('')
    const [signMonth, setSignMonth] = useState('')
    const [signYear, setSignYear] = useState('')

    // Accounting fields (Nợ / Có)
    const [debitAccount, setDebitAccount] = useState('')
    const [creditAccount, setCreditAccount] = useState('')

    // General note field
    const [editNote, setEditNote] = useState('')

    // Column C Editable fields
    const [editQuyCachTitle, setEditQuyCachTitle] = useState('Quy cách')
    const [editQuyCach, setEditQuyCach] = useState<Record<string, string>>({})

    // Note column editable fields
    const [editNoteTitle, setEditNoteTitle] = useState('Ghi chú')
    const [editItemNotes, setEditItemNotes] = useState<Record<string, string>>({})

    // Print size state
    const [printSize, setPrintSize] = useState<'A4' | 'A5'>('A5')

    // Capture and snapshot state
    const [isDownloading, setIsDownloading] = useState(false)
    const { isCapturing, downloadTimer, handleCapture } = useCaptureReceipt({
        fileNamePrefix: `Phieu_nhap_${order?.code || 'scan'}`
    })
    const isSnapshotMode = searchParams.get('snapshot') === '1' || isCapturing
    const isDownloadingState = isDownloading || isCapturing

    const token = searchParams.get('token')

    useEffect(() => {
        if (companyInfo && !editLocation) {
            setEditLocation(companyInfo.address || '')
        }
    }, [companyInfo])

    useEffect(() => {
        async function fetchData() {
            if (token) {
                await supabase.auth.setSession({
                    access_token: token,
                    refresh_token: ''
                })
            }

            if (!orderId) {
                setLoading(false)
                return
            }

            try {
                // Check for order data passed from server (API)
                let passedOrderData: any = null
                const orderDataParam = searchParams.get('order_data')
                if (orderDataParam) {
                    try {
                        passedOrderData = JSON.parse(decodeURIComponent(orderDataParam))
                    } catch (e) {
                        console.error('Failed to parse passed order data', e)
                    }
                }

                // Fetch order if not passed
                let orderData = passedOrderData
                if (!orderData) {
                    const { data } = await supabase
                        .from('inbound_orders')
                        .select(`
                            *,
                            supplier:suppliers(name),
                            system_code,
                            company_id
                        `)
                        .eq('id', orderId)
                        .single()
                    orderData = data
                }

                if (orderData) {
                    const o = orderData as any
                    setOrder(o)

                    // Fetch system config based on order's system_code
                    if (o.system_code) {
                        const { data: sysData } = await supabase
                            .from('systems')
                            .select('*')
                            .eq('code', o.system_code)
                            .single()
                        if (sysData) setSystemConfig(sysData)
                    }

                    // Set editable fields
                    const d = new Date(o.created_at)
                    if (!isNaN(d.getTime())) {
                        setEditDay(searchParams.get('editDay') || d.getDate().toString())
                        setEditMonth(searchParams.get('editMonth') || (d.getMonth() + 1).toString())
                        setEditYear(searchParams.get('editYear') || d.getFullYear().toString())
                    }

                    setEditSupplierName(searchParams.get('editSupplierName') || o.supplier?.name || '')
                    setEditSupplierAddress(searchParams.get('editSupplierAddress') || o.supplier_address || '')
                    setEditWarehouse(searchParams.get('editWarehouse') || o.warehouse_name || 'Kho mặc định')
                    setEditDescription(searchParams.get('editDescription') || o.description || '')
                    // setEditLocation is handled by useEffect on companyInfo

                    setEditTheoDoc(searchParams.get('editTheoDoc') || '')
                    setEditTheoSo(searchParams.get('editTheoSo') || '')
                    setEditTheoDay(searchParams.get('editTheoDay') || '')
                    setEditTheoMonth(searchParams.get('editTheoMonth') || '')
                    setEditTheoYear(searchParams.get('editTheoYear') || '')
                    setEditTheoCua(searchParams.get('editTheoCua') || '')

                    setAmountInWords(searchParams.get('amountInWords') || '')
                    setAttachedDocs(searchParams.get('attachedDocs') || '')

                    setSignTitle1(searchParams.get('signTitle1') || 'Người lập phiếu')
                    setSignTitle2(searchParams.get('signTitle2') || 'Thủ kho')
                    setSignTitle3(searchParams.get('signTitle3') || 'Kế toán trưởng')

                    setSignPerson1(searchParams.get('signPerson1') || '')
                    setSignPerson2(searchParams.get('signPerson2') || '')
                    setSignPerson3(searchParams.get('signPerson3') || '')

                    setSignDay(searchParams.get('signDay') || '')
                    setSignMonth(searchParams.get('signMonth') || '')
                    setSignYear(searchParams.get('signYear') || '')

                    setDebitAccount(searchParams.get('debitAccount') || '')
                    setCreditAccount(searchParams.get('creditAccount') || '')
                    setEditNote(searchParams.get('editNote') || '')

                    // Fetch units for conversion map
                    let unitsData: { id: string, name: string }[] | null = null

                    const unitsParam = searchParams.get('units_data')
                    if (unitsParam) {
                        try {
                            const parsed = JSON.parse(decodeURIComponent(unitsParam))
                            unitsData = parsed.map((u: any) => ({ id: u.i, name: u.n }))
                        } catch (e) { }
                    }

                    if (!unitsData) {
                        const { data } = await supabase.from('units').select('id, name')
                        unitsData = data
                    }

                    // Fetch items
                    let itemsData: any[] | null = null
                    const itemsParam = searchParams.get('items_data')
                    if (itemsParam) {
                        try {
                            itemsData = JSON.parse(decodeURIComponent(itemsParam))
                        } catch (e) { }
                    }

                    if (!itemsData) {
                        const { data } = await supabase
                            .from('inbound_order_items')
                            .select(`
                                *,
                                products (
                                    sku,
                                    internal_code,
                                    internal_name,
                                    unit,
                                    product_units (
                                        unit_id,
                                        conversion_rate
                                    )
                                )
                            `)
                            .eq('order_id', orderId)
                        itemsData = data
                    }

                    if (itemsData) {
                        setItems(itemsData as any)
                    }
                    if (unitsData) {
                        const map: Record<string, string> = {}
                        unitsData.forEach((u: any) => map[u.id] = u.name)
                        setUnitsMap(map)
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [orderId])

    // Auto-calculate amount in words when items change
    useEffect(() => {
        if (items.length > 0) {
            const total = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
            setAmountInWords(numberToVietnameseText(total))
        }
    }, [items])

    const handlePrint = () => {
        window.print()
    }

    const handleDownload = () => handleCapture(false)

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-gray-500">Đang tải...</div>
            </div>
        )
    }

    if (!order) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-red-500">Không tìm thấy phiếu nhập</div>
            </div>
        )
    }

    return (
        <div id="print-ready" data-ready={!loading && order && items.length >= 0 && (!hasModule('inbound_conversion') || !targetUnit || Object.keys(unitsMap).length > 0) ? "true" : undefined} className={`pt-0 px-6 pb-6 print:p-0 print:pt-0 print:px-0 max-w-4xl mx-auto bg-white text-black text-[13px] ${printSize === 'A5' ? 'print-a5-super-compact' : 'print:text-[12px]'} leading-relaxed ${isCapturing ? 'shadow-none !max-w-none !w-[1150px]' : ''}`}>
            {isCapturing && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    #print-ready {
                        width: 1150px !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 40px 60px !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: stretch !important;
                        box-sizing: border-box !important;
                    }
                    input, textarea {
                        display: none !important;
                    }
                `}} />
            )}
            {/* Toolbar - Hidden when printing or snapshotting */}
            <div className={`fixed top-4 right-4 print:hidden z-50 flex items-center gap-2 ${isSnapshotMode ? 'hidden' : ''}`}>
                <button
                    onClick={() => setPrintSize(prev => prev === 'A4' ? 'A5' : 'A4')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg transition-all hover:scale-105 font-medium ${printSize === 'A5' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-stone-200 hover:bg-stone-300 text-stone-800'}`}
                >
                    Khổ in: {printSize}
                </button>
                <button
                    onClick={handleDownload}
                    disabled={isDownloadingState}
                    className={`flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-full shadow-lg transition-all hover:scale-105 ${isDownloadingState ? 'opacity-70 cursor-wait' : ''}`}
                >
                    {isDownloadingState ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            Đang tạo ảnh... ({downloadTimer}s)
                        </>
                    ) : (
                        <>
                            <Download size={20} />
                            Tải ảnh phiếu
                        </>
                    )}
                </button>
                <button
                    onClick={() => setDisplayInternalCode(!displayInternalCode)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg transition-all hover:scale-105 font-medium ${displayInternalCode ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-stone-200 hover:bg-stone-300 text-stone-800'}`}
                >
                    <Hash size={20} />
                    {displayInternalCode ? 'Mã Nội Bộ' : 'Mã Gốc'}
                </button>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full shadow-lg transition-all hover:scale-105"
                >
                    <Printer size={20} />
                    In phiếu
                </button>
            </div>

            {/* Header with Shared Component */}
            <PrintHeader
                companyInfo={companyInfo}
                logoSrc={logoSrc}
                size={isInternal ? 'large' : 'compact'}
                rightContent={!isInternal && <PrintLegalHeader formNumber="01" />}
                isA5={printSize === 'A5'}
            />

            {/* Title */}
            <div className={`relative text-center ${printSize === 'A5' ? 'mt--1 mb-0' : 'mt-4 mb-1'}`}>
                <h1 className={`${printSize === 'A5' ? 'text-base' : 'text-xl'} font-bold tracking-wide`} style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                    PHIẾU NHẬP KHO
                </h1>

                {!isInternal && hasModule('inbound_financials') && (
                    <div className="absolute top-4 right-36 text-left">
                        <div className="text-sm font-medium text-gray-700">
                            <span className={`print:hidden ${isSnapshotMode ? 'hidden' : ''}`}>
                                Nợ:{' '}
                                <input
                                    type="text"
                                    value={debitAccount}
                                    onChange={(e) => setDebitAccount(e.target.value)}
                                    className="w-16 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500"
                                />
                            </span>
                            <span className={`hidden print:inline ${isSnapshotMode ? 'inline' : ''}`}>Nợ: <span className="inline-block min-w-[40px] border-b border-dashed border-gray-300">{debitAccount}</span></span>
                        </div>
                        <div className="text-sm font-medium text-gray-700 mt-1">
                            <span className={`print:hidden ${isSnapshotMode ? 'hidden' : ''}`}>
                                Có:{' '}
                                <input
                                    type="text"
                                    value={creditAccount}
                                    onChange={(e) => setCreditAccount(e.target.value)}
                                    className="w-16 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500"
                                />
                            </span>
                            <span className={`hidden print:inline ${isSnapshotMode ? 'inline' : ''}`}>Có: <span className="inline-block min-w-[40px] border-b border-dashed border-gray-300">{creditAccount}</span></span>
                        </div>
                    </div>
                )}

                <div className="text-sm italic text-gray-600 mt-2">
                    <span className={`print:hidden ${isSnapshotMode ? 'hidden' : ''}`}>
                        Ngày{' '}
                        <input
                            type="text"
                            value={editDay}
                            onChange={(e) => setEditDay(e.target.value)}
                            className="w-8 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500"
                        />
                        {' '}tháng{' '}
                        <input
                            type="text"
                            value={editMonth}
                            onChange={(e) => setEditMonth(e.target.value)}
                            className="w-8 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500"
                        />
                        {' '}năm{' '}
                        <input
                            type="text"
                            value={editYear}
                            onChange={(e) => setEditYear(e.target.value)}
                            className="w-14 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500"
                        />
                    </span>
                    <span className={`hidden print:inline ${isSnapshotMode ? 'inline' : ''}`}>
                        Ngày {editDay} tháng {editMonth} năm {editYear}
                    </span>
                </div>

                <div className="text-sm font-medium mt-1 text-black">
                    Số: <span className="font-bold text-black">{order.code}</span>
                </div>
            </div>

            <div className={`mt-6 ${printSize === 'A5' ? 'print:mt-0' : 'print:mt-1'} space-y-2 ${printSize === 'A5' ? 'print:space-y-0.5' : 'print:space-y-0'} text-sm ${printSize === 'A5' ? 'print:text-[10.5px]' : ''}`}>
                <div className={`flex items-center ${printSize === 'A5' ? 'leading-none h-4' : ''}`}>
                    <span className="text-gray-600 shrink-0">- Họ tên người giao:</span>
                    <EditableText
                        value={editSupplierName}
                        onChange={setEditSupplierName}
                        className="ml-2 flex-1 font-bold"
                        isSnapshot={isSnapshotMode}
                    />
                </div>
                <div className={`flex items-center ${printSize === 'A5' ? 'leading-none h-4' : ''}`}>
                    <span className="text-gray-600 shrink-0">- Địa chỉ ( bộ phận ):</span>
                    <EditableText
                        value={editSupplierAddress}
                        onChange={setEditSupplierAddress}
                        className="ml-2 flex-1 font-bold"
                        isSnapshot={isSnapshotMode}
                    />
                </div>
                {!isInternal && (
                    <div className={`flex items-center ${printSize === 'A5' ? 'leading-none h-4' : ''}`}>
                        <span className="text-gray-600 shrink-0">- Theo</span>
                        <AutoResizeInput
                            value={editTheoDoc}
                            onChange={setEditTheoDoc}
                            className="mx-1 font-bold"
                            minWidth={60}
                            emptyWidth={100}
                            isSnapshot={isSnapshotMode}
                        />

                        <span className="text-gray-600">số</span>
                        <AutoResizeInput
                            value={editTheoSo}
                            onChange={setEditTheoSo}
                            className="mx-1 font-bold"
                            minWidth={40}
                            emptyWidth={85}
                            isSnapshot={isSnapshotMode}
                        />

                        <span className="text-gray-600">ngày</span>
                        <AutoResizeInput
                            value={editTheoDay}
                            onChange={setEditTheoDay}
                            className="mx-1 font-bold"
                            minWidth={25}
                            emptyWidth={30}
                            isSnapshot={isSnapshotMode}
                        />

                        <span className="text-gray-600">tháng</span>
                        <AutoResizeInput
                            value={editTheoMonth}
                            onChange={setEditTheoMonth}
                            className="mx-1 font-bold"
                            minWidth={25}
                            emptyWidth={30}
                            isSnapshot={isSnapshotMode}
                        />

                        <span className="text-gray-600">năm</span>
                        <AutoResizeInput
                            value={editTheoYear}
                            onChange={setEditTheoYear}
                            className="mx-1 font-bold"
                            minWidth={30}
                            emptyWidth={40}
                            isSnapshot={isSnapshotMode}
                        />

                        <span className="text-gray-600">của</span>
                        <AutoResizeInput
                            value={editTheoCua}
                            onChange={setEditTheoCua}
                            className="mx-1 font-bold"
                            minWidth={100}
                            emptyWidth={100}
                            isSnapshot={isSnapshotMode}
                        />
                    </div>
                )}
                <div className={`flex items-center gap-8 ${printSize === 'A5' ? 'leading-none h-4' : ''}`}>
                    <div className="flex items-center">
                        <span className="text-gray-600 shrink-0">- Nhập tại kho:</span>
                        <EditableText
                            value={editWarehouse}
                            onChange={setEditWarehouse}
                            className="ml-2 font-bold"
                            isSnapshot={isSnapshotMode}
                        />
                    </div>
                    <div className="flex items-center flex-1">
                        <span className="text-gray-600 shrink-0">Địa điểm:</span>
                        <input
                            type="text"
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} flex-1 ml-2 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                        />
                        <span className={`hidden print:inline ml-2 flex-1 min-w-[50px] font-bold ${isSnapshotMode ? 'inline' : ''}`}>{editLocation || '\u00A0'}</span>
                    </div>
                </div>
                {editDescription && (
                    <div className={`flex items-center ${printSize === 'A5' ? 'leading-none h-4' : ''}`}>
                        <span className="text-gray-600 shrink-0">- Diễn giải:</span>
                        <EditableText
                            value={editDescription}
                            onChange={setEditDescription}
                            className="ml-2 flex-1 font-bold italic"
                            isSnapshot={isSnapshotMode}
                        />
                    </div>
                )}
                <div className={`flex items-center ${printSize === 'A5' ? 'leading-none h-4' : ''}`}>
                    <span className="text-gray-600 shrink-0">- Ghi chú:</span>
                    <input
                        type="text"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} flex-1 ml-2 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                    />
                    <span className={`hidden print:inline ml-2 flex-1 font-bold ${isSnapshotMode ? 'inline' : ''}`}>{editNote || '\u00A0'}</span>
                </div>
            </div>

            <div className="mt-6 print:mt-1">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th rowSpan={2} className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-2'} text-center w-10`}>STT</th>
                            <th rowSpan={2} className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-2'} text-center w-60`}>Tên, nhãn hiệu quy cách, phẩm chất vật tư, dụng cụ sản phẩm, hàng hóa</th>
                            <th rowSpan={2} className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-2'} text-center w-24`}>
                                <EditableText
                                    value={editQuyCachTitle}
                                    onChange={setEditQuyCachTitle}
                                    className="text-center font-bold min-w-0 w-full"
                                    isSnapshot={isSnapshotMode}
                                />
                            </th>
                            <th rowSpan={2} className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-2'} text-center w-14`}>Đơn vị tính</th>
                            <th colSpan={hasModule('inbound_conversion') && targetUnit ? (hasModule('inbound_financials') ? 3 : 2) : (hasModule('inbound_financials') ? 2 : 1)} className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-2'} text-center`}>Số lượng</th>
                            {!isInternal && hasModule('inbound_financials') && <th rowSpan={2} className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-2'} text-center w-24`}>Đơn giá</th>}
                            {!isInternal && hasModule('inbound_financials') && <th rowSpan={2} className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-2'} text-center w-28`}>Thành tiền</th>}
                            {isInternal && (
                                <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-center w-16">
                                    <EditableText
                                        value={editNoteTitle}
                                        onChange={setEditNoteTitle}
                                        className="text-center font-bold min-w-0 w-full"
                                        isSnapshot={isSnapshotMode}
                                    />
                                </th>
                            )}
                        </tr>
                        <tr className="bg-gray-100">
                            {hasModule('inbound_financials') && <th className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-2'} text-center w-20 align-top`}>Theo chứng từ</th>}
                            <th className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-2'} text-center w-20 align-top`}>Thực nhập</th>
                            {hasModule('inbound_conversion') && targetUnit && (
                                <th className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-2'} text-center w-24`}>Quy đổi<br /><span className="font-normal text-[10px]">({targetUnit})</span></th>
                            )}
                        </tr>
                        <tr className="bg-gray-100 font-normal">
                            <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">A</th>
                            <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">B</th>
                            <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">C</th>
                            <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">D</th>
                            {hasModule('inbound_financials') && <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">1</th>}
                            <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">{hasModule('inbound_financials') ? '2' : '1'}</th>
                            {hasModule('inbound_conversion') && targetUnit && (
                                <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">{hasModule('inbound_financials') ? '3' : '2'}</th>
                            )}
                            {!isInternal && hasModule('inbound_financials') && <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">{hasModule('inbound_conversion') && targetUnit ? '4' : '3'}</th>}
                            {!isInternal && hasModule('inbound_financials') && <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">{hasModule('inbound_conversion') && targetUnit ? '5' : '4'}</th>}
                            {isInternal && <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">{hasModule('inbound_conversion') && targetUnit ? (hasModule('inbound_financials') ? '4' : '3') : (hasModule('inbound_financials') ? '3' : '2')}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => {
                            const unitPrice = item.price || 0
                            const totalPrice = unitPrice * item.quantity

                            // Calculate converted qty
                            let convertedQty: string | number = '-'
                            let baseQty = 0
                            if (hasModule('inbound_conversion') && targetUnit && item.products) {
                                const product = item.products as any

                                const normalize = (s: string | undefined | null) => s ? s.normalize('NFC').toLowerCase().trim() : ''
                                const itemUnit = normalize(item.unit)
                                const prodUnit = normalize(product.unit)
                                const tgtUnit = normalize(targetUnit)

                                if (itemUnit === prodUnit) {
                                    baseQty = item.quantity
                                } else {
                                    const uConfig = product.product_units?.find((pu: any) => {
                                        if (!pu.unit_id) return false
                                        const mapVal = normalize(unitsMap[pu.unit_id])
                                        return mapVal === itemUnit
                                    })
                                    if (uConfig) baseQty = item.quantity * uConfig.conversion_rate
                                }

                                if (tgtUnit === prodUnit) {
                                    if (baseQty > 0) convertedQty = baseQty
                                } else {
                                    const targetConfig = product.product_units?.find((pu: any) => {
                                        if (!pu.unit_id) return false
                                        const mapVal = normalize(unitsMap[pu.unit_id])
                                        return mapVal === tgtUnit
                                    })
                                    if (targetConfig) convertedQty = baseQty / targetConfig.conversion_rate
                                }

                                if (typeof convertedQty === 'number') {
                                    convertedQty = formatQuantityFull(convertedQty)
                                }
                            }

                            // Calculate names and skus based on toggle
                            const productSource = item.products as any || {}
                            // Fetch conversion rate for "quy cách"
                            let quyCach = ""
                            const normalizeQuyCach = (s: string | undefined | null) => s ? s.normalize('NFC').toLowerCase().trim() : ''
                            if (productSource.product_units && productSource.product_units.length > 0) {
                                // Find the unit mapping for the current item's unit
                                const itemUnitStr = normalizeQuyCach(item.unit)
                                const uConfig = productSource.product_units.find((pu: any) => {
                                    if (!pu.unit_id) return false
                                    return normalizeQuyCach(unitsMap[pu.unit_id]) === itemUnitStr
                                })

                                if (uConfig) {
                                    quyCach = `${item.unit}/${uConfig.conversion_rate}${productSource.unit || ''}`
                                } else {
                                    // Fallback to the first mapping if we can't match the specific one
                                    const firstConfig = productSource.product_units[0]
                                    const mappedUnitName = firstConfig.unit_id ? unitsMap[firstConfig.unit_id] : ''
                                    quyCach = `${mappedUnitName}/${firstConfig.conversion_rate}${productSource.unit || ''}`
                                }
                            } else if (item.unit && productSource.unit && normalizeQuyCach(item.unit) !== normalizeQuyCach(productSource.unit)) {
                                quyCach = `${item.unit}/1${productSource.unit}`
                            }

                            const displayName = displayInternalCode && (item.products as any)?.internal_name
                                ? (item.products as any).internal_name
                                : item.product_name || 'N/A'

                            return (
                                <tr key={item.id} className="hover:bg-gray-50 font-bold">
                                    <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-0.5 py-0.5' : 'px-2 py-1.5'} text-center`}>{index + 1}</td>
                                    <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-1.5'}`}>{displayName}</td>
                                    <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-1.5'} text-center`}>
                                        <EditableText
                                            value={editQuyCach[item.id] !== undefined ? editQuyCach[item.id] : quyCach}
                                            onChange={(val: string) => setEditQuyCach(prev => ({ ...prev, [item.id]: val }))}
                                            className="text-center w-full min-w-0"
                                            isSnapshot={isSnapshotMode}
                                        />
                                    </td>
                                    <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-0.5 py-0.5' : 'px-2 py-1.5'} text-center`}>{item.unit || '-'}</td>
                                    {hasModule('inbound_financials') && (
                                        <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-0.5 py-0.5' : 'px-2 py-1.5'} text-center`}>
                                            <EditableText
                                                value={docQuantities[item.id] !== undefined ? docQuantities[item.id] : (item.document_quantity || item.quantity).toString()}
                                                onChange={(val) => setDocQuantities(prev => ({ ...prev, [item.id]: val }))}
                                                className="text-center w-full min-w-0"
                                                isSnapshot={isSnapshotMode}
                                            />
                                        </td>
                                    )}
                                    <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-0.5 py-0.5' : 'px-2 py-1.5'} text-center`}>
                                        {formatQuantityFull(item.quantity)}
                                    </td>
                                    {hasModule('inbound_conversion') && targetUnit && (
                                        <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-0.5 py-0.5' : 'px-2 py-1.5'} text-center text-stone-800`}>
                                            {typeof convertedQty === 'number' ? formatQuantityFull(convertedQty) : convertedQty}
                                        </td>
                                    )}
                                    {!isInternal && hasModule('inbound_financials') && (
                                        <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-1.5'} text-right`}>
                                            {unitPrice > 0 ? unitPrice.toLocaleString('vi-VN') : '-'}
                                        </td>
                                    )}
                                    {!isInternal && hasModule('inbound_financials') && (
                                        <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-1.5'} text-right uppercase`}>
                                            {totalPrice > 0 ? totalPrice.toLocaleString('vi-VN') : '-'}
                                        </td>
                                    )}
                                    {isInternal && (
                                        <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-1.5'} text-xs text-gray-600`}>
                                            <EditableText
                                                value={editItemNotes[item.id] !== undefined ? editItemNotes[item.id] : (item.note || '')}
                                                onChange={(val: string) => setEditItemNotes(prev => ({ ...prev, [item.id]: val }))}
                                                className="w-full min-w-0"
                                                isSnapshot={isSnapshotMode}
                                            />
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={15} className="border border-gray-400 px-2 py-4 text-center text-gray-400">
                                    Không có hàng hóa
                                </td>
                            </tr>
                        )}
                        {/* Total Row */}
                        <tr className="font-bold print-total-row">
                            <td className="border border-gray-400 px-2 py-1.5 text-center"></td>
                            <td className="border border-gray-400 px-2 py-1.5 text-center">Cộng</td>
                            <td className="border border-gray-400 px-2 py-1.5 text-center">x</td>
                            <td className="border border-gray-400 px-2 py-1.5 text-center">x</td>
                            {hasModule('inbound_financials') && <td className="border border-gray-400 px-2 py-1.5 text-center">x</td>}
                            <td className="border border-gray-400 px-2 py-1.5 text-center">x</td>
                            {hasModule('inbound_conversion') && targetUnit && (
                                <td className="border border-gray-400 px-2 py-1.5 text-center text-orange-600">
                                    {formatQuantityFull(items.reduce((sum, item) => {
                                        if (!item.products) return sum
                                        const product = item.products as any
                                        let baseQty = 0
                                        const normalize = (s: string | undefined | null) => s ? s.normalize('NFC').toLowerCase().trim() : ''
                                        const itemUnit = normalize(item.unit)
                                        const prodUnit = normalize(product.unit)
                                        const tgtUnit = normalize(targetUnit)

                                        if (itemUnit === prodUnit) {
                                            baseQty = item.quantity
                                        } else {
                                            const uConfig = product.product_units?.find((pu: any) => {
                                                if (!pu.unit_id) return false
                                                const mapVal = normalize(unitsMap[pu.unit_id])
                                                return mapVal === itemUnit
                                            })
                                            if (uConfig) baseQty = item.quantity * uConfig.conversion_rate
                                        }

                                        let converted = 0
                                        if (tgtUnit === prodUnit) {
                                            if (baseQty > 0) converted = baseQty
                                        } else {
                                            const targetConfig = product.product_units?.find((pu: any) => {
                                                if (!pu.unit_id) return false
                                                const mapVal = normalize(unitsMap[pu.unit_id])
                                                return mapVal === tgtUnit
                                            })
                                            if (targetConfig) converted = baseQty / targetConfig.conversion_rate
                                        }
                                        return sum + converted
                                    }, 0))}
                                </td>
                            )}
                            {!isInternal && hasModule('inbound_financials') && <td className="border border-gray-400 px-2 py-1.5 text-center">x</td>}
                            {!isInternal && hasModule('inbound_financials') && (
                                <td className="border border-gray-400 px-2 py-1.5 text-right">
                                    {items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0).toLocaleString('vi-VN')}
                                </td>
                            )}
                            {isInternal && <td className="border border-gray-400 px-2 py-1.5 text-center"></td>}
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className={`mt-4 text-sm space-y-1 ${printSize === 'A5' ? 'mb-2' : ''}`}>
                {!isInternal && hasModule('inbound_financials') && (
                    <div className="flex items-center">
                        <span className="shrink-0">- Tổng số tiền (viết bằng chữ):</span>
                        <EditableText
                            value={amountInWords}
                            onChange={setAmountInWords}
                            className="ml-2 flex-1 font-bold italic"
                            isSnapshot={isSnapshot}
                        />
                    </div>
                )}
                {!isInternal && (
                    <div className="flex items-center">
                        <span className="shrink-0">- Số chứng từ gốc kèm theo:</span>
                        <EditableText
                            value={attachedDocs}
                            onChange={setAttachedDocs}
                            className="ml-2 flex-1 font-bold"
                            isSnapshot={isSnapshot}
                        />
                    </div>
                )}
            </div>

            <div className={`mt-0 ${printSize === 'A5' ? 'print:-mt-2' : 'print:-mt-1'} signature-grid grid grid-cols-3 ${printSize === 'A5' ? 'gap-1' : 'gap-4'} text-center text-sm ${printSize === 'A5' ? 'print:break-inside-avoid' : ''}`}>
                <div>
                    <div className="text-sm italic text-center mb-1 invisible">
                        Ngày ... tháng ... năm ...
                    </div>
                    <div className="font-semibold">
                        <input
                            type="text"
                            value={signTitle1}
                            onChange={(e) => setSignTitle1(e.target.value)}
                            className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`}
                        />
                        <span className={`hidden print:inline ${isSnapshotMode ? 'inline' : ''}`}>{signTitle1}</span>
                    </div>
                    <div className="text-xs text-gray-500 italic">(Ký, họ tên)</div>
                    <div className="text-xs text-gray-500 italic invisible">(Hoặc bộ phận có nhu cầu nhập)</div>
                    <div className={`${printSize === 'A5' ? 'print:h-5' : 'print:h-8'}`}></div>
                    <div className="mt-1">
                        <input
                            type="text"
                            value={signPerson1}
                            onChange={(e) => setSignPerson1(e.target.value)}
                            placeholder="Nhập tên..."
                            className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                        />
                        <span className={`hidden print:inline font-bold ${isSnapshotMode ? 'inline' : ''}`}>{signPerson1}</span>
                    </div>
                </div>
                <div>
                    <div className="text-sm italic text-center mb-1 invisible">
                        Ngày ... tháng ... năm ...
                    </div>
                    <div className="font-semibold">
                        <input
                            type="text"
                            value={signTitle2}
                            onChange={(e) => setSignTitle2(e.target.value)}
                            className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`}
                        />
                        <span className={`hidden print:inline ${isSnapshotMode ? 'inline' : ''}`}>{signTitle2}</span>
                    </div>
                    <div className="text-xs text-gray-500 italic">(Ký, họ tên)</div>
                    <div className="text-xs text-gray-500 italic invisible">(Hoặc bộ phận có nhu cầu nhập)</div>
                    <div className={`${printSize === 'A5' ? 'print:h-5' : 'print:h-8'}`}></div>
                    <div className="mt-1">
                        <input
                            type="text"
                            value={signPerson2}
                            onChange={(e) => setSignPerson2(e.target.value)}
                            placeholder="Nhập tên..."
                            className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                        />
                        <span className={`hidden print:inline font-bold ${isSnapshotMode ? 'inline' : ''}`}>{signPerson2}</span>
                    </div>
                </div>
                <div>
                    <div className={`text-sm italic text-center mb-1 ${printSize === 'A5' ? 'print:pr-8' : ''}`}>
                        <span className={`print:hidden ${isSnapshotMode ? 'hidden' : ''}`}>
                            Ngày
                            <input
                                type="text"
                                value={signDay}
                                onChange={(e) => setSignDay(e.target.value)}
                                className="w-8 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500 mx-1 font-bold"
                            />
                            tháng
                            <input
                                type="text"
                                value={signMonth}
                                onChange={(e) => setSignMonth(e.target.value)}
                                className="w-8 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500 mx-1 font-bold"
                            />
                            năm
                            <input
                                type="text"
                                value={signYear}
                                onChange={(e) => setSignYear(e.target.value)}
                                className="w-12 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500 mx-1 font-bold"
                            />
                        </span>
                        <span className={`hidden print:inline ${isSnapshotMode ? 'inline' : ''}`}>
                            Ngày {signDay || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'} tháng {signMonth || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'} năm {signYear || ''}
                        </span>
                    </div>
                    <div className="font-semibold">
                        <input
                            type="text"
                            value={signTitle3}
                            onChange={(e) => setSignTitle3(e.target.value)}
                            className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`}
                        />
                        <span className={`hidden print:inline ${isSnapshotMode ? 'inline' : ''}`}>{signTitle3}</span>
                    </div>
                    <div className="text-xs text-gray-500 italic">(Hoặc bộ phận có nhu cầu nhập)</div>
                    <div className="text-xs text-gray-500 italic">(Ký, họ tên)</div>
                    <div className={`${printSize === 'A5' ? 'print:h-4' : 'print:h-8'}`}></div>
                    <div className="mt-1">
                        <input
                            type="text"
                            value={signPerson3}
                            onChange={(e) => setSignPerson3(e.target.value)}
                            placeholder="Nhập tên..."
                            className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                        />
                        <span className={`hidden print:inline font-bold ${isSnapshotMode ? 'inline' : ''}`}>{signPerson3}</span>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    @page {
                        /* 210mm width x 148mm height - standard for continuous dot matrix half-A4 paper */
                        size: ${printSize === 'A5' ? '210mm 148mm' : 'A4'};
                        margin: ${printSize === 'A5' ? '3mm 5mm 2mm 5mm' : '1mm 10mm 10mm 10mm'};
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    #print-ready {
                        ${printSize === 'A5' ? `
                            /* Normal 100% width on 210mm paper, let natural wrapping apply */
                        ` : ''}
                    }
                    ${printSize === 'A5' ? `
                    .print-a5-super-compact {
                        font-size: 11px !important;
                        line-height: 1.15 !important;
                    }
                    .print-a5-super-compact * {
                        line-height: 1.15 !important;
                    }
                    .print-a5-super-compact h1 {
                        font-size: 14px !important;
                        margin-top: 2px !important;
                        margin-bottom: 2px !important;
                    }
                    .print-a5-super-compact table th,
                    .print-a5-super-compact table td {
                        padding: 2px 4px !important;
                        font-size: 11px !important;
                    }
                    .print-a5-super-compact .print-total-row td {
                        padding-top: 8px !important;
                        padding-bottom: 8px !important;
                    }
                    .print-a5-super-compact .pb-6 {
                        padding-bottom: 2px !important;
                    }
                    .print-a5-super-compact .signature-grid {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .print-a5-super-compact img {
                        max-height: 25px !important;
                    }
                    thead {
                        display: table-row-group !important;
                    }
                    table {
                        page-break-inside: avoid !important;
                    }
                    ` : ''}
                    .no-print {
                        display: none !important;
                    }
                }

                /* Force all text in the print area to be black, both on screen and when printed */
                #print-ready * {
                    color: black !important;
                }
            `}</style>

            {isSnapshot && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    html, body {
                        background: white !important;
                        height: fit-content !important;
                        min-height: 0 !important;
                        width: 1240px !important;
                        min-width: 1240px !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                    }
                    .min-h-screen {
                        min-height: 0 !important;
                        height: auto !important;
                    }
                    body::before {
                        display: none !important;
                    }
                    #print-ready {
                        width: 1240px !important;
                        height: fit-content !important;
                        padding: 30px 30px 0 30px !important;
                        margin: 0 auto !important;
                        max-width: none !important;
                        box-shadow: none !important;
                        border: none !important;
                        box-sizing: border-box !important;
                    }
                `}} />
            )}

            <img
                src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                alt="QR"
                className="block w-full h-[1px] opacity-0 pointer-events-none"
            />
        </div>
    )
}
