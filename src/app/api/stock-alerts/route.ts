import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
    try {
        const { productId, productIds, systemCode, isManual } = await req.json()
        const ids: string[] = Array.isArray(productIds) ? productIds : (productId ? [productId] : [])

        if (ids.length === 0 || !systemCode) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        cookieStore.set({ name, value, ...options })
                    },
                    remove(name: string, options: CookieOptions) {
                        cookieStore.set({ name, value: '', ...options })
                    },
                },
            }
        )

        // 1. Fetch Products and their thresholds
        const { data: allProducts, error: prodError } = await supabase
            .from('products')
            .select('id, sku, name, unit, min_stock_level, critical_stock_level, last_notified_at')
            .in('id', ids)

        if (prodError || !allProducts) {
            return NextResponse.json({ error: 'Products not found' }, { status: 404 })
        }

        // 2. Fetch Lots & Items for Stock Calculation
        const { data: allLots, error: lotError } = await supabase
            .from('lots' as any)
            .select('id, product_id, quantity, lot_items(product_id, quantity)')
            .eq('system_code', systemCode)
            .eq('status', 'active')

        if (lotError) throw lotError
        const lots = (allLots as any[]) || []

        // 3. Process each product
        const productsToNotify: any[] = []
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000)

        for (const product of allProducts) {
            // Calculate stock for this product
            let total = 0
            lots.forEach(lot => {
                if (lot.lot_items && lot.lot_items.length > 0) {
                    lot.lot_items.forEach((item: any) => {
                        if (item.product_id === product.id) total += (item.quantity || 0)
                    })
                } else if (lot.product_id === product.id) {
                    total += (lot.quantity || 0)
                }
            })

            const m2 = product.min_stock_level || 0
            const m1 = product.critical_stock_level || 0

            // Determination of severity
            let severity: 'critical' | 'warning' | 'ok' = 'ok'
            if (total <= 0 || total <= m1) severity = 'critical'
            else if (total <= m2) severity = 'warning'

            // Inclusion logic:
            // If manual: Include ALL products
            // If automated: Only include those below threshold AND not throttled
            if (isManual) {
                productsToNotify.push({
                    ...product,
                    current_stock: total,
                    severity,
                    statusText: severity === 'critical' ? 'BÁO ĐỘNG (M1)' : (severity === 'warning' ? 'CHUẨN BỊ (M2)' : 'AN TOÀN'),
                    color: severity === 'critical' ? '#e11d48' : (severity === 'warning' ? '#f59e0b' : '#10b981'),
                    bgColor: severity === 'critical' ? '#fff1f2' : (severity === 'warning' ? '#fffbeb' : '#f0fdf4')
                })
            } else {
                if (severity === 'ok') continue
                
                // Throttle check (only for auto alerts)
                if (product.last_notified_at && new Date(product.last_notified_at) > fourHoursAgo) {
                    continue
                }

                productsToNotify.push({
                    ...product,
                    current_stock: total,
                    severity,
                    statusText: severity === 'critical' ? 'BÁO ĐỘNG (M1)' : 'CHUẨN BỊ (M2)',
                     color: severity === 'critical' ? '#e11d48' : '#f59e0b',
                    bgColor: severity === 'critical' ? '#fff1f2' : '#fffbeb'
                })
            }
        }

        if (productsToNotify.length === 0) {
            return NextResponse.json({ message: 'No products need notification.' })
        }

        // 4. Fetch Email Recipients for this system
        const { data: system } = await supabase
            .from('systems')
            .select('name, modules')
            .eq('code', systemCode)
            .single()

        const recipients = (system?.modules as any)?.stock_warning_emails || []
        if (recipients.length === 0) {
            return NextResponse.json({ error: 'No recipients configured' }, { status: 400 })
        }

        // 5. Send Email via Gmail SMTP
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS,
            },
        })

        const rowsHtml = productsToNotify.map(p => `
            <tr style="background: ${p.bgColor};">
                <td style="padding: 12px; border: 1px solid #ddd;">
                    <strong style="color: #334155;">${p.name}</strong><br/>
                    <small style="color: #64748b;">Mã: ${p.sku}</small>
                </td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: ${p.color};">
                    ${p.current_stock} ${p.unit}
                </td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: center; font-size: 11px; color: #64748b;">
                    M1: ${p.critical_stock_level || 0}<br/>
                    M2: ${p.min_stock_level || 0}
                </td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
                    <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background: ${p.color}; color: white; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                        ${p.statusText}
                    </span>
                </td>
            </tr>
        `).join('')

        const mailSubject = isManual 
            ? `[BÁO CÁO TỒN KHO THỰC TẾ] - ${system?.name || systemCode} - ${new Date().toLocaleDateString('vi-VN')}`
            : `[CẢNH BÁO TỒN KHO PHÂN CẤP] - ${productsToNotify.length} sản phẩm - ${system?.name || systemCode}`

        const mailTitle = isManual
            ? `📊 Báo cáo tồn kho thực tế (Gửi thủ công)`
            : `⚠️ Cảnh báo tồn kho 2 cấp độ`

        const mailDescription = isManual
            ? `Báo cáo tình trạng tồn kho hiện tại được yêu cầu gửi thủ công từ hệ thống:`
            : `Hệ thống ghi nhận biến động tồn kho tại <strong>${system?.name || systemCode}</strong>:`

        const mailOptions = {
            from: `"Hệ thống WMS" <${process.env.GMAIL_USER}>`,
            to: recipients.join(', '),
            subject: mailSubject,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; max-width: 800px; margin: auto; background-color: #f8fafc;">
                    <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <h2 style="color: ${isManual ? '#4f46e5' : '#e11d48'}; margin-top: 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px;">${mailTitle}</h2>
                        <p style="color: #475569; font-size: 15px;">${mailDescription}</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px;">
                            <thead>
                                <tr style="background: #f1f5f9; color: #475569;">
                                    <th style="padding: 12px; border: 1px solid #cbd5e1; text-align: left;">Sản phẩm</th>
                                    <th style="padding: 12px; border: 1px solid #cbd5e1; text-align: center;">Tồn thực tế</th>
                                    <th style="padding: 12px; border: 1px solid #cbd5e1; text-align: center;">Ngưỡng (M1/M2)</th>
                                    <th style="padding: 12px; border: 1px solid #cbd5e1; text-align: center;">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                        
                        <div style="margin-top: 32px; padding: 20px; background: #fff7ed; border-radius: 12px; border: 1px solid #ffedd5;">
                            <p style="margin: 0; font-weight: bold; color: #9a3412; font-size: 16px;">⚠️ Lưu ý quan trọng từ bộ phận Kho:</p>
                            <ul style="margin: 12px 0 0 0; color: #c2410c; font-size: 13px; line-height: 1.6;">
                                <li>Email này được xem như một **Thông báo tồn kho chính thức** gửi tới các bộ phận liên quan để phối hợp xử lý.</li>
                                <li><strong>Bộ phận Kho không chịu trách nhiệm</strong> nếu sau thông báo này hàng hóa không đủ cung cấp phục vụ cho kế hoạch sản xuất.</li>
                                <li><strong>Mức 1 (Đỏ)</strong>: Yêu cầu nhập hàng khẩn cấp ngay lập tức.</li>
                                <li><strong>Mức 2 (Cam)</strong>: Yêu cầu chuẩn bị kế hoạch nhập hàng trong thời gian tới.</li>
                                ${isManual ? `<li><strong>Báo cáo thủ công</strong>: Được tạo lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')}.</li>` : ''}
                            </ul>
                        </div>

                        <p style="margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                            Đây là email tự động từ hệ thống Modular WMS. Vui lòng không trả lời.
                        </p>
                    </div>
                </div>
            `,
        }

        await transporter.sendMail(mailOptions)

        // 6. Update last_notified_at (ONLY for items actually triggering an alert in auto mode)
        if (!isManual) {
            const now = new Date().toISOString()
            const notifyIds = productsToNotify.map(p => p.id)
            
            await supabase
                .from('products')
                .update({ last_notified_at: now })
                .in('id', notifyIds)
        }

        return NextResponse.json({ 
            success: true, 
            message: isManual ? 'Status report sent manually.' : `Batch alert sent for ${productsToNotify.length} products.`,
            count: productsToNotify.length 
        })

        return NextResponse.json({ 
            success: true, 
            message: `Batch alert sent for ${productsToNotify.length} products.`,
            count: productsToNotify.length 
        })

    } catch (error: any) {
        console.error('Error in batch stock-alerts API:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
