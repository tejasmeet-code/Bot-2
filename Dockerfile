# Production Dockerfile for Relosta Discord Bot
# Targeted for US Virginia Hosting (Fly.io iad / AWS us-east-1 / Ashburn VPS)
FROM node:22-bullseye-slim AS base

# Install OS dependencies for Canvas & Voice
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    ffmpeg \
    python3 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable Corepack and pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/api-zod/package.json* ./lib/api-zod/
COPY lib/db/package.json* ./lib/db/
COPY scripts/package.json* ./scripts/

# Install pnpm dependencies
RUN pnpm install --no-frozen-lockfile

# Copy application source
COPY . .

# Build the project
RUN npx pnpm run build

# Expose HTTP port for Healthchecks & Web Dashboard
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Persistent storage volume for bot JSON files
VOLUME ["/app/.data"]

CMD ["node", "--dns-result-order=ipv4first", "index.js"]
