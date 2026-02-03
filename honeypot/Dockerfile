# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src ./src
COPY config ./config

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S clawtrap && \
    adduser -S clawtrap -u 1001 -G clawtrap

# Install runtime dependencies
RUN apk add --no-cache \
    tini \
    curl \
    && rm -rf /var/cache/apk/*

# Copy built application
COPY --from=builder --chown=clawtrap:clawtrap /app/dist ./dist
COPY --from=builder --chown=clawtrap:clawtrap /app/node_modules ./node_modules
COPY --from=builder --chown=clawtrap:clawtrap /app/config ./config
COPY --chown=clawtrap:clawtrap package.json ./

# Create logs directory
RUN mkdir -p /app/logs && chown clawtrap:clawtrap /app/logs

# Create data directory for GeoIP databases
RUN mkdir -p /app/data/geoip && chown clawtrap:clawtrap /app/data/geoip

# Switch to non-root user
USER clawtrap

# Environment variables
ENV NODE_ENV=production
ENV CLAWTRAP_LOG_BACKEND=file

# Expose ports
EXPOSE 443 18789

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${CLAWTRAP_HTTP_PORT:-443}/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "dist/index.js"]
