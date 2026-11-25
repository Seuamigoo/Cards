#!/bin/sh
set -eu
mkdir -p /data/uploads
cd /app/server
npx prisma db push --skip-generate --accept-data-loss
cd /app
npx tsx server/src/seed.ts
exec npx tsx server/src/index.ts
