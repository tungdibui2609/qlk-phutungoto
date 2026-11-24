'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Sparkles,
  HardDrive,
  Camera,
  Mic,
  Stamp,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Code2,
  RefreshCw,
  Plug,
  Plus,
  Trash2,
  Mail,
  ExternalLink,
  BookOpen,
  ArrowRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { parseGeminiApiKeys } from '@/lib/stampDecoder'
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from '@/lib/operationDriveSync'

type PingResult = { ok: boolean; text: string; rootUrl?: string | null } | null
type ActiveTab = 'overview' | 'gemini' | 'stamp_drive' | 'ops_drive' | 'voice_drive'

interface GeminiKeyRow {
  id: string
  key: string
  account: string
  note: string
}

function maskKeyShort(k: string): string {
  const s = k.trim()
  if (s.length <= 14) return s
  return `${s.slice(0, 8)}...${s.slice(-4)}`
}

export default function IntegrationsPage() {
  const { systemType, currentSystem } = useSystem()
  const { profile } = useUser()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const [loading, setLoading] = useState(true)

  // 1. Gemini AI & Drive Ảnh Dấu Đóng (company_ai_settings)
  const [geminiRows, setGeminiRows] = useState<GeminiKeyRow[]>([])
  const [aiModel, setAiModel] = useState('gemini-2.5-flash')
  const [aiEnabled, setAiEnabled] = useState(true)
  const [stampDriveUrl, setStampDriveUrl] = useState('')
  const [stampDriveAccount, setStampDriveAccount] = useState('')
  const [stampDriveNote, setStampDriveNote] = useState('')
  const [stampDriveRootUrl, setStampDriveRootUrl] = useState('')
  const [showKeys, setShowKeys] = useState(false)
  const [savingAi, setSavingAi] = useState(false)
  const [testingGeminiKeys, setTestingGeminiKeys] = useState(false)
  const [geminiTestResults, setGeminiTestResults] = useState<
    { index: number; masked: string; status: 'ok' | 'quota' | 'invalid' | 'error'; message: string }[]
  >([])
  const [testingStampDrive, setTestingStampDrive] = useState(false)
  const [stampPing, setStampPing] = useState<PingResult>(null)

  // 2. Drive Ảnh Số Liệu (operation_drive_settings)
  const [opsDriveUrl, setOpsDriveUrl] = useState('')
  const [opsRootFolder, setOpsRootFolder] = useState('WMS_HinhAnh_Kho')
  const [opsAutoSync, setOpsAutoSync] = useState(false)
  const [opsAutoDeleteDays, setOpsAutoDeleteDays] = useState<string>('')
  const [opsAccount, setOpsAccount] = useState('')
  const [opsNote, setOpsNote] = useState('')
  const [opsRootUrl, setOpsRootUrl] = useState('')
  const [savingOpsDrive, setSavingOpsDrive] = useState(false)
  const [testingOpsDrive, setTestingOpsDrive] = useState(false)
  const [opsPing, setOpsPing] = useState<PingResult>(null)

  // 3. Drive Ghi Âm Kiểm Kê (inventory_voice_drive_settings)
  const [voiceDriveUrl, setVoiceDriveUrl] = useState('')
  const [voiceRootFolder, setVoiceRootFolder] = useState('WMS_GhiAm_KiemKe')
  const [voiceDriveEnabled, setVoiceDriveEnabled] = useState(true)
  const [voiceAccount, setVoiceAccount] = useState('')
  const [voiceNote, setVoiceNote] = useState('')
  const [voiceRootUrl, setVoiceRootUrl] = useState('')
  const [savingVoiceDrive, setSavingVoiceDrive] = useState(false)
  const [testingVoiceDrive, setTestingVoiceDrive] = useState(false)
  const [voicePing, setVoicePing] = useState<PingResult>(null)

  // Apps Script template
  const [showScript, setShowScript] = useState(false)
  const [copiedScript, setCopiedScript] = useState(false)

  const validGeminiKeys = useMemo(
    () => geminiRows.map(r => r.key.trim()).filter(Boolean),
    [geminiRows]
  )
  const parsedKeysCount = validGeminiKeys.length

  const loadAllSettings = useCallback(async () => {
    if (!systemType) return
    setLoading(true)
    try {
      const [aiRes, opsRes, voiceRes] = await Promise.all([
        (supabase as any)
          .from('company_ai_settings')
          .select(
            'gemini_api_key, gemini_model, is_enabled, drive_webhook_url, gemini_key_labels, stamp_drive_account, stamp_drive_note, stamp_drive_root_url'
          )
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from('operation_drive_settings')
          .select('*')
          .eq('system_code', systemType)
          .maybeSingle(),
        (supabase as any)
          .from('inventory_voice_drive_settings')
          .select('*')
          .eq('system_code', systemType)
          .maybeSingle(),
      ])

      if (aiRes?.data) {
        const keys = parseGeminiApiKeys(aiRes.data.gemini_api_key || '')
        const labelsMap: Record<string, { account?: string; note?: string }> =
          aiRes.data.gemini_key_labels && typeof aiRes.data.gemini_key_labels === 'object'
            ? aiRes.data.gemini_key_labels
            : {}
        setGeminiRows(
          keys.length > 0
            ? keys.map((k, idx) => ({
                id: `gk_${idx}_${Date.now()}`,
                key: k,
                account: labelsMap[k]?.account || '',
                note: labelsMap[k]?.note || '',
              }))
            : [{ id: `gk_0_${Date.now()}`, key: '', account: '', note: '' }]
        )
        setAiModel(aiRes.data.gemini_model || 'gemini-2.5-flash')
        setAiEnabled(aiRes.data.is_enabled !== false)
        setStampDriveUrl(aiRes.data.drive_webhook_url || '')
        setStampDriveAccount(aiRes.data.stamp_drive_account || '')
        setStampDriveNote(aiRes.data.stamp_drive_note || '')
        setStampDriveRootUrl(aiRes.data.stamp_drive_root_url || '')
      } else {
        setGeminiRows([{ id: `gk_0_${Date.now()}`, key: '', account: '', note: '' }])
        setAiModel('gemini-2.5-flash')
        setAiEnabled(true)
        setStampDriveUrl('')
        setStampDriveAccount('')
        setStampDriveNote('')
        setStampDriveRootUrl('')
      }

      if (opsRes?.data) {
        setOpsDriveUrl(opsRes.data.webhook_url || '')
        setOpsRootFolder(opsRes.data.root_folder_name || 'WMS_HinhAnh_Kho')
        setOpsAutoSync(!!opsRes.data.auto_sync_enabled)
        setOpsAutoDeleteDays(
          opsRes.data.auto_delete_local_days != null ? String(opsRes.data.auto_delete_local_days) : ''
        )
        setOpsAccount(opsRes.data.account_email || '')
        setOpsNote(opsRes.data.account_note || '')
        setOpsRootUrl(opsRes.data.root_folder_url || '')
      } else {
        setOpsDriveUrl('')
        setOpsRootFolder('WMS_HinhAnh_Kho')
        setOpsAutoSync(false)
        setOpsAutoDeleteDays('')
        setOpsAccount('')
        setOpsNote('')
        setOpsRootUrl('')
      }

      if (voiceRes?.data) {
        setVoiceDriveUrl(voiceRes.data.webhook_url || '')
        setVoiceRootFolder(voiceRes.data.root_folder_name || 'WMS_GhiAm_KiemKe')
        setVoiceDriveEnabled(voiceRes.data.is_enabled !== false)
        setVoiceAccount(voiceRes.data.account_email || '')
        setVoiceNote(voiceRes.data.account_note || '')
        setVoiceRootUrl(voiceRes.data.root_folder_url || '')
      } else {
        setVoiceDriveUrl('')
        setVoiceRootFolder('WMS_GhiAm_KiemKe')
        setVoiceDriveEnabled(true)
        setVoiceAccount('')
        setVoiceNote('')
        setVoiceRootUrl('')
      }
    } catch (e: any) {
      showToast('Không thể tải cấu hình kết nối: ' + (e?.message || e), 'error')
    } finally {
      setLoading(false)
    }
  }, [systemType, showToast])

  useEffect(() => {
    void loadAllSettings()
  }, [loadAllSettings])

  const pingDriveWebhook = async (
    webhookUrl: string,
    rootFolder: string,
    setBusy: (v: boolean) => void,
    setResult: (r: PingResult) => void,
    onRootUrl?: (url: string) => void
  ) => {
    const url = webhookUrl.trim()
    if (!url.startsWith('http')) {
      setResult({
        ok: false,
        text: 'Vui lòng nhập URL Google Apps Script hợp lệ (https://script.google.com/...).',
      })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/operations/drive-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: url,
          rootFolder: rootFolder.trim() || 'WMS_HinhAnh_Kho',
          action: 'ping',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.success || res.ok) {
        const rootUrl = data?.rootUrl ? String(data.rootUrl) : null
        if (rootUrl && onRootUrl) onRootUrl(rootUrl)
        setResult({
          ok: true,
          text: data?.message || 'Kết nối Google Drive thành công!',
          rootUrl,
        })
      } else {
        setResult({ ok: false, text: data?.error || 'Apps Script không phản hồi thành công.' })
      }
    } catch (e: any) {
      setResult({ ok: false, text: e?.message || 'Lỗi kết nối mạng.' })
    } finally {
      setBusy(false)
    }
  }

  const handleTestGeminiKeys = async () => {
    if (validGeminiKeys.length === 0) {
      showToast('Vui lòng nhập ít nhất 1 Gemini API Key trước khi test', 'warning')
      return
    }
    setTestingGeminiKeys(true)
    setGeminiTestResults([])
    try {
      const res = await fetch('/api/ai/test-gemini-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKeys: validGeminiKeys,
          model: aiModel.trim() || 'gemini-2.5-flash',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !Array.isArray(data?.results)) {
        showToast(data?.error || 'Không thể kiểm tra API Key', 'error')
        return
      }
      setGeminiTestResults(data.results)
      const okCount = data.results.filter((r: any) => r.status === 'ok').length
      showToast(
        `Kết quả test: ${okCount}/${data.results.length} key hoạt động tốt`,
        okCount > 0 ? 'success' : 'error'
      )
    } catch (e: any) {
      showToast('Lỗi kiểm tra key: ' + (e?.message || e), 'error')
    } finally {
      setTestingGeminiKeys(false)
    }
  }

  const handleSaveCompanyAi = async (successLabel = 'Đã lưu cấu hình!') => {
    setSavingAi(true)
    try {
      const companyId = profile?.company_id
      if (!companyId) throw new Error('Không xác định được công ty của tài khoản hiện tại')

      const cleanRows = geminiRows
        .map(r => ({
          key: r.key.trim(),
          account: r.account.trim(),
          note: r.note.trim(),
        }))
        .filter(r => r.key.length > 0)

      const keyString = cleanRows.map(r => r.key).join('\n')
      const keyLabels: Record<string, { account: string; note: string }> = {}
      cleanRows.forEach(r => {
        if (r.account || r.note) {
          keyLabels[r.key] = { account: r.account, note: r.note }
        }
      })

      const { error } = await (supabase as any).from('company_ai_settings').upsert(
        {
          company_id: companyId,
          gemini_api_key: keyString || null,
          gemini_key_labels: keyLabels,
          gemini_model: aiModel.trim() || 'gemini-2.5-flash',
          is_enabled: aiEnabled,
          drive_webhook_url: stampDriveUrl.trim() || null,
          stamp_drive_account: stampDriveAccount.trim() || null,
          stamp_drive_note: stampDriveNote.trim() || null,
          stamp_drive_root_url: stampDriveRootUrl.trim() || null,
          updated_by: profile?.id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' }
      )
      if (error) throw error
      showToast(successLabel, 'success')
    } catch (e: any) {
      showToast('Lỗi lưu cấu hình: ' + (e?.message || e), 'error')
    } finally {
      setSavingAi(false)
    }
  }

  const handleSaveOpsDrive = async () => {
    setSavingOpsDrive(true)
    try {
      const daysNum = opsAutoDeleteDays.trim() ? Number(opsAutoDeleteDays.trim()) : null
      const { error } = await (supabase as any).from('operation_drive_settings').upsert(
        {
          system_code: systemType,
          company_id: profile?.company_id || null,
          webhook_url: opsDriveUrl.trim(),
          root_folder_name: opsRootFolder.trim() || 'WMS_HinhAnh_Kho',
          auto_sync_enabled: opsAutoSync,
          auto_delete_local_days: daysNum && daysNum > 0 ? daysNum : null,
          account_email: opsAccount.trim() || null,
          account_note: opsNote.trim() || null,
          root_folder_url: opsRootUrl.trim() || null,
          updated_by: profile?.id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'system_code' }
      )
      if (error) throw error
      showToast(`Đã lưu cài đặt Google Drive Ảnh Số liệu (${systemType})!`, 'success')
    } catch (e: any) {
      showToast('Lỗi lưu Drive Số liệu: ' + (e?.message || e), 'error')
    } finally {
      setSavingOpsDrive(false)
    }
  }

  const handleSaveVoiceDrive = async () => {
    setSavingVoiceDrive(true)
    try {
      const { error } = await (supabase as any).from('inventory_voice_drive_settings').upsert(
        {
          system_code: systemType,
          company_id: profile?.company_id || null,
          webhook_url: voiceDriveUrl.trim() || null,
          root_folder_name: voiceRootFolder.trim() || 'WMS_GhiAm_KiemKe',
          is_enabled: voiceDriveEnabled,
          account_email: voiceAccount.trim() || null,
          account_note: voiceNote.trim() || null,
          root_folder_url: voiceRootUrl.trim() || null,
          updated_by: profile?.id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'system_code' }
      )
      if (error) throw error
      showToast(`Đã lưu cài đặt Google Drive Ghi âm Kiểm kê (${systemType})!`, 'success')
    } catch (e: any) {
      showToast('Lỗi lưu Drive Ghi âm: ' + (e?.message || e), 'error')
    } finally {
      setSavingVoiceDrive(false)
    }
  }

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE)
      setCopiedScript(true)
      setTimeout(() => setCopiedScript(false), 2000)
    } catch {}
  }

  const isGeminiReady = aiEnabled && parsedKeysCount > 0
  const isStampDriveReady = stampDriveUrl.trim().startsWith('http')
  const isOpsDriveReady = opsDriveUrl.trim().startsWith('http')
  const isVoiceDriveReady = voiceDriveEnabled && voiceDriveUrl.trim().startsWith('http')

  const accountDirectory = useMemo(() => {
    const rows: {
      service: string
      account: string
      detail: string
      note: string
      driveUrl?: string
      targetTab: ActiveTab
      badgeCls: string
    }[] = []

    geminiRows
      .filter(r => r.key.trim())
      .forEach((r, idx) => {
        rows.push({
          service: `Gemini API Key #${idx + 1}`,
          account: r.account.trim() || '(Chưa ghi tên Gmail)',
          detail: `${maskKeyShort(r.key)} · ${aiModel}`,
          note: r.note.trim() || 'Đọc dấu đóng & Dịch giọng nói kiểm kê',
          targetTab: 'gemini',
          badgeCls: 'bg-violet-100 text-violet-700',
        })
      })

    if (isStampDriveReady) {
      rows.push({
        service: 'Drive — Ảnh Dấu đóng',
        account: stampDriveAccount.trim() || '(Chưa ghi tên Gmail)',
        detail: 'Thư mục: WMS_AnhDauDong',
        note: stampDriveNote.trim() || 'Lưu ảnh chụp con dấu thùng hàng',
        driveUrl: stampDriveRootUrl || undefined,
        targetTab: 'stamp_drive',
        badgeCls: 'bg-amber-100 text-amber-800',
      })
    }

    if (isOpsDriveReady) {
      rows.push({
        service: `Drive — Ảnh Số liệu (${systemType})`,
        account: opsAccount.trim() || '(Chưa ghi tên Gmail)',
        detail: `Thư mục: ${opsRootFolder || 'WMS_HinhAnh_Kho'}`,
        note: opsNote.trim() || 'Lưu ảnh công việc, chụp nhanh & album kho',
        driveUrl: opsRootUrl || undefined,
        targetTab: 'ops_drive',
        badgeCls: 'bg-emerald-100 text-emerald-800',
      })
    }

    if (isVoiceDriveReady) {
      rows.push({
        service: `Drive — Ghi âm Kiểm kê (${systemType})`,
        account: voiceAccount.trim() || '(Chưa ghi tên Gmail)',
        detail: `Thư mục: ${voiceRootFolder || 'WMS_GhiAm_KiemKe'}`,
        note: voiceNote.trim() || 'Lưu file ghi âm gốc kiểm kê sai lệch',
        driveUrl: voiceRootUrl || undefined,
        targetTab: 'voice_drive',
        badgeCls: 'bg-sky-100 text-sky-800',
      })
    }

    return rows
  }, [
    geminiRows,
    aiModel,
    isStampDriveReady,
    stampDriveAccount,
    stampDriveNote,
    stampDriveRootUrl,
    isOpsDriveReady,
    opsAccount,
    opsRootFolder,
    opsNote,
    opsRootUrl,
    isVoiceDriveReady,
    voiceAccount,
    voiceRootFolder,
    voiceNote,
    voiceRootUrl,
    systemType,
  ])

  const navTabs: {
    id: ActiveTab
    label: string
    sub: string
    ok?: boolean
    icon: any
    activeRing: string
    iconBg: string
  }[] = [
    {
      id: 'overview',
      label: 'Hồ sơ tổng quan',
      sub: `${accountDirectory.length} kết nối đang lưu`,
      ok: accountDirectory.length > 0,
      icon: BookOpen,
      activeRing: 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20',
      iconBg: 'text-indigo-600 bg-indigo-100',
    },
    {
      id: 'gemini',
      label: 'Gemini AI Key',
      sub: isGeminiReady ? `${parsedKeysCount} key · ${aiModel}` : 'Chưa có key',
      ok: isGeminiReady,
      icon: Sparkles,
      activeRing: 'border-violet-500 bg-violet-50/60 ring-2 ring-violet-500/20',
      iconBg: 'text-violet-600 bg-violet-100',
    },
    {
      id: 'stamp_drive',
      label: 'Ảnh Dấu đóng',
      sub: isStampDriveReady ? stampDriveAccount || 'Đã kết nối' : 'Chưa cài URL',
      ok: isStampDriveReady,
      icon: Stamp,
      activeRing: 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20',
      iconBg: 'text-amber-600 bg-amber-100',
    },
    {
      id: 'ops_drive',
      label: 'Ảnh Số liệu',
      sub: isOpsDriveReady ? opsAccount || opsRootFolder : 'Chưa cài URL',
      ok: isOpsDriveReady,
      icon: Camera,
      activeRing: 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20',
      iconBg: 'text-emerald-600 bg-emerald-100',
    },
    {
      id: 'voice_drive',
      label: 'Ghi âm Kiểm kê',
      sub: isVoiceDriveReady ? voiceAccount || voiceRootFolder : 'Chưa cài URL',
      ok: isVoiceDriveReady,
      icon: Mic,
      activeRing: 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20',
      iconBg: 'text-sky-600 bg-sky-100',
    },
  ]

  return (
    <div className="p-3 md:p-6 max-w-6xl mx-auto space-y-5 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-800 flex items-center gap-2.5">
            <Plug className="text-indigo-600" size={26} />
            <span>Kết nối AI & Google Drive</span>
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Chọn từng thẻ bên dưới để xem hồ sơ tài khoản hoặc cấu hình chi tiết cho phân hệ{' '}
            <strong className="text-stone-700">{currentSystem?.name || systemType}</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAllSettings()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-bold shadow-xs self-start md:self-auto"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Tải lại</span>
        </button>
      </div>

      {/* 5 THẺ MENU BẤM CHUYỂN NỘI DUNG */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {navTabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all shadow-xs ${
                isActive
                  ? tab.activeRing
                  : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50/70'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tab.iconBg}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      tab.ok ? 'bg-emerald-500' : 'bg-stone-300'
                    }`}
                  />
                  <span className="text-xs font-extrabold text-stone-800 truncate">{tab.label}</span>
                </div>
                <div className="text-[11px] text-stone-500 truncate mt-0.5">{tab.sub}</div>
              </div>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-stone-500 text-sm bg-white rounded-3xl border border-stone-200">
          <Loader2 size={18} className="animate-spin" />
          <span>Đang tải cấu hình kết nối...</span>
        </div>
      ) : (
        <>
          {/* ── TAB 1: HỒ SƠ TỔNG QUAN (MẶC ĐỊNH) ── */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-100 bg-indigo-50/40 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                      <BookOpen size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-stone-800">
                        Hồ sơ Tài khoản Google & Tài nguyên đang kết nối ({accountDirectory.length})
                      </h2>
                      <p className="text-[11px] text-stone-500">
                        Tra cứu nhanh Gmail nào đang giữ API Key nào, thư mục Google Drive nào — bấm nút Sửa để chỉnh trực tiếp
                      </p>
                    </div>
                  </div>
                </div>

                {accountDirectory.length === 0 ? (
                  <div className="p-10 text-center text-sm text-stone-500">
                    Chưa có kết nối AI hoặc Google Drive nào. Hãy chọn các thẻ phía trên để bắt đầu cấu hình.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-extrabold border-b border-stone-100">
                        <tr>
                          <th className="px-4 py-3">Dịch vụ</th>
                          <th className="px-4 py-3">Tài khoản Google (Gmail)</th>
                          <th className="px-4 py-3">Key / Thư mục lưu</th>
                          <th className="px-4 py-3">Mục đích lưu trữ / Ghi chú</th>
                          <th className="px-4 py-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {accountDirectory.map((row, idx) => (
                          <tr key={idx} className="hover:bg-stone-50/70">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${row.badgeCls}`}>
                                {row.service}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-stone-800 whitespace-nowrap">
                              {row.account}
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-stone-600 whitespace-nowrap">
                              {row.detail}
                            </td>
                            <td className="px-4 py-3 text-stone-600">{row.note}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {row.driveUrl && (
                                  <a
                                    href={row.driveUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-[11px]"
                                  >
                                    <span>Drive</span>
                                    <ExternalLink size={11} />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setActiveTab(row.targetTab)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-[11px]"
                                >
                                  <span>Cấu hình</span>
                                  <ArrowRight size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Khối mã Google Apps Script mẫu dùng chung */}
              <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <HardDrive size={18} className="text-stone-600" />
                    <div>
                      <div className="text-sm font-extrabold text-stone-800">
                        Mã Google Apps Script mẫu (dùng chung cho Ảnh & Ghi âm)
                      </div>
                      <div className="text-xs text-stone-500">
                        Tạo 1 Web App trên script.google.com là dùng chung được cho cả Ảnh Dấu đóng, Ảnh Số liệu và Ghi âm Kiểm kê.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1.5"
                    >
                      {copiedScript ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      <span>{copiedScript ? 'Đã sao chép' : 'Sao chép mã'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowScript(v => !v)}
                      className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <Code2 size={13} />
                      <span>{showScript ? 'Ẩn mã' : 'Xem mã'}</span>
                    </button>
                  </div>
                </div>
                {showScript && (
                  <pre className="p-4 bg-stone-900 text-stone-100 text-[11px] overflow-x-auto max-h-72 leading-relaxed border-t border-stone-800">
                    {GOOGLE_APPS_SCRIPT_TEMPLATE}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 2: GEMINI AI KEY ── */}
          {activeTab === 'gemini' && (
            <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 bg-violet-50/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-stone-800">
                      Quản lý Gemini API Key & Model AI
                    </h2>
                    <p className="text-[11px] text-stone-500">
                      Dùng chung toàn công ty cho OCR dấu đóng thùng & Dịch giọng nói kiểm kê (tự xoay vòng khi 429/503)
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiEnabled}
                    onChange={e => setAiEnabled(e.target.checked)}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                  <span>Bật AI</span>
                </label>
              </div>

              <div className="p-5 space-y-5">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-extrabold text-stone-700 uppercase">
                      Danh sách Gemini API Key ({parsedKeysCount} key xoay vòng)
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={testingGeminiKeys || parsedKeysCount === 0}
                        onClick={() => void handleTestGeminiKeys()}
                        className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1 disabled:opacity-40"
                      >
                        {testingGeminiKeys ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={12} />
                        )}
                        <span>{testingGeminiKeys ? 'Đang test...' : 'Test từng key'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowKeys(v => !v)}
                        className="text-xs font-bold text-stone-500 hover:text-stone-700 flex items-center gap-1"
                      >
                        {showKeys ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{showKeys ? 'Ẩn key' : 'Hiện key'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setGeminiRows(prev => [
                            ...prev,
                            { id: `gk_${Date.now()}_${Math.random()}`, key: '', account: '', note: '' },
                          ])
                        }
                        className="px-2.5 py-1 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-700 text-xs font-extrabold flex items-center gap-1"
                      >
                        <Plus size={13} />
                        <span>Thêm Key</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {geminiRows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-1 md:grid-cols-12 gap-2 p-2.5 rounded-2xl bg-stone-50 border border-stone-200 items-center"
                      >
                        <div className="md:col-span-5 flex items-center gap-2">
                          <span className="text-[11px] font-black text-stone-400 w-5 text-center shrink-0">
                            #{idx + 1}
                          </span>
                          <input
                            type={showKeys ? 'text' : 'password'}
                            value={row.key}
                            onChange={e =>
                              setGeminiRows(prev =>
                                prev.map(r => (r.id === row.id ? { ...r, key: e.target.value } : r))
                              )
                            }
                            placeholder="AIzaSy... hoặc AQ.Ab8..."
                            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-mono text-stone-800"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <input
                            type="text"
                            value={row.account}
                            onChange={e =>
                              setGeminiRows(prev =>
                                prev.map(r => (r.id === row.id ? { ...r, account: e.target.value } : r))
                              )
                            }
                            placeholder="Gmail tạo key (VD: kho1@gmail.com)"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-800"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <input
                            type="text"
                            value={row.note}
                            onChange={e =>
                              setGeminiRows(prev =>
                                prev.map(r => (r.id === row.id ? { ...r, note: e.target.value } : r))
                              )
                            }
                            placeholder="Ghi chú (VD: Key chính / Dự phòng)"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-800"
                          />
                        </div>
                        <div className="md:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setGeminiRows(prev =>
                                prev.length > 1
                                  ? prev.filter(r => r.id !== row.id)
                                  : [{ id: row.id, key: '', account: '', note: '' }]
                              )
                            }
                            title="Xóa dòng key"
                            className="p-2 rounded-xl text-rose-500 hover:bg-rose-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {geminiTestResults.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {geminiTestResults.map(r => (
                        <div
                          key={r.index}
                          className={`px-3 py-2 rounded-xl border text-xs flex items-start gap-2 ${
                            r.status === 'ok'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : r.status === 'quota'
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                          }`}
                        >
                          <span className="font-mono font-bold shrink-0">
                            #{r.index} ({r.masked}):
                          </span>
                          <span className="font-semibold flex-1">{r.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-stone-100 space-y-1.5 max-w-md">
                  <label className="text-xs font-extrabold text-stone-700 uppercase">
                    Model Gemini
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setAiModel(m)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          aiModel === m
                            ? 'bg-violet-600 border-violet-600 text-white'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={aiModel}
                    onChange={e => setAiModel(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-mono text-stone-800"
                  />
                </div>
              </div>

              <div className="px-5 py-3.5 border-t border-stone-100 bg-stone-50/70 flex items-center justify-end">
                <button
                  type="button"
                  disabled={savingAi}
                  onClick={() => void handleSaveCompanyAi('Đã lưu cấu hình Gemini AI!')}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5"
                >
                  {savingAi ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Lưu cấu hình Gemini AI</span>
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 3: GOOGLE DRIVE — ẢNH DẤU ĐÓNG ── */}
          {activeTab === 'stamp_drive' && (
            <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 bg-amber-50/60 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                  <Stamp size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-stone-800">
                    Google Drive — Lưu Ảnh Dấu Đóng Thùng
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    Lưu trữ ảnh chụp con dấu thùng hàng từ màn hình Quét Dấu Đóng (Web & App)
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-stone-700 uppercase">
                    Google Apps Script Web App URL
                  </label>
                  <input
                    type="url"
                    value={stampDriveUrl}
                    onChange={e => setStampDriveUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-800"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-stone-600 uppercase">
                      Tài khoản Google (Gmail) chủ Drive
                    </label>
                    <div className="relative">
                      <Mail size={13} className="absolute left-3 top-2.5 text-stone-400" />
                      <input
                        type="text"
                        value={stampDriveAccount}
                        onChange={e => setStampDriveAccount(e.target.value)}
                        placeholder="VD: kho.daudong@gmail.com"
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-800"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-stone-600 uppercase">
                      Ghi chú mục đích lưu trữ
                    </label>
                    <input
                      type="text"
                      value={stampDriveNote}
                      onChange={e => setStampDriveNote(e.target.value)}
                      placeholder="VD: Lưu ảnh chụp dấu đóng thùng hàng kho đông"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-800"
                    />
                  </div>
                </div>

                {stampPing && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border ${
                      stampPing.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {stampPing.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span>{stampPing.text}</span>
                    </span>
                    {stampPing.rootUrl && (
                      <a
                        href={stampPing.rootUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-extrabold inline-flex items-center gap-1 shrink-0"
                      >
                        Mở Drive <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 border-t border-stone-100 bg-stone-50/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={testingStampDrive || !stampDriveUrl.trim()}
                    onClick={() =>
                      void pingDriveWebhook(
                        stampDriveUrl,
                        'WMS_AnhDauDong',
                        setTestingStampDrive,
                        setStampPing,
                        url => setStampDriveRootUrl(url)
                      )
                    }
                    className="px-3.5 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {testingStampDrive ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    <span>Kiểm tra kết nối</span>
                  </button>
                  {stampDriveRootUrl && (
                    <a
                      href={stampDriveRootUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold inline-flex items-center gap-1"
                    >
                      <span>Mở thư mục Drive</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  disabled={savingAi}
                  onClick={() => void handleSaveCompanyAi('Đã lưu cấu hình Drive Ảnh Dấu đóng!')}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5"
                >
                  {savingAi ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Lưu Drive Dấu đóng</span>
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 4: GOOGLE DRIVE — ẢNH SỐ LIỆU ── */}
          {activeTab === 'ops_drive' && (
            <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 bg-emerald-50/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <Camera size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-stone-800">
                      Google Drive — Ảnh Số liệu & Công việc
                    </h2>
                    <p className="text-[11px] text-stone-500">
                      Phân hệ: <strong>{systemType}</strong> · Đồng bộ ảnh chụp công việc, chụp nhanh & album kho
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opsAutoSync}
                    onChange={e => setOpsAutoSync(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <span>Tự động đồng bộ</span>
                </label>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-stone-700 uppercase">
                      Google Apps Script Web App URL
                    </label>
                    {stampDriveUrl.trim().startsWith('http') && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpsDriveUrl(stampDriveUrl.trim())
                          if (stampDriveAccount && !opsAccount) setOpsAccount(stampDriveAccount)
                        }}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                      >
                        Dùng chung URL Ảnh Dấu đóng
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={opsDriveUrl}
                    onChange={e => setOpsDriveUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-800"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-stone-600 uppercase">
                      Tài khoản Google (Gmail) chủ Drive
                    </label>
                    <div className="relative">
                      <Mail size={13} className="absolute left-3 top-2.5 text-stone-400" />
                      <input
                        type="text"
                        value={opsAccount}
                        onChange={e => setOpsAccount(e.target.value)}
                        placeholder="VD: khodong@gmail.com"
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-800"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-stone-600 uppercase">
                      Ghi chú lưu trữ
                    </label>
                    <input
                      type="text"
                      value={opsNote}
                      onChange={e => setOpsNote(e.target.value)}
                      placeholder="VD: Ảnh chụp nhanh, giao nhận ca làm"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-stone-600 uppercase">
                      Tên thư mục gốc trên Drive
                    </label>
                    <input
                      type="text"
                      value={opsRootFolder}
                      onChange={e => setOpsRootFolder(e.target.value)}
                      placeholder="WMS_HinhAnh_Kho"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-stone-600 uppercase">
                      Tự dọn ảnh gốc trên App (số ngày)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={opsAutoDeleteDays}
                      onChange={e => setOpsAutoDeleteDays(e.target.value)}
                      placeholder="Để trống = không tự xóa"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-800"
                    />
                  </div>
                </div>

                {opsPing && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border ${
                      opsPing.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {opsPing.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span>{opsPing.text}</span>
                    </span>
                    {opsPing.rootUrl && (
                      <a
                        href={opsPing.rootUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-extrabold inline-flex items-center gap-1 shrink-0"
                      >
                        Mở Drive <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 border-t border-stone-100 bg-stone-50/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={testingOpsDrive || !opsDriveUrl.trim()}
                    onClick={() =>
                      void pingDriveWebhook(
                        opsDriveUrl,
                        opsRootFolder,
                        setTestingOpsDrive,
                        setOpsPing,
                        url => setOpsRootUrl(url)
                      )
                    }
                    className="px-3.5 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {testingOpsDrive ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    <span>Kiểm tra kết nối</span>
                  </button>
                  {opsRootUrl && (
                    <a
                      href={opsRootUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold inline-flex items-center gap-1"
                    >
                      <span>Mở thư mục Drive</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  disabled={savingOpsDrive}
                  onClick={() => void handleSaveOpsDrive()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5"
                >
                  {savingOpsDrive ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Lưu Drive Số liệu</span>
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 5: GOOGLE DRIVE — GHI ÂM KIỂM KÊ ── */}
          {activeTab === 'voice_drive' && (
            <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 bg-sky-50/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center">
                    <Mic size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-stone-800">
                      Google Drive — File Ghi âm Kiểm kê
                    </h2>
                    <p className="text-[11px] text-stone-500">
                      Phân hệ: <strong>{systemType}</strong> · Lưu file ghi âm gốc khi đồng bộ kiểm kê (gộp tối đa 10 file/lượt gọi AI)
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={voiceDriveEnabled}
                    onChange={e => setVoiceDriveEnabled(e.target.checked)}
                    className="w-4 h-4 accent-sky-600 rounded"
                  />
                  <span>Bật lưu Drive</span>
                </label>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-extrabold text-stone-700 uppercase">
                      Google Apps Script Web App URL
                    </label>
                    <div className="flex items-center gap-3">
                      {opsDriveUrl.trim().startsWith('http') && (
                        <button
                          type="button"
                          onClick={() => {
                            setVoiceDriveUrl(opsDriveUrl.trim())
                            if (opsAccount && !voiceAccount) setVoiceAccount(opsAccount)
                          }}
                          className="text-xs font-bold text-sky-600 hover:text-sky-700"
                        >
                          Dùng chung URL Số liệu
                        </button>
                      )}
                      {stampDriveUrl.trim().startsWith('http') && (
                        <button
                          type="button"
                          onClick={() => {
                            setVoiceDriveUrl(stampDriveUrl.trim())
                            if (stampDriveAccount && !voiceAccount) setVoiceAccount(stampDriveAccount)
                          }}
                          className="text-xs font-bold text-amber-600 hover:text-amber-700"
                        >
                          Dùng chung URL Dấu đóng
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="url"
                    value={voiceDriveUrl}
                    onChange={e => setVoiceDriveUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-800"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-stone-600 uppercase">
                      Tài khoản Google (Gmail) chủ Drive
                    </label>
                    <div className="relative">
                      <Mail size={13} className="absolute left-3 top-2.5 text-stone-400" />
                      <input
                        type="text"
                        value={voiceAccount}
                        onChange={e => setVoiceAccount(e.target.value)}
                        placeholder="VD: kiemke@gmail.com"
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-800"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-stone-600 uppercase">
                      Ghi chú lưu trữ
                    </label>
                    <input
                      type="text"
                      value={voiceNote}
                      onChange={e => setVoiceNote(e.target.value)}
                      placeholder="VD: Ghi âm kiểm kê sai lệch"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-stone-600 uppercase">
                      Tên thư mục gốc trên Drive
                    </label>
                    <input
                      type="text"
                      value={voiceRootFolder}
                      onChange={e => setVoiceRootFolder(e.target.value)}
                      placeholder="WMS_GhiAm_KiemKe"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-800"
                    />
                  </div>
                </div>

                {voicePing && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border ${
                      voicePing.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {voicePing.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span>{voicePing.text}</span>
                    </span>
                    {voicePing.rootUrl && (
                      <a
                        href={voicePing.rootUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-extrabold inline-flex items-center gap-1 shrink-0"
                      >
                        Mở Drive <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 border-t border-stone-100 bg-stone-50/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={testingVoiceDrive || !voiceDriveUrl.trim()}
                    onClick={() =>
                      void pingDriveWebhook(
                        voiceDriveUrl,
                        voiceRootFolder,
                        setTestingVoiceDrive,
                        setVoicePing,
                        url => setVoiceRootUrl(url)
                      )
                    }
                    className="px-3.5 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {testingVoiceDrive ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    <span>Kiểm tra kết nối</span>
                  </button>
                  {voiceRootUrl && (
                    <a
                      href={voiceRootUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold inline-flex items-center gap-1"
                    >
                      <span>Mở thư mục Drive</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  disabled={savingVoiceDrive}
                  onClick={() => void handleSaveVoiceDrive()}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5"
                >
                  {savingVoiceDrive ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Lưu Drive Ghi âm</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
