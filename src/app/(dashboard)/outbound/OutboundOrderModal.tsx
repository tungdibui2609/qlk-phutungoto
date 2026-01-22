'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { X, Plus, Trash2, Save, ShoppingCart, ChevronDown, FilePenLine, Image } from 'lucide-react'
import { Combobox } from '@/components/ui/Combobox'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { Dialog, DialogContent } from '@/components/ui/Dialog'

// Force update
type Product = Database['public']['Tables']['products']['Row'] & {
    stock_quantity: number
    product_units?: {
        unit_id: string
        conversion_rate: number
    }[]
}
type Customer = { id: string, name: string, address?: string | null, phone?: string | null }
type Unit = Database['public']['Tables']['units']['Row']

interface OutboundOrderModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

const generateOrderCode = async (type: 'PNK' | 'PXK', systemCode?: string, systemName?: string) => {
    // Tự động tạo viết tắt từ tên phân hệ kho
    const getSystemAbbreviation = (code: string, name?: string): string => {
        if (name) {
            const nameWithoutKho = name.replace(/^Kho\s+/i, '')
            return nameWithoutKho
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/đ/g, "d").replace(/Đ/g, "D")
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
    id: string
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

export default function OutboundOrderModal({ isOpen, onClose, onSuccess }: OutboundOrderModalProps) {
    const { showToast } = useToast()
    const { systemType, currentSystem } = useSystem()

    // Form State
    const [code, setCode] = useState('')
    const [customerName, setCustomerName] = useState('')
    const [customerAddress, setCustomerAddress] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [warehouseName, setWarehouseName] = useState('')
    const [description, setDescription] = useState('')
    const [items, setItems] = useState<OrderItem[]>([])
    // Logistics State
    const [vehicleNumber, setVehicleNumber] = useState('')
    const [driverName, setDriverName] = useState('')
    const [containerNumber, setContainerNumber] = useState('')
    const [orderTypeId, setOrderTypeId] = useState('')
    // Images State
    const [images, setImages] = useState<string[]>([])
    // Conversion State
    const [targetUnit, setTargetUnit] = useState<string>('')

    const totalAmount = items.reduce((sum, item) => sum + item.quantity * (item.price || 0), 0)

    // Data State
    const [products, setProducts] = useState<Product[]>([])
    const [customers, setCustomers] = useState<Customer[]>([])
    const [branches, setBranches] = useState<any[]>([])
    const [units, setUnits] = useState<Unit[]>([]) // Store all active units
    const [orderTypes, setOrderTypes] = useState<any[]>([])
    const [loadingData, setLoadingData] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            // Generate draft code
            generateOrderCode('PXK', systemType, currentSystem?.name).then(newCode => setCode(newCode))

            fetchData()
        } else {
            // Reset
            setItems([])
            setDescription('')
            setCustomerName('')
            setCustomerAddress('')
            setCustomerPhone('')
            setVehicleNumber('')
            setDriverName('')
            setContainerNumber('')
            setOrderTypeId('')
            setOrderTypeId('')
            setImages([])
            setTargetUnit('')
        }
    }, [isOpen])

    async function fetchData() {
        setLoadingData(true)
        const [prodRes, branchRes, custRes, invRes, unitRes, typeRes] = await Promise.all([
            supabase.from('products').select('*, product_units(unit_id, conversion_rate)').eq('system_type', systemType).order('name'),
            supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
            supabase.from('customers').select('*').eq('system_code', systemType).order('name'),
            fetch(`/api/inventory?systemType=${systemType}`).then(res => res.json()),
            supabase.from('units').select('*').eq('is_active', true),
            // Fetch Order Types (System specific or Global)
            (supabase.from('order_types') as any)
                .select('*')
                .or(`scope.eq.outbound,scope.eq.both`)
                .or(`system_code.eq.${systemType},system_code.is.null`)
                .eq('is_active', true)
                .order('created_at', { ascending: true })
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
        if (unitRes.data) setUnits(unitRes.data)
        if (typeRes.data) setOrderTypes(typeRes.data)

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

        // Validate items
        const invalidItem = items.find(i => !i.productId || !i.unit)
        if (invalidItem) {
            showToast('Vui lòng chọn đầy đủ sản phẩm và đơn vị tính', 'warning')
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
                    type: 'Sale',
                    order_type_id: orderTypeId || null,
                    images, // Save images
                    system_code: systemType,
                    metadata: {
                        vehicleNumber,
                        driverName,
                        containerNumber,
                        targetUnit
                    }
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
                document_quantity: item.document_quantity || item.quantity,
                price: item.price || 0,
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

    // Module Checking
    const outboundModules = currentSystem?.outbound_modules
        ? (typeof currentSystem.outbound_modules === 'string' ? JSON.parse(currentSystem.outbound_modules) : currentSystem.outbound_modules)
        : []

    const hasModule = (moduleId: string) => {
        if (!outboundModules || outboundModules.length === 0) return true
        return outboundModules.includes(moduleId)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full ${hasModule('outbound_ui_compact') ? 'max-w-5xl' : 'max-w-7xl'} h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                {/* Header */}
                <div className="p-6 border-b border-stone-200 dark:border-zinc-800 flex justify-between items-center bg-stone-50 dark:bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <ShoppingCart className="text-orange-600" />
                            Tạo Phiếu Xuất Mới
                        </h2>
                        <p className="text-sm text-stone-500">Xuất hàng, bán hàng, chuyển kho</p>
                    </div>
                    {hasModule('outbound_conversion') && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">Hiển thị quy đổi theo:</span>
                            <select
                                value={targetUnit}
                                onChange={(e) => setTargetUnit(e.target.value)}
                                className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm text-stone-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-orange-500"
                            >
                                <option value="">-- Không --</option>
                                {units.map(u => (
                                    <option key={u.id} value={u.name}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-60">
                    {/* Module Check */}
                    {(() => {
                        return (
                            <>
                                {/* Grid wrapper for Basic and Customer */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Section 1: Thông tin phiếu (Basic) */}
                                    {(hasModule('outbound_basic') || true) && (
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

                                                {/* Order Type Selector (New Module: outbound_type) */}
                                                {hasModule('outbound_type') && (
                                                    <div className="space-y-1.5 md:col-span-2">
                                                        <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Loại phiếu xuất</label>
                                                        <select
                                                            value={orderTypeId}
                                                            onChange={e => setOrderTypeId(e.target.value)}
                                                            className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                                        >
                                                            <option value="">-- Chọn loại phiếu --</option>
                                                            {orderTypes.map(t => (
                                                                <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Section 2: Thông tin khách hàng (Module: outbound_customer) */}
                                    {hasModule('outbound_customer') && (
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
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1.5 md:col-span-2">
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
                                    )}
                                </div>

                                {/* NEW Module: Outbound Images */}
                                {hasModule('outbound_images') && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-zinc-800">
                                            <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                                            <h3 className="font-semibold text-stone-800 dark:text-white text-sm">Hình ảnh hóa đơn / Chứng từ</h3>
                                        </div>
                                        <div className="bg-stone-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-stone-200 dark:border-zinc-700 border-dashed">
                                            <ImageUpload value={images} onChange={setImages} />
                                        </div>
                                    </div>
                                )}

                                {/* NEW Module: Logistics */}
                                {hasModule('outbound_logistics') && (
                                    <div className="space-y-4 pt-2">
                                        <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-zinc-800">
                                            <div className="w-1 h-4 bg-teal-500 rounded-full"></div>
                                            <h3 className="font-semibold text-stone-800 dark:text-white text-sm">Vận chuyển & Giao hàng</h3>
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
                                                <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Tài xế/Người nhận</label>
                                                <input
                                                    type="text"
                                                    value={driverName}
                                                    onChange={e => setDriverName(e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg"
                                                    placeholder="Tên người nhận hàng"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Container / Chuyến</label>
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


                                {/* Section 3: Ghi chú */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-zinc-800">
                                        <div className="w-1 h-4 bg-stone-400 rounded-full"></div>
                                        <h3 className="font-semibold text-stone-800 dark:text-white text-sm">Diễn giải kèm theo / lý do xuất</h3>
                                    </div>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg h-20 resize-none text-sm"
                                        placeholder="Diễn giải về lô hàng xuất, lý do xuất, thông tin vận chuyển..."
                                    />
                                </div>

                                {/* Items Table */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-stone-900 dark:text-white">Chi tiết hàng hóa</h3>
                                    </div>

                                    <div className="border border-stone-200 dark:border-zinc-700 rounded-xl overflow-visible">
                                        <table className={`w-full text-left ${hasModule('outbound_ui_compact') ? 'text-base' : 'text-xs'}`}>
                                            <thead className="bg-stone-50 dark:bg-zinc-800/50 text-stone-500 font-medium text-center">
                                                <tr>
                                                    <th className="px-4 py-3 w-10">#</th>
                                                    <th className="px-4 py-3 min-w-[370px]">Sản phẩm</th>
                                                    <th className="px-4 py-3 w-24">ĐVT</th>
                                                    <th className="px-4 py-3 w-48 text-right">
                                                        <div className="flex flex-col items-center w-fit ml-auto">
                                                            <span>SL</span>
                                                            <span>Thực xuất</span>
                                                        </div>
                                                    </th>

                                                    {/* Conversion Column */}
                                                    {hasModule('outbound_conversion') && targetUnit && (
                                                        <th className="px-4 py-3 w-32 text-right text-orange-600">
                                                            <div>SL Quy đổi</div>
                                                            <div className="text-[10px] font-normal">({targetUnit})</div>
                                                        </th>
                                                    )}

                                                    {/* Module Financials */}
                                                    {hasModule('outbound_financials') && (
                                                        <>
                                                            <th className="px-4 py-3 w-40 text-right">Đơn giá</th>
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
                                                                        className="w-full bg-transparent outline-none text-right font-medium pr-6"
                                                                    />
                                                                    {hasModule('outbound_financials') && (
                                                                        <button
                                                                            onClick={() => {
                                                                                const newItems = [...items]
                                                                                newItems[index].isDocQtyVisible = !newItems[index].isDocQtyVisible
                                                                                setItems(newItems)
                                                                            }}
                                                                            className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 rounded-md hover:bg-stone-100"
                                                                            title="Nhập số lượng yêu cầu"
                                                                            tabIndex={-1}
                                                                        >
                                                                            <ChevronDown size={14} className={`transition-transform duration-200 ${item.isDocQtyVisible ? 'rotate-180' : ''}`} />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {hasModule('outbound_financials') && item.isDocQtyVisible && (
                                                                    <div className="relative animate-in slide-in-from-top-2 duration-200">
                                                                        <div className="text-[10px] text-stone-500 text-center mb-0.5">SL yêu cầu</div>
                                                                        <input
                                                                            type="text"
                                                                            value={item.document_quantity ? item.document_quantity.toLocaleString('vi-VN') : ''}
                                                                            onChange={e => {
                                                                                const val = e.target.value.replace(/\D/g, '')
                                                                                updateItem(item.id, 'document_quantity', Number(val))
                                                                            }}
                                                                            className="w-full bg-stone-50 border border-stone-200 rounded px-2 py-1 text-right text-xs text-stone-600 outline-none focus:border-blue-500"
                                                                            placeholder="SL yêu cầu"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Conversion Logic */}
                                                        {hasModule('outbound_conversion') && targetUnit && (
                                                            <td className="px-4 py-3 text-right font-medium text-orange-600">
                                                                {(() => {
                                                                    if (!item.quantity || !item.unit) return '-'

                                                                    // 1. Convert current unit to base unit
                                                                    const product = products.find(p => p.id === item.productId)
                                                                    if (!product) return '-'

                                                                    let baseQty = 0
                                                                    // Check if current unit is base unit
                                                                    if (item.unit === product.unit) {
                                                                        baseQty = item.quantity
                                                                    } else {
                                                                        const uConfig = product.product_units?.find(pu => {
                                                                            const uName = units.find(u => u.id === pu.unit_id)?.name
                                                                            return uName === item.unit
                                                                        })

                                                                        if (uConfig) {
                                                                            baseQty = item.quantity * uConfig.conversion_rate
                                                                        } else {
                                                                            return '-' // Cannot convert to base
                                                                        }
                                                                    }

                                                                    // 2. Convert base qty to target unit
                                                                    // If target is base
                                                                    if (targetUnit === product.unit) {
                                                                        return Number.isInteger(baseQty) ? baseQty : baseQty.toFixed(2)
                                                                    }

                                                                    // If target is other unit
                                                                    const targetConfig = product.product_units?.find(pu => {
                                                                        const uName = units.find(u => u.id === pu.unit_id)?.name
                                                                        return uName === targetUnit
                                                                    })

                                                                    if (targetConfig) {
                                                                        const result = baseQty / targetConfig.conversion_rate
                                                                        return Number.isInteger(result) ? result : result.toFixed(2)
                                                                    }

                                                                    return '-'
                                                                })()}
                                                            </td>
                                                        )}
                                                        {/* Module Financials */}
                                                        {hasModule('outbound_financials') && (
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
                                                                    {(item.quantity * (item.price || 0)).toLocaleString()}
                                                                </td>
                                                            </>
                                                        )}
                                                        <td className="px-4 py-3 relative">
                                                            <div className="flex items-center justify-center">
                                                                <button
                                                                    onClick={() => {
                                                                        const newItems = [...items]
                                                                        // Close others
                                                                        newItems.forEach(i => { if (i.id !== item.id) i.isNoteOpen = false })
                                                                        newItems[index].isNoteOpen = !newItems[index].isNoteOpen
                                                                        setItems(newItems)
                                                                    }}
                                                                    className={`p-2 rounded-full transition-colors ${item.note ? 'text-blue-600 bg-blue-50' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'}`}
                                                                    title="Ghi chú"
                                                                >
                                                                    <FilePenLine size={16} />
                                                                </button>

                                                                {item.isNoteOpen && (
                                                                    <>
                                                                        <div
                                                                            className="fixed inset-0 z-[60]"
                                                                            onClick={() => {
                                                                                const newItems = [...items]
                                                                                newItems[index].isNoteOpen = false
                                                                                setItems(newItems)
                                                                            }}
                                                                        />
                                                                        <div className="absolute right-full top-0 mr-2 z-[70] w-64 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg shadow-xl p-3 animate-in fade-in zoom-in-95 duration-200">
                                                                            <div className="mb-2 font-medium text-sm text-stone-700 dark:text-gray-200">Ghi chú</div>
                                                                            <textarea
                                                                                value={item.note}
                                                                                onChange={e => updateItem(item.id, 'note', e.target.value)}
                                                                                className="w-full h-24 p-2 text-sm border border-stone-200 dark:border-zinc-700 rounded-md bg-stone-50 dark:bg-zinc-900 outline-none focus:border-blue-500 resize-none"
                                                                                placeholder="Nhập ghi chú..."
                                                                                autoFocus
                                                                            />
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
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
                                                        <td colSpan={10} className="px-4 py-8 text-center text-stone-400">
                                                            Chưa có sản phẩm nào
                                                        </td>
                                                    </tr>
                                                )}
                                                {items.length > 0 && (
                                                    <tr className="bg-stone-50 dark:bg-zinc-800/50 font-bold border-t border-stone-200 dark:border-zinc-700">
                                                        <td colSpan={3} className="px-4 py-3 text-right text-stone-900 dark:text-white">
                                                            Tổng cộng:
                                                        </td>
                                                        {/* Total Quantity */}
                                                        <td className="px-4 py-3 text-right text-stone-900 dark:text-white">
                                                            {items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString('vi-VN')}
                                                        </td>

                                                        {/* Total Converted */}
                                                        {hasModule('outbound_conversion') && targetUnit && (
                                                            <td className="px-4 py-3 text-right text-orange-600">
                                                                {items.reduce((sum, item) => {
                                                                    if (!item.quantity || !item.unit) return sum
                                                                    const product = products.find(p => p.id === item.productId)
                                                                    if (!product) return sum

                                                                    let baseQty = 0
                                                                    if (item.unit === product.unit) {
                                                                        baseQty = item.quantity
                                                                    } else {
                                                                        const uConfig = product.product_units?.find(pu => {
                                                                            const uName = units.find(u => u.id === pu.unit_id)?.name
                                                                            return uName === item.unit
                                                                        })
                                                                        if (uConfig) baseQty = item.quantity * uConfig.conversion_rate
                                                                    }

                                                                    if (targetUnit === product.unit) return sum + baseQty

                                                                    const targetConfig = product.product_units?.find(pu => {
                                                                        const uName = units.find(u => u.id === pu.unit_id)?.name
                                                                        return uName === targetUnit
                                                                    })

                                                                    if (targetConfig) return sum + (baseQty / targetConfig.conversion_rate)
                                                                    return sum
                                                                }, 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}
                                                            </td>
                                                        )}

                                                        {/* Financials: Price (Empty) + Amount (Total) */}
                                                        {hasModule('outbound_financials') && (
                                                            <>
                                                                <td className="px-4 py-3"></td>
                                                                <td className="px-4 py-3 text-right text-blue-600 text-base">
                                                                    {totalAmount.toLocaleString('vi-VN')}
                                                                </td>
                                                            </>
                                                        )}

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
                                </div >
                            </>
                        )
                    })()}

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
                            {submitting ? 'Đang lưu...' : 'Lưu Phiếu Xuất'}
                        </button>
                    </div>
                </div>

                {/* Confirm Dialog */}
                <ConfirmDialog
                    isOpen={confirmDialog.isOpen}
                    onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.onConfirm}
                    variant="warning"
                />
            </div>
        </div >
    )
}
