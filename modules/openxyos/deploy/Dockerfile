FROM node:20.19-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/patch-express-types.cjs ./scripts/patch-express-types.cjs
RUN npm ci
COPY vite.config.ts tsconfig.json ./
COPY frontend ./frontend
COPY backend ./backend
RUN npm run build

FROM node:20.19-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/backend ./backend
COPY --from=build /app/dist ./dist
COPY deploy/docker-entrypoint.sh /usr/local/bin/xyos-entrypoint
RUN apt-get update \
  && apt-get install --no-install-recommends -y gosu \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 --create-home --home-dir /app xyos \
  && mkdir -p /app/uploads /app/backend/data \
  && chown -R xyos:xyos /app \
  && chmod 0755 /usr/local/bin/xyos-entrypoint
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/xyos-entrypoint"]
CMD ["node", "--import", "tsx", "backend/server.ts"]
