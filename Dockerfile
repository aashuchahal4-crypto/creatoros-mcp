FROM node:18-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --silent || true

COPY . .

ENTRYPOINT ["node", "bin/cli.js"]
