'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Save, Printer, Landmark, Trash2, Calendar, MapPin, Phone, Building2, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { OrderFormLayout } from '@/components/inventory/shared/OrderFormLayout'
import { OutboundItemsTable } from '@/components/inventory/outbound/OutboundItemsTable'
import { Combobox } from '@/components/ui/Combobox'
import { Product, Unit, OrderItem } from '@/components/inventory/types'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { generateBankOrderCode } from '@/lib/orderCodeUtils'
import { formatQuantityFull } from '@/lib/numberUtils'

interface BankOutboundOrderModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: (orderId?: string, autoPrint?: boolean) => void
    editOrderId?: string | null
    duplicateOrderId?: string | null
    systemCode?: string
}

export default function BankOutboundOrderModal({
    isOpen,
    onClose,
    onSuccess,
    editOrderId,
    duplicateOrderId,
    systemCode: propSystemCode
}: BankOutboundOrderModalProps) {
    const isDuplicate = !!duplicateOrderId
    const { showToast } = useToast()
    const { hasModule, systemType } = useSystem()
    const { profile } = useUser()
    const { convertUnit } = useUnitConversion()

    const systemCode = propSystemCode || systemType || 'KHO_DONG_LANH'

    // Form states
    const [code, setCode] = useState('')
    const [selectedCustomerId, setSelectedCustomerId] = useState('')
    const [customerName, setCustomerName] = useState('')
    const [customerAddress, setCustomerAddress] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [warehouseName, setWarehouseName] = useState('')
    const [description, setDescription] = useState('')
    const [createdAt, setCreatedAt] = useState<string>(new Date().toISOString())
    const [targetUnit, setTargetUnit] = useState<string>('')
    const [items, setItems] = useState<OrderItem[]>([])

    // Master data
    const [products, setProducts] = useState<Product[]>([])
    const [customers, setCustomers] = useState<any[]>([])
    const [branches, setBranches] = useState<any[]>([])
    const [units, setUnits] = useState<Unit[]>([])
    const [categories, setCategories] = useState<any[]>([])

    const [loadingData, setLoadingData] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const createEmptyItem = (): OrderItem => ({
        id: crypto.randomUUID(),
        productId: '',
        productName: '',
        unit: 'kg',
        quantity: 1,
        document_quantity: 1,
        price: 0,
        note: '',
        categoryId: null
    })

    useEffect(() => {
        if (isOpen) {
            fetchData()
        } else {
            resetForm()
        }
    }, [isOpen, editOrderId, duplicateOrderId, systemCode])

    function resetForm() {
        setItems([createEmptyItem()])
        setDescription('')
        setSelectedCustomerId('')
        setCustomerName('')
        setCustomerAddress('')
        setCustomerPhone('')
        setCode('')
        setCreatedAt(new Date().toISOString())
        setTargetUnit('')
    }

    async function fetchData() {
        setLoadingData(true)
        try {
            let activeSys = systemCode
            if (editOrderId || duplicateOrderId) {
                const targetId = (editOrderId || duplicateOrderId) as string
                const { data: oData } = await ((supabase
                    .from('bank_outbound_orders' as any) as any)
                    .select('system_code')
                    .eq('id', targetId)
                    .single())
                if (oData?.system_code) activeSys = oData.system_code
            }

            const [prodRes, custRes, branchRes, unitRes, catRes] = await Promise.all([
                supabase.from('products').select('*, product_units(unit_id, conversion_rate)').eq('system_type', activeSys).order('name'),
                supabase.from('customers').select('*').eq('system_code', activeSys).order('name'),
                supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
                supabase.from('units').select('*').eq('is_active', true).or(`system_code.eq.${activeSys},system_code.is.null`),
                supabase.from('categories').select('*').eq('system_type', activeSys).order('name')
            ])

            const loadedProducts = prodRes.data || []
            const mappedProducts: Product[] = loadedProducts.map((p: any) => ({
                ...p,
                name: p.name || p.internal_name || p.sku || 'Sản phẩm'
            }))

            setProducts(mappedProducts)
            if (custRes.data) setCustomers(custRes.data)

            const rawUnits = (unitRes.data || []) as Unit[]
            const seenUnitNames = new Set<string>()
            const uniqueUnits = rawUnits.filter((u: any) => {
                const norm = (u.name || '').trim().toLowerCase()
                if (!norm || seenUnitNames.has(norm)) return false
                seenUnitNames.add(norm)
                return true
            })
            setUnits(uniqueUnits)
            if (catRes.data) setCategories(catRes.data)

            const branchesData = branchRes.data as any[] || []
            setBranches(branchesData)

            if (editOrderId || duplicateOrderId) {
                const targetId = (editOrderId || duplicateOrderId) as string
                const { data: orderData, error: orderError } = await ((supabase
                    .from('bank_outbound_orders' as any) as any)
                    .select('*')
                    .eq('id', targetId)
                    .single())

                if (orderData) {
                    const o = orderData as any
                    if (editOrderId) {
                        setCode(o.code)
                    } else {
                        const newCode = await generateBankOrderCode('BANK_OUTBOUND')
                        setCode(newCode)
                    }

                    setSelectedCustomerId(o.customer_id || '')
                    setCustomerName(o.customer_name || '')
                    setCustomerAddress(o.customer_address || '')
                    setCustomerPhone(o.customer_phone || '')
                    setWarehouseName(o.warehouse_name || (branchesData[0]?.name || ''))
                    setDescription(o.description || '')
                    if (o.created_at) setCreatedAt(o.created_at)
                    if (o.metadata?.targetUnit) setTargetUnit(o.metadata.targetUnit)
                    else setTargetUnit('')

                    const { data: itemsData } = await ((supabase
                        .from('bank_outbound_order_items' as any) as any)
                        .select('*')
                        .eq('order_id', targetId))

                    if (itemsData && itemsData.length > 0) {
                        setItems((itemsData as any[]).map((i: any) => ({
                            id: crypto.randomUUID(),
                            productId: i.product_id || '',
                            productName: i.product_name || '',
                            unit: i.unit || 'kg',
                            quantity: Number(i.quantity) || 1,
                            document_quantity: Number(i.document_quantity) || Number(i.quantity) || 1,
                            price: Number(i.price) || 0,
                            note: i.note || '',
                            categoryId: i.category_id || null
                        })))
                    } else {
                        setItems([createEmptyItem()])
                    }
                }
            } else {
                // Brand new order
                const newCode = await generateBankOrderCode('BANK_OUTBOUND')
                setCode(newCode)
                if (branchesData.length > 0) {
                    setWarehouseName(branchesData.find((b: any) => b.is_default)?.name || branchesData[0].name)
                }
                setItems([createEmptyItem()])
            }
        } catch (err: any) {
            console.error('Error fetching data for Bank Outbound Modal:', err)
            showToast('Lỗi tải dữ liệu: ' + err.message, 'error')
        } finally {
            setLoadingData(false)
        }
    }

    const handleCustomerChange = (id: string | null) => {
        setSelectedCustomerId(id || '')
        if (id) {
            const found = customers.find(c => c.id === id)
            if (found) {
                setCustomerName(found.name || '')
                setCustomerAddress(found.address || '')
                setCustomerPhone(found.phone || '')
            }
        } else {
            setCustomerName('')
            setCustomerAddress('')
            setCustomerPhone('')
        }
    }

    const addItem = () => {
        setItems(prev => [...prev, createEmptyItem()])
    }

    const removeItem = (id: string) => {
        setItems(prev => {
            const filtered = prev.filter(i => i.id !== id)
            return filtered.length === 0 ? [createEmptyItem()] : filtered
        })
    }

    const updateItem = (id: string, field: keyof OrderItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item
            const updated = { ...item, [field]: value }

            // When a product is selected in Combobox, auto-fill unit & price
            if (field === 'productId') {
                const prod = products.find(p => p.id === value)
                if (prod) {
                    updated.productName = prod.name
                    updated.unit = prod.unit || 'kg'
                    updated.price = (prod as any)?.price || (prod as any)?.selling_price || 0
                }
            }
            return updated
        }))
    }

    const totalQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
    const totalAmount = items.reduce((sum, it) => sum + ((Number(it.quantity) || 0) * (Number(it.price) || 0)), 0)

    const handleSubmit = async (autoPrint = false) => {
        if (!code.trim()) {
            showToast('Vui lòng nhập mã phiếu', 'error')
            return
        }

        const validItems = items.filter(i => i.productId || i.productName)
        if (validItems.length === 0) {
            showToast('Vui lòng thêm ít nhất một sản phẩm vào phiếu', 'error')
            return
        }

        setSubmitting(true)
        try {
            const customerObj = customers.find(c => c.id === selectedCustomerId)
            const resolvedCustomerName = customerName || customerObj?.name || 'Khách hàng'

            const orderPayload: any = {
                code: code.trim(),
                status: 'Completed',
                warehouse_name: warehouseName,
                customer_id: selectedCustomerId || null,
                customer_name: resolvedCustomerName,
                customer_address: customerAddress,
                customer_phone: customerPhone,
                description: description,
                system_code: systemCode,
                system_type: systemCode,
                company_id: profile?.company_id || null,
                created_by: profile?.id || null,
                created_by_name: profile?.full_name || null,
                metadata: {
                    basisNum: code.trim(),
                    basisDate: format(new Date(createdAt), 'dd/MM/yyyy'),
                    is_bank_only: true,
                    targetUnit: targetUnit || null
                },
                created_at: createdAt
            }

            let savedOrderId = editOrderId

            if (editOrderId) {
                const { error: updateError } = await ((supabase
                    .from('bank_outbound_orders' as any) as any)
                    .update(orderPayload)
                    .eq('id', editOrderId))
                if (updateError) throw updateError

                await ((supabase
                    .from('bank_outbound_order_items' as any) as any)
                    .delete()
                    .eq('order_id', editOrderId))
            } else {
                const { data: newOrder, error: insertError } = await ((supabase
                    .from('bank_outbound_orders' as any) as any)
                    .insert(orderPayload)
                    .select()
                    .single())
                if (insertError) throw insertError
                savedOrderId = (newOrder as any)?.id
            }

            const itemPayloads = validItems.map(item => {
                const prod = products.find(p => p.id === item.productId)
                return {
                    order_id: savedOrderId,
                    product_id: item.productId || null,
                    product_name: prod?.name || item.productName || 'Sản phẩm',
                    unit: item.unit || prod?.unit || 'kg',
                    quantity: Number(item.quantity) || 1,
                    document_quantity: Number(item.document_quantity) || Number(item.quantity) || 1,
                    price: Number(item.price) || 0,
                    note: item.note || '',
                    company_id: profile?.company_id || null
                }
            })

            const { error: itemsError } = await ((supabase
                .from('bank_outbound_order_items' as any) as any)
                .insert(itemPayloads))
            if (itemsError) throw itemsError

            showToast(
                editOrderId ? 'Cập nhật phiếu xuất ngân hàng thành công!' : 'Tạo phiếu xuất ngân hàng thành công!',
                'success'
            )

            onSuccess(savedOrderId || undefined, autoPrint)
            onClose()
        } catch (err: any) {
            console.error('Error submitting bank outbound order:', err)
            showToast('Lỗi khi lưu phiếu: ' + err.message, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    const footerButtons = (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <span className="text-xs text-stone-400 italic">
                * Phiếu được lưu riêng và chỉ sử dụng để in ấn ký tá ngân hàng.
            </span>
            <div className="flex items-center gap-2.5 justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-gray-300 font-medium hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors text-xs"
                >
                    Hủy bỏ
                </button>
                <button
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60 text-xs"
                >
                    <Save size={16} />
                    {submitting ? 'Đang lưu...' : (editOrderId ? 'Cập Nhật Phiếu' : 'Lưu Phiếu')}
                </button>
                <button
                    onClick={() => handleSubmit(true)}
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60 text-xs"
                >
                    <Printer size={16} />
                    Lưu & In Ngay
                </button>
            </div>
        </div>
    )

    return (
        <OrderFormLayout
            title={
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                        <Landmark size={18} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-stone-900 dark:text-white">
                            {editOrderId ? 'Chỉnh Sửa Phiếu Xuất Ngân Hàng' : isDuplicate ? 'Nhân Bản Phiếu Xuất Ngân Hàng' : 'Tạo Phiếu Xuất Ngân Hàng'}
                        </h2>
                        <p className="text-xs text-stone-500 font-normal mt-0.5">
                            Phiếu in chứng từ gửi ngân hàng (Không ảnh hưởng đến tồn kho)
                        </p>
                    </div>
                </div>
            }
            onClose={onClose}
            footer={footerButtons}
            maxWidth="max-w-6xl"
        >
            <div className="space-y-4">
                {/* 1. Compact Information Card */}
                <div className="bg-stone-50/70 dark:bg-zinc-800/40 p-3.5 rounded-xl border border-stone-200 dark:border-zinc-700 space-y-2.5">
                    {/* Row 1: Code, Date, Warehouse, Customer, Conversion */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div>
                            <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                                Mã phiếu
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full h-9 px-3 text-xs font-mono font-bold bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-stone-900 dark:text-white"
                                placeholder="xxxx/mmyy/LXK"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                                Ngày phiếu
                            </label>
                            <input
                                type="datetime-local"
                                value={createdAt ? format(new Date(createdAt), "yyyy-MM-dd'T'HH:mm") : ''}
                                onChange={(e) => setCreatedAt(e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString())}
                                className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-stone-900 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                                Kho xuất hàng
                            </label>
                            <select
                                value={warehouseName}
                                onChange={(e) => setWarehouseName(e.target.value)}
                                className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-stone-900 dark:text-white"
                            >
                                {branches.map(b => (
                                    <option key={b.id} value={b.name}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                                Khách hàng
                            </label>
                            <Combobox
                                options={customers.map(c => ({
                                    value: c.id,
                                    label: c.name,
                                    sub: c.phone || c.address
                                }))}
                                value={selectedCustomerId}
                                onChange={handleCustomerChange}
                                placeholder="-- Chọn khách hàng --"
                                className="w-full text-xs"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                                Hiển thị quy đổi theo
                            </label>
                            <select
                                value={targetUnit}
                                onChange={(e) => setTargetUnit(e.target.value)}
                                className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-stone-900 dark:text-white"
                            >
                                <option value="">-- Không quy đổi --</option>
                                {units.map(u => (
                                    <option key={u.id} value={u.name}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Address, Phone, Description */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
                        <input
                            type="text"
                            value={customerAddress}
                            onChange={(e) => setCustomerAddress(e.target.value)}
                            placeholder="Địa chỉ khách hàng..."
                            className="w-full h-8 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-stone-700 dark:text-gray-300 placeholder:text-stone-400"
                        />
                        <input
                            type="text"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="Số điện thoại..."
                            className="w-full h-8 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-stone-700 dark:text-gray-300 placeholder:text-stone-400"
                        />
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Diễn giải / Ghi chú thêm trên phiếu..."
                            className="w-full h-8 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-stone-700 dark:text-gray-300 placeholder:text-stone-400"
                        />
                    </div>
                </div>

                {/* 2. Items Table: Directly visible front-and-center */}
                <div className="space-y-3">
                    <OutboundItemsTable
                        items={items}
                        products={products}
                        units={units}
                        categories={categories}
                        updateItem={updateItem}
                        removeItem={removeItem}
                        targetUnit={targetUnit}
                        hasModule={(id) => id === 'outbound_basic' || (targetUnit ? id === 'outbound_conversion' : false)}
                        compact={false}
                        displayInternalCode={false}
                        convertUnit={convertUnit}
                    />

                    {/* Add Item Button */}
                    <button
                        onClick={addItem}
                        className="w-full py-2 border border-dashed border-blue-300 dark:border-blue-800/60 rounded-xl text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors flex items-center justify-center gap-2 font-medium text-xs"
                    >
                        <Plus size={16} />
                        Thêm dòng sản phẩm
                    </button>

                    {/* Summary Bar */}
                    <div className="flex items-center justify-between p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/40 rounded-xl text-xs">
                        <div className="flex items-center gap-4 text-stone-600 dark:text-gray-300">
                            <span>Tổng cộng: <strong className="text-stone-900 dark:text-white">{items.length}</strong> mặt hàng</span>
                            <span className="text-stone-300">|</span>
                            <span>Tổng số lượng: <strong className="text-stone-900 dark:text-white">{formatQuantityFull(totalQty)}</strong></span>
                        </div>
                    </div>
                </div>
            </div>
        </OrderFormLayout>
    )
}
