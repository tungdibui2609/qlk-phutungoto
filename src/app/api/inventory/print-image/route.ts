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
        // Inventory reports might not have an ID, but depend on filters.
        // However, the proxy logic just needs to forward params.

        // Resolve absolute preview URL
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
        const params = new URLSearchParams();

        // Forward all params from request
        searchParams.forEach((value, key) => {
            params.set(key, value);
        });

        // PRE-FETCH DATA LOGIC
        const type = searchParams.get('type') || 'accounting';
        const systemType = searchParams.get('systemType');
        const warehouse = searchParams.get('warehouse');
        const dateTo = searchParams.get('to');
        const searchTerm = searchParams.get('search') || searchParams.get('q') || '';
        const convertToKg = searchParams.get('convertToKg') === 'true';

        let reportData: any = { ok: true, items: [] };

        try {
            if (type === 'accounting' || type === 'reconciliation') {
                // Replicate Accounting Logic
                // 1. Fetch Inbound
                let inboundQuery = supabase
                    .from('inbound_order_items')
                    .select(`product_id, product_name, unit, quantity, order:inbound_orders!inner(status, warehouse_name, created_at, system_code)`)
                    .eq('order.status', 'Completed');

                if (systemType) inboundQuery = inboundQuery.eq('order.system_code', systemType);
                if (warehouse && warehouse !== 'Tất cả') inboundQuery = inboundQuery.eq('order.warehouse_name', warehouse);
                if (dateTo) inboundQuery = inboundQuery.lte('order.created_at', `${dateTo} 23:59:59`);

                const { data: inboundItems } = await inboundQuery;

                // 2. Fetch Outbound
                let outboundQuery = supabase
                    .from('outbound_order_items')
                    .select(`product_id, product_name, unit, quantity, order:outbound_orders!inner(status, warehouse_name, created_at, system_code)`)
                    .eq('order.status', 'Completed');

                if (systemType) outboundQuery = outboundQuery.eq('order.system_code', systemType);
                if (warehouse && warehouse !== 'Tất cả') outboundQuery = outboundQuery.eq('order.warehouse_name', warehouse);
                if (dateTo) outboundQuery = outboundQuery.lte('order.created_at', `${dateTo} 23:59:59`);

                const { data: outboundItems } = await outboundQuery;

                // Helper data
                const { data: productsData } = await supabase.from('products').select('*');
                const { data: unitsData } = await supabase.from('units').select('*');
                const { data: prodUnitsData } = await supabase.from('product_units').select('*');

                // Build Maps
                const productMap = new Map();
                (productsData || []).forEach((p: any) => productMap.set(p.id, p));

                const unitNameMap = new Map();
                (unitsData || []).forEach((u: any) => unitNameMap.set(u.name.toLowerCase(), u.id));

                const conversionMap = new Map<string, Map<string, number>>();
                (prodUnitsData || []).forEach((pu: any) => {
                    if (!conversionMap.has(pu.product_id)) conversionMap.set(pu.product_id, new Map());
                    conversionMap.get(pu.product_id)!.set(pu.unit_id, pu.conversion_rate);
                });

                // Helpers
                const toBaseAmount = (pid: string, unitName: string | null, qty: number) => {
                    if (!pid || !unitName) return qty;
                    const prod = productMap.get(pid);
                    if (!prod) return qty;
                    if (prod.unit && prod.unit.toLowerCase() === unitName.toLowerCase()) return qty;
                    const uid = unitNameMap.get(unitName.toLowerCase());
                    if (!uid) return qty;
                    const rates = conversionMap.get(pid);
                    if (rates && rates.has(uid)) return qty * rates.get(uid)!;
                    return qty;
                };

                const getBaseToKgRate = (pid: string) => {
                    const prod = productMap.get(pid);
                    if (!prod) return null;
                    const kgNames = ['kg', 'kilogram', 'ki-lo-gam', 'kgs'];
                    if (prod.unit && kgNames.includes(prod.unit.toLowerCase())) return 1;
                    const rates = conversionMap.get(pid);
                    if (!rates) return null;
                    for (const name of kgNames) {
                        const uid = unitNameMap.get(name);
                        if (uid && rates.has(uid)) {
                            const val = rates.get(uid)!;
                            return val === 0 ? null : 1 / val;
                        }
                    }
                    return null;
                };

                // Processing
                const inventoryMap = new Map();

                const processItem = (item: any, type: 'in' | 'out') => {
                    // Note: Date filtering is already done in query for end date. Start date?
                    // User param 'from' exists. Accounting report logic usually calculates Opening from < FromDate
                    // But here api/inventory/route.ts logic: "if (isBeforePeriod) ..."
                    // I need that logic.
                    // Let's assume passed dateTo is the ONLY filter for now to save space? 
                    // No, Opening requires checking date.
                    const dateFrom = searchParams.get('from');
                    const itemDate = new Date(item.order.created_at);
                    const isBefore = dateFrom ? itemDate < new Date(dateFrom) : false;

                    const pid = item.product_id || 'unknown';
                    const wName = item.order.warehouse_name || 'Unknown';
                    const uName = item.unit || '';

                    let key = '', quantity = item.quantity, unitDisplay = uName, isUnconvertible = false;

                    if (convertToKg) {
                        const rate = getBaseToKgRate(pid);
                        if (rate !== null) {
                            key = `${pid}_${wName}_Kg`;
                            unitDisplay = 'Kg';
                            quantity = toBaseAmount(pid, uName, quantity) * rate;
                        } else {
                            key = `${pid}_${wName}_${uName}_UNCONVERTIBLE`;
                            isUnconvertible = true;
                        }
                    } else {
                        key = `${pid}_${wName}_${uName}`;
                    }

                    if (!inventoryMap.has(key)) {
                        const prod = productMap.get(pid);
                        inventoryMap.set(key, {
                            productId: pid,
                            productCode: prod?.sku || 'N/A',
                            productName: prod?.name || item.product_name || 'Unknown',
                            warehouse: wName,
                            unit: unitDisplay,
                            opening: 0, qtyIn: 0, qtyOut: 0, balance: 0,
                            isUnconvertible
                        });
                    }
                    const entry = inventoryMap.get(key);
                    if (isBefore) {
                        if (type === 'in') entry.opening += quantity;
                        else entry.opening -= quantity;
                    } else {
                        if (type === 'in') entry.qtyIn += quantity;
                        else entry.qtyOut += quantity;
                    }
                    if (type === 'in') entry.balance += quantity;
                    else entry.balance -= quantity;
                };

                (inboundItems || []).forEach((i: any) => processItem(i, 'in'));
                (outboundItems || []).forEach((i: any) => processItem(i, 'out'));

                let result = Array.from(inventoryMap.values());
                // Filter
                if (searchTerm) {
                    const q2 = searchTerm.toLowerCase();
                    result = result.filter((i: any) =>
                        i.productCode.toLowerCase().includes(q2) ||
                        i.productName.toLowerCase().includes(q2)
                    );
                }
                // Sort
                result.sort((a: any, b: any) => {
                    if (a.isUnconvertible && !b.isUnconvertible) return 1;
                    if (!a.isUnconvertible && b.isUnconvertible) return -1;
                    return a.productName.localeCompare(b.productName);
                });

                reportData.items = result;
            }

            if (type === 'lot') {
                let query = supabase.from('lots').select(`*, lot_items(id, quantity, product_id, products(name, unit, sku, product_code:id)), products!inner(name, unit, product_code:id, sku, system_type), suppliers(name), positions(code)`).eq('status', 'active').order('created_at', { ascending: false });
                if (systemType) query = query.eq('products.system_type', systemType);

                const { data: lots } = await query;

                if (lots) {
                    const mapped = lots.flatMap((lot: any) => {
                        if (lot.lot_items && lot.lot_items.length > 0) {
                            return lot.lot_items.map((item: any, idx: number) => ({
                                id: item.id || `${lot.id}-item-${idx}`,
                                lotCode: lot.code,
                                productSku: item.products?.sku || 'N/A',
                                productName: item.products?.name || 'Unknown',
                                productUnit: item.products?.unit || '-',
                                quantity: item.quantity,
                                batchCode: lot.batch_code || '-',
                                inboundDate: lot.inbound_date,
                                positions: lot.positions,
                                supplierName: lot.suppliers?.name || '-'
                            }));
                        } else if (lot.products) {
                            return [{
                                id: lot.id,
                                lotCode: lot.code,
                                productSku: lot.products.sku || 'N/A',
                                productName: lot.products.name,
                                productUnit: lot.products.unit,
                                quantity: lot.quantity,
                                batchCode: lot.batch_code || '-',
                                inboundDate: lot.inbound_date,
                                positions: lot.positions,
                                supplierName: lot.suppliers?.name || '-'
                            }];
                        }
                        return [];
                    });
                    reportData.lotItems = mapped.filter((item: any) => !searchTerm || item.lotCode.includes(searchTerm) || item.productName.includes(searchTerm));
                }
            }

            // Reconciliation logic part 2 (Lots)
            if (type === 'reconciliation') {
                const { data: lots } = await supabase.from('lots').select('product_id, quantity, products!inner(name, sku, unit, system_type)').eq('status', 'active').eq('products.system_type', systemType!);
                // We have accItems in reportData.items from accounting block above
                // Logic to merge...
                // To save space, maybe we just pass 'accItems' and 'lots' and let client merge?
                // Or merge here. Let's merge here.
                const accItems = reportData.items;
                const lotMap = new Map<string, number>();
                const productDetails = new Map<string, any>();
                (lots || []).forEach((lot: any) => {
                    if (!lot.product_id) return;
                    lotMap.set(lot.product_id, (lotMap.get(lot.product_id) || 0) + lot.quantity);
                    if (lot.products && !productDetails.has(lot.product_id)) productDetails.set(lot.product_id, lot.products);
                });

                const comparisonMap = new Map();
                accItems.forEach((acc: any) => {
                    const lotQty = lotMap.get(acc.productId) || 0;
                    comparisonMap.set(acc.productId, {
                        productId: acc.productId, productCode: acc.productCode, productName: acc.productName, unit: acc.unit,
                        accountingBalance: acc.balance, lotBalance: lotQty, diff: acc.balance - lotQty
                    });
                    lotMap.delete(acc.productId);
                });
                lotMap.forEach((qty, pid) => {
                    const d = productDetails.get(pid);
                    comparisonMap.set(pid, {
                        productId: pid, productCode: d?.sku || 'N/A', productName: d?.name || 'Unknown', unit: d?.unit || '',
                        accountingBalance: 0, lotBalance: qty, diff: 0 - qty
                    });
                });
                reportData.reconcileItems = Array.from(comparisonMap.values());
            }

            // Minify JSON to save space?
            // Sending raw JSON. 
            // NOTE: URL limit. If > 10KB, risk of failure.
            // Check for large data?

            const jsonStr = JSON.stringify(reportData);
            params.set('data', jsonStr);

        } catch (e) {
            console.error('Prefetch error', e);
            // Continue without data, client might fail but we try.
        }

        // Ensure specific system params

        // Ensure specific system params
        params.set('snapshot', '1');

        // Use token from session (server-side cookie) OR from params (passed from client)
        const paramToken = searchParams.get('token');
        const finalToken = token || paramToken || '';
        params.set('token', finalToken);

        if (companyData) {
            if (companyData.name) params.set('cmp_name', companyData.name);
            if (companyData.address) params.set('cmp_address', companyData.address);
            if (companyData.phone) params.set('cmp_phone', companyData.phone);
            if (companyData.email) params.set('cmp_email', companyData.email);
            if (companyData.logo_url) params.set('cmp_logo', companyData.logo_url);
            if (companyData.short_name) params.set('cmp_short', companyData.short_name);
        }

        const targetUrl = `${base}/print/inventory?${params.toString()}`;

        // Call external Puppeteer screenshot service
        // Call external Puppeteer screenshot service
        const serviceBase = (process.env.SCREENSHOT_SERVICE_URL || '').trim() || 'https://chupanh.onrender.com';
        const screenshotUrl = `${serviceBase.replace(/\/+$/, '')}/screenshot?url=${encodeURIComponent(targetUrl)}&selector=${encodeURIComponent('#print-ready[data-ready="true"]')}&width=794&timeout=30000`;

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

            // Generate filename based on date or report type
            const dateTo = searchParams.get('to') || 'report';
            const filename = `bao-cao-ton-${dateTo}.jpg`;

            return new NextResponse(Buffer.from(buffer), {
                status: 200,
                headers: {
                    'content-type': contentType,
                    'cache-control': 'public, max-age=3600',
                    'content-disposition': `inline; filename="${filename}"`
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
