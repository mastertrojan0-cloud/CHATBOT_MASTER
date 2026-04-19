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
FROM node:20-alpine AS runner

WORKDIR /app

# Copy only necessary files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/package.json ./package.json

# Install production dependencies only
WORKDIR /app/apps/api
COPY package.json ./
RUN npm install --omit=dev --omit=peer

# Environment
ENV NODE_ENV=production
ENV PORT=8080
# Build timestamp: 2026-04-19
EXPOSE 8080

# Start
CMD ["node", "dist/apps/api/src/server.js"]