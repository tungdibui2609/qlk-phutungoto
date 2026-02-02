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

        // Resolve absolute preview URL
        const envBase = (process.env.PRINT_BASE || '').toString().trim().replace(/\/$/, '');
        const base = envBase || safeHostFromReq(req) || 'http://localhost:3000';

        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll() },
                    setAll(cookiesToSet: any) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }: any) =>
                                cookieStore.set(name, value, options)
                            )
                        } catch { }
                    },
                },
            }
        );
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || searchParams.get('token') || '';

        // Fetch company settings server-side
        const { data: companyData } = await supabase
            .from('company_settings')
            .select('*')
            .limit(1)
            .single();

        // Construct the URL for screenshot service
        const params = new URLSearchParams();
        searchParams.forEach((value, key) => { params.set(key, value) });
        params.set('snapshot', '1');
        params.set('token', token);

        if (companyData) {
            if (companyData.name) params.set('cmp_name', companyData.name);
            if (companyData.address) params.set('cmp_address', companyData.address);
            if (companyData.phone) params.set('cmp_phone', companyData.phone);
            if (companyData.email) params.set('cmp_email', companyData.email);
            if (companyData.logo_url) params.set('cmp_logo', companyData.logo_url);
            if (companyData.short_name) params.set('cmp_short', companyData.short_name);
        }

        // Target URL is our new map print page
        const targetUrl = `${base}/print/warehouse-map?${params.toString()}`;

        // Call external screenshot service
        const serviceBase = (process.env.SCREENSHOT_SERVICE_URL || '').trim() || 'https://chupanh.onrender.com';
        // Increased width for map might be needed, but A4 standard is ~794px
        const screenshotUrl = `${serviceBase.replace(/\/+$/, '')}/screenshot?url=${encodeURIComponent(targetUrl)}&selector=${encodeURIComponent('#print-ready[data-ready="true"]')}&width=1200&timeout=60000`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 90000);

        try {
            console.log(`Fetching map snapshot from ${screenshotUrl}`);
            const res = await fetch(screenshotUrl, { signal: controller.signal, cache: 'no-store' });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                return NextResponse.json({ error: 'SCREENSHOT_SERVICE_ERROR', details: body }, { status: 502 });
            }

            const buffer = await res.arrayBuffer();
            const contentType = res.headers.get('content-type') || 'image/jpeg';

            return new NextResponse(Buffer.from(buffer), {
                status: 200,
                headers: {
                    'content-type': contentType,
                    'cache-control': 'public, max-age=3600',
                    'content-disposition': `inline; filename="so-do-kho.jpg"`
                },
            });
        } catch (err: any) {
            return NextResponse.json({ error: 'FETCH_ERROR', details: String(err) }, { status: 502 });
        } finally {
            clearTimeout(timer);
        }

    } catch (err: any) {
        return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR', details: String(err) }, { status: 500 });
    }
}
