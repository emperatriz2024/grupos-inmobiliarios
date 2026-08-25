FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    RADAR_BRIDGE_MODE=test \
    RADAR_BRIDGE_RUNTIME_DIR=/data/radar-whatsapp-secondary \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates dumb-init gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY bridge/whatsapp-secondary/package.json bridge/whatsapp-secondary/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY bridge/whatsapp-secondary/ ./
COPY deploy/cloud-bridge/entrypoint.sh /usr/local/bin/radar-entrypoint
RUN chmod 0755 /usr/local/bin/radar-entrypoint \
    && mkdir -p /data/radar-whatsapp-secondary \
    && chown -R node:node /app /data

EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/dumb-init","--","/usr/local/bin/radar-entrypoint"]
CMD ["node","index.js"]
