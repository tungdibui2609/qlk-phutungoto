'use client'

import React from 'react'
import MobileLotList from './MobileLotList'
import { useUser } from '@/contexts/UserContext'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { useInventoryByLot } from './by-lot/useInventoryByLot'
import { InventoryFilters } from './by-lot/InventoryFilters'
import { InventoryTable } from './by-lot/InventoryTable'

export default function InventoryByLot({ units, hookData, hideFilters, viewMode = 'lot' }: { units: any[], hookData?: any, hideFilters?: boolean, viewMode?: 'lot' | 'month' }) {
    const internalHookData = useInventoryByLot(units, { viewMode })
    const activeHookData = hookData || internalHookData

    const {
        loading,
        searchTerm,
        setSearchTerm,
        selectedBranch,
        setSelectedBranch,
        selectedZoneId,
        setSelectedZoneId,
        allZones,
        targetUnitId,
        setTargetUnitId,
        branches,
        groupedInventory,
        expandedProducts,
        toggleExpand,
        systemType
    } = activeHookData

    // Use company info for printing params (Managed here or could be moved to Filters)
    const { profile } = useUser()
    const { companyInfo, loading: loadingCompany } = usePrintCompanyInfo({
        orderCompanyId: profile?.company_id
    })

    return (
        <div className="space-y-4">
            {/* Filters */}
            {!hideFilters && (
                <InventoryFilters
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    selectedBranch={selectedBranch}
                    setSelectedBranch={setSelectedBranch}
                    branches={branches}
                    targetUnitId={targetUnitId}
                    setTargetUnitId={setTargetUnitId}
                    units={units}
                    systemType={systemType ?? ''}
                    companyInfo={companyInfo}
                    loadingCompany={loadingCompany}
                    selectedZoneId={selectedZoneId}
                    setSelectedZoneId={setSelectedZoneId}
                    allZones={allZones}
                />
            )}

            {/* Mobile List */}
            <div className="md:hidden">
                <MobileLotList
                    items={groupedInventory}
                    expandedProducts={expandedProducts}
                    toggleExpand={toggleExpand}
                    viewMode={viewMode}
                />
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
                <InventoryTable
                    groupedInventory={groupedInventory}
                    expandedProducts={expandedProducts}
                    toggleExpand={toggleExpand}
                    loading={loading}
                    viewMode={viewMode}
                />
            </div>
        </div>
    )
}
