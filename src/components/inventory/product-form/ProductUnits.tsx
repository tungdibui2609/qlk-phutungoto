import { Scale, X, Plus } from 'lucide-react'
import { QuantityInput } from '@/components/ui/QuantityInput'
import { Database } from '@/lib/database.types'

type Unit = Database['public']['Tables']['units']['Row']

interface ProductUnitsProps {
    formData: any
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    units: Unit[]
    alternativeUnits: { unit_id: string, factor: number, ref_unit_id: string }[]
    addAlternativeUnit: () => void
    removeAlternativeUnit: (index: number) => void
    updateAlternativeUnit: (index: number, field: 'unit_id' | 'factor' | 'ref_unit_id', value: any) => void
    readOnly: boolean
    inputClass: string
}

export function ProductUnits({
    formData,
    handleChange,
    units,
    alternativeUnits,
    addAlternativeUnit,
    removeAlternativeUnit,
    updateAlternativeUnit,
    readOnly,
    inputClass
}: ProductUnitsProps) {
    const baseUnitId = units.find(u => u.name === formData.unit)?.id || ''

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

    return (
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
                        disabled={readOnly}
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
                                disabled={readOnly}
                                value={alt.unit_id}
                                onChange={(e) => updateAlternativeUnit(index, 'unit_id', e.target.value)}
                                className="bg-white border border-stone-300 text-stone-800 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5 disabled:bg-stone-100"
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
                            <QuantityInput
                                value={alt.factor}
                                onChange={(val) => updateAlternativeUnit(index, 'factor', val)}
                                className="bg-white border border-stone-300 text-stone-800 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5 text-center disabled:bg-stone-100"
                                placeholder="Tỉ lệ"
                                readOnly={readOnly}
                            />
                        </div>

                        {/* Reference Unit Select */}
                        <div className="flex-1">
                            <select
                                disabled={readOnly}
                                value={alt.ref_unit_id}
                                onChange={(e) => updateAlternativeUnit(index, 'ref_unit_id', e.target.value)}
                                className="bg-white border border-stone-300 text-stone-800 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5 disabled:bg-stone-100"
                            >
                                {/* Base Unit Option */}
                                {baseUnitId && <option value="">{formData.unit} (Cơ bản)</option>}

                                {/* Other Available Units (Previous definitions) */}
                                {getAvailableRefs(index).filter(r => r.id !== '').map(ref => (
                                    <option key={ref.id} value={ref.id}>{ref.name}</option>
                                ))}
                            </select>
                        </div>

                        {!readOnly && (
                            <button
                                type="button"
                                onClick={() => removeAlternativeUnit(index)}
                                className="p-2 text-stone-400 hover:text-red-500 hover:bg-stone-100 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                ))}
                {!readOnly && (
                    <button
                        type="button"
                        onClick={addAlternativeUnit}
                        className="flex items-center gap-2 text-sm text-orange-600 font-medium hover:text-orange-700 px-2 py-1"
                    >
                        <Plus size={16} />
                        Thêm đơn vị quy đổi
                    </button>
                )}
            </div>
        </div>
    )
}
