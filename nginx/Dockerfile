# ── Stage 1: Build client ─────────────────────────────────────────
FROM node:20-alpine AS client-build
WORKDIR /app
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# ── Stage 2: Nginx with built client ─────────────────────────────
FROM nginx:alpine
COPY --from=client-build /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
