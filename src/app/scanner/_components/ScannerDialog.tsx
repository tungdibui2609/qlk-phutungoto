'use client'

import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

export type ScannerDialogVariant = 'info' | 'success' | 'warning' | 'danger' | 'celebrate'

export interface ScannerDialogOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: ScannerDialogVariant
}

interface DialogQueueItem extends ScannerDialogOptions {
  mode: 'alert' | 'confirm'
  resolve: (value: boolean) => void
}

type Listener = (item: DialogQueueItem | null) => void

const queue: DialogQueueItem[] = []
let activeItem: DialogQueueItem | null = null
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach(fn => fn(activeItem))
}

function pumpQueue() {
  if (!activeItem && queue.length > 0) {
    activeItem = queue.shift() || null
    notify()
  }
}

export function scannerAlert(
  messageOrOptions: string | ScannerDialogOptions
): Promise<void> {
  const opts: ScannerDialogOptions =
    typeof messageOrOptions === 'string'
      ? { message: messageOrOptions }
      : messageOrOptions

  return new Promise(resolve => {
    queue.push({
      mode: 'alert',
      title: opts.title,
      message: opts.message,
      confirmText: opts.confirmText || 'Đã hiểu',
      variant: opts.variant || inferVariant(opts.message),
      resolve: () => resolve(),
    })
    pumpQueue()
  })
}

export function scannerConfirm(
  messageOrOptions: string | ScannerDialogOptions
): Promise<boolean> {
  const opts: ScannerDialogOptions =
    typeof messageOrOptions === 'string'
      ? { message: messageOrOptions }
      : messageOrOptions

  return new Promise(resolve => {
    queue.push({
      mode: 'confirm',
      title: opts.title,
      message: opts.message,
      confirmText: opts.confirmText || 'Xác nhận',
      cancelText: opts.cancelText || 'Huỷ',
      variant: opts.variant || inferVariant(opts.message),
      resolve,
    })
    pumpQueue()
  })
}

function inferVariant(msg: string): ScannerDialogVariant {
  const lower = (msg || '').toLowerCase()
  if (lower.includes('đã đủ pallet') || lower.includes('chốt pallet') || lower.includes('🎉')) {
    return 'celebrate'
  }
  if (lower.includes('xóa') || lower.includes('xoá') || lower.includes('lỗi')) {
    return lower.includes('xóa') || lower.includes('xoá') ? 'danger' : 'warning'
  }
  if (lower.includes('thành công') || lower.includes('✅')) {
    return 'success'
  }
  return 'info'
}

const VARIANT_STYLES: Record<
  ScannerDialogVariant,
  {
    border: string
    iconBg: string
    iconColor: string
    confirmBtn: string
    defaultTitle: string
  }
> = {
  celebrate: {
    border: 'border-emerald-500/50 shadow-emerald-950/60',
    iconBg: 'bg-emerald-500/15 border-emerald-500/40',
    iconColor: 'text-emerald-400',
    confirmBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30',
    defaultTitle: 'Hoàn thành Pallet',
  },
  success: {
    border: 'border-emerald-500/40 shadow-emerald-950/40',
    iconBg: 'bg-emerald-500/15 border-emerald-500/30',
    iconColor: 'text-emerald-400',
    confirmBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25',
    defaultTitle: 'Thông báo',
  },
  warning: {
    border: 'border-amber-500/45 shadow-amber-950/40',
    iconBg: 'bg-amber-500/15 border-amber-500/35',
    iconColor: 'text-amber-400',
    confirmBtn: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25',
    defaultTitle: 'Lưu ý',
  },
  danger: {
    border: 'border-rose-500/45 shadow-rose-950/40',
    iconBg: 'bg-rose-500/15 border-rose-500/35',
    iconColor: 'text-rose-400',
    confirmBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25',
    defaultTitle: 'Xác nhận thao tác',
  },
  info: {
    border: 'border-sky-500/40 shadow-slate-950/60',
    iconBg: 'bg-sky-500/15 border-sky-500/30',
    iconColor: 'text-sky-400',
    confirmBtn: 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/25',
    defaultTitle: 'Thông báo',
  },
}

function VariantIcon({ variant, className }: { variant: ScannerDialogVariant; className?: string }) {
  switch (variant) {
    case 'celebrate':
      return <Sparkles size={22} className={className} />
    case 'success':
      return <CheckCircle2 size={22} className={className} />
    case 'warning':
      return <AlertTriangle size={22} className={className} />
    case 'danger':
      return <Trash2 size={22} className={className} />
    default:
      return <Info size={22} className={className} />
  }
}

export function ScannerDialogHost() {
  const [item, setItem] = useState<DialogQueueItem | null>(activeItem)

  useEffect(() => {
    const listener: Listener = next => setItem(next)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const closeWith = (result: boolean) => {
    if (!activeItem) return
    const current = activeItem
    activeItem = null
    notify()
    current.resolve(result)
    pumpQueue()
  }

  useEffect(() => {
    if (!item) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeWith(false)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        closeWith(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [item])

  if (!item) return null

  const variant = item.variant || 'info'
  const st = VARIANT_STYLES[variant]
  const displayTitle = item.title || st.defaultTitle

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => {
        if (item.mode === 'alert') closeWith(true)
      }}
    >
      <div
        className={`w-full max-w-sm bg-[#0f172a] border ${st.border} rounded-2xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-11 h-11 rounded-xl border ${st.iconBg} flex items-center justify-center shrink-0`}
          >
            {item.mode === 'confirm' && variant === 'info' ? (
              <HelpCircle size={22} className={st.iconColor} />
            ) : (
              <VariantIcon variant={variant} className={st.iconColor} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-white leading-snug">{displayTitle}</h3>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line mt-1.5">
              {item.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => closeWith(false)}
            className="p-1 rounded-lg text-slate-500 hover:text-white shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 pt-1">
          {item.mode === 'confirm' && (
            <button
              type="button"
              onClick={() => closeWith(false)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition active:scale-[0.98]"
            >
              {item.cancelText || 'Huỷ'}
            </button>
          )}
          <button
            type="button"
            onClick={() => closeWith(true)}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition active:scale-[0.98] ${st.confirmBtn}`}
          >
            {item.confirmText || (item.mode === 'confirm' ? 'Xác nhận' : 'Đã hiểu')}
          </button>
        </div>
      </div>
    </div>
  )
}
