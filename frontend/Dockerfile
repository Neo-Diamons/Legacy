FROM node:24-alpine AS base

FROM base AS builder

RUN apk add --no-cache gcompat curl
WORKDIR /app

COPY package*.json ./
COPY frontend/package.json \
    frontend/tsconfig.*json \
    frontend/vite.config.ts \
    frontend/index.html \
    frontend/
COPY frontend/src \
    frontend/src/

RUN npm ci --workspace=frontend && \
    npm run build --workspace=frontend && \
    npm prune --production

FROM base AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 react

COPY --from=builder --chown=react:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=react:nodejs /app/frontend/dist /app/dist

USER react
EXPOSE 5173

ENV NODE_ENV=production

CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "5173"]