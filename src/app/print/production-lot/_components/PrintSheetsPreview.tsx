'use client'

import React from 'react'
import type { PrintConfigState } from './types'
import { PrintHeader } from '@/components/print/PrintHeader'

interface PrintSheetsPreviewProps {
    data: any
    printConfig: PrintConfigState
    sheetLabels: any[]
    companyInfo: any
}

export function PrintSheetsPreview({
    data,
    printConfig,
    sheetLabels,
    companyInfo,
}: PrintSheetsPreviewProps) {
    return (
        <>
            {/* Sheets Preview (Khổ A5 / A4 Landscape) */}
            <div id="print-sheet" className="flex flex-col gap-8 print:gap-0 print:block">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        body * { visibility: hidden !important; }
                        #print-sheet, #print-sheet * { visibility: visible !important; }
                        #print-sheet { 
                            position: absolute !important; 
                            left: 0 !important; 
                            top: 0 !important; 
                            width: 100% !important;
                            display: block !important;
                            background: white !important;
                        }
                        .sheet-page-break { 
                            page-break-after: always !important; 
                            break-after: page !important;
                            display: block !important;
                            height: 0 !important;
                        }
                        @page { margin: 0; size: ${printConfig.paper_size === 'a4' ? 'A4 landscape' : 'A5 landscape'}; }
                    }
                ` }} />

                {sheetLabels.map((label, idx) => {
                    const fullCode = `${printConfig.code_prefix || ''}${label.index}`
                    const isA5 = printConfig.paper_size !== 'a4'
                    return (
                        <div key={idx}>
                            {printConfig.sheet_template === 'template2' ? (
                                /* MẪU 2: PHIẾU ĐƠN GIẢN (KHỔNG LỒ PHỦ KÍN 100% DIỆN TÍCH) */
                                <div 
                                    className={`bg-white shadow-2xl print:shadow-none border border-zinc-200 print:border-none flex flex-col justify-between items-center text-black select-none ${
                                        isA5 
                                            ? 'w-[210mm] h-[148mm] p-[2mm] print:p-[2mm] print:w-full print:h-full' 
                                            : 'w-[297mm] h-[210mm] p-[3mm] print:p-[3mm] print:w-full print:h-full'
                                    }`}
                                    style={{ fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif" }}
                                >
                                    <div className="w-full h-full flex flex-col justify-between items-center relative overflow-visible p-1 pb-4 print:pb-4">
                                        {/* Top: Date section with Month - CLEAN SLASHES WITHOUT DOTS */}
                                        <div className={`w-full flex items-center justify-center pt-1 pb-1 mb-1 ${isA5 ? 'gap-4' : 'gap-8'}`}>
                                            <span className={isA5 ? "text-7xl font-black text-zinc-400 tracking-wider" : "text-9xl font-black text-zinc-400 tracking-wider"}>/</span>
                                            <span className={isA5 ? "text-[155pt] font-black text-black leading-none tracking-tight px-3" : "text-[210pt] font-black text-black leading-none tracking-tight px-6"} style={{ fontWeight: 900 }}>
                                                {printConfig.month_val || (new Date().getMonth() + 1)}
                                            </span>
                                            <span className={isA5 ? "text-7xl font-black text-zinc-400 tracking-wider" : "text-9xl font-black text-zinc-400 tracking-wider"}>/</span>
                                        </div>

                                        {/* Center: Giant Code (e.g. F1, F2697) - PUSHED DOWN FOR BALANCED VERTICAL FLOW */}
                                        <div className="flex-1 w-full flex items-center justify-center text-center overflow-visible mt-12 mb-2 py-1 px-1">
                                            <h1 
                                                className="font-black text-black tracking-normal leading-none uppercase select-none w-full text-center inline-block"
                                                style={{ 
                                                    fontWeight: 900,
                                                    transform: fullCode.length <= 3 
                                                        ? 'scale(1.22, 1.28)' 
                                                        : fullCode.length <= 5 
                                                            ? 'scale(1.15, 1.22)' 
                                                            : 'scale(1.05, 1.15)',
                                                    transformOrigin: 'center center',
                                                    fontSize: isA5
                                                        ? (fullCode.length <= 2 ? '180pt' : fullCode.length <= 4 ? '145pt' : fullCode.length <= 6 ? '125pt' : '95pt')
                                                        : (fullCode.length <= 2 ? '260pt' : fullCode.length <= 4 ? '210pt' : fullCode.length <= 6 ? '175pt' : '130pt')
                                                }}
                                            >
                                                {fullCode}
                                            </h1>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* MẪU 1: PHIẾU CHUẨN */
                                <div className={`bg-white shadow-2xl print:shadow-none border border-zinc-100 print:border-none flex flex-col justify-between ${
                                    isA5 
                                        ? 'w-[210mm] h-[148mm] p-[6mm] print:p-[6mm] print:w-full print:h-full' 
                                        : 'w-[297mm] h-[210mm] p-[12mm] print:p-[12mm] print:w-full print:h-full'
                                }`}>
                                    {/* Header */}
                                    <div>
                                        <PrintHeader companyInfo={companyInfo} logoSrc={logoSrc} size="compact" />
                                        <div className="mt-6 text-center mb-6">
                                            <h1 className="text-2xl font-black uppercase tracking-widest text-zinc-900 mb-1">Phiếu Thông Tin Lô Sản Phẩm</h1>
                                            <div className="w-20 h-1 bg-blue-500 mx-auto rounded-full" />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 flex flex-col justify-center">
                                        <div className="grid grid-cols-12 gap-6 items-center">
                                            {/* Col 1: Lệnh SX + Sản phẩm */}
                                            <div className="col-span-4 space-y-8">
                                                <section>
                                                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-4 border-b-2 border-zinc-100 pb-2">Lệnh sản xuất</h3>
                                                    <div className="space-y-4">
                                                        <div className="flex flex-col"><span className="text-[11px] font-bold text-zinc-400 uppercase mb-1">Mã lệnh:</span> <span className="font-black text-zinc-900 text-2xl tracking-tighter">{data.productions?.code}</span></div>
                                                        <div className="flex flex-col"><span className="text-[11px] font-bold text-zinc-400 uppercase mb-1">Tên lệnh:</span> <span className="font-black text-zinc-900 text-lg leading-tight uppercase">{data.productions?.name}</span></div>
                                                        <div className="flex flex-col"><span className="text-[11px] font-bold text-zinc-400 uppercase mb-1">Khách hàng:</span> <span className="font-black text-zinc-900 text-lg uppercase">{data.productions?.customers?.name || 'CHANH THU GROUP'}</span></div>
                                                    </div>
                                                </section>
                                                <section>
                                                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-4 border-b-2 border-zinc-100 pb-2">Sản phẩm</h3>
                                                    <div className="space-y-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-bold text-zinc-400 uppercase mb-1">Tên SP:</span> 
                                                            <span 
                                                                className="font-black text-zinc-900 leading-tight uppercase"
                                                                style={{
                                                                    fontSize: (data as any).products?.name?.length > 60 ? '16px' : 
                                                                             (data as any).products?.name?.length > 45 ? '20px' :
                                                                             (data as any).products?.name?.length > 30 ? '24px' : '30px',
                                                                }}
                                                            >
                                                                {(data as any).products?.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col"><span className="text-[11px] font-bold text-zinc-400 uppercase mb-1">SKU:</span> <span className="font-black text-zinc-900 text-xl tracking-tight leading-none-0">{data.products?.sku}</span></div>
                                                    </div>
                                                </section>
                                            </div>

                                            {/* Col 2: Lot + Chi tiết */}
                                            <div className="col-span-4 space-y-8">
                                                <section>
                                                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-4 border-b-2 border-zinc-100 pb-2">Thông tin Lot</h3>
                                                    <div className="p-5 bg-zinc-50 rounded-3xl border-2 border-zinc-100 mb-5 text-center">
                                                        <div className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-1">Mã LOT</div>
                                                        <div className="text-3xl font-black text-zinc-900 tracking-tight">{data.lot_code}</div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-end border-b border-dashed border-zinc-200 pb-1">
                                                            <span className="text-[11px] font-bold text-zinc-400 uppercase">Ngày tạo:</span> 
                                                            <span className="font-black text-zinc-900 text-lg uppercase">
                                                                {printConfig.created_date ? new Date(printConfig.created_date).toLocaleDateString('vi-VN') : (data.created_at ? new Date(data.created_at).toLocaleDateString('vi-VN') : '')}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-end border-b border-dashed border-zinc-200 pb-1">
                                                            <span className="text-[11px] font-bold text-zinc-400 uppercase">Số lượng:</span> 
                                                            <span className="font-black text-emerald-600 text-2xl">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                                                        </div>
                                                    </div>
                                                </section>
                                                <section>
                                                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-4 border-b-2 border-zinc-100 pb-2">Chi tiết đóng gói</h3>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-1">
                                                        <div className="flex flex-col"><span className="text-[10px] font-bold text-zinc-400 uppercase">Quy cách:</span> <span className="font-black text-zinc-900 text-sm leading-tight uppercase">{printConfig.specification || '---'}</span></div>
                                                        <div className="flex flex-col"><span className="text-[10px] font-bold text-zinc-400 uppercase">Khối lượng:</span> <span className="font-black text-zinc-900 text-sm uppercase">{printConfig.net_weight || '---'}</span></div>
                                                        <div className="flex flex-col"><span className="text-[10px] font-bold text-zinc-400 uppercase">Ngày SX:</span> <span className="font-black text-zinc-900 text-sm leading-none">{new Date(printConfig.production_date).toLocaleDateString('vi-VN')}</span></div>
                                                        <div className="flex flex-col"><span className="text-[10px] font-bold text-zinc-400 uppercase">Ngày ĐG:</span> <span className="font-black text-zinc-900 text-sm leading-none">{printConfig.packing_date ? new Date(printConfig.packing_date).toLocaleDateString('vi-VN') : ''}</span></div>
                                                    </div>
                                                </section>
                                            </div>

                                            {/* Col 3: STT / INDEX Box */}
                                            <div className="col-span-4 flex items-center justify-center pl-8">
                                                <div className="border-[5px] border-black rounded-[4rem] w-full py-20 px-10 flex flex-col items-center justify-center text-center">
                                                    <span className="text-base font-black uppercase tracking-[0.25em] text-black mb-5">STT / INDEX</span>
                                                    <span className="text-[7.5rem] font-black text-black leading-none tracking-tighter">{label.index}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Signature */}
                                    <div className="mt-6 grid grid-cols-3 gap-6 text-center border-t-2 border-dashed border-zinc-200 pt-4">
                                        <div className="flex flex-col flex-1">
                                            <div className="h-10 flex flex-col justify-end mb-10">
                                                <p className="text-xs font-bold text-zinc-900 uppercase tracking-wide">Người lập phiếu</p>
                                            </div>
                                            <div className="w-24 h-px bg-zinc-300 mx-auto" />
                                        </div>
                                        <div className="flex flex-col flex-1">
                                            <div className="h-10 flex flex-col justify-end mb-10">
                                                <p className="text-xs font-bold text-zinc-900 uppercase tracking-wide">Quản lý sản xuất</p>
                                            </div>
                                            <div className="w-24 h-px bg-zinc-300 mx-auto" />
                                        </div>
                                        <div className="flex flex-col flex-1">
                                            <div className="h-10 flex flex-col justify-end mb-10">
                                                <p className="text-[9px] font-medium text-zinc-400 italic mb-1">Ngày ..... tháng ..... năm 202...</p>
                                                <p className="text-xs font-bold text-zinc-900 uppercase tracking-wide">Thủ kho</p>
                                            </div>
                                            <div className="w-24 h-px bg-zinc-300 mx-auto" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="sheet-page-break" />
                        </div>
                    )
                })}
            </div>
        </>
    )
}
