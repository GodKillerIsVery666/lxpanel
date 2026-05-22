FROM node:24-alpine AS deps
WORKDIR /opt/lxpanel
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build
RUN npm prune --omit=dev --workspaces

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    LXPANEL_HOST=0.0.0.0 \
    LXPANEL_PORT=7080 \
    LXPANEL_DATA_DIR=/var/lib/lxpanel \
    LXPANEL_WEB_ROOT=/opt/lxpanel/apps/web/dist
WORKDIR /opt/lxpanel
COPY --from=build /opt/lxpanel/package.json /opt/lxpanel/package-lock.json ./
COPY --from=build /opt/lxpanel/node_modules ./node_modules
COPY --from=build /opt/lxpanel/apps/api/package.json ./apps/api/package.json
COPY --from=build /opt/lxpanel/apps/api/dist ./apps/api/dist
COPY --from=build /opt/lxpanel/apps/web/dist ./apps/web/dist
COPY --from=build /opt/lxpanel/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /opt/lxpanel/packages/shared/dist ./packages/shared/dist
RUN addgroup -S lxpanel && adduser -S lxpanel -G lxpanel && mkdir -p /var/lib/lxpanel && chown -R lxpanel:lxpanel /var/lib/lxpanel /opt/lxpanel
USER lxpanel
EXPOSE 7080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:7080/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]
