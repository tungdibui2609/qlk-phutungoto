'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { X, Plus, Trash2, Save, ShoppingCart } from 'lucide-react'
import { Combobox } from '@/components/ui/Combobox'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/ToastProvider'

// Force update
type Product = Database['public']['Tables']['products']['Row']
type Customer = { id: string, name: string, address?: string | null, phone?: string | null }

interface OutboundOrderModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

const generateOrderCode = async (type: 'PNK' | 'PXK') => {
    const today = new Date()
    const d = String(today.getDate()).padStart(2, '0')
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const y = String(today.getFullYear()).slice(2)
    const dateStr = `${d}${m}${y}` // DDMMYY

    // Get start and end of today for query
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString()
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString()

    const tableName = type === 'PNK' ? 'inbound_orders' : 'outbound_orders'

    // Count existing orders today
    const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)

    if (error) {
        console.error('Error counting orders:', error)
        // Fallback to random if error
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
        return `${type}-${dateStr}-${random}`
    }

    const stt = String((count || 0) + 1).padStart(3, '0')
    return `${type}-${dateStr}-${stt}`
}

interface OrderItem {
    id: string
    productId: string
    productName: string
    unit: string
    quantity: number
    note: string
}

export default function OutboundOrderModal({ isOpen, onClose, onSuccess }: OutboundOrderModalProps) {
    const { showToast } = useToast()

    // Form State
    const [code, setCode] = useState('')
    const [customerName, setCustomerName] = useState('')
    const [customerAddress, setCustomerAddress] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [warehouseName, setWarehouseName] = useState('')
    const [description, setDescription] = useState('')
    const [items, setItems] = useState<OrderItem[]>([])

    // Data State
    const [products, setProducts] = useState<Product[]>([])
    const [customers, setCustomers] = useState<Customer[]>([])
    const [branches, setBranches] = useState<any[]>([])
    const [loadingData, setLoadingData] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            // Generate draft code
            generateOrderCode('PXK').then(newCode => setCode(newCode))

            fetchData()
        } else {
            // Reset
            setItems([])
            setDescription('')
            setCustomerName('')
        }
    }, [isOpen])

    async function fetchData() {
        setLoadingData(true)
        const [prodRes, branchRes, custRes, invRes] = await Promise.all([
            supabase.from('products').select('*').order('name'),
            supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
            supabase.from('customers').select('*').order('name'),
            fetch('/api/inventory').then(res => res.json())
        ])

        if (prodRes.data) {
            let productsWithStock: Product[] = prodRes.data as Product[]

            // Map inventory if available
            if (invRes.ok && Array.isArray(invRes.items)) {
                const stockMap = new Map<string, number>()
                invRes.items.forEach((item: any) => {
                    // item.productId might be available now
                    if (item.productId) {
                        stockMap.set(item.productId, item.balance)
                    }
                })

                productsWithStock = prodRes.data.map((p: any) => ({
                    ...p,
                    stock_quantity: stockMap.get(p.id) ?? 0
                })) as Product[]
            }

            setProducts(productsWithStock)
        }
        if (custRes.data) setCustomers(custRes.data as any)

        const branchesData = branchRes.data as any[] || []
        setBranches(branchesData)

        // Set default warehouse logic
        if (!warehouseName && branchesData.length > 0) {
            const defaultBranch = branchesData.find(b => b.is_default)
            if (defaultBranch) {
                setWarehouseName(defaultBranch.name)
            } else {
                setWarehouseName(branchesData[0].name)
            }
        }

        setLoadingData(false)
    }

    const addItem = () => {
        setItems([...items, {
            id: crypto.randomUUID(),
            productId: '',
            productName: '',
            unit: '',
            quantity: 1,
            note: ''
        }])
    }

    const updateItem = (id: string, field: keyof OrderItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item

            if (field === 'productId') {
                const prod = products.find(p => p.id === value)
                return {
                    ...item,
                    productId: value,
                    productName: prod?.name || '',
                    unit: prod?.unit || ''
                }
            }

            return { ...item, [field]: value }
        }))
    }

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id))
    }

    // Confirm Dialog State
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean
        title: string
        message: string
        onConfirm: () => void
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    })

    const handleSubmit = async () => {
        if (!customerName) {
            showToast('Vui lòng nhập tên khách hàng', 'warning')
            return
        }
        if (items.length === 0) {
            showToast('Vui lòng thêm ít nhất 1 sản phẩm', 'warning')
            return
        }

        // Stock Check
        const warnings: string[] = []

        items.forEach(item => {
            const product = products.find(p => p.id === item.productId)

            if (product) {
                // Check if stock is 0 or less than quantity
                if (product.stock_quantity <= 0) {
                    warnings.push(`• ${product.name}\n  (Hết hàng - Tồn: ${product.stock_quantity})`)
                } else if (item.quantity > product.stock_quantity) {
                    warnings.push(`• ${product.name}\n  (Xuất quá tồn - Tồn: ${product.stock_quantity}, Xuất: ${item.quantity})`)
                }
            }
        })

        if (warnings.length > 0) {
            setConfirmDialog({
                isOpen: true,
                title: 'Cảnh báo tồn kho',
                message: `Phát hiện các vấn đề sau:\n\n${warnings.join('\n\n')}\n\nBạn có chắc chắn muốn tiếp tục tạo phiếu xuất không?`,
                onConfirm: () => processSubmit()
            })
            return
        }

        processSubmit()
    }

    const processSubmit = async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        setSubmitting(true)
        try {
            // 1. Create Order
            const { data: order, error: orderError } = await (supabase
                .from('outbound_orders') as any)
                .insert({
                    code,
                    customer_name: customerName,
                    customer_address: customerAddress,
                    customer_phone: customerPhone,
                    warehouse_name: warehouseName,
                    description,
                    status: 'Pending',
                    type: 'Sale'
                })
                .select()
                .single()

            if (orderError) throw orderError
            if (!order) throw new Error('Failed to create order')

            // 2. Create Items
            const orderItems = items.map(item => ({
                order_id: order.id,
                product_id: item.productId,
                product_name: item.productName,
                unit: item.unit,
                quantity: item.quantity,
                price: 0,
                note: item.note
            }))

            const { error: itemsError } = await (supabase
                .from('outbound_order_items') as any)
                .insert(orderItems)

            if (itemsError) throw itemsError

            onSuccess()
            onClose()
        } catch (e: any) {
            showToast(e.message, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    // Total calculation removed

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                {/* Header */}
                <div className="p-6 border-b border-stone-200 dark:border-zinc-800 flex justify-between items-center bg-stone-50 dark:bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <ShoppingCart className="text-orange-600" />
                            Tạo Phiếu Xuất Mới
                        </h2>
                        <p className="text-sm text-stone-500">Xuất hàng, bán hàng, chuyển kho</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-60">
                    {/* Section 1: Thông tin phiếu */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-zinc-800">
                            <div className="w-1 h-4 bg-orange-500 rounded-full"></div>
                            <h3 className="font-semibold text-stone-800 dark:text-white text-sm">Thông tin phiếu</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Mã phiếu</label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={e => setCode(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg font-mono font-bold text-stone-800 dark:text-white"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Kho xuất hàng</label>
                                <select
                                    value={warehouseName}
                                    onChange={e => setWarehouseName(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Thông tin khách hàng */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-zinc-800">
                            <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                            <h3 className="font-semibold text-stone-800 dark:text-white text-sm">Thông tin khách hàng</h3>
                            {customerName && (
                                <span className="ml-auto text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full font-medium">
                                    {customerName}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Khách hàng <span className="text-red-500">*</span></label>
                                <Combobox
                                    options={customers.map(c => ({ value: c.id, label: c.name }))}
                                    value={null}
                                    onChange={(val) => {
                                        const c = customers.find(cus => cus.id === val)
                                        if (c) {
                                            setCustomerName(c.name)
                                            setCustomerAddress(c.address || '')
                                            setCustomerPhone(c.phone || '')
                                        }
                                    }}
                                    onSearchChange={(val) => {
                                        setCustomerName(val)
                                    }}
                                    placeholder="Nhập hoặc chọn khách hàng"
                                    className="w-full"
                                    allowCustom={true}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Địa chỉ</label>
                                <input
                                    type="text"
                                    value={customerAddress}
                                    onChange={e => setCustomerAddress(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg"
                                    placeholder="Địa chỉ giao hàng"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Số điện thoại</label>
                                <input
                                    type="text"
                                    value={customerPhone}
                                    onChange={e => setCustomerPhone(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg"
                                    placeholder="SĐT liên hệ"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Ghi chú */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-zinc-800">
                            <div className="w-1 h-4 bg-stone-400 rounded-full"></div>
                            <h3 className="font-semibold text-stone-800 dark:text-white text-sm">Ghi chú</h3>
                        </div>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg h-20 resize-none text-sm"
                            placeholder="Ghi chú về lô hàng xuất, lý do xuất, thông tin vận chuyển..."
                        />
                    </div>

                    {/* Items Table */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-stone-900 dark:text-white">Chi tiết hàng hóa</h3>
                            <button
                                onClick={addItem}
                                className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg text-sm font-medium transition-colors"
                            >
                                <Plus size={16} />
                                Thêm dòng
                            </button>
                        </div>

                        <div className="border border-stone-200 dark:border-zinc-700 rounded-xl overflow-visible">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-stone-50 dark:bg-zinc-800/50 text-stone-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3 w-10">#</th>
                                        <th className="px-4 py-3 min-w-[300px]">Sản phẩm</th>
                                        <th className="px-4 py-3 w-24">ĐVT</th>
                                        <th className="px-4 py-3 w-32">Số lượng</th>
                                        <th className="px-4 py-3">Ghi chú</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                    {items.map((item, index) => (
                                        <tr key={item.id} className="group hover:bg-stone-50 dark:hover:bg-zinc-800/30">
                                            <td className="px-4 py-3 text-stone-400">{index + 1}</td>
                                            <td className="px-4 py-3">
                                                <Combobox
                                                    options={products.map(p => ({
                                                        value: p.id,
                                                        label: `${p.sku} - ${p.name}`
                                                    }))}
                                                    value={item.productId}
                                                    onChange={(val) => updateItem(item.id, 'productId', val)}
                                                    placeholder="-- Chọn SP hoặc tìm kiếm --"
                                                    className="w-full"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-stone-500">{item.unit || '-'}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                                                    className="w-full bg-transparent outline-none text-right font-medium"
                                                    min="1"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.note}
                                                    onChange={e => updateItem(item.id, 'note', e.target.value)}
                                                    className="w-full bg-transparent outline-none text-stone-500"
                                                    placeholder="..."
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="text-stone-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-8 text-center text-stone-400">
                                                Chưa có sản phẩm nào
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-600 text-stone-700 dark:text-gray-300 rounded-lg font-medium hover:bg-stone-50 dark:hover:bg-zinc-700 transition-colors"
                        disabled={submitting}
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={20} />
                        {submitting ? 'Đang lưu...' : 'Lưu Phiếu Xuất'}
                    </button>
                </div>
            </div>

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                variant="warning"
                confirmText="Vẫn xuất hàng"
            />
        </div>
    )
}

