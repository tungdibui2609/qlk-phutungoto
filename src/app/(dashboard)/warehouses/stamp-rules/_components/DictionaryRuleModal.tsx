'use client'

import React from 'react'
import { Stamp, RefreshCw, X, Check, Box } from 'lucide-react'
import type { StampRule } from './constants'
import { STAMP_CATEGORIES } from './constants'

interface DictionaryRuleModalProps {
    isRuleModalOpen: boolean
    setIsRuleModalOpen: React.Dispatch<React.SetStateAction<boolean>>
    editingRule: StampRule | null
    formCategory: string
    setFormCategory: React.Dispatch<React.SetStateAction<string>>
    formCode: string
    setFormCode: React.Dispatch<React.SetStateAction<string>>
    formName: string
    setFormName: React.Dispatch<React.SetStateAction<string>>
    formDesc: string
    setFormDesc: React.Dispatch<React.SetStateAction<string>>
    formProductSku: string
    setFormProductSku: React.Dispatch<React.SetStateAction<string>>
    formSortOrder: string
    setFormSortOrder: React.Dispatch<React.SetStateAction<string>>
    warehouseProducts: { id: string; sku: string; name: string }[]
    isSavingRule: boolean
    handleSaveRule: (e: React.FormEvent) => Promise<void>
}

export function DictionaryRuleModal({
    isRuleModalOpen,
    setIsRuleModalOpen,
    editingRule,
    formCategory,
    setFormCategory,
    formCode,
    setFormCode,
    formName,
    setFormName,
    formDesc,
    setFormDesc,
    formProductSku,
    setFormProductSku,
    formSortOrder,
    setFormSortOrder,
    warehouseProducts,
    isSavingRule,
    handleSaveRule,
}: DictionaryRuleModalProps) {
    if (!isRuleModalOpen) return null
    return (
        <>
            {isRuleModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-slate-800 shrink-0">
                            <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                                <Stamp size={18} className="text-purple-600" />
                                {editingRule ? 'Chỉnh Sửa Quy Tắc Dấu Đóng' : 'Thêm Mới Quy Tắc Dấu Đóng'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsRuleModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveRule} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                            {/* Scrollable Form Body */}
                            <div className="overflow-y-auto p-6 space-y-4 flex-1">
                                {/* Chọn Danh mục */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Danh mục phân cấp <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formCategory}
                                        onChange={(e) => setFormCategory(e.target.value)}
                                        disabled={!!editingRule}
                                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        {Object.entries(STAMP_CATEGORIES).map(([key, cat]) => (
                                            <option key={key} value={key}>
                                                [{cat.line === 'line1' ? 'Dòng 1' : 'Dòng 2'}] {cat.label} ({cat.position})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400">
                                        {STAMP_CATEGORIES[formCategory]?.description}
                                    </p>
                                </div>

                                {/* Mã quy ước & Tên giải mã */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Mã số <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formCode}
                                            onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                                            placeholder="vd: 01, 001"
                                            required
                                            className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                        <span className="text-[10px] text-slate-400">
                                            Độ dài: {STAMP_CATEGORIES[formCategory]?.length}
                                        </span>
                                    </div>

                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {formCategory === 'special_12' ? 'Tên sản phẩm' : 'Tên / Diễn giải tiếng Việt'} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            placeholder={formCategory === 'special_12' ? 'vd: TP cấp đông sầu riêng trái Ri-6 loại A - Nito' : 'vd: Cấp đông múi, Monthong...'}
                                            required
                                            className="w-full px-3 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                </div>

                                {/* Mã SKU Sản Phẩm Kho Thành Phẩm (Cho danh mục Quy cách ngoại lệ special_12 hoặc bất kỳ quy tắc nào) */}
                                <div className="space-y-1 p-3 bg-purple-50/70 dark:bg-purple-950/40 rounded-xl border border-purple-200/90 dark:border-purple-800/80">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                                            <Box size={14} className="text-purple-600" />
                                            <span>Mã SKU Sản Phẩm Kho Thành Phẩm (Quy ra khi Duyệt LOT)</span>
                                        </label>
                                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/60 px-1.5 py-0.5 rounded">
                                            ⚡ Khớp 100% trực tiếp
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            list="warehouseProductSkuList"
                                            value={formProductSku}
                                            onChange={(e) => {
                                                const val = e.target.value.trim().toUpperCase()
                                                setFormProductSku(val)
                                                if (!formName.trim() && val) {
                                                    const found = warehouseProducts.find(p => p.sku === val)
                                                    if (found) setFormName(found.name)
                                                }
                                            }}
                                            placeholder="Nhập hoặc chọn mã SKU (vd: TP101020104.001, TP101020104.002...)"
                                            className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 text-purple-900 dark:text-purple-200 outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                                        />
                                        <datalist id="warehouseProductSkuList">
                                            {warehouseProducts.map(p => (
                                                <option key={p.id} value={p.sku}>
                                                    {p.sku} - {p.name}
                                                </option>
                                            ))}
                                        </datalist>
                                    </div>
                                    <p className="text-[10px] text-purple-700/80 dark:text-purple-300/80">
                                        Khi thùng quét mang mã quy cách này, hệ thống sẽ <strong>quy chuẩn thẳng 100% sang mã SKU này</strong> khi Duyệt tạo LOT mới từ Pallet mà không cần so khớp chuỗi.
                                    </p>
                                </div>

                                {/* Mô tả chi tiết */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Mô tả thêm / Tiêu chuẩn áp dụng (Tùy chọn)
                                    </label>
                                    <textarea
                                        value={formDesc}
                                        onChange={(e) => setFormDesc(e.target.value)}
                                        placeholder="Ghi chú thêm về tiêu chuẩn hoặc văn bản quy định..."
                                        rows={2}
                                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                {/* Thứ tự sắp xếp */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Thứ tự hiển thị
                                    </label>
                                    <input
                                        type="number"
                                        value={formSortOrder}
                                        onChange={(e) => setFormSortOrder(e.target.value)}
                                        min="0"
                                        className="w-24 px-3 py-1.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>

                            {/* Buttons Footer (Pinned at bottom) */}
                            <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsRuleModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingRule}
                                    className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {isSavingRule ? (
                                        <>
                                            <RefreshCw size={12} className="animate-spin" />
                                            Đang lưu...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            {editingRule ? 'Lưu cập nhật' : 'Thêm quy tắc'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
