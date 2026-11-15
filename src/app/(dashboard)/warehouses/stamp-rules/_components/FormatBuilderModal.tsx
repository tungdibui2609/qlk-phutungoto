'use client'

import React from 'react'
import { Plus, Trash2, RefreshCw, SlidersHorizontal, X, Check, Settings, ListOrdered, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react'
import type { StampFieldConfig, StampLineConfig, StampFormat } from './constants'
import { COLOR_THEMES, STAMP_CATEGORIES } from './constants'

interface FormatBuilderModalProps {
    isFormatModalOpen: boolean
    setIsFormatModalOpen: React.Dispatch<React.SetStateAction<boolean>>
    editingFormat: StampFormat | null
    isFormatModalFullscreen: boolean
    setIsFormatModalFullscreen: React.Dispatch<React.SetStateAction<boolean>>
    formatSubTab: 'general' | 'line1' | 'line2'
    setFormatSubTab: React.Dispatch<React.SetStateAction<'general' | 'line1' | 'line2'>>
    formFmtCode: string
    setFormFmtCode: React.Dispatch<React.SetStateAction<string>>
    formFmtName: string
    setFormFmtName: React.Dispatch<React.SetStateAction<string>>
    formFmtDesc: string
    setFormFmtDesc: React.Dispatch<React.SetStateAction<string>>
    formFmtIsDefault: boolean
    setFormFmtIsDefault: React.Dispatch<React.SetStateAction<boolean>>
    formLine1Config: StampLineConfig
    setFormLine1Config: React.Dispatch<React.SetStateAction<StampLineConfig>>
    formLine2Config: StampLineConfig
    setFormLine2Config: React.Dispatch<React.SetStateAction<StampLineConfig>>
    expandedFields: Record<string, boolean>
    toggleFieldExpand: (line: 'line1' | 'line2', idx: number) => void
    toggleAllFields: (line: 'line1' | 'line2', count: number) => void
    handleAddField: (targetLine: 'line1' | 'line2') => void
    handleUpdateField: (targetLine: 'line1' | 'line2', index: number, updates: Partial<StampFieldConfig>) => void
    handleRemoveField: (targetLine: 'line1' | 'line2', index: number) => void
    handleAutoAlignFields: (targetLine: 'line1' | 'line2') => void
    renderVisualTape: (config: StampLineConfig, lineType: 'line1' | 'line2') => React.ReactNode
    isSavingFormat: boolean
    handleSaveFormat: (e: React.FormEvent) => Promise<void>
}

export function FormatBuilderModal({
    isFormatModalOpen,
    setIsFormatModalOpen,
    editingFormat,
    isFormatModalFullscreen,
    setIsFormatModalFullscreen,
    formatSubTab,
    setFormatSubTab,
    formFmtCode,
    setFormFmtCode,
    formFmtName,
    setFormFmtName,
    formFmtDesc,
    setFormFmtDesc,
    formFmtIsDefault,
    setFormFmtIsDefault,
    formLine1Config,
    setFormLine1Config,
    formLine2Config,
    setFormLine2Config,
    expandedFields,
    toggleFieldExpand,
    toggleAllFields,
    handleAddField,
    handleUpdateField,
    handleRemoveField,
    handleAutoAlignFields,
    renderVisualTape,
    isSavingFormat,
    handleSaveFormat,
}: FormatBuilderModalProps) {
    if (!isFormatModalOpen) return null
    return (
        <>
            {isFormatModalOpen && (
                <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-150 ${isFormatModalFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}>
                    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden transition-all ${
                        isFormatModalFullscreen 
                            ? 'w-full h-full rounded-none' 
                            : 'w-full max-w-7xl h-[94vh] max-h-[94vh] rounded-3xl'
                    }`}>
                        {/* Header Modal */}
                        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-150 dark:border-slate-800 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                                    <SlidersHorizontal size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                                        {editingFormat ? 'Chỉnh Sửa Khuôn Định Dạng Dấu Đóng' : 'Tạo Mới Khuôn Định Dạng Dấu Đóng'}
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                                        Bảng thiết kế trực quan chia 2 cột: Live Inspector xem trước bên trái & tùy chỉnh trường bên phải
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setIsFormatModalFullscreen(!isFormatModalFullscreen)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    title={isFormatModalFullscreen ? "Thu nhỏ cửa sổ" : "Phóng to toàn màn hình"}
                                >
                                    {isFormatModalFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                </button>
                                <button
                                    onClick={() => setIsFormatModalOpen(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Subtabs in modal: Cấu hình chung vs Dòng 1 vs Dòng 2 */}
                        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
                            <button
                                type="button"
                                onClick={() => setFormatSubTab('line1')}
                                className={`px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
                                    formatSubTab === 'line1'
                                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                }`}
                            >
                                Cấu trúc Dòng 1 ({formLine1Config.fields.length} trường)
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormatSubTab('line2')}
                                className={`px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
                                    formatSubTab === 'line2'
                                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                }`}
                            >
                                Cấu trúc Dòng 2 ({formLine2Config.fields.length} trường)
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormatSubTab('general')}
                                className={`px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
                                    formatSubTab === 'general'
                                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                }`}
                            >
                                Thông tin chung
                            </button>
                        </div>

                        {/* Body Modal */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {/* TAB: CẤU HÌNH DÒNG 1 */}
                            {formatSubTab === 'line1' && (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                                    {/* CỘT TRÁI: Dải băng quan sát trực quan & Cài đặt chung Dòng 1 (Rộng 5/12 để hiển thị trọn vẹn, không cuộn ngang) */}
                                    <div className="lg:col-span-5 xl:col-span-5 space-y-3 lg:sticky lg:top-0">
                                        {renderVisualTape(formLine1Config, 'line1')}

                                        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 space-y-2.5 shadow-xs">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                                    <Settings size={13} />
                                                    Cài đặt quy cách Dòng 1
                                                </h5>
                                                <span className="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900">
                                                    Tổng {formLine1Config.total_length} ký tự
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="space-y-0.5">
                                                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Tên định danh dòng</label>
                                                    <input
                                                        type="text"
                                                        value={formLine1Config.title}
                                                        onChange={(e) => setFormLine1Config({ ...formLine1Config, title: e.target.value })}
                                                        className="w-full px-2.5 py-1 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-0.5">
                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Tổng độ dài (kt)</label>
                                                        <input
                                                            type="number"
                                                            value={formLine1Config.total_length}
                                                            onChange={(e) => setFormLine1Config({ ...formLine1Config, total_length: parseInt(e.target.value, 10) || 0 })}
                                                            className="w-full px-2.5 py-1 rounded-xl text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                                            <span>Dấu ngăn cách</span>
                                                            <span className="text-[9px] text-slate-400 font-normal">(-)</span>
                                                        </label>
                                                        <div className="flex items-center gap-1.5 pt-0.5">
                                                            <input
                                                                type="checkbox"
                                                                id="chk_has_delim"
                                                                checked={!!formLine1Config.has_delimiter}
                                                                onChange={(e) => setFormLine1Config({ ...formLine1Config, has_delimiter: e.target.checked })}
                                                                className="rounded text-indigo-600 cursor-pointer"
                                                            />
                                                            <label htmlFor="chk_has_delim" className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap cursor-pointer">Bật</label>
                                                            <input
                                                                type="text"
                                                                value={formLine1Config.delimiter_char || '-'}
                                                                onChange={(e) => setFormLine1Config({ ...formLine1Config, delimiter_char: e.target.value })}
                                                                className="w-9 px-1.5 py-0.5 text-center font-mono font-black rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 text-xs shadow-xs"
                                                                maxLength={1}
                                                                title="Ký tự dấu ngăn cách (mặc định là dấu -)"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CỘT PHẢI: Danh sách các phân đoạn mã để chỉnh sửa (7/12) */}
                                    <div className="lg:col-span-7 xl:col-span-7 space-y-3">
                                        <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                                            <div>
                                                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                                    Danh sách các phân đoạn mã ({formLine1Config.fields.length} trường)
                                                </h4>
                                                <p className="text-[11px] text-slate-400">
                                                    Bấm vào từng trường để mở rộng / thu gọn chi tiết cài đặt
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAllFields('line1', formLine1Config.fields.length)}
                                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                                                >
                                                    {formLine1Config.fields.some((_, i) => expandedFields[`line1_${i}`]) ? (
                                                        <>
                                                            <ChevronUp size={13} />
                                                            Thu gọn tất cả
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown size={13} />
                                                            Mở rộng tất cả
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAutoAlignFields('line1')}
                                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                                                    title="Tự động tính toán lại start = vị trí liền kề của trường trước"
                                                >
                                                    <ListOrdered size={13} />
                                                    Nối tiếp vị trí
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddField('line1')}
                                                    className="px-3 py-1 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-1 cursor-pointer shadow-xs"
                                                >
                                                    <Plus size={13} /> Thêm trường
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {formLine1Config.fields.map((field, idx) => {
                                                const isExpanded = !!expandedFields[`line1_${idx}`]
                                                const theme = COLOR_THEMES[field.color] || COLOR_THEMES.purple
                                                return (
                                                    <div 
                                                        id={`field-card-line1-${idx}`}
                                                        key={idx}
                                                        className={`rounded-2xl border transition-all ${
                                                            isExpanded 
                                                                ? 'bg-white dark:bg-slate-800 border-indigo-400 dark:border-indigo-600 shadow-sm ring-1 ring-indigo-500/20' 
                                                                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                                                        }`}
                                                    >
                                                        {/* Thanh tóm tắt gọn gàng - Click để sổ ra / đóng lại */}
                                                        <div 
                                                            onClick={() => toggleFieldExpand('line1', idx)}
                                                            className="flex items-center justify-between p-3 cursor-pointer select-none gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors rounded-2xl"
                                                        >
                                                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-mono text-[11px] font-black text-slate-700 dark:text-slate-300 shrink-0">
                                                                    {idx + 1}
                                                                </span>

                                                                {/* Badge màu trực quan */}
                                                                <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 shrink-0 ${theme.cardBadge}`}>
                                                                    <span>{field.shortName || field.name}</span>
                                                                    <span className={`font-mono text-[10px] font-black px-1.5 py-0.2 rounded-md ${theme.cardPill}`}>
                                                                        {field.length}kt
                                                                    </span>
                                                                </span>

                                                                {/* Tên trường & vị trí */}
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                                                        {field.name}
                                                                    </span>
                                                                    <span className="hidden sm:inline-block text-[11px] text-slate-400 font-mono font-medium whitespace-nowrap">
                                                                        (kt: {field.start}..{field.start + field.length - 1})
                                                                    </span>
                                                                    {field.afterDelimiter && (
                                                                        <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                                                            Sau dấu {formLine1Config.delimiter_char || '-'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Nút thao tác nhanh & mũi tên sổ xuống */}
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="hidden md:inline-flex text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                    {(field.dictCategory ? STAMP_CATEGORIES[field.dictCategory]?.label : undefined) || field.dictCategory || 'Từ điển'}
                                                                </span>

                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleRemoveField('line1', idx); }}
                                                                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                                                                    title="Xóa trường này"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); toggleFieldExpand('line1', idx); }}
                                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                                                                >
                                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Khung chi tiết cài đặt - Chỉ mở ra khi bấm vào */}
                                                        {isExpanded && (
                                                            <div className="p-4 border-t border-slate-150 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40 space-y-3.5 animate-in fade-in duration-150 rounded-b-2xl">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tên trường đầy đủ</label>
                                                                        <input
                                                                            type="text"
                                                                            value={field.name}
                                                                            onChange={(e) => handleUpdateField('line1', idx, { name: e.target.value })}
                                                                            className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                            placeholder="vd: Chủng loại trái cây"
                                                                        />
                                                                    </div>

                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tên ngắn gọn (Nhãn thẻ)</label>
                                                                        <input
                                                                            type="text"
                                                                            value={field.shortName}
                                                                            onChange={(e) => handleUpdateField('line1', idx, { shortName: e.target.value })}
                                                                            className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                            placeholder="vd: Chủng loại"
                                                                        />
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div className="space-y-1">
                                                                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Vị trí (start)</label>
                                                                            <input
                                                                                type="number"
                                                                                value={field.start}
                                                                                onChange={(e) => handleUpdateField('line1', idx, { start: parseInt(e.target.value, 10) || 0 })}
                                                                                className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                                min={0}
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Độ dài (len)</label>
                                                                            <input
                                                                                type="number"
                                                                                value={field.length}
                                                                                onChange={(e) => handleUpdateField('line1', idx, { length: parseInt(e.target.value, 10) || 1 })}
                                                                                className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                                min={1}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Từ điển liên kết</label>
                                                                        <select
                                                                            value={field.dictCategory || 'fruit_type'}
                                                                            onChange={(e) => handleUpdateField('line1', idx, { dictCategory: e.target.value, type: 'dictionary' })}
                                                                            className="w-full px-3 py-1.5 text-xs font-medium rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                        >
                                                                            {Object.entries(STAMP_CATEGORIES).map(([catK, catV]) => (
                                                                                <option key={catK} value={catK}>{catV.label}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                                                    {/* Chọn màu sắc thẻ */}
                                                                    <div className="flex items-center gap-2">
                                                                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Màu sắc thẻ:</label>
                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            {Object.entries(COLOR_THEMES).map(([cKey, cVal]) => (
                                                                                <button
                                                                                    key={cKey}
                                                                                    type="button"
                                                                                    onClick={() => handleUpdateField('line1', idx, { color: cKey })}
                                                                                    className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${field.color === cKey ? 'scale-125 ring-2 ring-indigo-500 ring-offset-1' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                                                                                    style={{ backgroundColor: cVal.hexPreview, borderColor: cVal.hexPreview }}
                                                                                    title={cVal.label}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Tùy chọn Nằm sau dấu ngăn cách */}
                                                                    {formLine1Config.has_delimiter && (
                                                                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-900/50">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!field.afterDelimiter}
                                                                                onChange={(e) => handleUpdateField('line1', idx, { afterDelimiter: e.target.checked })}
                                                                                className="rounded text-amber-600 cursor-pointer"
                                                                            />
                                                                            <span className="text-[11px] text-amber-800 dark:text-amber-300">
                                                                                Nằm sau dấu ({formLine1Config.delimiter_char || '-'})
                                                                            </span>
                                                                        </label>
                                                                    )}

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleFieldExpand('line1', idx)}
                                                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 self-end sm:self-auto cursor-pointer"
                                                                    >
                                                                        <span>Thu gọn</span>
                                                                        <ChevronUp size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: CẤU HÌNH DÒNG 2 */}
                            {formatSubTab === 'line2' && (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                                    {/* CỘT TRÁI: Dải băng quan sát trực quan & Cài đặt chung Dòng 2 (Rộng 5/12 để hiển thị trọn vẹn, không cuộn ngang) */}
                                    <div className="lg:col-span-5 xl:col-span-5 space-y-3 lg:sticky lg:top-0">
                                        {renderVisualTape(formLine2Config, 'line2')}

                                        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 space-y-2.5 shadow-xs">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                                    <Settings size={13} />
                                                    Cài đặt quy cách Dòng 2
                                                </h5>
                                                <span className="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900">
                                                    Tổng {formLine2Config.total_length} chữ số
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="space-y-0.5">
                                                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Tên định danh dòng</label>
                                                    <input
                                                        type="text"
                                                        value={formLine2Config.title}
                                                        onChange={(e) => setFormLine2Config({ ...formLine2Config, title: e.target.value })}
                                                        className="w-full px-2.5 py-1 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-0.5">
                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Tổng độ dài (kt)</label>
                                                        <input
                                                            type="number"
                                                            value={formLine2Config.total_length}
                                                            onChange={(e) => setFormLine2Config({ ...formLine2Config, total_length: parseInt(e.target.value, 10) || 0 })}
                                                            className="w-full px-2.5 py-1 rounded-xl text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                                            <span>Dấu ngăn cách</span>
                                                            <span className="text-[9px] text-slate-400 font-normal">(-)</span>
                                                        </label>
                                                        <div className="flex items-center gap-1.5 pt-0.5">
                                                            <input
                                                                type="checkbox"
                                                                id="chk_has_delim_line2"
                                                                checked={!!formLine2Config.has_delimiter}
                                                                onChange={(e) => setFormLine2Config({ ...formLine2Config, has_delimiter: e.target.checked })}
                                                                className="rounded text-indigo-600 cursor-pointer"
                                                            />
                                                            <label htmlFor="chk_has_delim_line2" className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap cursor-pointer">Bật</label>
                                                            <input
                                                                type="text"
                                                                value={formLine2Config.delimiter_char || '-'}
                                                                onChange={(e) => setFormLine2Config({ ...formLine2Config, delimiter_char: e.target.value })}
                                                                className="w-9 px-1.5 py-0.5 text-center font-mono font-black rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 text-xs shadow-xs"
                                                                maxLength={1}
                                                                title="Ký tự dấu ngăn cách (mặc định là dấu -)"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CỘT PHẢI: Danh sách các phân đoạn mã Dòng 2 để chỉnh sửa (7/12) */}
                                    <div className="lg:col-span-7 xl:col-span-7 space-y-3">
                                        <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                                            <div>
                                                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                                    Danh sách các phân đoạn mã Dòng 2 ({formLine2Config.fields.length} trường)
                                                </h4>
                                                <p className="text-[11px] text-slate-400">
                                                    Bấm vào từng trường để mở rộng / thu gọn chi tiết cài đặt
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAllFields('line2', formLine2Config.fields.length)}
                                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                                                >
                                                    {formLine2Config.fields.some((_, i) => expandedFields[`line2_${i}`]) ? (
                                                        <>
                                                            <ChevronUp size={13} />
                                                            Thu gọn tất cả
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown size={13} />
                                                            Mở rộng tất cả
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAutoAlignFields('line2')}
                                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                                                    title="Tự động tính toán lại start = vị trí liền kề của trường trước"
                                                >
                                                    <ListOrdered size={13} />
                                                    Nối tiếp vị trí
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddField('line2')}
                                                    className="px-3 py-1 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-1 cursor-pointer shadow-xs"
                                                >
                                                    <Plus size={13} /> Thêm trường
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {formLine2Config.fields.map((field, idx) => {
                                                const isExpanded = !!expandedFields[`line2_${idx}`]
                                                const theme = COLOR_THEMES[field.color] || COLOR_THEMES.blue
                                                const typeLabel = 
                                                    field.type === 'supplier' ? 'Nhà cung cấp (NCC)' :
                                                    field.type === 'date_ddmm' ? 'Ngày (DD/MM)' :
                                                    field.type === 'date_ddmmyy' ? 'Ngày (DD/MM/YY)' :
                                                    field.type === 'raw' ? 'Văn bản thô' : 'Từ điển'

                                                return (
                                                    <div 
                                                        id={`field-card-line2-${idx}`}
                                                        key={idx}
                                                        className={`rounded-2xl border transition-all ${
                                                            isExpanded 
                                                                ? 'bg-white dark:bg-slate-800 border-indigo-400 dark:border-indigo-600 shadow-sm ring-1 ring-indigo-500/20' 
                                                                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                                                        }`}
                                                    >
                                                        {/* Thanh tóm tắt gọn gàng - Click để sổ ra / đóng lại */}
                                                        <div 
                                                            onClick={() => toggleFieldExpand('line2', idx)}
                                                            className="flex items-center justify-between p-3 cursor-pointer select-none gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors rounded-2xl"
                                                        >
                                                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-mono text-[11px] font-black text-slate-700 dark:text-slate-300 shrink-0">
                                                                    {idx + 1}
                                                                </span>

                                                                {/* Badge màu trực quan */}
                                                                <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 shrink-0 ${theme.cardBadge}`}>
                                                                    <span>{field.shortName || field.name}</span>
                                                                    <span className={`font-mono text-[10px] font-black px-1.5 py-0.2 rounded-md ${theme.cardPill}`}>
                                                                        {field.length}kt
                                                                    </span>
                                                                </span>

                                                                {/* Tên trường & vị trí */}
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                                                        {field.name}
                                                                    </span>
                                                                    <span className="hidden sm:inline-block text-[11px] text-slate-400 font-mono font-medium whitespace-nowrap">
                                                                        (kt: {field.start}..{field.start + field.length - 1})
                                                                    </span>
                                                                    {field.afterDelimiter && (
                                                                        <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                                                            Sau dấu {formLine2Config.delimiter_char || '-'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Nút thao tác nhanh & mũi tên sổ xuống */}
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="hidden md:inline-flex text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                    {typeLabel}
                                                                </span>

                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleRemoveField('line2', idx); }}
                                                                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                                                                    title="Xóa trường này"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); toggleFieldExpand('line2', idx); }}
                                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                                                                >
                                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Khung chi tiết cài đặt - Chỉ mở ra khi bấm vào */}
                                                        {isExpanded && (
                                                            <div className="p-4 border-t border-slate-150 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40 space-y-3.5 animate-in fade-in duration-150 rounded-b-2xl">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tên trường đầy đủ</label>
                                                                        <input
                                                                            type="text"
                                                                            value={field.name}
                                                                            onChange={(e) => handleUpdateField('line2', idx, { name: e.target.value })}
                                                                            className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                            placeholder="vd: Nhà máy chế biến"
                                                                        />
                                                                    </div>

                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tên ngắn gọn (Nhãn thẻ)</label>
                                                                        <input
                                                                            type="text"
                                                                            value={field.shortName}
                                                                            onChange={(e) => handleUpdateField('line2', idx, { shortName: e.target.value })}
                                                                            className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                            placeholder="vd: Nhà máy"
                                                                        />
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div className="space-y-1">
                                                                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Vị trí (start)</label>
                                                                            <input
                                                                                type="number"
                                                                                value={field.start}
                                                                                onChange={(e) => handleUpdateField('line2', idx, { start: parseInt(e.target.value, 10) || 0 })}
                                                                                className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                                min={0}
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Độ dài (len)</label>
                                                                            <input
                                                                                type="number"
                                                                                value={field.length}
                                                                                onChange={(e) => handleUpdateField('line2', idx, { length: parseInt(e.target.value, 10) || 1 })}
                                                                                className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                                min={1}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Kiểu phân giải</label>
                                                                        <select
                                                                            value={field.type}
                                                                            onChange={(e) => handleUpdateField('line2', idx, { type: e.target.value as StampFieldConfig['type'] })}
                                                                            className="w-full px-3 py-1.5 text-xs font-medium rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                        >
                                                                            <option value="dictionary">Tra từ điển quy ước</option>
                                                                            <option value="supplier">Mã nhà cung cấp (NCC)</option>
                                                                            <option value="date_ddmm">Ngày tháng (DD/MM)</option>
                                                                            <option value="date_ddmmyy">Ngày tháng năm (DD/MM/YY)</option>
                                                                            <option value="raw">Văn bản thô (giữ nguyên)</option>
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                                                    {/* Danh mục từ điển (nếu kiểu từ điển) & Màu sắc thẻ */}
                                                                    <div className="flex items-center gap-4 flex-wrap">
                                                                        {(field.type === 'dictionary' || field.type === 'supplier') && (
                                                                            <div className="flex items-center gap-2">
                                                                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Từ điển:</label>
                                                                                <select
                                                                                    value={field.dictCategory || 'factory'}
                                                                                    onChange={(e) => handleUpdateField('line2', idx, { dictCategory: e.target.value })}
                                                                                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                                                                >
                                                                                    {Object.entries(STAMP_CATEGORIES).map(([catK, catV]) => (
                                                                                        <option key={catK} value={catK}>{catV.label}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                        )}

                                                                        <div className="flex items-center gap-2">
                                                                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Màu sắc:</label>
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                {Object.entries(COLOR_THEMES).map(([cKey, cVal]) => (
                                                                                    <button
                                                                                        key={cKey}
                                                                                        type="button"
                                                                                        onClick={() => handleUpdateField('line2', idx, { color: cKey })}
                                                                                        className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${field.color === cKey ? 'scale-125 ring-2 ring-indigo-500 ring-offset-1' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                                                                                        style={{ backgroundColor: cVal.hexPreview, borderColor: cVal.hexPreview }}
                                                                                        title={cVal.label}
                                                                                    />
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Tùy chọn Nằm sau dấu ngăn cách */}
                                                                    {formLine2Config.has_delimiter && (
                                                                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-900/50">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!field.afterDelimiter}
                                                                                onChange={(e) => handleUpdateField('line2', idx, { afterDelimiter: e.target.checked })}
                                                                                className="rounded text-amber-600 cursor-pointer"
                                                                            />
                                                                            <span className="text-[11px] text-amber-800 dark:text-amber-300">
                                                                                Nằm sau dấu ({formLine2Config.delimiter_char || '-'})
                                                                            </span>
                                                                        </label>
                                                                    )}

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleFieldExpand('line2', idx)}
                                                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 self-end sm:self-auto cursor-pointer"
                                                                    >
                                                                        <span>Thu gọn</span>
                                                                        <ChevronUp size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: THÔNG TIN CHUNG */}
                            {formatSubTab === 'general' && (
                                <div className="space-y-4 max-w-xl">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Mã định danh khuôn <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formFmtCode}
                                            onChange={(e) => setFormFmtCode(e.target.value.toUpperCase())}
                                            placeholder="vd: DEFAULT_FROZEN_STAMP"
                                            required
                                            className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Tên khuôn định dạng <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formFmtName}
                                            onChange={(e) => setFormFmtName(e.target.value)}
                                            placeholder="vd: Tiêu chuẩn Dấu đóng Thùng Cấp đông"
                                            required
                                            className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Mô tả chi tiết / Tiêu chuẩn đóng dấu
                                        </label>
                                        <textarea
                                            value={formFmtDesc}
                                            onChange={(e) => setFormFmtDesc(e.target.value)}
                                            placeholder="Ghi chú về văn bản ban hành hoặc các phân xưởng áp dụng..."
                                            rows={3}
                                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pt-2">
                                        <input
                                            type="checkbox"
                                            id="fmt_chk_default"
                                            checked={formFmtIsDefault}
                                            onChange={(e) => setFormFmtIsDefault(e.target.checked)}
                                            className="rounded"
                                        />
                                        <label htmlFor="fmt_chk_default" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                            Đặt làm khuôn mặc định của hệ thống (Tất cả điện thoại quét sẽ áp dụng khuôn này)
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Modal */}
                        <div className="flex items-center justify-between p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
                            <span className="text-[11px] text-slate-500">
                                Khi lưu, khuôn mới sẽ được đồng bộ ngay lập tức tới mọi thiết bị di động
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsFormatModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                >
                                    Đóng
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveFormat}
                                    disabled={isSavingFormat}
                                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {isSavingFormat ? (
                                        <>
                                            <RefreshCw size={13} className="animate-spin" />
                                            Đang lưu...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            Lưu cấu trúc khuôn
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </>
    )
}
