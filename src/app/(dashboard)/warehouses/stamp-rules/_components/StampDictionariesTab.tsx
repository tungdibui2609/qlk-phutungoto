'use client'

import React from 'react'
import Link from 'next/link'
import { Search, Edit, Trash2, RefreshCw, AlertCircle, X, Factory, MapPin, ExternalLink } from 'lucide-react'
import type { StampRule } from './constants'
import { STAMP_CATEGORIES } from './constants'

interface StampDictionariesTabProps {
    mainTab: 'dictionaries' | 'formats'
    rules: StampRule[]
    filteredRules: StampRule[]
    isLoadingRules: boolean
    selectedLine: 'all' | 'line1' | 'line2'
    setSelectedLine: React.Dispatch<React.SetStateAction<'all' | 'line1' | 'line2'>>
    selectedCategory: string
    setSelectedCategory: React.Dispatch<React.SetStateAction<string>>
    searchTerm: string
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>
    handleToggleActiveRule: (rule: StampRule) => Promise<void>
    handleOpenEditRule: (rule: StampRule) => void
    handleDeleteRule: (rule: StampRule) => Promise<void>
}

export function StampDictionariesTab({
    mainTab,
    rules,
    filteredRules,
    isLoadingRules,
    selectedLine,
    setSelectedLine,
    selectedCategory,
    setSelectedCategory,
    searchTerm,
    setSearchTerm,
    handleToggleActiveRule,
    handleOpenEditRule,
    handleDeleteRule,
}: StampDictionariesTabProps) {
    if (mainTab !== 'dictionaries') return null
    return (
        <>
            {mainTab === 'dictionaries' && (
                <div className="space-y-4">
                    {/* Toolbar & Filters */}
                    <div className="space-y-3">
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                            {/* Tabs Lọc theo Dòng 1 / Dòng 2 */}
                            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs shrink-0 self-start">
                                <button
                                    onClick={() => { setSelectedLine('all'); setSelectedCategory('all'); }}
                                    className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                                        selectedLine === 'all'
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Tất cả ({rules.length})
                                </button>
                                <button
                                    onClick={() => { setSelectedLine('line1'); setSelectedCategory('all'); }}
                                    className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                                        selectedLine === 'line1'
                                            ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Dòng 1: Quy cách ({rules.filter(r => STAMP_CATEGORIES[r.category]?.line === 'line1').length})
                                </button>
                                <button
                                    onClick={() => { setSelectedLine('line2'); setSelectedCategory('all'); }}
                                    className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                                        selectedLine === 'line2'
                                            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Dòng 2: Nguồn gốc ({rules.filter(r => STAMP_CATEGORIES[r.category]?.line === 'line2').length})
                                </button>
                            </div>

                            {/* Tìm kiếm */}
                            <div className="relative flex-1 max-w-md">
                                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Tìm theo mã số quy ước, tên giải mã, mô tả..."
                                    className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-200 shadow-2xs"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Sub-pills: Lọc theo từng danh mục cụ thể */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all border cursor-pointer ${
                                    selectedCategory === 'all'
                                        ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900'
                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                }`}
                            >
                                Tất cả danh mục
                            </button>
                            {Object.entries(STAMP_CATEGORIES)
                                .filter(([catKey, cat]) => selectedLine === 'all' || cat.line === selectedLine)
                                .map(([catKey, cat]) => {
                                    const count = rules.filter(r => r.category === catKey).length
                                    const isSelected = selectedCategory === catKey
                                    return (
                                        <button
                                            key={catKey}
                                            onClick={() => setSelectedCategory(catKey)}
                                            className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer ${
                                                isSelected
                                                    ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-purple-300'
                                            }`}
                                        >
                                            <span>{cat.label}</span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-purple-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                {count}
                                            </span>
                                        </button>
                                    )
                                })}
                        </div>
                    </div>

                    {/* Banner liên kết Nơi sản xuất / Nhà máy */}
                    {selectedCategory === 'factory' && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs text-rose-900 dark:text-rose-200 shadow-sm gap-2">
                            <div className="flex items-center gap-2.5">
                                <Factory size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
                                <div>
                                    <span className="font-bold">Đồng bộ hai chiều với Cơ sở sản xuất: </span>
                                    <span>Danh mục Mã nhà máy (Ký tự 1 Dòng 2) đã được liên kết trực tiếp với bảng </span>
                                    <Link href="/production-places" className="font-bold underline hover:text-rose-600 dark:hover:text-rose-300 inline-flex items-center gap-1">
                                        Nơi sản xuất / Nhà máy (/production-places) <ExternalLink size={12} />
                                    </Link>
                                    <span>. Mọi thay đổi ở đây hoặc trang Cơ sở sản xuất sẽ tự động đồng bộ và hiển thị thống nhất trên toàn hệ thống &amp; app mobile.</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Banner liên kết Vùng nguyên liệu (Tỉnh) với /material-zones */}
                    {selectedCategory === 'province' && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl text-xs text-emerald-900 dark:text-emerald-200 shadow-sm gap-2">
                            <div className="flex items-center gap-2.5">
                                <MapPin size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div>
                                    <span className="font-bold">Đồng bộ hai chiều với Vùng trồng / Vùng nguyên liệu: </span>
                                    <span>Danh mục Mã tỉnh dập dấu (Ký tự 15, 16 Dòng 2) đã được liên kết tự động với bảng </span>
                                    <Link href="/material-zones" className="font-bold underline hover:text-emerald-600 dark:hover:text-emerald-300 inline-flex items-center gap-1">
                                        Vùng nguyên liệu (/material-zones) <ExternalLink size={12} />
                                    </Link>
                                    <span>. Khi app mobile quét dấu, mã 2 số này được giải mã thành tên tỉnh và tự động điền vào Lô hàng đồng nhất.</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Table of Rules */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                        {isLoadingRules ? (
                            <div className="flex flex-col items-center justify-center py-20 space-y-3">
                                <RefreshCw className="text-purple-600 animate-spin" size={32} />
                                <p className="text-xs font-semibold text-slate-500">Đang tải danh mục quy tắc...</p>
                            </div>
                        ) : filteredRules.length === 0 ? (
                            <div className="text-center py-16 px-4 space-y-3">
                                <AlertCircle className="text-slate-300 dark:text-slate-700 mx-auto" size={40} />
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Không tìm thấy quy tắc nào</h4>
                                <p className="text-xs text-slate-400">Không có quy tắc nào khớp với bộ lọc hoặc từ khóa tìm kiếm.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                            <th className="px-4 py-3.5">Danh mục phân cấp</th>
                                            <th className="px-4 py-3.5">Vị trí ký tự</th>
                                            <th className="px-4 py-3.5 text-center">Ký hiệu / Mã</th>
                                            <th className="px-4 py-3.5">{selectedCategory === 'special_12' ? 'Tên sản phẩm' : 'Diễn giải tiếng Việt'}</th>
                                            <th className="px-4 py-3.5">Mã SKU Kho (Duyệt LOT)</th>
                                            <th className="px-4 py-3.5">Mô tả chi tiết</th>
                                            <th className="px-4 py-3.5 text-center">Trạng thái</th>
                                            <th className="px-4 py-3.5 text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150/70 dark:divide-slate-800/70">
                                        {filteredRules.map((rule) => {
                                            const catInfo = STAMP_CATEGORIES[rule.category]
                                            return (
                                                <tr 
                                                    key={rule.id}
                                                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                                                >
                                                    {/* Danh mục */}
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${catInfo?.colorBadge || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                            {catInfo?.label || rule.category}
                                                        </span>
                                                    </td>

                                                    {/* Vị trí */}
                                                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                        {catInfo ? (
                                                            <span>
                                                                <strong className="text-slate-700 dark:text-slate-300">{catInfo.line === 'line1' ? 'Dòng 1' : 'Dòng 2'}</strong> • {catInfo.position}
                                                            </span>
                                                        ) : '---'}
                                                    </td>

                                                    {/* Ký hiệu / Mã */}
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-2xs">
                                                            {rule.code}
                                                        </span>
                                                    </td>

                                                    {/* Tên giải mã */}
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                                            {rule.name}
                                                        </div>
                                                    </td>

                                                    {/* Mã SKU Kho thành phẩm */}
                                                    <td className="px-4 py-3">
                                                        {rule.product_sku ? (
                                                            <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 shadow-2xs">
                                                                {rule.product_sku}
                                                            </span>
                                                        ) : rule.category === 'special_12' ? (
                                                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-800/60 italic">
                                                                Chưa gán SKU
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-600 text-xs">---</span>
                                                        )}
                                                    </td>

                                                    {/* Mô tả */}
                                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                                        {rule.description || '---'}
                                                    </td>

                                                    {/* Trạng thái */}
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleToggleActiveRule(rule)}
                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                                                                rule.is_active
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                                            }`}
                                                        >
                                                            {rule.is_active ? 'Kích hoạt' : 'Tạm ẩn'}
                                                        </button>
                                                    </td>

                                                    {/* Thao tác */}
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                                                            <button
                                                                onClick={() => handleOpenEditRule(rule)}
                                                                className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg transition-colors cursor-pointer"
                                                                title="Chỉnh sửa"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteRule(rule)}
                                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                                title="Xóa"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
