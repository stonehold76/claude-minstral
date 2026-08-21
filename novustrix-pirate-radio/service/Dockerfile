# Novustrix Pirate Radio Service Dockerfile
# Multi-stage build for smaller final image

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY service/package.json service/package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install FFmpeg (required for audio encoding)
RUN apk add --no-cache ffmpeg libshout

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy built dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source code
COPY service/ ./

# Create directories
RUN mkdir -p /app/logs /app/tmp

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8082

# Expose port
EXPOSE 8082

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8082/health || exit 1

# Start the service
CMD ["node", "index.js"]
