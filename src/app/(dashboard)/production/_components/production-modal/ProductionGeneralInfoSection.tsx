'use client'

import React from 'react'
import { Info, Activity, Wand2, Search, Loader2, Scale, Leaf, RotateCw } from 'lucide-react'

interface ProductionGeneralInfoSectionProps {
    isLocked: boolean
    code: string
    setCode: React.Dispatch<React.SetStateAction<string>>
    generateAutoCode: () => void
    name: string
    setName: React.Dispatch<React.SetStateAction<string>>
    productionType: 'NEW' | 'RE_SORT'
    setProductionType: React.Dispatch<React.SetStateAction<'NEW' | 'RE_SORT'>>
    status: string
    setStatus: React.Dispatch<React.SetStateAction<string>>
    customerId: string
    setCustomerId: React.Dispatch<React.SetStateAction<string>>
    customers: any[]
    startDate: string
    setStartDate: React.Dispatch<React.SetStateAction<string>>
    endDate: string
    setEndDate: React.Dispatch<React.SetStateAction<string>>
    inputSource: 'MANUAL' | 'FRESH_MATERIAL'
    setInputSource: React.Dispatch<React.SetStateAction<'MANUAL' | 'FRESH_MATERIAL'>>
    inputSearchTerm: string
    setInputSearchTerm: React.Dispatch<React.SetStateAction<string>>
    isInputSearchOpen: boolean
    setIsInputSearchOpen: React.Dispatch<React.SetStateAction<boolean>>
    products: any[]
    setInputProductId: React.Dispatch<React.SetStateAction<string | null>>
    setInputProductName: React.Dispatch<React.SetStateAction<string>>
    inputQuantity: number
    setInputQuantity: React.Dispatch<React.SetStateAction<number>>
    inputUnit: string
    setInputUnit: React.Dispatch<React.SetStateAction<string>>
    fmStages: any[]
    fmStageId: string | null
    setFmStageId: React.Dispatch<React.SetStateAction<string | null>>
    fmBatches: any[]
    fmBatchId: string | null
    setFmBatchId: React.Dispatch<React.SetStateAction<string | null>>
    isRefreshingFm: boolean
    refreshStageData: () => void
    handleStageSelect: (stageId: string) => void
}

export function ProductionGeneralInfoSection({
    isLocked,
    code,
    setCode,
    generateAutoCode,
    name,
    setName,
    productionType,
    setProductionType,
    status,
    setStatus,
    customerId,
    setCustomerId,
    customers,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    inputSource,
    setInputSource,
    inputSearchTerm,
    setInputSearchTerm,
    isInputSearchOpen,
    setIsInputSearchOpen,
    products,
    setInputProductId,
    setInputProductName,
    inputQuantity,
    setInputQuantity,
    inputUnit,
    setInputUnit,
    fmStages,
    fmStageId,
    setFmStageId,
    fmBatches,
    fmBatchId,
    setFmBatchId,
    isRefreshingFm,
    refreshStageData,
    handleStageSelect,
}: ProductionGeneralInfoSectionProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3.5">
                <div className="p-4 bg-white dark:bg-zinc-800/40 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-stone-500 font-semibold text-[11px] uppercase tracking-wider">
                            <Info size={13} className="text-orange-500" /> Thông tin cơ bản
                        </div>
                        {!isLocked && (
                            <div className="flex bg-stone-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-stone-200/60 dark:border-zinc-700/60">
                                <button
                                    type="button"
                                    onClick={() => setProductionType('NEW')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${productionType === 'NEW' ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-white shadow-xs' : 'text-stone-500 hover:text-stone-700'}`}
                                >
                                    Sản xuất mới
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setProductionType('RE_SORT')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${productionType === 'RE_SORT' ? 'bg-orange-500 text-white shadow-xs' : 'text-stone-500 hover:text-stone-700'}`}
                                >
                                    Phân loại / Lựa lại
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {!isLocked && (
                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-stone-500 flex items-center justify-between">
                                    <span>Mã sản xuất</span>
                                    <button type="button" onClick={generateAutoCode} className="text-orange-600 hover:underline flex items-center gap-1 text-[10px] font-semibold cursor-pointer">
                                        <Wand2 size={11} /> Tự tạo
                                    </button>
                                </label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={e => setCode(e.target.value.toUpperCase())}
                                    className="w-full h-8 px-3 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-semibold font-mono focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all"
                                    required
                                />
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-stone-500">Đối tác / Khách hàng</label>
                            {isLocked ? (
                                <div className="h-8 px-3 rounded-lg bg-stone-50 dark:bg-zinc-800 font-semibold text-xs text-stone-800 dark:text-white border border-stone-200 dark:border-zinc-700 flex items-center">
                                    {customers.find(c => c.id === customerId)?.name || 'Chưa xác định'}
                                </div>
                            ) : (
                                <select
                                    value={customerId}
                                    onChange={e => setCustomerId(e.target.value)}
                                    className="w-full h-8 px-2.5 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-medium focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all"
                                >
                                    <option value="">-- Chọn khách hàng --</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[11px] font-semibold text-stone-500">Nội dung sản xuất</label>
                            {isLocked ? (
                                <div className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-zinc-800 font-bold text-sm text-stone-900 dark:text-white border border-stone-200 dark:border-zinc-700">
                                    {name}
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="VD: Sản xuất đơn hàng tháng 3..."
                                    className="w-full h-8 px-3 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-medium focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all"
                                    required
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Raw Material Selection */}
                {!isLocked && (
                    <div className="p-4 bg-white dark:bg-zinc-800/40 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-xs space-y-3.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-stone-500 font-semibold text-[11px] uppercase tracking-wider">
                                <Scale size={13} className="text-emerald-500" /> Định mức nguyên liệu đầu vào
                            </div>

                            <div className="flex bg-stone-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-stone-200/60 dark:border-zinc-700/60">
                                <button
                                    type="button"
                                    onClick={() => setInputSource('MANUAL')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${inputSource === 'MANUAL' ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-white shadow-xs' : 'text-stone-500 hover:text-stone-700'}`}
                                >
                                    Tự do
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInputSource('FRESH_MATERIAL')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${inputSource === 'FRESH_MATERIAL' ? 'bg-emerald-500 text-white shadow-xs' : 'text-stone-500 hover:text-stone-700'}`}
                                >
                                    <Leaf size={11} /> Từ lô NLT
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {inputSource === 'FRESH_MATERIAL' && (
                                <>
                                    <div className="space-y-1 relative">
                                        <label className="text-[11px] font-semibold text-stone-500">Chỉ định Lô NLT</label>
                                        <select
                                            value={fmBatchId || ''}
                                            onChange={e => { setFmBatchId(e.target.value || null); setFmStageId(null); }}
                                            className="w-full h-8 px-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/70 dark:border-emerald-800/40 text-xs font-semibold focus:ring-2 focus:ring-emerald-100 outline-none text-emerald-800 dark:text-emerald-400"
                                        >
                                            <option value="">
                                                {fmBatches.length > 0 ? '-- Chọn lô --' : '-- Không có lô đang mở --'}
                                            </option>
                                            {fmBatches.map(b => (
                                                <option key={b.id} value={b.id}>{b.batch_code} ({b.products?.name})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1 relative lg:col-span-2">
                                        <label className="text-[11px] font-semibold text-stone-500 flex items-center justify-between">
                                            <span>Chọn Giai đoạn lấy kết quả</span>
                                            {fmStageId && (
                                                <button
                                                    type="button"
                                                    onClick={refreshStageData}
                                                    disabled={isRefreshingFm}
                                                    className="text-emerald-600 hover:text-emerald-700 px-1.5 py-0.5 rounded hover:bg-emerald-50 transition-all flex items-center gap-1 cursor-pointer"
                                                    title="Làm mới số lượng từ NLT"
                                                >
                                                    <RotateCw size={11} className={isRefreshingFm ? 'animate-spin' : ''} />
                                                    <span className="text-[10px] font-semibold">Làm mới</span>
                                                </button>
                                            )}
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={fmStageId || ''}
                                                onChange={e => handleStageSelect(e.target.value)}
                                                disabled={!fmBatchId || isRefreshingFm}
                                                className="w-full h-8 px-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/70 dark:border-emerald-800/40 text-xs font-semibold focus:ring-2 focus:ring-emerald-100 outline-none text-emerald-800 dark:text-emerald-400 disabled:opacity-50"
                                            >
                                                <option value="">-- Chọn giai đoạn --</option>
                                                {fmStages.map(s => (
                                                    <option key={s.id} value={s.id}>{s.stage_name}</option>
                                                ))}
                                            </select>
                                            {isRefreshingFm && (
                                                <div className="absolute right-8 top-1/2 -translate-y-1/2">
                                                    <Loader2 size={13} className="animate-spin text-emerald-500" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className={`${inputSource === 'FRESH_MATERIAL' ? 'md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3 pt-2.5 border-t border-stone-100 dark:border-zinc-800' : 'md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3'} relative`}>
                                <div className="md:col-span-2 space-y-1 relative">
                                    <label className="text-[11px] font-semibold text-stone-500">Loại nguyên liệu tiêu hao</label>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                                        <input
                                            type="text"
                                            value={inputSearchTerm}
                                            onChange={(e) => {
                                                setInputSearchTerm(e.target.value)
                                                setIsInputSearchOpen(true)
                                            }}
                                            onFocus={() => setIsInputSearchOpen(true)}
                                            placeholder="Tìm sản phẩm nguyên liệu..."
                                            className="w-full h-8 pl-8 pr-3 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-medium focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                                        />
                                    </div>

                                    {isInputSearchOpen && inputSearchTerm && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-stone-200 dark:border-zinc-700 z-[110] max-h-52 overflow-y-auto">
                                            {products
                                                .filter(p => p.name.toLowerCase().includes(inputSearchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(inputSearchTerm.toLowerCase()))
                                                .map(p => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setInputProductId(p.id)
                                                            setInputProductName(p.name)
                                                            setInputSearchTerm(p.name)
                                                            setInputUnit(p.unit || 'Kg')
                                                            setIsInputSearchOpen(false)
                                                        }}
                                                        className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex flex-col border-b border-stone-100 dark:border-zinc-700/60 last:border-0"
                                                    >
                                                        <span className="font-semibold text-xs text-stone-800 dark:text-white">{p.name}</span>
                                                        <span className="text-[10px] text-stone-400">{p.sku} • {p.unit}</span>
                                                    </button>
                                                ))}
                                            {products.length === 0 && (
                                                <div className="px-3 py-3 text-center text-xs text-stone-400 italic">
                                                    Không tìm thấy sản phẩm nào. Vui lòng chọn kho đích trước.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-stone-500">Số lượng ({inputUnit || '---'})</label>
                                    <input
                                        type="number"
                                        value={inputQuantity || ''}
                                        onChange={e => setInputQuantity(parseFloat(e.target.value) || 0)}
                                        className="w-full h-8 px-3 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-bold focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                                        placeholder="VD: 10000"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div>
                <div className="p-4 bg-white dark:bg-zinc-800/40 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-xs space-y-3.5 h-full">
                    <div className="flex items-center gap-1.5 text-stone-500 font-semibold text-[11px] uppercase tracking-wider">
                        <Activity size={13} className="text-orange-500" /> Trạng thái & Thời gian
                    </div>
                    <div className="space-y-3">
                        {isLocked ? (
                            <div className={`px-3 py-2 rounded-lg font-bold text-center uppercase tracking-wider text-xs border ${status === 'DONE' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400' : 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400'}`}>
                                {status === 'DONE' ? 'Đã hoàn thành' : 'Đang triển khai'}
                            </div>
                        ) : (
                            <div className="flex p-0.5 bg-stone-100 dark:bg-zinc-800 rounded-lg border border-stone-200/60 dark:border-zinc-700/60">
                                <button
                                    type="button"
                                    onClick={() => setStatus('IN_PROGRESS')}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${status === 'IN_PROGRESS' ? 'bg-white dark:bg-zinc-700 text-orange-600 shadow-xs' : 'text-stone-500'}`}
                                >
                                    Đang làm
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatus('DONE')}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${status === 'DONE' ? 'bg-white dark:bg-zinc-700 text-emerald-600 shadow-xs' : 'text-stone-500'}`}
                                >
                                    Hoàn thành
                                </button>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-stone-500">Bắt đầu</label>
                                {isLocked ? (
                                    <div className="text-xs font-semibold text-stone-800 dark:text-white px-1">
                                        {startDate ? new Date(startDate).toLocaleDateString('vi-VN') : '---'}
                                    </div>
                                ) : (
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-8 px-2 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-medium" />
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-stone-500">Kết thúc</label>
                                {isLocked ? (
                                    <div className="text-xs font-semibold text-stone-800 dark:text-white px-1">
                                        {endDate ? new Date(endDate).toLocaleDateString('vi-VN') : '---'}
                                    </div>
                                ) : (
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full h-8 px-2 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-medium" />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
