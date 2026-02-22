# Use Node.js LTS version
FROM node:20-alpine AS base

# Install dependencies for PostgreSQL client
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm install -D typescript @types/node && \
    npm run build && \
    npm prune --production

# Production stage
FROM node:20-alpine AS production

# Install PostgreSQL client for backups
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=base --chown=nodejs:nodejs /app/dist ./dist
COPY --from=base --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=nodejs:nodejs /app/package*.json ./

# Copy migration files and scripts
COPY --chown=nodejs:nodejs src/database/migrations ./src/database/migrations
COPY --chown=nodejs:nodejs scripts ./scripts
COPY --chown=nodejs:nodejs docker-entrypoint.sh ./

# Create necessary directories and set permissions (as root)
RUN mkdir -p logs uploads && \
    chmod +x docker-entrypoint.sh scripts/*.sh && \
    chown -R nodejs:nodejs logs uploads

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application with migrations
CMD ["./docker-entrypoint.sh"]
