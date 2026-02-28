import React, { useState, useEffect, useMemo } from 'react'
import { X, Search, Check, Save, Palette, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'

interface Product {
    id: string;
    name: string;
    sku: string;
    color: string | null;
}

interface ProductColorConfigModalProps {
    onClose: () => void;
    onSaved: () => void;
}

const PREDEFINED_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e', '#64748b', '#78716c', '#000000', '#475569', '#334155', '#1e293b'
];

function isLight(color: string) {
    if (!color) return true;
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return brightness >= 128;
}

export function ProductColorConfigModal({ onClose, onSaved }: ProductColorConfigModalProps) {
    const { systemType } = useSystem()
    const { showToast } = useToast()

    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // Track modifications
    const [modifications, setModifications] = useState<Record<string, string | null>>({})

    useEffect(() => {
        if (systemType) {
            fetchProducts()
        }
    }, [systemType])

    async function fetchProducts() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, sku, color')
                .eq('system_type', systemType)
                .order('name')

            if (error) throw error;
            setProducts(data || []);
            setModifications({});
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

            let score = 0;

            // Exact match
            if (normalizedSku === term || normalizedName === term) {
                score = 100;
            }
            // Starts with match
            else if (normalizedSku.startsWith(term) || normalizedName.startsWith(term)) {
                score = 50;
            }
            // Contains match
            else if (normalizedName.includes(term) || normalizedSku.includes(term)) {
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
        setModifications(prev => ({
            ...prev,
            [productId]: color
        }));
    };

    const handleSave = async () => {
        const idsToUpdate = Object.keys(modifications);
        if (idsToUpdate.length === 0) {
            onClose();
            return;
        }

        setSaving(true);
        try {
            // Update each modified product
            // Supabase JS doesn't have a simple bulk update with different values for different rows easily without RPC, 
            // so we'll do promise all for the modified ones (there shouldn't be too many at once)
            const promises = idsToUpdate.map(id => {
                return supabase.from('products').update({ color: modifications[id] }).eq('id', id);
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

            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[85vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                            <Palette size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                                Cài đặt Màu sắc Mặt hàng
                            </h2>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Chọn màu sắc cho từng sản phẩm để dễ nhận diện trên sơ đồ kho
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
                    {Object.keys(modifications).length > 0 && (
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 mr-2">
                            <AlertCircle size={16} />
                            Đã thay đổi {Object.keys(modifications).length} sản phẩm
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
                                const currentColor = modifications[product.id] !== undefined
                                    ? modifications[product.id]
                                    : product.color;

                                return (
                                    <div key={product.id} className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80 flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-8 group">
                                        {/* Left Side: Product Info */}
                                        <div className="flex-shrink-0 w-full lg:w-1/3 flex items-center gap-4">
                                            <div
                                                className="w-10 h-10 rounded-full flex-shrink-0 border-2 border-slate-100 dark:border-slate-700 shadow-sm relative flex items-center justify-center overflow-hidden"
                                                style={{ backgroundColor: currentColor || 'transparent' }}
                                            >
                                                {!currentColor && (
                                                    <div className="absolute w-full h-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                                                        <div className="w-full h-0 border-t border-slate-300 dark:border-slate-600 transform -rotate-45"></div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {product.name}
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-1 font-mono">
                                                    Mã: {product.sku || 'N/A'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right Side: Color Selection */}
                                        <div className="flex-1 w-full pl-14 lg:pl-0 flex items-center flex-wrap gap-x-2 gap-y-3">
                                            {PREDEFINED_COLORS.map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => handleColorChange(product.id, c)}
                                                    className={`w-7 h-7 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 border flex items-center justify-center shadow-sm hover:scale-110 ${currentColor === c ? 'border-2 border-slate-900 dark:border-white scale-110' : 'border-black/5 dark:border-white/5 opacity-80 hover:opacity-100'}`}
                                                    style={{ backgroundColor: c }}
                                                    title={c}
                                                >
                                                    {currentColor === c && <Check size={14} color={isLight(c) ? '#000' : '#fff'} className="drop-shadow-sm" />}
                                                </button>
                                            ))}

                                            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

                                            <div className="flex items-center gap-2">
                                                <div className="relative flex items-center overflow-hidden border border-slate-200 dark:border-slate-700 rounded-full shadow-sm bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                                                    <input
                                                        type="color"
                                                        value={currentColor || '#ffffff'}
                                                        onChange={(e) => handleColorChange(product.id, e.target.value)}
                                                        className="w-8 h-8 p-0 hover:p-[2px] border-0 cursor-pointer bg-transparent transition-all rounded-full"
                                                        title="Màu tùy chọn"
                                                    />
                                                </div>

                                                {currentColor && (
                                                    <button
                                                        onClick={() => handleColorChange(product.id, null)}
                                                        className="text-xs font-bold text-slate-400 hover:text-red-600 bg-slate-100 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-900/30 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 whitespace-nowrap"
                                                    >
                                                        <X size={14} strokeWidth={2.5} /> Bỏ màu
                                                    </button>
                                                )}
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
