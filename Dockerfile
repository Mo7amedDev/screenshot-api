# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build
RUN cp -r src/services/fonts dist/services/fonts

# ── Stage 2: Runtime (clean slate, no tsc / tsx / dev deps) ──────────────────
FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS runtime
WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Copy only compiled output from builder stage
COPY --from=builder /app/dist ./dist

RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 3000
CMD ["node", "--max-old-space-size=2048", "dist/cluster.js"]