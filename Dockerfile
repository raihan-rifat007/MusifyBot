FROM node:18-slim

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src
COPY public ./public

ENV NODE_ENV=production

EXPOSE 10000

CMD ["node", "src/index.js"]
