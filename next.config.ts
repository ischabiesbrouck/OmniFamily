import type { NextConfig } from 'next';

// D1: the product surface is client components only. Do not enable Server Actions.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
