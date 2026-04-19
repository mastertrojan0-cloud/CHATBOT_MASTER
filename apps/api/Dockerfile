# Etapa 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json yarn.lock ./
COPY tsconfig.base.json ./
COPY packages packages/
COPY apps apps/

# Install dependencies
RUN yarn install --frozen-lockfile --network-timeout 300000

# Generate Prisma client
RUN yarn workspace @flowdesk/db prisma generate

# Build packages
RUN yarn workspace @flowdesk/db build
RUN yarn workspace @flowdesk/shared build
RUN yarn workspace @flowdesk/engine build
RUN yarn workspace @flowdesk/api build

# Etapa 2: Runtime
FROM node:20-slim AS runner

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends libssl3 libstdc++6 ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages

# Environment
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Start server with ES module support for package.json "type": "module"
CMD ["node", "--experimental-require-module", "apps/api/dist/apps/api/src/server.js"]