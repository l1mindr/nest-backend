# syntax=docker/dockerfile:1

FROM node:22-alpine AS base

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS dependencies
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm run build

FROM dependencies AS production-dependencies
RUN pnpm prune --prod --ignore-scripts

FROM dependencies AS development
COPY . .
CMD ["pnpm", "run", "start:dev"]

FROM dependencies AS test
COPY . .
CMD ["pnpm", "run", "test"]

# Keep production last so an untargeted `docker build` creates the runtime image.
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node

EXPOSE 8080

STOPSIGNAL SIGTERM

CMD ["node", "dist/main.js"]
