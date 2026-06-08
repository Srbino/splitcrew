import type { NextConfig } from 'next';

// Build-time version marker shown in the app menu. Evaluated on the build
// machine: commit SHA comes from Vercel, the date is the build timestamp.
const gitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local';
const buildDate = new Date().toISOString().slice(0, 10);

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: `${buildDate}·${gitSha}`,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
