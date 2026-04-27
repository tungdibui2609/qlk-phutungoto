'use client';

import React, { useState } from 'react';
import ZoneManager from '@/components/warehouse/ZoneManager'
import LayoutManager from '@/components/warehouse/layout-manager/LayoutManager'

import { useSystem } from '@/contexts/SystemContext';

export default function InfrastructurePage() {
    const { hasModule } = useSystem();
    const is2DLayoutEnabled = hasModule('warehouse_layout_2d');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {is2DLayoutEnabled ? 'Quản lý Sơ đồ Kho 2D' : 'Quản lý Cấu trúc Kho'}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    {is2DLayoutEnabled 
                        ? 'Thiết kế mặt bằng kho dạng AutoCAD 2D'
                        : 'Thiết kế sơ đồ kho, tạo khu vực và vị trí lưu trữ'
                    }
                </p>
            </div>

            {/* Main Content */}
            <div className="w-full">
                {is2DLayoutEnabled ? <LayoutManager /> : <ZoneManager />}
            </div>
        </div>
    )
}
