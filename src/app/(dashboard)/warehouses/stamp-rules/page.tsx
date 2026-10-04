// @ts-nocheck
'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { 
    Stamp, 
    Plus, 
    Search, 
    Edit, 
    Trash2, 
    RefreshCw, 
    CheckCircle2, 
    AlertCircle, 
    ArrowRight, 
    SlidersHorizontal, 
    Smartphone, 
    Sparkles, 
    X, 
    Check, 
    Layers, 
    Calendar, 
    Factory, 
    MapPin, 
    Box, 
    FileText 
} from 'lucide-react'

export interface StampRule {
    id: string
    category: string
    code: string
    name: string
    description?: string | null
    system_code?: string
    is_active: boolean
    sort_order: number
    created_at: string
    updated_at: string
}

export const STAMP_CATEGORIES: Record<string, { 
    label: string
    line: 'line1' | 'line2'
    position: string
    length: string
    description: string
    colorBadge: string
}> = {
    fruit_type: { 
        label: 'Chủng loại trái cây', 
        line: 'line1', 
        position: 'Ký tự 1', 
        length: '1 ký tự', 
        description: 'Loại trái cây thành phẩm cấp đông (Sầu riêng, Mít, Dưa hấu, Nhãn...)',
        colorBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
    },
    freeze_style: { 
        label: 'Hình thức cấp đông', 
        line: 'line1', 
        position: 'Ký tự 2, 3', 
        length: '2 ký tự', 
        description: 'Nguyên trái, múi, cắt lát...',
        colorBadge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
    },
    variety: { 
        label: 'Giống trái cây', 
        line: 'line1', 
        position: 'Ký tự 4, 5', 
        length: '2 ký tự', 
        description: 'Monthong (Dona), Ri-6, Musang King...',
        colorBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    },
    product_grade: { 
        label: 'Phân loại thành phẩm', 
        line: 'line1', 
        position: 'Ký tự 6, 7', 
        length: '2 ký tự', 
        description: 'Loại VIP, Loại A, Loại B, Loại C...',
        colorBadge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
    },
    package_spec: { 
        label: 'Quy cách đóng gói', 
        line: 'line1', 
        position: 'Ký tự 8, 9', 
        length: '2 ký tự', 
        description: 'Số lượng túi trong 1 thùng (1 túi/thùng, 4 túi/thùng...)',
        colorBadge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800'
    },
    freeze_method: { 
        label: 'Phương pháp cấp đông', 
        line: 'line1', 
        position: 'Ký tự 10, 11, 12', 
        length: '3 ký tự', 
        description: 'Hầm đông, Nitơ, IQF...',
        colorBadge: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800'
    },
    customer_quality: { 
        label: 'Chất lượng theo khách hàng', 
        line: 'line1', 
        position: 'Ký tự 14', 
        length: '1 ký tự', 
        description: 'Không phân chia (0), hoặc theo tiêu chuẩn riêng của từng khách hàng',
        colorBadge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
    },
    factory: { 
        label: 'Mã nhà máy', 
        line: 'line2', 
        position: 'Ký tự 1 (F)', 
        length: '1 ký tự', 
        description: 'Mã định danh nhà máy chế biến (1: Bến Tre, 2: Đắk Lắk...)',
        colorBadge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
    },
    supplier: { 
        label: 'Mã nhà cung cấp', 
        line: 'line2', 
        position: 'Ký tự 12, 13, 14 (XXX)', 
        length: '3 ký tự', 
        description: 'Mã hóa nhà cung cấp nguyên liệu theo danh sách được duyệt (001, 002, 047...)',
        colorBadge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800'
    },
    province: { 
        label: 'Vùng nguyên liệu (Tỉnh)', 
        line: 'line2', 
        position: 'Ký tự 15, 16 (ZZ)', 
        length: '2 ký tự', 
        description: 'Mã hóa các đơn vị hành chính cấp tỉnh (66: Đắk Lắk, 71: Bến Tre...)',
        colorBadge: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
    }
}

export default function StampRulesPage() {
    const { showToast } = useToast()
    const [rules, setRules] = useState<StampRule[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedLine, setSelectedLine] = useState<'all' | 'line1' | 'line2'>('all')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')

    // Simulator states
    const [simLine1, setSimLine1] = useState('102010204001-0')
    const [simLine2, setSimLine2] = useState('2120908092600166')

    // Modal Create / Edit states
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<StampRule | null>(null)
    const [formCategory, setFormCategory] = useState<string>('fruit_type')
    const [formCode, setFormCode] = useState('')
    const [formName, setFormName] = useState('')
    const [formDesc, setFormDesc] = useState('')
    const [formSortOrder, setFormSortOrder] = useState('1')
    const [isSaving, setIsSaving] = useState(false)

    // Fetch rules from Supabase
    const fetchRules = useCallback(async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('stamp_dictionaries')
                .select('*')
                .order('category', { ascending: true })
                .order('sort_order', { ascending: true })
                .order('code', { ascending: true })

            if (error) throw error
            setRules(data || [])
        } catch (err: any) {
            console.error('Lỗi khi tải quy tắc dấu đóng:', err)
            showToast('Không thể tải danh mục quy tắc: ' + err.message, 'error')
        } finally {
            setIsLoading(false)
        }
    }, [showToast])

    useEffect(() => {
        fetchRules()
    }, [fetchRules])

    // Filter rules
    const filteredRules = useMemo(() => {
        return rules.filter(r => {
            const catInfo = STAMP_CATEGORIES[r.category]
            if (selectedLine === 'line1' && catInfo?.line !== 'line1') return false
            if (selectedLine === 'line2' && catInfo?.line !== 'line2') return false
            if (selectedCategory !== 'all' && r.category !== selectedCategory) return false

            if (!searchTerm.trim()) return true
            const q = searchTerm.toLowerCase().trim()
            return (
                r.code.toLowerCase().includes(q) ||
                r.name.toLowerCase().includes(q) ||
                (r.description || '').toLowerCase().includes(q) ||
                (catInfo?.label || '').toLowerCase().includes(q)
            )
        })
    }, [rules, selectedLine, selectedCategory, searchTerm])

    // Fast dictionary map for simulator & display
    const dictMap = useMemo(() => {
        const map: Record<string, Record<string, string>> = {}
        rules.forEach(r => {
            if (!map[r.category]) map[r.category] = {}
            map[r.category][r.code.toUpperCase()] = r.name
        })
        return map
    }, [rules])

    // Simulator decoding
    const decodedSimulation = useMemo(() => {
        // Line 1: 102010204001-0 (clean dashes)
        const clean1 = simLine1.trim().replace(/\s+/g, '')
        let l1Info: any = null
        if (clean1.length >= 13) {
            // Char 1: fruit_type
            const cFruit = clean1.substring(0, 1)
            // Char 2,3: freeze_style
            const cStyle = clean1.substring(1, 3)
            // Char 4,5: variety
            const cVariety = clean1.substring(3, 5)
            // Char 6,7: grade
            const cGrade = clean1.substring(5, 7)
            // Char 8,9: spec
            const cSpec = clean1.substring(7, 9)
            // Char 10,11,12: method
            const cMethod = clean1.substring(9, 12)
            // Quality char after dash or at end
            const dashIdx = clean1.indexOf('-')
            const cQuality = dashIdx !== -1 ? clean1.substring(dashIdx + 1, dashIdx + 2) : clean1.substring(13, 14)

            l1Info = {
                fruit: dictMap['fruit_type']?.[cFruit] || `Mã ${cFruit} (Chưa cấu hình)`,
                style: dictMap['freeze_style']?.[cStyle] || `Mã ${cStyle} (Chưa cấu hình)`,
                variety: dictMap['variety']?.[cVariety] || `Mã ${cVariety} (Chưa cấu hình)`,
                grade: dictMap['product_grade']?.[cGrade] || `Mã ${cGrade} (Chưa cấu hình)`,
                spec: dictMap['package_spec']?.[cSpec] || `Mã ${cSpec} (Chưa cấu hình)`,
                method: dictMap['freeze_method']?.[cMethod] || `Mã ${cMethod} (Chưa cấu hình)`,
                quality: dictMap['customer_quality']?.[cQuality] || (cQuality ? `Mã ${cQuality}` : 'Tiêu chuẩn chung')
            }
        }

        // Line 2: 2120908092600166 (16 digits)
        const clean2 = simLine2.trim().replace(/[^0-9]/g, '')
        let l2Info: any = null
        if (clean2.length >= 16) {
            const cFactory = clean2.substring(0, 1)
            const dd = clean2.substring(1, 3)
            const mm = clean2.substring(3, 5)
            const DD = clean2.substring(5, 7)
            const MM = clean2.substring(7, 9)
            const YY = clean2.substring(9, 11)
            const cSupplier = clean2.substring(11, 14)
            const cProvince = clean2.substring(14, 16)

            l2Info = {
                factory: dictMap['factory']?.[cFactory] || `Nhà máy ${cFactory}`,
                pkgDate: `${dd}/${mm}`,
                inboundDate: `${DD}/${MM}/20${YY}`,
                supplier: dictMap['supplier']?.[cSupplier] || `Nhà cung cấp mã ${cSupplier}`,
                province: dictMap['province']?.[cProvince] || `Tỉnh mã ${cProvince}`
            }
        }

        return { l1Info, l2Info }
    }, [simLine1, simLine2, dictMap])

    // Open Create Modal
    const handleOpenCreate = (cat?: string) => {
        setEditingRule(null)
        setFormCategory(cat || selectedCategory !== 'all' ? (cat || selectedCategory) : 'fruit_type')
        setFormCode('')
        setFormName('')
        setFormDesc('')
        setFormSortOrder('1')
        setIsModalOpen(true)
    }

    // Open Edit Modal
    const handleOpenEdit = (rule: StampRule) => {
        setEditingRule(rule)
        setFormCategory(rule.category)
        setFormCode(rule.code)
        setFormName(rule.name)
        setFormDesc(rule.description || '')
        setFormSortOrder(String(rule.sort_order || 1))
        setIsModalOpen(true)
    }

    // Save Rule (Insert or Update)
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formCode.trim() || !formName.trim()) {
            showToast('Vui lòng nhập đầy đủ mã và diễn giải', 'warning')
            return
        }

        setIsSaving(true)
        try {
            const payload: any = {
                category: formCategory,
                code: formCode.trim().toUpperCase(),
                name: formName.trim(),
                description: formDesc.trim() || null,
                sort_order: parseInt(formSortOrder, 10) || 0,
                updated_at: new Date().toISOString()
            }

            if (editingRule) {
                const { error } = await supabase
                    .from('stamp_dictionaries')
                    .update(payload)
                    .eq('id', editingRule.id)
                if (error) throw error
                showToast(`Đã cập nhật quy tắc "${payload.code}" thành công`, 'success')
            } else {
                const { error } = await supabase
                    .from('stamp_dictionaries')
                    .insert([payload])
                if (error) throw error
                showToast(`Đã thêm mới quy tắc "${payload.code}" thành công`, 'success')
            }

            setIsModalOpen(false)
            fetchRules()
        } catch (err: any) {
            console.error('Lỗi khi lưu quy tắc:', err)
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    // Delete Rule
    const handleDelete = async (rule: StampRule) => {
        const confirmed = window.confirm(`Bạn có chắc muốn xóa mã quy ước "${rule.code} - ${rule.name}" không?`)
        if (!confirmed) return

        try {
            const { error } = await supabase
                .from('stamp_dictionaries')
                .delete()
                .eq('id', rule.id)

            if (error) throw error
            showToast(`Đã xóa quy tắc ${rule.code}`, 'success')
            setRules(prev => prev.filter(r => r.id !== rule.id))
        } catch (err: any) {
            console.error('Lỗi khi xóa quy tắc:', err)
            showToast('Không thể xóa: ' + err.message, 'error')
        }
    }

    // Toggle Active State
    const handleToggleActive = async (rule: StampRule) => {
        try {
            const newActive = !rule.is_active
            const { error } = await supabase
                .from('stamp_dictionaries')
                .update({ is_active: newActive, updated_at: new Date().toISOString() })
                .eq('id', rule.id)

            if (error) throw error
            setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: newActive } : r))
            showToast(`Đã ${newActive ? 'bật' : 'tắt'} kích hoạt mã ${rule.code}`, 'success')
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        }
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {/* 1. Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 shrink-0 mt-0.5">
                        <Stamp size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                                Cấu Hình Quy Tắc Dấu Đóng
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                {rules.length} quy tắc sẵn sàng
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
                            Quản lý bộ từ điển giải mã dấu mực đóng trên thùng kraft: <strong className="text-slate-800 dark:text-slate-200">Dòng 1 (14 ký tự phân cấp SP)</strong> và <strong className="text-slate-800 dark:text-slate-200">Dòng 2 (16 số truy xuất nguồn gốc)</strong>. Điện thoại sẽ tải từ điển này để tự động giải mã tức thì trong kho lạnh.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={fetchRules}
                        disabled={isLoading}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        title="Tải lại dữ liệu"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => handleOpenCreate()}
                        className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-purple-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                        <Plus size={16} />
                        Thêm quy tắc mới
                    </button>
                </div>
            </div>

            {/* 2. Live Simulator (Bộ Thử Nghiệm Giải Mã Dấu Đóng) */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white border border-indigo-900/50 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between gap-3 border-b border-indigo-800/40 pb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles size={18} className="text-amber-400" />
                            <h3 className="font-bold text-sm sm:text-base text-white">
                                Bộ Kiểm Tra & Thử Nghiệm Giải Mã Dấu Đóng (Live Simulator)
                            </h3>
                        </div>
                        <span className="text-[11px] font-mono text-indigo-300 bg-indigo-900/60 px-2.5 py-0.5 rounded-full border border-indigo-700/50">
                            Offline Engine Ready
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Input Dòng 1 */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-indigo-200 flex items-center justify-between">
                                <span>Dòng 1: Phân cấp & Quy cách (14 ký tự)</span>
                                <span className="font-mono text-[10px] text-indigo-400">Ví dụ: 102010204001-0</span>
                            </label>
                            <input
                                type="text"
                                value={simLine1}
                                onChange={(e) => setSimLine1(e.target.value)}
                                placeholder="102010204001-0"
                                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-indigo-700/50 font-mono font-bold text-sm text-amber-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                        </div>

                        {/* Input Dòng 2 */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-indigo-200 flex items-center justify-between">
                                <span>Dòng 2: Truy xuất & Nguồn gốc (16 chữ số)</span>
                                <span className="font-mono text-[10px] text-indigo-400">Ví dụ: 2120908092600166</span>
                            </label>
                            <input
                                type="text"
                                value={simLine2}
                                onChange={(e) => setSimLine2(e.target.value)}
                                placeholder="2120908092600166"
                                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-indigo-700/50 font-mono font-bold text-sm text-emerald-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                        </div>
                    </div>

                    {/* Result Output */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {/* Kết quả Dòng 1 */}
                        <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-indigo-800/40 space-y-1.5 text-xs">
                            <div className="font-bold text-amber-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                                <Box size={13} /> Kết quả giải mã Dòng 1:
                            </div>
                            {decodedSimulation.l1Info ? (
                                <div className="space-y-1 text-slate-200">
                                    <div>• <span className="text-slate-400">Chủng loại:</span> <strong className="text-white">{decodedSimulation.l1Info.fruit}</strong></div>
                                    <div>• <span className="text-slate-400">Hình thức:</span> <strong className="text-white">{decodedSimulation.l1Info.style}</strong></div>
                                    <div>• <span className="text-slate-400">Giống trái cây:</span> <strong className="text-amber-300">{decodedSimulation.l1Info.variety}</strong></div>
                                    <div>• <span className="text-slate-400">Phân loại phẩm cấp:</span> <strong className="text-emerald-300">{decodedSimulation.l1Info.grade}</strong></div>
                                    <div>• <span className="text-slate-400">Quy cách:</span> <strong className="text-white">{decodedSimulation.l1Info.spec}</strong></div>
                                    <div>• <span className="text-slate-400">Phương pháp:</span> <strong className="text-white">{decodedSimulation.l1Info.method}</strong></div>
                                    <div>• <span className="text-slate-400">Chất lượng:</span> <strong className="text-indigo-300">{decodedSimulation.l1Info.quality}</strong></div>
                                </div>
                            ) : (
                                <p className="text-slate-400 italic">Vui lòng nhập đủ tối thiểu 13 ký tự để giải mã.</p>
                            )}
                        </div>

                        {/* Kết quả Dòng 2 */}
                        <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-indigo-800/40 space-y-1.5 text-xs">
                            <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                                <Factory size={13} /> Kết quả giải mã Dòng 2:
                            </div>
                            {decodedSimulation.l2Info ? (
                                <div className="space-y-1 text-slate-200">
                                    <div>• <span className="text-slate-400">Nhà máy chế biến:</span> <strong className="text-rose-300">{decodedSimulation.l2Info.factory}</strong></div>
                                    <div>• <span className="text-slate-400">Ngày đóng gói:</span> <strong className="text-white">{decodedSimulation.l2Info.pkgDate}</strong></div>
                                    <div>• <span className="text-slate-400">Ngày nhập nguyên liệu:</span> <strong className="text-white">{decodedSimulation.l2Info.inboundDate}</strong></div>
                                    <div>• <span className="text-slate-400">Nhà cung cấp:</span> <strong className="text-orange-300">{decodedSimulation.l2Info.supplier}</strong></div>
                                    <div>• <span className="text-slate-400">Vùng nguyên liệu (Tỉnh):</span> <strong className="text-teal-300">{decodedSimulation.l2Info.province}</strong></div>
                                </div>
                            ) : (
                                <p className="text-slate-400 italic">Vui lòng nhập đủ 16 chữ số để giải mã.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Toolbar & Filters */}
            <div className="space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Tabs Lọc theo Dòng 1 / Dòng 2 */}
                    <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs shrink-0 self-start">
                        <button
                            onClick={() => { setSelectedLine('all'); setSelectedCategory('all'); }}
                            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                                selectedLine === 'all'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            Tất cả ({rules.length})
                        </button>
                        <button
                            onClick={() => { setSelectedLine('line1'); setSelectedCategory('all'); }}
                            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                                selectedLine === 'line1'
                                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            Dòng 1: Quy cách ({rules.filter(r => STAMP_CATEGORIES[r.category]?.line === 'line1').length})
                        </button>
                        <button
                            onClick={() => { setSelectedLine('line2'); setSelectedCategory('all'); }}
                            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                                selectedLine === 'line2'
                                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            Dòng 2: Nguồn gốc ({rules.filter(r => STAMP_CATEGORIES[r.category]?.line === 'line2').length})
                        </button>
                    </div>

                    {/* Tìm kiếm */}
                    <div className="relative flex-1 max-w-md">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm theo mã số quy ước, tên giải mã, mô tả..."
                            className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-200 shadow-2xs"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Sub-pills: Lọc theo từng danh mục cụ thể */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all border ${
                            selectedCategory === 'all'
                                ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                    >
                        Tất cả danh mục
                    </button>
                    {Object.entries(STAMP_CATEGORIES)
                        .filter(([catKey, cat]) => selectedLine === 'all' || cat.line === selectedLine)
                        .map(([catKey, cat]) => {
                            const count = rules.filter(r => r.category === catKey).length
                            const isSelected = selectedCategory === catKey
                            return (
                                <button
                                    key={catKey}
                                    onClick={() => setSelectedCategory(catKey)}
                                    className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                                        isSelected
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-purple-300'
                                    }`}
                                >
                                    <span>{cat.label}</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-purple-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                        {count}
                                    </span>
                                </button>
                            )
                        })}
                </div>
            </div>

            {/* 4. Table of Rules */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                        <RefreshCw className="text-purple-600 animate-spin" size={32} />
                        <p className="text-xs font-semibold text-slate-500">Đang tải danh mục quy tắc...</p>
                    </div>
                ) : filteredRules.length === 0 ? (
                    <div className="text-center py-16 px-4 space-y-3">
                        <AlertCircle className="text-slate-300 dark:text-slate-700 mx-auto" size={40} />
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Không tìm thấy quy tắc nào</h4>
                        <p className="text-xs text-slate-400">Không có quy tắc nào khớp với bộ lọc hoặc từ khóa tìm kiếm.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    <th className="px-4 py-3.5">Danh mục phân cấp</th>
                                    <th className="px-4 py-3.5">Vị trí ký tự</th>
                                    <th className="px-4 py-3.5 text-center">Ký hiệu / Mã</th>
                                    <th className="px-4 py-3.5">Diễn giải tiếng Việt</th>
                                    <th className="px-4 py-3.5">Mô tả chi tiết</th>
                                    <th className="px-4 py-3.5 text-center">Trạng thái</th>
                                    <th className="px-4 py-3.5 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150/70 dark:divide-slate-800/70">
                                {filteredRules.map((rule) => {
                                    const catInfo = STAMP_CATEGORIES[rule.category]
                                    return (
                                        <tr 
                                            key={rule.id}
                                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                                        >
                                            {/* Danh mục */}
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${catInfo?.colorBadge || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                    {catInfo?.label || rule.category}
                                                </span>
                                            </td>

                                            {/* Vị trí */}
                                            <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                {catInfo ? (
                                                    <span>
                                                        <strong className="text-slate-700 dark:text-slate-300">{catInfo.line === 'line1' ? 'Dòng 1' : 'Dòng 2'}</strong> • {catInfo.position}
                                                    </span>
                                                ) : '---'}
                                            </td>

                                            {/* Ký hiệu / Mã */}
                                            <td className="px-4 py-3 text-center">
                                                <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-2xs">
                                                    {rule.code}
                                                </span>
                                            </td>

                                            {/* Tên giải mã */}
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                                    {rule.name}
                                                </div>
                                            </td>

                                            {/* Mô tả */}
                                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                                {rule.description || '---'}
                                            </td>

                                            {/* Trạng thái */}
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleToggleActive(rule)}
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                                                        rule.is_active
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                            : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                                    }`}
                                                >
                                                    {rule.is_active ? 'Kích hoạt' : 'Tạm ẩn'}
                                                </button>
                                            </td>

                                            {/* Thao tác */}
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                                                    <button
                                                        onClick={() => handleOpenEdit(rule)}
                                                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg transition-colors cursor-pointer"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(rule)}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 5. Modal Thêm / Chỉnh Sửa Quy Tắc */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150 space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-3">
                            <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                                <Stamp size={18} className="text-purple-600" />
                                {editingRule ? 'Chỉnh Sửa Quy Tắc Dấu Đóng' : 'Thêm Mới Quy Tắc Dấu Đóng'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4">
                            {/* Chọn Danh mục */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Danh mục phân cấp <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formCategory}
                                    onChange={(e) => setFormCategory(e.target.value)}
                                    disabled={!!editingRule}
                                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    {Object.entries(STAMP_CATEGORIES).map(([key, cat]) => (
                                        <option key={key} value={key}>
                                            [{cat.line === 'line1' ? 'Dòng 1' : 'Dòng 2'}] {cat.label} ({cat.position})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400">
                                    {STAMP_CATEGORIES[formCategory]?.description}
                                </p>
                            </div>

                            {/* Mã quy ước & Tên giải mã */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Mã số <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formCode}
                                        onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                                        placeholder="vd: 01, 001"
                                        required
                                        className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                    <span className="text-[10px] text-slate-400">
                                        Độ dài: {STAMP_CATEGORIES[formCategory]?.length}
                                    </span>
                                </div>

                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Tên / Diễn giải tiếng Việt <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="vd: Cấp đông múi, Monthong..."
                                        required
                                        className="w-full px-3 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>

                            {/* Mô tả chi tiết */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Mô tả thêm / Tiêu chuẩn áp dụng (Tùy chọn)
                                </label>
                                <textarea
                                    value={formDesc}
                                    onChange={(e) => setFormDesc(e.target.value)}
                                    placeholder="Ghi chú thêm về tiêu chuẩn hoặc văn bản quy định..."
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            {/* Thứ tự sắp xếp */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Thứ tự hiển thị
                                </label>
                                <input
                                    type="number"
                                    value={formSortOrder}
                                    onChange={(e) => setFormSortOrder(e.target.value)}
                                    min="0"
                                    className="w-24 px-3 py-1.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-150 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {isSaving ? (
                                        <>
                                            <RefreshCw size={12} className="animate-spin" />
                                            Đang lưu...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            {editingRule ? 'Lưu cập nhật' : 'Thêm quy tắc'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
