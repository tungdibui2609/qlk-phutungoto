'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Save, Hash, ArrowDownToLine, ArrowUpFromLine, Package } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { OrderFormLayout } from '@/components/inventory/shared/OrderFormLayout'
import { InboundItemsTable } from '@/components/inventory/inbound/InboundItemsTable'
import { FastTextInput } from '@/components/ui/FastTextInput'
import { OrderItem, Product, Unit } from '@/components/inventory/types'
import { formatQuantityFull } from '@/lib/numberUtils'
import {
    ConsignmentDirection,
    ConsignmentOrder,
    ConsignmentOrderStatus,
    ConsignmentOutboundPurpose,
    ConsignmentWarehouse,
    ConsignmentInventoryRow,
    OUTBOUND_PURPOSE_LABELS
} from './types'
import { generateConsignmentOrderCode } from './consignmentService'

interface ConsignmentOrderModalProps {
    isOpen: boolean
    direction: ConsignmentDirection
    editOrder?: ConsignmentOrder | null
    warehouses: ConsignmentWarehouse[]
    products: Product[]
    units: Unit[]
    inventoryRows: ConsignmentInventoryRow[]
    onClose: () => void
    onSuccess: () => void
}

export default function ConsignmentOrderModal({
    isOpen,
    direction,
    editOrder,
    warehouses,
    products,
    units,
    inventoryRows,
    onClose,
    onSuccess
}: ConsignmentOrderModalProps) {
    const { systemType } = useSystem()
    const { profile } = useUser()
    const { showToast } = useToast()
    const { convertUnit } = useUnitConversion()

    const [code, setCode] = useState('')
    const [warehouseId, setWarehouseId] = useState('')
    const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString())
    const [status, setStatus] = useState<ConsignmentOrderStatus>('Completed')
    const [outboundPurpose, setOutboundPurpose] = useState<ConsignmentOutboundPurpose>('RETURN_TO_MAIN')
    const [partnerName, setPartnerName] = useState('')
    const [vehicleNumber, setVehicleNumber] = useState('')
    const [driverName, setDriverName] = useState('')
    const [description, setDescription] = useState('')
    const [targetUnit, setTargetUnit] = useState('')
    const [displayInternalCode, setDisplayInternalCode] = useState(false)
    const [items, setItems] = useState<OrderItem[]>([])
    const [submitting, setSubmitting] = useState(false)

    const activeWarehouses = useMemo(
        () => warehouses.filter(w => w.is_active || w.id === editOrder?.consignment_warehouse_id),
        [warehouses, editOrder]
    )

    const warehouseStockRows = useMemo(() => {
        if (!warehouseId) return []
        return inventoryRows.filter(r => r.warehouseId === warehouseId && r.balance > 0)
    }, [inventoryRows, warehouseId])

    // Adapter hasModule cho InboundItemsTable: bật quy đổi & số lô, tắt đơn giá/OEM để bảng gọn đẹp
    const tableHasModule = useCallback((id: string) => {
        if (id === 'inbound_conversion') return true
        if (id === 'inbound_batch_lot') return true
        return false
    }, [])

    useEffect(() => {
        if (!isOpen || !systemType) return

        if (editOrder) {
            setCode(editOrder.code)
            setWarehouseId(editOrder.consignment_warehouse_id)
            setOrderDate(editOrder.order_date || new Date().toISOString())
            setStatus(editOrder.status)
            setOutboundPurpose(editOrder.outbound_purpose || 'RETURN_TO_MAIN')
            setPartnerName(editOrder.partner_name || '')
            setVehicleNumber(editOrder.vehicle_number || '')
            setDriverName(editOrder.driver_name || '')
            setDescription(editOrder.description || '')
            setTargetUnit(editOrder.metadata?.targetUnit || '')
            setItems(
                (editOrder.items || []).map((it, idx) => ({
                    id: it.id || `edit-${idx}-${Date.now()}`,
                    productId: it.product_id || '',
                    productName: it.product_name || '',
                    unit: it.unit || '',
                    quantity: Number(it.quantity) || 0,
                    document_quantity: Number(it.quantity) || 0,
                    price: 0,
                    note: it.note || '',
                    batch_code: it.batch_code || '',
                    categoryId: null
                }))
            )
        } else {
            generateConsignmentOrderCode(direction, systemType).then(setCode)
            setWarehouseId(activeWarehouses[0]?.id || '')
            setOrderDate(new Date().toISOString())
            setStatus('Completed')
            setOutboundPurpose('RETURN_TO_MAIN')
            setPartnerName('')
            setVehicleNumber('')
            setDriverName('')
            setDescription('')
            setTargetUnit('')
            setItems([
                {
                    id: crypto.randomUUID(),
                    productId: '',
                    productName: '',
                    unit: '',
                    quantity: 1,
                    document_quantity: 1,
                    price: 0,
                    note: '',
                    batch_code: '',
                    categoryId: null
                }
            ])
        }
    }, [isOpen, editOrder?.id, direction, systemType])

    const addItem = useCallback(() => {
        setItems(prev => [
            ...prev,
            {
                id: crypto.randomUUID(),
                productId: '',
                productName: '',
                unit: '',
                quantity: 1,
                document_quantity: 1,
                price: 0,
                note: '',
                batch_code: '',
                categoryId: null
            }
        ])
    }, [])

    const updateItem = useCallback(
        (id: string, field: keyof OrderItem, value: any) => {
            setItems(prev =>
                prev.map(item => {
                    if (item.id !== id) return item
                    if (field === 'productId') {
                        const prod = products.find(p => p.id === value)
                        let initialUnit = ''
                        if (prod && (!prod.product_units || prod.product_units.length === 0) && prod.unit) {
                            initialUnit = prod.unit
                        } else if (prod?.unit) {
                            initialUnit = prod.unit
                        }
                        return {
                            ...item,
                            productId: value,
                            productName: prod?.name || '',
                            unit: initialUnit,
                            categoryId: prod?.category_id || null
                        }
                    }
                    if (field === 'quantity') {
                        const newValue = Number(value)
                        return { ...item, quantity: newValue, document_quantity: newValue }
                    }
                    if (field === 'unit') {
                        const newVal = value as string
                        const oldVal = item.unit
                        const prod = products.find(p => p.id === item.productId)
                        const baseUnitName = prod?.unit || ''

                        if (oldVal && newVal && oldVal !== newVal && item.productId) {
                            const newQty = convertUnit(
                                item.productId,
                                oldVal,
                                newVal,
                                item.quantity || 0,
                                baseUnitName
                            )
                            return {
                                ...item,
                                unit: newVal,
                                quantity: Number(newQty.toFixed(3)),
                                document_quantity: Number(newQty.toFixed(3))
                            }
                        }
                        return { ...item, unit: newVal }
                    }
                    return { ...item, [field]: value }
                })
            )
        },
        [products, convertUnit]
    )

    const removeItem = useCallback((id: string) => {
        setItems(prev => prev.filter(i => i.id !== id))
    }, [])

    const handleAddFromStockRow = (row: ConsignmentInventoryRow) => {
        setItems(prev => {
            const clean = prev.filter(i => i.productId || i.productName)
            return [
                ...clean,
                {
                    id: crypto.randomUUID(),
                    productId: row.productId || '',
                    productName: row.productName,
                    unit: row.unit,
                    quantity: row.balance,
                    document_quantity: row.balance,
                    price: 0,
                    note: '',
                    batch_code: '',
                    categoryId: null
                }
            ]
        })
    }

    const handleSubmit = async () => {
        if (!systemType) return
        if (!warehouseId) {
            showToast('Vui lòng chọn Kho ký gửi', 'warning')
            return
        }
        const validItems = items.filter(i => i.productId || i.productName.trim())
        if (validItems.length === 0) {
            showToast('Vui lòng thêm ít nhất 1 sản phẩm', 'warning')
            return
        }
        if (validItems.find(i => !i.productId || !i.unit || Number(i.quantity) <= 0)) {
            showToast('Vui lòng chọn đầy đủ sản phẩm, ĐVT và số lượng > 0 cho tất cả các dòng', 'warning')
            return
        }

        setSubmitting(true)
        try {
            const payload = {
                consignment_warehouse_id: warehouseId,
                direction,
                outbound_purpose: direction === 'OUTBOUND' ? outboundPurpose : null,
                status,
                order_date: orderDate || new Date().toISOString(),
                partner_name: partnerName.trim() || null,
                vehicle_number: vehicleNumber.trim() || null,
                driver_name: driverName.trim() || null,
                description: description.trim() || null,
                metadata: {
                    ...(editOrder?.metadata || {}),
                    targetUnit: targetUnit || undefined
                },
                updated_at: new Date().toISOString()
            }

            let orderId = editOrder?.id
            if (editOrder) {
                const { error } = await (supabase.from('consignment_orders') as any)
                    .update(payload)
                    .eq('id', editOrder.id)
                if (error) throw error

                await (supabase.from('consignment_order_items') as any)
                    .delete()
                    .eq('order_id', editOrder.id)
            } else {
                const { data: created, error } = await (supabase.from('consignment_orders') as any)
                    .insert({
                        ...payload,
                        company_id: profile?.company_id || undefined,
                        system_code: systemType,
                        code: code.trim()
                    })
                    .select()
                    .single()
                if (error) throw error
                orderId = created.id
            }

            const itemRows = validItems.map(it => {
                const prod = products.find(p => p.id === it.productId)
                return {
                    company_id: profile?.company_id || undefined,
                    system_code: systemType,
                    order_id: orderId,
                    product_id: it.productId || null,
                    product_name: it.productName || prod?.name || 'Hàng hóa',
                    sku: prod?.sku || null,
                    unit: it.unit.trim(),
                    quantity: Number(it.quantity),
                    batch_code: it.batch_code?.trim() || null,
                    note: it.note?.trim() || null
                }
            })

            const { error: itemsErr } = await (supabase.from('consignment_order_items') as any).insert(itemRows)
            if (itemsErr) throw itemsErr

            showToast(
                editOrder
                    ? `Đã cập nhật phiếu ${code}`
                    : `Đã tạo ${direction === 'INBOUND' ? 'phiếu nhập' : 'phiếu xuất'} ký gửi ${code}`,
                'success'
            )
            onSuccess()
            onClose()
        } catch (err: any) {
            showToast('Lỗi lưu phiếu ký gửi: ' + (err.message || 'Không xác định'), 'error')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    const isInbound = direction === 'INBOUND'

    const footerButtons = (
        <div className="flex items-center gap-2.5 justify-end w-full">
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-gray-300 font-medium hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors text-xs cursor-pointer"
            >
                Hủy bỏ
            </button>
            <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className={`px-5 py-2 rounded-xl text-white font-bold shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed text-xs cursor-pointer ${
                    isInbound
                        ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/20'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                }`}
            >
                <Save size={16} />
                {submitting
                    ? 'Đang lưu...'
                    : editOrder
                    ? 'Cập Nhật Phiếu'
                    : isInbound
                    ? 'Lưu Phiếu Nhập Ký Gửi'
                    : 'Lưu Phiếu Xuất Ký Gửi'}
            </button>
        </div>
    )

    return (
        <OrderFormLayout
            title={
                <div className="flex items-center gap-2.5">
                    <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isInbound
                                ? 'bg-orange-100 text-orange-600'
                                : 'bg-indigo-100 text-indigo-600'
                        }`}
                    >
                        {isInbound ? <ArrowDownToLine size={18} /> : <ArrowUpFromLine size={18} />}
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-stone-900 dark:text-white">
                            {editOrder
                                ? `Chỉnh Sửa Phiếu ${isInbound ? 'Nhập' : 'Xuất'} Ký Gửi`
                                : `Tạo Phiếu ${isInbound ? 'Nhập' : 'Xuất'} Kho Ký Gửi`}
                        </h2>
                        <p className="text-xs text-stone-500 font-normal mt-0.5">
                            {isInbound
                                ? 'Ghi nhận hàng hóa gửi vào kho bên ngoài'
                                : 'Xuất hàng từ kho ký gửi (lấy về kho gốc hoặc giao thẳng)'}
                        </p>
                    </div>
                </div>
            }
            onClose={onClose}
            maxWidth="max-w-6xl"
            headerActions={
                <button
                    type="button"
                    onClick={() => setDisplayInternalCode(!displayInternalCode)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        displayInternalCode
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-gray-300'
                    }`}
                    title="Hiển thị mã sản phẩm nội bộ"
                >
                    <Hash size={14} /> Nhập Mã Nội Bộ
                </button>
            }
            footer={footerButtons}
        >
            {/* 1. Compact Information Card (giống hệt InboundOrderModal) */}
            <div className="bg-stone-50/70 dark:bg-zinc-800/40 p-3.5 rounded-xl border border-stone-200 dark:border-zinc-700 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {/* Mã phiếu */}
                    <div>
                        <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                            Mã phiếu
                        </label>
                        <FastTextInput
                            value={code}
                            onChange={setCode}
                            className="w-full h-9 px-3 text-xs font-mono font-bold bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-900 dark:text-white"
                        />
                    </div>

                    {/* Ngày phiếu */}
                    <div>
                        <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                            Ngày phiếu
                        </label>
                        <input
                            type="datetime-local"
                            value={
                                orderDate
                                    ? new Date(
                                          new Date(orderDate).getTime() -
                                              new Date(orderDate).getTimezoneOffset() * 60000
                                      )
                                          .toISOString()
                                          .slice(0, 16)
                                    : ''
                            }
                            onChange={e => setOrderDate(new Date(e.target.value).toISOString())}
                            className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-900 dark:text-white"
                        />
                    </div>

                    {/* Kho ký gửi */}
                    <div>
                        <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                            Kho ký gửi <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={warehouseId}
                            onChange={e => setWarehouseId(e.target.value)}
                            className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-900 dark:text-white"
                        >
                            <option value="">-- Chọn kho gửi --</option>
                            {activeWarehouses.map(wh => (
                                <option key={wh.id} value={wh.id}>
                                    [{wh.code}] {wh.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Mục đích xuất (nếu là phiếu xuất) hoặc Người gửi/nhận */}
                    {!isInbound ? (
                        <div>
                            <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                                Mục đích xuất
                            </label>
                            <select
                                value={outboundPurpose}
                                onChange={e => setOutboundPurpose(e.target.value as ConsignmentOutboundPurpose)}
                                className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-stone-900 dark:text-white font-medium"
                            >
                                {Object.entries(OUTBOUND_PURPOSE_LABELS).map(([k, label]) => (
                                    <option key={k} value={k}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                                Đơn vị / Người gửi
                            </label>
                            <FastTextInput
                                value={partnerName}
                                onChange={setPartnerName}
                                placeholder="Không bắt buộc..."
                                className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-900 dark:text-white"
                            />
                        </div>
                    )}

                    {/* Trạng thái */}
                    <div>
                        <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                            Trạng thái
                        </label>
                        <select
                            value={status}
                            onChange={e => setStatus(e.target.value as ConsignmentOrderStatus)}
                            className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-900 dark:text-white"
                        >
                            <option value="Completed">Hoàn thành</option>
                            <option value="Pending">Chờ duyệt</option>
                        </select>
                    </div>

                    {/* Quy đổi theo */}
                    <div>
                        <label className="block text-[11px] font-semibold text-stone-600 dark:text-gray-300 mb-1">
                            Quy đổi theo
                        </label>
                        <select
                            value={targetUnit}
                            onChange={e => setTargetUnit(e.target.value)}
                            className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-900 dark:text-white"
                        >
                            <option value="">-- Không quy đổi --</option>
                            {units.map(u => (
                                <option key={u.id} value={u.name}>
                                    {u.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Row 2: Biển số, Tài xế, Người nhận (nếu xuất), Diễn giải */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-0.5">
                    {!isInbound && (
                        <FastTextInput
                            value={partnerName}
                            onChange={setPartnerName}
                            placeholder="Người nhận / Khách hàng..."
                            className="w-full h-8 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-stone-700 dark:text-gray-300 placeholder:text-stone-400"
                        />
                    )}
                    <FastTextInput
                        value={vehicleNumber}
                        onChange={setVehicleNumber}
                        placeholder="Biển số xe..."
                        className="w-full h-8 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-700 dark:text-gray-300 placeholder:text-stone-400"
                    />
                    <FastTextInput
                        value={driverName}
                        onChange={setDriverName}
                        placeholder="Tên tài xế..."
                        className="w-full h-8 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-700 dark:text-gray-300 placeholder:text-stone-400"
                    />
                    <FastTextInput
                        value={description}
                        onChange={setDescription}
                        placeholder="Diễn giải / Ghi chú trên phiếu..."
                        className={`w-full h-8 px-3 text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-stone-700 dark:text-gray-300 placeholder:text-stone-400 ${
                            isInbound ? 'sm:col-span-2' : ''
                        }`}
                    />
                </div>
            </div>

            {/* Thanh chọn nhanh hàng đang tồn khi XUẤT ký gửi */}
            {!isInbound && warehouseStockRows.length > 0 && (
                <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/50">
                    <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-1.5">
                        <Package size={14} />
                        Chọn nhanh từ hàng đang tồn tại kho ký gửi này ({warehouseStockRows.length} mặt hàng):
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {warehouseStockRows.map(row => (
                            <button
                                key={row.key}
                                type="button"
                                onClick={() => handleAddFromStockRow(row)}
                                className="px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-zinc-700 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <span className="font-medium truncate max-w-[200px]">{row.productName}</span>
                                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                    ({formatQuantityFull(row.balance)} {row.unit})
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. Items Table (tái sử dụng 100% InboundItemsTable của Kế toán: Combobox tìm aliases, ItemUnitSelect quy đổi, Dán Excel, Tổng SL & Tổng quy đổi) */}
            <div className="space-y-3">
                <InboundItemsTable
                    items={items}
                    setItems={setItems}
                    products={products}
                    units={units}
                    categories={[]}
                    updateItem={updateItem}
                    removeItem={removeItem}
                    targetUnit={targetUnit}
                    hasModule={tableHasModule}
                    displayInternalCode={displayInternalCode}
                    convertUnit={convertUnit}
                />

                <button
                    type="button"
                    onClick={addItem}
                    className="w-full py-2 border border-dashed border-stone-300 dark:border-zinc-700 rounded-xl text-stone-600 hover:text-orange-600 hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors flex items-center justify-center gap-2 text-xs font-bold cursor-pointer"
                >
                    <Plus size={16} />
                    Thêm sản phẩm
                </button>
            </div>
        </OrderFormLayout>
    )
}
