import { Database } from '@/lib/database.types'
import { Edit, Trash2, Phone, Mail, MapPin, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

type Supplier = Database['public']['Tables']['suppliers']['Row']

interface MobileSupplierListProps {
    suppliers: Supplier[]
    onDelete: (id: string) => void
}

export default function MobileSupplierList({ suppliers, onDelete }: MobileSupplierListProps) {
    if (suppliers.length === 0) {
        return (
            <div className="p-8 text-center text-stone-500 bg-white rounded-2xl border border-stone-200">
                <p>Chưa có nhà cung cấp nào</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {suppliers.map((supplier) => (
                <div key={supplier.id} className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-4">
                    {/* Header: Code & Status */}
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="font-mono text-xs font-medium bg-stone-100 text-stone-600 px-2 py-1 rounded">
                                {supplier.code}
                            </span>
                            <h3 className="font-bold text-stone-800 mt-1 text-lg">{supplier.name}</h3>
                        </div>
                        <div>
                            {supplier.is_active ? (
                                <CheckCircle size={18} className="text-green-500" />
                            ) : (
                                <XCircle size={18} className="text-stone-400" />
                            )}
                        </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-sm text-stone-600">
                        {supplier.contact_person && (
                            <div className="flex items-center gap-2">
                                <span className="font-medium">LH:</span> {supplier.contact_person}
                            </div>
                        )}

                        {(supplier.phone || supplier.email) && (
                            <div className="flex flex-wrap gap-3 mt-1">
                                {supplier.phone && (
                                    <a href={`tel:${supplier.phone}`} className="flex items-center gap-1.5 text-stone-600 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-100 hover:border-orange-200 hover:text-orange-600 transition-colors">
                                        <Phone size={14} />
                                        <span>{supplier.phone}</span>
                                    </a>
                                )}
                                {supplier.email && (
                                    <a href={`mailto:${supplier.email}`} className="flex items-center gap-1.5 text-stone-600 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-100 hover:border-orange-200 hover:text-orange-600 transition-colors">
                                        <Mail size={14} />
                                        <span className="truncate max-w-[150px]">{supplier.email}</span>
                                    </a>
                                )}
                            </div>
                        )}

                        {supplier.address && (
                            <div className="flex items-start gap-2 text-xs text-stone-500 pt-1">
                                <MapPin size={14} className="mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{supplier.address}</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 mt-3 border-t border-stone-100 flex gap-3">
                        <Link
                            href={`/suppliers/${supplier.id}`}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-stone-600 bg-stone-50 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                        >
                            <Edit size={16} />
                            <span>Chỉnh sửa</span>
                        </Link>
                        <button
                            onClick={() => onDelete(supplier.id)}
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
