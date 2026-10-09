# ---------- Etapa 1: construcción ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Etapa 2: ejecución (NGINX sin privilegios) ----------
FROM nginx:1.27-alpine
ENV BACKEND_HOST=backend \
    BACKEND_PORT=3000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    NGINX_ENVSUBST_FILTER=^(BACKEND_|NGINX_LOCAL_RESOLVERS)
# El usuario nginx necesita escribir caché, PID y la config generada desde la plantilla.
RUN sed -i 's,^pid .*,pid /tmp/nginx.pid;,; /^user /d' /etc/nginx/nginx.conf \
 && rm /etc/nginx/conf.d/default.conf \
 && chown -R nginx:nginx /var/cache/nginx /etc/nginx/conf.d
COPY templates /etc/nginx/templates
COPY snippets /etc/nginx/snippets
COPY --from=build /app/dist /usr/share/nginx/html
# UID numérico para que Kubernetes pueda verificar runAsNonRoot.
USER 101:101
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
