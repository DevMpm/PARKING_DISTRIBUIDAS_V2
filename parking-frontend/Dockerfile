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
# Config con proxy /api y /sse hacia Kong + fallback SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
