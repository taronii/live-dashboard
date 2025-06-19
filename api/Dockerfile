# Production Dockerfile for api service
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force;
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","server.js"]
