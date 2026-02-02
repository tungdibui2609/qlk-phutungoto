'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { X, Plus } from "lucide-react"
import { TagDisplay } from "./TagDisplay"
import { useSystem } from "@/contexts/SystemContext"
import { supabase } from "@/lib/supabaseClient"
import { useToast } from "@/components/ui/ToastProvider"

interface LotTagModalProps {
    lotId: string | null
    lotCodeDisplay?: string
    onClose: () => void
    onSuccess?: () => void
}

type TagEntry = {
    tag: string
    added_at: string
    lot_item_id: string | null
}

export function LotTagModal({ lotId, lotCodeDisplay, onClose, onSuccess }: LotTagModalProps) {
    const [allLotTags, setAllLotTags] = useState<TagEntry[]>([]) // All tags for this lot
    const [existingTags, setExistingTags] = useState<string[]>([]) // All unique tags from system + master
    const [inputValue, setInputValue] = useState("")
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [lotItems, setLotItems] = useState<{ id: string, product_name: string, product_sku: string, unit: string }[]>([])
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const { systemType } = useSystem()
    const { showToast, showConfirm } = useToast()
    // Load Data
    const loadData = useCallback(async () => {
        if (!lotId) return
        setLoading(true)
        try {
            // Fetch lot items
            const lotItemsRes = await supabase
                .from('lot_items')
                .select(`id, products(name, sku, unit), unit, quantity`)
                .eq('lot_id', lotId) as any

            const items = lotItemsRes.data?.map((i: any) => ({
                id: i.id,
                product_name: i.products?.name || 'Unknown',
                product_sku: i.products?.sku || '',
                unit: (i as any).unit || i.products?.unit || '',
            })) || []
            setLotItems(items)

            // Auto select if only 1
            if (items.length === 1 && !selectedItemId) {
                setSelectedItemId(items[0].id)
            }

            const [masterRes, allTagsRes, currentRes] = await Promise.all([
                fetch(`/api/lot-tags/master?systemCode=${systemType}`).then(r => r.json()).catch(() => ({ ok: false })),
                fetch("/api/lot-tags?all=1").then(r => r.json()).catch(() => ({ ok: false })),
                fetch(`/api/lot-tags?lotId=${encodeURIComponent(lotId)}`).then(r => r.json()).catch(() => ({ ok: false }))
            ])

            const allUniqueTags = new Set<string>()

            if (masterRes?.ok && Array.isArray(masterRes.tags)) {
                masterRes.tags.forEach((t: { name: string }) => {
                    if (t.name) allUniqueTags.add(t.name.toUpperCase())
                })
            }

            if (allTagsRes?.ok && Array.isArray(allTagsRes.uniqueTags)) {
                allTagsRes.uniqueTags.forEach((t: string) => {
                    if (t) allUniqueTags.add(t.toUpperCase())
                })
            }

            setExistingTags(Array.from(allUniqueTags).sort())

            if (currentRes?.ok && Array.isArray(currentRes.items)) {
                setAllLotTags(currentRes.items)
            }

        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [lotId, systemType])

    useEffect(() => {
        if (lotId) {
            loadData()
            setInputValue("")
        }
    }, [lotId, loadData])

    // Filter current tags based on selection
    const currentTags = useMemo(() => allLotTags.filter(t => {
        if (selectedItemId) return t.lot_item_id === selectedItemId
        return true
    }).map(t => t.tag), [allLotTags, selectedItemId])

    useEffect(() => {
        const trimmed = inputValue.trim().toUpperCase()

        // Always show top suggestions if empty
        if (!trimmed) {
            setSuggestions(existingTags.slice(0, 10))
            setSelectedIndex(-1)
            return
        }

        const segments = inputValue.split(/>/)
        const lastSegment = segments[segments.length - 1].trim().toUpperCase()
        const endsWithSeparator = />$/.test(inputValue)

        // If waiting for next level, show all tags (top level recommendations)
        if (endsWithSeparator || lastSegment === "") {
            const matches = existingTags.slice(0, 10)
            setSuggestions(matches)
            setSelectedIndex(-1)
            return
        }

        const matches = existingTags.filter(tag =>
            tag.toUpperCase().includes(lastSegment) &&
            !currentTags.includes(inputValue.trim().toUpperCase())
        ).slice(0, 8)

        setSuggestions(matches)
        setSelectedIndex(-1)

    }, [inputValue, existingTags, currentTags])

    const handleAdd = async () => {
        const trimmed = inputValue.trim().toUpperCase()
        if (!trimmed || !lotId) return

        // Validation: Must select item if multiple exist
        if (lotItems.length > 1 && !selectedItemId) {
            showToast("Vui lòng chọn dòng sản phẩm để gán mã", 'warning')
            return
        }

        // Use selected item or the only item
        const targetItemId = selectedItemId || (lotItems.length === 1 ? lotItems[0].id : null)

        if (currentTags.includes(trimmed)) {
            showToast("Mã này đã được gắn rồi", 'warning')
            return
        }

        setSaving(true)
        try {
            // 1. Ensure master tags exist for parts
            const parts = trimmed.split(/>/).map(p => p.trim()).filter(Boolean)
            for (const part of parts) {
                if (part !== '@' && !existingTags.includes(part)) {
                    try {
                        await fetch("/api/lot-tags/master", {
                            method: "POST",
                            body: JSON.stringify({
                                name: part,
                                systemCode: systemType
                            })
                        })
                    } catch { }
                }
            }

            // 2. Add to lot
            const res = await fetch("/api/lot-tags", {
                method: "POST",
                body: JSON.stringify({
                    lotId,
                    tag: trimmed,
                    lotItemId: targetItemId
                })
            })

            const j = await res.json()
            if (j?.ok) {
                // Optimistic update
                const newEntry: TagEntry = {
                    tag: trimmed,
                    added_at: new Date().toISOString(),
                    lot_item_id: targetItemId
                }
                setAllLotTags([...allLotTags, newEntry])

                setInputValue("")
                setShowSuggestions(false)
                // Update existing tags with new parts locally
                setExistingTags(prev => {
                    const newSet = new Set([...prev, ...parts])
                    return Array.from(newSet).sort()
                })
                onSuccess?.()
            } else {
                showToast(j?.error || "Lỗi khi lưu", 'error')
            }

        } catch {
            showToast("Lỗi kết nối", 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleRemove = async (tag: string) => {
        if (!lotId) return
        if (!await showConfirm(`Xóa mã ${tag}?`)) return

        // Find the specific entry to delete
        const targetItemId = selectedItemId || (lotItems.length === 1 ? lotItems[0].id : undefined)

        setSaving(true)
        try {
            let url = `/api/lot-tags?lotId=${encodeURIComponent(lotId)}&tag=${encodeURIComponent(tag)}`
            if (targetItemId) {
                url += `&lotItemId=${encodeURIComponent(targetItemId)}`
            }

            const res = await fetch(url, {
                method: "DELETE"
            })

            if (res.ok) {
                // Remove specific entry
                setAllLotTags(allLotTags.filter(t => !(t.tag === tag && (targetItemId ? t.lot_item_id === targetItemId : true))))
                onSuccess?.()
            }
        } catch {
            showToast("Lỗi kết nối", 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleSelectSuggestion = (suggestion: string) => {
        const segments = inputValue.split(/([>;:])/)
        // segments will be ["CONT1", ">", ""] or ["CONT1"]
        // We want to replace the last token (which might be partial)

        // Find the last actual text segment index
        let lastTextIndex = segments.length - 1;
        // If last segment is a separator, append
        if (segments[lastTextIndex] === '>') {
            setInputValue(inputValue + suggestion)
        } else {
            segments[lastTextIndex] = suggestion
            setInputValue(segments.join(""))
        }

        setShowSuggestions(false)
        inputRef.current?.focus()
    }

    const insertPlaceholder = () => {
        const val = inputValue.trim();
        const suffix = val.endsWith('>') ? '@>' : (val === '' ? '@>' : '>@>');
        setInputValue(val + suffix);
        inputRef.current?.focus();
    }

    if (!lotId) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[600px] max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10">
                    <div>
                        <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100">Gán Mã Phụ</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 font-mono tracking-wider">LOT</span>
                            <p className="text-xs text-slate-500 font-mono">{lotCodeDisplay || lotId}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                        <X size={22} />
                    </button>
                </div>

                {/* Main Content Area: 2 Columns */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Column: Product Selection */}
                    <div className="w-[340px] border-r border-slate-100 dark:border-slate-800 flex flex-col bg-slate-50/30 dark:bg-slate-800/10">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                Danh sách sản phẩm
                            </label>
                            <span className="bg-slate-200/50 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                {lotItems.length}
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {lotItems.length === 0 && !loading && (
                                <div className="text-center py-8 text-slate-400 text-sm italic">
                                    Không có sản phẩm nào
                                </div>
                            )}
                            {lotItems.map(item => {
                                const itemTags = allLotTags.filter(t => t.lot_item_id === item.id);

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedItemId(item.id)}
                                        className={`group p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 ${selectedItemId === item.id
                                            ? "bg-white dark:bg-slate-800 border-orange-500 dark:border-orange-500 shadow-md ring-1 ring-orange-500/20"
                                            : "bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-bold text-sm truncate transition-colors ${selectedItemId === item.id ? "text-orange-600 dark:text-orange-400" : "text-slate-700 dark:text-slate-300 group-hover:text-slate-900"}`}>
                                                    {item.product_name}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-slate-700 px-1 rounded">
                                                        {item.product_sku}
                                                    </span>
                                                    <span className="text-[10px] font-medium text-slate-500">• {item.unit}</span>
                                                </div>

                                                {/* Assigned Tags Preview */}
                                                {itemTags.length > 0 && (
                                                    <div className="mt-2.5 flex flex-wrap gap-1">
                                                        {itemTags.map((t, idx) => (
                                                            <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 font-mono border border-orange-200 dark:border-orange-800/50">
                                                                {t.tag.replace(/>/g, '›').replace('@', item.product_sku)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {selectedItemId === item.id && (
                                                <div className="w-5 h-5 rounded-full bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0 ml-2 animate-in zoom-in-50 duration-200">
                                                    <div className="w-2 h-2 rounded-full bg-white" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Column: Actions & Tags */}
                    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 relative">
                        {/* Header of Right Column */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center z-10">
                            <div className="flex flex-col gap-0.5">
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                    {selectedItemId ? (
                                        <>
                                            Mã phụ cho:
                                            <span className="text-slate-900 dark:text-slate-100 ml-1">
                                                {lotItems.find(i => i.id === selectedItemId)?.product_name}
                                            </span>
                                        </>
                                    ) : (
                                        "Vui lòng chọn sản phẩm"
                                    )}
                                </h4>
                                {selectedItemId && (
                                    <span className="text-[10px] font-mono text-slate-400">
                                        SKU: {lotItems.find(i => i.id === selectedItemId)?.product_sku}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                    {allLotTags.filter(t => t.lot_item_id === selectedItemId).length} Đã gán
                                </span>
                            </div>
                        </div>

                        {/* Current Tags Area */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="flex flex-wrap gap-2.5">
                                {selectedItemId && allLotTags.filter(t => t.lot_item_id === selectedItemId).length === 0 && (
                                    <div className="w-full flex flex-col items-center justify-center py-12 text-slate-400">
                                        <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3">
                                            <Plus size={24} className="opacity-20" />
                                        </div>
                                        <p className="text-sm italic">Chưa có mã phụ nào được gắn cho sản phẩm này</p>
                                    </div>
                                )}
                                {!selectedItemId && (
                                    <div className="w-full flex flex-col items-center justify-center py-12 text-slate-400">
                                        <p className="text-sm italic text-center">Chọn một sản phẩm từ danh sách bên trái<br />để xem và gán mã phụ</p>
                                    </div>
                                )}
                                {selectedItemId && allLotTags
                                    .filter(t => t.lot_item_id === selectedItemId)
                                    .map(t => (
                                        <div key={`${t.tag}-${t.added_at}`} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-3 pr-1.5 py-1.5 shadow-sm hover:shadow-md transition-all group">
                                            <TagDisplay tags={[t.tag]} placeholderMap={{ '@': lotItems.find(i => i.id === selectedItemId)?.product_sku || 'Product' }} />
                                            <button
                                                onClick={() => handleRemove(t.tag)}
                                                disabled={saving}
                                                className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Input Area (Sticky at Bottom) */}
                        {selectedItemId && (
                            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                        Gán mã mới
                                    </label>
                                    <button
                                        onClick={insertPlaceholder}
                                        className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-3 py-1.5 rounded-full font-bold hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-all flex items-center gap-1.5 border border-orange-200 dark:border-orange-800/50"
                                    >
                                        <Plus size={12} />
                                        Chèn Sản Phẩm (@)
                                    </button>
                                </div>

                                <div className="relative">
                                    <div className="flex gap-3">
                                        <div className="relative flex-1">
                                            <input
                                                ref={inputRef}
                                                value={inputValue}
                                                onChange={e => {
                                                    setInputValue(e.target.value.toUpperCase())
                                                    setShowSuggestions(true)
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                                                            handleSelectSuggestion(suggestions[selectedIndex])
                                                        } else {
                                                            handleAdd()
                                                        }
                                                    } else if (e.key === 'ArrowDown') {
                                                        e.preventDefault()
                                                        setSelectedIndex(p => (p < suggestions.length - 1 ? p + 1 : 0))
                                                    } else if (e.key === 'ArrowUp') {
                                                        e.preventDefault()
                                                        setSelectedIndex(p => (p > 0 ? p - 1 : suggestions.length - 1))
                                                    } else if (e.key === 'Escape') {
                                                        setShowSuggestions(false)
                                                    }
                                                }}
                                                onFocus={() => setShowSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                                placeholder="VD: CONT1>@>TIENGIANG"
                                                className="w-full pl-4 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm uppercase focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none"
                                                disabled={saving}
                                            />
                                        </div>
                                        <button
                                            onClick={handleAdd}
                                            disabled={!inputValue.trim() || saving}
                                            className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-orange-700 disabled:opacity-50 shadow-lg shadow-orange-600/20 active:scale-95 transition-all flex items-center gap-2 shrink-0"
                                        >
                                            {saving ? '...' : (
                                                <>
                                                    <Plus size={20} />
                                                    {inputValue.trim() ? "Lưu mã" : ""}
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Suggestions (Absolute, above the input area) */}
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div
                                            className="absolute bottom-[calc(100%+12px)] left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[100] max-h-64 overflow-hidden flex flex-col animate-in slide-in-from-bottom-2 duration-200"
                                            onMouseDown={(e) => e.preventDefault()}
                                        >
                                            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gợi ý mã phụ</span>
                                                <span className="text-[10px] text-slate-300">Enter để chọn</span>
                                            </div>
                                            <div className="overflow-y-auto max-h-52">
                                                {suggestions.map((s, i) => (
                                                    <div
                                                        key={s}
                                                        className={`px-4 py-3.5 cursor-pointer font-mono text-base border-b border-slate-50 dark:border-slate-800/50 last:border-0 transition-colors ${i === selectedIndex ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                                            }`}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            handleSelectSuggestion(s);
                                                        }}
                                                    >
                                                        <TagDisplay tags={[s]} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <p className="mt-4 text-[11px] text-slate-400 leading-relaxed text-center">
                                    Nhập mã tự do hoặc chọn từ gợi ý. Dùng biểu tượng <strong>@</strong> để đại diện cho thông tin sản phẩm trong chuỗi ký tự.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}
