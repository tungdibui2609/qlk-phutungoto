'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Printer, Edit3, Loader2 } from 'lucide-react'

interface CompanyInfo {
    name: string
    short_name: string | null
    address: string | null
    phone: string | null
    email: string | null
    tax_code: string | null
    logo_url: string | null
}

interface OrderItem {
    id: string
    product_name: string | null
    unit: string | null
    quantity: number
    document_quantity: number
    price: number
    note: string | null
    products: { sku: string } | null
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
}

// Editable text component - shows input on screen, shows text when printing
function EditableText({
    value,
    onChange,
    placeholder = '',
    className = '',
    isSnapshot = false
}: {
    value: string
    onChange: (val: string) => void
    placeholder?: string
    className?: string
    isSnapshot?: boolean
}) {
    return (
        <>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`print:hidden ${isSnapshot ? 'hidden' : ''} bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none transition-colors ${className}`}
            />
            <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''} ${className}`}>{value || ''}</span>
        </>
    )
}

function AutoResizeInput({
    value,
    onChange,
    minWidth = 30,
    emptyWidth = 30,
    className = '',
    isSnapshot = false
}: {
    value: string
    onChange: (val: string) => void
    minWidth?: number
    emptyWidth?: number
    className?: string
    isSnapshot?: boolean
}) {
    return (
        <>
            <span className={`${isSnapshot ? 'hidden' : ''} print:hidden ${className}`}>
                <span className="inline-grid items-center w-full h-full">
                    {/* Hidden span to measure content width */}
                    <span className="invisible col-start-1 row-start-1 px-1 overflow-hidden whitespace-pre border-b border-transparent opacity-0 pointer-events-none">
                        {value || '00'}
                    </span>
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="col-start-1 row-start-1 w-full h-full text-center bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none"
                        style={{ minWidth: `${minWidth}px` }}
                    />
                </span>
            </span>
            <span
                className={`${isSnapshot ? 'inline-block' : 'hidden'} print:inline-block ${className}`}
                style={{ minWidth: !value ? `${emptyWidth}px` : undefined }}
            >
                {value || ''}
            </span>
        </>
    )
}

function numberToVietnameseText(number: number): string {
    const defaultNumbers = ' hai ba bốn năm sáu bảy tám chín'
    const chuHangDonVi = ('1 mốt' + defaultNumbers).split(' ')
    const chuHangChuc = ('lẻ mười' + defaultNumbers).split(' ')
    const chuHangTram = ('không một' + defaultNumbers).split(' ')
    const dvBlock = '1 nghìn triệu tỷ'.split(' ')

    function convert_block_three(number: string, isLeading: boolean = false): string {
        var a = parseInt(number.substring(0, 1))
        var b = parseInt(number.substring(1, 2))
        var c = parseInt(number.substring(2, 3))
        var chu = ''

        // Hàng trăm
        if (!isLeading || a !== 0) {
            chu = chuHangTram[a] + ' trăm'
        }

        // Hàng chục
        if (b === 0) {
            if (c !== 0) {
                // If leading and hundreds was skipped (a=0), we don't say "lẻ"
                if (isLeading && a === 0) {
                    chu += ' ' + chuHangTram[c]
                } else {
                    chu += ' lẻ ' + chuHangTram[c]
                }
            }
        } else if (b === 1) {
            chu += ' mười'
            if (c === 1) chu += ' một'
            else if (c !== 0) chu += ' ' + chuHangDonVi[c]
        } else {
            chu += ' ' + chuHangChuc[b] + ' mươi'
            if (c === 1) chu += ' mốt'
            else if (c === 4) chu += ' tư'
            else if (c !== 0) chu += ' ' + chuHangDonVi[c]
        }
        return chu
    }

    function to_vietnamese(number: number): string {
        var str = number.toString()
        var i = str.length
        if (i === 0 || str === 'NaN' || str === '0') return 'Không đồng'

        var chu = ''
        var dau = ''
        var index = 0
        var result = ''

        if (number < 0) {
            dau = 'Âm '
            str = str.substring(1)
            i--
        }

        var arr = []
        var position = i

        while (position >= 0) {
            arr.push(str.substring(Math.max(0, position - 3), position))
            position -= 3
        }

        for (i = 0; i < arr.length; i++) {
            if (arr[i] !== '' && arr[i] !== '000') {
                // Determine if this is the leading block (most significant)
                // Since we iterate 0..len, and arr is built right-to-left
                const isLeading = i === arr.length - 1
                result = convert_block_three(arr[i].padStart(3, '0'), isLeading) + (dvBlock[i] === '1' ? '' : ' ' + dvBlock[i]) + ' ' + result
            }
            index++
        }

        result = result.trim()
        // Capitalize first letter
        let suffix = ' đồng./.'
        if (number > 0 && number % 1000000 === 0) {
            suffix = ' đồng chẵn./.'
        }
        return dau + result.charAt(0).toUpperCase() + result.slice(1) + suffix
    }

    return to_vietnamese(number)
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
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(initialCompanyInfo)
    const [docQuantities, setDocQuantities] = useState<Record<string, string>>({})
    const [systemConfig, setSystemConfig] = useState<any>(null)
    const [unitsMap, setUnitsMap] = useState<Record<string, string>>({})

    // Module helpers
    const hasModule = (moduleId: string) => {
        if (!systemConfig) return false
        const modules = typeof systemConfig.outbound_modules === 'string'
            ? JSON.parse(systemConfig.outbound_modules)
            : systemConfig.outbound_modules
        return Array.isArray(modules) && modules.includes(moduleId)
    }

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
    const [signTitle1, setSignTitle1] = useState('Người lập phiếu')
    const [signTitle2, setSignTitle2] = useState('Thủ kho')
    const [signTitle3, setSignTitle3] = useState('Kế toán trưởng')
    const [signTitle4, setSignTitle4] = useState('Người nhận hàng')
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

    // Download loading state
    const [isDownloading, setIsDownloading] = useState(false)
    const [downloadTimer, setDownloadTimer] = useState(0)

    const token = searchParams.get('token')

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
                // Fetch company info
                const { data: companyData } = await supabase
                    .from('company_settings')
                    .select('*')
                    .limit(1)
                    .single()


                if (companyData) {
                    setCompanyInfo(companyData as any)
                    setEditLocation((companyData as any).address || '')
                }

                // Fetch order
                const { data: orderData } = await supabase
                    .from('outbound_orders')
                    .select('*')
                    .eq('id', orderId)
                    .single()

                if (orderData) {
                    const o = orderData as any
                    setOrder(o)

                    // Fetch system config based on order's system_code
                    if (o.system_code) {
                        const { data: sysData } = await supabase
                            .from('system_configs')
                            .select('*')
                            .eq('system_code', o.system_code)
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
                    setEditLocation(searchParams.get('editLocation') || cmpAddress || (companyData as any)?.address || '')

                    setAmountInWords(searchParams.get('amountInWords') || '')
                    setAttachedDocs(searchParams.get('attachedDocs') || '')

                    setSignTitle1(searchParams.get('signTitle1') || 'Người lập phiếu')
                    setSignTitle2(searchParams.get('signTitle2') || 'Thủ kho')
                    setSignTitle3(searchParams.get('signTitle3') || 'Kế toán trưởng')
                    setSignTitle4(searchParams.get('signTitle4') || 'Người nhận hàng')

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

                    // Fetch units for conversion map
                    const { data: unitsData } = await supabase.from('units').select('id, name')
                    if (unitsData) {
                        const map: Record<string, string> = {}
                        unitsData.forEach((u: any) => map[u.id] = u.name)
                        setUnitsMap(map)
                    }

                    // Fetch items
                    const { data: itemsData } = await supabase
                        .from('outbound_order_items')
                        .select(`
                            *,
                            products (
                                sku,
                                unit,
                                product_units (
                                    unit_id,
                                    conversion_rate
                                )
                            )
                        `)
                        .eq('order_id', orderId)

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

    const handleDownload = async () => {
        if (isDownloading) return

        setIsDownloading(true)
        setDownloadTimer(0)

        // Start timer
        const timerInterval = setInterval(() => {
            setDownloadTimer(prev => prev + 1)
        }, 1000)

        try {
            const params = new URLSearchParams()
            if (orderId) params.set('id', orderId)
            params.set('type', printType)

            // Append all editable fields
            params.set('editDay', editDay)
            params.set('editMonth', editMonth)
            params.set('editYear', editYear)
            params.set('editCustomerName', editCustomerName)
            params.set('editCustomerAddress', editCustomerAddress)
            params.set('editReason', editReason)
            params.set('editWarehouse', editWarehouse)
            params.set('editLocation', editLocation)
            params.set('editDescription', editDescription)
            params.set('amountInWords', amountInWords)
            params.set('attachedDocs', attachedDocs)
            params.set('signTitle1', signTitle1)
            params.set('signTitle2', signTitle2)
            params.set('signTitle3', signTitle3)
            params.set('signTitle4', signTitle4)
            params.set('signPerson1', signPerson1)
            params.set('signPerson2', signPerson2)
            params.set('signPerson3', signPerson3)
            params.set('signPerson4', signPerson4)
            params.set('signDay', signDay)
            params.set('signMonth', signMonth)
            params.set('signYear', signYear)
            params.set('debitAccount', debitAccount)
            params.set('creditAccount', creditAccount)
            params.set('editNote', editNote)

            const res = await fetch(`/api/outbound/print-image?${params.toString()}`)
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.details || errData.error || 'Failed to generate image')
            }

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Phieu_xuat_${order?.code || 'scan'}.jpg`
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
        <div id="print-ready" data-ready={!loading && order ? "true" : undefined} className="pt-0 px-6 pb-6 print:p-4 max-w-4xl mx-auto bg-white text-black text-[13px] leading-relaxed">
            {/* Toolbar - Hidden when printing or snapshotting */}
            <div className={`fixed top-4 right-4 print:hidden z-50 flex items-center gap-2 ${isSnapshot ? 'hidden' : ''}`}>
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className={`flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-full shadow-lg transition-all hover:scale-105 ${isDownloading ? 'opacity-70 cursor-wait' : ''}`}
                >
                    {isDownloading ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            Đang tạo ảnh... ({downloadTimer}s)
                        </>
                    ) : (
                        <>
                            <Printer size={20} />
                            Tải ảnh phiếu
                        </>
                    )}
                </button>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full shadow-lg transition-all hover:scale-105"
                >
                    <Printer size={20} />
                    In phiếu
                </button>
            </div>

            {/* Header */}
            <div className="relative mb-4">
                {/* Legal Header - Top Right - Only show for official form */}
                {!isInternal && (
                    <div className="absolute top-0 right-0 text-center text-[9px] leading-tight font-bold text-gray-700">
                        <div className="text-red-600 font-bold">Mẫu số 02 - VT</div>
                        <div>(Ban hành theo Thông tư số 200/2014/TT-BTC</div>
                        <div>Ngày 22/12/2014 của Bộ Tài chính)</div>
                    </div>
                )}

                <div className="flex items-center gap-3">
                    {/* Logo */}
                    <div className="shrink-0">
                        {companyInfo?.logo_url ? (
                            <img
                                src={companyInfo.logo_url}
                                alt="Logo"
                                className={isInternal ? "h-20 w-auto object-contain" : "h-10 w-auto object-contain"}
                            />
                        ) : (
                            <div className={`${isInternal ? 'h-20 w-20 text-2xl' : 'h-14 w-14 text-xl'} bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold`}>
                                {companyInfo?.short_name?.[0] || 'C'}
                            </div>
                        )}
                    </div>

                    {/* Company Info */}
                    <div className="flex flex-col justify-center gap-0.5">
                        <div className={`text-emerald-700 font-bold uppercase leading-tight ${isInternal ? 'text-sm' : 'text-[10px]'} mb-0 whitespace-nowrap`}>
                            {companyInfo?.name || 'CÔNG TY'}
                        </div>
                        {companyInfo?.address && (
                            <div className={`font-bold text-gray-700 leading-tight ${isInternal ? 'text-sm' : 'text-[8px]'}`}>
                                Địa chỉ: {companyInfo.address}
                            </div>
                        )}
                        <div className={`font-bold text-gray-700 leading-tight ${isInternal ? 'text-sm' : 'text-[8px]'}`}>
                            {companyInfo?.email && `Email: ${companyInfo.email}`}
                            {companyInfo?.email && companyInfo?.phone && <span className="mx-1">|</span>}
                            {companyInfo?.phone && `ĐT: ${companyInfo.phone}`}
                        </div>
                    </div>
                </div>
            </div>

            {/* Title */}
            <div className="relative text-center mt-4 mb-1">
                <h1 className="text-xl font-bold tracking-wide" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                    PHIẾU XUẤT KHO
                </h1>

                {/* Nợ/Có on the right - absolute positioned - Only for official form */}
                {!isInternal && hasModule('outbound_financials') && (
                    <div className="absolute top-4 right-36 text-left">
                        {/* Nợ */}
                        <div className="text-sm font-medium text-gray-700">
                            <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                Nợ:{' '}
                                <input
                                    type="text"
                                    value={debitAccount}
                                    onChange={(e) => setDebitAccount(e.target.value)}
                                    className="w-16 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500"
                                />
                            </span>
                            <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>Nợ: <span className="inline-block min-w-[40px] border-b border-dashed border-gray-300">{debitAccount}</span></span>
                        </div>
                        {/* Có */}
                        <div className="text-sm font-medium text-gray-700 mt-1">
                            <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                                Có:{' '}
                                <input
                                    type="text"
                                    value={creditAccount}
                                    onChange={(e) => setCreditAccount(e.target.value)}
                                    className="w-16 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500"
                                />
                            </span>
                            <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>Có: <span className="inline-block min-w-[40px] border-b border-dashed border-gray-300">{creditAccount}</span></span>
                        </div>
                    </div>
                )}

                {/* Centered: Date */}
                <div className="text-sm italic text-gray-600 mt-2">
                    <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
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
                    <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>
                        Ngày {editDay} tháng {editMonth} năm {editYear}
                    </span>
                </div>

                {/* Centered: Số */}
                <div className="text-sm font-medium mt-1">
                    Số: <span className="font-bold text-orange-600">{order.code}</span>
                </div>
            </div>

            {/* Order Info - All fields are editable */}
            <div className="mt-6 space-y-2 text-sm">
                <div className="flex items-center">
                    <span className="text-gray-600 shrink-0">- Họ tên người nhận hàng:</span>
                    <EditableText
                        value={editCustomerName}
                        onChange={setEditCustomerName}
                        className="ml-2 flex-1 font-bold"
                        isSnapshot={isSnapshot}
                    />
                </div>
                <div className="flex items-center">
                    <span className="text-gray-600 shrink-0">- Địa chỉ ( bộ phận ):</span>
                    <EditableText
                        value={editCustomerAddress}
                        onChange={setEditCustomerAddress}
                        className="ml-2 flex-1 font-bold"
                        isSnapshot={isSnapshot}
                    />
                </div>
                <div className="flex items-center">
                    <span className="text-gray-600 shrink-0">- Lý do xuất kho:</span>
                    <EditableText
                        value={editReason}
                        onChange={setEditReason}
                        className="ml-2 flex-1 font-bold"
                        isSnapshot={isSnapshot}
                    />
                </div>
                <div className="flex items-center gap-8">
                    <div className="flex items-center">
                        <span className="text-gray-600 shrink-0">- Xuất tại kho:</span>
                        <EditableText
                            value={editWarehouse}
                            onChange={setEditWarehouse}
                            className="ml-2 font-bold"
                            isSnapshot={isSnapshot}
                        />
                    </div>
                    <div className="flex items-center flex-1">
                        <span className="text-gray-600 shrink-0">Địa điểm:</span>
                        <input
                            type="text"
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            className={`print:hidden ${isSnapshot ? 'hidden' : ''} flex-1 ml-2 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                        />
                        <span className={`hidden print:inline ml-2 flex-1 min-w-[50px] font-bold ${isSnapshot ? 'inline' : ''}`}>{editLocation || '\u00A0'}</span>
                    </div>
                </div>
                <div className="flex items-center">
                    <span className="text-gray-600 shrink-0">- Ghi chú:</span>
                    <input
                        type="text"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        className={`print:hidden ${isSnapshot ? 'hidden' : ''} flex-1 ml-2 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                    />
                    <span className={`hidden print:inline ml-2 flex-1 font-bold ${isSnapshot ? 'inline' : ''}`}>{editNote || '\u00A0'}</span>
                </div>
            </div>

            {/* Items Table */}
            <div className="mt-6">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-center w-10">STT</th>
                            <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-center w-48">Tên, nhãn hiệu quy cách, phẩm chất vật tư, dụng cụ sản phẩm, hàng hóa</th>
                            <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-center w-24">Mã số</th>
                            <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-center w-14">Đơn vị tính</th>
                            <th colSpan={hasModule('outbound_conversion') && targetUnit ? (hasModule('outbound_financials') ? 3 : 2) : (hasModule('outbound_financials') ? 2 : 1)} className="border border-gray-400 px-2 py-2 text-center">Số lượng</th>
                            {!isInternal && hasModule('outbound_financials') && <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-center w-24">Đơn giá</th>}
                            {!isInternal && hasModule('outbound_financials') && <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-center w-28">Thành tiền</th>}
                            {isInternal && <th rowSpan={2} className="border border-gray-400 px-2 py-2 text-center w-32">Ghi chú</th>}
                        </tr>
                        <tr className="bg-gray-100">
                            {hasModule('outbound_financials') && <th className="border border-gray-400 px-2 py-2 text-center w-16 align-top">Yêu cầu</th>}
                            <th className="border border-gray-400 px-2 py-2 text-center w-16 align-top">Thực xuất</th>
                            {hasModule('outbound_conversion') && targetUnit && (
                                <th className="border border-gray-400 px-2 py-2 text-center w-20">Quy đổi<br /><span className="font-normal text-[10px]">({targetUnit})</span></th>
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
                                if (item.unit === product.unit) {
                                    baseQty = item.quantity
                                } else {
                                    const uConfig = product.product_units?.find((pu: any) => {
                                        return unitsMap[pu.unit_id] === item.unit
                                    })
                                    if (uConfig) baseQty = item.quantity * uConfig.conversion_rate
                                }

                                if (targetUnit === product.unit) {
                                    convertedQty = baseQty
                                } else {
                                    const targetConfig = product.product_units?.find((pu: any) => {
                                        return unitsMap[pu.unit_id] === targetUnit
                                    })
                                    if (targetConfig) convertedQty = baseQty / targetConfig.conversion_rate
                                }

                                if (typeof convertedQty === 'number') {
                                    convertedQty = Number.isInteger(convertedQty) ? convertedQty : convertedQty.toFixed(2)
                                }
                            }

                            return (
                                <tr key={item.id} className="hover:bg-gray-50 font-bold">
                                    <td className="border border-gray-400 px-2 py-1.5 text-center">{index + 1}</td>
                                    <td className="border border-gray-400 px-2 py-1.5">{item.product_name || 'N/A'}</td>
                                    <td className="border border-gray-400 px-2 py-1.5 text-center">
                                        {item.products?.sku || '-'}
                                    </td>
                                    <td className="border border-gray-400 px-2 py-1.5 text-center">{item.unit || '-'}</td>
                                    {hasModule('outbound_financials') && (
                                        <td className="border border-gray-400 px-2 py-1.5 text-center">
                                            <EditableText
                                                value={docQuantities[item.id] !== undefined ? docQuantities[item.id] : (item.document_quantity || item.quantity).toString()}
                                                onChange={(val) => setDocQuantities(prev => ({ ...prev, [item.id]: val }))}
                                                className="text-center w-full"
                                                isSnapshot={isSnapshot}
                                            />
                                        </td>
                                    )}
                                    <td className="border border-gray-400 px-2 py-1.5 text-center">
                                        {item.quantity.toLocaleString('vi-VN')}
                                    </td>
                                    {hasModule('outbound_conversion') && targetUnit && (
                                        <td className="border border-gray-400 px-2 py-1.5 text-center text-orange-600">
                                            {typeof convertedQty === 'number' ? convertedQty.toLocaleString('vi-VN') : convertedQty}
                                        </td>
                                    )}
                                    {!isInternal && hasModule('outbound_financials') && (
                                        <td className="border border-gray-400 px-2 py-1.5 text-right">
                                            {unitPrice > 0 ? unitPrice.toLocaleString('vi-VN') : '-'}
                                        </td>
                                    )}
                                    {!isInternal && hasModule('outbound_financials') && (
                                        <td className="border border-gray-400 px-2 py-1.5 text-right">
                                            {totalPrice > 0 ? totalPrice.toLocaleString('vi-VN') : '-'}
                                        </td>
                                    )}
                                    {isInternal && (
                                        <td className="border border-gray-400 px-2 py-1.5 text-xs text-gray-600">
                                            {item.note || ''}
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
                        <tr className="font-bold">
                            <td className="border border-gray-400 px-2 py-1.5 text-center"></td>
                            <td className="border border-gray-400 px-2 py-1.5 text-center">Cộng</td>
                            <td className="border border-gray-400 px-2 py-1.5 text-center">x</td>
                            <td className="border border-gray-400 px-2 py-1.5 text-center">x</td>

                            {hasModule('outbound_financials') && <td className="border border-gray-400 px-2 py-1.5 text-center">x</td>}

                            {/* Quantity Total */}
                            <td className="border border-gray-400 px-2 py-1.5 text-center">
                                {items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString('vi-VN')}
                            </td>

                            {/* Converted Total - Placeholder */}
                            {hasModule('outbound_conversion') && targetUnit && (
                                <td className="border border-gray-400 px-2 py-1.5 text-center text-orange-600">
                                    {items.reduce((sum, item) => {
                                        if (!item.products) return sum
                                        const product = item.products as any
                                        let baseQty = 0
                                        if (item.unit === product.unit) {
                                            baseQty = item.quantity
                                        } else {
                                            const uConfig = product.product_units?.find((pu: any) => unitsMap[pu.unit_id] === item.unit)
                                            if (uConfig) baseQty = item.quantity * uConfig.conversion_rate
                                        }

                                        let converted = 0
                                        if (targetUnit === product.unit) {
                                            converted = baseQty
                                        } else {
                                            const targetConfig = product.product_units?.find((pu: any) => unitsMap[pu.unit_id] === targetUnit)
                                            if (targetConfig) converted = baseQty / targetConfig.conversion_rate
                                        }
                                        return sum + converted
                                    }, 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}
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

            {/* Summary */}
            <div className="mt-4 text-sm space-y-1">
                {!isInternal && hasModule('outbound_financials') && (
                    <div className="flex items-center">
                        <span className="shrink-0">- Tổng số tiền (viết bằng chữ):</span>
                        <EditableText
                            value={amountInWords}
                            onChange={setAmountInWords}
                            className="ml-2 flex-1 font-medium italic"
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
                            className="ml-2 flex-1 font-medium"
                            isSnapshot={isSnapshot}
                        />
                    </div>
                )}
            </div>

            {/* Signatures - 4 columns for outbound */}
            <div className="mt-10 grid grid-cols-4 gap-3 text-center text-sm">
                <div>
                    <div className="text-sm italic text-center mb-1 invisible">
                        Ngày ... tháng ... năm ...
                    </div>
                    <div className="font-semibold">
                        <input
                            type="text"
                            value={signTitle1}
                            onChange={(e) => setSignTitle1(e.target.value)}
                            className={`print:hidden ${isSnapshot ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`}
                        />
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>{signTitle1}</span>
                    </div>
                    <div className="text-xs text-gray-500 italic hidden">(Hoặc bộ phận có nhu cầu xuất)</div>
                    <div className="text-xs text-gray-500 italic">(Ký, họ tên)</div>
                    <div className="h-16"></div>
                    <div className="mt-4">
                        <input
                            type="text"
                            value={signPerson1}
                            onChange={(e) => setSignPerson1(e.target.value)}
                            placeholder="Nhập tên..."
                            className={`print:hidden ${isSnapshot ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                        />
                        <span className={`hidden print:inline font-bold ${isSnapshot ? 'inline' : ''}`}>{signPerson1}</span>
                    </div>
                </div>
                <div>
                    <div className="text-sm italic text-center mb-1 invisible">
                        Ngày ... tháng ... năm ...
                    </div>
                    <div className="font-semibold">
                        <input
                            type="text"
                            value={signTitle4}
                            onChange={(e) => setSignTitle4(e.target.value)}
                            className={`print:hidden ${isSnapshot ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`}
                        />
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>{signTitle4}</span>
                    </div>
                    <div className="text-xs text-gray-500 italic hidden">(Hoặc bộ phận có nhu cầu xuất)</div>
                    <div className="text-xs text-gray-500 italic">(Ký, họ tên)</div>
                    <div className="h-16"></div>
                    <div className="mt-4">
                        <input
                            type="text"
                            value={signPerson4}
                            onChange={(e) => setSignPerson4(e.target.value)}
                            placeholder="Nhập tên..."
                            className={`print:hidden ${isSnapshot ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                        />
                        <span className={`hidden print:inline font-bold ${isSnapshot ? 'inline' : ''}`}>{signPerson4}</span>
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
                            className={`print:hidden ${isSnapshot ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`}
                        />
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>{signTitle2}</span>
                    </div>
                    <div className="text-xs text-gray-500 italic hidden">(Hoặc bộ phận có nhu cầu xuất)</div>
                    <div className="text-xs text-gray-500 italic">(Ký, họ tên)</div>
                    <div className="h-16"></div>
                    <div className="mt-4">
                        <input
                            type="text"
                            value={signPerson2}
                            onChange={(e) => setSignPerson2(e.target.value)}
                            placeholder="Nhập tên..."
                            className={`print:hidden ${isSnapshot ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                        />
                        <span className={`hidden print:inline font-bold ${isSnapshot ? 'inline' : ''}`}>{signPerson2}</span>
                    </div>
                </div>
                <div>
                    <div className="text-sm italic text-center mb-1">
                        <span className={`print:hidden ${isSnapshot ? 'hidden' : ''}`}>
                            Ngày
                            <input
                                type="text"
                                value={signDay}
                                onChange={(e) => setSignDay(e.target.value)}
                                className="w-6 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500 mx-0.5 font-bold"
                            />
                            tháng
                            <input
                                type="text"
                                value={signMonth}
                                onChange={(e) => setSignMonth(e.target.value)}
                                className="w-6 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500 mx-0.5 font-bold"
                            />
                            năm
                            <input
                                type="text"
                                value={signYear}
                                onChange={(e) => setSignYear(e.target.value)}
                                className="w-10 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500 mx-0.5 font-bold"
                            />
                        </span>
                        <span className={`hidden print:inline-block whitespace-nowrap ${isSnapshot ? 'inline-block' : ''}`}>
                            Ngày <span className="inline-block min-w-[25px] text-center">{signDay}</span> tháng <span className="inline-block min-w-[25px] text-center">{signMonth}</span> năm <span className="inline-block min-w-[35px] text-center">{signYear}</span>
                        </span>
                    </div>
                    <div className="font-semibold">
                        <input
                            type="text"
                            value={signTitle3}
                            onChange={(e) => setSignTitle3(e.target.value)}
                            className={`print:hidden ${isSnapshot ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-semibold`}
                        />
                        <span className={`hidden print:inline ${isSnapshot ? 'inline' : ''}`}>{signTitle3}</span>
                    </div>
                    <div className="text-xs text-gray-500 italic whitespace-nowrap">(Hoặc bộ phận có nhu cầu xuất)</div>
                    <div className="text-xs text-gray-500 italic">(Ký, họ tên)</div>
                    <div className="h-16"></div>
                    <div>
                        <input
                            type="text"
                            value={signPerson3}
                            onChange={(e) => setSignPerson3(e.target.value)}
                            placeholder="Nhập tên..."
                            className={`print:hidden ${isSnapshot ? 'hidden' : ''} text-center w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none font-bold`}
                        />
                        <span className={`hidden print:inline font-bold ${isSnapshot ? 'inline' : ''}`}>{signPerson3}</span>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                @page {
                size: A4;
            margin: 1mm 10mm 10mm 10mm;
                    }
            body {
                -webkit - print - color - adjust: exact;
            print-color-adjust: exact;
                    }
            .no-print {
                display: none !important;
                    }
                }
            `}</style>

            {/* Snapshot Specific Styles - Fixes height issue */}
            {/* Snapshot Specific Styles - Fixes height and width issue */}
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
            {/* Dummy QR for screenshot service cropping */}
            <img
                src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                alt="QR"
                className="block w-full h-[1px] opacity-0 pointer-events-none"
            />
        </div>
    )
}

export default function OutboundPrintPage() {
    return (
        <React.Suspense fallback={<div className="p-8 text-center">Đang tải...</div>}>
            <OutboundPrintContent />
        </React.Suspense>
    )
}
