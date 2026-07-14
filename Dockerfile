FROM node:22-alpine AS base

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS deps
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# Production-only dependencies (no devDependencies) for a slim runtime image.
FROM base AS prod-deps
RUN pnpm install --prod --frozen-lockfile

# Minimal production runtime: compiled dist + prod node_modules only.
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
USER node
CMD ["node", "dist/main"]

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["pnpm", "run", "start:dev"]

FROM base AS test
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["pnpm", "run", "test"]
