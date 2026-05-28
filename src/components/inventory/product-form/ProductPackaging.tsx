import { Box } from 'lucide-react'

interface ProductPackagingProps {
    formData: any
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    readOnly: boolean
    inputClass: string
    units?: any[]
}

export function ProductPackaging({ formData, handleChange, readOnly, inputClass, units = [] }: ProductPackagingProps) {
    return (
        <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
            <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                <Box size={20} className="text-orange-500" />
                Quy cách đóng gói
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Số lượng trên mỗi Pallet</label>
                    <input
                        type="number"
                        name="quantity_per_pallet"
                        disabled={readOnly}
                        min={0}
                        value={formData.quantity_per_pallet || ''}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="VD: 30"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Đơn vị Pallet</label>
                    {readOnly ? (
                        <div className="py-3 text-stone-800 font-medium">{formData.pallet_unit || formData.unit || '--'}</div>
                    ) : (
                        <select
                            name="pallet_unit"
                            value={formData.pallet_unit || ''}
                            onChange={handleChange}
                            className={inputClass}
                        >
                            <option value="">-- Đơn vị cơ bản --</option>
                            {formData.unit && <option value={formData.unit}>{formData.unit} (Mặc định)</option>}
                            {units.map((u: any) => u.name !== formData.unit && (
                                <option key={u.id} value={u.name}>{u.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>
            <p className="text-xs text-stone-400 -mt-2">
                Dùng để tự động phát hiện và gợi ý ghép lot lẻ chưa lên kệ hoặc ở sảnh.
            </p>

            <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Ghi chú quy cách</label>
                <textarea
                    name="packaging_specification"
                    disabled={readOnly}
                    rows={4}
                    value={formData.packaging_specification}
                    onChange={handleChange}
                    className={`${inputClass} resize-none`}
                    placeholder="VD: Đóng thùng carton 5 lớp, lót giấy chống ẩm..."
                />
            </div>
        </div>
    )
}
