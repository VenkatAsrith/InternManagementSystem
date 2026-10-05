FROM node:20-alpine

WORKDIR /app

# Copy root and shared if needed
COPY shared ./shared

# Copy server package files
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --production

# Copy server source code
COPY server/ ./

# Expose backend port
EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "src/server.js"]
