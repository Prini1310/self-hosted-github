FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
RUN mkdir -p storage/repos storage/locks storage/.mutex
EXPOSE 3000
CMD ["node", "src/app.js"]
