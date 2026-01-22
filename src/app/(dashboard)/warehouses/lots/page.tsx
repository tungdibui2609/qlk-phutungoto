'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Plus, Search, Boxes, MapPin, Trash2, Calendar, Package, Factory, Hash, Layers, X, ChevronDown, ChevronUp, Filter, QrCode as QrIcon, Printer, Edit, ShieldCheck } from 'lucide-react'
import QRCode from "react-qr-code"
import Link from 'next/link'
import { Combobox } from '@/components/ui/Combobox'
import { useSystem } from '@/contexts/SystemContext'

type Lot = Database['public']['Tables']['lots']['Row'] & {
    lot_items: (Database['public']['Tables']['lot_items']['Row'] & {
        products: { name: string; unit: string | null; product_code?: string; sku: string } | null
    })[] | null
    suppliers: { name: string } | null
    qc_info: { name: string } | null
    positions: { code: string }[] | null
    // Legacy support for display if needed, but we will primarily use lot_items
    products?: { name: string; unit: string | null; product_code?: string } | null
}

interface LotItemInput {
    productId: string
    quantity: number
}

type Product = Database['public']['Tables']['products']['Row']
type Supplier = Database['public']['Tables']['suppliers']['Row']
type QCInfo = Database['public']['Tables']['qc_info']['Row']

export default function LotManagementPage() {
    const router = useRouter()
    const { currentSystem } = useSystem()
    const [lots, setLots] = useState<Lot[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // UI States
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const [editingLotId, setEditingLotId] = useState<string | null>(null)

    // Data for Selection
    const [products, setProducts] = useState<Product[]>([])
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [qcList, setQCList] = useState<QCInfo[]>([])

    // New Lot Form State
    // New Lot Form State
    const [newLotCode, setNewLotCode] = useState('')
    const [newLotNotes, setNewLotNotes] = useState('')
    const [selectedSupplierId, setSelectedSupplierId] = useState('')
    const [selectedQCId, setSelectedQCId] = useState('')
    const [inboundDate, setInboundDate] = useState('')
    const [peelingDate, setPeelingDate] = useState('')
    const [batchCode, setBatchCode] = useState('')
    const [lotItems, setLotItems] = useState<LotItemInput[]>([{ productId: '', quantity: 0 }])

    // QR Code State
    const [qrLot, setQrLot] = useState<Lot | null>(null)

    const formRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchLots()
        fetchCommonData()
    }, [])

    async function fetchCommonData() {
        const [prodRes, suppRes, qcRes] = await Promise.all([
            supabase.from('products').select('*').order('name'),
            supabase.from('suppliers').select('*').order('name'),
            supabase.from('qc_info').select('*').order('name')
        ])

        if (prodRes.data) setProducts(prodRes.data)
        if (suppRes.data) setSuppliers(suppRes.data)
        if (qcRes.data) setQCList(qcRes.data)
    }

    async function fetchLots() {
        setLoading(true)
        const { data, error } = await supabase
            .from('lots')
            .select(`
                *,
                lot_items (
                    id,
                    quantity,
                    product_id,
                    products (
                        name,
                        unit,
                        sku,
                        product_code:id
                    )
                ),
                suppliers (name),
                qc_info (name),
                positions (code)
            `)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching lots:', error)

            // Diagnostic: Try to identify the broken relationship
            const runDiagnostics = async () => {
                console.group('Diagnostic Checks')

                // 1. Check basic lots access
                const { error: err1 } = await supabase.from('lots').select('id').limit(1)
                console.log('1. Basic lots access:', err1 ? 'FAILED' : 'OK', err1 || '')

                // 2. Check simple joins
                const joins = ['suppliers(name)', 'qc_info(name)', 'positions(code)', 'lot_items(id)']
                for (const join of joins) {
                    const { error: errJ } = await supabase.from('lots').select(`id, ${join}`).limit(1)
                    console.log(`Check join ${join}:`, errJ ? 'FAILED' : 'OK', errJ || '')
                }

                // 3. Check deep join
                const { error: errDeep } = await supabase.from('lots').select('id, lot_items(products(id))').limit(1)
                console.log('Check deep join products:', errDeep ? 'FAILED' : 'OK', errDeep || '')

                console.groupEnd()
            }
            runDiagnostics()

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

        let warehousePrefix = ''
        if (currentSystem?.name) {
            // Remove "Kho" prefix if present (case insensitive)
            const cleanName = currentSystem.name.replace(/^Kho\s+/i, '').trim()

            // Get acronym (First letter of each word)
            const initials = cleanName.split(/\s+/).map(word => word[0]).join('')

            // Normalize Vietnamese to ASCII (remove accents, handle Đ)
            const normalized = initials
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/đ/g, "d")
                .replace(/Đ/g, "D")

            warehousePrefix = normalized.toUpperCase().replace(/[^A-Z0-9]/g, '')
        }

        const prefix = warehousePrefix ? `${warehousePrefix}-LOT-${dateStr}-` : `LOT-${dateStr}-`

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
            if (!editingLotId) {
                generateLotCode()
                // Set default date to today
                setInboundDate(new Date().toISOString().split('T')[0])
            }
        }
        setShowCreateForm(!showCreateForm)
    }

    function handleEditLot(lot: Lot) {
        setEditingLotId(lot.id)
        setNewLotCode(lot.code)
        setNewLotNotes(lot.notes || '')

        // Populate items
        if (lot.lot_items && lot.lot_items.length > 0) {
            setLotItems(lot.lot_items.map(item => ({
                productId: item.product_id,
                quantity: item.quantity
            })))
        } else if (lot.products) {
            // Fallback for legacy data
            setLotItems([{
                productId: (lot as any).product_id, // Accessing raw field if needed, but type says products is joined. 
                // Wait, type 'Lot' has 'products' object, but need product_id.
                // The DB row has product_id.
                // Let's rely on the row data we fetched.
                quantity: lot.quantity || 0
            }])
            // Actually, lot object from Supabase join might not have product_id at top level if we joined?
            // No, select * includes it.
            // But my type definition for Lot is: Row & ... 
            // Row has product_id.
            const legacyLot = lot as unknown as Database['public']['Tables']['lots']['Row']
            if (legacyLot.product_id) {
                setLotItems([{
                    productId: legacyLot.product_id,
                    quantity: legacyLot.quantity || 0
                }])
            } else {
                setLotItems([{ productId: '', quantity: 0 }])
            }
        } else {
            setLotItems([{ productId: '', quantity: 0 }])
        }

        setSelectedSupplierId(lot.supplier_id || '')
        setSelectedQCId(lot.qc_id || '')
        setInboundDate(lot.inbound_date ? new Date(lot.inbound_date).toISOString().split('T')[0] : '')
        setPeelingDate(lot.peeling_date ? new Date(lot.peeling_date).toISOString().split('T')[0] : '')
        setBatchCode(lot.batch_code || '')

        setShowCreateForm(true)
        setTimeout(() => {
            if (formRef.current) {
                const y = formRef.current.getBoundingClientRect().top + window.scrollY - 100
                window.scrollTo({ top: y, behavior: 'smooth' })
            }
        }, 100)
    }

    async function handleCreateLot() {
        if (!newLotCode.trim()) return

        // Validate items
        const validItems = lotItems.filter(item => item.productId && item.quantity > 0)
        if (validItems.length === 0) {
            alert('Vui lòng chọn ít nhất một sản phẩm và nhập số lượng.')
            return
        }

        // Calculate total quantity for the LOT summary
        const totalQuantity = validItems.reduce((sum, item) => sum + item.quantity, 0)

        const lotData = {
            code: newLotCode,
            notes: newLotNotes,
            supplier_id: selectedSupplierId || null,
            qc_id: selectedQCId || null,
            inbound_date: inboundDate || null,
            peeling_date: peelingDate || null,
            batch_code: batchCode || null,
            quantity: totalQuantity, // Legacy/Summary field
            status: 'active'
            // product_id is generally null now for multi-product LOTs, 
            // or we could set it to the first product as primary. Let's leave it null or derived.
        }

        let lotId = editingLotId
        let error

        if (editingLotId) {
            // Update existing lot info
            const { error: updateError } = await (supabase
                .from('lots') as any)
                .update(lotData)
                .eq('id', editingLotId)

            if (updateError) {
                error = updateError
            } else {
                // Update items: Delete all and re-insert (simplest strategy)
                const { error: deleteError } = await supabase
                    .from('lot_items')
                    .delete()
                    .eq('lot_id', editingLotId)

                if (deleteError) {
                    console.error('Error clearing old items', deleteError)
                    // Continue anyway to try insert
                }
            }
        } else {
            // Create new lot
            const { data: newLot, error: createError } = await (supabase
                .from('lots') as any)
                .insert(lotData)
                .select('id')
                .single()

            if (createError) {
                error = createError
            } else if (newLot) {
                lotId = newLot.id
            }
        }

        if (error) {
            alert(`Lỗi ${editingLotId ? 'cập nhật' : 'tạo'} LOT: ` + error.message)
            return
        }

        if (lotId) {
            // Insert items
            const itemsToInsert = validItems.map(item => ({
                lot_id: lotId,
                product_id: item.productId,
                quantity: item.quantity
            }))

            const { error: itemsError } = await supabase
                .from('lot_items')
                .insert(itemsToInsert as any) // Type might be tricky if not fully updated in local ts

            if (itemsError) {
                alert('Lỗi lưu danh sách sản phẩm: ' + itemsError.message)
            } else {
                // Refresh data
                await fetchLots()
                resetForm()
                setShowCreateForm(false)
            }
        }
    }

    function resetForm() {
        setEditingLotId(null)
        setNewLotCode('')
        setNewLotNotes('')
        setSelectedSupplierId('')
        setSelectedQCId('')
        setInboundDate('')
        setPeelingDate('')
        setBatchCode('')
        setLotItems([{ productId: '', quantity: 0 }])
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
            <div ref={formRef} className={`transition-all duration-500 ease-in-out overflow-hidden ${showCreateForm ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl p-6 md:p-8">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                        <Boxes className="text-emerald-600" size={24} />
                        {editingLotId ? 'Cập nhật thông tin LOT' : 'Thông tin LOT mới'}
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

                        {/* Ngày bóc múi */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Ngày bóc múi
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input
                                    type="date"
                                    value={peelingDate}
                                    onChange={(e) => setPeelingDate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Nhà cung cấp */}
                        <div className="space-y-2">
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

                        {/* QC Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Nhân viên QC
                            </label>
                            <div className="relative">
                                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <select
                                    value={selectedQCId}
                                    onChange={(e) => setSelectedQCId(e.target.value)}
                                    className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none appearance-none transition-all"
                                >
                                    <option value="">-- Chọn QC --</option>
                                    {qcList.map(qc => (
                                        <option key={qc.id} value={qc.id}>{qc.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        {/* Danh sách sản phẩm */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-4 space-y-3">
                            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                                <span>Danh sách sản phẩm ({lotItems.length})</span>
                                <button
                                    onClick={() => setLotItems([...lotItems, { productId: '', quantity: 0 }])}
                                    className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                >
                                    <Plus size={14} />
                                    Thêm dòng
                                </button>
                            </label>

                            <div className="space-y-3">
                                {lotItems.map((item, index) => (
                                    <div key={index} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                        <div className="flex-1 w-full space-y-1">
                                            <div className="relative">
                                                <Combobox
                                                    options={products.map(p => ({
                                                        value: p.id,
                                                        label: `${p.sku} - ${p.name}`,
                                                        sku: p.sku,
                                                        name: p.name
                                                    }))}
                                                    value={item.productId}
                                                    onChange={(val) => {
                                                        const newItems = [...lotItems]
                                                        newItems[index].productId = val || ''
                                                        setLotItems(newItems)
                                                    }}
                                                    placeholder="-- Chọn sản phẩm --"
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
                                            </div>
                                        </div>

                                        <div className="w-full md:w-32 space-y-1">
                                            <input
                                                type="number"
                                                min="1"
                                                placeholder="SL"
                                                value={item.quantity || ''}
                                                onChange={(e) => {
                                                    const newItems = [...lotItems]
                                                    newItems[index].quantity = parseInt(e.target.value) || 0
                                                    setLotItems(newItems)
                                                }}
                                                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all"
                                            />
                                        </div>

                                        {lotItems.length > 1 && (
                                            <button
                                                onClick={() => {
                                                    const newItems = lotItems.filter((_, i) => i !== index)
                                                    setLotItems(newItems)
                                                }}
                                                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Xóa dòng"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
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
                            {editingLotId ? 'Cập nhật' : 'Lưu LOT'}
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
                                    {lot.qc_info && (
                                        <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider truncate max-w-[120px] flex items-center gap-1">
                                            <ShieldCheck size={12} />
                                            {lot.qc_info.name}
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

                                <div className="h-6 mb-3 flex items-center">
                                    {lot.batch_code && (
                                        <div className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                                            <span className="opacity-70">Batch:</span>
                                            <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300">{lot.batch_code}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Product Info */}
                                <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-zinc-400 uppercase">Sản phẩm ({lot.lot_items?.length || 0})</span>
                                        <span className="text-emerald-600 font-bold text-lg">
                                            {lot.quantity || 0} <span className="text-xs font-medium text-emerald-500/70">Tổng</span>
                                        </span>
                                    </div>
                                    <div className="space-y-1 max-h-[80px] overflow-y-auto pr-1 custom-scrollbar">
                                        {lot.lot_items && lot.lot_items.length > 0 ? (
                                            lot.lot_items.map(item => (
                                                <div key={item.id} className="text-sm text-zinc-800 dark:text-zinc-200 flex justify-between gap-2">
                                                    <span className="truncate flex-1" title={item.products?.name}>{item.products?.name}</span>
                                                    <span className="font-mono text-xs bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                                                        {item.quantity} {item.products?.unit}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-sm text-zinc-400 italic">
                                                {lot.products?.name ? (
                                                    // Legacy fallback
                                                    <div className="text-sm text-zinc-800 dark:text-zinc-200 flex justify-between gap-2">
                                                        <span className="truncate flex-1">{lot.products.name}</span>
                                                        <span className="font-mono text-xs bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-300">
                                                            {lot.quantity} {lot.products.unit}
                                                        </span>
                                                    </div>
                                                ) : '---'}
                                            </div>
                                        )}
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
                                {lot.peeling_date ? (
                                    <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-2.5 border border-zinc-100 dark:border-zinc-800">
                                        <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Ngày bóc múi</div>
                                        <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                            {new Date(lot.peeling_date).toLocaleDateString('vi-VN')}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-2.5 border border-zinc-100 dark:border-zinc-800">
                                        <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Ngày tạo</div>
                                        <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                            {new Date(lot.created_at).toLocaleDateString('vi-VN')}
                                        </div>
                                    </div>
                                )}
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
                                        onClick={() => handleEditLot(lot)}
                                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                        title="Sửa"
                                    >
                                        <Edit size={16} />
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
