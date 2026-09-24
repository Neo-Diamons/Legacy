FROM node:24-slim AS base

FROM base AS builder

RUN apt-get update && \
        apt-get install -y --no-install-recommends python3 make g++ && \
        rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package*.json ./

COPY backend/package.json backend/tsconfig.json ./backend/
COPY backend/src ./backend/src
COPY backend/drizzle ./backend/drizzle
COPY backend/drizzle.config.ts ./backend/


RUN npm ci --workspace=backend && \
    npm run build --workspace=backend && \
    npm prune --production

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

COPY --from=builder --chown=hono:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:nodejs /app/backend/dist /app/dist
COPY --from=builder --chown=hono:nodejs /app/backend/drizzle /app/drizzle

RUN mkdir -p /app/data && chown hono:nodejs /app/data

USER hono
EXPOSE 3000

CMD ["node", "/app/dist/index.mjs"]