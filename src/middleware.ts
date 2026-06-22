import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    // IMPORTANT: Use getUser() to validate auth state on server side reliably
    const { data: { user } } = await supabase.auth.getUser()

    const url = request.nextUrl.clone()
    const path = url.pathname

    // CUSTOM DOMAIN LOGIC
    let hostname = request.headers.get('host')!

    // Normalize hostname by removing www. prefix if present
    if (hostname.startsWith('www.')) {
        hostname = hostname.replace('www.', '')
    }

    // Simple check: assume 'localhost' and 'vercel.app' are NOT custom domains
    const isCustomDomain = !hostname.includes('localhost') && !hostname.includes('vercel.app') && !hostname.includes('toanthang.vn') && !hostname.includes('ngrok-free.dev') && !hostname.includes('ngrok.io')

    if (isCustomDomain && !path.startsWith('/_next') && !path.startsWith('/static')) {
        // Use Service Role for Lookup to bypass RLS issues
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                }
            }
        )

        // Look up company by domain
        const { data: company, error } = await supabaseAdmin
            .from('companies')
            .select('id, name')
            .eq('custom_domain', hostname)
            .single()

        if (error) {
            console.log('[Middleware] Domain Lookup Error:', error.message)
        }

        if (company) {
            // Found company for this domain
            // 1. Enforce Isolation: If user is logged in, must belong to this company
            if (user) {
                // We need to fetch user profile to check company_id
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('company_id')
                    .eq('id', user.id)
                    .single()

                // If user has no profile or belongs to different company -> Redirect/Error
                // Exception: Super Admin (but Super Admin should probably use main domain? Or allowed?)
                // Let's strictly enforce: Accessing via custom domain requires membership.
                const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'tungdibui2609@gmail.com'
                const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL

                if (profile && profile.company_id !== company.id && !isSuperAdmin) {
                    // Unauthorized for this tenant

                    // FAILSAFE: If we are already on '/login' with the error param, DO NOT redirect again.
                    // This breaks the loop.
                    const isLoginError = path === '/login' && url.searchParams.get('error') === 'unauthorized_domain'

                    if (!isLoginError) {
                        const errorUrl = request.nextUrl.clone()
                        errorUrl.pathname = '/login'
                        errorUrl.searchParams.set('error', 'unauthorized_domain')
                        return NextResponse.redirect(errorUrl)
                    }
                }
            }

            // 2. Set Context Header for Server Components (optional but good)
            response.headers.set('x-company-id', company.id)
        } else {
            // Domain points here but not configured in DB -> 404
            // Only if it's NOT a static asset/api (already filtered above partially)
            if (!path.startsWith('/api')) {
                const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Liên kết chưa được kích hoạt | Modular WMS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%);
            --panel-bg: rgba(30, 27, 75, 0.4);
            --border-color: rgba(255, 255, 255, 0.08);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-color: #a855f7;
            --accent-gradient: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', sans-serif;
            background: var(--bg-gradient);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow: hidden;
            position: relative;
        }

        body::before, body::after {
            content: '';
            position: absolute;
            width: 300px;
            height: 300px;
            border-radius: 50%;
            filter: blur(120px);
            z-index: 0;
            opacity: 0.4;
        }
        body::before {
            background: #818cf8;
            top: 20%;
            left: 20%;
            animation: float-slow 10s ease-in-out infinite alternate;
        }
        body::after {
            background: #c084fc;
            bottom: 20%;
            right: 20%;
            animation: float-slow 12s ease-in-out infinite alternate-reverse;
        }

        @keyframes float-slow {
            0% { transform: translate(0, 0) scale(1); }
            100% { transform: translate(40px, 20px) scale(1.2); }
        }

        .container {
            position: relative;
            z-index: 10;
            width: 100%;
            max-width: 500px;
            background: var(--panel-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 40px 32px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes fade-in {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .icon-container {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: rgba(168, 85, 247, 0.1);
            border: 1px solid rgba(168, 85, 247, 0.2);
            margin-bottom: 24px;
            color: #c084fc;
            animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse-ring {
            0%, 100% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4);
            }
            50% {
                transform: scale(1.05);
                box-shadow: 0 0 0 12px rgba(168, 85, 247, 0);
            }
        }

        h1 {
            font-size: 24px;
            font-weight: 800;
            line-height: 1.3;
            margin-bottom: 12px;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.5px;
        }

        .domain-tag {
            display: inline-block;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 99px;
            padding: 6px 16px;
            font-size: 14px;
            color: #818cf8;
            font-family: monospace;
            margin-bottom: 20px;
            letter-spacing: 0.5px;
        }

        p {
            font-size: 15px;
            line-height: 1.6;
            color: var(--text-secondary);
            margin-bottom: 28px;
        }

        .support-info {
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            padding-top: 20px;
            margin-top: 8px;
        }

        .support-title {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: rgba(255, 255, 255, 0.4);
            margin-bottom: 12px;
        }

        .contact-link {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #fff;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            background: var(--accent-gradient);
            padding: 10px 24px;
            border-radius: 99px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(168, 85, 247, 0.3);
        }

        .contact-link:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(168, 85, 247, 0.5);
            opacity: 0.95;
        }

        .footer {
            margin-top: 24px;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.2);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon-container">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
        </div>
        <h1>Liên kết chưa kích hoạt</h1>
        <div class="domain-tag">${hostname}</div>
        <p>
            Xin lỗi quý khách, liên kết truy cập hiện tại chưa được kích hoạt hoặc không tồn tại trên hệ thống. Vui lòng kiểm tra lại đường dẫn hoặc liên hệ với Quản trị viên để được hỗ trợ.
        </p>
        <div class="support-info">
            <div class="support-title">Hỗ trợ kỹ thuật</div>
            <a href="mailto:tungdibui2609@gmail.com" class="contact-link">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                Liên hệ Quản trị viên
            </a>
        </div>
        <div class="footer">
            &copy; 2026 Modular WMS. Bảo lưu mọi quyền.
        </div>
    </div>
</body>
</html>`
                return new NextResponse(html, {
                    status: 404,
                    headers: { 'content-type': 'text/html; charset=utf-8' },
                })
            }
        }
    }

    // Constants
    const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'tungdibui2609@gmail.com'
    const IS_ADMIN_ROUTE = path.startsWith('/admin')
    const IS_LOGIN_PAGE = path === '/login'
    const IS_ADMIN_LOGIN_PAGE = path === '/admin/login' // Updated path
    const IS_SANXUAT_ROUTE = path.startsWith('/sanxuat')
    const IS_SANXUAT_LOGIN_PAGE = path === '/sanxuat/login'

    // Skip static assets and internal next paths
    if (path.startsWith('/_next') || path.startsWith('/static') || path.includes('.')) {
        return response
    }

    // API Routes protection which requires user session
    // Exception: /api/restore-admin (Public recovery endpoint) and /api/auth/* (Supabase callback)
    if (!user && path.startsWith('/api/') && !path.startsWith('/api/restore-admin') && !path.startsWith('/api/auth/') && !path.startsWith('/api/debug-perms')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Unauthenticated User Logic
    if (!user) {
        // Allow public routes
        const isSilentPrint = path === '/warehouses/lots/print-station' && url.searchParams.get('silent') === 'true'
        if (IS_LOGIN_PAGE || IS_ADMIN_LOGIN_PAGE || IS_SANXUAT_LOGIN_PAGE || path.startsWith('/print') || path.startsWith('/api/') || path.startsWith('/public') || isSilentPrint) {
            return response
        }

        // Redirect based on target
        if (IS_ADMIN_ROUTE) {
            url.pathname = '/admin/login' // Redirect to new Admin Login
        } else if (IS_SANXUAT_ROUTE) {
            url.pathname = '/sanxuat/login'
        } else {
            url.pathname = '/login'
        }
        return NextResponse.redirect(url)
    }

    // 2. Authenticated User Logic
    if (user) {
        const isSuperAdmin = user.email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
        const hasErrorParam = url.searchParams.has('error')

        // 2.1 Handling Login Pages (Redirect if already logged in)
        // ONLY Redirect if there is NO error param (to avoid loop when we redirect to login with error)
        if (IS_LOGIN_PAGE && !hasErrorParam) {
            if (isSuperAdmin) {
                url.pathname = '/admin/dashboard'
            } else {
                url.pathname = '/select-system'
            }
            return NextResponse.redirect(url)
        }

        if (IS_SANXUAT_LOGIN_PAGE && !hasErrorParam) {
            url.pathname = '/sanxuat/dashboard'
            return NextResponse.redirect(url)
        }

        if (IS_ADMIN_LOGIN_PAGE) {
            if (isSuperAdmin) {
                // If Super Admin, go to dashboard
                url.pathname = '/admin/dashboard'
                return NextResponse.redirect(url)
            } else {
                // If Normal User logic tries to access Admin Login, send them Home
                url.pathname = '/'
                return NextResponse.redirect(url)
            }
        }

        // 2.2 Protect Admin Routes
        if (IS_ADMIN_ROUTE && !IS_ADMIN_LOGIN_PAGE) {
            if (!isSuperAdmin) {
                // Tenant trying to access admin area -> Kick out
                console.log(`[Middleware] Unauthorized Admin Access Attempt by: ${user.email}`)
                url.pathname = '/'
                return NextResponse.redirect(url)
            }
            // Super Admin accessing /admin/* -> Allow (Fallthrough)
        }

        // 2.3 Strict Isolation: Prevent Super Admin from accessing Tenant Routes
        if (isSuperAdmin && !IS_ADMIN_ROUTE && !IS_ADMIN_LOGIN_PAGE && !path.startsWith('/api')) {
            // If Super Admin tries to access non-admin pages (like /select-system, /inventory, etc.)
            // Redirect them back to Admin Dashboard
            console.log(`[Middleware] Super Admin redirected from App Route: ${path}`)
            url.pathname = '/admin/dashboard'
            return NextResponse.redirect(url)
        }
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
