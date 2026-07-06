FROM node:22-alpine AS base

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./

FROM base AS deps
RUN yarn install --immutable

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["yarn", "start:dev"]

FROM base AS test
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["yarn", "test"]