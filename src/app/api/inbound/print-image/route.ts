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
                    setAll(cookiesToSet: any) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }: any) =>
                                cookieStore.set(name, value, options)
                            )
                        } catch {
                        }
                    },
                },
            }
        );
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

        // Fetch company settings server-side to ensure availability
        const { data: companyData } = await supabase
            .from('company_settings')
            .select('*')
            .limit(1)
            .single();

        // Construct the URL that the screenshot service will visit
        // We pass company info via params to avoid client-side fetch issues
        const params = new URLSearchParams();

        // Forward all params from request (print type, editable fields, etc.)
        searchParams.forEach((value, key) => {
            params.set(key, value);
        });

        // Ensure system params are set
        params.set('id', id);
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

        // Fetch order to get system_code
        const { data: orderData } = await supabase
            .from('inbound_orders')
            .select('system_code')
            .eq('id', id)
            .single();

        let inboundModules = '';
        if (orderData?.system_code) {
            const { data: sysData } = await supabase
                .from('systems')
                .select('inbound_modules')
                .eq('code', orderData.system_code)
                .single();
            if (sysData?.inbound_modules) {
                const modules = sysData.inbound_modules;
                if (Array.isArray(modules)) inboundModules = modules.join(',');
            }
        }

        // Fetch units map to pass to client
        const { data: unitsData } = await supabase
            .from('units')
            .select('id, name');

        let unitsJson = '';
        if (unitsData) {
            const minUnits = unitsData.map(u => ({ i: u.id, n: u.name }));
            unitsJson = JSON.stringify(minUnits);
        }

        // Fetch items with product details to pass to client
        const { data: itemsData } = await supabase
            .from('inbound_order_items')
            .select(`
                *,
                products (
                    sku,
                    unit,
                    product_units (
                        unit_id,
                        conversion_rate
                    )
                )
            `)
            .eq('order_id', id);

        let itemsJson = '';
        if (itemsData) {
            itemsJson = JSON.stringify(itemsData);
        }

        // Serialize order data to pass to client
        let orderJson = '';
        if (orderData) {
            // Need to include supplier name relation which we didn't fetch fully above
            const { data: fullOrder } = await supabase
                .from('inbound_orders')
                .select(`
                    *,
                    supplier:suppliers(name),
                    order_types(name)
                `)
                .eq('id', id)
                .single();

            if (fullOrder) {
                orderJson = JSON.stringify(fullOrder);
            }
        }

        const targetUrl = `${base}/print/inbound?${params.toString()}&modules=${encodeURIComponent(inboundModules)}&units_data=${encodeURIComponent(unitsJson)}&items_data=${encodeURIComponent(itemsJson)}&order_data=${encodeURIComponent(orderJson)}`;

        // Call external Puppeteer screenshot service
        const serviceBase = (process.env.SCREENSHOT_SERVICE_URL || '').trim() || 'https://chupanh.onrender.com';
        const screenshotUrl = `${serviceBase.replace(/\/+$/, '')}/screenshot?url=${encodeURIComponent(targetUrl)}&selector=${encodeURIComponent('#print-ready[data-ready="true"]')}&width=1240&timeout=30000`;

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
