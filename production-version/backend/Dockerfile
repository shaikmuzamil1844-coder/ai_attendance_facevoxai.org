# ─────────────────────────────────────────────
# FaceVoxAI Backend — Dockerfile
# Node.js 22 Alpine (production)
# ─────────────────────────────────────────────
FROM node:22-alpine AS base

WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy source
COPY src/ ./src/
COPY .env.example ./.env.example

EXPOSE 4000

CMD ["node", "src/index.js"]
