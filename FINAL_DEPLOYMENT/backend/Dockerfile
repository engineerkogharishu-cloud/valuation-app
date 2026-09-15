# Backend container image. Build context is FINAL_DEPLOYMENT/backend.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies from the lock file for a reproducible image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./

# Run unprivileged. The `node` user ships with the official image.
USER node

EXPOSE 3001
CMD ["node", "server.js"]
