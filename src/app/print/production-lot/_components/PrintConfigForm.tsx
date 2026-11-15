'use client'

import React from 'react'
import { Printer, BarChart3, RotateCcw, ShieldAlert, AlertTriangle, CheckCircle2, X, ArrowLeft, Search, Boxes } from 'lucide-react'
import type { PrintConfigState, PrintToastState } from './types'

interface PrintConfigFormProps {
    type: string
    data: any
    router: { back: () => void }
    printConfig: PrintConfigState
    setPrintConfig: React.Dispatch<React.SetStateAction<PrintConfigState>>
    isDamagedMode: boolean
    setIsDamagedMode: React.Dispatch<React.SetStateAction<boolean>>
    showDamagedModal: boolean
    setShowDamagedModal: React.Dispatch<React.SetStateAction<boolean>>
    setShowLotSelectModal: React.Dispatch<React.SetStateAction<boolean>>
    fetchAvailableLots: () => Promise<void>
    handlePrint: () => Promise<void>
    handleReset: () => void
    showReasonModal: boolean
    setShowReasonModal: React.Dispatch<React.SetStateAction<boolean>>
    damagedReason: string
    setDamagedReason: React.Dispatch<React.SetStateAction<string>>
    executePrint: (reason: string, count: number, startIndex: number) => Promise<void>
    showResetModal: boolean
    setShowResetModal: React.Dispatch<React.SetStateAction<boolean>>
    resetPassword: string
    setResetPassword: React.Dispatch<React.SetStateAction<string>>
    resetStep: 'password' | 'confirm'
    setResetStep: React.Dispatch<React.SetStateAction<'password' | 'confirm'>>
    executeReset: () => Promise<void>
    toast: PrintToastState
    setToast: React.Dispatch<React.SetStateAction<PrintToastState>>
    showToast: (message: string, type?: 'success' | 'error') => void
}

export function PrintConfigForm({
    type,
    data,
    router,
    printConfig,
    setPrintConfig,
    isDamagedMode,
    setIsDamagedMode,
    showDamagedModal,
    setShowDamagedModal,
    setShowLotSelectModal,
    fetchAvailableLots,
    handlePrint,
    handleReset,
    showReasonModal,
    setShowReasonModal,
    damagedReason,
    setDamagedReason,
    executePrint,
    showResetModal,
    setShowResetModal,
    resetPassword,
    setResetPassword,
    resetStep,
    setResetStep,
    executeReset,
    toast,
    setToast,
    showToast,
}: PrintConfigFormProps) {
    return (
        <>
            {/* Print Config Form */}
            <div className="print:hidden bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-2xl w-full max-w-4xl animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="p-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-2xl transition-all border border-zinc-200 flex items-center justify-center flex-shrink-0 active:scale-95"
                            title="Quay lại"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="p-4 bg-blue-500 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                            <Printer size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">
                                Cấu hình In Số Thứ Tự / Phiếu ({printConfig.paper_size === 'a4' ? 'Khổ A4' : 'Khổ A5'})
                            </h2>
                            <p className="text-zinc-500 text-sm font-medium italic">
                                Phiếu số thứ tự & thông tin lô sản phẩm · {printConfig.paper_size === 'a4' ? 'Khổ A4 (297 x 210 mm)' : 'Khổ A5 (210 x 148 mm)'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        {/* Paper Size Switcher */}
                        <div className="bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200 flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPrintConfig(prev => ({ ...prev, paper_size: 'a5' }))}
                                className={`px-3 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                                    printConfig.paper_size !== 'a4'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60'
                                }`}
                            >
                                Khổ A5
                            </button>
                            <button
                                type="button"
                                onClick={() => setPrintConfig(prev => ({ ...prev, paper_size: 'a4' }))}
                                className={`px-3 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                                    printConfig.paper_size === 'a4'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60'
                                }`}
                            >
                                Khổ A4
                            </button>
                        </div>

                        {/* Switcher Mẫu Phiếu */}
                        <div className="bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200 flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setPrintConfig(prev => ({ ...prev, sheet_template: 'template1' }))}
                                className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                                    printConfig.sheet_template !== 'template2'
                                        ? 'bg-zinc-900 text-white shadow-md'
                                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-blue-400" />
                                Mẫu 1: Phiếu Chuẩn
                            </button>
                            <button
                                type="button"
                                onClick={() => setPrintConfig(prev => ({ ...prev, sheet_template: 'template2' }))}
                                className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                                    printConfig.sheet_template === 'template2'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                Mẫu 2: Phiếu Đơn Giản (Mã + Tháng)
                            </button>
                        </div>
                    </div>
                </div>

                {/* Lot Info & Selector Banner */}
                <div className="mb-6 p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 bg-white text-blue-600 rounded-xl border border-zinc-200 shadow-xs flex-shrink-0">
                            <Boxes size={18} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                                Lô Sản Xuất đang áp dụng
                            </div>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                {data?.id ? (
                                    <>
                                        <span className="font-black text-zinc-900 text-sm bg-white px-2.5 py-0.5 rounded-md border border-zinc-200">
                                            {data.lot_code || '---'}
                                        </span>
                                        <span className="font-bold text-zinc-700 text-sm truncate max-w-[280px]">
                                            {data.products?.name || '---'}
                                        </span>
                                        {data.productions?.code && (
                                            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                                                LSX: {data.productions.code}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-xs font-bold text-zinc-500 italic">
                                        Chế độ in tự do (Chưa chọn lô cụ thể)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            fetchAvailableLots()
                            setShowLotSelectModal(true)
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-blue-50 text-blue-600 rounded-xl border border-blue-200 shadow-xs text-xs font-black uppercase tracking-wider transition-all hover:scale-102 active:scale-98 flex-shrink-0"
                    >
                        <Search size={14} />
                        <span>{data?.id ? 'Đổi Lô Sản Xuất' : 'Chọn Lô Sản Xuất'}</span>
                    </button>
                </div>

                {printConfig.sheet_template === 'template2' ? (
                    /* Cấu hình Mẫu 2: Phiếu Đơn Giản */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 px-1">Ký tự chữ cái (Prefix)</label>
                            <input
                                type="text"
                                value={printConfig.code_prefix}
                                onChange={e => setPrintConfig(prev => ({ ...prev, code_prefix: e.target.value.toUpperCase() }))}
                                className="w-full px-4 py-3 rounded-2xl bg-blue-50/50 border border-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all font-black text-lg text-blue-900 uppercase"
                                placeholder="VD: F"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 px-1">Dãy số bắt đầu (STT)</label>
                            <input
                                type="number" min={1}
                                value={printConfig.start_index}
                                onChange={e => setPrintConfig(prev => ({ ...prev, start_index: parseInt(e.target.value) || 1 }))}
                                className="w-full px-4 py-3 rounded-2xl bg-blue-50/50 border border-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all font-black text-lg text-blue-900"
                                placeholder="VD: 2474"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 px-1">Tháng in trên phiếu</label>
                            <input
                                type="text"
                                value={printConfig.month_val}
                                onChange={e => setPrintConfig(prev => ({ ...prev, month_val: e.target.value }))}
                                className="w-full px-4 py-3 rounded-2xl bg-blue-50/50 border border-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all font-black text-lg text-blue-900"
                                placeholder="VD: 8"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-orange-500 px-1">Số lượng phiếu cần in</label>
                            <input
                                type="number" min={1}
                                value={printConfig.label_count}
                                onChange={e => setPrintConfig(prev => ({ ...prev, label_count: parseInt(e.target.value) || 1 }))}
                                className="w-full px-4 py-3 rounded-2xl bg-orange-50 border border-orange-100 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all font-black text-lg text-orange-600"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-400 mb-2">Chế độ in</label>
                            <label className="relative inline-flex items-center cursor-pointer group mt-1">
                                <input
                                    type="checkbox"
                                    checked={isDamagedMode}
                                    onChange={e => {
                                        const goingToDamaged = e.target.checked
                                        setIsDamagedMode(goingToDamaged)
                                        if (!goingToDamaged) {
                                            const lastIndex = (data.productions?.last_sheet_index || 0)
                                            setPrintConfig(prev => ({ ...prev, start_index: lastIndex + 1 }))
                                        }
                                    }}
                                    className="sr-only peer"
                                />
                                <div className="w-14 h-8 bg-zinc-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-rose-500 shadow-inner"></div>
                                <span className={`ml-3 text-sm font-black uppercase tracking-tight transition-colors ${isDamagedMode ? 'text-rose-500' : 'text-zinc-500'}`}>
                                    {isDamagedMode ? 'In bù phiếu hỏng' : 'In sản xuất chuẩn'}
                                </span>
                            </label>
                        </div>
                    </div>
                ) : (
                    /* Cấu hình Mẫu 1: Phiếu Chuẩn */
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Quy cách</label>
                                <input
                                    type="text"
                                    value={printConfig.specification}
                                    onChange={e => setPrintConfig(prev => ({ ...prev, specification: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-sm text-zinc-800"
                                    placeholder="VD: Thùng 12 túi"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Khối lượng tịnh</label>
                                <input
                                    type="text"
                                    value={printConfig.net_weight}
                                    onChange={e => setPrintConfig(prev => ({ ...prev, net_weight: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-sm text-zinc-800"
                                    placeholder="VD: 20kg"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Ngày sản xuất</label>
                                <input
                                    type="date"
                                    value={printConfig.production_date}
                                    disabled
                                    className="w-full px-4 py-3 rounded-2xl bg-zinc-100 border border-zinc-200 cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-sm text-zinc-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Ngày đóng gói</label>
                                <input
                                    type="date"
                                    value={printConfig.packing_date}
                                    onChange={e => setPrintConfig(prev => ({ ...prev, packing_date: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-sm text-zinc-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Ngày tạo</label>
                                <input
                                    type="date"
                                    value={printConfig.created_date}
                                    onChange={e => setPrintConfig(prev => ({ ...prev, created_date: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-sm text-zinc-800"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-orange-500 px-1">Số lượng phiếu cần in</label>
                                <input
                                    type="number" min={1}
                                    value={printConfig.label_count}
                                    onChange={e => setPrintConfig(prev => ({ ...prev, label_count: parseInt(e.target.value) || 1 }))}
                                    className="w-full px-4 py-3 rounded-2xl bg-orange-50 border border-orange-100 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all font-black text-lg text-orange-600"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">STT Bắt đầu</label>
                                <input
                                    type="number" min={1}
                                    value={printConfig.start_index}
                                    onChange={e => setPrintConfig(prev => ({ ...prev, start_index: parseInt(e.target.value) || 1 }))}
                                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-sm text-zinc-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-zinc-400 mb-2">Chế độ in</label>
                                <label className="relative inline-flex items-center cursor-pointer group mt-1">
                                    <input
                                        type="checkbox"
                                        checked={isDamagedMode}
                                        onChange={e => {
                                            const goingToDamaged = e.target.checked
                                            setIsDamagedMode(goingToDamaged)
                                            if (!goingToDamaged) {
                                                const lastIndex = (data.productions?.last_sheet_index || 0)
                                                setPrintConfig(prev => ({ ...prev, start_index: lastIndex + 1 }))
                                            }
                                        }}
                                        className="sr-only peer"
                                    />
                                    <div className="w-14 h-8 bg-zinc-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-rose-500 shadow-inner"></div>
                                    <span className={`ml-3 text-sm font-black uppercase tracking-tight transition-colors ${isDamagedMode ? 'text-rose-500' : 'text-zinc-500'}`}>
                                        {isDamagedMode ? 'In bù phiếu hỏng' : 'In sản xuất chuẩn'}
                                    </span>
                                </label>
                            </div>
                        </div>
                    </>
                )}

                {/* Summary */}
                <div className="mt-6 bg-zinc-900 p-6 rounded-[2rem] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-zinc-900/30">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                            <BarChart3 className={isDamagedMode ? "text-rose-400" : "text-blue-400"} />
                        </div>
                        <div className="flex items-center gap-4 divide-x divide-white/10">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Báo cáo sản lượng in</span>
                                <div className="flex items-center gap-4 mt-1">
                                    <div className="flex flex-col">
                                        <span className="text-2xl font-black">{data.total_printed_sheets || 0}</span>
                                        <span className="text-[9px] font-bold text-zinc-500 uppercase">Phiếu Đạt</span>
                                    </div>
                                    <div className="w-px h-8 bg-white/10" />
                                    <button
                                        onClick={() => setShowDamagedModal(true)}
                                        className="flex flex-col text-rose-400 hover:text-rose-300 transition-colors cursor-pointer group/dam"
                                        title="Bấm để xem lịch sử in bù"
                                    >
                                        <span className="text-2xl font-black group-hover/dam:underline">{data.damaged_printed_sheets || 0}</span>
                                        <span className="text-[9px] font-bold uppercase">Phiếu Hỏng ▸</span>
                                    </button>
                                    <div className="w-px h-8 bg-white/10" />
                                    <div className="flex flex-col text-emerald-400">
                                        <span className="text-2xl font-black">{data.productions?.last_sheet_index || 0}</span>
                                        <span className="text-[9px] font-bold uppercase">STT Cuối</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                            <span className="text-[10px] font-black uppercase text-zinc-500 block leading-none mb-1">Cập nhật lần cuối</span>
                            <div className="text-xs font-bold text-zinc-300">{(data as any).last_printed_at ? new Date((data as any).last_printed_at).toLocaleString('vi-VN') : '---'}</div>
                        </div>
                        <button
                            onClick={handleReset}
                            className="p-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl transition-all border border-rose-500/20"
                            title="Reset toàn bộ thông số về 0"
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>
                </div>

                {/* Modal: Lịch sử in bù */}
                {showDamagedModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden" onClick={() => setShowDamagedModal(false)}>
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="px-6 py-5 bg-gradient-to-r from-rose-500 to-rose-600 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-white uppercase tracking-tight">Lịch sử In bù Phiếu hỏng</h2>
                                    <p className="text-rose-200 text-xs font-medium mt-0.5">Tổng cộng: {(data as any).damaged_printed_labels || 0} phiếu / {(Array.isArray((data as any).damaged_print_logs) ? (data as any).damaged_print_logs.length : 0)} lần in</p>
                                </div>
                                <button onClick={() => setShowDamagedModal(false)} className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xl font-black transition-colors">✕</button>
                            </div>
                            <div className="overflow-y-auto max-h-[60vh]">
                                {(() => {
                                    const logs = (data as any).damaged_print_logs
                                    if (!Array.isArray(logs) || logs.length === 0) {
                                        return <div className="p-12 text-center text-zinc-400 font-bold">Chưa có lịch sử in bù</div>
                                    }
                                    return (
                                        <div className="divide-y divide-zinc-100">
                                            {logs.map((log: any, idx: number) => {
                                                const start = Number(log.start_index) || 1
                                                const qty = Number(log.quantity) || 0
                                                const sttList = Array.from({ length: qty }, (_, i) => (start + i).toString().padStart(2, '0'))
                                                return (
                                                    <div key={idx} className="px-6 py-4 hover:bg-zinc-50/50 transition-colors">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <span className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 text-xs font-black flex items-center justify-center">{idx + 1}</span>
                                                                    <div>
                                                                        <div className="text-sm font-bold text-zinc-800">{log.user_email || 'Không xác định'}</div>
                                                                        <div className="text-[10px] text-zinc-400 font-medium">{log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : '---'}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="ml-10">
                                                                    <div className="text-xs text-zinc-500 mb-1.5"><span className="font-bold text-zinc-700">Lý do:</span> <span className="italic">{log.reason || '---'}</span></div>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase">STT in lại:</span>
                                                                        {sttList.map((stt: string, i: number) => (
                                                                            <span key={i} className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md text-xs font-black">{stt}</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-center bg-rose-50 px-4 py-2 rounded-xl border border-rose-100">
                                                                <span className="text-xl font-black text-rose-600">{qty}</span>
                                                                <span className="text-[8px] font-bold text-rose-400 uppercase">phiếu</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Modals: Reason & Reset - tái sử dụng */}
                {showReasonModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden" onClick={() => setShowReasonModal(false)}>
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="px-6 py-5 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <AlertTriangle className="text-white" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white uppercase tracking-tight">In bù phiếu hỏng</h2>
                                    <p className="text-amber-100 text-xs font-medium">Vui lòng nhập lý do trước khi in</p>
                                </div>
                            </div>
                            <div className="p-6">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Lý do in bù *</label>
                                <textarea
                                    value={damagedReason}
                                    onChange={(e) => setDamagedReason(e.target.value)}
                                    placeholder="VD: Phiếu bị nhòe mực, phiếu in sai thông tin..."
                                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 focus:outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-300 transition-all text-sm text-zinc-800 resize-none h-24"
                                    autoFocus
                                />
                                <div className="flex gap-3 mt-5">
                                    <button onClick={() => setShowReasonModal(false)} className="flex-1 px-4 py-3 rounded-2xl border border-zinc-200 text-zinc-500 font-bold text-sm hover:bg-zinc-50 transition-all">Huỷ bỏ</button>
                                    <button
                                        onClick={() => {
                                            if (!damagedReason.trim()) return
                                            setShowReasonModal(false)
                                            executePrint(damagedReason.trim(), Number(printConfig.label_count) || 0, Number(printConfig.start_index) || 1)
                                        }}
                                        disabled={!damagedReason.trim()}
                                        className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-sm uppercase tracking-wider hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                                    >Xác nhận & In</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showResetModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden" onClick={() => setShowResetModal(false)}>
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            {resetStep === 'password' ? (
                                <>
                                    <div className="px-6 py-5 bg-gradient-to-r from-rose-500 to-red-600 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center"><ShieldAlert className="text-white" size={24} /></div>
                                        <div>
                                            <h2 className="text-lg font-black text-white uppercase tracking-tight">Xác minh bảo mật</h2>
                                            <p className="text-rose-200 text-xs font-medium">Nhập mật khẩu để tiếp tục Reset</p>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Mật khẩu quản trị</label>
                                        <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Nhập mật khẩu..." className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 focus:outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-300 transition-all text-sm text-zinc-800" autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && resetPassword === 'Chanhthu123') setResetStep('confirm') }} />
                                        <div className="flex gap-3 mt-5">
                                            <button onClick={() => setShowResetModal(false)} className="flex-1 px-4 py-3 rounded-2xl border border-zinc-200 text-zinc-500 font-bold text-sm hover:bg-zinc-50 transition-all">Huỷ bỏ</button>
                                            <button onClick={() => { if (resetPassword === 'Chanhthu123') { setResetStep('confirm') } else { showToast('Sai mật khẩu!', 'error') }}} className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-black text-sm uppercase tracking-wider hover:shadow-lg transition-all active:scale-95">Tiếp tục</button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center animate-pulse"><AlertTriangle className="text-white" size={24} /></div>
                                        <div>
                                            <h2 className="text-lg font-black text-white uppercase tracking-tight">Xác nhận xóa dữ liệu</h2>
                                            <p className="text-red-200 text-xs font-medium">Hành động này không thể hoàn tác!</p>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-5">
                                            <p className="text-sm text-red-700 font-medium">Toàn bộ dữ liệu in sẽ bị xóa trắng.</p>
                                            <ul className="mt-2 space-y-1 text-xs text-red-600 font-bold">
                                                <li>• Phiếu Đạt, Phiếu Hỏng, STT cuối → 0</li>
                                                <li>• Lịch sử in bù → Xóa sạch</li>
                                            </ul>
                                        </div>
                                        <div className="flex gap-3">
                                            <button onClick={() => setShowResetModal(false)} className="flex-1 px-4 py-3 rounded-2xl border border-zinc-200 text-zinc-500 font-bold text-sm hover:bg-zinc-50 transition-all">Giữ lại</button>
                                            <button onClick={executeReset} className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 text-white font-black text-sm uppercase tracking-wider hover:shadow-lg transition-all active:scale-95">Xóa tất cả</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Toast */}
                {toast.show && (
                    <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300 print:hidden ${toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800' : 'bg-red-50/95 border-red-200 text-red-800'}`}>
                        {toast.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" /> : <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />}
                        <span className="text-sm font-bold max-w-[300px]">{toast.message}</span>
                        <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="ml-2 text-zinc-400 hover:text-zinc-600"><X size={16} /></button>
                    </div>
                )}

                <div className="mt-8 pt-8 border-t border-zinc-50 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Xem trước</span>
                        <span className="text-zinc-600 font-bold text-sm italic">Sẵn sàng in {printConfig.label_count} phiếu từ STT {String(printConfig.start_index).padStart(2, '0')}</span>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex items-center px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 shadow-sm shadow-emerald-500/5">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />Đã đồng bộ Database
                        </div>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 bg-zinc-900 hover:bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl shadow-zinc-900/20"
                        >
                            <Printer size={20} />RA LỆNH IN
                        </button>
                    </div>
                </div>
            </div>

        </>
    )
}
