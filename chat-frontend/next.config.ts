import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next's rewrite proxy defaults to a 30s timeout (see
  // next/dist/server/lib/router-utils/proxy-request.js), which is shorter
  // than Claude's typical reply latency — raise it so /api/chat/* requests
  // aren't reset mid-reply.
  experimental: {
    proxyTimeout: 120_000,
  },
  async rewrites() {
    return [
      // Must precede the chat-service catch-all below — both mount at /api/extract.
      {
        source: '/api/extract/:path*',
        destination: `${process.env.EXTRACT_API_TARGET ?? 'http://localhost:8001'}/api/extract/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${process.env.API_TARGET ?? 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
