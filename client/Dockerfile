# Stage 1: Build React SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared constants
COPY shared ./shared

# Copy client packages
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install

# Copy client source code
COPY client/ ./
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built static files
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
