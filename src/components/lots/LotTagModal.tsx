'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { X, Plus, Trash2 } from "lucide-react"
import { TagDisplay } from "./TagDisplay"
import { useSystem } from "@/contexts/SystemContext"
import { supabase } from "@/lib/supabaseClient"

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
    const [dropdownStyles, setDropdownStyles] = useState<{ top: number, left: number, width: number } | null>(null)
    const [lotItems, setLotItems] = useState<{ id: string, product_name: string, product_sku: string, unit: string }[]>([])
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const { systemType } = useSystem()
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
        if (showSuggestions && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect()
            setDropdownStyles({
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width
            })
        }
    }, [showSuggestions, inputValue])
    useEffect(() => {
        const trimmed = inputValue.trim().toUpperCase()

        // Always show top suggestions if empty
        if (!trimmed) {
            setSuggestions(existingTags.slice(0, 10))
            setSelectedIndex(-1)
            return
        }

        const segments = inputValue.split(/[>;]/)
        const lastSegment = segments[segments.length - 1].trim().toUpperCase()
        const endsWithSeparator = /[>;]$/.test(inputValue)

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
            alert("Vui lòng chọn dòng sản phẩm để gán mã")
            return
        }

        // Use selected item or the only item
        const targetItemId = selectedItemId || (lotItems.length === 1 ? lotItems[0].id : null)

        if (currentTags.includes(trimmed)) {
            alert("Mã này đã được gắn rồi")
            return
        }

        setSaving(true)
        try {
            // 1. Ensure master tags exist for parts
            const parts = trimmed.split(/[>;]/).map(p => p.trim()).filter(Boolean)
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
                alert(j?.error || "Lỗi khi lưu")
            }

        } catch {
            alert("Lỗi kết nối")
        } finally {
            setSaving(false)
        }
    }

    const handleRemove = async (tag: string) => {
        if (!lotId) return
        if (!confirm(`Xóa mã ${tag}?`)) return

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
            alert("Lỗi kết nối")
        } finally {
            setSaving(false)
        }
    }

    const handleSelectSuggestion = (suggestion: string) => {
        const segments = inputValue.split(/([>;])/)
        // segments will be ["CONT1", ">", ""] or ["CONT1"]
        // We want to replace the last token (which might be partial)

        // Find the last actual text segment index
        let lastTextIndex = segments.length - 1;
        // If last segment is a separator, append
        if (['>', ';'].includes(segments[lastTextIndex])) {
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
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                    <div>
                        <h3 className="font-semibold text-lg">Gắn Mã Phụ</h3>
                        <p className="text-xs text-zinc-500 font-mono">{lotCodeDisplay || lotId}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 space-y-4">
                    {/* Product Selection */}
                    {lotItems.length > 1 && (
                        <div>
                            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2 block">
                                Chọn sản phẩm
                            </label>
                            <div className="space-y-2">
                                {lotItems.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedItemId(item.id)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-colors ${selectedItemId === item.id
                                                ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-200 dark:ring-indigo-800"
                                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{item.product_name}</div>
                                                <div className="text-xs text-zinc-500 mt-0.5">{item.product_sku} • {item.unit}</div>
                                            </div>
                                            {selectedItemId === item.id && (
                                                <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Current Tags */}
                    <div>
                        <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2 block">
                            Đã gắn ({currentTags.length})
                        </label>
                        <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            {currentTags.length === 0 && (
                                <span className="text-sm text-zinc-400 italic">Chưa có mã phụ nào</span>
                            )}
                            {currentTags.map(tag => (
                                <div key={tag} className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-2 pr-1 py-1 shadow-sm">
                                    <TagDisplay tags={[tag]} placeholderMap={{ '@': 'Product' }} />
                                    <button
                                        onClick={() => handleRemove(tag)}
                                        disabled={saving}
                                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded ml-1"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Input */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Thêm mới
                            </label>
                            <button
                                onClick={insertPlaceholder}
                                className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100 font-medium hover:bg-indigo-100 transition-colors"
                            >
                                + Chèn Sản Phẩm (@)
                            </button>
                        </div>

                        <div className="relative">
                            <div className="flex gap-2">
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
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-sm uppercase focus:ring-2 focus:ring-emerald-500"
                                    disabled={saving}
                                />
                                <button
                                    onClick={handleAdd}
                                    disabled={!inputValue.trim() || saving}
                                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {saving ? '...' : <Plus size={20} />}
                                </button>
                            </div>

                            {/* Suggestions */}
                            {showSuggestions && suggestions.length > 0 && dropdownStyles && (
                                <div
                                    className="fixed bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-[100] max-h-60 overflow-y-auto"
                                    style={{
                                        top: dropdownStyles.top,
                                        left: dropdownStyles.left,
                                        width: dropdownStyles.width
                                    }}
                                >
                                    {suggestions.map((s, i) => (
                                        <div
                                            key={s}
                                            className={`px-4 py-3 cursor-pointer font-mono text-base border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 ${i === selectedIndex ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                }`}
                                            onMouseDown={() => handleSelectSuggestion(s)}
                                        >
                                            <TagDisplay tags={[s]} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <p className="mt-2 text-xs text-zinc-500">
                            Dùng nút <strong>Chèn Sản Phẩm</strong> để thêm vị trí sản phẩm trong chuỗi mã.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
