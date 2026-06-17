/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // yahoo-finance2 is a Node library; keep it external so it isn't bundled.
  experimental: {
    serverComponentsExternalPackages: ["yahoo-finance2"],
  },
};

export default nextConfig;
