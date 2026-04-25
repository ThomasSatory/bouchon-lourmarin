FROM node:20-alpine

WORKDIR /app

# Install server dependencies first (better layer cache)
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev

# Copy the rest of the site
COPY index.html robots.txt sitemap.xml ./
COPY assets/ ./assets/
COPY css/    ./css/
COPY js/     ./js/
COPY admin/  ./admin/
COPY server/ ./server/

# Data and uploads live in volumes
RUN mkdir -p /app/server/data /app/assets/uploads \
 && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://localhost:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", "server/server.js"]
