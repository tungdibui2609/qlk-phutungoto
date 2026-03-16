'use client'
import React from 'react'
import { Tag } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import ProductionCodeSettings from '@/components/sanxuat/production-codes/ProductionCodeSettings'

export default function ProductionCodesPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Quản lý mã sản xuất"
                subtitle="Production Code Management"
                description="Thiết lập các cấp độ và quy tắc mã sản xuất tập trung cho toàn bộ hệ thống xưởng."
                icon={Tag}
                permission="production.manage"
            />

            <div className="animate-fade-in">
                <ProductionCodeSettings />
            </div>
        </div>
    )
}
