'use client'

import React from 'react'
import { Calendar, CalendarClock, X, Plus } from 'lucide-react'
import { LotSectionHeader } from './shared'

interface LotDatesSectionProps {
    hasAnyDateModule: boolean
    dateModulesCount: number
    hasRawDate: boolean
    hasPeelingDate: boolean
    hasPackagingDate: boolean
    hasInboundDate: boolean
    rawMaterialDates: string[]
    newRawMaterialDateInput: string
    setNewRawMaterialDateInput: React.Dispatch<React.SetStateAction<string>>
    setRawMaterialDate: React.Dispatch<React.SetStateAction<string>>
    setRawMaterialDates: React.Dispatch<React.SetStateAction<string[]>>
    handleAddRawMaterialDate: () => void
    handleRemoveRawMaterialDate: (dateToRemove: string) => void
    peelingDates: string[]
    newPeelingDateInput: string
    setNewPeelingDateInput: React.Dispatch<React.SetStateAction<string>>
    setPeelingDate: React.Dispatch<React.SetStateAction<string>>
    setPeelingDates: React.Dispatch<React.SetStateAction<string[]>>
    handleAddPeelingDate: () => void
    handleRemovePeelingDate: (dateToRemove: string) => void
    packagingDates: string[]
    newPackagingDateInput: string
    setNewPackagingDateInput: React.Dispatch<React.SetStateAction<string>>
    setPackagingDate: React.Dispatch<React.SetStateAction<string>>
    setPackagingDates: React.Dispatch<React.SetStateAction<string[]>>
    handleAddPackagingDate: () => void
    handleRemovePackagingDate: (dateToRemove: string) => void
    inboundDate: string
    setInboundDate: React.Dispatch<React.SetStateAction<string>>
}

export function LotDatesSection({
    hasAnyDateModule,
    dateModulesCount,
    hasRawDate,
    hasPeelingDate,
    hasPackagingDate,
    hasInboundDate,
    rawMaterialDates,
    newRawMaterialDateInput,
    setNewRawMaterialDateInput,
    setRawMaterialDate,
    setRawMaterialDates,
    handleAddRawMaterialDate,
    handleRemoveRawMaterialDate,
    peelingDates,
    newPeelingDateInput,
    setNewPeelingDateInput,
    setPeelingDate,
    setPeelingDates,
    handleAddPeelingDate,
    handleRemovePeelingDate,
    packagingDates,
    newPackagingDateInput,
    setNewPackagingDateInput,
    setPackagingDate,
    setPackagingDates,
    handleAddPackagingDate,
    handleRemovePackagingDate,
    inboundDate,
    setInboundDate,
}: LotDatesSectionProps) {
    return (
        <>
            {hasAnyDateModule && (
                <div className="p-4 bg-slate-50/70 dark:bg-zinc-800/30 rounded-2xl border border-slate-200/70 dark:border-zinc-700/60">
                    <LotSectionHeader icon={CalendarClock} tone="amber" title="Tiến trình & Mốc thời gian" />

                    <div className={`grid gap-4 ${
                        dateModulesCount === 1 ? 'grid-cols-1 md:max-w-md' :
                        dateModulesCount === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                        dateModulesCount === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                    }`}>
                        {/* Ngày nhập nguyên liệu */}
                        {hasRawDate && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                            <Calendar size={13} className="text-emerald-500" />
                                            Ngày nhập nguyên liệu
                                        </label>
                                        {rawMaterialDates.length > 0 && (
                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                                {rawMaterialDates.length} ngày
                                            </span>
                                        )}
                                    </div>
                                    {rawMaterialDates.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRawMaterialDates([])
                                                setRawMaterialDate('')
                                            }}
                                            className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                            title="Xóa tất cả ngày nhập nguyên liệu (để trống)"
                                        >
                                            Xóa ngày
                                        </button>
                                    )}
                                </div>

                                {/* Danh sách các ngày nhập nguyên liệu đã thêm */}
                                {rawMaterialDates.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 max-h-24 overflow-y-auto">
                                        {rawMaterialDates.map((dStr) => (
                                            <div
                                                key={dStr}
                                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-xs"
                                            >
                                                <Calendar size={12} className="text-emerald-500 shrink-0" />
                                                <span>{new Date(dStr).toLocaleDateString('vi-VN')}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRawMaterialDate(dStr)}
                                                    className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                                    title={`Xóa ngày ${new Date(dStr).toLocaleDateString('vi-VN')}`}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Ô chọn và nút thêm ngày nhập nguyên liệu */}
                                <div className="flex items-center gap-1.5">
                                    <div className="relative flex-1">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                        <input
                                            type="date"
                                            value={newRawMaterialDateInput}
                                            onChange={(e) => setNewRawMaterialDateInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    handleAddRawMaterialDate()
                                                }
                                            }}
                                            className="w-full pl-9 pr-2 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-zinc-900 dark:text-zinc-100 text-xs transition-all"
                                            style={{ colorScheme: 'light dark' }}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleAddRawMaterialDate()}
                                        disabled={!newRawMaterialDateInput}
                                        className="px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer"
                                        title="Thêm ngày nhập nguyên liệu"
                                    >
                                        <Plus size={14} />
                                        <span>Thêm</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Ngày sản xuất */}
                        {hasPeelingDate && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                            <Calendar size={13} className="text-orange-500" />
                                            Ngày sản xuất
                                        </label>
                                        {peelingDates.length > 0 && (
                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                                                {peelingDates.length} ngày
                                            </span>
                                        )}
                                    </div>
                                    {peelingDates.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPeelingDates([])
                                                setPeelingDate('')
                                            }}
                                            className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                            title="Xóa tất cả ngày sản xuất"
                                        >
                                            Xóa ngày
                                        </button>
                                    )}
                                </div>

                                {/* Danh sách các ngày sản xuất đã thêm */}
                                {peelingDates.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 max-h-24 overflow-y-auto">
                                        {peelingDates.map((dStr) => (
                                            <div
                                                key={dStr}
                                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-zinc-800 border border-orange-200 dark:border-orange-800/60 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-xs"
                                            >
                                                <Calendar size={12} className="text-orange-500 shrink-0" />
                                                <span>{new Date(dStr).toLocaleDateString('vi-VN')}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePeelingDate(dStr)}
                                                    className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                                    title={`Xóa ngày ${new Date(dStr).toLocaleDateString('vi-VN')}`}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Ô chọn và nút thêm ngày sản xuất */}
                                <div className="flex items-center gap-1.5">
                                    <div className="relative flex-1">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                        <input
                                            type="date"
                                            value={newPeelingDateInput}
                                            onChange={(e) => setNewPeelingDateInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    handleAddPeelingDate()
                                                }
                                            }}
                                            className="w-full pl-9 pr-2 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-zinc-900 dark:text-zinc-100 text-xs transition-all"
                                            style={{ colorScheme: 'light dark' }}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleAddPeelingDate()}
                                        disabled={!newPeelingDateInput}
                                        className="px-2.5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer"
                                        title="Thêm ngày sản xuất"
                                    >
                                        <Plus size={14} />
                                        <span>Thêm</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Ngày đóng bao bì */}
                        {hasPackagingDate && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                            <Calendar size={13} className="text-blue-500" />
                                            Ngày đóng bao bì
                                        </label>
                                        {packagingDates.length > 0 && (
                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                                {packagingDates.length} ngày
                                            </span>
                                        )}
                                    </div>
                                    {packagingDates.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPackagingDates([])
                                                setPackagingDate('')
                                            }}
                                            className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                            title="Xóa tất cả ngày đóng bao bì (để trống)"
                                        >
                                            Xóa ngày
                                        </button>
                                    )}
                                </div>

                                {/* Danh sách các ngày đóng bao bì đã thêm */}
                                {packagingDates.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 max-h-24 overflow-y-auto">
                                        {packagingDates.map((dStr) => (
                                            <div
                                                key={dStr}
                                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-xs"
                                            >
                                                <Calendar size={12} className="text-blue-500 shrink-0" />
                                                <span>{new Date(dStr).toLocaleDateString('vi-VN')}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePackagingDate(dStr)}
                                                    className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                                    title={`Xóa ngày ${new Date(dStr).toLocaleDateString('vi-VN')}`}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Ô chọn và nút thêm ngày đóng bao bì */}
                                <div className="flex items-center gap-1.5">
                                    <div className="relative flex-1">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                        <input
                                            type="date"
                                            value={newPackagingDateInput}
                                            onChange={(e) => setNewPackagingDateInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    handleAddPackagingDate()
                                                }
                                            }}
                                            className="w-full pl-9 pr-2 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-zinc-100 text-xs transition-all"
                                            style={{ colorScheme: 'light dark' }}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleAddPackagingDate()}
                                        disabled={!newPackagingDateInput}
                                        className="px-2.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer"
                                        title="Thêm ngày đóng bao bì"
                                    >
                                        <Plus size={14} />
                                        <span>Thêm</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Ngày nhập kho */}
                        {hasInboundDate && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                        <Calendar size={13} className="text-amber-500" />
                                        Ngày nhập kho
                                    </label>
                                    {inboundDate && (
                                        <button
                                            type="button"
                                            onClick={() => setInboundDate('')}
                                            className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                            title="Xóa ngày nhập kho (để trống)"
                                        >
                                            Xóa ngày
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
                                    <input
                                        type="date"
                                        value={inboundDate}
                                        onChange={(e) => setInboundDate(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-zinc-900 dark:text-zinc-100 text-sm transition-all"
                                        style={{ colorScheme: 'light dark' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
