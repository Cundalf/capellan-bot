# Use official Bun image
FROM oven/bun:1 AS base

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Create necessary directories and set permissions
RUN mkdir -p database/wh40k-documents database/backups logs exports && \
    [ ! -f database/inquisidores.json ] && echo '{}' > database/inquisidores.json || true && \
    chown -R bun:bun /app

# Switch to non-root user
USER bun

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD bun --version || exit 1

# Set environment to production
ENV NODE_ENV=production

# Start the bot
CMD ["bun", "start"]