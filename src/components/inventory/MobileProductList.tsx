import React from 'react';
import Link from 'next/link';
import { Package, Edit, Trash2, Eye } from 'lucide-react';
import { ProductWithCategory } from './types';
import { getProductDisplayImage } from '@/lib/utils';
import Protected from '@/components/auth/Protected';

interface MobileProductListProps {
    products: ProductWithCategory[];
    unitsMap: Record<string, string>;
    onView: (product: ProductWithCategory) => void;
    onDelete: (id: string) => void;
}

export default function MobileProductList({
    products,
    unitsMap,
    onView,
    onDelete
}: MobileProductListProps) {
    if (products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-white border rounded-xl border-stone-200">
                <Package className="mb-3 text-stone-300" size={48} />
                <span className="text-stone-500">Chưa có sản phẩm nào.</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {products.map((item) => (
                <div
                    key={item.id}
                    className="bg-white border rounded-xl border-stone-200 shadow-sm overflow-hidden active:scale-[0.99] transition-transform"
                    onClick={() => onView(item)}
                >
                    <div className="flex p-4 gap-4">
                        {/* Image */}
                        <div className="w-20 h-20 rounded-lg bg-stone-100 flex-shrink-0 flex items-center justify-center overflow-hidden border border-stone-100">
                             {getProductDisplayImage(item) ? (
                                <img
                                    src={getProductDisplayImage(item)!}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            ) : (
                                <Package className="text-stone-400" size={24} />
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-stone-800 line-clamp-2 leading-tight mb-1">
                                {item.name}
                            </h3>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">
                                    {item.sku}
                                </span>
                                {item.part_number && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                                        {item.part_number}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-stone-500 line-clamp-1">
                                {item.categories?.name || '---'}
                            </p>
                        </div>
                    </div>

                    {/* Units Section */}
                    {(item.unit || (item.product_units && item.product_units.length > 0)) && (
                        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                             {item.unit && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                    1 {item.unit}
                                </span>
                            )}
                            {item.product_units?.map((u, idx) => (
                                <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-stone-50 text-stone-600 border border-stone-200">
                                    1 {unitsMap[u.unit_id] || '---'} = {u.conversion_rate} {item.unit}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Actions Footer */}
                    <div className="flex border-t border-stone-100 divide-x divide-stone-100">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onView(item);
                            }}
                            className="flex-1 py-3 flex items-center justify-center text-stone-600 hover:bg-stone-50 active:bg-stone-100"
                        >
                            <Eye size={16} />
                            <span className="ml-2 text-xs font-medium">Xem</span>
                        </button>

                        <Link
                            href={`/products/${item.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 py-3 flex items-center justify-center text-blue-600 hover:bg-blue-50 active:bg-blue-100"
                        >
                            <Edit size={16} />
                            <span className="ml-2 text-xs font-medium">Sửa</span>
                        </Link>

                        <Protected permission="product.delete">
                             <div className="flex-1 flex">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(item.id);
                                    }}
                                    className="flex-1 py-3 flex items-center justify-center text-red-600 hover:bg-red-50 active:bg-red-100"
                                >
                                    <Trash2 size={16} />
                                    <span className="ml-2 text-xs font-medium">Xóa</span>
                                </button>
                             </div>
                        </Protected>
                    </div>
                </div>
            ))}
        </div>
    );
}
