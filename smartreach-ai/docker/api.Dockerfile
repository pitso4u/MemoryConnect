FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps
COPY tsconfig.base.json ./

FROM base AS deps
RUN npm ci --workspaces --include-workspace-root

FROM deps AS build
RUN npm run build -w @smartreach/common -w @smartreach/ai -w @smartreach/social -w @smartreach/scheduler -w @smartreach/analytics -w @smartreach/publish -w @smartreach/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=deps /app/apps/api/package.json ./apps/api/package.json
WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
