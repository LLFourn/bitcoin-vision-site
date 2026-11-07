import type { NextConfig } from 'next';

// GitHub Pages serves a project site from /<repo>/; the deploy workflow sets
// this from actions/configure-pages. Empty for a user site, a custom domain,
// or local dev.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  // Plain static files: GitHub Pages has no server. The model runs in the
  // visitor's browser (public/vision/), so nothing needs one.
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
