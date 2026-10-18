# Production image: API plus the built React app, served from one origin.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci
COPY server server
COPY client client
RUN npm --workspace @pathforge/server run build && npm --workspace @pathforge/client run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV CLIENT_DIST=/app/client/dist
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --workspace @pathforge/server --omit=dev --include-workspace-root
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
EXPOSE 4000
CMD ["node", "server/dist/index.js"]
