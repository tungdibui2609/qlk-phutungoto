import { Combobox } from '@/components/ui/Combobox'
import { OrderSection } from './OrderSection'

interface Partner {
    id: string
    name: string
    address?: string | null
    phone?: string | null
}

interface PartnerSelectProps {
    type: 'supplier' | 'customer'
    label: string
    partners: Partner[]
    selectedId: string
    onSelect: (id: string | null) => void
    address: string
    setAddress: (v: string) => void
    phone: string
    setPhone: (v: string) => void
    partnerName?: string // For customer autosuggest or display
    setPartnerName?: (v: string) => void // For free text customer name
}

export function PartnerSelect({
    type, label, partners, selectedId, onSelect,
    address, setAddress, phone, setPhone,
    partnerName, setPartnerName
}: PartnerSelectProps) {
    const color = type === 'supplier' ? 'bg-blue-500' : 'bg-blue-500'

    return (
        <OrderSection title={`Thông tin ${label.toLowerCase()}`} color={color}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-medium text-stone-500 dark:text-gray-400">
                        {label} <span className="text-red-500">*</span>
                    </label>
                    <Combobox
                        options={partners.map(p => ({ value: p.id, label: p.name }))}
                        value={selectedId}
                        onChange={onSelect}
                        onSearchChange={setPartnerName} // Only useful for Customer where we allow manual input sometimes
                        placeholder={`Chọn ${label.toLowerCase()}`}
                        className="w-full"
                        allowCustom={!!setPartnerName} // Allow custom text for customers
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Địa chỉ</label>
                    <input
                        type="text"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Địa chỉ..."
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Số điện thoại</label>
                    <input
                        type="text"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="SĐT..."
                    />
                </div>
            </div>
        </OrderSection>
    )
}
