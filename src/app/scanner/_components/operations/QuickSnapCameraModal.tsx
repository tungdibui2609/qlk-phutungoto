'use client'

import React, { useEffect, useRef, useState } from 'react'
import { X, Camera, Images, Loader2 } from 'lucide-react'
import type { DeliveryShift } from './operationsService'
import { capturePhotoWithCamera, type PickedOperationPhoto } from './operationImagesService'

interface Props {
  visible: boolean
  openShifts: DeliveryShift[]
  initialShiftId: string | null
  totalQueueCount: number
  lastThumbUrl?: string | null
  systemCode: string
  userName?: string | null
  onClose: () => void
  onOpenQueue: () => void
  onCaptured: (payload: { shift: DeliveryShift; photo: PickedOperationPhoto }) => void
}

export default function QuickSnapCameraModal({
  visible,
  openShifts,
  initialShiftId,
  totalQueueCount,
  lastThumbUrl,
  systemCode,
  userName,
  onClose,
  onOpenQueue,
  onCaptured,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [targetShiftId, setTargetShiftId] = useState<string>(initialShiftId || '')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [blink, setBlink] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const [sessionLastUrl, setSessionLastUrl] = useState<string | null>(null)

  const activeShift = openShifts.find(s => s.id === targetShiftId) || openShifts[0] || null

  useEffect(() => {
    if (!visible) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      setCameraError(null)
      return
    }

    setTargetShiftId(initialShiftId || openShifts[0]?.id || '')
    setSessionCount(0)
    setSessionLastUrl(null)
    setCameraError(null)

    let cancelled = false
    const startCamera = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'Trình duyệt hiện tại không hỗ trợ mở camera trực tiếp (cần HTTPS hoặc localhost). Bạn vẫn có thể bấm nút bên dưới để chụp.'
        )
        return
      }
      setStarting(true)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
      } catch (err: any) {
        if (!cancelled) {
          setCameraError(
            err?.message ||
              'Không truy cập được Camera trực tiếp. Bạn có thể dùng nút Chụp bằng Camera máy bên dưới.'
          )
        }
      } finally {
        if (!cancelled) setStarting(false)
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [visible, initialShiftId, openShifts])

  if (!visible) return null

  const handleShutter = () => {
    if (!videoRef.current || !activeShift || cameraError) return
    const video = videoRef.current
    const vw = video.videoWidth || 1280
    const vh = video.videoHeight || 960
    const maxDim = 1400
    const scale = Math.min(1, maxDim / Math.max(vw, vh))
    const cw = Math.round(vw * scale)
    const ch = Math.round(vh * scale)

    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, cw, ch)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.78)
    setBlink(true)
    setTimeout(() => setBlink(false), 110)

    const photo: PickedOperationPhoto = {
      dataUrl,
      width: cw,
      height: ch,
      fileSize: Math.round((dataUrl.length * 3) / 4),
      mimeType: 'image/jpeg',
    }
    setSessionLastUrl(dataUrl)
    setSessionCount(c => c + 1)
    onCaptured({ shift: activeShift, photo })
  }

  const handleFallbackSystemCamera = async () => {
    if (!activeShift) return
    const photo = await capturePhotoWithCamera({
      systemCode: activeShift.system_code || systemCode,
      jobName: activeShift.summary_data?.job_name || activeShift.notes || null,
      userName,
    })
    if (!photo) return
    setSessionLastUrl(photo.dataUrl)
    setSessionCount(c => c + 1)
    onCaptured({ shift: activeShift, photo })
  }

  const previewThumb = sessionLastUrl || lastThumbUrl || null

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Kính ngắm video trực tiếp */}
      <div className="relative flex-1 overflow-hidden flex items-center justify-center bg-black">
        {!cameraError && (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
          />
        )}

        {starting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
            <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
            <span className="text-xs font-bold">Đang mở Camera...</span>
          </div>
        )}

        {cameraError && (
          <div className="p-6 text-center max-w-sm space-y-4">
            <Camera className="w-12 h-12 text-sky-400 mx-auto" />
            <div className="text-xs font-semibold text-slate-300 leading-relaxed">
              {cameraError}
            </div>
            <button
              type="button"
              onClick={() => void handleFallbackSystemCamera()}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold inline-flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span>Chụp bằng Camera máy</span>
            </button>
          </div>
        )}

        {blink && <div className="absolute inset-0 bg-white/65 pointer-events-none" />}

        {/* Thanh trên: Đóng + Badge + Dải chọn Công việc đang mở */}
        <div
          className="absolute top-0 inset-x-0 bg-black/55 backdrop-blur-sm pb-2.5 space-y-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        >
          <div className="flex items-center justify-between px-3.5">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-900/80 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="px-3 py-1 rounded-full bg-slate-900/85 border border-sky-400/40 text-sky-300 text-[11px] font-black tracking-wide">
              CHỤP NHANH{sessionCount > 0 ? ` • +${sessionCount}` : ''}
            </div>

            <div className="w-9" />
          </div>

          {openShifts.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto px-3.5 no-scrollbar">
              {openShifts.map(s => {
                const isSel = activeShift?.id === s.id
                const label = s.summary_data?.job_name || s.notes || 'Công việc'
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setTargetShiftId(s.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition shrink-0 max-w-[210px] ${
                      isSel
                        ? 'bg-indigo-600 border-indigo-300 text-white font-black'
                        : 'bg-slate-900/80 border-slate-600 text-slate-300 font-bold'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSel ? 'bg-white' : 'bg-emerald-400'
                      }`}
                    />
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Thanh đáy: Thumbnail nhỏ góc trái + Nút chụp BỤP + Nút Xong */}
        <div
          className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm pt-5 px-6 flex items-center justify-between"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
        >
          <button
            type="button"
            disabled={!previewThumb && totalQueueCount === 0}
            onClick={() => {
              onClose()
              onOpenQueue()
            }}
            className="relative w-14 h-14 flex items-center justify-center"
          >
            {previewThumb ? (
              <div className="relative w-13 h-13 rounded-xl border-2 border-white overflow-visible">
                <img
                  src={previewThumb}
                  alt="last"
                  className="w-12 h-12 rounded-lg object-cover"
                />
                {totalQueueCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center border border-black">
                    {totalQueueCount}
                  </span>
                )}
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl border border-slate-500/50 bg-slate-900/70 flex items-center justify-center text-slate-400">
                <Images className="w-5 h-5" />
              </div>
            )}
          </button>

          <button
            type="button"
            disabled={!!cameraError || !activeShift}
            onClick={handleShutter}
            aria-label="Chụp ảnh"
            className="w-[74px] h-[74px] rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:scale-90 transition disabled:opacity-40"
          >
            <div className="w-[58px] h-[58px] rounded-full bg-white" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-600 text-white text-xs font-extrabold"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  )
}
