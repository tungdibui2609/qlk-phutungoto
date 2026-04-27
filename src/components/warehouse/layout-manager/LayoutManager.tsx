'use client';

import React, { useState, useEffect } from 'react';
import { WarehouseLayout } from './types';
import { layoutService } from '@/services/warehouse/layoutService';
import { useSystem } from '@/contexts/SystemContext';
import { Plus, Edit2, Trash2, Map } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import LayoutEditor from './LayoutEditor';

export default function LayoutManager() {
    const { systemType } = useSystem();
    const { showToast, showConfirm } = useToast();
    const [layouts, setLayouts] = useState<WarehouseLayout[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingLayout, setEditingLayout] = useState<WarehouseLayout | null | 'NEW'>(null);

    const loadLayouts = async () => {
        if (!systemType) return;
        setLoading(true);
        try {
            const data = await layoutService.getLayouts(systemType);
            setLayouts(data);
        } catch (error) {
            console.error('Failed to load layouts', error);
            showToast('Không thể tải danh sách sơ đồ', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLayouts();
    }, [systemType]);

    const handleDelete = async (id: string, name: string) => {
        if (await showConfirm(`Bạn có chắc chắn muốn xóa sơ đồ "${name}"?`)) {
            const success = await layoutService.deleteLayout(id);
            if (success) {
                showToast('Đã xóa sơ đồ', 'success');
                loadLayouts();
            } else {
                showToast('Lỗi khi xóa sơ đồ', 'error');
            }
        }
    };

    if (editingLayout) {
        return (
            <div className="h-[80vh]">
                <LayoutEditor 
                    layout={editingLayout === 'NEW' ? undefined : editingLayout} 
                    onClose={() => setEditingLayout(null)} 
                    onSaveSuccess={() => {
                        setEditingLayout(null);
                        loadLayouts();
                    }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Danh Sách Sơ Đồ Mặt Bằng (Layout)</h2>
                    <p className="text-sm text-gray-500">Quản lý và thiết kế sơ đồ mặt bằng trực quan cho kho của bạn.</p>
                </div>
                <button type="button" onClick={() => setEditingLayout('NEW')} className="px-3 py-1.5 text-sm font-medium rounded-md flex items-center justify-center transition-colors bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Tạo Sơ Đồ Mới
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : layouts.length === 0 ? (
                <div className="text-center p-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    <Map className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Chưa có sơ đồ nào</h3>
                    <p className="text-gray-500 mt-1 mb-4">Bạn chưa thiết kế sơ đồ mặt bằng nào cho phân hệ này.</p>
                    <button type="button" onClick={() => setEditingLayout('NEW')} className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        Bắt đầu thiết kế ngay
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {layouts.map(layout => (
                        <div key={layout.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">{layout.name}</h3>
                                    <p className="text-sm text-gray-500 mt-1">Kích thước: {layout.width} x {layout.height} ô</p>
                                </div>
                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${layout.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                                    {layout.is_active ? 'Đang kích hoạt' : 'Ngừng dùng'}
                                </span>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-2">
                                <button type="button" className="px-2.5 py-1 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center transition-colors" onClick={() => setEditingLayout(layout)}>
                                    <Edit2 className="w-4 h-4 mr-1" /> Chỉnh sửa
                                </button>
                                <button type="button" className="px-2.5 py-1 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 flex items-center justify-center transition-colors text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDelete(layout.id, layout.name)}>
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
