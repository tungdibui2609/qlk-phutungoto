'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { X, Plus, Trash2, Save, FileText } from 'lucide-react'
import { Combobox } from '@/components/ui/Combobox'
import { useToast } from '@/components/ui/ToastProvider'

type Product = Database['public']['Tables']['products']['Row']
type Supplier = Database['public']['Tables']['suppliers']['Row']

interface InboundOrderModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    editOrderId?: string | null
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
    id: string // temp id
    productId: string
    productName: string
    unit: string
    quantity: number
    price: number
    note: string
}

export default function InboundOrderModal({ isOpen, onClose, onSuccess, editOrderId }: InboundOrderModalProps) {
    const { showToast } = useToast()

    // Form State
    const [code, setCode] = useState('')
    const [supplierId, setSupplierId] = useState('')
    const [supplierAddress, setSupplierAddress] = useState('')
    const [supplierPhone, setSupplierPhone] = useState('')
    const [warehouseName, setWarehouseName] = useState('')
    const [description, setDescription] = useState('')
    const [items, setItems] = useState<OrderItem[]>([])

    // Data State
    const [products, setProducts] = useState<Product[]>([])
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [branches, setBranches] = useState<any[]>([])
    const [loadingData, setLoadingData] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchData()
        } else {
            // Reset
            setItems([])
            setDescription('')
            setSupplierId('')
            setSupplierAddress('')
            setSupplierPhone('')
            setCode('')
        }
    }, [isOpen, editOrderId])

    async function fetchData() {
        setLoadingData(true)
        try {
            const [prodRes, suppRes, branchRes] = await Promise.all([
                supabase.from('products').select('*').order('name'),
                supabase.from('suppliers').select('*').order('name'),
                supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name')
            ])
            if (prodRes.data) setProducts(prodRes.data)
            if (suppRes.data) setSuppliers(suppRes.data)

            const branchesData = branchRes.data as any[] || []
            setBranches(branchesData)

            // Set default warehouse logic
            if (!editOrderId && !warehouseName && branchesData.length > 0) {
                const defaultBranch = branchesData.find(b => b.is_default)
                if (defaultBranch) {
                    setWarehouseName(defaultBranch.name)
                } else {
                    setWarehouseName(branchesData[0].name)
                }
            }

            // If Edit Mode
            if (editOrderId) {
                const { data: orderData, error: orderError } = await supabase
                    .from('inbound_orders')
                    .select('*')
                    .eq('id', editOrderId)
                    .single()

                const order = orderData as any

                if (orderError) throw orderError
                if (order) {
                    setCode(order.code)
                    setSupplierId(order.supplier_id || '')
                    setSupplierAddress(order.supplier_address || '')
                    setSupplierPhone(order.supplier_phone || '')
                    setWarehouseName(order.warehouse_name || '')
                    setDescription(order.description || '')

                    // Fetch Items
                    const { data: itemsData, error: itemsError } = await supabase
                        .from('inbound_order_items')
                        .select('*')
                        .eq('order_id', editOrderId)

                    const orderItems = itemsData as any

                    if (itemsError) throw itemsError
                    if (orderItems) {
                        setItems(orderItems.map((i: any) => ({
                            id: crypto.randomUUID(),
                            productId: i.product_id || '',
                            productName: i.product_name || '',
                            unit: i.unit || '',
                            quantity: i.quantity,
                            price: i.price || 0,
                            note: i.note || ''
                        })))
                    }
                }
            } else {
                // New Mode
                // Generate draft code
                if (!editOrderId) {
                    generateOrderCode('PNK').then(newCode => setCode(newCode))
                }
            }

        } catch (error) {
            console.error(error)
            showToast('Lỗi tải dữ liệu', 'error')
        }
        setLoadingData(false)
    }

    // Handle supplier change to autofill address/phone
    const handleSupplierChange = (val: string | null) => {
        setSupplierId(val || '')
        if (val) {
            const supplier = suppliers.find(s => s.id === val)
            if (supplier) {
                setSupplierAddress(supplier.address || '')
                setSupplierPhone(supplier.phone || '')
            }
        } else {
            setSupplierAddress('')
            setSupplierPhone('')
        }
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
                    price: prod?.cost_price || 0
                }
            }

            return { ...item, [field]: value }
        }))
    }

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id))
    }

    const handleSubmit = async () => {
        if (!supplierId) {
            showToast('Vui lòng chọn nhà cung cấp', 'warning')
            return
        }
        if (items.length === 0) {
            showToast('Vui lòng thêm ít nhất 1 sản phẩm', 'warning')
            return
        }

        setSubmitting(true)
        try {
            let orderId = editOrderId

            if (editOrderId) {
                // UPDATE ORDER
                const { error: updateError } = await (supabase
                    .from('inbound_orders') as any)
                    .update({
                        supplier_id: supplierId,
                        supplier_address: supplierAddress,
                        supplier_phone: supplierPhone,
                        warehouse_name: warehouseName,
                        description,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editOrderId)

                if (updateError) throw updateError

                // DELETE OLD ITEMS (Simple strategy)
                await supabase.from('inbound_order_items').delete().eq('order_id', editOrderId)

            } else {
                // CREATE ORDER
                const { data: order, error: orderError } = await (supabase
                    .from('inbound_orders') as any)
                    .insert({
                        code,
                        supplier_id: supplierId,
                        supplier_address: supplierAddress,
                        supplier_phone: supplierPhone,
                        warehouse_name: warehouseName,
                        description,
                        status: 'Pending',
                        type: 'Purchase'
                    })
                    .select()
                    .single()

                if (orderError) throw orderError
                if (!order) throw new Error('Failed to create order')
                orderId = order.id
            }

            // INSERT ITEMS
            if (!orderId) throw new Error('No Order ID')

            const orderItems = items.map(item => ({
                order_id: orderId,
                product_id: item.productId,
                product_name: item.productName,
                unit: item.unit,
                quantity: item.quantity,
                price: item.price,
                note: item.note
            }))

            const { error: itemsError } = await (supabase
                .from('inbound_order_items') as any)
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

    if (!isOpen) return null

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-stone-200 dark:border-zinc-800 flex justify-between items-center bg-stone-50 dark:bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <FileText className="text-orange-600" />
                            {editOrderId ? 'Chỉnh Sửa Phiếu Nhập' : 'Tạo Phiếu Nhập Mới'}
                        </h2>
                        <p className="text-sm text-stone-500">Nhập số liệu chứng từ kế toán</p>
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
                                <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Kho nhập hàng</label>
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

                    {/* Section 2: Thông tin nhà cung cấp */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-zinc-800">
                            <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                            <h3 className="font-semibold text-stone-800 dark:text-white text-sm">Thông tin nhà cung cấp</h3>
                            {supplierId && suppliers.find(s => s.id === supplierId) && (
                                <span className="ml-auto text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full font-medium">
                                    {suppliers.find(s => s.id === supplierId)?.name}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Nhà cung cấp <span className="text-red-500">*</span></label>
                                <Combobox
                                    options={suppliers.map(s => ({
                                        value: s.id,
                                        label: s.name
                                    }))}
                                    value={supplierId}
                                    onChange={handleSupplierChange}
                                    placeholder="Chọn nhà cung cấp"
                                    className="w-full"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Địa chỉ</label>
                                <input
                                    type="text"
                                    value={supplierAddress}
                                    onChange={e => setSupplierAddress(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg"
                                    placeholder="Địa chỉ nhà cung cấp"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Số điện thoại</label>
                                <input
                                    type="text"
                                    value={supplierPhone}
                                    onChange={e => setSupplierPhone(e.target.value)}
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
                            <h3 className="font-semibold text-stone-800 dark:text-white text-sm">Diễn giải</h3>
                        </div>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg h-20 resize-none text-sm"
                            placeholder="Diễn giải về lô hàng, số hóa đơn, chứng từ..."
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
                                        <th className="px-4 py-3 min-w-[400px]">Sản phẩm</th>
                                        <th className="px-4 py-3 w-24">ĐVT</th>
                                        <th className="px-4 py-3 w-32">Số lượng</th>
                                        <th className="px-4 py-3 w-32">Đơn giá</th>
                                        <th className="px-4 py-3 w-32">Thành tiền</th>
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
                                                    type="number"
                                                    value={item.price}
                                                    onChange={e => updateItem(item.id, 'price', Number(e.target.value))}
                                                    className="w-full bg-transparent outline-none text-right font-medium"
                                                    min="0"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-stone-700 dark:text-gray-300">
                                                {(item.quantity * item.price).toLocaleString()}
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
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-bold shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={20} />
                        {submitting ? 'Đang lưu...' : 'Lưu Phiếu Nhập'}
                    </button>
                </div>
            </div>
        </div>
    )
}
