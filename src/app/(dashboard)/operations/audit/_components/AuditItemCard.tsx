'use client'

import { useState, useEffect, useRef } from 'react'
import { InventoryCheckItem } from '../_hooks/useAudit'
import { Check, AlertTriangle, MessageSquare, Package, Minus, Plus, X } from 'lucide-react'
import { formatQuantityFull } from '@/lib/numberUtils'
import { QuantityInput } from '@/components/ui/QuantityInput'
import Image from 'next/image'

interface AuditItemCardProps {
    item: InventoryCheckItem
    onUpdate: (id: string, qty: number, note?: string) => void
}

export function AuditItemCard({ item, onUpdate }: AuditItemCardProps) {
    const [qty, setQty] = useState<number | ''>(item.actual_quantity !== null ? item.actual_quantity : '')
    const [note, setNote] = useState(item.note || '')
    const [showNote, setShowNote] = useState(!!item.note)

    // Update local state when prop changes (e.g. from quick fill)
    useEffect(() => {
        setQty(item.actual_quantity !== null ? item.actual_quantity : '')
    }, [item.actual_quantity])

    const handleSave = (newQty: number | '') => {
        if (typeof newQty === 'number') {
            onUpdate(item.id, newQty, note)
        }
    }

    const handleBlur = () => {
        if (qty === '') return
        handleSave(qty)
    }

    const adjustQty = (delta: number) => {
        const current = typeof qty === 'number' ? qty : 0
        const newVal = Math.max(0, current + delta)
        setQty(newVal)
        handleSave(newVal)
    }

    const isMatch = item.actual_quantity !== null && item.difference === 0
    const isMismatch = item.actual_quantity !== null && item.difference !== 0
    const isUncounted = item.actual_quantity === null

    return (
        <div className={`
            relative flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-200
            ${isMatch ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800' : ''}
            ${isMismatch ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-800' : ''}
            ${isUncounted ? 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800' : ''}
        `}>
            {/* Header: Product Info */}
            <div className="flex gap-3">
                <div className="w-12 h-12 relative rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                    {item.products?.image_url ? (
                        <Image
                            src={item.products.image_url}
                            alt={item.products.name}
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
                            {item.products?.name}
                        </h4>
                        {isMatch && <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />}
                        {isMismatch && <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                            {item.products?.sku}
                        </span>
                        {item.lots && (
                            <span className="text-xs font-medium text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded border border-orange-100 dark:border-orange-800">
                                {item.lots.code}
                            </span>
                        )}
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
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all"
                        >
                            <Minus size={18} />
                        </button>
                        <QuantityInput
                            value={qty}
                            onChange={(val) => setQty(val)}
                            onBlurCustom={handleBlur}
                            placeholder="-"
                            className={`
                                flex-1 h-10 rounded-xl text-center font-bold text-lg outline-none border-2 transition-all
                                focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10
                                ${isMismatch ? 'border-red-200 text-red-600 bg-red-50/50' : ''}
                                ${isMatch ? 'border-emerald-200 text-emerald-600 bg-emerald-50/50' : ''}
                                ${isUncounted ? 'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700' : ''}
                            `}
                        />
                        <button
                            onClick={() => adjustQty(1)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                    {qty !== '' && (
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

            {/* Note & Diff */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/50">
                <button
                    onClick={() => setShowNote(!showNote)}
                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${note ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <MessageSquare size={14} />
                    {note ? 'Sửa ghi chú' : 'Ghi chú'}
                </button>

                {item.actual_quantity !== null && item.difference !== 0 && (
                    <span className={`text-xs font-bold ${item.difference > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        Lệch: {item.difference > 0 ? '+' : ''}{formatQuantityFull(item.difference)}
                    </span>
                )}
            </div>

            {showNote && (
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={() => onUpdate(item.id, (typeof qty === 'number' ? qty : 0), note)}
                    placeholder="Nhập ghi chú kiểm kê..."
                    className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-orange-500 resize-none"
                    rows={2}
                />
            )}
        </div>
    )
}
