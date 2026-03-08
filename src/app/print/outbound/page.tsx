'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Printer, Loader2, Download, Hash, FileSpreadsheet } from 'lucide-react'
import { exportToExcel } from '@/lib/excelExport'
import { toJpeg } from 'html-to-image'
import { useCaptureReceipt } from '@/hooks/useCaptureReceipt'
import { formatQuantityFull } from '@/lib/numberUtils'
import { usePrintCompanyInfo, CompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { PrintHeader, PrintLegalHeader } from '@/components/print/PrintHeader'
import { EditableText, numberToVietnameseText } from '@/components/print/PrintHelpers'
import { PrintActionMenu } from '@/components/print/PrintActionMenu'

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

interface OutboundOrder {
    id: string
    code: string
    status: string
    created_at: string
    warehouse_name: string | null
    description: string | null
    customer_name: string | null
    customer_address: string | null
    customer_phone: string | null
    metadata: any
    system_code?: string
    company_id?: string
}

export default function OutboundPrintPage() {
    return (
        <React.Suspense fallback={<div className="p-8 text-center">Đang tải...</div>}>
            <OutboundPrintContent />
        </React.Suspense>
    )
}

function OutboundPrintContent() {
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
    const [order, setOrder] = useState<OutboundOrder | null>(null)
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
        const modules = typeof systemConfig.outbound_modules === 'string'
            ? JSON.parse(systemConfig.outbound_modules)
            : systemConfig.outbound_modules
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
    const [editCustomerName, setEditCustomerName] = useState('')
    const [editCustomerAddress, setEditCustomerAddress] = useState('')
    const [editReason, setEditReason] = useState('')
    const [editWarehouse, setEditWarehouse] = useState('')
    const [editLocation, setEditLocation] = useState(cmpAddress || '')
    const [editDescription, setEditDescription] = useState('')
    const [amountInWords, setAmountInWords] = useState('')
    const [attachedDocs, setAttachedDocs] = useState('')

    // Editable signature fields
    const [signTitle1, setSignTitle1] = useState('Người nhận')
    const [signTitle2, setSignTitle2] = useState('Thủ kho')
    const [signTitle3, setSignTitle3] = useState('Kế toán trưởng')
    const [signTitle4, setSignTitle4] = useState('TP.QLCL')
    const [signPerson1, setSignPerson1] = useState('')
    const [signPerson2, setSignPerson2] = useState('')
    const [signPerson3, setSignPerson3] = useState('')
    const [signPerson4, setSignPerson4] = useState('')
    const [signDay, setSignDay] = useState('')
    const [signMonth, setSignMonth] = useState('')
    const [signYear, setSignYear] = useState('')

    // Accounting fields (Nợ / Có)
    const [debitAccount, setDebitAccount] = useState('')
    const [creditAccount, setCreditAccount] = useState('')

    // General note field
    const [editNote, setEditNote] = useState('')

    // Quy cách overrides
    const [editQuyCachTitle, setEditQuyCachTitle] = useState('Quy cách')
    const [editQuyCach, setEditQuyCach] = useState<Record<string, string>>({})

    // Note column editable fields
    const [editNoteTitle, setEditNoteTitle] = useState('Ghi chú')
    const [editItemNotes, setEditItemNotes] = useState<Record<string, string>>({})

    // Transport info fields
    const [editVehicleNumber, setEditVehicleNumber] = useState('')
    const [editContainerNumber, setEditContainerNumber] = useState('')
    const [editSealNumber, setEditSealNumber] = useState('')

    // New 5th signature for driver
    const [signTitle5, setSignTitle5] = useState('Tài xế')
    const [signPerson5, setSignPerson5] = useState('')

    // Print size state
    const [printSize, setPrintSize] = useState<'A4' | 'A5'>('A4')

    // Capture and snapshot state
    const [isDownloading, setIsDownloading] = useState(false)
    const { isCapturing, downloadTimer, handleCapture } = useCaptureReceipt({
        fileNamePrefix: `Phieu_xuat_${order?.code || 'scan'}`
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

                // Fetch order FIRST if not passed (to get company_id)
                let orderData = passedOrderData
                if (!orderData) {
                    const { data } = await supabase
                        .from('outbound_orders')
                        .select('*, company_id')
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

                    // Set editable fields from order data OR URL params
                    const d = new Date(o.created_at)
                    if (!isNaN(d.getTime())) {
                        setEditDay(searchParams.get('editDay') || d.getDate().toString())
                        setEditMonth(searchParams.get('editMonth') || (d.getMonth() + 1).toString())
                        setEditYear(searchParams.get('editYear') || d.getFullYear().toString())
                    }
                    setEditCustomerName(searchParams.get('editCustomerName') || o.customer_name || '')
                    setEditCustomerAddress(searchParams.get('editCustomerAddress') || o.customer_address || '')
                    setEditWarehouse(searchParams.get('editWarehouse') || o.warehouse_name || 'Kho mặc định')
                    setEditDescription(searchParams.get('editDescription') || o.description || '')
                    setEditReason(searchParams.get('editReason') || o.description || '')
                    // setEditLocation handled by useEffect

                    setAmountInWords(searchParams.get('amountInWords') || '')
                    setAttachedDocs(searchParams.get('attachedDocs') || '')

                    setSignTitle1(searchParams.get('signTitle1') || 'Người nhận')
                    setSignTitle2(searchParams.get('signTitle2') || 'Thủ kho')
                    setSignTitle3(searchParams.get('signTitle3') || 'Kế toán trưởng')
                    setSignTitle4(searchParams.get('signTitle4') || 'TP.QLCL')

                    setSignPerson1(searchParams.get('signPerson1') || '')
                    setSignPerson2(searchParams.get('signPerson2') || '')
                    setSignPerson3(searchParams.get('signPerson3') || '')
                    setSignPerson4(searchParams.get('signPerson4') || '')

                    setSignDay(searchParams.get('signDay') || '')
                    setSignMonth(searchParams.get('signMonth') || '')
                    setSignYear(searchParams.get('signYear') || '')

                    setDebitAccount(searchParams.get('debitAccount') || '')
                    setCreditAccount(searchParams.get('creditAccount') || '')
                    setEditNote(searchParams.get('editNote') || '')
                    setEditVehicleNumber(searchParams.get('editVehicleNumber') || o.metadata?.vehicleNumber || '')
                    setEditContainerNumber(searchParams.get('editContainerNumber') || o.metadata?.containerNumber || '')
                    setEditSealNumber(searchParams.get('editSealNumber') || o.metadata?.sealNumber || '')
                    setSignTitle5(searchParams.get('signTitle5') || 'Tài xế')
                    setSignPerson5(searchParams.get('signPerson5') || o.metadata?.driverName || '')

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
                    if (unitsData) {
                        const map: Record<string, string> = {}
                        unitsData.forEach((u: any) => map[u.id] = u.name)
                        setUnitsMap(map)
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
                            .from('outbound_order_items')
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

    const handleExcelExport = async () => {
        if (!order) return

        // Map items with quy cach and converted qty
        const exportItems = items.map(item => {
            const productSource = item.products as any || {}
            let quyCachStr = ""
            const normalizeQuyCachLocal = (s: string | undefined | null) => s ? s.normalize('NFC').toLowerCase().trim() : ''

            if (productSource.product_units && productSource.product_units.length > 0) {
                const itemUnitStr = normalizeQuyCachLocal(item.unit)
                const uConfig = productSource.product_units.find((pu: any) => {
                    if (!pu.unit_id) return false
                    return normalizeQuyCachLocal(unitsMap[pu.unit_id]) === itemUnitStr
                })
                if (uConfig) quyCachStr = `${item.unit}/${uConfig.conversion_rate}${productSource.unit || ''}`
                else {
                    const firstConfig = productSource.product_units[0]
                    const mappedUnitName = firstConfig.unit_id ? unitsMap[firstConfig.unit_id] : ''
                    quyCachStr = `${mappedUnitName}/${firstConfig.conversion_rate}${productSource.unit || ''}`
                }
            } else if (item.unit && productSource.unit && normalizeQuyCachLocal(item.unit) !== normalizeQuyCachLocal(productSource.unit)) {
                quyCachStr = `${item.unit}/1${productSource.unit}`
            }

            // Converted Qty calculation (redundant but necessary for export)
            let convertedQtyValue: any = '-'
            if (hasModule('outbound_conversion') && targetUnit && item.products) {
                const product = item.products as any
                let baseQty = 0
                const normalizeLocal = (s: string | undefined | null) => s ? s.normalize('NFC').toLowerCase().trim() : ''
                const itemUnit = normalizeLocal(item.unit)
                const prodUnit = normalizeLocal(product.unit)
                const tgtUnit = normalizeLocal(targetUnit)

                if (itemUnit === prodUnit) baseQty = item.quantity
                else {
                    const uConfig = product.product_units?.find((pu: any) => {
                        if (!pu.unit_id) return false
                        const mapVal = normalizeLocal(unitsMap[pu.unit_id])
                        return mapVal === itemUnit
                    })
                    if (uConfig) baseQty = item.quantity * uConfig.conversion_rate
                }

                if (tgtUnit === prodUnit) {
                    if (baseQty > 0) convertedQtyValue = baseQty
                } else {
                    const targetConfig = product.product_units?.find((pu: any) => {
                        if (!pu.unit_id) return false
                        const mapVal = normalizeLocal(unitsMap[pu.unit_id])
                        return mapVal === tgtUnit
                    })
                    if (targetConfig) convertedQtyValue = baseQty / targetConfig.conversion_rate
                }
            }

            return {
                ...item,
                product_name: displayInternalCode && productSource.internal_name ? productSource.internal_name : item.product_name || 'N/A',
                quyCach: editQuyCach[item.id] !== undefined ? editQuyCach[item.id] : quyCachStr,
                convertedQty: convertedQtyValue,
                document_quantity: docQuantities[item.id] !== undefined ? parseFloat(docQuantities[item.id]) : (item.document_quantity || item.quantity)
            }
        })

        const signatures = [
            { title: signTitle1, name: signPerson1 },
            { title: signTitle5, name: signPerson5 },
            { title: signTitle4, name: signPerson4 },
            { title: signTitle2, name: signPerson2 },
            { title: signTitle3, name: signPerson3 }
        ]

        await exportToExcel({
            type: 'outbound',
            printType: isInternal ? 'internal' : 'official',
            order,
            items: exportItems,
            companyInfo,
            editableFields: {
                customerSupplierName: editCustomerName,
                customerSupplierAddress: editCustomerAddress,
                reasonDescription: editReason,
                warehouse: editWarehouse,
                location: editLocation,
                note: editNote,
                day: editDay,
                month: editMonth,
                year: editYear,
                debitAccount,
                creditAccount,
                amountInWords,
                attachedDocs,
                vehicleNumber: editVehicleNumber,
                containerNumber: editContainerNumber,
                sealNumber: editSealNumber,
                signatures,
                signDate: {
                    day: signDay,
                    month: signMonth,
                    year: signYear
                }
            },
            modules: {
                hasFinancials: hasModule('outbound_financials'),
                hasConversion: hasModule('outbound_conversion'),
                targetUnit
            }
        })
    }

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
                <div className="text-red-500">Không tìm thấy phiếu xuất</div>
            </div>
        )
    }

    return (
        <div id="print-ready" data-ready={!loading && order && items.length >= 0 && (!hasModule('outbound_conversion') || !targetUnit || Object.keys(unitsMap).length > 0) ? "true" : undefined} className={`pt-0 px-6 pb-6 print:p-0 print:pt-0 print:px-0 w-full max-w-4xl print:max-w-none print:w-full print:mx-0 mx-auto bg-white text-black text-[13px] ${printSize === 'A5' ? 'print:text-[12px]' : 'print:text-[13px]'} leading-relaxed ${isCapturing ? 'shadow-none !max-w-none !w-[1150px]' : ''}`}>
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
            {printSize === 'A5' && !isCapturing && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page {
                            /* Removed 'size: 210mm 148mm;' because Chrome has a known bug explicitly forcing width to 148mm when specifying this on A5 landscape */
                            margin: 5mm 5mm 5mm 5mm;
                        }
                        body, html {
                            margin: 0 !important;
                            padding: 0 !important;
                            width: auto !important;
                            height: auto !important;
                        }
                        #print-ready {
                            width: auto !important;
                            max-width: none !important;
                            height: auto !important;
                            max-height: none !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                    }
                `}} />
            )}
            {printSize === 'A4' && !isCapturing && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page {
                            size: A4 portrait;
                            margin: 15mm 15mm 15mm 15mm;
                        }
                    }
                `}} />
            )}
            {/* Consolidated Menu */}
            <PrintActionMenu
                printSize={printSize}
                onPrintSizeChange={() => setPrintSize(prev => prev === 'A4' ? 'A5' : 'A4')}
                isDownloading={isDownloadingState}
                downloadTimer={downloadTimer}
                onDownload={handleDownload}
                displayInternalCode={displayInternalCode}
                onDisplayInternalCodeChange={() => setDisplayInternalCode(!displayInternalCode)}
                onPrint={handlePrint}
                onExcelExport={handleExcelExport}
            />

            {/* Header with Shared Component */}
            <PrintHeader
                companyInfo={companyInfo}
                logoSrc={logoSrc}
                size={isInternal ? 'large' : 'compact'}
                rightContent={!isInternal && <PrintLegalHeader formNumber="02" />}
                isA5={printSize === 'A5'}
            />

            {/* Title */}
            <div className={`relative text-center ${printSize === 'A5' ? 'mt-2 mb-1' : 'mt-4 mb-1'}`}>
                <h1 className={`${printSize === 'A5' ? 'text-lg' : 'text-xl'} font-bold tracking-wide`} style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                    PHIẾU XUẤT KHO
                </h1>

                {!isInternal && hasModule('outbound_financials') && (
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

            <div className={`mt-4 ${printSize === 'A5' ? 'print:mt-2 pb-1' : 'print:mt-4'} space-y-2 ${printSize === 'A5' ? 'print:space-y-1' : 'print:space-y-0'} text-sm ${printSize === 'A5' ? 'print:text-[11px]' : ''}`}>
                <div className={`flex items-start ${printSize === 'A5' ? 'leading-tight' : ''}`}>
                    <span className="text-gray-600 shrink-0 mt-0.5">- Họ tên người nhận hàng:</span>
                    <EditableText
                        value={editCustomerName}
                        onChange={setEditCustomerName}
                        className="ml-2 flex-1 font-bold"
                        isSnapshot={isSnapshot}
                    />
                </div>
                <div className={`flex items-start ${printSize === 'A5' ? 'leading-tight' : ''}`}>
                    <span className="text-gray-600 shrink-0 mt-0.5">- Địa chỉ ( bộ phận ):</span>
                    <EditableText
                        value={editCustomerAddress}
                        onChange={setEditCustomerAddress}
                        className="ml-2 flex-1 font-bold"
                        isSnapshot={isSnapshot}
                    />
                </div>
                <div className={`flex items-start ${printSize === 'A5' ? 'leading-tight' : ''}`}>
                    <span className="text-gray-600 shrink-0 mt-0.5">- Lý do xuất kho:</span>
                    <EditableText
                        value={editReason}
                        onChange={setEditReason}
                        className="ml-2 flex-1 font-bold"
                        isSnapshot={isSnapshot}
                    />
                </div>
                <div className={`flex items-start flex-wrap ${printSize === 'A5' ? 'leading-tight' : ''} gap-x-8 gap-y-1 print:gap-x-2`}>
                    <div className="flex items-start">
                        <span className="text-gray-600 shrink-0 mt-0.5">- Xuất tại kho:</span>
                        <EditableText
                            value={editWarehouse}
                            onChange={setEditWarehouse}
                            className="ml-2 font-bold"
                            isSnapshot={isSnapshotMode}
                        />
                    </div>
                    <div className="flex items-start flex-1 min-w-[200px]">
                        <span className="text-gray-600 shrink-0 mt-0.5">Địa điểm:</span>
                        <input
                            type="text"
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} flex-1 ml-2 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                        />
                        <span className={`hidden print:inline ml-2 flex-1 font-bold break-words whitespace-normal ${isSnapshotMode ? 'inline' : ''}`}>{editLocation || '\u00A0'}</span>
                    </div>
                </div>
                <div className={`flex items-start ${printSize === 'A5' ? 'leading-tight' : ''}`}>
                    <span className="text-gray-600 shrink-0 mt-0.5">- Ghi chú:</span>
                    <input
                        type="text"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} flex-1 ml-2 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                    />
                    <span className={`hidden print:inline ml-2 flex-1 font-bold break-words whitespace-normal ${isSnapshotMode ? 'inline' : ''}`}>{editNote || '\u00A0'}</span>
                </div>
                <div className={`flex items-center gap-6 ${printSize === 'A5' ? 'leading-none h-4' : ''}`}>
                    <div className="flex items-center">
                        <span className="text-gray-600 shrink-0">- Biển số xe:</span>
                        <input
                            type="text"
                            value={editVehicleNumber}
                            onChange={(e) => setEditVehicleNumber(e.target.value)}
                            className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} ml-2 w-28 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                        />
                        <span className={`hidden print:inline ml-2 min-w-[50px] font-bold ${isSnapshotMode ? 'inline' : ''}`}>{editVehicleNumber || '\u00A0'}</span>
                    </div>
                    <div className="flex items-center">
                        <span className="text-gray-600 shrink-0">Số cont:</span>
                        <input
                            type="text"
                            value={editContainerNumber}
                            onChange={(e) => setEditContainerNumber(e.target.value)}
                            className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} ml-2 w-32 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                        />
                        <span className={`hidden print:inline ml-2 min-w-[50px] font-bold ${isSnapshotMode ? 'inline' : ''}`}>{editContainerNumber || '\u00A0'}</span>
                    </div>
                    <div className="flex items-center flex-1">
                        <span className="text-gray-600 shrink-0">Số seal:</span>
                        <input
                            type="text"
                            value={editSealNumber}
                            onChange={(e) => setEditSealNumber(e.target.value)}
                            className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} ml-2 flex-1 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                        />
                        <span className={`hidden print:inline ml-2 min-w-[50px] font-bold ${isSnapshotMode ? 'inline' : ''}`}>{editSealNumber || '\u00A0'}</span>
                    </div>
                </div>
            </div>

            <div className={`mt-6 ${printSize === 'A5' ? 'print:mt-2' : 'print:mt-1'} w-full`}>
                <table className={`w-full print:w-full border-collapse text-sm ${printSize === 'A5' ? 'print:table-fixed' : ''}`} style={{ width: '100%' }}>
                    <thead>
                        <tr className="bg-gray-100">
                            <th rowSpan={2} className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5 print:w-[5%]' : 'px-2 py-2 w-10'} text-center`}>STT</th>
                            <th rowSpan={2} className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5 print:w-[26%] break-words' : 'px-2 py-2 w-60'} text-center`}>Tên, nhãn hiệu quy cách, phẩm chất vật tư, dụng cụ sản phẩm, hàng hóa</th>
                            <th rowSpan={2} className={`border border-gray-400 px-2 py-2 text-center ${printSize === 'A5' ? 'print:w-[15%]' : 'w-24'}`}>
                                <EditableText
                                    value={editQuyCachTitle}
                                    onChange={setEditQuyCachTitle}
                                    className="text-center font-bold min-w-0 w-full"
                                    isSnapshot={isSnapshotMode}
                                />
                            </th>
                            <th rowSpan={2} className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5 print:w-[10%]' : 'px-2 py-2 w-14'} text-center`}>Đơn vị tính</th>
                            <th colSpan={hasModule('outbound_conversion') && targetUnit ? (hasModule('outbound_financials') ? 3 : 2) : (hasModule('outbound_financials') ? 2 : 1)} className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-2'} text-center`}>Số lượng</th>
                            {!isInternal && hasModule('outbound_financials') && <th rowSpan={2} className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5 print:w-[12%]' : 'px-2 py-2 w-24'} text-center`}>Đơn giá</th>}
                            {!isInternal && hasModule('outbound_financials') && <th rowSpan={2} className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5 print:w-[12%]' : 'px-2 py-2 w-28'} text-center`}>Thành tiền</th>}
                            {isInternal && (
                                <th rowSpan={2} className={`border border-gray-400 px-2 py-2 text-center ${printSize === 'A5' ? 'print:w-[12%]' : 'w-16'}`}>
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
                            {hasModule('outbound_financials') && <th className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5 print:w-[10%]' : 'px-2 py-2 w-20'} text-center align-top`}>Yêu cầu</th>}
                            <th className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5 print:w-[10%]' : 'px-2 py-2 w-20'} text-center align-top`}>Thực xuất</th>
                            {hasModule('outbound_conversion') && targetUnit && (
                                <th className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5 print:w-[12%]' : 'px-2 py-2 w-24'} text-center`}>Quy đổi<br /><span className="font-normal text-[10px]">({targetUnit})</span></th>
                            )}
                        </tr>
                        <tr className="bg-gray-100 font-normal">
                            <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">A</th>
                            <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">B</th>
                            <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">C</th>
                            <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">D</th>
                            {hasModule('outbound_financials') && <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">1</th>}
                            <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">{hasModule('outbound_financials') ? '2' : '1'}</th>
                            {hasModule('outbound_conversion') && targetUnit && (
                                <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">{hasModule('outbound_financials') ? '3' : '2'}</th>
                            )}
                            {!isInternal && hasModule('outbound_financials') && <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">{hasModule('outbound_conversion') && targetUnit ? '4' : '3'}</th>}
                            {!isInternal && hasModule('outbound_financials') && <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">{hasModule('outbound_conversion') && targetUnit ? '5' : '4'}</th>}
                            {isInternal && <th className="border border-gray-400 px-2 py-1 text-center italic font-normal">{hasModule('outbound_conversion') && targetUnit ? (hasModule('outbound_financials') ? '4' : '3') : (hasModule('outbound_financials') ? '3' : '2')}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => {
                            const unitPrice = item.price || 0
                            const totalPrice = unitPrice * item.quantity

                            // Calculate converted qty
                            let convertedQty: string | number = '-'
                            if (hasModule('outbound_conversion') && targetUnit && item.products) {
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

                            const displayName = displayInternalCode && productSource.internal_name ? productSource.internal_name : item.product_name || 'N/A'

                            return (
                                <tr key={item.id} className="hover:bg-gray-50 font-bold">
                                    <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-0.5 py-0.5 max-w-0 overflow-hidden' : 'px-2 py-1.5'} text-center`}>{index + 1}</td>
                                    <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5 text-[11px] leading-tight max-w-0 break-words whitespace-normal' : 'px-2 py-1.5'}`}>{displayName}</td>
                                    <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5 max-w-0' : 'px-2 py-1.5'} text-center`}>
                                        <EditableText
                                            value={editQuyCach[item.id] !== undefined ? editQuyCach[item.id] : quyCach}
                                            onChange={(val: string) => setEditQuyCach(prev => ({ ...prev, [item.id]: val }))}
                                            className="text-center w-full min-w-0"
                                            isSnapshot={isSnapshotMode}
                                        />
                                    </td>
                                    <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-0.5 py-0.5' : 'px-2 py-1.5'} text-center`}>{item.unit || '-'}</td>
                                    {hasModule('outbound_financials') && (
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
                                    {hasModule('outbound_conversion') && targetUnit && (
                                        <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-1.5'} text-center text-stone-800`}>
                                            {typeof convertedQty === 'number' ? formatQuantityFull(convertedQty) : convertedQty}
                                        </td>
                                    )}
                                    {!isInternal && hasModule('outbound_financials') && (
                                        <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-1.5'} text-right`}>
                                            {unitPrice > 0 ? unitPrice.toLocaleString('vi-VN') : '-'}
                                        </td>
                                    )}
                                    {!isInternal && hasModule('outbound_financials') && (
                                        <td className={`border border-gray-400 ${printSize === 'A5' ? 'px-1 py-0.5' : 'px-2 py-1.5'} text-right`}>
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
                                <td colSpan={12} className="border border-gray-400 px-2 py-4 text-center text-gray-400">
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

                            {hasModule('outbound_financials') && <td className="border border-gray-400 px-2 py-1.5 text-center">x</td>}

                            {/* Quantity Total */}
                            <td className="border border-gray-400 px-2 py-1.5 text-center">
                                {formatQuantityFull(items.reduce((sum, item) => sum + item.quantity, 0))}
                            </td>

                            {/* Converted Total - Placeholder */}
                            {hasModule('outbound_conversion') && targetUnit && (
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

                            {!isInternal && hasModule('outbound_financials') && <td className="border border-gray-400 px-2 py-1.5 text-center">x</td>}
                            {!isInternal && hasModule('outbound_financials') && (
                                <td className="border border-gray-400 px-2 py-1.5 text-right">
                                    {items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0).toLocaleString('vi-VN')}
                                </td>
                            )}
                            {isInternal && <td className="border border-gray-400 px-2 py-1.5 text-center"></td>}
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className={`mt-2 ${printSize === 'A5' ? 'print:mt-0 pb-1' : 'print:mt-4'} text-sm space-y-1 ${printSize === 'A5' ? 'mb-0' : 'mb-2'}`}>
                {!isInternal && hasModule('outbound_financials') && (
                    <div className="flex items-center">
                        <span className="shrink-0">- Tổng số tiền (viết bằng chữ):</span>
                        <EditableText
                            value={amountInWords}
                            onChange={setAmountInWords}
                            className="ml-2 flex-1 font-medium italic"
                            isSnapshot={isSnapshotMode}
                        />
                    </div>
                )}
                {!isInternal && (
                    <div className="flex items-center">
                        <span className="shrink-0">- Số chứng từ gốc kèm theo:</span>
                        <EditableText
                            value={attachedDocs}
                            onChange={setAttachedDocs}
                            className="ml-2 flex-1 font-medium"
                            isSnapshot={isSnapshotMode}
                        />
                    </div>
                )}
            </div>

            <div className={`mt-0 ${printSize === 'A5' ? 'print:mt-1 print:pb-0' : 'print:-mt-1'} signature-grid grid ${printSize === 'A5' ? 'grid-cols-5' : 'grid-cols-[1fr_1fr_1fr_1fr_1.4fr]'} ${printSize === 'A5' ? 'gap-0.5' : 'gap-3'} text-center text-sm items-end ${printSize === 'A5' ? 'print:break-inside-avoid' : ''}`}>
                {/* 1. Ngày tháng năm row */}
                <div className="invisible">Ngày ... tháng ... năm ...</div>
                <div className="invisible">Ngày ... tháng ... năm ...</div>
                <div className="invisible">Ngày ... tháng ... năm ...</div>
                <div className={`col-span-2 text-sm italic text-center whitespace-nowrap pr-4`}>
                    <span className={`print:hidden ${isSnapshotMode ? 'hidden' : ''}`}>
                        Ngày
                        <input type="text" value={signDay} onChange={(e) => setSignDay(e.target.value)}
                            className="w-5 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500 mx-0.5 font-bold" />
                        tháng
                        <input type="text" value={signMonth} onChange={(e) => setSignMonth(e.target.value)}
                            className="w-5 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500 mx-0.5 font-bold" />
                        năm
                        <input type="text" value={signYear} onChange={(e) => setSignYear(e.target.value)}
                            className="w-11 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500 mx-0.5 font-bold" />
                    </span>
                    <span className={`hidden print:inline ${isSnapshotMode ? 'inline' : ''}`}>
                        Ngày {signDay || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'} tháng {signMonth || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'} năm {signYear || ''}
                    </span>
                </div>

                {/* 2. Chức danh row */}
                <div className="font-semibold print:pt-3">
                    <input type="text" value={signTitle1} onChange={(e) => setSignTitle1(e.target.value)}
                        className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`} />
                    <span className={`hidden print:inline ${isSnapshotMode ? 'inline' : ''}`}>{signTitle1}</span>
                </div>
                <div className="font-semibold print:pt-3">
                    <input type="text" value={signTitle5} onChange={(e) => setSignTitle5(e.target.value)}
                        className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`} />
                    <span className={`hidden print:inline ${isSnapshotMode ? 'inline' : ''}`}>{signTitle5}</span>
                </div>
                <div className="font-semibold print:pt-3">
                    <input type="text" value={signTitle4} onChange={(e) => setSignTitle4(e.target.value)}
                        className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`} />
                    <span className={`hidden print:inline ${isSnapshotMode ? 'inline' : ''}`}>{signTitle4}</span>
                </div>
                <div className="font-semibold print:pt-3">
                    <input type="text" value={signTitle2} onChange={(e) => setSignTitle2(e.target.value)}
                        className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`} />
                    <span className={`hidden print:inline ${isSnapshotMode ? 'inline' : ''}`}>{signTitle2}</span>
                </div>
                <div className="font-semibold print:pt-3">
                    <input type="text" value={signTitle3} onChange={(e) => setSignTitle3(e.target.value)}
                        className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`} />
                    <span className={`hidden print:inline ${isSnapshotMode ? 'inline' : ''}`}>{signTitle3}</span>
                </div>

                {/* 3. Instruction & Label (Ký, họ tên) row */}
                <div className={`text-xs text-gray-500 italic self-start pb-6 ${printSize === 'A5' ? 'print:hidden' : 'print:pb-10'}`}>(Ký, họ tên)</div>
                <div className={`text-xs text-gray-500 italic self-start pb-6 ${printSize === 'A5' ? 'print:hidden' : 'print:pb-10'}`}>(Ký, họ tên)</div>
                <div className={`text-xs text-gray-500 italic self-start pb-6 ${printSize === 'A5' ? 'print:hidden' : 'print:pb-10'}`}>(Ký, họ tên)</div>
                <div className={`text-xs text-gray-500 italic self-start pb-6 ${printSize === 'A5' ? 'print:hidden' : 'print:pb-10'}`}>(Ký, họ tên)</div>
                <div className={`text-xs text-gray-500 italic self-start whitespace-nowrap ${printSize === 'A5' ? 'print:hidden' : ''}`}>
                    <div className="text-gray-500">(Hoặc bộ phận có nhu cầu xuất)</div>
                    <div className={`text-gray-500 pb-6 ${printSize === 'A5' ? 'print:pb-1' : 'print:pb-10'}`}>(Ký, họ tên)</div>
                </div>


                {/* 5. Spacer */}
                <div className={`${printSize === 'A5' ? 'print:h-4' : 'print:h-2'}`}></div>
                <div className={`${printSize === 'A5' ? 'print:h-4' : 'print:h-2'}`}></div>
                <div className={`${printSize === 'A5' ? 'print:h-4' : 'print:h-2'}`}></div>
                <div className={`${printSize === 'A5' ? 'print:h-4' : 'print:h-2'}`}></div>
                <div className={`${printSize === 'A5' ? 'print:h-4' : 'print:h-2'}`}></div>

                {/* 6. Họ tên row */}
                <div>
                    <input type="text" value={signPerson1} onChange={(e) => setSignPerson1(e.target.value)}
                        placeholder="Nhập tên..."
                        className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`} />
                    <span className={`hidden print:inline font-semibold whitespace-nowrap ${isSnapshotMode ? 'inline' : ''}`}>{signPerson1}</span>
                </div>
                <div>
                    <input type="text" value={signPerson5} onChange={(e) => setSignPerson5(e.target.value)}
                        placeholder="Nhập tên..."
                        className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`} />
                    <span className={`hidden print:inline font-semibold whitespace-nowrap ${isSnapshotMode ? 'inline' : ''}`}>{signPerson5}</span>
                </div>
                <div>
                    <input type="text" value={signPerson4} onChange={(e) => setSignPerson4(e.target.value)}
                        placeholder="Nhập tên..."
                        className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`} />
                    <span className={`hidden print:inline font-semibold whitespace-nowrap ${isSnapshotMode ? 'inline' : ''}`}>{signPerson4}</span>
                </div>
                <div>
                    <input type="text" value={signPerson2} onChange={(e) => setSignPerson2(e.target.value)}
                        placeholder="Nhập tên..."
                        className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`} />
                    <span className={`hidden print:inline font-semibold whitespace-nowrap ${isSnapshotMode ? 'inline' : ''}`}>{signPerson2}</span>
                </div>
                <div>
                    <input type="text" value={signPerson3} onChange={(e) => setSignPerson3(e.target.value)}
                        placeholder="Nhập tên..."
                        className={`print:hidden ${isSnapshotMode ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`} />
                    <span className={`hidden print:inline font-semibold whitespace-nowrap ${isSnapshotMode ? 'inline' : ''}`}>{signPerson3}</span>
                </div>
            </div>


            <style jsx global>{`
                @media print {
                    @page {
                        size: ${printSize === 'A5' ? '148mm 210mm' : 'portrait'};
                        margin: ${printSize === 'A5' ? '3mm 6mm 2mm 3mm' : '1mm 10mm 10mm 10mm'};
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    ${printSize === 'A5' ? `
                    /* === A5 FULL PAGE PRINT === */
                    /* A5 = 148mm x 210mm, margins 3mm each side = 142mm x 205mm printable */
                    
                    html {
                        width: 142mm !important;
                        overflow: visible !important;
                    }
                    body {
                        width: 142mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                    }
                    #print-ready {
                        width: 142mm !important;
                        max-width: 142mm !important;
                        min-width: 142mm !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        box-sizing: border-box !important;
                        font-size: 9px !important;
                        line-height: 1.15 !important;
                    }
                    #print-ready * {
                        line-height: 1.15 !important;
                    }
                    #print-ready h1 {
                        font-size: 11px !important;
                        margin-top: 0px !important;
                        margin-bottom: 0px !important;
                    }
                    
                    /* Table: fill full width, auto column sizing */
                    #print-ready table {
                        width: 100% !important;
                        max-width: 142mm !important;
                        table-layout: auto !important;
                    }
                    /* Remove ALL fixed Tailwind width classes on table cells */
                    #print-ready table th,
                    #print-ready table td {
                        width: auto !important;
                        min-width: 0 !important;
                        max-width: none !important;
                        padding: 1px 3px !important;
                        font-size: 10px !important;
                        word-break: break-word !important;
                        overflow-wrap: break-word !important;
                    }
                    #print-ready .print-total-row td {
                        padding-top: 4px !important;
                        padding-bottom: 4px !important;
                    }
                    
                    /* Signature section compact */
                    #print-ready .signature-grid {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        gap: 2px !important;
                    }
                    #print-ready .pb-6 {
                        padding-bottom: 1px !important;
                    }
                    #print-ready img:not([alt="Logo"]) {
                        max-height: 20px !important;
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

            {
                isSnapshot && (
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
                )
            }

            <img
                src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                alt="QR"
                className="block w-full h-[1px] opacity-0 pointer-events-none"
            />
        </div >
    )
}
