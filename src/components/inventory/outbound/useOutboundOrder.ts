import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { Product, Customer, Unit, OrderItem } from '../types'

export function useOutboundOrder({ isOpen, initialData, systemCode, onSuccess, onClose }: any) {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()

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
        } else {
            resetForm()
        }
    }, [isOpen, systemCode])

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
                    const stockMap = new Map<string, number>()
                    invRes.items.forEach((item: any) => { if (item.productId) stockMap.set(item.productId, item.balance) })
                    productsWithStock = prodRes.data.map((p: any) => ({ ...p, stock_quantity: stockMap.get(p.id) ?? 0 })) as Product[]
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
                                return { ...exp, draft: false, order_id: order.id, order_code: code }
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
