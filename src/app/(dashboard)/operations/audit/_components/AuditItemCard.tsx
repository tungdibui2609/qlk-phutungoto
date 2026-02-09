'use client'

import { useState, useEffect, useRef } from 'react'
import { InventoryCheckItem } from '../_hooks/useAudit'
import { Check, AlertTriangle, MessageSquare, Package, Minus, Plus, X, ShieldCheck, History, Send } from 'lucide-react'
import { formatQuantityFull } from '@/lib/numberUtils'
import { QuantityInput } from '@/components/ui/QuantityInput'
import Image from 'next/image'

interface AuditItemCardProps {
    item: InventoryCheckItem
    onUpdate: (id: string, qty: number, note?: string) => void
    onAddFeedback: (id: string, content: string, isReviewer?: boolean) => void
    readonly?: boolean
    canApprove?: boolean
}

export function AuditItemCard({ item, onUpdate, onAddFeedback, readonly, canApprove }: AuditItemCardProps) {
    const [qty, setQty] = useState<number | ''>(item.actual_quantity !== null ? item.actual_quantity : '')
    const [note, setNote] = useState(item.note || '')
    const [newFeedback, setNewFeedback] = useState('')
    const [showNote, setShowNote] = useState(!!item.note)
    const [showHistory, setShowHistory] = useState(!!item.logs?.length)

    // Update local state when prop changes (e.g. from quick fill)
    useEffect(() => {
        setQty(item.actual_quantity !== null ? item.actual_quantity : '')
    }, [item.actual_quantity])

    useEffect(() => {
        setNote(item.note || '')
    }, [item.note])

    const handleSave = (newQty: number | '') => {
        if (readonly) return
        if (typeof newQty === 'number') {
            onUpdate(item.id, newQty, note)
        }
    }

    const handleBlur = () => {
        if (qty === '') return
        handleSave(qty)
    }

    const adjustQty = (delta: number) => {
        if (readonly) return
        const current = typeof qty === 'number' ? qty : 0
        const newVal = Math.max(0, current + delta)
        setQty(newVal)
        handleSave(newVal)
    }

    const isMatch = item.actual_quantity !== null && item.difference === 0
    const isMismatch = item.actual_quantity !== null && item.difference !== 0
    const isUncounted = item.actual_quantity === null

    // Fallbacks for snapshot data if realations are missing
    const productName = item.products?.name || (item as any).product_name || 'Sản phẩm'
    const productSku = item.products?.sku || (item as any).product_sku || '---'
    const imageUrl = item.products?.image_url

    return (
        <div className={`
            relative flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-200
            ${isMatch ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800' : ''}
            ${isMismatch ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-800' : ''}
            ${isUncounted ? 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800' : ''}
            ${readonly ? 'opacity-80' : ''}
        `}>
            {/* Header: Product Info */}
            <div className="flex gap-3">
                <div className="w-12 h-12 relative rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                    {imageUrl ? (
                        <Image
                            src={imageUrl}
                            alt={productName}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Package size={20} />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm line-clamp-2">
                            {productName}
                        </h4>
                        {isMatch && <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />}
                        {isMismatch && <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                            {productSku}
                        </span>
                        {item.lots ? (
                            <span className="text-xs font-medium text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded border border-orange-100 dark:border-orange-800">
                                {item.lots.code}
                            </span>
                        ) : (item as any).lot_code ? (
                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {(item as any).lot_code}
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500">Hệ thống</span>
                    <span className="font-mono font-bold text-lg text-slate-700 dark:text-slate-300">
                        {formatQuantityFull(item.system_quantity)} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                    </span>
                </div>

                <div className="flex flex-col gap-1 items-end flex-1">
                    <span className="text-xs text-slate-500">Thực tế</span>
                    <div className="flex items-center gap-1 w-full max-w-[180px]">
                        <button
                            onClick={() => adjustQty(-1)}
                            disabled={readonly}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all ${readonly ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                            <Minus size={18} />
                        </button>
                        <QuantityInput
                            value={qty}
                            onChange={(val) => !readonly && setQty(val)}
                            onBlurCustom={() => !readonly && handleBlur()}
                            placeholder="-"
                            disabled={readonly}
                            className={`
                                flex-1 h-10 rounded-xl text-center font-bold text-lg outline-none border-2 transition-all
                                focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10
                                ${isMismatch ? 'border-red-200 text-red-600 bg-red-50/50' : ''}
                                ${isMatch ? 'border-emerald-200 text-emerald-600 bg-emerald-50/50' : ''}
                                ${isUncounted ? 'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700' : ''}
                                ${readonly ? 'bg-slate-50 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : ''}
                            `}
                        />
                        <button
                            onClick={() => adjustQty(1)}
                            disabled={readonly}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all ${readonly ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                    {qty !== '' && !readonly && (
                        <button
                            onClick={() => {
                                setQty('')
                                onUpdate(item.id, null as any)
                            }}
                            className="mt-1 text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-1"
                        >
                            <X size={10} /> Đặt lại
                        </button>
                    )}
                </div>
            </div>

            {/* Footer Actions: Discussion & Diff */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowNote(!showNote)}
                        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${note ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <MessageSquare size={14} />
                        {note ? 'Ghi chú hiện tại' : 'Thêm ghi chú'}
                    </button>

                    {item.logs && item.logs.length > 0 && (
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${showHistory ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <History size={14} />
                            Nhật ký ({item.logs.length})
                        </button>
                    )}
                </div>

                {item.actual_quantity !== null && item.difference !== 0 && (
                    <span className={`text-xs font-bold ${item.difference > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        Lệch: {item.difference > 0 ? '+' : ''}{formatQuantityFull(item.difference)}
                    </span>
                )}
            </div>

            {/* Audit Team Note (Editable by Audit Team) */}
            {showNote && (
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Ghi chú tổ kiểm kê</label>
                    <div className="flex gap-2">
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            disabled={readonly}
                            placeholder="Nhập ghi chú giải trình..."
                            className={`flex-1 text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-orange-500 resize-none ${readonly ? 'bg-slate-50/50 cursor-not-allowed' : ''}`}
                            rows={2}
                        />
                        {!readonly && (
                            <button
                                onClick={() => onUpdate(item.id, (typeof qty === 'number' ? qty : 0), note)}
                                className="px-3 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-colors"
                            >
                                <Check size={18} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* History / Audit Trail */}
            {showHistory && item.logs && (
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Luồng trao đổi đối soát</label>
                    {item.logs.map((log) => (
                        <div
                            key={log.id}
                            className={`p-3 rounded-xl border text-xs ${log.is_reviewer
                                    ? 'bg-blue-50/40 dark:bg-blue-900/10 border-blue-100/50 dark:border-blue-900/20'
                                    : 'bg-orange-50/40 dark:bg-orange-900/5 border-orange-100/50 dark:border-orange-900/10'
                                }`}
                        >
                            <div className="flex justify-between mb-1">
                                <div className="flex items-center gap-1.5 font-bold">
                                    {log.is_reviewer ? <ShieldCheck size={12} className="text-blue-600" /> : <MessageSquare size={12} className="text-orange-600" />}
                                    <span className={log.is_reviewer ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}>
                                        {log.user_name || 'Người dùng'} {log.is_reviewer ? '(Quản lý)' : '(Tổ kiểm)'}
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString('vi-VN')}</span>
                            </div>
                            <p className="italic mb-2 text-slate-800 dark:text-slate-200">"{log.content}"</p>
                            <div className="flex gap-3 text-[10px] font-mono bg-white/50 dark:bg-black/20 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800/50">
                                <span>HT: <b className="text-slate-700 dark:text-slate-300">{formatQuantityFull(log.system_quantity || 0)}</b></span>
                                <span>TT: <b className="text-blue-600">{formatQuantityFull(log.actual_quantity || 0)}</b></span>
                                <span>Lệch: <b className={((log.actual_quantity || 0) - (log.system_quantity || 0)) !== 0 ? 'text-red-500' : 'text-emerald-500'}>
                                    {formatQuantityFull((log.actual_quantity || 0) - (log.system_quantity || 0))}
                                </b></span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* New Feedback Input (Visible for both Audit Team and Reviewers) */}
            {!readonly || canApprove ? (
                <div className="space-y-1 pt-1">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newFeedback}
                            onChange={(e) => setNewFeedback(e.target.value)}
                            placeholder={canApprove ? "Phản hồi / Chỉ đạo cho tổ kiểm..." : "Giải trình / Trả lời người duyệt..."}
                            className={`flex-1 text-xs p-3 rounded-xl border focus:outline-none transition-colors ${canApprove
                                ? 'border-blue-100 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-900/10 focus:border-blue-500'
                                : 'border-orange-100 dark:border-orange-900/50 bg-orange-50/10 dark:bg-orange-900/5 focus:border-orange-500'
                                }`}
                        />
                        <button
                            onClick={() => {
                                onAddFeedback(item.id, newFeedback, !!canApprove)
                                setNewFeedback('')
                                setShowHistory(true)
                            }}
                            disabled={!newFeedback.trim()}
                            className={`px-3 rounded-xl text-white transition-colors disabled:opacity-50 ${canApprove ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'
                                }`}
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
