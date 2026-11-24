'use client'

import React, { useEffect, useState } from 'react'
import {
  X,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Code2,
  RefreshCw,
  Mic,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from '@/lib/operationDriveSync'

interface Props {
  open: boolean
  systemCode: string
  companyId?: string | null
  userId?: string | null
  onClose: () => void
  onSaved?: (isConnected: boolean) => void
}

export default function InventoryVoiceDriveModal({
  open,
  systemCode,
  companyId,
  userId,
  onClose,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [rootFolderName, setRootFolderName] = useState('WMS_GhiAm_KiemKe')
  const [isEnabled, setIsEnabled] = useState(true)
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [showScript, setShowScript] = useState(false)
  const [copiedScript, setCopiedScript] = useState(false)
  const [copyingFromOps, setCopyingFromOps] = useState(false)

  useEffect(() => {
    if (!open || !systemCode) return
    let cancelled = false
    setLoading(true)
    setTestMessage(null)
    ;(supabase as any)
      .from('inventory_voice_drive_settings')
      .select('*')
      .eq('system_code', systemCode)
      .maybeSingle()
      .then(({ data }: any) => {
        if (cancelled) return
        if (data) {
          setWebhookUrl(data.webhook_url || '')
          setRootFolderName(data.root_folder_name || 'WMS_GhiAm_KiemKe')
          setIsEnabled(data.is_enabled !== false)
        } else {
          setWebhookUrl('')
          setRootFolderName('WMS_GhiAm_KiemKe')
          setIsEnabled(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, systemCode])

  if (!open) return null

  const handleCopyFromOperationsDrive = async () => {
    setCopyingFromOps(true)
    setTestMessage(null)
    try {
      const { data } = await (supabase as any)
        .from('operation_drive_settings')
        .select('webhook_url')
        .eq('system_code', systemCode)
        .maybeSingle()

      if (data?.webhook_url) {
        setWebhookUrl(data.webhook_url)
        setTestMessage({
          ok: true,
          text: 'Đã lấy URL Apps Script từ cài đặt Drive của Số liệu (vẫn lưu vào thư mục riêng WMS_GhiAm_KiemKe).',
        })
      } else {
        setTestMessage({
          ok: false,
          text: `Phân hệ ${systemCode} chưa có Webhook trong cài đặt Số liệu.`,
        })
      }
    } finally {
      setCopyingFromOps(false)
    }
  }

  const handleTestPing = async () => {
    const url = webhookUrl.trim()
    if (!url.startsWith('http')) {
      setTestMessage({ ok: false, text: 'Vui lòng nhập URL Google Apps Script hợp lệ.' })
      return
    }
    setTesting(true)
    setTestMessage(null)
    try {
      const res = await fetch('/api/operations/drive-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: url,
          rootFolder: rootFolderName.trim() || 'WMS_GhiAm_KiemKe',
          action: 'ping',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.success || res.ok) {
        setTestMessage({
          ok: true,
          text: data?.message || 'Kết nối Google Drive thành công!',
        })
      } else {
        setTestMessage({
          ok: false,
          text: data?.error || 'Không thể kết nối tới Apps Script Webhook.',
        })
      }
    } catch (e: any) {
      setTestMessage({ ok: false, text: e?.message || 'Lỗi kết nối mạng.' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setTestMessage(null)
    try {
      const cleanUrl = webhookUrl.trim()
      const cleanFolder = rootFolderName.trim() || 'WMS_GhiAm_KiemKe'
      const { error } = await (supabase as any)
        .from('inventory_voice_drive_settings')
        .upsert(
          {
            system_code: systemCode,
            company_id: companyId || null,
            webhook_url: cleanUrl || null,
            root_folder_name: cleanFolder,
            is_enabled: isEnabled,
            updated_by: userId || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'system_code' }
        )

      if (error) throw error
      onSaved?.(Boolean(isEnabled && cleanUrl.startsWith('http')))
      onClose()
    } catch (e: any) {
      setTestMessage({ ok: false, text: 'Lỗi lưu cấu hình: ' + (e?.message || e) })
    } finally {
      setSaving(false)
    }
  }

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(
        GOOGLE_APPS_SCRIPT_TEMPLATE.replace(/WMS_HinhAnh_Kho/g, rootFolderName.trim() || 'WMS_GhiAm_KiemKe')
      )
      setCopiedScript(true)
      setTimeout(() => setCopiedScript(false), 2000)
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-[80] bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-stone-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <HardDrive size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-stone-800 flex items-center gap-2">
                <span>Cài đặt Google Drive — Ghi âm Kiểm kê</span>
              </h2>
              <p className="text-xs text-stone-500">
                Phân hệ: <strong className="text-stone-700">{systemCode}</strong> · File ghi âm kiểm kê sẽ lưu trực tiếp lên Google Drive (không tốn dung lượng Supabase)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-200/60 text-stone-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {loading ? (
            <div className="py-10 flex items-center justify-center gap-2 text-stone-500 text-sm">
              <Loader2 size={18} className="animate-spin" />
              <span>Đang tải cấu hình...</span>
            </div>
          ) : (
            <>
              {/* Toggle bật/tắt */}
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 border border-stone-200 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Mic size={16} className="text-purple-600" />
                  <div>
                    <div className="text-sm font-bold text-stone-800">
                      Lưu file ghi âm kiểm kê lên Google Drive
                    </div>
                    <div className="text-xs text-stone-500">
                      Khi đồng bộ từ Scanner, file ghi âm sẽ tự đẩy lên Drive và phát lại trực tiếp tại báo cáo kiểm kê
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={e => setIsEnabled(e.target.checked)}
                  className="w-5 h-5 accent-purple-600 rounded"
                />
              </label>

              {/* Webhook URL */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-stone-700 uppercase tracking-wide">
                    Google Apps Script Web App URL
                  </label>
                  <button
                    type="button"
                    disabled={copyingFromOps}
                    onClick={handleCopyFromOperationsDrive}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                  >
                    <RefreshCw size={12} className={copyingFromOps ? 'animate-spin' : ''} />
                    <span>Dùng chung URL từ Số liệu</span>
                  </button>
                </div>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                />
              </div>

              {/* Root folder */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-stone-700 uppercase tracking-wide">
                  Tên thư mục gốc trên Google Drive
                </label>
                <input
                  type="text"
                  value={rootFolderName}
                  onChange={e => setRootFolderName(e.target.value)}
                  placeholder="WMS_GhiAm_KiemKe"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                />
                <p className="text-[11px] text-stone-500">
                  Tự động phân nhánh: <code className="bg-stone-100 px-1 rounded">{rootFolderName || 'WMS_GhiAm_KiemKe'}/{systemCode}/YYYY-MM/YYYY-MM-DD/Phiên</code>
                </p>
              </div>

              {/* Test & Script template */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={testing || !webhookUrl.trim()}
                  onClick={handleTestPing}
                  className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {testing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Kiểm tra kết nối</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowScript(v => !v)}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1.5"
                >
                  <Code2 size={14} />
                  <span>{showScript ? 'Ẩn mã Apps Script' : 'Xem mã Apps Script mẫu'}</span>
                </button>
              </div>

              {testMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
                    testMessage.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {testMessage.ok ? (
                    <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  )}
                  <span>{testMessage.text}</span>
                </div>
              )}

              {showScript && (
                <div className="rounded-2xl border border-stone-200 bg-stone-900 text-stone-100 overflow-hidden">
                  <div className="px-3 py-2 bg-stone-800 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-300">
                      Code.gs (Google Apps Script)
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="px-2.5 py-1 rounded-lg bg-stone-700 hover:bg-stone-600 text-white text-[11px] font-bold flex items-center gap-1"
                    >
                      {copiedScript ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedScript ? 'Đã chép' : 'Sao chép mã'}</span>
                    </button>
                  </div>
                  <pre className="p-3 text-[11px] overflow-x-auto max-h-56 leading-relaxed">
                    {GOOGLE_APPS_SCRIPT_TEMPLATE.replace(
                      /WMS_HinhAnh_Kho/g,
                      rootFolderName.trim() || 'WMS_GhiAm_KiemKe'
                    )}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/70 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-stone-200 text-stone-600 text-sm font-bold hover:bg-stone-100"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            <span>Lưu cấu hình</span>
          </button>
        </div>
      </div>
    </div>
  )
}
