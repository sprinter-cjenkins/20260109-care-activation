# Stage 1: Build
FROM node:20.19.5-alpine AS base

ENV NODE_VERSION=20.19.5
ENV NPM_VERSION=10.8.2

# for building prisma
ENV DATABASE_URL="mysql://root:dev@127.0.0.1:3306/db_test"
ENV SHADOW_DATABASE_URL="mysql://root:dev@127.0.0.1:3306/prisma_migrate_shadow"

WORKDIR /app

# Reused libraries across our images
COPY prisma ./prisma
COPY shared ./shared

FROM base AS server_builder

WORKDIR /app/server

# Copy package files
COPY server/package*.json ./

RUN npm install --install-links

# Copy source code
COPY ./server .

# Build the NestJS app
RUN npm run build

# TODO (push pathways in production)
# RUN npm run push-pathway

# Stage 2: Production image
FROM base

WORKDIR /app/server

# Copy only production dependencies
COPY ./server/package*.json ./
RUN npm install --omit=dev --install-links

# Copy built app from builder
COPY --from=server_builder /app/server/dist ./dist

# Copy Prisma schema and generated client (needed at runtime)
# COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# COPY --from=builder /app/prisma ./prisma

# DATADOG
ARG DD_GIT_REPOSITORY_URL
ARG DD_GIT_COMMIT_SHA
ENV DD_GIT_REPOSITORY_URL=${DD_GIT_REPOSITORY_URL}
ENV DD_GIT_COMMIT_SHA=${DD_GIT_COMMIT_SHA}

# Expose the port
EXPOSE 3000

# Run the app
CMD ["node", "dist/src/main"]
