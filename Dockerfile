# syntax=docker/dockerfile:1

# Imagen para cedis-ctrl-react (Next.js 16 + React 19).
# Build multi-etapa: la imagen final solo lleva el output `standalone`,
# sin pnpm, sin devDependencies y sin código fuente.
#
# Node 22 y pnpm 10 para igualar el CI (.github/workflows/ci.yml).

ARG NODE_VERSION=22-alpine
ARG PNPM_VERSION=10

# ---------------------------------------------------------------------------
# Base: Node + pnpm
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
ARG PNPM_VERSION
RUN apk add --no-cache libc6-compat \
    && npm install --global pnpm@${PNPM_VERSION}
ENV PNPM_HOME=/pnpm \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---------------------------------------------------------------------------
# deps: node_modules completos (incluye devDependencies, las necesita el build)
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# builder: verificación de tipos + build de producción
# ---------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next.config.mjs tiene `typescript.ignoreBuildErrors: true`, así que
# `next build` no falla ante errores de tipo. Esta es la única reja real.
# Se puede desactivar con --build-arg VERIFICAR_TIPOS=false.
ARG VERIFICAR_TIPOS=true
RUN if [ "$VERIFICAR_TIPOS" = "true" ]; then pnpm exec tsc --noEmit; fi

# Next inlina las NEXT_PUBLIC_* en el bundle durante el build: son build args,
# no variables de runtime. Sin ellas la imagen queda en modo demostración
# (sin login, con datos seed).
ARG NEXT_PUBLIC_ENTRA_CLIENT_ID=
ARG NEXT_PUBLIC_ENTRA_TENANT_ID=
ARG NEXT_PUBLIC_ENTRA_REDIRECT_URI=
ARG NEXT_PUBLIC_FABRIC_GRAPHQL_ENDPOINT=
ENV NEXT_PUBLIC_ENTRA_CLIENT_ID=$NEXT_PUBLIC_ENTRA_CLIENT_ID \
    NEXT_PUBLIC_ENTRA_TENANT_ID=$NEXT_PUBLIC_ENTRA_TENANT_ID \
    NEXT_PUBLIC_ENTRA_REDIRECT_URI=$NEXT_PUBLIC_ENTRA_REDIRECT_URI \
    NEXT_PUBLIC_FABRIC_GRAPHQL_ENDPOINT=$NEXT_PUBLIC_FABRIC_GRAPHQL_ENDPOINT

# DOCKER_BUILD activa `output: 'standalone'` en next.config.mjs sin alterar
# el build de Vercel, que despliega desde main sin esta variable.
ENV DOCKER_BUILD=1
RUN pnpm build

# ---------------------------------------------------------------------------
# runner: imagen final
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

# El usuario `node` (uid 1000) ya viene en la imagen oficial.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

# Pega a un archivo estático de /public: no toca la API de Fabric.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/icon.svg').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# server.js lo genera el output standalone de Next.
CMD ["node", "server.js"]
