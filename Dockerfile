# AI721 SchoolX CM — image de production (multi-architecture : amd64 et arm64)
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data NODE_OPTIONS=--no-warnings
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY public ./public
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "server/index.js"]
