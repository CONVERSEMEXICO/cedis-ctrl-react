/** @type {import('next').NextConfig} */
const nextConfig = {
  // El Dockerfile define DOCKER_BUILD=1 para emitir `.next/standalone`
  // (server.js + solo las dependencias usadas). Vercel despliega sin esa
  // variable, así que su build no cambia.
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
