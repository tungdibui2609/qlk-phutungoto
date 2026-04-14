import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { useUser } from '@/contexts/UserContext'
import { unbundleService } from '@/services/inventory/unbundleService'
import { formatQuantityFull } from '@/lib/numberUtils'
import { Product, Customer, Unit, OrderItem } from '../types'
import { generateOrderCode } from '@/lib/orderCodeUtils'
import { lotService } from '@/services/warehouse/lotService'

export function useOutboundOrder({ isOpen, initialData, systemCode, onSuccess, onClose, editOrderId }: any) {
    const { showToast } = useToast()
    const { currentSystem, hasModule } = useSystem()
    const { profile } = useUser()
    const { getBaseAmount: toBaseAmount, convertUnit, unitNameMap, conversionMap, unitIdMap } = useUnitConversion()

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
    const [sealNumber, setSealNumber] = useState('')
    const [orderTypeId, setOrderTypeId] = useState('')
    // Images State
    const [images, setImages] = useState<string[]>([])
    // Conversion State
    const [targetUnit, setTargetUnit] = useState<string>('')
    const [createdAt, setCreatedAt] = useState<string>(new Date().toISOString())

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


    const isUtilityEnabled = (utilityId: string) => {
        // [ROBUST] Check both pre-parsed array and raw JSON structure
        if (Array.isArray(currentSystem?.utility_modules) && currentSystem.utility_modules.includes(utilityId)) return true
        
        const rawUtils = (currentSystem?.modules as any)?.utility_modules
        if (Array.isArray(rawUtils) && rawUtils.includes(utilityId)) return true

        return false
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
                .single() as { data: any, error: any }

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
                setSealNumber(meta.sealNumber || '')
                setVehicleNumber(meta.vehicleNumber || '')
                setDriverName(meta.driverName || '')
                setContainerNumber(meta.containerNumber || '')
                if (meta.targetUnit) setTargetUnit(meta.targetUnit)
            }
            if (order.created_at) setCreatedAt(order.created_at)

            if (order.items) {
                const formattedItems = order.items.map((i: any) => {
                    const item = {
                        id: crypto.randomUUID(),
                        productId: i.product_id,
                        productName: i.product_name,
                        unit: i.unit,
                        quantity: i.quantity,
                        document_quantity: i.document_quantity,
                        price: i.price,
                        note: i.note,
                        isDocQtyVisible: i.document_quantity !== i.quantity
                    }
                    
                    // Check unbundle for existing items
                    if (isUtilityEnabled('auto_unbundle_order')) {
                        const { needsUnbundle, unbundleInfo } = checkUnbundle(item.productId, item.unit, item.quantity)
                        return { ...item, needsUnbundle, unbundleInfo }
                    }

                    return item
                })
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
        setSealNumber('')
        setOrderTypeId('')
        setImages([])
        setTargetUnit('')
        setCreatedAt(new Date().toISOString())
    }

    async function fetchData() {
        setLoadingData(true)
        try {
            const [prodRes, branchRes, custRes, invRes, unitRes, typeRes] = await Promise.all([
                supabase.from('products').select('*, product_units(unit_id, conversion_rate)').eq('system_type', systemCode).order('name'),
                supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
                supabase.from('customers').select('*').eq('system_code', systemCode).order('name'),
                fetch(`/api/inventory?systemType=${systemCode}`).then(res => res.json()),
                supabase.from('units').select('*').eq('is_active', true).or(`system_code.eq.${systemCode},system_code.is.null`),
                (supabase.from('order_types') as any).select('*').or(`scope.eq.outbound,scope.eq.both`).or(`system_code.eq.${systemCode},system_code.is.null`).eq('is_active', true).order('created_at', { ascending: true })
            ])

            if (prodRes.data) {
                let productsWithStock: Product[] = prodRes.data as Product[]
                if (invRes.ok && Array.isArray(invRes.items)) {
                    const totalStockMap = new Map<string, number>()
                    const detailedStockMap = new Map<string, string[]>()
                    const localUnitStockMap = new Map<string, number>()

                    // Optimization: Use a lookup map for products instead of repeating .find() inside the loop.
                    // This improves performance from O(N*M) to O(N+M).
                    const productLookup = new Map<string, any>()
                    ;(prodRes.data as any[]).forEach(p => productLookup.set(p.id, p))

                    invRes.items.forEach((item: any) => {
                        if (item.productId) {
                            const prod = productLookup.get(item.productId)
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
            generateOrderCode('PXK', systemCode).then(setCode)
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
        return unbundleService.checkUnbundle({
            productId,
            unit,
            qty,
            products,
            units,
            unitNameMap,
            unitIdMap,
            conversionMap,
            unitStockMap
        })
    }

    const updateItem = (id: string, field: keyof OrderItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item
            if (field === 'productId') {
                const prod = products.find(p => p.id === value)
                let initialUnit = ''
                if (prod && (!prod.product_units || prod.product_units.length === 0) && prod.unit) initialUnit = prod.unit
                
                const returnItem = { ...item, productId: value, productName: prod?.name || '', unit: initialUnit, price: (prod as any)?.price || 0 }
                
                // Check unbundle
                if (isUtilityEnabled('auto_unbundle_order')) {
                    const { needsUnbundle, unbundleInfo } = checkUnbundle(value, initialUnit, item.quantity)
                    return { ...returnItem, needsUnbundle, unbundleInfo }
                }

                return returnItem
            }
            if (field === 'quantity') {
                const newValue = Number(value)
                const returnItem = { ...item, quantity: newValue, document_quantity: !item.isDocQtyVisible ? newValue : item.document_quantity }
                
                // Check unbundle
                if (isUtilityEnabled('auto_unbundle_order')) {
                    const { needsUnbundle, unbundleInfo } = checkUnbundle(item.productId, item.unit, newValue)
                    return { ...returnItem, needsUnbundle, unbundleInfo }
                }

                return returnItem
            }
            if (field === 'unit') {
                const newVal = value as string
                const oldVal = item.unit
                const prod = products.find(p => p.id === item.productId)
                const baseUnitName = prod?.unit || ''
                
                const newQty = convertUnit(
                    item.productId,
                    oldVal,
                    newVal,
                    item.quantity || 0,
                    baseUnitName
                )

                const returnItem = { 
                    ...item, 
                    unit: newVal, 
                    quantity: Number(newQty.toFixed(3)),
                    document_quantity: !item.isDocQtyVisible ? Number(newQty.toFixed(3)) : item.document_quantity
                }

                // Check unbundle
                if (isUtilityEnabled('auto_unbundle_order')) {
                    const { needsUnbundle, unbundleInfo } = checkUnbundle(item.productId, newVal, Number(newQty.toFixed(3)))
                    return { ...returnItem, needsUnbundle, unbundleInfo }
                }

                return returnItem
            }
            return { ...item, [field]: value }
        }))
    }

    const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))

    const handleSubmit = async () => {
        if (items.length === 0) return showToast('Vui lòng thêm ít nhất 1 sản phẩm', 'warning')
        if (items.find(i => !i.productId || !i.unit)) return showToast('Vui lòng chọn đầy đủ sản phẩm và đơn vị tính', 'warning')

        // Validating total quantity
        const totalItemsQty = items.reduce((acc, item) => acc + (item.quantity || 0), 0)
        if (totalItemsQty === 0) return showToast('Tổng số lượng phải lớn hơn 0', 'warning')

        setSubmitting(true)
        try {
            // Unbundle processing if enabled
            let processedItems = [...items]
            if (isUtilityEnabled('auto_unbundle_order')) {
                const { processed, unbundledCount } = unbundleService.processUnbundle(items, products, units, unitNameMap, unitIdMap, conversionMap, unitStockMap)
                if (unbundledCount > 0) {
                    processedItems = processed
                    showToast(`Đã tự động rã ${unbundledCount} dòng sản phẩm từ kho lẻ`, 'info')
                }
            }

            let orderId = editOrderId
            const payload = {
                customer_name: customerName,
                customer_address: customerAddress,
                customer_phone: customerPhone,
                warehouse_name: warehouseName,
                description,
                order_type_id: orderTypeId || null,
                images,
                updated_at: new Date().toISOString(),
                metadata: { vehicleNumber, driverName, containerNumber, sealNumber, targetUnit },
                company_id: profile?.company_id || null,
                created_at: createdAt
            }

            if (editOrderId) {
                const { error: updateError } = await (supabase.from('outbound_orders') as any).update(payload).eq('id', editOrderId)
                if (updateError) throw updateError
                await supabase.from('outbound_order_items').delete().eq('order_id', editOrderId)
            } else {
                const { data: order, error: orderError } = await (supabase.from('outbound_orders') as any).insert({
                    ...payload,
                    code,
                    status: 'Pending',
                    type: 'Sale',
                    system_code: systemCode,
                    system_type: systemCode,
                }).select().single()
                if (orderError) throw orderError
                orderId = order.id
            }

            if (!orderId) throw new Error('No Order ID')

            // Execute automatic unbundling for marked items
            if (isUtilityEnabled('auto_unbundle_order')) {
                const convType = orderTypes.find(t => t.name?.toLowerCase().includes('chuyển đổi') || t.scope === 'internal')
                for (const item of processedItems as any[]) {
                    if (item.needsUnbundle && item.unbundleMeta) {
                        const meta = item.unbundleMeta
                        const currentLiquid = unitStockMap.get(`${item.productId}_${(item.unit || '').toLowerCase().trim()}`) || 0
                        
                        await unbundleService.executeAutoUnbundle({
                            supabase,
                            productId: item.productId,
                            productName: item.productName,
                            baseUnit: meta.sourceUnit,
                            reqUnit: item.unit,
                            reqQty: item.quantity,
                            currentLiquid,
                            costPrice: item.price,
                            rate: meta.rate,
                            warehouseName,
                            systemCode,
                            mainOrderCode: code,
                            convTypeId: convType?.id,
                            conversionMap,
                            unitNameMap,
                            unitIdMap,
                            generateOrderCode: (type: 'PNK' | 'PXK') => generateOrderCode(type, systemCode)
                        })
                    }
                }
            }
            const orderItems = processedItems.map(item => ({
                order_id: orderId,
                product_id: item.productId,
                product_name: item.productName,
                unit: item.unit,
                quantity: item.quantity,
                document_quantity: item.document_quantity || item.quantity,
                price: item.price,
                note: item.note
            }))

            const { error: itemsError } = await (supabase.from('outbound_order_items') as any).insert(orderItems)
            if (itemsError) throw itemsError

            onSuccess(orderId)
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
        sealNumber, setSealNumber,
        orderTypeId, setOrderTypeId,
        images, setImages,
        targetUnit, setTargetUnit,
        createdAt, setCreatedAt,
        products, customers, branches, units, orderTypes,
        loadingData, submitting, handleSubmit,
        handleCustomerSelect,
        confirmDialog, setConfirmDialog,
        hasModule,
        convertUnit
    }
}
