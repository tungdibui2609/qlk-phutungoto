'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { X, Loader2, Warehouse, Search, UserPlus, Trash2 } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'

interface CreateAuditModalProps {
    isOpen: boolean
    onClose: () => void
    onCreate: (
        warehouseId: string | null,
        warehouseName: string | null,
        note: string,
        scope: 'ALL' | 'PARTIAL',
        productIds: string[],
        participants: { name: string, role: string }[]
    ) => Promise<any>
}

export function CreateAuditModal({ isOpen, onClose, onCreate }: CreateAuditModalProps) {
    const { currentSystem } = useSystem()
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [warehouses, setWarehouses] = useState<{ id: string, name: string }[]>([])

    // Form State
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
    const [note, setNote] = useState('')
    const [scope, setScope] = useState<'ALL' | 'PARTIAL'>('ALL')
    const [participants, setParticipants] = useState<{ name: string, role: string }[]>([
        { name: '', role: 'Kiểm kê viên' }
    ])

    // Product Search
    const [productSearch, setProductSearch] = useState('')
    const [products, setProducts] = useState<{ id: string, name: string, sku: string }[]>([])
    const [selectedProducts, setSelectedProducts] = useState<{ id: string, name: string, sku: string }[]>([])
    const [searchingProducts, setSearchingProducts] = useState(false)

    useEffect(() => {
        if (isOpen && currentSystem) {
            fetchWarehouses()
        }
    }, [isOpen, currentSystem])

    useEffect(() => {
        const timer = setTimeout(() => {
            if (productSearch.trim()) searchProducts(productSearch)
        }, 500)
        return () => clearTimeout(timer)
    }, [productSearch])

    const fetchWarehouses = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('branches')
            .select('id, name')
            .order('is_default', { ascending: false })
            .order('name')
        if (data) setWarehouses(data)
        setLoading(false)
    }

    const searchProducts = async (q: string) => {
        setSearchingProducts(true)
        const { data } = await supabase
            .from('products')
            .select('id, name, sku')
            .ilike('name', `%${q}%`)
            .limit(5)

        if (data) setProducts(data)
        setSearchingProducts(false)
    }

    const addProduct = (prod: { id: string, name: string, sku: string }) => {
        if (!selectedProducts.find(p => p.id === prod.id)) {
            setSelectedProducts([...selectedProducts, prod])
        }
        setProductSearch('')
        setProducts([])
    }

    const removeProduct = (id: string) => {
        setSelectedProducts(selectedProducts.filter(p => p.id !== id))
    }

    const updateParticipant = (index: number, field: 'name' | 'role', value: string) => {
        const newPart = [...participants]
        newPart[index] = { ...newPart[index], [field]: value }
        setParticipants(newPart)
    }

    const addParticipant = () => {
        setParticipants([...participants, { name: '', role: 'Kiểm kê viên' }])
    }

    const removeParticipant = (index: number) => {
        if (participants.length > 1) {
            setParticipants(participants.filter((_, i) => i !== index))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)

        let whName = null
        if (selectedWarehouseId) {
            const wh = warehouses.find(w => w.id === selectedWarehouseId)
            if (wh) whName = wh.name
        }

        await onCreate(
            selectedWarehouseId || null,
            whName,
            note,
            scope,
            selectedProducts.map(p => p.id),
            participants.filter(p => p.name.trim() !== '')
        )
        setSubmitting(false)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 dark:border-slate-800 my-8">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-lg">Tạo phiếu kiểm kê mới</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* 1. Scope & Warehouse */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Kho kiểm kê</label>
                            <select
                                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                value={selectedWarehouseId}
                                onChange={e => setSelectedWarehouseId(e.target.value)}
                            >
                                <option value="">Tất cả kho</option>
                                {warehouses.map(wh => (
                                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Phạm vi sản phẩm</label>
                            <select
                                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                value={scope}
                                onChange={e => setScope(e.target.value as any)}
                            >
                                <option value="ALL">Toàn bộ sản phẩm</option>
                                <option value="PARTIAL">Tùy chọn sản phẩm</option>
                            </select>
                        </div>
                    </div>

                    {/* 2. Product Selection (If Partial) */}
                    {scope === 'PARTIAL' && (
                        <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Chọn sản phẩm</label>
                            <div className="relative">
                                <input
                                    className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
                                    placeholder="Tìm kiếm sản phẩm..."
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                />
                                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                                {searchingProducts && <Loader2 size={16} className="absolute right-3 top-2.5 animate-spin text-orange-500" />}

                                {products.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                                        {products.map(p => (
                                            <div
                                                key={p.id}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm"
                                                onClick={() => addProduct(p)}
                                            >
                                                <span className="font-bold">{p.sku}</span> - {p.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected List */}
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                {selectedProducts.map(p => (
                                    <div key={p.id} className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                        <span>{p.sku}</span>
                                        <button type="button" onClick={() => removeProduct(p.id)} className="hover:text-red-500"><X size={12} /></button>
                                    </div>
                                ))}
                                {selectedProducts.length === 0 && <span className="text-xs text-slate-400 italic">Chưa chọn sản phẩm nào</span>}
                            </div>
                        </div>
                    )}

                    {/* 3. Participants */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tổ kiểm kê</label>
                            <button type="button" onClick={addParticipant} className="text-xs text-orange-600 font-bold flex items-center gap-1 hover:underline">
                                <UserPlus size={14} /> Thêm người
                            </button>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {participants.map((p, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input
                                        className="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
                                        placeholder="Họ tên"
                                        value={p.name}
                                        onChange={e => updateParticipant(idx, 'name', e.target.value)}
                                    />
                                    <input
                                        className="w-1/3 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
                                        placeholder="Chức vụ"
                                        value={p.role}
                                        onChange={e => updateParticipant(idx, 'role', e.target.value)}
                                    />
                                    {participants.length > 1 && (
                                        <button type="button" onClick={() => removeParticipant(idx)} className="text-slate-400 hover:text-red-500">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ghi chú</label>
                        <textarea
                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none"
                            rows={2}
                            placeholder="Nhập lý do kiểm kê, ghi chú..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Tạo phiếu kiểm kê'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
