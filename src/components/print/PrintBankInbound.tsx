'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { formatQuantityFull } from '@/lib/numberUtils'
import { calculateItemSpecification, extractWeightFromName } from '@/lib/unitConversion'

interface OrderItem {
    id: string
    product_name: string | null
    unit: string | null
    quantity: number
    document_quantity: number
    price: number
    note: string | null
    products: { id: string, sku: string, internal_code?: string | null, internal_name?: string | null, unit: string } | null
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

interface PrintBankInboundProps {
    order: InboundOrder
    items: OrderItem[]
    unitsMap?: Record<string, string>
    isSnapshot?: boolean
    printSize?: 'A4' | 'A5'
    displayInternalCode?: boolean
}

export function PrintBankInbound({
    order,
    items,
    unitsMap,
    isSnapshot = false,
    printSize = 'A4',
    displayInternalCode = false
}: PrintBankInboundProps) {
    // Parse order date
    const orderDate = new Date(order.created_at)
    const isValidDate = !isNaN(orderDate.getTime())
    const defaultDateTime = isValidDate ? format(orderDate, 'dd/MM/yyyy HH:mm') : ''

    // Calculate total weights in Kg from original receipt
    const itemCalculations = useMemo(() => {
        return items.map((item) => {
            const qty = Number(item.quantity) || 0
            const rawUnit = item.unit ? (unitsMap?.[item.unit] || item.unit) : ''
            
            // 1. Direct unit weight check (e.g. "Thùng (20kg)" -> 20)
            const unitRate = extractWeightFromName(rawUnit)
            let kg = 0
            let spec: any = null

            if (unitRate && unitRate > 0) {
                kg = qty * unitRate
            } else {
                // 2. Unit conversion via calculateItemSpecification
                spec = calculateItemSpecification(rawUnit, qty, item.products as any, unitsMap)
                if (spec && spec.convertedQty && spec.conversionRate > 1) {
                    kg = spec.convertedQty
                } else {
                    // 3. Fallback: Check product name / SKU for weight pattern
                    const nameRate = 
                        extractWeightFromName(item.product_name) ||
                        extractWeightFromName(item.products?.internal_name) ||
                        extractWeightFromName(item.products?.sku)
                    if (nameRate && nameRate > 0) {
                        kg = qty * nameRate
                    } else {
                        kg = spec?.convertedQty || qty
                    }
                }
            }

            return {
                ...item,
                kg,
                spec
            }
        })
    }, [items, unitsMap])

    const totalKg = useMemo(() => {
        return itemCalculations.reduce((sum, it) => sum + it.kg, 0)
    }, [itemCalculations])

    const totalPacks = useMemo(() => {
        return items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
    }, [items])

    // Mode: Consolidated (1 row with total kg) vs Detail (multiple rows)
    const [isConsolidated, setIsConsolidated] = useState(true)

    // Consolidated row state (default for bank)
    const [consolidatedDateTime, setConsolidatedDateTime] = useState(defaultDateTime)
    const [consolidatedName, setConsolidatedName] = useState('Sầu riêng cấp đông múi')
    const [consolidatedQty, setConsolidatedQty] = useState(`${formatQuantityFull(totalKg)} kg`)
    const [consolidatedNote, setConsolidatedNote] = useState(
        totalPacks > 0 && totalPacks !== totalKg ? `${formatQuantityFull(totalPacks)} Thùng` : ''
    )

    // Sync consolidated state when items load/change
    useEffect(() => {
        setConsolidatedDateTime(defaultDateTime)
        setConsolidatedQty(`${formatQuantityFull(totalKg)} kg`)
        setConsolidatedNote(
            totalPacks > 0 && totalPacks !== totalKg ? `${formatQuantityFull(totalPacks)} Thùng` : ''
        )
    }, [totalKg, totalPacks, defaultDateTime])

    // Editable Header fields
    const [bankName, setBankName] = useState('NGÂN HÀNG TMCP CÔNG THƯƠNG VN')
    const [bankBranch, setBankBranch] = useState('CHI NHÁNH BẾN TRE')
    const [docNumber, setDocNumber] = useState('......')
    const [docSuffix, setDocSuffix] = useState('LNK')
    const [city, setCity] = useState('Đắk Lắk')
    const [day, setDay] = useState(isValidDate ? orderDate.getDate().toString() : '....')
    const [month, setMonth] = useState(isValidDate ? (orderDate.getMonth() + 1).toString() : '....')
    const [year, setYear] = useState(isValidDate ? orderDate.getFullYear().toString() : '20.....')

    // Document basis
    const [basisNum, setBasisNum] = useState(order.code || '..........')
    const [basisDate, setBasisDate] = useState(isValidDate ? format(orderDate, 'dd/MM/yyyy') : '..............')
    const [unitName, setUnitName] = useState('kg')

    useEffect(() => {
        if (order.code) {
            setBasisNum(order.code)
        }
    }, [order.code])

    // Detailed table rows state (editable per item)
    const [editableItems, setEditableItems] = useState<{
        [id: string]: {
            dateTime: string
            productName: string
            quantity: string
            note: string
        }
    }>({})

    useEffect(() => {
        const initial: typeof editableItems = {}
        itemCalculations.forEach((item) => {
            const displayName = displayInternalCode && item.products?.internal_name
                ? item.products.internal_name
                : (item.product_name || item.products?.sku || '')
            const kgFormatted = `${formatQuantityFull(item.kg)} kg`
            const noteDefault = item.note || (item.unit ? `${formatQuantityFull(item.quantity)} ${item.unit}` : '')
            initial[item.id] = {
                dateTime: defaultDateTime,
                productName: displayName,
                quantity: kgFormatted,
                note: noteDefault
            }
        })
        setEditableItems(initial)
    }, [itemCalculations, defaultDateTime, displayInternalCode])

    // Post-table details
    const defaultWarehouseLocation = 'Kho số 02 thuộc Công ty cổ phần tập đoàn Xuất – Nhập khẩu trái cây Chánh Thu tại Thửa đất số 722, tờ bản đồ số 76, thôn Nam Kỳ Xã Cuôr Đăng, Tỉnh Đắk Lắk.'
    const [warehouseLocation, setWarehouseLocation] = useState(defaultWarehouseLocation)
    const [representative, setRepresentative] = useState('NGUYỄN ĐÌNH TÙNG')
    const [cccd, setCccd] = useState('066092009445')
    const [cccdDate, setCccdDate] = useState('07/09/2022')
    const [cccdPlace, setCccdPlace] = useState('Cục CSQLHC về TTXH')
    const [legalNote, setLegalNote] = useState(
        'Lệnh xuất kho lập thành 02 (hai) bản có giá trị pháp lý như nhau. Công Ty TNHH Dịch Vụ Bảo Vệ Ngày & Đêm giữ 01 (một) bản và Công ty Cổ phần Tập đoàn xuất - nhập khẩu trái cây Chánh Thu (bên thế chấp) giữ 01 (một) bản.'
    )

    // Signatures
    const [signer1Title, setSigner1Title] = useState('Đại diện Công Ty CPTM DVBV Ngày & Đêm')
    const [signer1Name, setSigner1Name] = useState('')
    const [signer2Title, setSigner2Title] = useState('Đại diện Công ty CP Tập Đoàn XNK Trái Cây Chánh Thu')
    const [signer2Name, setSigner2Name] = useState('Nguyễn Đình Tùng')

    const updateRow = (id: string, field: 'dateTime' | 'productName' | 'quantity' | 'note', val: string) => {
        setEditableItems(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: val
            }
        }))
    }

    return (
        <div
            className="w-full text-black leading-normal select-text print:text-black"
            style={{
                fontFamily: "'Times New Roman', Times, serif",
                fontSize: '13.5px'
            }}
        >
            {/* Header: Two Columns */}
            <div className="flex justify-between items-start pt-2">
                {/* Left Header */}
                <div className="text-center w-[45%]">
                    <div className="font-bold text-[13px] leading-tight uppercase">
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                            <input
                                type="text"
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                className="w-full text-center font-bold bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none"
                            />
                        </span>
                        <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                            {bankName}
                        </span>
                    </div>
                    <div className="font-bold text-[13px] leading-tight uppercase mt-0.5">
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                            <input
                                type="text"
                                value={bankBranch}
                                onChange={(e) => setBankBranch(e.target.value)}
                                className="w-full text-center font-bold bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none"
                            />
                        </span>
                        <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                            {bankBranch}
                        </span>
                    </div>
                    <div className="text-[13px] mt-1">
                        Số: <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} inline-flex items-center`}>
                            <input
                                type="text"
                                value={docNumber}
                                onChange={(e) => setDocNumber(e.target.value)}
                                className="w-16 text-center bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-medium tracking-wider"
                            />
                            <span>/</span>
                            <input
                                type="text"
                                value={docSuffix}
                                onChange={(e) => setDocSuffix(e.target.value)}
                                className="w-12 text-center bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-medium"
                            />
                        </span>
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                            {docNumber || '......'}/{docSuffix || 'LNK'}
                        </span>
                    </div>
                </div>

                {/* Right Header: National Motto */}
                <div className="text-center w-[50%]">
                    <div className="font-bold text-[13px] leading-tight uppercase">
                        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </div>
                    <div className="font-bold text-[13px] leading-tight mt-0.5">
                        Độc lập – Tự do – Hạnh phúc
                    </div>
                    <div className="text-[12px] tracking-widest mt-0.5 font-bold">
                        --o0o--
                    </div>

                    <div className="italic text-[13px] mt-2 text-right pr-2 whitespace-nowrap">
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} inline-flex items-center justify-end`}>
                            <input
                                type="text"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="w-16 text-right italic bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                            />
                            <span>, ngày&nbsp;</span>
                            <input
                                type="text"
                                value={day}
                                onChange={(e) => setDay(e.target.value)}
                                className="w-7 text-center italic bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                            />
                            <span>&nbsp;tháng&nbsp;</span>
                            <input
                                type="text"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                className="w-7 text-center italic bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                            />
                            <span>&nbsp;năm&nbsp;</span>
                            <input
                                type="text"
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                className="w-12 text-center italic bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                            />
                        </span>
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                            {city}, ngày {day} tháng {month} năm {year}
                        </span>
                    </div>
                </div>
            </div>

            {/* Document Title */}
            <div className="text-center mt-4 mb-3">
                <h1 className="text-xl font-bold uppercase tracking-wide">
                    PHIẾU NHẬP KHO
                </h1>
            </div>

            {/* Salutation */}
            <div className="text-center font-bold text-[13.5px] leading-relaxed mb-3">
                <p>
                    <span className="underline">Kính gửi</span> : Ban lãnh đạo ngân hàng TMCP Công Thương Việt Nam
                </p>
                <p>– Chi nhánh Bến Tre;</p>
            </div>

            {/* Basis Paragraphs */}
            <div className="space-y-1 text-[13px] text-justify leading-relaxed">
                <p>
                    - Căn cứ số liệu nhận hàng số{' '}
                    <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} inline-block`}>
                        <input
                            type="text"
                            value={basisNum}
                            onChange={(e) => setBasisNum(e.target.value)}
                            className="w-28 text-center font-medium bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                        />
                    </span>
                    <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} font-medium`}>
                        {basisNum || '..........'}
                    </span>
                    {' '}ngày{' '}
                    <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} inline-block`}>
                        <input
                            type="text"
                            value={basisDate}
                            onChange={(e) => setBasisDate(e.target.value)}
                            className="w-24 text-center font-medium bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                        />
                    </span>
                    <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} font-medium`}>
                        {basisDate || '..............'}
                    </span>
                    {' '}của Công ty Cổ phần Tập đoàn xuất - nhập khẩu trái cây Chánh Thu
                </p>

                <p>
                    - Công Ty TNHH Dịch Vụ Bảo Vệ Ngày & Đêm và Công ty Cổ phần Tập đoàn xuất - nhập khẩu trái cây Chánh Thu xác nhận nhập hàng cụ thể như sau :
                </p>

                <div className="flex justify-between items-center pt-0.5">
                    {/* Toggle between 1-row consolidated mode and detailed items */}
                    <div className="print:hidden">
                        <button
                            type="button"
                            onClick={() => setIsConsolidated(!isConsolidated)}
                            className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded-md font-medium transition-colors"
                        >
                            {isConsolidated ? '✓ Đang gom 1 dòng tổng ký (Mặc định)' : 'Đang hiện chi tiết từng mặt hàng'} (Bấm để đổi)
                        </button>
                    </div>

                    <div className="text-right italic font-normal text-[12.5px] ml-auto">
                        Đơn vị tính:{' '}
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                            <input
                                type="text"
                                value={unitName}
                                onChange={(e) => setUnitName(e.target.value)}
                                className="w-14 text-center italic bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                            />
                        </span>
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                            {unitName || 'kg'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse border border-black mt-1 text-[13px]">
                <thead>
                    <tr className="bg-gray-50/50">
                        <th className="border border-black px-2 py-1.5 text-center font-bold w-12">
                            STT
                        </th>
                        <th className="border border-black px-2 py-1.5 text-center font-bold w-36">
                            NGÀY, GIỜ
                        </th>
                        <th className="border border-black px-2 py-1.5 text-center font-bold">
                            LOẠI HÀNG HÓA
                        </th>
                        <th className="border border-black px-2 py-1.5 text-center font-bold w-44">
                            SỐ LƯỢNG HÀNG HÓA
                        </th>
                        <th className="border border-black px-2 py-1.5 text-center font-bold w-32">
                            GHI CHÚ
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {isConsolidated ? (
                        /* Consolidated 1-row view (Image 1 Standard) */
                        <tr className="hover:bg-gray-50/40">
                            <td className="border border-black px-2 py-3 text-center align-middle font-bold">
                                1
                            </td>
                            <td className="border border-black px-2 py-3 text-center align-middle">
                                <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                    <input
                                        type="text"
                                        value={consolidatedDateTime}
                                        onChange={(e) => setConsolidatedDateTime(e.target.value)}
                                        className="w-full text-center bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                                    />
                                </span>
                                <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                                    {consolidatedDateTime}
                                </span>
                            </td>
                            <td className="border border-black px-3 py-3 text-left font-bold align-middle">
                                <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                    <input
                                        type="text"
                                        value={consolidatedName}
                                        onChange={(e) => setConsolidatedName(e.target.value)}
                                        className="w-full text-left font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                                    />
                                </span>
                                <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                                    {consolidatedName}
                                </span>
                            </td>
                            <td className="border border-black px-2 py-3 text-center font-bold align-middle">
                                <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                    <input
                                        type="text"
                                        value={consolidatedQty}
                                        onChange={(e) => setConsolidatedQty(e.target.value)}
                                        className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                                    />
                                </span>
                                <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                                    {consolidatedQty}
                                </span>
                            </td>
                            <td className="border border-black px-2 py-3 text-center align-middle">
                                <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                    <input
                                        type="text"
                                        value={consolidatedNote}
                                        onChange={(e) => setConsolidatedNote(e.target.value)}
                                        placeholder=""
                                        className="w-full text-center bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                                    />
                                </span>
                                <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                                    {consolidatedNote}
                                </span>
                            </td>
                        </tr>
                    ) : (
                        /* Detailed individual items view */
                        items.map((item, idx) => {
                            const calc = itemCalculations[idx]
                            const rowData = editableItems[item.id] || {
                                dateTime: defaultDateTime,
                                productName: item.product_name || item.products?.sku || '',
                                quantity: `${formatQuantityFull(calc?.kg || item.quantity)} kg`,
                                note: item.note || ''
                            }

                            return (
                                <tr key={item.id} className="hover:bg-gray-50/40">
                                    <td className="border border-black px-2 py-2 text-center align-middle">
                                        {idx + 1}
                                    </td>
                                    <td className="border border-black px-2 py-2 text-center align-middle">
                                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                            <input
                                                type="text"
                                                value={rowData.dateTime}
                                                onChange={(e) => updateRow(item.id, 'dateTime', e.target.value)}
                                                className="w-full text-center bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                                            />
                                        </span>
                                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                                            {rowData.dateTime}
                                        </span>
                                    </td>
                                    <td className="border border-black px-2 py-2 text-left font-medium align-middle">
                                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                            <input
                                                type="text"
                                                value={rowData.productName}
                                                onChange={(e) => updateRow(item.id, 'productName', e.target.value)}
                                                className="w-full text-left font-medium bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                                            />
                                        </span>
                                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                                            {rowData.productName}
                                        </span>
                                    </td>
                                    <td className="border border-black px-2 py-2 text-center font-bold align-middle">
                                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                            <input
                                                type="text"
                                                value={rowData.quantity}
                                                onChange={(e) => updateRow(item.id, 'quantity', e.target.value)}
                                                className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                                            />
                                        </span>
                                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                                            {rowData.quantity}
                                        </span>
                                    </td>
                                    <td className="border border-black px-2 py-2 text-center align-middle">
                                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                            <input
                                                type="text"
                                                value={rowData.note}
                                                onChange={(e) => updateRow(item.id, 'note', e.target.value)}
                                                className="w-full text-center bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                                            />
                                        </span>
                                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                                            {rowData.note}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })
                    )}

                    {/* Total Row (only needed in detailed mode) */}
                    {!isConsolidated && (
                        <tr className="font-bold bg-gray-50/30">
                            <td colSpan={3} className="border border-black px-3 py-2 text-center font-bold">
                                Tổng cộng
                            </td>
                            <td className="border border-black px-2 py-2 text-center font-bold">
                                {formatQuantityFull(totalKg)} kg
                            </td>
                            <td className="border border-black px-2 py-2 text-center">
                                {totalPacks > 0 && totalPacks !== totalKg ? `${formatQuantityFull(totalPacks)} Thùng` : ''}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Below Table Information */}
            <div className="mt-3 space-y-2 text-[13px] leading-relaxed">
                <div>
                    <span className="font-normal">Địa điểm kho nhập hàng: </span>
                    <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                        <input
                            type="text"
                            value={warehouseLocation}
                            onChange={(e) => setWarehouseLocation(e.target.value)}
                            className="w-full bg-transparent border-b border-dashed border-gray-400 focus:border-blue-500 focus:outline-none"
                        />
                    </span>
                    <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                        {warehouseLocation}
                    </span>
                </div>

                <div className="flex items-center flex-wrap gap-x-6 gap-y-1">
                    <div className="flex items-center">
                        <span>Người đại diện Công ty Chánh thu nhận hàng: </span>
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} ml-1`}>
                            <input
                                type="text"
                                value={representative}
                                onChange={(e) => setRepresentative(e.target.value)}
                                placeholder="..................................."
                                className="w-56 bg-transparent border-b border-dashed border-gray-400 focus:border-blue-500 focus:outline-none"
                            />
                        </span>
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} ml-1`}>
                            {representative || '...................................'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                    <div className="flex items-center">
                        <span>Số CCCD: </span>
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} mx-1`}>
                            <input
                                type="text"
                                value={cccd}
                                onChange={(e) => setCccd(e.target.value)}
                                placeholder="...................."
                                className="w-32 text-center bg-transparent border-b border-dashed border-gray-400 focus:border-blue-500 focus:outline-none"
                            />
                        </span>
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} mx-1`}>
                            {cccd || '....................'}
                        </span>
                    </div>

                    <div className="flex items-center">
                        <span>Cấp ngày: </span>
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} mx-1`}>
                            <input
                                type="text"
                                value={cccdDate}
                                onChange={(e) => setCccdDate(e.target.value)}
                                placeholder="...................."
                                className="w-28 text-center bg-transparent border-b border-dashed border-gray-400 focus:border-blue-500 focus:outline-none"
                            />
                        </span>
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} mx-1`}>
                            {cccdDate || '....................'}
                        </span>
                    </div>

                    <div className="flex items-center">
                        <span>Nơi cấp: </span>
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} mx-1`}>
                            <input
                                type="text"
                                value={cccdPlace}
                                onChange={(e) => setCccdPlace(e.target.value)}
                                placeholder="...................."
                                className="w-44 text-center bg-transparent border-b border-dashed border-gray-400 focus:border-blue-500 focus:outline-none"
                            />
                        </span>
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} mx-1`}>
                            {cccdPlace || '....................'}
                        </span>
                    </div>
                </div>

                <div className="text-justify pt-1">
                    <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                        <textarea
                            value={legalNote}
                            onChange={(e) => setLegalNote(e.target.value)}
                            rows={2}
                            className="w-full bg-transparent border border-dashed border-gray-300 p-1 text-[13px] rounded focus:outline-none"
                        />
                    </span>
                    <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                        {legalNote}
                    </span>
                </div>
            </div>

            {/* Signatures: 2 Columns */}
            <div className="mt-8 flex justify-between items-start text-center break-inside-avoid print:break-inside-avoid print:mt-5">
                {/* Col 1 */}
                <div className="w-[47%] flex flex-col items-center">
                    <div className="w-full font-bold text-[13.5px] leading-snug">
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} w-full block`}>
                            <textarea
                                value={signer1Title}
                                onChange={(e) => setSigner1Title(e.target.value)}
                                rows={2}
                                className="w-full text-center font-bold bg-transparent border border-dashed border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none resize-none overflow-hidden text-[13.5px] leading-snug"
                            />
                        </span>
                        <span className={`hidden print:block ${isSnapshot ? 'block' : ''} text-center font-bold text-[13.5px] leading-snug whitespace-pre-line`}>
                            {signer1Title}
                        </span>
                    </div>
                    <div className="h-24 print:h-16" />
                    <div className="w-full font-bold text-[13px]">
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} w-full block`}>
                            <input
                                type="text"
                                value={signer1Name}
                                onChange={(e) => setSigner1Name(e.target.value)}
                                placeholder=""
                                className="w-48 text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                            />
                        </span>
                        <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                            {signer1Name}
                        </span>
                    </div>
                </div>

                {/* Col 2 */}
                <div className="w-[49%] flex flex-col items-center">
                    <div className="w-full font-bold text-[13.5px] leading-snug">
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} w-full block`}>
                            <textarea
                                value={signer2Title}
                                onChange={(e) => setSigner2Title(e.target.value)}
                                rows={2}
                                className="w-full text-center font-bold bg-transparent border border-dashed border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none resize-none overflow-hidden text-[13.5px] leading-snug"
                            />
                        </span>
                        <span className={`hidden print:block ${isSnapshot ? 'block' : ''} text-center font-bold text-[13.5px] leading-snug whitespace-pre-line`}>
                            {signer2Title}
                        </span>
                    </div>
                    <div className="h-24 print:h-16" />
                    <div className="w-full font-bold text-[13px]">
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} w-full block`}>
                            <input
                                type="text"
                                value={signer2Name}
                                onChange={(e) => setSigner2Name(e.target.value)}
                                placeholder=""
                                className="w-48 text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                            />
                        </span>
                        <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                            {signer2Name}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
