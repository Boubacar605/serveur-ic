# syntax=docker/dockerfile:1

# --- Base -------------------------------------------------------------------
FROM node:24-alpine AS base

# openssl + libc6-compat are required by the Prisma query engine shipped for
# musl-based images. pnpm is pinned to the version declared in package.json.
RUN apk add --no-cache openssl libc6-compat \
  && npm install --global pnpm@10.28.1

WORKDIR /app

# --- Build dependencies -----------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Compilation ------------------------------------------------------------
FROM deps AS build

COPY prisma ./prisma
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN pnpm prisma generate \
  && pnpm build

# --- Runtime dependencies ---------------------------------------------------
FROM base AS prod-deps

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

# `prisma` and `@prisma/client` are production dependencies: the entrypoint
# runs `prisma migrate deploy`, and the generated client must match the schema.
RUN pnpm install --frozen-lockfile --prod \
  && pnpm prisma generate

# --- Runtime ----------------------------------------------------------------
FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package.json ./

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('net').connect(process.env.PORT || 3000, '127.0.0.1').on('connect', () => process.exit(0)).on('error', () => process.exit(1))"

# Migrations are applied once at startup, then the process is replaced so it
# receives container signals (SIGTERM) directly.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/main"]
