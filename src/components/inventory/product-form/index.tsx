'use client'

import { ArrowLeft, Save, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Database } from '@/lib/database.types'
import { useProductForm } from './useProductForm'
import { ProductGeneralInfo } from './ProductGeneralInfo'
import { ProductUnits } from './ProductUnits'
import { ProductMedia } from './ProductMedia'
import { ProductPricing } from './ProductPricing'
import { ProductPackaging } from './ProductPackaging'

type Product = Database['public']['Tables']['products']['Row']

interface ProductFormProps {
    initialData?: Product
    isEditMode?: boolean
    readOnly?: boolean
}

export default function ProductForm({ initialData, isEditMode = false, readOnly = false }: ProductFormProps) {
    const {
        loading,
        formData,
        setFormData,
        handleChange,
        categories,
        units,
        mediaItems,
        setMediaItems,
        alternativeUnits,
        addAlternativeUnit,
        removeAlternativeUnit,
        updateAlternativeUnit,
        isAutoSku,
        setIsAutoSku,
        isGeneratingSku,
        generateSku,
        hasModule,
        handleSubmit
    } = useProductForm({ initialData, isEditMode, readOnly })

    const inputClass = readOnly
        ? "w-full p-0 bg-transparent border-none text-stone-800 font-medium focus:ring-0 placeholder:text-transparent"
        : "w-full p-3 rounded-xl outline-none transition-all duration-200 bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"

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
                            <span className="text-orange-600 text-xs font-medium">
                                {readOnly ? 'View Product' : (isEditMode ? 'Edit Product' : 'New Product')}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold text-stone-800">
                            {readOnly ? 'Chi tiết Sản phẩm' : (isEditMode ? 'Cập nhật Sản phẩm' : 'Thêm Sản phẩm mới')}
                        </h1>
                        <p className="text-stone-500 text-sm">
                            {readOnly ? 'Xem thông tin chi tiết' : 'Điền thông tin chi tiết'}
                        </p>
                    </div>
                </div>

                {!readOnly && (
                    <div className="flex gap-3">
                        <Link href="/inventory" className="px-5 py-2.5 rounded-xl font-medium text-stone-600 bg-stone-100 border border-stone-200 hover:border-stone-300 hover:text-stone-800 transition-colors">Hủy bỏ</Link>
                        <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-white transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)' }}>
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            {isEditMode ? 'Lưu sản phẩm' : 'Tạo sản phẩm'}
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN */}
                <div className="lg:col-span-2 space-y-6">
                    <ProductGeneralInfo
                        formData={formData}
                        handleChange={handleChange}
                        categories={categories}
                        isGeneratingSku={isGeneratingSku}
                        isAutoSku={isAutoSku}
                        setIsAutoSku={setIsAutoSku}
                        generateSku={generateSku}
                        setFormData={setFormData}
                        readOnly={readOnly}
                        inputClass={inputClass}
                    />

                    {hasModule('units_conversion') && (
                        <ProductUnits
                            formData={formData}
                            handleChange={handleChange}
                            units={units}
                            alternativeUnits={alternativeUnits}
                            addAlternativeUnit={addAlternativeUnit}
                            removeAlternativeUnit={removeAlternativeUnit}
                            updateAlternativeUnit={updateAlternativeUnit}
                            readOnly={readOnly}
                            inputClass={inputClass}
                        />
                    )}
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                    {hasModule('images') && (
                        <ProductMedia
                            mediaItems={mediaItems}
                            setMediaItems={setMediaItems}
                            readOnly={readOnly}
                            inputClass={inputClass}
                        />
                    )}

                    {hasModule('pricing') && (
                        <ProductPricing
                            formData={formData}
                            handleChange={handleChange}
                            readOnly={readOnly}
                            inputClass={inputClass}
                        />
                    )}

                    {hasModule('packaging') && (
                        <ProductPackaging
                            formData={formData}
                            handleChange={handleChange}
                            readOnly={readOnly}
                            inputClass={inputClass}
                        />
                    )}
                </div>
            </div>
        </form>
    )
}
