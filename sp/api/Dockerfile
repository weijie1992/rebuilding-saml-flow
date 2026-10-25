# Build context is ./sp (see docker-compose.yml), so paths are web/... and api/...

# --- stage 1: build the React SPA ---
FROM node:22-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- stage 2: compile the API ---
FROM node:22-slim AS api-build
WORKDIR /api
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/tsconfig.json ./
COPY api/src ./src
RUN npm run build

# --- stage 3: runtime — the API serves the built SPA from /app/web-dist ---
FROM node:22-slim
# Prisma's schema engine (used by `migrate deploy`) needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# Optional extra CAs, e.g. for a TLS-inspecting corporate proxy such as
# Cloudflare Gateway. Any *.crt in ./shared/certs is trusted (empty = no-op).
COPY --from=certs . /usr/local/share/ca-certificates/extra/
RUN update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
# Run as the unprivileged node user, and let it own /app: Prisma writes
# engine files under node_modules at run time.
RUN mkdir /app && chown node:node /app
WORKDIR /app
USER node
ENV NODE_ENV=production
# No Prisma update checks or upgrade banners at run time.
ENV CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1
ENV WEB_DIST=/app/web-dist
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev
# Fetch Prisma's native schema engine now, at build time, so container start
# never depends on the network. Fails the build loudly if it can't download.
RUN ./node_modules/.bin/prisma --version
COPY api/prisma.config.ts ./
COPY api/prisma ./prisma
COPY --from=api-build /api/dist ./dist
COPY --from=web /web/dist ./web-dist
EXPOSE 3000
# Apply any pending migrations, then start the server.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node --enable-source-maps dist/server.js"]
