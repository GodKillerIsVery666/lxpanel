# LXPanel Server Docker 镜像
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/ apps/
COPY packages/ packages/
COPY scripts/ scripts/
COPY tsconfig.json ./
RUN npm ci && npm run build

FROM node:24-alpine AS production
WORKDIR /app
RUN apk add --no-cache tini postgresql-client mysql-client mariadb-client
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/api/dist/ ./apps/api/dist/
COPY --from=builder /app/apps/web/dist/ ./apps/web/dist/
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/scripts/ ./scripts/
ENV NODE_ENV=production
ENV LXPANEL_WEB_ROOT=/app/apps/web/dist
EXPOSE 7080
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:7080/api/health/live || exit 1
ENTRYPOINT ["/sbin/tini", "--", "node", "apps/api/dist/server.js"]
