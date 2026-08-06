import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

/**
 * Next.js 16 renamed the `middleware` convention to `proxy`.
 *
 * Only the edge-safe half of the Auth.js config is imported here, so no
 * database driver and no bcrypt end up in the edge bundle. Next requires a
 * default (or named `proxy`) function export, so `auth` is exported directly.
 */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif)$).*)'],
};
