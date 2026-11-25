FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY app/package.json app/package.json
COPY server/package.json server/package.json

ENV DATABASE_URL=file:/data/convergencia.db
RUN npm ci

COPY catalog catalog
COPY src src
COPY server server

RUN npm run prisma:generate -w convergencia-server \
  && chmod +x server/docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/app/server/docker-entrypoint.sh"]
