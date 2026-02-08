import { useState, useCallback } from 'react'
import { toJpeg } from 'html-to-image'

interface UseCaptureReceiptOptions {
    fileNamePrefix: string
    nodeId?: string
    quality?: number
    pixelRatio?: number
    portraitWidth?: number
    landscapeWidth?: number
}

export function useCaptureReceipt({
    fileNamePrefix,
    nodeId = 'print-ready',
    quality = 0.95,
    pixelRatio = 2,
    portraitWidth = 1150,
    landscapeWidth = 1400
}: UseCaptureReceiptOptions) {
    const [isCapturing, setIsCapturing] = useState(false)
    const [downloadTimer, setDownloadTimer] = useState(0)

    const handleCapture = useCallback(async (isLandscape: boolean = false, customFileName?: string) => {
        if (isCapturing) return

        setIsCapturing(true)
        setDownloadTimer(0)

        const timerInterval = setInterval(() => {
            setDownloadTimer(prev => prev + 1)
        }, 1000)

        try {
            // Wait for React to render snapshot mode
            await new Promise(resolve => setTimeout(resolve, 500))

            const node = document.getElementById(nodeId)
            if (!node) throw new Error(`Không tìm thấy vùng in (node #${nodeId})`)

            const width = isLandscape ? landscapeWidth : portraitWidth

            const dataUrl = await toJpeg(node, {
                quality,
                backgroundColor: '#ffffff',
                cacheBust: true,
                pixelRatio,
                width,
            })

            const a = document.createElement('a')
            a.href = dataUrl
            a.download = customFileName || `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.jpg`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
        } catch (error: any) {
            console.error('Capture error:', error)
            alert(`Lỗi tải ảnh: ${error.message}`)
        } finally {
            clearInterval(timerInterval)
            setIsCapturing(false)
            setDownloadTimer(0)
        }
    }, [isCapturing, nodeId, quality, pixelRatio, portraitWidth, landscapeWidth, fileNamePrefix])

    return {
        isCapturing,
        downloadTimer,
        handleCapture
    }
}
