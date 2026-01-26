'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Plus, Search, Building2, Phone, Mail, MoreHorizontal, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import MobileSupplierList from '@/components/suppliers/MobileSupplierList'

type Supplier = Database['public']['Tables']['suppliers']['Row']

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const { systemType } = useSystem()
    const { showToast, showConfirm } = useToast()
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

    useEffect(() => {
        fetchSuppliers()
    }, [])

    async function fetchSuppliers() {
        setLoading(true)
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('system_code', systemType)
            .order('name')

        if (data) setSuppliers(data)
        setLoading(false)
    }

    async function deleteSupplier(id: string) {
        if (!await showConfirm('Bạn có chắc muốn xóa nhà cung cấp này?')) return

        const { error } = await supabase.from('suppliers').delete().eq('id', id)
        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast('Đã xóa nhà cung cấp thành công', 'success')
            fetchSuppliers()
        }
    }

    const filteredSuppliers = suppliers.filter(s => {
        const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.phone && s.phone.includes(searchTerm))

        const matchFilter = filterActive === 'all' ||
            (filterActive === 'active' && s.is_active) ||
            (filterActive === 'inactive' && !s.is_active)

        return matchSearch && matchFilter
    })

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-800">Nhà cung cấp</h1>
                    <p className="text-stone-500 text-sm mt-1">Quản lý danh sách nhà cung cấp phụ tùng</p>
                </div>
                <Link
                    href="/suppliers/new"
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                        boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)',
                    }}
                >
                    <Plus size={20} />
                    Thêm mới
                </Link>
            </div>

            {/* FILTERS */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 flex flex-col md:flex-row flex-wrap gap-4 md:items-center">
                <div className="relative flex-1 w-full md:min-w-[250px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm theo tên, mã, SĐT..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                </div>
                <div className="flex gap-2">
                    {(['all', 'active', 'inactive'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilterActive(f)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filterActive === f
                                ? 'bg-orange-500 text-white'
                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                }`}
                        >
                            {f === 'all' ? 'Tất cả' : f === 'active' ? 'Hoạt động' : 'Ngừng'}
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENT */}
            {loading ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-500">
                    Đang tải...
                </div>
            ) : filteredSuppliers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-500">
                    <Building2 className="mx-auto mb-3 opacity-30" size={48} />
                    <p>Chưa có nhà cung cấp nào</p>
                </div>
            ) : (
                <>
                    {/* MOBILE LIST */}
                    <div className="md:hidden">
                        <MobileSupplierList suppliers={filteredSuppliers} onDelete={deleteSupplier} />
                    </div>

                    {/* DESKTOP TABLE */}
                    <div className="hidden md:block bg-white rounded-2xl border border-stone-200 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-stone-50 border-b border-stone-200">
                                <tr>
                                    <th className="text-left px-5 py-4 text-sm font-semibold text-stone-600">Mã</th>
                                    <th className="text-left px-5 py-4 text-sm font-semibold text-stone-600">Nhà cung cấp</th>
                                    <th className="text-left px-5 py-4 text-sm font-semibold text-stone-600">Liên hệ</th>
                                    <th className="text-left px-5 py-4 text-sm font-semibold text-stone-600">SĐT</th>
                                    <th className="text-center px-5 py-4 text-sm font-semibold text-stone-600">Trạng thái</th>
                                    <th className="text-center px-5 py-4 text-sm font-semibold text-stone-600">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {filteredSuppliers.map((supplier) => (
                                    <tr key={supplier.id} className="hover:bg-stone-50 transition-colors">
                                        <td className="px-5 py-4">
                                            <span className="font-mono text-sm bg-stone-100 px-2 py-1 rounded">
                                                {supplier.code}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="font-medium text-stone-800">{supplier.name}</div>
                                            {supplier.email && (
                                                <div className="text-sm text-stone-500 flex items-center gap-1 mt-0.5">
                                                    <Mail size={12} />
                                                    {supplier.email}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-stone-600">
                                            {supplier.contact_person || '-'}
                                        </td>
                                        <td className="px-5 py-4">
                                            {supplier.phone ? (
                                                <span className="flex items-center gap-1 text-stone-600">
                                                    <Phone size={14} />
                                                    {supplier.phone}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            {supplier.is_active ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                    <CheckCircle size={12} />
                                                    Hoạt động
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-500">
                                                    <XCircle size={12} />
                                                    Ngừng
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <Link
                                                    href={`/suppliers/${supplier.id}`}
                                                    className="p-2 rounded-lg text-stone-500 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                                >
                                                    <Edit size={16} />
                                                </Link>
                                                <button
                                                    onClick={() => deleteSupplier(supplier.id)}
                                                    className="p-2 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* STATS */}
            <div className="text-sm text-stone-500 text-right">
                Hiển thị {filteredSuppliers.length} / {suppliers.length} nhà cung cấp
            </div>
        </div>
    )
}
