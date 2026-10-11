'use client';

import React from 'react';
import { X, Package, Calendar, Tag, ArrowUpRight, ShieldCheck, Layers, Hash } from 'lucide-react';
import { LayoutShape } from './types';

interface MultiLotItem {
    position: any;
    lot: any;
    lotId: string;
    lotCode: string;
    productName: string;
    sku: string;
    quantity: number;
    unit: string;
    inboundDate?: string;
    batchCode?: string;
    customerName?: string;
}

interface MultiLotZoneModalProps {
    isOpen: boolean;
    onClose: () => void;
    shape: LayoutShape | null;
    lots: MultiLotItem[];
    onSelectLot?: (lotItem: MultiLotItem) => void;
}

export default function MultiLotZoneModal({
    isOpen,
    onClose,
    shape,
    lots,
    onSelectLot
}: MultiLotZoneModalProps) {
    if (!isOpen || !shape) return null;

    const totalQuantity = lots.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const capacityPercent = shape.capacity ? Math.min(100, Math.round((totalQuantity / shape.capacity) * 100)) : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-6 border-b border-stone-100 dark:border-zinc-800 flex justify-between items-start bg-orange-50/50 dark:bg-orange-950/20">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-orange-500 text-white tracking-wider">
                                BÃI CHỨA ĐA LÔ
                            </span>
                            <span className="text-xs text-stone-500 font-mono font-bold">
                                {shape.code || 'ZONE'}
                            </span>
                        </div>
                        <h3 className="text-2xl font-black text-stone-900 dark:text-white">
                            {shape.label || 'Khu vực lưu trữ'}
                        </h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-stone-200/50 dark:hover:bg-zinc-800 rounded-full transition-colors text-stone-400 hover:text-stone-700"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Overview Stats */}
                <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-3 border-b border-stone-100 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900/50">
                    <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200/60 dark:border-zinc-700 shadow-sm">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Số Lượng Lô</span>
                        <div className="text-xl font-black text-stone-900 dark:text-white flex items-center gap-1.5">
                            <Layers size={18} className="text-orange-500" />
                            {lots.length} <span className="text-xs text-stone-400 font-medium">lô</span>
                        </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200/60 dark:border-zinc-700 shadow-sm">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Tổng Tồn Bãi</span>
                        <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <Package size={18} />
                            {totalQuantity.toLocaleString()}
                        </div>
                    </div>

                    {shape.capacity && (
                        <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200/60 dark:border-zinc-700 shadow-sm col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Tỷ Lệ Lấp Đầy</span>
                            <div className="text-xl font-black text-blue-600 dark:text-blue-400">
                                {capacityPercent}%
                                <span className="text-xs text-stone-400 font-normal ml-1">/ {shape.capacity.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Lots List */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                        Danh Sách Lô Hàng Đang Lưu Trữ Tại Đây
                    </h4>

                    {lots.length === 0 ? (
                        <div className="text-center py-12 text-stone-400 bg-stone-50 dark:bg-zinc-800/40 rounded-2xl border border-dashed border-stone-200 dark:border-zinc-800">
                            <Package size={40} className="mx-auto mb-2 opacity-40 text-stone-400" />
                            <p className="text-sm font-bold">Khu vực này hiện đang trống</p>
                            <p className="text-xs text-stone-400 mt-1">Chưa có lô hàng nào được gán vào khu vực này.</p>
                        </div>
                    ) : (
                        lots.map((item, index) => (
                            <div 
                                key={item.lotId || index}
                                className="p-4 rounded-2xl border border-stone-200 dark:border-zinc-800 hover:border-orange-500 bg-white dark:bg-zinc-850 hover:shadow-lg transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 group cursor-pointer"
                                onClick={() => onSelectLot?.(item)}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-black text-sm text-stone-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                                            {item.lotCode}
                                        </span>
                                        {item.batchCode && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300">
                                                Lô: {item.batchCode}
                                            </span>
                                        )}
                                        {item.customerName && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                                {item.customerName}
                                            </span>
                                        )}
                                    </div>

                                    <div className="text-xs font-bold text-stone-700 dark:text-stone-200">
                                        {item.productName}
                                        {item.sku && <span className="text-stone-400 font-normal ml-1.5">({item.sku})</span>}
                                    </div>

                                    {item.inboundDate && (
                                        <div className="text-[11px] text-stone-400 flex items-center gap-1">
                                            <Calendar size={12} /> Nhập ngày: {new Date(item.inboundDate).toLocaleDateString('vi-VN')}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-zinc-800">
                                    <div className="text-right">
                                        <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                                            {item.quantity?.toLocaleString()} <span className="text-xs text-stone-400 font-normal">{item.unit}</span>
                                        </div>
                                    </div>

                                    <button 
                                        type="button"
                                        className="p-2 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white transition-all shadow-sm"
                                        title="Xem chi tiết hoặc xuất lô này"
                                    >
                                        <ArrowUpRight size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-stone-100 dark:border-zinc-800 flex justify-end gap-2 bg-stone-50/50 dark:bg-zinc-900/50">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl text-stone-600 dark:text-zinc-300 font-bold hover:bg-stone-200/50 dark:hover:bg-zinc-800 text-sm transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
