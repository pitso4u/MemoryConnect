FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps
COPY tsconfig.base.json ./

FROM base AS deps
RUN npm ci --workspaces --include-workspace-root

FROM deps AS build
RUN npm run build -w @smartreach/common -w @smartreach/social -w @smartreach/publish -w @smartreach/worker

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=deps /app/apps/worker/package.json ./apps/worker/package.json
WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]
