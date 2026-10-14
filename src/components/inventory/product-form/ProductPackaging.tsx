import { Box, Info } from 'lucide-react'

interface ProductPackagingProps {
    formData: any
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    readOnly: boolean
    inputClass: string
    units?: any[]
}

const fieldBase =
    "h-10 px-3 text-sm outline-none transition-all duration-200 bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:z-10"

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <label className="text-sm font-medium text-stone-600 flex items-center gap-1">
                {label}
                {hint && (
                    <span title={hint} className="text-stone-400 hover:text-orange-500 cursor-help">
                        <Info size={13} />
                    </span>
                )}
            </label>
            <div className="min-w-0">{children}</div>
        </div>
    )
}

export function ProductPackaging({ formData, handleChange, readOnly, inputClass, units = [] }: ProductPackagingProps) {
    const palletUnit = formData.pallet_unit || formData.unit || ''

    return (
        <div className="bg-white rounded-2xl p-5 space-y-3 border border-stone-200">
            <h2 className="font-semibold text-base text-stone-800 pb-2.5 border-b border-stone-200 flex items-center gap-2">
                <Box size={18} className="text-orange-500" />
                Quy cách đóng gói
            </h2>

            <Row label="SL / Pallet" hint="Dùng để tự động phát hiện và gợi ý ghép lot lẻ chưa lên kệ hoặc ở sảnh.">
                {readOnly ? (
                    <div className="text-sm text-stone-800 font-medium">
                        {formData.quantity_per_pallet ? `${formData.quantity_per_pallet} ${palletUnit}` : '--'}
                    </div>
                ) : (
                    <div className="flex">
                        <input
                            type="number"
                            name="quantity_per_pallet"
                            min={0}
                            value={formData.quantity_per_pallet || ''}
                            onChange={handleChange}
                            className={`${fieldBase} relative w-full min-w-0 rounded-l-lg`}
                            placeholder="VD: 30"
                        />
                        <select
                            name="pallet_unit"
                            value={formData.pallet_unit || ''}
                            onChange={handleChange}
                            className={`${fieldBase} relative -ml-px w-32 shrink-0 rounded-r-lg bg-white`}
                            title="Đơn vị Pallet"
                        >
                            <option value="">{formData.unit ? `${formData.unit} (mặc định)` : 'Đơn vị cơ bản'}</option>
                            {units.map((u: any) => u.name !== formData.unit && (
                                <option key={u.id} value={u.name}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </Row>

            <Row label="Thùng / Cont" hint="Tổng số lượng thùng xuất bán tiêu chuẩn cho 1 container.">
                {readOnly ? (
                    <div className="text-sm text-stone-800 font-medium">
                        {formData.boxes_per_container ? `${formData.boxes_per_container} thùng` : '--'}
                    </div>
                ) : (
                    <div className="relative">
                        <input
                            type="number"
                            name="boxes_per_container"
                            min={0}
                            value={formData.boxes_per_container || ''}
                            onChange={handleChange}
                            className={`${fieldBase} w-full rounded-lg pr-14`}
                            placeholder="VD: 1500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none z-20">
                            thùng
                        </span>
                    </div>
                )}
            </Row>

            <div className="pt-1">
                <label className="block text-sm font-medium text-stone-600 mb-1.5">Ghi chú quy cách</label>
                {readOnly ? (
                    <div className="text-sm text-stone-800 whitespace-pre-wrap">{formData.packaging_specification || '--'}</div>
                ) : (
                    <textarea
                        name="packaging_specification"
                        rows={2}
                        value={formData.packaging_specification || ''}
                        onChange={handleChange}
                        className={`${inputClass} text-sm !p-2.5 !rounded-lg resize-y`}
                        placeholder="VD: Đóng thùng carton 5 lớp, lót giấy chống ẩm..."
                    />
                )}
            </div>
        </div>
    )
}
