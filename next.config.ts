import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'ui-avatars.com' }],
  },
  async headers() {
    return [
      {
        // Streaming must not be buffered by any intermediary.
        source: '/api/chat',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'X-Accel-Buffering', value: 'no' },
        ],
      },
      {
        // Embeddable persona widgets are the one thing allowed to be framed.
        // X-Frame-Options has no "allow any origin" value (ALLOW-FROM is dead
        // in every current browser), so this route omits it entirely and uses
        // CSP frame-ancestors instead — the modern mechanism, and the only one
        // that can express "any site may embed this".
        //
        // Framing here is safe because /embed/[slug] is public, read-only
        // chrome around a chat, gated on the persona's own `embed` capability.
        // It exposes nothing an anonymous visitor couldn't already reach.
        source: '/embed/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // Everything else stays un-framable. The negative lookahead is what
        // keeps DENY off /embed — a later, more specific rule would not
        // override an earlier DENY, both headers would be sent.
        source: '/((?!embed/).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default config;
