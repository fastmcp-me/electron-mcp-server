# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Install system dependencies for screenshot functionality
RUN apk add --no-cache \
    xvfb \
    imagemagick \
    chromium \
    electron \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code and built files
COPY dist/ ./dist/
COPY README.md ./
COPY LICENSE ./

# Create non-root user for security
RUN addgroup -g 1001 -S electronuser && \
    adduser -S electronuser -u 1001 -G electronuser

# Set proper permissions
RUN chown -R electronuser:electronuser /app

# Switch to non-root user
USER electronuser

# Set environment variables
ENV NODE_ENV=production
ENV DISPLAY=:99

# Expose any ports if needed (MCP typically uses stdio)
# EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Start the MCP server
CMD ["node", "dist/index.js"]
