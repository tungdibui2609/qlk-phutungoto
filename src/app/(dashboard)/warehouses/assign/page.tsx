'use client'

import { MobileProvider } from '@/contexts/MobileContext'
import WarehouseAssignContent from './_components/WarehouseAssignContent'

export default function WarehouseAssignPage() {
    return (
        <MobileProvider>
            <WarehouseAssignContent />
        </MobileProvider>
    )
}
