'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Plus, Search, Boxes, MapPin, Trash2, Calendar, Package, Factory, Hash, Layers, X, ChevronDown, ChevronUp, Filter, QrCode as QrIcon, Printer } from 'lucide-react'
import QRCode from "react-qr-code"
import Link from 'next/link'

type Lot = Database['public']['Tables']['lots']['Row'] & {
    products: { name: string; unit: string; product_code?: string } | null
    suppliers: { name: string } | null
    positions: { code: string }[] | null
}

type Product = Database['public']['Tables']['products']['Row']
type Supplier = Database['public']['Tables']['suppliers']['Row']

export default function LotManagementPage() {
    const router = useRouter()
    const [lots, setLots] = useState<Lot[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // UI States
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [showMobileFilters, setShowMobileFilters] = useState(false)

    // Data for Selection
    const [products, setProducts] = useState<Product[]>([])
    const [suppliers, setSuppliers] = useState<Supplier[]>([])

    // New Lot Form State
    const [newLotCode, setNewLotCode] = useState('')
    const [newLotNotes, setNewLotNotes] = useState('')
    const [selectedProductId, setSelectedProductId] = useState('')
    const [selectedSupplierId, setSelectedSupplierId] = useState('')
    const [inboundDate, setInboundDate] = useState('')
    const [batchCode, setBatchCode] = useState('')
    const [quantity, setQuantity] = useState('')

    // QR Code State
    const [qrLot, setQrLot] = useState<Lot | null>(null)

    useEffect(() => {
        fetchLots()
        fetchCommonData()
    }, [])

    async function fetchCommonData() {
        const [prodRes, suppRes] = await Promise.all([
            supabase.from('products').select('*').order('name'),
            supabase.from('suppliers').select('*').order('name')
        ])

        if (prodRes.data) setProducts(prodRes.data)
        if (suppRes.data) setSuppliers(suppRes.data)
    }

    async function fetchLots() {
        setLoading(true)
        const { data, error } = await supabase
            .from('lots')
            .select('*, products(name, unit, product_code:id), suppliers(name), positions(code)')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching lots:', error)
        } else if (data) {
            setLots(data as unknown as Lot[])
        }
        setLoading(false)
    }

    async function generateLotCode() {
        const today = new Date()
        const day = String(today.getDate()).padStart(2, '0')
        const month = String(today.getMonth() + 1).padStart(2, '0') // Month is 0-indexed
        const year = String(today.getFullYear()).slice(-2)
        const dateStr = `${day}${month}${year}`
        const prefix = `LOT-${dateStr}-`

        const { data, error } = await supabase
            .from('lots')
            .select('code')
            .ilike('code', `${prefix}%`)
            .order('code', { ascending: false })
            .limit(1)

        let sequence = 1
        if (data && data.length > 0) {
            const lastCode = (data as any)[0].code
            const lastSequence = parseInt(lastCode.split('-').pop() || '0')
            if (!isNaN(lastSequence)) {
                sequence = lastSequence + 1
            }
        }

        const newCode = `${prefix}${String(sequence).padStart(3, '0')}`
        setNewLotCode(newCode)
    }

    const toggleCreateForm = () => {
        if (!showCreateForm) {
            resetForm()
            generateLotCode()
            // Set default date to today
            setInboundDate(new Date().toISOString().split('T')[0])
        }
        setShowCreateForm(!showCreateForm)
    }

    async function handleCreateLot() {
        if (!newLotCode.trim()) return

        const { data, error } = await (supabase
            .from('lots') as any)
            .insert({
                code: newLotCode,
                notes: newLotNotes,
                product_id: selectedProductId || null,
                supplier_id: selectedSupplierId || null,
                inbound_date: inboundDate || null,
                batch_code: batchCode || null,
                quantity: quantity ? parseInt(quantity) : 0,
                status: 'active'
            })
            .select('*, products(name, unit), suppliers(name)')
            .single()

        if (error) {
            alert('Lỗi tạo LOT: ' + error.message)
        } else if (data) {
            setLots([data as unknown as Lot, ...lots])
            resetForm()
            setShowCreateForm(false)
        }
    }

    function resetForm() {
        setNewLotCode('')
        setNewLotNotes('')
        setSelectedProductId('')
        setSelectedSupplierId('')
        setInboundDate('')
        setBatchCode('')
        setQuantity('')
    }

    async function handleDeleteLot(id: string) {
        if (!confirm('Bạn có chắc chắn muốn xóa LOT này?')) return

        const { error } = await supabase
            .from('lots')
            .delete()
            .eq('id', id)

        if (error) {
            alert('Lỗi xóa LOT: ' + error.message)
        } else {
            setLots(lots.filter(lot => lot.id !== id))
        }
    }

    const filteredLots = lots.filter(lot =>
        lot.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lot.notes && lot.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <section className="space-y-6 pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                        Quản lý LOT
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Quản lý, theo dõi và xử lý các lô hàng trong kho.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/warehouses/map"
                        className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm flex items-center gap-2"
                    >
                        <MapPin size={18} />
                        Sơ đồ vị trí
                    </Link>
                    <button
                        onClick={toggleCreateForm}
                        className={`px-5 py-2.5 rounded-xl font-medium shadow-lg active:scale-95 transition-all flex items-center gap-2 ${showCreateForm
                            ? "bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 hover:border-rose-200 shadow-rose-500/10"
                            : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20"
                            }`}
                    >
                        {showCreateForm ? (
                            <>
                                <X size={20} />
                                Đóng form
                            </>
                        ) : (
                            <>
                                <Plus size={20} />
                                Tạo LOT mới
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Collapsible Create Form */}
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${showCreateForm ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl p-6 md:p-8">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                        <Boxes className="text-emerald-600" size={24} />
                        Thông tin LOT mới
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Mã LOT */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Mã LOT Nội bộ <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input
                                    type="text"
                                    value={newLotCode}
                                    readOnly
                                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 cursor-not-allowed outline-none font-mono"
                                />
                            </div>
                        </div>

                        {/* Batch NCC */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Số Batch/Lô (NCC)
                            </label>
                            <div className="relative">
                                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input
                                    type="text"
                                    value={batchCode}
                                    onChange={(e) => setBatchCode(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="VD: BATCH-01"
                                />
                            </div>
                        </div>

                        {/* Ngày nhập */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Ngày nhập kho
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input
                                    type="date"
                                    value={inboundDate}
                                    onChange={(e) => setInboundDate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Số lượng */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Số lượng nhập
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                placeholder="0"
                            />
                        </div>

                        {/* Sản phẩm */}
                        <div className="space-y-2 lg:col-span-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Sản phẩm
                            </label>
                            <div className="relative">
                                <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <select
                                    value={selectedProductId}
                                    onChange={(e) => setSelectedProductId(e.target.value)}
                                    className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none appearance-none transition-all"
                                >
                                    <option value="">-- Chọn sản phẩm --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        {/* Nhà cung cấp */}
                        <div className="space-y-2 lg:col-span-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Nhà cung cấp
                            </label>
                            <div className="relative">
                                <Factory className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <select
                                    value={selectedSupplierId}
                                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                                    className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none appearance-none transition-all"
                                >
                                    <option value="">-- Chọn nhà cung cấp --</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        {/* Ghi chú */}
                        <div className="space-y-2 lg:col-span-4">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Ghi chú
                            </label>
                            <textarea
                                value={newLotNotes}
                                onChange={(e) => setNewLotNotes(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none"
                                rows={2}
                                placeholder="Ghi chú thêm..."
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                            onClick={() => setShowCreateForm(false)}
                            className="px-5 py-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium transition-colors"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleCreateLot}
                            disabled={!newLotCode.trim()}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Lưu LOT
                        </button>
                    </div>
                </div>
            </div>

            {/* Sticky Filter Bar */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm sticky top-4 z-10 backdrop-blur-xl bg-opacity-90 dark:bg-opacity-90 transition-all">
                <div className="flex flex-col lg:flex-row items-center gap-4">
                    {/* Search */}
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm mã LOT, ghi chú..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        />
                    </div>

                    {/* Filter Toggle (Mobile) */}
                    <button
                        className="lg:hidden p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                        onClick={() => setShowMobileFilters(!showMobileFilters)}
                    >
                        <Filter size={20} />
                    </button>

                    {/* Extra Filters */}
                    <div className={`flex flex-col lg:flex-row items-center gap-3 w-full lg:w-auto ${showMobileFilters ? 'flex' : 'hidden lg:flex'}`}>
                        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            <span className="text-xs font-bold text-zinc-500 uppercase px-2">Trạng thái</span>
                            <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-600"></div>
                            <select className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer">
                                <option value="all">Tất cả</option>
                                <option value="active">Hoạt động</option>
                                <option value="closed">Đã đóng</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid View */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800 animate-pulse h-64"></div>
                    ))}
                </div>
            ) : filteredLots.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                        <Boxes className="text-zinc-300" size={48} />
                        <p className="text-zinc-500">Chưa có LOT nào được tạo</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLots.map(lot => (
                        <div key={lot.id} className="group bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-xl hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
                            {/* Decorative Top Bar */}
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex flex-wrap gap-2">
                                    <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                        LOT
                                    </span>
                                    {lot.suppliers && (
                                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider truncate max-w-[120px]">
                                            {lot.suppliers.name}
                                        </span>
                                    )}
                                </div>
                                {lot.positions && lot.positions.length > 0 ? (
                                    <button
                                        onClick={() => router.push(`/warehouses/map?assignLotId=${lot.id}`)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                                    >
                                        <MapPin size={12} />
                                        {lot.positions[0].code}
                                        {lot.positions.length > 1 && <span className="ml-1 text-[10px] opacity-70">+{lot.positions.length - 1}</span>}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => router.push(`/warehouses/map?assignLotId=${lot.id}`)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 text-xs font-bold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <MapPin size={12} />
                                        Chưa gán
                                    </button>
                                )}
                            </div>

                            {/* Main Content */}
                            <div className="mb-6">
                                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2 tracking-tight group-hover:text-emerald-600 transition-colors">
                                    {lot.code}
                                </h3>

                                {lot.batch_code && (
                                    <div className="text-sm font-medium text-zinc-500 mb-3 flex items-center gap-2">
                                        <span className="opacity-70">Batch:</span>
                                        <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300">{lot.batch_code}</span>
                                    </div>
                                )}

                                {/* Product Info */}
                                <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-zinc-400 uppercase">Sản phẩm</span>
                                        <span className="text-emerald-600 font-bold text-lg">
                                            {lot.quantity || 0} <span className="text-xs font-medium text-emerald-500/70">{lot.products?.unit}</span>
                                        </span>
                                    </div>
                                    <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2">
                                        {lot.products?.name || '---'}
                                    </div>
                                </div>
                            </div>

                            {/* Dates Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-2.5 border border-zinc-100 dark:border-zinc-800">
                                    <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Ngày nhập kho</div>
                                    <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                        {lot.inbound_date ? new Date(lot.inbound_date).toLocaleDateString('vi-VN') : '--/--/----'}
                                    </div>
                                </div>
                                <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-2.5 border border-zinc-100 dark:border-zinc-800">
                                    <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Ngày lên kệ</div>
                                    <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                        {new Date(lot.created_at).toLocaleDateString('vi-VN')}
                                    </div>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-auto">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setQrLot(lot)}
                                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                        title="Mã QR"
                                    >
                                        <QrIcon size={16} />
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { /* View details logic later */ }}
                                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                        title="Xem chi tiết"
                                    >
                                        <Filter size={16} className="rotate-90" /> {/* Using Filter as placeholder for Details/Split */}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteLot(lot.id)}
                                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        title="Xóa"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {/* QR Code Modal */}
            {qrLot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800 relative">
                        <button
                            onClick={() => setQrLot(null)}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                                    Mã QR LOT
                                </h3>
                                <p className="text-sm text-zinc-500 font-mono">
                                    {qrLot.code}
                                </p>
                            </div>

                            <div className="p-4 bg-white rounded-2xl shadow-inner border border-zinc-100">
                                <QRCode
                                    value={qrLot.code}
                                    size={200}
                                    className="h-auto w-full max-w-[200px]"
                                />
                            </div>

                            <button
                                onClick={() => window.print()}
                                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:opacity-90 transition-opacity"
                            >
                                <Printer size={18} />
                                In tem mã vạch
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}
