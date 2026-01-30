'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Printer } from 'lucide-react'
import { formatQuantityFull } from '@/lib/numberUtils'
import { usePrintCompanyInfo, CompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { PrintHeader } from '@/components/print/PrintHeader'
import { EditableText } from '@/components/print/PrintHelpers'

// Types
interface InventoryItem {
    id: string
    productCode: string
    productName: string
    unit: string
    opening: number
    qtyIn: number
    qtyOut: number
    balance: number
    productGroup?: string
    isUnconvertible?: boolean
}

interface LotItem {
    id: string
    lotCode: string
    productSku: string
    productName: string
    productUnit: string
    quantity: number
    batchCode: string
    inboundDate: string | null
    positions: { code: string }[] | null
    supplierName: string
}

interface ReconciliationItem {
    productId: string
    productCode: string
    productName: string
    unit: string
    accountingBalance: number
    lotBalance: number
    diff: number
}

export default function InventoryPrintPage() {
    const searchParams = useSearchParams()
    const type = searchParams.get('type') as 'accounting' | 'lot' | 'reconciliation' || 'accounting'
    const systemType = searchParams.get('systemType') || ''
    const dateFrom = searchParams.get('from') || ''
    const dateTo = searchParams.get('to') || new Date().toISOString().split('T')[0]
    const warehouse = searchParams.get('warehouse') || ''
    const searchTerm = searchParams.get('search') || ''
    const convertToKg = searchParams.get('convertToKg') === 'true'
    const isSnapshot = searchParams.get('snapshot') === '1'
    const token = searchParams.get('token')

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
    } as CompanyInfo : null

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [accountingItems, setAccountingItems] = useState<InventoryItem[]>([])
    const [lotItems, setLotItems] = useState<LotItem[]>([])
    const [reconcileItems, setReconcileItems] = useState<ReconciliationItem[]>([])

    // Use shared hook for company info
    const { companyInfo, logoSrc } = usePrintCompanyInfo({
        token,
        initialCompanyInfo,
        fallbackToProfile: !initialCompanyInfo // Only fallback if we don't have enough info from params
    })

    // Editable States
    const [editReportTitle, setEditReportTitle] = useState('')
    const [signTitle1, setSignTitle1] = useState('Người Lập Biểu')
    const [signTitle2, setSignTitle2] = useState('Thủ Kho')
    const [signTitle3, setSignTitle3] = useState('Giám Đốc')
    const [signPerson1, setSignPerson1] = useState('')
    const [signPerson2, setSignPerson2] = useState('')
    const [signPerson3, setSignPerson3] = useState('')

    // Download loading state
    const [isDownloading, setIsDownloading] = useState(false)
    const [downloadTimer, setDownloadTimer] = useState(0)

    useEffect(() => {
        // Hydrate editable fields from params if present
        if (searchParams.get('editReportTitle')) setEditReportTitle(searchParams.get('editReportTitle')!)

        if (searchParams.get('signTitle1')) setSignTitle1(searchParams.get('signTitle1')!)
        if (searchParams.get('signTitle2')) setSignTitle2(searchParams.get('signTitle2')!)
        if (searchParams.get('signTitle3')) setSignTitle3(searchParams.get('signTitle3')!)

        if (searchParams.get('signPerson1')) setSignPerson1(searchParams.get('signPerson1')!)
        if (searchParams.get('signPerson2')) setSignPerson2(searchParams.get('signPerson2')!)
        if (searchParams.get('signPerson3')) setSignPerson3(searchParams.get('signPerson3')!)

    }, [searchParams])

    useEffect(() => {
        fetchData()

        // Set default title based on type
        if (type === 'accounting') setEditReportTitle('BÁO CÁO TỔNG HỢP NHẬP XUẤT TỒN')
        else if (type === 'lot') setEditReportTitle('BÁO CÁO TỒN KHO THEO LOT')
        else if (type === 'reconciliation') setEditReportTitle('BẢNG ĐỐI CHIẾU TỒN KHO VS KẾ TOÁN')

    }, [type, systemType, dateFrom, dateTo, warehouse, convertToKg]) // Removed redundant dependency

    async function fetchData() {
        setLoading(true)
        setError(null)
        try {
            // Check for pre-fetched data in URL (passed from print-image API)
            const preFetchedDataStr = searchParams.get('data')
            if (preFetchedDataStr) {
                try {
                    const data = JSON.parse(preFetchedDataStr)
                    if (data.ok) {
                        if (data.items) setAccountingItems(data.items)
                        if (data.lotItems) setLotItems(data.lotItems)
                        if (data.reconcileItems) setReconcileItems(data.reconcileItems)
                        setLoading(false)
                        return // Skip network fetch
                    }
                } catch (e) {
                    console.error('Failed to parse pre-fetched data', e)
                }
            }

            if (token) {
                await supabase.auth.setSession({ access_token: token, refresh_token: '' })
            }

            if (type === 'accounting') {
                const params = new URLSearchParams()
                if (systemType) params.set('systemType', systemType)
                if (dateFrom) params.set('from', dateFrom)
                if (dateTo) params.set('to', dateTo)
                if (warehouse) params.set('warehouse', warehouse)
                if (searchTerm) params.set('q', searchTerm)
                if (convertToKg) params.set('convertToKg', 'true')

                const headers: HeadersInit = {}
                if (token) headers['Authorization'] = `Bearer ${token}`

                const res = await fetch(`/api/inventory?${params.toString()}`, { headers })
                if (!res.ok) {
                    const errText = await res.text().catch(() => '')
                    throw new Error(`Fetch failed: ${res.status} ${errText}`)
                }
                const data = await res.json()
                if (data.ok) setAccountingItems(data.items)
                else throw new Error(data.error || 'Unknown error')
            }
            else if (type === 'lot') {
                // Fetch Lot Data
                let query = supabase
                    .from('lots')
                    .select(`
                        *,
                        lot_items (
                            id, quantity, product_id,
                            products (name, unit, sku, product_code:id)
                        ),
                        products!inner(name, unit, product_code:id, sku, system_type),
                        suppliers(name),
                        positions(code)
                    `)
                    .eq('status', 'active')
                    .order('created_at', { ascending: false })

                if (systemType) {
                    query = query.eq('products.system_type', systemType)
                }

                const { data, error } = await query
                if (error) throw error

                if (data) {
                    const mapped: LotItem[] = data.flatMap((lot: any) => {
                        if (lot.lot_items && lot.lot_items.length > 0) {
                            return lot.lot_items.map((item: any, idx: number) => ({
                                id: item.id || `${lot.id}-item-${idx}`,
                                lotCode: lot.code,
                                productSku: item.products?.sku || 'N/A',
                                productName: item.products?.name || 'Unknown',
                                productUnit: item.products?.unit || '-',
                                quantity: item.quantity,
                                batchCode: lot.batch_code || '-',
                                inboundDate: lot.inbound_date,
                                positions: lot.positions,
                                supplierName: lot.suppliers?.name || '-'
                            }))
                        } else if (lot.products) {
                            return [{
                                id: lot.id,
                                lotCode: lot.code,
                                productSku: lot.products.sku || 'N/A',
                                productName: lot.products.name,
                                productUnit: lot.products.unit,
                                quantity: lot.quantity,
                                batchCode: lot.batch_code || '-',
                                inboundDate: lot.inbound_date,
                                positions: lot.positions,
                                supplierName: lot.suppliers?.name || '-'
                            }]
                        }
                        return []
                    })

                    // Client-side search filtering
                    const filtered = mapped.filter(item =>
                        !searchTerm ||
                        item.lotCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.productSku.toLowerCase().includes(searchTerm.toLowerCase())
                    )

                    setLotItems(filtered)
                }
            }
            else if (type === 'reconciliation') {
                // Fetch Accounting
                const headers: HeadersInit = {}
                if (token) headers['Authorization'] = `Bearer ${token}`

                const accRes = await fetch(`/api/inventory?dateTo=${dateTo}&systemType=${systemType}`, { headers })
                if (!accRes.ok) throw new Error(`Acc Fetch failed: ${accRes.status}`)
                const accData = await accRes.json()
                const accItems: InventoryItem[] = accData.ok ? accData.items : []

                // Fetch Lots
                const { data: lots, error: lotError } = await supabase
                    .from('lots')
                    .select('product_id, quantity, products!inner(name, sku, unit, system_type)')
                    .eq('status', 'active')
                    .eq('products.system_type', systemType) // Filter by system

                if (lotError) throw lotError

                const lotMap = new Map<string, number>()
                const productDetails = new Map<string, { code: string, name: string, unit: string }>()

                lots?.forEach((lot: any) => {
                    if (!lot.product_id) return
                    const current = lotMap.get(lot.product_id) || 0
                    lotMap.set(lot.product_id, current + (lot.quantity || 0))

                    if (lot.products && !productDetails.has(lot.product_id)) {
                        productDetails.set(lot.product_id, {
                            code: lot.products.sku,
                            name: lot.products.name,
                            unit: lot.products.unit
                        })
                    }
                })

                const comparisonMap = new Map<string, ReconciliationItem>()

                accItems.forEach(acc => {
                    const lotQty = lotMap.get(acc.id) || 0 // acc.id is productId in InventoryItem interface used in api
                    comparisonMap.set(acc.id, {
                        productId: acc.id,
                        productCode: acc.productCode,
                        productName: acc.productName,
                        unit: acc.unit,
                        accountingBalance: acc.balance,
                        lotBalance: lotQty,
                        diff: acc.balance - lotQty
                    })
                    lotMap.delete(acc.id)
                })

                lotMap.forEach((qty, productId) => {
                    const details = productDetails.get(productId)
                    comparisonMap.set(productId, {
                        productId: productId,
                        productCode: details?.code || 'N/A',
                        productName: details?.name || 'Unknown',
                        unit: details?.unit || '',
                        accountingBalance: 0,
                        lotBalance: qty,
                        diff: 0 - qty
                    })
                })

                setReconcileItems(Array.from(comparisonMap.values()))
            }
        } catch (e: any) {
            console.error(e)
            setError(e.message || String(e))
        } finally {
            setLoading(false)
        }
    }

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
            // Append filters
            if (type) params.set('type', type)
            if (systemType) params.set('systemType', systemType)
            if (dateFrom) params.set('from', dateFrom)
            if (dateTo) params.set('to', dateTo)
            if (warehouse) params.set('warehouse', warehouse)
            if (searchTerm) params.set('search', searchTerm)
            if (convertToKg) params.set('convertToKg', 'true')

            // Append editable fields
            params.set('editReportTitle', editReportTitle)
            params.set('signTitle1', signTitle1)
            params.set('signTitle2', signTitle2)
            params.set('signTitle3', signTitle3)
            params.set('signPerson1', signPerson1)
            params.set('signPerson2', signPerson2)
            params.set('signPerson3', signPerson3)

            // Get current session token to pass to the snapshot service
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) {
                params.set('token', session.access_token)
            }

            const res = await fetch(`/api/inventory/print-image?${params.toString()}`)
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.details || errData.error || 'Failed to generate image')
            }

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            // Filename
            const fileName = `bao-cao-ton-${dateTo}.jpg`
            a.download = fileName
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

    if (error) return <div id="print-ready" data-ready="true" className="flex h-screen items-center justify-center text-red-600 font-bold">Lỗi tải dữ liệu: {error}</div>

    return (
        <div id="print-ready" data-ready={!loading ? "true" : undefined} className="bg-white h-fit min-h-0 w-[210mm] mx-auto text-black pt-0 px-6 pb-6 print:p-4 text-[13px]">
            {/* Toolbar */}
            <div className={`fixed top-4 right-4 print:hidden flex gap-2 ${isSnapshot ? 'hidden' : ''}`}>
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className={`flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg transition-all ${isDownloading ? 'opacity-70 cursor-wait' : ''}`}
                >
                    {isDownloading ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            Đang tạo... ({downloadTimer}s)
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
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg"
                >
                    <Printer size={20} /> In báo cáo
                </button>
            </div>

            {/* Header with Shared Component - Force compact to match original layout, can be 'large' if desired */}
            <div className="mb-6">
                <PrintHeader
                    companyInfo={companyInfo}
                    logoSrc={logoSrc}
                    size="compact"  // Using compact to fit the inventory report style
                    rightContent={null}
                />
            </div>

            {/* Report Title (Editable) */}
            <div className="text-center mb-6">
                <div className="flex justify-center">
                    <EditableText
                        value={editReportTitle}
                        onChange={setEditReportTitle}
                        className="text-2xl font-bold uppercase text-center w-full"
                        style={{ fontFamily: "'Times New Roman', Times, serif" }}
                        isSnapshot={isSnapshot}
                    />
                </div>

                {/* Date Range info */}
                {type === 'accounting' && (
                    <p className="italic mt-1">
                        Từ ngày {new Date(dateFrom || new Date()).toLocaleDateString('vi-VN')} đến ngày {new Date(dateTo).toLocaleDateString('vi-VN')}
                    </p>
                )}
                {(type === 'lot' || type === 'reconciliation') && (
                    <p className="italic mt-1">
                        Tính đến ngày {new Date(dateTo).toLocaleDateString('vi-VN')}
                    </p>
                )}
            </div>

            {/* Content Table */}
            <div className="mb-8">
                {warehouse && <p className="font-medium mb-1 text-left">Kho: {warehouse}</p>}
                {type === 'accounting' && (
                    <table className="w-full border-collapse border border-black text-sm">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-1 w-10">STT</th>
                                <th className="border border-black p-1">Tên Sản Phẩm</th>
                                <th className="border border-black p-1">Mã SP</th>
                                <th className="border border-black p-1 w-16">ĐVT</th>
                                <th className="border border-black p-1 text-right w-20">Tồn Đầu</th>
                                <th className="border border-black p-1 text-right w-20">Nhập</th>
                                <th className="border border-black p-1 text-right w-20">Xuất</th>
                                <th className="border border-black p-1 text-right w-20">Tồn Cuối</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accountingItems.map((item, idx) => (
                                <tr key={`${item.id}-${idx}`} className={item.isUnconvertible ? 'bg-orange-100 print:bg-transparent' : ''}>
                                    <td className="border border-black p-1 text-center">{idx + 1}</td>
                                    <td className="border border-black p-1">
                                        {item.productName}
                                        {item.isUnconvertible && <span className="ml-1 text-[10px] italic text-red-600 print:text-black">(*)</span>}
                                    </td>
                                    <td className="border border-black p-1">{item.productCode}</td>
                                    <td className="border border-black p-1 text-center">{item.unit}</td>
                                    <td className="border border-black p-1 text-right">{formatQuantityFull(item.opening)}</td>
                                    <td className="border border-black p-1 text-right">{formatQuantityFull(item.qtyIn)}</td>
                                    <td className="border border-black p-1 text-right">{formatQuantityFull(item.qtyOut)}</td>
                                    <td className="border border-black p-1 text-right font-bold">{formatQuantityFull(item.balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {type === 'lot' && (
                    <table className="w-full border-collapse border border-black text-sm">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-1">Mã LOT</th>
                                <th className="border border-black p-1">Mã SP</th>
                                <th className="border border-black p-1">Tên Sản Phẩm</th>
                                <th className="border border-black p-1">NCC</th>
                                <th className="border border-black p-1">Ngày Nhập</th>
                                <th className="border border-black p-1 text-right">Số Lượng</th>
                                <th className="border border-black p-1 text-center">ĐVT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lotItems.length === 0 ? (
                                <tr><td colSpan={7} className="border border-black p-4 text-center">Không có dữ liệu</td></tr>
                            ) : (
                                lotItems.map((item, idx) => (
                                    <tr key={`${item.id}-${idx}`}>
                                        <td className="border border-black p-1 font-mono">{item.lotCode}</td>
                                        <td className="border border-black p-1">{item.productSku}</td>
                                        <td className="border border-black p-1">{item.productName}</td>
                                        <td className="border border-black p-1">{item.supplierName}</td>
                                        <td className="border border-black p-1 text-center">{item.inboundDate ? new Date(item.inboundDate).toLocaleDateString('vi-VN') : '-'}</td>
                                        <td className="border border-black p-1 text-right font-bold">{formatQuantityFull(item.quantity)}</td>
                                        <td className="border border-black p-1 text-center">{item.productUnit}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}

                {type === 'reconciliation' && (
                    <table className="w-full border-collapse border border-black text-sm">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-1">Mã SP</th>
                                <th className="border border-black p-1">Tên Sản Phẩm</th>
                                <th className="border border-black p-1 text-center">ĐVT</th>
                                <th className="border border-black p-1 text-right">Tồn Kế Toán</th>
                                <th className="border border-black p-1 text-right">Tổng LOT</th>
                                <th className="border border-black p-1 text-right">Chênh Lệch</th>
                                <th className="border border-black p-1 text-center">Trạng Thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reconcileItems.length === 0 ? (
                                <tr><td colSpan={7} className="border border-black p-4 text-center">Dữ liệu khớp hoàn toàn hoặc không có dữ liệu</td></tr>
                            ) : (
                                reconcileItems.map((item) => (
                                    <tr key={item.productId} className={item.diff !== 0 ? 'bg-orange-50 print:bg-transparent' : ''}>
                                        <td className="border border-black p-1">{item.productCode}</td>
                                        <td className="border border-black p-1">{item.productName}</td>
                                        <td className="border border-black p-1 text-center">{item.unit}</td>
                                        <td className="border border-black p-1 text-right">{formatQuantityFull(item.accountingBalance)}</td>
                                        <td className="border border-black p-1 text-right">{formatQuantityFull(item.lotBalance)}</td>
                                        <td className={`border border-black p-1 text-right font-bold ${item.diff !== 0 ? 'text-red-600 print:text-black' : ''}`}>
                                            {item.diff > 0 ? '+' : ''}{formatQuantityFull(item.diff)}
                                        </td>
                                        <td className="border border-black p-1 text-center">
                                            {item.diff !== 0 ? 'Lệch' : 'Khớp'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer Signatures (Editable) */}
            <div className="flex justify-between mt-8 break-inside-avoid">
                <div className="text-center w-1/3">
                    <div className="inline-block min-w-[200px]">
                        <EditableText value={signTitle1} onChange={setSignTitle1} className="font-bold text-center w-full mb-1" isSnapshot={isSnapshot} />
                    </div>
                    <p className="italic text-xs">(Ký, họ tên)</p>
                    <div className="h-24"></div>
                    <div className="inline-block min-w-[200px]">
                        <EditableText value={signPerson1} onChange={setSignPerson1} className="font-bold text-center w-full" placeholder="Nhập tên..." isSnapshot={isSnapshot} />
                    </div>
                </div>
                <div className="text-center w-1/3">
                    <div className="inline-block min-w-[200px]">
                        <EditableText value={signTitle2} onChange={setSignTitle2} className="font-bold text-center w-full mb-1" isSnapshot={isSnapshot} />
                    </div>
                    <p className="italic text-xs">(Ký, họ tên)</p>
                    <div className="h-24"></div>
                    <div className="inline-block min-w-[200px]">
                        <EditableText value={signPerson2} onChange={setSignPerson2} className="font-bold text-center w-full" placeholder="Nhập tên..." isSnapshot={isSnapshot} />
                    </div>
                </div>
                <div className="text-center w-1/3">
                    <div className="inline-block min-w-[200px]">
                        <EditableText value={signTitle3} onChange={setSignTitle3} className="font-bold text-center w-full mb-1" isSnapshot={isSnapshot} />
                    </div>
                    <p className="italic text-xs">(Ký, họ tên, đóng dấu)</p>
                    <div className="h-24"></div>
                    <div className="inline-block min-w-[200px]">
                        <EditableText value={signPerson3} onChange={setSignPerson3} className="font-bold text-center w-full" placeholder="Nhập tên..." isSnapshot={isSnapshot} />
                    </div>
                </div>
            </div>
            {/* Snapshot Specific Styles - Fixes height and width issue */}
            {isSnapshot && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    html, body {
                        background: white !important;
                        height: fit-content !important;
                        min-height: 0 !important;
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
                        width: 794px !important;
                        height: fit-content !important;
                        padding: 20px !important;
                        margin: 0 !important;
                        max-width: none !important;
                        box-shadow: none !important;
                        border: none !important;
                        box-sizing: border-box !important;
                        background: white !important;
                    }
                    /* Ensure table fits */
                    #print-ready table {
                        width: 100% !important;
                        font-size: 11px !important;
                    }
                    #print-ready th, #print-ready td {
                        padding: 4px 2px !important;
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
