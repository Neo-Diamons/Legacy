FROM node:24 AS base

FROM base AS builder

WORKDIR /app

COPY package*.json tsconfig.json vite.config.ts ./

RUN npm i

COPY index.html src/ ./

RUN npm run build


FROM base as runner

WORKDIR /app

COPY --from=builder  /app/dist /app/dist

EXPOSE 5173

CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "5173"]