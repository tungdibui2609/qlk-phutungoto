'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, Search, HardHat, Package } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { loanService } from '@/services/site-inventory/loanService'
import { QuantityInput } from '@/components/ui/QuantityInput'
import { useSystem } from '@/contexts/SystemContext'

interface LoanIssueModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export const LoanIssueModal: React.FC<LoanIssueModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { systemType } = useSystem()
    const { showToast } = useToast()
    const [step, setStep] = useState<1 | 2>(1) // 1: Select Item, 2: Enter Details
    const [selectedItem, setSelectedItem] = useState<any>(null)
    const [inventory, setInventory] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // Form Data
    const [workerName, setWorkerName] = useState('')
    const [quantity, setQuantity] = useState(0)
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchInventory()
            setStep(1)
            setSelectedItem(null)
            setWorkerName('')
            setQuantity(0)
            setNotes('')
        }
    }, [isOpen])

    async function fetchInventory() {
        setLoading(true)
        // Fetch lot_items directly to issue specific items
        // In a real app we might group by product, but for loans tracking specific lot items (assets) is good.
        // Or we show products and then auto-pick items. 
        // Let's list Product Stocks aggregated for simpler UI, or list Items. 
        // For Tools, usually we want to see "Drill A - Serial 123", so lot items.

        // This query fetches available items.
        const { data, error } = await supabase
            .from('lot_items')
            .select(`
                id, quantity, unit,
                products!inner (id, name, sku, system_type),
                lots!inner (code, warehouse_name)
            `)
            .eq('products.system_type', systemType)
            .gt('quantity', 0)
            .limit(50)

        if (error) {
            console.error('Fetch Inventory Error:', JSON.stringify(error, null, 2))
        } else {
            setInventory(data || [])
        }
        setLoading(false)
    }

    const filteredInventory = inventory.filter(item =>
        item.products.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.products.sku.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleNext = () => {
        if (!selectedItem) return
        setStep(2)
        // Default max qty
        setQuantity(1)
    }

    const handleSubmit = async () => {
        if (!workerName) return showToast('Vui lòng nhập tên người mượn', 'warning')
        if (quantity <= 0) return showToast('Số lượng không hợp lệ', 'warning')
        if (quantity > selectedItem.quantity) return showToast('Số lượng vượt quá tồn kho', 'warning')

        setSubmitting(true)
        try {
            // 1. Issue Loan Record and Decrement Stock
            // Note: Currently we only insert loan record. 
            // In a real implementation we MUST decrement the lot_item quantity.
            // Using a RPC or transaction is best.
            // For now, I'll do client-side: Update Lot Item -> Insert Loan.

            // A. Decrement Lot Item
            const newQty = selectedItem.quantity - quantity
            const { error: updateError } = await (supabase.from('lot_items') as any)
                .update({ quantity: newQty })
                .eq('id', selectedItem.id)

            if (updateError) throw updateError

            // B. Create Loan
            await loanService.issueLoan({
                supabase,
                lotItemId: selectedItem.id,
                productId: selectedItem.products.id,
                workerName,
                quantity,
                unit: selectedItem.unit,
                notes
            })

            showToast('Đã ghi nhận mượn công cụ', 'success')
            onSuccess()
            onClose()
        } catch (e: any) {
            showToast(e.message, 'error')
            // Revert logic would be needed here in production if step A succeeded but B failed
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-stone-100 dark:border-zinc-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <HardHat className="text-orange-500" />
                        Cho Mượn Công Cụ
                    </h3>
                    <button onClick={onClose}><X className="text-stone-400" /></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {step === 1 ? (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                                <input
                                    className="w-full pl-10 p-3 rounded-xl bg-stone-50 dark:bg-zinc-800 border-none outline-none font-medium"
                                    placeholder="Tìm công cụ, thiết bị..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                {loading ? (
                                    <div className="text-center py-8 text-stone-400">Đang tải...</div>
                                ) : filteredInventory.length === 0 ? (
                                    <div className="text-center py-8 text-stone-400">Không tìm thấy công cụ nào</div>
                                ) : (
                                    filteredInventory.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => setSelectedItem(item)}
                                            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${selectedItem?.id === item.id
                                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                                : 'border-stone-200 dark:border-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-800'
                                                }`}
                                        >
                                            <div>
                                                <div className="font-bold text-stone-800 dark:text-gray-100">{item.products.name}</div>
                                                <div className="text-xs text-stone-500">{item.products.sku} • {item.lots.code}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono font-bold">{item.quantity} <span className="text-xs text-stone-400">{item.unit}</span></div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in slide-in-from-right-5 duration-200">
                            <div className="p-4 rounded-xl bg-stone-50 dark:bg-zinc-800 flex items-center gap-3">
                                <Package className="text-orange-500" />
                                <div>
                                    <div className="font-bold">{selectedItem.products.name}</div>
                                    <div className="text-xs text-stone-500">Tồn kho: {selectedItem.quantity} {selectedItem.unit}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-stone-500">Người mượn / Tổ đội <span className="text-red-500">*</span></label>
                                <input
                                    value={workerName}
                                    onChange={e => setWorkerName(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-bold outline-none focus:border-orange-500"
                                    placeholder="Nhập tên người mượn..."
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-stone-500">Số lượng mượn</label>
                                <div className="flex items-center gap-2">
                                    <QuantityInput
                                        value={quantity}
                                        onChange={setQuantity}
                                        className="w-32 p-3 text-center font-bold text-xl rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    />
                                    <span className="font-bold text-stone-500">{selectedItem.unit}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-stone-500">Ghi chú (Tình trạng, ...)</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:border-orange-500 h-24 resize-none"
                                    placeholder="Ghi chú thêm..."
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-stone-100 dark:border-zinc-800 flex justify-end gap-3">
                    {step === 2 && (
                        <button onClick={() => setStep(1)} className="px-6 py-2.5 rounded-xl text-stone-500 font-bold hover:bg-stone-100">
                            Quay lại
                        </button>
                    )}
                    {step === 1 ? (
                        <button
                            onClick={handleNext}
                            disabled={!selectedItem}
                            className="px-6 py-2.5 bg-orange-600 text-white rounded-xl font-bold disabled:opacity-50"
                        >
                            Tiếp tục
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="px-8 py-2.5 bg-orange-600 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
                        >
                            {submitting ? 'Đang xử lý...' : <> <Check size={18} /> Xác nhận mượn </>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
