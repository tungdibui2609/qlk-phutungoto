import React, { useState } from 'react'
import {
    Printer,
    Download,
    FileSpreadsheet,
    Hash,
    MoreVertical,
    X,
    Maximize,
    Minimize,
    Loader2,
    Settings
} from 'lucide-react'

interface PrintActionMenuProps {
    printSize: 'A4' | 'A5';
    onPrintSizeChange: () => void;
    isDownloading: boolean;
    downloadTimer: number;
    onDownload: () => void;
    displayInternalCode: boolean;
    onDisplayInternalCodeChange: () => void;
    onPrint: () => void;
    onExcelExport: () => void;
    printType?: 'internal' | 'official' | 'bank';
    onPrintTypeChange?: (type: 'internal' | 'official' | 'bank') => void;
}

export function PrintActionMenu({
    printSize,
    onPrintSizeChange,
    isDownloading,
    downloadTimer,
    onDownload,
    displayInternalCode,
    onDisplayInternalCodeChange,
    onPrint,
    onExcelExport,
    printType,
    onPrintTypeChange
}: PrintActionMenuProps) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="fixed top-4 right-4 print:hidden z-50 flex flex-col items-end gap-2">
            {/* Main Menu Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center w-12 h-12 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 ${isOpen ? 'bg-rose-500 text-white rotate-90' : 'bg-blue-600 text-white'}`}
            >
                {isOpen ? <X size={24} /> : <Settings size={24} />}
            </button>

            {/* Menu Items */}
            {isOpen && (
                <div className="flex flex-col items-end gap-3 mt-2 animate-in slide-in-from-top-4 fade-in duration-200">
                    {/* Print Button - Keep it prominent */}
                    <button
                        onClick={() => { onPrint(); setIsOpen(false); }}
                        className="flex items-center gap-3 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full shadow-xl transition-all hover:-translate-x-1"
                    >
                        <Printer size={20} />
                        <span>In phiếu</span>
                    </button>

                    {/* Export Excel */}
                    <button
                        onClick={() => { onExcelExport(); setIsOpen(false); }}
                        className="flex items-center gap-3 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full shadow-xl transition-all hover:-translate-x-1"
                    >
                        <FileSpreadsheet size={20} />
                        <span>Xuất Excel</span>
                    </button>

                    {/* Download Image */}
                    <button
                        onClick={() => { onDownload(); setIsOpen(false); }}
                        disabled={isDownloading}
                        className={`flex items-center gap-3 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-xl transition-all hover:-translate-x-1 ${isDownloading ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {isDownloading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                <span>Đang tạo ảnh ({downloadTimer}s)</span>
                            </>
                        ) : (
                            <>
                                <Download size={20} />
                                <span>Tải ảnh phiếu</span>
                            </>
                        )}
                    </button>

                    {/* Toggle print size */}
                    <button
                        onClick={() => { onPrintSizeChange(); setIsOpen(false); }}
                        className={`flex items-center gap-3 px-5 py-2.5 rounded-full shadow-xl transition-all hover:-translate-x-1 font-semibold ${printSize === 'A5' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-white text-stone-800 border border-stone-200'}`}
                    >
                        {printSize === 'A5' ? <Minimize size={20} /> : <Maximize size={20} />}
                        <span>Khổ in: {printSize}</span>
                    </button>

                    {/* Toggle internal code */}
                    <button
                        onClick={() => { onDisplayInternalCodeChange(); setIsOpen(false); }}
                        className={`flex items-center gap-3 px-5 py-2.5 rounded-full shadow-xl transition-all hover:-translate-x-1 font-semibold ${displayInternalCode ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-white text-stone-800 border border-stone-200'}`}
                    >
                        <Hash size={20} />
                        <span>{displayInternalCode ? 'Hiện Mã Nội Bộ' : 'Hiện Mã Gốc'}</span>
                    </button>

                    {/* Switch print template */}
                    {onPrintTypeChange && (
                        <div className="flex flex-col gap-1 items-end bg-white dark:bg-zinc-800 p-2.5 rounded-2xl shadow-xl border border-stone-200 dark:border-zinc-700">
                            <span className="text-[10px] font-bold text-stone-500 uppercase px-1">Mẫu chứng từ</span>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => { onPrintTypeChange('internal'); setIsOpen(false); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${printType === 'internal' ? 'bg-blue-600 text-white shadow' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'}`}
                                >
                                    Nội bộ
                                </button>
                                <button
                                    onClick={() => { onPrintTypeChange('official'); setIsOpen(false); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${printType === 'official' ? 'bg-orange-500 text-white shadow' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'}`}
                                >
                                    Hệ thống
                                </button>
                                <button
                                    onClick={() => { onPrintTypeChange('bank'); setIsOpen(false); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${printType === 'bank' ? 'bg-emerald-600 text-white shadow' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'}`}
                                >
                                    Ngân hàng
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
