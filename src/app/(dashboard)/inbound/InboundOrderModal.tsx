'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { X, Plus, Trash2, Save, FileText, ChevronDown, FilePenLine } from 'lucide-react'
import { Combobox } from '@/components/ui/Combobox'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'

type Product = Database['public']['Tables']['products']['Row'] & {
    product_units?: {
        unit_id: string
        conversion_rate: number
    }[]
}
type Supplier = Database['public']['Tables']['suppliers']['Row']
type Unit = Database['public']['Tables']['units']['Row']

interface InboundOrderModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    editOrderId?: string | null
}

const generateOrderCode = async (type: 'PNK' | 'PXK', systemCode?: string, systemName?: string) => {
    // Tự động tạo viết tắt từ tên phân hệ kho
    const getSystemAbbreviation = (code: string, name?: string): string => {
        if (name) {
            const nameWithoutKho = name.replace(/^Kho\s+/i, '')
            return nameWithoutKho
                .split(' ')
                .filter(word => word.length > 0)
                .map(word => word[0])
                .join('')
                .toUpperCase()
        }
        return code.substring(0, 3).toUpperCase()
    }

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
        const prefix = systemCode ? `${getSystemAbbreviation(systemCode, systemName)}-` : ''
        return `${prefix}${type}-${dateStr}-${random}`
    }

    const stt = String((count || 0) + 1).padStart(3, '0')
    const prefix = systemCode ? `${getSystemAbbreviation(systemCode, systemName)}-` : ''
    return `${prefix}${type}-${dateStr}-${stt}`
}

interface OrderItem {
    id: string // temp id
    productId: string
    productName: string
    unit: string
    quantity: number
    document_quantity: number
    price: number
    note: string
    isDocQtyVisible?: boolean
    isNoteOpen?: boolean
}

export default function InboundOrderModal({ isOpen, onClose, onSuccess, editOrderId }: InboundOrderModalProps) {
    const { showToast } = useToast()
    const { systemType, currentSystem } = useSystem()

    // Form State
    const [code, setCode] = useState('')
    const [supplierId, setSupplierId] = useState('')
    const [supplierAddress, setSupplierAddress] = useState('')
    const [supplierPhone, setSupplierPhone] = useState('')
    const [warehouseName, setWarehouseName] = useState('')
    const [description, setDescription] = useState('')
    const [items, setItems] = useState<OrderItem[]>([])
    // Logistics State
    const [vehicleNumber, setVehicleNumber] = useState('')
    const [driverName, setDriverName] = useState('')
    const [containerNumber, setContainerNumber] = useState('')

    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0)

    // Data State
    const [products, setProducts] = useState<Product[]>([])
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [branches, setBranches] = useState<any[]>([])
    const [units, setUnits] = useState<Unit[]>([]) // Store all active units
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
            setSupplierPhone('')
            setCode('')
            setVehicleNumber('')
            setDriverName('')
            setContainerNumber('')
        }
    }, [isOpen, editOrderId])

    async function fetchData() {
        setLoadingData(true)
        try {
            const [prodRes, suppRes, branchRes, unitRes] = await Promise.all([
                supabase.from('products').select('*, product_units(unit_id, conversion_rate)').eq('system_type', systemType).order('name'),
                supabase.from('suppliers').select('*').eq('system_code', systemType).order('name'),
                supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
                supabase.from('units').select('*').eq('is_active', true)
            ])
            if (prodRes.data) setProducts(prodRes.data)
            if (suppRes.data) setSuppliers(suppRes.data)
            if (unitRes.data) setUnits(unitRes.data)

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
                    setWarehouseName(order.warehouse_name || '')
                    setDescription(order.description || '')

                    // Load Metadata
                    const meta = order.metadata || {}
                    setVehicleNumber(meta.vehicleNumber || '')
                    setDriverName(meta.driverName || '')
                    setContainerNumber(meta.containerNumber || '')

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
                            document_quantity: i.document_quantity || i.quantity,
                            price: i.price || 0,
                            note: i.note || ''
                        })))
                    }
                }
            } else {
                // New Mode
                // Generate draft code
                if (!editOrderId) {
                    generateOrderCode('PNK', systemType, currentSystem?.name).then(newCode => setCode(newCode))
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
            document_quantity: 1,
            price: 0,
            note: ''
        }])
    }

    const updateItem = (id: string, field: keyof OrderItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item

            if (field === 'productId') {
                const prod = products.find(p => p.id === value)

                // Determine initial unit
                let initialUnit = ''
                if (prod) {
                    const hasAlternatives = prod.product_units && prod.product_units.length > 0
                    // Only auto-select if NO alternatives exist (only base unit)
                    if (!hasAlternatives && prod.unit) {
                        initialUnit = prod.unit
                    }
                }

                return {
                    ...item,
                    productId: value,
                    productName: prod?.name || '',
                    unit: initialUnit,
                    price: prod?.cost_price || 0
                }
            }

            if (field === 'quantity') {
                const newValue = Number(value)
                return {
                    ...item,
                    quantity: newValue,
                    document_quantity: !item.isDocQtyVisible ? newValue : item.document_quantity
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

        // Validate items
        const invalidItem = items.find(i => !i.productId || !i.unit)
        if (invalidItem) {
            showToast('Vui lòng chọn đầy đủ sản phẩm và đơn vị tính', 'warning')
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
                        updated_at: new Date().toISOString(),
                        metadata: {
                            vehicleNumber,
                            driverName,
                            containerNumber
                        }
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
                        type: 'Purchase',
                        system_code: systemType,
                        metadata: {
                            vehicleNumber,
                            driverName,
                            containerNumber
                        }
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
                document_quantity: item.document_quantity || item.quantity,
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

    // Module Checking
    const inboundModules = currentSystem?.inbound_modules
        ? (typeof currentSystem.inbound_modules === 'string' ? JSON.parse(currentSystem.inbound_modules) : currentSystem.inbound_modules)
        : []

    // If no config found, default to SHOW ALL (or fallback behavior). 
    // However, to force usage of modules, we might default to BASIC only if array is empty?
    // Let's assume if null/undefined, show all (backward compat). If empty array, show nothing?
    // User approved "Configure modules", so likely strict mode.
    // Let's rely on default: if inbound_modules is null/undefined, assume ALL for now or Basic + Financials.
    // Better: Helper function
    const hasModule = (moduleId: string) => {
        if (!inboundModules || inboundModules.length === 0) return true // Default show all if not configured
        return inboundModules.includes(moduleId)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-stone-200 dark:border-zinc-800 flex justify-between items-center bg-stone-50 dark:bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <FileText className="text-orange-600" />
                            {editOrderId ? 'Chỉnh Sửa Phiếu Nhập' : 'Tạo Phiếu Nhập Mới'}
                        </h2>
                        <p className="text-sm text-stone-500">
                            {currentSystem?.name} - {editOrderId ? 'Cập nhật phiếu' : 'Tạo phiếu mới'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-60">

                    {/* Grid wrapper for Basic and Supplier */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Section 1: Thông tin phiếu */}
                        {(hasModule('inbound_basic') || true) && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-zinc-800">
                                    <div className="w-1 h-4 bg-orange-500 rounded-full"></div>
                                    <h3 className="font-semibold text-stone-800 dark:text-white text-sm">Thông tin phiếu</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        )}

                        {/* Section 2: Thông tin nhà cung cấp (Module: inbound_supplier) */}
                        {hasModule('inbound_supplier') && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-zinc-800">
                                    <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                    <h3 className="font-semibold text-stone-800 dark:text-white text-sm">Thông tin nhà cung cấp</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5 sm:col-span-2">
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
                                            placeholder="Địa chỉ NCC"
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
                        )}
                    </div>

                    {/* NEW Module: Logistics */}
                    {hasModule('inbound_logistics') && (
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-zinc-800">
                                <div className="w-1 h-4 bg-teal-500 rounded-full"></div>
                                <h3 className="font-semibold text-stone-800 dark:text-white text-sm">Vận chuyển & Kho bãi</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Biển số xe</label>
                                    <input
                                        type="text"
                                        value={vehicleNumber}
                                        onChange={e => setVehicleNumber(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg"
                                        placeholder="VD: 29C-123.45"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Tài xế/Người giao</label>
                                    <input
                                        type="text"
                                        value={driverName}
                                        onChange={e => setDriverName(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg"
                                        placeholder="Tên người giao hàng"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Container / Số chuyến</label>
                                    <input
                                        type="text"
                                        value={containerNumber}
                                        onChange={e => setContainerNumber(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg"
                                        placeholder="Số container..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section 3: Ghi chú (Basic) */}
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

                    {/* Items Table - Dynamic Columns */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-stone-900 dark:text-white">Chi tiết hàng hóa</h3>
                        </div>

                        <div className="border border-stone-200 dark:border-zinc-700 rounded-xl overflow-visible">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-stone-50 dark:bg-zinc-800/50 text-stone-500 font-medium text-center">
                                    <tr>
                                        <th className="px-4 py-3 w-10">#</th>
                                        <th className="px-4 py-3 min-w-[300px]">Sản phẩm</th>
                                        <th className="px-4 py-3 w-24">ĐVT</th>
                                        <th className="px-4 py-3 w-32 text-right">Số lượng</th>

                                        {/* Module Financials */}
                                        {hasModule('inbound_financials') && (
                                            <>
                                                <th className="px-4 py-3 w-32 text-right">Đơn giá</th>
                                                <th className="px-4 py-3 w-32 text-right">Thành tiền</th>
                                            </>
                                        )}

                                        <th className="px-4 py-3">Ghi chú</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                    {items.map((item, index) => (
                                        <tr key={item.id} className="group hover:bg-stone-50 dark:hover:bg-zinc-800/30">
                                            <td className="px-4 py-3 text-stone-400">{index + 1}</td>
                                            {/* Product Selection */}
                                            <td className="px-4 py-3 align-top">
                                                <Combobox
                                                    options={products.map(p => ({
                                                        value: p.id,
                                                        label: `${p.sku} - ${p.name}`,
                                                        sku: p.sku,
                                                        name: p.name
                                                    }))}
                                                    value={item.productId}
                                                    onChange={(val) => updateItem(item.id, 'productId', val)}
                                                    placeholder="-- Chọn SP --"
                                                    className="w-full"
                                                    renderValue={(option) => (
                                                        <div className="flex flex-col text-left w-full">
                                                            <div className="text-[10px] text-stone-500 font-mono mb-0.5">{option.sku}</div>
                                                            <div className="font-medium text-xs text-stone-900 dark:text-gray-100 line-clamp-2 leading-tight">
                                                                {option.name}
                                                            </div>
                                                        </div>
                                                    )}
                                                />
                                            </td>
                                            {/* Unit */}
                                            <td className="px-4 py-3 text-center">
                                                {(() => {
                                                    const product = products.find(p => p.id === item.productId)
                                                    if (!product) return <span className="text-stone-500">-</span>

                                                    // Prepare options: Base Unit + Alternatives
                                                    const options = []
                                                    if (product.unit) {
                                                        options.push({ value: product.unit, label: product.unit })
                                                    }
                                                    if (product.product_units && product.product_units.length > 0) {
                                                        product.product_units.forEach(pu => {
                                                            const uName = units.find(u => u.id === pu.unit_id)?.name
                                                            if (uName) {
                                                                options.push({ value: uName, label: uName })
                                                            }
                                                        })
                                                    }

                                                    // Deduplicate just in case
                                                    const uniqueOptions = Array.from(new Map(options.map(item => [item['value'], item])).values());

                                                    if (uniqueOptions.length <= 1) {
                                                        return <span className='text-stone-700 font-medium'>{item.unit || product.unit || '-'}</span>
                                                    }

                                                    return (
                                                        <select
                                                            value={item.unit}
                                                            onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                                            className={`w-full bg-transparent border-none outline-none font-medium text-center focus:ring-0 cursor-pointer hover:bg-stone-100 rounded ${!item.unit ? 'text-orange-500 animate-pulse' : 'text-stone-700'}`}
                                                        >
                                                            <option value="" disabled>-- ĐVT --</option>
                                                            {uniqueOptions.map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    )
                                                })()}
                                            </td>
                                            {/* Quantity & Document Quantity - Always Show but simplified if Document Module off? */}
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-2">
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={item.quantity ? item.quantity.toLocaleString('vi-VN') : ''}
                                                            onChange={e => {
                                                                const val = e.target.value.replace(/\D/g, '')
                                                                updateItem(item.id, 'quantity', Number(val))
                                                            }}
                                                            className="w-full bg-transparent outline-none text-right font-medium pr-2"
                                                        />
                                                    </div>
                                                    {/* Optional Document Quantity based on Module? or keep as is behavior? -> Keep as is for now or wrap in check */}
                                                </div>
                                            </td>

                                            {/* Module Financials */}
                                            {hasModule('inbound_financials') && (
                                                <>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={item.price ? item.price.toLocaleString('vi-VN') : ''}
                                                            onChange={e => {
                                                                const val = e.target.value.replace(/\D/g, '')
                                                                updateItem(item.id, 'price', val ? Number(val) : 0)
                                                            }}
                                                            className="w-full bg-transparent outline-none text-right font-medium"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium text-stone-700 dark:text-gray-300">
                                                        {(item.quantity * item.price).toLocaleString()}
                                                    </td>
                                                </>
                                            )}

                                            {/* Note */}
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="text"
                                                    value={item.note || ''}
                                                    onChange={e => updateItem(item.id, 'note', e.target.value)}
                                                    className="w-full bg-transparent outline-none text-left text-stone-500 focus:text-stone-800"
                                                    placeholder="..."
                                                />
                                            </td>

                                            {/* Delete */}
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
                                            <td colSpan={hasModule('inbound_financials') ? 8 : 6} className="px-4 py-8 text-center text-stone-400">
                                                Chưa có sản phẩm nào
                                            </td>
                                        </tr>
                                    )}

                                    {/* Footer Rows for Financials */}
                                    {items.length > 0 && hasModule('inbound_financials') && (
                                        <tr className="bg-stone-50 dark:bg-zinc-800/50 font-bold border-t border-stone-200 dark:border-zinc-700">
                                            <td colSpan={5} className="px-4 py-3 text-right text-stone-900 dark:text-white">
                                                Tổng cộng:
                                            </td>
                                            <td className="px-4 py-3 text-right text-orange-600 text-base">
                                                {totalAmount.toLocaleString()}
                                            </td>
                                            <td colSpan={2} className="px-4 py-3"></td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            <button
                                onClick={addItem}
                                className="w-full py-3 flex items-center justify-center gap-2 text-stone-500 hover:text-orange-600 hover:bg-orange-50 transition-colors border-t border-stone-200 dark:border-zinc-700 font-medium text-sm"
                            >
                                <Plus size={16} />
                                Thêm dòng
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50 flex items-center justify-between gap-4">
                    <div className="text-xs text-stone-500 italic flex items-center gap-1">
                        {/* Legend or Info */}
                    </div>
                    <div className="flex items-center gap-3">
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
        </div >
    )
}
