import { useState, useEffect, useRef } from 'react'
import { Boxes, MapPin, Calendar, Factory, ShieldCheck, Package, Hash, Layers, X, Plus, Trash2, ChevronDown } from 'lucide-react'
import { Combobox } from '@/components/ui/Combobox'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { logActivity } from '@/lib/audit'
import { Lot, Product, Supplier, QCInfo, Unit, ProductUnit } from '../_hooks/useLotManagement'

interface LotItemInput {
    productId: string
    quantity: number
    unit: string
}

interface LotFormProps {
    isVisible: boolean
    editingLot: Lot | null
    onClose: () => void
    onSuccess: (lot?: any) => void

    // Common Data Props
    products: Product[]
    suppliers: Supplier[]
    qcList: QCInfo[]
    units: Unit[]
    productUnits: ProductUnit[]
    branches: any[]
    isModuleEnabled: (moduleId: string) => boolean
}

export function LotForm({
    isVisible,
    editingLot,
    onClose,
    onSuccess,
    products,
    suppliers,
    qcList,
    units,
    productUnits,
    branches,
    isModuleEnabled
}: LotFormProps) {
    const { currentSystem } = useSystem()

    // Form State
    const [newLotCode, setNewLotCode] = useState('')
    const [newLotNotes, setNewLotNotes] = useState('')
    const [selectedSupplierId, setSelectedSupplierId] = useState('')
    const [selectedQCId, setSelectedQCId] = useState('')
    const [inboundDate, setInboundDate] = useState('')
    const [peelingDate, setPeelingDate] = useState('')
    const [packagingDate, setPackagingDate] = useState('')
    const [warehouseName, setWarehouseName] = useState('') // Add warehouseName state
    const [batchCode, setBatchCode] = useState('')
    const [images, setImages] = useState<string[]>([])
    const [extraInfo, setExtraInfo] = useState('')
    const [lotItems, setLotItems] = useState<LotItemInput[]>([{ productId: '', quantity: 0, unit: '' }])
    const [isInitialized, setIsInitialized] = useState(false)
    const [isPersistent, setIsPersistent] = useState(false)

    const formRef = useRef<HTMLDivElement>(null)

    // Reset or Initialize Form
    useEffect(() => {
        if (isVisible) {
            if (editingLot) {
                // Edit Mode
                setNewLotCode(editingLot.code)
                setNewLotNotes(editingLot.notes || '')

                // Populate items
                if (editingLot.lot_items && editingLot.lot_items.length > 0) {
                    setLotItems(editingLot.lot_items.map(item => ({
                        productId: item.product_id,
                        quantity: item.quantity,
                        unit: (item as any).unit || ''
                    })))
                } else if (editingLot.products) {
                    // Fallback for legacy
                    const legacyPId = (editingLot as any).product_id
                    if (legacyPId) {
                        setLotItems([{
                            productId: legacyPId,
                            quantity: editingLot.quantity || 0,
                            unit: editingLot.products?.unit || ''
                        }])
                    } else {
                        setLotItems([{ productId: '', quantity: 0, unit: '' }])
                    }
                } else {
                    setLotItems([{ productId: '', quantity: 0, unit: '' }])
                }

                setSelectedSupplierId(editingLot.supplier_id || '')
                setSelectedQCId(editingLot.qc_id || '')
                setInboundDate(editingLot.inbound_date ? new Date(editingLot.inbound_date).toISOString().split('T')[0] : '')
                setPeelingDate(editingLot.peeling_date ? new Date(editingLot.peeling_date).toISOString().split('T')[0] : '')
                setPackagingDate(editingLot.packaging_date ? new Date(editingLot.packaging_date).toISOString().split('T')[0] : '')
                setWarehouseName(editingLot.warehouse_name || '')
                setBatchCode(editingLot.batch_code || '')

                // Handle images
                let imgs: string[] = []
                if (Array.isArray(editingLot.images)) imgs = editingLot.images
                else if (typeof editingLot.images === 'string') {
                    try { imgs = JSON.parse(editingLot.images) } catch (e) { imgs = [] }
                }
                setImages(imgs)

                // Handle metadata
                let meta: any = {}
                if (editingLot.metadata && typeof editingLot.metadata === 'object') meta = editingLot.metadata
                else if (typeof editingLot.metadata === 'string') {
                    try { meta = JSON.parse(editingLot.metadata) } catch (e) { meta = {} }
                }
                setExtraInfo(meta.extra_info || '')

            } else {
                // Create Mode - Load sticky values from localStorage
                const stickyData = localStorage.getItem('LOT_FORM_STICKY_DATA')
                if (stickyData) {
                    try {
                        const parsed = JSON.parse(stickyData)
                        setIsPersistent(!!parsed.isPersistent)

                        if (parsed.isPersistent) {
                            // Reset non-persistent fields first to ensure no leaks
                            setImages([])
                            setNewLotNotes('')

                            if (parsed.supplierId) setSelectedSupplierId(parsed.supplierId)
                            if (parsed.qcId) setSelectedQCId(parsed.qcId)
                            if (parsed.peelingDate) setPeelingDate(parsed.peelingDate)
                            if (parsed.packagingDate) setPackagingDate(parsed.packagingDate)
                            if (parsed.warehouseName) setWarehouseName(parsed.warehouseName)
                            if (parsed.batchCode) setBatchCode(parsed.batchCode)
                            if (parsed.extraInfo) setExtraInfo(parsed.extraInfo.toUpperCase())
                            if (parsed.inboundDate) setInboundDate(parsed.inboundDate)
                            if (parsed.lotItems) setLotItems(parsed.lotItems)
                        } else {
                            resetForm()
                            setInboundDate(new Date().toISOString().split('T')[0])
                            setPeelingDate(new Date().toISOString().split('T')[0])
                            setPackagingDate(new Date().toISOString().split('T')[0])

                            if (branches.length > 0) {
                                const defaultBranch = branches.find(b => b.is_default)
                                setWarehouseName(defaultBranch ? defaultBranch.name : branches[0].name)
                            }
                        }
                    } catch (e) {
                        console.error('Failed to parse sticky data', e)
                    }
                } else {
                    // Defaults if no sticky data
                    resetForm()
                    setInboundDate(new Date().toISOString().split('T')[0])
                    setPeelingDate(new Date().toISOString().split('T')[0])
                    setPackagingDate(new Date().toISOString().split('T')[0])

                    if (branches.length > 0) {
                        const defaultBranch = branches.find(b => b.is_default)
                        setWarehouseName(defaultBranch ? defaultBranch.name : branches[0].name)
                    }
                }

                generateLotCode()
            }
            setIsInitialized(true)

            // Scroll to form
            setTimeout(() => {
                if (formRef.current) {
                    const y = formRef.current.getBoundingClientRect().top + window.scrollY - 100
                    window.scrollTo({ top: y, behavior: 'smooth' })
                }
            }, 100)
        }
    }, [isVisible, editingLot, branches])

    // Save sticky values to localStorage in Create Mode
    useEffect(() => {
        if (isVisible && !editingLot && isInitialized) {
            const stickyData = {
                isPersistent,
                supplierId: isPersistent ? selectedSupplierId : '',
                qcId: isPersistent ? selectedQCId : '',
                peelingDate: isPersistent ? peelingDate : '',
                packagingDate: isPersistent ? packagingDate : '',
                warehouseName: isPersistent ? warehouseName : '',
                batchCode: isPersistent ? batchCode : '',
                extraInfo: isPersistent ? extraInfo : '',
                inboundDate: isPersistent ? inboundDate : '',
                lotItems: isPersistent ? lotItems : []
            }
            localStorage.setItem('LOT_FORM_STICKY_DATA', JSON.stringify(stickyData))
        }
    }, [
        isVisible,
        editingLot,
        isInitialized,
        isPersistent,
        selectedSupplierId,
        selectedQCId,
        peelingDate,
        packagingDate,
        warehouseName,
        batchCode,
        extraInfo,
        inboundDate,
        lotItems
    ])

    function resetForm() {
        setNewLotCode('')
        setNewLotNotes('')
        setSelectedSupplierId('')
        setSelectedQCId('')
        setInboundDate('')
        setPeelingDate('')
        setPackagingDate('')
        setWarehouseName('')
        setBatchCode('')
        setImages([])
        setExtraInfo('')
        setLotItems([{ productId: '', quantity: 0, unit: '' }])
    }

    async function generateLotCode() {
        if (!currentSystem?.name) return;

        const today = new Date()
        const day = String(today.getDate()).padStart(2, '0')
        const month = String(today.getMonth() + 1).padStart(2, '0')
        const year = String(today.getFullYear()).slice(-2)
        const dateStr = `${day}${month}${year}`

        let warehousePrefix = ''
        // Remove "Kho" prefix if present
        const cleanName = currentSystem.name.replace(/^Kho\s+/i, '').trim()

        // Get acronym
        const initials = cleanName.split(/\s+/).map(word => word[0]).join('')

        // Normalize Vietnamese
        const normalized = initials
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D")

        warehousePrefix = normalized.toUpperCase().replace(/[^A-Z0-9]/g, '')

        const prefix = warehousePrefix ? `${warehousePrefix}-LOT-${dateStr}-` : `LOT-${dateStr}-`

        const { data } = await supabase
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

        setNewLotCode(`${prefix}${String(sequence).padStart(3, '0')}`)
    }

    async function handleSubmit() {
        if (!newLotCode.trim()) return

        const validItems = lotItems.filter(item => item.productId && item.quantity > 0)
        const totalQuantity = validItems.reduce((sum, item) => sum + item.quantity, 0)

        // Prepare History Entry if new Lot
        const systemHistory: any = (editingLot?.metadata as any)?.system_history || { exports: [], inbound: [] }
        if (!editingLot) {
            const inboundItems: Record<string, any> = {}
            validItems.forEach((item, idx) => {
                const product = products.find(p => p.id === item.productId)
                inboundItems[idx] = {
                    product_id: item.productId,
                    product_sku: product?.sku,
                    product_name: product?.name,
                    quantity: item.quantity,
                    unit: item.unit,
                    price: (product as any)?.cost_price || 0
                }
            })

            if (!systemHistory.inbound) systemHistory.inbound = []
            systemHistory.inbound.push({
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                supplier_id: selectedSupplierId || null,
                supplier_name: suppliers.find(s => s.id === selectedSupplierId)?.name || 'N/A',
                items: inboundItems,
                draft: true // Marked as draft for the inbound buffer
            })
        }

        const lotData = {
            code: newLotCode,
            notes: newLotNotes,
            supplier_id: selectedSupplierId || null,
            qc_id: selectedQCId || null,
            inbound_date: inboundDate || null,
            peeling_date: peelingDate || null,
            packaging_date: packagingDate || null,
            warehouse_name: warehouseName || null,
            batch_code: batchCode || null,
            quantity: totalQuantity,
            status: 'active',
            system_code: currentSystem?.code,
            images: images,
            metadata: {
                extra_info: extraInfo,
                system_history: systemHistory
            }
        }

        let lotId = editingLot?.id
        let error

        if (lotId) {
            // Update
            const { error: updateError } = await (supabase
                .from('lots') as any)
                .update(lotData)
                .eq('id', lotId)

            error = updateError

            if (!error) {
                // Reset items
                const { error: deleteError } = await supabase
                    .from('lot_items')
                    .delete()
                    .eq('lot_id', lotId)
                if (deleteError) console.error(deleteError)
            }
        } else {
            // Create
            const { data: newLot, error: createError } = await (supabase
                .from('lots') as any)
                .insert(lotData)
                .select('id')
                .single()

            error = createError
            if (newLot) lotId = newLot.id
        }

        if (error) {
            alert(`Lỗi ${editingLot ? 'cập nhật' : 'tạo'} LOT: ` + error.message)
            return
        }

        if (lotId && validItems.length > 0) {
            const itemsToInsert = validItems.map(item => ({
                lot_id: lotId,
                product_id: item.productId,
                quantity: item.quantity,
                unit: item.unit
            }))

            const { error: itemsError } = await supabase
                .from('lot_items')
                .insert(itemsToInsert as any)

            if (itemsError) {
                alert('Lỗi lưu danh sách sản phẩm: ' + itemsError.message)
            }
        }

        // Audit Log
        try {
            await logActivity({
                supabase,
                tableName: 'lots',
                recordId: lotId || 'unknown',
                action: editingLot ? 'UPDATE' : 'CREATE',
                oldData: editingLot ? { ...editingLot, lot_items: editingLot.lot_items } : null,
                newData: { ...lotData, lot_items: validItems }
            })
        } catch (err) {
            console.error('Failed to log activity', err)
        }

        onSuccess(lotId ? { id: lotId, ...lotData } : undefined)
    }

    return (
        <div ref={formRef} className={`transition-all duration-500 ease-in-out overflow-hidden ${isVisible ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 md:p-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Boxes className="text-orange-600" size={24} />
                    {editingLot ? 'Cập nhật thông tin LOT' : 'Thông tin LOT mới'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Mã LOT */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Mã LOT Nội bộ <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={newLotCode}
                                readOnly
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 cursor-not-allowed outline-none font-mono"
                            />
                        </div>
                    </div>

                    {/* Batch NCC */}
                    {isModuleEnabled('batch_code') && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Số Batch/Lô (NCC)
                            </label>
                            <div className="relative">
                                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={batchCode}
                                    onChange={(e) => setBatchCode(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                    placeholder="VD: BATCH-01"
                                />
                            </div>
                        </div>
                    )}

                    {/* Ngày nhập */}
                    {isModuleEnabled('inbound_date') && (
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
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* Ngày bóc múi */}
                    {isModuleEnabled('peeling_date') && (
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
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* Ngày đóng bao bì */}
                    {isModuleEnabled('packaging_date') && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Ngày đóng bao bì
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input
                                    type="date"
                                    value={packagingDate}
                                    onChange={(e) => setPackagingDate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* Kho nhập hàng */}
                    {isModuleEnabled('warehouse_name') && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Kho nhập hàng
                            </label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <select
                                    value={warehouseName}
                                    onChange={(e) => setWarehouseName(e.target.value)}
                                    className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none appearance-none transition-all"
                                >
                                    <option value="">-- Chọn kho hàng --</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                            </div>
                        </div>
                    )}

                    {/* Nhà cung cấp */}
                    {isModuleEnabled('supplier_info') && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Nhà cung cấp
                            </label>
                            <div className="relative">
                                <Factory className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <select
                                    value={selectedSupplierId}
                                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                                    className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none appearance-none transition-all"
                                >
                                    <option value="">-- Chọn nhà cung cấp --</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                            </div>
                        </div>
                    )}

                    {/* QC Selection */}
                    {isModuleEnabled('qc_info') && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Nhân viên QC
                            </label>
                            <div className="relative">
                                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <select
                                    value={selectedQCId}
                                    onChange={(e) => setSelectedQCId(e.target.value)}
                                    className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none appearance-none transition-all"
                                >
                                    <option value="">-- Chọn QC --</option>
                                    {qcList.map(qc => (
                                        <option key={qc.id} value={qc.id}>{qc.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                            </div>
                        </div>
                    )}

                    {/* Media & Extra Info */}
                    {(isModuleEnabled('lot_images') || isModuleEnabled('extra_info')) && (
                        <div className="md:col-span-2 lg:col-span-4 space-y-4 border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-4">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Package size={16} className="text-orange-600" />
                                Hình ảnh & Thông tin phụ
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {isModuleEnabled('lot_images') && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                            Hình ảnh chứng từ / lot
                                        </label>
                                        <ImageUpload
                                            value={images}
                                            onChange={setImages}
                                            maxFiles={5}
                                            folder="img-lot"
                                        />
                                    </div>
                                )}

                                {isModuleEnabled('extra_info') && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                            Thông tin bổ sung
                                        </label>
                                        <textarea
                                            value={extraInfo}
                                            onChange={(e) => setExtraInfo(e.target.value.toUpperCase())}
                                            className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none font-mono text-sm uppercase"
                                            rows={5}
                                            placeholder="NHẬP CÁC THÔNG TIN PHỤ KHÁC..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Ghi chú */}
                    <div className="space-y-2 lg:col-span-4 mb-4">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Ghi chú
                        </label>
                        <textarea
                            value={newLotNotes}
                            onChange={(e) => setNewLotNotes(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none"
                            rows={2}
                            placeholder="Ghi chú thêm..."
                        />
                    </div>

                    {/* Danh sách sản phẩm */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-4 space-y-3">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>Danh sách sản phẩm ({lotItems.length})</span>
                            <button
                                onClick={() => setLotItems([...lotItems, { productId: '', quantity: 0, unit: '' }])}
                                className="text-xs flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium px-2 py-1 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
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
                                                    setLotItems(prev => {
                                                        const newItems = [...prev]
                                                        const product = products.find(p => p.id === val)
                                                        newItems[index] = {
                                                            ...newItems[index],
                                                            productId: val || '',
                                                            unit: product?.unit || ''
                                                        }
                                                        return newItems
                                                    })
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
                                                const val = parseInt(e.target.value) || 0
                                                setLotItems(prev => {
                                                    const newItems = [...prev]
                                                    newItems[index] = { ...newItems[index], quantity: val }
                                                    return newItems
                                                })
                                            }}
                                            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-sm transition-all"
                                        />
                                    </div>

                                    {/* Unit Selection */}
                                    <div className="w-full md:w-28 space-y-1">
                                        <select
                                            value={item.unit}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                setLotItems(prev => {
                                                    const newItems = [...prev]
                                                    newItems[index] = { ...newItems[index], unit: val }
                                                    return newItems
                                                })
                                            }}
                                            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-sm transition-all"
                                        >
                                            {(() => {
                                                const product = products.find(p => p.id === item.productId)
                                                if (!product) return <option value="">Đơn vị</option>

                                                const availableUnits = new Set<string>()
                                                if (product.unit) availableUnits.add(product.unit)

                                                productUnits
                                                    .filter(pu => pu.product_id === item.productId)
                                                    .forEach(pu => {
                                                        const u = units.find(u => u.id === pu.unit_id)
                                                        if (u) availableUnits.add(u.name)
                                                    })

                                                return Array.from(availableUnits).map(u => (
                                                    <option key={u} value={u}>{u}</option>
                                                ))
                                            })()}
                                        </select>
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
                </div>

                <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    {!editingLot && (
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={isPersistent}
                                    onChange={(e) => setIsPersistent(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                            </div>
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-orange-600 transition-colors">
                                Ghi nhớ thông tin cho lô tiếp theo
                            </span>
                        </label>
                    )}
                    <div className="flex items-center gap-3 ml-auto">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!newLotCode.trim()}
                            className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {editingLot ? 'Cập nhật' : 'Lưu LOT'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
