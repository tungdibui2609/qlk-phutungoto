'use client'

import React from 'react'
import { CheckCircle2, Sparkles, Factory, Box } from 'lucide-react'
import type { StampFormat } from './constants'

interface StampLiveSimulatorProps {
    formats: StampFormat[]
    activeFormatId: string
    activeFormat: StampFormat | undefined
    handleSelectFormatForSimulator: (fmtId: string) => void
    simLine1: string
    setSimLine1: React.Dispatch<React.SetStateAction<string>>
    simLine2: string
    setSimLine2: React.Dispatch<React.SetStateAction<string>>
    showTechnicalL1: boolean
    setShowTechnicalL1: React.Dispatch<React.SetStateAction<boolean>>
    decodedSimulation: any
}

export function StampLiveSimulator({
    formats,
    activeFormatId,
    activeFormat,
    handleSelectFormatForSimulator,
    simLine1,
    setSimLine1,
    simLine2,
    setSimLine2,
    showTechnicalL1,
    setShowTechnicalL1,
    decodedSimulation,
}: StampLiveSimulatorProps) {
    return (
        <>
            {/* 2. Live Simulator (Bộ Thử Nghiệm Giải Mã Động Dấu Đóng) */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white border border-indigo-900/50 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/40 pb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles size={18} className="text-amber-400" />
                            <h3 className="font-bold text-sm sm:text-base text-white">
                                Bộ Kiểm Tra & Thử Nghiệm Giải Mã Dấu Đóng (Live Engine)
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-indigo-200 font-semibold">Khuôn mẫu áp dụng:</label>
                            <select
                                value={activeFormatId}
                                onChange={(e) => handleSelectFormatForSimulator(e.target.value)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-indigo-700 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-purple-400"
                            >
                                {formats.map(fmt => (
                                    <option key={fmt.id} value={fmt.id}>
                                        {fmt.name} {fmt.is_default ? '★ (Mặc định)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Input Dòng 1 */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-indigo-200 flex items-center justify-between">
                                <span>{activeFormat?.line1_config?.title || 'Dòng 1: Phân cấp & Quy cách'} ({activeFormat?.line1_config?.total_length || 14} ký tự)</span>
                                {activeFormat?.line1_config?.sample && (
                                    <button 
                                        type="button"
                                        onClick={() => setSimLine1(activeFormat.line1_config.sample || '')}
                                        className="font-mono text-[10px] text-indigo-400 hover:text-amber-300 underline cursor-pointer"
                                    >
                                        Mẫu: {activeFormat.line1_config.sample}
                                    </button>
                                )}
                            </label>
                            <input
                                type="text"
                                value={simLine1}
                                onChange={(e) => setSimLine1(e.target.value)}
                                placeholder="Nhập dãy ký tự dòng 1..."
                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-indigo-700/60 font-mono font-black text-sm tracking-wider text-amber-300 focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-inner"
                            />
                            {/* Dãy số phân đoạn màu Dòng 1 */}
                            {decodedSimulation.special12Match ? (
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-emerald-300 flex items-center justify-between">
                                        <span>Phân đoạn nhận diện theo quy ước:</span>
                                        <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                                            ⭐ ƯU TIÊN NGOẠI LỆ 12 SỐ
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-950/80 rounded-xl border border-emerald-900/60 shadow-inner">
                                        <div className="flex flex-col items-center">
                                            <span className="px-3 py-1 rounded-lg font-mono font-black text-xs border border-emerald-500/70 bg-emerald-950/90 text-emerald-300 shadow-sm">
                                                {decodedSimulation.special12Match.code}
                                            </span>
                                            <span className="text-[9px] font-bold text-emerald-400 mt-0.5 whitespace-nowrap">
                                                12 số ngoại lệ trọn gói
                                            </span>
                                        </div>
                                        {simLine1.replace(/[^0-9]/g, '').length > 12 && (
                                            <div className="flex flex-col items-center">
                                                <span className="px-2 py-1 rounded-lg font-mono font-bold text-xs border border-slate-700 bg-slate-800 text-slate-400">
                                                    {simLine1.replace(/[^0-9]/g, '').substring(12)}
                                                </span>
                                                <span className="text-[9px] font-medium text-slate-500 mt-0.5 whitespace-nowrap">
                                                    Đuôi phụ
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : decodedSimulation.l1Segments.length > 0 ? (
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                                        <span>Phân đoạn mã tương ứng theo khuôn:</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-950/70 rounded-xl border border-indigo-900/60 shadow-inner">
                                        {decodedSimulation.l1Segments.map((seg: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-1">
                                                {seg.prefix && <span className="font-mono text-slate-500 font-bold px-0.5">{seg.prefix}</span>}
                                                <div className="flex flex-col items-center">
                                                    <span className={`px-2 py-0.5 rounded-lg font-mono font-black text-xs border shadow-sm ${seg.bgClass}`}>
                                                        {seg.code}
                                                    </span>
                                                    <span className="text-[9px] font-medium text-slate-400 mt-0.5 whitespace-nowrap">{seg.shortLabel}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Input Dòng 2 */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-indigo-200 flex items-center justify-between">
                                <span>{activeFormat?.line2_config?.title || 'Dòng 2: Truy xuất & Nguồn gốc'} ({activeFormat?.line2_config?.total_length || 16} chữ số)</span>
                                {activeFormat?.line2_config?.sample && (
                                    <button 
                                        type="button"
                                        onClick={() => setSimLine2(activeFormat.line2_config.sample || '')}
                                        className="font-mono text-[10px] text-indigo-400 hover:text-emerald-300 underline cursor-pointer"
                                    >
                                        Mẫu: {activeFormat.line2_config.sample}
                                    </button>
                                )}
                            </label>
                            <input
                                type="text"
                                value={simLine2}
                                onChange={(e) => setSimLine2(e.target.value)}
                                placeholder="Nhập dãy ký tự dòng 2..."
                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-indigo-700/60 font-mono font-black text-sm tracking-wider text-emerald-300 focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-inner"
                            />
                            {/* Dãy số phân đoạn màu Dòng 2 */}
                            {decodedSimulation.l2Segments.length > 0 && (
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                                        <span>Phân đoạn mã tương ứng theo khuôn:</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-950/70 rounded-xl border border-indigo-900/60 shadow-inner">
                                        {decodedSimulation.l2Segments.map((seg: any, idx: number) => (
                                            <div key={idx} className="flex flex-col items-center">
                                                <span className={`px-2 py-0.5 rounded-lg font-mono font-black text-xs border shadow-sm ${seg.bgClass}`}>
                                                    {seg.code}
                                                </span>
                                                <span className="text-[9px] font-medium text-slate-400 mt-0.5 whitespace-nowrap">{seg.shortLabel}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Result Output với Nhãn mã & Màu sắc đồng bộ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {/* Kết quả Dòng 1 */}
                        <div className="p-4 rounded-2xl bg-slate-800/70 border border-indigo-800/50 space-y-3 text-xs shadow-md">
                            <div className="font-bold text-amber-400 flex items-center justify-between text-[11px] uppercase tracking-wider border-b border-slate-700/60 pb-2">
                                <span className="flex items-center gap-1.5">
                                    <Box size={14} /> KẾT QUẢ GIẢI MÃ DÒNG 1:
                                </span>
                                {decodedSimulation.special12Match ? (
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
                                        ⭐ Áp dụng quy cách ngoại lệ
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-normal text-slate-400 lowercase">màu tương ứng với đoạn mã</span>
                                )}
                            </div>

                            {/* Trường hợp phát hiện ngoại lệ 12 số */}
                            {decodedSimulation.special12Match ? (
                                <div className="space-y-3">
                                    <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/90 to-slate-900 border border-emerald-500/60 text-emerald-100 shadow-md space-y-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-mono text-[10px] font-black">
                                                    12 SỐ ĐẦU
                                                </span>
                                                <span className="text-xs font-black text-emerald-400">
                                                    ⭐ QUY CÁCH NGOẠI LỆ ƯU TIÊN SỐ 1
                                                </span>
                                            </div>
                                            <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-700/60">
                                                {decodedSimulation.special12Match.code}
                                            </span>
                                        </div>

                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                                Tên sản phẩm &amp; Quy cách trọn gói:
                                            </p>
                                            <h4 className="text-sm sm:text-base font-black text-white mt-0.5 leading-snug">
                                                {decodedSimulation.special12Match.name}
                                            </h4>
                                        </div>

                                        <p className="text-[11px] text-emerald-300/90 leading-relaxed bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-800/60 flex items-start gap-2">
                                            <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                                            <span>
                                                Dòng 1 khớp 12 ký tự ngoại lệ. Hệ thống ưu tiên giải mã trọn gói thông số sản phẩm từ bảng quy ước này và <strong>bỏ qua các trường cắt nhỏ của khuôn 14 số chuẩn</strong> để tránh hiển thị sai lệch thông số (như lỗi chưa cấu hình đóng gói).
                                            </span>
                                        </p>
                                    </div>

                                    {/* Nút bấm chuyển đổi xem phân tích kỹ thuật theo khuôn 14 số nếu muốn debug */}
                                    <div className="pt-1 border-t border-slate-700/50">
                                        <button
                                            type="button"
                                            onClick={() => setShowTechnicalL1(!showTechnicalL1)}
                                            className="text-[11px] font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            <span>{showTechnicalL1 ? '▲ Thu gọn phân tích khuôn 14 số' : '▼ Xem phân tích thử nghiệm theo khuôn 14 số chuẩn (Chỉ tham khảo)'}</span>
                                        </button>

                                        {showTechnicalL1 && (
                                            <div className="space-y-1.5 mt-2.5 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                                                <div className="text-[10px] font-bold text-amber-400/90 mb-1 flex items-center gap-1">
                                                    <span>⚠️ Phân đoạn thô theo khuôn 14 số (Không áp dụng chính thức cho tem ngoại lệ này):</span>
                                                </div>
                                                {decodedSimulation.l1Segments.map((seg: any, idx: number) => (
                                                    <div 
                                                        key={idx}
                                                        className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80 opacity-60 hover:opacity-100 transition-opacity"
                                                    >
                                                        <span className={`px-2 py-0.5 rounded font-mono font-black text-[11px] border shrink-0 ${seg.badgeClass}`}>
                                                            {seg.code}
                                                        </span>
                                                        <span className="text-slate-400 text-xs shrink-0 font-medium">{seg.label}:</span>
                                                        <strong className={`text-xs font-bold truncate ${seg.textClass}`}>
                                                            {seg.value}
                                                        </strong>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : decodedSimulation.l1Segments.length > 0 ? (
                                <div className="space-y-1.5">
                                    {decodedSimulation.l1Segments.map((seg: any, idx: number) => (
                                        <div 
                                            key={idx}
                                            className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors"
                                        >
                                            <span className={`px-2.5 py-0.5 rounded-lg font-mono font-black text-xs border shrink-0 ${seg.badgeClass}`}>
                                                {seg.code}
                                            </span>
                                            <span className="text-slate-400 text-xs shrink-0 font-medium">{seg.label}:</span>
                                            <strong className={`text-xs font-bold truncate ${seg.textClass}`}>
                                                {seg.value}
                                            </strong>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-400 italic">Chưa có trường nào được cấu hình cho dòng 1.</p>
                            )}
                        </div>

                        {/* Kết quả Dòng 2 */}
                        <div className="p-4 rounded-2xl bg-slate-800/70 border border-indigo-800/50 space-y-2.5 text-xs shadow-md">
                            <div className="font-bold text-emerald-400 flex items-center justify-between text-[11px] uppercase tracking-wider border-b border-slate-700/60 pb-2">
                                <span className="flex items-center gap-1.5">
                                    <Factory size={14} /> KẾT QUẢ GIẢI MÃ DÒNG 2:
                                </span>
                                <span className="text-[10px] font-normal text-slate-400 lowercase">màu tương ứng với đoạn mã</span>
                            </div>
                            {decodedSimulation.l2Segments.length > 0 ? (
                                <div className="space-y-1.5">
                                    {decodedSimulation.l2Segments.map((seg: any, idx: number) => (
                                        <div 
                                            key={idx}
                                            className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors"
                                        >
                                            <span className={`px-2.5 py-0.5 rounded-lg font-mono font-black text-xs border shrink-0 ${seg.badgeClass}`}>
                                                {seg.code}
                                            </span>
                                            <span className="text-slate-400 text-xs shrink-0 font-medium">{seg.label}:</span>
                                            <strong className={`text-xs font-bold truncate ${seg.textClass}`}>
                                                {seg.value}
                                            </strong>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-400 italic">Chưa có trường nào được cấu hình cho dòng 2.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </>
    )
}
