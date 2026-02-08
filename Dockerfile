# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and build configuration
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────
# Using node:20-slim (Debian) instead of Alpine because Playwright/Chromium
# requires glibc and system libraries not available on Alpine.
FROM node:20-slim AS production

WORKDIR /app

# Install Playwright Chromium system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Add a non-root user for security
RUN groupadd -r mcp && useradd -r -g mcp mcp

# Copy package files and install production-only dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Install only Chromium browser for Playwright
RUN npx playwright install chromium

# Copy built output from builder stage
COPY --from=builder /app/dist/ ./dist/

# Create storage directory with correct ownership
RUN mkdir -p /app/storage && chown -R mcp:mcp /app/storage

# Switch to non-root user
USER mcp

# Expose HTTP transport port (configurable via PORT env var)
EXPOSE 3000

# Health check for container orchestrators (Docker, Kubernetes).
# Only effective when running in HTTP transport mode.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Default to stdio transport for MCP client compatibility.
# Override with MCP_TEST_MODE="" to enable HTTP transport.
ENV MCP_TEST_MODE=stdio

# IMPORTANT: Do NOT bake secrets into the image.
# Pass them at runtime via --env-file or -e flags:
#   docker run --env-file .env google-researcher-mcp

CMD ["node", "dist/server.js"]
