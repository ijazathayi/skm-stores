/** @type {import('next').NextConfig} */
const nextConfig = {
  // All pages use client-side Firebase — no SSR issues
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;
