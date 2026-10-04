'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { PackageOpen, X, Check, Trash2, Search, AlertCircle, Info, Lock, Eye } from 'lucide-react'
import { LoosePositionConfig } from '@/app/api/warehouses/positions/loose/route'

export interface LooseTargetPosition {
    id: string
    code: string
    zone_name?: string
    lot_id?: string | null
    lotDetail?: any
}

interface ProductItem {
    id: string
    name: string
    sku?: string
    code?: string
    internal_name?: string
}

interface LoosePositionModalProps {
    isOpen: boolean
    onClose: () => void
    positions: LooseTargetPosition[]
    currentConfig?: LoosePositionConfig | null
    isAlreadyLoose?: boolean
    products: ProductItem[]
    onConfirm: (config: {
        productId?: string | null
        productName: string
        sku?: string | null
        isClosed: boolean
        note?: string
    }) => void
    onRemoveLoose?: () => void
}

export function LoosePositionModal({
    isOpen,
    onClose,
    positions,
    currentConfig,
    isAlreadyLoose = false,
    products = [],
    onConfirm,
    onRemoveLoose
}: LoosePositionModalProps) {
    const [selectedProductId, setSelectedProductId] = useState<string>('')
    const [customProductName, setCustomProductName] = useState<string>('')
    const [productSearch, setProductSearch] = useState<string>('')
    const [isClosed, setIsClosed] = useState<boolean>(true)
    const [note, setNote] = useState<string>('')

    useEffect(() => {
        if (isOpen) {
            if (currentConfig) {
                setSelectedProductId(currentConfig.productId || '')
                setCustomProductName(currentConfig.productName || '')
                setIsClosed(currentConfig.isClosed !== undefined ? currentConfig.isClosed : true)
                setNote(currentConfig.note || '')
            } else {
                setSelectedProductId('')
                setCustomProductName('')
                setIsClosed(true) // Mặc định là Đóng (không tính tồn kho trong tháng)
                setNote('')
            }
            setProductSearch('')
        }
    }, [isOpen, currentConfig])

    const filteredProducts = useMemo(() => {
        if (!productSearch.trim()) return products.slice(0, 50)
        const q = productSearch.toLowerCase().trim()
        return products.filter(p => 
            p.name?.toLowerCase().includes(q) || 
            p.sku?.toLowerCase().includes(q) || 
            p.internal_name?.toLowerCase().includes(q)
        ).slice(0, 50)
    }, [products, productSearch])

    if (!isOpen || positions.length === 0) return null

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault()

        let chosenName = customProductName.trim()
        let chosenSku: string | null = null

        if (selectedProductId) {
            const prod = products.find(p => p.id === selectedProductId)
            if (prod) {
                chosenName = prod.name
                chosenSku = prod.sku || null
            }
        }

        if (!chosenName) {
            alert('Vui lòng chọn hoặc nhập tên chủng loại sản phẩm hàng lẻ!')
            return
        }

        onConfirm({
            productId: selectedProductId || null,
            productName: chosenName,
            sku: chosenSku,
            isClosed,
            note: note.trim()
        })
        onClose()
    }

    return (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-500/10 dark:bg-amber-500/15">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                            <PackageOpen size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">
                                {isAlreadyLoose ? 'Cập Nhật Ô Hàng Lẻ' : 'Thiết Lập Ô Hàng Lẻ'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Gán chủng loại & điều khiển tính tồn kho chốt sổ
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
                    {/* Vị trí áp dụng */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Vị trí áp dụng ({positions.length} ô)
                        </label>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 max-h-24 overflow-y-auto">
                            {positions.map(p => (
                                <span
                                    key={p.id}
                                    className="px-2 py-0.5 text-xs font-mono font-bold bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800/60 shadow-xs"
                                >
                                    {p.code}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Chọn Chủng loại hàng lẻ */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Chủng loại hàng lẻ quy định cho ô này <span className="text-rose-500">*</span>
                        </label>
                        
                        {/* Search & Select dropdown */}
                        <div className="space-y-2">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    placeholder="Tìm theo tên hoặc mã SKU sản phẩm..."
                                    className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                />
                            </div>

                            <select
                                value={selectedProductId}
                                onChange={e => {
                                    setSelectedProductId(e.target.value)
                                    const prod = products.find(p => p.id === e.target.value)
                                    if (prod) {
                                        setCustomProductName(prod.name)
                                    }
                                }}
                                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium"
                            >
                                <option value="">-- Chọn sản phẩm có sẵn trong danh mục --</option>
                                {filteredProducts.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.sku ? `(${p.sku})` : ''}
                                    </option>
                                ))}
                            </select>

                            <div className="pt-1">
                                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                                    Hoặc tự nhập tên chủng loại hiển thị:
                                </label>
                                <input
                                    type="text"
                                    value={customProductName}
                                    onChange={e => {
                                        setCustomProductName(e.target.value)
                                        if (selectedProductId) setSelectedProductId('')
                                    }}
                                    placeholder="Ví dụ: TP cấp đông sầu riêng múi ri 6 A (1 túi)"
                                    className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Cơ chế Đóng / Mở Tính tồn kho */}
                    <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-xl space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                            <Info size={14} className="text-amber-600 shrink-0" />
                            <span>Trạng thái tính tồn kho chốt sổ:</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {/* Nút chọn Đóng */}
                            <button
                                type="button"
                                onClick={() => setIsClosed(true)}
                                className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                    isClosed
                                        ? 'bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-100 ring-2 ring-amber-400/40'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                                    isClosed ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300'
                                }`}>
                                    {isClosed && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                                <div>
                                    <div className="text-xs font-bold flex items-center gap-1">
                                        ⏸️ ĐÓNG (Tạm ẩn tồn)
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                        Trong tháng: Thao tác kho bình thường, không tính vào báo cáo tồn kho để tránh sai lệch.
                                    </div>
                                </div>
                            </button>

                            {/* Nút chọn Mở */}
                            <button
                                type="button"
                                onClick={() => setIsClosed(false)}
                                className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                    !isClosed
                                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-400/40'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                                    !isClosed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                                }`}>
                                    {!isClosed && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                                <div>
                                    <div className="text-xs font-bold flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                                        🟢 MỞ (Tính vào tồn)
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                        Đầu tháng: Tính số lượng ô lẻ này vào báo cáo tồn kho để chốt số liệu kế toán.
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Ghi chú thêm */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Ghi chú vị trí (tùy chọn)
                        </label>
                        <input
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Ví dụ: Chỉ để khay lẻ múi loại A..."
                            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                    </div>

                    {/* Footer Buttons */}
                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                        {isAlreadyLoose && onRemoveLoose ? (
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm('Bạn có chắc muốn hủy chế độ Ô Hàng Lẻ cho các vị trí này?')) {
                                        onRemoveLoose()
                                        onClose()
                                    }
                                }}
                                className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <Trash2 size={14} />
                                <span>Bỏ ô hàng lẻ</span>
                            </button>
                        ) : <div />}

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/20 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <Check size={14} />
                                <span>Lưu thiết lập</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
