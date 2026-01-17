import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function safeHostFromReq(req: NextRequest) {
    try {
        const forwardedProto = req.headers.get('x-forwarded-proto');
        const forwardedHost = req.headers.get('x-forwarded-host');
        const hostHeader = req.headers.get('host');
        if (forwardedHost) return `${forwardedProto || 'https'}://${forwardedHost}`;
        if (hostHeader) return `https://${hostHeader}`;
    } catch { }
    return '';
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ ok: false, error: 'ID_REQUIRED' }, { status: 400 });

        // Resolve absolute preview URL
        // Use configured PRINT_BASE or fallback to request host
        const envBase = (process.env.PRINT_BASE || '').toString().trim().replace(/\/$/, '');
        const base = envBase || safeHostFromReq(req) || 'http://localhost:3000';

        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll()
                    },
                    setAll(cookiesToSet) {
                        // Optional: Handle cookie updates if needed, though for just reading session it's fine to ignore or empty
                    },
                },
            }
        );
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

        // Construct the URL that the screenshot service will visit
        // We add snapshot=1 to tell the page to render in "clean/print" mode
        // And token to authenticate the screenshot service against RLS
        const targetUrl = `${base}/print/inbound?id=${id}&snapshot=1&token=${token}`;

        // Call external Puppeteer screenshot service
        const serviceBase = (process.env.SCREENSHOT_SERVICE_URL || '').trim() || 'https://chupanh.onrender.com';
        const screenshotUrl = `${serviceBase.replace(/\/+$/, '')}/screenshot?url=${encodeURIComponent(targetUrl)}`;

        // Set a timeout for the fetch
        const controller = new AbortController();
        const timeoutMs = 60000; // 60 seconds
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            console.log(`Fetching screenshot for ${targetUrl} from ${screenshotUrl}`);

            const res = await fetch(screenshotUrl, {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-store'
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                console.error('Screenshot service error', res.status, body);
                return NextResponse.json({ error: 'SCREENSHOT_SERVICE_ERROR', details: body }, { status: 502 });
            }

            const buffer = await res.arrayBuffer();
            const contentType = res.headers.get('content-type') || 'image/jpeg';

            return new NextResponse(Buffer.from(buffer), {
                status: 200,
                headers: {
                    'content-type': contentType,
                    'cache-control': 'public, max-age=3600',
                    'content-disposition': `inline; filename="phieu-nhap-${id}.jpg"`
                },
            });
        } catch (err: any) {
            console.error('Fetch error:', err);
            return NextResponse.json({ error: 'FETCH_ERROR', details: String(err) }, { status: 502 });
        } finally {
            clearTimeout(timer);
        }

    } catch (err: any) {
        console.error('Internal error:', err);
        return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR', details: String(err) }, { status: 500 });
    }
}
