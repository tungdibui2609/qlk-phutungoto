'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { X, Loader2, Warehouse, Search, UserPlus, Trash2, Users, Check } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'

interface ConstructionTeam {
    id: string
    name: string
    code: string | null
}

interface ConstructionMember {
    id: string
    full_name: string
    phone: string | null
    role: string | null
    team_id: string | null
}

interface CreateAuditModalProps {
    isOpen: boolean
    onClose: () => void
    onCreate: (
        warehouseId: string | null,
        warehouseName: string | null,
        note: string,
        scope: 'ALL' | 'PARTIAL',
        productIds: string[],
        participants: { name: string, role: string }[]
    ) => Promise<any>
}

export function CreateAuditModal({ isOpen, onClose, onCreate }: CreateAuditModalProps) {
    const { currentSystem } = useSystem()
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [warehouses, setWarehouses] = useState<{ id: string, name: string }[]>([])

    // Form State
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
    const [note, setNote] = useState('')
    const [scope, setScope] = useState<'ALL' | 'PARTIAL'>('ALL')

    // Team/Member Selection State
    const [teams, setTeams] = useState<ConstructionTeam[]>([])
    const [selectedTeamId, setSelectedTeamId] = useState<string>('')
    const [teamMembers, setTeamMembers] = useState<ConstructionMember[]>([])
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
    const [loadingTeams, setLoadingTeams] = useState(false)
    const [loadingMembers, setLoadingMembers] = useState(false)

    // Manual participants (fallback)
    const [manualParticipants, setManualParticipants] = useState<{ name: string, role: string }[]>([])
    const [showManualInput, setShowManualInput] = useState(false)

    // Product Search
    const [productSearch, setProductSearch] = useState('')
    const [products, setProducts] = useState<{ id: string, name: string, sku: string }[]>([])
    const [selectedProducts, setSelectedProducts] = useState<{ id: string, name: string, sku: string }[]>([])
    const [searchingProducts, setSearchingProducts] = useState(false)

    useEffect(() => {
        if (isOpen && currentSystem) {
            fetchWarehouses()
            fetchTeams()
        }
    }, [isOpen, currentSystem])

    useEffect(() => {
        if (selectedTeamId) {
            fetchTeamMembers(selectedTeamId)
        } else {
            setTeamMembers([])
            setSelectedMemberIds(new Set())
        }
    }, [selectedTeamId])

    useEffect(() => {
        const timer = setTimeout(() => {
            if (productSearch.trim()) searchProducts(productSearch)
        }, 500)
        return () => clearTimeout(timer)
    }, [productSearch])

    const fetchWarehouses = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('branches')
            .select('id, name, is_default')
            .order('is_default', { ascending: false })
            .order('name')

        if (data) {
            setWarehouses(data)
            // Tự động chọn kho đầu tiên nếu đó là kho mặc định
            if (data.length > 0 && data[0].is_default) {
                setSelectedWarehouseId(data[0].id)
            }
        }
        setLoading(false)
    }

    const fetchTeams = async () => {
        if (!currentSystem?.code) return
        setLoadingTeams(true)
        const { data } = await (supabase
            .from('construction_teams') as any)
            .select('id, name, code')
            .eq('system_code', currentSystem.code)
            .order('name')
        if (data) setTeams(data)
        setLoadingTeams(false)
    }

    const fetchTeamMembers = async (teamId: string) => {
        if (!currentSystem?.code) return
        setLoadingMembers(true)
        const { data } = await (supabase
            .from('construction_members') as any)
            .select('id, full_name, phone, role, team_id')
            .eq('system_code', currentSystem.code)
            .eq('team_id', teamId)
            .eq('is_active', true)
            .order('full_name')
        if (data) {
            setTeamMembers(data)
            // Auto-select all members by default
            setSelectedMemberIds(new Set(data.map((m: ConstructionMember) => m.id)))
        }
        setLoadingMembers(false)
    }

    const toggleMemberSelection = (memberId: string) => {
        setSelectedMemberIds(prev => {
            const newSet = new Set(prev)
            if (newSet.has(memberId)) {
                newSet.delete(memberId)
            } else {
                newSet.add(memberId)
            }
            return newSet
        })
    }

    const searchProducts = async (q: string) => {
        if (!q.trim()) {
            setProducts([])
            return
        }
        setSearchingProducts(true)
        let query = supabase
            .from('products')
            .select('id, name, sku')
            .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
            .limit(10)

        if (currentSystem?.code) {
            query = query.eq('system_type', currentSystem.code)
        }

        const { data } = await query

        if (data) setProducts(data)
        setSearchingProducts(false)
    }

    const addProduct = (prod: { id: string, name: string, sku: string }) => {
        if (!selectedProducts.find(p => p.id === prod.id)) {
            setSelectedProducts([...selectedProducts, prod])
        }
        setProductSearch('')
        setProducts([])
    }

    const removeProduct = (id: string) => {
        setSelectedProducts(selectedProducts.filter(p => p.id !== id))
    }

    const updateManualParticipant = (index: number, field: 'name' | 'role', value: string) => {
        const newPart = [...manualParticipants]
        newPart[index] = { ...newPart[index], [field]: value }
        setManualParticipants(newPart)
    }

    const addManualParticipant = () => {
        setManualParticipants([...manualParticipants, { name: '', role: 'Kiểm kê viên' }])
        setShowManualInput(true)
    }

    const removeManualParticipant = (index: number) => {
        setManualParticipants(manualParticipants.filter((_, i) => i !== index))
        if (manualParticipants.length <= 1) {
            setShowManualInput(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)

        let whName = null
        if (selectedWarehouseId) {
            const wh = warehouses.find(w => w.id === selectedWarehouseId)
            if (wh) whName = wh.name
        }

        // Combine team members + manual participants
        const teamParticipants = teamMembers
            .filter(m => selectedMemberIds.has(m.id))
            .map(m => ({ name: m.full_name, role: m.role || 'Kiểm kê viên' }))

        const manualFiltered = manualParticipants.filter(p => p.name.trim() !== '')

        const allParticipants = [...teamParticipants, ...manualFiltered]

        await onCreate(
            selectedWarehouseId || null,
            whName,
            note,
            scope,
            selectedProducts.map(p => p.id),
            allParticipants
        )
        setSubmitting(false)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 rounded-t-3xl shrink-0">
                    <h3 className="font-bold text-lg">Tạo phiếu kiểm kê mới</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="p-6 space-y-6 overflow-y-auto flex-1">
                        {/* 1. Scope & Warehouse */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Kho kiểm kê</label>
                                <select
                                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                    value={selectedWarehouseId}
                                    onChange={e => setSelectedWarehouseId(e.target.value)}
                                >
                                    <option value="">Tất cả kho</option>
                                    {warehouses.map(wh => (
                                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Phạm vi sản phẩm</label>
                                <select
                                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                    value={scope}
                                    onChange={e => setScope(e.target.value as any)}
                                >
                                    <option value="ALL">Toàn bộ sản phẩm</option>
                                    <option value="PARTIAL">Tùy chọn sản phẩm</option>
                                </select>
                            </div>
                        </div>

                        {/* 2. Tổ kiểm kê - Team Selection */}
                        <div className="space-y-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <Users size={16} className="text-blue-600" />
                                    Tổ kiểm kê
                                </label>
                                <button
                                    type="button"
                                    onClick={addManualParticipant}
                                    className="text-xs text-orange-600 font-bold flex items-center gap-1 hover:underline"
                                >
                                    <UserPlus size={14} /> Thêm thủ công
                                </button>
                            </div>

                            {/* Team Dropdown */}
                            <div className="space-y-2">
                                <label className="text-xs text-slate-500">Chọn đội thi công</label>
                                <select
                                    className="w-full h-10 px-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                    value={selectedTeamId}
                                    onChange={e => setSelectedTeamId(e.target.value)}
                                    disabled={loadingTeams}
                                >
                                    <option value="">-- Không chọn đội --</option>
                                    {teams.map(team => (
                                        <option key={team.id} value={team.id}>
                                            {team.name} {team.code ? `(${team.code})` : ''}
                                        </option>
                                    ))}
                                </select>
                                {loadingTeams && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Loader2 size={12} className="animate-spin" /> Đang tải danh sách đội...
                                    </div>
                                )}
                            </div>

                            {/* Team Members with Checkboxes */}
                            {selectedTeamId && (
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-500">Thành viên của đội</label>
                                    {loadingMembers ? (
                                        <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
                                            <Loader2 size={12} className="animate-spin" /> Đang tải thành viên...
                                        </div>
                                    ) : teamMembers.length > 0 ? (
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                            {teamMembers.map(member => (
                                                <div
                                                    key={member.id}
                                                    onClick={() => toggleMemberSelection(member.id)}
                                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${selectedMemberIds.has(member.id)
                                                        ? 'bg-blue-100 dark:bg-blue-800/40 border border-blue-300 dark:border-blue-600'
                                                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300'
                                                        }`}
                                                >
                                                    <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${selectedMemberIds.has(member.id)
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600'
                                                        }`}>
                                                        {selectedMemberIds.has(member.id) && <Check size={14} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
                                                            {member.full_name}
                                                        </div>
                                                        <div className="text-xs text-slate-500 truncate">
                                                            {member.role || 'Kiểm kê viên'} {member.phone ? `• ${member.phone}` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-400 italic py-2">
                                            Đội này chưa có thành viên nào
                                        </div>
                                    )}
                                    <div className="text-xs text-blue-600 font-medium">
                                        Đã chọn {selectedMemberIds.size}/{teamMembers.length} thành viên
                                    </div>
                                </div>
                            )}

                            {/* Manual Participants Fallback */}
                            {(showManualInput || manualParticipants.length > 0) && (
                                <div className="space-y-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                                    <label className="text-xs text-slate-500">Thêm người thủ công</label>
                                    {manualParticipants.map((p, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input
                                                className="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800"
                                                placeholder="Họ tên"
                                                value={p.name}
                                                onChange={e => updateManualParticipant(idx, 'name', e.target.value)}
                                            />
                                            <input
                                                className="w-1/3 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800"
                                                placeholder="Chức vụ"
                                                value={p.role}
                                                onChange={e => updateManualParticipant(idx, 'role', e.target.value)}
                                            />
                                            <button type="button" onClick={() => removeManualParticipant(idx)} className="text-slate-400 hover:text-red-500">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Empty State */}
                            {!selectedTeamId && manualParticipants.length === 0 && (
                                <div className="text-xs text-slate-400 italic text-center py-2">
                                    Chọn đội hoặc thêm thành viên thủ công để tạo tổ kiểm kê
                                </div>
                            )}
                        </div>

                        {/* 3. Product Selection (If Partial) */}
                        {scope === 'PARTIAL' && (
                            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Chọn sản phẩm</label>
                                <div className="relative">
                                    <input
                                        className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
                                        placeholder="Tìm kiếm sản phẩm..."
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                    />
                                    <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                                    {searchingProducts && <Loader2 size={16} className="absolute right-3 top-2.5 animate-spin text-orange-500" />}

                                    {products.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                                            {products.map(p => (
                                                <div
                                                    key={p.id}
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm"
                                                    onClick={() => addProduct(p)}
                                                >
                                                    <span className="font-bold">{p.sku}</span> - {p.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Selected List */}
                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                    {selectedProducts.map(p => (
                                        <div key={p.id} className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                            <span>{p.sku}</span>
                                            <button type="button" onClick={() => removeProduct(p.id)} className="hover:text-red-500"><X size={12} /></button>
                                        </div>
                                    ))}
                                    {selectedProducts.length === 0 && <span className="text-xs text-slate-400 italic">Chưa chọn sản phẩm nào</span>}
                                </div>
                            </div>
                        )}

                        {/* Ghi chú */}
                        <div className="space-y-2 pt-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ghi chú</label>
                            <textarea
                                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none"
                                rows={2}
                                placeholder="Nhập lý do kiểm kê, ghi chú..."
                                value={note}
                                onChange={e => setNote(e.target.value)}
                            />
                        </div>

                    </div>

                    {/* Sticky Footer */}
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 rounded-b-3xl shrink-0">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Tạo phiếu kiểm kê'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
