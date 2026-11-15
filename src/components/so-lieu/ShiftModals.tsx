'use client'

import React from 'react'
import Link from 'next/link'
import {
    Briefcase,
    Calendar,
    Check,
    CheckCircle2,
    Clock,
    FileText,
    History,
    Settings2,
    StopCircle,
    X,
} from 'lucide-react'

interface ShiftModalsProps {
    // Common
    openShifts: any[]
    currentJobName: string
    orderTypes: any[]
    subShifts: any[]
    profile: any
    formatDateTime: (dateStr: string) => string
    formatDateTimeLocal: (d: Date) => string

    // 6. Open Shift Modal
    openShiftModal: boolean
    setOpenShiftModal: (v: boolean) => void
    jobNameInput: string
    setJobNameInput: (v: string) => void
    jobTemplatesList: any[]
    selectedJobTemplate: any
    setSelectedJobTemplate: (v: any) => void
    jobNotesInput: string
    setJobNotesInput: (v: string) => void
    jobOrderTypeId: string
    setJobOrderTypeId: (v: string) => void
    jobOpenedAtInput: string
    setJobOpenedAtInput: (v: string) => void
    handleOpenShift: () => void

    // 7. Interim Close Modal
    interimCloseModal: boolean
    setInterimCloseModal: (v: boolean) => void
    interimSummary: any
    interimNotes: string
    setInterimNotes: (v: string) => void
    handleInterimClose: () => void

    // 8. Close Shift Modal
    closeShiftModal: boolean
    setCloseShiftModal: (v: boolean) => void
    shiftSummary: any
    closeTimeInput: string
    setCloseTimeInput: (v: string) => void
    closeOrderTypeId: string
    setCloseOrderTypeId: (v: string) => void
    closeNotes: string
    setCloseNotes: (v: string) => void
    handleCloseShift: () => void

    // 9. Sub-shifts Panel
    showSubShiftsPanel: boolean
    setShowSubShiftsPanel: (v: boolean) => void
}

/** Tập hợp 4 modal/panel quản lý Ca công việc: Mở ca, Chốt tạm, Đóng ca, Lịch sử đợt chốt tạm. */
export default function ShiftModals({
    openShifts,
    currentJobName,
    orderTypes,
    subShifts,
    profile,
    formatDateTime,
    formatDateTimeLocal,
    openShiftModal,
    setOpenShiftModal,
    jobNameInput,
    setJobNameInput,
    jobTemplatesList,
    selectedJobTemplate,
    setSelectedJobTemplate,
    jobNotesInput,
    setJobNotesInput,
    jobOrderTypeId,
    setJobOrderTypeId,
    jobOpenedAtInput,
    setJobOpenedAtInput,
    handleOpenShift,
    interimCloseModal,
    setInterimCloseModal,
    interimSummary,
    interimNotes,
    setInterimNotes,
    handleInterimClose,
    closeShiftModal,
    setCloseShiftModal,
    shiftSummary,
    closeTimeInput,
    setCloseTimeInput,
    closeOrderTypeId,
    setCloseOrderTypeId,
    closeNotes,
    setCloseNotes,
    handleCloseShift,
    showSubShiftsPanel,
    setShowSubShiftsPanel,
}: ShiftModalsProps) {
    return (
        <>
            {/* 6. MODAL MỞ THÊM CÔNG VIỆC MỚI */}
            {openShiftModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
                        {/* Thanh handle cho mobile */}
                        <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100 dark:border-zinc-800 shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2.5 sm:p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                                    <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-base sm:text-xl text-stone-900 dark:text-white truncate">
                                        {openShifts.length > 0 ? 'Mở Thêm Công Việc Mới' : 'Mở Ca Công Việc Đầu Tiên'}
                                    </h3>
                                    <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400">Mỗi công việc có bàn ghim và số liệu thống kê riêng</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpenShiftModal(false)}
                                className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition shrink-0"
                                title="Đóng"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
                            {/* 1. Tên công việc */}
                            <div>
                                <label className="block text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                                    Tên công việc <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        autoFocus
                                        list="job-templates-datalist"
                                        value={jobNameInput}
                                        onChange={e => {
                                            const val = e.target.value
                                            setJobNameInput(val)
                                            const match = jobTemplatesList.find(t => t.name.toLowerCase() === val.toLowerCase().trim())
                                            if (match) {
                                                if (match.notes && !jobNotesInput) setJobNotesInput(match.notes)
                                                setSelectedJobTemplate(match)
                                            }
                                        }}
                                        placeholder="Ví dụ: Đóng gói sầu riêng xuất khẩu, Sơ chế mít..."
                                        className="w-full text-sm sm:text-base font-semibold px-3.5 py-3 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-stone-900 dark:text-white"
                                    />
                                    <datalist id="job-templates-datalist">
                                        {jobTemplatesList.map(tpl => (
                                            <option key={tpl.id} value={tpl.name} />
                                        ))}
                                    </datalist>
                                </div>

                                {/* Gợi ý mẫu công việc từ danh sách quản lý */}
                                <div className="mt-3 bg-stone-50/80 dark:bg-zinc-800/50 p-3 sm:p-3.5 rounded-xl border border-stone-200/70 dark:border-zinc-800">
                                    <div className="flex items-center justify-between mb-2.5">
                                        <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                                            <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                                            <span>Chọn nhanh từ mẫu công việc:</span>
                                        </span>
                                        <Link
                                            href="/so-lieu/mau-cong-viec"
                                            target="_blank"
                                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                            title="Mở trang quản lý & tạo mới công việc mẫu"
                                        >
                                            <Settings2 className="w-3.5 h-3.5" />
                                            <span>Quản lý mẫu</span>
                                        </Link>
                                    </div>
                                    {jobTemplatesList.length === 0 ? (
                                        <p className="text-xs text-stone-400 dark:text-zinc-500 italic">
                                            Chưa có công việc mẫu cho kho này — bấm &ldquo;Quản lý mẫu&rdquo; để tạo mới.
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {jobTemplatesList.map(tpl => {
                                                const isSelected = selectedJobTemplate?.id === tpl.id || jobNameInput.trim().toLowerCase() === tpl.name.trim().toLowerCase()
                                                return (
                                                    <button
                                                        key={tpl.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected && jobNameInput.trim() === tpl.name.trim()) {
                                                                setJobNameInput('')
                                                                setSelectedJobTemplate(null)
                                                            } else {
                                                                setJobNameInput(tpl.name)
                                                                if (tpl.notes) setJobNotesInput(tpl.notes)
                                                                setSelectedJobTemplate(tpl)
                                                            }
                                                        }}
                                                        className={`text-xs px-3 py-1.5 rounded-lg transition active:scale-95 flex items-center gap-2 border shadow-2xs ${
                                                            isSelected
                                                                ? 'bg-indigo-600 border-indigo-600 text-white font-bold'
                                                                : 'bg-white hover:bg-stone-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-stone-200 font-medium'
                                                        }`}
                                                    >
                                                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                        <span>{tpl.name}</span>
                                                        {tpl.pinned_product_ids && tpl.pinned_product_ids.length > 0 && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isSelected ? 'bg-indigo-800 text-white' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'}`}>
                                                                {tpl.pinned_product_ids.length} SP
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Loại phiếu kế toán */}
                            <div>
                                <label className="text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
                                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                                    <span>Loại phiếu (Kế toán)</span>
                                </label>
                                <select
                                    value={jobOrderTypeId}
                                    onChange={e => setJobOrderTypeId(e.target.value)}
                                    className="w-full text-xs sm:text-sm px-3 py-2 sm:py-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-stone-800 dark:text-stone-100"
                                >
                                    <option value="">-- Mặc định (hoặc chọn khi chốt ca / làm phiếu) --</option>
                                    {orderTypes.map(ot => (
                                        <option key={ot.id} value={ot.id}>
                                            {ot.code ? `${ot.code} - ` : ''}{ot.name}{ot.scope && ot.scope !== 'both' ? ` (${ot.scope === 'inbound' ? 'Nhập' : 'Xuất'})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-stone-400 mt-1">
                                    Gán trước loại phiếu để tự động điền sẵn khi tạo phiếu nhập/xuất kho kế toán.
                                </p>
                            </div>

                            {/* 2. Thời gian bắt đầu công việc (Hỗ trợ nhập bù) */}
                            <div>
                                <div className="flex flex-wrap items-center justify-between mb-1.5 gap-2">
                                    <label className="text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                                        <span>Thời gian bắt đầu (Ngày & Giờ)</span>
                                    </label>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setJobOpenedAtInput(formatDateTimeLocal(new Date()))}
                                            className="text-xs px-2.5 py-1 rounded-md font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition"
                                        >
                                            Hiện tại
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const d = new Date()
                                                d.setDate(d.getDate() - 1)
                                                setJobOpenedAtInput(formatDateTimeLocal(d))
                                            }}
                                            className="text-xs px-2.5 py-1 rounded-md font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-zinc-700 transition"
                                        >
                                            Hôm qua
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const d = new Date()
                                                d.setDate(d.getDate() - 2)
                                                setJobOpenedAtInput(formatDateTimeLocal(d))
                                            }}
                                            className="text-xs px-2.5 py-1 rounded-md font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-zinc-700 transition"
                                        >
                                            2 ngày trước
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="datetime-local"
                                    value={jobOpenedAtInput}
                                    onChange={e => setJobOpenedAtInput(e.target.value)}
                                    className="w-full text-sm font-semibold p-2.5 sm:p-3 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-stone-800 dark:text-stone-100"
                                />
                                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1.5">
                                    <span>💡</span> <span>Bạn có thể lùi ngày &amp; giờ để <strong>nhập bù số liệu</strong> cho các ca làm việc trước đó.</span>
                                </p>
                            </div>

                            {/* 3. Ghi chú thêm */}
                            <div>
                                <label className="block text-xs sm:text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                                    Ghi chú thêm (tùy chọn):
                                </label>
                                <textarea
                                    value={jobNotesInput}
                                    onChange={e => setJobNotesInput(e.target.value)}
                                    placeholder="Ghi chú về tổ phụ trách, địa điểm xưởng, ca làm..."
                                    rows={2}
                                    className="w-full text-xs sm:text-sm p-3 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-4 mt-3 border-t border-stone-100 dark:border-zinc-800 shrink-0">
                            <button
                                onClick={() => setOpenShiftModal(false)}
                                className="h-11 px-4 text-sm font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl transition flex items-center justify-center border border-stone-200 dark:border-zinc-700"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleOpenShift}
                                disabled={!jobNameInput.trim()}
                                className="h-11 px-5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center"
                            >
                                Bắt Đầu CV
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. MODAL CHỐT CA TẠM (CHO CÔNG VIỆC ĐANG CHỌN) */}
            {interimCloseModal && interimSummary && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 max-h-[92vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
                        <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800 mb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0" />
                                <div>
                                    <h3 className="font-bold text-base text-stone-900 dark:text-white">
                                        Báo Cáo Chốt Tạm (Đợt {subShifts.length + 1})
                                    </h3>
                                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold truncate">
                                        Công việc: {currentJobName}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setInterimCloseModal(false)} className="text-stone-400 hover:text-stone-600 p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="text-xs text-stone-500 mb-3 flex items-center justify-between shrink-0">
                            <span>Từ: <strong>{formatDateTime(interimSummary.from_time)}</strong></span>
                            <span>Đến: <strong>{formatDateTime(interimSummary.to_time)}</strong></span>
                        </div>

                        <div className="flex-1 overflow-y-auto mb-3 border border-stone-100 dark:border-zinc-800 rounded-xl p-3 bg-stone-50/50 dark:bg-zinc-950/50">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b text-stone-400 uppercase font-semibold">
                                        <th className="pb-1.5">Sản phẩm</th>
                                        <th className="pb-1.5 text-right">Nhập (+)</th>
                                        <th className="pb-1.5 text-right">Xuất (-)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                    {Object.values(interimSummary.products_summary || {}).map((item: any, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2 font-medium text-stone-800 dark:text-stone-200">
                                                {item.product_name} ({item.unit})
                                            </td>
                                            <td className="py-2 text-right text-emerald-600 font-bold">+{item.in_qty}</td>
                                            <td className="py-2 text-right text-rose-600 font-bold">-{item.out_qty}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mb-3 shrink-0">
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Ghi chú đợt chốt tạm:
                            </label>
                            <input
                                type="text"
                                value={interimNotes}
                                onChange={e => setInterimNotes(e.target.value)}
                                placeholder="Ví dụ: Chốt giữa ca ăn trưa..."
                                className="w-full text-xs p-3 sm:p-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800 shrink-0">
                            <button
                                onClick={() => setInterimCloseModal(false)}
                                className="h-11 sm:h-9 px-4 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl flex items-center justify-center"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleInterimClose}
                                className="h-11 sm:h-9 px-5 text-xs font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl shadow-md flex items-center justify-center"
                            >
                                Xác nhận Chốt Tạm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 8. MODAL CHỐT SỔ (HOÀN THÀNH CÔNG VIỆC ĐANG CHỌN) */}
            {closeShiftModal && shiftSummary && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 max-h-[92vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
                        <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800 mb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <StopCircle className="w-5 h-5 text-rose-600 shrink-0" />
                                <div>
                                    <h3 className="font-bold text-base text-stone-900 dark:text-white">
                                        Báo Cáo Tổng Kết Hoàn Thành
                                    </h3>
                                    <p className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 font-bold truncate">
                                        {currentJobName}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setCloseShiftModal(false)} className="text-stone-400 hover:text-stone-600 p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="text-xs text-stone-500 mb-3 bg-stone-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-stone-200 dark:border-zinc-700/60 flex flex-col gap-1.5 shrink-0">
                            <div>Thời gian bắt đầu: <strong>{formatDateTime(shiftSummary.from_time)}</strong></div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-1 border-t border-stone-200 dark:border-zinc-700/50">
                                <label className="font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                    <span>Thời gian chốt CV:</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={closeTimeInput}
                                    onChange={e => setCloseTimeInput(e.target.value)}
                                    className="text-xs font-semibold p-1.5 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-lg text-stone-800 dark:text-stone-200"
                                />
                            </div>
                            <div>Người thực hiện: <strong>{profile?.full_name || 'Nhân viên kho'}</strong></div>
                        </div>

                        <div className="flex-1 overflow-y-auto mb-3 border border-stone-100 dark:border-zinc-800 rounded-xl p-3 bg-stone-50/50 dark:bg-zinc-950/50">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b text-stone-400 uppercase font-semibold">
                                        <th className="pb-1.5">Sản phẩm</th>
                                        <th className="pb-1.5 text-right">Tổng Nhập (+)</th>
                                        <th className="pb-1.5 text-right">Tổng Xuất (-)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                    {Object.values(shiftSummary.products_summary || {}).map((item: any, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2 font-bold text-stone-800 dark:text-stone-200">
                                                {item.product_name} ({item.unit})
                                            </td>
                                            <td className="py-2 text-right text-emerald-600 font-bold">+{item.in_qty}</td>
                                            <td className="py-2 text-right text-rose-600 font-bold">-{item.out_qty}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mb-3 shrink-0">
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Loại phiếu kế toán:
                            </label>
                            <select
                                value={closeOrderTypeId}
                                onChange={e => setCloseOrderTypeId(e.target.value)}
                                className="w-full text-xs p-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-stone-800 dark:text-stone-100"
                            >
                                <option value="">-- Mặc định (hoặc chọn loại phiếu) --</option>
                                {orderTypes.map(ot => (
                                    <option key={ot.id} value={ot.id}>
                                        {ot.code ? `${ot.code} - ` : ''}{ot.name}{ot.scope && ot.scope !== 'both' ? ` (${ot.scope === 'inbound' ? 'Nhập' : 'Xuất'})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-3 shrink-0">
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Ghi chú hoàn thành công việc:
                            </label>
                            <input
                                type="text"
                                value={closeNotes}
                                onChange={e => setCloseNotes(e.target.value)}
                                placeholder="Ghi chú tổng kết sau khi làm xong..."
                                className="w-full text-xs p-3 sm:p-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800 shrink-0">
                            <button
                                onClick={() => setCloseShiftModal(false)}
                                className="h-11 sm:h-9 px-4 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl flex items-center justify-center"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleCloseShift}
                                className="h-11 sm:h-9 px-4 text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow-md flex items-center justify-center"
                            >
                                Xác Nhận Đóng CV
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 9. PANEL LỊCH SỬ CÁC ĐỢT CHỐT TẠM TRONG CÔNG VIỆC NÀY */}
            {showSubShiftsPanel && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 max-h-[85vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
                        <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800 mb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <History className="w-5 h-5 text-indigo-600 shrink-0" />
                                <div>
                                    <h3 className="font-bold text-base text-stone-900 dark:text-white">
                                        Các Đợt Chốt Tạm
                                    </h3>
                                    <p className="text-xs text-stone-500 truncate">{currentJobName}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowSubShiftsPanel(false)} className="text-stone-400 hover:text-stone-600 p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3">
                            {subShifts.length === 0 ? (
                                <p className="text-xs text-stone-400 text-center py-6">Chưa có đợt chốt tạm nào.</p>
                            ) : (
                                subShifts.map((sub, idx) => (
                                    <div
                                        key={sub.id || idx}
                                        className="p-3 bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700/60 rounded-xl text-xs"
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                Đợt {sub.sub_shift_number || idx + 1}
                                            </span>
                                            <span className="text-stone-400 text-[11px]">
                                                {formatDateTime(sub.to_time)}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-stone-500 mb-1">
                                            Chốt bởi: {sub.closed_by_name || 'Nhân viên'}
                                            {sub.notes && ` • Ghi chú: ${sub.notes}`}
                                        </div>

                                        {sub.summary_data?.products_summary && (
                                            <div className="mt-2 pt-2 border-t border-stone-200 dark:border-zinc-700/50 space-y-1">
                                                {Object.values(sub.summary_data.products_summary).map((p: any, pIdx) => (
                                                    <div key={pIdx} className="flex items-center justify-between text-[11px]">
                                                        <span className="text-stone-700 dark:text-stone-300">{p.product_name}:</span>
                                                        <span className="font-semibold text-stone-900 dark:text-white">
                                                            +{p.in_qty} / -{p.out_qty} {p.unit}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-3 border-t border-stone-200 dark:border-zinc-800 text-right shrink-0">
                            <button
                                onClick={() => setShowSubShiftsPanel(false)}
                                className="w-full sm:w-auto h-11 sm:h-9 px-5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 rounded-xl flex items-center justify-center"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
