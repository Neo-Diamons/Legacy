FROM node:22 AS builder

WORKDIR /app

COPY package*.json .

RUN npm install

COPY . .

ENV SQLITE_DB_LOCATION="./todo.db"

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html