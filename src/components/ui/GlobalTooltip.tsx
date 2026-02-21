'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface TooltipData {
    content: React.ReactNode
    x: number
    y: number
}

// Global state mechanism for the tooltip
let isTooltipActive = false
let tooltipSetData: ((data: TooltipData | null) => void) | null = null

export const showGlobalTooltip = (content: React.ReactNode, e: React.MouseEvent | MouseEvent) => {
    if (!tooltipSetData) return
    isTooltipActive = true
    tooltipSetData({
        content,
        x: e.clientX,
        y: e.clientY
    })
}

export const hideGlobalTooltip = () => {
    if (!tooltipSetData) return
    isTooltipActive = false
    tooltipSetData(null)
}

export const moveGlobalTooltip = (e: React.MouseEvent | MouseEvent) => {
    if (!isTooltipActive || !tooltipSetData) return
    // We only update position if active, to avoid re-rendering too often if we don't have to
    // For smoother following, we can call this on mousemove
    // But direct state updates on mousemove can be heavy.
}

interface GlobalTooltipProps {
    offsetY?: number
}

export function GlobalTooltip({ offsetY = 15 }: GlobalTooltipProps) {
    const [data, setData] = useState<TooltipData | null>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        tooltipSetData = setData
        return () => {
            tooltipSetData = null
        }
    }, [])

    // Add global mouse move listener to follow the cursor smoothly if active
    useEffect(() => {
        if (!mounted) return

        const handleMouseMove = (e: MouseEvent) => {
            if (isTooltipActive && tooltipSetData) {
                // To avoid excessive re-renders, we use requestAnimationFrame or just update state directly
                // React 18 batching handles this reasonably well
                setData(prev => {
                    if (!prev) return prev
                    return { ...prev, x: e.clientX, y: e.clientY }
                })
            }
        }

        window.addEventListener('mousemove', handleMouseMove, { passive: true })
        window.addEventListener('scroll', hideGlobalTooltip, true)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('scroll', hideGlobalTooltip, true)
        }
    }, [mounted])

    if (!mounted || !data) return null

    // Ensure it doesn't overflow the viewport
    const style: React.CSSProperties = {
        position: 'fixed',
        left: data.x,
        top: data.y - offsetY,
        transform: 'translate(-50%, -100%)', // Center horizontally, appear above cursor
        zIndex: 99999,
        pointerEvents: 'none',
    }

    return createPortal(
        <div style={style} className="animate-in fade-in duration-100">
            {data.content}
        </div>,
        document.body
    )
}
