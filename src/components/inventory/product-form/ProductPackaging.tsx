import { Box } from 'lucide-react'

interface ProductPackagingProps {
    formData: any
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    readOnly: boolean
    inputClass: string
}

export function ProductPackaging({ formData, handleChange, readOnly, inputClass }: ProductPackagingProps) {
    return (
        <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
            <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                <Box size={20} className="text-orange-500" />
                Quy cách đóng gói
            </h2>
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
