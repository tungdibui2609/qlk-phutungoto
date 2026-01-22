'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { X, Calendar, Package, User, FileText, CheckCircle, Clock, Printer, ChevronDown, Eye } from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface InboundOrder {
    id: string
    code: string
    status: string | null
    created_at: string
    warehouse_name: string | null
    description: string | null
    supplier: { name: string } | null
    supplier_address: string | null
    supplier_phone: string | null
    image_url?: string | null
    images?: string[] | null
    metadata?: {
        vehicleNumber?: string
        driverName?: string
        containerNumber?: string
        targetUnit?: string
    } | null
    order_types?: { name: string } | null
}

type Unit = Database['public']['Tables']['units']['Row']

interface OrderItem {
    id: string
    product_name: string | null
    unit: string | null
    quantity: number
    document_quantity: number
    price: number
    note: string | null
    products: {
        sku: string
        unit?: string
        product_units?: {
            unit_id: string
            conversion_rate: number
        }[]
    } | null
}

interface InboundOrderDetailModalProps {
    order: InboundOrder | null
    onClose: () => void
    onUpdate?: () => void
}

export default function InboundOrderDetailModal({ order, onClose, onUpdate }: InboundOrderDetailModalProps) {
    const { showToast, showConfirm } = useToast()
    const { currentSystem } = useSystem()
    const { hasPermission } = useUser()

    const hasModule = (moduleId: string) => {
        if (!currentSystem?.inbound_modules) return false

        // Handle both array and JSON string formats
        const modules = Array.isArray(currentSystem.inbound_modules)
            ? currentSystem.inbound_modules
            : typeof currentSystem.inbound_modules === 'string'
                ? JSON.parse(currentSystem.inbound_modules)
                : []

        return Array.isArray(modules) && modules.includes(moduleId)
    }

    const [items, setItems] = useState<OrderItem[]>([])
    const [units, setUnits] = useState<Unit[]>([])
    const [loading, setLoading] = useState(false)
    const [showPrintMenu, setShowPrintMenu] = useState(false)
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [visibleNoteId, setVisibleNoteId] = useState<string | null>(null)
    const [showConfirmApprove, setShowConfirmApprove] = useState(false)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const targetUnit = order?.metadata?.targetUnit

    useEffect(() => {
        if (order) {
            fetchItems()
            // Assume order might have image_url if schema is updated, or we fetch it
            if ('image_url' in order) {
                setImageUrl((order as any).image_url)
            }
        } else {
            setItems([])
            setImageUrl(null)
        }
    }, [order])

    async function fetchItems() {
        if (!order) return
        setLoading(true)

        // Fetch Units
        const { data: unitsData } = await supabase.from('units').select('*')
        if (unitsData) setUnits(unitsData)

        // Fetch Items with Product Units
        const { data, error } = await supabase
            .from('inbound_order_items')
            .select('*, products(sku, unit, product_units(unit_id, conversion_rate))')
            .eq('order_id', order.id)

        if (data) {
            setItems(data as any)
        }

        // Fetch order details again to get extra fields
        const { data: orderData } = await (supabase
            .from('inbound_orders') as any)
            .select('image_url, images, metadata, order_types(name)')
            .eq('id', order.id)
            .single()

        if (orderData) {
            // Merge extra data into the current order object for display
            Object.assign(order, {
                image_url: orderData.image_url,
                images: orderData.images,
                metadata: orderData.metadata,
                order_types: orderData.order_types
            })
            // Also update local state if needed (though we rely on order prop mostly, but simpler to force update via refetch in parent or just mutate prop for display safely)
            // Ideally we should have local fullOrder state, but 'order' prop is used.
            // Let's force a re-render by setting a local state dummy or updating imageUrl separately.
            if (orderData.image_url) setImageUrl(orderData.image_url)
        }

        setLoading(false)
    }

    const handleUploadImage = async (file: File) => {
        if (!file || !order) return

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })

            if (!res.ok) throw new Error('Upload failed')

            const data = await res.json()
            const url = data.secureUrl

            // Update Supabase
            const { error } = await (supabase
                .from('inbound_orders') as any)
                .update({ image_url: url })
                .eq('id', order.id)

            if (error) throw error

            setImageUrl(url)
            showToast('Đã tải ảnh hóa đơn lên thành công', 'success')
            if (onUpdate) onUpdate()
        } catch (error: any) {
            console.error('Upload error:', error)
            showToast('Lỗi tải ảnh: ' + error.message, 'error')
        } finally {
            setUploading(false)
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            handleUploadImage(file)
        }
    }

    const handleRemoveImage = async () => {
        if (!order) return

        if (!await showConfirm('Bạn có chắc muốn xóa ảnh hóa đơn này?')) return

        try {
            const { error } = await (supabase
                .from('inbound_orders') as any)
                .update({ image_url: null })
                .eq('id', order.id)

            if (error) throw error

            setImageUrl(null)
            showToast('Đã xóa ảnh hóa đơn', 'success')
            if (onUpdate) onUpdate()
            if (fileInputRef.current) fileInputRef.current.value = ''
        } catch (error: any) {
            showToast('Lỗi xóa ảnh: ' + error.message, 'error')
        }
    }

    const handleApprove = async () => {
        if (!order) return
        setShowConfirmApprove(true)
    }

    const onConfirmApprove = async () => {
        if (!order) return

        try {
            const { data, error } = await (supabase
                .from('inbound_orders') as any)
                .update({ status: 'Completed' })
                .eq('id', order.id)
                .select()

            if (error) throw error
            if (!data || data.length === 0) throw new Error('Không thể cập nhật phiếu (Có thể do phân quyền hoặc phiếu đã bị xóa)')

            showToast('Đã xác nhận phiếu nhập thành công!', 'success')
            if (onUpdate) onUpdate()
            onClose()
        } catch (error: any) {
            showToast('Lỗi: ' + error.message, 'error')
        }
    }



    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0)

    if (!order) return null

    return (
        <>
            <Dialog open={!!order} onOpenChange={onClose}>
                <DialogContent className={`${hasModule('inbound_ui_compact') ? 'max-w-5xl' : 'max-w-7xl'} max-h-[90vh] overflow-y-auto p-0 gap-0 bg-stone-50 dark:bg-zinc-900 border-none shadow-2xl`}>
                    <DialogTitle className="sr-only">Chi tiết phiếu {order.code}</DialogTitle>
                    <DialogDescription className="sr-only">
                        Xem chi tiết thông tin phiếu nhập {order.code}
                    </DialogDescription>
                    {/* Header */}
                    <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-800 border-b border-stone-100 dark:border-zinc-700 shadow-sm">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-orange-600 dark:text-orange-400 font-mono">
                                {order.code}
                            </h2>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${order.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                order.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                                    'bg-yellow-50 text-yellow-700 border-yellow-200'
                                }`}>
                                {order.status === 'Pending' ? 'Chờ xử lý' : order.status}
                            </span>
                        </div>
                        {hasModule('inbound_conversion') && targetUnit && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-stone-500">Quy đổi:</span>
                                <span className="font-bold text-orange-600 px-2 py-0.5 bg-orange-50 rounded border border-orange-100">{targetUnit}</span>
                            </div>
                        )}
                    </div>

                    <ConfirmDialog
                        isOpen={showConfirmApprove}
                        onCancel={() => setShowConfirmApprove(false)}
                        onConfirm={onConfirmApprove}
                        title="Xác nhận hoàn thành"
                        message="Xác nhận hoàn thành phiếu nhập này? Hành động này không thể hoàn tác."
                        confirmText="Xác nhận"
                        variant="warning"
                    />

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* Info Grid - 2 columns */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 p-4 bg-stone-50 dark:bg-zinc-800/50 rounded-xl border border-stone-100 dark:border-zinc-800">
                            {/* Column 1 */}
                            <div>
                                <label className="text-xs font-semibold text-stone-400 uppercase">Nhà cung cấp</label>
                                <p className="font-medium text-stone-900 dark:text-gray-200 flex items-center gap-2 mt-1">
                                    <User size={16} className="text-orange-500" />
                                    {order.supplier?.name || 'N/A'}
                                </p>
                                {order.supplier_address && (
                                    <p className="text-sm text-stone-500 mt-1 pl-6">
                                        {order.supplier_address}
                                    </p>
                                )}
                                {order.supplier_phone && (
                                    <p className="text-sm text-stone-500 mt-0.5 pl-6">
                                        SĐT: {order.supplier_phone}
                                    </p>
                                )}
                            </div>

                            {/* Column 2 */}
                            <div>
                                <label className="text-xs font-semibold text-stone-400 uppercase">Kho nhập</label>
                                <p className="font-medium text-stone-900 dark:text-gray-200 flex items-center gap-2 mt-1">
                                    <Package size={16} className="text-orange-500" />
                                    {order.warehouse_name || 'N/A'}
                                </p>
                            </div>

                            {/* Column 1 */}
                            {order.order_types?.name && (
                                <div>
                                    <label className="text-xs font-semibold text-stone-400 uppercase">Loại phiếu</label>
                                    <p className="font-medium text-stone-900 dark:text-gray-200 mt-1">
                                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold border border-blue-100">
                                            {order.order_types.name}
                                        </span>
                                    </p>
                                </div>
                            )}

                            {/* Column 2 */}
                            <div>
                                <label className="text-xs font-semibold text-stone-400 uppercase">Ngày tạo</label>
                                <p className="font-medium text-stone-900 dark:text-gray-200 flex items-center gap-2 mt-1">
                                    <Calendar size={16} className="text-orange-500" />
                                    {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}
                                </p>
                            </div>

                            {/* Logistics Info - spans if exists */}
                            {(order.metadata?.vehicleNumber || order.metadata?.driverName || order.metadata?.containerNumber) && (
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold text-stone-400 uppercase">Vận chuyển</label>
                                    <div className="mt-1 flex flex-wrap gap-4 text-sm text-stone-700 dark:text-gray-300">
                                        {order.metadata.vehicleNumber && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-stone-500">Biển số:</span>
                                                <span className="font-medium bg-stone-100 dark:bg-zinc-700 px-1.5 rounded">{order.metadata.vehicleNumber}</span>
                                            </div>
                                        )}
                                        {order.metadata.driverName && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-stone-500">Tài xế:</span>
                                                <span className="font-medium">{order.metadata.driverName}</span>
                                            </div>
                                        )}
                                        {order.metadata.containerNumber && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-stone-500">Container:</span>
                                                <span className="font-medium font-mono">{order.metadata.containerNumber}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Description - full width */}
                            <div className="md:col-span-2 border-t border-stone-200 dark:border-zinc-700 pt-4">
                                <label className="text-xs font-semibold text-stone-400 uppercase">Diễn giải</label>
                                <p className="font-medium text-stone-900 dark:text-gray-200 flex items-start gap-2 mt-1">
                                    <FileText size={16} className="text-stone-400 mt-0.5" />
                                    <span className="italic text-stone-600 dark:text-gray-400">
                                        {order.description || 'Không có ghi chú'}
                                    </span>
                                </p>
                            </div>

                            {/* Images Grid - full width */}
                            {order.images && order.images.length > 0 && (
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold text-stone-400 uppercase">Hình ảnh đính kèm</label>
                                    <div className="mt-2 grid grid-cols-4 gap-2">
                                        {order.images.map((img, idx) => (
                                            <img
                                                key={idx}
                                                src={img}
                                                alt={`Image ${idx + 1}`}
                                                className="h-20 w-auto object-cover rounded-lg border border-stone-200 dark:border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => window.open(img, '_blank')}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Items Table */}
                        <div>
                            <h3 className="font-bold text-stone-900 dark:text-white mb-4 flex items-center gap-2">
                                <span className="w-1 h-6 bg-orange-500 rounded-full"></span>
                                Chi tiết hàng hóa
                            </h3>

                            {loading ? (
                                <div className="py-8 text-center text-gray-500">Đang tải chi tiết...</div>
                            ) : (
                                <div className="border border-gray-200 dark:border-zinc-700 rounded-xl overflow-x-auto">
                                    <table className={`w-full text-left ${hasModule('inbound_ui_compact') ? 'text-base' : 'text-xs'}`}>
                                        <thead className="bg-stone-50 dark:bg-zinc-800/50 text-stone-500 font-medium">
                                            <tr>
                                                <th className="px-4 py-3 w-10">#</th>
                                                <th className="px-4 py-3 min-w-[370px]">Sản phẩm</th>
                                                <th className="px-4 py-3 w-24">ĐVT</th>
                                                <th className="px-4 py-3 w-24 text-right">SL Thực nhập</th>
                                                {/* Conversion Column */}
                                                {hasModule('inbound_conversion') && targetUnit && (
                                                    <th className="px-4 py-3 w-32 text-right text-orange-600">
                                                        <div>SL Quy đổi</div>
                                                        <div className="text-[10px] font-normal">({targetUnit})</div>
                                                    </th>
                                                )}
                                                {hasModule('inbound_financials') && (
                                                    <th className="px-4 py-3 w-24 text-right">SL Chứng từ</th>
                                                )}
                                                {hasModule('inbound_financials') && (
                                                    <>
                                                        <th className="px-4 py-3 w-32 text-right">Đơn giá</th>
                                                        <th className="px-4 py-3 w-32 text-right">Thành tiền</th>
                                                    </>
                                                )}
                                                <th className="px-4 py-3">Ghi chú</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                            {items.map((item, index) => (
                                                <tr key={item.id} className="hover:bg-stone-50 dark:hover:bg-zinc-800/30">
                                                    <td className="px-4 py-3 text-stone-400">{index + 1}</td>
                                                    <td className="px-4 py-3 font-medium text-stone-900 dark:text-white">
                                                        <div className="text-[10px] text-stone-500 font-mono mb-0.5">{item.products?.sku || '-'}</div>
                                                        <div>{item.product_name || 'N/A'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-stone-500">{item.unit || '-'}</td>
                                                    <td className="px-4 py-3 text-right font-medium">{item.quantity}</td>
                                                    {/* Conversion Logic */}
                                                    {hasModule('inbound_conversion') && targetUnit && (
                                                        <td className="px-4 py-3 text-right font-medium text-orange-600">
                                                            {(() => {
                                                                if (!item.quantity || !item.unit || !item.products) return '-'

                                                                // 1. Convert to base
                                                                let baseQty = 0
                                                                if (item.unit === item.products.unit) {
                                                                    baseQty = item.quantity
                                                                } else {
                                                                    const uConfig = item.products.product_units?.find(pu => {
                                                                        const uName = units.find(u => u.id === pu.unit_id)?.name
                                                                        return uName === item.unit
                                                                    })
                                                                    if (uConfig) {
                                                                        baseQty = item.quantity * uConfig.conversion_rate
                                                                    } else {
                                                                        return '-'
                                                                    }
                                                                }

                                                                // 2. Convert to target
                                                                if (targetUnit === item.products.unit) {
                                                                    return Number.isInteger(baseQty) ? baseQty : baseQty.toFixed(2)
                                                                }

                                                                const targetConfig = item.products.product_units?.find(pu => {
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

                                                    {hasModule('inbound_financials') && (
                                                        <td className="px-4 py-3 text-right font-medium text-blue-600">{item.document_quantity || item.quantity}</td>
                                                    )}
                                                    {hasModule('inbound_financials') && (
                                                        <>
                                                            <td className="px-4 py-3 text-right text-stone-500">
                                                                {(item.price || 0).toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-orange-600">
                                                                {((item.quantity || 0) * (item.price || 0)).toLocaleString()}
                                                            </td>
                                                        </>
                                                    )}
                                                    <td className="px-4 py-3 text-center relative pointer-events-none">
                                                        <div className="pointer-events-auto inline-block">
                                                            {item.note ? (
                                                                <div className="relative">
                                                                    <button
                                                                        onClick={() => setVisibleNoteId(visibleNoteId === item.id ? null : item.id)}
                                                                        className="text-red-500 hover:text-red-600 transition-colors relative z-10"
                                                                        title="Xem ghi chú"
                                                                    >
                                                                        <Eye size={18} />
                                                                    </button>

                                                                    {/* Tooltip content */}
                                                                    {visibleNoteId === item.id && (
                                                                        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-4 w-64 bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-2xl border border-stone-200 dark:border-zinc-700 z-50 animate-in fade-in slide-in-from-right-2 zoom-in-95 duration-200">
                                                                            <h4 className="text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2 border-b border-stone-100 dark:border-zinc-700 pb-1">
                                                                                Ghi chú
                                                                            </h4>
                                                                            <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed text-left">
                                                                                {item.note}
                                                                            </p>
                                                                            {/* Arrow */}
                                                                            <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-zinc-800 transform rotate-45 border-t border-r border-stone-200 dark:border-zinc-700"></div>
                                                                        </div>
                                                                    )}

                                                                    {/* Click backdrop to close */}
                                                                    {visibleNoteId === item.id && (
                                                                        <div
                                                                            className="fixed inset-0 z-0 bg-transparent"
                                                                            onClick={() => setVisibleNoteId(null)}
                                                                        />
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <Eye size={18} className="text-stone-300 mx-auto" />
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {items.length > 0 && (
                                                <tr className="bg-stone-50 dark:bg-zinc-800/50 font-bold border-t border-stone-200 dark:border-zinc-700">
                                                    <td colSpan={3} className="px-4 py-3 text-right text-stone-900 dark:text-white">
                                                        Tổng cộng:
                                                    </td>
                                                    {/* Total Actual Quantity */}
                                                    <td className="px-4 py-3 text-right text-stone-900 dark:text-white">
                                                        {items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString('vi-VN')}
                                                    </td>

                                                    {/* Total Converted */}
                                                    {hasModule('inbound_conversion') && targetUnit && (
                                                        <td className="px-4 py-3 text-right text-orange-600">
                                                            {items.reduce((sum, item) => {
                                                                if (!item.quantity || !item.unit) return sum
                                                                const product = item.products
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

                                                    {/* Document Quantity (If active) */}
                                                    {hasModule('inbound_financials') && (
                                                        <td className="px-4 py-3 text-right text-blue-600">
                                                            {items.reduce((sum, item) => sum + (item.document_quantity || 0), 0).toLocaleString('vi-VN')}
                                                        </td>
                                                    )}

                                                    {/* Financials: Price + Amount */}
                                                    {hasModule('inbound_financials') && (
                                                        <>
                                                            <td className="px-4 py-3"></td>
                                                            <td className="px-4 py-3 text-right text-blue-600 text-base">
                                                                {totalAmount.toLocaleString('vi-VN')}
                                                            </td>
                                                        </>
                                                    )}

                                                    <td className="px-4 py-3"></td>
                                                </tr>
                                            )}
                                            {items.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                                                        Không tìm thấy chi tiết hàng hóa
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50 flex justify-end gap-3">
                        <div className="relative">
                            <button
                                onClick={() => setShowPrintMenu(!showPrintMenu)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
                            >
                                <Printer size={18} />
                                In phiếu
                                <ChevronDown size={16} />
                            </button>
                            {showPrintMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowPrintMenu(false)} />
                                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-stone-200 dark:border-zinc-700 overflow-hidden z-20">
                                        <button
                                            onClick={() => {
                                                window.open(`/print/inbound?id=${order.id}&type=internal`, '_blank')
                                                setShowPrintMenu(false)
                                            }}
                                            className="w-full px-4 py-3 text-left hover:bg-stone-100 dark:hover:bg-zinc-700 flex items-center gap-3 text-stone-700 dark:text-gray-200"
                                        >
                                            <Printer size={16} className="text-blue-500" />
                                            <div>
                                                <div className="font-medium">Phiếu nội bộ</div>
                                                <div className="text-xs text-stone-500">Không có đơn giá, thành tiền</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                window.open(`/print/inbound?id=${order.id}&type=official`, '_blank')
                                                setShowPrintMenu(false)
                                            }}
                                            className="w-full px-4 py-3 text-left hover:bg-stone-100 dark:hover:bg-zinc-700 flex items-center gap-3 text-stone-700 dark:text-gray-200 border-t border-stone-100 dark:border-zinc-700"
                                        >
                                            <Printer size={16} className="text-orange-500" />
                                            <div>
                                                <div className="font-medium">Phiếu theo thông tư</div>
                                                <div className="text-xs text-stone-500">Mẫu 01-VT đầy đủ</div>
                                            </div>
                                        </button>

                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-600 text-stone-700 dark:text-gray-300 rounded-lg font-medium hover:bg-stone-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                            Đóng
                        </button>

                        {order.status === 'Pending' && hasPermission('inbound.approve') && (
                            <button
                                onClick={handleApprove}
                                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-lg shadow-green-500/20 transition-all hover:scale-105 active:scale-95"
                            >
                                <CheckCircle size={20} />
                                Xác nhận Nhập kho
                            </button>
                        )}
                    </div>
                </DialogContent>
            </Dialog >
        </>
    )
}
