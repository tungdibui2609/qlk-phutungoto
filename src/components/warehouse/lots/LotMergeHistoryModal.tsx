'use client'

import React from 'react'
import { X, History, Calendar, Boxes, Truck, ShieldCheck, Info, Package, Factory, MapPin, Layers, Maximize2 } from 'lucide-react'
import { TagDisplay } from '@/components/lots/TagDisplay'

interface SourceLotSnapshot {
    code: string
    inbound_date?: string
    peeling_date?: string
    packaging_date?: string
    suppliers?: { name: string }
    qc_info?: { name: string }
    batch_code?: string
    warehouse_name?: string
    metadata?: any
    positions?: { code: string }[]
    notes?: string
    merge_date?: string
}

interface LotMergeHistoryModalProps {
    data: SourceLotSnapshot | null
    onClose: () => void
}

export const LotMergeHistoryModal: React.FC<LotMergeHistoryModalProps> = ({ data, onClose }) => {
    if (!data) return null

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 flex flex-col relative">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-900/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <History size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-none">Lịch sử Gộp Lot</h3>
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono mt-1 font-bold">GỐC: {data.code}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white dark:hover:bg-slate-800 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="space-y-6">
                        {/* Top Grid: Dates & Location */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                    <Calendar size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Ngày nhập</span>
                                </div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {data.inbound_date ? new Date(data.inbound_date).toLocaleDateString('vi-VN') : '--/--/----'}
                                </p>
                            </div>
                            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                    <Factory size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Bóc múi</span>
                                </div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {data.peeling_date ? new Date(data.peeling_date).toLocaleDateString('vi-VN') : '--/--/----'}
                                </p>
                            </div>
                            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                    <Package size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Đóng bao bì</span>
                                </div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {data.packaging_date ? new Date(data.packaging_date).toLocaleDateString('vi-VN') : '--/--/----'}
                                </p>
                            </div>

                            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                    <Calendar size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Ngày gộp</span>
                                </div>
                                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                    {data.merge_date ? new Date(data.merge_date).toLocaleDateString('vi-VN') : '--/--/----'}
                                </p>
                            </div>

                            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 col-span-2">
                                <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                    <MapPin size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Vị trí cũ</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {data.positions && data.positions.length > 0 ? (
                                        data.positions.map(p => (
                                            <span key={p.code} className="text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-700">
                                                {p.code}
                                            </span>
                                        ))
                                    ) : (
                                        <p className="text-sm font-medium text-slate-400 italic">Chưa gán</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Main Info List */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                    <Truck size={20} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Nhà cung cấp</p>
                                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{data.suppliers?.name || '---'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                    <ShieldCheck size={20} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Nhân viên QC</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{data.qc_info?.name || '---'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                    <Layers size={20} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Số Batch/Lô</p>
                                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{data.batch_code || '---'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                                    <Info size={20} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Thông tin thêm</p>
                                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                        {data.metadata && (data.metadata as any).extra_info || '---'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Notes Section */}
                        {data.notes && (
                            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                                    <Info size={16} />
                                    <span className="text-xs font-bold uppercase tracking-wider">Ghi chú gốc</span>
                                </div>
                                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap italic">"{data.notes}"</p>
                            </div>
                        )}

                        {/* Image Gallery Section */}
                        {data.metadata?.images && (data.metadata.images as string[]).length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <Package size={16} />
                                    <span className="text-xs font-bold uppercase tracking-wider">Hình ảnh ({data.metadata.images.length})</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {(data.metadata.images as string[]).map((img, idx) => (
                                        <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 group relative">
                                            <img src={img} alt={`Snapshot image ${idx + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                    onClick={() => window.open(img, '_blank')}
                                                    className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/40"
                                                >
                                                    <Maximize2 size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                    >
                        Đã hiểu
                    </button>
                </div>
            </div>
        </div>
    )
}
