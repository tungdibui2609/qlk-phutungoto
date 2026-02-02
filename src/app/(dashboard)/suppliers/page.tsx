'use client'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Building2, Phone, Mail, Edit, Trash2, Search } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import MobileSupplierList from '@/components/suppliers/MobileSupplierList'
import Protected from '@/components/auth/Protected'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import { useListingData } from '@/hooks/useListingData'
import Link from 'next/link'

type Supplier = Database['public']['Tables']['suppliers']['Row']

export default function SuppliersPage() {
    const { showToast, showConfirm } = useToast()

    const {
        filteredData: filteredSuppliers,
        loading,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        refresh,
        data: allSuppliers
    } = useListingData<Supplier>('suppliers', {
        orderBy: { column: 'name' }
    })

    async function deleteSupplier(id: string) {
        if (!await showConfirm('Bạn có chắc muốn xóa nhà cung cấp này?')) return

        const { error } = await supabase.from('suppliers').delete().eq('id', id)
        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast('Đã xóa nhà cung cấp thành công', 'success')
            refresh()
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Nhà cung cấp"
                subtitle="Suppliers"
                description="Quản lý danh sách nhà cung cấp phụ tùng"
                icon={Building2}
                actionLink="/suppliers/new"
                actionText="Thêm mới"
                permission="partner.manage"
            />

            {/* FILTERS */}
            <div className="bg-white rounded-[24px] p-5 border border-stone-200 flex flex-col md:flex-row flex-wrap gap-4 md:items-center shadow-sm">
                <div className="relative flex-1 w-full md:min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm theo tên, mã, số điện thoại, ghi chú..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all font-medium"
                    />
                </div>
                <div className="flex gap-2 p-1 bg-stone-100 rounded-2xl">
                    {(['all', 'active', 'inactive'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${statusFilter === f
                                ? 'bg-white text-orange-600 shadow-sm'
                                : 'text-stone-500 hover:text-stone-700'
                                }`}
                        >
                            {f === 'all' ? 'Tất cả' : f === 'active' ? 'Hoạt động' : 'Ngừng'}
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENT */}
            {loading ? (
                <div className="bg-white rounded-[32px] border border-stone-200 p-20 text-center shadow-sm">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">Đang tải dữ liệu...</p>
                </div>
            ) : filteredSuppliers.length === 0 ? (
                <EmptyState
                    icon={Building2}
                    title="Chưa có nhà cung cấp nào"
                    description={searchTerm ? `Không tìm thấy kết quả nào khớp với "${searchTerm}"` : "Hãy bắt đầu bằng cách thêm nhà cung cấp đầu tiên của bạn."}
                />
            ) : (
                <>
                    {/* MOBILE LIST */}
                    <div className="md:hidden">
                        <MobileSupplierList suppliers={filteredSuppliers} onDelete={deleteSupplier} />
                    </div>

                    {/* DESKTOP TABLE */}
                    <div className="hidden md:block bg-white rounded-[32px] border border-stone-200 overflow-hidden shadow-sm">
                        <table className="w-full">
                            <thead className="bg-stone-50/50 border-b border-stone-200">
                                <tr>
                                    <th className="text-left px-6 py-5 text-xs font-black uppercase tracking-widest text-stone-400">Mã</th>
                                    <th className="text-left px-6 py-5 text-xs font-black uppercase tracking-widest text-stone-400">Nhà cung cấp</th>
                                    <th className="text-left px-6 py-5 text-xs font-black uppercase tracking-widest text-stone-400">Liên hệ</th>
                                    <th className="text-left px-6 py-5 text-xs font-black uppercase tracking-widest text-stone-400">SĐT</th>
                                    <th className="text-center px-6 py-5 text-xs font-black uppercase tracking-widest text-stone-400">Trạng thái</th>
                                    <th className="text-center px-6 py-5 text-xs font-black uppercase tracking-widest text-stone-400">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {filteredSuppliers.map((supplier) => (
                                    <tr key={supplier.id} className="group hover:bg-orange-50/30 transition-colors">
                                        <td className="px-6 py-5">
                                            <span className="font-mono text-xs font-bold bg-stone-100 text-stone-600 px-2.5 py-1 rounded-lg border border-stone-200">
                                                {supplier.code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="font-bold text-stone-800 text-base">{supplier.name}</div>
                                            {supplier.email && (
                                                <div className="text-xs text-stone-500 font-medium flex items-center gap-1.5 mt-1">
                                                    <Mail size={12} className="text-stone-400" />
                                                    {supplier.email}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-stone-600 font-medium">
                                            {supplier.contact_person || '-'}
                                        </td>
                                        <td className="px-6 py-5">
                                            {supplier.phone ? (
                                                <span className="flex items-center gap-1.5 text-stone-600 font-bold">
                                                    <Phone size={14} className="text-stone-400" />
                                                    {supplier.phone}
                                                </span>
                                            ) : (
                                                <span className="text-stone-300 font-bold">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <StatusBadge isActive={supplier.is_active} />
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Protected permission="partner.manage">
                                                    <Link
                                                        href={`/suppliers/${supplier.id}`}
                                                        className="p-2.5 rounded-xl text-stone-400 hover:bg-white hover:text-orange-600 hover:shadow-sm border border-transparent hover:border-orange-100 transition-all"
                                                    >
                                                        <Edit size={18} />
                                                    </Link>
                                                    <button
                                                        onClick={() => deleteSupplier(supplier.id)}
                                                        className="p-2.5 rounded-xl text-stone-400 hover:bg-white hover:text-red-600 hover:shadow-sm border border-transparent hover:border-red-100 transition-all"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </Protected>
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
            <div className="flex items-center justify-between px-2">
                <div className="text-[11px] font-black uppercase tracking-widest text-stone-400 bg-stone-100 px-3 py-1 rounded-full">
                    {filteredSuppliers.length} / {allSuppliers.length} Kết quả
                </div>
            </div>
        </div>
    )
}
