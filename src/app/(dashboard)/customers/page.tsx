'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { Plus, Search, Users, Edit, Trash2, Phone, Mail, Building2 } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'

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

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([])
    const { systemType } = useSystem()
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

    useEffect(() => {
        fetchCustomers()
    }, [])

    async function fetchCustomers() {
        setLoading(true)
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('system_code', systemType)
            .order('name')

        if (data) setCustomers(data)
        setLoading(false)
    }

    async function deleteCustomer(id: string) {
        if (!confirm('Bạn có chắc muốn xóa khách hàng này?')) return

        const { error } = await supabase.from('customers').delete().eq('id', id)
        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            fetchCustomers()
        }
    }

    const filteredCustomers = customers.filter(c => {
        const matchesSearch =
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.phone && c.phone.includes(searchTerm))

        const matchesFilter =
            filterActive === 'all' ||
            (filterActive === 'active' && c.is_active) ||
            (filterActive === 'inactive' && !c.is_active)

        return matchesSearch && matchesFilter
    })

    return (
        <div className="space-y-5">
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-stone-800">Khách hàng</h1>
                    <p className="text-stone-500 text-xs mt-0.5">Quản lý danh sách khách hàng, garage, đại lý</p>
                </div>
                <Link
                    href="/customers/new"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                        boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                    }}
                >
                    <Plus size={16} />
                    Thêm mới
                </Link>
            </div>

            {/* SEARCH & FILTER */}
            <div className="bg-white rounded-xl p-4 border border-stone-200 flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <input
                        type="text"
                        placeholder="Tìm theo tên, mã, SĐT..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                </div>
                <div className="flex gap-1">
                    {(['all', 'active', 'inactive'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterActive(status)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterActive === status
                                ? 'bg-orange-100 text-orange-600'
                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                }`}
                        >
                            {status === 'all' ? 'Tất cả' : status === 'active' ? 'Hoạt động' : 'Ngừng'}
                        </button>
                    ))}
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-stone-500 text-sm">Đang tải...</div>
                ) : filteredCustomers.length === 0 ? (
                    <div className="p-8 text-center text-stone-500">
                        <Users className="mx-auto mb-2 opacity-30" size={40} />
                        <p className="text-sm">Chưa có khách hàng nào</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-stone-50 border-b border-stone-200">
                            <tr>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">Mã</th>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">Tên khách hàng</th>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">Liên hệ</th>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">SĐT</th>
                                <th className="text-center px-4 py-3 font-semibold text-stone-600">Trạng thái</th>
                                <th className="text-center px-4 py-3 font-semibold text-stone-600 w-24">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {filteredCustomers.map((customer) => (
                                <tr key={customer.id} className="hover:bg-stone-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded">
                                            {customer.code}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                                                <Building2 size={14} className="text-orange-600" />
                                            </div>
                                            <span className="font-medium text-stone-800">{customer.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-stone-600">
                                        {customer.contact_person || '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {customer.phone ? (
                                            <span className="flex items-center gap-1 text-stone-600">
                                                <Phone size={12} />
                                                {customer.phone}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${customer.is_active
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-stone-100 text-stone-500'
                                            }`}>
                                            {customer.is_active ? 'Hoạt động' : 'Ngừng'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <Link
                                                href={`/customers/${customer.id}`}
                                                className="p-1.5 rounded-lg text-stone-500 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                            >
                                                <Edit size={14} />
                                            </Link>
                                            <button
                                                onClick={() => deleteCustomer(customer.id)}
                                                className="p-1.5 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* STATS */}
            <div className="text-xs text-stone-500 text-right">
                Hiển thị {filteredCustomers.length} / {customers.length} khách hàng
            </div>
        </div>
    )
}
