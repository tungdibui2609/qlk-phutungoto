'use client'

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { normalizeWarehouseVoiceText } from './voiceTextNormalizer'

export interface OfflineVoicePayload {
  audioBase64: string
  mimeType: string
  durationSec: number
}

export interface VoiceMicStopResult {
  wasRecording: boolean
  savedOffline?: boolean
  text?: string
  voiceUrl?: string | null
}

export interface VoiceMicButtonHandle {
  isRecording: () => boolean
  stopAndFinalize: () => Promise<VoiceMicStopResult>
}

/**
 * Registry toàn cục theo dõi nút Micro đang ghi âm trên Web Scanner:
 * - Bấm Micro ở ô khác -> tự động dừng & lưu ghi âm của ô trước đó.
 * - Bấm "HOÀN TẤT" / đóng modal -> gọi `stopAnyActiveVoiceRecording()` để tự dừng & lưu.
 */
let activeVoiceRecorder: {
  id: string
  stopAndFinalize: () => Promise<VoiceMicStopResult>
} | null = null

export async function stopAnyActiveVoiceRecording(): Promise<VoiceMicStopResult> {
  if (!activeVoiceRecorder) return { wasRecording: false }
  const current = activeVoiceRecorder
  return await current.stopAndFinalize()
}

interface VoiceMicButtonProps {
  /** Callback khi dịch AI thành công (trả về text đã chuẩn hóa + voiceUrl đã lưu trên server nếu có) */
  onResult: (normalizedText: string, voiceUrl?: string | null) => void
  /** Callback khi đang tắt mạng (hoặc gọi server lỗi) -> lưu ghi âm offline chờ đồng bộ & AI dịch sau */
  onOfflineAudio?: (payload: OfflineVoicePayload) => void | Promise<void>
  /** Có lưu file ghi âm lên Supabase Storage trên Server không */
  saveToServer?: boolean
  /** Thư mục gốc riêng trên Google Drive (VD: WMS_GhiAm_GhiNhap) */
  rootFolderOverride?: string | null
  systemCode?: string
  sessionId?: string | null
  sessionName?: string | null
  positionId?: string | null
  positionCode?: string | null
  /** companyId để dùng đúng Gemini API Key trong company_ai_settings */
  companyId?: string | null
  /** Danh sách tên sản phẩm / tên viết tắt (aliases) giúp Gemini nhận chuẩn 99% */
  vocabulary?: string[]
  /** Báo lỗi thân thiện */
  onError?: (msg: string) => void
  size?: 'sm' | 'md'
  title?: string
  className?: string
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '')
      const commaIdx = dataUrl.indexOf(',')
      resolve(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export const VoiceMicButton = forwardRef<VoiceMicButtonHandle, VoiceMicButtonProps>(function VoiceMicButton({
  onResult,
  onOfflineAudio,
  saveToServer = false,
  rootFolderOverride = null,
  systemCode = 'KHO_DONG_LANH',
  sessionId,
  sessionName,
  positionId,
  positionCode,
  companyId,
  vocabulary,
  onError,
  size = 'sm',
  title = 'Bấm để nói — bấm lần nữa để dừng (Tự lưu offline nếu mất mạng)',
  className = '',
}, ref) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const statusRef = useRef<'idle' | 'recording' | 'transcribing'>('idle')
  const instanceIdRef = useRef<string>(`web_mic_${Math.random().toString(36).slice(2, 10)}`)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number>(0)
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const webSpeechRef = useRef<any>(null)
  const stopResolverRef = useRef<((res: VoiceMicStopResult) => void) | null>(null)
  const stoppingPromiseRef = useRef<Promise<VoiceMicStopResult> | null>(null)

  const updateStatus = (next: 'idle' | 'recording' | 'transcribing') => {
    statusRef.current = next
    setStatus(next)
  }

  const resolvePendingStop = (res: VoiceMicStopResult) => {
    if (stopResolverRef.current) {
      const fn = stopResolverRef.current
      stopResolverRef.current = null
      fn(res)
    }
  }

  const onResultRef = useRef(onResult)
  const onOfflineAudioRef = useRef(onOfflineAudio)
  const onErrorRef = useRef(onError)
  const vocabRef = useRef(vocabulary)

  useEffect(() => {
    onResultRef.current = onResult
    onOfflineAudioRef.current = onOfflineAudio
    onErrorRef.current = onError
    vocabRef.current = vocabulary
  }, [onResult, onOfflineAudio, onError, vocabulary])

  const cleanupStream = () => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current)
      autoStopTimerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  useEffect(() => {
    const myId = instanceIdRef.current
    return () => {
      cleanupStream()
      if (activeVoiceRecorder?.id === myId) {
        activeVoiceRecorder = null
      }
      try {
        webSpeechRef.current?.abort?.()
      } catch {}
    }
  }, [])

  const startWebSpeechFallback = () => {
    const w = typeof window !== 'undefined' ? (window as any) : null
    const Ctor = w?.SpeechRecognition || w?.webkitSpeechRecognition
    if (!Ctor) {
      const msg = 'Trình duyệt chưa hỗ trợ ghi âm / nhận dạng giọng nói.'
      if (onErrorRef.current) onErrorRef.current(msg)
      else alert(msg)
      return
    }
    try {
      const rec = new Ctor()
      rec.lang = 'vi-VN'
      rec.interimResults = false
      rec.continuous = false
      rec.onstart = () => setStatus('recording')
      rec.onresult = (event: any) => {
        let text = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) text += (event.results[i][0]?.transcript || '') + ' '
        }
        const normalized = normalizeWarehouseVoiceText(text)
        if (normalized) onResultRef.current(normalized, null)
      }
      rec.onerror = () => setStatus('idle')
      rec.onend = () => setStatus('idle')
      webSpeechRef.current = rec
      rec.start()
    } catch {
      setStatus('idle')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {}
    }
    if (webSpeechRef.current) {
      try {
        webSpeechRef.current.stop()
      } catch {}
      webSpeechRef.current = null
    }
  }

  const stopAndFinalizeInternal = (): Promise<VoiceMicStopResult> => {
    if (stoppingPromiseRef.current) return stoppingPromiseRef.current
    if (statusRef.current !== 'recording') {
      return Promise.resolve({ wasRecording: false })
    }
    const p = new Promise<VoiceMicStopResult>(resolve => {
      const timeoutId = setTimeout(() => {
        resolvePendingStop({ wasRecording: true })
      }, 12000)
      stopResolverRef.current = res => {
        clearTimeout(timeoutId)
        stoppingPromiseRef.current = null
        resolve(res)
      }
      stopRecording()
    })
    stoppingPromiseRef.current = p
    return p
  }

  useImperativeHandle(ref, () => ({
    isRecording: () => statusRef.current === 'recording',
    stopAndFinalize: stopAndFinalizeInternal,
  }))

  const handlePress = async () => {
    if (statusRef.current === 'transcribing') return
    if (statusRef.current === 'recording') {
      stopRecording()
      return
    }

    // Nếu ô khác đang ghi âm mà chưa bấm dừng -> tự động dừng & lưu ô trước đó rồi mới ghi ô mới
    if (activeVoiceRecorder && activeVoiceRecorder.id !== instanceIdRef.current) {
      await activeVoiceRecorder.stopAndFinalize()
    }

    // Nếu mất mạng nhưng không dùng chế độ lưu offline (VD: ô tìm kiếm) -> fallback Web Speech
    if (typeof navigator !== 'undefined' && !navigator.onLine && !onOfflineAudioRef.current) {
      startWebSpeechFallback()
      return
    }

    const canRecord =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined'

    if (!canRecord) {
      startWebSpeechFallback()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ]
      const mimeType = preferredTypes.find(t => MediaRecorder.isTypeSupported?.(t)) || ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = ev => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
      }

      recorder.onstop = async () => {
        cleanupStream()
        const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        const actualMime = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0].trim()
        const blob = new Blob(chunksRef.current, { type: actualMime })
        chunksRef.current = []

        if (blob.size < 400) {
          updateStatus('idle')
          resolvePendingStop({ wasRecording: true })
          return
        }

        let stopResult: VoiceMicStopResult = { wasRecording: true }

        try {
          const audioBase64 = await blobToBase64(blob)

          // 0. Chế độ tự động gửi AI trong Cài đặt (mặc định TẮT -> luôn lưu local để nghe lại trước)
          let autoSendOnStop = false
          try {
            autoSendOnStop = localStorage.getItem('config_auto_transcribe_voice_on_stop') === 'true'
          } catch {}

          if (!autoSendOnStop && onOfflineAudioRef.current) {
            await onOfflineAudioRef.current({ audioBase64, mimeType: actualMime, durationSec })
            stopResult = { wasRecording: true, savedOffline: true }
            return
          }

          // 1. Nếu đang tắt mạng -> lưu ngay ghi âm vào IndexedDB chờ đồng bộ & AI dịch
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            if (onOfflineAudioRef.current) {
              await onOfflineAudioRef.current({ audioBase64, mimeType: actualMime, durationSec })
              stopResult = { wasRecording: true, savedOffline: true }
            }
            return
          }

          // 2. Có mạng -> gửi lên server lưu Storage (nếu saveToServer) + Gemini AI dịch ngay
          updateStatus('transcribing')
          const res = await fetch('/api/voice-transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64,
              mimeType: actualMime,
              companyId: companyId || null,
              saveToServer,
              rootFolderOverride: rootFolderOverride || null,
              systemCode,
              sessionId: sessionId || null,
              sessionName: sessionName || null,
              positionId: positionId || null,
              positionCode: positionCode || null,
              vocabulary: vocabRef.current || [],
            }),
          })

          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            // Nếu server/mạng lỗi mà có chế độ lưu offline -> cứu file ghi âm vào máy!
            if (onOfflineAudioRef.current) {
              await onOfflineAudioRef.current({ audioBase64, mimeType: actualMime, durationSec })
              stopResult = { wasRecording: true, savedOffline: true }
            } else {
              const msg = data?.error || 'Không thể dịch giọng nói'
              if (onErrorRef.current) onErrorRef.current(msg)
            }
            return
          }

          const rawText = String(data?.text || '').trim()
          const normalized = rawText ? normalizeWarehouseVoiceText(rawText) : ''
          const voiceUrl = data?.voiceUrl ? String(data.voiceUrl) : null

          if (normalized || voiceUrl) {
            onResultRef.current(normalized, voiceUrl)
            stopResult = { wasRecording: true, text: normalized, voiceUrl }
          }
          if (data?.warning && onErrorRef.current) {
            onErrorRef.current(data.warning)
          }
        } catch {
          // Mất sóng bất ngờ khi đang gửi -> cứu ngay file ghi âm vào IndexedDB nếu hỗ trợ
          try {
            const fallbackB64 = await blobToBase64(blob)
            if (onOfflineAudioRef.current) {
              await onOfflineAudioRef.current({
                audioBase64: fallbackB64,
                mimeType: actualMime,
                durationSec,
              })
              stopResult = { wasRecording: true, savedOffline: true }
            }
          } catch {}
        } finally {
          if (activeVoiceRecorder?.id === instanceIdRef.current) {
            activeVoiceRecorder = null
          }
          updateStatus('idle')
          resolvePendingStop(stopResult)
        }
      }

      startedAtRef.current = Date.now()
      recorder.start()
      updateStatus('recording')
      activeVoiceRecorder = {
        id: instanceIdRef.current,
        stopAndFinalize: stopAndFinalizeInternal,
      }

      // Tự dừng sau 15 giây nếu nhân viên quên bấm dừng
      autoStopTimerRef.current = setTimeout(() => {
        stopRecording()
      }, 15000)
    } catch (err: any) {
      if (activeVoiceRecorder?.id === instanceIdRef.current) {
        activeVoiceRecorder = null
      }
      cleanupStream()
      updateStatus('idle')
      resolvePendingStop({ wasRecording: false })
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Bạn chưa cấp quyền Microphone cho trình duyệt.'
          : err?.message || 'Không thể mở Microphone'
      if (onErrorRef.current) onErrorRef.current(msg)
      else alert(msg)
    }
  }

  const dimCls = size === 'md' ? 'w-8 h-8 rounded-xl' : 'w-7 h-7 rounded-lg'
  const iconCls = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'

  return (
    <button
      type="button"
      onClick={() => void handlePress()}
      disabled={status === 'transcribing'}
      title={
        status === 'recording'
          ? 'Đang ghi âm... Bấm lại để dừng'
          : status === 'transcribing'
            ? 'AI đang dịch & lưu ghi âm...'
            : title
      }
      aria-label={status === 'recording' ? 'Dừng ghi âm' : 'Nói để ghi chú'}
      className={`${dimCls} flex items-center justify-center shrink-0 transition active:scale-90 border ${
        status === 'recording'
          ? 'bg-rose-500 border-rose-400 text-white animate-pulse shadow-md shadow-rose-500/40'
          : status === 'transcribing'
            ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
            : 'bg-sky-500/15 border-sky-500/35 text-sky-400 hover:bg-sky-500/25'
      } ${className}`}
    >
      {status === 'transcribing' ? (
        <Loader2 className={`${iconCls} animate-spin`} />
      ) : status === 'recording' ? (
        <Square className="w-3 h-3 fill-current" />
      ) : (
        <Mic className={iconCls} />
      )}
    </button>
  )
})
