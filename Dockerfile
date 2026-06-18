FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm run build:server

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist-server/server.js"]
