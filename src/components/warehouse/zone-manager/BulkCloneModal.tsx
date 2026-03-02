'use client'
import React, { useState, useMemo } from 'react'
import { X, Copy, AlertCircle } from 'lucide-react'
import { LocalZone } from './types'

interface BulkCloneModalProps {
    zone: LocalZone
    onClose: () => void
    onConfirm: (zone: LocalZone, fromN: number, toN: number, padLength: number) => void
}

/** Extract trailing number from a string: "B01" → { prefix: "B", num: 1, padLength: 2 } */
function parseTrailingNumber(str: string): { prefix: string; num: number; padLength: number } | null {
    const match = str.match(/^(.*?)(\d+)$/)
    if (!match) return null
    return {
        prefix: match[1],
        num: parseInt(match[2], 10),
        padLength: match[2].length
    }
}

export function BulkCloneModal({ zone, onClose, onConfirm }: BulkCloneModalProps) {
    const parsed = useMemo(() => parseTrailingNumber(zone.code), [zone.code])
    const parsedName = useMemo(() => parseTrailingNumber(zone.name), [zone.name])

    const defaultFrom = parsed ? parsed.num + 1 : 2
    const defaultPad = parsed ? parsed.padLength : 2

    const [fromN, setFromN] = useState(defaultFrom)
    const [toN, setToN] = useState(defaultFrom + 4)
    const [padLength, setPadLength] = useState(defaultPad)

    const codePrefix = parsed ? parsed.prefix : zone.code + '_'
    const namePrefix = parsedName ? parsedName.prefix : zone.name + ' '

    const preview = useMemo(() => {
        const items: string[] = []
        for (let i = fromN; i <= Math.min(toN, fromN + 4); i++) {
            const numStr = String(i).padStart(padLength, '0')
            items.push(`${codePrefix}${numStr} – ${namePrefix}${numStr}`)
        }
        if (toN - fromN + 1 > 5) items.push(`... và ${toN - fromN + 1 - 5} zone nữa`)
        return items
    }, [fromN, toN, padLength, codePrefix, namePrefix])

    const count = toN - fromN + 1
    const isValid = fromN <= toN && count >= 1 && count <= 200

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                            <Copy size={16} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Nhân bản hàng loạt</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Từ zone <span className="font-mono font-bold">{zone.code}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                    {/* Padding length */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Độ dài số (pad zeros) — ví dụ: 2 → 01, 02...
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={5}
                            value={padLength}
                            onChange={e => setPadLength(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* From - To */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Từ số</label>
                            <input
                                type="number"
                                min={1}
                                value={fromN}
                                onChange={e => setFromN(parseInt(e.target.value) || 1)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Đến số</label>
                            <input
                                type="number"
                                min={1}
                                value={toN}
                                onChange={e => setToN(parseInt(e.target.value) || 1)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Validation */}
                    {!isValid && (
                        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            <AlertCircle size={14} />
                            {count > 200 ? 'Tối đa 200 zone mỗi lần nhân bản' : 'Số bắt đầu phải ≤ số kết thúc'}
                        </div>
                    )}

                    {/* Preview */}
                    {isValid && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                Xem trước — {count} zone sẽ được tạo (kèm toàn bộ cấu trúc con):
                            </p>
                            <div className="space-y-1">
                                {preview.map((p, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                        <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{p}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={() => isValid && onConfirm(zone, fromN, toN, padLength)}
                        disabled={!isValid}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <Copy size={14} />
                        Tạo {isValid ? count : ''} zone
                    </button>
                </div>
            </div>
        </div>
    )
}
