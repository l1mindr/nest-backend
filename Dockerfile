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

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["pnpm", "run", "start:dev"]

FROM base AS test
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["pnpm", "run", "test"]
