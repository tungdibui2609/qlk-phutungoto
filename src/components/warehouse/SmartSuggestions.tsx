"use client";

import React, { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, AlertTriangle, ArrowUpRight, Combine, PlusCircle, Loader2 } from 'lucide-react';

interface Suggestion {
    id: string;
    type: 'PUT_AWAY' | 'REPLENISH' | 'CONSOLIDATE' | 'ALERT';
    title: string;
    description: string;
    action: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export default function SmartSuggestions() {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        // Temporarily using mock data until API is implemented
        const mockSuggestions: Suggestion[] = [
            {
                id: '1',
                type: 'PUT_AWAY',
                title: 'Tối ưu vị trí nhập hàng',
                description: 'Khu vực A-01 còn nhiều vị trí trống phù hợp cho sản phẩm SKU-123 vừa về kho.',
                action: 'Xem vị trống',
                priority: 'MEDIUM'
            },
            {
                id: '2',
                type: 'ALERT',
                title: 'Cảnh báo tồn kho thấp',
                description: 'Sản phẩm "Thùng carton 5 lớp" đang dưới mức tồn kho tối thiểu (còn 50/200).',
                action: 'Tạo phiếu nhập',
                priority: 'HIGH'
            },
            {
                id: '3',
                type: 'CONSOLIDATE',
                title: 'Gợi ý gộp lô hàng',
                description: 'Có 2 lô hàng lẻ của cùng sản phẩm tại B-02 và B-05, có thể gộp để tiết kiệm diện tích.',
                action: 'Gộp lô',
                priority: 'LOW'
            }
        ];

        setTimeout(() => {
            setSuggestions(mockSuggestions);
            setIsLoading(false);
        }, 500);
    }, []);

    const getIcon = (type: Suggestion['type']) => {
        switch (type) {
            case 'PUT_AWAY': return <ArrowUpRight size={18} className="text-blue-600" />;
            case 'REPLENISH': return <PlusCircle size={18} className="text-emerald-600" />;
            case 'CONSOLIDATE': return <Combine size={18} className="text-amber-600" />;
            case 'ALERT': return <AlertTriangle size={18} className="text-rose-600" />;
            default: return <Sparkles size={18} className="text-purple-600" />;
        }
    };

    const getBgColor = (type: Suggestion['type']) => {
        switch (type) {
            case 'PUT_AWAY': return 'bg-blue-50 dark:bg-blue-900/20';
            case 'REPLENISH': return 'bg-emerald-50 dark:bg-emerald-900/20';
            case 'CONSOLIDATE': return 'bg-amber-50 dark:bg-amber-900/20';
            case 'ALERT': return 'bg-rose-50 dark:bg-rose-900/20';
            default: return 'bg-zinc-50 dark:bg-zinc-800';
        }
    };

    return (
        <div className="h-full flex flex-col bg-transparent">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 sticky top-0 bg-white dark:bg-zinc-900 z-10">
                <Sparkles size={20} className="text-purple-500" />
                <h2 className="font-bold text-zinc-800 dark:text-zinc-100">Gợi ý & Cảnh báo</h2>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-zinc-400" />
                    </div>
                ) : suggestions.length === 0 ? (
                    <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                        <div className="flex gap-3">
                            <Sparkles size={18} className="text-zinc-400" />
                            <div>
                                <h3 className="font-bold text-sm text-zinc-700 dark:text-zinc-300">Kho vận hành ổn định</h3>
                                <p className="text-xs text-zinc-500">Không có gợi ý nào vào lúc này.</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    suggestions.map((item) => (
                        <div key={item.id} className={`p-4 rounded-xl border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 transition-all ${getBgColor(item.type)}`}>
                            <div className="flex gap-3">
                                <div className="mt-0.5">{getIcon(item.type)}</div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-1">{item.title}</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-3">
                                        {item.description}
                                    </p>
                                    <button className="text-xs font-bold flex items-center gap-1 hover:underline transition-all">
                                        {item.action}
                                        <ArrowRight size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
