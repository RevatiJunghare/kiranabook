FROM node:20-alpine

ENV NODE_ENV=production \
    TZ=Asia/Kolkata

WORKDIR /app

RUN apk add --no-cache tzdata wget

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-4000}/health || exit 1

CMD ["node", "src/index.js"]
