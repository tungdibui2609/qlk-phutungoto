'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { Database } from '@/lib/database.types'
import { X, Save, Tag, Sparkles, Plus, AlertCircle } from 'lucide-react'
import { normalizeSearchString } from '@/lib/searchUtils'

type Product = Database['public']['Tables']['products']['Row'] & {
    aliases?: string | null
    part_number?: string | null
    internal_code?: string | null
    internal_name?: string | null
    categories?: { name: string } | null
}

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product | null
    onSuccess: () => void
}

/**
 * Trích xuất gợi ý các từ gõ tắt thông minh từ tên sản phẩm gốc và mã nội bộ
 */
function generateSmartSuggestions(product: Product | null): string[] {
    if (!product?.name) return []
    const suggestions = new Set<string>()

    const rawName = product.name.trim()
    const internalName = (product as any).internal_name || ''
    const internalCode = (product as any).internal_code || ''

    // Các từ ngữ thông dụng thường được lược bớt khi nhân viên kho gõ tắt
    const cleanName = rawName
        .replace(/\b(sầu riêng|sau rieng|cấp đông|cap dong|nguyên trái|nguyen trai|múi|mui|dạng|dang|loại|loai)\b/gi, '')
        .replace(/[(),/\\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    if (cleanName.length >= 2) {
        suggestions.add(cleanName.toLowerCase())
        suggestions.add(normalizeSearchString(cleanName, true))
    }

    // Tách các biến thể (ví dụ: Dona/Monthong C vụn -> "dona c vụn", "monthong c vụn")
    if (rawName.includes('/') || rawName.includes('-')) {
        const parts = rawName.split(/[\/\-]/).map(p => p.trim()).filter(Boolean)
        parts.forEach(p => {
            const sub = p.replace(/\b(sầu riêng|cấp đông)\b/gi, '').trim().toLowerCase()
            if (sub.length >= 2) {
                suggestions.add(sub)
            }
        })
    }

    // Trích xuất viết tắt chữ cái đầu (Acronym: Dona C Vụn -> dncv)
    const words = rawName
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length > 0)
    
    if (words.length >= 2) {
        const initials = words.map(w => w[0]).join('').toLowerCase()
        if (initials.length >= 2 && initials.length <= 6) {
            suggestions.add(initials)
        }
    }

    // Gợi ý từ mã nội bộ nếu có
    if (internalCode) {
        suggestions.add(internalCode.toLowerCase())
    }
    if (internalName) {
        suggestions.add(internalName.toLowerCase())
    }

    return Array.from(suggestions).filter(s => s && s.length >= 2)
}

export default function ProductAliasModal({ open, onOpenChange, product, onSuccess }: Props) {
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [tagInput, setTagInput] = useState('')
    const [aliases, setAliases] = useState<string[]>([])
    const [suggestions, setSuggestions] = useState<string[]>([])

    useEffect(() => {
        if (open && product) {
            const raw = product.aliases || (product as any).short_name || ''
            const initialList = raw
                ? raw.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean)
                : []
            setAliases(initialList)
            setTagInput('')
            setSuggestions(generateSmartSuggestions(product))
        } else {
            setAliases([])
            setTagInput('')
            setSuggestions([])
        }
    }, [open, product])

    if (!open || !product) return null

    const handleAddTag = (tagToAdd?: string) => {
        const raw = tagToAdd !== undefined ? tagToAdd : tagInput
        const cleaned = raw.trim().toLowerCase()
        if (!cleaned) return

        // Cho phép thêm nhiều tag phân cách bằng dấu phẩy
        const newTags = cleaned.split(/[,;\n]/).map(s => s.trim().toLowerCase()).filter(Boolean)
        const updated = Array.from(new Set([...aliases, ...newTags]))
        setAliases(updated)
        setTagInput('')
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            handleAddTag()
        }
    }

    const handleRemoveTag = (indexToRemove: number) => {
        setAliases(aliases.filter((_, idx) => idx !== indexToRemove))
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            // Tự động thêm tag đang gõ dở nếu có
            let finalAliases = [...aliases]
            if (tagInput.trim()) {
                const pending = tagInput.trim().toLowerCase().split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
                finalAliases = Array.from(new Set([...finalAliases, ...pending]))
            }

            const aliasesString = finalAliases.join(', ')

            const { error } = await (supabase.from('products') as any)
                .update({
                    aliases: aliasesString || null
                })
                .eq('id', product.id)

            if (error) throw error

            showToast('Lưu tên gõ tắt sản phẩm thành công!', 'success')
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error('Update aliases error:', error)
            showToast('Lỗi khi lưu tên gõ tắt: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
            <div className="bg-white rounded-[28px] w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden border border-stone-200 animate-slide-up">
                {/* Header */}
                <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl shadow-sm border border-amber-200">
                            <Tag size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-stone-900 tracking-tight">Thiết lập Tên gõ tắt</h2>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                                SKU: {product.sku || '---'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                    {/* Thông tin sản phẩm */}
                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Sản phẩm áp dụng:</span>
                        <p className="font-bold text-stone-900 text-sm leading-snug">{product.name}</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {product.sku && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-white text-stone-600 border border-stone-200">
                                    Mã SKU: {product.sku}
                                </span>
                            )}
                            {(product as any).internal_code && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Nội bộ: {(product as any).internal_code}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Ô nhập từ gõ tắt */}
                    <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-stone-700">
                            Danh sách tên viết tắt / từ khóa gõ nhanh ({aliases.length})
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Nhập tên viết tắt rồi nhấn Enter (VD: dona c vụn, dncv)..."
                                className="flex-1 px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 placeholder:text-stone-400 text-sm font-medium focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => handleAddTag()}
                                className="px-5 py-3 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                            >
                                <Plus size={18} />
                                Thêm
                            </button>
                        </div>
                        <p className="text-[11px] text-stone-400 font-medium">
                            * Mẹo: Bạn có thể nhập nhiều từ cùng lúc, ngăn cách bằng dấu phẩy.
                        </p>
                    </div>

                    {/* Danh sách Tags hiện tại */}
                    <div className="space-y-2">
                        <div className="min-h-[70px] p-4 bg-stone-50/70 rounded-2xl border border-dashed border-stone-200 flex flex-wrap gap-2 items-center">
                            {aliases.length === 0 ? (
                                <div className="text-stone-400 text-xs font-medium italic flex items-center gap-2">
                                    <AlertCircle size={15} />
                                    Chưa có tên gõ tắt nào được gán cho sản phẩm này.
                                </div>
                            ) : (
                                aliases.map((alias, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-amber-200 text-amber-900 font-bold text-xs shadow-sm hover:border-amber-400 transition-all group"
                                    >
                                        <span>{alias}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTag(idx)}
                                            className="text-stone-400 hover:text-red-500 rounded-full p-0.5 transition-colors"
                                            title="Xóa từ khóa này"
                                        >
                                            <X size={13} />
                                        </button>
                                    </span>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Gợi ý thông minh */}
                    {suggestions.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-stone-100">
                            <div className="flex items-center gap-1.5 text-xs font-black text-amber-800 uppercase tracking-wider">
                                <Sparkles size={14} className="text-amber-500" />
                                <span>Gợi ý gõ tắt thông minh (bấm để thêm):</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map((sug, sIdx) => {
                                    const isAdded = aliases.includes(sug)
                                    return (
                                        <button
                                            key={sIdx}
                                            type="button"
                                            disabled={isAdded}
                                            onClick={() => handleAddTag(sug)}
                                            className={`text-xs px-3 py-1.5 rounded-xl font-medium border transition-all flex items-center gap-1 ${
                                                isAdded
                                                    ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 hover:border-amber-300 shadow-xs'
                                            }`}
                                        >
                                            <Plus size={12} className={isAdded ? 'opacity-30' : 'text-amber-600'} />
                                            {sug}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="px-5 py-2.5 rounded-xl text-stone-600 font-bold text-sm hover:bg-stone-200/60 transition-colors"
                        disabled={loading}
                    >
                        Hủy bỏ
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-sm shadow-md shadow-amber-600/20 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        <span>Lưu Tên Gõ Tắt</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
