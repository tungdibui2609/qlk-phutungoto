import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { ArrowLeft, Save, Loader2, Package, Sparkles, Image as ImageIcon, Car, DollarSign, Box, Link as LinkIcon, X, Plus, Scale, Video } from 'lucide-react'
import Link from 'next/link'
import { useSystem } from '@/contexts/SystemContext'
import { getFieldsForModules } from '@/lib/product-modules'

type Product = Database['public']['Tables']['products']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']
type Unit = Database['public']['Tables']['units']['Row']

interface ProductFormProps {
    initialData?: Product
    isEditMode?: boolean
}

export default function ProductForm({ initialData, isEditMode = false }: ProductFormProps) {
    const router = useRouter()
    const { systemType, currentSystem } = useSystem()
    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])

    // Module specific states
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])
    const [units, setUnits] = useState<Unit[]>([])
    const [crossRefs, setCrossRefs] = useState<string[]>(initialData?.cross_reference_numbers || [])
    const [newCrossRef, setNewCrossRef] = useState('')

    const [formData, setFormData] = useState({
        // Basic
        sku: initialData?.sku || '',
        name: initialData?.name || '',
        category_id: initialData?.category_id || '',
        description: initialData?.description || '',
        // Images (Legacy/Thumbnail)
        image_url: initialData?.image_url || '',
        // Units
        unit: initialData?.unit || '',
        // Pricing
        cost_price: initialData?.cost_price || 0,
        retail_price: initialData?.retail_price || 0,
        wholesale_price: initialData?.wholesale_price || 0,
        // Packaging
        packaging_specification: initialData?.packaging_specification || '',
    })

    const [mediaItems, setMediaItems] = useState<{ id?: string, url: string, type: 'image' | 'video' }[]>([])
    const [alternativeUnits, setAlternativeUnits] = useState<{ unit_id: string, factor: number, ref_unit_id: string }[]>([])

    const systemModules = currentSystem?.modules
        ? (typeof currentSystem.modules === 'string' ? JSON.parse(currentSystem.modules) : currentSystem.modules)
        : []
    const hasModule = (moduleId: string) => systemModules.includes(moduleId)

    useEffect(() => {
        fetchCategories()
        if (hasModule('units_conversion')) {
            fetchUnits()
            if (isEditMode && initialData) fetchProductUnits()
        }
        if (hasModule('images') && isEditMode && initialData) {
            fetchMedia()
        }
    }, [])

    async function fetchMedia() {
        if (!initialData) return
        const { data } = await (supabase.from('product_media') as any).select('*').eq('product_id', initialData.id).order('sort_order')
        if (data && data.length > 0) {
            setMediaItems(data.map((d: any) => ({ id: d.id, url: d.url, type: d.type })))
        } else if (initialData.image_url) {
            // Fallback: If no media items but legacy image_url exists, add it
            setMediaItems([{ url: initialData.image_url, type: 'image' }])
        }
    }

    async function fetchUnits() {
        const { data } = await (supabase.from('units') as any).select('*').eq('is_active', true).order('name')
        if (data) setUnits(data)
    }

    // Helper to get Base Unit ID
    const baseUnitId = units.find(u => u.name === formData.unit)?.id || ''

    useEffect(() => {
        // Fetch product units ONLY after units are loaded, to allow factor calculation
        if (isEditMode && initialData && hasModule('units_conversion') && units.length > 0) {
            fetchProductUnits()
        }
    }, [units, isEditMode, initialData])

    async function fetchProductUnits() {
        if (!initialData) return
        const { data } = await (supabase.from('product_units') as any).select('*').eq('product_id', initialData.id)

        if (data) {
            // Data has conversion_rate (absolute) and ref_unit_id
            // We need to back-calculate the 'factor' displayed in UI
            const mapped = data.map((d: any) => {
                let factor = d.conversion_rate
                if (d.ref_unit_id) {
                    const refUnit = data.find((r: any) => r.unit_id === d.ref_unit_id)
                    if (refUnit) {
                        factor = d.conversion_rate / refUnit.conversion_rate
                    }
                }
                return {
                    unit_id: d.unit_id,
                    factor: factor, // Display relative factor
                    ref_unit_id: d.ref_unit_id || '' // Empty string for Base Unit
                }
            })
            setAlternativeUnits(mapped)
        }
    }

    async function fetchCategories() {
        const { data } = await supabase.from('categories').select('*').order('name')
        if (data) setCategories(data)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const addAlternativeUnit = () => {
        // Smart Default: Use the specific unit of the LAST row as the reference for the new row
        let defaultRef = ''
        if (alternativeUnits.length > 0) {
            const lastRow = alternativeUnits[alternativeUnits.length - 1]
            if (lastRow.unit_id) {
                defaultRef = lastRow.unit_id // Chain it!
            }
        }

        setAlternativeUnits(prev => [...prev, { unit_id: '', factor: 1, ref_unit_id: defaultRef }])
    }

    const removeAlternativeUnit = (index: number) => {
        setAlternativeUnits(prev => prev.filter((_, i) => i !== index))
    }

    const updateAlternativeUnit = (index: number, field: 'unit_id' | 'factor' | 'ref_unit_id', value: any) => {
        setAlternativeUnits(prev => {
            const newUnits = [...prev]
            newUnits[index] = { ...newUnits[index], [field]: value }
            return newUnits
        })
    }

    // Helper to get Available Reference Units for a given index (Base + Previous Rows)
    const getAvailableRefs = (currentIndex: number) => {
        const refs = []
        // Add Base Unit
        if (formData.unit && baseUnitId) {
            refs.push({ id: '', name: formData.unit }) // Empty string ID represents Base Unit
        }
        // Add previous alternative units that have a unit selected
        for (let i = 0; i < currentIndex; i++) {
            const u = alternativeUnits[i]
            const unitObj = units.find(unit => unit.id === u.unit_id)
            if (unitObj) {
                refs.push({ id: unitObj.id, name: unitObj.name })
            }
        }
        return refs
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const payload = {
            ...formData,
            system_type: systemType,
        }

        try {
            let productId = initialData?.id

            if (isEditMode && initialData) {
                const { error } = await (supabase.from('products') as any).update(payload).eq('id', initialData.id)
                if (error) throw error
            } else {
                const { data, error } = await (supabase.from('products') as any).insert([payload]).select().single()
                if (error) throw error
                productId = data.id
            }

            // Update Product Units
            if (productId && hasModule('units_conversion')) {
                // Delete existing
                await (supabase.from('product_units') as any).delete().eq('product_id', productId)

                // Calculate absolute conversion rates and insert
                if (alternativeUnits.length > 0) {
                    const validUnits: any[] = []

                    // Map unit_id to its Absolute Rate
                    const ratesMap = new Map<string, number>()

                    const unitsToInsert = alternativeUnits.filter(u => u.unit_id && u.factor > 0)

                    for (const u of unitsToInsert) {
                        let absoluteRate = u.factor

                        // Resolve reference rate
                        if (u.ref_unit_id) {
                            const parentRate = ratesMap.get(u.ref_unit_id)
                            if (parentRate) {
                                absoluteRate = u.factor * parentRate
                            } else {
                                // If parent rate not found (maybe parent is Base Unit but ID logic mixed up?)
                                // Or out of order. Assume Base Unit (1) if ref is missing in previous map
                                // But wait, Base Unit is not in ratesMap. 
                                // Actually, ref_unit_id is empty string for Base. 
                                // so if this block is entered, it MUST be an Alt Unit.
                                // If logical parent hasn't been processed yet (impossible if UI enforces order), take factor as is.
                                console.warn('Possible out of order or circular reference', u)
                            }
                        }

                        ratesMap.set(u.unit_id, absoluteRate)

                        validUnits.push({
                            product_id: productId,
                            unit_id: u.unit_id,
                            conversion_rate: absoluteRate,
                            ref_unit_id: u.ref_unit_id || null
                        })
                    }

                    if (validUnits.length > 0) {
                        await (supabase.from('product_units') as any).insert(validUnits)
                    }
                }
            }

            router.push('/inventory')
            router.refresh()
        } catch (error: any) {
            alert('Error: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const inputClass = "w-full p-3 rounded-xl outline-none transition-all duration-200 bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"

    return (
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/inventory" className="p-2.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-500 hover:border-orange-300 hover:text-orange-600 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="text-orange-500" size={16} />
                            <span className="text-orange-600 text-xs font-medium">{isEditMode ? 'Edit Product' : 'New Product'}</span>
                        </div>
                        <h1 className="text-2xl font-bold text-stone-800">{isEditMode ? 'Cập nhật Sản phẩm' : 'Thêm Sản phẩm mới'}</h1>
                        <p className="text-stone-500 text-sm">Điền thông tin chi tiết</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Link href="/inventory" className="px-5 py-2.5 rounded-xl font-medium text-stone-600 bg-stone-100 border border-stone-200 hover:border-stone-300 hover:text-stone-800 transition-colors">Hủy bỏ</Link>
                    <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-white transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)' }}>
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        {isEditMode ? 'Lưu sản phẩm' : 'Tạo sản phẩm'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN */}
                <div className="lg:col-span-2 space-y-6">
                    {/* BASIC INFO - ALWAYS SHOW */}
                    <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                        <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                            <Package size={20} className="text-orange-500" />
                            Thông tin cơ bản
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Tên sản phẩm <span className="text-red-500">*</span></label>
                                <input name="name" required value={formData.name} onChange={handleChange} className={inputClass} placeholder="VD: Má phanh trước..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Mã SKU <span className="text-red-500">*</span></label>
                                <input name="sku" required value={formData.sku} onChange={handleChange} className={`${inputClass} font-mono`} placeholder="VD: MP-001" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Danh mục</label>
                                <select name="category_id" value={formData.category_id} onChange={handleChange} className={inputClass}>
                                    <option value="">-- Chọn danh mục --</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">Mô tả chi tiết</label>
                            <textarea name="description" rows={3} value={formData.description} onChange={handleChange} className={`${inputClass} resize-none`} placeholder="Mô tả kỹ thuật, thông số..." />
                        </div>
                    </div>

                    {/* UNITS & CONVERSION MODULE */}
                    {hasModule('units_conversion') && (
                        <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                            <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                                <Scale size={20} className="text-orange-500" />
                                Đơn vị & Tỉ lệ quy đổi
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-2">Đơn vị cơ bản</label>
                                    <select
                                        name="unit"
                                        value={formData.unit}
                                        onChange={handleChange}
                                        className={inputClass}
                                    >
                                        <option value="">-- Chọn đơn vị --</option>
                                        {units.map(u => (
                                            <option key={u.id} value={u.name}>{u.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-stone-400 mt-1">Đơn vị nhỏ nhất để quản lý tồn kho</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-stone-700">Đơn vị quy đổi khác</label>
                                {alternativeUnits.map((alt, index) => (
                                    <div key={index} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                                        {/* Quantity is always 1 */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-stone-500 w-4 text-center">1</span>
                                        </div>

                                        {/* Select New Unit */}
                                        <div className="flex-1">
                                            <select
                                                value={alt.unit_id}
                                                onChange={(e) => updateAlternativeUnit(index, 'unit_id', e.target.value)}
                                                className="bg-white border border-stone-300 text-stone-800 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5"
                                            >
                                                <option value="">-- Chọn Đơn vị --</option>
                                                {units.filter(u => u.name !== formData.unit).map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <span className="text-stone-400">=</span>

                                        {/* Conversion Factor Input */}
                                        <div className="w-24">
                                            <input
                                                type="number"
                                                value={alt.factor}
                                                onChange={(e) => updateAlternativeUnit(index, 'factor', Number(e.target.value))}
                                                className="bg-white border border-stone-300 text-stone-800 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5 text-center"
                                                placeholder="Tỉ lệ"
                                                min="1"
                                            />
                                        </div>

                                        {/* Reference Unit Select */}
                                        <div className="flex-1">
                                            <select
                                                value={alt.ref_unit_id}
                                                onChange={(e) => updateAlternativeUnit(index, 'ref_unit_id', e.target.value)}
                                                className="bg-white border border-stone-300 text-stone-800 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5"
                                            >
                                                {/* Base Unit Option */}
                                                {baseUnitId && <option value="">{formData.unit} (Cơ bản)</option>}

                                                {/* Other Available Units (Previous definitions) */}
                                                {getAvailableRefs(index).filter(r => r.id !== '').map(ref => (
                                                    <option key={ref.id} value={ref.id}>{ref.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => removeAlternativeUnit(index)}
                                            className="p-2 text-stone-400 hover:text-red-500 hover:bg-stone-100 rounded-lg transition-colors"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addAlternativeUnit}
                                    className="flex items-center gap-2 text-sm text-orange-600 font-medium hover:text-orange-700 px-2 py-1"
                                >
                                    <Plus size={16} />
                                    Thêm đơn vị quy đổi
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                    {/* IMAGES & MEDIA MODULE */}
                    {hasModule('images') && (
                        <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                            <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                                <ImageIcon size={20} className="text-orange-500" />
                                Thư viện Media
                            </h2>

                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-stone-700">Links (Ảnh / Video)</label>
                                {mediaItems.map((item, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <select
                                            value={item.type}
                                            onChange={(e) => {
                                                const newItems = [...mediaItems]
                                                newItems[index].type = e.target.value as any
                                                setMediaItems(newItems)
                                            }}
                                            className="w-24 p-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
                                        >
                                            <option value="image">Ảnh</option>
                                            <option value="video">Video</option>
                                        </select>
                                        <input
                                            value={item.url}
                                            onChange={(e) => {
                                                const newItems = [...mediaItems]
                                                newItems[index].url = e.target.value
                                                setMediaItems(newItems)
                                            }}
                                            className={`${inputClass} text-sm py-2`}
                                            placeholder="URL..."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setMediaItems(prev => prev.filter((_, i) => i !== index))}
                                            className="p-2 text-stone-400 hover:text-red-500 hover:bg-stone-50 rounded-lg"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setMediaItems(prev => [...prev, { url: '', type: 'image' }])}
                                    className="flex items-center gap-2 text-sm text-orange-600 font-medium hover:text-orange-700 px-2"
                                >
                                    <Plus size={16} />
                                    Thêm Link Media
                                </button>
                            </div>

                            {/* Preview Grid */}
                            {mediaItems.some(m => m.url) && (
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    {mediaItems.filter(m => m.url).map((item, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-black border border-stone-200 group">
                                            {item.type === 'image' ? (
                                                <img src={item.url} alt={`Preview ${idx}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Error' }} />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center relative">
                                                    {/* If it looks like a direct video file, use video tag */}
                                                    {item.url.match(/\.(mp4|webm|ogg)$/i) ? (
                                                        <video src={item.url} controls className="w-full h-full object-contain" />
                                                    ) : (
                                                        <div className="flex flex-col items-center text-white gap-2">
                                                            <Video size={32} />
                                                            <span className="text-xs max-w-[80%] text-center truncate px-2">{item.url}</span>
                                                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs underline text-orange-400">Mở Link</a>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div className="absolute top-1 right-1 px-2 py-0.5 rounded bg-black/50 text-[10px] text-white font-medium uppercase">
                                                {item.type}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PRICING MODULE */}
                    {hasModule('pricing') && (
                        <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                            <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                                <DollarSign size={20} className="text-orange-500" />
                                Giá cả
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-2">Giá vốn (Cost)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            name="cost_price"
                                            value={formData.cost_price}
                                            onChange={handleChange}
                                            className={`${inputClass} pl-8`}
                                            placeholder="0"
                                            min="0"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">₫</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-2">Giá bán lẻ (Retail)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            name="retail_price"
                                            value={formData.retail_price}
                                            onChange={handleChange}
                                            className={`${inputClass} pl-8`}
                                            placeholder="0"
                                            min="0"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">₫</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-2">Giá bán buôn (Wholesale)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            name="wholesale_price"
                                            value={formData.wholesale_price}
                                            onChange={handleChange}
                                            className={`${inputClass} pl-8`}
                                            placeholder="0"
                                            min="0"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">₫</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PACKAGING MODULE */}
                    {hasModule('packaging') && (
                        <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                            <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                                <Box size={20} className="text-orange-500" />
                                Quy cách đóng gói
                            </h2>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">Ghi chú quy cách</label>
                                <textarea
                                    name="packaging_specification"
                                    rows={4}
                                    value={formData.packaging_specification}
                                    onChange={handleChange}
                                    className={`${inputClass} resize-none`}
                                    placeholder="VD: Đóng thùng carton 5 lớp, lót giấy chống ẩm..."
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </form>
    )
}
