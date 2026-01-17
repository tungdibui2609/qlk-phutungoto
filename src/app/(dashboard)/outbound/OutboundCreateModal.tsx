'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { X, Plus, Trash2, Save, ShoppingCart } from 'lucide-react'

type Product = Database['public']['Tables']['products']['Row']

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
    price: number
    note: string
}

export default function OutboundCreateModal({ isOpen, onClose, onSuccess }: OutboundOrderModalProps) {
    // Form State
    const [code, setCode] = useState('')
    const [customerName, setCustomerName] = useState('')
    const [warehouseName, setWarehouseName] = useState('')
    const [description, setDescription] = useState('')
    const [items, setItems] = useState<OrderItem[]>([])

    // Data State
    const [products, setProducts] = useState<Product[]>([])
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
        const [prodRes, branchRes] = await Promise.all([
            supabase.from('products').select('*').order('name'),
            supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name')
        ])

        if (prodRes.data) setProducts(prodRes.data)

        const branchesData = branchRes.data as any[] || []
        setBranches(branchesData)

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
            price: 0,
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
                    unit: prod?.unit || '',
                    price: prod?.retail_price || 0 // Use retail price for outbound
                }
            }

            return { ...item, [field]: value }
        }))
    }

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id))
    }

    const handleSubmit = async () => {
        if (!customerName) return alert('Vui lòng nhập tên khách hàng')
        if (items.length === 0) return alert('Vui lòng thêm ít nhất 1 sản phẩm')

        setSubmitting(true)
        try {
            // 1. Create Order
            const { data: order, error: orderError } = await (supabase
                .from('outbound_orders') as any)
                .insert({
                    code,
                    customer_name: customerName,
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
                price: item.price,
                note: item.note
            }))

            const { error: itemsError } = await (supabase
                .from('outbound_order_items') as any)
                .insert(orderItems)

            if (itemsError) throw itemsError

            onSuccess()
            onClose()
        } catch (e: any) {
            alert(e.message)
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <ShoppingCart className="text-orange-600" />
                            Tạo Phiếu Xuất Mới
                        </h2>
                        <p className="text-sm text-gray-500">Xuất hàng, bán hàng, chuyển kho</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* General Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mã phiếu</label>
                            <input
                                type="text"
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 rounded-lg font-mono font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Khách hàng <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="Tên khách hàng hoặc người nhận"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Kho hàng</label>
                            <select
                                value={warehouseName}
                                onChange={e => setWarehouseName(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            >
                                {branches.map(b => (
                                    <option key={b.id} value={b.name}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-3 space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Diễn giải</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg h-20 resize-none"
                                placeholder="Ghi chú về lô hàng xuất, địa chỉ giao hàng..."
                            />
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 dark:text-white">Chi tiết hàng hóa</h3>
                            <button
                                onClick={addItem}
                                className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg text-sm font-medium transition-colors"
                            >
                                <Plus size={16} />
                                Thêm dòng
                            </button>
                        </div>

                        <div className="border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3 w-10">#</th>
                                        <th className="px-4 py-3 min-w-[200px]">Sản phẩm</th>
                                        <th className="px-4 py-3 w-24">ĐVT</th>
                                        <th className="px-4 py-3 w-32">Số lượng</th>
                                        <th className="px-4 py-3 w-40">Đơn giá</th>
                                        <th className="px-4 py-3 w-40">Thành tiền</th>
                                        <th className="px-4 py-3">Ghi chú</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {items.map((item, index) => (
                                        <tr key={item.id} className="group hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                                            <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={item.productId}
                                                    onChange={e => updateItem(item.id, 'productId', e.target.value)}
                                                    className="w-full bg-transparent outline-none border-b border-transparent focus:border-orange-500 pb-1"
                                                >
                                                    <option value="">-- Chọn SP --</option>
                                                    {products.map(p => (
                                                        <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500">{item.unit || '-'}</td>
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
                                                    type="number"
                                                    value={item.price}
                                                    onChange={e => updateItem(item.id, 'price', Number(e.target.value))}
                                                    className="w-full bg-transparent outline-none text-right text-gray-500"
                                                    min="0"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                                                {(item.quantity * item.price).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.note}
                                                    onChange={e => updateItem(item.id, 'note', e.target.value)}
                                                    className="w-full bg-transparent outline-none text-gray-500"
                                                    placeholder="..."
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                                                Chưa có sản phẩm nào
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {items.length > 0 && (
                                    <tfoot className="bg-gray-50 dark:bg-zinc-800/50 font-bold text-gray-900 dark:text-white">
                                        <tr>
                                            <td colSpan={5} className="px-4 py-3 text-right text-gray-500">Tổng cộng:</td>
                                            <td className="px-4 py-3 text-right text-lg text-orange-600">
                                                {totalAmount.toLocaleString()}
                                            </td>
                                            <td colSpan={2}></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
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
        </div>
    )
}
