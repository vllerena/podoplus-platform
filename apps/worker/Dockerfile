# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: base
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN npm install -g pnpm@10.28.0
WORKDIR /app

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: deps
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile --filter @podoplus/worker...

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: builder
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS builder

COPY --from=deps /app ./

COPY apps/worker/ ./apps/worker/
COPY apps/api/prisma/ ./apps/api/prisma/
COPY packages/ ./packages/
COPY tsconfig.base.json ./

# Generar Prisma client usando el schema del API
RUN pnpm --filter @podoplus/worker exec prisma generate --schema=../../apps/api/prisma/schema.prisma

# Compilar TypeScript
RUN pnpm --filter @podoplus/worker build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 4: runner
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/apps/worker/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

CMD ["node", "dist/main.js"]
