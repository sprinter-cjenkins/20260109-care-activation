# Stage 1: Build
FROM node:20.19.5-alpine AS builder

ENV NODE_VERSION=20.19.5
ENV NPM_VERSION=10.8.2

WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the NestJS app
RUN npm run build

# TODO (push pathways in production)
# RUN npm run push-pathway

# Stage 2: Production image
FROM node:20.19.5-alpine

WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built app from builder
COPY --from=builder /app/dist ./dist

# Copy Prisma schema and generated client (needed at runtime)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# DATADOG
ARG DD_GIT_REPOSITORY_URL
ARG DD_GIT_COMMIT_SHA
ENV DD_GIT_REPOSITORY_URL=${DD_GIT_REPOSITORY_URL}
ENV DD_GIT_COMMIT_SHA=${DD_GIT_COMMIT_SHA}

# Expose the port
EXPOSE 3000

# Run the app
CMD ["node", "dist/src/main"]
