import { Database } from '@/lib/database.types'
import { Edit, Trash2, Phone, Mail, MapPin, CheckCircle, XCircle, Building2 } from 'lucide-react'
import Link from 'next/link'

interface Customer {
    id: string
    code: string
    name: string
    contact_person: string | null
    phone: string | null
    email: string | null
    address: string | null
    is_active: boolean | null
    created_at: string | null
}

interface MobileCustomerListProps {
    customers: Customer[]
    onDelete: (id: string) => void
}

export default function MobileCustomerList({ customers, onDelete }: MobileCustomerListProps) {
    if (customers.length === 0) {
        return (
            <div className="p-8 text-center text-stone-500 bg-white rounded-2xl border border-stone-200">
                <p>Chưa có khách hàng nào</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {customers.map((customer) => (
                <div key={customer.id} className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-4">
                    {/* Header: Code & Status */}
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="font-mono text-xs font-medium bg-stone-100 text-stone-600 px-2 py-1 rounded">
                                {customer.code}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                                    <Building2 size={12} className="text-orange-600" />
                                </div>
                                <h3 className="font-bold text-stone-800 text-lg leading-tight">{customer.name}</h3>
                            </div>
                        </div>
                        <div>
                            {customer.is_active ? (
                                <CheckCircle size={18} className="text-green-500" />
                            ) : (
                                <XCircle size={18} className="text-stone-400" />
                            )}
                        </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-sm text-stone-600">
                        {customer.contact_person && (
                            <div className="flex items-center gap-2">
                                <span className="font-medium">LH:</span> {customer.contact_person}
                            </div>
                        )}

                        {(customer.phone || customer.email) && (
                            <div className="flex flex-wrap gap-3 mt-1">
                                {customer.phone && (
                                    <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-stone-600 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-100 hover:border-orange-200 hover:text-orange-600 transition-colors">
                                        <Phone size={14} />
                                        <span>{customer.phone}</span>
                                    </a>
                                )}
                                {customer.email && (
                                    <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 text-stone-600 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-100 hover:border-orange-200 hover:text-orange-600 transition-colors">
                                        <Mail size={14} />
                                        <span className="truncate max-w-[150px]">{customer.email}</span>
                                    </a>
                                )}
                            </div>
                        )}

                        {customer.address && (
                            <div className="flex items-start gap-2 text-xs text-stone-500 pt-1">
                                <MapPin size={14} className="mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{customer.address}</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 mt-3 border-t border-stone-100 flex gap-3">
                        <Link
                            href={`/customers/${customer.id}`}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-stone-600 bg-stone-50 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                        >
                            <Edit size={16} />
                            <span>Chỉnh sửa</span>
                        </Link>
                        <button
                            onClick={() => onDelete(customer.id)}
                            className="flex items-center justify-center p-2.5 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}
