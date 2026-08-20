# Matrix-FoundryVTT Bridge Dockerfile
# Customized for: GameMaster bot on thedagora.social
# Room: !ioIGXPMvsniZqjrndd:thedagora.social

FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/foundry-module ./foundry-module
COPY --from=builder /app/package.json .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose bridge port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the bridge
CMD ["node", "dist/index.js"]
