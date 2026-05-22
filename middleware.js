import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, searchParams } = request.nextUrl

  // Allow demo dashboard
  if (pathname === '/dashboard' && searchParams.get('demo') === 'true') {
    return supabaseResponse
  }

  // Protect dashboard and import routes — preserve return path for post-login
  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/import'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const returnPath = pathname + (request.nextUrl.search || '')
    url.searchParams.set('next', returnPath)
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from login (honor ?next= when safe)
  if (user && pathname === '/login') {
    const nextParam = searchParams.get('next')
    const safeNext =
      nextParam &&
      nextParam.startsWith('/') &&
      !nextParam.startsWith('//') &&
      !nextParam.includes('://')
    if (safeNext) {
      return NextResponse.redirect(new URL(nextParam, request.url))
    }
    const url = request.nextUrl.clone()
    url.pathname = '/import'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
