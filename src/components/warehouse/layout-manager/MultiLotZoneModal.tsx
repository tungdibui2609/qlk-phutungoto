'use client';

import React from 'react';
import { 
    X, Package, Calendar, Tag, ArrowUpRight, ShieldCheck, 
    Layers, Hash, Eye, Truck, Send, LogOut, QrCode, PlusCircle, MapPin
} from 'lucide-react';
import { LayoutShape } from './types';

export interface MultiLotItem {
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
    allZoneLots?: MultiLotItem[];
    onShowAllLots?: () => void;
    onSelectLot?: (lotItem: MultiLotItem) => void;
    onViewLotDetails?: (lotId: string) => void;
    onExportLot?: (positionId: string, lotId: string) => void;
    onUnassignPosition?: (positionId: string) => void;
    onMoveLot?: (positionId: string) => void;
    onPrintQr?: (lot: any) => void;
    onAssignLot?: (shape: LayoutShape) => void;
}

export default function MultiLotZoneModal({
    isOpen,
    onClose,
    shape,
    lots,
    allZoneLots,
    onShowAllLots,
    onSelectLot,
    onViewLotDetails,
    onExportLot,
    onUnassignPosition,
    onMoveLot,
    onPrintQr,
    onAssignLot
}: MultiLotZoneModalProps) {
    if (!isOpen || !shape) return null;

    const totalQuantity = lots.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const capacityPercent = shape.capacity ? Math.min(100, Math.round((totalQuantity / shape.capacity) * 100)) : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-stone-100 dark:border-zinc-800 flex justify-between items-start bg-orange-50/70 dark:bg-orange-950/20">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-orange-500 text-white tracking-wider shadow-xs">
                                {shape.isMultiLot || lots.length > 1 ? 'BÃI CHỨA ĐA LÔ' : 'VỊ TRÍ LƯU TRỮ'}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-md bg-stone-200/80 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 font-mono font-bold">
                                {shape.code || shape.label || 'ZONE'}
                            </span>
                            {allZoneLots && allZoneLots.length > 1 && lots.length === 1 && onShowAllLots && (
                                <button
                                    type="button"
                                    onClick={onShowAllLots}
                                    className="px-2.5 py-0.5 text-[11px] font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 dark:bg-orange-950/70 dark:text-orange-300 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                                    title="Xem tất cả các lô khác trong bãi này"
                                >
                                    <Layers size={12} />
                                    <span>Xem cả bãi ({allZoneLots.length} lô)</span>
                                </button>
                            )}
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">
                            {shape.label || shape.code || 'Khu vực lưu trữ'}
                        </h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-stone-200/50 dark:hover:bg-zinc-800 rounded-full transition-colors text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                        title="Đóng"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Overview Stats */}
                <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 gap-3 border-b border-stone-100 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900/50">
                    <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200/60 dark:border-zinc-700 shadow-xs">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Số Lượng Lô</span>
                        <div className="text-xl font-black text-stone-900 dark:text-white flex items-center gap-1.5">
                            <Layers size={18} className="text-orange-500" />
                            {lots.length} <span className="text-xs text-stone-400 font-medium">lô</span>
                        </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200/60 dark:border-zinc-700 shadow-xs">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Tổng Tồn Bãi</span>
                        <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <Package size={18} />
                            {totalQuantity.toLocaleString()}
                        </div>
                    </div>

                    {shape.capacity ? (
                        <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200/60 dark:border-zinc-700 shadow-xs col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Tỷ Lệ Lấp Đầy</span>
                            <div className="text-xl font-black text-blue-600 dark:text-blue-400">
                                {capacityPercent}%
                                <span className="text-xs text-stone-400 font-normal ml-1">/ {shape.capacity.toLocaleString()}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200/60 dark:border-zinc-700 shadow-xs col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Trạng Thái</span>
                            <div className="text-sm font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mt-1">
                                <span className={`w-2.5 h-2.5 rounded-full ${lots.length > 0 ? 'bg-emerald-500' : 'bg-stone-300'}`}></span>
                                {lots.length > 0 ? 'Đang chứa hàng' : 'Đang trống'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Lots List */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-3.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1 flex items-center justify-between">
                        <span>Thông Tin Hàng Hóa Tại Vị Trí Này</span>
                        <span className="text-[11px] font-normal lowercase">({lots.length} lô lưu trữ)</span>
                    </h4>

                    {lots.length === 0 ? (
                        <div className="text-center py-12 text-stone-400 bg-stone-50 dark:bg-zinc-800/40 rounded-2xl border border-dashed border-stone-200 dark:border-zinc-800">
                            <Package size={40} className="mx-auto mb-2 opacity-40 text-stone-400" />
                            <p className="text-sm font-bold text-stone-600 dark:text-stone-300">Vị trí này hiện đang trống</p>
                            <p className="text-xs text-stone-400 mt-1 mb-4">Chưa có lô hàng nào được gán vào khu vực này.</p>
                            {onAssignLot && (
                                <button
                                    onClick={() => {
                                        onClose();
                                        onAssignLot(shape);
                                    }}
                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 mx-auto"
                                >
                                    <PlusCircle size={14} />
                                    <span>Gán Lô Hàng Vào Đây</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        lots.map((item, index) => {
                            const posCode = item.position?.code || item.lotCode;
                            const isSubPos = posCode.includes('-');

                            return (
                                <div 
                                    key={item.lotId || index}
                                    className="p-4 rounded-2xl border border-stone-200 dark:border-zinc-800 hover:border-orange-500/80 bg-white dark:bg-zinc-850 hover:shadow-md transition-all flex flex-col gap-3 group"
                                >
                                    {/* Top row: Position badge, Lot code, Badges & Quantity */}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Badge vị trí cụ thể */}
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                                                <MapPin size={12} className="text-orange-600" />
                                                {posCode}
                                            </span>

                                            {/* Mã LOT */}
                                            <span className="font-mono font-black text-sm text-stone-900 dark:text-white">
                                                {item.lotCode}
                                            </span>

                                            {item.batchCode && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300">
                                                    Lô SX: {item.batchCode}
                                                </span>
                                            )}

                                            {item.customerName && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                                    {item.customerName}
                                                </span>
                                            )}
                                        </div>

                                        {/* Số lượng */}
                                        <div className="text-right">
                                            <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                                                {item.quantity?.toLocaleString()} <span className="text-xs text-stone-400 font-semibold">{item.unit}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Middle row: Tên sản phẩm & SKU & Ngày nhập */}
                                    <div className="space-y-1 bg-stone-50/70 dark:bg-zinc-900/50 p-2.5 rounded-xl border border-stone-100 dark:border-zinc-800">
                                        <div className="text-sm font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                                            <Package size={14} className="text-orange-500 shrink-0" />
                                            <span>{item.productName}</span>
                                            {item.sku && (
                                                <span className="text-xs font-mono font-normal text-stone-400 bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-stone-200/60 dark:border-zinc-700">
                                                    SKU: {item.sku}
                                                </span>
                                            )}
                                        </div>

                                        {item.inboundDate && (
                                            <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5 pl-5">
                                                <Calendar size={12} className="text-stone-400" />
                                                <span>Ngày nhập: {new Date(item.inboundDate).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom row: Hành động nhanh cho lô này */}
                                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100 dark:border-zinc-800 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {/* Xem chi tiết full modal */}
                                            {onViewLotDetails && item.lotId && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onClose();
                                                        onViewLotDetails(item.lotId);
                                                    }}
                                                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs"
                                                    title="Xem toàn bộ chi tiết, lịch sử và mã phụ của LOT"
                                                >
                                                    <Eye size={13} />
                                                    <span>Chi tiết LOT</span>
                                                </button>
                                            )}

                                            {/* Xuất hàng */}
                                            {onExportLot && item.lotId && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onClose();
                                                        onExportLot(item.position?.id, item.lotId);
                                                    }}
                                                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs"
                                                    title="Tạo lệnh xuất cho lô này"
                                                >
                                                    <Send size={13} />
                                                    <span>Xuất hàng</span>
                                                </button>
                                            )}

                                            {/* Dời vị trí */}
                                            {onMoveLot && item.position?.id && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onClose();
                                                        onMoveLot(item.position.id);
                                                    }}
                                                    className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-stone-300 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs"
                                                    title="Chuyển lô này sang vị trí khác"
                                                >
                                                    <Truck size={13} />
                                                    <span>Dời vị trí</span>
                                                </button>
                                            )}

                                            {/* In tem QR */}
                                            {onPrintQr && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onClose();
                                                        onPrintQr(item.lot || { id: item.lotId, code: item.lotCode });
                                                    }}
                                                    className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-stone-300 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold transition-all shadow-2xs"
                                                    title="Xem mã QR của LOT"
                                                >
                                                    <QrCode size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Gỡ vị trí */}
                                        {onUnassignPosition && item.position?.id && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onClose();
                                                    onUnassignPosition(item.position.id);
                                                }}
                                                className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ml-auto"
                                                title="Gỡ lô này khỏi vị trí (chuyển về chưa gán)"
                                            >
                                                <LogOut size={13} />
                                                <span>Gỡ vị trí</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
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
