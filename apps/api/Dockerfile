# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: base — Node + pnpm
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN npm install -g pnpm@10.28.0
WORKDIR /app

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: deps — instalar dependencias del monorepo
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps

# Copiar manifiestos de pnpm (necesarios para install)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

# Instalar solo las dependencias necesarias para el API
RUN pnpm install --frozen-lockfile --filter @podoplus/api...

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: builder — compilar el API
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS builder

COPY --from=deps /app ./

# Copiar código fuente completo del API y paquetes compartidos
COPY apps/api/ ./apps/api/
COPY packages/ ./packages/
COPY tsconfig.base.json ./

# Generar Prisma client
RUN pnpm --filter @podoplus/api exec prisma generate

# Compilar NestJS
RUN pnpm --filter @podoplus/api build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 4: runner — imagen de producción (mínima)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN npm install -g pnpm@10.28.0
WORKDIR /app

ENV NODE_ENV=production

# Copiar artefactos de build
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./local_modules

# Instalar solo dependencias de producción (sin devDependencies)
RUN pnpm install --prod --ignore-scripts 2>/dev/null || true

# Script de entrada: correr migraciones y luego arrancar
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
