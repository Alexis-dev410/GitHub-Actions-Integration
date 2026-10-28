FROM node:22-bookworm AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# The test target includes development dependencies and the supplied tests.
FROM dependencies AS test
COPY . .
CMD ["npm", "test"]

FROM test AS build
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 5000
CMD ["node", "dist/server.js"]
