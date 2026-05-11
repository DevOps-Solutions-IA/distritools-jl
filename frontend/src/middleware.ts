import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_ACCESS_COOKIE = 'dt_admin_access';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const isLogin = pathname === '/admin/login';
  const hasAccessCookie = Boolean(request.cookies.get(ADMIN_ACCESS_COOKIE)?.value);

  if (isLogin && hasAccessCookie) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (!isLogin && !hasAccessCookie) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
