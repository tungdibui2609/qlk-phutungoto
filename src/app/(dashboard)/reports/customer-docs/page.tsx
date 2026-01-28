'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { FileText, Search, Download, Building2, Loader2 } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'

// Note: This report requires additional tables (invoices, delivery_notes, quotes)
// Currently showing placeholder with instructions

export default function CustomerDocsPage() {
    const { currentSystem } = useSystem()
    const [customers, setCustomers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        if (currentSystem?.code) {
            fetchCustomers()
        }
    }, [currentSystem?.code])

    async function fetchCustomers() {
        if (!currentSystem?.code) return

        setLoading(true)
        const { data } = await supabase
            .from('customers')
            .select('*')
            .eq('is_active', true)
            .or(`system_code.eq.${currentSystem.code},system_code.is.null`)
            .order('name')
        if (data) setCustomers(data)
        setLoading(false)
    }

    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.code.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                        <FileText className="text-orange-500" size={24} />
                        Chứng từ Khách hàng ({currentSystem?.name})
                    </h1>
                    <p className="text-stone-500 text-xs mt-0.5">Quản lý hóa đơn, phiếu xuất, báo giá</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-stone-600 bg-stone-100 border border-stone-200">
                    <Download size={16} /> Xuất báo cáo
                </button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm text-yellow-700">
                    <strong>Lưu ý:</strong> Để quản lý chứng từ chi tiết, cần tạo thêm các bảng:
                </p>
                <ul className="text-sm text-yellow-700 mt-2 list-disc list-inside">
                    <li><code>invoices</code> - Hóa đơn bán hàng</li>
                    <li><code>delivery_notes</code> - Phiếu giao hàng</li>
                    <li><code>quotes</code> - Báo giá</li>
                </ul>
                <p className="text-sm text-yellow-700 mt-2">Hiện tại đang hiển thị danh sách khách hàng.</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 border border-stone-200">
                    <p className="text-xs text-stone-500">Khách hàng hoạt động</p>
                    <p className="text-2xl font-bold text-stone-800">{customers.length}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <p className="text-xs text-blue-600">Hóa đơn</p>
                    <p className="text-xl font-bold text-blue-700">Chưa có dữ liệu</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <p className="text-xs text-green-600">Phiếu xuất</p>
                    <p className="text-xl font-bold text-green-700">Chưa có dữ liệu</p>
                </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-stone-200">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <input type="text" placeholder="Tìm khách hàng..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm focus:outline-none" />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-stone-500 text-sm">Đang tải...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-stone-500">
                        <FileText className="mx-auto mb-2 opacity-30" size={40} />
                        <p className="text-sm">Chưa có khách hàng nào</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-stone-50 border-b border-stone-200">
                            <tr>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">Khách hàng</th>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">Liên hệ</th>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">SĐT</th>
                                <th className="text-center px-4 py-3 font-semibold text-stone-600">Số hóa đơn</th>
                                <th className="text-right px-4 py-3 font-semibold text-stone-600">Tổng giá trị</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {filtered.map(c => (
                                <tr key={c.id} className="hover:bg-stone-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={16} className="text-stone-400" />
                                            <div>
                                                <p className="font-medium text-stone-800">{c.name}</p>
                                                <p className="text-xs text-stone-400">{c.code}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-stone-600">{c.contact_person || '-'}</td>
                                    <td className="px-4 py-3 text-stone-600">{c.phone || '-'}</td>
                                    <td className="px-4 py-3 text-center text-stone-400">-</td>
                                    <td className="px-4 py-3 text-right text-stone-400">-</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
