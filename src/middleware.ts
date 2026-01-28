import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // Create a Supabase client configured to use cookies
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

    // Refresh session if expired - required for Server Components
    const { data: { session } } = await supabase.auth.getSession()

    // Protected routes logic
    // Protected routes logic
    const isLoginPage = request.nextUrl.pathname === '/login'
    // The Admin Login page is now exactly '/admin'
    const isAdminLoginPage = request.nextUrl.pathname === '/admin'
    const isPublicRoute = isLoginPage || isAdminLoginPage || request.nextUrl.pathname.startsWith('/print')

    if (!session && !isPublicRoute) {
        // Handle API routes to return JSON instead of redirecting to HTML login
        if (request.nextUrl.pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Redirect unauthenticated users to login page
        const url = request.nextUrl.clone()
        // Determine where to redirect based on tried path
        if (request.nextUrl.pathname.startsWith('/admin')) {
            url.pathname = '/admin'
        } else {
            url.pathname = '/login'
        }
        return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from login pages
    if (session) {
        if (isLoginPage) {
            const url = request.nextUrl.clone()
            url.pathname = '/select-system' // Regular users go here by default
            return NextResponse.redirect(url)
        }
        if (isAdminLoginPage) {
            const url = request.nextUrl.clone()
            if (session.user.email?.toLowerCase().trim() === 'tungdibui2609@gmail.com') {
                url.pathname = '/admin/companies'
            } else {
                // If logged in but not admin, maybe logout or redirect home? 
                // For now, redirect to home to avoid confusion
                url.pathname = '/'
            }
            return NextResponse.redirect(url)
        }
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - api (API routes, if any public ones exist - currently protecting everything else)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
