FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Dev: source is bind-mounted at runtime, only node_modules is baked in.
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
# DOCKER_DEV switches next.config.ts to a polling file watcher (Turbopack);
# WATCHPACK_POLLING is the same thing for `next dev --webpack`.
ENV DOCKER_DEV=1 WATCHPACK_POLLING=true
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
