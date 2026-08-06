import type { NextAuthConfig } from 'next-auth';
import type { Session, User } from 'next-auth';
import type { JWT } from '@auth/core/jwt';
import type { NextRequest } from 'next/server';

/**
 * Edge-safe half of the Auth.js config. The middleware imports only this file,
 * so no database driver and no bcrypt are pulled into the edge runtime.
 *
 * Callback parameters are annotated explicitly: in next-auth 5 beta the
 * `callbacks` property resolves to `any`, so relying on contextual typing
 * would silently give up type safety exactly where authorisation is decided.
 */
export const authConfig = {
  pages: { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    authorized({ auth, request }: { auth: Session | null; request: NextRequest }): boolean {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;

      if (pathname.startsWith('/admin')) return isLoggedIn && auth?.user?.isAdmin === true;
      // /rooms (Phase 6), /crews (Phase 7), and /marketplace (Phase 9) have
      // no guest mode, unlike /chat — every participant is a real team
      // member, so all three are gated the same way /dashboard is rather
      // than left to requireUser() to throw uncaught.
      if (
        pathname.startsWith('/dashboard') || pathname.startsWith('/rooms') ||
        pathname.startsWith('/crews') || pathname.startsWith('/marketplace')
      ) {
        return isLoggedIn;
      }

      return true;
    },
    // Shared with the Node runtime (src/lib/auth.ts) — must live here too,
    // not just there, because the edge middleware (src/proxy.ts) builds its
    // own NextAuth() instance from this edge-safe config alone. Without it,
    // the JWT/session in the middleware never carries `isAdmin`, so the
    // `/admin` check above sees it as always undefined and no admin can
    // ever pass, regardless of credentials.
    jwt({ token, user }: { token: JWT; user?: User }): JWT {
      if (user) {
        token.uid = user.id;
        token.isAdmin = user.isAdmin ?? false;
        token.defaultTeamId = user.defaultTeamId;
      }
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }): Session {
      if (token.uid) session.user.id = token.uid;
      session.user.isAdmin = token.isAdmin ?? false;
      // Non-null by DB constraint (users.default_team_id is NOT NULL — see
      // drizzle/0006_teams_not_null.sql) for every account created after the
      // teams retrofit; the `!` reflects that guarantee, not a hope.
      session.user.defaultTeamId = token.defaultTeamId!;
      return session;
    },
  },
} satisfies NextAuthConfig;
