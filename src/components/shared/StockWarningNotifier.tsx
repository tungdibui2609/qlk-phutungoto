'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'

export default function StockWarningNotifier() {
    const { systemType, hasModule } = useSystem()
    const { showToast } = useToast()
    const processingRef = useRef<Set<string>>(new Set())

    const isStockWarningEnabled = hasModule('stock_warning')

    const pendingBatchRef = useRef<Set<string>>(new Set())
    const batchTimerRef = useRef<NodeJS.Timeout | null>(null)

    const triggerBatchAlert = async () => {
        if (pendingBatchRef.current.size === 0) return
        
        const idsToSend = Array.from(pendingBatchRef.current)
        pendingBatchRef.current.clear()
        batchTimerRef.current = null

        try {
            const response = await fetch('/api/stock-alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productIds: idsToSend, systemCode: systemType })
            })
            
            const result = await response.json()
            
            if (result.success && result.count > 0) {
                showToast(`Cảnh báo: Có ${result.count} sản phẩm sắp hết hàng! Đã gửi mail tổng hợp.`, 'warning')
            }
        } catch (error) {
            console.error('Error triggering batch stock alert:', error)
        }
    }

    const queueForCheck = (productId: string) => {
        // Only queue if not already in a pending batch or recently processed
        // In this upgraded version, we rely more on the API's 4h throttle,
        // but we still want to avoid spamming the same batch.
        pendingBatchRef.current.add(productId)
        
        if (batchTimerRef.current) clearTimeout(batchTimerRef.current)
        batchTimerRef.current = setTimeout(triggerBatchAlert, 5000) // 5 second buffer
    }

    useEffect(() => {
        if (!isStockWarningEnabled) return

        // 1. Initial check on mount
        const initialCheck = async () => {
            const { data: products } = await supabase
                .from('products' as any)
                .select('id, min_stock_level, critical_stock_level')
                .eq('system_type', systemType)
                .or('min_stock_level.gt.0,critical_stock_level.gt.0')
                .eq('is_active', true)

            if (products) {
                for (const p of (products as any[])) {
                    queueForCheck(p.id)
                }
            }
        }

        initialCheck()

        // 2. Realtime subscription to LOT changes
        // When a lot is updated (quantity changed), check the associated product
        const channel = supabase
            .channel('stock-warning-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'lots',
                    filter: `system_code=eq.${systemType}`
                },
                (payload) => {
                    const productId = (payload.new as any)?.product_id || (payload.old as any)?.product_id
                    if (productId) {
                        queueForCheck(productId)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [isStockWarningEnabled, systemType])

    // This component renders nothing
    return null
}
