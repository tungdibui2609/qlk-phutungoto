'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { X, Plus, Layers, Check } from "lucide-react"
import { TagDisplay } from "./TagDisplay"
import { useSystem } from "@/contexts/SystemContext"
import { supabase } from "@/lib/supabaseClient"
import { useToast } from "@/components/ui/ToastProvider"
import { canonicalizeUnit } from "@/lib/unitConversion"

interface LotTagModalProps {
    lotIds: string[] | null
    lotCodeDisplay?: string
    onClose: () => void
    onSuccess?: () => void
}

type TagEntry = {
    tag: string
    added_at: string
    lot_item_id: string | null
}

export function LotTagModal({ lotIds, lotCodeDisplay, onClose, onSuccess }: LotTagModalProps) {
    const lotId = lotIds?.[0] || null // For backward compatibility in some internal lookups if needed
    const [allLotTags, setAllLotTags] = useState<TagEntry[]>([]) // All tags for this lot
    const [existingTags, setExistingTags] = useState<string[]>([]) // All unique tags from system + master
    const [inputValue, setInputValue] = useState("")
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [lotItems, setLotItems] = useState<{ id: string, ids: string[], lotIds: string[], product_name: string, product_sku: string, unit: string }[]>([])
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const { systemType } = useSystem()
    const { showToast, showConfirm } = useToast()
    // Load Data
    const loadData = useCallback(async () => {
        if (!lotIds || lotIds.length === 0) return
        setLoading(true)
        try {
            // Fetch lot items for all LOTs
            const lotItemsRes = await supabase
                .from('lot_items')
                .select(`id, lot_id, products(name, sku, unit), unit, quantity`)
                .in('lot_id', lotIds) as any

            const rawItems = lotItemsRes.data || []

            // Group items by unique product attributes
            const groupedMap: Record<string, { id: string, ids: string[], lotIds: string[], product_name: string, product_sku: string, unit: string }> = {}

            rawItems.forEach((i: any) => {
                const name = i.products?.name || 'Unknown'
                const sku = i.products?.sku || ''
                const unit = (i as any).unit || i.products?.unit || ''
                const key = `${canonicalizeUnit(name)}|${canonicalizeUnit(sku)}|${canonicalizeUnit(unit)}`

                if (!groupedMap[key]) {
                    groupedMap[key] = {
                        id: i.id, // Representative ID
                        ids: [i.id],
                        lotIds: [i.lot_id],
                        product_name: name,
                        product_sku: sku,
                        unit: unit
                    }
                } else {
                    groupedMap[key].ids.push(i.id)
                    if (!groupedMap[key].lotIds.includes(i.lot_id)) {
                        groupedMap[key].lotIds.push(i.lot_id)
                    }
                }
            })

            const items = Object.values(groupedMap)
            setLotItems(items)

            // Tự động chọn Tất Cả Sản Phẩm nếu có nhiều hơn 1 sản phẩm, hoặc chọn sản phẩm duy nhất
            if (!selectedItemId) {
                if (items.length > 1) {
                    setSelectedItemId('ALL')
                } else if (items.length === 1) {
                    setSelectedItemId(items[0].id)
                }
            }

            const [masterRes, allTagsRes] = await Promise.all([
                fetch(`/api/lot-tags/master?systemCode=${systemType}`).then(r => r.json()).catch(() => ({ ok: false })),
                fetch("/api/lot-tags?all=1").then(r => r.json()).catch(() => ({ ok: false }))
            ])

            // Lấy tags của toàn bộ các lotIds
            let fetchedLotTags: TagEntry[] = []
            try {
                const { data: tagsData } = await supabase
                    .from('lot_tags')
                    .select('tag, added_at, added_by, lot_item_id, lot_id')
                    .in('lot_id', lotIds)

                if (tagsData) {
                    fetchedLotTags = tagsData.map((t: any) => ({
                        tag: t.tag,
                        added_at: t.added_at,
                        lot_item_id: t.lot_item_id
                    }))
                }
            } catch (err) {
                console.error('Error fetching lot tags via Supabase:', err)
            }

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
            setAllLotTags(fetchedLotTags)

        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [lotIds, systemType, selectedItemId])

    useEffect(() => {
        if (lotIds && lotIds.length > 0) {
            loadData()
            setInputValue("")
        }
    }, [lotIds, loadData])

    // Danh sách tag tổng hợp cho toàn bộ sản phẩm
    const uniqueTagsForAll = useMemo(() => {
        if (lotItems.length === 0) return []
        const map = new Map<string, Set<string>>()
        allLotTags.forEach(t => {
            if (!map.has(t.tag)) map.set(t.tag, new Set())
            if (t.lot_item_id) map.get(t.tag)!.add(t.lot_item_id)
        })
        return Array.from(map.entries()).map(([tag, set]) => ({
            tag,
            count: set.size
        })).sort((a, b) => b.count - a.count)
    }, [allLotTags, lotItems.length])

    // Filter current tags based on selection
    const currentTags = useMemo(() => {
        if (selectedItemId === 'ALL') {
            return uniqueTagsForAll.filter(t => t.count === lotItems.length).map(t => t.tag)
        }
        if (selectedItemId) {
            return allLotTags.filter(t => t.lot_item_id === selectedItemId).map(t => t.tag)
        }
        return []
    }, [allLotTags, selectedItemId, uniqueTagsForAll, lotItems.length])

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
        if (!trimmed || !lotIds || lotIds.length === 0) return

        // Xác định danh sách nhóm sản phẩm cần gán
        let targetGroups: typeof lotItems = []
        if (selectedItemId === 'ALL') {
            targetGroups = lotItems
        } else if (selectedItemId) {
            const found = lotItems.find(i => i.id === selectedItemId)
            if (found) targetGroups = [found]
        } else if (lotItems.length === 1) {
            targetGroups = [lotItems[0]]
        }

        if (targetGroups.length === 0) {
            showToast("Vui lòng chọn sản phẩm để gán mã", 'warning')
            return
        }

        if (currentTags.includes(trimmed)) {
            showToast("Mã này đã được gắn cho tất cả sản phẩm đang chọn", 'warning')
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

            // 2. Add to all target groups
            const newEntries: TagEntry[] = []
            const promises: Promise<any>[] = []

            for (const group of targetGroups) {
                group.lotIds.forEach((lId: string, idx: number) => {
                    const itemId = group.ids[idx] || group.ids[0]
                    promises.push(
                        fetch("/api/lot-tags", {
                            method: "POST",
                            body: JSON.stringify({
                                lotId: lId,
                                tag: trimmed,
                                lotItemId: itemId
                            })
                        }).then(r => r.json()).then(res => {
                            if (res.ok) {
                                newEntries.push({
                                    tag: trimmed,
                                    added_at: new Date().toISOString(),
                                    lot_item_id: group.id
                                })
                            }
                            return res
                        })
                    )
                })
            }

            const results = await Promise.all(promises)
            const allOk = results.every((r: any) => r.ok)

            if (allOk || results.some(r => r.ok)) {
                // Optimistic update
                setAllLotTags(prev => [...prev, ...newEntries])
                setInputValue("")
                setShowSuggestions(false)
                setExistingTags(prev => {
                    const newSet = new Set([...prev, ...parts])
                    return Array.from(newSet).sort()
                })
                showToast(
                    selectedItemId === 'ALL'
                        ? `Đã gán mã phụ cho toàn bộ ${targetGroups.length} sản phẩm thành công!`
                        : 'Đã gán mã phụ thành công!',
                    'success'
                )
                onSuccess?.()
            } else {
                const errors = results.filter(r => !r.ok).map(r => r.error).join(", ")
                showToast(errors || "Lỗi khi lưu mã phụ", 'error')
            }

        } catch (error) {
            console.error(error)
            showToast("Lỗi kết nối", 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleRemove = async (tag: string) => {
        if (!lotIds || lotIds.length === 0) return

        let targetGroups: typeof lotItems = []
        if (selectedItemId === 'ALL') {
            targetGroups = lotItems
        } else if (selectedItemId) {
            const found = lotItems.find(i => i.id === selectedItemId)
            if (found) targetGroups = [found]
        } else if (lotItems.length === 1) {
            targetGroups = [lotItems[0]]
        }

        if (targetGroups.length === 0) return

        const confirmMsg = selectedItemId === 'ALL'
            ? `Xóa mã "${tag}" khỏi tất cả ${targetGroups.length} sản phẩm trong ${lotIds.length} lô đã chọn?`
            : `Xóa mã "${tag}" khỏi sản phẩm đã chọn?`

        if (!await showConfirm(confirmMsg)) return

        setSaving(true)
        try {
            const promises: Promise<any>[] = []
            for (const group of targetGroups) {
                group.lotIds.forEach((lId: string, idx: number) => {
                    const itemId = group.ids[idx] || group.ids[0]
                    let url = `/api/lot-tags?lotId=${encodeURIComponent(lId)}&tag=${encodeURIComponent(tag)}`
                    if (itemId) url += `&lotItemId=${encodeURIComponent(itemId)}`
                    promises.push(fetch(url, { method: "DELETE" }).then(r => r.json()))
                })
            }

            const results = await Promise.all(promises)
            const allOk = results.every((r: any) => r.ok)

            if (allOk || results.some(r => r.ok)) {
                const targetIds = new Set(targetGroups.map(g => g.id))
                setAllLotTags(prev => prev.filter(t => !(t.tag === tag && (selectedItemId === 'ALL' || targetIds.has(t.lot_item_id || '')))))
                showToast(`Đã xóa mã ${tag}`, 'success')
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
                            <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-800 text-[10px] font-bold text-slate-500 font-mono tracking-wider">LOTS</span>
                            <p className="text-xs text-slate-500 font-mono">
                                {lotIds && lotIds.length > 3 ? `${lotIds.length} lô đang chọn` : lotIds?.join(", ")}
                            </p>
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
                            <div className="flex items-center gap-1.5">
                                {lotItems.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedItemId(selectedItemId === 'ALL' ? null : 'ALL')}
                                        className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                    >
                                        {selectedItemId === 'ALL' ? 'Bỏ chọn' : 'Chọn tất cả'}
                                    </button>
                                )}
                                <span className="bg-slate-200/50 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                    {lotItems.length}
                                </span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {lotItems.length === 0 && !loading && (
                                <div className="text-center py-8 text-slate-400 text-sm italic">
                                    Không có sản phẩm nào
                                </div>
                            )}

                            {/* Mục chọn Tất Cả Sản Phẩm */}
                            {lotItems.length > 1 && (
                                <div
                                    onClick={() => setSelectedItemId('ALL')}
                                    className={`group p-3 rounded-2xl border cursor-pointer transition-all duration-200 ${
                                        selectedItemId === 'ALL'
                                            ? "bg-white dark:bg-slate-800 border-teal-500 dark:border-teal-500 shadow-md ring-2 ring-teal-500/20"
                                            : "bg-teal-50/50 dark:bg-teal-950/20 border-teal-200/70 dark:border-teal-900/40 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                                                selectedItemId === 'ALL'
                                                    ? "bg-teal-600 text-white"
                                                    : "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300"
                                            }`}>
                                                <Layers size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className={`font-bold text-sm truncate ${
                                                    selectedItemId === 'ALL' ? "text-teal-700 dark:text-teal-300" : "text-slate-800 dark:text-slate-200"
                                                }`}>
                                                    Tất cả sản phẩm
                                                </div>
                                                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                                    Gán đồng loạt {lotItems.length} sản phẩm ({lotIds?.length} lô)
                                                </div>
                                            </div>
                                        </div>
                                        {selectedItemId === 'ALL' && (
                                            <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center shadow-md shadow-teal-600/30 shrink-0 ml-2 animate-in zoom-in-50 duration-200">
                                                <Check size={12} className="text-white" strokeWidth={3} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Danh sách từng sản phẩm */}
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
                                    {selectedItemId === 'ALL' ? (
                                        <>
                                            <span className="p-1 bg-teal-50 dark:bg-teal-950/40 text-teal-600 rounded-lg">
                                                <Layers size={16} />
                                            </span>
                                            <span>Mã phụ cho:</span>
                                            <span className="text-teal-600 dark:text-teal-400 font-bold ml-1">
                                                Tất cả sản phẩm ({lotItems.length} SP - {lotIds?.length} lô)
                                            </span>
                                        </>
                                    ) : selectedItemId ? (
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
                                {selectedItemId === 'ALL' ? (
                                    <span className="text-[10px] text-slate-400">
                                        Mã phụ sẽ được áp dụng cho toàn bộ các sản phẩm và lô hàng đang chọn
                                    </span>
                                ) : selectedItemId ? (
                                    <span className="text-[10px] font-mono text-slate-400">
                                        SKU: {lotItems.find(i => i.id === selectedItemId)?.product_sku}
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                    {selectedItemId === 'ALL'
                                        ? `${uniqueTagsForAll.length} Mã phụ`
                                        : `${allLotTags.filter(t => t.lot_item_id === selectedItemId).length} Đã gán`}
                                </span>
                            </div>
                        </div>

                        {/* Current Tags Area */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="flex flex-wrap gap-2.5">
                                {selectedItemId === 'ALL' && uniqueTagsForAll.length === 0 && (
                                    <div className="w-full flex flex-col items-center justify-center py-12 text-slate-400">
                                        <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3">
                                            <Plus size={24} className="opacity-20" />
                                        </div>
                                        <p className="text-sm italic">Chưa có mã phụ chung nào được gắn cho các sản phẩm</p>
                                    </div>
                                )}
                                {selectedItemId && selectedItemId !== 'ALL' && allLotTags.filter(t => t.lot_item_id === selectedItemId).length === 0 && (
                                    <div className="w-full flex flex-col items-center justify-center py-12 text-slate-400">
                                        <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3">
                                            <Plus size={24} className="opacity-20" />
                                        </div>
                                        <p className="text-sm italic">Chưa có mã phụ nào được gắn cho sản phẩm này</p>
                                    </div>
                                )}
                                {!selectedItemId && (
                                    <div className="w-full flex flex-col items-center justify-center py-12 text-slate-400">
                                        <p className="text-sm italic text-center">Chọn một sản phẩm từ danh sách bên trái<br />hoặc bấm "Tất cả sản phẩm" để xem và gán mã phụ</p>
                                    </div>
                                )}
                                {selectedItemId === 'ALL' && uniqueTagsForAll.map(({ tag, count }) => (
                                    <div key={tag} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-800/60 rounded-xl pl-3 pr-1.5 py-1.5 shadow-sm hover:shadow-md transition-all group">
                                        <TagDisplay tags={[tag]} placeholderMap={{ '@': 'SKU' }} />
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                                            count === lotItems.length
                                                ? "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 font-bold"
                                                : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                                        }`}>
                                            {count}/{lotItems.length} SP
                                        </span>
                                        <button
                                            onClick={() => handleRemove(tag)}
                                            disabled={saving}
                                            title="Xóa mã này khỏi tất cả sản phẩm"
                                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                                {selectedItemId && selectedItemId !== 'ALL' && allLotTags
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
                                    {selectedItemId === 'ALL' ? (
                                        <>Đang ở chế độ <strong>Gán cho tất cả ({lotItems.length} sản phẩm)</strong>. Nhập mã tự do hoặc dùng biểu tượng <strong>@</strong> để hệ thống tự động thay bằng mã SKU riêng của từng sản phẩm tương ứng.</>
                                    ) : (
                                        <>Nhập mã tự do hoặc chọn từ gợi ý. Dùng biểu tượng <strong>@</strong> để đại diện cho thông tin sản phẩm trong chuỗi ký tự.</>
                                    )}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}
