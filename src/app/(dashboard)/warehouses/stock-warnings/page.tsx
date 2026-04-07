'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
    AlertTriangle, 
    Search, 
    Loader2, 
    Save, 
    Mail, 
    Bell, 
    Settings2, 
    Package, 
    Filter,
    ChevronDown,
    RefreshCw,
    Edit3,
    CheckCircle2,
    XCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { formatQuantityFull } from '@/lib/numberUtils'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'

interface ProductStock {
    id: string
    sku: string
    name: string
    unit: string
    category: string
    current_stock: number
    min_stock_level: number
    critical_stock_level: number
    status: 'ok' | 'warning' | 'critical' | 'out'
}

interface LotData {
    id: string
    product_id: string | null
    quantity: number | null
    lot_items: {
        product_id: string | null
        quantity: number | null
    }[]
}

export default function StockWarningsPage() {
    const { systemType, systems, refreshSystems } = useSystem()
    const { showToast } = useToast()
    
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [products, setProducts] = useState<ProductStock[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState<'all' | 'warning'>('all')
    
    // Email Config State
    const [emails, setEmails] = useState<string>('')
    const [isEditingEmails, setIsEditingEmails] = useState(false)

    // Current System Info
    const currentSystem = useMemo(() => systems.find(s => s.code === systemType), [systems, systemType])

    // Fetch Emails from System Config
    useEffect(() => {
        if (currentSystem?.modules) {
            const modules = currentSystem.modules as any
            if (modules.stock_warning_emails) {
                setEmails(Array.isArray(modules.stock_warning_emails) ? modules.stock_warning_emails.join(', ') : modules.stock_warning_emails)
            }
        }
    }, [currentSystem])

    const fetchStockData = async () => {
        setLoading(true)
        try {
            // 1. Fetch Products - Sử dụng SELECT * để đảm bảo lấy đủ các cột mới thêm
            const { data: prodData, error: prodError } = await supabase
                .from('products' as any)
                .select(`
                    *,
                    categories (id, name)
                `)
                .eq('system_type', systemType)
                .eq('is_active', true)
                .order('sku')

            if (prodError) {
                console.error('Lỗi truy vấn sản phẩm:', prodError)
                throw new Error(`Lỗi bảng Sản phẩm: ${prodError.message}`)
            }

            // 2. Fetch Lots & Items
            const { data: lotData, error: lotError } = await supabase
                .from('lots' as any)
                .select(`
                    id,
                    product_id,
                    quantity,
                    lot_items (
                        product_id,
                        quantity
                    )
                `)
                .eq('system_code', systemType)
                .eq('status', 'active')

            if (lotError) {
                console.error('Lỗi truy vấn LOT:', lotError)
                throw new Error(`Lỗi bảng LOT: ${lotError.message}`)
            }

            const typedLotData = (lotData || []) as unknown as LotData[]

            // 3. Aggregate stock
            const stockMap = new Map<string, number>()
            
            typedLotData.forEach(lot => {
                if (lot.lot_items && lot.lot_items.length > 0) {
                    lot.lot_items.forEach((item) => {
                        if (!item.product_id) return
                        stockMap.set(item.product_id, (stockMap.get(item.product_id) || 0) + (item.quantity || 0))
                    })
                } else if (lot.product_id) {
                    stockMap.set(lot.product_id, (stockMap.get(lot.product_id) || 0) + (lot.quantity || 0))
                }
            })

            // 4. Combine
            const transformed: ProductStock[] = (prodData || []).map((p: any) => {
                const current = stockMap.get(p.id) || 0
                const min2 = p.min_stock_level || 0
                const min1 = p.critical_stock_level || 0
                let status: 'ok' | 'warning' | 'critical' | 'out' = 'ok'
                
                if (current <= 0) status = 'out'
                else if (current <= min1) status = 'critical'
                else if (current <= min2) status = 'warning'
                
                return {
                    id: p.id,
                    sku: p.sku,
                    name: p.name,
                    unit: p.unit || 'Cái',
                    category: (p.categories as any)?.name || 'Chưa phân loại',
                    current_stock: current,
                    min_stock_level: min2,
                    critical_stock_level: min1,
                    status
                }
            })

            setProducts(transformed)
        } catch (error: any) {
            console.error('Lỗi fetchStockData:', error)
            showToast(error.message || 'Lỗi tải dữ liệu', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStockData()
    }, [systemType])

    const handleUpdateLevel = async (productId: string, field: 'min_stock_level' | 'critical_stock_level', val: number) => {
        try {
            const { error } = await supabase
                .from('products' as any)
                // @ts-ignore
                .update({ [field]: val } as any)
                .eq('id', productId)

            if (error) throw error
            
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    const newP = { ...p, [field]: val }
                    const current = newP.current_stock
                    const m1 = newP.critical_stock_level
                    const m2 = newP.min_stock_level
                    
                    let status: 'ok' | 'warning' | 'critical' | 'out' = 'ok'
                    if (current <= 0) status = 'out'
                    else if (current <= m1) status = 'critical'
                    else if (current <= m2) status = 'warning'
                    
                    return { ...newP, status }
                }
                return p
            }))
            
            showToast(`Đã cập nhật ${field === 'critical_stock_level' ? 'Mức 1 (Báo động)' : 'Mức 2 (Chuẩn bị)'}`, 'success')
        } catch (error: any) {
            showToast('Lỗi cập nhật: ' + error.message, 'error')
        }
    }

    const saveEmailConfig = async () => {
        if (!currentSystem) return
        setSaving(true)
        try {
            const emailList = emails.split(',').map(e => e.trim()).filter(e => e.length > 0)
            
            const currentModules = currentSystem.modules as any || {}
            const updatedModules = {
                ...currentModules,
                stock_warning_emails: emailList
            }

            const { error } = await supabase
                .from('systems' as any)
                // @ts-ignore
                .update({ modules: updatedModules } as any)
                .eq('code', systemType)

            if (error) throw error
            
            await refreshSystems()
            setIsEditingEmails(false)
            showToast('Đã lưu cấu hình email nhận cảnh báo', 'success')
        } catch (error: any) {
            showToast('Lỗi lưu cấu hình email: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                p.name.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesStatus = filterStatus === 'all' || p.status !== 'ok'
            return matchesSearch && matchesStatus
        })
    }, [products, searchTerm, filterStatus])

    const stats = useMemo(() => {
        return {
            total: products.length,
            warning: products.filter(p => p.status === 'warning').length,
            critical: products.filter(p => p.status === 'critical' || p.status === 'out').length
        }
    }, [products])

    return (
        <div className="h-full flex flex-col space-y-6 p-4 md:p-8 pt-6 bg-stone-50/50 dark:bg-stone-950/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-3">
                        <div className="p-2 bg-orange-500 rounded-2xl shadow-lg shadow-orange-500/20 text-white">
                            <AlertTriangle size={28} />
                        </div>
                        Cảnh báo tồn kho
                    </h2>
                    <p className="text-stone-500 dark:text-stone-400 font-medium ml-14 -mt-1">
                        Quản lý ngưỡng tồn tối thiểu và cấu hình thông báo
                    </p>
                </div>
                
                <div className="flex gap-2 ml-14 md:ml-0">
                    <button 
                        onClick={fetchStockData}
                        className="p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl text-stone-600 hover:text-orange-600 transition-all active:scale-95 shadow-sm"
                        title="Làm mới dữ liệu"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="h-12 w-[1px] bg-stone-200 dark:bg-stone-800 mx-2 hidden md:block" />
                    <div className="bg-white dark:bg-stone-900 p-2 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-1">
                        <button 
                            onClick={() => setFilterStatus('all')}
                            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${filterStatus === 'all' ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-md' : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'}`}
                        >
                            Tất cả ({stats.total})
                        </button>
                        <button 
                            onClick={() => setFilterStatus('warning')}
                            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${filterStatus === 'warning' ? 'bg-rose-500 text-white shadow-md shadow-rose-200' : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'}`}
                        >
                            Cảnh báo ({stats.warning + stats.critical})
                        </button>
                    </div>
                </div>
            </div>

            {/* Email Config Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[32px] p-8 text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000" />
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-white/20 backdrop-blur-xl rounded-2xl border border-white/20">
                            <Mail size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tight">Cấu hình Email nhận cảnh báo</h3>
                            <p className="text-indigo-100 text-sm font-medium opacity-80">Thông báo sẽ được gửi ngay lập tức tới các địa chỉ này</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            {isEditingEmails ? (
                                <div className="space-y-2">
                                    <input 
                                        type="text"
                                        value={emails}
                                        onChange={(e) => setEmails(e.target.value)}
                                        placeholder="Nhập email, cách nhau bằng dấu phẩy (vd: k1@gmail.com, k2@gmail.com)"
                                        className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-md"
                                    />
                                    <p className="text-[10px] text-white/60 ml-2 italic">Hỗ trợ nhận thông báo qua Outlook, Gmail, v.v.</p>
                                </div>
                            ) : (
                                <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 backdrop-blur-sm min-h-[50px] flex items-center">
                                    {emails ? (
                                        <div className="flex flex-wrap gap-2">
                                            {emails.split(',').map((email, i) => (
                                                <span key={i} className="px-3 py-1 bg-white/20 rounded-lg text-xs font-bold border border-white/10">
                                                    {email.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-white/40 italic text-sm">Chưa có email nào được cấu hình...</span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="shrink-0 flex items-start gap-2">
                            {isEditingEmails ? (
                                <>
                                    <button 
                                        onClick={saveEmailConfig}
                                        disabled={saving}
                                        className="bg-white text-indigo-600 font-black px-6 py-3 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/10 flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                        Lưu lại
                                    </button>
                                    <button 
                                        onClick={() => setIsEditingEmails(false)}
                                        className="bg-white/10 text-white font-bold px-4 py-3 rounded-2xl hover:bg-white/20 transition-all"
                                    >
                                        Hủy
                                    </button>
                                </>
                            ) : (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={async () => {
                                            if (products.length === 0) return
                                            setSaving(true)
                                            try {
                                                const response = await fetch('/api/stock-alerts', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ 
                                                        productIds: products.map(p => p.id), 
                                                        systemCode: systemType,
                                                        isManual: true
                                                    })
                                                })
                                                const result = await response.json()
                                                if (result.success) {
                                                    showToast('Đã gửi báo cáo tồn kho thực tế qua Email!', 'success')
                                                } else {
                                                    throw new Error(result.error || 'Lỗi không xác định')
                                                }
                                            } catch (error: any) {
                                                showToast('Lỗi gửi báo cáo: ' + error.message, 'error')
                                            } finally {
                                                setSaving(false)
                                            }
                                        }}
                                        disabled={saving || products.length === 0}
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 group/btn disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 size={20} className="animate-spin" /> : <Mail size={20} className="group-hover:-translate-y-1 transition-transform" />}
                                        Gửi báo cáo ngay
                                    </button>
                                    <button 
                                        onClick={() => setIsEditingEmails(true)}
                                        className="bg-white/20 hover:bg-white/30 text-white font-black px-6 py-3 rounded-2xl border border-white/20 transition-all flex items-center gap-2 group/btn"
                                    >
                                        <Edit3 size={20} className="group-hover:rotate-12 transition-transform" />
                                        Cấu hình
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Table Content */}
            <div className="bg-white dark:bg-stone-900 rounded-[32px] border border-stone-200 dark:border-stone-800 shadow-xl shadow-stone-200/50 dark:shadow-none overflow-hidden flex flex-col min-h-0">
                <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input 
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm mã SKU hoặc tên sản phẩm..."
                            className="w-full bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        />
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            <span className="text-xs font-bold text-stone-500">Đủ hàng</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                            <span className="text-xs font-bold text-stone-500">Sắp hết</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                            <span className="text-xs font-bold text-stone-500">Đã hết</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-stone-50/50 dark:bg-stone-800/50 text-stone-400 font-black text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="px-8 py-4 w-1/3">Sản Phẩm</th>
                                <th className="px-6 py-4">ĐVT / Phân loại</th>
                                <th className="px-6 py-4 text-right">Tồn hiện tại</th>
                                <th className="px-6 py-4 text-center">Mức 1<br/><span className="text-[9px] text-rose-400">Báo động</span></th>
                                <th className="px-6 py-4 text-center">Mức 2<br/><span className="text-[9px] text-amber-500">Chuẩn bị</span></th>
                                <th className="px-6 py-4 text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50 dark:divide-stone-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="animate-spin text-orange-500" size={40} />
                                            <span className="text-stone-400 font-bold">Đang tải dữ liệu tồn kho...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <Package size={60} className="text-stone-300" />
                                            <span className="text-stone-500 font-bold">Không tìm thấy sản phẩm nào!</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((p) => (
                                    <tr 
                                        key={p.id} 
                                        className={`group transition-all hover:bg-stone-50/50 dark:hover:bg-stone-800/30 ${p.status !== 'ok' ? 'bg-orange-50/10' : ''}`}
                                    >
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-black text-stone-900 dark:text-stone-100 group-hover:text-orange-600 transition-colors uppercase tracking-tight">{p.name}</span>
                                                <span className="text-[11px] font-bold text-stone-400 uppercase">{p.sku}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col items-center">
                                                <span className="text-sm font-bold text-stone-600">{p.unit}</span>
                                                <span className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-[9px] font-bold text-stone-400 mt-1">{p.category}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className={`text-lg font-black tabular-nums ${p.status === 'out' || p.status === 'critical' ? 'text-rose-500 animate-pulse' : p.status === 'warning' ? 'text-amber-500' : 'text-stone-900 dark:text-white'}`}>
                                                {formatQuantityFull(p.current_stock)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-5">
                                            <div className="flex items-center justify-center">
                                                <input 
                                                    type="number"
                                                    defaultValue={p.critical_stock_level}
                                                    onBlur={(e) => {
                                                        const val = parseInt(e.target.value)
                                                        if (!isNaN(val) && val !== p.critical_stock_level) {
                                                            handleUpdateLevel(p.id, 'critical_stock_level', val)
                                                        }
                                                    }}
                                                    className="w-20 bg-rose-50/50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/50 border rounded-xl px-2 py-1 text-right font-black text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20 transition-all text-sm"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-5">
                                            <div className="flex items-center justify-center">
                                                <input 
                                                    type="number"
                                                    defaultValue={p.min_stock_level}
                                                    onBlur={(e) => {
                                                        const val = parseInt(e.target.value)
                                                        if (!isNaN(val) && val !== p.min_stock_level) {
                                                            handleUpdateLevel(p.id, 'min_stock_level', val)
                                                        }
                                                    }}
                                                    className="w-20 bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/50 border rounded-xl px-2 py-1 text-right font-black text-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all text-sm"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-center">
                                                {p.status === 'ok' ? (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                                                        <CheckCircle2 size={14} />
                                                        <span className="text-[10px] font-black uppercase">An toàn</span>
                                                    </div>
                                                ) : p.status === 'warning' ? (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-xl border border-amber-100 dark:border-amber-800/50">
                                                        <AlertTriangle size={14} />
                                                        <span className="text-[10px] font-black uppercase">Mức 2</span>
                                                    </div>
                                                ) : p.status === 'critical' ? (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl border border-rose-100 dark:border-rose-800/50 animate-pulse">
                                                        <AlertTriangle size={14} />
                                                        <span className="text-[10px] font-black uppercase">Mức 1</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-600 text-white rounded-xl shadow-lg shadow-rose-200">
                                                        <XCircle size={14} />
                                                        <span className="text-[10px] font-black uppercase">Đã hết</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Legend / Info Footer */}
                <div className="p-4 bg-stone-50 dark:bg-stone-800/20 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                        <span>Hiển thị {filteredProducts.length} sản phẩm</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
