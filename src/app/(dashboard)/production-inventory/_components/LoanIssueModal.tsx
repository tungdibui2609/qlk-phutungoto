'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, Search, Factory, Package, RefreshCw, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { productionLoanService } from '@/services/production-inventory/productionLoanService'
import { QuantityInput } from '@/components/ui/QuantityInput'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { Combobox, ComboboxOption } from '@/components/ui/Combobox'
import { lotService } from '@/services/warehouse/lotService'
import { formatQuantityFull } from '@/lib/numberUtils'

interface LoanIssueModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    existingBatchId?: string
    defaultWorkerName?: string
    defaultProductionId?: string
}

export const LoanIssueModal: React.FC<LoanIssueModalProps> = ({ isOpen, onClose, onSuccess, existingBatchId, defaultWorkerName, defaultProductionId }) => {
    const { systemType } = useSystem()
    const { showToast } = useToast()
    const [selectedItems, setSelectedItems] = useState<any[]>([])
    const [inventory, setInventory] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // Common Form Data
    const [workerName, setWorkerName] = useState('')
    const [borrowerOptions, setBorrowerOptions] = useState<ComboboxOption[]>([])
    const [fetchingBorrowers, setFetchingBorrowers] = useState(false)
    const [selectedProductionId, setSelectedProductionId] = useState<string>('')
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)

    // Production Order Selection
    const { profile } = useUser()
    const [productions, setProductions] = useState<any[]>([])
    const [fetchingProductions, setFetchingProductions] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchInventory()
            fetchBorrowers()
            fetchProductions()
            setSelectedItems([])
            setWorkerName(defaultWorkerName || '')
            setSelectedProductionId(defaultProductionId || '')
            setNotes('')
        }
    }, [isOpen, systemType, profile?.company_id])

    async function fetchBorrowers() {
        if (!systemType) return
        setFetchingBorrowers(true)
        try {
            const { data: members } = await (supabase.from('construction_members') as any)
                .select('id, full_name')
                .eq('system_code', systemType)
                .eq('is_active', true)

            const { data: teams } = await (supabase.from('construction_teams') as any)
                .select('id, name')
                .eq('system_code', systemType)

            const options: ComboboxOption[] = []
            if (members) members.forEach((m: any) => options.push({ value: m.full_name, label: `[Thành viên] ${m.full_name}`, type: 'member', id: m.id }))
            if (teams) teams.forEach((t: any) => options.push({ value: t.name, label: `[Đội] ${t.name}`, type: 'team', id: t.id }))
            setBorrowerOptions(options)
        } catch (err) {
            console.error('Error fetching borrowers:', err)
        } finally {
            setFetchingBorrowers(false)
        }
    }

    async function fetchProductions() {
        if (!profile?.company_id) return
        setFetchingProductions(true)
        try {
            const data = await productionLoanService.getInProgressProductions(supabase, profile.company_id)
            setProductions(data || [])
        } catch (err) {
            console.error('Error fetching productions:', err)
        } finally {
            setFetchingProductions(false)
        }
    }

    async function fetchInventory() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('lot_items')
                .select(`
                    quantity, unit,
                    products!inner (id, name, sku),
                    lots!inner (system_code),
                    lot_tags (tag)
                `)
                .eq('lots.system_code', systemType)
                .gt('quantity', 0)

            if (error) {
                console.error('Fetch Inventory Error:', error)
            } else {
                const grouped: Record<string, any> = {}
                data?.forEach((item: any) => {
                    const p = item.products as any
                    const tag = item.lot_tags && item.lot_tags.length > 0 ? item.lot_tags[0].tag : null
                    const key = `${p.id}-${item.unit}-${tag || 'no-tag'}`
                    
                    if (!grouped[key]) {
                        grouped[key] = {
                            id: key, 
                            productId: p.id,
                            name: p.name,
                            sku: p.sku,
                            unit: item.unit,
                            tag: tag,
                            quantity: 0
                        }
                    }
                    grouped[key].quantity += Number(item.quantity)
                })
                setInventory(Object.values(grouped))
            }
        } catch (err) {
            console.error('Error fetching inventory:', err)
        } finally {
            setLoading(false)
        }
    }

    const filteredInventory = inventory.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const getDateColor = (dateKey: string) => {
        const colors = [
            'bg-blue-50 text-blue-600 border-blue-200',
            'bg-purple-50 text-purple-600 border-purple-200',
            'bg-orange-50 text-orange-600 border-orange-200',
            'bg-green-50 text-green-600 border-green-200',
            'bg-rose-50 text-rose-600 border-rose-200',
            'bg-indigo-50 text-indigo-600 border-indigo-200'
        ]
        let hash = 0
        for (let i = 0; i < dateKey.length; i++) {
            hash = dateKey.charCodeAt(i) + ((hash << 5) - hash)
        }
        return colors[Math.abs(hash) % colors.length]
    }

    const addItem = (item: any) => {
        const now = new Date()
        const cartId = `${item.id}-${now.getTime()}`
        const dateKey = now.toISOString().split('T')[0] // YYYY-MM-DD
        setSelectedItems([...selectedItems, { 
            ...item, 
            cartId, 
            issueQuantity: 1,
            addedAt: now.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
            dateKey
        }])
    }

    const removeItem = (cartId: string) => {
        setSelectedItems(selectedItems.filter(i => i.cartId !== cartId))
    }

    const updateItemQuantity = (cartId: string, qty: number) => {
        setSelectedItems(selectedItems.map(i => i.cartId === cartId ? { ...i, issueQuantity: qty } : i))
    }

    const handleSubmit = async () => {
        if (!workerName) return showToast('Vui lòng nhập tên người nhận', 'warning')
        if (selectedItems.length === 0) return showToast('Vui lòng chọn ít nhất một mặt hàng', 'warning')
        
        // Validation quantities per item and total per product unit
        const totals: Record<string, number> = {}
        for (const item of selectedItems) {
            if (item.issueQuantity <= 0) return showToast(`Số lượng ${item.name} không hợp lệ`, 'warning')
            totals[item.id] = (totals[item.id] || 0) + item.issueQuantity
        }

        for (const itemId in totals) {
            const invItem = inventory.find(i => i.id === itemId)
            if (totals[itemId] > (invItem?.quantity || 0)) {
                return showToast(`Tổng số lượng ${invItem?.name} (${totals[itemId]}) vượt quá tồn kho (${invItem?.quantity})`, 'warning')
            }
        }

        setSubmitting(true)
        try {
            // Use existing batch ID if appending, or generate a new one
            const batchId = existingBatchId || crypto.randomUUID()

            // Process batch issuance
            for (const item of selectedItems) {
                await productionLoanService.issueLoanFIFO({
                    supabase,
                    productId: item.productId,
                    workerName,
                    totalQuantity: item.issueQuantity,
                    unit: item.unit,
                    systemCode: systemType as string,
                    productionId: selectedProductionId || undefined,
                    notes,
                    tag: item.tag || undefined,
                    batchId
                })
            }

            showToast(`Đã cấp phát thành công ${selectedItems.length} lượt cấp phát`, 'success')
            onSuccess()
            onClose()
        } catch (e: any) {
            showToast(e.message, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-6xl w-full max-h-[92vh] shadow-2xl overflow-hidden flex flex-col border-4 border-white dark:border-zinc-800">
                {/* Header */}
                <div className="px-5 py-3 border-b border-stone-100 dark:border-zinc-800 flex justify-between items-center bg-stone-50/50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-500/20">
                            <Factory size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-stone-900 dark:text-white uppercase tracking-tight">
                                Phiếu Cấp Phát Vật Tư
                            </h3>
                            <p className="text-[10px] text-stone-400 font-bold">Batch Issuance</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
                    >
                        <X className="text-stone-400" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-12">
                    {/* Left: Inventory Selection */}
                    <div className="col-span-12 lg:col-span-5 border-r border-stone-100 dark:border-zinc-800 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-zinc-900">
                        <div className="p-6 space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                                <input
                                    className="w-full pl-10 p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-800 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm transition-all"
                                    placeholder="Tìm tên vật tư, mã SKU..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="text-[10px] font-black uppercase text-stone-400 tracking-widest pl-1">
                                Danh sách tồn kho ({filteredInventory.length})
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-2 custom-scrollbar">
                            {loading ? (
                                <div className="text-center py-20 flex flex-col items-center gap-3">
                                    <RefreshCw className="animate-spin text-blue-500" size={32} />
                                    <span className="text-sm font-bold text-stone-400">Đang tải tồn kho...</span>
                                </div>
                            ) : filteredInventory.length === 0 ? (
                                <div className="text-center py-20 text-stone-400 font-bold">Không tìm thấy vật tư nào</div>
                            ) : (
                                filteredInventory.map(item => {
                                    const isSelected = selectedItems.find(i => i.id === item.id)
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => addItem(item)}
                                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group
                                                ${selectedItems.some(i => i.id === item.id)
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md shadow-blue-500/5' 
                                                    : 'border-stone-50 dark:border-zinc-800 hover:border-stone-200 dark:hover:border-zinc-700 bg-stone-50/30 dark:bg-zinc-800/30'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                                                    ${selectedItems.some(i => i.id === item.id) ? 'bg-blue-500 text-white' : 'bg-stone-200 dark:bg-zinc-700 text-stone-500'}
                                                `}>
                                                    {selectedItems.some(i => i.id === item.id) ? (
                                                        <div className="flex flex-col items-center leading-none">
                                                            <Check size={16} />
                                                            <span className="text-[9px] font-black mt-0.5">{selectedItems.filter(i => i.id === item.id).length}</span>
                                                        </div>
                                                    ) : <Package size={20} />}
                                                </div>
                                                <div>
                                                    <div className="font-black text-stone-800 dark:text-gray-100 text-sm leading-tight flex items-center gap-2">
                                                        {item.name}
                                                        {item.tag && (
                                                            <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-[9px] font-black font-mono">
                                                                {item.tag.replace('@', item.sku)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-stone-400 font-bold uppercase tracking-tighter mt-0.5">{item.sku}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-sm text-stone-700 dark:text-stone-300">
                                                    {formatQuantityFull(item.quantity)}
                                                </div>
                                                <div className="text-[9px] font-black text-stone-400 uppercase">{item.unit}</div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Right: Cart & General Info */}
                    <div className="col-span-12 lg:col-span-7 flex flex-col overflow-hidden bg-stone-50/30 dark:bg-zinc-900/30">
                        <div className="p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-black text-stone-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                    <Package size={16} className="text-blue-500" />
                                    Danh sách vật tư chờ cấp ({selectedItems.length})
                                </h4>
                                {selectedItems.length > 0 && (
                                    <button 
                                        onClick={() => setSelectedItems([])}
                                        className="text-[10px] font-black text-red-500 hover:underline uppercase tracking-widest"
                                    >
                                        Xóa tất cả
                                    </button>
                                )}
                            </div>

                            {/* Scrollable Area: Cart + General Info */}
                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                                {/* Cart List */}
                                <div className="space-y-3">
                                    {selectedItems.length === 0 ? (
                                        <div className="py-20 flex flex-col items-center justify-center opacity-40">
                                            <ArrowLeft className="text-stone-400 mb-4 animate-bounce-x" size={48} />
                                            <p className="text-stone-500 font-black uppercase text-sm text-center">Hãy chọn vật tư bên trái để bắt đầu</p>
                                        </div>
                                    ) : (
                                        selectedItems.map((item, idx) => (
                                            <div key={item.cartId} className="p-3 bg-white dark:bg-zinc-800 rounded-2xl border border-stone-100 dark:border-zinc-700 shadow-sm">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                        <span className="w-5 h-5 flex-shrink-0 rounded-full bg-stone-100 dark:bg-zinc-700 text-[9px] font-black flex items-center justify-center text-stone-500">#{idx + 1}</span>
                                                        <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-black font-mono flex-shrink-0 ${getDateColor(item.dateKey)}`}>
                                                            {item.addedAt}
                                                        </span>
                                                        <div className="font-black text-stone-900 dark:text-white text-sm truncate">
                                                            {item.name}
                                                        </div>
                                                        {item.tag && (
                                                            <span className="px-1 py-0.5 rounded bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 text-[9px] font-bold font-mono">
                                                                {item.tag.replace('@', item.sku)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button onClick={() => removeItem(item.cartId)} className="p-1 text-stone-400 hover:text-red-500 transition-all"><X size={14} /></button>
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <QuantityInput value={item.issueQuantity} onChange={(val) => updateItemQuantity(item.cartId, val)} className="w-24 bg-stone-50 dark:bg-zinc-900 p-1.5 rounded-xl border-none font-black text-base focus:ring-1 focus:ring-blue-500" />
                                                        <span className="font-black text-stone-400 uppercase text-[10px]">{item.unit}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[9px] font-black text-stone-400 uppercase mr-1">Tồn:</span>
                                                        <span className="text-xs font-black text-blue-600">{formatQuantityFull(item.quantity)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* General Info */}
                                {selectedItems.length > 0 && (
                                    <div className="pt-6 border-t-2 border-dashed border-stone-200 dark:border-zinc-700 grid grid-cols-2 gap-4 pb-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest pl-1">Người nhận <span className="text-red-500">*</span></label>
                                            <Combobox options={borrowerOptions} value={workerName} onChange={(val) => setWorkerName(val || '')} placeholder="Tìm hoặc nhập..." isLoading={fetchingBorrowers} allowCustom={true} className="w-full h-10" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest pl-1">Lệnh Sản Xuất</label>
                                            <select value={selectedProductionId} onChange={e => setSelectedProductionId(e.target.value)} className="w-full h-10 px-3 rounded-xl border-2 border-stone-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-blue-500 font-bold text-xs transition-all cursor-pointer">
                                                <option value="">-- Tự do --</option>
                                                {productions.map(p => <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-2 space-y-1.5">
                                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest pl-1">Ghi chú phiếu cấp</label>
                                            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border-2 border-stone-100 dark:border-zinc-700 outline-none focus:border-blue-500 h-16 resize-none font-medium text-xs transition-all" placeholder="Ghi chú chung..." />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer - OUTSIDE Grid, direct child of Modal */}
                <div className="px-4 py-3 border-t border-stone-100 dark:border-zinc-800 flex justify-end items-center gap-3 bg-white dark:bg-zinc-800 flex-shrink-0">
                    <div className="mr-auto px-3 py-1 bg-stone-100 dark:bg-zinc-700 rounded-full text-[10px] font-black text-stone-500 uppercase tracking-tighter">
                        {selectedItems.length > 0 ? `${selectedItems.length} lượt cấp` : 'Chưa có hàng'}
                    </div>
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 rounded-xl text-stone-500 font-black uppercase text-[10px] tracking-widest hover:bg-stone-100 dark:hover:bg-zinc-700 transition-all"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || selectedItems.length === 0}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 disabled:opacity-30 disabled:shadow-none transition-all flex items-center gap-2 active:scale-95"
                    >
                        {submitting ? (
                            <><RefreshCw className="animate-spin" size={14} /> Đang lưu...</>
                        ) : (
                            <><Check size={16} /> Lưu phiếu</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
