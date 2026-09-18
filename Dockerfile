# Favie — one image, two processes: web (`next start`) and the pg-boss worker (`tsx src/worker/index.ts`).
# Run it once as "web" and once as "worker", or let scripts/start-all.sh run both in one container.
#
# NEXT_PUBLIC_* values are compiled into the browser bundle, so they are BUILD arguments: an image is
# specific to one environment (one public URL, one Supabase project). Everything else is runtime env.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
# `next build` imports the route modules; the DB client refuses to load without a URL. Nothing connects at build time.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 FAVIE_DEV=0
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
# The worker and the maintenance scripts run TypeScript through tsx, so the sources and dev dependencies stay in the image.
COPY --from=build /app ./
EXPOSE 3000
# Default: web + worker in one container. Split deployments override the command:
#   web:    npx next start -p 3000
#   worker: sh scripts/worker-forever.sh
CMD ["sh", "scripts/start-all.sh"]
