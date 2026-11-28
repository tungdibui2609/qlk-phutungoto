'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { useCaptureReceipt } from '@/hooks/useCaptureReceipt'
import { PrintHeader } from '@/components/print/PrintHeader'
import { PrintActionMenu } from '@/components/print/PrintActionMenu'
import { EditableText } from '@/components/print/PrintHelpers'
import { formatQuantityFull } from '@/lib/numberUtils'
import { calculateItemSpecification } from '@/lib/unitConversion'
import { exportToExcelWithTemplate } from '@/lib/excelExport'
import { ConsignmentOrder, OUTBOUND_PURPOSE_LABELS } from '@/components/accounting/consignment/types'

export default function ConsignmentPrintPage() {
    return (
        <React.Suspense fallback={<div className="p-8 text-center text-sm">Đang tải phiếu in...</div>}>
            <ConsignmentPrintContent />
        </React.Suspense>
    )
}

function ConsignmentPrintContent() {
    const searchParams = useSearchParams()
    const orderId = searchParams.get('id')
    const sizeParam = searchParams.get('size')?.toUpperCase() === 'A4' ? 'A4' : 'A5'
    const autoPrint = searchParams.get('autoPrint') === '1'

    const [order, setOrder] = useState<ConsignmentOrder | null>(null)
    const [unitsMap, setUnitsMap] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [printSize, setPrintSize] = useState<'A4' | 'A5'>(sizeParam)
    const [displayInternalCode, setDisplayInternalCode] = useState(false)

    // Editable fields đồng bộ 100% giữa Web & Excel (/maunhap_kygui.xlsx, /mauxuat_kygui.xlsx)
    const [editDay, setEditDay] = useState('')
    const [editMonth, setEditMonth] = useState('')
    const [editYear, setEditYear] = useState('')
    const [editWarehouse, setEditWarehouse] = useState('')
    const [editAddress, setEditAddress] = useState('')
    const [editPartnerName, setEditPartnerName] = useState('')
    const [editNoteInfo, setEditNoteInfo] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [editVehicleNumber, setEditVehicleNumber] = useState('')
    const [editDriverName, setEditDriverName] = useState('')
    const [signTitle1, setSignTitle1] = useState('Người lập phiếu')
    const [signTitle2, setSignTitle2] = useState('Người giao hàng')
    const [signTitle3, setSignTitle3] = useState('Thủ kho ký gửi')
    const [signTitle4, setSignTitle4] = useState('Kế toán / Giám đốc')
    const [signPerson1, setSignPerson1] = useState('')
    const [signPerson2, setSignPerson2] = useState('')
    const [signPerson3, setSignPerson3] = useState('')
    const [signPerson4, setSignPerson4] = useState('')

    const sheetRef = useRef<HTMLDivElement>(null)
    const { companyInfo, logoSrc } = usePrintCompanyInfo({
        orderCompanyId: order?.company_id || null
    })
    const { convertUnit } = useUnitConversion()
    const { isCapturing, downloadTimer, handleCapture } = useCaptureReceipt({
        fileNamePrefix: `phieu-ky-gui-${order?.code || 'draft'}`,
        nodeId: 'print-ready'
    })

    useEffect(() => {
        if (!orderId) {
            setLoading(false)
            return
        }
        async function fetchOrder() {
            setLoading(true)
            const [orderRes, unitsRes] = await Promise.all([
                (supabase.from('consignment_orders') as any)
                    .select('*, consignment_warehouses(id, code, name, address, contact_name, contact_phone), items:consignment_order_items(*, products(id, sku, name, unit, weight_kg, internal_code, internal_name, product_units(unit_id, conversion_rate)))')
                    .eq('id', orderId)
                    .single(),
                supabase.from('units').select('id, name')
            ])

            if (unitsRes.data) {
                const map: Record<string, string> = {}
                unitsRes.data.forEach((u: any) => {
                    map[u.id] = u.name
                })
                setUnitsMap(map)
            }

            if (orderRes.data) {
                const data = orderRes.data as ConsignmentOrder
                setOrder(data)
                const d = new Date(data.order_date)
                setEditDay(format(d, 'dd'))
                setEditMonth(format(d, 'MM'))
                setEditYear(format(d, 'yyyy'))
                const wh: any = data.consignment_warehouses
                setEditWarehouse(wh?.name || '')
                setEditAddress(wh?.address || '')
                setEditPartnerName(data.partner_name || '')
                setEditDescription(data.description || '')
                setEditVehicleNumber(data.vehicle_number || '')
                setEditDriverName(data.driver_name || '')

                if (data.direction === 'INBOUND') {
                    const infoParts = [
                        data.source_outbound_order_code ? `PXK ${data.source_outbound_order_code}` : '',
                        data.vehicle_number ? `Xe ${data.vehicle_number}` : '',
                        data.driver_name ? `TX ${data.driver_name}` : ''
                    ].filter(Boolean)
                    setEditNoteInfo(infoParts.join(' · '))
                    setSignTitle2('Người giao hàng')
                } else {
                    const infoParts = [
                        data.outbound_purpose ? OUTBOUND_PURPOSE_LABELS[data.outbound_purpose] : '',
                        data.linked_inbound_order_code ? `PNK ${data.linked_inbound_order_code}` : ''
                    ].filter(Boolean)
                    setEditNoteInfo(infoParts.join(' · '))
                    setSignTitle2('Người nhận hàng')
                }
            }
            setLoading(false)
        }
        fetchOrder()
    }, [orderId])

    useEffect(() => {
        if (!loading && order && autoPrint) {
            const t = setTimeout(() => window.print(), 400)
            return () => clearTimeout(t)
        }
    }, [loading, order, autoPrint])

    const computedItems = useMemo(() => {
        if (!order?.items) return []
        return order.items.map(it => {
            const productSource = (it.products as any) || {}
            const spec = calculateItemSpecification(it.unit, Number(it.quantity) || 0, productSource, unitsMap)
            const qty = Number(it.quantity) || 0
            const baseUnit = productSource.unit || it.unit
            let kg = 0
            if (it.product_id && qty > 0) {
                const conv = convertUnit(it.product_id, it.unit, 'Kg', qty, baseUnit)
                if (Number.isFinite(conv)) kg = conv
            } else if (it.unit?.toLowerCase() === 'kg') {
                kg = qty
            }
            const nameBase =
                displayInternalCode && productSource.internal_name
                    ? productSource.internal_name
                    : it.product_name || productSource.name || 'N/A'
            const displayName = it.batch_code ? `${nameBase} (Lô: ${it.batch_code})` : nameBase
            return {
                ...it,
                displayName,
                quyCach: spec.quyCach || '',
                kg
            }
        })
    }, [order, unitsMap, convertUnit, displayInternalCode])

    const handleExcelExport = async () => {
        if (!order) return
        const isInbound = order.direction === 'INBOUND'

        const exportItems = computedItems.map(it => ({
            ...it,
            product_name: it.displayName,
            quyCach: it.quyCach,
            convertedQty: it.kg > 0 ? it.kg : '-',
            document_quantity: Number(it.quantity) || 0,
            price: 0
        }))

        const signatures = [
            { title: signTitle1, name: signPerson1 },
            { title: signTitle2, name: signPerson2 },
            { title: signTitle3, name: signPerson3 },
            { title: signTitle4, name: signPerson4 }
        ]

        await exportToExcelWithTemplate(
            {
                type: isInbound ? 'inbound' : 'outbound',
                printType: 'internal',
                order: {
                    ...order,
                    warehouse_name: editWarehouse,
                    description: editDescription
                },
                items: exportItems,
                companyInfo,
                editableFields: {
                    customerSupplierName: editPartnerName,
                    customerSupplierAddress: editAddress,
                    reasonDescription: editDescription,
                    warehouse: editWarehouse,
                    location: editAddress,
                    note: editNoteInfo,
                    vehicleNumber: editVehicleNumber,
                    containerNumber: editDriverName,
                    sealNumber: '',
                    day: editDay,
                    month: editMonth,
                    year: editYear,
                    signatures,
                    signDate: {
                        day: editDay,
                        month: editMonth,
                        year: editYear
                    }
                },
                modules: {
                    hasFinancials: false,
                    hasConversion: true,
                    targetUnit: 'Kg'
                }
            },
            isInbound ? '/maunhap_kygui.xlsx' : '/mauxuat_kygui.xlsx'
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-100">
                <div className="flex items-center gap-2 text-stone-600 text-sm">
                    <Loader2 size={18} className="animate-spin" />
                    Đang tải dữ liệu phiếu ký gửi...
                </div>
            </div>
        )
    }

    if (!order) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-stone-100 p-6 text-center">
                <FileText size={40} className="text-stone-400 mb-3" />
                <h2 className="font-bold text-stone-800 text-lg">Không tìm thấy phiếu ký gửi</h2>
                <p className="text-sm text-stone-500 mt-1">Vui lòng kiểm tra lại mã phiếu hoặc đóng tab này.</p>
            </div>
        )
    }

    const isInbound = order.direction === 'INBOUND'
    const isA5 = printSize === 'A5'
    const totalQty = computedItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
    const totalKg = computedItems.reduce((s, it) => s + (Number(it.kg) || 0), 0)

    return (
        <div className="min-h-screen bg-stone-100 print:bg-white py-5 print:py-0">
            {/* Floating Action Menu giống hệt /print/inbound & /print/outbound */}
            <PrintActionMenu
                printSize={printSize}
                onPrintSizeChange={() => setPrintSize(prev => (prev === 'A4' ? 'A5' : 'A4'))}
                isDownloading={isCapturing}
                downloadTimer={downloadTimer}
                onDownload={() => handleCapture(printSize === 'A5')}
                displayInternalCode={displayInternalCode}
                onDisplayInternalCodeChange={() => setDisplayInternalCode(prev => !prev)}
                onPrint={() => window.print()}
                onExcelExport={handleExcelExport}
            />

            {/* Khung trang in khớp 100% với /maunhap_kygui.xlsx và /mauxuat_kygui.xlsx */}
            <div
                id="print-ready"
                ref={sheetRef}
                className={`print-sheet bg-white mx-auto shadow-lg print:shadow-none text-black ${
                    isA5
                        ? 'w-[210mm] min-h-[147.5mm] px-[10mm] py-[7mm] text-[11px] leading-snug'
                        : 'w-[210mm] min-h-[297mm] px-[14mm] py-[12mm] text-[13px] leading-normal'
                }`}
                style={{ fontFamily: "'Times New Roman', Times, serif" }}
            >
                <PrintHeader
                    companyInfo={companyInfo}
                    logoSrc={logoSrc}
                    size="large"
                    isA5={isA5}
                />

                {/* Tiêu đề phiếu */}
                <div className={`text-center ${isA5 ? 'mt-1.5 mb-2' : 'mt-3 mb-4'}`}>
                    <h1 className={`font-bold uppercase tracking-wide text-black ${isA5 ? 'text-[16px]' : 'text-[20px]'}`}>
                        {isInbound ? 'PHIẾU NHẬP KHO KÝ GỬI' : 'PHIẾU XUẤT KHO KÝ GỬI'}
                    </h1>
                    <div className="italic mt-0.5 flex items-center justify-center gap-1">
                        <span>Ngày</span>
                        <EditableText value={editDay} onChange={setEditDay} className="w-7 text-center" />
                        <span>tháng</span>
                        <EditableText value={editMonth} onChange={setEditMonth} className="w-7 text-center" />
                        <span>năm</span>
                        <EditableText value={editYear} onChange={setEditYear} className="w-11 text-center" />
                    </div>
                    <div className="font-bold mt-0.5">Số : {order.code}</div>
                </div>

                {/* Thông tin đầu phiếu khớp từng dòng với file Excel mẫu ký gửi */}
                <div className={`space-y-1 ${isA5 ? 'mb-2 text-[11px]' : 'mb-4 text-[13px]'}`}>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                        <div className="flex items-baseline gap-1">
                            <span className="font-bold shrink-0">- Kho ký gửi:</span>
                            <EditableText value={editWarehouse} onChange={setEditWarehouse} className="flex-1 font-bold" />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="font-bold shrink-0">- Địa chỉ kho gửi:</span>
                            <EditableText
                                value={editAddress}
                                onChange={setEditAddress}
                                placeholder="..................................."
                                className="flex-1"
                            />
                        </div>

                        <div className="flex items-baseline gap-1">
                            <span className="font-bold shrink-0">
                                {isInbound ? '- Người gửi / Đơn vị:' : '- Người nhận / Khách hàng:'}
                            </span>
                            <EditableText
                                value={editPartnerName}
                                onChange={setEditPartnerName}
                                placeholder="..................................."
                                className="flex-1"
                            />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="font-bold shrink-0">
                                {isInbound ? '- Chứng từ / Xe:' : '- Mục đích / Liên kết:'}
                            </span>
                            <EditableText
                                value={editNoteInfo}
                                onChange={setEditNoteInfo}
                                placeholder="..................................."
                                className="flex-1"
                            />
                        </div>

                        <div className="col-span-2 flex items-baseline gap-1">
                            <span className="font-bold shrink-0">
                                {isInbound ? '- Diễn giải:' : '- Diễn giải / Lý do xuất:'}
                            </span>
                            <EditableText
                                value={editDescription}
                                onChange={setEditDescription}
                                placeholder="............................................................................"
                                className="flex-1"
                            />
                        </div>

                        {!isInbound && (
                            <>
                                <div className="flex items-baseline gap-1">
                                    <span className="font-bold shrink-0">- BS Xe:</span>
                                    <EditableText
                                        value={editVehicleNumber}
                                        onChange={setEditVehicleNumber}
                                        placeholder="..........................."
                                        className="flex-1"
                                    />
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="font-bold shrink-0">- Tài xế:</span>
                                    <EditableText
                                        value={editDriverName}
                                        onChange={setEditDriverName}
                                        placeholder="..........................."
                                        className="flex-1"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Bảng hàng hóa 6 cột khớp 100% với /maunhap_kygui.xlsx & /mauxuat_kygui.xlsx */}
                <table className="w-full border-collapse border border-black">
                    <thead>
                        <tr className="bg-stone-100 print:bg-stone-100">
                            <th rowSpan={2} className="border border-black px-1.5 py-1 text-center w-9">STT</th>
                            <th rowSpan={2} className="border border-black px-2 py-1 text-center">
                                Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sp, hàng hoá
                            </th>
                            <th rowSpan={2} className="border border-black px-1.5 py-1 text-center w-24">Quy Cách</th>
                            <th rowSpan={2} className="border border-black px-1.5 py-1 text-center w-20">Đơn Vị Tính</th>
                            <th colSpan={2} className="border border-black px-2 py-1 text-center">Số Lượng</th>
                        </tr>
                        <tr className="bg-stone-100 print:bg-stone-100">
                            <th className="border border-black px-2 py-1 text-center w-24">
                                {isInbound ? 'Thực Nhập' : 'Thực Xuất'}
                            </th>
                            <th className="border border-black px-2 py-1 text-center w-24">Quy Đổi (Kg)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {computedItems.map((it, idx) => (
                            <tr key={it.id || idx}>
                                <td className="border border-black px-1.5 py-1.5 text-center font-bold">{idx + 1}</td>
                                <td className="border border-black px-2 py-1.5 font-bold">{it.displayName}</td>
                                <td className="border border-black px-1.5 py-1.5 text-center font-bold">{it.quyCach}</td>
                                <td className="border border-black px-1.5 py-1.5 text-center font-bold">{it.unit}</td>
                                <td className="border border-black px-2 py-1.5 text-center font-bold">
                                    {formatQuantityFull(Number(it.quantity) || 0)}
                                </td>
                                <td className="border border-black px-2 py-1.5 text-center font-bold">
                                    {it.kg > 0 ? formatQuantityFull(it.kg) : ''}
                                </td>
                            </tr>
                        ))}
                        <tr className="font-bold bg-stone-50 print:bg-stone-50">
                            <td className="border border-black px-1.5 py-1.5 text-center"></td>
                            <td className="border border-black px-2 py-1.5 text-center uppercase">Cộng</td>
                            <td className="border border-black px-1.5 py-1.5 text-center">X</td>
                            <td className="border border-black px-1.5 py-1.5 text-center">X</td>
                            <td className="border border-black px-2 py-1.5 text-center">{formatQuantityFull(totalQty)}</td>
                            <td className="border border-black px-2 py-1.5 text-center">
                                {totalKg > 0 ? formatQuantityFull(totalKg) : ''}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 4 cột chữ ký có thể sửa trực tiếp */}
                <div className={`grid grid-cols-4 gap-2 text-center ${isA5 ? 'mt-4 text-[11px]' : 'mt-8 text-[13px]'}`}>
                    {[
                        { title: signTitle1, setTitle: setSignTitle1, person: signPerson1, setPerson: setSignPerson1 },
                        { title: signTitle2, setTitle: setSignTitle2, person: signPerson2, setPerson: setSignPerson2 },
                        { title: signTitle3, setTitle: setSignTitle3, person: signPerson3, setPerson: setSignPerson3 },
                        { title: signTitle4, setTitle: setSignTitle4, person: signPerson4, setPerson: setSignPerson4 }
                    ].map((sig, i) => (
                        <div key={i} className="flex flex-col items-center">
                            <EditableText value={sig.title} onChange={sig.setTitle} className="font-bold text-center" />
                            <div className="italic text-[10px]">(Ký, họ tên)</div>
                            <div className={isA5 ? 'h-10' : 'h-16'} />
                            <EditableText value={sig.person} onChange={sig.setPerson} placeholder=".................." className="font-bold text-center" />
                        </div>
                    ))}
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    @page {
                        size: ${isA5 ? 'A5 landscape' : 'A4 portrait'};
                        margin: 0;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .print-sheet {
                        box-shadow: none !important;
                        margin: 0 !important;
                    }
                }
            `}</style>
        </div>
    )
}
