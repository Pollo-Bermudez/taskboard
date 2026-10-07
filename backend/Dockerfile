# ---------- Etapa 1: dependencias de producción ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Se eliminan docs, mapas y tipos: no se usan en runtime y reducen la imagen final.
RUN npm ci --omit=dev \
 && find node_modules -type f \( -name '*.md' -o -name '*.map' -o -name '*.ts' -o -name '*.markdown' \) -delete \
 && find node_modules -type d \( -name test -o -name tests -o -name example -o -name examples \) -prune -exec rm -rf {} + \
 && rm -rf node_modules/.package-lock.json

# ---------- Etapa opcional: pruebas (docker compose --profile test) ----------
FROM node:20-alpine AS test
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "test"]

# ---------- Etapa 2: base de ejecución ----------
# Parte de node:20-alpine y elimina npm, npx, corepack y yarn: no se usan en runtime
# y son superficie de ataque. Se aplana en una sola capa para que el borrado reduzca
# realmente el tamaño (con capas apiladas los archivos seguirían en la capa base).
FROM node:20-alpine AS runtime-base
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-* \
 && addgroup -S app && adduser -S app -G app

# ---------- Etapa 3: ejecución ----------
FROM scratch
COPY --from=runtime-base / /
ENV NODE_ENV=production \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=app:app package.json ./
COPY --chown=app:app src ./src
COPY --chown=app:app migrations ./migrations
USER app
EXPOSE 3000
CMD ["node", "src/server.js"]
