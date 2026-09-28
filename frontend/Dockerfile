FROM node:24-alpine AS builder

RUN apk add --no-cache gcompat
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
    npm run build --workspace=frontend

FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
