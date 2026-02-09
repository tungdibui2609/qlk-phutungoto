'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Printer, Download } from 'lucide-react'
import { useCaptureReceipt } from '@/hooks/useCaptureReceipt'
import { formatQuantityFull } from '@/lib/numberUtils'
import { usePrintCompanyInfo, CompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { PrintHeader } from '@/components/print/PrintHeader'
import { EditableText } from '@/components/print/PrintHelpers'

// Types
interface AuditItem {
    id: string
    product_sku: string
    product_name: string
    unit: string
    system_quantity: number
    actual_quantity: number | null
    difference: number
    note: string
}

interface AuditSession {
    id: string
    code: string
    warehouse_name: string | null
    created_at: string
    participants: any[]
    note: string | null
    scope: string
}

export default function AuditPrintPage() {
    const searchParams = useSearchParams()
    const id = searchParams.get('id')
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
    const [session, setSession] = useState<AuditSession | null>(null)
    const [items, setItems] = useState<AuditItem[]>([])

    // Use shared hook for company info
    const { companyInfo, logoSrc } = usePrintCompanyInfo({
        token,
        initialCompanyInfo,
        fallbackToProfile: !initialCompanyInfo
    })

    // Editable States
    const [editReportTitle, setEditReportTitle] = useState('PHIẾU KIỂM KÊ KHO')
    const [signTitle1, setSignTitle1] = useState('Người Lập Biểu')
    const [signTitle2, setSignTitle2] = useState('Tổ Kiểm Kê')
    const [signTitle3, setSignTitle3] = useState('Thủ Kho/Giám Đốc')
    const [signPerson1, setSignPerson1] = useState('')
    const [signPerson2, setSignPerson2] = useState('')
    const [signPerson3, setSignPerson3] = useState('')

    // Capture and snapshot state
    const { isCapturing, downloadTimer, handleCapture } = useCaptureReceipt({
        fileNamePrefix: `phieu-kiem-ke-${session?.code || 'audit'}`
    })
    const isSnapshot = searchParams.get('snapshot') === '1'
    const isSnapshotMode = isSnapshot || isCapturing

    useEffect(() => {
        if (id) {
            fetchData(id)
        }
    }, [id])

    async function fetchData(auditId: string) {
        setLoading(true)
        setError(null)
        try {
            if (token) {
                await supabase.auth.setSession({ access_token: token, refresh_token: '' })
            }

            // Fetch Audit Header
            const { data: check, error: checkError } = await supabase
                .from('inventory_checks')
                .select('*')
                .eq('id', auditId)
                .single()

            if (checkError) throw checkError
            setSession(check as any)

            // Fetch Audit Items
            const { data: checkItems, error: itemsError } = await supabase
                .from('inventory_check_items')
                .select('*')
                .eq('check_id', auditId)
                .order('created_at', { ascending: true })

            if (itemsError) throw itemsError
            setItems(checkItems as any[])

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

    const handleDownload = () => handleCapture(false, `phieu-kiem-ke-${session?.code}.jpg`)

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin mr-2" /> Đang tải dữ liệu...</div>

    if (error) return <div id="print-ready" data-ready="true" className="flex h-screen items-center justify-center text-red-600 font-bold">Lỗi tải dữ liệu: {error}</div>

    if (!session) return <div className="flex h-screen items-center justify-center">Không tìm thấy dữ liệu kiểm kê</div>

    return (
        <div id="print-ready" data-ready={!loading ? "true" : undefined} className={`bg-white h-fit min-h-0 mx-auto text-black pt-0 px-6 pb-6 print:p-4 text-[13px] ${isCapturing ? 'shadow-none !w-[1150px]' : 'w-[210mm]'}`}>
            {isCapturing && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    #print-ready {
                        width: 1150px !important;
                        margin: 0 !important;
                        padding: 40px 60px !important;
                        display: flex !important;
                        flex-direction: column !important;
                        box-sizing: border-box !important;
                    }
                `}} />
            )}
            {/* Toolbar */}
            <div className={`fixed top-4 right-4 print:hidden flex gap-2 ${isSnapshotMode ? 'hidden' : ''}`}>
                <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg"
                >
                    <Download size={20} /> Tải ảnh
                </button>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg"
                >
                    <Printer size={20} /> In phiếu
                </button>
            </div>

            {/* Header */}
            <div className="mb-6">
                <PrintHeader
                    companyInfo={companyInfo}
                    logoSrc={logoSrc}
                    size="compact"
                    rightContent={
                        <div className="text-right">
                            <p className="font-bold text-lg">{session.code}</p>
                            <p className="text-xs italic">Ngày: {new Date(session.created_at).toLocaleDateString('vi-VN')}</p>
                        </div>
                    }
                />
            </div>

            {/* Title */}
            <div className="text-center mb-6">
                <EditableText
                    value={editReportTitle}
                    onChange={setEditReportTitle}
                    className="text-2xl font-bold uppercase text-center w-full"
                    style={{ fontFamily: "'Times New Roman', Times, serif" }}
                    isSnapshot={isSnapshotMode}
                />
                <p className="mt-1 font-medium">Kho: {session.warehouse_name || 'Toàn bộ kho'}</p>
                {session.note && <p className="italic text-xs mt-1">Ghi chú: {session.note}</p>}
            </div>

            {/* Participants */}
            <div className="mb-4 text-sm">
                <p className="font-bold mb-1">Tổ kiểm kê:</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {(session.participants as any[])?.length > 0 ? (
                        (session.participants as any[]).map((p, i) => (
                            <span key={i}>- {p.name} ({p.role})</span>
                        ))
                    ) : (
                        <span className="italic text-slate-500">Chưa xác định</span>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="mb-8">
                <table className="w-full border-collapse border border-black text-sm">
                    <thead>
                        <tr className="bg-gray-100 uppercase text-[12px]">
                            <th className="border border-black p-1 w-10">STT</th>
                            <th className="border border-black p-1">Mã Sản Phẩm</th>
                            <th className="border border-black p-1">Tên Sản Phẩm</th>
                            <th className="border border-black p-1 w-16">ĐVT</th>
                            <th className="border border-black p-1 text-right w-24">Số Hệ Thống</th>
                            <th className="border border-black p-1 text-right w-24">Số Thực Tế</th>
                            <th className="border border-black p-1 text-right w-24">Chênh Lệch</th>
                            <th className="border border-black p-1">Ghi Chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={item.id}>
                                <td className="border border-black p-1 text-center">{idx + 1}</td>
                                <td className="border border-black p-1 font-mono">{item.product_sku}</td>
                                <td className="border border-black p-1">{item.product_name}</td>
                                <td className="border border-black p-1 text-center">{item.unit}</td>
                                <td className="border border-black p-1 text-right">{formatQuantityFull(item.system_quantity)}</td>
                                <td className="border border-black p-1 text-right font-bold">
                                    {item.actual_quantity !== null ? formatQuantityFull(item.actual_quantity) : '-'}
                                </td>
                                <td className={`border border-black p-1 text-right font-bold ${item.difference !== 0 ? 'text-red-600 print:text-black' : ''}`}>
                                    {item.difference > 0 ? '+' : ''}{formatQuantityFull(item.difference)}
                                </td>
                                <td className="border border-black p-1 text-xs">{item.note}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer Signatures */}
            <div className="flex justify-between mt-12 break-inside-avoid">
                <div className="text-center w-1/3">
                    <EditableText value={signTitle1} onChange={setSignTitle1} className="font-bold text-center w-full mb-1" isSnapshot={isSnapshotMode} />
                    <p className="italic text-xs">(Ký, ghi rõ họ tên)</p>
                    <div className="h-24"></div>
                    <EditableText value={signPerson1} onChange={setSignPerson1} className="font-bold text-center w-full" placeholder="Họ tên..." isSnapshot={isSnapshotMode} />
                </div>
                <div className="text-center w-1/3">
                    <EditableText value={signTitle2} onChange={setSignTitle2} className="font-bold text-center w-full mb-1" isSnapshot={isSnapshotMode} />
                    <p className="italic text-xs">(Ký, ghi rõ họ tên)</p>
                    <div className="h-24"></div>
                    <EditableText value={signPerson2} onChange={setSignPerson2} className="font-bold text-center w-full" placeholder="Họ tên..." isSnapshot={isSnapshotMode} />
                </div>
                <div className="text-center w-1/3">
                    <EditableText value={signTitle3} onChange={setSignTitle3} className="font-bold text-center w-full mb-1" isSnapshot={isSnapshotMode} />
                    <p className="italic text-xs">(Ký, ghi rõ họ tên)</p>
                    <div className="h-24"></div>
                    <EditableText value={signPerson3} onChange={setSignPerson3} className="font-bold text-center w-full" placeholder="Họ tên..." isSnapshot={isSnapshotMode} />
                </div>
            </div>

            {/* Snapshot Styles */}
            {isSnapshot && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    html, body {
                        background: white !important;
                        height: fit-content !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                    }
                    #print-ready {
                        width: 794px !important;
                        height: fit-content !important;
                        padding: 20px !important;
                        margin: 0 !important;
                        box-sizing: border-box !important;
                    }
                    #print-ready table { font-size: 11px !important; }
                `}} />
            )}
        </div>
    )
}
