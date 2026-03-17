import React, { useState, useEffect, useMemo } from 'react'
import { X, Search, Check, Save, Palette, AlertCircle, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { getProductColorStyle } from '@/lib/warehouseUtils'

interface Product {
    id: string;
    name: string;
    sku: string;
    color: string | null;
    internal_code?: string | null;
    internal_name?: string | null;
    sort_order?: number | null;
}

interface ProductColorConfigModalProps {
    onClose: () => void;
    onSaved: () => void;
    displayInternalInfo?: boolean;
}

const PREDEFINED_COLORS = [
    // Row 1
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    // Row 2
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    // Row 3
    '#f43f5e', '#64748b', '#78716c', '#475569', '#334155', '#1e293b', '#000000', '#ffffff',
    // Row 4 (Expanded)
    '#991b1b', '#9a3412', '#92400e', '#854d0e', '#3f6212', '#166534', '#065f46', '#115e59',
    // Row 5 (Expanded)
    '#155e75', '#075985', '#1e40af', '#3730a3', '#5b21b6', '#6b21a8', '#86198f', '#9d174d'
];

function isLight(color: string) {
    if (!color || color === 'transparent') return true;
    const hex = color.startsWith('#') ? color.replace('#', '') : 'ffffff';
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return brightness >= 128;
}

export function ProductColorConfigModal({ onClose, onSaved, displayInternalInfo = false }: ProductColorConfigModalProps) {
    const { systemType } = useSystem()
    const { showToast } = useToast()

    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // Track active selection mode per product: 'primary' | 'secondary' | 'tertiary'
    const [activeMode, setActiveMode] = useState<Record<string, 'primary' | 'secondary' | 'tertiary'>>({})

    // Track modifications
    const [modifications, setModifications] = useState<Record<string, string | null>>({})
    const [orderModifications, setOrderModifications] = useState<Record<string, number | null>>({})
    useEffect(() => {
        if (systemType) {
            fetchProducts()
        }
    }, [systemType])

    async function fetchProducts() {
        setLoading(true)
        try {
            // Attempt with sort_order
            const { data, error } = await supabase
                .from('products')
                .select('id, name, sku, color, internal_code, internal_name, sort_order')
                .eq('system_type', systemType)
                .order('sort_order', { ascending: true, nullsFirst: false })
                .order('name')

            if (error) {
                // If column doesn't exist, retry without it
                if (error.code === '42703') { // undefined_column
                    const { data: fallbackData, error: fallbackError } = await supabase
                        .from('products')
                        .select('id, name, sku, color, internal_code, internal_name')
                        .eq('system_type', systemType)
                        .order('name')
                    
                    if (fallbackError) throw fallbackError;
                    setProducts(fallbackData || []);
                } else {
                    throw error;
                }
            } else {
                setProducts(data || []);
            }
            setModifications({});
            setOrderModifications({});
        } catch (error: any) {
            console.error('Error fetching products:', error);
            showToast('Lỗi tải danh sách sản phẩm: ' + error.message, 'error');
        } finally {
            setLoading(false)
        }
    }

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;

        const normalize = (str: string) => {
            if (!str) return '';
            return str.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd');
        };

        const term = normalize(searchTerm);

        const scoredProducts = products.map(p => {
            const normalizedName = normalize(p.name);
            const normalizedSku = p.sku ? normalize(p.sku) : '';
            const normalizedInternalName = p.internal_name ? normalize(p.internal_name) : '';
            const normalizedInternalCode = p.internal_code ? normalize(p.internal_code) : '';

            let score = 0;

            // Exact match
            if (normalizedSku === term || normalizedName === term || normalizedInternalCode === term || normalizedInternalName === term) {
                score = 100;
            }
            // Starts with match
            else if (normalizedSku.startsWith(term) || normalizedName.startsWith(term) || normalizedInternalCode.startsWith(term) || normalizedInternalName.startsWith(term)) {
                score = 50;
            }
            // Contains match
            else if (normalizedName.includes(term) || normalizedSku.includes(term) || normalizedInternalName.includes(term) || normalizedInternalCode.includes(term)) {
                score = 10;
            }

            return { product: p, score };
        });

        // Filter out non-matches, sort by score descending, then map back to product
        return scoredProducts
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.product);
    }, [products, searchTerm]);

    const handleColorChange = (productId: string, color: string | null) => {
        setModifications(prev => {
            const currentVal = prev[productId] !== undefined ? prev[productId] : products.find(p => p.id === productId)?.color || null;
            // Ensure we have an array of up to 3 elements
            const colors = [null, null, null] as (string | null)[];
            if (currentVal) {
                const parts = currentVal.split(',');
                if (parts[0]) colors[0] = parts[0];
                if (parts[1]) colors[1] = parts[1];
                if (parts[2]) colors[2] = parts[2];
            }
            
            const mode = activeMode[productId] || 'primary';
            
            if (mode === 'primary') {
                colors[0] = color;
            } else if (mode === 'secondary') {
                colors[1] = color;
            } else {
                colors[2] = color;
            }

            // Cleanup: filter out nulls and join with commas
            const finalColor = colors.filter(Boolean).join(',') || null;

            return {
                ...prev,
                [productId]: finalColor
            };
        });
    };

    const handleSave = async () => {
        const idsToUpdate = Array.from(new Set([...Object.keys(modifications), ...Object.keys(orderModifications)]));
        if (idsToUpdate.length === 0) {
            onClose();
            return;
        }

        setSaving(true);
        try {
            const promises = idsToUpdate.map(id => {
                const updateData: any = {};
                if (modifications[id] !== undefined) updateData.color = modifications[id];
                if (orderModifications[id] !== undefined) updateData.sort_order = orderModifications[id];
                
                return supabase.from('products').update(updateData).eq('id', id);
            });

            await Promise.all(promises);

            showToast('Đã lưu cấu hình màu sắc sản phẩm thành công', 'success');
            onSaved();
            onClose();
        } catch (error: any) {
            console.error('Error saving product colors:', error);
            showToast('Lỗi khi lưu cấu hình: ' + error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col h-[85vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                            <Palette size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                                Cài đặt Màu sắc Mặt hàng (Hỗ trợ Đa màu)
                            </h2>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Chọn tối đa 3 màu cho mỗi sản phẩm để phân loại chuyên sâu
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800 flex justify-between gap-4 flex-shrink-0">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm mặt hàng theo mã hoặc tên..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                        />
                    </div>
                    {Object.keys(modifications).length + Object.keys(orderModifications).length > 0 && (
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 mr-2">
                            <AlertCircle size={16} />
                            Đã thay đổi {Array.from(new Set([...Object.keys(modifications), ...Object.keys(orderModifications)])).length} sản phẩm
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-900 custom-scrollbar relative">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p className="text-slate-500 font-medium text-sm">Đang tải danh sách sản phẩm...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Search size={48} className="opacity-20 mb-4" />
                            <p>Không tìm thấy mặt hàng nào phù hợp.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                            {filteredProducts.map(product => {
                                 const currentColorStr = modifications[product.id] !== undefined
                                    ? modifications[product.id]
                                    : product.color;
                                
                                const currentSortOrder = orderModifications[product.id] !== undefined
                                    ? orderModifications[product.id]
                                    : product.sort_order;
                                
                                const colors = currentColorStr ? currentColorStr.split(',') : [];
                                const c1 = colors[0] || null;
                                const c2 = colors[1] || null;
                                const c3 = colors[2] || null;
                                
                                const mode = activeMode[product.id] || 'primary';
                                const activeColor = mode === 'primary' ? c1 : (mode === 'secondary' ? c2 : c3);

                                return (
                                    <div key={product.id} className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80 flex flex-col items-start gap-4 group">
                                        <div className="w-full flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-8">
                                            {/* Left Side: Product Info */}
                                            <div className="flex-shrink-0 w-full lg:w-1/3 flex items-start gap-4">
                                                <div
                                                    className="w-14 h-14 rounded-2xl flex-shrink-0 border-2 border-slate-100 dark:border-slate-700 shadow-sm relative flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900 mt-1"
                                                    style={getProductColorStyle(currentColorStr)}
                                                >
                                                    {!currentColorStr && (
                                                        <div className="absolute w-full h-full flex items-center justify-center">
                                                            <div className="w-full h-0 border-t border-slate-300 dark:border-slate-600 transform -rotate-45"></div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1 flex flex-col pt-0.5">
                                                    <h3 className="font-black text-slate-900 dark:text-white text-[13px] leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors font-mono uppercase tracking-tight">
                                                        {displayInternalInfo && product.internal_code ? product.internal_code : product.sku || 'N/A'}
                                                    </h3>
                                                     <p className="text-[11px] font-bold text-slate-500 mt-1 line-clamp-2 uppercase tracking-wide">
                                                        {displayInternalInfo && product.internal_name ? product.internal_name : product.name}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* STT Input */}
                                            <div className="flex flex-col gap-1 flex-shrink-0">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">STT</label>
                                                <input
                                                    type="number"
                                                    value={currentSortOrder ?? ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value === '' ? null : parseInt(e.target.value);
                                                        setOrderModifications(prev => ({ ...prev, [product.id]: val }));
                                                    }}
                                                    placeholder="--"
                                                    className="w-14 px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg text-[11px] font-black text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                />
                                            </div>

                                            {/* Mode Selector */}
                                            <div className="flex flex-col gap-2 flex-shrink-0">
                                                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                                                    <button
                                                        onClick={() => setActiveMode(prev => ({ ...prev, [product.id]: 'primary' }))}
                                                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[9px] font-black transition-all ${mode === 'primary' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        <div className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: c1 || 'transparent' }}></div>
                                                        CHÍNH
                                                    </button>
                                                    <button
                                                        onClick={() => setActiveMode(prev => ({ ...prev, [product.id]: 'secondary' }))}
                                                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[9px] font-black transition-all ${mode === 'secondary' ? 'bg-white dark:bg-slate-800 shadow-sm text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        <div className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: c2 || 'transparent' }}></div>
                                                        PHỤ 1
                                                    </button>
                                                    <button
                                                        onClick={() => setActiveMode(prev => ({ ...prev, [product.id]: 'tertiary' }))}
                                                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[9px] font-black transition-all ${mode === 'tertiary' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        <div className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: c3 || 'transparent' }}></div>
                                                        PHỤ 2
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Right Side: Color Selection */}
                                            <div className="flex-1 w-full flex items-center flex-wrap gap-x-1.5 gap-y-2 lg:justify-end">
                                                {PREDEFINED_COLORS.map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => handleColorChange(product.id, c)}
                                                        className={`w-6 h-6 rounded-md transition-all border flex items-center justify-center shadow-sm hover:scale-110 ${activeColor === c ? 'ring-2 ring-indigo-500 ring-offset-2 z-10 scale-110 border-white' : 'border-black/5 dark:border-white/5 opacity-80 hover:opacity-100'}`}
                                                        style={{ backgroundColor: c }}
                                                        title={c}
                                                    >
                                                        {activeColor === c && <Check size={12} color={isLight(c) ? '#000' : '#fff'} strokeWidth={4} />}
                                                    </button>
                                                ))}

                                                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

                                                <div className="flex items-center gap-2">
                                                    <div className="relative flex items-center overflow-hidden border border-slate-200 dark:border-slate-700 rounded shadow-sm bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                                                        <input
                                                            type="color"
                                                            value={activeColor || '#ffffff'}
                                                            onChange={(e) => handleColorChange(product.id, e.target.value)}
                                                            className="w-6 h-6 p-0 border-0 cursor-pointer bg-transparent"
                                                            title="Màu tùy chọn"
                                                        />
                                                    </div>

                                                    {(c1 || c2) && (
                                                        <button
                                                            onClick={() => handleColorChange(product.id, null)}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                                            title="Xóa màu đang chọn"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 flex justify-end gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || Object.keys(modifications).length === 0}
                        className="px-6 py-2.5 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Đang lưu...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                Lưu Cấu Hình
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
