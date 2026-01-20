'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { X, Calendar, Package, User, FileText, CheckCircle, Clock, Printer, ChevronDown, Eye } from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'

interface InboundOrder {
    id: string
    code: string
    status: string
    created_at: string
    warehouse_name: string | null
    description: string | null
    supplier: { name: string } | null
    supplier_address: string | null
    supplier_phone: string | null
    image_url?: string | null
}

interface OrderItem {
    id: string
    product_name: string | null
    unit: string | null
    quantity: number
    document_quantity: number
    price: number
    note: string | null
    products: { sku: string } | null
}

interface InboundOrderDetailModalProps {
    order: InboundOrder | null
    onClose: () => void
    onUpdate?: () => void
}

export default function InboundOrderDetailModal({ order, onClose, onUpdate }: InboundOrderDetailModalProps) {
    const { showToast, showConfirm } = useToast()
    const { hasPermission } = useUser()
    const [items, setItems] = useState<OrderItem[]>([])
    const [loading, setLoading] = useState(false)
    const [showPrintMenu, setShowPrintMenu] = useState(false)
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [visibleNoteId, setVisibleNoteId] = useState<string | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

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
        const { data, error } = await supabase
            .from('inbound_order_items')
            .select('*, products(sku)')
            .eq('order_id', order.id)

        if (data) {
            setItems(data as any)
        }

        // Fetch order details again to get image_url if not present in prop
        const { data: orderData } = await supabase
            .from('inbound_orders')
            .select('image_url')
            .eq('id', order.id)
            .single()

        if (orderData && (orderData as any).image_url) {
            setImageUrl((orderData as any).image_url)
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

        const confirmed = await showConfirm('Xác nhận hoàn thành phiếu nhập này? Hành động này không thể hoàn tác.')
        if (!confirmed) return

        try {
            const { error } = await (supabase
                .from('inbound_orders') as any)
                .update({ status: 'Completed' })
                .eq('id', order.id)

            if (error) throw error

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-stone-200 dark:border-zinc-800 flex justify-between items-start bg-stone-50 dark:bg-zinc-900/50">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
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
                        <p className="text-sm text-stone-500 flex items-center gap-2">
                            <Calendar size={14} />
                            {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-stone-50 dark:bg-zinc-800/50 rounded-xl border border-stone-100 dark:border-zinc-800">
                        <div className="space-y-4">
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
                            <div>
                                <label className="text-xs font-semibold text-stone-400 uppercase">Kho nhập</label>
                                <p className="font-medium text-stone-900 dark:text-gray-200 flex items-center gap-2 mt-1">
                                    <Package size={16} className="text-orange-500" />
                                    {order.warehouse_name || 'N/A'}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-stone-400 uppercase">Diễn giải</label>
                                <p className="font-medium text-stone-900 dark:text-gray-200 flex items-start gap-2 mt-1">
                                    <FileText size={16} className="text-stone-400 mt-0.5" />
                                    <span className="italic text-stone-600 dark:text-gray-400">
                                        {order.description || 'Không có ghi chú'}
                                    </span>
                                </p>
                            </div>

                            {/* Invoice Image Section */}
                            <div>
                                <label className="text-xs font-semibold text-stone-400 uppercase flex items-center justify-between">
                                    <span>Hình ảnh hóa đơn</span>
                                    {uploading && <span className="text-orange-500">Đang tải...</span>}
                                </label>
                                <div className="mt-2">
                                    {imageUrl ? (
                                        <div className="relative group inline-block">
                                            <img
                                                src={imageUrl}
                                                alt="Hóa đơn"
                                                className="h-32 w-auto object-contain rounded-lg border border-stone-200 dark:border-zinc-700 bg-white"
                                                onClick={() => window.open(imageUrl, '_blank')}
                                            />
                                            <button
                                                onClick={handleRemoveImage}
                                                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                title="Xóa ảnh"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleFileSelect}
                                                disabled={uploading}
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploading}
                                                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-600 rounded-lg text-sm text-stone-600 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-zinc-700 transition-colors border-dashed"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-zinc-800 flex items-center justify-center">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                                </div>
                                                Chụp/Tải ảnh hóa đơn
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
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
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-stone-50 dark:bg-zinc-800/50 text-stone-500 font-medium">
                                        <tr>
                                            <th className="px-4 py-3 w-10">#</th>
                                            <th className="px-4 py-3 min-w-[370px]">Sản phẩm</th>
                                            <th className="px-4 py-3 w-24">ĐVT</th>
                                            <th className="px-4 py-3 w-24 text-right">SL Thực nhập</th>
                                            <th className="px-4 py-3 w-24 text-right">SL Chứng từ</th>
                                            <th className="px-4 py-3 w-32 text-right">Đơn giá</th>
                                            <th className="px-4 py-3 w-32 text-right">Thành tiền</th>
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
                                                <td className="px-4 py-3 text-right font-medium text-blue-600">{item.document_quantity || item.quantity}</td>
                                                <td className="px-4 py-3 text-right text-stone-500">
                                                    {(item.price || 0).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-orange-600">
                                                    {((item.quantity || 0) * (item.price || 0)).toLocaleString()}
                                                </td>
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
                                            <tr className="bg-stone-50 dark:bg-zinc-800/50 font-bold">
                                                <td colSpan={6} className="px-4 py-3 text-right text-stone-900 dark:text-white">
                                                    Tổng cộng:
                                                </td>
                                                <td className="px-4 py-3 text-right text-orange-600 text-sm">
                                                    {totalAmount.toLocaleString()}
                                                </td>
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
            </div>
        </div>
    )
}
