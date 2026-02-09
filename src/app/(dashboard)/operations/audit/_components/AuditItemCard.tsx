'use client'

import { useState, useEffect, useRef } from 'react'
import { InventoryCheckItem } from '../_hooks/useAudit'
import { Check, AlertTriangle, MessageSquare, Package, Minus, Plus, X, ShieldCheck, History, Send } from 'lucide-react'
import { formatQuantityFull } from '@/lib/numberUtils'
import { QuantityInput } from '@/components/ui/QuantityInput'
import Image from 'next/image'

interface AuditItemCardProps {
    items: InventoryCheckItem[]
    onUpdate: (id: string, qty: number, note?: string) => void
    onAddFeedback: (id: string, content: string, isReviewer?: boolean) => void
    readonly?: boolean
    canApprove?: boolean
}

export function AuditItemCard({ items, onUpdate, onAddFeedback, readonly, canApprove }: AuditItemCardProps) {
    const firstItem = items[0]
    const [itemStates, setItemStates] = useState<Record<string, { qty: number | '', note: string }>>(
        Object.fromEntries(items.map(item => [
            item.id,
            {
                qty: item.actual_quantity !== null ? item.actual_quantity : '',
                note: item.note || ''
            }
        ]))
    )
    const [newFeedback, setNewFeedback] = useState('')
    const [showNote, setShowNote] = useState(items.some(i => i.note))
    const [showHistory, setShowHistory] = useState(items.some(i => i.logs?.length))

    // Update local state when prop changes
    useEffect(() => {
        setItemStates(prev => {
            const next = { ...prev }
            items.forEach(item => {
                next[item.id] = {
                    qty: item.actual_quantity !== null ? item.actual_quantity : '',
                    note: item.note || next[item.id]?.note || ''
                }
            })
            return next
        })
    }, [items])

    const handleSave = (itemId: string, newQty: number | '', note: string) => {
        if (readonly) return
        if (typeof newQty === 'number') {
            onUpdate(itemId, newQty, note)
        }
    }

    const adjustQty = (itemId: string, delta: number) => {
        if (readonly) return
        const currentQty = itemStates[itemId]?.qty
        const currentNote = itemStates[itemId]?.note
        const current = typeof currentQty === 'number' ? currentQty : 0
        const newVal = Math.max(0, current + delta)

        setItemStates(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], qty: newVal }
        }))
        handleSave(itemId, newVal, currentNote)
    }

    // Consolidated logs
    const allLogs = items.flatMap(i => i.logs || []).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const hasMismatch = items.some(i => i.actual_quantity !== null && i.difference !== 0)
    const isAllMatch = items.every(i => i.actual_quantity !== null && i.difference === 0)
    const hasUncounted = items.some(i => i.actual_quantity === null)

    const productName = firstItem.products?.name || (firstItem as any).product_name || 'Sản phẩm'
    const productSku = firstItem.products?.sku || (firstItem as any).product_sku || '---'
    const imageUrl = firstItem.products?.image_url

    return (
        <div className={`
            relative flex flex-col gap-4 p-4 rounded-2xl border transition-all duration-200
            ${isAllMatch ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800' : ''}
            ${hasMismatch ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-800' : ''}
            ${hasUncounted && !hasMismatch ? 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800' : ''}
            ${readonly ? 'opacity-90' : ''}
        `}>
            {/* Header: Product Info */}
            <div className="flex gap-4">
                <div className="w-14 h-14 relative rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 shadow-sm">
                    {imageUrl ? (
                        <Image src={imageUrl} alt={productName} fill className="object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Package size={24} />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base line-clamp-2 leading-tight">
                            {productName}
                        </h4>
                        {isAllMatch && <Check size={20} className="text-emerald-600 shrink-0 mt-0.5" />}
                        {hasMismatch && <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">
                            {productSku}
                        </span>
                        {firstItem.lots ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded border border-orange-100 dark:border-orange-800">
                                LOT: {firstItem.lots.code}
                            </span>
                        ) : (firstItem as any).lot_code ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                LOT: {(firstItem as any).lot_code}
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Units List */}
            <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                {items.map(item => {
                    const state = itemStates[item.id] || { qty: '', note: '' }
                    const diff = item.actual_quantity !== null ? item.actual_quantity - item.system_quantity : 0 - item.system_quantity
                    const isItemMatch = item.actual_quantity !== null && diff === 0
                    const isItemMismatch = item.actual_quantity !== null && diff !== 0

                    return (
                        <div key={item.id} className="pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Đơn vị: {item.unit}</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs text-slate-500">Hệ thống:</span>
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                        {formatQuantityFull(item.system_quantity)}
                                    </span>
                                </div>
                                {item.actual_quantity !== null && diff !== 0 && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${diff > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        <span className={`text-[11px] font-bold ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            Lệch: {diff > 0 ? '+' : ''}{formatQuantityFull(diff)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5 w-full sm:w-auto sm:max-w-[200px]">
                                <button
                                    onClick={() => adjustQty(item.id, -1)}
                                    disabled={readonly}
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all ${readonly ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    <Minus size={16} />
                                </button>
                                <QuantityInput
                                    value={state.qty}
                                    onChange={(val) => {
                                        if (readonly) return
                                        setItemStates(prev => ({
                                            ...prev,
                                            [item.id]: { ...prev[item.id], qty: val }
                                        }))
                                    }}
                                    onBlurCustom={() => {
                                        if (readonly || state.qty === '') return
                                        handleSave(item.id, state.qty, state.note)
                                    }}
                                    placeholder="-"
                                    disabled={readonly}
                                    className={`
                                        flex-1 h-9 rounded-lg text-center font-bold text-base outline-none border-2 transition-all
                                        focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10
                                        ${isItemMismatch ? 'border-red-200 text-red-600 bg-red-50/50' : ''}
                                        ${isItemMatch ? 'border-emerald-200 text-emerald-600 bg-emerald-50/50' : ''}
                                        ${item.actual_quantity === null ? 'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700' : ''}
                                        ${readonly ? 'bg-slate-50 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : ''}
                                    `}
                                />
                                <button
                                    onClick={() => adjustQty(item.id, 1)}
                                    disabled={readonly}
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all ${readonly ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    <Plus size={16} />
                                </button>
                                {state.qty !== '' && !readonly && (
                                    <button
                                        onClick={() => {
                                            setItemStates(prev => ({
                                                ...prev,
                                                [item.id]: { ...prev[item.id], qty: '' }
                                            }))
                                            onUpdate(item.id, null as any, state.note)
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                        title="Đặt lại"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Footer Actions: Discussion & Notes Toggle */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowNote(!showNote)}
                        className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${showNote ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <MessageSquare size={14} />
                        {showNote ? 'Ghi chú' : 'Thêm ghi chú'}
                    </button>

                    {allLogs.length > 0 && (
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${showHistory ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <History size={14} />
                            Lịch sử ({allLogs.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Single Note for the Card / Main Product */}
            {showNote && (
                <div className="space-y-1 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ghi chú tổ kiểm kê</label>
                    <div className="flex gap-2">
                        <textarea
                            value={itemStates[firstItem.id]?.note || ''}
                            onChange={(e) => {
                                const newNote = e.target.value
                                setItemStates(prev => {
                                    const next = { ...prev }
                                    // Update note for all units of this product (simpler UX)
                                    items.forEach(i => {
                                        next[i.id] = { ...next[i.id], note: newNote }
                                    })
                                    return next
                                })
                            }}
                            disabled={readonly}
                            placeholder="Giải trình chênh lệch hoặc ghi chú chung cho sản phẩm..."
                            className={`flex-1 text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-orange-500 resize-none ${readonly ? 'cursor-not-allowed opacity-70' : ''}`}
                            rows={2}
                        />
                        {!readonly && (
                            <button
                                onClick={() => {
                                    items.forEach(item => {
                                        const state = itemStates[item.id]
                                        handleSave(item.id, state.qty, state.note)
                                    })
                                }}
                                className="px-3 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-all shadow-sm active:scale-95"
                            >
                                <Check size={20} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Consolidated History / Audit Trail */}
            {showHistory && allLogs.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Luồng trao đổi đối soát</label>
                    {allLogs.map((log) => {
                        const logItem = items.find(i => i.id === log.item_id)
                        const hasSnapshot = Array.isArray(log.snapshot_data) && log.snapshot_data.length > 0

                        return (
                            <div
                                key={log.id}
                                className={`p-3 rounded-xl border text-xs shadow-sm ${log.is_reviewer
                                    ? 'bg-blue-50/40 dark:bg-blue-900/10 border-blue-100/50 dark:border-blue-900/20'
                                    : 'bg-orange-50/40 dark:bg-orange-900/5 border-orange-100/50 dark:border-orange-900/10'
                                    }`}
                            >
                                <div className="flex justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5 font-bold">
                                        {log.is_reviewer ? <ShieldCheck size={12} className="text-blue-600" /> : <MessageSquare size={12} className="text-orange-600" />}
                                        <span className={log.is_reviewer ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}>
                                            {log.user_name || 'Người dùng'} {log.is_reviewer ? '(Quản lý)' : '(Tổ kiểm)'}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString('vi-VN')}</span>
                                </div>
                                <p className="italic mb-2 text-slate-800 dark:text-slate-200">"{log.content}"</p>

                                <div className="space-y-1.5 bg-white/60 dark:bg-black/20 p-2 rounded-lg border border-slate-100 dark:border-slate-800/50">
                                    {hasSnapshot ? (
                                        (log.snapshot_data as any[]).map((snap, idx) => {
                                            const diff = (snap.actual_quantity || 0) - (snap.system_quantity || 0)
                                            return (
                                                <div key={idx} className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono border-b last:border-0 border-slate-100 dark:border-slate-800/30 pb-1 last:pb-0 mb-1 last:mb-0">
                                                    <span className="text-slate-400 font-bold uppercase min-w-[60px]">Đơn vị: {snap.unit}</span>
                                                    <span>HT: <b className="text-slate-700 dark:text-slate-300">{formatQuantityFull(snap.system_quantity || 0)}</b></span>
                                                    <span>TT: <b className="text-blue-600">{snap.actual_quantity !== null ? formatQuantityFull(snap.actual_quantity) : '-'}</b></span>
                                                    <span>Lệch: <b className={diff !== 0 ? 'text-red-500' : 'text-emerald-500'}>
                                                        {diff > 0 ? '+' : ''}{formatQuantityFull(diff)}
                                                    </b></span>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono">
                                            {logItem && <span className="text-slate-400 font-bold uppercase mr-1">Đơn vị: {log.unit || logItem.unit}</span>}
                                            <span>HT: <b className="text-slate-700 dark:text-slate-300">{formatQuantityFull(log.system_quantity || 0)}</b></span>
                                            <span>TT: <b className="text-blue-600">{log.actual_quantity !== null ? formatQuantityFull(log.actual_quantity) : '-'}</b></span>
                                            <span>Lệch: <b className={((log.actual_quantity || 0) - (log.system_quantity || 0)) !== 0 ? 'text-red-500' : 'text-emerald-500'}>
                                                {formatQuantityFull((log.actual_quantity || 0) - (log.system_quantity || 0))}
                                            </b></span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* New Feedback Input */}
            {!readonly || canApprove ? (
                <div className="space-y-1 pt-1">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newFeedback}
                            onChange={(e) => setNewFeedback(e.target.value)}
                            placeholder={canApprove ? "Phản hồi cho tổ kiểm..." : "Giải trình cho người duyệt..."}
                            className={`flex-1 text-xs p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all ${canApprove
                                ? 'border-blue-100 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-900/10 focus:border-blue-500 focus:ring-blue-500/20'
                                : 'border-orange-100 dark:border-orange-900/50 bg-orange-50/10 dark:bg-orange-900/5 focus:border-orange-500 focus:ring-orange-500/20'
                                }`}
                        />
                        <button
                            onClick={() => {
                                // Add feedback to the first item (consolidated view)
                                onAddFeedback(firstItem.id, newFeedback, !!canApprove)
                                setNewFeedback('')
                                setShowHistory(true)
                            }}
                            disabled={!newFeedback.trim()}
                            className={`px-3 rounded-xl text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 ${canApprove ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'
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
