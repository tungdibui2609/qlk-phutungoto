'use client'

import React, { useState, useEffect } from 'react'
import {
  Boxes,
  CloudOff,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Settings,
  AlertCircle,
  Zap,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

const STORAGE_KEY_PROFILE = 'auth_user_profile'
const STORAGE_KEY_OFFLINE_CREDENTIALS = 'auth_offline_credentials'

export interface StoredScannerAccount {
  id: string
  email?: string
  full_name: string
  username?: string
  employee_code?: string
  department?: string
  phone?: string
  company_id?: string
  company?: {
    id: string
    name: string
    code: string
  } | null
  allowed_systems?: string[]
  role_name?: string
}

interface OfflineCredentials {
  inputIdentifier: string
  email: string
  username?: string
  fullName: string
  lastLoginAt: string
}

export function getStoredScannerUser(): StoredScannerAccount | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(STORAGE_KEY_PROFILE)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveStoredScannerUser(profile: StoredScannerAccount): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile))
  } catch {}
}

export function clearStoredScannerUser(): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(STORAGE_KEY_PROFILE)
    window.localStorage.removeItem(STORAGE_KEY_OFFLINE_CREDENTIALS)
  } catch {}
}

function getOfflineCredentials(): OfflineCredentials | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(STORAGE_KEY_OFFLINE_CREDENTIALS)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveOfflineCredentials(creds: OfflineCredentials): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY_OFFLINE_CREDENTIALS, JSON.stringify(creds))
  } catch {}
}

async function resolveEmailFromInput(input: string): Promise<string> {
  const cleanInput = input.trim()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanInput)
  if (isEmail) return cleanInput

  // Check if input is prefix.username (e.g. ctg.phuc)
  const prefixMatch = cleanInput.match(/^([a-z0-9]+)\.([a-z0-9_.-]+)$/i)
  if (prefixMatch) {
    return `${cleanInput}@system.local`
  }

  // Try RPC get_user_email_by_username
  try {
    const { data: userEmail, error } = await (supabase as any).rpc('get_user_email_by_username', {
      p_username: cleanInput,
    })
    if (!error && userEmail) {
      return userEmail
    }
  } catch {}

  // Fallback: query user_profiles directly
  try {
    const { data: found } = await (supabase.from('user_profiles') as any)
      .select('email')
      .ilike('username', cleanInput)
      .maybeSingle()
    if (found?.email) {
      return found.email
    }
  } catch {}

  return cleanInput
}

export async function fetchScannerUserProfile(userId: string, fallbackEmail?: string): Promise<StoredScannerAccount | null> {
  try {
    const { data, error } = await (supabase.from('user_profiles') as any)
      .select(`
        id,
        email,
        full_name,
        username,
        employee_code,
        department,
        phone,
        company_id,
        allowed_systems,
        companies ( id, name, code ),
        roles ( name, code )
      `)
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return null

    const companyData = data.companies as any
    let company = companyData
      ? {
          id: companyData.id,
          name: companyData.name,
          code: companyData.code,
        }
      : null

    if (!company && data.company_id) {
      try {
        const { data: comp } = await (supabase.from('companies') as any)
          .select('id, name, code')
          .eq('id', data.company_id)
          .maybeSingle()
        if (comp) {
          company = comp
        } else if (data.company_id === 'b503014d-19b6-464e-91f3-f34eba4b4b05') {
          company = {
            id: data.company_id,
            name: 'Công Ty Cổ Phần Tập Đoàn XNK Trái Cây Chánh Thu',
            code: 'CTG',
          }
        }
      } catch {}
    }

    const profile: StoredScannerAccount = {
      id: data.id,
      email: data.email || fallbackEmail,
      full_name: data.full_name || 'Nhân viên kho',
      username: data.username,
      employee_code: data.employee_code,
      department: data.department,
      phone: data.phone,
      company_id: data.company_id,
      company: company || {
        id: 'b503014d-19b6-464e-91f3-f34eba4b4b05',
        name: 'Công Ty Cổ Phần Tập Đoàn XNK Trái Cây Chánh Thu',
        code: 'CTG',
      },
      allowed_systems: data.allowed_systems,
      role_name: data.roles?.name || data.department || 'Vận hành kho',
    }

    saveStoredScannerUser(profile)
    return profile
  } catch (err) {
    console.warn('Lỗi lấy thông tin người dùng:', err)
    return null
  }
}

export interface ScannerLoginViewProps {
  onLoginSuccess: (account: StoredScannerAccount, isOffline?: boolean) => void
  onOpenSettings?: () => void
}

export default function ScannerLoginView({ onLoginSuccess, onOpenSettings }: ScannerLoginViewProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [offlineLoading, setOfflineLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cachedUser, setCachedUser] = useState<StoredScannerAccount | null>(null)

  useEffect(() => {
    const stored = getStoredScannerUser()
    const creds = getOfflineCredentials()
    if (stored) {
      setCachedUser(stored)
      if (creds?.inputIdentifier) {
        setUsername(creds.inputIdentifier)
      } else if (stored.username) {
        setUsername(stored.username)
      } else if (stored.email) {
        setUsername(stored.email)
      }
    }
  }, [])

  const handleQuickOfflineLogin = async () => {
    if (!cachedUser) return
    setOfflineLoading(true)
    try {
      onLoginSuccess(cachedUser, true)
    } finally {
      setOfflineLoading(false)
    }
  }

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (!username.trim()) {
      setErrorMessage('Vui lòng nhập email hoặc tên đăng nhập')
      return
    }
    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    const cleanInput = username.trim().toLowerCase()
    const storedUser = getStoredScannerUser()
    const offlineCreds = getOfflineCredentials()

    try {
      const resolvedEmail = await resolveEmailFromInput(username.trim())
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      })

      if (authErr) {
        if (authErr.message.includes('Invalid login credentials')) {
          setErrorMessage('Sai tên đăng nhập hoặc mật khẩu')
          return
        }
        throw authErr
      }

      if (!authData?.user) {
        setErrorMessage('Không thể xác thực tài khoản')
        return
      }

      let profile = await fetchScannerUserProfile(authData.user.id, authData.user.email || resolvedEmail)
      if (!profile) {
        profile = {
          id: authData.user.id,
          email: authData.user.email || resolvedEmail,
          full_name:
            authData.user.user_metadata?.full_name ||
            authData.user.email?.split('@')[0] ||
            'Nhân viên kho',
          company: {
            id: 'b503014d-19b6-464e-91f3-f34eba4b4b05',
            name: 'Công Ty Cổ Phần Tập Đoàn XNK Trái Cây Chánh Thu',
            code: 'CTG',
          },
          role_name: 'Vận hành kho',
        }
      }

      saveStoredScannerUser(profile)
      saveOfflineCredentials({
        inputIdentifier: cleanInput,
        email: (profile.email || resolvedEmail).toLowerCase(),
        username: (profile.username || '').toLowerCase(),
        fullName: profile.full_name,
        lastLoginAt: new Date().toISOString(),
      })

      onLoginSuccess(profile, false)
    } catch (err: any) {
      const errMsg = err?.message || ''
      const isNetworkError =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        errMsg.includes('Network') ||
        errMsg.includes('timeout') ||
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('offline')

      if (isNetworkError && storedUser) {
        const matchEmail = storedUser.email?.toLowerCase() === cleanInput
        const matchUsername = storedUser.username?.toLowerCase() === cleanInput
        const matchIdentifier = offlineCreds?.inputIdentifier === cleanInput
        const matchResolved = offlineCreds?.email === cleanInput

        if (matchEmail || matchUsername || matchIdentifier || matchResolved) {
          onLoginSuccess(storedUser, true)
          return
        }
      }

      setErrorMessage(
        isNetworkError
          ? 'Không có kết nối mạng tới máy chủ. Vui lòng kết nối Internet lần đầu hoặc sử dụng tài khoản đã lưu trên máy.'
          : errMsg || 'Lỗi kết nối máy chủ'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-[#0f172a] px-5 pt-9 pb-10 flex flex-col justify-center">
      <div className="w-full max-w-md mx-auto">
        {/* ── LOGO & HEADER ──────────────────────── */}
        <div className="flex flex-col items-center mb-5 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1e293b] border-2 border-[#38bdf8] flex items-center justify-center mb-3.5 shadow-[0_0_20px_rgba(56,189,248,0.28)]">
            <Boxes size={42} color="#38bdf8" />
          </div>
          <h1 className="text-[20px] font-black text-[#f8fafc] tracking-[1px]">
            CHÁNH THU WAREHOUSE
          </h1>
          <p className="text-[13px] text-[#94a3b8] mt-1">
            Hệ Thống Quét Tem Thùng &amp; Pallet Kho
          </p>

          <div className="inline-flex items-center gap-1.5 bg-[#1e293b] py-1 px-3 rounded-full mt-3 border border-[#334155]">
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
            <span className="text-[#cbd5e1] text-[11px] font-mono font-bold">
              api.chanhthu.click
            </span>
          </div>
        </div>

        {/* ── TIỆN ÍCH TIẾP TỤC NGOẠI TUYẾN KHI CÓ TÀI KHOẢN ĐÃ LƯU ──── */}
        {cachedUser && (
          <div
            className="bg-[#1e293b] rounded-[18px] p-4 mb-4 shadow-lg"
            style={{
              borderWidth: 1.5,
              borderColor: 'rgba(245, 158, 11, 0.4)',
            }}
          >
            <div className="flex items-center justify-between mb-3 gap-2">
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border shrink-0"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                }}
              >
                <CloudOff size={13} color="#f59e0b" />
                <span className="text-[#f59e0b] text-[10px] font-extrabold">
                  Tài khoản lưu trên máy
                </span>
              </div>
              <span className="text-[#10b981] text-[11px] font-bold truncate">
                {cachedUser.company?.code || 'CTG'} · {cachedUser.company?.name || 'Chánh Thu'}
              </span>
            </div>

            <div className="flex items-center gap-3 mb-3.5">
              <div
                className="w-[38px] h-[38px] rounded-full border border-[#38bdf8] flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)' }}
              >
                <User size={18} color="#38bdf8" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[#f8fafc] text-[15px] font-extrabold truncate">
                  {cachedUser.full_name}
                </div>
                <div className="text-[#94a3b8] text-[12px] truncate mt-0.5">
                  {cachedUser.username || cachedUser.email}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleQuickOfflineLogin}
              disabled={offlineLoading}
              className="w-full bg-[#f59e0b] hover:bg-amber-400 disabled:opacity-60 flex items-center justify-center gap-2 py-3 rounded-xl text-[#0f172a] text-[11px] font-black tracking-[0.4px] shadow-md active:scale-[0.99] transition"
            >
              {offlineLoading ? (
                <Loader2 size={16} className="animate-spin text-[#0f172a]" />
              ) : (
                <>
                  <Zap size={16} color="#0f172a" />
                  <span>VÀO NHANH NGOẠI TUYẾN (KHÔNG CẦN MẠNG)</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ── FORM CARD ──────────────────────────── */}
        <form
          onSubmit={handleSignIn}
          className="bg-[#1e293b] rounded-[20px] p-5 border border-[#334155] shadow-xl"
        >
          <h2 className="text-[18px] font-extrabold text-white">
            {cachedUser ? 'Đăng Nhập Tài Khoản Khác' : 'Đăng Nhập Tài Khoản'}
          </h2>
          <p className="text-[12px] text-[#94a3b8] mt-1 mb-4.5 leading-[17px]">
            Đăng nhập lần đầu cần mạng để tải cấu hình kho. Sau khi đăng nhập, tài khoản sẽ được lưu vĩnh viễn trên máy để làm việc ngoại tuyến.
          </p>

          {errorMessage && (
            <div
              className="flex items-center gap-2 border border-[#ef4444] p-2.5 rounded-[10px] mb-4"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
            >
              <AlertCircle size={18} color="#ef4444" className="shrink-0" />
              <span className="text-[#fca5a5] text-[12px] font-semibold flex-1">
                {errorMessage}
              </span>
            </div>
          )}

          {/* Username / Email Input */}
          <label className="block text-[12px] font-bold text-[#cbd5e1] mb-1.5">
            Email hoặc Tên đăng nhập:
          </label>
          <div className="flex items-center bg-[#0f172a] border border-[#334155] focus-within:border-[#38bdf8] rounded-xl px-3 mb-4">
            <User size={19} color="#94a3b8" className="mr-2 shrink-0" />
            <input
              type="text"
              placeholder="VD: tungnguyen@chanhthu.com hoặc ctg.phuc"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                if (errorMessage) setErrorMessage(null)
              }}
              autoCapitalize="none"
              autoCorrect="off"
              className="flex-1 py-3 bg-transparent text-[#f8fafc] text-[14px] placeholder-[#64748b] focus:outline-hidden select-text"
            />
          </div>

          {/* Password Input */}
          <label className="block text-[12px] font-bold text-[#cbd5e1] mb-1.5">
            Mật khẩu:
          </label>
          <div className="flex items-center bg-[#0f172a] border border-[#334155] focus-within:border-[#38bdf8] rounded-xl px-3 mb-4">
            <Lock size={19} color="#94a3b8" className="mr-2 shrink-0" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (errorMessage) setErrorMessage(null)
              }}
              className="flex-1 py-3 bg-transparent text-[#f8fafc] text-[14px] placeholder-[#64748b] focus:outline-hidden select-text"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="p-1.5 text-[#94a3b8] hover:text-white"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0284c7] hover:bg-sky-500 disabled:opacity-60 flex items-center justify-center gap-2 py-3.5 rounded-xl mt-2 text-white text-[14px] font-extrabold tracking-[0.5px] shadow-lg shadow-sky-600/30 active:scale-[0.99] transition"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : (
              <>
                <span>ĐĂNG NHẬP NGAY</span>
                <ArrowRight size={18} color="#fff" />
              </>
            )}
          </button>
        </form>

        {/* ── SECURITY INFO NOTICE ───────────────── */}
        <div
          className="flex items-start gap-3 p-3.5 rounded-2xl mt-5 border"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            borderColor: 'rgba(16, 185, 129, 0.25)',
          }}
        >
          <ShieldCheck size={22} color="#10b981" className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-[#10b981] text-[13px] font-extrabold mb-0.5">
              Bảo Mật Phân Quyền Công Ty
            </div>
            <div className="text-[#94a3b8] text-[11px] leading-[16px]">
              Khi đăng nhập, mọi Pallet và tem thùng bạn quét sẽ tự động gắn kết với công ty của bạn, đảm bảo tính bảo mật và quản lý tập trung trên web mẹ.
            </div>
          </div>
        </div>

        {/* ── OPTIONAL SERVER SETTINGS BUTTON ───── */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full flex items-center justify-center gap-1.5 mt-6 py-2 text-[#64748b] hover:text-slate-300 text-[12px] font-semibold transition"
          >
            <Settings size={16} />
            <span>Cấu hình máy chủ kết nối</span>
          </button>
        )}
      </div>
    </div>
  )
}
