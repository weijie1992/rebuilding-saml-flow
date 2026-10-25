# --- build stage: compile TypeScript ---
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime stage: production deps + compiled JS + Prisma migrations ---
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
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# Fetch Prisma's native schema engine now, at build time, so container start
# never depends on the network. Fails the build loudly if it can't download.
RUN ./node_modules/.bin/prisma --version
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY --from=build /app/dist ./dist
EXPOSE 4000
# Apply any pending migrations, then start the server.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node --enable-source-maps dist/server.js"]
