# ── build the PWA
FROM node:22-alpine AS web
WORKDIR /app
COPY scripts ./scripts
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci
COPY web ./web
RUN cd web && npm run build

# ── runtime: one Node process serves the PWA + WebSocket relay
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=web /app/web/dist ./web/dist
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "server/index.js"]
