import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const fileId = req.nextUrl.searchParams.get('id')?.trim()
    const width = req.nextUrl.searchParams.get('w')?.trim() || '1600'

    if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
        return new NextResponse('Invalid file id', { status: 400 })
    }

    const candidates = [
        `https://lh3.googleusercontent.com/d/${fileId}=w${width}`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`,
        `https://drive.google.com/uc?export=view&id=${fileId}`,
    ]

    for (const url of candidates) {
        try {
            const upstream = await fetch(url, {
                redirect: 'follow',
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                },
            })
            const contentType = upstream.headers.get('content-type') || ''
            if (upstream.ok && contentType.startsWith('image/')) {
                const buf = await upstream.arrayBuffer()
                return new NextResponse(buf, {
                    status: 200,
                    headers: {
                        'Content-Type': contentType,
                        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
                    },
                })
            }
        } catch {
            // Thử URL dự phòng tiếp theo
        }
    }

    return new NextResponse('Unable to load image from Google Drive', { status: 502 })
}
