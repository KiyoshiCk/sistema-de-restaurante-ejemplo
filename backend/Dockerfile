FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY server.js ./

# Crear directorio para datos
RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "server.js"]
