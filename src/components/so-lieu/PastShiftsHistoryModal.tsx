'use client'

import React from 'react'
import { Briefcase, History, X } from 'lucide-react'

interface PastShiftsHistoryModalProps {
    isOpen: boolean
    pastShifts: any[]
    formatDateTime: (dateStr: string | null | undefined) => string
    formatTimeOnly: (dateStr: string | null | undefined) => string
    onClose: () => void
}

export default function PastShiftsHistoryModal({
    isOpen,
    pastShifts,
    formatDateTime,
    formatTimeOnly,
    onClose,
}: PastShiftsHistoryModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 max-h-[85vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
                {/* Thanh handle cho mobile */}
                <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800 mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-indigo-600 shrink-0" />
                        <div>
                            <h3 className="font-bold text-base text-stone-900 dark:text-white">
                                Lịch Sử Các Công Việc Đã Hoàn Thành
                            </h3>
                            <p className="text-xs text-stone-500">Danh sách báo cáo các công việc đã đóng</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3">
                    {pastShifts.length === 0 ? (
                        <p className="text-xs text-stone-400 text-center py-8">Chưa có công việc nào được chốt sổ trước đó.</p>
                    ) : (
                        pastShifts.map((shift, idx) => {
                            const jobTitle = shift.summary_data?.job_name || shift.notes || 'Công việc'
                            const productsSum = shift.summary_data?.products_summary || {}
                            return (
                                <div
                                    key={shift.id || idx}
                                    className="p-3.5 bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700/60 rounded-xl text-xs space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="w-4 h-4 text-indigo-600" />
                                            <span className="font-bold text-sm text-stone-900 dark:text-white">
                                                {jobTitle}
                                            </span>
                                        </div>
                                        <span className="text-[11px] text-stone-400">
                                            Hoàn thành: {formatDateTime(shift.closed_at)}
                                        </span>
                                    </div>

                                    <div className="text-[11px] text-stone-500">
                                        Thời gian: {formatTimeOnly(shift.opened_at)} - {formatTimeOnly(shift.closed_at)} • Người làm: {shift.closed_by_name || 'Nhân viên'}
                                    </div>

                                    {/* Bảng tóm tắt số liệu công việc */}
                                    {Object.keys(productsSum).length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-stone-200 dark:border-zinc-700/50">
                                            <div className="text-[11px] font-semibold text-stone-400 mb-1">Số liệu tổng kết:</div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                {Object.values(productsSum).map((p: any, pIdx) => (
                                                    <div key={pIdx} className="flex items-center justify-between bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-stone-100 dark:border-zinc-800 text-[11px]">
                                                        <span className="font-medium text-stone-700 dark:text-stone-300 truncate mr-2">{p.product_name}</span>
                                                        <span className="font-bold text-stone-900 dark:text-white whitespace-nowrap">
                                                            +{p.in_qty} / -{p.out_qty} {p.unit}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

                <div className="pt-3 border-t border-stone-200 dark:border-zinc-800 text-right shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto h-11 sm:h-9 px-5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 rounded-xl flex items-center justify-center"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}
