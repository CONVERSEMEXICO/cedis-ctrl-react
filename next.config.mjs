/** @type {import('next').NextConfig} */
const nextConfig = {
  // El Dockerfile define DOCKER_BUILD=1 para emitir `.next/standalone`
  // (server.js + solo las dependencias usadas). Vercel despliega sin esa
  // variable, así que su build no cambia.
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
  // `next dev` de Next 16 agrega su propio bloque al final de CLAUDE.md en cada
  // arranque. Ese archivo se mantiene a mano (ver "Flujo con v0"): apagado.
  agentRules: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
