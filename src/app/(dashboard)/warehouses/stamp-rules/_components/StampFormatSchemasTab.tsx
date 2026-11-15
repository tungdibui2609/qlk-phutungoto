'use client'

import React from 'react'
import { Edit, Trash2, Sparkles, Factory, Box, Star } from 'lucide-react'
import type { StampFormat } from './constants'
import { COLOR_THEMES } from './constants'

interface StampFormatSchemasTabProps {
    mainTab: 'dictionaries' | 'formats'
    formats: StampFormat[]
    activeFormatId: string
    setActiveFormatId: React.Dispatch<React.SetStateAction<string>>
    setSimLine1: React.Dispatch<React.SetStateAction<string>>
    setSimLine2: React.Dispatch<React.SetStateAction<string>>
    handleSetDefaultFormat: (fmt: StampFormat) => Promise<void>
    handleOpenEditFormat: (fmt: StampFormat) => void
    handleDeleteFormat: (fmt: StampFormat) => Promise<void>
    showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export function StampFormatSchemasTab({
    mainTab,
    formats,
    activeFormatId,
    setActiveFormatId,
    setSimLine1,
    setSimLine2,
    handleSetDefaultFormat,
    handleOpenEditFormat,
    handleDeleteFormat,
    showToast,
}: StampFormatSchemasTabProps) {
    if (mainTab !== 'formats') return null
    return (
        <>
            {mainTab === 'formats' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        {formats.map((fmt) => {
                            const isDefault = fmt.is_default
                            const isSelected = fmt.id === activeFormatId
                            return (
                                <div 
                                    key={fmt.id}
                                    className={`bg-white dark:bg-slate-900 border rounded-3xl p-5 sm:p-6 transition-all shadow-sm ${
                                        isDefault 
                                            ? 'border-indigo-500/60 ring-2 ring-indigo-500/20 shadow-md' 
                                            : 'border-slate-200 dark:border-slate-800'
                                    }`}
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-150 dark:border-slate-800 pb-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                                                    {fmt.name}
                                                </h3>
                                                <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                    {fmt.code}
                                                </span>
                                                {isDefault && (
                                                    <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                                                        <Star size={12} className="fill-indigo-500 text-indigo-500" />
                                                        Mặc định App Mobile
                                                    </span>
                                                )}
                                                {isSelected && (
                                                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                                        Đang dùng ở Live Simulator
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {fmt.description || 'Không có mô tả chi tiết.'}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                            {!isDefault && (
                                                <button
                                                    onClick={() => handleSetDefaultFormat(fmt)}
                                                    className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                                >
                                                    <Star size={13} />
                                                    Đặt làm mặc định
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setActiveFormatId(fmt.id)
                                                    if (fmt.line1_config?.sample) setSimLine1(fmt.line1_config.sample)
                                                    if (fmt.line2_config?.sample) setSimLine2(fmt.line2_config.sample)
                                                    showToast(`Đã đưa khuôn "${fmt.name}" lên Live Simulator`, 'info')
                                                }}
                                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <Sparkles size={13} className="text-amber-500" />
                                                Thử nghiệm
                                            </button>
                                            <button
                                                onClick={() => handleOpenEditFormat(fmt)}
                                                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                            >
                                                <Edit size={13} />
                                                Chỉnh sửa cấu trúc
                                            </button>
                                            {!isDefault && (
                                                <button
                                                    onClick={() => handleDeleteFormat(fmt)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                                                    title="Xóa khuôn này"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Preview sơ đồ các trường của Dòng 1 & Dòng 2 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                        {/* Line 1 breakdown */}
                                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                                                <span className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                                                    <Box size={14} className="text-purple-600 dark:text-purple-400" />
                                                    {fmt.line1_config?.title || 'Dòng 1'}
                                                </span>
                                                <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700/80 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-2xs">
                                                    Tổng {fmt.line1_config?.total_length || 14} ký tự {fmt.line1_config?.has_delimiter ? `(Dấu phân cách "${fmt.line1_config.delimiter_char || '-'}")` : ''}
                                                </span>
                                            </div>

                                            {/* Dãy số mẫu minh họa trực quan - TÔ MÀU TỪNG PHÂN ĐOẠN KHỐI */}
                                            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono flex-wrap shadow-inner">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 shrink-0 flex items-center gap-1">
                                                    <Sparkles size={12} className="text-amber-400" />
                                                    Mẫu số:
                                                </span>
                                                <div className="flex items-center gap-1.5 flex-wrap font-mono font-black">
                                                    {(fmt.line1_config?.fields || []).map((f, i) => {
                                                        const theme = COLOR_THEMES[f.color] || COLOR_THEMES.purple
                                                        const sampleStr = (fmt.line1_config?.sample || '102010204001-0').trim().replace(/\s+/g, '')
                                                        const hasDelim = !!fmt.line1_config?.has_delimiter
                                                        const delimChar = fmt.line1_config?.delimiter_char || '-'
                                                        let sampleCode = ''
                                                        if (f.afterDelimiter && hasDelim) {
                                                            const dIdx = sampleStr.indexOf(delimChar)
                                                            if (dIdx !== -1) {
                                                                sampleCode = sampleStr.substring(dIdx + 1, dIdx + 1 + f.length)
                                                            }
                                                        } else {
                                                            sampleCode = sampleStr.substring(f.start, f.start + f.length)
                                                        }
                                                        return (
                                                            <React.Fragment key={i}>
                                                                {f.afterDelimiter && hasDelim && (
                                                                    <span className="px-0.5 text-slate-500 font-black text-xs">{delimChar}</span>
                                                                )}
                                                                <span
                                                                    className="px-2 py-0.5 rounded-lg text-xs font-black tracking-wider transition-all hover:scale-110 shadow-xs"
                                                                    style={{
                                                                        backgroundColor: theme.hexPreview + '30',
                                                                        color: '#ffffff',
                                                                        border: `1.5px solid ${theme.hexPreview}`
                                                                    }}
                                                                    title={`${f.shortName || f.name} (${f.length}kt)`}
                                                                >
                                                                    {sampleCode || '?'}
                                                                </span>
                                                            </React.Fragment>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {(fmt.line1_config?.fields || []).map((f, i) => {
                                                    const theme = COLOR_THEMES[f.color] || COLOR_THEMES.purple
                                                    const sampleStr = (fmt.line1_config?.sample || '102010204001-0').trim().replace(/\s+/g, '')
                                                    const hasDelim = !!fmt.line1_config?.has_delimiter
                                                    const delimChar = fmt.line1_config?.delimiter_char || '-'
                                                    let sampleCode = ''
                                                    if (f.afterDelimiter && hasDelim) {
                                                        const dIdx = sampleStr.indexOf(delimChar)
                                                        if (dIdx !== -1) {
                                                            sampleCode = sampleStr.substring(dIdx + 1, dIdx + 1 + f.length)
                                                        }
                                                    } else {
                                                        sampleCode = sampleStr.substring(f.start, f.start + f.length)
                                                    }
                                                    return (
                                                        <div 
                                                            key={i} 
                                                            className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 transition-transform hover:scale-105 shadow-2xs ${theme.cardBadge}`}
                                                            title={`Mã mẫu: ${sampleCode || '?'} | Vị trí: kt ${f.start}..${f.start + f.length - 1}`}
                                                        >
                                                            {/* Ô số mẫu nhỏ tô màu nổi bật theo đúng màu trường */}
                                                            <span 
                                                                className="font-mono text-[11px] font-black px-1.5 py-0.5 rounded-md shadow-2xs text-white"
                                                                style={{ backgroundColor: theme.hexPreview }}
                                                            >
                                                                {f.afterDelimiter && hasDelim ? `${delimChar}${sampleCode || '?'}` : (sampleCode || '?')}
                                                            </span>
                                                            <span>{f.shortName || f.name}</span>
                                                            <span className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-md ${theme.cardPill}`}>
                                                                {f.length}kt
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Line 2 breakdown */}
                                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                                                <span className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                                                    <Factory size={14} className="text-indigo-600 dark:text-indigo-400" />
                                                    {fmt.line2_config?.title || 'Dòng 2'}
                                                </span>
                                                <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700/80 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-2xs">
                                                    Tổng {fmt.line2_config?.total_length || 16} chữ số {fmt.line2_config?.has_delimiter ? `(Dấu phân cách "${fmt.line2_config.delimiter_char || '-'}")` : ''}
                                                </span>
                                            </div>

                                            {/* Dãy số mẫu minh họa trực quan - TÔ MÀU TỪNG PHÂN ĐOẠN KHỐI */}
                                            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono flex-wrap shadow-inner">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 shrink-0 flex items-center gap-1">
                                                    <Sparkles size={12} className="text-amber-400" />
                                                    Mẫu số:
                                                </span>
                                                <div className="flex items-center gap-1.5 flex-wrap font-mono font-black">
                                                    {(fmt.line2_config?.fields || []).map((f, i) => {
                                                        const theme = COLOR_THEMES[f.color] || COLOR_THEMES.blue
                                                        const sampleStr = (fmt.line2_config?.sample || '2120908092600166').trim().replace(/\s+/g, '')
                                                        const hasDelim = !!fmt.line2_config?.has_delimiter
                                                        const delimChar = fmt.line2_config?.delimiter_char || '-'
                                                        let sampleCode = ''
                                                        if (f.afterDelimiter && hasDelim) {
                                                            const dIdx = sampleStr.indexOf(delimChar)
                                                            if (dIdx !== -1) {
                                                                sampleCode = sampleStr.substring(dIdx + 1, dIdx + 1 + f.length)
                                                            }
                                                        } else {
                                                            sampleCode = sampleStr.substring(f.start, f.start + f.length)
                                                        }
                                                        return (
                                                            <React.Fragment key={i}>
                                                                {f.afterDelimiter && hasDelim && (
                                                                    <span className="px-0.5 text-slate-500 font-black text-xs">{delimChar}</span>
                                                                )}
                                                                <span
                                                                    className="px-2 py-0.5 rounded-lg text-xs font-black tracking-wider transition-all hover:scale-110 shadow-xs"
                                                                    style={{
                                                                        backgroundColor: theme.hexPreview + '30',
                                                                        color: '#ffffff',
                                                                        border: `1.5px solid ${theme.hexPreview}`
                                                                    }}
                                                                    title={`${f.shortName || f.name} (${f.length}kt)`}
                                                                >
                                                                    {sampleCode || '?'}
                                                                </span>
                                                            </React.Fragment>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {(fmt.line2_config?.fields || []).map((f, i) => {
                                                    const theme = COLOR_THEMES[f.color] || COLOR_THEMES.blue
                                                    const sampleStr = (fmt.line2_config?.sample || '2120908092600166').trim().replace(/\s+/g, '')
                                                    const hasDelim = !!fmt.line2_config?.has_delimiter
                                                    const delimChar = fmt.line2_config?.delimiter_char || '-'
                                                    let sampleCode = ''
                                                    if (f.afterDelimiter && hasDelim) {
                                                        const dIdx = sampleStr.indexOf(delimChar)
                                                        if (dIdx !== -1) {
                                                            sampleCode = sampleStr.substring(dIdx + 1, dIdx + 1 + f.length)
                                                        }
                                                    } else {
                                                        sampleCode = sampleStr.substring(f.start, f.start + f.length)
                                                    }
                                                    return (
                                                        <div 
                                                            key={i} 
                                                            className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 transition-transform hover:scale-105 shadow-2xs ${theme.cardBadge}`}
                                                            title={`Mã mẫu: ${sampleCode || '?'} | Vị trí: kt ${f.start}..${f.start + f.length - 1}`}
                                                        >
                                                            {/* Ô số mẫu nhỏ tô màu nổi bật theo đúng màu trường */}
                                                            <span 
                                                                className="font-mono text-[11px] font-black px-1.5 py-0.5 rounded-md shadow-2xs text-white"
                                                                style={{ backgroundColor: theme.hexPreview }}
                                                            >
                                                                {f.afterDelimiter && hasDelim ? `${delimChar}${sampleCode || '?'}` : (sampleCode || '?')}
                                                            </span>
                                                            <span>{f.shortName || f.name}</span>
                                                            <span className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-md ${theme.cardPill}`}>
                                                                {f.length}kt
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </>
    )
}
