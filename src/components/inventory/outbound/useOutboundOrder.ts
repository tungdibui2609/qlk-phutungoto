import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { unbundleService } from '@/services/inventory/unbundleService'
import { formatQuantityFull } from '@/lib/numberUtils'
import { Product, Customer, Unit, OrderItem } from '../types'

export function useOutboundOrder({ isOpen, initialData, systemCode, onSuccess, onClose, editOrderId }: any) {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()
    const { toBaseAmount, unitNameMap, conversionMap } = useUnitConversion()

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

    // Data State
    const [products, setProducts] = useState<Product[]>([])
    const [customers, setCustomers] = useState<Customer[]>([])
    const [branches, setBranches] = useState<any[]>([])
    const [units, setUnits] = useState<Unit[]>([])
    const [orderTypes, setOrderTypes] = useState<any[]>([])
    const [loadingData, setLoadingData] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => { } })
    const [unitStockMap, setUnitStockMap] = useState<Map<string, number>>(new Map()) // "productId_unitName" -> balance

    // Helper: Config Check
    const outboundModules = currentSystem?.outbound_modules
        ? (typeof currentSystem.outbound_modules === 'string' ? JSON.parse(currentSystem.outbound_modules) : currentSystem.outbound_modules)
        : []

    const hasModule = (moduleId: string) => {
        if (!outboundModules || outboundModules.length === 0) return true
        return outboundModules.includes(moduleId)
    }

    const generateOrderCode = async (type: 'PNK' | 'PXK', sysCode?: string, sysName?: string) => {
        const getSystemAbbreviation = (code: string, name?: string): string => {
            if (name) {
                const nameWithoutKho = name.replace(/^Kho\s+/i, '')
                return nameWithoutKho.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").split(' ').filter(word => word.length > 0).map(word => word[0]).join('').toUpperCase()
            }
            return code.substring(0, 3).toUpperCase()
        }
        const today = new Date()
        const dateStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(2)}`
        const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString()
        const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString()
        const tableName = type === 'PNK' ? 'inbound_orders' : 'outbound_orders'

        const { count, error } = await supabase.from(tableName).select('*', { count: 'exact', head: true }).gte('created_at', startOfDay).lte('created_at', endOfDay)
        if (error) {
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
            const prefix = sysCode ? `${getSystemAbbreviation(sysCode, sysName)}-` : ''
            return `${prefix}${type}-${dateStr}-${random}`
        }
        const stt = String((count || 0) + 1).padStart(3, '0')
        const prefix = sysCode ? `${getSystemAbbreviation(sysCode, sysName)}-` : ''
        return `${prefix}${type}-${dateStr}-${stt}`
    }

    useEffect(() => {
        if (isOpen) {
            fetchData()
            if (editOrderId) {
                fetchOrderDetails(editOrderId)
            }
        } else {
            resetForm()
        }
    }, [isOpen, systemCode, editOrderId])

    async function fetchOrderDetails(id: string) {
        try {
            const { data: order, error } = await supabase
                .from('outbound_orders')
                .select('*, items:outbound_order_items(*)')
                .eq('id', id)
                .single()

            if (error) throw error
            if (!order) return

            setCode(order.code)
            setCustomerName(order.customer_name || '')
            setCustomerAddress(order.customer_address || '')
            setCustomerPhone(order.customer_phone || '')
            setWarehouseName(order.warehouse_name || '')
            setDescription(order.description || '')
            setImages((order.images as string[]) || [])
            setOrderTypeId(order.order_type_id || '')

            if (order.metadata) {
                const meta = order.metadata as any
                setVehicleNumber(meta.vehicleNumber || '')
                setDriverName(meta.driverName || '')
                setContainerNumber(meta.containerNumber || '')
                setTargetUnit(meta.targetUnit || '')
            }

            if (order.items) {
                const formattedItems = order.items.map((i: any) => ({
                    id: crypto.randomUUID(), // New ID for frontend handling
                    productId: i.product_id,
                    productName: i.product_name,
                    unit: i.unit,
                    quantity: i.quantity,
                    document_quantity: i.document_quantity,
                    price: i.price,
                    note: i.note,
                    isDocQtyVisible: i.document_quantity !== i.quantity
                }))
                setItems(formattedItems)
            }

        } catch (e: any) {
            console.error(e)
            showToast('Lỗi tải thông tin phiếu: ' + e.message, 'error')
        }
    }

    function resetForm() {
        setItems([])
        setDescription('')
        setCustomerName('')
        setCustomerAddress('')
        setCustomerPhone('')
        setCode('')
        setVehicleNumber('')
        setDriverName('')
        setContainerNumber('')
        setOrderTypeId('')
        setImages([])
        setTargetUnit('')
    }

    async function fetchData() {
        setLoadingData(true)
        try {
            const [prodRes, branchRes, custRes, invRes, unitRes, typeRes] = await Promise.all([
                supabase.from('products').select('*, product_units(unit_id, conversion_rate)').eq('system_type', systemCode).order('name'),
                supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
                supabase.from('customers').select('*').eq('system_code', systemCode).order('name'),
                fetch(`/api/inventory?systemType=${systemCode}`).then(res => res.json()),
                supabase.from('units').select('*').eq('is_active', true),
                (supabase.from('order_types') as any).select('*').or(`scope.eq.outbound,scope.eq.both`).or(`system_code.eq.${systemCode},system_code.is.null`).eq('is_active', true).order('created_at', { ascending: true })
            ])

            if (prodRes.data) {
                let productsWithStock: Product[] = prodRes.data as Product[]
                if (invRes.ok && Array.isArray(invRes.items)) {
                    const totalStockMap = new Map<string, number>()
                    const detailedStockMap = new Map<string, string[]>()
                    const localUnitStockMap = new Map<string, number>()

                    invRes.items.forEach((item: any) => {
                        if (item.productId) {
                            const prod = prodRes.data.find(p => p.id === item.productId)
                            const baseQty = toBaseAmount(item.productId, item.unit, item.balance, prod?.unit || null)
                            totalStockMap.set(item.productId, (totalStockMap.get(item.productId) || 0) + baseQty)

                            // Aggregation by Unit (Case-insensitive)
                            const uKey = `${item.productId}_${(item.unit || '').toLowerCase().trim()}`
                            localUnitStockMap.set(uKey, (localUnitStockMap.get(uKey) || 0) + item.balance)

                            if (!detailedStockMap.has(item.productId)) detailedStockMap.set(item.productId, [])
                            detailedStockMap.get(item.productId)!.push(`${formatQuantityFull(item.balance)} ${item.unit}`)
                        }
                    })

                    setUnitStockMap(localUnitStockMap)
                    productsWithStock = prodRes.data.map((p: any) => ({
                        ...p,
                        stock_quantity: totalStockMap.get(p.id) ?? 0,
                        stock_details: detailedStockMap.get(p.id)?.join('; ') || ''
                    })) as Product[]
                }
                setProducts(productsWithStock)
            }
            if (custRes.data) setCustomers(custRes.data as any)
            if (unitRes.data) setUnits(unitRes.data)
            if (typeRes.data) setOrderTypes(typeRes.data)

            const branchesData = branchRes.data as any[] || []
            setBranches(branchesData)
            if (!warehouseName && branchesData.length > 0) {
                setWarehouseName(branchesData.find(b => b.is_default)?.name || branchesData[0].name)
            }

            if (initialData) {
                if (initialData.items) setItems(initialData.items)
                if (initialData.customerName) setCustomerName(initialData.customerName)
            }
            generateOrderCode('PXK', systemCode, currentSystem?.name).then(setCode)
        } catch (error) {
            console.error(error)
            showToast('Lỗi tải dữ liệu', 'error')
        }
        setLoadingData(false)
    }

    const handleCustomerSelect = (val: string | null) => {
        if (!val) return
        const c = customers.find(cus => cus.id === val)
        if (c) {
            setCustomerName(c.name)
            setCustomerAddress(c.address || '')
            setCustomerPhone(c.phone || '')
        }
    }

    const addItem = () => {
        setItems([...items, {
            id: crypto.randomUUID(), productId: '', productName: '', unit: '', quantity: 1, document_quantity: 1, price: 0, note: ''
        }])
    }

    const checkUnbundle = (productId: string, unit: string, qty: number): { needsUnbundle: boolean, unbundleInfo?: string, sourceUnit?: string, rate?: number } => {
        const product = products.find(p => p.id === productId)
        if (!product || !unit) return { needsUnbundle: false }

        const normReqUnit = unit.toLowerCase().trim()

        // 1. Check direct liquid stock
        // Note: unitStockMap keys are formatted as "productId_unitname"
        const currentLiquid = unitStockMap.get(`${productId}_${normReqUnit}`) || 0
        if (currentLiquid >= qty - 0.000001) return { needsUnbundle: false }

        const deficit = qty - currentLiquid

        // Helper to get rate Base -> Unit (How many Units in 1 Base)
        // conversionMap: product -> unitId -> rate (Base/Unit). 1 Unit = Rate Base.
        // So Rate(Base/Unit) = 1 Unit / Rate Base?? No.
        // conversionMap stores value from database 'conversion_rate'. Usually "How many Base in 1 Unit".
        // e.g. Thùng (20kg). Rate = 20.
        // Product Base = Kg.

        // Case 1: Break Base Unit (Official Unit)
        // We need to convert FROM Base TO ReqUnit.
        const baseUnitName = (product.unit || '').toLowerCase().trim()
        if (normReqUnit !== baseUnitName) {
            const currentBase = unitStockMap.get(`${productId}_${baseUnitName}`) || 0
            if (currentBase > 0) {
                const rUnitId = unitNameMap.get(normReqUnit)
                // Rate in Map: 1 ReqUnit = X BaseUnit.
                const rateReqStackToBase = conversionMap.get(productId)?.get(rUnitId || '') || 0

                if (rateReqStackToBase > 0) {
                    // We want: How many ReqUnit in 1 BaseUnit?
                    // 1 Base = 1/X ReqUnit.
                    const rateBaseToReq = 1 / rateReqStackToBase

                    // deficit is in ReqUnit.
                    // We need 'baseToBreak' BaseUnits.
                    // baseToBreak * rateBaseToReq >= deficit.
                    // baseToBreak >= deficit / rateBaseToReq.
                    // baseToBreak >= deficit * rateReqStackToBase

                    const baseToBreak = Math.ceil(deficit / rateBaseToReq - 0.000001)

                    // Optimization: Do we have enough Base?
                    if (currentBase >= baseToBreak) {
                        return {
                            needsUnbundle: true,
                            unbundleInfo: `Tự động: Bẻ ${baseToBreak} ${product.unit} -> ${formatQuantityFull(baseToBreak * rateBaseToReq)} ${unit}`,
                            sourceUnit: product.unit ?? undefined,
                            rate: rateBaseToReq // Passing "How many Req in 1 Base"
                        }
                    }
                }
            }
        }

        // Case 2: Break OTHER units
        // e.g. Have Thùng. Need Khay.
        for (const pu of product.product_units || []) {
            const altUnitName = units.find(u => u.id === pu.unit_id)?.name
            if (!altUnitName) continue
            const normAltUnit = altUnitName.toLowerCase().trim()

            if (normAltUnit === normReqUnit) continue

            const currentAlt = unitStockMap.get(`${productId}_${normAltUnit}`) || 0
            if (currentAlt > 0) {
                // Rate Alt -> Base (e.g. 1 Thùng = 25 Kg)
                const altToBase = pu.conversion_rate

                // Rate Req -> Base (e.g. 1 Khay = 2.5 Kg)
                const reqUnitId = unitNameMap.get(normReqUnit)
                // If Req is Base, rate is 1. Else lookup.
                const reqToBase = normReqUnit === baseUnitName ? 1 : (conversionMap.get(productId)?.get(reqUnitId || '') || 1)

                // We want Rate Alt -> Req. (How many Req in 1 Alt)
                // 1 Alt = altToBase Base.
                // 1 Req = reqToBase Base.
                // 1 Alt = (altToBase / reqToBase) Req.
                const rateAltToReq = altToBase / reqToBase

                if (rateAltToReq > 0) {
                    const altToBreak = Math.ceil(deficit / rateAltToReq - 0.000001)

                    if (currentAlt >= altToBreak) {
                        return {
                            needsUnbundle: true,
                            unbundleInfo: `Tự động: Bẻ ${altToBreak} ${altUnitName} -> ${formatQuantityFull(altToBreak * rateAltToReq)} ${unit}`,
                            sourceUnit: altUnitName,
                            rate: rateAltToReq
                        }
                    }
                }
            }
        }

        return { needsUnbundle: false }
    }

    const updateItem = (id: string, field: keyof OrderItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item
            let updatedItem = { ...item, [field]: value }

            if (field === 'productId') {
                const prod = products.find(p => p.id === value)
                let initialUnit = ''
                if (prod && (!prod.product_units || prod.product_units.length === 0) && prod.unit) initialUnit = prod.unit
                updatedItem = { ...updatedItem, productId: value, productName: prod?.name || '', unit: initialUnit, price: prod?.cost_price || 0 }
            }
            if (field === 'quantity') {
                const newValue = Number(value)
                updatedItem = { ...updatedItem, quantity: newValue, document_quantity: !item.isDocQtyVisible ? newValue : item.document_quantity }
            }

            // Always re-check unbundle status when product, unit or quantity changes
            if (field === 'productId' || field === 'unit' || field === 'quantity') {
                const { needsUnbundle, unbundleInfo } = checkUnbundle(updatedItem.productId, updatedItem.unit, updatedItem.quantity)
                updatedItem.needsUnbundle = needsUnbundle
                updatedItem.unbundleInfo = unbundleInfo
            }

            return updatedItem
        }))
    }

    const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))

    const handleSubmit = async () => {
        if (!customerName) return showToast('Vui lòng nhập tên khách hàng', 'warning')
        if (items.length === 0) return showToast('Vui lòng thêm ít nhất 1 sản phẩm', 'warning')
        if (items.find(i => !i.productId || !i.unit)) return showToast('Vui lòng chọn đầy đủ sản phẩm và đơn vị tính', 'warning')

        // Stock Check
        const warnings: string[] = []
        items.forEach(item => {
            const product = products.find(p => p.id === item.productId)
            if (product) {
                if ((product.stock_quantity ?? 0) <= 0) warnings.push(`• ${product.name}\n  (Hết hàng - Tồn: ${product.stock_quantity ?? 0})`)
                else if (item.quantity > (product.stock_quantity ?? 0)) warnings.push(`• ${product.name}\n  (Xuất quá tồn - Tồn: ${product.stock_quantity ?? 0}, Xuất: ${item.quantity})`)
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
            // Find Conversion Order Type
            const conversionType = orderTypes.find(t => t.name.toLowerCase().includes('chuyển đổi'))
            const convTypeId = conversionType?.id

            // Step 1: Check and Perform Auto-Unbundle for items that need it
            for (const item of items) {
                const unbundle = checkUnbundle(item.productId, item.unit, item.quantity)

                if (unbundle.needsUnbundle && unbundle.sourceUnit && unbundle.rate) {
                    const product = products.find(p => p.id === item.productId)
                    const currentLiquid = unitStockMap.get(`${item.productId}_${item.unit}`) || 0

                    const baseToBreak = await unbundleService.executeAutoUnbundle({
                        supabase,
                        productId: item.productId,
                        productName: item.productName,
                        baseUnit: unbundle.sourceUnit,
                        reqUnit: item.unit,
                        reqQty: item.quantity,
                        currentLiquid,
                        costPrice: product?.cost_price || 0,
                        rate: unbundle.rate,
                        warehouseName,
                        systemCode,
                        mainOrderCode: code,
                        convTypeId,
                        generateOrderCode: (type) => generateOrderCode(type, systemCode, currentSystem?.name)
                    })

                    if (baseToBreak) {
                        showToast(`Đã tự động bẻ ${baseToBreak} ${unbundle.sourceUnit} sang ${item.unit}`, 'success')
                    }
                }
            }

            // Step 2: Create or Update Main Outbound Order
            let orderId = editOrderId

            if (editOrderId) {
                const { error: updateError } = await (supabase.from('outbound_orders') as any).update({
                    customer_name: customerName,
                    customer_address: customerAddress,
                    customer_phone: customerPhone,
                    warehouse_name: warehouseName,
                    description,
                    order_type_id: orderTypeId || null,
                    images,
                    metadata: {
                        vehicleNumber,
                        driverName,
                        containerNumber,
                        targetUnit
                    }
                }).eq('id', editOrderId)

                if (updateError) throw updateError

                // Delete old items to replace with new ones
                const { error: deleteError } = await supabase.from('outbound_order_items').delete().eq('order_id', editOrderId)
                if (deleteError) throw deleteError

            } else {
                const { data: order, error: orderError } = await (supabase.from('outbound_orders') as any).insert({
                    code,
                    customer_name: customerName,
                    customer_address: customerAddress,
                    customer_phone: customerPhone,
                    warehouse_name: warehouseName,
                    description,
                    status: 'Pending',
                    type: 'Sale',
                    order_type_id: orderTypeId || null,
                    images,
                    system_code: systemCode,
                    system_type: systemCode,
                    metadata: {
                        vehicleNumber,
                        driverName,
                        containerNumber,
                        targetUnit
                    }
                }).select().single()

                if (orderError) throw orderError
                if (!order) throw new Error('Failed to create order')
                orderId = order.id
            }

            const orderItems = items.map(item => ({
                order_id: orderId,
                product_id: item.productId,
                product_name: item.productName,
                unit: item.unit,
                quantity: item.quantity,
                document_quantity: item.document_quantity || item.quantity,
                price: item.price || 0,
                note: item.note
            }))

            const { error: itemsError } = await (supabase.from('outbound_order_items') as any).insert(orderItems)
            if (itemsError) throw itemsError

            // Cleanup LOT metadata if this was a buffer sync
            if (initialData?.batchData) {
                for (const p of initialData.batchData) {
                    const { data: lot } = await supabase.from('lots').select('metadata').eq('id', p.lot_id).single()
                    if (lot) {
                        const metadata = { ...lot.metadata as any }
                        metadata.system_history.exports = metadata.system_history.exports.map((exp: any) => {
                            if (exp.id === p.export_id) {
                                return { ...exp, draft: false, order_id: orderId, order_code: code }
                            }
                            return exp
                        })
                        await supabase.from('lots').update({ metadata }).eq('id', p.lot_id)
                    }
                }
            }
            onSuccess()
            onClose()
        } catch (e: any) {
            showToast(e.message, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    return {
        code, setCode,
        customerName, setCustomerName,
        customerAddress, setCustomerAddress,
        customerPhone, setCustomerPhone,
        warehouseName, setWarehouseName,
        description, setDescription,
        items, addItem, updateItem, removeItem,
        vehicleNumber, setVehicleNumber,
        driverName, setDriverName,
        containerNumber, setContainerNumber,
        orderTypeId, setOrderTypeId,
        images, setImages,
        targetUnit, setTargetUnit,
        products, customers, branches, units, orderTypes,
        loadingData, submitting, handleSubmit,
        hasModule, confirmDialog, setConfirmDialog, handleCustomerSelect
    }
}
