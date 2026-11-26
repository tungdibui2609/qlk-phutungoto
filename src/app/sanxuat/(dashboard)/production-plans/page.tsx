'use client'

import React from 'react'
import ProductionPlansView from '@/components/production-plans/ProductionPlansView'

export default function SanxuatProductionPlansPage() {
    return (
        <div className="px-4 pt-4">
            <ProductionPlansView isSanxuatPortal={true} />
        </div>
    )
}
