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
        <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-6">
                        <div className="flex items-center justify-between text-stone-400 font-black text-[10px] uppercase tracking-widest">
                            <div className="flex items-center gap-2">
                                <Info size={14} className="text-orange-500" /> Thông tin cơ bản
                            </div>
                            {!isLocked && (
                                <div className="flex bg-stone-100 dark:bg-zinc-800 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setProductionType('NEW')}
                                        className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${productionType === 'NEW' ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                    >
                                        Sản xuất mới
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProductionType('RE_SORT')}
                                        className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${productionType === 'RE_SORT' ? 'bg-orange-500 text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                    >
                                        Phân loại / Lựa lại
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {!isLocked && (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-500 flex items-center justify-between">
                                        <span>Mã sản xuất</span>
                                        <button type="button" onClick={generateAutoCode} className="text-orange-600 hover:underline flex items-center gap-1 text-[10px]">
                                            <Wand2 size={12} /> Tự tạo
                                        </button>
                                    </label>
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={e => setCode(e.target.value.toUpperCase())}
                                        className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                                        required
                                    />
                                </div>
                            )}
                            <div className={isLocked ? 'md:col-span-1 space-y-2' : 'space-y-2'}>
                                <label className="text-xs font-bold text-stone-500">Đối tác / Khách hàng</label>
                                {isLocked ? (
                                    <div className="px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 font-bold text-sm text-stone-800 dark:text-white border border-stone-100 dark:border-zinc-700">
                                        {customers.find(c => c.id === customerId)?.name || 'Chưa xác định'}
                                    </div>
                                ) : (
                                    <select
                                        value={customerId}
                                        onChange={e => setCustomerId(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all appearance-none"
                                    >
                                        <option value="">-- Chọn khách hàng --</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-bold text-stone-500">Nội dung sản xuất</label>
                                {isLocked ? (
                                    <div className="px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 font-black text-lg text-stone-900 dark:text-white border border-stone-100 dark:border-zinc-700">
                                        {name}
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="VD: Sản xuất đơn hàng tháng 3..."
                                        className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                                        required
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Raw Material Selection - NEW SECTION */}
                    {!isLocked && (
                        <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                    <Scale size={14} className="text-emerald-500" /> Định mức nguyên liệu đầu vào
                                </div>

                                <div className="flex bg-stone-100 dark:bg-zinc-800 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setInputSource('MANUAL')}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${inputSource === 'MANUAL' ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                    >
                                        Tự do
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInputSource('FRESH_MATERIAL')}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${inputSource === 'FRESH_MATERIAL' ? 'bg-emerald-500 text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                    >
                                        <Leaf size={12} /> Từ lô NLT
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {inputSource === 'FRESH_MATERIAL' && (
                                    <>
                                        <div className="space-y-2 relative md:col-span-1 lg:col-span-1">
                                            <label className="text-xs font-bold text-stone-500">Chỉ định Lô NLT</label>
                                            <select
                                                value={fmBatchId || ''}
                                                onChange={e => { setFmBatchId(e.target.value || null); setFmStageId(null); }}
                                                className="w-full px-4 py-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all appearance-none text-emerald-800 dark:text-emerald-400"
                                            >
                                                <option value="">
                                                    {fmBatches.length > 0 ? '-- Chọn lô --' : '-- Không có lô nào đang mở --'}
                                                </option>
                                                {fmBatches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.batch_code} ({b.products?.name})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2 relative md:col-span-1 lg:col-span-1">
                                            <label className="text-xs font-bold text-stone-500 flex items-center justify-between">
                                                <span>Chọn Giai đoạn lấy kết quả</span>
                                                {fmStageId && (
                                                    <button
                                                        type="button"
                                                        onClick={refreshStageData}
                                                        disabled={isRefreshingFm}
                                                        className="text-emerald-600 hover:text-emerald-700 p-1 rounded-lg hover:bg-emerald-50 transition-all flex items-center gap-1 group"
                                                        title="Làm mới số lượng từ NLT"
                                                    >
                                                        <RotateCw size={12} className={`${isRefreshingFm ? 'animate-spin' : 'group-active:rotate-180 transition-transform duration-500'}`} />
                                                        <span className="text-[10px] font-bold">Làm mới</span>
                                                    </button>
                                                )}
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={fmStageId || ''}
                                                    onChange={e => handleStageSelect(e.target.value)}
                                                    disabled={!fmBatchId || isRefreshingFm}
                                                    className="w-full px-4 py-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all appearance-none text-emerald-800 dark:text-emerald-400 disabled:opacity-50"
                                                >
                                                    <option value="">-- Chọn giai đoạn --</option>
                                                    {fmStages.map(s => (
                                                        <option key={s.id} value={s.id}>{s.stage_name}</option>
                                                    ))}
                                                </select>
                                                {isRefreshingFm && (
                                                    <div className="absolute right-10 top-1/2 -translate-y-1/2">
                                                        <Loader2 size={16} className="animate-spin text-emerald-500" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className={`${inputSource === 'FRESH_MATERIAL' ? 'md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-stone-100 dark:border-zinc-800' : 'md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6'} relative`}>
                                    <div className="md:col-span-2 space-y-2 relative">
                                        <label className="text-xs font-bold text-stone-500">Loại nguyên liệu tiêu hao</label>
                                    <div className="relative">
                                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                        <input
                                            type="text"
                                            value={inputSearchTerm}
                                            onChange={(e) => {
                                                setInputSearchTerm(e.target.value)
                                                setIsInputSearchOpen(true)
                                            }}
                                            onFocus={() => setIsInputSearchOpen(true)}
                                            placeholder="Tìm sản phẩm nguyên liệu..."
                                            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all"
                                        />
                                    </div>

                                    {isInputSearchOpen && inputSearchTerm && (
                                        <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-stone-100 dark:border-zinc-700 z-[110] max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
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
                                                        className="w-full text-left px-5 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex flex-col"
                                                    >
                                                        <span className="font-bold text-sm text-stone-800 dark:text-white">{p.name}</span>
                                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{p.sku} • {p.unit}</span>
                                                    </button>
                                                ))}
                                            {products.length === 0 && (
                                                <div className="px-5 py-4 text-center text-xs text-stone-400 font-medium italic">
                                                    Không tìm thấy sản phẩm nào. Vui lòng chọn kho đích trước.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-500">Số lượng ({inputUnit || '---'})</label>
                                    <input
                                        type="number"
                                        value={inputQuantity || ''}
                                        onChange={e => setInputQuantity(parseFloat(e.target.value) || 0)}
                                        className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-black text-lg focus:ring-4 focus:ring-emerald-100 outline-none transition-all"
                                        placeholder="VD: 10000"
                                    />
                                </div>
                            </div>
                        </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-6 h-full">
                        <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                            <Activity size={14} className="text-orange-500" /> Trạng thái & Thời gian
                        </div>
                        <div className="space-y-4">
                            {isLocked ? (
                                <div className={`px-6 py-4 rounded-2xl font-black text-center uppercase tracking-widest text-sm border-2 ${status === 'DONE' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600' : 'bg-orange-500/10 border-orange-500 text-orange-600'}`}>
                                    {status === 'DONE' ? 'Đã hoàn thành' : 'Đang triển khai'}
                                </div>
                            ) : (
                                <div className="flex p-1 bg-stone-100 dark:bg-zinc-800 rounded-2xl">
                                    <button
                                        type="button"
                                        onClick={() => setStatus('IN_PROGRESS')}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${status === 'IN_PROGRESS' ? 'bg-white dark:bg-zinc-700 text-orange-600 shadow-sm' : 'text-stone-400'}`}
                                    >
                                        Đang làm
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatus('DONE')}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${status === 'DONE' ? 'bg-white dark:bg-zinc-700 text-emerald-600 shadow-sm' : 'text-stone-400'}`}
                                    >
                                        Hoàn thành
                                    </button>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-stone-400 uppercase">Bắt đầu</label>
                                    {isLocked ? (
                                        <div className="text-xs font-black text-stone-800 dark:text-white px-1">
                                            {startDate ? new Date(startDate).toLocaleDateString('vi-VN') : '---'}
                                        </div>
                                    ) : (
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-xs font-bold" />
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-stone-400 uppercase">Kết thúc</label>
                                    {isLocked ? (
                                        <div className="text-xs font-black text-stone-800 dark:text-white px-1">
                                            {endDate ? new Date(endDate).toLocaleDateString('vi-VN') : '---'}
                                        </div>
                                    ) : (
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-xs font-bold" />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
