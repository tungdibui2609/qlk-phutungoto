'use client'

import React, { useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'

interface ImageLightboxProps {
    images: string[]
    currentIndex: number
    onClose: () => void
    onNavigate?: (index: number) => void
}

export default function ImageLightbox({ images, currentIndex, onClose, onNavigate }: ImageLightboxProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowLeft' && onNavigate && currentIndex > 0) {
                onNavigate(currentIndex - 1)
            }
            if (e.key === 'ArrowRight' && onNavigate && currentIndex < images.length - 1) {
                onNavigate(currentIndex + 1)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [currentIndex, images.length, onClose, onNavigate])

    if (!images || images.length === 0) return null

    const currentImg = images[currentIndex] || images[0]

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            {/* Top Toolbar */}
            <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
                <span className="text-white/70 text-sm font-medium">
                    {currentIndex + 1} / {images.length}
                </span>
                <a
                    href={currentImg}
                    download={`anh-nhac-viec-${currentIndex + 1}.jpg`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                    title="Tải ảnh về"
                >
                    <Download className="w-5 h-5" />
                </a>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                    title="Đóng (Esc)"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Navigation Buttons */}
            {images.length > 1 && currentIndex > 0 && onNavigate && (
                <button
                    onClick={() => onNavigate(currentIndex - 1)}
                    className="absolute left-4 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white transition z-10"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
            )}

            {images.length > 1 && currentIndex < images.length - 1 && onNavigate && (
                <button
                    onClick={() => onNavigate(currentIndex + 1)}
                    className="absolute right-4 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white transition z-10"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            )}

            {/* Main Image */}
            <div className="max-w-5xl max-h-[85vh] flex items-center justify-center overflow-hidden rounded-lg shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={currentImg}
                    alt="Hình ảnh phóng to"
                    className="max-w-full max-h-[85vh] object-contain rounded-lg animate-in zoom-in-95 duration-150"
                />
            </div>
        </div>
    )
}
