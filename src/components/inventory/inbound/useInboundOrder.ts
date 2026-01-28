import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { Product, Supplier, Unit, OrderItem } from '../types'

export function useInboundOrder({ isOpen, editOrderId, initialData, systemCode, onSuccess, onClose }: any) {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()
    const { profile } = useUser()

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
    const [orderTypeId, setOrderTypeId] = useState('')
    // Images State
    const [images, setImages] = useState<string[]>([])
    // Conversion State
    const [targetUnit, setTargetUnit] = useState<string>('')

    // Data State
    const [products, setProducts] = useState<Product[]>([])
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [branches, setBranches] = useState<any[]>([])
    const [units, setUnits] = useState<Unit[]>([])
    const [orderTypes, setOrderTypes] = useState<any[]>([])
    const [loadingData, setLoadingData] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Helper: Config Check
    const inboundModules = currentSystem?.inbound_modules
        ? (typeof currentSystem.inbound_modules === 'string' ? JSON.parse(currentSystem.inbound_modules) : currentSystem.inbound_modules)
        : []

    const hasModule = (moduleId: string) => {
        if (!inboundModules || inboundModules.length === 0) return true
        return inboundModules.includes(moduleId)
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
        } else {
            resetForm()
        }
    }, [isOpen, editOrderId, systemCode])

    function resetForm() {
        setItems([])
        setDescription('')
        setSupplierId('')
        setSupplierAddress('')
        setSupplierPhone('')
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
            const [prodRes, suppRes, branchRes, unitRes, typeRes] = await Promise.all([
                supabase.from('products').select('*, product_units(unit_id, conversion_rate)').eq('system_type', systemCode).order('name'),
                supabase.from('suppliers').select('*').eq('system_code', systemCode).order('name'),
                supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
                supabase.from('units').select('*').eq('is_active', true),
                (supabase.from('order_types') as any).select('*').or(`scope.eq.inbound,scope.eq.both`).or(`system_code.eq.${systemCode},system_code.is.null`).eq('is_active', true).order('created_at', { ascending: true })
            ])

            if (prodRes.data) setProducts(prodRes.data)
            if (suppRes.data) setSuppliers(suppRes.data)
            if (unitRes.data) setUnits(unitRes.data)
            if (typeRes.data) setOrderTypes(typeRes.data)
            const branchesData = branchRes.data as any[] || []
            setBranches(branchesData)

            if (!editOrderId && !warehouseName && branchesData.length > 0) {
                setWarehouseName(branchesData.find(b => b.is_default)?.name || branchesData[0].name)
            }

            if (editOrderId) {
                const { data: orderData, error: orderError } = await (supabase.from('inbound_orders') as any).select('*').eq('id', editOrderId).single()
                if (orderError) throw orderError
                const order = orderData as any
                if (order) {
                    setCode(order.code)
                    setSupplierId(order.supplier_id || '')
                    setSupplierAddress(order.supplier_address || '')
                    setSupplierPhone(order.supplier_phone || '')
                    setWarehouseName(order.warehouse_name || '')
                    setOrderTypeId(order.order_type_id || '')
                    setDescription(order.description || '')
                    if (Array.isArray(order.images)) setImages(order.images); else if (order.image_url) setImages([order.image_url])
                    const meta = order.metadata || {}
                    setVehicleNumber(meta.vehicleNumber || '')
                    setDriverName(meta.driverName || '')
                    setContainerNumber(meta.containerNumber || '')
                    if (meta.targetUnit) setTargetUnit(meta.targetUnit)

                    const { data: itemsData } = await supabase.from('inbound_order_items').select('*').eq('order_id', editOrderId)
                    if (itemsData) setItems(itemsData.map((i: any) => ({
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
            } else if (initialData) {
                if (initialData.items) setItems(initialData.items)

                // Fix Supplier: Use fetched data instead of waiting for state update
                if (initialData.supplierId) {
                    setSupplierId(initialData.supplierId)
                    const s = (suppRes.data || []).find((x: any) => x.id === initialData.supplierId)
                    if (s) {
                        setSupplierAddress(s.address || '')
                        setSupplierPhone(s.phone || '')
                    }
                }

                if (initialData.warehouseName) setWarehouseName(initialData.warehouseName)
                if (initialData.targetUnit) setTargetUnit(initialData.targetUnit)
                if (initialData.orderTypeId) setOrderTypeId(initialData.orderTypeId)

                if (initialData.description) setDescription(initialData.description)

                generateOrderCode('PNK', systemCode, currentSystem?.name).then(setCode)
            } else {
                if (!editOrderId) generateOrderCode('PNK', systemCode, currentSystem?.name).then(setCode)
            }
        } catch (error) {
            console.error(error)
            showToast('Lỗi tải dữ liệu', 'error')
        }
        setLoadingData(false)
    }

    const handleSupplierChange = (val: string | null) => {
        setSupplierId(val || '')
        if (val) {
            const supplier = suppliers.find(s => s.id === val)
            if (supplier) {
                setSupplierAddress(supplier.address || '')
                setSupplierPhone(supplier.phone || '')
            }
        } else {
            setSupplierAddress(''); setSupplierPhone('')
        }
    }

    const addItem = () => {
        setItems([...items, {
            id: crypto.randomUUID(), productId: '', productName: '', unit: '', quantity: 1, document_quantity: 1, price: 0, note: ''
        }])
    }

    const updateItem = (id: string, field: keyof OrderItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item
            if (field === 'productId') {
                const prod = products.find(p => p.id === value)
                let initialUnit = ''
                if (prod && (!prod.product_units || prod.product_units.length === 0) && prod.unit) initialUnit = prod.unit
                return { ...item, productId: value, productName: prod?.name || '', unit: initialUnit, price: prod?.cost_price || 0 }
            }
            if (field === 'quantity') {
                const newValue = Number(value)
                return { ...item, quantity: newValue, document_quantity: !item.isDocQtyVisible ? newValue : item.document_quantity }
            }
            return { ...item, [field]: value }
        }))
    }

    const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))

    const handleSubmit = async () => {
        if (!supplierId) return showToast('Vui lòng chọn nhà cung cấp', 'warning')
        if (items.length === 0) return showToast('Vui lòng thêm ít nhất 1 sản phẩm', 'warning')
        if (items.find(i => !i.productId || !i.unit)) return showToast('Vui lòng chọn đầy đủ sản phẩm và đơn vị tính', 'warning')

        setSubmitting(true)
        try {
            let orderId = editOrderId
            const payload = {
                supplier_id: supplierId,
                supplier_address: supplierAddress,
                supplier_phone: supplierPhone,
                warehouse_name: warehouseName,
                description,
                order_type_id: orderTypeId || null,
                images,
                updated_at: new Date().toISOString(),
                metadata: { vehicleNumber, driverName, containerNumber, targetUnit },
                company_id: profile?.company_id || null
            }

            if (editOrderId) {
                const { error: updateError } = await (supabase.from('inbound_orders') as any).update(payload).eq('id', editOrderId)
                if (updateError) throw updateError
                await supabase.from('inbound_order_items').delete().eq('order_id', editOrderId)
            } else {
                const { data: order, error: orderError } = await (supabase.from('inbound_orders') as any).insert({
                    ...payload,
                    code,
                    status: 'Pending',
                    type: 'Purchase',
                    system_code: systemCode,
                    system_type: systemCode,
                }).select().single()
                if (orderError) throw orderError
                orderId = order.id
            }

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

            const { error: itemsError } = await (supabase.from('inbound_order_items') as any).insert(orderItems)
            if (itemsError) throw itemsError

            // Cleanup LOT metadata if this was a buffer sync
            if (initialData?.batchData) {
                for (const p of initialData.batchData) {
                    const { data: lot } = await supabase.from('lots').select('metadata').eq('id', p.lot_id).single()
                    if (lot) {
                        const metadata = { ...lot.metadata as any }
                        metadata.system_history.inbound = metadata.system_history.inbound.map((inb: any) => {
                            if (inb.id === p.inbound_id) {
                                return { ...inb, draft: false, order_id: orderId, order_code: code }
                            }
                            return inb
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
        supplierId, handleSupplierChange,
        supplierAddress, setSupplierAddress,
        supplierPhone, setSupplierPhone,
        warehouseName, setWarehouseName,
        description, setDescription,
        items, addItem, updateItem, removeItem,
        vehicleNumber, setVehicleNumber,
        driverName, setDriverName,
        containerNumber, setContainerNumber,
        orderTypeId, setOrderTypeId,
        images, setImages,
        targetUnit, setTargetUnit,
        products, suppliers, branches, units, orderTypes,
        loadingData, submitting, handleSubmit,
        hasModule
    }
}
