'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Calendar, Download, Loader2, Printer } from 'lucide-react'
import { ExportMapDiagram } from '@/components/export/ExportMapDiagram'
import { useCaptureReceipt } from '@/hooks/useCaptureReceipt'
import { formatQuantityFull } from '@/lib/numberUtils'
import { usePrintCompanyInfo, CompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { EditableText } from '@/components/print/PrintHelpers'
import { format } from 'date-fns'

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
                const { data: itemsDataRaw, error: itemsError } = await supabase
                    .from('export_task_items')
                    .select(`
                        id,
                        quantity,
                        unit,
                        status,
                        lots (code, inbound_date, notes, positions(code)),
                        positions (code),
                        products (name, sku)
                    `)
                    .eq('task_id', taskId)

                if (itemsError) throw itemsError

                // Map the data to include fallback position
                const itemsData = (itemsDataRaw || []).map((item: any) => {
                    let posCode = item.positions?.code
                    if (!posCode && item.lots?.positions && item.lots?.positions.length > 0) {
                        posCode = item.lots.positions[0].code
                    }
                    return {
                        ...item,
                        positions: posCode ? { code: posCode } : null
                    }
                })

                // Sắp xếp theo mã vị trí (A-Z) để gom nhóm các khu vực gần nhau
                itemsData.sort((a: any, b: any) => {
                    const posA = a.positions?.code || ''
                    const posB = b.positions?.code || ''
                    return posA.localeCompare(posB)
                })

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
        <div id="print-ready" className={`print:p-0 mx-auto text-black bg-stone-100 print:bg-white text-[13px] leading-relaxed font-serif py-8 print:py-0 min-h-screen flex flex-col items-center gap-8 print:block print:gap-0`}>
            <style jsx global>{`
                @media print {
                    @page {
                        margin: 10mm;
                        size: A4 portrait;
                    }
                    @page landscape-page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                    .landscape-section {
                        page: landscape-page;
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
            <div className={`pt-8 px-8 pb-8 print:p-0 w-full max-w-[210mm] print:max-w-none bg-white shadow-md print:shadow-none ${isCapturing ? 'w-[210mm]' : ''}`}>
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
                <table className="w-full border-collapse border border-black mb-4 text-xs">
                    <thead>
                        <tr>
                            <th className="border border-black p-2 w-10 text-center">STT</th>
                            <th className="border border-black p-2 w-24 text-center">Mã LOT</th>
                            <th className="border border-black p-2 w-24 text-center">Vị trí</th>
                            <th className="border border-black p-2 text-center">Sản phẩm</th>
                            <th className="border border-black p-2 w-16 text-center">Số lượng</th>
                            <th className="border border-black p-2 w-16 text-center">ĐVT</th>
                            {task.status === 'Completed' ? (
                                <>
                                    <th className="border border-black p-2 w-14 text-center">Đã hạ</th>
                                    <th className="border border-black p-2 w-14 text-center">Chưa hạ</th>
                                </>
                            ) : (
                                <th className="border border-black p-2 w-24 text-center">Ngày nhập kho</th>
                            )}
                            <th className="border border-black p-2 w-24 text-center">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={item.id} className="break-inside-avoid">
                                <td className="border border-black p-2 text-center">{idx + 1}</td>
                                <td className="border border-black p-2 text-center">{item.lots?.code}</td>
                                <td className="border border-black p-2 text-center">{item.positions?.code}</td>
                                <td className="border border-black p-2">
                                    <div className="font-bold">{item.products?.sku} - {item.products?.name}</div>
                                    {item.lots?.notes && <div className="text-[10px] font-bold mt-1 uppercase">{item.lots.notes}</div>}
                                </td>
                                <td className="border border-black p-2 text-center font-bold">{formatQuantityFull(item.quantity)}</td>
                                <td className="border border-black p-2 text-center">{item.unit}</td>
                                {task.status === 'Completed' ? (
                                    <>
                                        <td className="border border-black p-2 text-center text-lg">◻</td>
                                        <td className="border border-black p-2 text-center text-lg">◻</td>
                                    </>
                                ) : (
                                    <td className="border border-black p-2 text-center font-medium">
                                        {item.lots?.inbound_date ? format(new Date(item.lots.inbound_date), 'dd/MM/yyyy') : ''}
                                    </td>
                                )}
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td className="border border-black p-4 text-center" colSpan={task.status === 'Completed' ? 9 : 8}>Không có dữ liệu</td>
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

            {/* PAGE 2: DIAGRAM */}
            <div className={`landscape-section pt-8 px-8 pb-8 print:p-0 w-full max-w-[297mm] print:max-w-none bg-white shadow-md print:shadow-none ${isCapturing ? 'w-[297mm]' : ''}`}>
                <h2 className="font-bold text-lg mb-4 text-center uppercase border-b border-black pb-2">Sơ đồ vị trí xuất kho</h2>
                <ExportMapDiagram items={items} />
            </div>
        </div>
    )
}
