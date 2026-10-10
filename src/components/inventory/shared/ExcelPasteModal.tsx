'use client'

import React, { useState, useMemo } from 'react'
import { X, ClipboardList, CheckCircle2, AlertTriangle, FileSpreadsheet, ArrowDown } from 'lucide-react'
import { Product, OrderItem } from '../types'
import { parseClipboardText, findMatchingProduct } from '@/lib/orderPasteUtils'
import { formatQuantityFull } from '@/lib/numberUtils'

interface ExcelPasteModalProps {
    isOpen: boolean
    onClose: () => void
    products: Product[]
    currentItems: OrderItem[]
    onApply: (newItems: OrderItem[]) => void
    checkUnbundleFn?: (productId: string, unit: string, qty: number) => { needsUnbundle: boolean, unbundleInfo?: string }
}

export function ExcelPasteModal({
    isOpen,
    onClose,
    products,
    currentItems,
    onApply,
    checkUnbundleFn
}: ExcelPasteModalProps) {
    const [rawText, setRawText] = useState('')
    const [mode, setMode] = useState<'append' | 'replace'>('append')

    // Parse the pasted text live
    const parsedRows = useMemo(() => {
        return parseClipboardText(rawText)
    }, [rawText])

    // Match products for preview
    const previewData = useMemo(() => {
        return parsedRows.map((row, idx) => {
            const matched = findMatchingProduct(row.productQuery, products)
            const unit = row.unit || matched?.unit || ''
            const qty = row.quantity !== undefined && row.quantity > 0 ? row.quantity : 1
            const price = matched ? ((matched as any).sale_price || (matched as any).wholesale_price || (matched as any).price || 0) : 0
            const categoryId = matched?.category_id || null

            return {
                index: idx + 1,
                query: row.productQuery,
                matched,
                unit,
                quantity: qty,
                price,
                categoryId,
                note: row.note || ''
            }
        })
    }, [parsedRows, products])

    const matchedCount = previewData.filter(d => d.matched).length
    const unmatchedCount = previewData.length - matchedCount

    const handleApply = () => {
        if (previewData.length === 0) return

        const convertedItems: OrderItem[] = previewData.map(d => {
            let unbundleData: { needsUnbundle: boolean, unbundleInfo?: string } = { needsUnbundle: false }
            if (checkUnbundleFn && d.matched) {
                unbundleData = checkUnbundleFn(d.matched.id, d.unit, d.quantity)
            }

            return {
                id: crypto.randomUUID(),
                productId: d.matched?.id || '',
                productName: d.matched?.name || d.query,
                unit: d.unit,
                quantity: d.quantity,
                document_quantity: d.quantity,
                price: d.price,
                categoryId: d.categoryId,
                note: d.note,
                needsUnbundle: unbundleData.needsUnbundle,
                unbundleInfo: unbundleData.unbundleInfo
            }
        })

        if (mode === 'replace') {
            onApply(convertedItems)
        } else {
            // Filter out empty rows if currentItems only has a single initial blank row
            const cleanedCurrent = currentItems.filter(i => i.productId || i.productName)
            onApply([...cleanedCurrent, ...convertedItems])
        }

        setRawText('')
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/70 dark:bg-zinc-800/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-xl">
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-stone-900 dark:text-white text-base">
                                Dán dữ liệu từ Excel / Google Sheets
                            </h3>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                                Copy các ô từ bảng tính Excel rồi dán (Ctrl + V) vào khung bên dưới
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Instructions */}
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3 text-xs text-emerald-800 dark:text-emerald-300">
                        <div className="font-semibold mb-1 flex items-center gap-1.5">
                            <ClipboardList size={14} /> Hỗ trợ các định dạng copy từ Excel:
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-emerald-700 dark:text-emerald-400/90 pl-1">
                            <li><strong>1 cột:</strong> [Mã sản phẩm] hoặc [Tên sản phẩm]</li>
                            <li><strong>2 cột:</strong> [Mã SP] &emsp; [Số lượng]</li>
                            <li><strong>3 cột:</strong> [Mã SP] &emsp; [ĐVT / Tên] &emsp; [Số lượng]</li>
                        </ul>
                    </div>

                    {/* Textarea */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                                Dán dữ liệu tại đây (Ctrl + V):
                            </label>
                            {rawText && (
                                <button
                                    onClick={() => setRawText('')}
                                    className="text-[11px] text-red-500 hover:underline"
                                >
                                    Xóa nội dung
                                </button>
                            )}
                        </div>
                        <textarea
                            rows={5}
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder={"Dán các dòng từ Excel vào đây...\nVí dụ:\nCC301.00066\t10\nCC301.00068\t25\nCC301.00505\t5"}
                            className="w-full p-3 font-mono text-xs bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-stone-900 dark:text-white placeholder:text-stone-400"
                            autoFocus
                        />
                    </div>

                    {/* Live Preview */}
                    {previewData.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-2">
                                    Xem trước danh sách ({previewData.length} dòng):
                                </span>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                        <CheckCircle2 size={13} /> {matchedCount} khớp kho
                                    </span>
                                    {unmatchedCount > 0 && (
                                        <span className="text-amber-600 font-semibold flex items-center gap-1">
                                            <AlertTriangle size={13} /> {unmatchedCount} mã chưa có trong kho
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="border border-stone-200 dark:border-zinc-700 rounded-xl max-h-56 overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-400 text-[11px] sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 w-10 text-center">#</th>
                                            <th className="px-3 py-2">Mã nhập vào</th>
                                            <th className="px-3 py-2">Sản phẩm khớp</th>
                                            <th className="px-3 py-2 w-20 text-center">ĐVT</th>
                                            <th className="px-3 py-2 w-24 text-right">Số lượng</th>
                                            <th className="px-3 py-2 w-28 text-center">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                        {previewData.map((row) => (
                                            <tr key={row.index} className="hover:bg-stone-50 dark:hover:bg-zinc-800/40">
                                                <td className="px-3 py-2 text-center text-stone-400">{row.index}</td>
                                                <td className="px-3 py-2 font-mono font-medium text-stone-800 dark:text-stone-200">
                                                    {row.query}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {row.matched ? (
                                                        <div>
                                                            <div className="font-semibold text-stone-900 dark:text-white line-clamp-1">
                                                                {row.matched.name}
                                                            </div>
                                                            <div className="text-[10px] text-stone-400 font-mono">
                                                                {row.matched.sku || row.matched.internal_code}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-stone-400 italic">Chưa tìm thấy</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-center text-stone-600 dark:text-stone-300">
                                                    {row.unit || '-'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-stone-900 dark:text-white">
                                                    {formatQuantityFull(row.quantity)}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {row.matched ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                                                            <CheckCircle2 size={11} /> Khớp
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400">
                                                            <AlertTriangle size={11} /> Chưa có SP
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Mode selection */}
                    <div className="flex items-center gap-6 pt-2 border-t border-stone-100 dark:border-zinc-800">
                        <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                            Phương thức nạp:
                        </label>
                        <div className="flex items-center gap-4 text-xs">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="radio"
                                    name="paste_mode"
                                    checked={mode === 'append'}
                                    onChange={() => setMode('append')}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                />
                                <span>Thêm nối tiếp vào danh sách ({currentItems.filter(i => i.productId).length} dòng hiện có)</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="radio"
                                    name="paste_mode"
                                    checked={mode === 'replace'}
                                    onChange={() => setMode('replace')}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="text-red-600 dark:text-red-400">Thay thế toàn bộ danh sách</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-3.5 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-850">
                    <div className="text-xs text-stone-500">
                        {previewData.length > 0 ? (
                            <span>Sẵn sàng nạp <strong>{previewData.length}</strong> dòng sản phẩm</span>
                        ) : (
                            <span>Vui lòng dán dữ liệu để xem trước</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            disabled={previewData.length === 0}
                            onClick={handleApply}
                            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-1.5"
                        >
                            <ArrowDown size={14} />
                            Áp dụng vào phiếu ({previewData.length})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
