FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium RADAR_COLLECTOR_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8787
CMD ["npm","start"]
