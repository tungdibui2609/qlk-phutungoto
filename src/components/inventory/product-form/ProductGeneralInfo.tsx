import React from 'react'
import { Package } from 'lucide-react'
import { Database } from '@/lib/database.types'

type Category = Database['public']['Tables']['categories']['Row']

interface ProductGeneralInfoProps {
    formData: any
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    categories: Category[]
    isGeneratingSku: boolean
    isAutoSku: boolean
    setIsAutoSku: (value: boolean) => void
    generateSku: () => Promise<string>
    setFormData: any
    readOnly: boolean
    inputClass: string
}

export function ProductGeneralInfo({
    formData,
    handleChange,
    categories,
    isGeneratingSku,
    isAutoSku,
    setIsAutoSku,
    generateSku,
    setFormData,
    readOnly,
    inputClass
}: ProductGeneralInfoProps) {
    return (
        <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
            <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                <Package size={20} className="text-orange-500" />
                Thông tin cơ bản
            </h2>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Tên sản phẩm <span className="text-red-500">*</span></label>
                    <input name="name" required disabled={readOnly} value={formData.name} onChange={handleChange} className={inputClass} placeholder="VD: Má phanh trước..." />
                </div>
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                        Mã SKU <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                        <input
                            name="sku"
                            required
                            disabled={readOnly || isAutoSku || isGeneratingSku}
                            value={isGeneratingSku ? 'Đang tạo...' : formData.sku}
                            onChange={handleChange}
                            className={`${inputClass} font-mono ${isAutoSku ? 'bg-stone-100 text-stone-500' : ''}`}
                            placeholder="VD: MP-001"
                        />
                        {!readOnly && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="autoSku"
                                    checked={isAutoSku}
                                    onChange={async (e) => {
                                        setIsAutoSku(e.target.checked)
                                        if (e.target.checked) {
                                            const newSku = await generateSku()
                                            setFormData((prev: any) => ({ ...prev, sku: newSku }))
                                        }
                                    }}
                                    disabled={isGeneratingSku}
                                    className="w-4 h-4 text-orange-600 rounded border-stone-300 focus:ring-orange-500"
                                />
                                <label htmlFor="autoSku" className="text-xs text-stone-500 font-medium cursor-pointer select-none">
                                    {isGeneratingSku ? 'Đang xử lý...' : 'Tạo mã tự động (theo phân hệ)'}
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PRIMARY CATEGORY */}
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2 font-semibold">
                        Danh mục chính <span className="text-red-500">*</span>
                    </label>
                    <select
                        required
                        disabled={readOnly}
                        name="primary_category_id"
                        value={formData.primary_category_id}
                        onChange={handleChange}
                        className={inputClass}
                    >
                        <option value="">-- Chọn danh mục chính --</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* SECONDARY CATEGORIES */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2 font-semibold">
                        Danh mục phụ (Không bắt buộc)
                    </label>
                    <div className="flex flex-wrap gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200 border-dashed">
                        {categories.map(cat => {
                            // Don't show primary category as a secondary option to avoid confusion
                            if (cat.id === formData.primary_category_id) return null;

                            const isSelected = formData.secondary_category_ids?.includes(cat.id)
                            
                            return (
                                <div 
                                    key={cat.id} 
                                    className={`
                                        relative flex items-center p-2 px-4 rounded-lg border transition-all cursor-pointer group
                                        ${isSelected 
                                            ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-200' 
                                            : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'}
                                    `}
                                    onClick={() => {
                                        if (readOnly) return
                                        const currentIds = [...(formData.secondary_category_ids || [])]
                                        const newIds = isSelected 
                                            ? currentIds.filter(id => id !== cat.id)
                                            : [...currentIds, cat.id]
                                        setFormData((prev: any) => ({ ...prev, secondary_category_ids: newIds }))
                                    }}
                                >
                                    <div className={`
                                        w-4 h-4 rounded-md border flex items-center justify-center mr-3 transition-colors flex-shrink-0
                                        ${isSelected ? 'bg-orange-600 border-orange-600' : 'bg-white border-stone-300 group-hover:border-stone-400'}
                                    `}>
                                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-sm font-medium ${isSelected ? 'text-orange-900' : 'text-stone-600'}`}>
                                            {cat.name}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                        {categories.length === 0 && (
                            <div className="col-span-full py-4 text-center text-stone-400 text-sm italic">
                                Chưa có danh mục nào được định nghĩa.
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Mô tả chi tiết</label>
                <textarea name="description" disabled={readOnly} rows={3} value={formData.description} onChange={handleChange} className={`${inputClass} resize-none`} placeholder="Mô tả kỹ thuật, thông số..." />
            </div>
        </div>
    )
}
