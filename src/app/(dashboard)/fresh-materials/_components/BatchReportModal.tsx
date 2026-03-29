'use client'

import { useRef } from 'react'
import { Printer, X, Download, FileText, Leaf, Calendar, User, Clock, Package, TrendingDown } from 'lucide-react'

interface BatchReportModalProps {
    isOpen: boolean
    onClose: () => void
    batch: any
}

export default function BatchReportModal({ isOpen, onClose, batch }: BatchReportModalProps) {
    const reportRef = useRef<HTMLDivElement>(null)

    const handlePrint = () => {
        window.print()
    }

    if (!isOpen) return null

    const stages = (batch.fresh_material_stages || []).sort((a: any, b: any) => a.stage_order - b.stage_order)
    
    // Calculate final summary
    const lastStage = stages.length > 0 ? stages[stages.length - 1] : null
    const finalProducts = lastStage ? (lastStage.fresh_material_stage_outputs || [])
        .filter((o: any) => o.output_type === 'PRODUCT')
        .reduce((sum: number, o: any) => sum + (o.quantity || 0), 0) : 0
    
    const initialQuantity = batch.total_initial_quantity || 0
    const totalLoss = initialQuantity > 0 ? initialQuantity - finalProducts : 0
    const totalLossRate = initialQuantity > 0 ? (totalLoss / initialQuantity) * 100 : 0

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300 print:p-0 print:bg-white">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-5xl h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 print:h-auto print:shadow-none print:rounded-none">
                
                {/* Header Actions (Hidden when printing) */}
                <div className="px-8 py-5 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-stone-50/50 dark:bg-zinc-800/50 print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-stone-800 dark:text-white uppercase tracking-tight">Xem trước báo cáo in</h3>
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Định dạng chuẩn A4 • Sẵn sàng xuất bản</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 transition-all active:scale-95"
                        >
                            <Printer size={16} /> Xác nhận in
                        </button>
                        <button onClick={onClose} className="p-2.5 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-stone-400">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Printable Content Section */}
                <div 
                    ref={reportRef}
                    className="flex-1 overflow-y-auto p-12 bg-white text-stone-900 font-sans print:p-0 print:overflow-visible"
                >
                    {/* BÁO CÁO HEADER */}
                    <div className="flex justify-between items-start mb-12">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Leaf className="text-emerald-600" size={24} />
                                <h1 className="text-2xl font-black uppercase tracking-tighter text-emerald-700">Chánh Thu Food</h1>
                            </div>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Hệ thống quản lý chế biến vạn năng</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-3xl font-black text-stone-800 mb-1">BÁO CÁO TIẾN ĐỘ</h2>
                            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Mã báo cáo: FM-{batch.batch_code}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-12 mb-12 border-y border-stone-100 py-8">
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 bg-stone-50 p-2 rounded-lg inline-block">Thông tin lô hàng</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between border-b border-stone-50 pb-2">
                                    <span className="text-xs text-stone-500 font-bold uppercase">Mã lô NLT:</span>
                                    <span className="text-xs font-black text-stone-800">{batch.batch_code}</span>
                                </div>
                                <div className="flex justify-between border-b border-stone-50 pb-2">
                                    <span className="text-xs text-stone-500 font-bold uppercase">Tên nguyên liệu:</span>
                                    <span className="text-xs font-black text-emerald-600 uppercase">{batch.products?.name} ({batch.products?.sku})</span>
                                </div>
                                <div className="flex justify-between border-b border-stone-50 pb-2">
                                    <span className="text-xs text-stone-500 font-bold uppercase">Nhà cung cấp:</span>
                                    <span className="text-xs font-black text-stone-800">{batch.suppliers?.name}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 bg-stone-50 p-2 rounded-lg inline-block">Thông số nhập</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between border-b border-stone-50 pb-2">
                                    <span className="text-xs text-stone-500 font-bold uppercase text-blue-600 flex items-center gap-1"><Calendar size={12} /> Ngày nhận:</span>
                                    <span className="text-xs font-black text-stone-800">{new Date(batch.received_date).toLocaleDateString('vi-VN')}</span>
                                </div>
                                <div className="flex justify-between border-b border-stone-50 pb-2">
                                    <span className="text-xs text-stone-500 font-bold uppercase text-emerald-600 flex items-center gap-1"><Package size={12} /> Tổng nhập xe:</span>
                                    <span className="text-lg font-black text-emerald-600">{initialQuantity.toLocaleString('vi-VN')} {batch.initial_unit}</span>
                                </div>
                                <div className="flex justify-between border-b border-stone-50 pb-2">
                                    <span className="text-xs text-stone-500 font-bold uppercase text-stone-400 flex items-center gap-1"><Clock size={12} /> Lần bốc xe:</span>
                                    <span className="text-xs font-black text-stone-800">{batch.fresh_material_receivings?.length} lần</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CHI TIẾT GIAI ĐOẠN */}
                    <div className="space-y-10">
                        <h4 className="text-sm font-black uppercase tracking-widest text-stone-800 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black">?</div>
                            Chi tiết quá trình xử lý
                        </h4>

                        {stages.map((stage: any, idx: number) => {
                            const outputs = stage.fresh_material_stage_outputs || []
                            const products = outputs.filter((o: any) => o.output_type === 'PRODUCT')
                            const waste = outputs.filter((o: any) => o.output_type === 'WASTE')
                            
                            const outTotal = outputs.reduce((sum: number, o: any) => sum + (o.quantity || 0), 0)
                            const lossKg = stage.input_quantity - outTotal
                            const lossPercent = stage.input_quantity > 0 ? (lossKg / stage.input_quantity) * 100 : 0

                            return (
                                <div key={stage.id} className="relative pl-8 border-l-2 border-stone-100">
                                    {/* Timeline dot */}
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-600 border-4 border-white ring-2 ring-emerald-50" />
                                    
                                    <div className="mb-4 flex items-center justify-between">
                                        <h5 className="text-xs font-black text-stone-800 uppercase tracking-widest pl-2">
                                            Giai đoạn {idx + 1}: <span className="text-emerald-600">{stage.stage_name}</span>
                                        </h5>
                                        <div className="text-[10px] uppercase font-bold text-stone-400">
                                            Trạng thái: <span className="text-stone-800">{stage.status}</span>
                                        </div>
                                    </div>

                                    {/* Stats grid */}
                                    <div className="grid grid-cols-3 gap-6 mb-6">
                                        <div className="p-4 bg-stone-50 rounded-2xl">
                                            <p className="text-[10px] font-black uppercase text-stone-400 mb-1 tracking-widest">Sản lượng vào</p>
                                            <p className="text-sm font-black text-stone-800">{stage.input_quantity.toLocaleString('vi-VN')} {stage.input_unit}</p>
                                        </div>
                                        <div className="p-4 bg-emerald-50 rounded-2xl">
                                            <p className="text-[10px] font-black uppercase text-emerald-400 mb-1 tracking-widest">Sản phẩm thu hồi</p>
                                            <p className="text-sm font-black text-emerald-700">
                                                {products.reduce((sum: number, p: any) => sum + p.quantity, 0).toLocaleString('vi-VN')} {stage.input_unit}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-red-50 rounded-2xl">
                                            <p className="text-[10px] font-black uppercase text-red-400 mb-1 tracking-widest">Hao hụt bước này</p>
                                            <p className="text-sm font-black text-red-600">
                                                {lossKg.toLocaleString('vi-VN')} {stage.input_unit} ({lossPercent.toFixed(1)}%)
                                            </p>
                                        </div>
                                    </div>

                                    {/* Items Table */}
                                    {outputs.length > 0 && (
                                        <div className="rounded-2xl overflow-hidden border border-stone-100 ml-2">
                                            <table className="w-full text-[10px]">
                                                <thead className="bg-stone-50 border-b border-stone-100">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left font-black text-stone-400 uppercase tracking-widest">Phân loại</th>
                                                        <th className="px-4 py-2 text-left font-black text-stone-400 uppercase tracking-widest">Hạng/Mẫu</th>
                                                        <th className="px-4 py-2 text-right font-black text-stone-400 uppercase tracking-widest">Khối lượng</th>
                                                        <th className="px-4 py-2 text-left font-black text-stone-400 uppercase tracking-widest">Ghi chú</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-50">
                                                    {outputs.map((o: any) => (
                                                        <tr key={o.id}>
                                                            <td className="px-4 py-2.5 font-bold text-stone-700">
                                                                {o.output_type === 'PRODUCT' ? 'Sản phẩm ' + (o.products?.name || '') : o.output_type === 'WASTE' ? 'Phế / Hao hụt' : 'Mẫu thử'}
                                                            </td>
                                                            <td className="px-4 py-2.5 font-bold text-stone-500 uppercase">{o.grade || '---'}</td>
                                                            <td className="px-4 py-2.5 text-right font-black text-stone-800">{o.quantity.toLocaleString('vi-VN')} {o.unit}</td>
                                                            <td className="px-4 py-2.5 text-stone-400 italic italic">{o.notes || ''}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* TỔNG KẾT BÁO CÁO */}
                    <div className="mt-16 p-8 bg-emerald-600 rounded-[32px] text-white flex items-center justify-between shadow-2xl print:bg-emerald-700">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                                <TrendingDown size={32} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black mb-1">TỔNG KẾT</h3>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Kết quả cuối cùng thu hồi được sau tất cả giai đoạn</p>
                            </div>
                        </div>
                        <div className="text-right flex items-center gap-12">
                            <div>
                                <p className="text-[10px] font-black uppercase opacity-70 mb-1 tracking-widest text-emerald-100">Khối lượng thu hồi</p>
                                <p className="text-3xl font-black">{finalProducts.toLocaleString('vi-VN')} {batch.initial_unit}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase opacity-70 mb-1 tracking-widest text-emerald-100">Tổng hụt nguyên liệu</p>
                                <p className="text-3xl font-black">{totalLoss.toLocaleString('vi-VN')} {batch.initial_unit} ({totalLossRate.toFixed(1)}%)</p>
                            </div>
                        </div>
                    </div>

                    {/* SIGNATURE SECTION */}
                    <div className="mt-20 grid grid-cols-3 gap-8 text-center">
                        <div>
                            <p className="text-xs font-black uppercase text-stone-400 mb-20 tracking-widest">Người lập biểu</p>
                            <div className="w-32 h-px bg-stone-200 mx-auto mb-2" />
                            <p className="text-sm font-black text-stone-800 font-serif">Ký tên</p>
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase text-stone-400 mb-20 tracking-widest">Phụ trách kho</p>
                            <div className="w-32 h-px bg-stone-200 mx-auto mb-2" />
                            <p className="text-sm font-black text-stone-800 font-serif">Ký tên</p>
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase text-stone-400 mb-20 tracking-widest">Ban giám đốc</p>
                            <div className="w-32 h-px bg-stone-200 mx-auto mb-2" />
                            <p className="text-sm font-black text-stone-800 font-serif">Ký tên</p>
                        </div>
                    </div>

                    <div className="mt-20 pt-8 border-t border-stone-100 text-center text-[8px] font-black text-stone-300 uppercase tracking-[0.2em]">
                        Chánh Thu Food • Hệ thống báo cáo vạn năng • Modular WMS Platform
                    </div>
                </div>
            </div>
        </div>
    )
}
