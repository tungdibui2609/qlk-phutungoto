'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { formatQuantityFull } from '@/lib/numberUtils'
import { numberToVietnameseText } from '@/components/print/PrintHelpers'
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
    created_by_name?: string | null
    metadata?: any
    system_code?: string
    company_id?: string
}

interface PrintBankOutboundProps {
    order: OutboundOrder
    items: OrderItem[]
    unitsMap?: Record<string, string>
    isSnapshot?: boolean
    printSize?: 'A4' | 'A5'
    displayInternalCode?: boolean
}

export function PrintBankOutbound({
    order,
    items,
    unitsMap,
    isSnapshot = false,
    printSize = 'A4',
    displayInternalCode = false
}: PrintBankOutboundProps) {
    const orderDate = new Date(order.created_at)
    const isValidDate = !isNaN(orderDate.getTime())

    // Calculate weights in Kg from original receipt
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

    const totalAmount = useMemo(() => {
        return items.reduce((sum, it) => sum + ((Number(it.quantity) || 0) * (Number(it.price) || 0)), 0)
    }, [items])

    // Mode: Consolidated (1 row with total kg) vs Detail (multiple rows)
    const [isConsolidated, setIsConsolidated] = useState(true)

    // Consolidated row state (default for bank)
    const [consolidatedName, setConsolidatedName] = useState('Sầu riêng cấp đông múi')
    const [consolidatedQty, setConsolidatedQty] = useState(`${formatQuantityFull(totalKg)} kg`)
    const [consolidatedPrice, setConsolidatedPrice] = useState(
        totalKg > 0 ? Math.round(totalAmount / totalKg).toLocaleString('vi-VN') : '0'
    )
    const [consolidatedTotal, setConsolidatedTotal] = useState(totalAmount.toLocaleString('vi-VN'))

    useEffect(() => {
        setConsolidatedQty(`${formatQuantityFull(totalKg)} kg`)
        setConsolidatedPrice(totalKg > 0 ? Math.round(totalAmount / totalKg).toLocaleString('vi-VN') : '0')
        setConsolidatedTotal(totalAmount.toLocaleString('vi-VN'))
    }, [totalKg, totalAmount])

    // Editable Header fields
    const [bankName, setBankName] = useState('NGÂN HÀNG TMCP CÔNG THƯƠNG VN')
    const [bankBranch, setBankBranch] = useState('CHI NHÁNH BẾN TRE')
    const [docNumber, setDocNumber] = useState('......')
    const [docSuffix, setDocSuffix] = useState('LXK')
    const [city, setCity] = useState('Đắk Lắk')
    const [day, setDay] = useState(isValidDate ? orderDate.getDate().toString() : '....')
    const [month, setMonth] = useState(isValidDate ? (orderDate.getMonth() + 1).toString() : '....')
    const [year, setYear] = useState(isValidDate ? orderDate.getFullYear().toString() : '20.....')

    // Document basis
    const [recipientCompany, setRecipientCompany] = useState('Công Ty CPTM DVBV Ngày & Đêm')
    const [basisNum, setBasisNum] = useState(order.code || '..............')
    const [basisDate, setBasisDate] = useState(isValidDate ? format(orderDate, 'dd/MM/yyyy') : '...............')
    const [debtDate, setDebtDate] = useState('................')
    const [proposeCompany, setProposeCompany] = useState('Công Ty CPTM DVBV Ngày & Đêm')
    const [unitName, setUnitName] = useState('VNĐ')

    useEffect(() => {
        if (order.code) {
            setBasisNum(order.code)
        }
    }, [order.code])

    // Detailed table items
    const [editableItems, setEditableItems] = useState<{
        [id: string]: {
            productSymbol: string
            quantity: string
            price: string
            totalPrice: string
        }
    }>({})

    useEffect(() => {
        const initial: typeof editableItems = {}
        itemCalculations.forEach((item) => {
            const displayName = displayInternalCode && item.products?.internal_name
                ? item.products.internal_name
                : (item.product_name || item.products?.sku || '')
            const qtyKg = item.kg || Number(item.quantity) || 0
            const unitPrice = Number(item.price) || 0
            const total = (Number(item.quantity) || 0) * unitPrice

            initial[item.id] = {
                productSymbol: displayName,
                quantity: `${formatQuantityFull(qtyKg)} kg`,
                price: unitPrice ? unitPrice.toLocaleString('vi-VN') : '0',
                totalPrice: total ? total.toLocaleString('vi-VN') : '0'
            }
        })
        setEditableItems(initial)
    }, [itemCalculations, displayInternalCode])

    // Post-table summary
    const [totalValueText, setTotalValueText] = useState('')
    const [amountInWords, setAmountInWords] = useState('')

    useEffect(() => {
        if (totalAmount > 0) {
            setTotalValueText(`${totalAmount.toLocaleString('vi-VN')} VNĐ`)
            setAmountInWords(numberToVietnameseText(totalAmount))
        } else {
            setTotalValueText('..........................................................................')
            setAmountInWords('....................................................................................')
        }
    }, [totalAmount])

    const defaultWarehouseLocation = 'Thôn Nam Kỳ, xã Cuôr Đăng, Tỉnh Đắk Lắk'
    const [warehouseLocation, setWarehouseLocation] = useState(defaultWarehouseLocation)
    const [representative, setRepresentative] = useState('NGUYỄN ĐÌNH TÙNG')
    const [cccd, setCccd] = useState('066092009445')
    const [cccdDate, setCccdDate] = useState('07/09/2022')
    const [cccdPlace, setCccdPlace] = useState('Cục CSQLHC về TTXH')
    const [legalNote, setLegalNote] = useState(
        'Lệnh xuất kho lập thành 03 (ba) bản có giá trị pháp lý như nhau; mỗi bên dưới đây giữ 01 (một) bản để thực hiện.'
    )

    // 5 Signatures
    const [signer1Title, setSigner1Title] = useState('NGƯỜI LẬP')
    const [signer1Name, setSigner1Name] = useState(order.created_by_name || '')

    const [signer2Title, setSigner2Title] = useState('THỦ KHO')
    const [signer2Name, setSigner2Name] = useState('Nguyễn Đình Tùng')

    const [signer3Title, setSigner3Title] = useState('GIÁM ĐỐC NHÀ MÁY')
    const [signer3Name, setSigner3Name] = useState('')

    const [signer4Title, setSigner4Title] = useState('BẢO VỆ')
    const [signer4Name, setSigner4Name] = useState('')

    const [signer5Title, setSigner5Title] = useState('TÀI XẾ')
    const [signer5Name, setSigner5Name] = useState(order.metadata?.driverName || '')

    const updateRow = (id: string, field: 'productSymbol' | 'quantity' | 'price' | 'totalPrice', val: string) => {
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
                fontSize: '13px'
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
                            {docNumber || '......'}/{docSuffix || 'LXK'}
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
                    LỆNH XUẤT KHO
                </h1>
            </div>

            {/* Salutation */}
            <div className="text-left text-[13px] leading-relaxed mb-2">
                <span className="font-bold underline">Kính gửi</span> : -{' '}
                <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} inline-block`}>
                    <input
                        type="text"
                        value={recipientCompany}
                        onChange={(e) => setRecipientCompany(e.target.value)}
                        className="w-80 font-medium bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                    />
                </span>
                <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} font-medium`}>
                    {recipientCompany}
                </span>
                ;
            </div>

            {/* Basis Paragraphs */}
            <div className="space-y-1 text-[13px] text-justify leading-relaxed">
                <p>
                    - Căn cứ phiếu xuất kho kiêm giao nhận hàng số{' '}
                    <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} inline-block`}>
                        <input
                            type="text"
                            value={basisNum}
                            onChange={(e) => setBasisNum(e.target.value)}
                            className="w-28 text-center font-medium bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                        />
                    </span>
                    <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} font-medium`}>
                        {basisNum}
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
                        {basisDate}
                    </span>
                    {' '}của Công ty Cổ phần Tập đoàn xuất - nhập khẩu trái cây Chánh Thu..
                </p>

                <p>
                    - Căn cứ chứng từ hạch toán thu nợ ngày{' '}
                    <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} inline-block`}>
                        <input
                            type="text"
                            value={debtDate}
                            onChange={(e) => setDebtDate(e.target.value)}
                            className="w-24 text-center font-medium bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                        />
                    </span>
                    <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} font-medium`}>
                        {debtDate}
                    </span>
                    {' '}đề nghị{' '}
                    <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} inline-block`}>
                        <input
                            type="text"
                            value={proposeCompany}
                            onChange={(e) => setProposeCompany(e.target.value)}
                            className="w-72 font-medium bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                        />
                    </span>
                    <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} font-medium`}>
                        {proposeCompany}
                    </span>
                    {' '}xuất cho Công ty Cổ phần Tập đoàn xuất - nhập khẩu trái cây Chánh Thu số tài sản cụ thể như sau:
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
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} inline-block`}>
                            <input
                                type="text"
                                value={unitName}
                                onChange={(e) => setUnitName(e.target.value)}
                                className="w-14 text-center italic bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                            />
                        </span>
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                            {unitName || 'VNĐ'}
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
                        <th className="border border-black px-2 py-1.5 text-center font-bold">
                            KÝ HIỆU SẢN PHẨM
                        </th>
                        <th className="border border-black px-2 py-1.5 text-center font-bold w-32">
                            SỐ LƯỢNG
                        </th>
                        <th className="border border-black px-2 py-1.5 text-center font-bold w-32">
                            ĐƠN GIÁ (VNĐ)
                        </th>
                        <th className="border border-black px-2 py-1.5 text-center font-bold w-36">
                            TỔNG TRỊ GIÁ
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {isConsolidated ? (
                        /* Consolidated 1-row view (Image 2 Standard) */
                        <tr className="hover:bg-gray-50/40">
                            <td className="border border-black px-2 py-3 text-center align-middle font-bold">
                                1
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
                            <td className="border border-black px-2 py-3 text-right align-middle">
                                <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                    <input
                                        type="text"
                                        value={consolidatedPrice}
                                        onChange={(e) => setConsolidatedPrice(e.target.value)}
                                        className="w-full text-right bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                                    />
                                </span>
                                <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                                    {consolidatedPrice}
                                </span>
                            </td>
                            <td className="border border-black px-2 py-3 text-right font-bold align-middle">
                                <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                    <input
                                        type="text"
                                        value={consolidatedTotal}
                                        onChange={(e) => setConsolidatedTotal(e.target.value)}
                                        className="w-full text-right font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                                    />
                                </span>
                                <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                                    {consolidatedTotal}
                                </span>
                            </td>
                        </tr>
                    ) : (
                        /* Detailed individual items view */
                        items.map((item, idx) => {
                            const calc = itemCalculations[idx]
                            const unitPrice = Number(item.price) || 0
                            const total = (Number(item.quantity) || 0) * unitPrice

                            const rowData = editableItems[item.id] || {
                                productSymbol: item.product_name || item.products?.sku || '',
                                quantity: `${formatQuantityFull(calc?.kg || item.quantity)} kg`,
                                price: unitPrice ? unitPrice.toLocaleString('vi-VN') : '0',
                                totalPrice: total ? total.toLocaleString('vi-VN') : '0'
                            }

                            return (
                                <tr key={item.id} className="hover:bg-gray-50/40">
                                    <td className="border border-black px-2 py-2 text-center align-middle">
                                        {idx + 1}
                                    </td>
                                    <td className="border border-black px-2 py-2 text-left font-medium align-middle">
                                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                            <input
                                                type="text"
                                                value={rowData.productSymbol}
                                                onChange={(e) => updateRow(item.id, 'productSymbol', e.target.value)}
                                                className="w-full text-left font-medium bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                                            />
                                        </span>
                                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                                            {rowData.productSymbol}
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
                                    <td className="border border-black px-2 py-2 text-right align-middle">
                                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                            <input
                                                type="text"
                                                value={rowData.price}
                                                onChange={(e) => updateRow(item.id, 'price', e.target.value)}
                                                className="w-full text-right bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                                            />
                                        </span>
                                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                                            {rowData.price}
                                        </span>
                                    </td>
                                    <td className="border border-black px-2 py-2 text-right font-bold align-middle">
                                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                            <input
                                                type="text"
                                                value={rowData.totalPrice}
                                                onChange={(e) => updateRow(item.id, 'totalPrice', e.target.value)}
                                                className="w-full text-right font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none"
                                            />
                                        </span>
                                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                                            {rowData.totalPrice}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })
                    )}

                    {/* Total Row (only shown in detailed mode) */}
                    {!isConsolidated && (
                        <tr className="font-bold bg-gray-50/30">
                            <td colSpan={2} className="border border-black px-3 py-2 text-center font-bold">
                                Tổng cộng
                            </td>
                            <td className="border border-black px-2 py-2 text-center font-bold">
                                {formatQuantityFull(totalKg)} kg
                            </td>
                            <td className="border border-black px-2 py-2 text-center">-</td>
                            <td className="border border-black px-2 py-2 text-right font-bold">
                                {totalAmount.toLocaleString('vi-VN')}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Below Table Information */}
            <div className="mt-3 space-y-2 text-[13px] leading-relaxed">
                <div>
                    <span>Tổng giá trị tài sản: </span>
                    <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                        <input
                            type="text"
                            value={totalValueText}
                            onChange={(e) => setTotalValueText(e.target.value)}
                            className="w-[70%] font-bold bg-transparent border-b border-dashed border-gray-400 focus:border-blue-500 focus:outline-none"
                        />
                    </span>
                    <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} font-bold`}>
                        {totalValueText}
                    </span>
                </div>

                <div>
                    <span>(Bằng chữ: </span>
                    <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                        <input
                            type="text"
                            value={amountInWords}
                            onChange={(e) => setAmountInWords(e.target.value)}
                            className="w-[80%] italic bg-transparent border-b border-dashed border-gray-400 focus:border-blue-500 focus:outline-none"
                        />
                    </span>
                    <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} italic`}>
                        {amountInWords}
                    </span>
                    <span>)</span>
                </div>

                <div>
                    <span>Địa điểm kho xuất hàng: </span>
                    <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                        <input
                            type="text"
                            value={warehouseLocation}
                            onChange={(e) => setWarehouseLocation(e.target.value)}
                            className="w-[75%] bg-transparent border-b border-dashed border-gray-400 focus:border-blue-500 focus:outline-none"
                        />
                    </span>
                    <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                        {warehouseLocation}
                    </span>
                </div>

                <div>
                    <span>Người đại diện Công ty nhận hàng: </span>
                    <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                        <input
                            type="text"
                            value={representative}
                            onChange={(e) => setRepresentative(e.target.value)}
                            placeholder="...................................................."
                            className="w-[65%] bg-transparent border-b border-dashed border-gray-400 focus:border-blue-500 focus:outline-none"
                        />
                    </span>
                    <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                        {representative || '....................................................'}
                    </span>
                </div>

                <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                    <div className="flex items-center">
                        <span>CCCD số: </span>
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} mx-1`}>
                            <input
                                type="text"
                                value={cccd}
                                onChange={(e) => setCccd(e.target.value)}
                                placeholder="............................"
                                className="w-36 text-center bg-transparent border-b border-dashed border-gray-400 focus:border-blue-500 focus:outline-none"
                            />
                        </span>
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} mx-1`}>
                            {cccd || '............................'}
                        </span>
                    </div>

                    <div className="flex items-center">
                        <span>cấp ngày </span>
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} mx-1`}>
                            <input
                                type="text"
                                value={cccdDate}
                                onChange={(e) => setCccdDate(e.target.value)}
                                placeholder="................"
                                className="w-28 text-center bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                            />
                        </span>
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} mx-1`}>
                            {cccdDate || '................'}
                        </span>
                    </div>

                    <div className="flex items-center">
                        <span>tại </span>
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''} mx-1`}>
                            <input
                                type="text"
                                value={cccdPlace}
                                onChange={(e) => setCccdPlace(e.target.value)}
                                placeholder="...................."
                                className="w-44 text-center bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
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

            {/* Signatures: 2 Rows matching Bank Form */}
            <div className="mt-6 space-y-4 break-inside-avoid print:break-inside-avoid print:mt-4 print:space-y-3">
                {/* Row 1: 3 Signatures */}
                <div className="grid grid-cols-3 text-center gap-4">
                    {/* 1. Người lập */}
                    <div className="flex flex-col items-center">
                        <div className="font-bold text-[13px] leading-tight uppercase w-full">
                            <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                <input
                                    type="text"
                                    value={signer1Title}
                                    onChange={(e) => setSigner1Title(e.target.value)}
                                    className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:outline-none uppercase"
                                />
                            </span>
                            <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                                {signer1Title}
                            </span>
                        </div>
                        <div className="h-20 print:h-14" />
                        <div className="font-bold text-[12.5px] w-full">
                            <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                <input
                                    type="text"
                                    value={signer1Name}
                                    onChange={(e) => setSigner1Name(e.target.value)}
                                    placeholder=""
                                    className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:outline-none"
                                />
                            </span>
                            <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                                {signer1Name}
                            </span>
                        </div>
                    </div>

                    {/* 2. Thủ kho */}
                    <div className="flex flex-col items-center">
                        <div className="font-bold text-[13px] leading-tight uppercase w-full">
                            <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                <input
                                    type="text"
                                    value={signer2Title}
                                    onChange={(e) => setSigner2Title(e.target.value)}
                                    className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:outline-none uppercase"
                                />
                            </span>
                            <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                                {signer2Title}
                            </span>
                        </div>
                        <div className="h-20 print:h-14" />
                        <div className="font-bold text-[12.5px] w-full">
                            <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                <input
                                    type="text"
                                    value={signer2Name}
                                    onChange={(e) => setSigner2Name(e.target.value)}
                                    placeholder=""
                                    className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:outline-none"
                                />
                            </span>
                            <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                                {signer2Name}
                            </span>
                        </div>
                    </div>

                    {/* 3. Giám đốc nhà máy */}
                    <div className="flex flex-col items-center">
                        <div className="font-bold text-[13px] leading-tight uppercase w-full">
                            <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                <input
                                    type="text"
                                    value={signer3Title}
                                    onChange={(e) => setSigner3Title(e.target.value)}
                                    className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:outline-none uppercase"
                                />
                            </span>
                            <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                                {signer3Title}
                            </span>
                        </div>
                        <div className="h-20 print:h-14" />
                        <div className="font-bold text-[12.5px] w-full">
                            <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                <input
                                    type="text"
                                    value={signer3Name}
                                    onChange={(e) => setSigner3Name(e.target.value)}
                                    placeholder=""
                                    className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:outline-none"
                                />
                            </span>
                            <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                                {signer3Name}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Row 2: 2 Signatures (Bảo vệ, Tài xế) */}
                <div className="grid grid-cols-3 text-center gap-4">
                    {/* 4. Bảo vệ */}
                    <div className="flex flex-col items-center">
                        <div className="font-bold text-[13px] leading-tight uppercase w-full">
                            <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                <input
                                    type="text"
                                    value={signer4Title}
                                    onChange={(e) => setSigner4Title(e.target.value)}
                                    className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:outline-none uppercase"
                                />
                            </span>
                            <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                                {signer4Title}
                            </span>
                        </div>
                        <div className="h-20 print:h-14" />
                        <div className="font-bold text-[12.5px] w-full">
                            <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                <input
                                    type="text"
                                    value={signer4Name}
                                    onChange={(e) => setSigner4Name(e.target.value)}
                                    placeholder=""
                                    className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:outline-none"
                                />
                            </span>
                            <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                                {signer4Name}
                            </span>
                        </div>
                    </div>

                    {/* 5. Tài xế */}
                    <div className="flex flex-col items-center">
                        <div className="font-bold text-[13px] leading-tight uppercase w-full">
                            <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                <input
                                    type="text"
                                    value={signer5Title}
                                    onChange={(e) => setSigner5Title(e.target.value)}
                                    className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:outline-none uppercase"
                                />
                            </span>
                            <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                                {signer5Title}
                            </span>
                        </div>
                        <div className="h-20 print:h-14" />
                        <div className="font-bold text-[12.5px] w-full">
                            <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                <input
                                    type="text"
                                    value={signer5Name}
                                    onChange={(e) => setSigner5Name(e.target.value)}
                                    placeholder=""
                                    className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:outline-none"
                                />
                            </span>
                            <span className={`hidden print:block ${isSnapshot ? 'block' : ''}`}>
                                {signer5Name}
                            </span>
                        </div>
                    </div>

                    {/* Empty placeholder for 3rd column */}
                    <div />
                </div>
            </div>
        </div>
    )
}
