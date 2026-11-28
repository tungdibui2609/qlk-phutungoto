'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
    Printer,
    ArrowLeft,
    LayoutGrid,
    Copy,
    Info,
    RotateCcw,
    Lock
} from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'

function GoodsRecordingBlock() {
    return (
        <table className="goods-block-table w-full h-full border-collapse table-fixed">
            <colgroup>
                <col style={{ width: '13%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '25.33%' }} />
                <col style={{ width: '25.33%' }} />
                <col style={{ width: '25.34%' }} />
            </colgroup>
            <tbody>
                {/* Hàng 1: TÊN HÀNG */}
                <tr style={{ height: '24%' }}>
                    <td className="goods-cell text-center font-bold whitespace-nowrap">
                        TÊN HÀNG
                    </td>
                    <td colSpan={4} className="goods-cell" />
                </tr>

                {/* Hàng 2: TẦNG | STT VỊ TRÍ | KHO : | DÃY : | Ô : */}
                <tr style={{ height: '14%' }}>
                    <td rowSpan={2} className="goods-cell text-center font-bold">
                        TẦNG
                    </td>
                    <td rowSpan={2} className="goods-cell text-center font-bold leading-tight">
                        <div>STT</div>
                        <div>VỊ TRÍ</div>
                    </td>
                    <td className="goods-cell text-left font-bold pl-1.5">
                        KHO :
                    </td>
                    <td className="goods-cell text-left font-bold pl-1.5">
                        DÃY :
                    </td>
                    <td className="goods-cell text-left font-bold pl-1.5">
                        Ô :
                    </td>
                </tr>

                {/* Hàng 3: A | B | C */}
                <tr style={{ height: '12%' }}>
                    <td className="goods-cell text-center font-bold">A</td>
                    <td className="goods-cell text-center font-bold">B</td>
                    <td className="goods-cell text-center font-bold">C</td>
                </tr>

                {/* Hàng 4: Tầng 2 */}
                <tr style={{ height: '25%' }}>
                    <td rowSpan={2} className="goods-cell" />
                    <td className="goods-cell text-center font-bold">2</td>
                    <td className="goods-cell" />
                    <td className="goods-cell" />
                    <td className="goods-cell" />
                </tr>

                {/* Hàng 5: Tầng 1 */}
                <tr style={{ height: '25%' }}>
                    <td className="goods-cell text-center font-bold">1</td>
                    <td className="goods-cell" />
                    <td className="goods-cell" />
                    <td className="goods-cell" />
                </tr>
            </tbody>
        </table>
    )
}

export default function GoodsRecordingMapPrintPage() {
    const router = useRouter()
    const { hasModule, currentSystem } = useSystem()

    const defaultYear = String(new Date().getFullYear())

    // Cấu hình in ấn
    const [dayText, setDayText] = useState('')
    const [monthText, setMonthText] = useState('')
    const [yearText, setYearText] = useState(defaultYear)
    const [duplex, setDuplex] = useState(true) // Mặc định in 2 mặt khổ A4
    const [sheetCount, setSheetCount] = useState(1) // Số tờ giấy A4
    const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape')
    const [topMarginMm, setTopMarginMm] = useState(8) // Chỉ căn lề trên (trái/phải/dưới = 0)

    const isModuleEnabled = hasModule('print_goods_recording_map')

    // Tổng số mặt (trang A4) cần xuất ra máy in
    const pages = useMemo(() => {
        const safeSheets = Math.max(1, Math.min(50, Number(sheetCount) || 1))
        const sidesPerSheet = duplex ? 2 : 1
        const total = safeSheets * sidesPerSheet
        return Array.from({ length: total }, (_, idx) => ({
            pageNumber: idx + 1,
            sheetNumber: Math.floor(idx / sidesPerSheet) + 1,
            sideLabel: duplex ? (idx % 2 === 0 ? 'Mặt 1 (Mặt trước)' : 'Mặt 2 (Mặt sau)') : '1 mặt'
        }))
    }, [sheetCount, duplex])

    const handleReset = () => {
        setDayText('')
        setMonthText('')
        setYearText(defaultYear)
        setDuplex(true)
        setSheetCount(1)
        setOrientation('landscape')
        setTopMarginMm(8)
    }

    const handlePrint = () => {
        window.print()
    }

    if (currentSystem && !isModuleEnabled) {
        return (
            <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-6 text-center space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                        <Lock size={24} />
                    </div>
                    <h1 className="text-lg font-bold text-stone-900">
                        Module chưa được bật
                    </h1>
                    <p className="text-sm text-stone-600">
                        Phân hệ <strong>{currentSystem.name}</strong> chưa kích hoạt module{' '}
                        <strong>In sơ đồ ghi hàng</strong>. Vui lòng vào{' '}
                        <em>Cài đặt → Cấu hình phân hệ → In ấn</em> để bật tính năng này.
                    </p>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors cursor-pointer"
                    >
                        <ArrowLeft size={16} />
                        Quay lại
                    </button>
                </div>
            </div>
        )
    }

    const pageWidthMm = orientation === 'landscape' ? 297 : 210
    const pageHeightMm = orientation === 'landscape' ? 210 : 297

    return (
        <div className="min-h-screen bg-stone-100 print:bg-white print:min-h-0">
            {/* Thanh công cụ cấu hình (ẩn khi in) */}
            <div className="sticky top-0 z-30 bg-white border-b border-stone-200 shadow-sm print:hidden">
                <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="p-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                            title="Quay lại"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
                                <LayoutGrid size={18} />
                            </div>
                            <div>
                                <h1 className="text-base font-bold text-stone-900 leading-tight">
                                    In sơ đồ ghi hàng
                                </h1>
                                <p className="text-xs text-stone-500">
                                    Khổ A4 • {duplex ? 'In 2 mặt' : 'In 1 mặt'} • 6 ô/mặt • Chỉ căn lề trên ({topMarginMm}mm)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Các tuỳ chọn nhanh */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Ngày / Tháng / Năm */}
                        <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs">
                            <span className="text-stone-500 font-medium">Ngày:</span>
                            <input
                                type="text"
                                value={dayText}
                                onChange={(e) => setDayText(e.target.value)}
                                placeholder="Trống"
                                className="w-11 px-1.5 py-0.5 bg-white border border-stone-200 rounded text-center text-stone-800 focus:outline-none focus:border-orange-500"
                            />
                            <span className="text-stone-500 font-medium">Tháng:</span>
                            <input
                                type="text"
                                value={monthText}
                                onChange={(e) => setMonthText(e.target.value)}
                                placeholder="Trống"
                                className="w-11 px-1.5 py-0.5 bg-white border border-stone-200 rounded text-center text-stone-800 focus:outline-none focus:border-orange-500"
                            />
                            <span className="text-stone-500 font-medium">Năm:</span>
                            <input
                                type="text"
                                value={yearText}
                                onChange={(e) => setYearText(e.target.value)}
                                placeholder="2026"
                                className="w-14 px-1.5 py-0.5 bg-white border border-stone-200 rounded text-center font-semibold text-stone-800 focus:outline-none focus:border-orange-500"
                            />
                        </div>

                        {/* Căn lề trên */}
                        <div
                            className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs"
                            title="Chỉ căn lề trên; lề trái, phải, dưới đều bằng 0mm"
                        >
                            <span className="text-stone-500 font-medium">Lề trên:</span>
                            <input
                                type="number"
                                min={0}
                                max={30}
                                value={topMarginMm}
                                onChange={(e) => setTopMarginMm(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
                                className="w-12 px-1.5 py-0.5 bg-white border border-stone-200 rounded text-center font-semibold text-stone-800 focus:outline-none focus:border-orange-500"
                            />
                            <span className="text-stone-500">mm</span>
                        </div>

                        {/* Chế độ 2 mặt / 1 mặt */}
                        <div className="flex items-center rounded-lg border border-stone-200 overflow-hidden text-xs font-medium">
                            <button
                                type="button"
                                onClick={() => setDuplex(true)}
                                className={`px-2.5 py-1.5 transition-colors cursor-pointer ${
                                    duplex
                                        ? 'bg-orange-600 text-white'
                                        : 'bg-white text-stone-600 hover:bg-stone-50'
                                }`}
                            >
                                2 mặt A4
                            </button>
                            <button
                                type="button"
                                onClick={() => setDuplex(false)}
                                className={`px-2.5 py-1.5 transition-colors cursor-pointer ${
                                    !duplex
                                        ? 'bg-orange-600 text-white'
                                        : 'bg-white text-stone-600 hover:bg-stone-50'
                                }`}
                            >
                                1 mặt A4
                            </button>
                        </div>

                        {/* Hướng giấy */}
                        <div className="flex items-center rounded-lg border border-stone-200 overflow-hidden text-xs font-medium">
                            <button
                                type="button"
                                onClick={() => setOrientation('landscape')}
                                className={`px-2.5 py-1.5 transition-colors cursor-pointer ${
                                    orientation === 'landscape'
                                        ? 'bg-stone-800 text-white'
                                        : 'bg-white text-stone-600 hover:bg-stone-50'
                                }`}
                            >
                                A4 Ngang
                            </button>
                            <button
                                type="button"
                                onClick={() => setOrientation('portrait')}
                                className={`px-2.5 py-1.5 transition-colors cursor-pointer ${
                                    orientation === 'portrait'
                                        ? 'bg-stone-800 text-white'
                                        : 'bg-white text-stone-600 hover:bg-stone-50'
                                }`}
                            >
                                A4 Dọc
                            </button>
                        </div>

                        {/* Số tờ */}
                        <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs">
                            <Copy size={13} className="text-stone-500" />
                            <span className="text-stone-500 font-medium">Số tờ:</span>
                            <input
                                type="number"
                                min={1}
                                max={50}
                                value={sheetCount}
                                onChange={(e) => setSheetCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                                className="w-12 px-1.5 py-0.5 bg-white border border-stone-200 rounded text-center font-semibold text-stone-800 focus:outline-none focus:border-orange-500"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleReset}
                            className="p-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                            title="Khôi phục mặc định"
                        >
                            <RotateCcw size={16} />
                        </button>

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
                        >
                            <Printer size={16} />
                            In ngay ({pages.length} trang)
                        </button>
                    </div>
                </div>

                {/* Gợi ý in 2 mặt */}
                {duplex && (
                    <div className="bg-amber-50/80 border-t border-amber-200/70 px-4 py-1.5">
                        <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-amber-800">
                            <Info size={14} className="shrink-0" />
                            <span>
                                Biểu mẫu đã dàn sẵn <strong>2 mặt ({pages.length} trang A4)</strong>, chỉ căn lề trên <strong>{topMarginMm}mm</strong> (trái/phải/dưới = 0mm). Khi hộp thoại in hiện ra, hãy bật <strong>In 2 mặt (Two-sided)</strong> và đặt <strong>Lề (Margins) = Không (None)</strong> để in tràn chuẩn khổ A4.
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Khu vực xem trước & in */}
            <div className="py-6 px-4 flex flex-col items-center gap-6 print:p-0 print:gap-0 print:block">
                {pages.map((page, index) => (
                    <div
                        key={page.pageNumber}
                        className="flex flex-col items-center print:block"
                    >
                        {/* Nhãn xem trước (ẩn khi in) */}
                        <div className="w-full flex items-center justify-between mb-1.5 px-1 text-xs font-medium text-stone-500 print:hidden">
                            <span>
                                Tờ {page.sheetNumber} — {page.sideLabel}
                            </span>
                            <span>
                                Trang {page.pageNumber}/{pages.length} • A4 {orientation === 'landscape' ? 'Ngang (297×210mm)' : 'Dọc (210×297mm)'}
                            </span>
                        </div>

                        {/* Trang A4 thực tế */}
                        <div
                            className={`goods-map-sheet bg-white shadow-md border border-stone-300 print:shadow-none print:border-none flex flex-col box-border ${
                                index < pages.length - 1 ? 'goods-map-page-break' : ''
                            }`}
                            style={{
                                width: `${pageWidthMm}mm`,
                                height: `${pageHeightMm}mm`,
                                paddingTop: `${topMarginMm}mm`,
                                paddingLeft: 0,
                                paddingRight: 0,
                                paddingBottom: 0
                            }}
                        >
                            {/* Tiêu đề NGÀY ... THÁNG ... NĂM ... */}
                            <div className="goods-map-header text-center font-bold text-black shrink-0 flex items-center justify-center">
                                <span>NGÀY</span>
                                <span className="inline-block min-w-[22mm] text-center px-1">
                                    {dayText}
                                </span>
                                <span>THÁNG</span>
                                <span className="inline-block min-w-[22mm] text-center px-1">
                                    {monthText}
                                </span>
                                <span>NĂM</span>
                                <span className="inline-block min-w-[16mm] text-center px-1.5">
                                    {yearText}
                                </span>
                            </div>

                            {/* Lưới 2 cột × 3 hàng = 6 khối sơ đồ */}
                            <div className="goods-map-grid flex-1 grid grid-cols-2 grid-rows-3 min-h-0">
                                {Array.from({ length: 6 }).map((_, blockIdx) => (
                                    <div key={blockIdx} className="min-h-0 min-w-0 h-full w-full">
                                        <GoodsRecordingBlock />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <style jsx global>{`
                .goods-map-sheet {
                    font-family: Arial, Helvetica, sans-serif;
                    color: #000;
                    background: #fff;
                }
                .goods-map-header {
                    font-size: ${orientation === 'landscape' ? '15px' : '14px'};
                    line-height: 1.2;
                    padding-bottom: 2.5mm;
                }
                .goods-map-grid {
                    column-gap: 2.2mm;
                    row-gap: 2.2mm;
                }
                .goods-block-table {
                    border: 2px solid #000;
                }
                .goods-cell {
                    border: 1.5px solid #000;
                    font-size: ${orientation === 'landscape' ? '12.5px' : '11px'};
                    color: #000;
                    vertical-align: middle;
                    padding: 1px 3px;
                }

                @media print {
                    @page {
                        size: A4 ${orientation} !important;
                        margin: 0 !important;
                    }
                    html,
                    body {
                        width: ${pageWidthMm}mm !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .goods-map-sheet {
                        width: ${pageWidthMm}mm !important;
                        height: ${pageHeightMm}mm !important;
                        margin: 0 !important;
                        padding-top: ${topMarginMm}mm !important;
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                        padding-bottom: 0 !important;
                        box-sizing: border-box !important;
                        overflow: hidden !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .goods-map-page-break {
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                }
            `}</style>
        </div>
    )
}
