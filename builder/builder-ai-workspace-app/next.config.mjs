/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/builder/builder-ai-workspace-app',
  assetPrefix: '/builder/builder-ai-workspace-app',
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
