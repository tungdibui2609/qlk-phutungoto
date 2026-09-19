'use client'

import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import {
    Printer,
    ArrowLeft,
    Plus,
    Trash2,
    FileSpreadsheet,
    RefreshCw,
    Loader2,
    Warehouse as WarehouseIcon,
    FileText,
    RotateCcw
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { formatQuantityFull } from '@/lib/numberUtils'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

interface BankReportItem {
    id: string
    productName: string
    unit: string
    opening: string | number
    qtyIn: string | number
    qtyOut: string | number
    balance: string | number
    totalValue: string | number
}

interface Branch {
    id: string
    name: string
    is_default?: boolean
}

// Generate default blank rows for handwriting / manual entry
function createBlankRows(count = 8): BankReportItem[] {
    return Array.from({ length: count }, (_, idx) => ({
        id: `blank-${Date.now()}-${idx}`,
        productName: '',
        unit: '',
        opening: '',
        qtyIn: '',
        qtyOut: '',
        balance: '',
        totalValue: ''
    }))
}

function BankReportContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Date filters (blank by default to match the paper template)
    const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '')
    const [dateTo, setDateTo] = useState(searchParams.get('to') || '')

    // Branches & Warehouse
    const [branches, setBranches] = useState<Branch[]>([])
    const [selectedBranch, setSelectedBranch] = useState<string>('Tất cả')

    // Document texts matching user photo
    const [docTitle, setDocTitle] = useState('BÁO CÁO TỔNG HỢP NHẬP - XUẤT - TỒN')
    const [bankName, setBankName] = useState('Ngân hàng TMCP Công thương Việt Nam - Chi nhánh Bến Tre')
    const [introStatement, setIntroStatement] = useState(
        'Công Ty TNHH Dịch Vụ Bảo Vệ Ngày & Đêm kính gửi ngân hàng báo cáo hàng hóa đang bảo vệ tại kho của Công ty Cổ phần Tập Đoàn XNK Trái Cây Chánh Thu như sau:'
    )

    // Date line for signature (default dots for handwriting as in photo)
    const [signDay, setSignDay] = useState('......')
    const [signMonth, setSignMonth] = useState('......')
    const [signYear, setSignYear] = useState('2025')

    // Signatures
    const [signer1Title, setSigner1Title] = useState('Đại diện Công ty CP Tập Đoàn XNK Trái Cây Chánh Thu')
    const [signer1Name, setSigner1Name] = useState('Nguyễn Đình Tùng')
    const [signer2Title, setSigner2Title] = useState('Đại diện Công Ty TNHH Dịch Vụ Bảo Vệ Ngày & Đêm')
    const [signer2Name, setSigner2Name] = useState('')

    // Table Data - Default to 8 blank rows for handwriting
    const [items, setItems] = useState<BankReportItem[]>(() => createBlankRows(8))
    const [loading, setLoading] = useState(false)

    // Load Branches for warehouse selector
    useEffect(() => {
        async function fetchBranches() {
            try {
                const { data } = await supabase.from('branches').select('id, name, is_default')
                if (data) {
                    setBranches(data as Branch[])
                    const def = (data as Branch[]).find(b => b.is_default)
                    if (def) setSelectedBranch(def.name)
                }
            } catch (err) {
                console.error('Error fetching branches:', err)
            }
        }
        fetchBranches()
    }, [])

    // Optional on-demand fetch: Only load from warehouse if user explicitly clicks
    const handleLoadFromWarehouse = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (dateFrom) params.set('dateFrom', dateFrom)
            if (dateTo) params.set('dateTo', dateTo)
            if (selectedBranch && selectedBranch !== 'Tất cả') {
                params.set('warehouse', selectedBranch)
            }

            const res = await fetch(`/api/inventory?${params.toString()}`)
            const data = await res.json()

            if (data.ok && Array.isArray(data.items) && data.items.length > 0) {
                const mapped: BankReportItem[] = data.items.map((it: any, index: number) => ({
                    id: it.productCode || `row-${index}`,
                    productName: it.productName || it.productCode || '',
                    unit: it.unit || 'kg',
                    opening: Number(it.opening) || 0,
                    qtyIn: Number(it.qtyIn) || 0,
                    qtyOut: Number(it.qtyOut) || 0,
                    balance: Number(it.balance) || 0,
                    totalValue: ''
                }))
                setItems(mapped)
            } else {
                alert('Không tìm thấy dữ liệu tồn kho trong khoảng thời gian này.')
            }
        } catch (err) {
            console.error('Failed to load inventory for bank report:', err)
            alert('Có lỗi khi tải dữ liệu tồn kho.')
        } finally {
            setLoading(false)
        }
    }

    // Reset to blank template
    const handleResetBlank = (count = 8) => {
        setItems(createBlankRows(count))
    }

    // Update individual cell
    const updateItem = (id: string, field: keyof BankReportItem, val: string | number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, [field]: val }
            }
            return item
        }))
    }

    // Add a single blank row
    const handleAddRow = () => {
        const newRow: BankReportItem = {
            id: `manual-${Date.now()}`,
            productName: '',
            unit: '',
            opening: '',
            qtyIn: '',
            qtyOut: '',
            balance: '',
            totalValue: ''
        }
        setItems(prev => [...prev, newRow])
    }

    // Delete a row
    const handleDeleteRow = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id))
    }

    // Totals Calculation (only sums numeric rows)
    const totals = useMemo(() => {
        let hasAnyNumber = false
        const res = items.reduce((acc, it) => {
            const op = it.opening !== '' ? Number(it.opening) : NaN
            const qi = it.qtyIn !== '' ? Number(it.qtyIn) : NaN
            const qo = it.qtyOut !== '' ? Number(it.qtyOut) : NaN
            const bl = it.balance !== '' ? Number(it.balance) : NaN
            const tv = it.totalValue !== '' ? Number(it.totalValue) : NaN

            if (!isNaN(op) || !isNaN(qi) || !isNaN(qo) || !isNaN(bl) || !isNaN(tv)) {
                hasAnyNumber = true
            }

            return {
                opening: acc.opening + (!isNaN(op) ? op : 0),
                qtyIn: acc.qtyIn + (!isNaN(qi) ? qi : 0),
                qtyOut: acc.qtyOut + (!isNaN(qo) ? qo : 0),
                balance: acc.balance + (!isNaN(bl) ? bl : 0),
                totalValue: acc.totalValue + (!isNaN(tv) ? tv : 0)
            }
        }, { opening: 0, qtyIn: 0, qtyOut: 0, balance: 0, totalValue: 0 })

        return { ...res, hasAnyNumber }
    }, [items])

    // Subtitle date formatting: if empty, display standard dots "Từ ngày ............ Đến ngày ............"
    const formattedDateRange = useMemo(() => {
        const f = dateFrom ? format(new Date(dateFrom), 'dd/MM/yyyy') : '............'
        const t = dateTo ? format(new Date(dateTo), 'dd/MM/yyyy') : '............'
        return `Từ ngày ${f} Đến ngày ${t}`
    }, [dateFrom, dateTo])

    // Format cell display
    const renderCellDisplay = (val: string | number) => {
        if (val === '' || val === null || val === undefined) return '\u00A0'
        const num = Number(val)
        if (!isNaN(num) && typeof val === 'number') {
            return formatQuantityFull(num)
        }
        return String(val)
    }

    // Excel Export
    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook()
        const ws = workbook.addWorksheet('Báo Cáo Ngân Hàng')

        // Title
        ws.addRow([])
        ws.addRow(['', '', docTitle])
        ws.addRow(['', '', formattedDateRange])
        ws.addRow(['', `Kính gửi: ${bankName}`])
        ws.addRow(['', introStatement])
        ws.addRow([])

        // Table Header
        const headerRow = ws.addRow([
            'STT',
            'TÊN, QUY CÁCH VẬT LIỆU, DỤNG CỤ SẢN PHẨM HÀNG HÓA',
            'ĐVT',
            'TỒN ĐẦU KỲ',
            'NHẬP TRONG KỲ',
            'XUẤT TRONG KỲ',
            'TỒN CUỐI KỲ',
            'TỔNG TRỊ GIÁ'
        ])

        headerRow.font = { bold: true }
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

        // Data Rows
        items.forEach((it, idx) => {
            ws.addRow([
                idx + 1,
                it.productName,
                it.unit,
                it.opening !== '' ? Number(it.opening) || it.opening : '',
                it.qtyIn !== '' ? Number(it.qtyIn) || it.qtyIn : '',
                it.qtyOut !== '' ? Number(it.qtyOut) || it.qtyOut : '',
                it.balance !== '' ? Number(it.balance) || it.balance : '',
                it.totalValue !== '' ? Number(it.totalValue) || it.totalValue : ''
            ])
        })

        // Total Row
        const totRow = ws.addRow([
            '',
            'TỔNG CỘNG',
            '',
            totals.hasAnyNumber ? totals.opening : '',
            totals.hasAnyNumber ? totals.qtyIn : '',
            totals.hasAnyNumber ? totals.qtyOut : '',
            totals.hasAnyNumber ? totals.balance : '',
            totals.hasAnyNumber ? (totals.totalValue || '') : ''
        ])
        totRow.font = { bold: true }

        // Column widths
        ws.columns = [
            { width: 8 },
            { width: 45 },
            { width: 12 },
            { width: 16 },
            { width: 16 },
            { width: 16 },
            { width: 16 },
            { width: 20 }
        ]

        const buffer = await workbook.xlsx.writeBuffer()
        saveAs(new Blob([buffer]), `Bao_cao_ngan_hang_trang_${format(new Date(), 'yyyyMMdd')}.xlsx`)
    }

    return (
        <div className="min-h-screen bg-stone-100 text-stone-900 pb-16">
            {/* ── Top Controls Toolbar (Hidden in Print) ── */}
            <div className="sticky top-0 z-30 bg-white shadow-md border-b border-stone-200 px-4 py-3 print:hidden">
                <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-3">
                    {/* Left: Back & Title */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-600 hover:text-stone-900"
                            title="Quay lại"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-base font-bold text-stone-800 leading-tight flex items-center gap-2">
                                <span>Phiếu Ngân Hàng (Khổ A4 Ngang)</span>
                                <span className="text-[11px] font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                                    Mẫu điền tay / in trắng
                                </span>
                            </h1>
                            <p className="text-xs text-stone-500">
                                Để trống sẵn dòng để in ra viết tay, hoặc nhập trực tiếp trước khi in
                            </p>
                        </div>
                    </div>

                    {/* Middle: Actions for Template */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        {/* Reset to Blank */}
                        <div className="flex items-center gap-1 bg-stone-50 border border-stone-300 rounded-lg p-1">
                            <button
                                type="button"
                                onClick={() => handleResetBlank(8)}
                                className="px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200 rounded transition-colors flex items-center gap-1"
                                title="Mẫu trắng 8 dòng"
                            >
                                <RotateCcw size={13} />
                                <span>8 dòng trắng</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleResetBlank(12)}
                                className="px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200 rounded transition-colors"
                                title="Mẫu trắng 12 dòng"
                            >
                                12 dòng
                            </button>
                        </div>

                        {/* Add blank row */}
                        <button
                            type="button"
                            onClick={handleAddRow}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-stone-50 hover:bg-stone-200 text-stone-700 rounded-lg border border-stone-300 transition-colors"
                            title="Thêm 1 dòng trống mới"
                        >
                            <Plus size={14} />
                            <span>Thêm dòng</span>
                        </button>

                        {/* Optional Date Pickers */}
                        <div className="hidden lg:flex items-center gap-1.5 bg-stone-50 border border-stone-300 rounded-lg px-2 py-1 text-xs">
                            <span className="text-stone-500">Từ:</span>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="bg-transparent focus:outline-none"
                            />
                            <span className="text-stone-500">Đến:</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="bg-transparent focus:outline-none"
                            />
                            {(dateFrom || dateTo) && (
                                <button
                                    type="button"
                                    onClick={() => { setDateFrom(''); setDateTo('') }}
                                    className="text-[11px] text-blue-600 hover:underline ml-1"
                                    title="Xóa ngày để in dấu chấm chấm"
                                >
                                    Để trống (...)
                                </button>
                            )}
                        </div>

                        {/* On-demand Warehouse load */}
                        <button
                            type="button"
                            onClick={handleLoadFromWarehouse}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg border border-amber-300 transition-colors"
                            title="Lấy số liệu tồn kho hiện tại nếu không muốn điền tay"
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                            <span>Lấy số liệu từ kho (Tùy chọn)</span>
                        </button>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors"
                        >
                            <FileSpreadsheet size={15} />
                            <span>Xuất Excel</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all hover:scale-105 active:scale-95"
                        >
                            <Printer size={16} />
                            <span>In phiếu (A4 ngang)</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Document Container (#print-ready) ── */}
            <div className="max-w-[1240px] mx-auto p-4 sm:p-6 print:p-0">
                <div
                    id="print-ready"
                    className="bg-white mx-auto text-black shadow-xl rounded-sm p-8 sm:p-12 print:p-0 print:shadow-none print:m-0 w-full"
                    style={{
                        fontFamily: "'Times New Roman', Times, serif",
                        fontSize: '13.5px',
                        lineHeight: '1.4'
                    }}
                >
                    {/* Document Title Header */}
                    <div className="text-center mb-4">
                        <h1 className="text-[20px] sm:text-[22px] font-bold uppercase tracking-wide text-black mb-1">
                            <input
                                type="text"
                                value={docTitle}
                                onChange={(e) => setDocTitle(e.target.value)}
                                className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none print:hidden uppercase"
                            />
                            <span className="hidden print:inline uppercase">{docTitle}</span>
                        </h1>

                        <div className="text-[13.5px] italic text-black font-normal">
                            <input
                                type="text"
                                value={formattedDateRange}
                                onChange={(e) => {
                                    // allow custom typing if needed
                                    const val = e.target.value
                                    if (val.includes('Từ') || val.includes('...')) {
                                        // keeping custom
                                    }
                                }}
                                className="w-full max-w-[450px] text-center italic bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none print:hidden"
                            />
                            <span className="hidden print:inline">{formattedDateRange}</span>
                        </div>
                    </div>

                    {/* Salutation & Statements */}
                    <div className="space-y-1.5 mb-3.5 text-black text-justify leading-relaxed">
                        <div className="flex items-baseline flex-wrap">
                            <span className="font-bold">Kính gửi:&nbsp;</span>
                            <span className="flex-1 min-w-[200px]">
                                <input
                                    type="text"
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    className="w-full font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none print:hidden"
                                />
                                <span className="hidden print:inline font-bold">{bankName}</span>
                            </span>
                        </div>

                        <div>
                            <textarea
                                value={introStatement}
                                onChange={(e) => setIntroStatement(e.target.value)}
                                rows={2}
                                className="w-full text-justify bg-transparent border border-dashed border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none resize-none print:hidden"
                            />
                            <span className="hidden print:inline">{introStatement}</span>
                        </div>
                    </div>

                    {/* Table (8 Columns matching photo) */}
                    <table className="w-full border-collapse border border-black mt-2 text-[13px]">
                        <thead>
                            <tr className="bg-gray-50/70 print:bg-transparent">
                                <th className="border border-black px-2 py-2.5 text-center font-bold w-12">
                                    STT
                                </th>
                                <th className="border border-black px-3 py-2.5 text-center font-bold">
                                    TÊN, QUY CÁCH VẬT LIỆU, DỤNG CỤ SẢN PHẨM HÀNG HÓA
                                </th>
                                <th className="border border-black px-2 py-2.5 text-center font-bold w-16">
                                    ĐVT
                                </th>
                                <th className="border border-black px-2 py-2.5 text-center font-bold w-28">
                                    TỒN ĐẦU KỲ
                                </th>
                                <th className="border border-black px-2 py-2.5 text-center font-bold w-28">
                                    NHẬP TRONG KỲ
                                </th>
                                <th className="border border-black px-2 py-2.5 text-center font-bold w-28">
                                    XUẤT TRONG KỲ
                                </th>
                                <th className="border border-black px-2 py-2.5 text-center font-bold w-28">
                                    TỒN CUỐI KỲ
                                </th>
                                <th className="border border-black px-2 py-2.5 text-center font-bold w-36">
                                    TỔNG TRỊ GIÁ
                                </th>
                                <th className="border border-black px-1 py-1 text-center w-8 print:hidden">
                                    #
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 h-10 print:h-10">
                                    {/* STT */}
                                    <td className="border border-black px-2 py-2 text-center font-semibold align-middle">
                                        {index + 1}
                                    </td>

                                    {/* Product Name & Specification */}
                                    <td className="border border-black px-3 py-2 text-left align-middle font-medium">
                                        <input
                                            type="text"
                                            value={item.productName}
                                            placeholder=""
                                            onChange={(e) => updateItem(item.id, 'productName', e.target.value)}
                                            className="w-full text-left bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:outline-none print:hidden font-medium"
                                        />
                                        <span className="hidden print:inline-block w-full">
                                            {item.productName || '\u00A0'}
                                        </span>
                                    </td>

                                    {/* Unit */}
                                    <td className="border border-black px-2 py-2 text-center align-middle">
                                        <input
                                            type="text"
                                            value={item.unit}
                                            placeholder=""
                                            onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                            className="w-full text-center bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:outline-none print:hidden"
                                        />
                                        <span className="hidden print:inline-block w-full text-center">
                                            {item.unit || '\u00A0'}
                                        </span>
                                    </td>

                                    {/* Opening */}
                                    <td className="border border-black px-2 py-2 text-right align-middle font-medium">
                                        <input
                                            type="text"
                                            value={item.opening}
                                            placeholder=""
                                            onChange={(e) => updateItem(item.id, 'opening', e.target.value)}
                                            className="w-full text-right bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:outline-none print:hidden"
                                        />
                                        <span className="hidden print:inline-block w-full text-right">
                                            {renderCellDisplay(item.opening)}
                                        </span>
                                    </td>

                                    {/* In */}
                                    <td className="border border-black px-2 py-2 text-right align-middle font-medium">
                                        <input
                                            type="text"
                                            value={item.qtyIn}
                                            placeholder=""
                                            onChange={(e) => updateItem(item.id, 'qtyIn', e.target.value)}
                                            className="w-full text-right bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:outline-none print:hidden"
                                        />
                                        <span className="hidden print:inline-block w-full text-right">
                                            {renderCellDisplay(item.qtyIn)}
                                        </span>
                                    </td>

                                    {/* Out */}
                                    <td className="border border-black px-2 py-2 text-right align-middle font-medium">
                                        <input
                                            type="text"
                                            value={item.qtyOut}
                                            placeholder=""
                                            onChange={(e) => updateItem(item.id, 'qtyOut', e.target.value)}
                                            className="w-full text-right bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:outline-none print:hidden"
                                        />
                                        <span className="hidden print:inline-block w-full text-right">
                                            {renderCellDisplay(item.qtyOut)}
                                        </span>
                                    </td>

                                    {/* Balance */}
                                    <td className="border border-black px-2 py-2 text-right align-middle font-bold">
                                        <input
                                            type="text"
                                            value={item.balance}
                                            placeholder=""
                                            onChange={(e) => updateItem(item.id, 'balance', e.target.value)}
                                            className="w-full text-right font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:outline-none print:hidden"
                                        />
                                        <span className="hidden print:inline-block w-full text-right">
                                            {renderCellDisplay(item.balance)}
                                        </span>
                                    </td>

                                    {/* Total Value */}
                                    <td className="border border-black px-2 py-2 text-right align-middle font-semibold">
                                        <input
                                            type="text"
                                            value={item.totalValue}
                                            placeholder=""
                                            onChange={(e) => updateItem(item.id, 'totalValue', e.target.value)}
                                            className="w-full text-right bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:outline-none print:hidden"
                                        />
                                        <span className="hidden print:inline-block w-full text-right">
                                            {renderCellDisplay(item.totalValue)}
                                        </span>
                                    </td>

                                    {/* Delete Action (Hidden in print) */}
                                    <td className="border border-black px-1 py-1 text-center align-middle print:hidden">
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteRow(item.id)}
                                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                            title="Xóa dòng này"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {/* Total Row */}
                            <tr className="font-bold bg-gray-50/60 print:bg-transparent h-10 print:h-10">
                                <td colSpan={3} className="border border-black px-3 py-2.5 text-center font-bold uppercase tracking-wider">
                                    TỔNG CỘNG
                                </td>
                                <td className="border border-black px-2 py-2.5 text-right font-bold">
                                    {totals.hasAnyNumber ? formatQuantityFull(totals.opening) : '\u00A0'}
                                </td>
                                <td className="border border-black px-2 py-2.5 text-right font-bold">
                                    {totals.hasAnyNumber ? formatQuantityFull(totals.qtyIn) : '\u00A0'}
                                </td>
                                <td className="border border-black px-2 py-2.5 text-right font-bold">
                                    {totals.hasAnyNumber ? formatQuantityFull(totals.qtyOut) : '\u00A0'}
                                </td>
                                <td className="border border-black px-2 py-2.5 text-right font-bold">
                                    {totals.hasAnyNumber ? formatQuantityFull(totals.balance) : '\u00A0'}
                                </td>
                                <td className="border border-black px-2 py-2.5 text-right font-bold">
                                    {totals.hasAnyNumber && totals.totalValue ? totals.totalValue.toLocaleString('vi-VN') : '\u00A0'}
                                </td>
                                <td className="border border-black print:hidden" />
                            </tr>
                        </tbody>
                    </table>

                    {/* Signatures and Date Section */}
                    <div className="mt-8 break-inside-avoid print:break-inside-avoid">
                        {/* Date line (Right aligned above signature) */}
                        <div className="flex justify-end text-[13.5px] italic mb-3">
                            <div className="text-center">
                                <span className="print:hidden">
                                    Ngày{' '}
                                    <input
                                        type="text"
                                        value={signDay}
                                        onChange={(e) => setSignDay(e.target.value)}
                                        className="w-12 text-center bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                                    />
                                    {' '}Tháng{' '}
                                    <input
                                        type="text"
                                        value={signMonth}
                                        onChange={(e) => setSignMonth(e.target.value)}
                                        className="w-12 text-center bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                                    />
                                    {' '}Năm{' '}
                                    <input
                                        type="text"
                                        value={signYear}
                                        onChange={(e) => setSignYear(e.target.value)}
                                        className="w-16 text-center bg-transparent border-b border-dashed border-gray-400 focus:outline-none"
                                    />
                                </span>
                                <span className="hidden print:inline">
                                    Ngày {signDay} Tháng {signMonth} Năm {signYear}
                                </span>
                            </div>
                        </div>

                        {/* Two Signatures (Chánh Thu & Ngày & Đêm) */}
                        <div className="flex justify-between items-start text-center">
                            {/* Left: Chánh Thu */}
                            <div className="w-[45%] flex flex-col items-center">
                                <div className="font-bold text-[13.5px] leading-snug w-full">
                                    <input
                                        type="text"
                                        value={signer1Title}
                                        onChange={(e) => setSigner1Title(e.target.value)}
                                        className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:outline-none print:hidden"
                                    />
                                    <span className="hidden print:block font-bold">{signer1Title}</span>
                                </div>
                                <div className="text-xs italic text-gray-500 mt-1 print:hidden">
                                    (Ký, họ tên, đóng dấu)
                                </div>
                                <div className="h-24 print:h-20" />
                                <div className="font-bold text-[13px] w-full">
                                    <input
                                        type="text"
                                        value={signer1Name}
                                        onChange={(e) => setSigner1Name(e.target.value)}
                                        placeholder="Họ tên..."
                                        className="w-48 text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:outline-none print:hidden"
                                    />
                                    <span className="hidden print:block font-bold">{signer1Name}</span>
                                </div>
                            </div>

                            {/* Right: Ngày & Đêm */}
                            <div className="w-[48%] flex flex-col items-center">
                                <div className="font-bold text-[13.5px] leading-snug w-full">
                                    <input
                                        type="text"
                                        value={signer2Title}
                                        onChange={(e) => setSigner2Title(e.target.value)}
                                        className="w-full text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:outline-none print:hidden"
                                    />
                                    <span className="hidden print:block font-bold">{signer2Title}</span>
                                </div>
                                <div className="text-xs italic text-gray-500 mt-1 print:hidden">
                                    (Ký, họ tên, đóng dấu)
                                </div>
                                <div className="h-24 print:h-20" />
                                <div className="font-bold text-[13px] w-full">
                                    <input
                                        type="text"
                                        value={signer2Name}
                                        onChange={(e) => setSigner2Name(e.target.value)}
                                        placeholder=""
                                        className="w-48 text-center font-bold bg-transparent border-b border-dashed border-transparent hover:border-gray-400 focus:outline-none print:hidden"
                                    />
                                    <span className="hidden print:block font-bold">{signer2Name}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles for A4 Landscape */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4 landscape !important;
                        margin: 10mm 15mm 10mm 15mm !important;
                    }
                    html, body {
                        width: 100% !important;
                        height: auto !important;
                        min-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        background: white !important;
                    }
                    #print-ready {
                        width: 100% !important;
                        max-width: 100% !important;
                        min-width: 0 !important;
                        height: auto !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        box-sizing: border-box !important;
                        box-shadow: none !important;
                        border: none !important;
                        overflow: visible !important;
                        font-size: 13px !important;
                        line-height: 1.35 !important;
                    }
                    #print-ready table {
                        width: 100% !important;
                        table-layout: auto !important;
                        border-collapse: collapse !important;
                    }
                    #print-ready table th,
                    #print-ready table td {
                        border: 1px solid black !important;
                        word-break: normal !important;
                        overflow-wrap: normal !important;
                        height: 38px !important;
                        min-height: 38px !important;
                        vertical-align: middle !important;
                    }
                    #print-ready * {
                        color: black !important;
                    }
                    thead {
                        display: table-header-group !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    )
}

export default function BankReportPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-stone-50">
                <div className="flex items-center gap-2 text-stone-500">
                    <Loader2 className="animate-spin" size={20} />
                    <span>Đang tải phiếu ngân hàng...</span>
                </div>
            </div>
        }>
            <BankReportContent />
        </Suspense>
    )
}
