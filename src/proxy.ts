import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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
                console.log(`[Proxy] Unauthorized Admin Access Attempt by: ${user.email}`)
                url.pathname = '/'
                return NextResponse.redirect(url)
            }
            // Super Admin accessing /admin/* -> Allow (Fallthrough)
        }

        // 2.3 Strict Isolation: Prevent Super Admin from accessing Tenant Routes
        if (isSuperAdmin && !IS_ADMIN_ROUTE && !IS_ADMIN_LOGIN_PAGE && !path.startsWith('/api')) {
            // If Super Admin tries to access non-admin pages (like /select-system, /inventory, etc.)
            // Redirect them back to Admin Dashboard
            console.log(`[Proxy] Super Admin redirected from App Route: ${path}`)
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
