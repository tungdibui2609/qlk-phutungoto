'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Tag, Trash2, ChevronRight, RefreshCw } from 'lucide-react'
import { TagDisplay } from '@/components/lots/TagDisplay'

import { useSystem } from '@/contexts/SystemContext'

export default function LotCodesPage() {
    const { systemType } = useSystem()
    const [loading, setLoading] = useState(false)
    const [masterTags, setMasterTags] = useState<{ name: string, created_at: string }[]>([])
    const [usageTags, setUsageTags] = useState<string[]>([]) // From usage
    const [searchTerm, setSearchTerm] = useState('')
    const [newTag, setNewTag] = useState('')
    const [creating, setCreating] = useState(false)

    const loadData = async () => {
        setLoading(true)
        try {
            const [masterRes, usageRes] = await Promise.all([
                fetch(`/api/lot-tags/master?systemCode=${systemType}`).then(r => r.json()),
                fetch('/api/lot-tags?all=1').then(r => r.json())
            ])

            if (masterRes.ok && Array.isArray(masterRes.tags)) {
                setMasterTags(masterRes.tags)
            }
            if (usageRes.ok && Array.isArray(usageRes.uniqueTags)) {
                setUsageTags(usageRes.uniqueTags)
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
                    systemCode: systemType
                })
            })
            if (res.ok) {
                setNewTag('')
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

    // Merge and filter
    const displayedTags = useMemo(() => {
        const all = new Set<string>()
        masterTags.forEach(t => all.add(t.name))
        usageTags.forEach(t => all.add(t))

        // Remove empty or placeholder
        all.delete('@')
        all.delete('')

        const list = Array.from(all).sort()
        if (!searchTerm.trim()) return list

        return list.filter(t => t.includes(searchTerm.toUpperCase()))
    }, [masterTags, usageTags, searchTerm])

    return (
        <section className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                        Quản lý Mã Phụ
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Danh sách các mã phụ (Tags) dùng để phân loại LOT.
                    </p>
                </div>
                <button
                    onClick={loadData}
                    className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition"
                >
                    <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Create Box */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-4">
                    Thêm Mã Mới (Nguyên liệu)
                </h3>
                <div className="flex gap-3 max-w-md">
                    <input
                        value={newTag}
                        onChange={e => setNewTag(e.target.value.toUpperCase())}
                        placeholder="VD: CONT1"
                        className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-sm uppercase focus:ring-2 focus:ring-emerald-500"
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    />
                    <button
                        onClick={handleCreate}
                        disabled={!newTag.trim() || creating}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {creating ? '...' : <Plus size={20} />}
                    </button>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                    Tạo các mã đơn lẻ (Master Tags) để sử dụng khi xây dựng chuỗi mã phụ cho Lot. Ví dụ: <code>CONT1</code>, <code>KHU_A</code>...
                </p>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 bg-zinc-50/50 dark:bg-zinc-800/20">
                    <Search size={18} className="text-zinc-400" />
                    <input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Tìm kiếm mã..."
                        className="bg-transparent border-none focus:ring-0 text-sm w-full"
                    />
                </div>

                {loading && displayedTags.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">Đang tải...</div>
                ) : (
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {displayedTags.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">Chưa có mã phụ nào.</div>
                        ) : (
                            displayedTags.map(tag => {
                                const isMaster = masterTags.some(m => m.name === tag)
                                return (
                                    <div key={tag} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                                        <div className="flex items-center gap-3">
                                            <TagDisplay tags={[tag]} />
                                            {!isMaster && (
                                                <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200">
                                                    Từ LOT
                                                </span>
                                            )}
                                        </div>
                                        {isMaster && (
                                            <button
                                                onClick={() => handleDelete(tag)}
                                                className="p-2 text-zinc-400 hover:text-rose-500 transition"
                                                title="Xóa khỏi danh sách Master"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}
            </div>
        </section>
    )
}
