'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { ArrowLeft, Save, Loader2, Image as ImageIcon, Package, Sparkles, Wrench, DollarSign, Car, Building2, X, Plus, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'

type Product = Database['public']['Tables']['products']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Supplier = Database['public']['Tables']['suppliers']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']

interface ProductFormProps {
    initialData?: Product
    isEditMode?: boolean
}

const QUALITY_GRADES = [
    { value: 'OEM', label: 'OEM - Chính hãng' },
    { value: 'OES', label: 'OES - Nhà cung cấp chính hãng' },
    { value: 'Aftermarket', label: 'Aftermarket - Hãng phụ chất lượng' },
    { value: 'Generic', label: 'Generic - Hàng phổ thông' },
]

const ORIGIN_COUNTRIES = [
    'Việt Nam', 'Nhật Bản', 'Hàn Quốc', 'Thái Lan', 'Trung Quốc',
    'Đức', 'Mỹ', 'Đài Loan', 'Indonesia', 'Malaysia', 'Khác'
]

export default function ProductForm({ initialData, isEditMode = false }: ProductFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])
    const [crossRefs, setCrossRefs] = useState<string[]>(initialData?.cross_reference_numbers || [])
    const [newCrossRef, setNewCrossRef] = useState('')

    const [formData, setFormData] = useState({
        // Basic
        sku: initialData?.sku || '',
        name: initialData?.name || '',
        category_id: initialData?.category_id || '',
        manufacturer: initialData?.manufacturer || '',
        part_number: initialData?.part_number || '',
        compatible_models: initialData?.compatible_models?.join(', ') || '',
        unit: initialData?.unit || 'cái',
        min_stock_level: initialData?.min_stock_level || 5,
        description: initialData?.description || '',
        image_url: initialData?.image_url || '',
        // Technical
        oem_number: initialData?.oem_number || '',
        origin_country: initialData?.origin_country || '',
        quality_grade: initialData?.quality_grade || '',
        warranty_months: initialData?.warranty_months || 0,
        weight_kg: initialData?.weight_kg || '',
        dimensions: initialData?.dimensions || '',
        // Pricing
        cost_price: initialData?.cost_price || 0,
        retail_price: initialData?.retail_price || 0,
        wholesale_price: initialData?.wholesale_price || 0,
        // Supplier
        supplier_id: initialData?.supplier_id || '',
        lead_time_days: initialData?.lead_time_days || 0,
        // Status
        is_active: initialData?.is_active ?? true,
        is_returnable: initialData?.is_returnable ?? true,
    })

    useEffect(() => {
        fetchCategories()
        fetchSuppliers()
        fetchVehicles()
        if (isEditMode && initialData) {
            fetchProductVehicles()
        }
    }, [])

    async function fetchCategories() {
        const { data } = await supabase.from('categories').select('*').order('name')
        if (data) setCategories(data)
    }

    async function fetchSuppliers() {
        const { data } = await supabase.from('suppliers').select('*').eq('is_active', true).order('name')
        if (data) setSuppliers(data)
    }

    async function fetchVehicles() {
        const { data } = await supabase.from('vehicles').select('*').order('brand').order('model')
        if (data) setVehicles(data)
    }

    async function fetchProductVehicles() {
        if (!initialData) return
        const { data } = await supabase
            .from('product_vehicle_compatibility')
            .select('vehicle_id')
            .eq('product_id', initialData.id)
        if (data) {
            setSelectedVehicles(data.map((d: any) => d.vehicle_id))
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked
            setFormData(prev => ({ ...prev, [name]: checked }))
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
        }
    }

    const toggleVehicle = (vehicleId: string) => {
        setSelectedVehicles(prev =>
            prev.includes(vehicleId)
                ? prev.filter(id => id !== vehicleId)
                : [...prev, vehicleId]
        )
    }

    const addCrossRef = () => {
        if (newCrossRef.trim() && !crossRefs.includes(newCrossRef.trim())) {
            setCrossRefs(prev => [...prev, newCrossRef.trim()])
            setNewCrossRef('')
        }
    }

    const removeCrossRef = (ref: string) => {
        setCrossRefs(prev => prev.filter(r => r !== ref))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const compatible_models_array = formData.compatible_models
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0)

        const payload = {
            ...formData,
            compatible_models: compatible_models_array,
            min_stock_level: Number(formData.min_stock_level),
            cost_price: Number(formData.cost_price),
            retail_price: Number(formData.retail_price),
            wholesale_price: Number(formData.wholesale_price),
            warranty_months: Number(formData.warranty_months),
            lead_time_days: Number(formData.lead_time_days),
            weight_kg: formData.weight_kg ? Number(formData.weight_kg) : null,
            category_id: formData.category_id || null,
            supplier_id: formData.supplier_id || null,
            cross_reference_numbers: crossRefs.length > 0 ? crossRefs : null,
            price: Number(formData.retail_price), // Keep old price field in sync
        }

        try {
            let productId = initialData?.id

            if (isEditMode && initialData) {
                const { error } = await supabase
                    .from('products')
                    .update(payload)
                    .eq('id', initialData.id)
                if (error) throw error
            } else {
                const { data, error } = await supabase
                    .from('products')
                    .insert([payload])
                    .select()
                    .single()
                if (error) throw error
                productId = data.id
            }

            // Update vehicle compatibility
            if (productId) {
                // Remove old associations
                await supabase
                    .from('product_vehicle_compatibility')
                    .delete()
                    .eq('product_id', productId)

                // Add new associations
                if (selectedVehicles.length > 0) {
                    const vehicleAssocs = selectedVehicles.map(vehicle_id => ({
                        product_id: productId,
                        vehicle_id
                    }))
                    await supabase
                        .from('product_vehicle_compatibility')
                        .insert(vehicleAssocs)
                }
            }

            router.push('/inventory')
            router.refresh()
        } catch (error: any) {
            alert('Error saving product: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const inputClass = "w-full p-3 rounded-xl outline-none transition-all duration-200 bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"

    // Group vehicles by brand for the selector
    const vehiclesByBrand = vehicles.reduce((acc, v) => {
        if (!acc[v.brand]) acc[v.brand] = []
        acc[v.brand].push(v)
        return acc
    }, {} as Record<string, Vehicle[]>)

    // Calculate margin
    const costPrice = Number(formData.cost_price) || 0
    const retailPrice = Number(formData.retail_price) || 0
    const margin = costPrice > 0 ? ((retailPrice - costPrice) / costPrice * 100).toFixed(1) : 0

    return (
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
            {/* ACTION BAR */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/inventory"
                        className="p-2.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="text-orange-500" size={16} />
                            <span className="text-orange-600 text-xs font-medium">
                                {isEditMode ? 'Edit Product' : 'New Product'}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold text-stone-800">
                            {isEditMode ? 'Cập nhật Sản phẩm' : 'Thêm Sản phẩm mới'}
                        </h1>
                        <p className="text-stone-500 text-sm">Điền thông tin chi tiết về phụ tùng</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/inventory"
                        className="px-5 py-2.5 rounded-xl font-medium text-stone-600 bg-stone-100 border border-stone-200 hover:border-stone-300 hover:text-stone-800 transition-colors"
                    >
                        Hủy bỏ
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-white transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5"
                        style={{
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)',
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        {isEditMode ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN */}
                <div className="lg:col-span-2 space-y-6">
                    {/* General Info Card */}
                    <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                        <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                            <Package size={20} className="text-orange-500" />
                            Thông tin chung
                        </h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">
                                    Tên sản phẩm <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={inputClass}
                                    placeholder="VD: Má phanh trước..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">
                                    Mã SKU <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="sku"
                                    required
                                    value={formData.sku}
                                    onChange={handleChange}
                                    className={`${inputClass} font-mono`}
                                    placeholder="VD: MP-001"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Part Number (Mã PT)</label>
                                <input
                                    name="part_number"
                                    value={formData.part_number}
                                    onChange={handleChange}
                                    className={`${inputClass} font-mono`}
                                    placeholder="VD: 123-456-789"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Danh mục</label>
                                <select
                                    name="category_id"
                                    value={formData.category_id}
                                    onChange={handleChange}
                                    className={inputClass}
                                >
                                    <option value="">-- Chọn danh mục --</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">Mô tả chi tiết</label>
                            <textarea
                                name="description"
                                rows={3}
                                value={formData.description}
                                onChange={handleChange}
                                className={`${inputClass} resize-none`}
                                placeholder="Mô tả kỹ thuật, thông số..."
                            />
                        </div>
                    </div>

                    {/* Technical Info Card */}
                    <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                        <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                            <Wrench size={20} className="text-orange-500" />
                            Thông tin kỹ thuật
                        </h2>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Mã OEM</label>
                                <input
                                    name="oem_number"
                                    value={formData.oem_number}
                                    onChange={handleChange}
                                    className={`${inputClass} font-mono`}
                                    placeholder="VD: 04465-33450"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Xuất xứ</label>
                                <select
                                    name="origin_country"
                                    value={formData.origin_country}
                                    onChange={handleChange}
                                    className={inputClass}
                                >
                                    <option value="">-- Chọn --</option>
                                    {ORIGIN_COUNTRIES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Phẩm cấp</label>
                                <select
                                    name="quality_grade"
                                    value={formData.quality_grade}
                                    onChange={handleChange}
                                    className={inputClass}
                                >
                                    <option value="">-- Chọn --</option>
                                    {QUALITY_GRADES.map(g => (
                                        <option key={g.value} value={g.value}>{g.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Hãng SX</label>
                                <input
                                    name="manufacturer"
                                    value={formData.manufacturer}
                                    onChange={handleChange}
                                    className={inputClass}
                                    placeholder="VD: Bosch"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Bảo hành (tháng)</label>
                                <input
                                    type="number"
                                    name="warranty_months"
                                    value={formData.warranty_months}
                                    onChange={handleChange}
                                    className={inputClass}
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Trọng lượng (kg)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    name="weight_kg"
                                    value={formData.weight_kg}
                                    onChange={handleChange}
                                    className={inputClass}
                                    placeholder="0.5"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Kích thước</label>
                                <input
                                    name="dimensions"
                                    value={formData.dimensions}
                                    onChange={handleChange}
                                    className={inputClass}
                                    placeholder="20x15x10 cm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Vehicle Compatibility Card */}
                    <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                        <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                            <Car size={20} className="text-orange-500" />
                            Xe tương thích
                            <span className="ml-auto text-sm font-normal text-stone-500">
                                Đã chọn: {selectedVehicles.length}
                            </span>
                        </h2>

                        {/* Selected vehicles chips */}
                        {selectedVehicles.length > 0 && (
                            <div className="flex flex-wrap gap-2 p-3 bg-orange-50 rounded-xl">
                                {selectedVehicles.map(vehicleId => {
                                    const v = vehicles.find(vh => vh.id === vehicleId)
                                    if (!v) return null
                                    return (
                                        <span
                                            key={vehicleId}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-sm border border-orange-200"
                                        >
                                            <Car size={14} className="text-orange-500" />
                                            {v.brand} {v.model}
                                            <button
                                                type="button"
                                                onClick={() => toggleVehicle(vehicleId)}
                                                className="ml-1 text-stone-400 hover:text-red-500"
                                            >
                                                <X size={14} />
                                            </button>
                                        </span>
                                    )
                                })}
                            </div>
                        )}

                        {/* Vehicle selector */}
                        <div className="max-h-64 overflow-y-auto border border-stone-200 rounded-xl">
                            {Object.keys(vehiclesByBrand).sort().map(brand => (
                                <div key={brand} className="border-b border-stone-100 last:border-b-0">
                                    <div className="px-4 py-2 bg-stone-50 font-medium text-stone-700 text-sm sticky top-0">
                                        {brand}
                                    </div>
                                    <div className="p-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {vehiclesByBrand[brand].map(v => (
                                            <label
                                                key={v.id}
                                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm transition-colors ${selectedVehicles.includes(v.id)
                                                    ? 'bg-orange-100 text-orange-700'
                                                    : 'hover:bg-stone-50 text-stone-600'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedVehicles.includes(v.id)}
                                                    onChange={() => toggleVehicle(v.id)}
                                                    className="rounded border-stone-300 text-orange-500 focus:ring-orange-400"
                                                />
                                                <span>{v.model}</span>
                                                {v.year_from && (
                                                    <span className="text-xs text-stone-400">
                                                        {v.year_from}-{v.year_to || 'nay'}
                                                    </span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Legacy compatible models field */}
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">
                                Dòng xe (nhập tay)
                            </label>
                            <input
                                name="compatible_models"
                                value={formData.compatible_models}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder="VD: Ranger 2020, Everest 2021"
                            />
                            <p className="text-xs text-stone-400 mt-1.5">Nhập các dòng xe cách nhau bằng dấu phẩy (dùng khi không tìm thấy trong danh sách)</p>
                        </div>
                    </div>

                    {/* Cross Reference Card */}
                    <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                        <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                            <LinkIcon size={20} className="text-orange-500" />
                            Mã tham chiếu (Cross Reference)
                        </h2>
                        <p className="text-sm text-stone-500">Các mã OEM tương đương từ các hãng khác nhau</p>

                        {crossRefs.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {crossRefs.map(ref => (
                                    <span
                                        key={ref}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 rounded-lg text-sm font-mono"
                                    >
                                        {ref}
                                        <button
                                            type="button"
                                            onClick={() => removeCrossRef(ref)}
                                            className="text-stone-400 hover:text-red-500"
                                        >
                                            <X size={14} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <input
                                value={newCrossRef}
                                onChange={(e) => setNewCrossRef(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCrossRef() } }}
                                className={`${inputClass} font-mono flex-1`}
                                placeholder="Nhập mã OEM tương đương..."
                            />
                            <button
                                type="button"
                                onClick={addCrossRef}
                                className="px-4 py-2 rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                    {/* Pricing Card */}
                    <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                        <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                            <DollarSign size={20} className="text-orange-500" />
                            Giá cả
                        </h2>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">Giá vốn (VNĐ)</label>
                            <input
                                type="number"
                                name="cost_price"
                                value={formData.cost_price}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">Giá bán lẻ (VNĐ)</label>
                            <input
                                type="number"
                                name="retail_price"
                                value={formData.retail_price}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">Giá sỉ (VNĐ)</label>
                            <input
                                type="number"
                                name="wholesale_price"
                                value={formData.wholesale_price}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>

                        {costPrice > 0 && retailPrice > 0 && (
                            <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                                <div className="text-sm text-green-700">
                                    Biên lợi nhuận: <span className="font-semibold">{margin}%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Supplier Card */}
                    <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                        <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                            <Building2 size={20} className="text-orange-500" />
                            Nhà cung cấp
                        </h2>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">Chọn NCC</label>
                            <select
                                name="supplier_id"
                                value={formData.supplier_id}
                                onChange={handleChange}
                                className={inputClass}
                            >
                                <option value="">-- Chọn nhà cung cấp --</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">Thời gian đặt hàng (ngày)</label>
                            <input
                                type="number"
                                name="lead_time_days"
                                value={formData.lead_time_days}
                                onChange={handleChange}
                                className={inputClass}
                                min="0"
                            />
                        </div>
                    </div>

                    {/* Warehouse & Status Card */}
                    <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                        <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200">
                            Kho vận & Trạng thái
                        </h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Đơn vị tính</label>
                                <input
                                    name="unit"
                                    value={formData.unit}
                                    onChange={handleChange}
                                    className={inputClass}
                                    placeholder="cái, bộ, hộp..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Tồn tối thiểu</label>
                                <input
                                    type="number"
                                    name="min_stock_level"
                                    value={formData.min_stock_level}
                                    onChange={handleChange}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="is_active"
                                    checked={formData.is_active}
                                    onChange={handleChange}
                                    className="w-5 h-5 rounded border-stone-300 text-orange-500 focus:ring-orange-400"
                                />
                                <span className="text-stone-700">Đang kinh doanh</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="is_returnable"
                                    checked={formData.is_returnable}
                                    onChange={handleChange}
                                    className="w-5 h-5 rounded border-stone-300 text-orange-500 focus:ring-orange-400"
                                />
                                <span className="text-stone-700">Được đổi trả</span>
                            </label>
                        </div>
                    </div>

                    {/* Image Card */}
                    <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                        <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200">
                            Hình ảnh
                        </h2>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">URL Hình ảnh</label>
                            <div className="relative">
                                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                                <input
                                    name="image_url"
                                    value={formData.image_url}
                                    onChange={handleChange}
                                    className={`${inputClass} pl-10 text-sm`}
                                    placeholder="https://example.com/image.jpg"
                                />
                            </div>
                        </div>

                        {/* Image Preview */}
                        <div className="aspect-square w-full rounded-xl flex items-center justify-center overflow-hidden bg-stone-100 border-2 border-dashed border-stone-200">
                            {formData.image_url ? (
                                <img
                                    src={formData.image_url}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                    onError={(e) => (e.currentTarget.src = '')}
                                />
                            ) : (
                                <div className="text-center text-stone-400">
                                    <Package size={48} className="mx-auto mb-3 opacity-30" />
                                    <span className="text-sm">Chưa có ảnh</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </form>
    )
}
