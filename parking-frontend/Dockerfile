# ─────────── Etapa 1: build (compila la app Vite/React) ───────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─────────── Etapa 2: servir el build estático con NGINX ───────────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback: cualquier ruta desconocida sirve index.html (React Router)
RUN printf 'server {\n  listen 80;\n  location / {\n    root /usr/share/nginx/html;\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
