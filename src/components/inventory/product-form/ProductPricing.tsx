import { DollarSign } from 'lucide-react'

interface ProductPricingProps {
    formData: any
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    readOnly: boolean
    inputClass: string
}

export function ProductPricing({ formData, handleChange, readOnly, inputClass }: ProductPricingProps) {
    return (
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
                            disabled={readOnly}
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
                            disabled={readOnly}
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
                            disabled={readOnly}
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
    )
}
