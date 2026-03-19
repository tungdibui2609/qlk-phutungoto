'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, Search, HardHat, Package } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { loanService } from '@/services/site-inventory/loanService'
import { QuantityInput } from '@/components/ui/QuantityInput'
import { useSystem } from '@/contexts/SystemContext'
import { Combobox, ComboboxOption } from '@/components/ui/Combobox'
import { lotService } from '@/services/warehouse/lotService'

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
    const [borrowerOptions, setBorrowerOptions] = useState<ComboboxOption[]>([])
    const [fetchingBorrowers, setFetchingBorrowers] = useState(false)
    const [quantity, setQuantity] = useState(0)
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchInventory()
            fetchBorrowers()
            setStep(1)
            setSelectedItem(null)
            setWorkerName('')
            setQuantity(0)
            setNotes('')
        }
    }, [isOpen, systemType])

    async function fetchBorrowers() {
        if (!systemType) return
        setFetchingBorrowers(true)
        try {
            // Fetch members
            const { data: members, error: mError } = await (supabase.from('construction_members') as any)
                .select('id, full_name')
                .eq('system_code', systemType)
                .eq('is_active', true)

            // Fetch teams
            const { data: teams, error: tError } = await (supabase.from('construction_teams') as any)
                .select('id, name')
                .eq('system_code', systemType)

            const options: ComboboxOption[] = []

            if (members) {
                members.forEach((m: any) => {
                    options.push({
                        value: m.full_name, // Store name directly as it was previously a text field
                        label: `[Thành viên] ${m.full_name}`,
                        type: 'member',
                        id: m.id
                    })
                })
            }

            if (teams) {
                teams.forEach((t: any) => {
                    options.push({
                        value: t.name,
                        label: `[Đội] ${t.name}`,
                        type: 'team',
                        id: t.id
                    })
                })
            }

            setBorrowerOptions(options)
        } catch (err) {
            console.error('Error fetching borrowers:', err)
        } finally {
            setFetchingBorrowers(false)
        }
    }

    async function fetchInventory() {
        setLoading(true)
        // Fetch lot_items directly to issue specific items
        // Filter by products and lots system_code to ensure isolation

        const { data, error } = await supabase
            .from('lot_items')
            .select(`
                id, quantity, unit,
                products!inner (id, name, sku, system_type),
                lots!inner (id, code, warehouse_name, system_code)
            `)
            .eq('lots.system_code', systemType)
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
                systemCode: systemType as string,
                notes
            })

            // C. Sync LOT Status and Quantity
            await lotService.syncLotStatus({
                supabase,
                lotId: selectedItem.lots.id,
                isSiteIssuance: true
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
                                <Combobox
                                    options={borrowerOptions}
                                    value={workerName}
                                    onChange={(val) => setWorkerName(val || '')}
                                    placeholder="Chọn hoặc nhập tên người mượn..."
                                    isLoading={fetchingBorrowers}
                                    allowCustom={true}
                                    className="w-full"
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
