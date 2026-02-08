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
FROM node:20-alpine AS production

WORKDIR /app

# Add a non-root user for security
RUN addgroup -S mcp && adduser -S mcp -G mcp

# Copy package files and install production-only dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built output from builder stage
COPY --from=builder /app/dist/ ./dist/

# Create storage directory with correct ownership
RUN mkdir -p /app/storage && chown -R mcp:mcp /app/storage

# Switch to non-root user
USER mcp

# Expose HTTP transport port (configurable via PORT env var)
EXPOSE 3000

# Default to stdio transport for MCP client compatibility.
# Override with MCP_TEST_MODE="" to enable HTTP transport.
ENV MCP_TEST_MODE=stdio

# IMPORTANT: Do NOT bake secrets into the image.
# Pass them at runtime via --env-file or -e flags:
#   docker run --env-file .env google-researcher-mcp

CMD ["node", "dist/server.js"]
