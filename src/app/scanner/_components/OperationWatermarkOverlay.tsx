'use client'

import React, { useEffect, useState } from 'react'

const WATERMARK_ENABLED_KEY = 'solieu_watermark_enabled'
const WEEKDAYS_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
const TARGET_WIDTH = 1080

export interface WatermarkPayload {
  uri: string
  width?: number
  height?: number
  systemCode: string
  jobName?: string | null
  itemName?: string | null
  quantity?: number | null
  unit?: string | null
  direction?: 'in' | 'out' | null
  capturedByName?: string | null
  capturedAt?: Date
}

type WatermarkProcessor = (payload: WatermarkPayload) => Promise<string>

let registeredProcessor: WatermarkProcessor | null = null

export function registerWatermarkProcessor(processor: WatermarkProcessor | null): void {
  registeredProcessor = processor
}

export async function getWatermarkEnabled(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return true
    const raw = window.localStorage.getItem(WATERMARK_ENABLED_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    return true
  }
}

export async function setWatermarkEnabled(enabled: boolean): Promise<void> {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(WATERMARK_ENABLED_KEY, enabled ? 'true' : 'false')
  } catch (err) {
    console.warn('setWatermarkEnabled error:', err)
  }
}

/**
 * Đóng dấu thông tin (ngày giờ, kho, công việc, sản phẩm, số lượng, người chụp) lên ảnh.
 * Nếu tắt watermark hoặc processor chưa sẵn sàng/lỗi thì trả về URI gốc an toàn.
 */
export async function applyOperationWatermark(payload: WatermarkPayload): Promise<string> {
  try {
    const enabled = await getWatermarkEnabled()
    if (!enabled) {
      return payload.uri
    }
    if (registeredProcessor) {
      const stampedUri = await registeredProcessor(payload)
      return stampedUri || payload.uri
    }
    return await renderCanvasWatermark(payload)
  } catch (err) {
    console.warn('applyOperationWatermark fallback to original:', err)
    return payload.uri
  }
}

async function renderCanvasWatermark(payload: WatermarkPayload): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return payload.uri
  }

  return new Promise<string>((resolve) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'

    const timeout = window.setTimeout(() => {
      resolve(payload.uri)
    }, 4500)

    img.onload = () => {
      window.clearTimeout(timeout)
      try {
        const origW = payload.width || img.naturalWidth || TARGET_WIDTH
        const origH = payload.height || img.naturalHeight || Math.round(TARGET_WIDTH * (4 / 3))
        const ratio = origW > 0 ? origH / origW : 4 / 3
        const width = TARGET_WIDTH
        const height = Math.max(600, Math.round(TARGET_WIDTH * ratio))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(payload.uri)
          return
        }

        // Draw base photo
        ctx.drawImage(img, 0, 0, width, height)

        // Format strings matching Android OperationWatermarkOverlay
        const dt = payload.capturedAt || new Date()
        const hh = String(dt.getHours()).padStart(2, '0')
        const mm = String(dt.getMinutes()).padStart(2, '0')
        const dd = String(dt.getDate()).padStart(2, '0')
        const mo = String(dt.getMonth() + 1).padStart(2, '0')
        const timeStr = `${hh}:${mm}`
        const dateStr = `${dd}/${mo}/${dt.getFullYear()}`
        const weekdayStr = WEEKDAYS_VI[dt.getDay()]

        const dirLabel =
          payload.direction === 'in'
            ? 'NHẬP +'
            : payload.direction === 'out'
              ? 'XUẤT -'
              : ''
        const qtyStr =
          payload.quantity != null
            ? `${dirLabel}${payload.quantity}${payload.unit ? ` ${payload.unit}` : ''}`
            : ''

        // Calculate bottom bar height
        const leftLines: { text: string; color: string; font: string }[] = []
        if (payload.jobName) {
          leftLines.push({
            text: `📍 ${payload.jobName}`,
            color: '#ffffff',
            font: '700 26px system-ui, -apple-system, sans-serif',
          })
        }
        if (payload.itemName) {
          leftLines.push({
            text: `📦 ${payload.itemName}`,
            color: '#fde68a',
            font: '700 28px system-ui, -apple-system, sans-serif',
          })
        }
        if (qtyStr) {
          leftLines.push({
            text: `SL: ${qtyStr}`,
            color: payload.direction === 'out' ? '#fda4af' : '#fbbf24',
            font: '800 28px system-ui, -apple-system, sans-serif',
          })
        }

        const barHeight = Math.max(115, leftLines.length * 36 + 34)
        const barTop = height - barHeight

        ctx.fillStyle = 'rgba(0, 0, 0, 0.56)'
        ctx.fillRect(0, barTop, width, barHeight)

        // Left column
        const padX = 28
        let curY = height - 22 - (leftLines.length - 1) * 36
        leftLines.forEach((line) => {
          ctx.font = line.font
          ctx.fillStyle = line.color
          ctx.textAlign = 'left'
          ctx.fillText(line.text, padX, curY, width * 0.62)
          curY += 36
        })

        // Right column
        const rightX = width - padX
        ctx.textAlign = 'right'

        let rightBottomY = height - 20
        if (payload.capturedByName) {
          ctx.font = '600 22px system-ui, -apple-system, sans-serif'
          ctx.fillStyle = '#cbd5e1'
          ctx.fillText(`👤 ${payload.capturedByName}`, rightX, rightBottomY, width * 0.34)
          rightBottomY -= 30
        }

        ctx.font = '600 22px system-ui, -apple-system, sans-serif'
        ctx.fillStyle = '#f1f5f9'
        ctx.fillText(`${dateStr} • ${weekdayStr}`, rightX, rightBottomY, width * 0.34)
        rightBottomY -= 34

        ctx.font = '800 34px system-ui, -apple-system, sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.fillText(timeStr, rightX, rightBottomY, width * 0.34)

        const outDataUrl = canvas.toDataURL('image/jpeg', 0.85)
        resolve(outDataUrl || payload.uri)
      } catch (e) {
        console.warn('Canvas watermark render error:', e)
        resolve(payload.uri)
      }
    }

    img.onerror = () => {
      window.clearTimeout(timeout)
      resolve(payload.uri)
    }

    img.src = payload.uri
  })
}

export default function OperationWatermarkOverlay() {
  const [activeJob, setActiveJob] = useState<WatermarkPayload | null>(null)

  useEffect(() => {
    const processOne = async (payload: WatermarkPayload): Promise<string> => {
      setActiveJob(payload)
      try {
        return await renderCanvasWatermark(payload)
      } finally {
        setActiveJob(null)
      }
    }

    registerWatermarkProcessor(processOne)
    return () => {
      registerWatermarkProcessor(null)
    }
  }, [])

  if (!activeJob) return null

  const dt = activeJob.capturedAt || new Date()
  const hh = String(dt.getHours()).padStart(2, '0')
  const mm = String(dt.getMinutes()).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  const mo = String(dt.getMonth() + 1).padStart(2, '0')
  const timeStr = `${hh}:${mm}`
  const dateStr = `${dd}/${mo}/${dt.getFullYear()}`
  const weekdayStr = WEEKDAYS_VI[dt.getDay()]

  const dirLabel =
    activeJob.direction === 'in'
      ? 'NHẬP +'
      : activeJob.direction === 'out'
        ? 'XUẤT -'
        : ''
  const qtyStr =
    activeJob.quantity != null
      ? `${dirLabel}${activeJob.quantity}${activeJob.unit ? ` ${activeJob.unit}` : ''}`
      : ''

  return (
    <div
      className="fixed -left-[9999px] top-0 pointer-events-none select-none overflow-hidden"
      aria-hidden="true"
    >
      <div className="w-[540px] bg-black relative overflow-hidden">
        <div className="bg-black/55 px-4 py-3 flex items-end justify-between gap-3">
          <div className="flex-1 flex flex-col items-start justify-end gap-0.5 min-w-0">
            {activeJob.jobName && (
              <div className="text-white text-[15px] font-bold truncate w-full">
                📍 {activeJob.jobName}
              </div>
            )}
            {activeJob.itemName && (
              <div className="text-[#fde68a] text-[16px] font-bold truncate w-full">
                📦 {activeJob.itemName}
              </div>
            )}
            {qtyStr && (
              <div
                className="text-[16px] font-extrabold truncate w-full"
                style={{ color: activeJob.direction === 'out' ? '#fda4af' : '#fbbf24' }}
              >
                SL: {qtyStr}
              </div>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end justify-end gap-0.5 text-right">
            <div className="text-white text-[19px] font-extrabold tracking-tight">{timeStr}</div>
            <div className="text-[#f1f5f9] text-[12px] font-semibold">
              {dateStr} • {weekdayStr}
            </div>
            {activeJob.capturedByName && (
              <div className="text-[#cbd5e1] text-[12px] font-semibold truncate max-w-[180px]">
                👤 {activeJob.capturedByName}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
