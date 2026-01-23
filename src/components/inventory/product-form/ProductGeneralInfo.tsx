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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Danh mục</label>
                    <select name="category_id" disabled={readOnly} value={formData.category_id} onChange={handleChange} className={inputClass}>
                        <option value="">-- Chọn danh mục --</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Mô tả chi tiết</label>
                <textarea name="description" disabled={readOnly} rows={3} value={formData.description} onChange={handleChange} className={`${inputClass} resize-none`} placeholder="Mô tả kỹ thuật, thông số..." />
            </div>
        </div>
    )
}
