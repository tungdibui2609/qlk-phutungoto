'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Trash2, RefreshCw, CheckCircle2, XCircle, Info, Sparkles } from 'lucide-react'
import { TagDisplay } from '@/components/lots/TagDisplay'
import Protected from '@/components/auth/Protected'

import { useSystem } from '@/contexts/SystemContext'

interface MasterTagItem {
    name: string
    created_at: string
    append_to_product_name?: boolean
}

export default function SanxuatLotCodesPage() {
    const { systemType } = useSystem()
    const [loading, setLoading] = useState(false)
    const [masterTags, setMasterTags] = useState<MasterTagItem[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [newTag, setNewTag] = useState('')
    const [newTagAppendToName, setNewTagAppendToName] = useState(false)
    const [creating, setCreating] = useState(false)
    const [updatingTag, setUpdatingTag] = useState<string | null>(null)

    const loadData = async () => {
        setLoading(true)
        try {
            const masterRes = await fetch(`/api/lot-tags/master?systemCode=${systemType}`).then(r => r.json())

            if (masterRes.ok && Array.isArray(masterRes.tags)) {
                setMasterTags(masterRes.tags)
            }
        } catch (e) {
            console.error('Failed to load tags', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [systemType])

    const handleDelete = async (name: string) => {
        if (!confirm(`Xóa mã phụ "${name}"? Việc này sẽ không xóa mã khỏi các LOT đã gắn.`)) return
        try {
            const res = await fetch(`/api/lot-tags/master?name=${encodeURIComponent(name)}&systemCode=${systemType}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                loadData()
            } else {
                alert('Không xóa được')
            }
        } catch {
            alert('Lỗi kết nối')
        }
    }

    const handleCreate = async () => {
        const name = newTag.toUpperCase().trim()
        if (!name) return

        if (masterTags.find(t => t.name === name)) {
            alert('Mã này đã tồn tại')
            return
        }

        setCreating(true)
        try {
            const res = await fetch('/api/lot-tags/master', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    systemCode: systemType,
                    append_to_product_name: newTagAppendToName
                })
            })
            if (res.ok) {
                setNewTag('')
                setNewTagAppendToName(false)
                loadData()
            } else {
                const j = await res.json()
                alert(j.error || 'Lỗi khi tạo')
            }
        } catch {
            alert('Lỗi kết nối')
        } finally {
            setCreating(false)
        }
    }

    const handleToggleAppendToName = async (tagItem: MasterTagItem) => {
        const nextState = !tagItem.append_to_product_name
        setUpdatingTag(tagItem.name)

        // Optimistic update
        setMasterTags(prev => prev.map(t => t.name === tagItem.name ? { ...t, append_to_product_name: nextState } : t))

        try {
            const res = await fetch('/api/lot-tags/master', {
                method: 'PATCH',
                body: JSON.stringify({
                    name: tagItem.name,
                    systemCode: systemType,
                    append_to_product_name: nextState
                })
            })

            if (!res.ok) {
                const j = await res.json()
                alert(j.error || 'Lỗi khi cập nhật cấu hình gắn tên sản phẩm')
                // Revert
                loadData()
            }
        } catch {
            alert('Lỗi kết nối khi cập nhật')
            loadData()
        } finally {
            setUpdatingTag(null)
        }
    }

    // Merge and filter
    const displayedTags = useMemo(() => {
        const list = [...masterTags].sort((a, b) => a.name.localeCompare(b.name))
        if (!searchTerm.trim()) return list

        return list.filter(t => t.name.includes(searchTerm.toUpperCase()))
    }, [masterTags, searchTerm])

    return (
        <section className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                        Quản lý Mã Phụ Sản Xuất
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Danh sách các mã phụ (Tags) dùng để phân loại LOT sản xuất và tùy chọn gắn kèm tên sản phẩm.
                    </p>
                </div>
                <button
                    onClick={loadData}
                    className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition"
                    title="Tải lại danh sách"
                >
                    <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Create Box */}
            <Protected permission="lotcode.manage">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span>Thêm Mã Mới (Nguyên liệu / Nguồn hàng)</span>
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
                        <input
                            value={newTag}
                            onChange={e => setNewTag(e.target.value.toUpperCase())}
                            placeholder="VD: TRUNG HÙNG, CONT1, KHU_A..."
                            className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-sm uppercase focus:ring-2 focus:ring-emerald-500"
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        />
                        <button
                            onClick={handleCreate}
                            disabled={!newTag.trim() || creating}
                            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition shadow-sm"
                        >
                            {creating ? 'Đang thêm...' : (
                                <>
                                    <Plus size={18} />
                                    <span>Thêm Mã</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Toggle gắn tên sản phẩm khi tạo mới */}
                    <div className="mt-3.5 flex items-center gap-2.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-700 dark:text-zinc-300">
                            <input
                                type="checkbox"
                                checked={newTagAppendToName}
                                onChange={e => setNewTagAppendToName(e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700"
                            />
                            <span className="font-medium">Gắn kèm theo tên sản phẩm của LOT</span>
                        </label>
                        {newTag.trim() && newTagAppendToName && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                                VD: Đô Na A ({newTag.trim()})
                            </span>
                        )}
                    </div>

                    <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-500 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-zinc-700 dark:text-zinc-300">
                            <Info size={14} className="text-blue-500" />
                            <span>Quy tắc hiển thị tên sản phẩm theo Mã Phụ:</span>
                        </div>
                        <p>
                            Khi một mã phụ được <b>bật cờ "Gắn kèm tên SP"</b>, bất kỳ LOT nào gắn mã này thì dòng sản phẩm của lô đó sẽ có tên: <code>Tên Sản Phẩm (MÃ_PHỤ)</code>. Toàn bộ các báo cáo tồn kho liên quan đến LOT sẽ tự động phân loại và tách dòng theo tên đã gắn kèm.
                        </p>
                    </div>
                </div>
            </Protected>

            {/* List */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-800/20">
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                        <Search size={18} className="text-zinc-400 shrink-0" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm mã phụ..."
                            className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none"
                        />
                    </div>
                    <div className="text-xs text-zinc-500 font-medium">
                        Tổng số: <span className="font-bold text-zinc-800 dark:text-zinc-200">{displayedTags.length}</span> mã
                    </div>
                </div>

                {loading && displayedTags.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">Đang tải...</div>
                ) : (
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {displayedTags.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">Chưa có mã phụ nào.</div>
                        ) : (
                            displayedTags.map(tagItem => (
                                <div key={tagItem.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition gap-3">
                                    <div className="flex items-center gap-3">
                                        <TagDisplay tags={[tagItem.name]} />
                                        {tagItem.append_to_product_name && (
                                            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                <Sparkles size={11} className="text-emerald-500" />
                                                Gắn kèm: [Tên SP ({tagItem.name})]
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3 self-end sm:self-auto">
                                        <Protected permission="lotcode.manage">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleAppendToName(tagItem)}
                                                disabled={updatingTag === tagItem.name}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                                    tagItem.append_to_product_name
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                                }`}
                                                title={tagItem.append_to_product_name ? 'Bấm để tắt gắn kèm vào tên sản phẩm' : 'Bấm để bật gắn kèm vào tên sản phẩm'}
                                            >
                                                {tagItem.append_to_product_name ? (
                                                    <>
                                                        <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                        <span>Gắn tên SP: BẬT</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <XCircle size={14} className="text-zinc-400 shrink-0" />
                                                        <span>Gắn tên SP: TẮT</span>
                                                    </>
                                                )}
                                            </button>

                                            <button
                                                onClick={() => handleDelete(tagItem.name)}
                                                className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                                                title="Xóa khỏi danh sách Master"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </Protected>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </section>
    )
}
