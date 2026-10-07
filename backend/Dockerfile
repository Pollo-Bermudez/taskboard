# ---------- Etapa 1: dependencias de producción ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Se eliminan docs, mapas y tipos: no se usan en runtime y reducen la imagen final.
RUN npm ci --omit=dev \
 && find node_modules -type f \( -name '*.md' -o -name '*.map' -o -name '*.ts' -o -name '*.markdown' \) -delete \
 && rm -rf node_modules/.package-lock.json

# ---------- Etapa opcional: pruebas (docker compose --profile test) ----------
FROM node:20-alpine AS test
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "test"]

# ---------- Etapa 2: ejecución ----------
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=app:app package.json ./
COPY --chown=app:app src ./src
COPY --chown=app:app migrations ./migrations
USER app
EXPOSE 3000
CMD ["node", "src/server.js"]
