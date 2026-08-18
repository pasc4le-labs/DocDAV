# syntax=docker/dockerfile:1
#
# DocDAV - SvelteKit docs platform (adapter-node).
# Build the SvelteKit SSR bundle in stage 1, ship a minimal production
# node_modules + the build output in stage 2.

# ---- Stage 1: build ----
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- Stage 2: runtime ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4323
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/build ./build
EXPOSE 4323
USER node
CMD ["node", "build/index.js"]
