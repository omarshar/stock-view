import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Check if the user is authenticated
  if (!session) {
    // If the user is not authenticated and trying to access a protected route
    if (req.nextUrl.pathname.startsWith('/dashboard')) {
      const redirectUrl = new URL('/auth/login', req.url);
      return NextResponse.redirect(redirectUrl);
    }
  } else {
    // If the user is authenticated and trying to access auth pages
    if (req.nextUrl.pathname.startsWith('/auth')) {
      const redirectUrl = new URL('/dashboard', req.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*'],
};
