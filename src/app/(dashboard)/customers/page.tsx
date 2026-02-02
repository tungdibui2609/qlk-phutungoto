'use client'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Users, Phone, Mail, Edit, Trash2, Search, Building2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import MobileCustomerList from '@/components/customers/MobileCustomerList'
import Protected from '@/components/auth/Protected'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import { useListingData } from '@/hooks/useListingData'
import Link from 'next/link'

type Customer = Database['public']['Tables']['customers']['Row']

export default function CustomersPage() {
    const { showToast, showConfirm } = useToast()

    const {
        filteredData: filteredCustomers,
        loading,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        refresh,
        data: allCustomers
    } = useListingData<Customer>('customers', {
        orderBy: { column: 'name' }
    })

    async function deleteCustomer(id: string) {
        if (!await showConfirm('Bạn có chắc muốn xóa khách hàng này?')) return

        const { error } = await supabase.from('customers').delete().eq('id', id)
        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast('Đã xóa khách hàng thành công', 'success')
            refresh()
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Khách hàng"
                subtitle="Customers"
                description="Quản lý danh sách khách hàng, garage, đại lý"
                icon={Users}
                actionLink="/customers/new"
                actionText="Thêm mới"
                permission="partner.manage"
            />

            {/* SEARCH & FILTER */}
            <div className="bg-white rounded-[24px] p-5 border border-stone-200 flex flex-col md:flex-row items-center gap-4 shadow-sm">
                <div className="relative flex-1 w-full md:min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm theo tên, mã, SĐT, ghi chú..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all font-medium"
                    />
                </div>
                <div className="flex gap-1 p-1 bg-stone-100 rounded-2xl w-full md:w-auto">
                    {(['all', 'active', 'inactive'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${statusFilter === status
                                ? 'bg-white text-orange-600 shadow-sm'
                                : 'text-stone-500 hover:text-stone-700'
                                }`}
                        >
                            {status === 'all' ? 'Tất cả' : status === 'active' ? 'Hoạt động' : 'Ngừng'}
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
            ) : filteredCustomers.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="Chưa có khách hàng nào"
                    description={searchTerm ? `Không tìm thấy kết quả nào khớp với "${searchTerm}"` : "Hãy bắt đầu bằng cách thêm khách hàng đầu tiên của bạn."}
                />
            ) : (
                <>
                    {/* MOBILE LIST */}
                    <div className="md:hidden">
                        <MobileCustomerList customers={filteredCustomers} onDelete={deleteCustomer} />
                    </div>

                    {/* DESKTOP TABLE */}
                    <div className="hidden md:block bg-white rounded-[32px] border border-stone-200 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-stone-50/50 border-b border-stone-200">
                                <tr>
                                    <th className="text-left px-6 py-5 text-xs font-black uppercase tracking-widest text-stone-400">Mã</th>
                                    <th className="text-left px-6 py-5 text-xs font-black uppercase tracking-widest text-stone-400">Khách hàng</th>
                                    <th className="text-left px-6 py-5 text-xs font-black uppercase tracking-widest text-stone-400">Liên hệ</th>
                                    <th className="text-left px-6 py-5 text-xs font-black uppercase tracking-widest text-stone-400">SĐT</th>
                                    <th className="text-center px-6 py-5 text-xs font-black uppercase tracking-widest text-stone-400">Trạng thái</th>
                                    <th className="text-center px-6 py-5 text-xs font-black uppercase tracking-widest text-stone-400 w-24">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {filteredCustomers.map((customer) => (
                                    <tr key={customer.id} className="group hover:bg-orange-50/30 transition-colors">
                                        <td className="px-6 py-5">
                                            <span className="font-mono text-xs font-bold bg-stone-100 text-stone-600 px-2.5 py-1 rounded-lg border border-stone-200">
                                                {customer.code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center border border-orange-200/50 shadow-sm shadow-orange-500/10">
                                                    <Building2 size={18} className="text-orange-600" />
                                                </div>
                                                <span className="font-bold text-stone-800 text-base">{customer.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-stone-600 font-medium">
                                            {customer.contact_person || '-'}
                                        </td>
                                        <td className="px-6 py-5">
                                            {customer.phone ? (
                                                <span className="flex items-center gap-1.5 text-stone-600 font-bold">
                                                    <Phone size={14} className="text-stone-400" />
                                                    {customer.phone}
                                                </span>
                                            ) : (
                                                <span className="text-stone-300 font-bold">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <StatusBadge isActive={customer.is_active} />
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Protected permission="partner.manage">
                                                    <Link
                                                        href={`/customers/${customer.id}`}
                                                        className="p-2.5 rounded-xl text-stone-400 hover:bg-white hover:text-orange-600 hover:shadow-sm border border-transparent hover:border-orange-100 transition-all"
                                                    >
                                                        <Edit size={18} />
                                                    </Link>
                                                    <button
                                                        onClick={() => deleteCustomer(customer.id)}
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
                    {filteredCustomers.length} / {allCustomers.length} Kết quả
                </div>
            </div>
        </div>
    )
}
