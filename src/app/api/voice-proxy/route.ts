import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function detectAudioMimeType(buf: Uint8Array, rawContentType: string): string {
  // Kiểm tra magic bytes thực tế để trình duyệt phát chuẩn cả .m4a (Android) lẫn .webm/.ogg/.wav (Web)
  if (buf.length >= 12) {
    // MP4 / M4A: bytes 4..7 == "ftyp"
    if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
      return 'audio/mp4'
    }
    // WebM / Matroska: 0x1A 0x45 0xDF 0xA3
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
      return 'audio/webm'
    }
    // Ogg: "OggS"
    if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
      return 'audio/ogg'
    }
    // WAV: "RIFF"
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
      return 'audio/wav'
    }
    // MP3: "ID3" or frame sync 0xFF 0xFB/0xF3/0xF2
    if (
      (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
      (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
    ) {
      return 'audio/mpeg'
    }
  }
  if (rawContentType.startsWith('audio/')) return rawContentType
  return 'audio/mp4'
}

export async function GET(req: NextRequest) {
  const fileId = (req.nextUrl.searchParams.get('id') || '').trim()
  if (!fileId || !/^[a-zA-Z0-9_-]{10,120}$/.test(fileId)) {
    return NextResponse.json({ error: 'Invalid Google Drive file id' }, { status: 400 })
  }

  try {
    const driveUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
    const upstream = await fetch(driveUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Google Drive trả về HTTP ${upstream.status}` },
        { status: 502 }
      )
    }

    const arrayBuf = await upstream.arrayBuffer()
    const bytes = new Uint8Array(arrayBuf)
    const rawContentType = upstream.headers.get('content-type') || ''
    const contentType = detectAudioMimeType(bytes, rawContentType)
    const totalLength = bytes.byteLength

    // Hỗ trợ HTTP Range (206 Partial Content) để Chrome/Safari phát & tua file .m4a mượt mà
    const rangeHeader = req.headers.get('range')
    if (rangeHeader && totalLength > 0) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0
        const end = match[2] ? Math.min(parseInt(match[2], 10), totalLength - 1) : totalLength - 1
        if (start <= end && start < totalLength) {
          const chunk = bytes.subarray(start, end + 1)
          return new NextResponse(chunk, {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(chunk.byteLength),
              'Content-Range': `bytes ${start}-${end}/${totalLength}`,
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=3600',
            },
          })
        }
      }
    }

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(totalLength),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Không thể tải file ghi âm từ Google Drive' },
      { status: 500 }
    )
  }
}
