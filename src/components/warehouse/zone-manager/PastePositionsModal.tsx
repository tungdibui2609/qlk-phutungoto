'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
    X,
    ClipboardPaste,
    ArrowRight,
    CheckCircle2,
    AlertTriangle,
    Layers,
    Sparkles,
    Search,
    RefreshCw,
    Building2,
    Info
} from 'lucide-react'
import { LocalZone, LocalPosition } from './types'
import {
    getFullAncestorChain,
    deducePrefixReplacement,
    previewClonePositions,
    ClonePositionSummary
} from './positionCloneUtils'

interface PastePositionsModalProps {
    sourceZone: LocalZone
    targetZone: LocalZone
    zones: LocalZone[]
    positionsMap: Record<string, LocalPosition[]>
    onClose: () => void
    onConfirm: (
        sourceZone: LocalZone,
        targetZone: LocalZone,
        searchPrefix: string,
        replacePrefix: string
    ) => void
}

export function PastePositionsModal({
    sourceZone,
    targetZone,
    zones,
    positionsMap,
    onClose,
    onConfirm
}: PastePositionsModalProps) {
    const sourceChain = useMemo(() => getFullAncestorChain(sourceZone.id, zones), [sourceZone.id, zones])
    const targetChain = useMemo(() => getFullAncestorChain(targetZone.id, zones), [targetZone.id, zones])

    const { defaultSearch, defaultReplace, suggestions } = useMemo(
        () => deducePrefixReplacement(sourceChain, targetChain),
        [sourceChain, targetChain]
    )

    const [searchPrefix, setSearchPrefix] = useState(defaultSearch)
    const [replacePrefix, setReplacePrefix] = useState(defaultReplace)
    const [isExecuting, setIsExecuting] = useState(false)

    // Sync if source/target changes
    useEffect(() => {
        setSearchPrefix(defaultSearch)
        setReplacePrefix(defaultReplace)
    }, [defaultSearch, defaultReplace])

    // Generate real-time preview
    const summary: ClonePositionSummary = useMemo(() => {
        return previewClonePositions(
            sourceZone.id,
            targetZone.id,
            searchPrefix,
            replacePrefix,
            zones,
            positionsMap
        )
    }, [sourceZone.id, targetZone.id, searchPrefix, replacePrefix, zones, positionsMap])

    const sourcePathStr = sourceChain.map(z => z.name || z.code).join(' ❯ ')
    const targetPathStr = targetChain.map(z => z.name || z.code).join(' ❯ ')

    const handleApplySuggestion = (sSearch: string, sReplace: string) => {
        setSearchPrefix(sSearch)
        setReplacePrefix(sReplace)
    }

    const handleConfirm = () => {
        if (summary.totalPositionsToClone === 0) return
        setIsExecuting(true)
        try {
            onConfirm(sourceZone, targetZone, searchPrefix, replacePrefix)
            onClose()
        } finally {
            setIsExecuting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-orange-50/50 via-white to-amber-50/50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-sm">
                            <ClipboardPaste size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                                Dán & Tự động đổi tiền tố Vị trí
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Sao chép toàn bộ vị trí tương ứng từ zone nguồn sang zone đích
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                    {/* Zone Cards: Source & Target */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                        {/* Source Card */}
                        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Zone Nguồn (Copy)</span>
                                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-bold">
                                    {sourceZone.code}
                                </span>
                            </div>
                            <div className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                {sourceZone.name}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate" title={sourcePathStr}>
                                {sourcePathStr}
                            </div>
                        </div>

                        {/* Target Card */}
                        <div className="p-3.5 rounded-xl border border-orange-200 dark:border-orange-800/60 bg-orange-50/40 dark:bg-orange-950/20 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">Zone Đích (Paste)</span>
                                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 font-bold">
                                    {targetZone.code}
                                </span>
                            </div>
                            <div className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                {targetZone.name}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate" title={targetPathStr}>
                                {targetPathStr}
                            </div>
                        </div>
                    </div>

                    {/* Prefix replacement configuration */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <Sparkles size={14} className="text-orange-500" />
                                Quy tắc đổi tiền tố mã vị trí
                            </label>
                            <span className="text-[11px] text-gray-400">
                                Tự động thay thế tiền tố trong mã
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <span className="block text-[10px] font-medium text-gray-500 mb-1">Tìm tiền tố cũ:</span>
                                <input
                                    type="text"
                                    value={searchPrefix}
                                    onChange={e => setSearchPrefix(e.target.value.toUpperCase())}
                                    placeholder="VD: K2"
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all"
                                />
                            </div>

                            <div className="pt-5 text-gray-400">
                                <ArrowRight size={20} />
                            </div>

                            <div className="flex-1">
                                <span className="block text-[10px] font-medium text-gray-500 mb-1">Thay bằng tiền tố mới:</span>
                                <input
                                    type="text"
                                    value={replacePrefix}
                                    onChange={e => setReplacePrefix(e.target.value.toUpperCase())}
                                    placeholder="VD: K5"
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Quick suggestions */}
                        {suggestions.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] text-gray-400 block font-medium">Gợi ý phát hiện tự động:</span>
                                <div className="flex flex-wrap gap-2">
                                    {suggestions.map((s, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleApplySuggestion(s.search, s.replace)}
                                            className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-all flex items-center gap-1.5 ${
                                                searchPrefix === s.search && replacePrefix === s.replace
                                                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm font-bold'
                                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-orange-300 hover:bg-orange-50/50'
                                            }`}
                                            title={s.description}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 text-center">
                            <span className="block text-[10px] text-gray-400 font-medium uppercase">Số vị trí sẽ tạo</span>
                            <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                                {summary.totalPositionsToClone}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 text-center">
                            <span className="block text-[10px] text-gray-400 font-medium uppercase">Số Zone con khớp</span>
                            <span className="text-xl font-bold text-gray-800 dark:text-gray-200">
                                {summary.matchedSubzonesCount} / {summary.totalSourceSubzonesCount}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 text-center">
                            <span className="block text-[10px] text-gray-400 font-medium uppercase">Trùng lặp</span>
                            <span className={`text-xl font-bold ${summary.duplicateCount > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                {summary.duplicateCount}
                            </span>
                        </div>
                    </div>

                    {/* Duplicate Warning */}
                    {summary.duplicateCount > 0 && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400">
                            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold">Cảnh báo trùng mã vị trí!</span> Có {summary.duplicateCount} vị trí trùng với mã đã có trong hệ thống hoặc trùng nhau trong đợt tạo này. Vui lòng điều chỉnh lại tiền tố thay thế.
                            </div>
                        </div>
                    )}

                    {/* Unmatched Warning */}
                    {summary.unmatchedSubzones.length > 0 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-400">
                            <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold">Lưu ý:</span> Có {summary.unmatchedSubzones.length} zone con ở nguồn không tìm thấy zone tương ứng ở đích (sẽ bỏ qua {summary.unmatchedSubzones.reduce((s, z) => s + z.posCount, 0)} vị trí).
                            </div>
                        </div>
                    )}

                    {/* Live Preview Table */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                Xem trước mẫu ({Math.min(summary.previewItems.length, 8)} / {summary.previewItems.length} vị trí):
                            </span>
                            {summary.previewItems.length > 8 && (
                                <span className="text-[11px] text-gray-400">
                                    + {summary.previewItems.length - 8} vị trí khác tương ứng
                                </span>
                            )}
                        </div>

                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
                            <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                                {summary.previewItems.slice(0, 8).map((item, idx) => (
                                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors">
                                        <div className="space-y-0.5 min-w-0 pr-3">
                                            <div className="font-medium text-gray-800 dark:text-gray-200 truncate">
                                                {item.targetZoneName}
                                            </div>
                                            <div className="text-[10px] text-gray-400">
                                                Nguồn: {item.sourceZoneName}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="flex items-center gap-2 font-mono">
                                                <span className="text-gray-400 line-through text-[11px]">{item.originalCode}</span>
                                                <ArrowRight size={12} className="text-gray-400" />
                                                <span className="font-bold text-orange-600 dark:text-orange-400 text-xs px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-950/40 border border-orange-200/50 dark:border-orange-800/40">
                                                    {item.newCode}
                                                </span>
                                            </div>

                                            {item.status === 'ok' ? (
                                                <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 font-medium">
                                                    <CheckCircle2 size={12} /> Hợp lệ
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium" title={item.statusMessage}>
                                                    <AlertTriangle size={12} /> {item.status === 'unmatched_target' ? 'Bỏ qua' : 'Trùng'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {summary.previewItems.length === 0 && (
                                    <div className="py-6 text-center text-xs text-gray-400 italic">
                                        Không tìm thấy vị trí nào từ zone nguồn để sao chép.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        Hủy
                    </button>

                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!summary.canExecute || isExecuting}
                        className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                        {isExecuting ? (
                            'Đang dán...'
                        ) : (
                            <>
                                <ClipboardPaste size={16} />
                                Xác nhận dán {summary.totalPositionsToClone} Vị trí
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
